const express = require('express');
const session = require('../whatsapp/wwebjs-session');

const router = express.Router();

// Health check
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'session-manager',
    timestamp: new Date().toISOString()
  });
});

// Estado de la sesión ADMIN (única sesión)
router.get('/status', (req, res) => {
  res.status(200).json({
    status: session.getSessionStatus()
  });
});

// QR actual (si existe) para autenticar sesión ADMIN
router.get('/qr', (req, res) => {
  const qr = session.getCurrentQR();

  if (!qr) {
    return res.status(200).json({ status: 'NO_QR' });
  }

  const isPngDataUrl = typeof qr === 'string' && qr.startsWith('data:image/png;base64,');

  if (!isPngDataUrl) {
    return res.status(200).json({ status: 'QR_AVAILABLE', qr, qrType: 'raw_string' });
  }

  return res.status(200).json({ status: 'QR_AVAILABLE', qr });
});

// Conectar sesión ADMIN (única sesión del sistema)
router.post('/connect', async (req, res) => {
  try {
    const result = await session.connect();
    
    res.status(200).json({
      success: true,
      message: result.alreadyConnected ? 'Already connected' : 'Connected',
      session: result.session,
      state: result.state,
      alreadyConnected: result.alreadyConnected
    });
  } catch (error) {
    console.error('[API] Connect error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Desconectar sesión ADMIN
router.post('/disconnect', async (req, res) => {
  try {
    const result = await session.disconnect();
    res.status(200).json(result);
  } catch (error) {
    console.error('[API] Disconnect error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
