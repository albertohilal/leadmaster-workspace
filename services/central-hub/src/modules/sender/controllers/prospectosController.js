const db = require('../../../config/db');

const prospectosController = {
  /**
   * Filtrar prospectos de una campaña
   * 
   * Query params:
   * - campania_id (obligatorio): ID de la campaña
   * - estado (opcional): pendiente | enviado | error
   * - q (opcional): búsqueda en nombre_destino (LIKE)
   * - limit (opcional): límite de resultados (default: 50)
   * 
   * Endpoint: GET /api/sender/prospectos/filtrar
   */
  async filtrarProspectos(req, res) {
    try {
      const { 
        campania_id,
        estado,
        q,
        limit = 50
      } = req.query;
      
      // ✅ Validación: campania_id es obligatorio
      if (!campania_id) {
        return res.status(400).json({
          success: false,
          error: 'campania_id es obligatorio'
        });
      }
      
      // ✅ Obtener cliente_id del usuario autenticado
      const clienteId = req.user.cliente_id;

      // ✅ Construir query dinámico con parámetros seguros
      const conditions = [];
      const params = [campania_id, clienteId];

      // Filtro opcional por estado
      if (estado) {
        conditions.push('estado = ?');
        params.push(estado);
      }

      // Filtro opcional por nombre (búsqueda LIKE)
      if (q) {
        conditions.push('nombre_destino LIKE ?');
        params.push(`%${q}%`);
      }

      // Validar y sanitizar limit
      const limitValue = Math.min(parseInt(limit) || 50, 200);

      // ✅ Query SQL simplificado (solo ll_envios_whatsapp)
      const whereClause = conditions.length > 0 
        ? `AND ${conditions.join(' AND ')}`
        : '';

      const sql = `
        SELECT 
          id,
          campania_id,
          telefono_wapp,
          nombre_destino,
          estado,
          mensaje,
          fecha_envio,
          fecha_creacion
        FROM ll_envios_whatsapp
        WHERE campania_id = ?
          AND cliente_id = ?
          ${whereClause}
        ORDER BY id DESC
        LIMIT ?
      `;

      params.push(limitValue);

      console.log('🔍 [prospectos] Query:', { campania_id, clienteId, estado, q, limit: limitValue });
      
      const [rows] = await db.execute(sql, params);

      console.log(`✅ [prospectos] Encontrados ${rows.length} registros`);

      // ✅ Respuesta consistente
      res.json({
        success: true,
        data: rows,
        total: rows.length,
        limit: limitValue
      });

    } catch (error) {
      console.error('❌ [prospectos] Error al filtrar:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        message: error.message
      });
    }
  },

  /**
   * Obtener áreas disponibles
   * DEPRECATED: Mantenido por compatibilidad, pero no usado en modelo simplificado
   */
  async obtenerAreas(req, res) {
    try {
      res.json({
        success: true,
        areas: []
      });
    } catch (error) {
      console.error('❌ [prospectos] Error al obtener áreas:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  },

  /**
   * Obtener rubros disponibles
   * DEPRECATED: Mantenido por compatibilidad, pero no usado en modelo simplificado
   */
  async obtenerRubros(req, res) {
    try {
      res.json({
        success: true,
        rubros: []
      });
    } catch (error) {
      console.error('❌ [prospectos] Error al obtener rubros:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  },

  /**
   * Obtener estados disponibles
   * 
   * Query params:
   * - campania_id (opcional): filtrar estados de una campaña específica
   * 
   * Endpoint: GET /api/sender/prospectos/estados
   */
  async obtenerEstados(req, res) {
    try {
      const { campania_id } = req.query;
      const clienteId = req.user.cliente_id;
      
      let sql = `
        SELECT DISTINCT estado as id, estado as nombre
        FROM ll_envios_whatsapp
        WHERE cliente_id = ?
      `;
      
      const params = [clienteId];
      
      if (campania_id) {
        sql += ` AND campania_id = ?`;
        params.push(campania_id);
      }
      
      sql += ` ORDER BY estado ASC`;
      
      const [rows] = await db.execute(sql, params);

      res.json({
        success: true,
        estados: rows
      });

    } catch (error) {
      console.error('❌ [prospectos] Error al obtener estados:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        message: error.message
      });
    }
  },

  /**
   * Obtener estadísticas de prospectos por campaña
   * 
   * Query params:
   * - campania_id (obligatorio): ID de la campaña
   * 
   * Endpoint: GET /api/sender/prospectos/estadisticas
   */
  async obtenerEstadisticas(req, res) {
    try {
      const { campania_id } = req.query;
      const clienteId = req.user.cliente_id;

      if (!campania_id) {
        return res.status(400).json({
          success: false,
          error: 'campania_id es obligatorio'
        });
      }

      const [stats] = await db.execute(`
        SELECT 
          COUNT(*) as total_prospectos,
          SUM(CASE WHEN estado = 'pendiente' THEN 1 ELSE 0 END) as pendientes,
          SUM(CASE WHEN estado = 'enviado' THEN 1 ELSE 0 END) as enviados,
          SUM(CASE WHEN estado = 'error' THEN 1 ELSE 0 END) as errores
        FROM ll_envios_whatsapp
        WHERE campania_id = ?
          AND cliente_id = ?
      `, [campania_id, clienteId]);

      res.json({
        success: true,
        data: stats[0]
      });

    } catch (error) {
      console.error('❌ [prospectos] Error al obtener estadísticas:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        message: error.message
      });
    }
  }
};

module.exports = prospectosController;