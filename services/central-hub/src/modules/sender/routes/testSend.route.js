const express = require('express');
const router = express.Router();

const { sendMessage } = require('../services/sender.service');

/**
 * TEST ENDPOINT – NO USAR EN PRODUCCIÓN ABIERTA
 * Permite validar integración Central Hub → Session Manager
 */
router.post('/test-send', async (req, res) => {
  try {
    const { clienteId, to, message, dryRun = true } = req.body;

    if (!clienteId || !to || !message) {
      return res.status(400).json({
        error: 'clienteId, to y message son obligatorios'
      });
    }

    if (dryRun) {
      // Solo valida estado de sesión
      await sendMessage({
        clienteId,
        to,
        message: '[DRY RUN] ' + message
      });

      return res.json({
        success: true,
        dryRun: true,
        message: 'Sesión válida. WhatsApp READY.'
      });
    }

    // Envío real
    const result = await sendMessage({ clienteId, to, message });

    res.json({
      success: true,
      dryRun: false,
      result
    });

  } catch (error) {
    res.status(409).json({
      success: false,
      error: error.message,
      name: error.name
    });
  }
});

module.exports = router;
