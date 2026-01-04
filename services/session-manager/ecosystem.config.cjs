/**
 * PM2 Ecosystem Config - Session Manager (Standalone)
 * 
 * ⚠️ USAR SOLO SI Session Manager ES UN SERVICIO INDEPENDIENTE
 * 
 * ARQUITECTURA:
 * - Puerto: 3001
 * - 1 instancia por cliente
 * - NO cluster mode
 * - Gestión manual de múltiples clientes
 */

module.exports = {
  apps: [
    {
      name: 'session-manager-51',
      script: 'index.js',
      cwd: '/root/leadmaster-workspace/services/session-manager',
      
      // === Variables de entorno ===
      env: {
        NODE_ENV: 'production',
        CLIENTE_ID: 51,
        PORT: 3001
      },
      
      // === Proceso único (NO cluster) ===
      instances: 1,
      exec_mode: 'fork',
      
      // === Auto-reinicio limitado ===
      autorestart: true,
      max_restarts: 5, // Menos reinicios que central-hub
      min_uptime: '30s', // WhatsApp tarda más en iniciar
      max_memory_restart: '800M',
      
      // === Backoff para evitar loops ===
      exp_backoff_restart_delay: 500,
      restart_delay: 10000, // 10 segundos entre reinicios
      
      // === Logs separados ===
      error_file: '/root/.pm2/logs/session-manager-51-error.log',
      out_file: '/root/.pm2/logs/session-manager-51-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // === NO watch con WhatsApp ===
      watch: false,
      
      // === Shutdown extendido (WhatsApp logout) ===
      kill_timeout: 20000, // 20 segundos para logout de WhatsApp
      wait_ready: true,
      listen_timeout: 15000,
      
      // === Prevención EADDRINUSE ===
      stop_exit_codes: [0],
      
      // === Node.js options ===
      node_args: '--max-old-space-size=1024 --experimental-modules'
    }
  ]
};
