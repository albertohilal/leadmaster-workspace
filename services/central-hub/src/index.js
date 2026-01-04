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

// Proxy QR / status WhatsApp (OBLIGATORIO antes del static)
const whatsappQrProxy = require('./routes/whatsappQrProxy');
app.use('/session-manager', require('./modules/session-manager/routes'));


/* =========================
   Rutas de módulos internos
========================= */

// Autenticación
app.use('/auth', require('./modules/auth/routes/authRoutes'));

// Session Manager
app.use('/session-manager', require('./modules/session-manager/routes'));

// Envíos
app.use('/sender', require('./modules/sender/routes'));

// ⚠️ Listener DESACTIVADO (el módulo no existe)
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
