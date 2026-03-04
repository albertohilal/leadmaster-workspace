const db = require('../../../config/db');

function parseIntId(raw) {
  const n = Number.parseInt(String(raw), 10);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

const prospectosController = {
  /**
   * Filtrar prospectos de una campaña
   *
   * MODELO DE NEGOCIO:
   * - Los prospectos base pertenecen al cliente (ll_lugares_clientes -> llxbx_societe)
   * - Se agrupa por phone_mobile para garantizar 1 fila = 1 número único
   * - El estado por campaña se obtiene desde ll_envios_whatsapp (LEFT JOIN por telefono_wapp)
   * - Una campaña define el cliente_id
   * - Regla: 1 campaña + 1 teléfono = 1 envío máximo
   *
   * Query params:
   * - campania_id (obligatorio): ID de la campaña
   *
   * Endpoint (interno): GET /api/sender/prospectos/filtrar
   */
  async filtrarProspectos(req, res) {
    try {
      const clienteId = req.user?.cliente_id;
      if (!clienteId) {
        return res.status(401).json({
          success: false,
          error: 'Usuario no autenticado'
        });
      }

      const campaniaId = parseIntId(req.query?.campania_id);
      if (!campaniaId) {
        return res.status(400).json({
          success: false,
          error: 'campania_id es obligatorio y debe ser un entero válido'
        });
      }

      // Multi-tenant: la campaña debe pertenecer al cliente autenticado
      // (si no, se filtra por cliente y devuelve 0 filas => 404 semántico no aplica; 200 con data=[] está bien)
      const sql = `
        SELECT
          MIN(s.rowid) AS prospecto_id,
          MAX(s.nom) AS nombre,
          s.phone_mobile AS telefono_wapp,
          COUNT(*) AS total_sucursales,
          MAX(s.address) AS direccion,
          MAX(s.client) AS societe_client,
          MAX(s.fournisseur) AS societe_fournisseur,
          CASE
            WHEN MAX(s.fournisseur) = 1 THEN 'Proveedor'
            WHEN MAX(s.client) = 1 THEN 'Cliente'
            WHEN MAX(s.client) = 2 THEN 'Prospecto'
            WHEN MAX(s.client) = 3 THEN 'Proveedor'
            ELSE 'Otro'
          END AS tipo_societe,
          MAX(env.estado) AS estado_campania,
          MAX(env.id) AS envio_id,
          MAX(env.fecha_envio) AS fecha_envio
        FROM ll_campanias_whatsapp c
        JOIN ll_lugares_clientes lc
          ON lc.cliente_id = c.cliente_id
        JOIN llxbx_societe s
          ON s.rowid = lc.societe_id
        LEFT JOIN ll_envios_whatsapp env
          ON env.campania_id = c.id
         AND env.telefono_wapp = s.phone_mobile
        WHERE c.id = ?
          AND c.cliente_id = ?
          AND s.entity = 1
          AND s.phone_mobile IS NOT NULL
          AND s.phone_mobile <> ''
        GROUP BY s.phone_mobile
        ORDER BY nombre ASC
      `;

      const [rows] = await db.execute(sql, [campaniaId, clienteId]);

      console.log(`✅ [prospectos] campania_id=${campaniaId} cliente_id=${clienteId} => ${rows.length} filas`);

      return res.json({
        success: true,
        data: rows,
        total: rows.length
      });
    } catch (error) {
      console.error('❌ [prospectos] Error al filtrar:', error);
      return res.status(500).json({
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
      return res.json({ success: true, areas: [] });
    } catch (error) {
      console.error('❌ [prospectos] Error al obtener áreas:', error);
      return res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
  },

  /**
   * Obtener rubros disponibles
   * DEPRECATED: Mantenido por compatibilidad, pero no usado en modelo simplificado
   */
  async obtenerRubros(req, res) {
    try {
      return res.json({ success: true, rubros: [] });
    } catch (error) {
      console.error('❌ [prospectos] Error al obtener rubros:', error);
      return res.status(500).json({ success: false, error: 'Error interno del servidor' });
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
      const clienteId = req.user?.cliente_id;
      if (!clienteId) {
        return res.status(401).json({ success: false, error: 'Usuario no autenticado' });
      }

      const campaniaId = req.query?.campania_id ? parseIntId(req.query.campania_id) : null;
      if (req.query?.campania_id && !campaniaId) {
        return res.status(400).json({
          success: false,
          error: 'campania_id debe ser un entero válido'
        });
      }

      let sql = `
        SELECT DISTINCT env.estado as id, env.estado as nombre
        FROM ll_envios_whatsapp env
        JOIN ll_campanias_whatsapp c ON env.campania_id = c.id
        WHERE c.cliente_id = ?
      `;

      const params = [clienteId];

      if (campaniaId) {
        sql += ` AND env.campania_id = ?`;
        params.push(campaniaId);
      }

      sql += ` ORDER BY env.estado ASC`;

      const [rows] = await db.execute(sql, params);

      return res.json({
        success: true,
        estados: rows
      });
    } catch (error) {
      console.error('❌ [prospectos] Error al obtener estados:', error);
      return res.status(500).json({
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
      const clienteId = req.user?.cliente_id;
      if (!clienteId) {
        return res.status(401).json({ success: false, error: 'Usuario no autenticado' });
      }

      const campaniaId = parseIntId(req.query?.campania_id);
      if (!campaniaId) {
        return res.status(400).json({
          success: false,
          error: 'campania_id es obligatorio y debe ser un entero válido'
        });
      }

      // Opción segura multi-tenant: validar que la campaña pertenece al cliente en el mismo query.
      const [stats] = await db.execute(
        `
        SELECT 
          COUNT(*) as total_prospectos,
          SUM(CASE WHEN env.estado = 'pendiente' THEN 1 ELSE 0 END) as pendientes,
          SUM(CASE WHEN env.estado = 'enviado' THEN 1 ELSE 0 END) as enviados,
          SUM(CASE WHEN env.estado = 'error' THEN 1 ELSE 0 END) as errores
        FROM ll_envios_whatsapp env
        JOIN ll_campanias_whatsapp c ON env.campania_id = c.id
        WHERE env.campania_id = ?
          AND c.cliente_id = ?
        `,
        [campaniaId, clienteId]
      );

      return res.json({
        success: true,
        data: stats[0] || {
          total_prospectos: 0,
          pendientes: 0,
          enviados: 0,
          errores: 0
        }
      });
    } catch (error) {
      console.error('❌ [prospectos] Error al obtener estadísticas:', error);
      return res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        message: error.message
      });
    }
  }
};

module.exports = prospectosController;