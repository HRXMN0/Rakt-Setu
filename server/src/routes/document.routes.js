const express = require('express');
const router = express.Router();
const documentController = require('../controllers/document.controller');
const { authenticateToken, optionalAuthenticate } = require('../middleware/auth.middleware');
const { handleUpload } = require('../middleware/upload.middleware');

// Public file retrieval for avatars / documents (with secure internal checks & access tokens)
router.get('/file/:filename', optionalAuthenticate, documentController.getFileByFilename);
router.get('/:id', optionalAuthenticate, documentController.downloadDocument);

// All subsequent routes require JWT authentication
router.use(authenticateToken);

// Universal document endpoints (usable across DONOR, HOSPITAL_STAFF, ADMIN, SUPER_ADMIN)
router.post('/', handleUpload('document', true), documentController.uploadDocument);
router.post('/upload', handleUpload('document', true), documentController.uploadDocument);
router.post('/photo', handleUpload('photo', true), documentController.uploadProfilePhoto);
router.get('/', documentController.getMyDocuments);
router.post('/:id/token', documentController.createDocumentAccessToken);
router.delete('/:id', documentController.deleteDocument);

module.exports = router;
