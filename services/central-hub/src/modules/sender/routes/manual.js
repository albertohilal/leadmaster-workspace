/**
 * Rutas para envío manual
 * Central Hub – LeadMaster
 * 
 * FASE 1 – Modo Manual Controlado
 * 
 * Endpoint: POST /api/sender/registro-manual
 */

const express = require('express');
const router = express.Router();
const manualController = require('../controllers/manualController');

/**
 * POST /registro-manual
 * Registra un intento de envío manual por Web WhatsApp
 */
router.post('/registro-manual', manualController.registrarEnvioManual);

module.exports = router;
