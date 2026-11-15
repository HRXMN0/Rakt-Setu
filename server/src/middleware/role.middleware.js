const { errorResponse } = require('../utils/responseHelper');

/**
 * Role-Based Access Control (RBAC) Middleware
 * @param  {...string} allowedRoles Roles authorized to access this route
 */
const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return errorResponse(res, 401, 'Unauthorized: User is not authenticated.');
        }

        const userRole = req.user.role;

        if (!allowedRoles.includes(userRole)) {
            return errorResponse(
                res,
                403,
                `Forbidden: Role '${userRole}' does not have sufficient permissions to perform this action.`
            );
        }

        next();
    };
};

/**
 * Enforces that a donor can only access or modify their own resource records.
 * Super Admins and Admins bypass this check.
 */
const enforceDonorOwnership = (paramKey = 'id') => {
    return (req, res, next) => {
        if (!req.user) {
            return errorResponse(res, 401, 'Unauthorized: User is not authenticated.');
        }

        // Admins and Super Admins have administrative oversight
        if (req.user.role === 'SUPER_ADMIN' || req.user.role === 'ADMIN') {
            return next();
        }

        const targetId = req.params[paramKey] || req.body[paramKey] || req.query[paramKey];
        const userIdStr = req.user._id.toString();

        if (targetId && targetId !== userIdStr) {
            return errorResponse(
                res,
                403,
                'Forbidden: You do not have permission to view or modify records belonging to another donor.'
            );
        }

        next();
    };
};

/**
 * Enforces facility isolation for hospital staff
 */
const enforceHospitalIsolation = () => {
    return (req, res, next) => {
        if (!req.user) {
            return errorResponse(res, 401, 'Unauthorized: User is not authenticated.');
        }

        // Global administrators can view all facilities
        if (req.user.role === 'SUPER_ADMIN' || req.user.role === 'ADMIN') {
            return next();
        }

        if (req.user.role === 'HOSPITAL_STAFF') {
            // Check hospital affiliation
            if (!req.user.hospitalId && !req.user.hospitalName) {
                return errorResponse(res, 403, 'Forbidden: Hospital staff is not affiliated with any authorized hospital.');
            }
        }

        next();
    };
};

module.exports = {
    authorizeRoles,
    enforceDonorOwnership,
    enforceHospitalIsolation
};

