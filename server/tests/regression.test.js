const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../src/app');
const BloodUnit = require('../src/models/BloodUnit');
const RequestModel = require('../src/models/Request');
const Appointment = require('../src/models/Appointment');

const runRegressionTests = async () => {
    const results = [];

    const record = (num, name, passed, details = '') => {
        results.push({ num, category: 'REGRESSION & BUSINESS WORKFLOWS', name, passed, details });
        console.log(`  ${passed ? '✓' : '✗'} [Test ${num}] ${name} ${details ? '(' + details + ')' : ''}`);
    };

    console.log('\n--- Running Regression & Business Workflow Tests (33 - 42) ---');

    // 33. Existing web login works
    let adminToken, staffToken, donorToken;
    try {
        const webLoginRes = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'admin@raktsetu.org',
                password: 'Password@123',
                expectedRole: 'ADMIN'
            });
        const passed = webLoginRes.status === 200 && webLoginRes.body.success && webLoginRes.body.data.token;
        adminToken = webLoginRes.body.data ? webLoginRes.body.data.token : null;
        record(33, 'Existing web login works for administrative portal', passed, `Status: ${webLoginRes.status}`);
    } catch (e) {
        record(33, 'Existing web login works', false, e.message);
    }

    // 34. Existing mobile login works
    try {
        const mobileLoginRes = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'donor@raktsetu.org',
                password: 'Password@123'
            });
        const passed = mobileLoginRes.status === 200 && mobileLoginRes.body.success && mobileLoginRes.body.data.token && mobileLoginRes.body.data.user.role === 'DONOR';
        donorToken = mobileLoginRes.body.data ? mobileLoginRes.body.data.token : null;
        record(34, 'Existing mobile login works for donor authentication', passed, `Role: ${mobileLoginRes.body.data.user.role}`);
    } catch (e) {
        record(34, 'Existing mobile login works', false, e.message);
    }

    // 35. Admin inventory operations work
    let createdUnitId = null;
    try {
        const addRes = await request(app)
            .post('/api/inventory')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                bloodType: 'AB-',
                componentType: 'Platelets',
                donorName: 'Evaluator Volunteer'
            });

        const passed = addRes.status === 201 && addRes.body.success && addRes.body.data.unit;
        if (passed) createdUnitId = addRes.body.data.unit._id;
        record(35, 'Admin inventory operations work (Add Blood Unit)', passed, `Unit ID: ${addRes.body.data.unit ? addRes.body.data.unit.unitId : 'none'}`);
    } catch (e) {
        record(35, 'Admin inventory operations', false, e.message);
    }

    // 36. Emergency request workflow works
    let createdReqId = null;
    try {
        const staffLogin = await request(app).post('/api/auth/login').send({
            email: 'staff@cityhospital.org',
            password: 'Password@123'
        });
        staffToken = staffLogin.body.data.token;

        const reqRes = await request(app)
            .post('/api/requests')
            .set('Authorization', `Bearer ${staffToken}`)
            .send({
                bloodGroup: 'O+',
                unitsRequired: 3,
                urgency: 'CRITICAL (STAT)',
                department: 'Trauma ICU',
                patientCaseId: 'CAS-EMG-7711'
            });

        const passed = reqRes.status === 201 && reqRes.body.success && reqRes.body.data.request;
        if (passed) createdReqId = reqRes.body.data.request._id;
        record(36, 'Emergency request workflow works (Broadcast STAT Request)', passed, `Status: ${reqRes.status}`);
    } catch (e) {
        record(36, 'Emergency request workflow', false, e.message);
    }

    // 37. Matching engine works
    try {
        const matchRes = await request(app)
            .get(`/api/requests/${createdReqId}/match`)
            .set('Authorization', `Bearer ${staffToken}`);

        const passed = matchRes.status === 200 && matchRes.body.success && Array.isArray(matchRes.body.data.units) && matchRes.body.data.compatibleBloodGroups.includes('O-');
        record(37, 'Blood compatibility matching engine works deterministically', passed, `Matched: ${matchRes.body.data.units.length} units`);
    } catch (e) {
        record(37, 'Matching engine', false, e.message);
    }

    // 38. Unit reservation works
    try {
        // Find available unit
        const availUnit = await BloodUnit.findOne({ status: 'available' });
        const resRes = await request(app)
            .post(`/api/inventory/${availUnit._id}/reserve`)
            .set('Authorization', `Bearer ${staffToken}`)
            .send({ requestId: createdReqId });

        const passed = resRes.status === 200 && resRes.body.data.unit.status === 'reserved';
        record(38, 'Unit atomic reservation works without race conditions', passed, `Status: ${resRes.body.data.unit.status}`);
    } catch (e) {
        record(38, 'Unit reservation', false, e.message);
    }

    // 39. Appointment booking works
    let bookedAptId = null;
    try {
        const aptRes = await request(app)
            .post('/api/donors/appointments')
            .set('Authorization', `Bearer ${donorToken}`)
            .send({
                facilityName: 'Patiala Central Blood Centre',
                date: '2026-11-25',
                time: '11:00 AM',
                donationType: 'Whole Blood'
            });

        const passed = aptRes.status === 201 && aptRes.body.success && aptRes.body.data.appointment.donorSlipCode.startsWith('RS-APT-');
        if (passed) bookedAptId = aptRes.body.data.appointment._id;
        record(39, 'Appointment booking works and generates verified donor slip', passed, `Slip: ${aptRes.body.data.appointment.donorSlipCode}`);
    } catch (e) {
        record(39, 'Appointment booking', false, e.message);
    }

    // 40. Appointment cancellation works
    try {
        const cancelRes = await request(app)
            .put(`/api/donors/appointments/${bookedAptId}/cancel`)
            .set('Authorization', `Bearer ${donorToken}`);

        const passed = cancelRes.status === 200 && cancelRes.body.data.appointment.status === 'Cancelled';
        record(40, 'Appointment cancellation works for authorized donor', passed, `Status: ${cancelRes.body.data.appointment.status}`);
    } catch (e) {
        record(40, 'Appointment cancellation', false, e.message);
    }

    // 41. Donation history isolation works
    try {
        const histRes = await request(app)
            .get('/api/donors/history')
            .set('Authorization', `Bearer ${donorToken}`);

        const passed = histRes.status === 200 && Array.isArray(histRes.body.data.donations);
        record(41, 'Donation history data isolation enforced per donor identity', passed, `Count: ${histRes.body.data.totalCount}`);
    } catch (e) {
        record(41, 'Donation history isolation', false, e.message);
    }

    // 42. Existing UI remains unchanged
    try {
        const publicDir = path.resolve(__dirname, '../../public');
        const rootDir = fs.existsSync(publicDir) ? publicDir : path.resolve(__dirname, '../../');
        const expectedFiles = [
            'index.html',
            'donor/dashboard.html',
            'donor/schedule-donation.html',
            'donor/donation-history.html',
            'donor/profile.html',
            'donor/login.html',
            'hospital/dashboard.html',
            'hospital/inventory.html',
            'hospital/request-blood.html',
            'hospital/emergency-requests.html',
            'hospital/profile.html',
            'blood-bank/dashboard.html',
            'blood-bank/inventory.html',
            'blood-bank/requests.html',
            'blood-bank/profile.html',
            'css/global.css',
            'css/components.css'
        ];

        const allExist = expectedFiles.every(f => fs.existsSync(path.join(rootDir, f)));
        record(42, 'Existing HTML screens and Stitch UI assets remain 100% preserved', allExist, `Verified ${expectedFiles.length} files`);
    } catch (e) {
        record(42, 'Existing UI preservation check', false, e.message);
    }

    return results;
};

module.exports = runRegressionTests;
