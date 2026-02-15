/**
 * ❌ CONTROLADOR DEPRECADO - ELIMINADO EN TAREA 1
 * 
 * Este controlador violaba la política de estados y auditoría:
 * - Guardaba en tabla separada ll_envios_manual (fuera del flujo principal)
 * - No usaba ll_envios_whatsapp
 * - No generaba auditoría en ll_envios_whatsapp_historial
 * - No pasaba por cambiarEstado()
 * 
 * REEMPLAZADO POR:
 * - src/modules/sender/controllers/enviosController.js
 *   prepararEnvioManual() (TAREA 2)
 *   confirmarEnvioManual() (TAREA 3)
 * 
 * Este archivo se mantendrá temporalmente para documentación.
 */

// const db = require('../../../config/db');

// const manualController = {
//   async registrarEnvioManual(req, res) {
//     // ... código deprecado
//   }
// };

// module.exports = manualController;

module.exports = {};
