// services/clientSessionService.js - Gestión de sesiones por cliente
const pool = require('../../../config/db');

class ClientSessionService {
  /**
   * Obtener sesión de WhatsApp por cliente_id
   */
  async getSessionByClient(clienteId) {
    try {
      const [rows] = await pool.query(
        'SELECT * FROM ll_whatsapp_sessions WHERE cliente_id = ? LIMIT 1',
        [clienteId]
      );

      if (rows.length === 0) {
        // Crear sesión por defecto si no existe
        return await this.createSession(clienteId);
      }

      return rows[0];
    } catch (error) {
      console.error('Error obteniendo sesión por cliente:', error);
      return null;
    }
  }

  /**
   * Crear nueva sesión para un cliente
   */
  async createSession(clienteId, sessionName = null) {
    try {
      const name = sessionName || `client_${clienteId}_session`;
      
      const [result] = await pool.query(
        'INSERT INTO ll_whatsapp_sessions (cliente_id, session_name, status) VALUES (?, ?, ?)',
        [clienteId, name, 'DISCONNECTED']
      );

      return {
        id: result.insertId,
        cliente_id: clienteId,
        session_name: name,
        status: 'DISCONNECTED'
      };
    } catch (error) {
      console.error('Error creando sesión:', error);
      return null;
    }
  }

  /**
   * Actualizar estado de sesión
   */
  async updateSessionStatus(clienteId, status, phoneNumber = null, qr = null) {
    try {
      const updates = {
        status,
        updated_at: new Date()
      };

      if (phoneNumber) {
        updates.phone_number = phoneNumber;
      }

      if (qr) {
        updates.last_qr = qr;
      }

      if (status === 'CONNECTED') {
        updates.last_connected = new Date();
      }

      const keys = Object.keys(updates);
      const values = Object.values(updates);
      const setClause = keys.map(k => `${k} = ?`).join(', ');

      await pool.query(
        `UPDATE ll_whatsapp_sessions SET ${setClause} WHERE cliente_id = ?`,
        [...values, clienteId]
      );

      return true;
    } catch (error) {
      console.error('Error actualizando estado de sesión:', error);
      return false;
    }
  }

  /**
   * Obtener todas las sesiones activas
   */
  async getAllActiveSessions() {
    try {
      const [rows] = await pool.query(
        'SELECT * FROM ll_whatsapp_sessions WHERE status = "CONNECTED" ORDER BY last_connected DESC'
      );
      return rows;
    } catch (error) {
      console.error('Error obteniendo sesiones activas:', error);
      return [];
    }
  }

  /**
   * Eliminar sesión
   */
  async deleteSession(clienteId) {
    try {
      await pool.query(
        'DELETE FROM ll_whatsapp_sessions WHERE cliente_id = ?',
        [clienteId]
      );
      return true;
    } catch (error) {
      console.error('Error eliminando sesión:', error);
      return false;
    }
  }

  /**
   * Verificar si un cliente tiene sesión activa
   */
  async hasActiveSession(clienteId) {
    try {
      const [rows] = await pool.query(
        'SELECT status FROM ll_whatsapp_sessions WHERE cliente_id = ? AND status = "CONNECTED"',
        [clienteId]
      );
      return rows.length > 0;
    } catch (error) {
      console.error('Error verificando sesión activa:', error);
      return false;
    }
  }
}

module.exports = new ClientSessionService();
