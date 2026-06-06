const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const { authenticate } = require('../../../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../../../../backend/uploads/profile');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg', 'image/svg+xml'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, JPG, and SVG are allowed.'));
  }
};

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: fileFilter 
});

// Apply auth middleware to all profile routes
router.use(authenticate);

// Profile data
router.get('/', (req, res, next) => profileController.getProfile(req, res, next));
router.put('/', (req, res, next) => profileController.updateProfile(req, res, next));

// Image uploads
router.post('/logo', upload.single('logo'), (req, res, next) => profileController.uploadLogo(req, res, next));
router.post('/favicon', upload.single('favicon'), (req, res, next) => profileController.uploadFavicon(req, res, next));
router.post('/background', upload.single('background'), (req, res, next) => profileController.uploadBackground(req, res, next));

// Security
router.post('/change-password', (req, res, next) => profileController.changePassword(req, res, next));

// Audit
router.get('/audit', (req, res, next) => profileController.getAuditHistory(req, res, next));

module.exports = router;
