/**
 * WhatsApp Client Wrapper - MULTI-CLIENT SINGLETON VERSION
 * Manages multiple WhatsApp Web sessions (one per cliente_id)
 * Implements 9-state explicit model for 24x7 operation
 */

import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import path from 'path';

// ===== MODELO DE 9 ESTADOS (NO NEGOCIABLE) =====
const SessionState = {
  // Estados de Inicialización
  INITIALIZING: 'INITIALIZING',           // Primera vez, sin sesión previa
  RECONNECTING: 'RECONNECTING',           // Recuperando sesión existente
  
  // Estado Operativo
  READY: 'READY',                         // Conectado y operativo
  
  // Estados de Autenticación
  QR_REQUIRED: 'QR_REQUIRED',             // Requiere escaneo de QR
  AUTH_FAILURE: 'AUTH_FAILURE',           // Autenticación falló
  
  // Estados de Desconexión (clasificados)
  DISCONNECTED_RECOVERABLE: 'DISCONNECTED_RECOVERABLE',  // Temporal
  DISCONNECTED_LOGOUT: 'DISCONNECTED_LOGOUT',            // Usuario cerró sesión
  DISCONNECTED_BANNED: 'DISCONNECTED_BANNED',            // Bloqueado
  
  // Estado de Error
  ERROR: 'ERROR'                          // Error técnico no recuperable
};

// ===== MULTI-CLIENT STORAGE =====
// Map<clienteId, { client, state, qr, reconnectionAttempts }>
const clients = new Map();
const MAX_RECONNECTION_ATTEMPTS = 3;

/**
 * Centralizes state transitions with logging
 * @param {number} clienteId - Cliente ID
 * @param {string} newState - Next state from SessionState enum
 * @param {string} reason - Human-readable reason for transition
 */
function updateState(clienteId, newState, reason) {
  const clientData = clients.get(clienteId);
  if (!clientData) {
    console.error(`[WhatsApp] Cannot update state for unknown cliente_id: ${clienteId}`);
    return;
  }
  
  const timestamp = new Date().toISOString();
  console.log(`[WhatsApp][${clienteId}] State: ${clientData.state} → ${newState} | Reason: ${reason} | Time: ${timestamp}`);
  clientData.state = newState;
}

/**
 * Verifica si existe sesión persistida en disco
 * @param {number} id - Cliente ID
 * @returns {boolean} True si existe sesión válida
 */
function hasExistingSession(id) {
  const sessionPath = path.resolve(`./sessions/cliente_${id}`);
  
  if (!fs.existsSync(sessionPath)) {
    return false;
  }
  
  // LocalAuth guarda la sesión en subdirectorio 'session'
  const sessionFile = path.join(sessionPath, 'session');
  return fs.existsSync(sessionFile);
}

/**
 * Initialize WhatsApp client for a specific cliente
 * @param {number} id - Cliente ID
 */
export function initialize(id) {
  if (clients.has(id)) {
    console.log(`[WhatsApp] Client already initialized for cliente_id: ${id}`);
    return;
  }

  const authPath = `./sessions/cliente_${id}`;

  console.log(`[WhatsApp] Initializing for cliente_id: ${id}`);
  console.log(`[WhatsApp] Session path: ${authPath}`);

  // ===== VALIDACIÓN DE SESIÓN EN DISCO (CRÍTICO) =====
  const hasSession = hasExistingSession(id);
  
  const initialState = hasSession 
    ? SessionState.RECONNECTING 
    : SessionState.INITIALIZING;
  
  // Create client data structure
  const clientData = {
    client: null,
    state: initialState,
    qr: null,
    reconnectionAttempts: 0
  };
  
  clients.set(id, clientData);
  
  console.log(`[WhatsApp][${id}] Initial state: ${initialState} (session exists: ${hasSession})`);

  const clientInstance = new Client({
    authStrategy: new LocalAuth({
      clientId: `cliente_${id}`,
      dataPath: authPath
    }),
    puppeteer: {
      executablePath: '/usr/bin/google-chrome',
      headless: 'old',
      args: [
        '--headless=old',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
        '--no-zygote',
        '--disable-features=site-per-process'
      ]
    }

  });
  
  clientData.client = clientInstance;
  clientData.client = clientInstance;

  // ===== EVENT HANDLERS CON GESTIÓN DE ESTADOS =====
  
  // QR code event
  clientInstance.on('qr', (qr) => {
    clientData.qr = qr; // Guardar en memoria para lectura posterior
    updateState(id, SessionState.QR_REQUIRED, 'QR code generated - waiting for scan');
    console.log(`[WhatsApp][${id}] QR Code received - scan with your phone:`);
    qrcode.generate(qr, { small: true });
  });

  // Ready event
  clientInstance.on('ready', () => {
    clientData.reconnectionAttempts = 0; // Reset contador al conectar exitosamente
    clientData.qr = null; // Limpiar QR cuando la sesión está lista
    updateState(id, SessionState.READY, 'WhatsApp session ready - can send messages');
    console.log(`[WhatsApp][${id}] Client is READY`);
  });

  // Authenticated event
  clientInstance.on('authenticated', () => {
    console.log(`[WhatsApp][${id}] Authenticated successfully`);
  });

  // Authentication failure
  clientInstance.on('auth_failure', (msg) => {
    updateState(id, SessionState.AUTH_FAILURE, `Authentication failed: ${msg}`);
    console.error(`[WhatsApp][${id}] Authentication failure:`, msg);
  });

  // Disconnected event - CLASIFICACIÓN INTELIGENTE
  clientInstance.on('disconnected', (reason) => {
    console.log(`[WhatsApp][${id}] Disconnected. Reason:`, reason);
    
    // Logout explícito del usuario
    if (reason === 'LOGOUT' || reason === 'logout') {
      updateState(id, SessionState.DISCONNECTED_LOGOUT, 'User logged out from mobile');
      return;
    }
    
    // Sesión abierta en otro lugar
    if (reason === 'CONFLICT' || reason === 'conflict') {
      updateState(id, SessionState.DISCONNECTED_LOGOUT, 'Session opened elsewhere');
      return;
    }
    
    // Número bloqueado/baneado
    if (reason && (reason.includes('ban') || reason.includes('blocked'))) {
      updateState(id, SessionState.DISCONNECTED_BANNED, 'Number banned by WhatsApp');
      return;
    }
    
    // Desconexión recuperable (red, temporal, etc) - CON LÍMITE
    if (clientData.reconnectionAttempts < MAX_RECONNECTION_ATTEMPTS) {
      clientData.reconnectionAttempts++;
      updateState(
        id,
        SessionState.DISCONNECTED_RECOVERABLE, 
        `Temporary disconnection - attempt ${clientData.reconnectionAttempts}/${MAX_RECONNECTION_ATTEMPTS}`
      );
    } else {
      updateState(id, SessionState.ERROR, 'Max reconnection attempts reached');
    }
  });

  // Change state event (adicional de whatsapp-web.js)
  clientInstance.on('change_state', (state) => {
    console.log(`[WhatsApp][${id}] Internal state changed:`, state);
  });

  // Loading screen event
  clientInstance.on('loading_screen', (percent, message) => {
    console.log(`[WhatsApp][${id}] Loading: ${percent}% - ${message}`);
  });

  // Initialize
  clientInstance.initialize().catch((err) => {
    updateState(id, SessionState.ERROR, `Initialization error: ${err.message}`);
    console.error(`[WhatsApp][${id}] Initialization error:`, err);
  });
}

