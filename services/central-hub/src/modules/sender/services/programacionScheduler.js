/**
 * Servicio que ejecuta el envío de campañas según la programación
 *
 * ARQUITECTURA CONTRACT-BASED:
 * - Consulta Session Manager ANTES de cada ejecución
 * - NO asume estado de sesión
 * - NO cachea estado entre ejecuciones
 * - Aborta si session.status !== 'READY'
 *
 * Control de gobierno:
 * - Envíos automáticos BLOQUEADOS por flag AUTO_CAMPAIGNS_ENABLED
 * - NO ejecuta en entornos test/development
 */

const env = require('../../../config/environment');
const connection = require('../db/connection');
const {
  sessionManagerClient,
  SessionManagerTimeoutError,
  SessionManagerUnreachableError,
  SessionManagerSessionNotReadyError,
  SessionManagerWhatsAppError,
  SessionManagerValidationError
} = require('../../../integrations/sessionManager');
const { cambiarEstado } = require('./estadoService');

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const PROCESS_INTERVAL_MS = 60 * 1000; // cada minuto

// Delay anti-spam entre mensajes (30-90 segundos)
// Valores conservadores para evitar detección de automatización
const DEFAULT_SEND_DELAY_MIN = 30000;  // 30 segundos
const DEFAULT_SEND_DELAY_MAX = 90000;  // 90 segundos (1.5 minutos)

// Identificador único de instancia (locking)
const INSTANCE_ID = `${require('os').hostname()}_${process.pid}_${Date.now()}`;

let processing = false;

/* =========================
   DIAGNÓSTICO OPERATIVO
   ========================= */
// Activar con: export DIAG_SENDER=1 en entorno PM2
const DIAG_ENABLED = process.env.DIAG_SENDER === '1';

