import React, { useState, useEffect } from 'react';
import { sessionAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { SessionStatus, getStatusColor, getStatusText } from '../../constants/sessionStatus';

const Header = () => {
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { user, logout } = useAuth();
  const clienteId = localStorage.getItem('cliente_id');

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 10000); // cada 10 segundos
    return () => clearInterval(interval);
  }, [clienteId]);

  const checkStatus = async () => {
    if (!clienteId) {
      // No mostrar error si no hay cliente_id (puede ser admin sin WhatsApp configurado)
      setConnectionStatus(null);
      setLoading(false);
      return;
    }

    try {
      const response = await sessionAPI.getSession(clienteId);
      
      // Backend retorna FLAT response: { state, connected, needs_qr }
      // NO hay data.session - acceder directamente a data.state
      const whatsappState = response?.data?.state;
      
      // Mapear estados del backend a constantes del frontend
      let mappedStatus = SessionStatus.ERROR;
      if (whatsappState === 'CONNECTED') {
        mappedStatus = SessionStatus.CONNECTED;
      } else if (whatsappState === 'QR_REQUIRED') {
        mappedStatus = SessionStatus.QR_REQUIRED;
      } else if (whatsappState === 'CONNECTING' || whatsappState === 'INITIALIZING' || whatsappState === 'RECONNECTING') {
        mappedStatus = SessionStatus.CONNECTING;
      } else if (whatsappState === 'DISCONNECTED') {
        mappedStatus = SessionStatus.DISCONNECTED;
      }
      
      setConnectionStatus(mappedStatus);
    } catch (error) {
      // Silenciar errores 404 - puede que el servicio de WhatsApp no esté disponible
      if (error.response?.status === 404) {
        setConnectionStatus(null); // No mostrar estado si no está disponible
      } else {
        console.warn('WhatsApp status check failed:', error.message);
        setConnectionStatus(SessionStatus.ERROR);
      }
    } finally {
      setLoading(false);
    }
  };



  return (
    <header className="bg-white shadow-md px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Breadcrumb o título */}
        <div>
          <h2 className="text-xl font-semibold text-gray-800">
            Bienvenido a LeadMaster
          </h2>
          <p className="text-sm text-gray-500">
            Gestiona tu sistema de leads y WhatsApp
          </p>
        </div>

        {/* Status y user info */}
        <div className="flex items-center space-x-6">
          {/* WhatsApp Status */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">WhatsApp:</span>
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${
                connectionStatus ? getStatusColor(connectionStatus) : 'bg-gray-400'
              } ${loading ? 'animate-pulse' : ''}`}></div>
              <span className="text-sm font-medium text-gray-700">
                {connectionStatus ? getStatusText(connectionStatus) : 'Cargando...'}
              </span>
            </div>
          </div>

          {/* User avatar/menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center space-x-2 hover:bg-gray-50 px-3 py-2 rounded-lg transition"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-dyd-blue to-primary rounded-full flex items-center justify-center text-white font-bold shadow-md">
                {user?.usuario?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="text-sm text-left">
                <p className="font-medium text-gray-700">{user?.usuario || 'Usuario'}</p>
                <p className="text-xs text-gray-500 capitalize">{user?.tipo || 'cliente'}</p>
              </div>
              <svg 
                className={`w-4 h-4 text-gray-500 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50">
                <div className="px-4 py-3 border-b border-gray-200">
                  <p className="text-sm font-medium text-gray-900">{user?.usuario}</p>
                  <p className="text-xs text-gray-500 mt-1">Cliente ID: {user?.cliente_id}</p>
                </div>
                
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    // Aquí podríamos abrir un modal de cambio de contraseña
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  <span>Cambiar contraseña</span>
                </button>

                <div className="border-t border-gray-200 mt-2 pt-2">
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      logout();
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span>Cerrar sesión</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
