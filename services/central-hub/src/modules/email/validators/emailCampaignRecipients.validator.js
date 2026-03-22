function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeNullableString(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeNullablePositiveInteger(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  const i = Math.floor(n);
  return i > 0 ? i : value;
}

function validateEmailCampaignRecipientsBody(body) {
  if (!isPlainObject(body)) {
    return {
      ok: false,
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'payload must be an object'
    };
  }

  if (!Array.isArray(body.recipients) || body.recipients.length === 0) {
    return {
      ok: false,
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'recipients must be a non-empty array',
      details: { field: 'recipients' }
    };
  }

  const normalized = [];

  for (let index = 0; index < body.recipients.length; index += 1) {
    const recipient = body.recipients[index];

    if (!isPlainObject(recipient)) {
      return {
        ok: false,
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'each recipient must be an object',
        details: { field: `recipients[${index}]` }
      };
    }

    if (!isNonEmptyString(recipient.to_email) || !isValidEmail(recipient.to_email.trim())) {
      return {
        ok: false,
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'recipient.to_email must be a valid email',
        details: { field: `recipients[${index}].to_email` }
      };
    }

    const lugar_id = normalizeNullablePositiveInteger(recipient.lugar_id);
    if (lugar_id !== null && !Number.isInteger(lugar_id)) {
      return {
        ok: false,
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'recipient.lugar_id must be a positive integer or null',
        details: { field: `recipients[${index}].lugar_id` }
      };
    }

    if (
      recipient.nombre_destino !== undefined &&
      recipient.nombre_destino !== null &&
      typeof recipient.nombre_destino !== 'string'
    ) {
      return {
        ok: false,
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'recipient.nombre_destino must be a string or null',
        details: { field: `recipients[${index}].nombre_destino` }
      };
    }

    normalized.push({
      to_email: recipient.to_email.trim().toLowerCase(),
      nombre_destino: normalizeNullableString(recipient.nombre_destino),
      lugar_id
    });
  }

  return {
    ok: true,
    value: {
      recipients: normalized
    }
  };
}

module.exports = {
  validateEmailCampaignRecipientsBody
};
