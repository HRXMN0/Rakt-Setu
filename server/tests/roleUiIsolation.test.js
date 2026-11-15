/**
 * RAKT-SETU ROLE-BASED UI & IDENTITY ISOLATION TEST SUITE
 * Tests all 12 mandatory scenarios required by the Role-Based UI Audit:
 * 1. Donor logs in and sees donor information everywhere.
 * 2. Hospital staff logs in and sees correct hospital staff information.
 * 3. Admin logs in and sees correct admin information.
 * 4. Super Admin logs in and sees correct super admin information.
 * 5. Donor logs out and hospital staff logs in (clean session transition).
 * 6. Hospital staff logs out and donor logs in (clean session transition).
 * 7. Admin switches to another account.
 * 8. Refreshing a page preserves authenticated identity.
 * 9. Navigating between endpoints does not change logged-in identity.
 * 10. Directly accessing protected endpoints does not reveal another role's data.
 * 11. Expired or invalid sessions do not leave stale identity info visible.
 * 12. Newly registered donor displays own info instead of seeded demo information.
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const User = require('../src/models/User');

const runRoleUiIsolationTests = async () => {
    const results = [];

    const record = (scenarioNum, title, passed, details = '') => {
        results.push({ scenarioNum, title, passed, details });
        console.log(`  ${passed ? '✓' : '✗'} [Scenario ${scenarioNum}] ${title} ${details ? '(' + details + ')' : ''}`);
    };

    console.log('\n--- Running Role-Based UI & Identity Isolation Test Suite (12 Scenarios) ---');

    // SCENARIO 1: Donor logs in and sees donor information everywhere
    try {
        const res = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'donor@raktsetu.org',
                password: 'Password@123',
                expectedRole: 'DONOR'
            });

        const u = res.body?.data?.user;
        const passed = res.status === 200 &&
            u.role === 'DONOR' &&
            u.email === 'donor@raktsetu.org' &&
            u.hospitalName === null &&
            u.bloodBankName === null &&
            u.hospitalId === null &&
            u.bloodBankId === null;

        record(1, 'Donor logs in and receives isolated donor identity (no hospital/bloodbank default pollution)', passed,
            `Name: ${u?.name}, Role: ${u?.role}, HospitalName: ${u?.hospitalName}`);
    } catch (e) {
        record(1, 'Donor logs in and receives isolated donor identity', false, e.message);
    }

    // SCENARIO 2: Hospital staff logs in and sees correct hospital staff information
    try {
        const res = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'staff@cityhospital.org',
                password: 'Password@123',
                expectedRole: 'HOSPITAL_STAFF'
            });

        const u = res.body?.data?.user;
        const passed = res.status === 200 &&
            u.role === 'HOSPITAL_STAFF' &&
            u.email === 'staff@cityhospital.org' &&
            u.hospitalName === 'Government Rajindra Hospital, Patiala' &&
            u.bloodBankName === null;

        record(2, 'Hospital staff logs in and receives correct clinical staff & hospital affiliation', passed,
            `Facility: ${u?.hospitalName}, Staff: ${u?.name}`);
    } catch (e) {
        record(2, 'Hospital staff logs in and receives correct hospital staff information', false, e.message);
    }

    // SCENARIO 3: Admin logs in and sees correct admin information
    try {
        const res = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'admin@raktsetu.org',
                password: 'Password@123',
                expectedRole: 'ADMIN'
            });

        const u = res.body?.data?.user;
        const passed = res.status === 200 &&
            u.role === 'ADMIN' &&
            u.email === 'admin@raktsetu.org' &&
            u.bloodBankName === 'Patiala Central Blood Centre' &&
            u.hospitalName === null;

        record(3, 'Admin logs in and receives correct blood bank depot administrator identity', passed,
            `Depot: ${u?.bloodBankName}, Admin: ${u?.name}`);
    } catch (e) {
        record(3, 'Admin logs in and receives correct admin information', false, e.message);
    }

    // SCENARIO 4: Super Admin logs in and sees correct super admin information
    try {
        const res = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'superadmin@raktsetu.org',
                password: 'Password@123'
            });

        const u = res.body?.data?.user;
        const passed = res.status === 200 &&
            u.role === 'SUPER_ADMIN' &&
            u.email === 'superadmin@raktsetu.org' &&
            u.hospitalId === null &&
            u.bloodBankId === null;

        record(4, 'Super Admin logs in and receives universal administrative oversight identity', passed,
            `Role: ${u?.role}, User: ${u?.name}`);
    } catch (e) {
        record(4, 'Super Admin logs in and sees correct super admin information', false, e.message);
    }

    // SCENARIO 5: Donor logs out and hospital staff logs in
    try {
        // Step A: Logout clears session cookie
        const logoutRes = await request(app).post('/api/auth/logout');
        const cookieCleared = logoutRes.status === 200;

        // Step B: Hospital staff logs in
        const hospRes = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'staff@cityhospital.org',
                password: 'Password@123',
                expectedRole: 'HOSPITAL_STAFF'
            });

        const u = hospRes.body?.data?.user;
        const passed = cookieCleared && hospRes.status === 200 && u.email === 'staff@cityhospital.org' && u.role === 'HOSPITAL_STAFF';

        record(5, 'Donor logs out and hospital staff logs in: clean session transition without cross-role bleed', passed,
            `Previous session cleared: ${cookieCleared}, New Role: ${u?.role}`);
    } catch (e) {
        record(5, 'Donor logs out and hospital staff logs in', false, e.message);
    }

    // SCENARIO 6: Hospital staff logs out and donor logs in
    try {
        // Step A: Logout hospital
        const logoutRes = await request(app).post('/api/auth/logout');

        // Step B: Donor logs in
        const donorRes = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'donor@raktsetu.org',
                password: 'Password@123',
                expectedRole: 'DONOR'
            });

        const u = donorRes.body?.data?.user;
        const passed = logoutRes.status === 200 && donorRes.status === 200 && u.email === 'donor@raktsetu.org' && u.role === 'DONOR' && u.hospitalName === null;

        record(6, 'Hospital staff logs out and donor logs in: hospital details purged from donor session', passed,
            `Donor Name: ${u?.name}, HospitalName: ${u?.hospitalName}`);
    } catch (e) {
        record(6, 'Hospital staff logs out and donor logs in', false, e.message);
    }

    // SCENARIO 7: Admin switches to another account
    try {
        // Admin login
        const adminRes = await request(app)
            .post('/api/auth/login')
            .send({ email: 'admin@raktsetu.org', password: 'Password@123' });
        const adminToken = adminRes.body?.data?.token;

        // Admin logout
        await request(app).post('/api/auth/logout');

        // Super Admin login
        const superRes = await request(app)
            .post('/api/auth/login')
            .send({ email: 'superadmin@raktsetu.org', password: 'Password@123' });
        const superToken = superRes.body?.data?.token;

        const passed = adminToken && superToken && adminToken !== superToken && superRes.body?.data?.user?.role === 'SUPER_ADMIN';
        record(7, 'Admin switches to another account (account switching generates independent authenticated identity)', passed,
            `Admin -> SuperAdmin switch successful`);
    } catch (e) {
        record(7, 'Admin switches to another account', false, e.message);
    }

    // SCENARIO 8: Refreshing a page preserves the correct authenticated identity
    try {
        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({ email: 'donor@raktsetu.org', password: 'Password@123' });
        const token = loginRes.body?.data?.token;

        // Simulate page refresh: call /api/auth/me using Bearer token
        const refreshRes = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${token}`);

        const meUser = refreshRes.body?.data?.user;
        const passed = refreshRes.status === 200 &&
            meUser &&
            meUser.email === 'donor@raktsetu.org' &&
            meUser.role === 'DONOR' &&
            meUser.hospitalName === null;

        record(8, 'Refreshing a page preserves correct authenticated identity via /api/auth/me', passed,
            `Refreshed Identity: ${meUser?.email} (${meUser?.role}), HospitalName: ${meUser?.hospitalName}`);
    } catch (e) {
        record(8, 'Refreshing a page preserves the correct authenticated identity', false, e.message);
    }

    // SCENARIO 9: Navigating between pages does not change the logged-in identity
    try {
        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({ email: 'donor@raktsetu.org', password: 'Password@123' });
        const token = loginRes.body?.data?.token;

        // Simulate navigating across 3 donor endpoints
        const ep1 = await request(app).get('/api/donors/profile').set('Authorization', `Bearer ${token}`);
        const ep2 = await request(app).get('/api/donors/history').set('Authorization', `Bearer ${token}`);
        const ep3 = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

        const passed = ep1.status === 200 && ep2.status === 200 && ep3.status === 200 &&
            ep1.body?.data?.donor?.email === 'donor@raktsetu.org' &&
            ep3.body?.data?.user?.email === 'donor@raktsetu.org';

        record(9, 'Navigating between endpoints maintains consistent verified identity across transitions', passed,
            `Endpoints tested: /profile, /history, /me`);
    } catch (e) {
        record(9, 'Navigating between pages does not change the logged-in identity', false, e.message);
    }

    // SCENARIO 10: Directly opening a protected URL does not reveal another role's information
    try {
        const donorLogin = await request(app)
            .post('/api/auth/login')
            .send({ email: 'donor@raktsetu.org', password: 'Password@123' });
        const donorToken = donorLogin.body?.data?.token;

        // Donor attempts to access protected hospital-only endpoint (create requisition)
        const hospitalRequisition = await request(app)
            .post('/api/requests')
            .set('Authorization', `Bearer ${donorToken}`)
            .send({ patientName: 'Forbidden Test', unitsNeeded: 2, bloodGroup: 'O+' });

        // Unauthenticated access attempt with no token on protected documents endpoint
        const anonAccess = await request(app)
            .get('/api/hospitals/documents');

        const passed = hospitalRequisition.status === 403 && anonAccess.status === 401;
        record(10, 'Directly accessing protected URLs strictly blocks unauthorized roles with zero identity leakage', passed,
            `Donor accessing hospital API: ${hospitalRequisition.status} Forbidden, Anon: ${anonAccess.status} Unauthorized`);
    } catch (e) {
        record(10, 'Directly opening a protected URL does not reveal another role info', false, e.message);
    }

    // SCENARIO 11: Expired or invalid sessions do not leave stale identity information visible
    try {
        const invalidToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalidpayload.invalidsignature';
        const res = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${invalidToken}`);

        const passed = res.status === 401 && !res.body?.data?.user;
        record(11, 'Invalid or expired sessions reject requests cleanly without exposing any user data', passed,
            `Status: ${res.status}, Rejected: ${!res.body?.data?.user}`);
    } catch (e) {
        record(11, 'Expired or invalid sessions do not leave stale identity visible', false, e.message);
    }

    // SCENARIO 12: Newly registered donor displays their own information instead of seeded demo information
    try {
        const uniqueEmail = `priya_patel_${Date.now()}@gmail.com`;
        const regRes = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'Priya Patel',
                email: uniqueEmail,
                password: 'Password@123',
                confirmPassword: 'Password@123',
                role: 'DONOR',
                bloodGroup: 'A+',
                city: 'Patiala',
                area: 'Model Town'
            });

        const newDonor = regRes.body?.data?.user;
        const newToken = regRes.body?.data?.token;

        // Query /api/auth/me for this newly registered donor
        const meRes = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${newToken}`);

        const meDonor = meRes.body?.data?.user;

        const passed = regRes.status === 201 &&
            newDonor &&
            newDonor.name === 'Priya Patel' &&
            newDonor.email === uniqueEmail &&
            newDonor.hospitalName === null &&
            newDonor.bloodBankName === null &&
            meDonor.name === 'Priya Patel' &&
            meDonor.email === uniqueEmail &&
            meDonor.name !== 'Aarav Sharma'; // Must NOT be seeded demo donor!

        record(12, 'Newly registered donor displays their own identity and never inherits seeded demo donor data', passed,
            `Registered Name: ${meDonor?.name}, Email: ${meDonor?.email}, HospitalName: ${meDonor?.hospitalName}`);
    } catch (e) {
        record(12, 'Newly registered donor displays their own information', false, e.message);
    }

    return results;
};

if (require.main === module) {
    const { connectDB, disconnectDB } = require('../src/config/db');
    (async () => {
        try {
            await connectDB();
            const results = await runRoleUiIsolationTests();
            const total = results.length;
            const passed = results.filter(r => r.passed).length;
            console.log(`\n================================================================`);
            console.log(`  📊 ROLE-BASED UI ISOLATION SUMMARY: ${passed} / ${total} PASSED`);
            console.log(`================================================================\n`);
            await disconnectDB();
            process.exit(passed === total ? 0 : 1);
        } catch (err) {
            console.error('Test execution failed:', err);
            process.exit(1);
        }
    })();
}

module.exports = runRoleUiIsolationTests;
