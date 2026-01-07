require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

/* =========================
   Middleware base
========================= */
app.use(express.json());
app.use(cors());

/* =========================
   HEALTH (antes de todo)
========================= */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'central-hub',
    timestamp: new Date().toISOString()
  });
});

/* =========================
   API ROUTES (ANTES del frontend)
========================= */

/**
 * Proxy público de WhatsApp (QR + status)
 *
 * RUTAS FINALES EXPUESTAS:
 *   GET /whatsapp/:clienteId/status
 *   GET /whatsapp/:clienteId/qr
 *
 * IMPORTANTE:
 * - NGINX recibe /api/whatsapp/* y elimina /api antes de enviar a Express
 * - Por eso Express debe montar en /whatsapp (sin /api)
 * - Debe montarse ANTES del static
 * - Es la ÚNICA vía pública hacia WhatsApp
 */
const whatsappQrProxy = require('./routes/whatsappQrProxy');
app.use('/whatsapp', whatsappQrProxy);

/* =========================
   Rutas de módulos internos
========================= */

// Autenticación
app.use('/auth', require('./modules/auth/routes/authRoutes'));

// Session Manager (uso interno del Hub)
app.use('/session-manager', require('./modules/session-manager/routes'));

// Envíos
app.use('/sender', require('./modules/sender/routes'));

// Listener
app.use('/listener', require('./modules/listener/routes/listenerRoutes'));

// Sync Contacts
app.use('/sync-contacts', require('./modules/sync-contacts/routes'));

/* =========================
   Frontend (SIEMPRE AL FINAL)
========================= */
app.use(express.static(path.join(__dirname, '../frontend/dist')));

/* =========================
   Server
========================= */
const PORT = process.env.PORT || 3012;

const server = app.listen(PORT, () => {
  console.log(`🚀 Leadmaster Central Hub corriendo en http://localhost:${PORT}`);
  
  // Signal to PM2 that app is ready (wait_ready: true)
  if (process.send) {
    process.send('ready');
  }
});

/* =========================
   Graceful Shutdown
========================= */
const gracefulShutdown = (signal) => {
  console.log(`\n⚠️  ${signal} recibido. Cerrando servidor...`);
  
  server.close(() => {
    console.log('✅ Servidor cerrado correctamente');
    process.exit(0);
  });
  
  // Forzar cierre si no responde en 10 segundos
  setTimeout(() => {
    console.error('❌ Tiempo de espera excedido. Forzando cierre.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

/* =========================
   Global Error Handlers
========================= */
process.on('uncaughtException', (error) => {
  console.error('❌ UNCAUGHT EXCEPTION:', error);
  console.error(error.stack);
  // En producción, loguear y continuar (no crash)
  // PM2 reiniciará si es crítico
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ UNHANDLED REJECTION at:', promise);
  console.error('Reason:', reason);
  // En producción, loguear y continuar
});
