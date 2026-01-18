const express = require('express');
const session = require('../whatsapp/session');

const router = express.Router();

router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'session-manager',
    timestamp: new Date().toISOString()
  });
});

router.get('/status', (req, res) => {
  const state = session.getState();
  res.status(200).json(state);
});

router.get('/qr-code', (req, res) => {
  const state = session.getState();
  
  if (state.status !== 'QR_REQUIRED' || !state.qrDataUrl) {
    return res.status(404).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>QR Code - Session Manager</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            background: #1a1a1a;
            color: #fff;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
          }
          .container {
            text-align: center;
            padding: 2rem;
          }
          h1 { font-size: 1.5rem; margin-bottom: 1rem; }
          p { color: #888; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>⚠️ QR Code Not Available</h1>
          <p>Current status: ${state.status}</p>
          <p>Please initiate connection first via POST /connect</p>
        </div>
      </body>
      </html>
    `);
  }

  res.status(200).send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>WhatsApp QR Code - Session Manager</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          background: #1a1a1a;
          color: #fff;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
        }
        .container {
          text-align: center;
          padding: 2rem;
        }
        h1 {
          font-size: 1.5rem;
          margin-bottom: 1.5rem;
        }
        img {
          max-width: 100%;
          height: auto;
          border: 8px solid #fff;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        }
        .instructions {
          margin-top: 1.5rem;
          color: #888;
          font-size: 0.9rem;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>📱 Scan WhatsApp QR Code</h1>
        <img src="${state.qrDataUrl}" alt="WhatsApp QR Code">
        <div class="instructions">
          <p>Open WhatsApp on your phone</p>
          <p>Tap Menu or Settings → Linked Devices → Link a Device</p>
          <p>Point your phone to this screen to capture the code</p>
        </div>
      </div>
    </body>
    </html>
  `);
});

router.post('/connect', async (req, res) => {
  try {
    const result = await session.connect();
    res.status(200).json(result);
  } catch (error) {
    console.error('[API]', 'Error connecting:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/disconnect', async (req, res) => {
  try {
    const result = await session.disconnect();
    res.status(200).json(result);
  } catch (error) {
    console.error('[API]', 'Error disconnecting:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/send', async (req, res) => {
  const { cliente_id, to, message } = req.body;

  // Validación 1: cliente_id presente y numérico
  if (!cliente_id || typeof cliente_id !== 'number') {
    console.log('[API] SEND blocked → INVALID_CLIENTE_ID');
    return res.status(400).json({
      success: false,
      code: 'INVALID_CLIENTE_ID',
      message: 'cliente_id must be a number'
    });
  }

  // Validación 2: to presente y string
  if (!to || typeof to !== 'string') {
    console.log(`[API] SEND blocked → INVALID_TO (cliente_id=${cliente_id})`);
    return res.status(400).json({
      success: false,
      code: 'INVALID_TO',
      message: 'to must be a string'
    });
  }

  // Validación 3: message presente y string no vacío
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    console.log(`[API] SEND blocked → INVALID_MESSAGE (cliente_id=${cliente_id})`);
    return res.status(400).json({
      success: false,
      code: 'INVALID_MESSAGE',
      message: 'message must be a non-empty string'
    });
  }

  // Validación 4: Estado de sesión estrictamente READY
  const state = session.getState();
  if (state.status !== 'READY') {
    console.log(`[API] SEND blocked → SESSION_NOT_READY (cliente_id=${cliente_id})`);
    return res.status(503).json({
      success: false,
      code: 'SESSION_NOT_READY',
      message: 'WhatsApp session not ready',
      currentStatus: state.status
    });
  }

  // Normalización: to a formato WhatsApp
  const chatId = to.endsWith('@c.us') ? to : `${to}@c.us`;

  // Envío
  try {
    await session.sendMessage(cliente_id, chatId, message);
    console.log(`[API] Message sent → cliente_id=${cliente_id} to=${chatId}`);
    
    res.status(200).json({
      success: true,
      message: 'Message sent'
    });
  } catch (error) {
    console.error(`[API] SEND failed → cliente_id=${cliente_id}`, error.message);
    res.status(500).json({
      success: false,
      code: 'SEND_FAILED',
      message: 'Failed to send WhatsApp message'
    });
  }
});

module.exports = router;
