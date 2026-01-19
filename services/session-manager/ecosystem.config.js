/**
 * PM2 Ecosystem Config - Session Manager
 * 
 * ARQUITECTURA:
 * - Session Manager: Puerto 3001 (1 instancia única)
 * - Maneja la sesión WhatsApp single-admin
 * 
 * CRÍTICO:
 * - NO reiniciar este proceso innecesariamente (pérdida de sesión WhatsApp)
 * - NO usar cluster mode (WhatsApp es stateful)
 * - NO usar watch
 * - Este proceso debe permanecer levantado indefinidamente
 * - Central Hub es independiente y puede reiniciarse sin afectar WhatsApp
 */

module.exports = {
  apps: [
    {
      name: 'session-manager',
      script: 'index.js',
      cwd: '/root/leadmaster-workspace/services/session-manager',
      
      // === Proceso único (NO cluster) ===
      instances: 1,
      exec_mode: 'fork',
      
      // === Variables de entorno ===
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      
      // === Auto-reinicio inteligente ===
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '1G',
      
      // === Manejo de errores ===
      exp_backoff_restart_delay: 100,
      restart_delay: 5000,
      
      // === Logs ===
      error_file: '/root/.pm2/logs/session-manager-error.log',
      out_file: '/root/.pm2/logs/session-manager-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // === Opciones de monitoreo ===
      watch: false,
      ignore_watch: ['node_modules', '.wwebjs_auth', '.git'],
      
      // === Graceful shutdown ===
      kill_timeout: 10000,
      wait_ready: true,
      listen_timeout: 10000,
      
      // === Prevención de loops ===
      stop_exit_codes: [0],
      
      // === Node.js options ===
      node_args: '--max-old-space-size=2048'
    }
  ]
};
