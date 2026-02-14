// sync-contacts/services/syncService.js
const db = require('../../../config/db');
const GoogleContactsService = require('./googleContactsService');

class SyncService {
  constructor() {
    this.googleService = new GoogleContactsService();
  }

  /**
   * Sincronización completa de un cliente
   */
  async syncFullClient(clienteId) {
    try {
      console.log(`🔄 [sync] Iniciando sincronización completa para cliente ${clienteId}`);

      // Inicializar servicio de Google
      await this.googleService.initializeForClient(clienteId);

      // Obtener configuración del cliente
      const config = await this.getClientConfig(clienteId);

      // Obtener contactos de Dolibarr
      const contactosDolibarr = await this.getContactosDolibarr(clienteId, config);
      console.log(`📊 [sync] Encontrados ${contactosDolibarr.length} contactos en Dolibarr`);

      // Obtener mappings existentes
      const [mappings] = await db.execute(
        'SELECT societe_id, google_resource_name FROM ll_sync_contactos_mapping WHERE cliente_id = ?',
        [clienteId]
      );
      const mappingMap = new Map(mappings.map(m => [m.societe_id, m.google_resource_name]));

      const stats = {
        total: contactosDolibarr.length,
        created: 0,
        updated: 0,
        skipped: 0,
        errors: 0
      };

      // Procesar cada contacto
      for (const contacto of contactosDolibarr) {
        try {
          const resourceName = mappingMap.get(contacto.societe_id);

          if (resourceName) {
            // Contacto ya existe, actualizar
            await this.googleService.updateContact(resourceName, contacto, clienteId);
            stats.updated++;
            console.log(`✅ [sync] Actualizado: ${contacto.nombre}`);
          } else {
            // Contacto nuevo, crear
            await this.googleService.createContact(contacto, clienteId);
            stats.created++;
            console.log(`➕ [sync] Creado: ${contacto.nombre}`);
          }

          // Rate limiting: esperar 100ms entre requests (600/min máximo)
          await this.sleep(100);

        } catch (error) {
          stats.errors++;
          console.error(`❌ [sync] Error con ${contacto.nombre}:`, error.message);
        }
      }

      // Actualizar configuración
      await db.execute(
        `UPDATE ll_sync_contactos_config 
         SET ultima_sync_completa = NOW(),
             proxima_sync_programada = DATE_ADD(NOW(), INTERVAL frecuencia_horas HOUR)
         WHERE cliente_id = ?`,
        [clienteId]
      );

      // Log resumen
      await this.googleService.logSync(
        clienteId,
        'sync_full',
        null,
        null,
        'success',
        JSON.stringify(stats)
      );

      console.log(`🎉 [sync] Sincronización completa para cliente ${clienteId}:`, stats);
      return stats;

    } catch (error) {
      console.error(`❌ [sync] Error en sincronización completa:`, error);
      
      await this.googleService.logSync(
        clienteId,
        'sync_full',
        null,
        null,
        'error',
        error.message
      );

      throw error;
    }
  }

  /**
   * Sincronización incremental (solo cambios recientes)
   */
  async syncIncrementalClient(clienteId, since) {
    try {
      console.log(`🔄 [sync] Sincronización incremental para cliente ${clienteId} desde ${since}`);

      await this.googleService.initializeForClient(clienteId);

      const config = await this.getClientConfig(clienteId);

      // Obtener solo contactos modificados desde 'since'
      const contactosModificados = await this.getContactosModificados(clienteId, config, since);
      
      if (contactosModificados.length === 0) {
        console.log(`✅ [sync] No hay cambios desde última sincronización`);
        return { total: 0, created: 0, updated: 0, errors: 0 };
      }

      console.log(`📊 [sync] ${contactosModificados.length} contactos modificados`);

      const stats = {
        total: contactosModificados.length,
        created: 0,
        updated: 0,
        errors: 0
      };

      for (const contacto of contactosModificados) {
        try {
          const mapping = await this.googleService.getMapping(clienteId, contacto.societe_id);

          if (mapping) {
            await this.googleService.updateContact(mapping.google_resource_name, contacto, clienteId);
            stats.updated++;
          } else {
            await this.googleService.createContact(contacto, clienteId);
            stats.created++;
          }

          await this.sleep(100);

        } catch (error) {
          stats.errors++;
          console.error(`❌ [sync] Error:`, error.message);
        }
      }

      await db.execute(
        `UPDATE ll_sync_contactos_config 
         SET proxima_sync_programada = DATE_ADD(NOW(), INTERVAL frecuencia_horas HOUR)
         WHERE cliente_id = ?`,
        [clienteId]
      );

      console.log(`✅ [sync] Incremental completo:`, stats);
      return stats;

    } catch (error) {
      console.error(`❌ [sync] Error en sync incremental:`, error);
      throw error;
    }
  }

