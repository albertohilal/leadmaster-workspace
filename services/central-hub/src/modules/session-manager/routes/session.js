const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/sessionController');
const { authenticate } = require('../../auth/middleware/authMiddleware');

// Todas las rutas de sesión requieren autenticación
router.use(authenticate);

router.get('/status', sessionController.status);
router.post('/login', sessionController.login);
router.post('/logout', sessionController.logout);
router.get('/state', sessionController.state);
router.get('/qr', sessionController.qr);

module.exports = router;
