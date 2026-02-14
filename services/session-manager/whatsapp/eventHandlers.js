/**
 * WhatsApp Client Event Handlers
 * 
 * Centralized event handling for WhatsApp Web clients
 * Implements 9-state model for session lifecycle
 */

import qrcode from 'qrcode-terminal';
import { destroyClient } from './clientFactory.js';

// ===== MODELO DE 9 ESTADOS (NO NEGOCIABLE) =====
export const SessionState = {
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

const MAX_RECONNECTION_ATTEMPTS = 3;

/**
 * Centralizes state transitions with logging
 * @param {number} clienteId - Cliente ID
 * @param {Object} wrapper - Client wrapper object
 * @param {string} newState - Next state from SessionState enum
 * @param {string} reason - Human-readable reason for transition
 */
function updateState(clienteId, wrapper, newState, reason) {
  const timestamp = new Date().toISOString();
  console.log(`[WhatsApp][${clienteId}] State: ${wrapper.state} → ${newState} | Reason: ${reason} | Time: ${timestamp}`);
  wrapper.state = newState;
}

/**
 * Setup all event handlers for a WhatsApp client
 * @param {number} clienteId - Cliente ID  
 * @param {Object} wrapper - Client wrapper with {client, state, qr, reconnectionAttempts}
 */
export function setupClientEventHandlers(clienteId, wrapper) {
  const { client } = wrapper;
  
  // QR code event
  client.on('qr', (qr) => {
    wrapper.qr = qr;
    updateState(clienteId, wrapper, SessionState.QR_REQUIRED, 'QR code generated - waiting for scan');
    console.log(`[WhatsApp][${clienteId}] QR Code received - scan with your phone:`);
    qrcode.generate(qr, { small: true });
  });

  // Ready event
  client.on('ready', () => {
    wrapper.reconnectionAttempts = 0;
    wrapper.qr = null;
    updateState(clienteId, wrapper, SessionState.READY, 'WhatsApp session ready - can send messages');
    console.log(`[WhatsApp][${clienteId}] Client is READY`);
  });

  // Authenticated event
  client.on('authenticated', () => {
    console.log(`[WhatsApp][${clienteId}] Authenticated successfully`);
  });

  // Authentication failure
  client.on('auth_failure', (msg) => {
    updateState(clienteId, wrapper, SessionState.AUTH_FAILURE, `Authentication failed: ${msg}`);
    console.error(`[WhatsApp][${clienteId}] Authentication failure:`, msg);
  });

  // Disconnected event - CLASIFICACIÓN INTELIGENTE
  client.on('disconnected', (reason) => {
    console.log(`[WhatsApp][${clienteId}] Disconnected. Reason:`, reason);
    
    // Logout explícito del usuario
    if (reason === 'LOGOUT' || reason === 'logout') {
      updateState(clienteId, wrapper, SessionState.DISCONNECTED_LOGOUT, 'User logged out from mobile');
      
      // Schedule cleanup after delay (CRIT-2: prevent memory leak)
      console.log(`[WhatsApp][${clienteId}] Terminal state LOGOUT - scheduling cleanup in 60s`);
      setTimeout(async () => {
        await destroyClient(clienteId);
      }, 60000); // 60 seconds delay to allow frontend to read final state
      
      return;
    }
    
    // Sesión abierta en otro lugar
    if (reason === 'CONFLICT' || reason === 'conflict') {
      updateState(clienteId, wrapper, SessionState.DISCONNECTED_LOGOUT, 'Session opened elsewhere');
      return;
    }
    
    // Número bloqueado/baneado
    if (reason && (reason.includes('ban') || reason.includes('blocked'))) {
      updateState(clienteId, wrapper, SessionState.DISCONNECTED_BANNED, 'Number banned by WhatsApp');
      
      // Schedule cleanup after delay (CRIT-2: prevent memory leak)
      console.log(`[WhatsApp][${clienteId}] Terminal state BANNED - scheduling cleanup in 60s`);
      setTimeout(async () => {
        await destroyClient(clienteId);
      }, 60000); // 60 seconds delay to allow frontend to read final state
      
      return;
    }
    
    // Desconexión recuperable (red, temporal, etc) - CON LÍMITE
    if (wrapper.reconnectionAttempts < MAX_RECONNECTION_ATTEMPTS) {
      wrapper.reconnectionAttempts++;
      updateState(
        clienteId,
        wrapper,
        SessionState.DISCONNECTED_RECOVERABLE, 
        `Temporary disconnection - attempt ${wrapper.reconnectionAttempts}/${MAX_RECONNECTION_ATTEMPTS}`
      );
    } else {
      updateState(clienteId, wrapper, SessionState.ERROR, 'Max reconnection attempts reached');
    }
  });

  // Change state event
  client.on('change_state', (state) => {
    console.log(`[WhatsApp][${clienteId}] Internal state changed:`, state);
  });

  // Loading screen event
  client.on('loading_screen', (percent, message) => {
    console.log(`[WhatsApp][${clienteId}] Loading: ${percent}% - ${message}`);
  });
  
  // Error handler - Puppeteer/Chromium crashes (CRIT-3)
  client.on('error', (error) => {
    console.error(`[WhatsApp][${clienteId}] Client error detected:`, error);
    updateState(clienteId, wrapper, SessionState.ERROR, `Client error: ${error.message || 'Unknown error'}`);
  });
  
  // Remote session saved (informational)
  client.on('remote_session_saved', () => {
    console.log(`[WhatsApp][${clienteId}] Remote session saved successfully`);
  });
  
  console.log(`[EventHandlers] All handlers registered for cliente_id: ${clienteId}`);
}
