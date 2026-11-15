const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { getJwtSecret } = require('../config/jwt');

// In-memory single-use tracking registry (jti -> expiresAt timestamp)
const usedTokensRegistry = new Map();

// Periodic purge of expired tokens from registry
const purgeExpiredTokens = () => {
    const now = Date.now();
    for (const [jti, expiresAt] of usedTokensRegistry.entries()) {
        if (expiresAt <= now) {
            usedTokensRegistry.delete(jti);
        }
    }
};

/**
 * Generates a narrowly-scoped, short-lived, single-use document access token.
 * 
 * Binds:
 * - Specific Document ID (docId)
 * - Specific User ID (sub)
 * - Specific Action ('view' or 'download')
 * - Purpose identifier ('DOCUMENT_ACCESS')
 * - Unique Nonce (jti) for single-use enforcement
 * - Short expiry (default: 120 seconds)
 */
const generateDocumentAccessToken = ({ documentId, userId, action = 'view', expiresIn = '120s' }) => {
    if (!documentId) throw new Error('documentId is required to generate access token');
    if (!userId) throw new Error('userId is required to generate access token');

    const jti = crypto.randomBytes(16).toString('hex');
    const payload = {
        sub: userId.toString(),
        docId: documentId.toString(),
        action,
        purpose: 'DOCUMENT_ACCESS',
        jti
    };

    const secret = getJwtSecret();
    return jwt.sign(payload, secret, { expiresIn });
};

/**
 * Verifies and redeems a single-use document access token.
 * Throws an error if invalid, expired, reused, or mismatched.
 */
const verifyDocumentAccessToken = (token, expectedDocId, expectedAction = 'view') => {
    if (!token) {
        throw new Error('Document access token is missing.');
    }

    purgeExpiredTokens();

    const secret = getJwtSecret();
    let decoded;
    try {
        decoded = jwt.verify(token, secret);
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            throw new Error('Document access token has expired.');
        }
        throw new Error('Invalid or malformed document access token.');
    }

    // 1. Purpose check
    if (decoded.purpose !== 'DOCUMENT_ACCESS') {
        throw new Error('Invalid token purpose: Not a document access token.');
    }

    // 2. Document binding check
    if (expectedDocId && decoded.docId !== expectedDocId.toString()) {
        throw new Error('Document access token is not valid for this document.');
    }

    // 3. Action binding check
    if (expectedAction && decoded.action !== expectedAction) {
        throw new Error(`Document access token is restricted to '${decoded.action}', not '${expectedAction}'.`);
    }

    // 4. Single-use check
    if (usedTokensRegistry.has(decoded.jti)) {
        throw new Error('Document access token has already been used. Tokens are strictly single-use.');
    }

    // Redeem token: record jti until expiration
    const expiresAt = (decoded.exp ? decoded.exp * 1000 : Date.now() + 120000);
    usedTokensRegistry.set(decoded.jti, expiresAt);

    return decoded;
};

const clearUsedTokensForTest = () => {
    usedTokensRegistry.clear();
};

module.exports = {
    generateDocumentAccessToken,
    verifyDocumentAccessToken,
    clearUsedTokensForTest
};
