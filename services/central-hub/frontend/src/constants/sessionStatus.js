/**
 * Enums oficiales del contrato SESSION_MANAGER_API_CONTRACT.md
 * 
 * REGLAS ABSOLUTAS:
 * - NO INVENTAR estados adicionales
 * - NO mapear o traducir estos valores
 * - Usar EXACTAMENTE como vienen del backend
 */

export const SessionStatus = Object.freeze({
  INIT: 'init',
  QR_REQUIRED: 'qr_required',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  ERROR: 'error'
});

export const QRStatus = Object.freeze({
  NONE: 'none',
  GENERATED: 'generated',
  EXPIRED: 'expired',
  USED: 'used'
});

/**
 * Funciones PURAS de mapeo UI (solo presentación)
 * NO contienen lógica de negocio
 * NO deciden estados
 * SOLO traducen para visualización
 */

/**
 * Retorna color CSS para un estado de sesión
 * @param {string} status - SessionStatus del backend
 * @returns {string} Clase CSS de color
 */
export const getStatusColor = (status) => {
  switch (status) {
    case SessionStatus.CONNECTED:
      return 'bg-success';
    case SessionStatus.CONNECTING:
      return 'bg-blue-500';
    case SessionStatus.QR_REQUIRED:
      return 'bg-warning';
    case SessionStatus.DISCONNECTED:
      return 'bg-gray-400';
    case SessionStatus.ERROR:
      return 'bg-danger';
    case SessionStatus.INIT:
      return 'bg-gray-400';
    default:
      return 'bg-gray-400';
  }
};

/**
 * Retorna texto legible para un estado de sesión
 * @param {string} status - SessionStatus del backend
 * @returns {string} Texto para mostrar al usuario
 */
export const getStatusText = (status) => {
  switch (status) {
    case SessionStatus.CONNECTED:
      return 'Conectado';
    case SessionStatus.CONNECTING:
      return 'Conectando...';
    case SessionStatus.QR_REQUIRED:
      return 'QR Requerido';
    case SessionStatus.DISCONNECTED:
      return 'Desconectado';
    case SessionStatus.ERROR:
      return 'Error';
    case SessionStatus.INIT:
      return 'Inicializando...';
    default:
      return 'Desconocido';
  }
};

/**
 * Retorna texto legible para un estado de QR
 * @param {string} qrStatus - QRStatus del backend
 * @returns {string} Texto para mostrar al usuario
 */
export const getQRStatusText = (qrStatus) => {
  switch (qrStatus) {
    case QRStatus.GENERATED:
      return 'QR Generado';
    case QRStatus.EXPIRED:
      return 'QR Expirado';
    case QRStatus.USED:
      return 'QR Usado';
    case QRStatus.NONE:
      return 'Sin QR';
    default:
      return 'Desconocido';
  }
};
