const express = require('express');
const router = express.Router();
const messagesController = require('../controllers/messagesController');

// Enviar mensaje individual
router.post('/send', messagesController.send);
// Enviar mensajes masivos
router.post('/bulk', messagesController.sendBulk);
// Estado de envío
router.get('/status/:id', messagesController.status);

module.exports = router;
