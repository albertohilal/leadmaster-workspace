import React, { useState, useEffect } from 'react';
import Card from '../common/Card';
import Button from '../common/Button';
import LoadingSpinner from '../common/LoadingSpinner';
import Modal from '../common/Modal';
import { sessionAPI } from '../../services/api';
import { SessionStatus, QRStatus, getStatusColor, getStatusText } from '../../constants/sessionStatus';

const SessionManager = () => {
  // Estado: Objeto COMPLETO de sesión del backend (NO inventar estados locales)
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [qrString, setQrString] = useState(null);
  const [showQRModal, setShowQRModal] = useState(false);
  
  const clienteId = localStorage.getItem('cliente_id');

  useEffect(() => {
    loadSession();
    const interval = setInterval(loadSession, 5000); // Polling cada 5 segundos
    return () => clearInterval(interval);
  }, [clienteId]);

  // Cerrar modal automáticamente si se conecta
  useEffect(() => {
    if (session?.status === SessionStatus.CONNECTED) {
      setShowQRModal(false);
      setQrString(null);
    }
  }, [session?.status]);

  /**
   * Carga el estado actual de la sesión desde el backend
   * Consume ÚNICAMENTE sessionAPI.getSession(clienteId)
   */
  const loadSession = async () => {
    if (!clienteId) {
      setError('No hay cliente_id configurado');
      return;
    }

    try {
      const response = await sessionAPI.getSession(clienteId);
      
      // Guardar objeto COMPLETO del backend sin modificar
      setSession(response.data.session);
      setError(null);
      
    } catch (err) {
      console.error('Error al cargar sesión:', err);
      
      if (err.response?.status === 404) {
        setError('Sesión no encontrada');
      } else if (err.response?.status === 502) {
        setError('Session Manager no disponible');
      } else if (err.response?.status === 504) {
        setError('Timeout al conectar con Session Manager');
      } else {
        setError(err.response?.data?.message || 'Error al cargar sesión');
      }
    }
  };

  /**
   * Solicita generación de QR al backend
   * Consume ÚNICAMENTE sessionAPI.requestQR(clienteId)
   */
  const handleRequestQR = async () => {
    if (!clienteId) {
      setError('No hay cliente_id configurado');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await sessionAPI.requestQR(clienteId);
      
      // Backend retorna qr_string (no qr_code)
      setQrString(response.data.qr_string);
      setShowQRModal(true);
      
      // Actualizar sesión después de solicitar QR
      await loadSession();
      
    } catch (err) {
      console.error('Error al solicitar QR:', err);
      
      // Manejar errores específicos del contrato
      if (err.response?.status === 409) {
        setError('La sesión ya está conectada');
      } else if (err.response?.status === 403) {
        setError('No estás autorizado para generar QR');
      } else if (err.response?.status === 404) {
        setError('Sesión no encontrada. Debe inicializarse primero.');
      } else if (err.response?.status === 500) {
        setError('Error al generar código QR');
      } else {
        setError(err.response?.data?.message || 'Error desconocido');
      }
      
      setShowQRModal(false);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Renderiza el contenido según session.status (NO estados inventados)
   * React ÚNICAMENTE con switch sobre SessionStatus del contrato
   */
  const renderContent = () => {
    if (!session && !error) {
      return <LoadingSpinner text="Cargando sesión..." />;
    }

    if (error) {
      return (
        <div className="text-center py-8">
          <p className="text-red-600 mb-4">{error}</p>
          <Button variant="primary" onClick={loadSession}>
            Reintentar
          </Button>
        </div>
      );
    }

    if (!session) {
      return <p className="text-gray-600 text-center py-8">No hay información de sesión</p>;
    }

    // Switch EXPLÍCITO sobre session.status (del contrato)
    switch (session.status) {
      case SessionStatus.CONNECTED:
        return (
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className={`w-16 h-16 ${getStatusColor(session.status)} rounded-full flex items-center justify-center text-white text-3xl`}>
                ✓
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{getStatusText(session.status)}</p>
                <p className="text-sm text-gray-600 mt-1">WhatsApp está conectado y listo para enviar mensajes</p>
                {session.phone_number && (
                  <p className="text-sm text-gray-500 mt-1">Teléfono: {session.phone_number}</p>
                )}
              </div>
            </div>
            <div className="flex space-x-2">
              <Button variant="secondary" onClick={loadSession}>
                Actualizar
              </Button>
            </div>
          </div>
        );

      case SessionStatus.QR_REQUIRED:
        return (
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className={`w-16 h-16 ${getStatusColor(session.status)} rounded-full flex items-center justify-center text-white text-3xl`}>
                📱
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{getStatusText(session.status)}</p>
                <p className="text-sm text-gray-600 mt-1">
                  {session.qr_status === QRStatus.EXPIRED 
                    ? 'El código QR ha expirado. Genera uno nuevo.'
                    : 'Necesitas escanear un código QR para conectar'}
                </p>
              </div>
            </div>
            <div className="flex space-x-2">
              <Button variant="primary" onClick={handleRequestQR} disabled={loading}>
                {session.qr_status === QRStatus.EXPIRED ? 'Generar Nuevo QR' : 'Generar QR'}
              </Button>
              <Button variant="secondary" onClick={loadSession}>
                Actualizar
              </Button>
            </div>
          </div>
        );

      case SessionStatus.CONNECTING:
        return (
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className={`w-16 h-16 ${getStatusColor(session.status)} rounded-full flex items-center justify-center text-white text-3xl`}>
                ⏳
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{getStatusText(session.status)}</p>
                <p className="text-sm text-gray-600 mt-1">Estableciendo conexión con WhatsApp...</p>
                {session.qr_status === QRStatus.USED && (
                  <p className="text-sm text-green-600 mt-1">✓ Código QR escaneado exitosamente</p>
                )}
              </div>
            </div>
            <LoadingSpinner text="Conectando..." />
          </div>
        );

      case SessionStatus.DISCONNECTED:
        return (
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className={`w-16 h-16 ${getStatusColor(session.status)} rounded-full flex items-center justify-center text-white text-3xl`}>
                ×
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{getStatusText(session.status)}</p>
                <p className="text-sm text-gray-600 mt-1">La sesión de WhatsApp está desconectada</p>
              </div>
            </div>
            <div className="flex space-x-2">
              <Button variant="primary" onClick={handleRequestQR} disabled={loading}>
                Conectar WhatsApp
              </Button>
              <Button variant="secondary" onClick={loadSession}>
                Actualizar
              </Button>
            </div>
          </div>
        );

      case SessionStatus.ERROR:
        return (
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className={`w-16 h-16 ${getStatusColor(session.status)} rounded-full flex items-center justify-center text-white text-3xl`}>
                ⚠️
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{getStatusText(session.status)}</p>
                <p className="text-sm text-red-600 mt-1">
                  {session.last_error_message || 'Error desconocido en la sesión'}
                </p>
                {session.last_error_code && (
                  <p className="text-xs text-gray-500 mt-1">Código: {session.last_error_code}</p>
                )}
              </div>
            </div>
            <div className="flex space-x-2">
              <Button variant="warning" onClick={handleRequestQR} disabled={loading}>
                Reconectar
              </Button>
              <Button variant="secondary" onClick={loadSession}>
                Actualizar
              </Button>
            </div>
          </div>
        );

      case SessionStatus.INIT:
        return (
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className={`w-16 h-16 ${getStatusColor(session.status)} rounded-full flex items-center justify-center text-white text-3xl`}>
                ⚙️
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{getStatusText(session.status)}</p>
                <p className="text-sm text-gray-600 mt-1">La sesión se está inicializando...</p>
              </div>
            </div>
            <LoadingSpinner text="Inicializando..." />
          </div>
        );

      default:
        return (
          <div className="text-center py-8">
            <p className="text-gray-600">Estado desconocido: {session.status}</p>
            <Button variant="secondary" onClick={loadSession} className="mt-4">
              Actualizar
            </Button>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Título */}
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Gestión de Sesión WhatsApp</h1>
        <p className="text-gray-600 mt-1">Administra tu conexión con WhatsApp</p>
      </div>

      {/* Estado de la Sesión */}
      <Card title="Estado de la Conexión" icon="💬">
        {renderContent()}
      </Card>

      {/* Modal de QR Code */}
      <Modal
        isOpen={showQRModal}
        onClose={() => {
          setShowQRModal(false);
          setQrString(null);
        }}
        title="Escanea el código QR"
      >
        <div className="text-center">
          {qrString ? (
            <div>
              <img src={qrString} alt="QR Code" className="mx-auto mb-4 max-w-sm" />
              <p className="text-sm text-gray-600">
                Escanea este código QR con WhatsApp desde tu teléfono
              </p>
              <p className="text-xs text-gray-500 mt-2">
                El código expira en unos segundos. Se actualizará automáticamente.
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