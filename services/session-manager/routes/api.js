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

// Enviar mensaje (cliente_id es solo metadata para logging/billing)
router.post('/send', async (req, res) => {
  const { cliente_id, to, message } = req.body;
  
  // Validaciones
  if (!cliente_id || typeof cliente_id !== 'number') {
    return res.status(400).json({
      success: false,
      code: 'INVALID_CLIENTE_ID',
      message: 'cliente_id must be a number (metadata only)'
    });
  }
  
  if (!to || typeof to !== 'string') {
    return res.status(400).json({
      success: false,
      code: 'INVALID_TO',
      message: 'to must be a string'
    });
  }
  
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_MESSAGE',
      message: 'message must be a non-empty string'
    });
  }
  
  // Verificar que la sesión ADMIN esté conectada
  if (!session.isConnected()) {
    return res.status(503).json({
      success: false,
      code: 'SESSION_NOT_READY',
      message: 'Admin WhatsApp session not ready'
    });
  }
  
  try {
    const result = await session.sendMessage(cliente_id, to, message);
    
    res.status(200).json({
      success: true,
      message: 'Message sent',
      data: result
    });
  } catch (error) {
    console.error('[API] Send error:', error.message);
    res.status(500).json({
      success: false,
      code: 'SEND_FAILED',
      message: error.message
    });
  }
});

module.exports = router;
