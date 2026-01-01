import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const Sidebar = () => {
  const location = useLocation();
  
  const { user } = useAuth();

  const menuItems = [
    { 
      path: '/dashboard', 
      icon: '📊', 
      label: 'Dashboard',
      exact: true
    },
    { 
      path: '/whatsapp', 
      icon: '💬', 
      label: 'WhatsApp' 
    },
    { 
      path: '/leads', 
      icon: '👥', 
      label: 'Leads' 
    },
    { 
      path: '/listener', 
      icon: '🤖', 
      label: 'Listener' 
    },
    { 
      path: '/campaigns', 
      icon: '📨', 
      label: 'Campañas' 
    },
    { 
      path: '/prospectos', 
      icon: '🎯', 
      label: 'Seleccionar Prospectos' 
    },
    { 
      path: '/config', 
      icon: '⚙️', 
      label: 'Configuración' 
    },
    {
      path: '/admin/sessions',
      icon: '🛠️',
      label: 'Sesiones (Admin)',
      admin: true
    },
  ];

  const isActive = (item) => {
    if (item.exact) {
      return location.pathname === item.path;
    }
    return location.pathname.startsWith(item.path);
  };

  return (
    <aside className="bg-gray-900 text-white w-64 min-h-screen p-4 flex flex-col">
      {/* Logo DyD */}
      <div className="mb-8 text-center">
        <div className="w-20 h-20 mx-auto mb-3 bg-gradient-to-br from-dyd-orange to-dyd-yellow rounded-full flex items-center justify-center shadow-lg">
          <img 
            src="/assets/logo-dyd.svg" 
            alt="DyD Logo" 
            className="w-16 h-16"
          />
        </div>
        <h1 className="text-2xl font-bold text-dyd-blue">LeadMaster</h1>
        <p className="text-sm text-gray-400">Desarrollo y Diseño</p>
      </div>

      {/* Menu */}
      <nav className="flex-1">
        <ul className="space-y-2">
          {menuItems
            .filter(item => !item.admin || (user?.tipo === 'admin'))
            .map((item) => (
            <li key={item.path}>
              <Link
                to={item.path}
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive(item)
                    ? 'bg-dyd-blue text-white'
                    : 'text-gray-300 hover:bg-gray-800'
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer info */}
      <div className="mt-8 pt-4 border-t border-gray-700">
        <div className="text-xs text-gray-500 text-center">
          <p className="font-medium text-gray-400">LeadMaster Hub</p>
          <p className="mt-1">v1.0.0</p>
          <p className="mt-1">© 2025 Desarrollo y Diseño</p>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
