const express = require('express');
const router = express.Router();
const enviosController = require('../controllers/enviosController');


router.get('/status', enviosController.status);
// Listar envíos
router.get('/', enviosController.list);

module.exports = router;
