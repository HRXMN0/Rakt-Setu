const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getJwtSecret } = require('../config/jwt');
const { errorResponse } = require('../utils/responseHelper');

const authenticateToken = async (req, res, next) => {
    try {
        let token = null;

        // 1. Primary: Extract from secure HttpOnly cookie
        if (req.cookies && req.cookies.rs_jwt_token) {
            token = req.cookies.rs_jwt_token;
        }

        // 2. Secondary fallback: Extract from Authorization: Bearer <token>
        if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return errorResponse(res, 401, 'Authentication token missing. Please log in.');
        }

        const secret = getJwtSecret();
        let decoded;
        try {
            decoded = jwt.verify(token, secret);
        } catch (jwtErr) {
            if (jwtErr.name === 'TokenExpiredError') {
                return errorResponse(res, 401, 'Session has expired. Please log in again.');
            }
            return errorResponse(res, 401, 'Invalid or malformed authentication token.');
        }

        const user = await User.findById(decoded.id).select('-password');
        if (!user) {
            return errorResponse(res, 401, 'User account associated with this token no longer exists.');
        }

        // Session Revocation Check: verify token version matches current user tokenVersion
        if (decoded.tokenVersion !== undefined && user.tokenVersion !== undefined) {
            if (decoded.tokenVersion !== user.tokenVersion) {
                return errorResponse(res, 401, 'Session has been invalidated or logged out. Please log in again.');
            }
        }

        // Attach verified user identity to req
        req.user = user;
        next();
    } catch (err) {
        return errorResponse(res, 500, 'Authentication error: ' + err.message);
    }
};

const optionalAuthenticate = async (req, res, next) => {
    try {
        let token = null;
        if (req.cookies && req.cookies.rs_jwt_token) {
            token = req.cookies.rs_jwt_token;
        } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (token) {
            const secret = getJwtSecret();
            try {
                const decoded = jwt.verify(token, secret);
                const user = await User.findById(decoded.id).select('-password');
                if (user && (decoded.tokenVersion === undefined || user.tokenVersion === undefined || decoded.tokenVersion === user.tokenVersion)) {
                    req.user = user;
                }
            } catch (ignoreErr) {
                // Token invalid or expired, continue unauthenticated
            }
        }
        next();
    } catch (err) {
        next();
    }
};

module.exports = {
    authenticateToken,
    optionalAuthenticate
};

