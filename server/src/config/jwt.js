/**
 * RAKT-SETU JWT CONFIGURATION & SECRET VALIDATOR
 * Guarantees cryptographic secret integrity and blocks startup in production
 * if an insecure or default secret is configured.
 */

const getJwtSecret = () => {
    const secret = process.env.JWT_SECRET;
    const isProduction = process.env.NODE_ENV === 'production';
    const defaultPlaceholder = 'raktsetu_evaluation_2_secure_jwt_secret_key_2026';

    if (isProduction) {
        if (!secret || secret.trim() === '' || secret === defaultPlaceholder || secret.length < 32) {
            throw new Error(
                '[FATAL SECURITY CONFIGURATION ERROR]: Production deployment requires a secure, dedicated JWT_SECRET of at least 32 characters.'
            );
        }
    }

    return secret || defaultPlaceholder;
};

module.exports = {
    getJwtSecret
};
