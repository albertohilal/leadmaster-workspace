function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function findFirstPresentField(body, fieldNames) {
  return fieldNames.find((fieldName) => Object.prototype.hasOwnProperty.call(body, fieldName));
}

const ALLOWED_FIELDS = new Set(['channel', 'nombre', 'subject', 'text']);

const DISALLOWED_FIELDS = {
  cliente_id: 'cliente_id is not allowed in email campaign create payload',
  to: 'to is not allowed when creating an email campaign',
  destinatarios: 'destinatarios is not allowed when creating an email campaign',
  destinatarios_ids: 'destinatarios_ids is not allowed when creating an email campaign',
  destinatariosIds: 'destinatariosIds is not allowed when creating an email campaign',
  prospectos: 'prospectos is not allowed when creating an email campaign',
  prospectos_ids: 'prospectos_ids is not allowed when creating an email campaign',
  prospectosIds: 'prospectosIds is not allowed when creating an email campaign',
  contact_id: 'contact_id is not allowed when creating an email campaign',
  contact_ids: 'contact_ids is not allowed when creating an email campaign',
  campaign_id: 'campaign_id is not allowed when creating an email campaign',
  programada: 'programada is not allowed when creating an email campaign',
  fecha_envio: 'fecha_envio is not allowed when creating an email campaign',
  programacion: 'programacion is not allowed when creating an email campaign',
  scheduled_at: 'scheduled_at is not allowed when creating an email campaign',
  schedule_at: 'schedule_at is not allowed when creating an email campaign',
  mensaje: 'mensaje is not allowed when creating an email campaign'
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

  if (body.channel !== undefined && body.channel !== null) {
    if (typeof body.channel !== 'string' || body.channel.trim().length === 0) {
      return {
        ok: false,
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'channel must be EMAIL',
        details: { field: 'channel' }
      };
    }

    if (body.channel.trim().toUpperCase() !== 'EMAIL') {
      return {
        ok: false,
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'channel must be EMAIL',
        details: { field: 'channel' }
      };
    }
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
      channel: 'EMAIL',
      nombre: body.nombre.trim(),
      subject: body.subject.trim(),
      text: body.text.trim()
    }
  };
}

module.exports = {
  validateCreateEmailCampaignBody
};