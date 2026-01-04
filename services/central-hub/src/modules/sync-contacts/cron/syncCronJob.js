// sync-contacts/cron/syncCronJob.js
const cron = require('node-cron');
const db = require('../../../config/db');
const SyncService = require('../services/syncService');

class SyncCronJob {
  constructor() {
    this.syncService = new SyncService();
    this.isRunning = false;
  }

  /**
   * Iniciar cron job para sincronización automática
   * Se ejecuta cada hora y verifica qué clientes necesitan sync
   */
  start() {
    // Ejecutar cada hora (0 minutos de cada hora)
    cron.schedule('0 * * * *', async () => {
      if (this.isRunning) {
        console.log('⏭️  [sync-cron] Sincronización anterior aún en proceso, saltando...');
        return;
      }

      this.isRunning = true;
      console.log('⏰ [sync-cron] Iniciando verificación de sincronizaciones programadas...');

      try {
        await this.checkAndSyncClients();
      } catch (error) {
        console.error('❌ [sync-cron] Error en cron job:', error);
      } finally {
        this.isRunning = false;
      }
    });

    console.log('✅ [sync-cron] Cron job de sincronización iniciado (cada hora)');
  }

  /**
   * Verificar qué clientes necesitan sincronización y ejecutarla
   */
  async checkAndSyncClients() {
    try {
      // Obtener clientes que tienen sync automático activo y les toca sincronizar
      const [clientes] = await db.execute(`
        SELECT 
          c.cliente_id,
          c.frecuencia_horas,
          c.ultima_sync_completa,
          c.proxima_sync_programada,
          u.usuario as nombre_cliente
        FROM ll_sync_contactos_config c
        INNER JOIN ll_cliente_google_tokens t ON t.cliente_id = c.cliente_id AND t.activo = 1
        INNER JOIN ll_usuarios u ON u.cliente_id = c.cliente_id
        WHERE c.sync_automatico = 1
          AND c.activo = 1
          AND (
            c.proxima_sync_programada IS NULL 
            OR c.proxima_sync_programada <= NOW()
          )
      `);

      if (clientes.length === 0) {
        console.log('✅ [sync-cron] No hay clientes pendientes de sincronización');
        return;
      }

      console.log(`📊 [sync-cron] ${clientes.length} cliente(s) necesitan sincronización`);

      for (const cliente of clientes) {
        try {
          console.log(`🔄 [sync-cron] Sincronizando cliente ${cliente.nombre_cliente} (ID: ${cliente.cliente_id})`);

          // Determinar tipo de sync
          const horasDesdeUltimaSync = cliente.ultima_sync_completa 
            ? (Date.now() - new Date(cliente.ultima_sync_completa).getTime()) / (1000 * 60 * 60)
            : 999;

          let stats;
          if (horasDesdeUltimaSync > 24 || !cliente.ultima_sync_completa) {
            // Si pasaron más de 24h o nunca se sincronizó, hacer sync completa
            console.log(`📋 [sync-cron] Sync completa (última hace ${Math.round(horasDesdeUltimaSync)}h)`);
            stats = await this.syncService.syncFullClient(cliente.cliente_id);
          } else {
            // Sync incremental
            console.log(`📋 [sync-cron] Sync incremental desde ${cliente.ultima_sync_completa}`);
            stats = await this.syncService.syncIncrementalClient(
              cliente.cliente_id, 
              cliente.ultima_sync_completa
            );
          }

          console.log(`✅ [sync-cron] Cliente ${cliente.nombre_cliente} sincronizado:`, stats);

          // Esperar 5 segundos entre clientes para no sobrecargar
          await this.sleep(5000);

        } catch (error) {
          console.error(`❌ [sync-cron] Error sincronizando cliente ${cliente.cliente_id}:`, error.message);
          
          // Registrar error en log
          await db.execute(
            `INSERT INTO ll_sync_contactos_log 
             (cliente_id, accion, estado, mensaje) 
             VALUES (?, 'cron_error', 'error', ?)`,
            [cliente.cliente_id, error.message]
          );
        }
      }

      console.log('🎉 [sync-cron] Ciclo de sincronización completado');

    } catch (error) {
      console.error('❌ [sync-cron] Error verificando clientes:', error);
    }
  }

  /**
   * Ejecutar sync manual para testing
   */
  async runNow() {
    console.log('🚀 [sync-cron] Ejecutando sincronización manual...');
    await this.checkAndSyncClients();
  }

  /**
   * Helper: sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new SyncCronJob();
