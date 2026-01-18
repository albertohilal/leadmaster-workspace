/**
 * Servicio que ejecuta el envío de campañas según la programación
 * 
 * ARQUITECTURA CONTRACT-BASED:
 * - Consulta Session Manager ANTES de cada ejecución
 * - NO asume estado de sesión
 * - NO cachea estado entre ejecuciones
 * - Aborta si session.status !== 'connected'
 * 
 * Responsabilidades:
 * - Scheduler decide CUÁNDO ejecutar
 * - Session Manager decide SI puede ejecutar
 */

const connection = require('../db/connection');
const { 
  sessionManagerClient, 
  SessionManagerTimeoutError,
  SessionManagerUnreachableError
} = require('../../../integrations/sessionManager');

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const PROCESS_INTERVAL_MS = 60 * 1000; // cada minuto

// Configuración por defecto del delay anti-spam entre mensajes
// Mantiene compatibilidad hacia atrás: comportamiento idéntico al original (2-6s)
const DEFAULT_SEND_DELAY_MIN = 2000; // 2 segundos
const DEFAULT_SEND_DELAY_MAX = 6000; // 6 segundos

// Identificador único de esta instancia del scheduler (para locking concurrente)
const INSTANCE_ID = `${require('os').hostname()}_${process.pid}_${Date.now()}`;

let processing = false;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Adquiere lock atómico sobre una programación
 * @param {number} programacionId 
 * @param {string} instanceId
 * @returns {Promise<boolean>} true si se adquirió el lock
 */
async function acquireProgramacionLock(programacionId, instanceId) {
  const [result] = await connection.query(
    'UPDATE ll_programaciones SET locked_at = NOW(), locked_by = ? WHERE id = ? AND locked_at IS NULL',
    [instanceId, programacionId]
  );
  return result.affectedRows === 1;
}

/**
 * Libera lock de una programación
 * @param {number} programacionId
 * @param {string} instanceId
 */
async function releaseProgramacionLock(programacionId, instanceId) {
  await connection.query(
    'UPDATE ll_programaciones SET locked_at = NULL, locked_by = NULL WHERE id = ? AND locked_by = ?',
    [programacionId, instanceId]
  );
}

/**
 * Calcula un delay aleatorio para envíos de WhatsApp
 * 
 * Propósito: Evitar detección de spam por WhatsApp al enviar múltiples mensajes
 * Comportamiento por defecto: mantiene el rango original (2-6 segundos)
 * 
 * @param {Object} config - Configuración opcional del delay
 * @param {number} config.minDelay - Delay mínimo en ms (default: 2000)
 * @param {number} config.maxDelay - Delay máximo en ms (default: 6000)
 * @returns {number} Delay aleatorio en milisegundos
 */
function getRandomSendDelay(config = {}) {
  const minDelay = config.minDelay || DEFAULT_SEND_DELAY_MIN;
  const maxDelay = config.maxDelay || DEFAULT_SEND_DELAY_MAX;
  const range = maxDelay - minDelay;
  return minDelay + Math.floor(Math.random() * range);
}

function dentroDeVentana(programacion, ahora) {
  const diaActual = DAY_KEYS[ahora.getDay()];
  const dias = (programacion.dias_semana || '')
    .split(',')
    .map((d) => d.trim().toLowerCase());
  if (!dias.includes(diaActual)) return false;

  const horaActual = ahora.toTimeString().slice(0, 8); // HH:MM:SS
  return horaActual >= programacion.hora_inicio && horaActual <= programacion.hora_fin;
}

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
  if (!rows.length) return 0;
  return rows[0].enviados;
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
    `SELECT id, telefono_wapp, mensaje_final
     FROM ll_envios_whatsapp
     WHERE campania_id = ? AND estado = 'pendiente'
     ORDER BY id ASC
     LIMIT ?`,
    [campaniaId, limite]
  );
  return rows;
}

