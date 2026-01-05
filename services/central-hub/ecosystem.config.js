/**
 * PM2 Ecosystem Config - LeadMaster Central Hub
 * 
 * ARQUITECTURA:
 * - Central Hub: Puerto 3012 (1 instancia única)
 * - Session Manager embebido: Manejado por Central Hub
 * 
 * IMPORTANTE:
 * - NO usar cluster mode (WhatsApp sessions son stateful)
 * - NO usar watch (reinicia sesiones WhatsApp)
 * - Usar node index.js directo (no npm start)
 */

module.exports = {
  apps: [
    {
      name: 'leadmaster-central-hub',
      script: 'src/index.js',
      cwd: '/root/leadmaster-workspace/services/central-hub',
      
      // === Proceso único (NO cluster) ===
      instances: 1,
      exec_mode: 'fork', // NO usar cluster con WhatsApp
      
      // === Variables de entorno ===
      env: {
        NODE_ENV: 'production',
        PORT: 3012
      },
      
      // === Auto-reinicio inteligente ===
      autorestart: true,
      max_restarts: 10, // Límite de reinicios consecutivos
      min_uptime: '10s', // Mínimo uptime antes de considerar "stable"
      max_memory_restart: '1G',
      
      // === Manejo de errores ===
      exp_backoff_restart_delay: 100, // Backoff exponencial entre reinicios
      restart_delay: 4000, // 4 segundos de delay entre reinicios
      
      // === Logs ===
      error_file: '/root/.pm2/logs/leadmaster-central-hub-error.log',
      out_file: '/root/.pm2/logs/leadmaster-central-hub-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // === Opciones de monitoreo ===
      watch: false, // NUNCA watch con WhatsApp
      ignore_watch: ['node_modules', 'tokens', '.git', 'frontend/dist'],
      
      // === Graceful shutdown ===
      kill_timeout: 10000, // 10 segundos para shutdown
      wait_ready: true, // Esperar señal 'ready' del proceso
      listen_timeout: 10000,
      
      // === Prevención de loops ===
      stop_exit_codes: [0], // Solo considerar exit 0 como stop intencional
      
      // === Node.js options ===
      node_args: '--max-old-space-size=2048'
    }
  ]
};
