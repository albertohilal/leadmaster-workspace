// auth/services/authService.js - Lógica de autenticación
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../../../config/db');

class AuthService {
  /**
   * Validar credenciales de usuario
   */
  async login(usuario, password) {
    try {
      const [rows] = await pool.query(
        'SELECT * FROM ll_usuarios WHERE usuario = ? AND activo = 1',
        [usuario]
      );

      if (rows.length === 0) {
        return { success: false, message: 'Usuario no encontrado o inactivo' };
      }

      const user = rows[0];
      
      // Validar password con bcrypt
      const isValid = await bcrypt.compare(password, user.password_hash);
      
      if (!isValid) {
        return { success: false, message: 'Contraseña incorrecta' };
      }

      // Generar JWT token
      const token = jwt.sign(
        { 
          id: user.id,
          cliente_id: user.cliente_id,
          usuario: user.usuario,
          tipo: user.tipo
        },
        process.env.SESSION_SECRET,
        { expiresIn: '24h' }
      );

      return {
        success: true,
        token,
        user: {
          id: user.id,
          cliente_id: user.cliente_id,
          usuario: user.usuario,
          tipo: user.tipo
        }
      };
    } catch (error) {
      console.error('Error en login:', error);
      return { success: false, message: 'Error del servidor' };
    }
  }

  /**
   * Verificar token JWT
   */
  verifyToken(token) {
    try {
      const decoded = jwt.verify(token, process.env.SESSION_SECRET);
      return { success: true, user: decoded };
    } catch (error) {
      return { success: false, message: 'Token inválido o expirado' };
    }
  }

  /**
   * Obtener información del usuario por ID
   */
  async getUserById(id) {
    try {
      const [rows] = await pool.query(
        'SELECT id, cliente_id, usuario, tipo, activo FROM ll_usuarios WHERE id = ?',
        [id]
      );

      if (rows.length === 0) {
        return null;
      }

      return rows[0];
    } catch (error) {
      console.error('Error obteniendo usuario:', error);
      return null;
    }
  }

  /**
   * Cambiar contraseña
   */
  async changePassword(userId, oldPassword, newPassword) {
    try {
      const [rows] = await pool.query(
        'SELECT password_hash FROM ll_usuarios WHERE id = ?',
        [userId]
      );

      if (rows.length === 0) {
        return { success: false, message: 'Usuario no encontrado' };
      }

      // Validar contraseña antigua
      const isValid = await bcrypt.compare(oldPassword, rows[0].password_hash);
      
      if (!isValid) {
        return { success: false, message: 'Contraseña actual incorrecta' };
      }

      // Hash nueva contraseña
      const newHash = await bcrypt.hash(newPassword, 10);

      // Actualizar en BD
      await pool.query(
        'UPDATE ll_usuarios SET password_hash = ? WHERE id = ?',
        [newHash, userId]
      );

      return { success: true, message: 'Contraseña actualizada correctamente' };
    } catch (error) {
      console.error('Error cambiando contraseña:', error);
      return { success: false, message: 'Error del servidor' };
    }
  }
}

module.exports = new AuthService();
