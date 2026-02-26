const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');

const SESSION_NAME = 'admin';
const TOKENS_DIR = path.resolve(__dirname, '..', 'tokens');

let adminClient = null;
let connectPromise = null;

let sessionStatus = 'INIT';
let currentQR = null;
let qrTimestamp = null;
let qrAttempts = 0;

console.log('[WhatsAppSession] whatsapp-web.js headless VPS mode enabled (no GUI / no Xvfb)');

function attachEventHandlers(client) {
  client.on('qr', async (qrString) => {
    qrAttempts += 1;
    qrTimestamp = new Date().toISOString();
    sessionStatus = 'QR_REQUIRED';

    try {
      currentQR = await QRCode.toDataURL(qrString);
      console.log(`[WhatsAppSession] QR generated for ADMIN (attempt ${qrAttempts})`);
    } catch (error) {
      // Fallback: raw string if PNG generation fails
      currentQR = qrString;
      console.warn('[WhatsAppSession] Failed to convert QR to PNG; serving raw QR string');
    }
  });

  client.on('authenticated', () => {
    sessionStatus = 'AUTHENTICATED';
    currentQR = null;
    console.log('[WhatsAppSession] ADMIN session authenticated');
  });

  client.on('ready', () => {
    sessionStatus = 'READY';
    currentQR = null;
    console.log('✅ [WhatsAppSession] ADMIN session READY');
  });

  client.on('auth_failure', (msg) => {
    sessionStatus = 'ERROR';
    currentQR = null;
    console.error('[WhatsAppSession] Auth failure:', msg);
  });

  client.on('disconnected', (reason) => {
    sessionStatus = 'DISCONNECTED';
    currentQR = null;
    adminClient = null;
    console.warn('[WhatsAppSession] Disconnected:', reason);
  });
}

async function connect() {
  if (adminClient) {
    return { alreadyConnected: true, state: sessionStatus, session: SESSION_NAME };
  }

  if (connectPromise && (sessionStatus === 'DISCONNECTED' || sessionStatus === 'ERROR')) {
    connectPromise = null;
  }

  if (connectPromise) {
    return { alreadyConnected: true, state: sessionStatus, session: SESSION_NAME };
  }

  sessionStatus = 'INIT';
  currentQR = null;
  qrTimestamp = null;
  qrAttempts = 0;

  connectPromise = (async () => {
    try {
      const client = new Client({
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
            '--disable-dev-shm-usage'
          ]
        }
      });

      attachEventHandlers(client);
      adminClient = client;

      // Initialize is required; do not await forever in connect()
      await client.initialize();

      // If we got here without 'ready' yet, keep current status
      return client;
    } catch (error) {
      sessionStatus = 'ERROR';
      currentQR = null;
      adminClient = null;
      console.error('[WhatsAppSession] Error while connecting:', error?.message || error);
      return null;
    } finally {
      connectPromise = null;
    }
  })();

  return { alreadyConnected: false, state: sessionStatus, session: SESSION_NAME };
}

function isConnected() {
  return sessionStatus === 'READY' && !!adminClient;
}

async function disconnect() {
  if (!adminClient) {
    sessionStatus = 'DISCONNECTED';
    currentQR = null;
    qrAttempts = 0;
    return { success: true, message: 'No active session' };
  }

  const client = adminClient;
  adminClient = null;

  try {
    try {
      await client.logout();
    } catch (_) {}
    try {
      await client.destroy();
    } catch (_) {}
  } finally {
    sessionStatus = 'DISCONNECTED';
    currentQR = null;
    qrAttempts = 0;
  }

  return { success: true, message: 'Disconnected' };
}

async function sendMessage(clienteId, to, message) {
  if (!adminClient || sessionStatus !== 'READY') throw new Error('SESSION_NOT_READY');

  const rawNumber = String(to).replace(/\D/g, '');
  const chatId = `${rawNumber}@c.us`;

  try {
    await adminClient.sendMessage(chatId, message);
    return {
      success: true,
      cliente_id: clienteId,
      to: rawNumber,
      timestamp: new Date().toISOString(),
      method: 'whatsapp-web.js'
    };
  } catch (error) {
    console.error('[WhatsAppSession] sendMessage error:', error?.message || error);
    throw error;
  }
}

function getState() {
  return { status: sessionStatus };
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

module.exports = {
  connect,
  disconnect,
  sendMessage,
  getState,
  getSessionStatus,
  getCurrentQR,
  getQrAttempts,
  isConnected
};