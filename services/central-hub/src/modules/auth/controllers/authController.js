// auth/controllers/authController.js - Controlador de autenticación
const authService = require('../services/authService');

class AuthController {
  /**
   * POST /auth/login
   * Login de usuario
   */
  async login(req, res) {
    try {
      const { usuario, password } = req.body;

      if (!usuario || !password) {
        return res.status(400).json({
          success: false,
          message: 'Usuario y contraseña son requeridos'
        });
      }

      const result = await authService.login(usuario, password);

      if (!result.success) {
        return res.status(401).json(result);
      }

      res.json(result);
    } catch (error) {
      console.error('Error en login controller:', error);
      res.status(500).json({
        success: false,
        message: 'Error del servidor'
      });
    }
  }

  /**
   * POST /auth/verify
   * Verificar token JWT
   */
  async verify(req, res) {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Token no proporcionado'
        });
      }

      const result = authService.verifyToken(token);

      if (!result.success) {
        return res.status(401).json(result);
      }

      // Obtener datos actualizados del usuario
      const user = await authService.getUserById(result.user.id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      res.json({
        success: true,
        user
      });
    } catch (error) {
      console.error('Error en verify controller:', error);
      res.status(500).json({
        success: false,
        message: 'Error del servidor'
      });
    }
  }

  /**
   * POST /auth/change-password
   * Cambiar contraseña
   */
  async changePassword(req, res) {
    try {
      const { oldPassword, newPassword } = req.body;
      const userId = req.user.id; // Viene del middleware de autenticación

      if (!oldPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Contraseña actual y nueva son requeridas'
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'La nueva contraseña debe tener al menos 6 caracteres'
        });
      }

      const result = await authService.changePassword(userId, oldPassword, newPassword);

      res.json(result);
    } catch (error) {
      console.error('Error en change-password controller:', error);
      res.status(500).json({
        success: false,
        message: 'Error del servidor'
      });
    }
  }

  /**
   * POST /auth/logout
   * Logout (invalidar token en cliente)
   */
  async logout(req, res) {
    // El logout se maneja en el cliente eliminando el token
    // Aquí solo confirmamos la acción
    res.json({
      success: true,
      message: 'Sesión cerrada correctamente'
    });
  }

  /**
   * GET /auth/me
   * Obtener información del usuario autenticado
   */
  async me(req, res) {
    try {
      const userId = req.user.id;
      const user = await authService.getUserById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      res.json({
        success: true,
        user
      });
    } catch (error) {
      console.error('Error en me controller:', error);
      res.status(500).json({
        success: false,
        message: 'Error del servidor'
      });
    }
  }
}

module.exports = new AuthController();
