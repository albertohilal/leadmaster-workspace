const express = require('express');
const router = express.Router();

const emailController = require('../controllers/email.controller');

router.use('/campaigns', require('./emailCampaigns.routes'));

// POST /api/email/send
router.post('/send', emailController.send);

module.exports = router;
