import React, { useState, useEffect, useRef } from 'react';

/**
 * WhatsappSession Component
 * 
 * Gestiona la inicialización y estado de una sesión WhatsApp multi-cliente.
 * Implementa el flujo explícito: POST /init → Polling GET /status
 * 
 * Estados del backend (session-manager):
 * - NOT_INITIALIZED: Cliente no existe o no inicializado
 * - INITIALIZING: Lanzando Puppeteer/Chromium
 * - QR_REQUIRED: Esperando escaneo de QR
 * - READY: Sesión conectada y lista
 * - AUTH_FAILURE: Fallo de autenticación
 * - DISCONNECTED_*: Varios tipos de desconexión
 * - ERROR: Error fatal
 */
const WhatsappSession = ({ clienteId, sessionManagerUrl = 'http://localhost:3001' }) => {
  // Estado de UI
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [qrCodeBase64, setQrCodeBase64] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [backendState, setBackendState] = useState(null);

  // Referencias para gestión de polling
  const pollingIntervalRef = useRef(null);
  const isInitializedRef = useRef(false);
  const isMountedRef = useRef(true);

  /**
   * Cleanup al desmontar componente
   */
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      stopPolling();
    };
  }, []);

  /**
   * Inicialización automática al montar
   */
  useEffect(() => {
    if (clienteId && !isInitializedRef.current) {
      initSession();
    }
  }, [clienteId]);

  /**
   * Detener polling
   */
  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      console.log('[WhatsappSession] Polling stopped');
    }
  };

  /**
   * Iniciar polling a GET /status
   * Solo debe llamarse DESPUÉS de POST /init exitoso
   */
  const startPolling = () => {
    // Prevenir múltiples intervalos
    if (pollingIntervalRef.current) {
      console.warn('[WhatsappSession] Polling already active');
      return;
    }

    console.log('[WhatsappSession] Starting polling every 5 seconds');

    // Primera verificación inmediata
    fetchStatus();

    // Polling cada 5 segundos
    pollingIntervalRef.current = setInterval(() => {
      fetchStatus();
    }, 5000);
  };

  /**
   * POST /init
   * Inicializa explícitamente el cliente WhatsApp en el backend
   * Solo se debe llamar UNA vez al montar el componente
   */
  const initSession = async () => {
    // Prevenir llamadas duplicadas
    if (isInitializedRef.current) {
      console.warn('[WhatsappSession] Session already initialized');
      return;
    }

    console.log(`[WhatsappSession] Initializing session for cliente_id: ${clienteId}`);
    setLoading(true);
    setStatusMessage('Inicializando WhatsApp...');
    setError(null);

    try {
      const response = await fetch(`${sessionManagerUrl}/init`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Cliente-Id': String(clienteId)
        }
      });

      const data = await response.json();

      // Verificar si el componente sigue montado
      if (!isMountedRef.current) return;

      // Manejar errores del backend
      if (data.error) {
        console.error('[WhatsappSession] Init error:', data);
        setError(data.message || 'Error al inicializar sesión WhatsApp');
        setStatusMessage('Error de inicialización');
        setLoading(false);
        return;
      }

      console.log('[WhatsappSession] Init successful:', data);

      // Marcar como inicializado
      isInitializedRef.current = true;

      // Actualizar UI según respuesta
      if (data.action === 'NO_ACTION_NEEDED') {
        setStatusMessage('Cliente ya inicializado previamente');
      } else {
        setStatusMessage('Inicialización exitosa. Cargando estado...');
      }

      // CRÍTICO: Iniciar polling SOLO después de init exitoso
      startPolling();

    } catch (err) {
      console.error('[WhatsappSession] Network error during init:', err);
      
      if (!isMountedRef.current) return;

      setError('Error de conexión con el servidor');
      setStatusMessage('No se pudo conectar al servicio WhatsApp');
      setLoading(false);
    }
  };

  /**
   * GET /status
   * Consulta el estado actual de la sesión WhatsApp
   * NO inicializa, solo consulta
   */
  const fetchStatus = async () => {
    try {
      const response = await fetch(`${sessionManagerUrl}/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Cliente-Id': String(clienteId)
        }
      });

      const data = await response.json();

      // Verificar si el componente sigue montado
      if (!isMountedRef.current) return;

      console.log('[WhatsappSession] Status:', data.state);

      // Actualizar estado backend
      setBackendState(data.state);

      // Interpretar estado según modelo de 9 estados
      switch (data.state) {
        case 'NOT_INITIALIZED':
          setStatusMessage('Esperando inicialización...');
          setLoading(true);
          setConnected(false);
          setQrCodeBase64(null);
          break;

        case 'INITIALIZING':
          setStatusMessage('Generando sesión de WhatsApp...');
          setLoading(true);
          setConnected(false);
          setQrCodeBase64(null);
          break;

        case 'RECONNECTING':
          setStatusMessage('Reconectando sesión existente...');
          setLoading(true);
          setConnected(false);
          setQrCodeBase64(null);
          break;

        case 'QR_REQUIRED':
          setStatusMessage('Escanea el código QR con tu teléfono');
          setLoading(false);
          setConnected(false);
          
          // Actualizar QR solo si cambió
          if (data.qr_code_base64 && data.qr_code_base64 !== qrCodeBase64) {
            setQrCodeBase64(data.qr_code_base64);
          }
          break;

        case 'READY':
          setStatusMessage('WhatsApp conectado correctamente');
          setLoading(false);
          setConnected(true);
          setQrCodeBase64(null);
          
          // CRÍTICO: Detener polling cuando se conecta
          console.log('[WhatsappSession] Session READY - stopping polling');
          stopPolling();
          break;

        case 'AUTH_FAILURE':
          setStatusMessage('Fallo de autenticación. Reinicia la sesión.');
          setError('La autenticación de WhatsApp falló');
          setLoading(false);
          setConnected(false);
          setQrCodeBase64(null);
          stopPolling();
          break;

        case 'DISCONNECTED_RECOVERABLE':
          setStatusMessage('Desconectado temporalmente. Reintentando...');
          setLoading(true);
          setConnected(false);
          setQrCodeBase64(null);
          break;

        case 'DISCONNECTED_LOGOUT':
          setStatusMessage('Sesión cerrada manualmente desde el teléfono');
          setError('Debes volver a escanear el código QR');
          setLoading(false);
          setConnected(false);
          setQrCodeBase64(null);
          stopPolling();
          break;

        case 'DISCONNECTED_BANNED':
          setStatusMessage('Número bloqueado por WhatsApp');
          setError('Este número ha sido bloqueado por WhatsApp');
          setLoading(false);
          setConnected(false);
          setQrCodeBase64(null);
          stopPolling();
          break;

        case 'ERROR':
          setStatusMessage('Error en la sesión de WhatsApp');
          setError(data.recommended_action || 'Error desconocido');
          setLoading(false);
          setConnected(false);
          setQrCodeBase64(null);
          stopPolling();
          break;

        default:
          console.warn('[WhatsappSession] Unknown state:', data.state);
          setStatusMessage(`Estado desconocido: ${data.state}`);
          setLoading(false);
          break;
      }

    } catch (err) {
      console.error('[WhatsappSession] Network error during status fetch:', err);
      
      if (!isMountedRef.current) return;

      // No detener polling por errores transitorios de red
      setError('Error temporal de conexión. Reintentando...');
    }
  };

  /**
   * Reiniciar sesión manualmente
   * Útil para recuperación de errores
   */
  const restartSession = () => {
    console.log('[WhatsappSession] Manual restart requested');
    
    // Resetear estados
    stopPolling();
    isInitializedRef.current = false;
    setLoading(false);
    setStatusMessage('');
    setQrCodeBase64(null);
    setConnected(false);
    setError(null);
    setBackendState(null);

    // Reiniciar flujo
    initSession();
  };

  return (
    <div className="whatsapp-session-container">
      <div className="whatsapp-session-header">
        <h2>Sesión WhatsApp - Cliente #{clienteId}</h2>
        <div className="status-badge">
          {connected ? (
            <span className="badge badge-success">Conectado</span>
          ) : loading ? (
            <span className="badge badge-warning">Cargando...</span>
          ) : error ? (
            <span className="badge badge-danger">Error</span>
          ) : (
            <span className="badge badge-secondary">Desconectado</span>
          )}
        </div>
      </div>

      <div className="whatsapp-session-body">
        {/* Mensaje de estado */}
        <div className="status-message">
          <p>{statusMessage}</p>
          {backendState && (
            <small className="text-muted">Estado: {backendState}</small>
          )}
        </div>

        {/* Indicador de carga */}
        {loading && !qrCodeBase64 && (
          <div className="loading-spinner">
            <div className="spinner-border" role="status">
              <span className="sr-only">Cargando...</span>
            </div>
          </div>
        )}

        {/* Código QR */}
        {qrCodeBase64 && (
          <div className="qr-code-container">
            <img 
              src={qrCodeBase64} 
              alt="WhatsApp QR Code" 
              className="qr-code-image"
            />
            <p className="qr-instructions">
              1. Abre WhatsApp en tu teléfono<br />
              2. Ve a Menú → Dispositivos vinculados<br />
              3. Escanea este código QR
            </p>
          </div>
        )}

        {/* Estado conectado */}
        {connected && (
          <div className="connected-status">
            <div className="success-icon">✓</div>
            <p>WhatsApp está conectado y listo para enviar mensajes</p>
          </div>
        )}

        {/* Errores */}
        {error && (
          <div className="alert alert-danger" role="alert">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Acciones */}
        <div className="whatsapp-session-actions">
          {(error || backendState === 'DISCONNECTED_LOGOUT') && (
            <button 
              className="btn btn-primary" 
              onClick={restartSession}
              disabled={loading}
            >
              Reiniciar Sesión
            </button>
          )}
          
          {connected && (
            <button 
              className="btn btn-outline-secondary" 
              onClick={fetchStatus}
            >
              Actualizar Estado
            </button>
          )}
        </div>
      </div>

      {/* Debug info (solo en desarrollo) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="debug-info">
          <details>
            <summary>Debug Info</summary>
            <pre>
              {JSON.stringify({
                clienteId,
                loading,
                connected,
                error,
                backendState,
                hasQR: !!qrCodeBase64,
                isInitialized: isInitializedRef.current,
                isPolling: !!pollingIntervalRef.current
              }, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
};

export default WhatsappSession;
