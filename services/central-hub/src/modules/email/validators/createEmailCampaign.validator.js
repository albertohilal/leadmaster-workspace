function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function findFirstPresentField(body, fieldNames) {
  return fieldNames.find((fieldName) => Object.prototype.hasOwnProperty.call(body, fieldName));
}

const ALLOWED_FIELDS = new Set([
  'nombre',
  'subject',
  'text'
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
  asunto: 'asunto is not allowed when creating an email campaign; use subject',
  body: 'body is not allowed when creating an email campaign; use text',
  fecha_programada: 'fecha_programada is not allowed in the minimum email campaign create payload',
  email_from: 'email_from is not allowed in the minimum email campaign create payload',
  name_from: 'name_from is not allowed in the minimum email campaign create payload',
  reply_to_email: 'reply_to_email is not allowed in the minimum email campaign create payload',
  observaciones: 'observaciones is not allowed in the minimum email campaign create payload',
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

  if (!isNonEmptyString(body.subject)) {
    return {
      ok: false,
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'subject is required',
      details: { field: 'subject' }
    };
  }

  if (!isNonEmptyString(body.text)) {
    return {
      ok: false,
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'text is required',
      details: { field: 'text' }
    };
  }

  return {
    ok: true,
    value: {
      nombre: body.nombre.trim(),
      subject: body.subject.trim(),
      text: body.text.trim()
    }
  };
}

module.exports = {
  validateCreateEmailCampaignBody
};