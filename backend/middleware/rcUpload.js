// ============================================================
// RC UPLOAD MIDDLEWARE
// ============================================================
// Secure, bounded disk upload middleware for RC front & back
// images with MIME type and file size validation.
// ============================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'rc');

// Ensure directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const fieldPrefix = file.fieldname === 'rcBack' ? 'rc_back' : 'rc_front';
    const uniqueId = crypto.randomBytes(6).toString('hex');
    const safeName = `${fieldPrefix}_${Date.now()}_${uniqueId}${ext}`;
    cb(null, safeName);
  }
});

const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

const fileFilter = (req, file, cb) => {
  if (allowedMimes.includes(file.mimetype.toLowerCase())) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid image type (${file.mimetype}). Allowed types: JPG, PNG, WEBP.`));
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max per image
    files: 2
  },
  fileFilter
}).fields([
  { name: 'rcFront', maxCount: 1 },
  { name: 'rcBack', maxCount: 1 }
]);

const uploadRcMiddleware = (req, res, next) => {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: 'Image file size exceeds limit. Maximum allowed size is 5MB per image.',
          code: 'FILE_TOO_LARGE'
        });
      }
      return res.status(400).json({
        success: false,
        error: err.message,
        code: 'UPLOAD_ERROR'
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        error: err.message,
        code: 'INVALID_FILE'
      });
    }
    next();
  });
};

module.exports = uploadRcMiddleware;

