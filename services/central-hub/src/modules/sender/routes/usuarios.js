const express = require('express');
const router = express.Router();
const usuariosController = require('../controllers/usuariosController');

router.get('/status', usuariosController.status);
// Aquí se agregarán las rutas reales de usuarios

module.exports = router;