  /**
   * Obtener contactos de Dolibarr para un cliente
   */
  async getContactosDolibarr(clienteId, config) {
    let sql = `
      SELECT 
        s.rowid as societe_id,
        s.nom as nombre,
        s.phone_mobile as telefono,
        s.address as direccion,
        s.town as ciudad,
        s.client as es_cliente,
        COALESCE(r.nombre, 'Sin categoría') as rubro,
        r.area as area_rubro,
        u.usuario as cliente_nombre
      FROM llxbx_societe s
      INNER JOIN ll_lugares_clientes lc ON lc.societe_id = s.rowid
      LEFT JOIN ll_societe_extended se ON se.societe_id = s.rowid
      LEFT JOIN ll_rubros r ON se.rubro_id = r.id
      LEFT JOIN ll_usuarios u ON u.cliente_id = lc.cliente_id
      WHERE lc.cliente_id = ?
        AND s.entity = 1
    `;

    const params = [clienteId];

    // Filtro: solo con WhatsApp
    if (config.solo_con_whatsapp) {
      sql += ` AND s.phone_mobile IS NOT NULL AND s.phone_mobile != ''`;
    }

    // Filtro: incluir/excluir clientes y prospectos
    const conditions = [];
    if (config.incluir_clientes) {
      conditions.push('s.client = 1');
    }
    if (config.incluir_prospectos) {
      conditions.push('((s.client = 0 OR s.client IS NULL) AND s.fournisseur = 0)');
    }
    if (conditions.length > 0) {
      sql += ` AND (${conditions.join(' OR ')})`;
    }

    sql += ` ORDER BY s.nom ASC`;

    const [rows] = await db.execute(sql, params);

    // Agregar prefijo/sufijo configurado
    return rows.map(row => ({
      ...row,
      prefijo: config.prefijo_nombre || '',
      sufijo: config.sufijo_nombre || ''
    }));
  }

  /**
   * Obtener contactos modificados desde una fecha
   */
  async getContactosModificados(clienteId, config, since) {
    // En Dolibarr, verificar campo tms (timestamp de modificación)
    let sql = `
      SELECT 
        s.rowid as societe_id,
        s.nom as nombre,
        s.phone_mobile as telefono,
        s.address as direccion,
        s.town as ciudad,
        s.client as es_cliente,
        COALESCE(r.nombre, 'Sin categoría') as rubro,
        r.area as area_rubro,
        u.usuario as cliente_nombre,
        s.tms as fecha_modificacion
      FROM llxbx_societe s
      INNER JOIN ll_lugares_clientes lc ON lc.societe_id = s.rowid
      LEFT JOIN ll_societe_extended se ON se.societe_id = s.rowid
      LEFT JOIN ll_rubros r ON se.rubro_id = r.id
      LEFT JOIN ll_usuarios u ON u.cliente_id = lc.cliente_id
      WHERE lc.cliente_id = ?
        AND s.entity = 1
        AND s.tms >= ?
    `;

    const params = [clienteId, since];

    if (config.solo_con_whatsapp) {
      sql += ` AND s.phone_mobile IS NOT NULL AND s.phone_mobile != ''`;
    }

    const conditions = [];
    if (config.incluir_clientes) {
      conditions.push('s.client = 1');
    }
    if (config.incluir_prospectos) {
      conditions.push('((s.client = 0 OR s.client IS NULL) AND s.fournisseur = 0)');
    }
    if (conditions.length > 0) {
      sql += ` AND (${conditions.join(' OR ')})`;
    }

    sql += ` ORDER BY s.tms DESC`;

    const [rows] = await db.execute(sql, params);

    return rows.map(row => ({
      ...row,
      prefijo: config.prefijo_nombre || '',
      sufijo: config.sufijo_nombre || ''
    }));
  }

  /**
   * Obtener configuración del cliente
   */
  async getClientConfig(clienteId) {
    const [rows] = await db.execute(
      'SELECT * FROM ll_sync_contactos_config WHERE cliente_id = ? AND activo = 1',
      [clienteId]
    );

    if (rows.length === 0) {
      // Crear configuración por defecto
      await db.execute(
        `INSERT INTO ll_sync_contactos_config 
         (cliente_id, sync_automatico, frecuencia_horas, solo_con_whatsapp) 
         VALUES (?, 1, 6, 1)`,
        [clienteId]
      );

      return {
        sync_automatico: true,
        frecuencia_horas: 6,
        solo_con_whatsapp: true,
        incluir_clientes: true,
        incluir_prospectos: true,
        prefijo_nombre: '',
        sufijo_nombre: ''
      };
    }

    return rows[0];
  }

  /**
   * Obtener estadísticas de sincronización
   */
  async getStats(clienteId) {
    const [stats] = await db.execute(`
      SELECT 
        (SELECT COUNT(*) 
         FROM llxbx_societe s
         INNER JOIN ll_lugares_clientes lc ON lc.societe_id = s.rowid
         WHERE lc.cliente_id = ? AND s.phone_mobile IS NOT NULL AND s.phone_mobile != '') as total_contactos,
        
        (SELECT COUNT(*) 
         FROM ll_sync_contactos_mapping 
         WHERE cliente_id = ?) as sincronizados,
        
        (SELECT MAX(fecha_sync) 
         FROM ll_sync_contactos_log 
         WHERE cliente_id = ? AND estado = 'success') as ultima_sync,
        
        (SELECT proxima_sync_programada 
         FROM ll_sync_contactos_config 
         WHERE cliente_id = ?) as proxima_sync
    `, [clienteId, clienteId, clienteId, clienteId]);

    const [recentLog] = await db.execute(`
      SELECT accion, estado, COUNT(*) as cantidad
      FROM ll_sync_contactos_log
      WHERE cliente_id = ? AND fecha_sync >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      GROUP BY accion, estado
    `, [clienteId]);

    return {
      ...stats[0],
      pendientes: stats[0].total_contactos - stats[0].sincronizados,
      ultimas_24h: recentLog
    };
  }

  /**
   * Helper: Sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = SyncService;
