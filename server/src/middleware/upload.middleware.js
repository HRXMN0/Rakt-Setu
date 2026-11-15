const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { errorResponse } = require('../utils/responseHelper');

// Ensure upload directory exists
const uploadDir = path.resolve(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Allowed MIME types and extensions
const ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/pjpeg',
    'image/png',
    'image/x-png',
    'image/webp',
    'application/pdf',
    'application/x-pdf'
];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];

// Configure Multer Disk Storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Prevent path traversal by extracting clean basename extension
        const rawExt = path.extname(file.originalname).toLowerCase();
        const safeExt = ALLOWED_EXTENSIONS.includes(rawExt) ? rawExt : '.bin';
        const randomHex = crypto.randomBytes(8).toString('hex');
        const uniqueName = `${Date.now()}-${randomHex}${safeExt}`;
        cb(null, uniqueName);
    }
});

// File filter for extension and MIME check
const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    // Check extension
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return cb(new Error(`Invalid file extension '${ext}'. Allowed types: JPEG, PNG, WEBP, PDF`), false);
    }

    // Check client-provided MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        return cb(new Error(`Invalid MIME type '${file.mimetype}'. Allowed: image/jpeg, image/png, image/webp, application/pdf`), false);
    }

    cb(null, true);
};

// Max 5MB file size limit
const maxFileSize = parseInt(process.env.MAX_FILE_SIZE_MB || '5', 10) * 1024 * 1024;

const upload = multer({
    storage,
    limits: {
        fileSize: maxFileSize,
        files: 1
    },
    fileFilter
});

/**
 * Validates file magic bytes to verify content authenticity
 */
const validateFileContentSignature = (filePath, mimeType) => {
    try {
        const buffer = Buffer.alloc(12);
        const fd = fs.openSync(filePath, 'r');
        fs.readSync(fd, buffer, 0, 12, 0);
        fs.closeSync(fd);

        // JPEG magic bytes: FF D8 FF
        if (mimeType === 'image/jpeg' || mimeType === 'image/jpg' || mimeType === 'image/pjpeg') {
            return buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
        }

        // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
        if (mimeType === 'image/png' || mimeType === 'image/x-png') {
            return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
        }

        // WEBP magic bytes: 'RIFF' .... 'WEBP'
        if (mimeType === 'image/webp') {
            const isRiff = buffer.toString('ascii', 0, 4) === 'RIFF';
            const isWebp = buffer.toString('ascii', 8, 12) === 'WEBP';
            return isRiff && isWebp;
        }

        // PDF magic bytes: %PDF (25 50 44 46)
        if (mimeType === 'application/pdf' || mimeType === 'application/x-pdf') {
            return buffer.toString('ascii', 0, 4) === '%PDF';
        }

        return false;
    } catch (err) {
        return false;
    }
};

/**
 * Wrapper middleware to handle Multer errors gracefully and normalize field names
 */
const handleUpload = (fieldName = 'document', required = true) => {
    // Configure flexible fields upload supporting designated field name as well as 'file', 'document', 'photo'
    const uploadMultiFields = upload.fields([
        { name: fieldName, maxCount: 1 },
        { name: 'document', maxCount: 1 },
        { name: 'file', maxCount: 1 },
        { name: 'photo', maxCount: 1 }
    ]);

    return (req, res, next) => {
        uploadMultiFields(req, res, (err) => {
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return errorResponse(res, 400, `File exceeds the maximum allowed size of ${process.env.MAX_FILE_SIZE_MB || '5'}MB.`);
                }
                return errorResponse(res, 400, `Upload error: ${err.message}`);
            } else if (err) {
                return errorResponse(res, 400, err.message);
            }

            // Normalize req.file from fields
            if (req.files) {
                if (req.files[fieldName] && req.files[fieldName][0]) {
                    req.file = req.files[fieldName][0];
                } else if (req.files['document'] && req.files['document'][0]) {
                    req.file = req.files['document'][0];
                } else if (req.files['file'] && req.files['file'][0]) {
                    req.file = req.files['file'][0];
                } else if (req.files['photo'] && req.files['photo'][0]) {
                    req.file = req.files['photo'][0];
                }
            }

            if (required && !req.file) {
                return errorResponse(res, 400, `Missing required file upload field '${fieldName}' (or 'file').`);
            }

            // If file was uploaded, perform content signature verification
            if (req.file) {
                const isValidSignature = validateFileContentSignature(req.file.path, req.file.mimetype);
                if (!isValidSignature) {
                    // Delete fake/corrupted file
                    try { fs.unlinkSync(req.file.path); } catch (e) {}
                    return errorResponse(res, 400, 'File content signature does not match the declared file extension or MIME type.');
                }
            }

            next();
        });
    };
};

module.exports = {
    handleUpload,
    uploadDir,
    ALLOWED_EXTENSIONS,
    ALLOWED_MIME_TYPES
};

