function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateEmailCampaignPrepareBody(body) {
  if (body === undefined) {
    return {
      ok: true,
      value: {
        fecha_programada: null
      }
    };
  }

  if (!isPlainObject(body)) {
    return {
      ok: false,
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'payload must be an object'
    };
  }

  const allowedFields = ['fecha_programada'];
  const unknownField = Object.keys(body).find((field) => !allowedFields.includes(field));
  if (unknownField) {
    return {
      ok: false,
      status: 400,
      code: 'VALIDATION_ERROR',
      message: `${unknownField} is not supported in email campaign prepare payload`,
      details: { field: unknownField }
    };
  }

  if (body.fecha_programada !== undefined && body.fecha_programada !== null) {
    if (typeof body.fecha_programada !== 'string' || Number.isNaN(Date.parse(body.fecha_programada))) {
      return {
        ok: false,
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'fecha_programada must be a valid datetime or null',
        details: { field: 'fecha_programada' }
      };
    }
  }

  return {
    ok: true,
    value: {
      fecha_programada: body.fecha_programada || null
    }
  };
}

module.exports = {
  validateEmailCampaignPrepareBody
};
