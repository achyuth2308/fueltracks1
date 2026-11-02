// ============================================================
// ADMIN & MANAGEMENT ROUTES
// ============================================================

const express = require('express');
const AdminController = require('../controllers/adminController');
const OnboardController = require('../controllers/OnboardController');
const DeviceInventoryController = require('../controllers/DeviceInventoryController');
const GeofenceRouteController = require('../controllers/geofenceRouteController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

const router = express.Router();

// Apply auth to all admin routes
router.use(authenticate);

// ============================================================
// ORGANIZATIONS (Superadmin only or Dealer for their child orgs)
// ============================================================
router.get('/orgs', authorize('superadmin', 'dealer'), AdminController.getAllOrgs);
router.get('/orgs/:id', authorize('superadmin', 'dealer'), AdminController.getOrgById);
router.get('/orgs/:id/resources', authorize('superadmin', 'dealer'), AdminController.getOrgResources);
router.post('/orgs', authorize('superadmin', 'dealer'), AdminController.createOrg);
router.get('/orgs/:id/site-notifications', authorize('superadmin', 'dealer'), AdminController.getOrgSiteNotifications);
router.put('/orgs/:id/site-notifications', authorize('superadmin', 'dealer'), AdminController.updateOrgSiteNotifications);
router.post('/orgs/:id/sites', authorize('superadmin', 'dealer'), AdminController.createOrgSite);
router.get('/orgs/:id/tracks', authorize('superadmin', 'dealer'), AdminController.getOrgTracks);
router.post('/orgs/:id/tracks', authorize('superadmin', 'dealer'), AdminController.createOrgTrack);
router.delete('/orgs/:id/tracks/:trackId', authorize('superadmin', 'dealer'), AdminController.deleteOrgTrack);
router.put('/orgs/:id', authorize('superadmin', 'dealer'), AdminController.updateOrg);
router.delete('/orgs/:id', authorize('superadmin', 'dealer'), AdminController.deleteOrg);

// ============================================================
// USERS (Superadmin or Dealer for their subtree)
// ============================================================
router.get('/users', authorize('superadmin', 'dealer'), AdminController.getAllUsers);
router.post('/users', authorize('superadmin', 'dealer'), AdminController.createUser);
router.post('/users/:id/send-whatsapp-template', authorize('superadmin', 'dealer'), AdminController.sendUserCredentialsWhatsApp);
router.put('/users/:id', authorize('superadmin', 'dealer'), AdminController.updateUser);
router.delete('/users/:id', authorize('superadmin', 'dealer'), AdminController.deleteUser);
router.get('/users/:id/vehicles', authorize('superadmin', 'dealer'), AdminController.getUserVehicles);
router.post('/users/:id/impersonate', authorize('superadmin', 'dealer'), AdminController.impersonateUser);

// ============================================================
// GROUPS (Sub-tenant tagging units)
// ============================================================
router.get('/groups', AdminController.getAllGroups);
router.post('/groups', authorize('superadmin', 'dealer'), AdminController.createGroup);
router.put('/groups/:id', authorize('superadmin', 'dealer'), AdminController.updateGroup);
router.delete('/groups/:id', authorize('superadmin', 'dealer'), AdminController.deleteGroup);

// ============================================================
// STATS SUMMARY (Dashboard counts)
// ============================================================
router.get('/dashboard/stats', AdminController.getDashboardStats);

// ============================================================
// ALERTS
// ============================================================
router.get('/alerts/recent', AdminController.getRecentAlerts);

// ============================================================
// ONBOARDING & DEVICES
// ============================================================
router.get('/devices', authorize('superadmin', 'dealer'), AdminController.getDevices);
router.delete('/devices/:id', authorize('superadmin', 'dealer'), AdminController.deleteDevice);
router.post('/onboard/devices', authorize('superadmin', 'dealer'), OnboardController.onboardDevices);
router.post('/onboard/bulk-excel', authorize('superadmin', 'dealer'), OnboardController.bulkOnboardExcel);

// Device Inventory Master Routes (Hardware Stock Lookup & Import)
router.get('/device-inventory/lookup', DeviceInventoryController.lookupByImei);
router.post('/device-inventory/bulk-import', authorize('superadmin', 'dealer'), DeviceInventoryController.bulkImport);
router.get('/device-inventory', authorize('superadmin', 'dealer'), DeviceInventoryController.listInventory);

// ============================================================
// BILLING
// ============================================================
router.get('/billing/expired', authorize('superadmin', 'dealer'), AdminController.getExpiredBillingLicenses);
router.post('/billing/set-vehicle-amount', authorize('superadmin', 'dealer'), AdminController.setVehicleBillingAmount);


// ============================================================
// DEVICE QUOTA (tier-based limits per dealer org)
// ============================================================
router.get('/device-quota', authorize('superadmin', 'dealer'), AdminController.getDeviceQuota);
router.patch('/orgs/:id/device-limits', authorize('superadmin'), AdminController.setDeviceLimits);

// ============================================================
// RENEWALS CONFIG
// ============================================================
router.get('/renewal-plans', authorize('superadmin', 'dealer'), AdminController.getRenewalPlans);
router.post('/renewal-plans', authorize('superadmin', 'dealer'), AdminController.createRenewalPlan);
router.put('/renewal-plans/:id', authorize('superadmin', 'dealer'), AdminController.updateRenewalPlan);
router.delete('/renewal-plans/:id', authorize('superadmin', 'dealer'), AdminController.deleteRenewalPlan);
router.get('/renewal-transactions', authorize('superadmin', 'dealer'), AdminController.getRenewalTransactions);

// ============================================================
// GEOFENCES
// ============================================================
router.get('/geofences', GeofenceRouteController.getGeofences);
router.post('/geofences', GeofenceRouteController.createGeofence);
router.put('/geofences/:id', GeofenceRouteController.updateGeofence);
router.delete('/geofences/:id', GeofenceRouteController.deleteGeofence);
router.post('/geofences/:id/assign', GeofenceRouteController.assignGeofence);
router.get('/geofences/:id/vehicles', GeofenceRouteController.getGeofenceVehicles);

// ============================================================
// ROUTES
// ============================================================
router.get('/routes', GeofenceRouteController.getRoutes);
router.post('/routes', GeofenceRouteController.createRoute);
router.put('/routes/:id', GeofenceRouteController.updateRoute);
router.delete('/routes/:id', GeofenceRouteController.deleteRoute);
router.post('/routes/:id/assign', GeofenceRouteController.assignRoute);
router.get('/routes/:id/vehicles', GeofenceRouteController.getRouteVehicles);

module.exports = router;
