const express = require('express');
const router = express.Router();
const hospitalController = require('../controllers/hospital.controller');
const documentController = require('../controllers/document.controller');
const { authenticateToken, optionalAuthenticate } = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');
const { handleUpload } = require('../middleware/upload.middleware');

// Public directory of facilities
router.get('/', hospitalController.getAllHospitals);
router.get('/network/emergency', hospitalController.getEmergencyNetworkStock);

// Protected facility document management (Hospital license, NABH accreditation, depot certificates)
router.post(
    '/documents',
    authenticateToken,
    authorizeRoles('HOSPITAL_STAFF', 'ADMIN', 'SUPER_ADMIN'),
    handleUpload('document', true),
    documentController.uploadDocument
);

router.get(
    '/documents',
    authenticateToken,
    authorizeRoles('HOSPITAL_STAFF', 'ADMIN', 'SUPER_ADMIN'),
    documentController.getMyDocuments
);

router.get(
    '/documents/file/:filename',
    optionalAuthenticate,
    documentController.getFileByFilename
);

router.get(
    '/documents/:id',
    authenticateToken,
    documentController.downloadDocument
);

router.post(
    '/documents/:id/token',
    authenticateToken,
    documentController.createDocumentAccessToken
);

router.delete(
    '/documents/:id',
    authenticateToken,
    documentController.deleteDocument
);

router.post(
    '/profile/photo',
    authenticateToken,
    handleUpload('photo', true),
    documentController.uploadProfilePhoto
);

router.get('/:id', hospitalController.getHospitalById);
router.put('/:id', authenticateToken, authorizeRoles('HOSPITAL_STAFF', 'ADMIN', 'SUPER_ADMIN'), hospitalController.updateHospital);

module.exports = router;

