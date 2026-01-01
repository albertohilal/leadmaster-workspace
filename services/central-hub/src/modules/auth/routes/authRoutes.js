// auth/routes/authRoutes.js - Rutas de autenticación
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');

// Rutas públicas
router.post('/login', authController.login.bind(authController));
router.post('/verify', authController.verify.bind(authController));

// Rutas protegidas
router.post('/logout', authenticate, authController.logout.bind(authController));
router.post('/change-password', authenticate, authController.changePassword.bind(authController));
router.get('/me', authenticate, authController.me.bind(authController));

module.exports = router;
