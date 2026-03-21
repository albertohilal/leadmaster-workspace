function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNullableString(value) {
  return value === null || value === undefined || typeof value === 'string';
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeOptionalText(value) {
  if (value === undefined || value === null) return null;
  return value;
}

function normalizeOptionalString(value) {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function findFirstPresentField(body, fieldNames) {
  return fieldNames.find((fieldName) => Object.prototype.hasOwnProperty.call(body, fieldName));
}

const ALLOWED_FIELDS = new Set([
  'nombre',
  'asunto',
  'body',
  'fecha_programada',
  'email_from',
  'name_from',
  'reply_to_email',
  'observaciones'
]);

const DISALLOWED_FIELDS = {
  cliente_id: 'cliente_id is not allowed in email campaign create payload',
  estado: 'estado is not allowed when creating an email campaign',
  total_destinatarios: 'total_destinatarios is not allowed when creating an email campaign',
  total_enviados: 'total_enviados is not allowed when creating an email campaign',
  total_fallidos: 'total_fallidos is not allowed when creating an email campaign',
  fecha_creacion: 'fecha_creacion is not allowed when creating an email campaign',
  fecha_inicio_envio: 'fecha_inicio_envio is not allowed when creating an email campaign',
  fecha_fin_envio: 'fecha_fin_envio is not allowed when creating an email campaign',
  channel: 'channel is not allowed when creating an email campaign',
  subject: 'subject is not allowed when creating an email campaign; use asunto',
  text: 'text is not allowed when creating an email campaign; use body',
  to: 'to is not allowed when creating an email campaign',
  destinatarios: 'destinatarios is not allowed when creating an email campaign',
  destinatarios_ids: 'destinatarios_ids is not allowed when creating an email campaign',
  destinatariosIds: 'destinatariosIds is not allowed when creating an email campaign',
  prospectos: 'prospectos is not allowed when creating an email campaign',
  prospectos_ids: 'prospectos_ids is not allowed when creating an email campaign',
  prospectosIds: 'prospectosIds is not allowed when creating an email campaign',
  campaign_id: 'campaign_id is not allowed when creating an email campaign'
};

function validateCreateEmailCampaignBody(body) {
  if (!isPlainObject(body)) {
    return {
      ok: false,
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'payload must be an object'
    };
  }

  const blockedField = findFirstPresentField(body, Object.keys(DISALLOWED_FIELDS));
  if (blockedField) {
    return {
      ok: false,
      status: 400,
      code: 'VALIDATION_ERROR',
      message: DISALLOWED_FIELDS[blockedField],
      details: { field: blockedField }
    };
  }

  const unknownField = Object.keys(body).find((fieldName) => !ALLOWED_FIELDS.has(fieldName));
  if (unknownField) {
    return {
      ok: false,
      status: 400,
      code: 'VALIDATION_ERROR',
      message: `${unknownField} is not supported in email campaign create payload`,
      details: { field: unknownField }
    };
  }

  if (!isNonEmptyString(body.nombre)) {
    return {
      ok: false,
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'nombre is required',
      details: { field: 'nombre' }
    };
  }

  if (!isNonEmptyString(body.asunto)) {
    return {
      ok: false,
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'asunto is required',
      details: { field: 'asunto' }
    };
  }

  if (!isNullableString(body.body)) {
    return {
      ok: false,
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'body must be a string or null',
      details: { field: 'body' }
    };
  }

  if (body.fecha_programada !== undefined && body.fecha_programada !== null) {
    if (!isNonEmptyString(body.fecha_programada) || Number.isNaN(Date.parse(body.fecha_programada))) {
      return {
        ok: false,
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'fecha_programada must be a valid datetime or null',
        details: { field: 'fecha_programada' }
      };
    }
  }

  if (body.email_from !== undefined && body.email_from !== null) {
    if (!isNonEmptyString(body.email_from) || !isValidEmail(body.email_from.trim())) {
      return {
        ok: false,
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'email_from must be a valid email address',
        details: { field: 'email_from' }
      };
    }
  }

  if (body.reply_to_email !== undefined && body.reply_to_email !== null) {
    if (!isNonEmptyString(body.reply_to_email) || !isValidEmail(body.reply_to_email.trim())) {
      return {
        ok: false,
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'reply_to_email must be a valid email address',
        details: { field: 'reply_to_email' }
      };
    }
  }

  if (!isNullableString(body.name_from)) {
    return {
      ok: false,
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'name_from must be a string or null',
      details: { field: 'name_from' }
    };
  }

  if (!isNullableString(body.observaciones)) {
    return {
      ok: false,
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'observaciones must be a string or null',
      details: { field: 'observaciones' }
    };
  }

  return {
    ok: true,
    value: {
      nombre: body.nombre.trim(),
      asunto: body.asunto.trim(),
      body: normalizeOptionalText(body.body),
      fecha_programada: normalizeOptionalString(body.fecha_programada),
      email_from: normalizeOptionalString(body.email_from),
      name_from: normalizeOptionalString(body.name_from),
      reply_to_email: normalizeOptionalString(body.reply_to_email),
      observaciones: normalizeOptionalText(body.observaciones)
    }
  };
}

module.exports = {
  validateCreateEmailCampaignBody
};