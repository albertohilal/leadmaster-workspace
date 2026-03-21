const express = require('express');
const router = express.Router();

const emailCampaignsController = require('../controllers/emailCampaigns.controller');

// POST /api/email/campaigns
router.post('/', emailCampaignsController.create);

module.exports = router;