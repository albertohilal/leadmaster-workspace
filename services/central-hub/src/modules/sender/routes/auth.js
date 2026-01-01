// Rutas de autenticación migradas desde whatsapp-massive-sender-V2
const express = require('express');
const router = express.Router();

// TODO: Importar y adaptar controladores reales
// const authController = require('../controllers/authController');
// router.post('/login', authController.login);
// router.post('/logout', authController.logout);

router.get('/status', (req, res) => {
  res.json({ status: 'auth ok' });
});

module.exports = router;
