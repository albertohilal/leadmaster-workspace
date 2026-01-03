/**
 * WhatsApp Client Wrapper - IMPROVED VERSION
 * Manages a single WhatsApp Web session for one cliente_id
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

let clientInstance = null;
let currentState = SessionState.INITIALIZING;
let clienteId = null;
let reconnectionAttempts = 0;
const MAX_RECONNECTION_ATTEMPTS = 3;
let lastQRCode = null; // Almacena el último QR generado (solo lectura)

/**
 * Centralizes state transitions with logging
 * @param {string} newState - Next state from SessionState enum
 * @param {string} reason - Human-readable reason for transition
 */
function updateState(newState, reason) {
  const timestamp = new Date().toISOString();
  console.log(`[WhatsApp] State: ${currentState} → ${newState} | Reason: ${reason} | Time: ${timestamp}`);
  currentState = newState;
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

  // ===== VALIDACIÓN DE SESIÓN EN DISCO (CRÍTICO) =====
  const hasSession = hasExistingSession(clienteId);
  
  if (hasSession) {
    updateState(SessionState.RECONNECTING, 'Recovering existing session from disk');
  } else {
    updateState(SessionState.INITIALIZING, 'First time initialization - no session found');
  }

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

  // ===== EVENT HANDLERS CON GESTIÓN DE ESTADOS =====
  
  // QR code event
  clientInstance.on('qr', (qr) => {
    lastQRCode = qr; // Guardar en memoria para lectura posterior
    updateState(SessionState.QR_REQUIRED, 'QR code generated - waiting for scan');
    console.log('[WhatsApp] QR Code received - scan with your phone:');
    qrcode.generate(qr, { small: true });
  });

  // Ready event
  clientInstance.on('ready', () => {
    reconnectionAttempts = 0; // Reset contador al conectar exitosamente
    lastQRCode = null; // Limpiar QR cuando la sesión está lista
    updateState(SessionState.READY, 'WhatsApp session ready - can send messages');
    console.log('[WhatsApp] Client is READY');
  });

  // Authenticated event
  clientInstance.on('authenticated', () => {
    console.log('[WhatsApp] Authenticated successfully');
  });

  // Authentication failure
  clientInstance.on('auth_failure', (msg) => {
    updateState(SessionState.AUTH_FAILURE, `Authentication failed: ${msg}`);
    console.error('[WhatsApp] Authentication failure:', msg);
  });

  // Disconnected event - CLASIFICACIÓN INTELIGENTE
  clientInstance.on('disconnected', (reason) => {
    console.log('[WhatsApp] Disconnected. Reason:', reason);
    
    // Logout explícito del usuario
    if (reason === 'LOGOUT' || reason === 'logout') {
      updateState(SessionState.DISCONNECTED_LOGOUT, 'User logged out from mobile');
      return;
    }
    
    // Sesión abierta en otro lugar
    if (reason === 'CONFLICT' || reason === 'conflict') {
      updateState(SessionState.DISCONNECTED_LOGOUT, 'Session opened elsewhere');
      return;
    }
    
    // Número bloqueado/baneado
    if (reason && (reason.includes('ban') || reason.includes('blocked'))) {
      updateState(SessionState.DISCONNECTED_BANNED, 'Number banned by WhatsApp');
      return;
    }
    
    // Desconexión recuperable (red, temporal, etc) - CON LÍMITE
    if (reconnectionAttempts < MAX_RECONNECTION_ATTEMPTS) {
      reconnectionAttempts++;
      updateState(
        SessionState.DISCONNECTED_RECOVERABLE, 
        `Temporary disconnection - attempt ${reconnectionAttempts}/${MAX_RECONNECTION_ATTEMPTS}`
      );
    } else {
      updateState(SessionState.ERROR, 'Max reconnection attempts reached');
    }
  });

  // Change state event (adicional de whatsapp-web.js)
  clientInstance.on('change_state', (state) => {
    console.log('[WhatsApp] Internal state changed:', state);
  });

  // Loading screen event
  clientInstance.on('loading_screen', (percent, message) => {
    console.log(`[WhatsApp] Loading: ${percent}% - ${message}`);
  });

  // Initialize
  clientInstance.initialize().catch((err) => {
    updateState(SessionState.ERROR, `Initialization error: ${err.message}`);
    console.error('[WhatsApp] Initialization error:', err);
  });
}

/**
 * Get current session status (API pública - NO modificada)
 * @returns {Object} Status object
 */
export function getStatus() {
  return {
    cliente_id: clienteId,
    connected: currentState === SessionState.READY,
    state: currentState,
    // Campos adicionales para mejor integración
    reconnection_attempts: reconnectionAttempts,
    max_reconnection_attempts: MAX_RECONNECTION_ATTEMPTS
  };
}

/**
 * Verifica si la sesión está lista para enviar mensajes
 * @returns {boolean}
 */
export function isReady() {
  return currentState === SessionState.READY;
}

/**
 * Verifica si el estado requiere autenticación (QR)
 * @returns {boolean}
 */
export function needsAuthentication() {
  return [
    SessionState.QR_REQUIRED,
    SessionState.AUTH_FAILURE,
    SessionState.DISCONNECTED_LOGOUT
  ].includes(currentState);
}

/**
 * Verifica si el estado es auto-recuperable
 * @returns {boolean}
 */
export function isRecoverable() {
  return [
    SessionState.INITIALIZING,
    SessionState.RECONNECTING,
    SessionState.DISCONNECTED_RECOVERABLE
  ].includes(currentState);
}

/**
 * Obtiene el último QR generado (si existe)
 * @returns {string|null} QR code string o null
 */
export function getLastQR() {
  return lastQRCode;
}

/**
 * Send a WhatsApp message (API pública - NO modificada)
 * @param {string} to - Phone number with country code
 * @param {string} message - Message text
 * @returns {Promise<Object>} Result
 */
export async function sendMessage(to, message) {
  if (!clientInstance) {
    throw new Error('WhatsApp client not initialized');
  }

  // Validación estricta: solo READY permite envío
  if (currentState !== SessionState.READY) {
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
