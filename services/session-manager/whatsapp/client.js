/**
 * WhatsApp Client Wrapper
 * Manages a single WhatsApp Web session for one cliente_id
 */

import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';

let clientInstance = null;
let currentState = 'INIT';
let clienteId = null;

/**
 * Initialize WhatsApp client
 * @param {number} id - Cliente ID
 */
export function initialize(id) {
  if (clientInstance) {
    console.log(`[WhatsApp] Client already initialized for cliente_id: ${clienteId}`);
    return;
  }

  clienteId = id;
  const authPath = `./sessions/cliente_${clienteId}`;

  console.log(`[WhatsApp] Initializing for cliente_id: ${clienteId}`);
  console.log(`[WhatsApp] Session path: ${authPath}`);

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
    console.log('[WhatsApp] QR Code received - scan with your phone:');
    qrcode.generate(qr, { small: true });
  });

  // Ready event
  clientInstance.on('ready', () => {
    currentState = 'READY';
    console.log('[WhatsApp] Client is READY');
  });

  // Authenticated event
  clientInstance.on('authenticated', () => {
    console.log('[WhatsApp] Authenticated');
  });

  // Authentication failure
  clientInstance.on('auth_failure', (msg) => {
    currentState = 'DISCONNECTED';
    console.error('[WhatsApp] Authentication failure:', msg);
  });

  // Disconnected event
  clientInstance.on('disconnected', (reason) => {
    currentState = 'DISCONNECTED';
    console.log('[WhatsApp] Disconnected:', reason);
  });

  // Initialize
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
 * Send a WhatsApp message
 * @param {string} to - Phone number with country code
 * @param {string} message - Message text
 * @returns {Promise<Object>} Result
 */
export async function sendMessage(to, message) {
  if (!clientInstance) {
    throw new Error('WhatsApp client not initialized');
  }

  if (currentState !== 'READY') {
    throw new Error(`Session not ready. Current state: ${currentState}`);
  }

  // Format phone number
  const formattedNumber = to.includes('@c.us') ? to : `${to}@c.us`;

  try {
    const sentMessage = await clientInstance.sendMessage(formattedNumber, message);
    return {
      ok: true,
      message_id: sentMessage.id._serialized
    };
  } catch (error) {
    console.error('[WhatsApp] Send error:', error);
    throw error;
  }
}
