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
        estado = '',
        tipoCliente = '',
        soloWappValido = 'true'
      } = req.query;
      
      // ✅ VALIDACIÓN: campania_id es obligatorio
      if (!campania_id) {
        return res.status(400).json({
          success: false,
          error: 'campania_id es obligatorio'
        });
      }
      
      const userId = req.user.id;  // ID del usuario en ll_usuarios
      const clienteId = req.user.cliente_id;  // ID del cliente

      console.log("==================================================");
      console.log("DIAGNOSTICO PROSPECTOS");
      console.log("userId:", userId);
      console.log("clienteId:", clienteId);
      console.log("campania_id:", campania_id);
      console.log("req.user completo:", JSON.stringify(req.user, null, 2));
      console.log("==================================================");

      // ✅ Separar condiciones WHERE y HAVING correctamente
      const whereConditions = ['s.entity = 1'];
      const havingConditions = [];
      
      // Parámetros en orden: clienteId (INNER JOIN), campania_id (LEFT JOIN)
      const params = [clienteId, campania_id];

      // Filtro de WhatsApp válido (WHERE)
      if (soloWappValido === 'true') {
        whereConditions.push("s.phone_mobile IS NOT NULL AND s.phone_mobile != ''");
      }

      // Filtro por rubro (WHERE)
      if (rubro) {
        whereConditions.push("COALESCE(r.nombre, 'Sin rubro') LIKE ?");
        params.push(`%${rubro}%`);
      }

      // Filtro por dirección (WHERE)
      if (direccion) {
        whereConditions.push("s.address LIKE ?");
        params.push(`%${direccion}%`);
      }

      // Filtro por área (WHERE)
      if (area) {
        whereConditions.push("r.area LIKE ?");
        params.push(`%${area}%`);
      }

      // Filtro por tipo de cliente (WHERE)
      if (tipoCliente === 'clientes') {
        whereConditions.push("s.client = 1");
      } else if (tipoCliente === 'prospectos') {
        whereConditions.push("((s.client = 0 OR s.client IS NULL) AND s.fournisseur = 0)");
      } else if (tipoCliente === 'ambos') {
        whereConditions.push("(s.client = 1 OR s.fournisseur = 1)");
      }

      // Filtro por estado (HAVING - usa funciones agregadas)
      if (estado === 'sin_envio') {
        havingConditions.push("MAX(env.id) IS NULL");
      } else if (estado === 'enviado') {
        havingConditions.push("MAX(env.estado) = 'enviado'");
      } else if (estado === 'pendiente') {
        havingConditions.push("MAX(env.estado) = 'pendiente'");
      }

      // Construir query final con estructura limpia
      const sql = `
        SELECT 
          s.rowid as id,
          s.nom as nombre,
          s.phone_mobile as telefono_wapp,
          s.email as email,
          s.address as direccion,
          s.town as ciudad,
          COALESCE(r.nombre, 'Sin rubro') as rubro,
          r.area as area_rubro,
          MIN(lc.cliente_id) as cliente_id,
          CASE 
            WHEN MAX(env.id) IS NOT NULL THEN MAX(env.estado)
            ELSE 'disponible'
          END as estado,
          MAX(env.fecha_envio) as fecha_envio,
          CASE 
            WHEN s.phone_mobile IS NOT NULL AND s.phone_mobile != '' THEN 1 
            ELSE 0 
          END as wapp_valido,
          s.client as es_cliente,
          s.fournisseur as es_proveedor
        FROM llxbx_societe s
        INNER JOIN ll_lugares_clientes lc ON lc.societe_id = s.rowid AND lc.cliente_id = ?
        LEFT JOIN ll_societe_extended se ON se.societe_id = s.rowid
        LEFT JOIN ll_rubros r ON se.rubro_id = r.id
        LEFT JOIN ll_envios_whatsapp env ON env.lugar_id = s.rowid AND env.campania_id = ?
        WHERE ${whereConditions.join(' AND ')}
        GROUP BY s.rowid, s.nom, s.phone_mobile, s.email, s.address, s.town, r.nombre, r.area, s.client, s.fournisseur
        HAVING ${havingConditions.length > 0 ? havingConditions.join(' AND ') : '1=1'}
        ORDER BY s.nom ASC
        LIMIT 1000
      `;

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
        SELECT DISTINCT ll_rubros.area as nombre
        FROM ll_rubros
        WHERE ll_rubros.area IS NOT NULL 
          AND ll_rubros.area != ''
        ORDER BY ll_rubros.area ASC
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
        SELECT ll_rubros.id, ll_rubros.nombre, ll_rubros.area, ll_rubros.keyword_google
        FROM ll_rubros
        ORDER BY ll_rubros.nombre ASC
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

  // Obtener estados disponibles de envíos
  async obtenerEstados(req, res) {
    try {
      const { campania_id } = req.query;
      
      let sql = `
        SELECT DISTINCT ll_envios_whatsapp.estado as nombre
        FROM ll_envios_whatsapp
        WHERE ll_envios_whatsapp.estado IS NOT NULL 
          AND ll_envios_whatsapp.estado != ''
      `;
      
      const params = [];
      
      // ✅ Filtrar por campaña específica si se proporciona
      if (campania_id) {
        sql += ` AND ll_envios_whatsapp.campania_id = ?`;
        params.push(campania_id);
      }
      
      sql += ` ORDER BY ll_envios_whatsapp.estado ASC`;
      
      const [rows] = await db.execute(sql, params);

      const estados = rows.map(row => ({ 
        id: row.nombre, 
        nombre: row.nombre 
      }));

      // Agregar estado "sin_envio" para prospectos que no han sido enviados
      estados.unshift({ id: 'sin_envio', nombre: 'sin_envio' });

      res.json({
        success: true,
        estados: estados
      });

    } catch (error) {
      console.error('❌ [prospectos] Error al obtener estados:', error);
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