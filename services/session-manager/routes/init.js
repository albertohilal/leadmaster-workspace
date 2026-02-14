/**
 * POST /init - Explicit WhatsApp Client Initialization Endpoint
 * 
 * Responsibilities:
 * - Validates X-Cliente-Id header
 * - Creates or retrieves WhatsApp client wrapper
 * - Explicitly calls client.initialize() if not already initialized
 * - Prevents duplicate initializations
 * - Returns current initialization status
 * 
 * This is the ONLY endpoint that triggers WhatsApp client initialization.
 * Other endpoints (status, send, qr-code) assume initialization already happened.
 */

import express from 'express';
import { getOrCreateClient } from '../whatsapp/clientFactory.js';
import { getStatus } from '../whatsapp/client.js';
import { SessionState } from '../whatsapp/eventHandlers.js';

const router = express.Router();

// Lock map to prevent concurrent initializations of the same client
const initializationLocks = new Map();

/**
 * POST /init
 * Header required: X-Cliente-Id
 * Explicitly initializes WhatsApp client for the given cliente_id
 */
router.post('/', async (req, res) => {
  const clienteIdHeader = req.headers['x-cliente-id'];
  
  // Validación de header
  if (!clienteIdHeader) {
    console.log('[INIT] Missing X-Cliente-Id header');
    return res.status(400).json({
      error: true,
      code: 'MISSING_HEADER',
      message: 'Header X-Cliente-Id is required'
    });
  }
  
  const clienteId = parseInt(clienteIdHeader, 10);
  if (isNaN(clienteId) || clienteId <= 0) {
    console.log(`[INIT] Invalid X-Cliente-Id: ${clienteIdHeader}`);
    return res.status(400).json({
      error: true,
      code: 'INVALID_HEADER',
      message: 'X-Cliente-Id must be a positive integer'
    });
  }
  
  try {
    console.log(`[INIT] Initialization requested for cliente_id: ${clienteId}`);
    
    // Check for ongoing initialization (RACE CONDITION PREVENTION)
    if (initializationLocks.has(clienteId)) {
      console.log(`[INIT] Initialization already in progress for cliente_id: ${clienteId}`);
      return res.status(409).json({
        error: true,
        code: 'INITIALIZATION_IN_PROGRESS',
        message: 'Client initialization already in progress',
        cliente_id: clienteId,
        retry_after_seconds: 5
      });
    }
    
    // Get or create client wrapper
    const clientWrapper = getOrCreateClient(clienteId);
    
    // Check if already initialized
    if (clientWrapper.initialized) {
      console.log(`[INIT] Client already initialized for cliente_id: ${clienteId}`);
      const status = getStatus(clienteId);
      
      return res.status(200).json({
        success: true,
        message: 'Client already initialized',
        cliente_id: clienteId,
        status: status,
        action: 'NO_ACTION_NEEDED'
      });
    }
    
    // Acquire lock with Promise-based mechanism
    const initPromise = (async () => {
      try {
        // Mark as initialized to prevent re-initialization
        clientWrapper.initialized = true;
        
        console.log(`[INIT] Calling client.initialize() for cliente_id: ${clienteId}`);
        
        // Explicitly initialize WhatsApp client
        // This triggers Puppeteer, Chromium launch, and event handlers
        await clientWrapper.client.initialize();
        
        console.log(`[INIT] Successfully called initialize() for cliente_id: ${clienteId}`);
        return true;
      } finally {
        // Always release lock, even on error
        initializationLocks.delete(clienteId);
      }
    })();
    
    initializationLocks.set(clienteId, initPromise);
    
    // Wait for initialization to complete
    await initPromise;
    
    // Get updated status after initialization
    const status = getStatus(clienteId);
    
    return res.status(200).json({
      success: true,
      message: 'WhatsApp client initialization started',
      cliente_id: clienteId,
      status: status,
      action: 'INITIALIZING',
      next_steps: 'Monitor /status endpoint for QR code or READY state'
    });
    
  } catch (error) {
    console.error(`[INIT ERROR] Failed to initialize cliente_id ${clienteId}:`, error);
    
    // CRITICAL: Reset initialized flag to allow retries (HIGH-3)
    const clientWrapper = getOrCreateClient(clienteId);
    if (clientWrapper) {
      clientWrapper.initialized = false;
      clientWrapper.state = SessionState.ERROR;
      console.log(`[INIT] Reset initialized flag for cliente_id ${clienteId} due to error`);
    }
    
    return res.status(500).json({
      error: true,
      code: 'INITIALIZATION_FAILED',
      message: error.message || 'Failed to initialize WhatsApp client',
      cliente_id: clienteId,
      retry: true  // Indicate client can retry
    });
  }
});

export default router;
