require('dotenv').config();
const app = require('./app');
const wwebjsSession = require('./whatsapp/wwebjs-session');

const PORT = process.env.PORT || 3001;

console.log('='.repeat(50));
console.log('  SESSION MANAGER - Single Admin Session');
console.log('='.repeat(50));
console.log(`Port: ${PORT}`);
console.log(`Node Version: ${process.version}`);
console.log('='.repeat(50));

const server = app.listen(PORT, async () => {
  console.log(`[Server] Listening on port ${PORT}`);
  console.log(`[Server] Health: http://localhost:${PORT}/health`);
  console.log(`[Server] Status: http://localhost:${PORT}/status`);
  console.log('='.repeat(50));
  
  // Initialize WhatsApp session after HTTP server is ready
  console.log('[Bootstrap] Initializing ADMIN WhatsApp session...');
  try {
    await wwebjsSession.connect();
    console.log('[Bootstrap] ✅ WhatsApp session initialized successfully');
  } catch (error) {
    console.error('[Bootstrap] ⚠️  Failed to initialize WhatsApp session:', error.message);
    console.error('[Bootstrap] Server will continue running without WhatsApp connection');
  }
});

let isShuttingDown = false;

const gracefulShutdown = async (signal) => {
  if (isShuttingDown) {
    console.log('[Shutdown] Already shutting down, ignoring signal');
    return;
  }
  
  isShuttingDown = true;
  console.log(`\n[Shutdown] Received ${signal}, initiating graceful shutdown...`);

  const forceExitTimer = setTimeout(() => {
    console.error('[Shutdown] ⚠️  Forcing exit after timeout');
    process.exit(1);
  }, 5000);

  try {
    console.log('[Shutdown] Closing HTTP server...');
    await new Promise((resolve) => {
      server.close(() => {
        console.log('[Shutdown] ✅ HTTP server closed');
        resolve();
      });
    });

    clearTimeout(forceExitTimer);
    console.log('[Shutdown] ✅ Graceful shutdown completed');
    process.exit(0);

  } catch (error) {
    console.error('[Shutdown] ❌ Error during shutdown:', error);
    clearTimeout(forceExitTimer);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  console.error('[UNCAUGHT_EXCEPTION] Error:', error);
  // Do not hard-exit: keep API alive for operational recovery.
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED_REJECTION] at:', promise, 'reason:', reason);
  // Do not hard-exit: QR/login flows can be flaky; service must remain available.
});
