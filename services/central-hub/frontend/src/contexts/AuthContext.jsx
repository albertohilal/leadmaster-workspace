// contexts/AuthContext.jsx - Context para autenticación global
import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  // El token se maneja automáticamente por el interceptor de api.js
  // No necesitamos configurar headers manualmente aquí

  // Verificar token al cargar
  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await api.post('/auth/verify', {});

        if (response.data.success) {
          setUser(response.data.user);
          
          // Guardar cliente_id en localStorage si viene en la respuesta
          if (response.data.user?.cliente_id) {
            localStorage.setItem('cliente_id', response.data.user.cliente_id);
          }
        } else {
          // Token inválido
          localStorage.removeItem('token');
          localStorage.removeItem('cliente_id');
          setToken(null);
        }
      } catch (error) {
        console.error('Error verificando token:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('cliente_id');
        setToken(null);
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
  }, [token]);

  const login = async (usuario, password) => {
    try {
      const response = await api.post('/auth/login', { usuario, password });

      if (response.data.success) {
        const { token: newToken, user: userData } = response.data;
        localStorage.setItem('token', newToken);
        
        // Guardar cliente_id en localStorage para polling de WhatsApp
        if (userData.cliente_id) {
          localStorage.setItem('cliente_id', userData.cliente_id);
        }
        
        setToken(newToken);
        setUser(userData);
        return { success: true };
      } else {
        return { success: false, message: response.data.message };
      }
    } catch (error) {
      console.error('Error en login:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Error de conexión'
      };
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Error en logout:', error);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('cliente_id');
      setToken(null);
      setUser(null);
    }
  };

  const changePassword = async (oldPassword, newPassword) => {
    try {
      const response = await api.post('/auth/change-password', {
        oldPassword,
        newPassword
      });

      return response.data;
    } catch (error) {
      console.error('Error cambiando contraseña:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Error de conexión'
      };
    }
  };

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    changePassword,
    isAuthenticated: !!user,
    isAdmin: user?.tipo === 'admin'
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
