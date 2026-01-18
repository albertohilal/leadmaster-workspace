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

  if (!cliente_id) {
    return res.status(400).json({
      success: false,
      error: 'cliente_id is required'
    });
  }

  if (!to) {
    return res.status(400).json({
      success: false,
      error: 'to is required'
    });
  }

  if (!message) {
    return res.status(400).json({
      success: false,
      error: 'message is required'
    });
  }

  const state = session.getState();
  if (state.status !== 'READY') {
    return res.status(409).json({
      success: false,
      error: 'Session not ready',
      currentStatus: state.status
    });
  }

  try {
    const result = await session.sendMessage(cliente_id, to, message);
    res.status(200).json(result);
  } catch (error) {
    console.error('[API]', 'Error sending message:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
