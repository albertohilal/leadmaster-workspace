// Servicio que ejecuta el envío de campañas según la programación
// Inspirado en el scheduler de whatsapp-massive-sender-V2
const connection = require('../db/connection');
const sessionService = require('../../session-manager/services/sessionService');

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

async function procesarProgramacion(programacion) {
  const clienteId = Number(programacion.cliente_id);
  const estadoSesion = sessionService.getSessionState(clienteId);
  if (!estadoSesion.ready) {
    console.warn(`⚠️ Programación ${programacion.id}: sesión cliente ${clienteId} no disponible (${estadoSesion.state})`);
    return;
  }

  const enviados = await enviadosHoy(programacion.id);
  const disponible = programacion.cupo_diario - enviados;
  if (disponible <= 0) return;

  const pendientes = await obtenerPendientes(programacion.campania_id, disponible);
  if (!pendientes.length) return;

  console.log(`🕒 Programación ${programacion.id}: enviando ${pendientes.length} mensajes`);
  let enviadosAhora = 0;
  for (const envio of pendientes) {
    if (!envio.telefono_wapp || !envio.mensaje_final) continue;
    try {
      const destinatario = envio.telefono_wapp.includes('@c.us')
        ? envio.telefono_wapp
        : `${envio.telefono_wapp}@c.us`;

      await sessionService.sendMessage(clienteId, destinatario, envio.mensaje_final);
      await marcarEnviado(envio.id);
      enviadosAhora += 1;
      const randomDelay = 2000 + Math.floor(Math.random() * 4000);
      await delay(randomDelay);
    } catch (err) {
      console.error(`❌ Error al enviar mensaje programado ${envio.id}:`, err.message);
    }
  }

  if (enviadosAhora > 0) {
    await incrementarConteo(programacion.id, enviadosAhora);
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
