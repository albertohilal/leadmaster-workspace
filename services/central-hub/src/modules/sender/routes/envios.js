const express = require('express');
const router = express.Router();
const enviosController = require('../controllers/enviosController');

// Health/status
router.get('/status', enviosController.status);

// Listar envíos (mock / legacy)
router.get('/', enviosController.list);

// TAREA 2: Preparar envío manual (obtener datos antes de abrir WhatsApp)
router.get('/:id/manual/prepare', enviosController.prepareManual);

// TAREA 3: Confirmar envío manual (operador confirma envío realizado)
router.post('/:id/manual/confirm', enviosController.confirmManual);

// OPS-POST-ENVÍO-01: Clasificación post-envío (auditable)
router.post('/:id/post-envio-clasificar', enviosController.clasificarPostEnvio);

// Reintentar envío en estado error (error → pendiente) con auditoría
router.post('/:id/reintentar', enviosController.reintentar);

module.exports = router;