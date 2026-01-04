const express = require('express');
const router = express.Router();
const sesionesController = require('../controllers/sesionesController');

router.get('/status', sesionesController.status);
// Aquí se agregarán las rutas reales de sesiones

module.exports = router;
