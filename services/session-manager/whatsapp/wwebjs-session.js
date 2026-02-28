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
   CENTRAL HUB BRIDGE (Listener persistence)
======================================================= */

const CENTRAL_HUB_BASE_URL = String(process.env.CENTRAL_HUB_BASE_URL || '').replace(/\/+$/, '');
const CENTRAL_HUB_USER = process.env.CENTRAL_HUB_USER;
const CENTRAL_HUB_PASS = process.env.CENTRAL_HUB_PASS;
const CENTRAL_HUB_CLIENTE_ID = Number(
  process.env.CENTRAL_HUB_CLIENTE_ID || process.env.CLIENTE_ID || 1
);

let centralHubToken = null;
let centralHubLoginPromise = null;

function normalizePhone(raw) {
  if (!raw) return null;
  const value = String(raw).trim();

  // Ignorar grupos
  if (value.endsWith('@g.us')) return null;

  // Normalizar IDs WhatsApp
  const withoutSuffix = value
    .replace(/@c\.us$/i, '')
    .replace(/@s\.whatsapp\.net$/i, '');

  const digits = withoutSuffix.replace(/\D+/g, '');
  return digits || null;
}

function isCentralHubConfigured() {
  return Boolean(CENTRAL_HUB_BASE_URL && CENTRAL_HUB_USER && CENTRAL_HUB_PASS);
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });

    const text = await resp.text().catch(() => '');
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch (_) {}

    return { resp, text, json };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function centralHubLogin() {
  if (!isCentralHubConfigured()) {
    throw new Error('CENTRAL_HUB_BASE_URL/CENTRAL_HUB_USER/CENTRAL_HUB_PASS missing');
  }

  if (centralHubLoginPromise) return centralHubLoginPromise;

  centralHubLoginPromise = (async () => {
    const loginUrl = `${CENTRAL_HUB_BASE_URL}/api/auth/login`;
    const { resp, json, text } = await fetchJsonWithTimeout(
      loginUrl,
      {
        method: 'POST',
        body: JSON.stringify({ usuario: CENTRAL_HUB_USER, password: CENTRAL_HUB_PASS })
      },
      8000
    );

    if (!resp.ok) {
      throw new Error(`Central Hub login failed: HTTP ${resp.status} ${resp.statusText} :: ${text}`);
    }

    const token = json?.token;
    if (!token) {
      throw new Error(`Central Hub login response missing token :: ${text}`);
    }

    centralHubToken = token;
    return token;
  })();

  try {
    return await centralHubLoginPromise;
  } finally {
    centralHubLoginPromise = null;
  }
}

async function postToCentralHubListener({ telefono, texto, esHumano }) {
  if (!isCentralHubConfigured()) {
    console.error('[WWEBJS->HUB] Central Hub bridge disabled: missing env');
    return false;
  }

  if (!telefono || !texto) return false;

  const payload = {
    cliente_id: CENTRAL_HUB_CLIENTE_ID,
    telefono,
    texto,
    esHumano: Boolean(esHumano)
  };

  const postOnce = async () => {
    const token = centralHubToken || (await centralHubLogin());
    const url = `${CENTRAL_HUB_BASE_URL}/api/listener/test-message`;
    return fetchJsonWithTimeout(
      url,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      },
      8000
    );
  };

  try {
    let { resp, text } = await postOnce();

    if (resp.status === 401) {
      // Token expirado/invalidado: relogin 1 vez
      centralHubToken = null;
      ({ resp, text } = await postOnce());
    }

    if (!resp.ok) {
      console.error(`[WWEBJS->HUB] Listener POST failed: HTTP ${resp.status} ${resp.statusText} :: ${text}`);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[WWEBJS->HUB] Failed to post to listener:', err?.message || err);
    return false;
  }
}

/* =======================================================
   EVENT HANDLERS
======================================================= */

function attachEventHandlers(waClient) {
  // Inbound: mensajes recibidos desde prospectos
  waClient.on('message', async (msg) => {
    try {
      if (!msg || msg.fromMe) return;

      const telefono = normalizePhone(msg.from);
      if (!telefono) return;

      const texto = typeof msg.body === 'string' ? msg.body.trim() : '';
      if (!texto) return;

      const ok = await postToCentralHubListener({ telefono, texto, esHumano: false });
      if (ok) {
        console.log(`[WWEBJS->HUB] inbound saved telefono=${telefono}`);
      }
    } catch (err) {
      console.error('[WWEBJS->HUB] inbound handler error:', err?.message || err);
    }
  });

  // Outbound: mensajes enviados desde la UI (WhatsApp Web). Se consideran humanos (pausa IA)
  waClient.on('message_create', async (msg) => {
    try {
      if (!msg || !msg.fromMe) return;

      const telefono = normalizePhone(msg.to);
      if (!telefono) return;

      const texto = typeof msg.body === 'string' ? msg.body.trim() : '';
      if (!texto) return;

      const ok = await postToCentralHubListener({ telefono, texto, esHumano: true });
      if (ok) {
        console.log(`[WWEBJS->HUB] outbound saved (human) telefono=${telefono}`);
      }
    } catch (err) {
      console.error('[WWEBJS->HUB] outbound handler error:', err?.message || err);
    }
  });

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