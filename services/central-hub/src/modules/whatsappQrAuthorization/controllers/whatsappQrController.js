/**
 * WhatsApp QR Controller
 * 
 * Maneja las peticiones HTTP para obtener estado de sesión WhatsApp y códigos QR.
 * Parte del módulo canónico whatsappQrAuthorization.
 * 
 * Responsabilidades:
 * - Validar parámetros de entrada (clienteId)
 * - Orquestar llamadas a sessionManagerClient
 * - Verificar autorizaciones con qrAuthorizationService
 * - Reaccionar a estados del contrato (session.status)
 * - Formatear respuestas HTTP con códigos apropiados
 * - Manejar errores tipados del Session Manager
 */

const { 
  sessionManagerClient, 
  SessionStatus,
  QRStatus,
  SessionNotFoundError,
  SessionAlreadyConnectedError,
  QRGenerationFailedError,
  SessionManagerTimeoutError,
  SessionManagerUnreachableError
} = require('../../../integrations/sessionManager');

const qrAuthorizationService = require('../services/qrAuthorizationService');

/**
 * GET /api/whatsapp/:clienteId/status
 * Obtiene el estado de la sesión WhatsApp según el contrato oficial
 * 
 * Consume: getSession(instance_id)
 * Reacciona a: session.status, session.qr_status
 * 
 * Respuestas:
 * - 200: Sesión encontrada (retorna WhatsAppSession completo)
 * - 400: clienteId inválido
 * - 404: Sesión no existe
 * - 500: Error interno
 * - 502: Session Manager no disponible
 * - 504: Timeout
 */
async function getWhatsappSessionStatus(req, res) {
  const { clienteId } = req.params;
  
  const clienteIdNum = parseInt(clienteId, 10);
  if (isNaN(clienteIdNum) || clienteIdNum <= 0) {
    return res.status(400).json({
      ok: false,
      error: 'INVALID_CLIENT_ID',
      message: 'clienteId debe ser un número positivo'
    });
  }

  const instanceId = `sender_${clienteIdNum}`;

  try {
    // Obtener sesión completa según contrato
    const session = await sessionManagerClient.getSession(instanceId);
    
    // Retornar sesión completa sin modificar
    res.json({
      ok: true,
      session
    });
    
  } catch (error) {
    console.error(
      `[whatsapp-proxy] Error obteniendo status para cliente ${clienteId}:`,
      error.message
    );
    
    // Errores tipados del contrato
    if (error instanceof SessionNotFoundError) {
      return res.status(404).json({
        ok: false,
        error: 'SESSION_NOT_FOUND',
        message: `Sesión no encontrada para cliente ${clienteId}`
      });
    }
    
    if (error instanceof SessionManagerTimeoutError) {
      return res.status(504).json({
        ok: false,
        error: 'GATEWAY_TIMEOUT',
        message: 'Session Manager no respondió a tiempo'
      });
    }
    
    if (error instanceof SessionManagerUnreachableError) {
      return res.status(502).json({
        ok: false,
        error: 'SESSION_MANAGER_UNAVAILABLE',
        message: 'Session Manager no está disponible'
      });
    }
    
    // Otros errores
    res.status(500).json({
      ok: false,
      error: 'INTERNAL_ERROR',
      message: error.message
    });
  }
}

/**
 * GET /api/whatsapp/:clienteId/qr
 * Solicita generación de QR según el contrato oficial
 * 
 * Flujo:
 * 1. Validar clienteId
 * 2. Verificar autorización del cliente
 * 3. Obtener estado actual con getSession()
 * 4. Reaccionar según session.status:
 *    - 'init' o 'qr_required': llamar requestQR()
 *    - 'connected': retornar error lógico (ya conectado)
 *    - 'connecting': informar que QR fue escaneado
 *    - 'disconnected': intentar requestQR()
 *    - 'error': retornar error de sesión
 * 
 * Respuestas:
 * - 200: QR generado o disponible
 * - 400: clienteId inválido
 * - 403: Cliente no autorizado
 * - 404: Sesión no existe
 * - 409: Sesión ya conectada
 * - 500: Error generando QR o error de sesión
 * - 502: Session Manager no disponible
 * - 504: Timeout
 */
