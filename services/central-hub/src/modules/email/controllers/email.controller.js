const emailService = require('../services/email.service');
const { validateSendEmailBody } = require('../validators/sendEmail.validator');
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
  // Auth requerido por routing (router.use(authenticate))
  const cliente_id = getClienteIdFromReq(req);

  if (!cliente_id) {
    return res.status(403).json({
      success: false,
      error: 'Acceso denegado',
      details: 'Usuario autenticado sin cliente_id válido'
    });
  }

  const validation = validateSendEmailBody(req.body);

  if (!validation.ok) {
    return res.status(validation.status || 400).json({
      success: false,
      error: validation.code || 'VALIDATION_ERROR',
      message: validation.message,
      details: validation.details
    });
  }

  try {
    const data = await emailService.sendEmail({
      cliente_id,
      request: validation.value
    });

    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    // Errores tipados de integración
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
      return res.status(502).json({
        success: false,
        error: 'MAILER_UNREACHABLE',
        message: error.message
      });
    }

    if (error instanceof MailerHttpError) {
      // Propagar errores de Mailer de forma controlada.
      // Si Mailer devuelve un body estándar {error, code, message}, lo reflejamos.
      const body = error.body;
      const mailerCode = body && typeof body.code === 'string' ? body.code : undefined;
      const mailerMessage = body && typeof body.message === 'string' ? body.message : undefined;
      const mailerDetails = body && body.details !== undefined ? body.details : undefined;

      const status = typeof error.status === 'number' ? error.status : 502;

      return res.status(status).json({
        success: false,
        error: mailerCode || 'MAILER_HTTP_ERROR',
        message: mailerMessage || error.message,
        details: mailerDetails
      });
    }

    // Error inesperado
    console.error('[Email] Error inesperado:', {
      name: error?.name,
      message: error?.message
    });

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
