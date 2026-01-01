const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticate, requireAdmin } = require('../../auth/middleware/authMiddleware');

// Admin-only endpoints
router.use(authenticate, requireAdmin);

router.get('/sessions', adminController.listSessions);
router.post('/admin/login', adminController.adminLogin);
router.post('/admin/logout', adminController.adminLogout);

module.exports = router;
