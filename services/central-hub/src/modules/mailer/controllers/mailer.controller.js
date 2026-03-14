const mailerService = require('../services/mailer.service');
const { validateSendMailerBody } = require('../validators/sendMailer.validator');
const {
  MailerHttpError,
  MailerTimeoutError,
  MailerUnreachableError,
  MailerInvalidConfigError
} = require('../../../integrations/mailer');

function getClienteIdFromReq(req) {
  const raw = req?.user?.cliente_id;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const i = Math.floor(n);
  if (i <= 0) return null;
  return i;
}

async function send(req, res) {
  const startedAt = Date.now();

  const cliente_id = getClienteIdFromReq(req);
  if (!cliente_id) {
    return res.status(403).json({
      success: false,
      error: 'FORBIDDEN',
      message: 'Usuario autenticado sin cliente_id válido'
    });
  }

  const validation = validateSendMailerBody(req.body);
  if (!validation.ok) {
    return res.status(validation.status || 400).json({
      success: false,
      error: validation.code || 'VALIDATION_ERROR',
      message: validation.message,
      details: validation.details
    });
  }

  const { to } = validation.value;

  console.log('[Mailer] send attempt', {
    cliente_id,
    to
  });

  try {
    const data = await mailerService.send({
      cliente_id,
      request: validation.value
    });

    console.log('[Mailer] send ok', {
      cliente_id,
      to,
      duration_ms: Date.now() - startedAt
    });

    return res.status(200).json(data);
  } catch (error) {
    console.error('[Mailer] send error', {
      cliente_id,
      to,
      name: error?.name,
      message: error?.message,
      duration_ms: Date.now() - startedAt
    });

    if (error instanceof MailerInvalidConfigError) {
      return res.status(500).json({
        success: false,
        error: 'MAILER_INVALID_CONFIG',
        message: error.message
      });
    }

    if (error instanceof MailerTimeoutError) {
      return res.status(504).json({
        success: false,
        error: 'MAILER_TIMEOUT',
        message: error.message
      });
    }

    if (error instanceof MailerUnreachableError) {
      return res.status(503).json({
        success: false,
        error: 'MAILER_UNREACHABLE',
        message: error.message
      });
    }

    if (error instanceof MailerHttpError) {
      const body = error.body;
      const mailerCode = body && typeof body.code === 'string' ? body.code : undefined;
      const mailerMessage = body && typeof body.message === 'string' ? body.message : undefined;
      const mailerDetails = body && body.details !== undefined ? body.details : undefined;

      const mailerStatus = typeof error.status === 'number' ? error.status : 502;

      // 400: validación del mailer -> propagar tal cual
      if (mailerStatus === 400) {
        return res.status(400).json(body || {
          success: false,
          error: mailerCode || 'MAILER_VALIDATION_ERROR',
          message: mailerMessage || error.message,
          details: mailerDetails
        });
      }

      // 4xx: propagar status pero normalizar formato si hace falta
      if (mailerStatus >= 400 && mailerStatus < 500) {
        return res.status(mailerStatus).json(body || {
          success: false,
          error: mailerCode || 'MAILER_HTTP_ERROR',
          message: mailerMessage || error.message,
          details: mailerDetails
        });
      }

      // 5xx del mailer: tratar como upstream error (bad gateway)
      return res.status(502).json({
        success: false,
        error: mailerCode || 'MAILER_UPSTREAM_ERROR',
        message: mailerMessage || 'Error en servicio upstream (mailer)',
        details: {
          upstream_status: mailerStatus,
          upstream_body: body
        }
      });
    }

    return res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Error interno del servidor'
    });
  }
}

module.exports = {
  send
};
