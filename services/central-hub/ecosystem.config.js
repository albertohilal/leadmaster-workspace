/**
 * PM2 Ecosystem Config - LeadMaster Central Hub
 *
 * ARQUITECTURA:
 * - Central Hub: Puerto 3012 (1 instancia única)
 * - Session Manager: Proceso independiente (puerto 3001)
 *
 * IMPORTANTE:
 * - NO usar cluster mode (WhatsApp sessions son stateful)
 * - NO usar watch (reinicia sesiones WhatsApp)
 * - Este archivo controla SOLO central-hub
 * - Session Manager tiene su propio ecosystem.config.js
 */

module.exports = {
  apps: [
    {
      name: 'leadmaster-central-hub',
      script: 'src/index.js',
      cwd: '/root/leadmaster-workspace/services/central-hub',

      // === Proceso único (NO cluster) ===
      instances: 1,
      exec_mode: 'fork',

      // === Variables de entorno (CANÓNICAS) ===
      env: {
        NODE_ENV: 'production',
        PORT: 3012,

        // ---- WhatsApp / Session Manager ----
        SESSION_MANAGER_BASE_URL: 'http://localhost:3001',

        // ---- Seguridad operativa ----
        DRY_RUN: 'true', // ⚠️ BLOQUEO de envíos reales

        // ---- Campañas automáticas ----
        AUTO_CAMPAIGNS_ENABLED: 'false'
      },

      // === Auto-reinicio inteligente ===
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '1G',

      // === Manejo de errores ===
      exp_backoff_restart_delay: 100,
      restart_delay: 4000,

      // === Logs ===
      error_file: '/root/.pm2/logs/leadmaster-central-hub-error.log',
      out_file: '/root/.pm2/logs/leadmaster-central-hub-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // === Opciones de monitoreo ===
      watch: false,
      ignore_watch: ['node_modules', 'tokens', '.git', 'frontend/dist'],

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
