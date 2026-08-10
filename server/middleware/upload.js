const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure committee uploads directory exists
const isVercel = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NOW_REGION;
const uploadDir = isVercel ? '/tmp/uploads' : path.join(__dirname, '../../public/uploads/committee');
if (!fs.existsSync(uploadDir)) {
  try {
    fs.mkdirSync(uploadDir, { recursive: true });
  } catch (e) {}
}

// Multer Memory Storage Configuration (Works in Vercel & Serverless environments)
const storage = multer.memoryStorage();

// File Filter for Image Files
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file format. Only JPG, PNG, WEBP, and GIF images are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Middleware wrapper to handle Multer upload errors cleanly
function handleCommitteePhotoUpload(req, res, next) {
  const singleUpload = upload.single('photo');
  singleUpload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: 'Image size exceeds maximum limit of 5MB.' });
      }
      return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
}

module.exports = {
  handleCommitteePhotoUpload
};
