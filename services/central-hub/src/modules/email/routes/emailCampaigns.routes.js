const express = require('express');
const router = express.Router();

const emailCampaignsController = require('../controllers/emailCampaigns.controller');

// POST /api/email/campaigns
router.post('/', emailCampaignsController.create);

// POST /api/email/campaigns/:id/recipients
router.post('/:id/recipients', emailCampaignsController.addRecipients);

// POST /api/email/campaigns/:id/prepare
router.post('/:id/prepare', emailCampaignsController.prepare);

module.exports = router;