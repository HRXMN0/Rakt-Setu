const { errorResponse } = require('../utils/responseHelper');

const errorHandler = (err, req, res, next) => {
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';
    let errors = null;

    // Mongoose bad ObjectId (CastError)
    if (err.name === 'CastError') {
        statusCode = 400;
        message = `Invalid ID format for field '${err.path}'`;
    }

    // Mongoose Validation Error
    if (err.name === 'ValidationError') {
        statusCode = 400;
        message = 'Validation failed';
        errors = Object.values(err.errors).map(val => val.message);
    }

    // Mongoose Duplicate Key Error (code 11000)
    if (err.code === 11000) {
        statusCode = 409;
        const field = Object.keys(err.keyValue || {})[0] || 'field';
        message = `An account or record with that ${field} already exists.`;
    }

    // JSON Web Token Errors
    if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Invalid authentication token signature.';
    }
    if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Authentication token expired.';
    }

    // CORS & CSRF origin rejection
    if (err.message && err.message.startsWith('CORS blocked:')) {
        statusCode = 403;
    }

    // Database Transaction & Topology Errors
    if (err.name === 'DatabaseTransactionError') {
        statusCode = err.statusCode || 503;
        message = err.message;
    }

    // Log in development
    if (process.env.NODE_ENV === 'development') {
        console.error(`[Error ${statusCode}]: ${message}`, err.stack);
    }

    return errorResponse(res, statusCode, message, errors);
};

module.exports = errorHandler;

