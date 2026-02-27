/**
 * PM2 Ecosystem Config - Session Manager (Multi-Client Singleton)
 * 
 * ARQUITECTURA:
 * - Puerto: 3001
 * - 1 instancia ÚNICA para TODOS los clientes
 * - Clientes se inicializan bajo demanda vía header X-Cliente-Id
 * - NO cluster mode
 */

module.exports = {
  apps: [
    {
      name: 'session-manager',
      script: 'index.js',
      cwd: '/root/leadmaster-workspace/services/session-manager',
      
      // === Variables de entorno ===
      env: {
        NODE_ENV: 'production',
        PORT: 3001
        // NO CLIENTE_ID - se pasa por header en cada request
      },
      
      // === Proceso único (NO cluster) ===
      instances: 1,
      exec_mode: 'fork',
      
      // === Auto-reinicio limitado ===
      autorestart: true,
      max_restarts: 5,
      min_uptime: '30s', // WhatsApp tarda más en iniciar
      max_memory_restart: '1024M', // Más memoria para múltiples clientes
      
      // === Backoff para evitar loops ===
      exp_backoff_restart_delay: 500,
      restart_delay: 10000, // 10 segundos entre reinicios
      
      // === Logs centralizados ===
      error_file: '/root/.pm2/logs/session-manager-error.log',
      out_file: '/root/.pm2/logs/session-manager-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // === NO watch con WhatsApp ===
      watch: false,
      
      // === Shutdown extendido (WhatsApp logout) ===
      kill_timeout: 30000, // 30 segundos para logout de todos los clientes
      
      // === Prevención EADDRINUSE ===
      // Nota: Removido stop_exit_codes para permitir auto-recovery ante cualquier exit
      
      // === Node.js options ===
      node_args: '--max-old-space-size=1536 --experimental-modules'
    }
  ]
};
