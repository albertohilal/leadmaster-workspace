const db = require('../../../config/db');

function parseIntId(raw) {
  const n = Number.parseInt(String(raw), 10);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

function normalizeCarteraOrigen(raw) {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (!s) return null;

  const upper = s.toUpperCase();
  if (upper === 'ALL' || upper === 'TODOS' || upper === 'TODO') return null;
  return upper;
}

function buildEmailValidSqlExpression(alias) {
  return `(
    ${alias}.email IS NOT NULL
    AND TRIM(${alias}.email) <> ''
    AND LOWER(TRIM(${alias}.email)) REGEXP '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$'
  )`;
}

function buildEmailDedupeKeySqlExpression(alias) {
  return `CASE
    WHEN ${alias}.phone_mobile IS NOT NULL AND TRIM(${alias}.phone_mobile) <> ''
      THEN CONCAT('PHONE:', TRIM(${alias}.phone_mobile))
    ELSE CONCAT('EMAIL:', LOWER(TRIM(${alias}.email)))
  END`;
}

const prospectosController = {
  /**
   * Filtrar prospectos de una campaña
   *
   * MODELO DE NEGOCIO:
   * - Los prospectos base pertenecen al cliente (ll_lugares_clientes -> llxbx_societe)
  * - Con campania_id: dedupe por phone_mobile usando fila canónica MAX(rowid)
  * - Sin campania_id (modo Email): dedupe híbrido por phone_mobile o email normalizado
  * - Sin campania_id (modo Email): la fila canónica prioriza email válido dentro de cada grupo
  * - El estado por campaña se obtiene desde ll_envios_whatsapp sólo cuando hay campania_id
  * - Cuando se informa campania_id, una campaña define el cliente_id
  * - Regla general del selector: una fila por contacto lógico visible
   *
   * Query params:
  * - campania_id (opcional): ID de la campaña WhatsApp
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

      const campaniaId = req.query?.campania_id ? parseIntId(req.query.campania_id) : null;
      if (req.query?.campania_id && !campaniaId) {
        return res.status(400).json({
          success: false,
          error: 'campania_id debe ser un entero válido'
        });
      }

      const emailCampaignId = !campaniaId && req.query?.email_campaign_id
        ? parseIntId(req.query.email_campaign_id)
        : null;

      if (!campaniaId && req.query?.email_campaign_id && !emailCampaignId) {
        return res.status(400).json({
          success: false,
          error: 'email_campaign_id debe ser un entero válido'
        });
      }

      if (!campaniaId && emailCampaignId) {
        const [emailCampaignRows] = await db.execute(
          `SELECT id
           FROM ll_campanias_email
           WHERE id = ? AND cliente_id = ?
           LIMIT 1`,
          [emailCampaignId, clienteId]
        );

        if (!emailCampaignRows.length) {
          return res.status(404).json({
            success: false,
            error: 'Campaña Email no encontrada para el cliente autenticado'
          });
        }
      }

      const carteraOrigen = normalizeCarteraOrigen(req.query?.cartera_origen);
      // Valores reales esperados en BD (ll_societe_extended.cartera_origen):
      // CARTERA_PROPIA | CAPTADO_LEADMASTER | IMPORT_MANUAL | REFERIDO
      const allowedCarteraOrigen = new Set([
        'CARTERA_PROPIA',
        'CAPTADO_LEADMASTER',
        'IMPORT_MANUAL',
        'REFERIDO'
      ]);

      if (carteraOrigen && !allowedCarteraOrigen.has(carteraOrigen)) {
        return res.status(400).json({
          success: false,
          error: `cartera_origen inválido. Valores permitidos: ${Array.from(allowedCarteraOrigen).join(', ')}`
        });
      }

      let sql = '';
      let params = [];

      if (campaniaId) {
        // Multi-tenant: la campaña debe pertenecer al cliente autenticado
        // (si no, se filtra por cliente y devuelve 0 filas => 404 semántico no aplica; 200 con data=[] está bien)
        sql = `
          SELECT
            s.rowid AS prospecto_id,
            s.nom AS nombre,
            s.email AS email,
            s.phone_mobile AS telefono_wapp,
            suc.total_sucursales AS total_sucursales,
            s.address AS direccion,
            s.client AS societe_client,
            s.fournisseur AS societe_fournisseur,
            CASE
              WHEN s.fournisseur = 1 THEN 'Proveedor'
              WHEN s.client = 1 THEN 'Cliente'
              WHEN s.client = 2 THEN 'Prospecto'
              WHEN s.client = 3 THEN 'Proveedor'
              ELSE 'Otro'
            END AS tipo_societe,
            se.cartera_origen AS cartera_origen,
            COALESCE(env.estado, 'sin_envio') AS estado_campania,
            env.id AS envio_id,
            env.fecha_envio AS fecha_envio,
            pe.post_envio_estado AS post_envio_estado,
            pe.accion_siguiente AS accion_siguiente,
            pe.detalle AS detalle,
            pe.clasificado_por AS clasificado_por,
            pe.created_at AS post_envio_created_at,
            pe.id AS post_envio_id
          FROM ll_campanias_whatsapp c
          JOIN (
            SELECT
              s0.phone_mobile,
              MAX(s0.rowid) AS rowid_canon
            FROM ll_lugares_clientes lc0
            JOIN llxbx_societe s0
              ON s0.rowid = lc0.societe_id
            WHERE lc0.cliente_id = ?
              AND s0.entity = 1
              AND s0.phone_mobile IS NOT NULL
              AND s0.phone_mobile <> ''
            GROUP BY s0.phone_mobile
          ) canon
          JOIN llxbx_societe s
            ON s.rowid = canon.rowid_canon
          JOIN (
            SELECT
              s2.phone_mobile,
              COUNT(*) AS total_sucursales
            FROM ll_lugares_clientes lc2
            JOIN llxbx_societe s2
              ON s2.rowid = lc2.societe_id
            WHERE lc2.cliente_id = ?
              AND s2.entity = 1
              AND s2.phone_mobile IS NOT NULL
              AND s2.phone_mobile <> ''
            GROUP BY s2.phone_mobile
          ) suc
            ON suc.phone_mobile = canon.phone_mobile
          LEFT JOIN ll_societe_extended se
            ON se.societe_id = s.rowid
          LEFT JOIN ll_envios_whatsapp env
            ON env.campania_id = c.id
           /* Usamos lugar_id para vincular el envío al prospecto aunque haya cambiado el phone_mobile histórico. */
           AND env.lugar_id = s.rowid
          LEFT JOIN (
            SELECT p1.*
            FROM ll_post_envio_clasificaciones p1
            INNER JOIN (
              SELECT envio_id, MAX(id) AS max_id
              FROM ll_post_envio_clasificaciones
              WHERE cliente_id = ?
              GROUP BY envio_id
            ) pmax
              ON pmax.max_id = p1.id
          ) pe
            ON pe.envio_id = env.id
          WHERE c.id = ?
            AND c.cliente_id = ?
        `;

        params = [clienteId, clienteId, clienteId, campaniaId, clienteId];
      } else {
        const emailValidExpr = buildEmailValidSqlExpression('s0');
        const emailValidExprS2 = buildEmailValidSqlExpression('s2');
        const emailDedupeKeyExpr = buildEmailDedupeKeySqlExpression('s0');
        const emailDedupeKeyExprS2 = buildEmailDedupeKeySqlExpression('s2');

        const emailCandidatesSubquery = `
          SELECT
            ${emailDedupeKeyExpr} AS dedupe_key,
            s0.rowid,
            CASE WHEN ${emailValidExpr} THEN 1 ELSE 0 END AS has_valid_email
          FROM ll_lugares_clientes lc0
          JOIN llxbx_societe s0
            ON s0.rowid = lc0.societe_id
          WHERE lc0.cliente_id = ?
            AND s0.entity = 1
            AND (
              (s0.phone_mobile IS NOT NULL AND TRIM(s0.phone_mobile) <> '')
              OR ${emailValidExpr}
            )
        `;

        sql = `
          SELECT
            s.rowid AS prospecto_id,
            s.nom AS nombre,
            s.email AS email,
            s.phone_mobile AS telefono_wapp,
            suc.total_sucursales AS total_sucursales,
            s.address AS direccion,
            s.client AS societe_client,
            s.fournisseur AS societe_fournisseur,
            CASE
              WHEN s.fournisseur = 1 THEN 'Proveedor'
              WHEN s.client = 1 THEN 'Cliente'
              WHEN s.client = 2 THEN 'Prospecto'
              WHEN s.client = 3 THEN 'Proveedor'
              ELSE 'Otro'
            END AS tipo_societe,
            se.cartera_origen AS cartera_origen,
            'sin_envio' AS estado_campania,
            NULL AS envio_id,
            NULL AS fecha_envio,
            NULL AS post_envio_estado,
            NULL AS accion_siguiente,
            NULL AS detalle,
            NULL AS clasificado_por,
            NULL AS post_envio_created_at,
            NULL AS post_envio_id,
            email_env.id AS email_envio_id,
            email_env.status AS email_recipient_status,
            email_env.selected_at AS email_selected_at,
            email_env.sent_at AS email_sent_at,
            email_env.error_message AS email_error_message
          FROM (
            SELECT selected.dedupe_key, MAX(selected.rowid) AS rowid_canon
            FROM (
              ${emailCandidatesSubquery}
            ) selected
            INNER JOIN (
              SELECT grouped.dedupe_key, MAX(grouped.has_valid_email) AS preferred_has_valid_email
              FROM (
                ${emailCandidatesSubquery}
              ) grouped
              GROUP BY grouped.dedupe_key
            ) preferred
              ON preferred.dedupe_key = selected.dedupe_key
             AND preferred.preferred_has_valid_email = selected.has_valid_email
            GROUP BY selected.dedupe_key
          ) canon
          JOIN llxbx_societe s
            ON s.rowid = canon.rowid_canon
          JOIN (
            SELECT
              ${emailDedupeKeyExprS2} AS dedupe_key,
              COUNT(*) AS total_sucursales
            FROM ll_lugares_clientes lc2
            JOIN llxbx_societe s2
              ON s2.rowid = lc2.societe_id
            WHERE lc2.cliente_id = ?
              AND s2.entity = 1
              AND (
                (s2.phone_mobile IS NOT NULL AND TRIM(s2.phone_mobile) <> '')
                OR ${emailValidExprS2}
              )
            GROUP BY ${emailDedupeKeyExprS2}
          ) suc
            ON suc.dedupe_key = canon.dedupe_key
          LEFT JOIN ll_societe_extended se
            ON se.societe_id = s.rowid
          LEFT JOIN ll_envios_email email_env
            ON email_env.campania_email_id = ?
           AND email_env.cliente_id = ?
           AND email_env.to_email = LOWER(TRIM(s.email))
        `;

        params = [clienteId, clienteId, clienteId, emailCampaignId || 0, clienteId];
      }

      if (carteraOrigen) {
        sql += ` AND se.cartera_origen = ?`;
        params.push(carteraOrigen);
      }

      sql += `
        ORDER BY nombre ASC
      `;

      const [rows] = await db.execute(sql, params);

      console.log(
        `✅ [prospectos] campania_id=${campaniaId || 'cliente_universo'} email_campaign_id=${emailCampaignId || 'none'} cliente_id=${clienteId} => ${rows.length} filas`
      );

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