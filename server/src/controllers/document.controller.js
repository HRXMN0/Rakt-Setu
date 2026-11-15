const path = require('path');
const fs = require('fs');
const Document = require('../models/Document');
const User = require('../models/User');
const { uploadDir } = require('../middleware/upload.middleware');
const { successResponse, errorResponse } = require('../utils/responseHelper');
const { generateDocumentAccessToken, verifyDocumentAccessToken } = require('../utils/documentToken');

/**
 * Validates that targetPath is strictly contained inside uploadDir using path.relative().
 * Defends against prefix-collision paths (e.g., uploads-evil vs uploads) and directory traversal.
 */
const isContainedInUploads = (targetPath) => {
    const resolvedUploadDir = path.resolve(uploadDir);
    const resolvedTarget = path.resolve(targetPath);
    const relative = path.relative(resolvedUploadDir, resolvedTarget);
    return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
};

/**
 * Validates filename against application generated format: timestamp-hex.ext
 * Strictly rejects path separators, directory traversal sequences, null bytes, and non-alphanumeric chars.
 */
const isValidFilenameFormat = (filename) => {
    if (!filename || typeof filename !== 'string') return false;
    // Reject path separators, directory traversal sequences, or null bytes
    if (filename.includes('/') || filename.includes('\\') || filename.includes('..') || filename.includes('\0')) {
        return false;
    }
    // Application generated filename format: Date.now() - 16 hex chars . extension
    return /^\d{10,15}-[a-f0-9]{16}\.(jpg|jpeg|png|webp|pdf)$/i.test(filename);
};

/**
 * Upload Profile Photo for authenticated donor or staff
 */
const uploadProfilePhoto = async (req, res, next) => {
    try {
        if (!req.file) {
            return errorResponse(res, 400, 'Please select a photo to upload.');
        }

        const userId = req.user._id;
        const relativeUrl = `/api/donors/documents/file/${req.file.filename}`;

        // Update user profile photo
        await User.findByIdAndUpdate(userId, { profilePhoto: relativeUrl });

        // Save document metadata
        const doc = await Document.create({
            userId,
            ownerRole: req.user.role,
            documentType: 'PROFILE_PHOTO',
            originalName: req.file.originalname,
            filename: req.file.filename,
            filePath: req.file.path,
            mimeType: req.file.mimetype,
            fileSize: req.file.size,
            description: 'Profile avatar photograph'
        });

        return successResponse(res, 201, 'Profile photo uploaded successfully', {
            document: doc,
            photoUrl: relativeUrl
        });
    } catch (err) {
        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
            try { fs.unlinkSync(req.file.path); } catch (e) {}
        }
        next(err);
    }
};

/**
 * Upload Donor ID or Medical Verification Document
 */
const uploadDocument = async (req, res, next) => {
    try {
        if (!req.file) {
            return errorResponse(res, 400, 'Please select a document file to upload.');
        }

        const { documentType, description } = req.body;
        const userId = req.user._id;
        const defaultDocType = req.user.role === 'DONOR' ? 'DONOR_ID' : 'FACILITY_LICENSE';

        const doc = await Document.create({
            userId,
            ownerRole: req.user.role,
            documentType: documentType || defaultDocType,
            facilityId: req.user.hospitalId || req.user.bloodBankId || null,
            originalName: req.file.originalname,
            filename: req.file.filename,
            filePath: req.file.path,
            mimeType: req.file.mimetype,
            fileSize: req.file.size,
            description: description || (req.user.role === 'DONOR' ? 'Uploaded healthcare identification' : 'Facility regulatory certification')
        });

        return successResponse(res, 201, 'Document uploaded successfully', { document: doc });
    } catch (err) {
        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
            try { fs.unlinkSync(req.file.path); } catch (e) {}
        }
        next(err);
    }
};

/**
 * Get all documents for authenticated user
 */
const getMyDocuments = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const documents = await Document.find({ userId }).sort({ createdAt: -1 });

        return successResponse(res, 200, 'Documents retrieved', { documents });
    } catch (err) {
        next(err);
    }
};

/**
 * Generate a narrowly-scoped, short-lived, single-use document access token for URL-based viewing
 */
