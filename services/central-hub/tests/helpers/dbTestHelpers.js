/**
 * Database Helpers para tests de integración de campañas
 * 
 * Propósito:
 * - Setup y teardown de datos de prueba
 * - Aislamiento de tests (cleanup automático)
 * - Consultas de verificación para asserts
 */

const connection = require('../../src/modules/sender/db/connection');

/**
 * Limpia todas las tablas relacionadas con campañas de test
 * ORDEN CRÍTICO: Eliminar primero hijos, luego padres (foreign keys)
 */
async function cleanupTestData() {
  // 1. Tabla de contadores diarios (sin FK pero asociada)
  await connection.query('DELETE FROM ll_programacion_envios_diarios WHERE programacion_id >= 9000');
  
  // 2. Envíos (FK a campañas)
  await connection.query('DELETE FROM ll_envios_whatsapp WHERE campania_id >= 9000');
  
  // 3. Programaciones (FK a campañas)
  await connection.query('DELETE FROM ll_programaciones WHERE id >= 9000');
  
  // 4. Campañas (tabla padre)
  await connection.query('DELETE FROM ll_campanias_whatsapp WHERE id >= 9000');
}

/**
 * Crea una campaña de prueba
 * @param {Object} options
 * @returns {Promise<number>} ID de la campaña creada
 */
async function createTestCampaign({
  id = 9001,
  nombre = 'Campaña Test',
  mensaje = 'Mensaje de prueba para testing',
  estado = 'pendiente',
  cliente_id = 1
} = {}) {
  const [result] = await connection.query(
    `INSERT INTO ll_campanias_whatsapp (id, nombre, mensaje, estado, cliente_id, fecha_creacion)
     VALUES (?, ?, ?, ?, ?, NOW())`,
    [id, nombre, mensaje, estado, cliente_id]
  );
  return id;
}

/**
 * Crea una programación de prueba
 * @param {Object} options
 * @returns {Promise<number>} ID de la programación creada
 */
async function createTestProgramacion({
  id = 9001,
  campania_id = 9001,
  cliente_id = 1,
  cupo_diario = 10,
  estado = 'aprobada',
  dias_semana = 'mon,tue,wed,thu,fri,sat,sun',
  hora_inicio = '00:00:00',
  hora_fin = '23:59:59',
  fecha_inicio = new Date().toISOString().split('T')[0]
} = {}) {
  const [result] = await connection.query(
    `INSERT INTO ll_programaciones 
     (id, campania_id, cliente_id, cupo_diario, estado, dias_semana, hora_inicio, hora_fin, fecha_inicio)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, campania_id, cliente_id, cupo_diario, estado, dias_semana, hora_inicio, hora_fin, fecha_inicio]
  );
  return id;
}

/**
 * Crea registros de envío pendientes para testing
 * @param {Object} options
 * @returns {Promise<number[]>} Array de IDs creados
 */
async function createTestEnvios({
  campania_id = 9001,
  count = 5,
  estado = 'pendiente',
  startPhone = 5491112340000
} = {}) {
  const envios = [];
  
  for (let i = 0; i < count; i++) {
    const telefono = `${startPhone + i}`;
    const nombre = `Destinatario Test ${i + 1}`;
    const mensaje = `Mensaje de prueba ${i + 1}`;
    
    const [result] = await connection.query(
      `INSERT INTO ll_envios_whatsapp 
       (campania_id, telefono_wapp, nombre_destino, mensaje_final, estado)
       VALUES (?, ?, ?, ?, ?)`,
      [campania_id, telefono, nombre, mensaje, estado]
    );
    
    envios.push(result.insertId);
  }
  
  return envios;
}

/**
 * Obtiene el estado actual de un envío
 * @param {number} envioId
 * @returns {Promise<Object|null>}
 */
async function getEnvioById(envioId) {
  const [rows] = await connection.query(
    'SELECT * FROM ll_envios_whatsapp WHERE id = ?',
    [envioId]
  );
  return rows.length ? rows[0] : null;
}

/**
 * Cuenta envíos por estado para una campaña
 * @param {number} campaniaId
 * @returns {Promise<Object>} { pendiente: number, enviado: number, error: number }
 */
async function countEnviosByEstado(campaniaId) {
  const [rows] = await connection.query(
    `SELECT estado, COUNT(*) as count
     FROM ll_envios_whatsapp
     WHERE campania_id = ?
     GROUP BY estado`,
    [campaniaId]
  );
  
  const counts = { pendiente: 0, enviado: 0, error: 0 };
  rows.forEach((row) => {
    counts[row.estado] = row.count;
  });
  
  return counts;
}

/**
 * Obtiene todos los envíos de una campaña ordenados por ID
 * @param {number} campaniaId
 * @returns {Promise<Array>}
 */
async function getEnviosByCampaign(campaniaId) {
  const [rows] = await connection.query(
    `SELECT id, telefono_wapp, mensaje_final, estado, fecha_envio
     FROM ll_envios_whatsapp
     WHERE campania_id = ?
     ORDER BY id ASC`,
    [campaniaId]
  );
  return rows;
}

/**
 * Obtiene el conteo de envíos de hoy para una programación
 * @param {number} programacionId
 * @returns {Promise<number>}
 */
async function getEnviadosHoy(programacionId) {
  const [rows] = await connection.query(
    `SELECT enviados FROM ll_programacion_envios_diarios
     WHERE programacion_id = ? AND fecha = CURDATE()`,
    [programacionId]
  );
  return rows.length ? rows[0].enviados : 0;
}

/**
 * Verifica si un envío fue marcado como enviado con timestamp
 * @param {number} envioId
 * @returns {Promise<boolean>}
 */
async function isEnvioMarcadoComoEnviado(envioId) {
  const [rows] = await connection.query(
    `SELECT estado, fecha_envio FROM ll_envios_whatsapp WHERE id = ?`,
    [envioId]
  );
  
  if (!rows.length) return false;
  
  const envio = rows[0];
  return envio.estado === 'enviado' && envio.fecha_envio !== null;
}

/**
 * Obtiene todos los IDs de envíos pendientes de una campaña
 * @param {number} campaniaId
 * @returns {Promise<number[]>}
 */
async function getPendingEnvioIds(campaniaId) {
  const [rows] = await connection.query(
    `SELECT id FROM ll_envios_whatsapp 
     WHERE campania_id = ? AND estado = 'pendiente'
     ORDER BY id ASC`,
    [campaniaId]
  );
  return rows.map((row) => row.id);
}

module.exports = {
  cleanupTestData,
  createTestCampaign,
  createTestProgramacion,
  createTestEnvios,
  getEnvioById,
  countEnviosByEstado,
  getEnviosByCampaign,
  getEnviadosHoy,
  isEnvioMarcadoComoEnviado,
  getPendingEnvioIds
};
