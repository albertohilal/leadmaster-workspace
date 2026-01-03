const express = require('express');
const axios = require('axios');

const router = express.Router();

// URL del Session Manager
const SESSION_MANAGER_URL =
  process.env.SESSION_MANAGER_URL || 'http://localhost:3001';

/**
 * Proxy WhatsApp status
 * GET /api/whatsapp/:clientId/status
 */
router.get('/:clientId/status', async (req, res) => {
  const { clientId } = req.params;

  try {
    const response = await axios.get(
      `${SESSION_MANAGER_URL}/health`,
      { timeout: 5000 }
    );

    res.json({
      ok: true,
      source: 'central-hub',
      clientId,
      sessionManager: response.data
    });
  } catch (err) {
    res.status(502).json({
      ok: false,
      source: 'central-hub',
      clientId,
      error: 'SESSION_MANAGER_UNAVAILABLE',
      detail: err.message
    });
  }
});

module.exports = router;
