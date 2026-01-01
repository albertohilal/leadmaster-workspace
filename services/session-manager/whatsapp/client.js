import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';

/**
 * WhatsApp client wrapper
 * Manages a single WhatsApp Web session for one cliente_id
 */

let clientInstance = null;
let currentState = 'INIT';
let lastQRCode = null;
let clienteId = null;

/**
 * Initialize WhatsApp client for a specific cliente_id
 * @param {number} id - Cliente ID
 */
export function initializeClient(id) {
  if (clientInstance) {
    console.log(`[WhatsApp] Client already initialized for cliente_id: ${clienteId}`);
    return;
  }

  clienteId = id;
  const authPath = `./sessions/cliente_${clienteId}`;

  console.log(`[WhatsApp] Initializing client for cliente_id: ${clienteId}`);
  console.log(`[WhatsApp] Auth path: ${authPath}`);

  clientInstance = new Client({
    authStrategy: new LocalAuth({
      clientId: `cliente_${clienteId}`,
      dataPath: authPath
    }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });

  // QR code event
  clientInstance.on('qr', (qr) => {
    currentState = 'QR_REQUIRED';
    lastQRCode = qr;
    console.log('[WhatsApp] QR Code received');
    qrcode.generate(qr, { small: true });
  });

  // Ready event
  clientInstance.on('ready', () => {
    currentState = 'READY';
    lastQRCode = null;
    console.log('[WhatsApp] Client is ready');
  });

  // Authenticated event
  clientInstance.on('authenticated', () => {
    console.log('[WhatsApp] Client authenticated');
  });

  // Authentication failure
  clientInstance.on('auth_failure', (msg) => {
    currentState = 'DISCONNECTED';
    console.error('[WhatsApp] Authentication failure:', msg);
  });

  // Disconnected event
  clientInstance.on('disconnected', (reason) => {
    currentState = 'DISCONNECTED';
    console.log('[WhatsApp] Client disconnected:', reason);
  });

  // Initialize connection
  clientInstance.initialize().catch((err) => {
    console.error('[WhatsApp] Initialization error:', err);
    currentState = 'DISCONNECTED';
  });
}

/**
 * Get current session status
 * @returns {Object} Status object
 */
export function getStatus() {
  return {
    cliente_id: clienteId,
    connected: currentState === 'READY',
    state: currentState
  };
}

/**
 * Get QR code for authentication
 * @returns {string|null} QR code string or null
 */
export function getQRCode() {
  return lastQRCode;
}

/**
 * Send a WhatsApp message
 * @param {string} to - Phone number with country code
 * @param {string} message - Message text
 * @returns {Promise<Object>} Result with message_id
 */
export async function sendMessage(to, message) {
  if (!clientInstance) {
    throw new Error('WhatsApp client not initialized');
  }

  if (currentState !== 'READY') {
    throw new Error(`Session not ready. Current state: ${currentState}`);
  }

  // Format phone number: ensure it has @c.us suffix
  const formattedNumber = to.includes('@c.us') ? to : `${to}@c.us`;

  try {
    const sentMessage = await clientInstance.sendMessage(formattedNumber, message);
    return {
      ok: true,
      message_id: sentMessage.id._serialized
    };
  } catch (error) {
    console.error('[WhatsApp] Send message error:', error);
    throw error;
  }
}

/**
 * Disconnect WhatsApp client
 * @returns {Promise<void>}
 */
export async function disconnect() {
  if (!clientInstance) {
    throw new Error('WhatsApp client not initialized');
  }

  try {
    await clientInstance.destroy();
    currentState = 'DISCONNECTED';
    clientInstance = null;
    console.log('[WhatsApp] Client disconnected successfully');
  } catch (error) {
    console.error('[WhatsApp] Disconnect error:', error);
    throw error;
  }
}

/**
 * Get account information
 * @returns {Promise<Object>} Account info
 */
export async function getAccountInfo() {
  if (!clientInstance) {
    throw new Error('WhatsApp client not initialized');
  }

  if (currentState !== 'READY') {
    throw new Error(`Session not ready. Current state: ${currentState}`);
  }

  try {
    const info = await clientInstance.info;
    return {
      phone: info.wid.user,
      platform: info.platform,
      pushname: info.pushname
    };
  } catch (error) {
    console.error('[WhatsApp] Get account info error:', error);
    throw error;
  }
}
