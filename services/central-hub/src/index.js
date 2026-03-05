require('./config/environment');

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

/* =========================
   Configuración Express
========================= */

// Desactivar ETag para evitar respuestas 304 en endpoints dinámicos
app.set('etag', false);

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
    timestamp: new Date().toISOString(),
  });
});

/* =========================
   API ROUTES (ANTES del frontend)
========================= */

/**
 * ARQUITECTURA DE RUTAS:
 *
 * Frontend → /api/* → Nginx → Express /api/*
 *
 * Nginx pasa /api/* tal cual a Express (NO elimina el prefijo)
 */

// Health check (sin autenticación)
app.use('/api/health', require('./routes/health.routes'));

// Stats (con autenticación)
app.use('/api/stats', require('./routes/stats.routes'));

// Autenticación
app.use('/api/auth', require('./modules/auth/routes/authRoutes'));

// Admin WhatsApp (single-admin)
app.use('/api/admin/whatsapp', require('./routes/adminWhatsapp.routes'));

/* =====================================================
   WhatsApp PROXY LEGACY (NO TOCAR)
===================================================== */

const whatsappQrProxy = require('./routes/whatsappQrProxy');
app.use('/api/whatsapp', whatsappQrProxy);

/* =====================================================
   WhatsApp PROXY V2 (NUEVO CONTRATO LIMPIO)
   Temporalmente bajo /api/whatsapp-v2
===================================================== */

const whatsappSessionProxyV2 = require('./routes/whatsappSessionProxyV2');
app.use('/api/whatsapp-v2', whatsappSessionProxyV2);

/* =====================================================
   Otros módulos
===================================================== */

// Session Manager (uso interno del Hub)
app.use('/api/session-manager', require('./modules/session-manager/routes'));

// Envíos
app.use('/api/sender', require('./modules/sender/routes'));

// Listener
app.use('/api/listener', require('./modules/listener/routes/listenerRoutes'));

// Sync Contacts
app.use('/api/sync-contacts', require('./modules/sync-contacts/routes'));

/* =====================================================
   QR Code Read-Only Proxy (sin /api por compatibilidad)
===================================================== */

const qrCodeProxy = require('./routes/qrCodeProxy');
app.use('/qr-code', qrCodeProxy);

/* =========================
   404 Handler SOLO para API
========================= */

app.use('/api', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Endpoint ${req.originalUrl} no existe`,
    timestamp: new Date().toISOString(),
  });
});

/* =========================
   Frontend (SIEMPRE AL FINAL)
========================= */

const frontendDistPath = path.join(__dirname, '../frontend/dist');

// estáticos (assets) desde dist
app.use(express.static(frontendDistPath, {
  index: false, // importante: no fuerces index por static; lo maneja el fallback
}));

// SPA fallback (NAVEGACIÓN): cualquier GET/HEAD que NO sea /api devuelve index.html
// Condición extra: solo responder HTML (evita romper requests tipo fetch/json)
app.use((req, res, next) => {
  if (req.path === '/api' || req.path.startsWith('/api/')) return next();
  if (req.path.startsWith('/assets/')) return next();

  if (req.method !== 'GET' && req.method !== 'HEAD') return next();

  const acceptHeader = req.get('Accept') || '';
  const acceptsHtml =
    acceptHeader.includes('text/html') ||
    acceptHeader.includes('application/xhtml+xml') ||
    acceptHeader.includes('*/*');

  if (!acceptsHtml) return next();

  return res.sendFile(path.join(frontendDistPath, 'index.html'));
});

/* =========================
   Server
========================= */

const PORT = process.env.PORT || 3012;

const server = app.listen(PORT, () => {
  console.log(`🚀 Leadmaster Central Hub corriendo en http://localhost:${PORT}`);

  // Inicializar scheduler de programaciones
  const programacionScheduler = require('./modules/sender/services/programacionScheduler');
  programacionScheduler.start();
  console.log('⏰ Scheduler de programaciones iniciado (cada 60 segundos)');

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
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ UNHANDLED REJECTION at:', promise);
  console.error('Reason:', reason);
});