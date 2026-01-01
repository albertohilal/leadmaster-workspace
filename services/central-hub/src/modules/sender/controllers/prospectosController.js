const db = require('../../../config/db');

const prospectosController = {
  // Obtener prospectos con filtros (replicando funcionalidad de whatsapp-massive-sender-V2)
  async filtrarProspectos(req, res) {
    try {
      const { 
        campania_id,
        area = '',
        rubro = '',
        direccion = '',
        estado = 'sin_envio',
        tipoCliente = '',
        soloWappValido = 'true'
      } = req.query;
      
      const clienteId = req.user.cliente_id;

      // Query principal que combina llxbx_societe (tabla Dolibarr) con nuestras tablas
      let sql = `
        SELECT 
          s.rowid as id,
          s.nom as nombre,
          s.phone_mobile as telefono_wapp,
          s.email as email,
          s.address as direccion,
          s.town as ciudad,
          COALESCE(r.nombre, 'Sin rubro') as rubro,
          r.area as area_rubro,
          lc.cliente_id,
          CASE 
            WHEN env.id IS NOT NULL THEN env.estado
            ELSE 'disponible'
          END as estado,
          env.fecha_envio,
          CASE 
            WHEN s.phone_mobile IS NOT NULL AND s.phone_mobile != '' THEN 1 
            ELSE 0 
          END as wapp_valido,
          s.client as es_cliente,
          s.fournisseur as es_proveedor
        FROM llxbx_societe s
        LEFT JOIN ll_lugares_clientes lc ON lc.societe_id = s.rowid
        LEFT JOIN ll_societe_extended se ON se.societe_id = s.rowid
        LEFT JOIN ll_rubros r ON se.rubro_id = r.id
        LEFT JOIN ll_envios_whatsapp env ON env.lugar_id = s.rowid${campania_id ? ' AND env.campania_id = ?' : ''}
        WHERE s.entity = 1
          AND lc.cliente_id = ?
      `;
      
      const params = [clienteId];
      if (campania_id) params.push(campania_id);

      // Filtro por números válidos de WhatsApp
      if (soloWappValido === 'true') {
        sql += ` AND s.phone_mobile IS NOT NULL AND s.phone_mobile != ''`;
      }

      // Filtro por estado
      // Si hay campaña seleccionada, excluir contactos ya enviados o pendientes para ESA campaña
      if (campania_id && estado === 'sin_envio') {
        sql += ` AND env.id IS NULL`;
      } else if (!campania_id && estado === 'sin_envio') {
        // Sin campaña seleccionada, mostrar solo sin envío en ninguna campaña
        sql += ` AND env.id IS NULL`;
      } else if (estado === 'enviado') {
        sql += ` AND env.estado = 'enviado'`;
      } else if (estado === 'pendiente') {
        sql += ` AND env.estado = 'pendiente'`;
      }

      // Filtro por rubro
      if (rubro) {
        sql += ` AND COALESCE(r.nombre, 'Sin rubro') LIKE ?`;
        params.push(`%${rubro}%`);
      }

      // Filtro por dirección
      if (direccion) {
        sql += ` AND s.address LIKE ?`;
        params.push(`%${direccion}%`);
      }

      // Filtro por área/ciudad
      if (area) {
        sql += ` AND s.town LIKE ?`;
        params.push(`%${area}%`);
      }

      // Filtro por tipo de cliente
      if (tipoCliente === 'clientes') {
        sql += ` AND s.client = 1`;
      } else if (tipoCliente === 'prospectos') {
        sql += ` AND (s.client = 0 OR s.client IS NULL)`;
      } else if (tipoCliente === 'ambos') {
        sql += ` AND (s.client = 1 OR s.fournisseur = 1)`;
      }

      sql += ` ORDER BY s.nom ASC LIMIT 1000`;

      console.log('🔍 [prospectos] Ejecutando query con filtros:', { 
        clienteId, campania_id, area, rubro, direccion, estado, tipoCliente, soloWappValido 
      });
      console.log('🔍 [prospectos] SQL:', sql);
      console.log('🔍 [prospectos] Params:', params);

      const [rows] = await db.execute(sql, params);

      console.log(`✅ [prospectos] Encontrados ${rows.length} prospectos`);
      if (rows.length > 0) {
        console.log('🔍 [prospectos] Primer registro completo:', JSON.stringify(rows[0], null, 2));
        console.log('🔍 [prospectos] area_rubro del primer registro:', rows[0].area_rubro);
        console.log('🔍 [prospectos] Rubros únicos:', [...new Set(rows.map(r => r.rubro))]);
        console.log('🔍 [prospectos] Áreas únicas:', [...new Set(rows.map(r => r.area_rubro))].filter(Boolean));
      }

      res.json({
        success: true,
        prospectos: rows,
        total: rows.length
      });

    } catch (error) {
      console.error('❌ [prospectos] Error al filtrar prospectos:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  },

  // Obtener áreas/ciudades disponibles
  async obtenerAreas(req, res) {
    try {
      const clienteId = req.user.cliente_id;

      const [rows] = await db.execute(`
        SELECT DISTINCT s.town as nombre
        FROM llxbx_societe s
        WHERE s.entity = 1 
          AND s.town IS NOT NULL 
          AND s.town != ''
        ORDER BY s.town ASC
      `);

      const areas = rows.map(row => ({ 
        id: row.nombre, 
        nombre: row.nombre 
      }));

      res.json({
        success: true,
        areas: areas
      });

    } catch (error) {
      console.error('❌ [prospectos] Error al obtener áreas:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  },

  // Obtener rubros disponibles
  async obtenerRubros(req, res) {
    try {
      const [rows] = await db.execute(`
        SELECT id, nombre, area, keyword_google
        FROM ll_rubros
        ORDER BY nombre ASC
      `);

      res.json({
        success: true,
        rubros: rows
      });

    } catch (error) {
      console.error('❌ [prospectos] Error al obtener rubros:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  },

  // Obtener estadísticas de prospectos
  async obtenerEstadisticas(req, res) {
    try {
      const { campania_id } = req.query;
      const clienteId = req.user.cliente_id;

      const [stats] = await db.execute(`
        SELECT 
          COUNT(DISTINCT s.rowid) as total_prospectos,
          COUNT(DISTINCT CASE WHEN s.phone_mobile IS NOT NULL AND s.phone_mobile != '' THEN s.rowid END) as con_whatsapp,
          COUNT(DISTINCT CASE WHEN env.estado = 'enviado' THEN s.rowid END) as ya_enviados,
          COUNT(DISTINCT CASE WHEN env.estado = 'pendiente' THEN s.rowid END) as pendientes,
          COUNT(DISTINCT CASE WHEN env.id IS NULL THEN s.rowid END) as disponibles
        FROM llxbx_societe s
        LEFT JOIN ll_lugares_clientes lc ON lc.societe_id = s.rowid AND lc.cliente_id = ?
        LEFT JOIN ll_envios_whatsapp env ON env.lugar_id = s.rowid AND env.campania_id = ?
        WHERE s.entity = 1
      `, [clienteId, campania_id]);

      res.json({
        success: true,
        data: stats[0]
      });

    } catch (error) {
      console.error('Error al obtener estadísticas:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
};

module.exports = prospectosController;