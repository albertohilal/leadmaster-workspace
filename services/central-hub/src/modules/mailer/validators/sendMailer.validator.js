function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isBasicEmail(value) {
  if (!isNonEmptyString(value)) return false;
  const email = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Valida el body de entrada para POST /mailer/send
 * - Ignora cliente_id si viene en el body
 * - Exige: to, subject, text
 */
function validateSendMailerBody(body) {
  if (!body || typeof body !== 'object') {
    return {
      ok: false,
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'payload must be an object'
    };
  }

  const { to, subject, text } = body;

  if (!isBasicEmail(to)) {
    return {
      ok: false,
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'to must be a valid email',
      details: { field: 'to' }
    };
  }

  if (!isNonEmptyString(subject)) {
    return {
      ok: false,
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'subject is required',
      details: { field: 'subject' }
    };
  }

  if (!isNonEmptyString(text)) {
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
      to: to.trim(),
      subject: subject.trim(),
      text: text.trim()
    }
  };
}

module.exports = {
  validateSendMailerBody
};