async function getWhatsappQr(req, res) {
  const { clienteId } = req.params;
  
  const clienteIdNum = parseInt(clienteId, 10);
  if (isNaN(clienteIdNum) || clienteIdNum <= 0) {
    return res.status(400).json({
      ok: false,
      error: 'INVALID_CLIENT_ID',
      message: 'clienteId debe ser un número positivo'
    });
  }

  const instanceId = `sender_${clienteIdNum}`;

  try {
    // FASE 2: Verificar autorización ANTES de cualquier operación
    const authorized = await qrAuthorizationService.isAuthorized(clienteIdNum);
    
    if (!authorized) {
      return res.status(403).json({
        ok: false,
        error: 'QR_NOT_AUTHORIZED',
        message: 'QR no autorizado para este cliente'
      });
    }
    
    // Paso 1: Obtener estado actual de la sesión
    let session;
    try {
      session = await sessionManagerClient.getSession(instanceId);
    } catch (error) {
      // Si la sesión no existe, esto es un caso válido que debe manejarse
      if (error instanceof SessionNotFoundError) {
        return res.status(404).json({
          ok: false,
          error: 'SESSION_NOT_FOUND',
          message: `Sesión no encontrada para cliente ${clienteId}. Debe inicializarse primero.`
        });
      }
      throw error; // Re-lanzar otros errores
    }

    // Paso 2: Reaccionar según session.status (contrato oficial)
    switch (session.status) {
      case SessionStatus.INIT:
      case SessionStatus.QR_REQUIRED:
        // Necesita QR - solicitar generación
        try {
          const qrData = await sessionManagerClient.requestQR(instanceId);
          return res.json({
            ok: true,
            qr_string: qrData.qr_string,
            qr_expires_at: qrData.qr_expires_at,
            status: session.status
          });
        } catch (qrError) {
          if (qrError instanceof SessionAlreadyConnectedError) {
            // Race condition: se conectó entre getSession y requestQR
            return res.status(409).json({
              ok: false,
              error: 'SESSION_ALREADY_CONNECTED',
              message: 'La sesión ya está conectada'
            });
          }
          if (qrError instanceof QRGenerationFailedError) {
            return res.status(500).json({
              ok: false,
              error: 'QR_GENERATION_FAILED',
              message: 'No se pudo generar el código QR'
            });
          }
          throw qrError; // Re-lanzar otros errores
        }

      case SessionStatus.CONNECTED:
        // Ya está conectado - no se necesita QR
        return res.status(409).json({
          ok: false,
          error: 'SESSION_ALREADY_CONNECTED',
          message: 'La sesión ya está conectada. No se necesita escanear QR.',
          phone_number: session.phone_number
        });

      case SessionStatus.CONNECTING:
        // QR ya fue escaneado, esperando autenticación
        return res.status(200).json({
          ok: true,
          status: SessionStatus.CONNECTING,
          message: 'QR escaneado, esperando conexión...'
        });

      case SessionStatus.DISCONNECTED:
        // Desconectado - puede necesitar nuevo QR
        try {
          const qrData = await sessionManagerClient.requestQR(instanceId);
          return res.json({
            ok: true,
            qr_string: qrData.qr_string,
            qr_expires_at: qrData.qr_expires_at,
            status: SessionStatus.DISCONNECTED
          });
        } catch (qrError) {
          if (qrError instanceof QRGenerationFailedError) {
            return res.status(500).json({
              ok: false,
              error: 'QR_GENERATION_FAILED',
              message: 'No se pudo generar el código QR'
            });
          }
          throw qrError;
        }

      case SessionStatus.ERROR:
        // Error irrecuperable
        return res.status(500).json({
          ok: false,
          error: 'SESSION_ERROR',
          message: 'La sesión está en estado de error',
          last_error_code: session.last_error_code,
          last_error_message: session.last_error_message
        });

      default:
        // Estado desconocido (no debería ocurrir si el contrato se respeta)
        return res.status(500).json({
          ok: false,
          error: 'UNKNOWN_SESSION_STATUS',
          message: `Estado de sesión desconocido: ${session.status}`
        });
    }
    
  } catch (error) {
    console.error(
      `[whatsapp-proxy] Error en endpoint QR para cliente ${clienteId}:`,
      error.message
    );
    
    // Errores de base de datos (al verificar autorización)
    if (
      error.code === 'ER_ACCESS_DENIED_ERROR' ||
      error.code === 'ER_BAD_DB_ERROR' ||
      error.code === 'ECONNREFUSED'
    ) {
      return res.status(500).json({
        ok: false,
        error: 'DATABASE_ERROR',
        message: 'Error verificando autorización'
      });
    }
    
    // Errores tipados del contrato
    if (error instanceof SessionManagerTimeoutError) {
      return res.status(504).json({
        ok: false,
        error: 'GATEWAY_TIMEOUT',
        message: 'Session Manager no respondió a tiempo'
      });
    }
    
    if (error instanceof SessionManagerUnreachableError) {
      return res.status(502).json({
        ok: false,
        error: 'SESSION_MANAGER_UNAVAILABLE',
        message: 'Session Manager no está disponible'
      });
    }
    
    // Otros errores
    res.status(500).json({
      ok: false,
      error: 'INTERNAL_ERROR',
      message: error.message
    });
  }
}

module.exports = {
  getWhatsappSessionStatus,
  getWhatsappQr
};
