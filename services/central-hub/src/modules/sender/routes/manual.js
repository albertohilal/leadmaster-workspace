/**
 * ❌ ARCHIVO DEPRECADO - ELIMINADO EN TAREA 1
 * 
 * Este archivo violaba la política de estados y auditoría:
 * - Usaba tabla separada ll_envios_manual
 * - No pasaba por cambiarEstado()
 * - No generaba auditoría en ll_envios_whatsapp_historial
 * 
 * REEMPLAZADO POR:
 * - src/modules/sender/routes/envios.js
 *   GET /api/envios/:id/manual/prepare (TAREA 2)
 *   POST /api/envios/:id/manual/confirm (TAREA 3)
 * 
 * Este archivo se mantendrá temporalmente para documentación.
 */

// const express = require('express');
// const router = express.Router();
// const manualController = require('../controllers/manualController');

// router.post('/registro-manual', manualController.registrarEnvioManual);

// module.exports = router;
