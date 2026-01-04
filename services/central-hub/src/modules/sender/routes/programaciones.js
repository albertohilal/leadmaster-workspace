// Rutas para gestionar la programación de campañas
const express = require('express');
const router = express.Router();
const programacionesController = require('../controllers/programacionesController');

// Listar programaciones
router.get('/', programacionesController.listarProgramaciones);

// Crear programación
router.post('/', programacionesController.crearProgramacion);

module.exports = router;
