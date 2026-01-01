const express = require('express');
const router = express.Router();
const campaniasController = require('../controllers/campaniasController');

router.get('/status', campaniasController.status);
// Aquí se agregarán las rutas reales de campañas

module.exports = router;
