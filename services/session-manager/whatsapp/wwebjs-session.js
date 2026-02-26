const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcodeTerminal = require('qrcode-terminal');
const QRCode = require('qrcode'); // ← NUEVO

const SESSION_NAME = 'admin';
const TOKENS_DIR = path.resolve(__dirname, '..', 'tokens');

let client = null;
let connectPromise = null;

let sessionStatus = 'INIT';
let currentQR = null; // ahora será base64 image
let qrAttempts = 0;

/* =======================================================
   EVENT HANDLERS
======================================================= */

function attachEventHandlers(waClient) {
  waClient.on('qr', async (qr) => {
    try {
      // Convertimos raw string → base64 PNG
      const qrBase64 = await QRCode.toDataURL(qr);

      currentQR = qrBase64;
      sessionStatus = 'QR_REQUIRED';
      qrAttempts += 1;

      console.log(
        `\n================ QR RECEIVED (Attempt ${qrAttempts}) ================\n`
      );

      // Mostrar en terminal (solo debug)
      qrcodeTerminal.generate(qr, { small: true });

      console.log(
        '\nScan from: WhatsApp → Dispositivos vinculados → Vincular dispositivo\n'
      );
    } catch (err) {
      console.error('[WWEBJS] Failed to convert QR:', err?.message || err);
      sessionStatus = 'ERROR';
      currentQR = null;
    }
  });

  waClient.on('authenticated', () => {
    sessionStatus = 'AUTHENTICATED';
    currentQR = null;
    console.log('[WWEBJS] ADMIN authenticated');
  });

  waClient.on('ready', () => {
    sessionStatus = 'READY';
    currentQR = null;
    console.log('✅ [WWEBJS] ADMIN session READY');
  });

  waClient.on('disconnected', async (reason) => {
    console.warn('[WWEBJS] Disconnected:', reason);

    sessionStatus = 'DISCONNECTED';
    currentQR = null;
    qrAttempts = 0;

    try {
      await waClient.destroy();
    } catch (_) {}

    client = null;
  });

  waClient.on('auth_failure', async (msg) => {
    console.error('[WWEBJS] Auth failure:', msg);

    sessionStatus = 'ERROR';
    currentQR = null;
    qrAttempts = 0;

    try {
      await waClient.destroy();
    } catch (_) {}

    client = null;
  });
}

/* =======================================================
   CONNECT
======================================================= */

async function connect() {
  if (client) {
    return { alreadyConnected: true, state: sessionStatus, session: SESSION_NAME };
  }

  if (connectPromise) {
    return { alreadyConnected: true, state: sessionStatus, session: SESSION_NAME };
  }

  sessionStatus = 'INIT';
  currentQR = null;
  qrAttempts = 0;

  try {
    const waClient = new Client({
      authStrategy: new LocalAuth({
        clientId: SESSION_NAME,
        dataPath: TOKENS_DIR
      }),
      puppeteer: {
        headless: true,
        executablePath: '/usr/bin/google-chrome-stable',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
        ]
      }
    });

    attachEventHandlers(waClient);
    client = waClient;

    connectPromise = waClient
      .initialize()
      .catch((error) => {
        console.error('[WWEBJS] Error while connecting:', error?.message || error);

        sessionStatus = 'ERROR';
        currentQR = null;
        qrAttempts = 0;
        client = null;
        return null;
      })
      .finally(() => {
        connectPromise = null;
      });

    return { alreadyConnected: false, state: sessionStatus, session: SESSION_NAME };
  } catch (error) {
    console.error('[WWEBJS] Failed to start client:', error?.message || error);

    sessionStatus = 'ERROR';
    currentQR = null;
    qrAttempts = 0;
    client = null;
    connectPromise = null;

    return { alreadyConnected: false, state: sessionStatus, session: SESSION_NAME };
  }
}

/* =======================================================
   DISCONNECT
======================================================= */

async function disconnect() {
  if (!client) {
    sessionStatus = 'DISCONNECTED';
    currentQR = null;
    qrAttempts = 0;
    return { success: true, message: 'No active session' };
  }

  const currentClient = client;
  client = null;

  try {
    await currentClient.destroy();
  } catch (_) {}

  sessionStatus = 'DISCONNECTED';
  currentQR = null;
  qrAttempts = 0;

  return { success: true, message: 'Disconnected' };
}

/* =======================================================
   SEND MESSAGE
======================================================= */

async function sendMessage(clienteId, to, message) {
  if (!client || sessionStatus !== 'READY') {
    throw new Error('SESSION_NOT_READY');
  }

  const rawNumber = String(to).replace(/\D/g, '');
  const chatId = `${rawNumber}@c.us`;

  await client.sendMessage(chatId, message);

  return {
    success: true,
    cliente_id: clienteId,
    to: rawNumber,
    timestamp: new Date().toISOString(),
    method: 'WWEBJS'
  };
}

/* =======================================================
   HELPERS
======================================================= */

function isConnected() {
  return sessionStatus === 'READY' && !!client;
}

function getSessionStatus() {
  return sessionStatus;
}

function getCurrentQR() {
  return currentQR; // ahora devuelve base64 image
}

/* =======================================================
   EXPORTS
======================================================= */

module.exports = {
  connect,
  disconnect,
  sendMessage,
  isConnected,
  getSessionStatus,
  getCurrentQR
};