const createDocumentAccessToken = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { action = 'view' } = req.body || {};

        const doc = await Document.findById(id);
        if (!doc) {
            return errorResponse(res, 404, 'Document not found.');
        }

        // Ownership and Authorization Check
        const isOwner = doc.userId.toString() === req.user._id.toString() ||
            (doc.facilityId && req.user.hospitalId && doc.facilityId.toString() === req.user.hospitalId.toString());
        const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN';

        if (!isOwner && !isAdmin) {
            return errorResponse(res, 403, 'Forbidden: You do not have permission to generate access tokens for this document.');
        }

        const accessToken = generateDocumentAccessToken({
            documentId: doc._id,
            userId: req.user._id,
            action,
            expiresIn: '120s'
        });

        return successResponse(res, 200, 'Document access token generated', {
            accessToken,
            expiresInSeconds: 120,
            documentId: doc._id
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Download / Stream protected document with strict ownership or single-use access token verification
 */
const downloadDocument = async (req, res, next) => {
    try {
        const { id } = req.params;

        const doc = await Document.findById(id);
        if (!doc) {
            return errorResponse(res, 404, 'Document not found.');
        }

        // 1. Authorization: Either authenticated session OR valid single-use document token
        let authorized = false;

        // Check if single-use document access token is provided via query parameter
        if (req.query && req.query.accessToken) {
            try {
                verifyDocumentAccessToken(req.query.accessToken, doc._id, 'view');
                authorized = true;
            } catch (tokenErr) {
                return errorResponse(res, 403, `Document access token rejected: ${tokenErr.message}`);
            }
        }

        // Check ambient authenticated session if not already authorized by access token
        if (!authorized && req.user) {
            const isOwner = doc.userId.toString() === req.user._id.toString() ||
                (doc.facilityId && req.user.hospitalId && doc.facilityId.toString() === req.user.hospitalId.toString());
            const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN';
            if (isOwner || isAdmin) {
                authorized = true;
            }
        }

        if (!authorized) {
            return errorResponse(res, 403, 'Forbidden: You do not have permission to access another user\'s private documents.');
        }

        // 2. Validate filename format to prevent unexpected filesystem lookups
        const safeFilename = path.basename(doc.filename);
        if (!isValidFilenameFormat(safeFilename)) {
            return errorResponse(res, 400, 'Invalid document filename stored in database.');
        }

        // 3. Robust path.relative() containment validation to prevent traversal and prefix collision
        const safePath = path.resolve(uploadDir, safeFilename);
        if (!isContainedInUploads(safePath)) {
            return errorResponse(res, 400, 'Invalid file path: path containment violation.');
        }

        if (!fs.existsSync(safePath)) {
            return errorResponse(res, 404, 'Document physical file is missing from storage.');
        }

        res.setHeader('Content-Type', doc.mimeType);
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.originalName)}"`);

        const readStream = fs.createReadStream(safePath);
        readStream.pipe(res);
    } catch (err) {
        next(err);
    }
};

/**
 * Serve protected avatar/image file with filename validation and path containment
 */
const getFileByFilename = async (req, res, next) => {
    try {
        const { filename } = req.params;

        // 1. Strict filename character and format validation
        if (!isValidFilenameFormat(filename)) {
            return errorResponse(res, 400, 'Invalid filename format or illegal characters detected.');
        }

        const safeFilename = path.basename(filename);
        const safePath = path.resolve(uploadDir, safeFilename);

        // 2. Robust path.relative() containment validation
        if (!isContainedInUploads(safePath)) {
            return errorResponse(res, 400, 'Invalid file path: path containment violation.');
        }

        // 3. Authoritative check: Look up document in database first
        const doc = await Document.findOne({ filename: safeFilename });
        if (!doc) {
            return errorResponse(res, 404, 'Document record not found.');
        }

        // 4. Authorization check: Non-profile documents require authenticated owner/admin or access token
        if (doc.documentType !== 'PROFILE_PHOTO') {
            let authorized = false;

            if (req.query && req.query.accessToken) {
                try {
                    verifyDocumentAccessToken(req.query.accessToken, doc._id, 'view');
                    authorized = true;
                } catch (tokenErr) {
                    return errorResponse(res, 403, `Document access token rejected: ${tokenErr.message}`);
                }
            }

            if (!authorized && req.user) {
                const isOwner = doc.userId.toString() === req.user._id.toString() ||
                    (doc.facilityId && req.user.hospitalId && doc.facilityId.toString() === req.user.hospitalId.toString());
                const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN';
                if (isOwner || isAdmin) {
                    authorized = true;
                }
            }

            if (!authorized) {
                return errorResponse(res, req.user ? 403 : 401, 'Authentication or valid access token required to access private document.');
            }
        }

        // 5. Storage existence check
        if (!fs.existsSync(safePath)) {
            return errorResponse(res, 404, 'Document physical file is missing from storage.');
        }

        res.setHeader('Content-Type', doc.mimeType);
        fs.createReadStream(safePath).pipe(res);
    } catch (err) {
        next(err);
    }
};

/**
 * Delete a document
 */
const deleteDocument = async (req, res, next) => {
    try {
        const { id } = req.params;

        const doc = await Document.findById(id);
        if (!doc) {
            return errorResponse(res, 404, 'Document not found.');
        }

        // Ownership check
        const isOwner = doc.userId.toString() === req.user._id.toString();
        const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN';

        if (!isOwner && !isAdmin) {
            return errorResponse(res, 403, 'Forbidden: You cannot delete another user\'s document.');
        }

        // Remove from disk safely
        const safeFilename = path.basename(doc.filename);
        const safePath = path.resolve(uploadDir, safeFilename);
        if (isContainedInUploads(safePath) && fs.existsSync(safePath)) {
            try {
                fs.unlinkSync(safePath);
            } catch (e) {
                console.warn('[Doc Delete]: Could not unlink file:', e.message);
            }
        }

        // If this document was the user's active profile photo, reset it
        if (doc.documentType === 'PROFILE_PHOTO') {
            await User.findByIdAndUpdate(doc.userId, { profilePhoto: null });
        }

        await Document.findByIdAndDelete(id);

        return successResponse(res, 200, 'Document deleted successfully');
    } catch (err) {
        next(err);
    }
};

module.exports = {
    isContainedInUploads,
    isValidFilenameFormat,
    uploadProfilePhoto,
    uploadDocument,
    getMyDocuments,
    createDocumentAccessToken,
    downloadDocument,
    getFileByFilename,
    deleteDocument
};
