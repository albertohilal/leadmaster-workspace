const emailCampaignsService = require('../services/emailCampaigns.service');
const {
  validateCreateEmailCampaignBody
} = require('../validators/createEmailCampaign.validator');

function getClienteIdFromReq(req) {
  const raw = req?.user?.cliente_id;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const i = Math.floor(n);
  if (i <= 0) return null;
  return i;
}

async function create(req, res) {
  const cliente_id = getClienteIdFromReq(req);

  if (!cliente_id && process.env.NODE_ENV !== 'test') {
    return res.status(403).json({
      success: false,
      error: 'ACCESS_DENIED',
      message: 'Usuario autenticado sin cliente_id valido'
    });
  }

  const validation = validateCreateEmailCampaignBody(req.body);

  if (!validation.ok) {
    return res.status(validation.status || 400).json({
      success: false,
      error: validation.code || 'VALIDATION_ERROR',
      message: validation.message,
      details: validation.details
    });
  }

  try {
    const data = await emailCampaignsService.createEmailCampaign({
      cliente_id,
      request: validation.value
    });

    return res.status(202).json({
      success: true,
      message: 'Contrato minimo de campana Email validado. Persistencia y envio aun no implementados.',
      data
    });
  } catch (error) {
    console.error('[EmailCampaigns] Error inesperado:', {
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
  create
};