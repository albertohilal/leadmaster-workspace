const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');

const QR_TTL_MS = 60000; // 60 segundos

let client = null;
let qrCheckInterval = null;
let globalState = {
  status: 'INIT',
  connected: false,
  qrDataUrl: null,
  qrGeneratedAt: null,
  lastError: null,
  updatedAt: new Date().toISOString(),
  readyAt: null,
  account: null
};

function updateState(updates) {
  globalState = {
    ...globalState,
    ...updates,
    updatedAt: new Date().toISOString()
  };
  console.log('[SessionManager]', 'State updated:', globalState.status);
}

async function initializeClient() {
  if (client) {
    console.log('[SessionManager]', 'Client already initialized');
    return;
  }

  console.log('[SessionManager]', 'Initializing WhatsApp client...');
  
  updateState({ status: 'CONNECTING', qrDataUrl: null, qrGeneratedAt: null });

  client = new Client({
    authStrategy: new LocalAuth({ clientId: 'admin' }),
    
    // Disable WhatsApp Web version cache to avoid internal bugs
    // Related to markedUnread / sendSeen synchronization issues
    // Using 'none' prevents whatsapp-web.js from caching WhatsApp Web version
    // which can cause state sync errors when sending messages to new chats
    webVersionCache: {
      type: 'none'
    },
    
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    }
  });

  client.on('qr', async (qr) => {
    console.log('[SessionManager]', 'QR code received');
    try {
      const qrDataUrl = await qrcode.toDataURL(qr);
      updateState({ 
        status: 'QR_REQUIRED', 
        qrDataUrl,
        qrGeneratedAt: Date.now()
      });
    } catch (error) {
      console.error('[SessionManager]', 'Error generating QR:', error);
      updateState({ status: 'ERROR', lastError: error.message });
    }
  });

  client.on('authenticated', () => {
    console.log('[SessionManager]', 'Authenticated successfully');
    updateState({ status: 'CONNECTING', qrDataUrl: null, qrGeneratedAt: null });
  });

  client.on('ready', async () => {
    console.log('[SessionManager]', 'Client is ready');
    
    // Inject runtime patch to neutralize sendSeen bug
    try {
      await client.pupPage.evaluate(() => {
        try {
          // Override Store.SendSeen.sendSeen if exists
          if (window.Store && window.Store.SendSeen && window.Store.SendSeen.sendSeen) {
            window.Store.SendSeen.sendSeen = async () => {
              // noop - do nothing
            };
            console.log('[Patch] Store.SendSeen.sendSeen neutralized');
          }
          
          // Override WWebJS.sendSeen if exists
          if (window.WWebJS && window.WWebJS.sendSeen) {
            window.WWebJS.sendSeen = async () => {
              // noop - do nothing
            };
            console.log('[Patch] WWebJS.sendSeen neutralized');
          }
        } catch (err) {
          console.warn('[Patch] Error applying sendSeen patch:', err.message);
        }
      });
      console.log('[SessionManager] sendSeen patch applied successfully');
    } catch (patchError) {
      console.warn('[SessionManager] Could not apply sendSeen patch:', patchError.message);
    }
    
    try {
      const info = client.info;
      const account = {
        wid: info.wid._serialized,
        name: info.pushname,
        number: info.wid.user
      };
      
      updateState({
        status: 'READY',
        connected: true,
        qrDataUrl: null,
        qrGeneratedAt: null,
        readyAt: new Date().toISOString(),
        account
      });
    } catch (error) {
      console.error('[SessionManager]', 'Error getting account info:', error);
      updateState({
        status: 'READY',
        connected: true,
        qrDataUrl: null,
        qrGeneratedAt: null,
        readyAt: new Date().toISOString()
      });
    }
  });

  client.on('disconnected', (reason) => {
    console.log('[SessionManager]', 'Client disconnected:', reason);
    updateState({
      status: 'DISCONNECTED',
      connected: false,
      qrDataUrl: null,
      account: null,
      lastError: reason
    });
  });

  client.on('auth_failure', (error) => {
    console.error('[SessionManager]', 'Authentication failure:', error);
    updateState({
      status: 'ERROR',
      connected: false,
      qrDataUrl: null,
      lastError: 'Authentication failed'
    });
  });

  try {
    await client.initialize();
    startQRCheckInterval();
  } catch (error) {
    console.error('[SessionManager]', 'Error initializing client:', error);
    updateState({
      status: 'ERROR',
      connected: false,
      lastError: error.message
    });
  }
}

