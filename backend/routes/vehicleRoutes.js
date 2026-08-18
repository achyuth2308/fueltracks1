// ============================================================
// VEHICLE ROUTES
// ============================================================

const express = require('express');
const VehicleController = require('../controllers/vehicleController');
const GeofenceRouteController = require('../controllers/geofenceRouteController');
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

// Partial update for vehicle settings (overspeed limits, etc)
router.patch('/:id/settings', authorize('customer', 'superadmin', 'dealer'), VehicleController.updateVehicleSettings);
router.delete('/:id', authorize('superadmin'), VehicleController.deleteVehicle);
router.post('/:id/migrate', authorize('superadmin', 'dealer'), VehicleController.migrateVehicle);

// Analytics, History & Live Route
router.get('/:id/history', VehicleController.getVehicleHistory);
router.get('/:id/route', VehicleController.getVehicleRoute);
router.get('/:id/report', VehicleController.getVehicleReport);
router.get('/:id/alerts', VehicleController.getVehicleAlerts);
router.delete('/:id/alerts', VehicleController.clearVehicleAlerts);
router.get('/:id/messages', VehicleController.getVehicleMessages);

// Commands & Controls (Immobilizer / Relay)
router.post('/:id/immobilizer', VehicleController.toggleImmobilizer);

// ══════════════════════════════════════════════════════════
// ROUTE MANAGEMENT (accessible by all authenticated users including customers)
// Customers can set routes for their own vehicles and receive
// trip_started, route_deviation, and trip_ended alerts automatically.
// ══════════════════════════════════════════════════════════
router.get('/routes/list', GeofenceRouteController.getMyRoutes);
router.post('/routes/create', GeofenceRouteController.createMyRoute);
router.put('/routes/:id', GeofenceRouteController.updateMyRoute);
router.delete('/routes/:id', GeofenceRouteController.deleteMyRoute);
router.post('/routes/:id/assign', GeofenceRouteController.assignMyRoute);
router.get('/routes/:id/vehicles', GeofenceRouteController.getMyRouteVehicles);

module.exports = router;

