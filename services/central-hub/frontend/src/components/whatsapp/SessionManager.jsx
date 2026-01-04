import React, { useState, useEffect } from 'react';
import Card from '../common/Card';
import Button from '../common/Button';
import LoadingSpinner from '../common/LoadingSpinner';
import Modal from '../common/Modal';
import { sessionAPI } from '../../services/api';
import { buildApiUrl } from '../../config/api';

const SessionManager = () => {
  const [loading, setLoading] = useState(true);
  const [sessionStatus, setSessionStatus] = useState('DISCONNECTED');
  const [qrCode, setQrCode] = useState(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [sessionInfo, setSessionInfo] = useState(null);
  const [logs, setLogs] = useState([]);
  const [qrRefreshInterval, setQrRefreshInterval] = useState(null);

  useEffect(() => {
    loadSessionData();
    const interval = setInterval(loadSessionData, 5000); // actualizar cada 5 segundos
    return () => clearInterval(interval);
  }, []);

  // Limpiar intervalo de QR cuando se cierra el modal
  useEffect(() => {
    if (!showQRModal && qrRefreshInterval) {
      clearInterval(qrRefreshInterval);
      setQrRefreshInterval(null);
    }
  }, [showQRModal, qrRefreshInterval]);

  const loadSessionData = async () => {
    try {
      const stateRes = await sessionAPI.getState().catch(() => ({ data: {} }));
      
      const state = stateRes.data.state || 'desconectado';
      setSessionInfo(stateRes.data);

      // Mapear estados del backend a estados del frontend
      if (state === 'conectado') {
        setSessionStatus('CONNECTED');
        setShowQRModal(false); // Cerrar modal si está conectado
      } else if (state === 'conectando' || state === 'qr') {
        setSessionStatus('QR');
        // Solo cargar QR, no abrir modal automáticamente
        if (stateRes.data.hasQR) {
          const qrUrl = buildApiUrl(`/session-manager/qr?t=${Date.now()}`);
          setQrCode(qrUrl);
        }
      } else {
        setSessionStatus('DISCONNECTED');
        setShowQRModal(false);
      }
    } catch (error) {
      console.error('Error loading session data:', error);
      setSessionStatus('ERROR');
    } finally {
      setLoading(false);
    }
  };

  const loadQRCode = async () => {
    try {
      setShowQRModal(true); // Abrir modal inmediatamente
      setQrCode(null); // Limpiar QR anterior
      
      const token = localStorage.getItem('token');
      
      // Función interna para refrescar el QR
      const refreshQR = async () => {
        try {
          // Verificar que el QR esté disponible
          const response = await fetch(buildApiUrl('/session-manager/qr'), {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          // Si es 401, el token expiró
          if (response.status === 401) {
            console.error('Token expirado - redirigiendo al login');
            setShowQRModal(false);
            alert('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.');
            localStorage.removeItem('token');
            window.location.href = '/login';
            return 'expired';
          }
          
          if (response.ok) {
            // Crear URL de la imagen con token y timestamp
            // IMPORTANTE: Incluir token como parámetro porque <img> no envía headers
            const qrUrl = buildApiUrl(`/session-manager/qr?token=${token}&t=${Date.now()}`);
            setQrCode(qrUrl);
            return true; // QR disponible
          } else {
            console.log('Esperando que se genere el QR...');
            return false; // QR no disponible aún
          }
        } catch (error) {
          console.error('Error refreshing QR:', error);
          return false;
        }
      };
      
      // Polling inicial: 8 intentos con espera de 3 segundos (24 segundos total)
      let qrReady = false;
      let attempts = 0;
      const maxAttempts = 8;
      
      while (!qrReady && attempts < maxAttempts && showQRModal) {
        qrReady = await refreshQR();
        
        // Si el token expiró, detener el bucle
        if (qrReady === 'expired') {
          return;
        }
        
        if (!qrReady && showQRModal) {
          await new Promise(resolve => setTimeout(resolve, 3000)); // Esperar 3s
          attempts++;
        }
      }
      
      if (!qrReady) {
        console.error('QR no disponible después de 3 intentos');
        setShowQRModal(false);
        alert('QR no disponible. Por favor:\n1. Presiona "Conectar WhatsApp"\n2. Espera 5 segundos\n3. Intenta "Ver QR" nuevamente');
        return;
      }
      
      // QR disponible: configurar auto-refresh cada 15 segundos (WhatsApp QR expira en ~20s)
      const interval = setInterval(() => {
        if (showQRModal) {
          refreshQR();
        }
      }, 15000);
      setQrRefreshInterval(interval);
      
    } catch (error) {
      console.error('Error loading QR code:', error);
      setShowQRModal(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('¿Estás seguro de desconectar WhatsApp?')) return;
    
    try {
      setLoading(true);
      const response = await sessionAPI.disconnect();
      if (response.data.success) {
        alert('WhatsApp desconectado exitosamente');
        setSessionStatus('DISCONNECTED');
        setQrCode(null);
        setShowQRModal(false);
      }
      loadSessionData();
    } catch (error) {
      console.error('Error disconnecting:', error);
      alert('Error al desconectar WhatsApp');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setLoading(true);
      const response = await sessionAPI.connect();
      if (response.data.success) {
        setSessionStatus('QR');
        // Esperar 5 segundos para que el backend genere el QR
        setTimeout(() => {
          loadQRCode();
          setLoading(false);
          // Reintentar cada 2 segundos si no carga
          const retryInterval = setInterval(() => {
            loadQRCode();
          }, 2000);
          // Detener después de 30 segundos
          setTimeout(() => clearInterval(retryInterval), 30000);
        }, 5000);
      }
    } catch (error) {
      console.error('Error connecting:', error);
      alert('Error al conectar WhatsApp');
      setLoading(false);
    }
  };

  const getStatusColor = () => {
    switch (sessionStatus) {
      case 'CONNECTED':
        return 'bg-success';
      case 'DISCONNECTED':
      case 'ERROR':
        return 'bg-danger';
      case 'QR':
        return 'bg-warning';
      default:
        return 'bg-gray-400';
    }
  };

  const getStatusText = () => {
    switch (sessionStatus) {
      case 'CONNECTED':
        return 'Conectado';
      case 'DISCONNECTED':
        return 'Desconectado';
      case 'QR':
        return 'Esperando QR';
      case 'ERROR':
        return 'Error';
      default:
        return 'Verificando...';
    }
  };

  if (loading) {
    return <LoadingSpinner size="large" text="Cargando sesión..." />;
  }

  return (
    <div className="space-y-6">
      {/* Título */}
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Gestión de Sesión WhatsApp</h1>
        <p className="text-gray-600 mt-1">Administra tu conexión con WhatsApp</p>
      </div>

      {/* Estado de la Sesión */}
      <Card title="Estado de la Conexión" icon="💬">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className={`w-16 h-16 ${getStatusColor()} rounded-full flex items-center justify-center text-white text-3xl`}>
              {sessionStatus === 'CONNECTED' ? '✓' : sessionStatus === 'QR' ? '⏳' : '×'}
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{getStatusText()}</p>
              <p className="text-sm text-gray-600 mt-1">
                {sessionStatus === 'CONNECTED' && 'Tu WhatsApp está conectado y funcionando'}
                {sessionStatus === 'DISCONNECTED' && 'No hay conexión con WhatsApp'}
                {sessionStatus === 'QR' && 'Escanea el código QR para conectar'}
                {sessionStatus === 'ERROR' && 'Ocurrió un error en la conexión'}
              </p>
            </div>
          </div>

          <div className="flex space-x-2">
            {sessionStatus === 'DISCONNECTED' && (
              <Button variant="primary" onClick={handleConnect}>
                Conectar WhatsApp
              </Button>
            )}
            {sessionStatus === 'CONNECTED' && (
              <>
                <Button variant="secondary" onClick={loadSessionData}>
                  Actualizar
                </Button>
                <Button variant="danger" onClick={handleDisconnect}>
                  Desconectar WhatsApp
                </Button>
              </>
            )}
            {sessionStatus === 'ERROR' && (
              <Button variant="warning" onClick={handleConnect}>
                Reconectar
              </Button>
            )}
            {sessionStatus === 'QR' && (
              <>
                <Button variant="primary" onClick={loadQRCode}>
                  Ver QR
                </Button>
                <Button variant="danger" onClick={handleDisconnect}>
                  Cancelar
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Información de la Sesión */}
      {sessionStatus === 'CONNECTED' && sessionInfo && (
        <Card title="Información de la Sesión" icon="📱">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Nombre</p>
              <p className="text-lg font-medium text-gray-800">
                {sessionInfo.name || 'No disponible'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Teléfono</p>
              <p className="text-lg font-medium text-gray-800">
                {sessionInfo.phone || 'No disponible'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Tiempo Conectado</p>
              <p className="text-lg font-medium text-gray-800">
                {sessionInfo.uptime || 'Calculando...'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Última Actualización</p>
              <p className="text-lg font-medium text-gray-800">
                {new Date().toLocaleTimeString()}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Logs de Sesión */}
      <Card title="Logs Recientes" icon="📋">
        <div className="space-y-2">
          <p className="text-sm text-gray-500 text-center py-8">
            No hay logs disponibles en este momento
          </p>
        </div>
      </Card>

      {/* Modal de QR Code */}
      <Modal
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
        title="Escanea el código QR"
      >
        <div className="text-center">
          {qrCode ? (
            <div>
              <img src={qrCode} alt="QR Code" className="mx-auto mb-4" />
              <p className="text-sm text-gray-600">
                Escanea este código QR con WhatsApp Web desde tu teléfono
              </p>
            </div>
          ) : (
            <LoadingSpinner text="Generando código QR..." />
          )}
        </div>
      </Modal>
    </div>
  );
};

export default SessionManager;
               