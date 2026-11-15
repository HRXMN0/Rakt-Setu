const express = require('express');
const router = express.Router();
const requestController = require('../controllers/request.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');

// All request operations require authentication
router.use(authenticateToken);

// 1. View Requests (Hospital staff restricted to their own hospital; Admins view all)
router.get('/', authorizeRoles('HOSPITAL_STAFF', 'ADMIN', 'SUPER_ADMIN'), requestController.getAllRequests);

// 2. Create Blood Request (Hospital Staff & Admins)
router.post('/', authorizeRoles('HOSPITAL_STAFF', 'ADMIN', 'SUPER_ADMIN'), requestController.createRequest);

// 3. Get Single Request Details
router.get('/:id', authorizeRoles('HOSPITAL_STAFF', 'ADMIN', 'SUPER_ADMIN'), requestController.getRequestById);

// 4. Compatibility Matching Engine Execution
router.get('/:id/match', authorizeRoles('HOSPITAL_STAFF', 'ADMIN', 'SUPER_ADMIN'), requestController.matchRequest);

// 5. Update Status (Approve, Dispatch, Fulfill, Reject, Cancel)
router.put('/:id/status', authorizeRoles('HOSPITAL_STAFF', 'ADMIN', 'SUPER_ADMIN'), requestController.updateRequestStatus);

module.exports = router;