async function recreateClient() {
  console.log('[SessionManager]', 'Recreating client for QR refresh...');
  
  try {
    if (client) {
      await client.destroy();
      client = null;
    }
  } catch (error) {
    console.error('[SessionManager]', 'Error destroying client:', error);
  }
  
  await initializeClient();
}

function startQRCheckInterval() {
  if (qrCheckInterval) {
    return;
  }

  qrCheckInterval = setInterval(() => {
    if (globalState.status !== 'QR_REQUIRED') {
      return;
    }

    if (!globalState.qrGeneratedAt) {
      return;
    }

    const qrAge = Date.now() - globalState.qrGeneratedAt;
    
    if (qrAge > QR_TTL_MS) {
      console.log('[SessionManager]', `QR expired (${Math.floor(qrAge / 1000)}s), regenerating...`);
      recreateClient().catch(error => {
        console.error('[SessionManager]', 'Error recreating client:', error);
        updateState({
          status: 'ERROR',
          lastError: `Failed to regenerate QR: ${error.message}`
        });
      });
    }
  }, 15000); // Check every 15 seconds
  
  console.log('[SessionManager]', 'QR check interval started');
}

function stopQRCheckInterval() {
  if (qrCheckInterval) {
    clearInterval(qrCheckInterval);
    qrCheckInterval = null;
    console.log('[SessionManager]', 'QR check interval stopped');
  }
}

async function connect() {
  if (client && globalState.status === 'READY') {
    console.log('[SessionManager]', 'Already connected');
    return { success: true, message: 'Already connected' };
  }

  await initializeClient();
  return { success: true, message: 'Connection initiated' };
}

async function disconnect() {
  if (!client) {
    console.log('[SessionManager]', 'No client to disconnect');
    return { success: true, message: 'No active session' };
  }

  stopQRCheckInterval();

  try {
    await client.destroy();
    client = null;
    updateState({
      status: 'DISCONNECTED',
      connected: false,
      qrDataUrl: null,
      qrGeneratedAt: null,
      account: null,
      readyAt: null
    });
    console.log('[SessionManager]', 'Client disconnected successfully');
    return { success: true, message: 'Disconnected successfully' };
  } catch (error) {
    console.error('[SessionManager]', 'Error disconnecting:', error);
    return { success: false, error: error.message };
  }
}

function normalizePhoneNumber(phone) {
  const cleaned = phone.replace(/\D/g, '');
  return `${cleaned}@c.us`;
}

async function sendMessage(clienteId, to, message) {
  if (!client || globalState.status !== 'READY') {
    throw new Error('Session not ready');
  }

  const chatId = normalizePhoneNumber(to);
  
  console.log('[SessionManager]', `Sending message for cliente_id=${clienteId} to ${chatId}`);

  try {
    const result = await client.sendMessage(chatId, message);
    return {
      success: true,
      message_id: result.id._serialized,
      cliente_id: clienteId,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('[SessionManager]', 'Error sending message:', error);
    throw error;
  }
}

function getState() {
  return { ...globalState };
}

function getQRCode() {
  return globalState.qrDataUrl;
}

async function cleanup() {
  console.log('[SessionManager] Cleaning up WhatsApp client...');
  
  try {
    stopQRCheckInterval();
  } catch (error) {
    console.error('[SessionManager] Error stopping QR check interval:', error);
  }
  
  if (client) {
    try {
      await client.destroy();
      client = null;
      console.log('[SessionManager] WhatsApp client destroyed');
    } catch (error) {
      console.error('[SessionManager] Error destroying client:', error);
      client = null;
    }
  }
}

module.exports = {
  connect,
  disconnect,
  sendMessage,
  getState,
  getQRCode,
  cleanup
};
