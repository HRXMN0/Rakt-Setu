const express = require('express');
const router = express.Router();
const donorController = require('../controllers/donor.controller');
const documentController = require('../controllers/document.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');
const { handleUpload } = require('../middleware/upload.middleware');

// Public file retrieval for avatar images
router.get('/documents/file/:filename', documentController.getFileByFilename);

// All subsequent donor routes require authentication
router.use(authenticateToken);

// 1. Current Donor Profile & Vitals
router.get('/profile', authorizeRoles('DONOR'), donorController.getMyProfile);
router.put('/profile', authorizeRoles('DONOR'), donorController.updateProfile);

// 2. Donation History & Certificates
router.get('/history', authorizeRoles('DONOR'), donorController.getDonationHistory);

// 3. Appointments
router.get('/appointments', authorizeRoles('DONOR'), donorController.getMyAppointments);
router.post('/appointments', authorizeRoles('DONOR'), donorController.bookAppointment);
router.put('/appointments/:appointmentId/cancel', authorizeRoles('DONOR', 'ADMIN', 'SUPER_ADMIN'), donorController.cancelAppointment);
router.delete('/appointments/:appointmentId', authorizeRoles('DONOR', 'ADMIN', 'SUPER_ADMIN'), donorController.cancelAppointment);
router.put('/appointments/:appointmentId/complete', authorizeRoles('HOSPITAL_STAFF', 'ADMIN', 'SUPER_ADMIN'), donorController.completeAppointment);

// 4. Multer Upload & Document Management
router.post('/profile/photo', handleUpload('photo', true), documentController.uploadProfilePhoto);
router.post('/documents', handleUpload('document', true), documentController.uploadDocument);
router.get('/documents', documentController.getMyDocuments);
router.get('/documents/:id', documentController.downloadDocument);
router.delete('/documents/:id', documentController.deleteDocument);

// 5. Admin & Staff Donor Directory Management
router.get('/', authorizeRoles('ADMIN', 'SUPER_ADMIN', 'HOSPITAL_STAFF'), donorController.getAllDonors);
router.get('/:id', authorizeRoles('DONOR', 'ADMIN', 'SUPER_ADMIN', 'HOSPITAL_STAFF'), donorController.getDonorById);
router.get('/:donorId/donations', authorizeRoles('DONOR', 'ADMIN', 'SUPER_ADMIN', 'HOSPITAL_STAFF'), donorController.getDonationsByDonorId);

module.exports = router;

