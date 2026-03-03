const crypto = require('crypto');
const pool = require('../../../config/db');

function normalizeDigits(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/\D+/g, '');
}

function isValidDate(date) {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

function toMySqlDateTimeString(date) {
  // Store as UTC DATETIME string (MySQL DATETIME has no TZ)
  // YYYY-MM-DD HH:mm:ss
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function sha256Hex(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * MySQL + mysql2 behavior notes:
 * INSERT ... ON DUPLICATE KEY UPDATE with a no-op update (id=id) can return:
 * - affectedRows = 1  -> inserted
 * - affectedRows = 2  -> duplicate + updated (real change)
 * - affectedRows = 0  -> duplicate + update was a NO-OP (no changes)
 *
 * We want "duplicated = true" for both 0 and 2.
 */
function computeDuplicatedFlag(result) {
  if (!result) return false;
  return result.affectedRows === 0 || result.affectedRows === 2;
}

async function persistIncomingMessage({ cliente_id, from, message, timestamp, raw }) {
  const clienteId = Number(cliente_id);
  const fromDigits = normalizeDigits(from);

  const date = new Date(timestamp);
  if (!isValidDate(date)) {
    const error = new Error('timestamp inválido');
    error.code = 'INVALID_TIMESTAMP';
    throw error;
  }

  const tsIsoNormalized = date.toISOString();
  const tsWaMySql = toMySqlDateTimeString(date);

  const messageHash = sha256Hex(`${clienteId}|IN|${fromDigits}|${message}|${tsIsoNormalized}`);

  const sql = `
    INSERT INTO ll_whatsapp_messages
      (cliente_id, direction, wa_from, wa_to, message, ts_wa, message_hash, raw_json)
    VALUES
      (?, 'IN', ?, NULL, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      id = id
  `;

  const params = [
    clienteId,
    fromDigits,
    message,
    tsWaMySql,
    messageHash,
    raw ? JSON.stringify(raw) : null
  ];

  const [result] = await pool.execute(sql, params);

  const duplicated = computeDuplicatedFlag(result);

  return {
    duplicated,
    message_hash: messageHash,
    ts_wa: tsWaMySql
  };
}

async function persistOutgoingMessage({ cliente_id, from, to, message, timestamp, raw }) {
  const clienteId = Number(cliente_id);
  const fromDigits = normalizeDigits(from);
  const toDigits = normalizeDigits(to);

  const date = new Date(timestamp);
  if (!isValidDate(date)) {
    const error = new Error('timestamp inválido');
    error.code = 'INVALID_TIMESTAMP';
    throw error;
  }

  const tsIsoNormalized = date.toISOString();
  const tsWaMySql = toMySqlDateTimeString(date);

  const messageHash = sha256Hex(
    `${clienteId}|OUT|${fromDigits}|${toDigits}|${message}|${tsIsoNormalized}`
  );

  const sql = `
    INSERT INTO ll_whatsapp_messages
      (cliente_id, direction, wa_from, wa_to, message, ts_wa, message_hash, raw_json)
    VALUES
      (?, 'OUT', ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      id = id
  `;

  const params = [
    clienteId,
    fromDigits,
    toDigits,
    message,
    tsWaMySql,
    messageHash,
    raw ? JSON.stringify(raw) : null
  ];

  const [result] = await pool.execute(sql, params);

  const duplicated = computeDuplicatedFlag(result);

  return {
    duplicated,
    message_hash: messageHash,
    ts_wa: tsWaMySql
  };
}

async function listMessages({ cliente_id, from, limit }) {
  const clienteId = Number(cliente_id);
  const fromDigits = from ? normalizeDigits(from) : null;

  const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 200));

  let sql = `
    SELECT
      id,
      cliente_id,
      direction,
      wa_from,
      wa_to,
      message,
      ts_wa,
      message_hash,
      created_at
    FROM ll_whatsapp_messages
    WHERE cliente_id = ?
  `;

  const params = [clienteId];

  if (fromDigits) {
    sql += ' AND wa_from = ?';
    params.push(fromDigits);
  }

  sql += ' ORDER BY ts_wa DESC LIMIT ?';
  params.push(safeLimit);

  const [rows] = await pool.execute(sql, params);
  return rows;
}

module.exports = {
  persistIncomingMessage,
  persistOutgoingMessage,
  listMessages,
  normalizeDigits,
  toMySqlDateTimeString
};