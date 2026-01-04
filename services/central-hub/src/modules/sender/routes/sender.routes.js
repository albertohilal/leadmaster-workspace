/**
 * Rutas para envío de mensajes de WhatsApp
 * Integración con session-manager
 */

const express = require('express');
const router = express.Router();
const senderController = require('../controllers/sender.controller');

// POST /sender/send - Enviar mensaje individual
router.post('/send', senderController.send);

module.exports = router;
