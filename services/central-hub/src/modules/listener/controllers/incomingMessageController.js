const messagePersistence = require('../services/messagePersistence');

function badRequest(res, message) {
  return res.status(400).json({
    error: true,
    code: 'INVALID_REQUEST',
    message
  });
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isIsoTimestamp(value) {
  if (typeof value !== 'string') return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

exports.incomingMessage = async (req, res) => {
  try {
    const { cliente_id, from, message, timestamp } = req.body || {};

    if (cliente_id === undefined || cliente_id === null || cliente_id === '') {
      return badRequest(res, 'cliente_id es requerido');
    }

    const clienteIdNumber = Number(cliente_id);
    if (!Number.isFinite(clienteIdNumber) || clienteIdNumber <= 0) {
      return badRequest(res, 'cliente_id debe ser un number válido');
    }

    if (!isNonEmptyString(from)) {
      return badRequest(res, 'from es requerido');
    }

    const fromDigits = messagePersistence.normalizeDigits(from);
    if (!fromDigits) {
      return badRequest(res, 'from inválido (debe contener dígitos)');
    }

    if (!isNonEmptyString(message)) {
      return badRequest(res, 'message es requerido');
    }

    if (!isNonEmptyString(timestamp) || !isIsoTimestamp(timestamp)) {
      return badRequest(res, 'timestamp es requerido y debe ser ISO válido');
    }

    const result = await messagePersistence.persistIncomingMessage({
      cliente_id: clienteIdNumber,
      from: fromDigits,
      message: message.trim(),
      timestamp,
      raw: req.body
    });

    return res.status(200).json({ ok: true, duplicated: result.duplicated });
  } catch (error) {
    console.error('❌ [listener] Error persistiendo incoming-message:', error);

    return res.status(500).json({
      error: true,
      code: 'DB_ERROR',
      message: error.message || 'Error persistiendo mensaje'
    });
  }
};

exports.outgoingMessage = async (req, res) => {
  try {
    const { cliente_id, from, to, message, timestamp } = req.body || {};

    if (cliente_id === undefined || cliente_id === null || cliente_id === '') {
      return badRequest(res, 'cliente_id es requerido');
    }

    const clienteIdNumber = Number(cliente_id);
    if (!Number.isFinite(clienteIdNumber) || clienteIdNumber <= 0) {
      return badRequest(res, 'cliente_id debe ser un number válido');
    }

    if (!isNonEmptyString(from)) {
      return badRequest(res, 'from es requerido');
    }

    const fromDigits = messagePersistence.normalizeDigits(from);
    if (!fromDigits) {
      return badRequest(res, 'from inválido (debe contener dígitos)');
    }

    if (!isNonEmptyString(to)) {
      return badRequest(res, 'to es requerido');
    }

    const toDigits = messagePersistence.normalizeDigits(to);
    if (!toDigits) {
      return badRequest(res, 'to inválido (debe contener dígitos)');
    }

    if (!isNonEmptyString(message)) {
      return badRequest(res, 'message es requerido');
    }

    if (!isNonEmptyString(timestamp) || !isIsoTimestamp(timestamp)) {
      return badRequest(res, 'timestamp es requerido y debe ser ISO válido');
    }

    const result = await messagePersistence.persistOutgoingMessage({
      cliente_id: clienteIdNumber,
      from: fromDigits,
      to: toDigits,
      message: message.trim(),
      timestamp,
      raw: req.body
    });

    return res.status(200).json({ ok: true, duplicated: result.duplicated });
  } catch (error) {
    console.error('❌ [listener] Error persistiendo outgoing-message:', error);

    return res.status(500).json({
      error: true,
      code: 'DB_ERROR',
      message: error.message || 'Error persistiendo mensaje'
    });
  }
};

exports.listMessages = async (req, res) => {
  try {
    const { cliente_id, from, limit } = req.query || {};

    if (cliente_id === undefined || cliente_id === null || cliente_id === '') {
      return badRequest(res, 'cliente_id es requerido');
    }

    const clienteIdNumber = Number(cliente_id);
    if (!Number.isFinite(clienteIdNumber) || clienteIdNumber <= 0) {
      return badRequest(res, 'cliente_id debe ser un number válido');
    }

    const rows = await messagePersistence.listMessages({
      cliente_id: clienteIdNumber,
      from: from,
      limit
    });

    return res.json({ ok: true, items: rows });
  } catch (error) {
    console.error('❌ [listener] Error listando messages:', error);
    return res.status(500).json({
      error: true,
      code: 'DB_ERROR',
      message: error.message || 'Error consultando mensajes'
    });
  }
};
