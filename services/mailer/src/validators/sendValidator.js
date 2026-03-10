const { createHttpError } = require("../middleware/errorHandler");

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function isBasicEmail(value) {
  if (!isNonEmptyString(value)) return false;
  const email = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateSendPayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw createHttpError({
      status: 400,
      code: "VALIDATION_ERROR",
      message: "payload must be an object"
    });
  }

  const {
    cliente_id,
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
  } = payload;

  if (cliente_id === undefined || cliente_id === null) {
    throw createHttpError({
      status: 400,
      code: "VALIDATION_ERROR",
      message: "cliente_id is required",
      details: { field: "cliente_id" }
    });
  }

  if (!isPositiveInteger(cliente_id)) {
    throw createHttpError({
      status: 400,
      code: "VALIDATION_ERROR",
      message: "cliente_id must be a positive integer",
      details: { field: "cliente_id" }
    });
  }

  if (!isBasicEmail(to)) {
    throw createHttpError({
      status: 400,
      code: "VALIDATION_ERROR",
      message: "to must be a valid email",
      details: { field: "to" }
    });
  }

  if (!isNonEmptyString(subject)) {
    throw createHttpError({
      status: 400,
      code: "VALIDATION_ERROR",
      message: "subject is required",
      details: { field: "subject" }
    });
  }

  const hasText = isNonEmptyString(text);
  const hasHtml = isNonEmptyString(html);

  if (!hasText && !hasHtml) {
    throw createHttpError({
      status: 400,
      code: "VALIDATION_ERROR",
      message: "text or html is required",
      details: { field: "text|html" }
    });
  }

  const normalized = {
    cliente_id,
    to: to.trim(),
    subject: subject.trim(),
    text: hasText ? text : undefined,
    html: hasHtml ? html : undefined,
    campaign_id,
    contact_id,
    from_email,
    from_name,
    reply_to,
    metadata
  };

  return normalized;
}

module.exports = { validateSendPayload };
