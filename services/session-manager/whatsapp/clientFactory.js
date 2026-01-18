/**
 * WhatsApp Client Factory
 * 
 * Centralizes client creation and lifecycle management
 * Implements wrapper pattern with 'initialized' flag to prevent duplicate initializations
 */

import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import { setupClientEventHandlers } from './eventHandlers.js';

// Storage for client wrappers
// Map<clienteId, { client, initialized, state, qr, reconnectionAttempts }>
const clientWrappers = new Map();

/**
 * Get existing client wrapper or create new one
 * Does NOT call client.initialize() - that's explicit via /init endpoint
 * 
 * @param {number} clienteId - Cliente ID
 * @returns {Object} Client wrapper with { client, initialized, state, qr, reconnectionAttempts }
 */
export function getOrCreateClient(clienteId) {
  // Return existing wrapper if already created
  if (clientWrappers.has(clienteId)) {
    return clientWrappers.get(clienteId);
  }
  
  console.log(`[ClientFactory] Creating new client wrapper for cliente_id: ${clienteId}`);
  
  // Create WhatsApp Web client instance
  const authPath = `./sessions/cliente_${clienteId}`;
  
  const clientInstance = new Client({
    authStrategy: new LocalAuth({
      clientId: `cliente_${clienteId}`,
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
  
  // Create wrapper with metadata
  const wrapper = {
    client: clientInstance,
    initialized: false,  // NOT initialized until /init endpoint is called
    state: 'NOT_INITIALIZED',
    qr: null,
    reconnectionAttempts: 0
  };
  
  // Setup event handlers (they will only fire AFTER client.initialize() is called)
  setupClientEventHandlers(clienteId, wrapper);
  
  // Store wrapper
  clientWrappers.set(clienteId, wrapper);
  
  console.log(`[ClientFactory] Client wrapper created for cliente_id: ${clienteId} (NOT initialized yet)`);
  
  return wrapper;
}

/**
 * Get existing client wrapper (without creating)
 * @param {number} clienteId - Cliente ID
 * @returns {Object|null} Client wrapper or null if not found
 */
export function getClient(clienteId) {
  return clientWrappers.get(clienteId) || null;
}

/**
 * Check if client exists and is initialized
 * @param {number} clienteId - Cliente ID
 * @returns {boolean}
 */
export function isClientInitialized(clienteId) {
  const wrapper = clientWrappers.get(clienteId);
  return wrapper ? wrapper.initialized : false;
}

/**
 * Get all active client IDs
 * @returns {number[]} Array of cliente IDs
 */
export function getAllClientIds() {
  return Array.from(clientWrappers.keys());
}

/**
 * Destroy a WhatsApp client and cleanup resources (CRIT-2)
 * - Calls client.destroy() to cleanup Puppeteer/Chromium
 * - Removes wrapper from Map to prevent memory leak
 * - Safe to call even if client doesn't exist
 * 
 * @param {number} clienteId - Cliente ID to destroy
 * @returns {Promise<void>}
 */
export async function destroyClient(clienteId) {
  const wrapper = clientWrappers.get(clienteId);
  
  if (!wrapper) {
    console.log(`[ClientFactory] No client to destroy for cliente_id: ${clienteId}`);
    return;
  }
  
  try {
    console.log(`[ClientFactory] Destroying client for cliente_id: ${clienteId}`);
    
    // Destroy WhatsApp client instance (cleanup Puppeteer/Chromium)
    if (wrapper.client) {
      await wrapper.client.destroy();
      console.log(`[ClientFactory] WhatsApp client destroyed for cliente_id: ${clienteId}`);
    }
    
    // Remove from map to prevent memory leak
    clientWrappers.delete(clienteId);
    
    console.log(`[ClientFactory] Client wrapper removed from map for cliente_id: ${clienteId}`);
    console.log(`[ClientFactory] Cleanup completed for cliente_id: ${clienteId}`);
    
  } catch (error) {
    console.error(`[ClientFactory] Error destroying client for cliente_id ${clienteId}:`, error);
    
    // Remove from map anyway to prevent memory leak
    clientWrappers.delete(clienteId);
    console.log(`[ClientFactory] Force-removed wrapper for cliente_id: ${clienteId} despite error`);
  }
}

