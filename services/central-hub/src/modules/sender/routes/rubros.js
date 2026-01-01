const express = require('express');
const router = express.Router();
const rubrosController = require('../controllers/rubrosController');

router.get('/status', rubrosController.status);
// Aquí se agregarán las rutas reales de rubros

module.exports = router;
