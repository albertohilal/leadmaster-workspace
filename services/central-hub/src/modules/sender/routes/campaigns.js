const express = require('express');
const router = express.Router();
const campaignsController = require('../controllers/campaignsController');



router.get('/', campaignsController.list);
// Crear campaña
router.post('/', campaignsController.create);
// Aprobar campaña (solo admin)
router.post('/:id/approve', campaignsController.approve);
// Detalle de campaña
router.get('/:id', campaignsController.detail);
// Editar campaña
router.put('/:id', campaignsController.update);
// Eliminar campaña
router.delete('/:id', campaignsController.remove);

module.exports = router;
