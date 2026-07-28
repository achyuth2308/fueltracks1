/**
 * @file emailExample.routes.js
 * @description Example routes for testing the SendGrid email service.
 */

const express = require('express');
const router = express.Router();
const emailController = require('../controllers/emailExample.controller');

// POST /api/emails/test-otp
router.post('/test-otp', emailController.testOTPEmail);

// POST /api/emails/test-geofence
router.post('/test-geofence', emailController.testGeofenceAlert);

module.exports = router;
