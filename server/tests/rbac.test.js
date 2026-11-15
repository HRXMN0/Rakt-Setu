const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Appointment = require('../src/models/Appointment');
const RequestModel = require('../src/models/Request');

const runRbacTests = async () => {
    const results = [];

    const record = (num, name, passed, details = '') => {
        results.push({ num, category: 'AUTHORIZATION / RBAC', name, passed, details });
        console.log(`  ${passed ? '✓' : '✗'} [Test ${num}] ${name} ${details ? '(' + details + ')' : ''}`);
    };

    console.log('\n--- Running Authorization / RBAC Tests (9 - 15) ---');

    // Helper to log in and get token
    const getToken = async (email, password) => {
        const res = await request(app).post('/api/auth/login').send({ email, password });
        return res.body.data ? res.body.data.token : null;
    };

    const donorToken = await getToken('donor@raktsetu.org', 'Password@123');
    const staffToken = await getToken('staff@cityhospital.org', 'Password@123');
    const adminToken = await getToken('admin@raktsetu.org', 'Password@123');
    const superAdminToken = await getToken('superadmin@raktsetu.org', 'Password@123');

    // 9. Donor cannot access admin endpoints
    try {
        const res = await request(app)
            .post('/api/inventory')
            .set('Authorization', `Bearer ${donorToken}`)
            .send({
                bloodType: 'O+',
                componentType: 'Whole Blood'
            });
        const passed = res.status === 403;
        record(9, 'Donor cannot access admin endpoints (POST /api/inventory)', passed, `Status: ${res.status}`);
    } catch (e) {
        record(9, 'Donor cannot access admin endpoints', false, e.message);
    }

    // 10. Hospital staff cannot access admin/superadmin management endpoints
    try {
        const res = await request(app)
            .post('/api/inventory')
            .set('Authorization', `Bearer ${staffToken}`)
            .send({
                bloodType: 'B+',
                componentType: 'Whole Blood'
            });
        const passed = res.status === 403;
        record(10, 'Hospital staff cannot access admin endpoints', passed, `Status: ${res.status}`);
    } catch (e) {
        record(10, 'Hospital staff cannot access admin endpoints', false, e.message);
    }

    // 11. Admin cannot self-register or escalate as super admin
    try {
        const res = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'Fake Super Admin',
                email: `fake_super_${Date.now()}@test.org`,
                password: 'Password@123',
                confirmPassword: 'Password@123',
                role: 'SUPER_ADMIN'
            });
        const passed = res.status === 403 && res.body.message.includes('SUPER_ADMIN is strictly prohibited');
        record(11, 'Role escalation to SUPER_ADMIN prohibited', passed, `Status: ${res.status}`);
    } catch (e) {
        record(11, 'Role escalation to SUPER_ADMIN prohibited', false, e.message);
    }

    // 12. Donor cannot modify their role
    try {
        const res = await request(app)
            .put('/api/donors/profile')
            .set('Authorization', `Bearer ${donorToken}`)
            .send({
                role: 'ADMIN'
            });
        const passed = res.status === 403 && res.body.message.includes('Modifying your assigned role is strictly prohibited');
        record(12, 'Donor cannot modify their role', passed, `Status: ${res.status}`);
    } catch (e) {
        record(12, 'Donor cannot modify their role', false, e.message);
    }

    // 13. Donor cannot access another donor\'s private donation history
    try {
        // Create dummy second donor
        const otherDonor = await User.create({
            name: 'Priya Sharma',
            email: `priya_${Date.now()}@test.org`,
            password: 'Password@123',
            role: 'DONOR'
        });

        const res = await request(app)
            .get(`/api/donors/${otherDonor._id}/donations`)
            .set('Authorization', `Bearer ${donorToken}`);
        const passed = res.status === 403;
        record(13, 'Donor cannot access another donor\'s history', passed, `Status: ${res.status}`);
    } catch (e) {
        record(13, 'Donor cannot access another donor\'s history', false, e.message);
    }

    // 14. Donor cannot cancel another donor\'s appointment
    try {
        const otherUser = await User.findOne({ role: 'SUPER_ADMIN' });
        const otherApt = await Appointment.create({
            donorId: otherUser._id,
            donorName: otherUser.name,
            facilityName: 'Government Rajindra Hospital, Patiala',
            date: '2026-11-20',
            time: '11:00 AM',
            status: 'Confirmed',
            donorSlipCode: `RS-APT-${Date.now().toString().slice(-4)}`
        });

        const res = await request(app)
            .put(`/api/donors/appointments/${otherApt._id}/cancel`)
            .set('Authorization', `Bearer ${donorToken}`);
        const passed = res.status === 403;
        record(14, 'Donor cannot cancel another donor\'s appointment', passed, `Status: ${res.status}`);
    } catch (e) {
        record(14, 'Donor cannot cancel another donor\'s appointment', false, e.message);
    }

    // 15. Hospital staff cannot access another hospital\'s restricted data
    try {
        const otherReq = await RequestModel.create({
            requestId: `REQ-ER-${Date.now().toString().slice(-4)}`,
            bloodGroup: 'O-',
            unitsRequired: 3,
            hospitalName: 'Amar Hospital, Patiala', // Different hospital from staffUser (Rajindra)
            status: 'Pending'
        });

        const res = await request(app)
            .get(`/api/requests/${otherReq._id}`)
            .set('Authorization', `Bearer ${staffToken}`);
        const passed = res.status === 403;
        record(15, 'Hospital staff cannot access another hospital\'s restricted data', passed, `Status: ${res.status}`);
    } catch (e) {
        record(15, 'Hospital data isolation', false, e.message);
    }

    return results;
};

module.exports = runRbacTests;

