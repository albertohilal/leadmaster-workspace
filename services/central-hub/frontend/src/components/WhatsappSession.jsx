import React, { useState, useEffect, useRef } from 'react';

/**
 * WhatsappSession Component
 * 
 * Gestiona la inicialización y estado de una sesión WhatsApp.
 * Implementa el flujo explícito: POST /connect → Polling GET /status → GET /qr (si aplica)
 * 
 * Estados del backend (session-manager):
 * - INIT
 * - QR_REQUIRED
 * - AUTHENTICATED
 * - READY
 * - DISCONNECTED
 * - ERROR
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
      connectSession();
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
  * Solo debe llamarse DESPUÉS de POST /connect exitoso (o intento de connect)
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
   * POST /connect
   * Solicita al backend iniciar (o reutilizar) la sesión WhatsApp
   * Solo se debe llamar UNA vez al montar el componente
   */
  const connectSession = async () => {
    // Prevenir llamadas duplicadas
    if (isInitializedRef.current) {
      console.warn('[WhatsappSession] Session already initialized');
      return;
    }

    console.log(`[WhatsappSession] Connecting session for cliente_id: ${clienteId}`);
    setLoading(true);
    setStatusMessage('Inicializando WhatsApp...');
    setError(null);

    try {
      const response = await fetch(`${sessionManagerUrl}/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Cliente-Id': String(clienteId)
        }
      });

      const data = await response.json();

      // Verificar si el componente sigue montado
      if (!isMountedRef.current) return;

      if (!response.ok || data?.success === false) {
        console.error('[WhatsappSession] Connect error:', data);
        setError(data?.error || 'Error al inicializar sesión WhatsApp');
        setStatusMessage('Error de inicialización');
        setLoading(false);
        return;
      }

      console.log('[WhatsappSession] Connect successful:', data);

      // Marcar como inicializado
      isInitializedRef.current = true;

      setStatusMessage(data?.alreadyConnected ? 'Sesión ya iniciada. Cargando estado...' : 'Conectando...');

      // CRÍTICO: Iniciar polling SOLO después de connect exitoso
      startPolling();

    } catch (err) {
      console.error('[WhatsappSession] Network error during connect:', err);
      
      if (!isMountedRef.current) return;

      setError('Error de conexión con el servidor');
      setStatusMessage('No se pudo conectar al servicio WhatsApp');
      setLoading(false);
    }
  };

  /**
   * GET /status
   * Consulta el estado actual de la sesión WhatsApp
   * NO conecta, solo consulta
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

      const state = data?.status || data?.state;
      console.log('[WhatsappSession] Status:', state);

      // Actualizar estado backend
      setBackendState(state);

      // Interpretar estado según modelo de 9 estados
      switch (state) {
        case 'INIT':
          setStatusMessage('Inicializando WhatsApp...');
          setLoading(true);
          setConnected(false);
          setQrCodeBase64(null);
          break;

        case 'QR_REQUIRED':
          setStatusMessage('Escanea el código QR con tu teléfono');
          setLoading(false);
          setConnected(false);

          // QR viene por endpoint separado
          fetchQR();
          break;

        case 'AUTHENTICATED':
          setStatusMessage('Autenticado. Finalizando conexión...');
          setLoading(true);
          setConnected(false);
          setQrCodeBase64(null);
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

        case 'DISCONNECTED':
          setStatusMessage('WhatsApp desconectado. Reintentá conectar.');
          setLoading(false);
          setConnected(false);
          setQrCodeBase64(null);
          stopPolling();
          break;

        case 'ERROR':
          setStatusMessage('Error en la sesión de WhatsApp');
          setError('Error en la sesión');
          setLoading(false);
          setConnected(false);
          setQrCodeBase64(null);
          stopPolling();
          break;

        default:
          console.warn('[WhatsappSession] Unknown state:', state);
          setStatusMessage(`Estado desconocido: ${String(state)}`);
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
   * GET /qr
   * Obtiene el QR actual en formato Data URL (image/png)
   */
  const fetchQR = async () => {
    try {
      const response = await fetch(`${sessionManagerUrl}/qr`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Cliente-Id': String(clienteId)
        }
      });

      const data = await response.json();

      if (!isMountedRef.current) return;

      if (data?.status !== 'QR_AVAILABLE' || !data?.qr) {
        setQrCodeBase64(null);
        return;
      }

      if (data.qr !== qrCodeBase64) {
        setQrCodeBase64(data.qr);
      }
    } catch (err) {
      console.error('[WhatsappSession] Network error during QR fetch:', err);
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
    connectSession();
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
          {(error || backendState === 'DISCONNECTED' || backendState === 'ERROR') && (
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
      {import.meta.env.DEV && (
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
