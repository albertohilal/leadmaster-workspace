/**
 * WhatsApp QR Proxy Routes
 * 
 * Expone el estado y QR de WhatsApp del Session Manager externo (puerto 3001)
 * a través del Central Hub (puerto 3012).
 * 
 * ARQUITECTURA:
 * - Este archivo solo define rutas públicas
 * - Toda comunicación con Session Manager pasa por sessionManagerClient.js
 * - NO usa axios directo
 * - NO duplica lógica HTTP
 * - Solo actúa como proxy transparente
 * 
 * Endpoints públicos:
 * - GET /api/whatsapp/:clienteId/status → Devuelve estado WhatsApp
 * - GET /api/whatsapp/:clienteId/qr     → Devuelve QR como JSON
 */

const express = require('express');
const sessionManagerClient = require('../services/sessionManagerClient');

const router = express.Router();

/**
 * GET /api/whatsapp/:clienteId/status
 * Obtiene el estado de la sesión WhatsApp para un cliente
 * 
 * Respuestas:
 * - 200: Estado exitoso desde Session Manager
 * - 502: Session Manager no disponible
 * - 504: Timeout
 */
router.get('/:clienteId/status', async (req, res) => {
  const { clienteId } = req.params;
  
  // Validación básica
  const clienteIdNum = parseInt(clienteId, 10);
  if (isNaN(clienteIdNum) || clienteIdNum <= 0) {
    return res.status(400).json({
      ok: false,
      error: 'INVALID_CLIENT_ID',
      message: 'clienteId debe ser un número positivo'
    });
  }

  try {
    // Llamar al Session Manager a través del cliente
    const status = await sessionManagerClient.getStatus(clienteIdNum);
    
    // Devolver respuesta tal cual (proxy transparente)
    res.json(status);
    
  } catch (error) {
    console.error(`[whatsapp-proxy] Error obteniendo status para cliente ${clienteId}:`, error.message);
    
    // Mapear errores a códigos HTTP apropiados
    if (error.message.includes('TIMEOUT')) {
      return res.status(504).json({
        ok: false,
        error: 'GATEWAY_TIMEOUT',
        message: 'Session Manager no respondió a tiempo'
      });
    }
    
    if (error.message.includes('UNREACHABLE') || error.message.includes('ECONNREFUSED')) {
      return res.status(502).json({
        ok: false,
        error: 'SESSION_MANAGER_UNAVAILABLE',
        message: 'Session Manager no está disponible'
      });
    }
    
    // Error genérico del Session Manager
    res.status(502).json({
      ok: false,
      error: 'SESSION_MANAGER_ERROR',
      message: error.message
    });
  }
});

/**
 * GET /api/whatsapp/:clienteId/qr
 * Obtiene el código QR de WhatsApp para un cliente
 * 
 * Respuestas:
 * - 200: QR disponible (JSON con campo qr)
 * - 409: WhatsApp ya conectado (no hay QR)
 * - 404: QR no disponible aún
 * - 502: Session Manager no disponible
 * - 504: Timeout
 */
router.get('/:clienteId/qr', async (req, res) => {
  const { clienteId } = req.params;
  
  // Validación básica
  const clienteIdNum = parseInt(clienteId, 10);
  if (isNaN(clienteIdNum) || clienteIdNum <= 0) {
    return res.status(400).json({
      ok: false,
      error: 'INVALID_CLIENT_ID',
      message: 'clienteId debe ser un número positivo'
    });
  }

  try {
    // Llamar al Session Manager a través del cliente
    const qrData = await sessionManagerClient.getQR(clienteIdNum);
    
    // Devolver respuesta tal cual (proxy transparente)
    res.json(qrData);
    
  } catch (error) {
    console.error(`[whatsapp-proxy] Error obteniendo QR para cliente ${clienteId}:`, error.message);
    
    // Mapear errores según statusCode del Session Manager
    if (error.statusCode) {
      // Propagar el mismo código de error que devolvió el Session Manager
      return res.status(error.statusCode).json(error.response || {
        ok: false,
        error: error.code || 'SESSION_MANAGER_ERROR',
        message: error.message
      });
    }
    
    // Errores de red/timeout
    if (error.message.includes('TIMEOUT')) {
      return res.status(504).json({
        ok: false,
        error: 'GATEWAY_TIMEOUT',
        message: 'Session Manager no respondió a tiempo'
      });
    }
    
    if (error.message.includes('UNREACHABLE') || error.message.includes('ECONNREFUSED')) {
      return res.status(502).json({
        ok: false,
        error: 'SESSION_MANAGER_UNAVAILABLE',
        message: 'Session Manager no está disponible'
      });
    }
    
    // Error genérico
    res.status(502).json({
      ok: false,
      error: 'SESSION_MANAGER_ERROR',
      message: error.message
    });
  }
});

module.exports = router;

