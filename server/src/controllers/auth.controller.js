const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getJwtSecret } = require('../config/jwt');
const { successResponse, errorResponse } = require('../utils/responseHelper');

const COOKIE_NAME = 'rs_jwt_token';
const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
};

const generateToken = (user) => {
    const payload = {
        id: user._id,
        email: user.email,
        role: user.role,
        name: user.name,
        facilityId: user.hospitalId || user.bloodBankId || null,
        tokenVersion: user.tokenVersion !== undefined ? user.tokenVersion : 0
    };

    const secret = getJwtSecret();
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

    return jwt.sign(payload, secret, { expiresIn });
};

/**
 * Register a new user account
 */
const register = async (req, res, next) => {
    try {
        const { name, email, password, confirmPassword, role, bloodGroup, phone, city, area, hospitalName, bloodBankName, licenseNumber, weight } = req.body;

        // 1. Mandatory validation
        if (!name || !email || !password) {
            return errorResponse(res, 400, 'Name, email, and password are required fields.');
        }

        // Email regex validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return errorResponse(res, 400, 'Please provide a valid email address.');
        }

        // Password matching check if confirmPassword provided
        if (confirmPassword && password !== confirmPassword) {
            return errorResponse(res, 400, 'Passwords do not match.');
        }

        // Password strength: min 6 chars
        if (password.length < 6) {
            return errorResponse(res, 400, 'Password must be at least 6 characters long.');
        }

        // 2. Prevent self-registration as SUPER_ADMIN
        let assignedRole = role ? role.toUpperCase() : 'DONOR';
        if (assignedRole === 'SUPER_ADMIN') {
            return errorResponse(res, 403, 'Self-registration as SUPER_ADMIN is strictly prohibited.');
        }

        // Support role aliases sent from frontend registration forms
        if (assignedRole === 'HOSPITAL') assignedRole = 'HOSPITAL_STAFF';
        if (assignedRole === 'BLOOD_BANK') assignedRole = 'ADMIN';

        // Validate permitted role
        const validRoles = ['DONOR', 'HOSPITAL_STAFF', 'ADMIN'];
        if (!validRoles.includes(assignedRole)) {
            return errorResponse(res, 400, `Invalid role '${assignedRole}'. Permitted registration roles: ${validRoles.join(', ')}`);
        }

        // 3. Prevent duplicate email registration
        // Safe runtime diagnostic: Ensure User model is strictly querying raktsetu
        const mongoose = require('mongoose');
        const activeModelDb = User.db?.name || mongoose.connection.name;
        if (activeModelDb !== 'raktsetu') {
            console.error(`[DB Routing Error]: Registration rejected. Model bound to database '${activeModelDb}', expected 'raktsetu'.`);
            return errorResponse(res, 500, `Database configuration error: Registration target is '${activeModelDb}' instead of 'raktsetu'.`);
        }

        const existing = await User.findOne({ email: email.toLowerCase().trim() });
        if (existing) {
            return errorResponse(res, 409, 'An account with this email address already exists.');
        }

        // 4. Create new user
        const newUser = await User.create({
            name: name.trim(),
            email: email.toLowerCase().trim(),
            password,
            role: assignedRole,
            bloodGroup: bloodGroup || null,
            phone: phone || '',
            city: city || 'Patiala',
            area: area || '',
            weight: weight || '68 kg',
            hospitalName: assignedRole === 'HOSPITAL_STAFF' ? (hospitalName || req.body.name || 'Government Rajindra Hospital, Patiala') : null,
            bloodBankName: assignedRole === 'ADMIN' ? (bloodBankName || req.body.name || 'Patiala Central Blood Centre') : null,
            licenseNumber: licenseNumber || req.body.license || '',
            verified: true
        });

        const token = generateToken(newUser);

        // Set HttpOnly cookie for XSS-proof browser session
        res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);

        // Sanitize response (exclude password)
        const userObj = newUser.toObject();
        delete userObj.password;
        if (userObj.role === 'DONOR') {
            userObj.hospitalName = null;
            userObj.hospitalId = null;
            userObj.bloodBankName = null;
            userObj.bloodBankId = null;
        }

        return successResponse(res, 201, 'Registration successful', {
            token,
            user: userObj
        });
    } catch (err) {
        next(err);
    }
};

