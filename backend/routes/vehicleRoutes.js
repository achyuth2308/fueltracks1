// ============================================================
// VEHICLE ROUTES
// ============================================================

const express = require('express');
const VehicleController = require('../controllers/vehicleController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

const router = express.Router();

// Apply auth to all vehicle routes
router.use(authenticate);

// CRUD
router.get('/', VehicleController.getAllVehicles);
router.get('/:id', VehicleController.getVehicleById);
router.post('/', authorize('superadmin', 'dealer'), VehicleController.createVehicle);
router.put('/:id', authorize('superadmin', 'dealer'), VehicleController.updateVehicle);
router.delete('/:id', authorize('superadmin'), VehicleController.deleteVehicle);
router.post('/:id/migrate', authorize('superadmin', 'dealer'), VehicleController.migrateVehicle);

// Analytics, History & Live Route
router.get('/:id/history', VehicleController.getVehicleHistory);
router.get('/:id/route', VehicleController.getVehicleRoute);
router.get('/:id/report', VehicleController.getVehicleReport);
router.get('/:id/alerts', VehicleController.getVehicleAlerts);
router.get('/:id/messages', VehicleController.getVehicleMessages);

module.exports = router;
