import React from 'react';
import WhatsappSession from '../components/WhatsappSession';
import '../components/WhatsappSession.css';

/**
 * WhatsappPage
 * 
 * Página principal para gestión de sesión WhatsApp
 * Puede renderizar múltiples sesiones si es necesario
 */
const WhatsappPage = () => {
  // TODO: Obtener clienteId del contexto de usuario/aplicación
  // Por ahora, usamos un ID hardcodeado para demo
  const clienteId = 1;

  // Session Manager URL desde variables de entorno
  // Vite usa VITE_ prefix (no REACT_APP_)
  const sessionManagerUrl = import.meta.env.VITE_SESSION_MANAGER_URL || 'http://localhost:3001';

  return (
    <div className="whatsapp-page">
      <div className="container">
        <div className="page-header">
          <h1>Gestión de WhatsApp</h1>
          <p className="subtitle">
            Conecta tu cuenta de WhatsApp para enviar mensajes a tus leads
          </p>
        </div>

        <WhatsappSession 
          clienteId={clienteId}
          sessionManagerUrl={sessionManagerUrl}
        />

        <div className="help-section">
          <h3>¿Necesitas ayuda?</h3>
          <ul>
            <li>Asegúrate de tener WhatsApp instalado en tu teléfono</li>
            <li>Verifica que tu teléfono tenga conexión a internet</li>
            <li>El código QR expira después de 2 minutos</li>
            <li>Si tienes problemas, intenta reiniciar la sesión</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default WhatsappPage;
