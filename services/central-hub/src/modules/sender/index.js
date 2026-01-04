// Módulo Sender: Entry point para integración
const express = require('express');
const router = express.Router();

// Importar y montar rutas del módulo sender
router.use('/campaigns', require('./routes/campaigns'));

module.exports = router;
