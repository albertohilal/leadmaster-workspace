// components/auth/Login.jsx - Pantalla de login
import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(usuario, password);

    if (result.success) {
      navigate('/');
    } else {
      setError(result.message || 'Error al iniciar sesión');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dyd-blue via-purple-400 to-purple-500 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-8">
        {/* Logo DyD */}
        <div className="text-center mb-8">
          <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-dyd-orange to-dyd-yellow rounded-full flex items-center justify-center shadow-lg">
            <img 
              src="/assets/logo-dyd.svg" 
              alt="DyD Logo" 
              className="w-20 h-20"
            />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            LeadMaster Hub
          </h1>
          <p className="text-gray-600">
            Desarrollo y Diseño
          </p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Usuario
            </label>
            <input
              type="text"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-dyd-blue focus:border-transparent outline-none transition"
              placeholder="Ingresa tu usuario"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-dyd-blue focus:border-transparent outline-none transition"
              placeholder="Ingresa tu contraseña"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-dyd-blue to-primary text-white font-semibold py-3 rounded-lg hover:from-primary hover:to-dyd-blue transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Iniciando sesión...
              </span>
            ) : (
              'Iniciar Sesión'
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>LeadMaster Central Hub v1.0</p>
          <p className="mt-1">© {new Date().getFullYear()} Desarrollo y Diseño</p>
          
          {/* Ayuda de credenciales (solo desarrollo) */}
          {import.meta.env.DEV && (
            <details className="mt-4 text-left bg-gray-50 rounded-lg p-3">
              <summary className="cursor-pointer text-xs font-medium text-gray-600 hover:text-gray-800">
                🔧 Credenciales de prueba
              </summary>
              <div className="mt-2 space-y-2 text-xs text-gray-600">
                <div className="bg-white p-2 rounded border border-gray-200">
                  <p className="font-mono"><strong>Usuario:</strong> Haby</p>
                  <p className="font-mono"><strong>Password:</strong> haby1973</p>
                  <p className="text-gray-500 mt-1">Cliente Haby Supply (ID: 51)</p>
                </div>
                <div className="bg-white p-2 rounded border border-gray-200">
                  <p className="font-mono"><strong>Usuario:</strong> b3toh</p>
                  <p className="font-mono"><strong>Password:</strong> elgeneral2018</p>
                  <p className="text-gray-500 mt-1">Admin (ID: 1)</p>
                </div>
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
