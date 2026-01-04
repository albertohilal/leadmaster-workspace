// auth/middleware/authMiddleware.js - Middleware de autenticación
const authService = require('../services/authService');

/**
 * Middleware para verificar JWT en requests
 */
const authenticate = async (req, res, next) => {
  try {
    // Permitir pruebas sin token en entorno de test
    if (process.env.NODE_ENV === 'test') {
      // Usuario mock para pruebas (no-admin por defecto)
      req.user = { id: 0, tipo: 'admin', cliente_id: 0 };
      return next();
    }
    
    // Intentar obtener token desde header o query parameter
    let token = req.headers.authorization?.replace('Bearer ', '');
    
    // Si no está en el header, buscar en query params (para imágenes <img src="">)
    if (!token && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token no proporcionado'
      });
    }

    const result = authService.verifyToken(token);

    if (!result.success) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido o expirado'
      });
    }

    // Agregar información del usuario al request
    req.user = result.user;
    next();
  } catch (error) {
    console.error('Error en middleware de autenticación:', error);
    res.status(500).json({
      success: false,
      message: 'Error del servidor'
    });
  }
};

/**
 * Middleware para verificar rol de administrador
 */
const requireAdmin = (req, res, next) => {
  if (req.user.tipo !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Acceso denegado. Se requiere rol de administrador'
    });
  }
  next();
};

/**
 * Middleware para verificar que el usuario pertenece al cliente
 */
const requireOwnClient = (req, res, next) => {
  const clienteId = req.params.cliente_id || req.body.cliente_id || req.query.cliente_id;

  // Los admins pueden acceder a todos los clientes
  if (req.user.tipo === 'admin') {
    return next();
  }

  // Los usuarios solo pueden acceder a su propio cliente
  if (req.user.cliente_id != clienteId) {
    return res.status(403).json({
      success: false,
      message: 'Acceso denegado. No tienes permiso para este cliente'
    });
  }

  next();
};

module.exports = {
  authenticate,
  requireAdmin,
  requireOwnClient
};
