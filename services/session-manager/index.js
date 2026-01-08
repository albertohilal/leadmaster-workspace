import app from './app.js';
// import { initialize } from './whatsapp/client.js'; // Ya no se inicializa automáticamente

// Environment variable validation
const PORT = process.env.PORT || 3001;

console.log('='.repeat(50));
console.log('  SESSION MANAGER - LeadMaster (Multi-Client)');
console.log('='.repeat(50));
console.log(`Port: ${PORT}`);
console.log(`Node Version: ${process.version}`);
console.log(`Mode: Multi-client singleton (no CLIENTE_ID required)`);
console.log('='.repeat(50));

// NO inicializamos ningún cliente al arrancar
// Los clientes se inicializan bajo demanda cuando recibimos el primer request
console.log('[Init] WhatsApp clients will be initialized on-demand');
console.log('[Init] Send requests with header X-Cliente-Id to initialize sessions');

// Start Express server
const server = app.listen(PORT, () => {
  console.log(`[Server] Listening on port ${PORT}`);
  console.log(`[Server] Health: http://localhost:${PORT}/health`);
  console.log(`[Server] Status: http://localhost:${PORT}/status (requires X-Cliente-Id header)`);
  console.log(`[Server] QR Code: http://localhost:${PORT}/qr-code (requires X-Cliente-Id header)`);
  console.log('='.repeat(50));
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`\n[Shutdown] Received ${signal}`);
  server.close(() => {
    console.log('[Shutdown] Server closed');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('[Shutdown] Forcing exit');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Error handlers
process.on('uncaughtException', (error) => {
  console.error('[FATAL] Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled rejection:', reason);
  process.exit(1);
});