function diagLog(prefix, data) {
  if (!DIAG_ENABLED) return;
  console.log(`[DIAG_SENDER] ${prefix}`, JSON.stringify(data, null, 2));
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* =========================
   LOCKING
   ========================= */
async function acquireProgramacionLock(programacionId, instanceId) {
  const [result] = await connection.query(
    'UPDATE ll_programaciones SET locked_at = NOW(), locked_by = ? WHERE id = ? AND locked_at IS NULL',
    [instanceId, programacionId]
  );
  return result.affectedRows === 1;
}

async function releaseProgramacionLock(programacionId, instanceId) {
  await connection.query(
    'UPDATE ll_programaciones SET locked_at = NULL, locked_by = NULL WHERE id = ? AND locked_by = ?',
    [programacionId, instanceId]
  );
}

/* =========================
   UTILIDADES
   ========================= */
function getRandomSendDelay(config = {}) {
  const minDelay = config.minDelay || DEFAULT_SEND_DELAY_MIN;
  const maxDelay = config.maxDelay || DEFAULT_SEND_DELAY_MAX;
  return minDelay + Math.floor(Math.random() * (maxDelay - minDelay));
}

function dentroDeVentana(programacion, ahora) {
  const diaActual = DAY_KEYS[ahora.getDay()];
  const dias = (programacion.dias_semana || '')
    .split(',')
    .map((d) => d.trim().toLowerCase());

  if (!dias.includes(diaActual)) return false;

  const horaActual = ahora.toTimeString().slice(0, 8);
  return horaActual >= programacion.hora_inicio && horaActual <= programacion.hora_fin;
}

/* =========================
   DB QUERIES
   ========================= */
async function obtenerProgramacionesActivas() {
  const [rows] = await connection.query(
    `SELECT p.*
     FROM ll_programaciones p
     WHERE p.estado = 'aprobada'
       AND p.fecha_inicio <= CURDATE()
       AND (p.fecha_fin IS NULL OR p.fecha_fin >= CURDATE())`
  );
  return rows;
}

async function enviadosHoy(programacionId) {
  const [rows] = await connection.query(
    `SELECT enviados FROM ll_programacion_envios_diarios
     WHERE programacion_id = ? AND fecha = CURDATE()`,
    [programacionId]
  );
  return rows.length ? rows[0].enviados : 0;
}

async function incrementarConteo(programacionId, cantidad) {
  await connection.query(
    `INSERT INTO ll_programacion_envios_diarios (programacion_id, fecha, enviados)
     VALUES (?, CURDATE(), ?)
     ON DUPLICATE KEY UPDATE enviados = enviados + VALUES(enviados), actualizado_en = NOW()`,
    [programacionId, cantidad]
  );
}

async function obtenerPendientes(campaniaId, limite) {
  const [rows] = await connection.query(
    `SELECT id, telefono_wapp, mensaje_final, nombre_destino
     FROM ll_envios_whatsapp
     WHERE campania_id = ? AND estado = 'pendiente'
     ORDER BY id ASC
     LIMIT ?`,
    [campaniaId, limite]
  );
  return rows;
}

/* =========================
   PROCESAMIENTO
   ========================= */
async function procesarProgramacion(programacion) {
  const clienteId = Number(programacion.cliente_id);

  console.log(`🚀 PROCESANDO Programación ${programacion.id} - Campaña ${programacion.campania_id} - Cupo diario: ${programacion.cupo_diario}`);

  diagLog('🚀 INICIO', {
    programacion_id: programacion.id,
    campania_id: programacion.campania_id,
    cupo_diario: programacion.cupo_diario
  });

  let status;
  try {
    status = await sessionManagerClient.getStatus({ cliente_id: clienteId });
  } catch (error) {
    if (error instanceof SessionManagerTimeoutError) {
      console.error(`⏸️ Programación ${programacion.id}: Session Manager timeout`);
      return;
    }
    if (error instanceof SessionManagerUnreachableError) {
      console.error(`⏸️ Programación ${programacion.id}: Session Manager unreachable`);
      return;
    }
    console.error(`⏸️ Programación ${programacion.id}: Error consultando Session Manager`);
    return;
  }

  if (status.state !== 'READY' || !status.connected) {
    console.warn(`⏸️ Programación ${programacion.id}: WhatsApp no READY (${status.state})`);
    diagLog('⛔ ABORT: WhatsApp no READY', {
      programacion_id: programacion.id,
      state: status.state,
      connected: status.connected
    });
    return;
  }

  const [campaniaRows] = await connection.query(
    'SELECT id, nombre, estado FROM ll_campanias_whatsapp WHERE id = ?',
    [programacion.campania_id]
  );

  if (!campaniaRows.length || campaniaRows[0].estado !== 'en_progreso') {
    console.warn(`⛔ Programación ${programacion.id}: Campaña no habilitada`);
    diagLog('⛔ ABORT: Campaña no habilitada', {
      programacion_id: programacion.id,
      campania_id: programacion.campania_id,
      estado: campaniaRows[0]?.estado || 'NO_EXISTE'
    });
    return;
  }

  const enviados = await enviadosHoy(programacion.id);
  const disponible = programacion.cupo_diario - enviados;
  
  diagLog('📊 CUPO DIARIO', {
    programacion_id: programacion.id,
    cupo_total: programacion.cupo_diario,
    enviados_hoy: enviados,
    disponible: disponible
  });
  
  if (disponible <= 0) {
    diagLog('⛔ ABORT: Cupo agotado', {
      programacion_id: programacion.id,
      cupo_diario: programacion.cupo_diario,
      enviados_hoy: enviados
    });
    return;
  }

  const pendientes = await obtenerPendientes(programacion.campania_id, disponible);
  
  diagLog('📥 PENDIENTES OBTENIDOS', {
    programacion_id: programacion.id,
    campania_id: programacion.campania_id,
    limite_solicitado: disponible,
    pendientes_encontrados: pendientes.length,
    ids: pendientes.map(p => p.id)
  });
  
  if (!pendientes.length) {
    diagLog('⛔ ABORT: Sin pendientes', {
      programacion_id: programacion.id,
      campania_id: programacion.campania_id
    });
    return;
  }

  let enviadosExitosos = 0;
  let enviadosFallidos = 0;
  
  for (const envio of pendientes) {
    const destinatario = String(envio.telefono_wapp || '').replace(/\D/g, '');

    if (!destinatario) {
      console.error(`❌ Envío ${envio.id}: Teléfono inválido o vacío`);
      enviadosFallidos++;
      
      try {
        await cambiarEstado(
          { connection },
          envio.id,
          'error',
          'scheduler',
          '(TELEFONO_INVALIDO) Número de teléfono vacío o inválido'
        );
      } catch (estadoErr) {
        console.error(`❌ Error marcando estado de envío ${envio.id}:`, estadoErr.message);
      }
      
      continue;
    }

    const mensajePersonalizado = envio.mensaje_final
      .replace(/\{nombre\}/gi, envio.nombre_destino || '')
      .replace(/\{nombre_destino\}/gi, envio.nombre_destino || '')
      .trim();

    try {
      diagLog('📤 ENVIANDO', {
        envio_id: envio.id,
        telefono: destinatario,
        cliente_id: clienteId,
        nombre: envio.nombre_destino
      });
      
      const result = await sessionManagerClient.sendMessage({
        cliente_id: clienteId,
        to: destinatario,
        message: mensajePersonalizado
      });
      
      if (!result) {
        throw new Error('(INVALID_SEND_RESPONSE) sendMessage retornó null o undefined');
      }
      
      if (result.ok !== true) {
        throw new Error(`(INVALID_SEND_RESPONSE) sendMessage retornó ok=${result.ok}`);
      }
      
      if (!result.message_id) {
        throw new Error('(INVALID_SEND_RESPONSE) Falta message_id en respuesta');
      }
      
      await cambiarEstado(
        { connection },
        envio.id,
        'enviado',
        'scheduler',
        'Envío automático exitoso',
        { messageId: result.message_id }
      );
      
      enviadosExitosos++;
      
      diagLog('✅ ENVIADO', {
        envio_id: envio.id,
        telefono: destinatario,
        message_id: result.message_id
      });

      await delay(getRandomSendDelay());
      
    } catch (err) {
      enviadosFallidos++;
      
      let errorCode = 'UNKNOWN_ERROR';
      let errorMessage = err.message;
      
      if (err instanceof SessionManagerTimeoutError) {
        errorCode = 'SESSION_MANAGER_TIMEOUT';
      } else if (err instanceof SessionManagerUnreachableError) {
        errorCode = 'SESSION_MANAGER_UNREACHABLE';
      } else if (err instanceof SessionManagerSessionNotReadyError) {
        errorCode = 'SESSION_NOT_READY';
      } else if (err instanceof SessionManagerWhatsAppError) {
        errorCode = 'WHATSAPP_ERROR';
      } else if (err instanceof SessionManagerValidationError) {
        errorCode = 'VALIDATION_ERROR';
      } else if (err.message.includes('INVALID_SEND_RESPONSE')) {
        errorCode = 'INVALID_SEND_RESPONSE';
      } else if (err.message.includes('TELEFONO_INVALIDO')) {
        errorCode = 'TELEFONO_INVALIDO';
      }
      
      console.error(`❌ Envío ${envio.id} fallido (${errorCode}): ${errorMessage}`);
      
      try {
        await cambiarEstado(
          { connection },
          envio.id,
          'error',
          'scheduler',
          `(${errorCode}) ${errorMessage}`
        );
      } catch (estadoErr) {
        console.error(`❌ Error marcando estado de envío ${envio.id}:`, estadoErr.message);
      }
      
      diagLog('❌ ERROR sendMessage', {
        envio_id: envio.id,
        error_code: errorCode,
        error: errorMessage,
        telefono: destinatario
      });
    }
  }
  
  diagLog('🏁 RESUMEN FINAL', {
    programacion_id: programacion.id,
    campania_id: programacion.campania_id,
    pendientes_procesados: pendientes.length,
    enviados_exitosos: enviadosExitosos,
    enviados_fallidos: enviadosFallidos
  });

  // Incrementar contador diario
  if (enviadosExitosos > 0) {
    await incrementarConteo(programacion.id, enviadosExitosos);
    console.log(`📊 Contador diario actualizado: +${enviadosExitosos} envíos para programación ${programacion.id}`);
  }
}

/* =========================
   TICK (CON CORTE MAESTRO)
   ========================= */
async function tick() {
  if (!env.autoCampaignsEnabled) {
    console.warn('⛔ Scheduler activo pero envíos automáticos DESHABILITADOS (AUTO_CAMPAIGNS_ENABLED=false)');
    return;
  }

  if (processing) return;
  processing = true;

  try {
    const ahora = new Date();
    const programaciones = await obtenerProgramacionesActivas();

    console.log(`🕒 Scheduler tick: ${ahora.toISOString()} (hora local: ${ahora.toTimeString().slice(0, 8)})`);
    console.log(`📋 Programaciones encontradas: ${programaciones.map(p => p.id).join(', ')}`);

    for (const prog of programaciones) {
      const enVentana = dentroDeVentana(prog, ahora);
      console.log(`🔍 Programación ${prog.id}: dentroDeVentana=${enVentana} (dias_semana: ${prog.dias_semana}, hora_inicio: ${prog.hora_inicio}, hora_fin: ${prog.hora_fin})`);
      if (!enVentana) continue;

      console.log(`🔒 Intentando adquirir lock para programación ${prog.id}...`);
      const lock = await acquireProgramacionLock(prog.id, INSTANCE_ID);
      console.log(`🔒 Lock para programación ${prog.id}: ${lock ? 'ADQUIRIDO' : 'FALLÓ'}`);
      if (!lock) continue;

      try {
        console.log(`➡️  Llamando procesarProgramacion(${prog.id})...`);
        await procesarProgramacion(prog);
        console.log(`✅ procesarProgramacion(${prog.id}) completado`);
      } catch (error) {
        console.error(`❌ Error en procesarProgramacion(${prog.id}):`, error);
      } finally {
        console.log(`🔓 Liberando lock para programación ${prog.id}...`);
        await releaseProgramacionLock(prog.id, INSTANCE_ID);
        console.log(`🔓 Lock liberado para programación ${prog.id}`);
      }
    }
  } catch (err) {
    console.error('❌ Error en scheduler:', err);
  } finally {
    processing = false;
  }
}

/* =========================
   START
   ========================= */
function start() {
  // Guard: NO ejecutar scheduler en test
  if (env.isTest) {
    return;
  }

  // Guard: NO ejecutar si campañas automáticas deshabilitadas
  if (!env.autoCampaignsEnabled) {
    console.warn('⚠️  Scheduler iniciado pero AUTO_CAMPAIGNS_ENABLED=false');
  }

  setInterval(tick, PROCESS_INTERVAL_MS);
  tick();
}

/* =========================
   EXPORTS
   ========================= */
module.exports = {
  start,
  __test__: {
    procesarProgramacion,
    obtenerPendientes
  }
};
