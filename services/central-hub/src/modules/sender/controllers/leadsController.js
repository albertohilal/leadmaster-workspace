const db = require('../../../config/db');

/**
 * Obtener todos los leads/clientes para un cliente específico
 * Filtro multi-cliente por cliente_id
 */
exports.getLeadsByClient = async (req, res) => {
  try {
    const { cliente_id } = req.user; // Viene del middleware de auth
    
    // Usando exactamente la consulta que proporcionaste
    const query = `
      SELECT * FROM iunaorg_dyd.llxbx_societe
      LEFT JOIN iunaorg_dyd.ll_lugares_clientes
      ON ll_lugares_clientes.societe_id = llxbx_societe.rowid
      WHERE ll_lugares_clientes.cliente_id = ?
    `;
    
    const [rows] = await db.execute(query, [cliente_id]);
    
    res.json({
      success: true,
      data: rows,
      total: rows.length,
      cliente_id: cliente_id
    });
    
  } catch (error) {
    console.error('Error getting leads by client:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener leads',
      error: error.message
    });
  }
};

/**
 * Obtener leads filtrados por tipo y origen
 */
exports.getFilteredLeads = async (req, res) => {
  try {
    const { cliente_id } = req.user;
    const { tipo_cliente, origen, search, ia_status } = req.query;
    
    let whereConditions = ['ll_lugares_clientes.cliente_id = ?'];
    let params = [cliente_id];
    
    // Filtro por tipo de cliente
    if (tipo_cliente && tipo_cliente !== 'all') {
      whereConditions.push('llxbx_societe.client = ?');
      params.push(parseInt(tipo_cliente));
    }
    
    // Filtro por origen
    if (origen === 'originales') {
      whereConditions.push('llxbx_societe.client = 1');
    } else if (origen === 'scraping') {
      whereConditions.push('(llxbx_societe.client = 0 AND llxbx_societe.fournisseur = 0)');
    }
    
    // Filtro por búsqueda
    if (search) {
      whereConditions.push('(llxbx_societe.nom LIKE ? OR llxbx_societe.telephone LIKE ? OR llxbx_societe.email LIKE ?)');
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    const whereClause = whereConditions.join(' AND ');
    
    const query = `
      SELECT 
        llxbx_societe.rowid,
        llxbx_societe.nom,
        llxbx_societe.telephone,
        llxbx_societe.email,
        llxbx_societe.address,
        llxbx_societe.client,
        llxbx_societe.datec as fecha_creacion,
        CASE 
          WHEN llxbx_societe.client = 0 THEN 'Lead'
          WHEN llxbx_societe.client = 1 THEN 'Cliente'
          WHEN llxbx_societe.client = 2 THEN 'Prospecto' 
          WHEN llxbx_societe.client = 3 THEN 'Proveedor'
        END as tipo_cliente,
        CASE 
          WHEN llxbx_societe.client = 1 THEN 'Originales'
          WHEN llxbx_societe.client = 0 THEN 'Scraping'
          ELSE 'Otros'
        END as origen,
        ll_lugares_clientes.cliente_id,
        FALSE as ia_habilitada
      FROM iunaorg_dyd.llxbx_societe
      LEFT JOIN iunaorg_dyd.ll_lugares_clientes
      ON ll_lugares_clientes.societe_id = llxbx_societe.rowid
      WHERE ${whereClause}
      AND llxbx_societe.telephone IS NOT NULL
      ORDER BY llxbx_societe.client DESC, llxbx_societe.nom ASC
    `;
    
    const [rows] = await db.execute(query, params);
    
    res.json({
      success: true,
      data: rows,
      total: rows.length,
      filters: { tipo_cliente, origen, search, ia_status },
      cliente_id: cliente_id
    });
    
  } catch (error) {
    console.error('Error getting filtered leads:', error);
    res.status(500).json({
      success: false,
      message: 'Error al filtrar leads',
      error: error.message
    });
  }
};

/**
 * Estadísticas de leads por cliente
 */
exports.getLeadsStats = async (req, res) => {
  try {
    const { cliente_id } = req.user;
    
    const query = `
      SELECT 
        llxbx_societe.client,
        COUNT(*) as total,
        CASE 
          WHEN llxbx_societe.client = 0 THEN 'Lead'
          WHEN llxbx_societe.client = 1 THEN 'Cliente'
          WHEN llxbx_societe.client = 2 THEN 'Prospecto' 
          WHEN llxbx_societe.client = 3 THEN 'Proveedor'
        END as tipo_cliente
      FROM iunaorg_dyd.llxbx_societe
      LEFT JOIN iunaorg_dyd.ll_lugares_clientes
      ON ll_lugares_clientes.societe_id = llxbx_societe.rowid
      WHERE ll_lugares_clientes.cliente_id = ?
      AND llxbx_societe.telephone IS NOT NULL
      GROUP BY llxbx_societe.client
      ORDER BY llxbx_societe.client
    `;
    
    const [rows] = await db.execute(query, [cliente_id]);
    
    const stats = {
      total_leads: 0,
      por_tipo: {},
      cliente_id: cliente_id
    };
    
    rows.forEach(row => {
      stats.total_leads += row.total;
      stats.por_tipo[row.tipo_cliente] = row.total;
    });
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error('Error getting leads stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas',
      error: error.message
    });
  }
};