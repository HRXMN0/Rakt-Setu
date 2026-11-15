const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const User = require('../src/models/User');

const runAuthTests = async () => {
    const results = [];

    const record = (num, name, passed, details = '') => {
        results.push({ num, category: 'AUTHENTICATION', name, passed, details });
        console.log(`  ${passed ? '✓' : '✗'} [Test ${num}] ${name} ${details ? '(' + details + ')' : ''}`);
    };

    console.log('\n--- Running Authentication Tests (1 - 8) ---');

    // 1. Register a new donor
    try {
        const uniqueEmail = `test_donor_${Date.now()}@test.org`;
        const res = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'Karan Singh',
                email: uniqueEmail,
                password: 'Password@123',
                confirmPassword: 'Password@123',
                role: 'DONOR',
                bloodGroup: 'B+',
                phone: '+91 98144 00000',
                city: 'Patiala'
            });

        const passed = res.status === 201 && res.body.success && res.body.data.token && res.body.data.user.role === 'DONOR';
        record(1, 'Register a new donor', passed, `Status: ${res.status}`);

        // 2. Reject duplicate registration
        const dupRes = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'Duplicate Donor',
                email: uniqueEmail,
                password: 'Password@123',
                confirmPassword: 'Password@123',
                role: 'DONOR'
            });
        const dupPassed = dupRes.status === 409 && !dupRes.body.success;
        record(2, 'Reject duplicate registration', dupPassed, `Status: ${dupRes.status}`);
    } catch (e) {
        record(1, 'Register a new donor', false, e.message);
        record(2, 'Reject duplicate registration', false, e.message);
    }

    // 3. Reject invalid passwords
    try {
        const shortPassRes = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'Short Pass User',
                email: `short_${Date.now()}@test.org`,
                password: '123',
                confirmPassword: '123',
                role: 'DONOR'
            });
        const shortPassed = shortPassRes.status === 400 && shortPassRes.body.message.includes('Password must be at least 6 characters');
        record(3, 'Reject invalid passwords (< 6 chars)', shortPassed, `Status: ${shortPassRes.status}`);
    } catch (e) {
        record(3, 'Reject invalid passwords', false, e.message);
    }

    // 4. Login successfully
    try {
        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'donor@raktsetu.org',
                password: 'Password@123'
            });
        const loginPassed = loginRes.status === 200 && loginRes.body.success && loginRes.body.data.token;
        record(4, 'Login successfully with valid credentials', loginPassed, `Status: ${loginRes.status}`);
    } catch (e) {
        record(4, 'Login successfully', false, e.message);
    }

    // 5. Reject incorrect password
    try {
        const wrongPassRes = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'donor@raktsetu.org',
                password: 'WrongPassword999!'
            });
        const wrongPassed = wrongPassRes.status === 401 && !wrongPassRes.body.success;
        record(5, 'Reject incorrect password', wrongPassed, `Status: ${wrongPassRes.status}`);
    } catch (e) {
        record(5, 'Reject incorrect password', false, e.message);
    }

    // 6. Reject malformed JWT
    try {
        const malformedRes = await request(app)
            .get('/api/donors/profile')
            .set('Authorization', 'Bearer totally.invalid.malformed.token');
        const malformedPassed = malformedRes.status === 401;
        record(6, 'Reject malformed JWT', malformedPassed, `Status: ${malformedRes.status}`);
    } catch (e) {
        record(6, 'Reject malformed JWT', false, e.message);
    }

    // 7. Reject expired JWT
    try {
        const secret = process.env.JWT_SECRET || 'raktsetu_evaluation_2_secure_jwt_secret_key_2026';
        const expiredToken = jwt.sign(
            { id: '507f1f77bcf86cd799439011', email: 'expired@test.org', role: 'DONOR' },
            secret,
            { expiresIn: '-10s' }
        );
        const expiredRes = await request(app)
            .get('/api/donors/profile')
            .set('Authorization', `Bearer ${expiredToken}`);
        const expiredPassed = expiredRes.status === 401 && expiredRes.body.message.includes('expired');
        record(7, 'Reject expired JWT', expiredPassed, `Status: ${expiredRes.status}`);
    } catch (e) {
        record(7, 'Reject expired JWT', false, e.message);
    }

    // 8. Logout/session invalidation
    try {
        const logoutRes = await request(app).post('/api/auth/logout');
        const logoutPassed = logoutRes.status === 200 && logoutRes.body.success;
        record(8, 'Logout endpoint response valid', logoutPassed, `Status: ${logoutRes.status}`);
    } catch (e) {
        record(8, 'Logout endpoint', false, e.message);
    }

    return results;
};

module.exports = runAuthTests;

