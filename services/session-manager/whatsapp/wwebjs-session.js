const fs = require('fs');
const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcodeTerminal = require('qrcode-terminal');
const QRCode = require('qrcode'); // ← NUEVO

const SESSION_NAME = 'admin';
const TOKENS_DIR = path.resolve(__dirname, '..', 'tokens');

let client = null;
let connectPromise = null;

let sessionStatus = 'INIT';
let currentQR = null; // puede ser PNG base64 (dataURL) o raw string
let qrAttempts = 0;
let qrTimestamp = null; // ISO del último QR recibido

/* =======================================================
   EVENT HANDLERS
======================================================= */

function attachEventHandlers(waClient) {
  waClient.on('qr', async (qr) => {
    // Estado y métricas SIEMPRE se actualizan aunque falle conversión
    sessionStatus = 'QR_REQUIRED';
    qrAttempts += 1;
    qrTimestamp = new Date().toISOString();

    console.log(
      `\n================ QR RECEIVED (Attempt ${qrAttempts}) ================\n`
    );

    // Mostrar en terminal (solo debug). Usa raw string.
    try {
      qrcodeTerminal.generate(qr, { small: true });
    } catch (_) {}

    // Intentar convertir raw string → base64 PNG (dataURL)
    try {
      const qrBase64 = await QRCode.toDataURL(qr);
      currentQR = qrBase64;
      console.log('[WWEBJS] QR stored as PNG dataURL');
    } catch (err) {
      // Fallback: raw string (NO invalida el flujo)
      currentQR = qr;
      console.warn(
        '[WWEBJS] QR PNG conversion failed; falling back to raw string:',
        err?.message || err
      );
    }

    console.log(
      '\nScan from: WhatsApp → Dispositivos vinculados → Vincular dispositivo\n'
    );
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
    qrTimestamp = null;
    connectPromise = null;

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
    qrTimestamp = null;
    connectPromise = null;

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

  // Evitar bloqueo por promesas colgadas en estados terminales
  if (connectPromise && (sessionStatus === 'DISCONNECTED' || sessionStatus === 'ERROR')) {
    connectPromise = null;
  }

  if (connectPromise) {
    return { alreadyConnected: true, state: sessionStatus, session: SESSION_NAME };
  }

  sessionStatus = 'INIT';
  currentQR = null;
  qrAttempts = 0;
  qrTimestamp = null;

  // Asegurar carpeta de tokens (LocalAuth) antes de iniciar cliente
  try {
    fs.mkdirSync(TOKENS_DIR, { recursive: true });
  } catch (error) {
    console.error('[WWEBJS] Failed to ensure TOKENS_DIR exists:', error?.message || error);
    sessionStatus = 'ERROR';
    return { alreadyConnected: false, state: sessionStatus, session: SESSION_NAME };
  }

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

    const initPromise = waClient
      .initialize()
      .catch((error) => {
        console.error('[WWEBJS] Error while connecting:', error?.message || error);

        // Solo limpiar si este sigue siendo el client actual
        if (client === waClient) {
          sessionStatus = 'ERROR';
          currentQR = null;
          qrAttempts = 0;
          qrTimestamp = null;
          client = null;
        }

        return null;
      })
      .finally(() => {
        if (connectPromise === initPromise) {
          connectPromise = null;
        }
      });

    connectPromise = initPromise;

    return { alreadyConnected: false, state: sessionStatus, session: SESSION_NAME };
  } catch (error) {
    console.error('[WWEBJS] Failed to start client:', error?.message || error);

    sessionStatus = 'ERROR';
    currentQR = null;
    qrAttempts = 0;
    qrTimestamp = null;
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
    qrTimestamp = null;
    connectPromise = null;
    return { success: true, message: 'No active session' };
  }

  const currentClient = client;
  client = null;

  try {
    try {
      if (typeof currentClient.logout === 'function') {
        await currentClient.logout();
      }
    } catch (_) {}

    try {
      if (typeof currentClient.destroy === 'function') {
        await currentClient.destroy();
      }
    } catch (_) {}
  } catch (_) {}

  sessionStatus = 'DISCONNECTED';
  currentQR = null;
  qrAttempts = 0;
  qrTimestamp = null;
  connectPromise = null;

  return { success: true, message: 'Disconnected' };
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
  return currentQR;
}

function getQrAttempts() {
  return qrAttempts;
}

function getQrTimestamp() {
  return qrTimestamp;
}

/* =======================================================
   EXPORTS
======================================================= */

module.exports = {
  connect,
  disconnect,
  isConnected,
  getSessionStatus,
  getCurrentQR,
  getQrAttempts,
  getQrTimestamp
};