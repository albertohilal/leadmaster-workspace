// sync-contacts/controllers/syncContactsController.js
const SyncService = require('../services/syncService');
const GoogleContactsService = require('../services/googleContactsService');
const db = require('../../../config/db');

class SyncContactsController {
  constructor() {
    this.syncService = new SyncService();
  }

  /**
   * GET /sync-contacts/authorize/:cliente_id
   * Redirigir a Google OAuth para autorizar acceso
   */
  async authorize(req, res) {
    try {
      const clienteId = parseInt(req.params.cliente_id);

      // Verificar que el usuario logueado sea el mismo cliente o admin
      if (req.user.cliente_id !== clienteId && req.user.tipo !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para autorizar este cliente'
        });
      }

      const authUrl = GoogleContactsService.getAuthUrl(clienteId);

      res.redirect(authUrl);
    } catch (error) {
      console.error('Error en authorize:', error);
      res.status(500).json({
        success: false,
        message: 'Error al generar URL de autorización'
      });
    }
  }

  /**
   * GET /sync-contacts/callback
   * Callback de Google OAuth
   */
  async callback(req, res) {
    try {
      const { code, state } = req.query;
      const clienteId = parseInt(state); // cliente_id viene en state

      if (!code) {
        return res.status(400).send('Error: No se recibió código de autorización');
      }

      await GoogleContactsService.handleOAuthCallback(code, clienteId);

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Autorización Exitosa</title>
          <style>
            body { font-family: Arial; text-align: center; padding: 50px; }
            .success { color: green; font-size: 24px; }
            .info { margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="success">✅ Autorización exitosa</div>
          <div class="info">
            <p>Ahora puedes sincronizar tus contactos con Gmail.</p>
            <p>Puedes cerrar esta ventana.</p>
            <a href="/sync-contacts/status/${clienteId}">Ver estado de sincronización</a>
          </div>
        </body>
        </html>
      `);
    } catch (error) {
      console.error('Error en callback:', error);
      res.status(500).send('Error al procesar autorización');
    }
  }

  /**
   * POST /sync-contacts/sync/:cliente_id
   * Sincronizar contactos manualmente
   */
  async syncManual(req, res) {
    try {
      const clienteId = parseInt(req.params.cliente_id);
      const { incremental = false } = req.body;

      // Verificar permisos
      if (req.user.cliente_id !== clienteId && req.user.tipo !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para sincronizar este cliente'
        });
      }

      console.log(`🔄 [sync-controller] Iniciando sincronización ${incremental ? 'incremental' : 'completa'} para cliente ${clienteId}`);

      let stats;
      if (incremental) {
        // Sync incremental desde última sincronización
        const [config] = await db.execute(
          'SELECT ultima_sync_completa FROM ll_sync_contactos_config WHERE cliente_id = ?',
          [clienteId]
        );
        const since = config[0]?.ultima_sync_completa || new Date(Date.now() - 24 * 60 * 60 * 1000);
        stats = await this.syncService.syncIncrementalClient(clienteId, since);
      } else {
        // Sync completa
        stats = await this.syncService.syncFullClient(clienteId);
      }

      res.json({
        success: true,
        message: 'Sincronización completada',
        stats
      });
    } catch (error) {
      console.error('Error en syncManual:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error al sincronizar contactos'
      });
    }
  }

  /**
   * GET /sync-contacts/status/:cliente_id
   * Ver estado de sincronización
   */
  async status(req, res) {
    try {
      const clienteId = parseInt(req.params.cliente_id);

      // Verificar permisos
      if (req.user.cliente_id !== clienteId && req.user.tipo !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para ver este estado'
        });
      }

      const stats = await this.syncService.getStats(clienteId);

      // Verificar si tiene autorización
      const [tokens] = await db.execute(
        'SELECT activo, fecha_autorizacion FROM ll_cliente_google_tokens WHERE cliente_id = ?',
        [clienteId]
      );

      const hasAuth = tokens.length > 0 && tokens[0].activo;

      res.json({
        success: true,
        cliente_id: clienteId,
        autorizado: hasAuth,
        fecha_autorizacion: tokens[0]?.fecha_autorizacion,
        stats
      });
    } catch (error) {
      console.error('Error en status:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener estado'
      });
    }
  }

  /**
   * GET /sync-contacts/log/:cliente_id
   * Ver historial de sincronizaciones
   */
  async log(req, res) {
    try {
      const clienteId = parseInt(req.params.cliente_id);
      const { limit = 50, offset = 0 } = req.query;

      // Verificar permisos
      if (req.user.cliente_id !== clienteId && req.user.tipo !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para ver este log'
        });
      }

      const [logs] = await db.execute(`
        SELECT 
          id,
          accion,
          societe_id,
          nombre_contacto,
          telefono,
          google_resource_name,
          fecha_sync,
          estado,
          mensaje
        FROM ll_sync_contactos_log
        WHERE cliente_id = ?
        ORDER BY fecha_sync DESC
        LIMIT ? OFFSET ?
      `, [clienteId, parseInt(limit), parseInt(offset)]);

      const [count] = await db.execute(
        'SELECT COUNT(*) as total FROM ll_sync_contactos_log WHERE cliente_id = ?',
        [clienteId]
      );

      res.json({
        success: true,
        logs,
        total: count[0].total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
    } catch (error) {
      console.error('Error en log:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener log'
      });
    }
  }

  /**
   * PUT /sync-contacts/config/:cliente_id
   * Actualizar configuración de sync
   */
  async updateConfig(req, res) {
    try {
      const clienteId = parseInt(req.params.cliente_id);
      const {
        sync_automatico,
        frecuencia_horas,
        solo_con_whatsapp,
        incluir_clientes,
        incluir_prospectos,
        prefijo_nombre,
        sufijo_nombre
      } = req.body;

      // Verificar permisos
      if (req.user.cliente_id !== clienteId && req.user.tipo !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para modificar esta configuración'
        });
      }

      const updates = [];
      const params = [];

      if (sync_automatico !== undefined) {
        updates.push('sync_automatico = ?');
        params.push(sync_automatico ? 1 : 0);
      }
      if (frecuencia_horas !== undefined) {
        updates.push('frecuencia_horas = ?');
        params.push(parseInt(frecuencia_horas));
      }
      if (solo_con_whatsapp !== undefined) {
        updates.push('solo_con_whatsapp = ?');
        params.push(solo_con_whatsapp ? 1 : 0);
      }
      if (incluir_clientes !== undefined) {
        updates.push('incluir_clientes = ?');
        params.push(incluir_clientes ? 1 : 0);
      }
      if (incluir_prospectos !== undefined) {
        updates.push('incluir_prospectos = ?');
        params.push(incluir_prospectos ? 1 : 0);
      }
      if (prefijo_nombre !== undefined) {
        updates.push('prefijo_nombre = ?');
        params.push(prefijo_nombre);
      }
      if (sufijo_nombre !== undefined) {
        updates.push('sufijo_nombre = ?');
        params.push(sufijo_nombre);
      }

      params.push(clienteId);

      await db.execute(
        `UPDATE ll_sync_contactos_config SET ${updates.join(', ')} WHERE cliente_id = ?`,
        params
      );

      res.json({
        success: true,
        message: 'Configuración actualizada'
      });
    } catch (error) {
      console.error('Error en updateConfig:', error);
      res.status(500).json({
        success: false,
        message: 'Error al actualizar configuración'
      });
    }
  }

  /**
   * DELETE /sync-contacts/revoke/:cliente_id
   * Revocar acceso a Google
   */
  async revoke(req, res) {
    try {
      const clienteId = parseInt(req.params.cliente_id);

      // Verificar permisos
      if (req.user.cliente_id !== clienteId && req.user.tipo !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para revocar este acceso'
        });
      }

      // Marcar token como inactivo
      await db.execute(
        'UPDATE ll_cliente_google_tokens SET activo = 0 WHERE cliente_id = ?',
        [clienteId]
      );

      res.json({
        success: true,
        message: 'Acceso revocado. Debes autorizar nuevamente para sincronizar.'
      });
    } catch (error) {
      console.error('Error en revoke:', error);
      res.status(500).json({
        success: false,
        message: 'Error al revocar acceso'
      });
    }
  }
}

module.exports = new SyncContactsController();