/**
 * Marca un envío como procesado usando UPDATE optimista
 * 
 * UPDATE optimista: Solo actualiza si estado = 'pendiente'
 * Previene duplicados en casos de:
 * - Reinicio del scheduler durante envío
 * - Múltiples procesos scheduler corriendo
 * - Retry de mensajes fallidos
 * 
 * @param {number} id - ID del registro en ll_envios_whatsapp
 * @returns {Promise<boolean>} true si se marcó exitosamente, false si ya fue procesado
 */
async function marcarEnviado(id) {
  const [result] = await connection.query(
    'UPDATE ll_envios_whatsapp SET estado = "enviado", fecha_envio = NOW() WHERE id = ? AND estado = "pendiente"',
    [id]
  );
  return result.affectedRows === 1;
}

/**
 * Procesa una programación según el contrato Session Manager single-admin
 * 
 * Flujo simplificado:
 * 1. Validar que Session Manager esté READY (estado global único)
 * 2. Si NO conectado, abortar con log descriptivo
 * 3. Si conectado, proceder con envíos usando sesión 'admin' implícita
 */
async function procesarProgramacion(programacion) {
  const clienteId = Number(programacion.cliente_id);

  // PASO 1: Consultar estado global de Session Manager (arquitectura single-admin)
  let status;
  try {
    status = await sessionManagerClient.getStatus();
  } catch (error) {
    if (error instanceof SessionManagerTimeoutError) {
      console.error(
        `⏸️  Programación ${programacion.id} ABORTADA: ` +
        `Session Manager no respondió (timeout). Reintentará en el próximo ciclo.`
      );
      return;
    }
    
    if (error instanceof SessionManagerUnreachableError) {
      console.error(
        `⏸️  Programación ${programacion.id} ABORTADA: ` +
        `Session Manager no disponible. Reintentará en el próximo ciclo.`
      );
      return;
    }
    
    console.error(
      `⏸️  Programación ${programacion.id} ABORTADA: ` +
      `Error consultando Session Manager: ${error.message}`
    );
    return;
  }

  // PASO 2: Verificar que la sesión global esté conectada
  if (status.status !== 'READY' || !status.connected) {
    const statusMessages = {
      'INIT': 'Sesión inicializando. Requiere escaneo de QR.',
      'QR_REQUIRED': 'QR no escaneado. Debe escanearse para conectar.',
      'CONNECTING': 'Sesión conectando. Esperar autenticación.',
      'DISCONNECTED': 'WhatsApp desconectado. Requiere reconexión.',
      'ERROR': `Error en sesión: ${status.lastError || 'desconocido'}`
    };
    
    const reason = statusMessages[status.status] || `Estado: ${status.status}`;
    
    console.warn(
      `⏸️  Programación ${programacion.id} ABORTADA: ` +
      `WhatsApp no conectado (cliente ${clienteId}). ${reason}`
    );
    return;
  }

  // PASO 3: Sesión conectada - proceder con envíos
  console.log(
    `✅ Programación ${programacion.id}: WhatsApp verificado (cliente ${clienteId}, ` +
    `teléfono: ${status.account?.number || 'N/A'})`
  );

  // PASO 4: Validar estado de la campaña (OBLIGATORIO)
  const [campaniaRows] = await connection.query(
    'SELECT id, nombre, estado FROM ll_campanias_whatsapp WHERE id = ?',
    [programacion.campania_id]
  );

  if (!campaniaRows.length) {
    console.error(
      `⏸️  Programación ${programacion.id} ABORTADA: ` +
      `Campaña ${programacion.campania_id} no encontrada`
    );
    return;
  }

  const campania = campaniaRows[0];

  if (campania.estado !== 'en_progreso') {
    console.warn(
      `[SENDER BLOCKED] Programación ${programacion.id} ABORTADA: ` +
      `Campaña ${campania.id} "${campania.nombre}" no está aprobada para envío ` +
      `(estado actual: ${campania.estado})`
    );
    return;
  }

  console.log(
    `✅ Campaña ${campania.id} "${campania.nombre}": Estado validado (en_progreso)`
  );

  const enviados = await enviadosHoy(programacion.id);
  const disponible = programacion.cupo_diario - enviados;
  
  if (disponible <= 0) {
    console.log(`⏸️  Programación ${programacion.id}: Cupo diario agotado (${enviados}/${programacion.cupo_diario})`);
    return;
  }

  const pendientes = await obtenerPendientes(programacion.campania_id, disponible);
  
  if (!pendientes.length) {
    console.log(`⏸️  Programación ${programacion.id}: No hay mensajes pendientes`);
    return;
  }

  console.log(`🕒 Programación ${programacion.id}: Enviando ${pendientes.length} mensajes`);
  
  let enviadosAhora = 0;
  let falladosAhora = 0;
  
  for (const envio of pendientes) {
    if (!envio.telefono_wapp || !envio.mensaje_final) {
      console.warn(`⚠️  Envío ${envio.id}: Datos incompletos (teléfono o mensaje vacío)`);
      continue;
    }
    
    try {
      // PASO 1: Marcar como procesado ANTES de enviar (UPDATE optimista)
      // Esto previene envíos duplicados en caso de crash/restart
      const marcado = await marcarEnviado(envio.id);
      
      if (!marcado) {
        console.log(
          `⏭️  Envío ${envio.id}: Ya procesado por otro proceso/ciclo. Omitiendo.`
        );
        continue;
      }
      
      // PASO 2: Enviar mensaje (solo si el UPDATE fue exitoso)
      // Session Manager single-admin: usa sesión 'admin' implícita
      const destinatario = envio.telefono_wapp.includes('@c.us')
        ? envio.telefono_wapp
        : `${envio.telefono_wapp}@c.us`;

      await sessionManagerClient.sendMessage({
        cliente_id: clienteId,
        to: destinatario,
        message: envio.mensaje_final
      });
      
      enviadosAhora += 1;
      
      // PASO 3: Delay anti-spam (parametrizado, compatible hacia atrás)
      const randomDelay = getRandomSendDelay();
      console.log(`[Scheduler] Delay aplicado antes del próximo envío: ${randomDelay}ms`);
      await delay(randomDelay);
      
    } catch (err) {
      falladosAhora += 1;
      console.error(
        `❌ Envío ${envio.id} FALLIDO: ${err.message} ` +
        `(destinatario: ${envio.telefono_wapp})`
      );
      
      // Si falla por sesión no lista, abortar el resto
      if (err.message.includes('not ready') || err.message.includes('no está listo')) {
        console.error(
          `🛑 Programación ${programacion.id}: Abortando envíos restantes ` +
          `por problema de sesión`
        );
        break;
      }
    }
  }

  if (enviadosAhora > 0) {
    await incrementarConteo(programacion.id, enviadosAhora);
    console.log(
      `📊 Programación ${programacion.id}: Completado ` +
      `(${enviadosAhora} enviados, ${falladosAhora} fallidos)`
    );
  }
}

