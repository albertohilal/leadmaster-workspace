function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isBasicEmail(value) {
  if (!isNonEmptyString(value)) return false;
  const email = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeOptionalString(value) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function normalizeOptionalEmail(fieldName, value) {
  if (value === undefined || value === null) return { ok: true, value: undefined };
  if (typeof value !== 'string') {
    return {
      ok: false,
      status: 400,
      code: 'VALIDATION_ERROR',
      message: `${fieldName} must be a valid email`,
      details: { field: fieldName }
    };
  }

  const trimmed = value.trim();
  if (trimmed === '') return { ok: true, value: undefined };

  if (!isBasicEmail(trimmed)) {
    return {
      ok: false,
      status: 400,
      code: 'VALIDATION_ERROR',
      message: `${fieldName} must be a valid email`,
      details: { field: fieldName }
    };
  }

  return { ok: true, value: trimmed };
}

/**
 * Valida el body de entrada para enviar email desde el hub.
 * - NO acepta cliente_id desde el cliente externo: se inyecta desde req.user.
 * - Exige: to, subject, text|html.
 */
function validateSendEmailBody(body) {
  if (!body || typeof body !== 'object') {
    return {
      ok: false,
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'payload must be an object'
    };
  }

  const {
    to,
    subject,
    text,
    html,
    campaign_id,
    contact_id,
    from_email,
    from_name,
    reply_to,
    metadata
  } = body;

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

  const hasText = isNonEmptyString(text);
  const hasHtml = isNonEmptyString(html);

  if (!hasText && !hasHtml) {
    return {
      ok: false,
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'text or html is required',
      details: { field: 'text|html' }
    };
  }

  const fromEmailValidation = normalizeOptionalEmail('from_email', from_email);
  if (!fromEmailValidation.ok) {
    return fromEmailValidation;
  }

  const replyToValidation = normalizeOptionalEmail('reply_to', reply_to);
  if (!replyToValidation.ok) {
    return replyToValidation;
  }

  return {
    ok: true,
    value: {
      to: to.trim(),
      subject: subject.trim(),
      text: hasText ? text : undefined,
      html: hasHtml ? html : undefined,
      campaign_id,
      contact_id,
      from_email: fromEmailValidation.value,
      from_name: normalizeOptionalString(from_name),
      reply_to: replyToValidation.value,
      metadata
    }
  };
}

module.exports = {
  validateSendEmailBody
};
