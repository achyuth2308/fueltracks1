// ============================================================
// MINING REGISTRATION CONTROLLER
// Handles multi-step form submissions, file uploads, validation,
// email confirmations, and back-office management.
// ============================================================

const path = require('path');
const fs = require('fs');
const multer = require('multer');
const MiningRegistrationModel = require('../models/miningRegistrationModel');
const UserModel = require('../models/userModel');
const EmailService = require('../services/emailService');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../uploads/mining_registrations');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const sanitizedExt = path.extname(file.originalname).toLowerCase();
    cb(null, `${file.fieldname}-${uniqueSuffix}${sanitizedExt}`);
  }
});

// File validation filter: max 10MB, images + pdf
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'application/pdf'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type (${file.mimetype}) for ${file.fieldname}. Allowed types: JPG, PNG, WEBP, and PDF.`));
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter
}).fields([
  { name: 'vehicle_number_photo', maxCount: 1 },
  { name: 'rc_copy_photo', maxCount: 1 },
  { name: 'aadhar_copy_photo', maxCount: 1 }
]);

/**
 * Validate field formats
 */
function validateRegistrationPayload(body, files = {}) {
  const errors = [];

  const {
    asm_tsl_phone,
    device_model,
    vehicle_number,
    imei_number,
    engine_number,
    chassis_number,
    manufacturing_year,
    vehicle_manufacturer,
    customer_name,
    customer_phone,
    fo_address,
    aadhar_number,
    installer_name,
    request_type
  } = body;

  // Basic required fields
  if (!asm_tsl_phone || !/^\d{10}$/.test(String(asm_tsl_phone).trim())) {
    errors.push('ASM / TSL Phone No. must be a valid 10-digit number.');
  }

  if (!device_model || String(device_model).trim() === '') {
    errors.push('Device Model is required.');
  }

  if (!vehicle_number || String(vehicle_number).trim() === '') {
    errors.push('Vehicle Number is required.');
  } else {
    // Normalise & validate Indian vehicle registration formats
    const cleanVeh = String(vehicle_number).replace(/[\s-]/g, '').toUpperCase();
    if (!/^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$/.test(cleanVeh) && cleanVeh.length < 5) {
      errors.push('Please enter a valid Vehicle Registration Number (e.g. DL01AB1234 or TS08XY5678).');
    }
  }

  if (imei_number && String(imei_number).trim() !== '') {
    const cleanImei = String(imei_number).trim();
    if (!/^\d{15}$/.test(cleanImei)) {
      errors.push('IMEI Number must be exactly 15 numeric digits if provided.');
    }
  }

  if (!engine_number || String(engine_number).trim() === '') {
    errors.push('Engine Number is required.');
  }

  if (!chassis_number || String(chassis_number).trim() === '') {
    errors.push('Chassis Number is required.');
  }

  const currentYear = new Date().getFullYear();
  const yearNum = parseInt(manufacturing_year, 10);
  if (isNaN(yearNum) || yearNum < 1980 || yearNum > currentYear + 1) {
    errors.push(`Vehicle Manufacturing Year must be a 4-digit year between 1980 and ${currentYear + 1}.`);
  }

  if (!vehicle_manufacturer || String(vehicle_manufacturer).trim() === '') {
    errors.push('Vehicle Manufacturer is required.');
  }

  if (!customer_name || String(customer_name).trim() === '') {
    errors.push('Customer Name is required.');
  }

  if (!customer_phone || !/^\d{10}$/.test(String(customer_phone).trim())) {
    errors.push('Customer Phone No. must be a valid 10-digit number.');
  }

  if (!fo_address || String(fo_address).trim().length < 5) {
    errors.push("FO's Address (as on Aadhar card) is required (minimum 5 characters).");
  }

  if (!aadhar_number || !/^\d{12}$/.test(String(aadhar_number).replace(/\s/g, ''))) {
    errors.push('Aadhar Number must be a valid 12-digit number.');
  }

  if (!installer_name || String(installer_name).trim() === '') {
    errors.push('Installer Name is required.');
  }

  if (!request_type || String(request_type).trim() === '') {
    errors.push('Request Type is required.');
  }

  // File uploads check
  if (!files.vehicle_number_photo || files.vehicle_number_photo.length === 0) {
    errors.push('Vehicle Number Photo is required.');
  }
  if (!files.rc_copy_photo || files.rc_copy_photo.length === 0) {
    errors.push('RC Copy Photo is required.');
  }
  if (!files.aadhar_copy_photo || files.aadhar_copy_photo.length === 0) {
    errors.push('Aadhar Copy Photo is required.');
  }

  return errors;
}

const MiningRegistrationController = {
  /**
   * Middleware for handling multipart uploads
   */
  uploadMiddleware: (req, res, next) => {
    upload(req, res, function (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            error: 'File size limit exceeded. Each file must be under 10MB.'
          });
        }
        return res.status(400).json({ success: false, error: err.message });
      } else if (err) {
        return res.status(400).json({ success: false, error: err.message });
      }
      next();
    });
  },

  /**
   * Submit new registration
   */
  async submit(req, res) {
    try {
      const files = req.files || {};
      const validationErrors = validateRegistrationPayload(req.body, files);

      if (validationErrors.length > 0) {
        // Remove uploaded files if validation failed to avoid orphaned disk files
        Object.values(files).forEach((fileArr) => {
          fileArr.forEach((file) => {
            if (fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
            }
          });
        });

        return res.status(400).json({
          success: false,
          error: validationErrors[0],
          allErrors: validationErrors
        });
      }

      // Extract user metadata from authenticated session
      const user = req.user || {};
      let submittedByEmail = user.email || req.body.submitted_by_email;

      if (!submittedByEmail && user.id) {
        const dbUser = await UserModel.findById(user.id);
        if (dbUser) {
          submittedByEmail = dbUser.email;
        }
      }

      if (!submittedByEmail) {
        return res.status(400).json({
          success: false,
          error: 'Submitter email could not be resolved from your logged-in session.'
        });
      }

      // Generate accessible relative URLs
      const vehicleNumberPhotoUrl = `/uploads/mining_registrations/${files.vehicle_number_photo[0].filename}`;
      const rcCopyPhotoUrl = `/uploads/mining_registrations/${files.rc_copy_photo[0].filename}`;
      const aadharCopyPhotoUrl = `/uploads/mining_registrations/${files.aadhar_copy_photo[0].filename}`;

      const registrationData = {
        org_id: user.org_id || null,
        user_id: user.id || null,
        asm_tsl_phone: String(req.body.asm_tsl_phone).trim(),
        device_model: String(req.body.device_model).trim(),
        vehicle_number: String(req.body.vehicle_number).replace(/[\s-]/g, '').toUpperCase(),
        imei_number: req.body.imei_number ? String(req.body.imei_number).trim() : null,
        engine_number: String(req.body.engine_number).trim(),
        chassis_number: String(req.body.chassis_number).trim(),
        manufacturing_year: parseInt(req.body.manufacturing_year, 10),
        vehicle_manufacturer: String(req.body.vehicle_manufacturer).trim(),
        customer_name: String(req.body.customer_name).trim(),
        customer_phone: String(req.body.customer_phone).trim(),
        fo_address: String(req.body.fo_address).trim(),
        aadhar_number: String(req.body.aadhar_number).replace(/\s/g, '').trim(),
        vehicle_number_photo_url: vehicleNumberPhotoUrl,
        rc_copy_photo_url: rcCopyPhotoUrl,
        aadhar_copy_photo_url: aadharCopyPhotoUrl,
        installer_name: String(req.body.installer_name).trim(),
        request_type: String(req.body.request_type).trim(),
        submitted_by_email: submittedByEmail,
        send_email_copy: req.body.send_email_copy === 'true' || req.body.send_email_copy === true,
        status: 'PENDING'
      };

      const record = await MiningRegistrationModel.create(registrationData);

      // Trigger email copy asynchronously if requested
      if (registrationData.send_email_copy) {
        EmailService.sendMiningRegistrationConfirmation(submittedByEmail, record).catch(err => {
          console.error('[MiningRegistrationController] Async confirmation email failed:', err);
        });
      }

      return res.status(201).json({
        success: true,
        message: 'Vehicle & Mining Registration submitted successfully!',
        data: record
      });
    } catch (err) {
      console.error('[MiningRegistrationController] Submit error:', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to save registration. ' + err.message
      });
    }
  },

  /**
   * Get all registrations with search & filters
   */
  async getAll(req, res) {
    try {
      const user = req.user;
      const {
        status,
        requestType,
        search,
        page = 1,
        limit = 20,
        sortBy = 'created_at',
        sortOrder = 'DESC'
      } = req.query;

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const offset = (pageNum - 1) * limitNum;

      const result = await MiningRegistrationModel.findAll({
        orgId: user.org_id,
        userId: user.id,
        role: user.role,
        status,
        requestType,
        search,
        limit: limitNum,
        offset,
        sortBy,
        sortOrder
      });

      return res.json({
        success: true,
        data: result.registrations,
        pagination: {
          total: result.total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(result.total / limitNum)
        }
      });
    } catch (err) {
      console.error('[MiningRegistrationController] getAll error:', err);
      return res.status(500).json({ success: false, error: 'Failed to retrieve registrations' });
    }
  },

  /**
   * Get single registration by ID
   */
  async getById(req, res) {
    try {
      const { id } = req.params;
      const record = await MiningRegistrationModel.findById(id);

      if (!record) {
        return res.status(404).json({ success: false, error: 'Registration record not found' });
      }

      // Check tenant permissions
      const user = req.user;
      if (user.role === 'customer' && record.user_id !== user.id) {
        return res.status(403).json({ success: false, error: 'Unauthorized access to this registration' });
      }
      if (user.role === 'dealer' && record.org_id !== user.org_id) {
        return res.status(403).json({ success: false, error: 'Unauthorized access to this registration' });
      }

      return res.json({ success: true, data: record });
    } catch (err) {
      console.error('[MiningRegistrationController] getById error:', err);
      return res.status(500).json({ success: false, error: 'Failed to fetch registration details' });
    }
  },

  /**
   * Update status & notes (Admin / Dealer only)
   */
  async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, admin_notes } = req.body;

      const allowedStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'IN_REVIEW'];
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: `Invalid status. Allowed values: ${allowedStatuses.join(', ')}`
        });
      }

      const existing = await MiningRegistrationModel.findById(id);
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Registration record not found' });
      }

      const updated = await MiningRegistrationModel.updateStatus(id, status, admin_notes);

      return res.json({
        success: true,
        message: `Registration status updated to ${status}`,
        data: updated
      });
    } catch (err) {
      console.error('[MiningRegistrationController] updateStatus error:', err);
      return res.status(500).json({ success: false, error: 'Failed to update registration status' });
    }
  },

  /**
   * Delete registration
   */
  async deleteRegistration(req, res) {
    try {
      const { id } = req.params;
      const existing = await MiningRegistrationModel.findById(id);
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Registration not found' });
      }

      // Delete associated physical files if they exist
      const fileUrls = [
        existing.vehicle_number_photo_url,
        existing.rc_copy_photo_url,
        existing.aadhar_copy_photo_url
      ];

      fileUrls.forEach(url => {
        if (url && url.startsWith('/uploads/mining_registrations/')) {
          const filename = path.basename(url);
          const fullPath = path.join(uploadDir, filename);
          if (fs.existsSync(fullPath)) {
            try { fs.unlinkSync(fullPath); } catch (_) {}
          }
        }
      });

      await MiningRegistrationModel.deleteById(id);

      return res.json({ success: true, message: 'Registration deleted successfully' });
    } catch (err) {
      console.error('[MiningRegistrationController] delete error:', err);
      return res.status(500).json({ success: false, error: 'Failed to delete registration' });
    }
  },

  /**
   * Export registrations to CSV
   */
  async exportCsv(req, res) {
    try {
      const user = req.user;
      const { status, requestType, search } = req.query;

      const result = await MiningRegistrationModel.exportAll({
        orgId: user.org_id,
        userId: user.id,
        role: user.role,
        status,
        requestType,
        search
      });

      const records = result.registrations || [];

      // Build CSV header and rows
      const headers = [
        'ID',
        'Status',
        'Submission Date',
        'Vehicle Number',
        'Device Model',
        'IMEI Number',
        'Engine Number',
        'Chassis Number',
        'Mfg Year',
        'Manufacturer',
        'Customer Name',
        'Customer Phone',
        'ASM/TSL Phone',
        'Installer Name',
        'Request Type',
        'FO Address',
        'Aadhar Number',
        'Submitted By Email',
        'Vehicle Photo URL',
        'RC Copy URL',
        'Aadhar Copy URL',
        'Admin Notes'
      ];

      const csvRows = [headers.join(',')];

      records.forEach(r => {
        const row = [
          `"${r.id || ''}"`,
          `"${r.status || ''}"`,
          `"${r.created_at ? new Date(r.created_at).toISOString() : ''}"`,
          `"${r.vehicle_number || ''}"`,
          `"${r.device_model || ''}"`,
          `"${r.imei_number || ''}"`,
          `"${r.engine_number || ''}"`,
          `"${r.chassis_number || ''}"`,
          `"${r.manufacturing_year || ''}"`,
          `"${(r.vehicle_manufacturer || '').replace(/"/g, '""')}"`,
          `"${(r.customer_name || '').replace(/"/g, '""')}"`,
          `"${r.customer_phone || ''}"`,
          `"${r.asm_tsl_phone || ''}"`,
          `"${(r.installer_name || '').replace(/"/g, '""')}"`,
          `"${r.request_type || ''}"`,
          `"${(r.fo_address || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
          `"XXXX-XXXX-${(r.aadhar_number || '').slice(-4)}"`,
          `"${r.submitted_by_email || ''}"`,
          `"${r.vehicle_number_photo_url || ''}"`,
          `"${r.rc_copy_photo_url || ''}"`,
          `"${r.aadhar_copy_photo_url || ''}"`,
          `"${(r.admin_notes || '').replace(/"/g, '""')}"`
        ];
        csvRows.push(row.join(','));
      });

      const csvContent = csvRows.join('\r\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="mining_registrations_${Date.now()}.csv"`);
      return res.status(200).send(csvContent);
    } catch (err) {
      console.error('[MiningRegistrationController] exportCsv error:', err);
      return res.status(500).json({ success: false, error: 'Failed to export registrations CSV' });
    }
  },

  /**
   * Google Form & Google Apps Script Webhook receiver
   * Automatically ingests responses submitted to Google Forms
   */
  async handleGoogleFormWebhook(req, res) {
    try {
      const payload = req.body || {};
      console.log('[GoogleFormWebhook] Received submission payload:', JSON.stringify(payload).slice(0, 300));

      // Helper function to match keys regardless of punctuation, case, or formatting
      const findValue = (possibleMatches, fallback = '') => {
        const payloadKeys = Object.keys(payload);
        for (const target of possibleMatches) {
          // Exact match
          if (payload[target] !== undefined && payload[target] !== null && String(payload[target]).trim() !== '') {
            return String(payload[target]).trim();
          }
          // Case-insensitive match
          const matchedKey = payloadKeys.find(k => k.trim().toLowerCase() === target.toLowerCase());
          if (matchedKey && payload[matchedKey] !== undefined && payload[matchedKey] !== null) {
            return String(payload[matchedKey]).trim();
          }
          // Substring match
          const partialKey = payloadKeys.find(k => k.toLowerCase().includes(target.toLowerCase()));
          if (partialKey && payload[partialKey] !== undefined && payload[partialKey] !== null) {
            return String(payload[partialKey]).trim();
          }
        }
        return fallback;
      };

      const submitted_by_email = findValue(['submitted_by_email', 'Email Address', 'Email', 'respondent_email', 'user_email'], 'technician@fueltracks.in');
      const asm_tsl_phone = findValue(['asm_tsl_phone', 'ASM / TSL Phone No.', 'ASM Phone', 'TSL Phone', 'Phone'], '9999999999');
      const device_model = findValue(['device_model', 'Device Model', 'Model', 'Device Type'], 'Roadpoint');
      const vehicle_number = findValue(['vehicle_number', 'Vehicle Number', 'Vehicle No', 'Registration No', 'Reg No', 'Registration Number'], '').replace(/[\s-]/g, '').toUpperCase();
      const imei_number = findValue(['imei_number', 'IMEI Number', 'IMEI', 'Device ID', 'VLTD SLNO'], null);
      const engine_number = findValue(['engine_number', 'Engine Number', 'Engine No'], 'ENG' + Math.floor(100000 + Math.random() * 900000));
      const chassis_number = findValue(['chassis_number', 'Chassis Number', 'Chassis No'], 'CHS' + Math.floor(100000 + Math.random() * 900000));
      const manufacturing_year = parseInt(findValue(['manufacturing_year', 'Vehicle Manufacturing Year', 'Manufacturing Year', 'Mfg Year', 'Year'], new Date().getFullYear().toString()), 10) || new Date().getFullYear();
      const vehicle_manufacturer = findValue(['vehicle_manufacturer', 'Vehicle Manufacturer', 'Manufacturer', 'Make'], 'Tata Motors');
      const customer_name = findValue(['customer_name', 'Customer Name', 'Owner Name', 'Name', 'Customer'], 'Valued Client');
      const customer_phone = findValue(['customer_phone', 'Customer Phone No.', 'Customer Mobile', 'Customer Phone', 'Mobile'], '9999999999');
      const fo_address = findValue(["fo_address", "FO's Address (as on Aadhar card)", "FO Address", "Address"], 'N/A');
      const aadhar_number = findValue(['aadhar_number', 'Aadhar Number', 'Aadhar', 'UID'], '000000000000');
      const vehicle_number_photo_url = findValue(['vehicle_number_photo_url', 'Vehicle Number Photo', 'Vehicle Photo', 'Plate Photo', 'Photo of Vehicle'], '/uploads/mining_registrations/google_form_doc.png');
      const rc_copy_photo_url = findValue(['rc_copy_photo_url', 'RC Copy Photo', 'RC Photo', 'RC Copy', 'Registration Certificate'], '/uploads/mining_registrations/google_form_doc.png');
      const aadhar_copy_photo_url = findValue(['aadhar_copy_photo_url', 'Aadhar Copy Photo', 'Aadhar Photo', 'Aadhar Copy', 'Aadhar Card'], '/uploads/mining_registrations/google_form_doc.png');
      const installer_name = findValue(['installer_name', 'Installer Name', 'Technician Name', 'Service Engineer', 'Installer'], 'Field Technician');
      const request_type = findValue(['request_type', 'Request Type', 'Type of Request'], 'New Installation');

      if (!vehicle_number) {
        return res.status(400).json({
          success: false,
          error: 'Vehicle Number is required to record Google Form registration'
        });
      }

      const registrationData = {
        org_id: null,
        user_id: null,
        asm_tsl_phone,
        device_model,
        vehicle_number,
        imei_number: imei_number || null,
        engine_number,
        chassis_number,
        manufacturing_year,
        vehicle_manufacturer,
        customer_name,
        customer_phone,
        fo_address,
        aadhar_number,
        vehicle_number_photo_url,
        rc_copy_photo_url,
        aadhar_copy_photo_url,
        installer_name,
        request_type,
        submitted_by_email,
        send_email_copy: true,
        status: 'PENDING'
      };

      const record = await MiningRegistrationModel.create(registrationData);
      console.log('[GoogleFormWebhook] Successfully created registration from Google Form:', record.id, record.vehicle_number);

      // Trigger email copy asynchronously
      if (submitted_by_email && submitted_by_email.includes('@')) {
        EmailService.sendMiningRegistrationConfirmation(submitted_by_email, record).catch(err => {
          console.error('[GoogleFormWebhook] Confirmation email failed:', err);
        });
      }

      return res.status(201).json({
        success: true,
        message: 'Google Form submission ingested successfully into FuelTracks Admin Panel!',
        data: record
      });
    } catch (err) {
      console.error('[GoogleFormWebhook] Ingestion error:', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to process Google Form submission: ' + err.message
      });
    }
  }
};

module.exports = MiningRegistrationController;
