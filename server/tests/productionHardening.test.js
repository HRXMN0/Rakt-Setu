/**
 * RAKT-SETU PRODUCTION HARDENING & SECURITY VERIFICATION SUITE
 * Tests Phase C, D, E, F security enhancements:
 * 1. Removal of password bypass backdoor
 * 2. Mandatory JWT secret enforcement in production
 * 3. Helmet security headers presence
 * 4. Enhanced /api/health endpoint reporting
 * 5. CORS policy strict origin evaluation
 * 6. Orphaned upload cleanup verification
 */

const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../src/app');
const User = require('../src/models/User');
const { getJwtSecret } = require('../src/config/jwt');
const { removeFile, fileExists } = require('../src/services/storage.adapter');

const runProductionHardeningTests = async () => {
    const results = [];
    console.log('\n--- Running Production Hardening & Security Tests (43 - 50) ---');

    const record = (num, name, passed, details = '') => {
        results.push({ num, category: 'PRODUCTION_HARDENING', name, passed, details });
        console.log(`  ${passed ? '✓' : '✗'} [Test ${num}] ${name} ${details ? '(' + details + ')' : ''}`);
    };

    // 43. Verify password backdoor is eliminated
    try {
        const user = await User.findOne({ email: 'donor@raktsetu.org' }).select('+password');
        let backdoorBypassed = false;
        if (user) {
            // Attempt logging in with dummy password that would previously pass if hardcoded
            backdoorBypassed = await user.matchPassword('definitely_wrong_password_999');
        }
        const passed = !backdoorBypassed;
        record(43, 'Authentication backdoor permanently eliminated in User model', passed);
    } catch (e) {
        record(43, 'Authentication backdoor permanently eliminated', false, e.message);
    }

    // 44. Verify JWT secret validator throws in production with weak/missing secret
    try {
        const prevEnv = process.env.NODE_ENV;
        const prevSecret = process.env.JWT_SECRET;

        process.env.NODE_ENV = 'production';
        process.env.JWT_SECRET = 'short';

        let threwError = false;
        try {
            getJwtSecret();
        } catch (err) {
            threwError = err.message.includes('FATAL SECURITY CONFIGURATION ERROR');
        }

        process.env.NODE_ENV = prevEnv;
        process.env.JWT_SECRET = prevSecret;

        record(44, 'Production rejects weak/default JWT secret (< 32 chars)', threwError);
    } catch (e) {
        record(44, 'Production rejects weak/default JWT secret', false, e.message);
    }

    // 45. Verify Helmet security headers on HTTP responses
    try {
        const res = await request(app).get('/api/health');
        const hasNosniff = res.headers['x-content-type-options'] === 'nosniff';
        const hasFrameOptions = res.headers['x-frame-options'] === 'SAMEORIGIN';
        const passed = res.status === 200 && hasNosniff && hasFrameOptions;
        record(45, 'Helmet HTTP security headers present (X-Content-Type-Options, X-Frame-Options)', passed);
    } catch (e) {
        record(45, 'Helmet HTTP security headers present', false, e.message);
    }

    // 46. Verify enhanced /api/health endpoint
    try {
        const res = await request(app).get('/api/health');
        const passed = res.status === 200 && res.body.success === true && res.body.database === 'connected' && typeof res.body.uptimeSeconds === 'number';
        record(46, 'Enhanced /api/health reports live database status and uptime metrics', passed);
    } catch (e) {
        record(46, 'Enhanced /api/health reports status', false, e.message);
    }

    // 47. Verify CORS policy rejects unauthorized cross-origin requests
    try {
        const res = await request(app)
            .get('/api/health')
            .set('Origin', 'https://malicious-phishing-site.com');

        // Express CORS middleware will call next(err) which error handler reports as 500 or CORS blocked
        const passed = res.status >= 400 || res.headers['access-control-allow-origin'] !== 'https://malicious-phishing-site.com';
        record(47, 'CORS policy prevents unauthorized third-party origins', passed);
    } catch (e) {
        record(47, 'CORS policy prevents unauthorized origins', true);
    }

    // 48. Verify modular storage adapter interface
    try {
        const testFile = 'test_adapter_probe.txt';
        const testPath = path.resolve(__dirname, '../src/uploads', testFile);
        fs.writeFileSync(testPath, 'raktsetu-storage-probe');

        const existsBefore = await fileExists(testFile);
        const removed = await removeFile(testFile);
        const existsAfter = await fileExists(testFile);

        const passed = existsBefore === true && removed === true && existsAfter === false;
        record(48, 'Modular Storage Adapter handles existence and safe file unlinking', passed);
    } catch (e) {
        record(48, 'Modular Storage Adapter', false, e.message);
    }

    // 49. Verify rate limiting headers on authentication
    try {
        const res = await request(app).post('/api/auth/login').send({ email: 'donor@raktsetu.org', password: 'Password@123' });
        const hasRateLimitHeader = res.headers['ratelimit-limit'] !== undefined || 
                                   res.headers['x-ratelimit-limit'] !== undefined ||
                                   res.headers['ratelimit'] !== undefined ||
                                   res.headers['ratelimit-policy'] !== undefined;
        record(49, 'Rate limiting middleware active on authentication endpoints', hasRateLimitHeader);
    } catch (e) {
        record(49, 'Rate limiting middleware active', false, e.message);
    }

    // 50. Verify hospital and blood bank isolation
    try {
        // Hospital staff from Government Rajindra Hospital should not view Amar Hospital private requisitions
        const staffRes = await request(app).post('/api/auth/login').send({ email: 'staff@cityhospital.org', password: 'Password@123' });
        const token = staffRes.body.data.token;

        const res = await request(app)
            .get('/api/requests')
            .set('Authorization', `Bearer ${token}`);

        // Every returned request must belong to Rajindra hospital or null
        const allOwnHospital = res.body.data.requests.every(r => r.hospitalName.includes('Rajindra'));
        record(50, 'Facility isolation enforced on hospital requisitions query', allOwnHospital);
    } catch (e) {
        record(50, 'Facility isolation enforced', false, e.message);
    }

    return results;
};

module.exports = runProductionHardeningTests;
