const emailCampaignsService = require('../services/emailCampaigns.service');
const emailCampaignRecipientsService = require('../services/emailCampaignRecipients.service');
const emailCampaignPrepareService = require('../services/emailCampaignPrepare.service');
const {
  validateCreateEmailCampaignBody
} = require('../validators/createEmailCampaign.validator');
const {
  validateEmailCampaignRecipientsBody
} = require('../validators/emailCampaignRecipients.validator');
const {
  validateEmailCampaignPrepareBody
} = require('../validators/emailCampaignPrepare.validator');

function getClienteIdFromReq(req) {
  const raw = req?.user?.cliente_id;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const i = Math.floor(n);
  if (i <= 0) return null;
  return i;
}

async function list(req, res) {
  const cliente_id = getClienteIdFromReq(req);

  if (!cliente_id) {
    return res.status(403).json({
      success: false,
      error: 'ACCESS_DENIED',
      message: 'Usuario autenticado sin cliente_id valido'
    });
  }

  try {
    const campaigns = await emailCampaignsService.listEmailCampaigns({
      cliente_id
    });

    return res.status(200).json({
      success: true,
      data: {
        campaigns
      }
    });
  } catch (error) {
    console.error('[EmailCampaigns] Error listando campañas:', {
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

async function create(req, res) {
  const cliente_id = getClienteIdFromReq(req);

  if (!cliente_id) {
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

    return res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    if (error && error.status) {
      return res.status(error.status).json({
        success: false,
        error: error.code || 'EMAIL_CAMPAIGN_ERROR',
        message: error.message,
        details: error.details
      });
    }

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

async function addRecipients(req, res) {
  const cliente_id = getClienteIdFromReq(req);

  if (!cliente_id) {
    return res.status(403).json({
      success: false,
      error: 'ACCESS_DENIED',
      message: 'Usuario autenticado sin cliente_id valido'
    });
  }

  const campaign_id = Number(req.params.id);

  if (!Number.isInteger(campaign_id) || campaign_id <= 0) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'campaign id must be a positive integer',
      details: { field: 'id' }
    });
  }

  const validation = validateEmailCampaignRecipientsBody(req.body);

  if (!validation.ok) {
    return res.status(validation.status || 400).json({
      success: false,
      error: validation.code || 'VALIDATION_ERROR',
      message: validation.message,
      details: validation.details
    });
  }

  try {
    const data = await emailCampaignRecipientsService.addRecipients({
      cliente_id,
      campaign_id,
      recipients: validation.value.recipients
    });

    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    if (error && error.status) {
      return res.status(error.status).json({
        success: false,
        error: error.code || 'EMAIL_CAMPAIGN_RECIPIENTS_ERROR',
        message: error.message,
        details: error.details
      });
    }

    console.error('[EmailCampaigns] Error agregando destinatarios:', {
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

async function prepare(req, res) {
  const cliente_id = getClienteIdFromReq(req);

  if (!cliente_id) {
    return res.status(403).json({
      success: false,
      error: 'ACCESS_DENIED',
      message: 'Usuario autenticado sin cliente_id valido'
    });
  }

  const campaign_id = Number(req.params.id);

  if (!Number.isInteger(campaign_id) || campaign_id <= 0) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'campaign id must be a positive integer',
      details: { field: 'id' }
    });
  }

  const validation = validateEmailCampaignPrepareBody(req.body);

  if (!validation.ok) {
    return res.status(validation.status || 400).json({
      success: false,
      error: validation.code || 'VALIDATION_ERROR',
      message: validation.message,
      details: validation.details
    });
  }

  try {
    const data = await emailCampaignPrepareService.prepareCampaign({
      cliente_id,
      campaign_id,
      request: validation.value
    });

    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    if (error && error.status) {
      return res.status(error.status).json({
        success: false,
        error: error.code || 'EMAIL_CAMPAIGN_PREPARE_ERROR',
        message: error.message,
        details: error.details
      });
    }

    console.error('[EmailCampaigns] Error preparando campaña:', {
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
  list,
  create,
  addRecipients,
  prepare
};