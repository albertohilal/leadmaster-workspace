const express = require('express');
const router = express.Router();
const enviosController = require('../controllers/enviosController');


router.get('/status', enviosController.status);
// Listar envíos
router.get('/', enviosController.list);

// TAREA 2: Preparar envío manual (obtener datos antes de confirmar)
router.get('/:id/manual/prepare', enviosController.prepareManual);

// TAREA 3: Confirmar envío manual (cambiar estado a enviado)
router.post('/:id/manual/confirm', enviosController.confirmManual);

// TAREA: Reintentar envío en estado error (cambiar estado error→pendiente)
router.post('/:id/reintentar', enviosController.reintentar);

module.exports = router;
