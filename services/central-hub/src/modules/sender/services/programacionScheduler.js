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
  SessionStatus,
  SessionNotFoundError,
  SessionManagerTimeoutError,
  SessionManagerUnreachableError
} = require('../../../integrations/sessionManager');

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const PROCESS_INTERVAL_MS = 60 * 1000; // cada minuto
let processing = false;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

async function marcarEnviado(id) {
  await connection.query(
    'UPDATE ll_envios_whatsapp SET estado = "enviado", fecha_envio = NOW() WHERE id = ?',
    [id]
  );
}

/**
 * Procesa una programación según el contrato Session Manager
 * 
 * Flujo obligatorio:
 * 1. Consultar estado de sesión (NO inferir)
 * 2. Verificar status === 'connected'
 * 3. Si NO conectado, abortar con log descriptivo
 * 4. Si conectado, proceder con envíos
 */
async function procesarProgramacion(programacion) {
  const clienteId = Number(programacion.cliente_id);
  const instanceId = `sender_${clienteId}`;

  // PASO 1: Consultar estado de sesión (OBLIGATORIO según contrato)
  let session;
  try {
    session = await sessionManagerClient.getSession(instanceId);
  } catch (error) {
    if (error instanceof SessionNotFoundError) {
      console.warn(
        `⏸️  Programación ${programacion.id} ABORTADA: ` +
        `Sesión no existe para cliente ${clienteId}. Debe inicializarse primero.`
      );
      return;
    }
    
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
    
    // Error inesperado
    console.error(
      `⏸️  Programación ${programacion.id} ABORTADA: ` +
      `Error consultando sesión: ${error.message}`
    );
    return;
  }

  // PASO 2: Verificar estado según contrato (NO NEGOCIABLE)
  if (session.status !== SessionStatus.CONNECTED) {
    const statusMessages = {
      [SessionStatus.INIT]: 'Sesión inicializando. Requiere escaneo de QR.',
      [SessionStatus.QR_REQUIRED]: 'QR no escaneado. Debe escanearse para conectar.',
      [SessionStatus.CONNECTING]: 'Sesión conectando. Esperar autenticación.',
      [SessionStatus.DISCONNECTED]: 'WhatsApp desconectado. Requiere reconexión.',
      [SessionStatus.ERROR]: `Error en sesión: ${session.last_error_message || 'desconocido'}`
    };
    
    const reason = statusMessages[session.status] || `Estado: ${session.status}`;
    
    console.warn(
      `⏸️  Programación ${programacion.id} ABORTADA: ` +
      `Cliente ${clienteId} no conectado. ${reason}`
    );
    return;
  }

  // PASO 3: Sesión conectada - proceder con envíos
  console.log(
    `✅ Programación ${programacion.id}: Sesión verificada (cliente ${clienteId}, ` +
    `teléfono: ${session.phone_number || 'N/A'})`
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
      // Formatear número para WhatsApp
      const destinatario = envio.telefono_wapp.includes('@c.us')
        ? envio.telefono_wapp
        : `${envio.telefono_wapp}@c.us`;

      // Enviar usando el cliente del contrato
      await sessionManagerClient.sendMessage({
        clienteId,
        to: destinatario,
        message: envio.mensaje_final
      });
      
      await marcarEnviado(envio.id);
      enviadosAhora += 1;
      
      // Delay aleatorio entre mensajes (anti-spam)
      const randomDelay = 2000 + Math.floor(Math.random() * 4000);
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
      await procesarProgramacion(prog);
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