/**
 * User login
 */
const login = async (req, res, next) => {
    try {
        const { email, password, expectedRole } = req.body;

        if (!email || !password) {
            return errorResponse(res, 400, 'Please provide both email and password.');
        }

        // Find user by email and explicitly select password field
        const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
        if (!user) {
            return errorResponse(res, 401, 'Invalid email or password.');
        }

        // Verify password hash
        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return errorResponse(res, 401, 'Invalid email or password.');
        }

        // Check expected role if requested by portal
        if (expectedRole && user.role !== expectedRole) {
            // SUPER_ADMIN has universal administrative oversight across all portals (Donor, Hospital, Blood Bank)
            const isSuperAdminAccess = user.role === 'SUPER_ADMIN';
            if (!isSuperAdminAccess) {
                return errorResponse(
                    res,
                    403,
                    `This account is registered with role '${user.role}'. Please log in through the designated ${user.role} portal.`
                );
            }
        }

        const token = generateToken(user);

        // Set HttpOnly cookie for XSS-proof browser session
        res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);

        const userObj = user.toObject();
        delete userObj.password;
        if (userObj.role === 'DONOR') {
            userObj.hospitalName = null;
            userObj.hospitalId = null;
            userObj.bloodBankName = null;
            userObj.bloodBankId = null;
        } else if (userObj.role === 'HOSPITAL_STAFF') {
            userObj.bloodBankName = null;
            userObj.bloodBankId = null;
        } else if (userObj.role === 'ADMIN') {
            userObj.hospitalName = null;
            userObj.hospitalId = null;
        } else if (userObj.role === 'SUPER_ADMIN') {
            userObj.hospitalId = null;
            userObj.bloodBankId = null;
        }

        return successResponse(res, 200, 'Login successful', {
            token,
            user: userObj
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Get current authenticated user profile
 */
const getMe = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        if (!user) {
            return errorResponse(res, 404, 'User account not found.');
        }
        const userObj = user.toObject();
        if (userObj.role === 'DONOR') {
            userObj.hospitalName = null;
            userObj.hospitalId = null;
            userObj.bloodBankName = null;
            userObj.bloodBankId = null;
        } else if (userObj.role === 'HOSPITAL_STAFF') {
            userObj.bloodBankName = null;
            userObj.bloodBankId = null;
        } else if (userObj.role === 'ADMIN') {
            userObj.hospitalName = null;
            userObj.hospitalId = null;
        } else if (userObj.role === 'SUPER_ADMIN') {
            userObj.hospitalId = null;
            userObj.bloodBankId = null;
        }
        return successResponse(res, 200, 'Profile retrieved', { user: userObj });
    } catch (err) {
        next(err);
    }
};

/**
 * Logout and invalidate session
 */
const logout = async (req, res) => {
    try {
        let token = null;
        if (req.cookies && req.cookies[COOKIE_NAME]) {
            token = req.cookies[COOKIE_NAME];
        } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (token) {
            try {
                const secret = getJwtSecret();
                const decoded = jwt.verify(token, secret, { ignoreExpiration: true });
                if (decoded && decoded.id) {
                    await User.findByIdAndUpdate(decoded.id, { $inc: { tokenVersion: 1 } });
                }
            } catch (ignoreErr) {
                // Ignore token decode/verification errors during logout
            }
        }

        res.clearCookie(COOKIE_NAME, {
            httpOnly: true,
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            secure: process.env.NODE_ENV === 'production'
        });

        return successResponse(res, 200, 'Logged out successfully. HttpOnly session cookie cleared and server session revoked.');
    } catch (err) {
        return errorResponse(res, 500, 'Logout error: ' + err.message);
    }
};

module.exports = {
    register,
    login,
    getMe,
    logout
};

