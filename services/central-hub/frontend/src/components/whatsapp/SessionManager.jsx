import React, { useState, useEffect } from 'react';
import Card from '../common/Card';
import Button from '../common/Button';
import LoadingSpinner from '../common/LoadingSpinner';
import Modal from '../common/Modal';
import { sessionAPI } from '../../services/api';
import {
  SessionStatus,
  QRStatus,
  getStatusColor,
  getStatusText
} from '../../constants/sessionStatus';

const SessionManager = () => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [qrString, setQrString] = useState(null);
  const [showQRModal, setShowQRModal] = useState(false);

  const clienteId = localStorage.getItem('cliente_id');

  useEffect(() => {
    loadSession();
    const interval = setInterval(loadSession, 5000);
    return () => clearInterval(interval);
  }, [clienteId]);

  // Cerrar modal automáticamente al conectar
  useEffect(() => {
    if (session?.status === SessionStatus.CONNECTED) {
      setShowQRModal(false);
      setQrString(null);
    }
  }, [session?.status]);

  /**
   * ==========================
   * Cargar estado de sesión
   * ==========================
   */
  const loadSession = async () => {
    if (!clienteId) {
      setError('No hay cliente_id configurado');
      return;
    }

    try {
      const response = await sessionAPI.getSession(clienteId);
      const normalizedState = response?.data?.state?.toLowerCase();

      let mappedStatus = SessionStatus.ERROR;

      switch (normalizedState) {
        case SessionStatus.CONNECTED:
          mappedStatus = SessionStatus.CONNECTED;
          break;
        case SessionStatus.QR_REQUIRED:
          mappedStatus = SessionStatus.QR_REQUIRED;
          break;
        case SessionStatus.CONNECTING:
        case SessionStatus.INIT:
        case 'initializing':
        case 'reconnecting':
          mappedStatus = SessionStatus.CONNECTING;
          break;
        case SessionStatus.DISCONNECTED:
          mappedStatus = SessionStatus.DISCONNECTED;
          break;
        default:
          mappedStatus = SessionStatus.ERROR;
      }

      setSession({
        status: mappedStatus,
        connected: Boolean(response.data.connected),
        needs_qr: Boolean(response.data.needs_qr),
        qr_status: response.data.needs_qr ? QRStatus.REQUIRED : null,
        phone_number: response.data.phone_number || null
      });

      setError(null);
    } catch (err) {
      console.error('[Session] Error cargando sesión:', err);
      setError(err.response?.data?.message || 'Error al cargar sesión');
    }
  };

  /**
   * ==========================
   * Mostrar QR (read-only)
   * ==========================
   */
  const handleShowQR = async () => {
    if (!clienteId) {
      setError('No hay cliente_id configurado');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('[QR] GET /qr-code | cliente:', clienteId);

      const response = await sessionAPI.getQRCode(clienteId);

      // Defensa absoluta contra respuestas inválidas
      const qr = response?.data?.qr;

      if (
        typeof qr !== 'string' ||
        !qr.startsWith('data:image/')
      ) {
        console.error('[QR] QR inválido o respuesta incorrecta:', response.data);
        setError('El servidor no devolvió un código QR válido');
        return;
      }

      setQrString(qr);
      setShowQRModal(true);

      console.log('[QR] QR válido recibido y renderizado');

    } catch (err) {
      console.error('[QR] Error obteniendo QR:', err);

      if (err.response?.status === 404) {
        setError('El código QR aún no está disponible. Reintentá en unos segundos.');
      } else if (err.response?.status === 409) {
        setError('La sesión no requiere QR en este momento');
      } else {
        setError(err.response?.data?.message || 'Error al obtener el QR');
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * ==========================
   * Render por estado
   * ==========================
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

    switch (session.status) {
      case SessionStatus.CONNECTED:
        return (
          <div className="space-y-4">
            <p className="text-2xl font-bold text-green-600">WhatsApp conectado</p>
            {session.phone_number && (
              <p className="text-sm text-gray-500">
                Teléfono: {session.phone_number}
              </p>
            )}
          </div>
        );

      case SessionStatus.QR_REQUIRED:
        return (
          <div className="space-y-4">
            <p className="text-xl font-bold">Escaneá el QR para conectar</p>
            <Button onClick={handleShowQR} disabled={loading}>
              Mostrar QR
            </Button>
          </div>
        );

      case SessionStatus.CONNECTING:
        return <LoadingSpinner text="Conectando..." />;

      case SessionStatus.DISCONNECTED:
        return (
          <Button onClick={handleShowQR} disabled={loading}>
            Conectar WhatsApp
          </Button>
        );

      default:
        return <p>Error en la sesión</p>;
    }
  };

  return (
    <div className="space-y-6">
      <Card title="Estado de la Conexión" icon="💬">
        {renderContent()}
      </Card>

      <Modal
        isOpen={showQRModal}
        onClose={() => {
          setShowQRModal(false);
          setQrString(null);
        }}
        title="Escaneá el código QR"
      >
        <div className="text-center">
          {qrString ? (
            <img
              src={qrString}
              alt="QR WhatsApp"
              className="mx-auto max-w-sm"
            />
          ) : (
            <LoadingSpinner text="Cargando QR..." />
          )}
        </div>
      </Modal>
    </div>
  );
};

export default SessionManager;
