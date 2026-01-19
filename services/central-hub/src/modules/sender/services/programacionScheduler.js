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
 */

const connection = require('../db/connection');
const {
  sessionManagerClient,
  SessionManagerTimeoutError,
  SessionManagerUnreachableError
} = require('../../../integrations/sessionManager');

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const PROCESS_INTERVAL_MS = 60 * 1000; // cada minuto

// Delay anti-spam (compatibilidad hacia atrás)
const DEFAULT_SEND_DELAY_MIN = 2000;
const DEFAULT_SEND_DELAY_MAX = 6000;

// Identificador único de instancia (locking)
const INSTANCE_ID = `${require('os').hostname()}_${process.pid}_${Date.now()}`;

let processing = false;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* =========================
   CONTROL MAESTRO (CRÍTICO)
   ========================= */
function automaticCampaignsEnabled() {
  return process.env.AUTO_CAMPAIGNS_ENABLED === 'true';
}

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
  const [result] = await connection.query(
    'UPDATE ll_envios_whatsapp SET estado = "enviado", fecha_envio = NOW() WHERE id = ? AND estado = "pendiente"',
    [id]
  );
  return result.affectedRows === 1;
}

/* =========================
   PROCESAMIENTO
   ========================= */
async function procesarProgramacion(programacion) {
  const clienteId = Number(programacion.cliente_id);

  let status;
  try {
    status = await sessionManagerClient.getStatus();
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

  if (status.status !== 'READY' || !status.connected) {
    console.warn(`⏸️ Programación ${programacion.id}: WhatsApp no READY (${status.status})`);
    return;
  }

  const [campaniaRows] = await connection.query(
    'SELECT id, nombre, estado FROM ll_campanias_whatsapp WHERE id = ?',
    [programacion.campania_id]
  );

  if (!campaniaRows.length || campaniaRows[0].estado !== 'en_progreso') {
    console.warn(`⛔ Programación ${programacion.id}: Campaña no habilitada`);
    return;
  }

  const enviados = await enviadosHoy(programacion.id);
  const disponible = programacion.cupo_diario - enviados;
  if (disponible <= 0) return;

  const pendientes = await obtenerPendientes(programacion.campania_id, disponible);
  if (!pendientes.length) return;

  for (const envio of pendientes) {
    const marcado = await marcarEnviado(envio.id);
    if (!marcado) continue;

    const destinatario = envio.telefono_wapp.includes('@c.us')
      ? envio.telefono_wapp
      : `${envio.telefono_wapp}@c.us`;

    try {
      await sessionManagerClient.sendMessage({
        cliente_id: clienteId,
        to: destinatario,
        message: envio.mensaje_final
      });

      await delay(getRandomSendDelay());
    } catch (err) {
      console.error(`❌ Envío ${envio.id} fallido: ${err.message}`);
      break;
    }
  }
}

/* =========================
   TICK (CON CORTE MAESTRO)
   ========================= */
async function tick() {
  if (!automaticCampaignsEnabled()) {
    console.warn('⛔ Scheduler activo pero envíos automáticos DESHABILITADOS (AUTO_CAMPAIGNS_ENABLED=false)');
    return;
  }

  if (processing) return;
  processing = true;

  try {
    const ahora = new Date();
    const programaciones = await obtenerProgramacionesActivas();

    for (const prog of programaciones) {
      if (!dentroDeVentana(prog, ahora)) continue;

      const lock = await acquireProgramacionLock(prog.id, INSTANCE_ID);
      if (!lock) continue;

      try {
        await procesarProgramacion(prog);
      } finally {
        await releaseProgramacionLock(prog.id, INSTANCE_ID);
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
  setInterval(tick, PROCESS_INTERVAL_MS);
  tick();
}

module.exports = { start };
