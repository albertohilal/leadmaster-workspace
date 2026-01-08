/**
 * WhatsApp Session Manager - On-Demand Initialization
 * 
 * Handles automatic initialization of WhatsApp clients when requested
 */

import { initialize, getStatus } from './client.js';

/**
 * Ensures a WhatsApp client is initialized for the given cliente_id
 * If not initialized, initializes it automatically
 * 
 * @param {number} clienteId - Cliente ID
 * @returns {void}
 */
export function ensureClientInitialized(clienteId) {
  const status = getStatus(clienteId);
  
  // Si el cliente no está inicializado (NOT_INITIALIZED), inicializarlo
  if (status.state === 'NOT_INITIALIZED') {
    console.log(`[Manager] Auto-initializing WhatsApp client for cliente_id: ${clienteId}`);
    initialize(clienteId);
  }
}
