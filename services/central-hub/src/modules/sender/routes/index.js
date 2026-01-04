// Rutas principales migradas desde whatsapp-massive-sender-V2
const express = require('express');
const router = express.Router();
const { authenticate } = require('../../auth/middleware/authMiddleware');

// Todas las rutas de sender requieren autenticación
router.use(authenticate);

// Ejemplo de importación de controlador
// const campaniasController = require('../controllers/campaniasController');
// router.get('/campanias', campaniasController.listarCampanias);

// TODO: Migrar e importar todas las rutas y controladores reales

router.get('/status', (req, res) => {
  res.json({ status: 'sender module ok' });
});


// Nueva ruta modular para campañas
router.use('/campaigns', require('./campaigns'));
// Nueva ruta modular para mensajes
router.use('/messages', require('./messages'));
// Nueva ruta para envío directo vía session-manager (integración HTTP)
router.use('/', require('./sender.routes'));
// Nueva ruta modular para leads/lugares (multi-cliente)
router.use('/lugares', require('./lugares'));
// Nueva ruta modular para destinatarios
router.use('/destinatarios', require('./destinatarios'));
// Nueva ruta modular para prospectos
router.use('/prospectos', require('./prospectos'));

// Rutas legacy
router.use('/auth', require('./auth'));
router.use('/campanias', require('./campanias'));
router.use('/envios', require('./envios'));
// Programaciones de campañas (días, horarios, cupo)
router.use('/programaciones', require('./programaciones'));
router.use('/usuarios', require('./usuarios'));
router.use('/sesiones', require('./sesiones'));
router.use('/lugares', require('./lugares'));
router.use('/rubros', require('./rubros'));

module.exports = router;
