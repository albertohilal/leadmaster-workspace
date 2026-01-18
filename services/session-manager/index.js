require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 3001;

console.log('='.repeat(50));
console.log('  SESSION MANAGER - Single Admin');
console.log('='.repeat(50));
console.log(`Port: ${PORT}`);
console.log(`Node Version: ${process.version}`);
console.log('='.repeat(50));

const server = app.listen(PORT, () => {
  console.log(`[Server] Listening on port ${PORT}`);
  console.log(`[Server] Health: http://localhost:${PORT}/health`);
  console.log(`[Server] Status: http://localhost:${PORT}/status`);
  console.log(`[Server] QR Code: http://localhost:${PORT}/qr-code`);
  console.log('='.repeat(50));
});

let isShuttingDown = false;

const gracefulShutdown = async (signal) => {
  if (isShuttingDown) {
    console.log('[Shutdown] Already shutting down, ignoring signal');
    return;
  }
  
  isShuttingDown = true;
  console.log(`\n[Shutdown] Received ${signal}, initiating graceful shutdown...`);

  if (process.send) {
    process.send('shutdown');
  }

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

    const { cleanup } = require('./whatsapp/session');
    await cleanup();

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
  console.error('[FATAL] Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
