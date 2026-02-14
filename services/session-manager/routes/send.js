import express from 'express';
import { sendMessage, getStatus } from '../whatsapp/client.js';
import { ensureClientInitialized } from '../whatsapp/manager.js';

const router = express.Router();

/**
 * POST /send
 * Header requerido: X-Cliente-Id
 * Send a WhatsApp message
 */
router.post('/', async (req, res) => {
  const clienteIdHeader = req.headers['x-cliente-id'];
  const { to, message } = req.body;
  
  // Validación de header
  if (!clienteIdHeader) {
    return res.status(400).json({
      error: true,
      code: 'MISSING_HEADER',
      message: 'Header X-Cliente-Id es requerido'
    });
  }
  
  const clienteId = parseInt(clienteIdHeader, 10);
  if (isNaN(clienteId) || clienteId <= 0) {
    return res.status(400).json({
      error: true,
      code: 'INVALID_HEADER',
      message: 'X-Cliente-Id debe ser un número positivo'
    });
  }
  
  // Asegurar que el cliente esté inicializado
  ensureClientInitialized(clienteId);
  
  try {
    // Validate required fields
    if (!to || !message) {
      return res.status(400).json({
        error: true,
        code: 'INVALID_REQUEST',
        message: 'Missing required fields: to, message'
      });
    }

    // Check session status
    const status = getStatus(clienteId);
    if (status.state !== 'READY') {
      return res.status(409).json({
        error: true,
        code: 'SESSION_NOT_READY',
        message: `WhatsApp session not ready. Current state: ${status.state}`
      });
    }

    // Send message
    const result = await sendMessage(clienteId, to, message);
    res.status(200).json(result);

  } catch (error) {
    console.error('[Route:Send] Error:', error);
    res.status(500).json({
      error: true,
      code: 'SEND_FAILED',
      message: error.message || 'Failed to send message'
    });
  }
});

export default router;
