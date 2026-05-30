// ============================================================
// ADMIN & MANAGEMENT ROUTES
// ============================================================

const express = require('express');
const AdminController = require('../controllers/adminController');
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
router.post('/orgs', authorize('superadmin', 'dealer'), AdminController.createOrg);
router.put('/orgs/:id', authorize('superadmin', 'dealer'), AdminController.updateOrg);
router.delete('/orgs/:id', authorize('superadmin', 'dealer'), AdminController.deleteOrg);

// ============================================================
// USERS (Superadmin or Dealer for their subtree)
// ============================================================
router.get('/users', authorize('superadmin', 'dealer'), AdminController.getAllUsers);
router.post('/users', authorize('superadmin', 'dealer'), AdminController.createUser);
router.put('/users/:id', authorize('superadmin', 'dealer'), AdminController.updateUser);
router.delete('/users/:id', authorize('superadmin', 'dealer'), AdminController.deleteUser);

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

module.exports = router;