async function tick() {
  if (processing) return;
  processing = true;
  try {
    const ahora = new Date();
    const programaciones = await obtenerProgramacionesActivas();
    
    for (const prog of programaciones) {
      if (!dentroDeVentana(prog, ahora)) continue;
      
      // Intentar adquirir lock atómico
      const lockAdquirido = await acquireProgramacionLock(prog.id, INSTANCE_ID);
      
      if (!lockAdquirido) {
        console.log(
          `⏭️  [Scheduler] Programación ${prog.id}: Lock ocupado, ` +
          `omitiendo (procesándose por otra instancia)`
        );
        continue;
      }
      
      console.log(
        `🔒 [Scheduler] Lock adquirido para programación ${prog.id} ` +
        `por ${INSTANCE_ID.split('_')[0]}`
      );
      
      try {
        await procesarProgramacion(prog);
      } finally {
        await releaseProgramacionLock(prog.id, INSTANCE_ID);
        console.log(`🔓 [Scheduler] Lock liberado para programación ${prog.id}`);
      }
    }
  } catch (err) {
    console.error('❌ Error en scheduler de programaciones:', err);
  } finally {
    processing = false;
  }
}

function start() {
  setInterval(tick, PROCESS_INTERVAL_MS);
  tick();
}

module.exports = {
  start
};
