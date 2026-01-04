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
 *   GET /api/whatsapp/:clienteId/status
 *   GET /api/whatsapp/:clienteId/qr
 *
 * IMPORTANTE:
 * - Debe montarse ANTES del static
 * - Es la ÚNICA vía pública hacia WhatsApp
 */
const whatsappQrProxy = require('./routes/whatsappQrProxy');
app.use('/api/whatsapp', whatsappQrProxy);

/* =========================
   Rutas de módulos internos
========================= */

// Autenticación
app.use('/auth', require('./modules/auth/routes/authRoutes'));

// Session Manager (uso interno del Hub)
app.use('/session-manager', require('./modules/session-manager/routes'));

// Envíos
app.use('/sender', require('./modules/sender/routes'));

// ⚠️ Listener DESACTIVADO (módulo inexistente)
// app.use('/listener', require('./modules/listener/routes'));

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

app.listen(PORT, () => {
  console.log(`🚀 Leadmaster Central Hub corriendo en http://localhost:${PORT}`);
});
