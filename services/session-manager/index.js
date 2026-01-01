import app from './app.js';
import { initialize } from './whatsapp/client.js';

// Environment variable validation
const CLIENTE_ID = process.env.CLIENTE_ID;
const PORT = process.env.PORT || 3001;

if (!CLIENTE_ID) {
  console.error('[FATAL] CLIENTE_ID environment variable is required');
  console.error('[FATAL] Usage: CLIENTE_ID=51 npm start');
  process.exit(1);
}

// Validate CLIENTE_ID is a number
const clienteIdNum = parseInt(CLIENTE_ID, 10);
if (isNaN(clienteIdNum) || clienteIdNum <= 0) {
  console.error('[FATAL] CLIENTE_ID must be a positive integer');
  process.exit(1);
}

console.log('='.repeat(50));
console.log('  SESSION MANAGER - LeadMaster');
console.log('='.repeat(50));
console.log(`Cliente ID: ${clienteIdNum}`);
console.log(`Port: ${PORT}`);
console.log(`Node Version: ${process.version}`);
console.log('='.repeat(50));

// Initialize WhatsApp client
try {
  initialize(clienteIdNum);
  console.log('[Init] WhatsApp client initialization started');
} catch (error) {
  console.error('[FATAL] Failed to initialize WhatsApp client:', error);
  process.exit(1);
}

// Start Express server
const server = app.listen(PORT, () => {
  console.log(`[Server] Listening on port ${PORT}`);
  console.log(`[Server] Health: http://localhost:${PORT}/health`);
  console.log(`[Server] Status: http://localhost:${PORT}/status`);
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
