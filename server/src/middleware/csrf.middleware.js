/**
 * RAKT-SETU DEFENSE-IN-DEPTH CSRF PROTECTION MIDDLEWARE
 * 
 * Strict protections against Cross-Site Request Forgery (CSRF) for cookie-authenticated sessions:
 * 1. Method Filtering: Evaluates state-mutating requests (POST, PUT, PATCH, DELETE).
 * 2. Origin/Referer Validation: Validates against strict production allowlist. Never allows localhost in production.
 * 3. Missing Header Handling: If Origin and Referer are stripped, requires custom preflight/CSRF header.
 * 4. Simple Form Blocking: Rejects application/x-www-form-urlencoded and text/plain with ambient cookies.
 * 5. Double-Submit Token Support: Validates X-CSRF-Token matching rs_csrf_token cookie when present.
 */

const { errorResponse } = require('../utils/responseHelper');

const csrfProtection = (req, res, next) => {
    // 1. Only inspect state-mutating HTTP methods
    const mutatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (!mutatingMethods.includes(req.method)) {
        return next();
    }

    // CSRF targets ambient credential delivery (HttpOnly cookies).
    // If request is not authenticated via cookie, CSRF does not apply.
    const hasCookieAuth = req.cookies && req.cookies.rs_jwt_token;
    if (!hasCookieAuth) {
        return next();
    }

    const isProduction = process.env.NODE_ENV === 'production';
    const configuredOrigins = process.env.CORS_ORIGIN
        ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
        : ['http://localhost:5000', 'http://127.0.0.1:5000'];

    // 2. Extract Origin or Referer
    const rawOrigin = req.headers.origin || (req.headers.referer ? (() => {
        try { return new URL(req.headers.referer).origin; } catch (e) { return null; }
    })() : null);

    // 3. Reject simple HTML form submissions with ambient cookies
    const contentType = (req.headers['content-type'] || '').toLowerCase();
    if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('text/plain')) {
        return errorResponse(
            res,
            403,
            'CSRF protection: Simple HTML form submissions are strictly forbidden with ambient credentials.'
        );
    }

    // 4. Validate Origin / Referer if present
    if (rawOrigin) {
        let isAllowed = false;
        if (isProduction) {
            // In production, strictly enforce exact allowlist. NEVER automatically permit localhost.
            isAllowed = configuredOrigins.includes(rawOrigin);
        } else {
            // In development and evaluation, permit loopback and configured origins
            const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(rawOrigin);
            isAllowed = isLocalhost || configuredOrigins.includes(rawOrigin);
        }

        if (!isAllowed) {
            return errorResponse(
                res,
                403,
                `CSRF protection: Origin '${rawOrigin}' is not authorized to execute state mutations.`
            );
        }
    } else {
        // 5. Explicitly handle missing Origin and Referer headers:
        // Attackers can strip Referer via <meta name="referrer" content="no-referrer">.
        // Therefore, cookie-authenticated mutating requests lacking Origin/Referer MUST present a custom preflight header.
        const hasCustomHeader = req.headers['x-requested-with'] ||
                                req.headers['x-csrf-token'] ||
                                contentType.includes('application/json') ||
                                contentType.includes('multipart/form-data');

        if (!hasCustomHeader) {
            return errorResponse(
                res,
                403,
                'CSRF protection: Missing Origin/Referer headers on cookie-authenticated mutation without an anti-CSRF custom header.'
            );
        }
    }

    // 6. Double-Submit Token verification if present
    const cookieCsrf = req.cookies && req.cookies.rs_csrf_token;
    const headerCsrf = req.headers['x-csrf-token'];
    if (cookieCsrf && headerCsrf) {
        if (cookieCsrf !== headerCsrf) {
            return errorResponse(res, 403, 'CSRF protection: Double-submit CSRF token mismatch.');
        }
    }

    next();
};

module.exports = csrfProtection;