/**
 * Get current session status (API pública - refactorizada para multi-cliente)
 * @param {number} clienteId - Cliente ID
 * @returns {Object} Status object
 */
export function getStatus(clienteId) {
  const clientData = clients.get(clienteId);
  
  if (!clientData) {
    return {
      cliente_id: clienteId,
      connected: false,
      state: 'NOT_INITIALIZED',
      reconnection_attempts: 0,
      max_reconnection_attempts: MAX_RECONNECTION_ATTEMPTS,
      error: 'Client not initialized for this cliente_id'
    };
  }
  
  return {
    cliente_id: clienteId,
    connected: clientData.state === SessionState.READY,
    state: clientData.state,
    reconnection_attempts: clientData.reconnectionAttempts,
    max_reconnection_attempts: MAX_RECONNECTION_ATTEMPTS
  };
}

/**
 * Verifica si la sesión está lista para enviar mensajes
 * @param {number} clienteId - Cliente ID
 * @returns {boolean}
 */
export function isReady(clienteId) {
  const clientData = clients.get(clienteId);
  return clientData ? clientData.state === SessionState.READY : false;
}

/**
 * Verifica si el estado requiere autenticación (QR)
 * @param {number} clienteId - Cliente ID
 * @returns {boolean}
 */
export function needsAuthentication(clienteId) {
  const clientData = clients.get(clienteId);
  if (!clientData) return false;
  
  return [
    SessionState.QR_REQUIRED,
    SessionState.AUTH_FAILURE,
    SessionState.DISCONNECTED_LOGOUT
  ].includes(clientData.state);
}

/**
 * Verifica si el estado es auto-recuperable
 * @param {number} clienteId - Cliente ID
 * @returns {boolean}
 */
export function isRecoverable(clienteId) {
  const clientData = clients.get(clienteId);
  if (!clientData) return false;
  
  return [
    SessionState.INITIALIZING,
    SessionState.RECONNECTING,
    SessionState.DISCONNECTED_RECOVERABLE
  ].includes(clientData.state);
}

/**
 * Obtiene el último QR generado (si existe)
 * @param {number} clienteId - Cliente ID
 * @returns {string|null} QR code string o null
 */
export function getLastQR(clienteId) {
  const clientData = clients.get(clienteId);
  return clientData ? clientData.qr : null;
}

/**
 * Send a WhatsApp message (API pública - refactorizada para multi-cliente)
 * @param {number} clienteId - Cliente ID
 * @param {string} to - Phone number with country code
 * @param {string} message - Message text
 * @returns {Promise<Object>} Result
 */
export async function sendMessage(clienteId, to, message) {
  const clientData = clients.get(clienteId);
  
  if (!clientData || !clientData.client) {
    throw new Error(`WhatsApp client not initialized for cliente_id: ${clienteId}`);
  }

  // Validación estricta: solo READY permite envío
  if (clientData.state !== SessionState.READY) {
    throw new Error(`Session not ready. Current state: ${clientData.state}`);
  }

  // Format phone number
  const formattedNumber = to.includes('@c.us') ? to : `${to}@c.us`;

  try {
    const sentMessage = await clientData.client.sendMessage(formattedNumber, message);
    return {
      ok: true,
      message_id: sentMessage.id._serialized
    };
  } catch (error) {
    console.error(`[WhatsApp][${clienteId}] Send error:`, error);
    throw error;
  }
}
