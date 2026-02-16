const db = require('../../../config/db');

const prospectosController = {
  /**
   * Filtrar prospectos de una campaña
   * 
   * MODELO DE NEGOCIO:
   * - Los prospectos base pertenecen al cliente (ll_lugares_clientes -> llxbx_societe)
   * - El estado por campaña se obtiene desde ll_envios_whatsapp (LEFT JOIN)
   * - Una campaña define el cliente_id
   * - Devuelve TODOS los prospectos del cliente aunque no tengan envío
   * 
   * Query params:
   * - campania_id (obligatorio): ID de la campaña
   * 
   * Endpoint: GET /api/sender/prospectos/filtrar
   */
  async filtrarProspectos(req, res) {
    try {
      const { campania_id } = req.query;
      
      if (!campania_id) {
        return res.status(400).json({
          success: false,
          error: 'campania_id es obligatorio'
        });
      }

      const sql = `
        SELECT
          s.rowid AS prospecto_id,
          s.nom AS nombre,
          COALESCE(env.estado, 'no_incluido') AS estado_campania,
          s.phone_mobile AS telefono_wapp,
          s.address AS direccion,
          env.id AS envio_id,
          env.fecha_envio
        FROM ll_campanias_whatsapp c
        JOIN ll_lugares_clientes lc
          ON lc.cliente_id = c.cliente_id
        JOIN llxbx_societe s
          ON s.rowid = lc.societe_id
        LEFT JOIN ll_envios_whatsapp env
          ON env.campania_id = c.id
         AND env.lugar_id = s.rowid
        WHERE c.id = ?
          AND s.entity = 1
        ORDER BY s.nom ASC
      `;

      console.log('🔍 [prospectos] Query con campania_id:', campania_id);
      
      const [rows] = await db.execute(sql, [campania_id]);

      console.log(`✅ [prospectos] Encontrados ${rows.length} prospectos`);

      res.json({
        success: true,
        data: rows,
        total: rows.length
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
        SELECT DISTINCT env.estado as id, env.estado as nombre
        FROM ll_envios_whatsapp env
        JOIN ll_campanias_whatsapp c ON env.campania_id = c.id
        WHERE c.cliente_id = ?
      `;
      
      const params = [clienteId];
      
      if (campania_id) {
        sql += ` AND env.campania_id = ?`;
        params.push(campania_id);
      }
      
      sql += ` ORDER BY env.estado ASC`;
      
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
      `, [campania_id]);

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