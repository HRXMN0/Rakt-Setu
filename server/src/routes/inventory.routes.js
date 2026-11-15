const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventory.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');

// All inventory operations require authentication
router.use(authenticateToken);

// 1. View Inventory (Accessible to Admin, Super Admin, Hospital Staff)
router.get('/', authorizeRoles('ADMIN', 'SUPER_ADMIN', 'HOSPITAL_STAFF'), inventoryController.getAllUnits);

// 2. Reserve Unit (Hospital Staff or Admins during emergency dispatch)
router.post('/:id/reserve', authorizeRoles('ADMIN', 'SUPER_ADMIN', 'HOSPITAL_STAFF'), inventoryController.reserveUnit);

// 3. Add Blood Unit (Strictly Blood Bank Admin or Super Admin)
router.post('/', authorizeRoles('ADMIN', 'SUPER_ADMIN'), inventoryController.addUnit);

// 4. Update Blood Unit (Status / Expiry / Component)
router.put('/:id', authorizeRoles('ADMIN', 'SUPER_ADMIN'), inventoryController.updateUnit);

// 5. Delete Blood Unit
router.delete('/:id', authorizeRoles('ADMIN', 'SUPER_ADMIN'), inventoryController.deleteUnit);

module.exports = router;

