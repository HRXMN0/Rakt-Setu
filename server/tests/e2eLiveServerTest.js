const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5000';

function request(options, body = null, isMultipart = false) {
    return new Promise((resolve, reject) => {
        const url = new URL(options.path || '', BASE_URL);
        const reqOptions = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: options.method || 'GET',
            headers: options.headers || {}
        };

        if (body && !isMultipart && typeof body === 'object') {
            body = JSON.stringify(body);
            reqOptions.headers['Content-Type'] = 'application/json';
            reqOptions.headers['Content-Length'] = Buffer.byteLength(body);
        }

        const req = http.request(reqOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                let parsed = data;
                try {
                    parsed = JSON.parse(data);
                } catch (e) {}
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: parsed
                });
            });
        });

        req.on('error', reject);

        if (body) {
            req.write(body);
        }
        req.end();
    });
}

async function runE2E() {
    console.log('================================================================');
    console.log('  🧪 RUNNING COMPREHENSIVE LIVE SERVER E2E VERIFICATION');
    console.log('  Target: ' + BASE_URL);
    console.log('================================================================\n');

    let passed = 0;
    let failed = 0;

    function assert(condition, testName, details = '') {
        if (condition) {
            console.log(`  ✅ PASS: ${testName} ${details ? '(' + details + ')' : ''}`);
            passed++;
        } else {
            console.error(`  ❌ FAIL: ${testName} ${details ? '(' + details + ')' : ''}`);
            failed++;
        }
    }

    try {
        // 1. Health Endpoint
        const health = await request({ path: '/api/health' });
        assert(health.status === 200 && health.body.success, 'Health check endpoint', `Status ${health.status}`);

        // 2. Static Front-end File Serving
        const home = await request({ path: '/' });
        assert(home.status === 200 && typeof home.body === 'string' && home.body.includes('Rakt-Setu'), 'Static root serving index.html');

        const donorLogin = await request({ path: '/donor/login.html' });
        assert(donorLogin.status === 200 && donorLogin.body.includes('donor@raktsetu.org'), 'Static donor/login.html served with demo info');

        const hospitalLogin = await request({ path: '/hospital/login.html' });
        assert(hospitalLogin.status === 200 && hospitalLogin.body.includes('staff@cityhospital.org'), 'Static hospital/login.html served with demo info');

        const bloodBankLogin = await request({ path: '/blood-bank/login.html' });
        assert(bloodBankLogin.status === 200 && bloodBankLogin.body.includes('admin@raktsetu.org'), 'Static blood-bank/login.html served with demo info');

        const css = await request({ path: '/css/global.css' });
        assert(css.status === 200 && css.body.length > 5000, 'Static CSS loaded correctly');

        const apiJs = await request({ path: '/js/api.js' });
        assert(apiJs.status === 200 && apiJs.body.includes('ApiClient'), 'Static js/api.js loaded correctly');

        // 3. Authentication for All 4 Roles
        // A. SUPER_ADMIN Login
        const saLogin = await request({
            path: '/api/auth/login',
            method: 'POST'
        }, { email: 'superadmin@raktsetu.org', password: 'Password@123' });
        assert(saLogin.status === 200 && saLogin.body.data.user.role === 'SUPER_ADMIN', 'Super Admin login with Password@123', `Token received`);
        const saToken = saLogin.body?.data?.token;

        // B. SUPER_ADMIN Login with lowercase password (flexibility test)
        const saLogin2 = await request({
            path: '/api/auth/login',
            method: 'POST'
        }, { email: 'superadmin@raktsetu.org', password: 'password123' });
        assert(saLogin2.status === 200, 'Super Admin login with password123 (demo fallback)');

        // C. SUPER_ADMIN Login via Donor Portal (expectedRole: 'DONOR')
        const saDonorPortalLogin = await request({
            path: '/api/auth/login',
            method: 'POST'
        }, { email: 'superadmin@raktsetu.org', password: 'Password@123', expectedRole: 'DONOR' });
        assert(saDonorPortalLogin.status === 200, 'Super Admin login on Donor Portal (universal administrative oversight)');

        // D. ADMIN Login
        const adminLogin = await request({
            path: '/api/auth/login',
            method: 'POST'
        }, { email: 'admin@raktsetu.org', password: 'Password@123', expectedRole: 'ADMIN' });
        assert(adminLogin.status === 200 && adminLogin.body.data.user.role === 'ADMIN', 'Admin login (Blood Bank depot)');
        const adminToken = adminLogin.body?.data?.token;

        // E. HOSPITAL_STAFF Login
        const staffLogin = await request({
            path: '/api/auth/login',
            method: 'POST'
        }, { email: 'staff@cityhospital.org', password: 'Password@123', expectedRole: 'HOSPITAL_STAFF' });
        assert(staffLogin.status === 200 && staffLogin.body.data.user.role === 'HOSPITAL_STAFF', 'Hospital Staff login');
        const staffToken = staffLogin.body?.data?.token;

        // F. DONOR Login
        const donorLoginRes = await request({
            path: '/api/auth/login',
            method: 'POST'
        }, { email: 'donor@raktsetu.org', password: 'Password@123', expectedRole: 'DONOR' });
        assert(donorLoginRes.status === 200 && donorLoginRes.body.data.user.role === 'DONOR', 'Donor login');
        const donorToken = donorLoginRes.body?.data?.token;

        // G. Aliases Login (hospital@raktsetu.org & bloodbank@raktsetu.org)
        const hospAliasLogin = await request({
            path: '/api/auth/login',
            method: 'POST'
        }, { email: 'hospital@raktsetu.org', password: 'Password@123' });
        assert(hospAliasLogin.status === 200, 'Hospital alias account login (hospital@raktsetu.org)');

        const bbAliasLogin = await request({
            path: '/api/auth/login',
            method: 'POST'
        }, { email: 'bloodbank@raktsetu.org', password: 'Password@123' });
        assert(bbAliasLogin.status === 200, 'Blood Bank alias account login (bloodbank@raktsetu.org)');

        // 4. Register a New Donor and Verify 0 donations & clean profile
        const newEmail = `e2e_donor_${Date.now()}@example.com`;
        const regRes = await request({
            path: '/api/auth/register',
            method: 'POST'
        }, {
            name: 'Priya Verma',
            email: newEmail,
            password: 'Password@123',
            confirmPassword: 'Password@123',
            role: 'DONOR',
            bloodGroup: 'B+'
        });
        assert(regRes.status === 201 && regRes.body.data.user.email === newEmail, 'Register new donor');
        const newDonorToken = regRes.body?.data?.token;

        const newDonorHistory = await request({
            path: '/api/donors/history',
            headers: { 'Authorization': `Bearer ${newDonorToken}` }
        });
        assert(newDonorHistory.status === 200 && newDonorHistory.body.data.donations.length === 0, 'New donor starts with 0 donations');

        // 5. Existing Demo Donor Profile & History
        const demoProfile = await request({
            path: '/api/donors/profile',
            headers: { 'Authorization': `Bearer ${donorToken}` }
        });
        assert(demoProfile.status === 200 && demoProfile.body.data.donor.bloodGroup === 'O+', 'Fetch demo donor profile');

        const demoHistory = await request({
            path: '/api/donors/history',
            headers: { 'Authorization': `Bearer ${donorToken}` }
        });
        assert(demoHistory.status === 200 && demoHistory.body.data.donations.length >= 3, 'Fetch demo donor donation history (3 records)');

        // 6. Appointment Booking & Cancellation
        const aptRes = await request({
            path: '/api/donors/appointments',
            method: 'POST',
            headers: { 'Authorization': `Bearer ${donorToken}` }
        }, {
            facilityName: 'Government Rajindra Hospital, Patiala',
            facilityType: 'Hospital',
            date: '2026-12-01',
            time: '10:00 AM - 11:00 AM',
            donationType: 'Whole Blood'
        });
        const slip = aptRes.body?.data?.appointment?.donorSlipCode || aptRes.body?.data?.appointment?.appointmentSlipId;
        assert(aptRes.status === 201 && !!slip, 'Book donation appointment', slip);
        const aptId = aptRes.body?.data?.appointment?._id;

        if (aptId) {
            const cancelRes = await request({
                path: `/api/donors/appointments/${aptId}/cancel`,
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${donorToken}` }
            });
            assert(cancelRes.status === 200 && cancelRes.body.data.appointment.status === 'Cancelled', 'Cancel donor appointment');
        }

        // 7. Inventory Management (Admin only)
        const invRes = await request({
            path: '/api/inventory',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const unitList = invRes.body?.data?.units || [];
        assert(invRes.status === 200 && Array.isArray(unitList) && unitList.length > 0, 'List blood units (Admin)', `${unitList.length} units in database`);

        const availUnit = unitList.find(u => u.status === 'available');
        if (availUnit) {
            const reserveRes = await request({
                path: `/api/inventory/${availUnit._id}/reserve`,
                method: 'POST',
                headers: { 'Authorization': `Bearer ${adminToken}` }
            });
            const resStatus = reserveRes.body?.data?.unit?.status || reserveRes.body?.data?.bloodUnit?.status;
            assert(reserveRes.status === 200 && resStatus === 'reserved', 'Reserve blood unit atomically');
        }

        // 8. Hospital Emergency Blood Request & Compatibility Matching
        const reqRes = await request({
            path: '/api/requests',
            method: 'POST',
            headers: { 'Authorization': `Bearer ${staffToken}` }
        }, {
            patientName: 'Karan Mehra',
            patientAge: 42,
            patientGender: 'Male',
            bloodGroup: 'A+',
            component: 'Packed RBCs',
            unitsRequested: 2,
            urgency: 'STAT Emergency',
            clinicalIndication: 'Acute trauma emergency surgery'
        });
        assert(reqRes.status === 201 && reqRes.body.data.request.urgency === 'STAT Emergency', 'Create STAT Emergency blood requisition');
        const requestId = reqRes.body?.data?.request?._id;

        if (requestId) {
            const matchRes = await request({
                path: `/api/requests/${requestId}/match`,
                headers: { 'Authorization': `Bearer ${staffToken}` }
            });
            const matches = matchRes.body?.data?.units || matchRes.body?.data?.matches || [];
            assert(matchRes.status === 200 && Array.isArray(matches), 'Run compatibility matching engine', `Found ${matches.length} compatible units`);
        }

        // 9. RBAC Security Checks
        // A. Donor trying to access Admin Inventory endpoint
        const forbiddenInv = await request({
            path: '/api/inventory',
            method: 'POST',
            headers: { 'Authorization': `Bearer ${donorToken}` }
        }, { unitId: 'HACK-01', bloodGroup: 'O+' });
        assert(forbiddenInv.status === 403, 'RBAC: Donor blocked from adding blood unit (403 Forbidden)');

        // B. Hospital staff trying to modify another hospital request
        const forbiddenCancel = await request({
            path: `/api/donors/appointments/${aptId}/cancel`,
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${newDonorToken}` }
        });
        assert(forbiddenCancel.status === 403, 'RBAC: Cross-donor appointment access rejected (403 Forbidden)');

        // 10. Multer File Upload E2E (multipart)
        const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
        const dummyPdfContent = '%PDF-1.4\n1 0 obj\n<< /Title (Test Donor ID Card) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF';
        const multipartBody = 
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="documentType"\r\n\r\n` +
            `DONOR_ID\r\n` +
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="description"\r\n\r\n` +
            `Aadhaar Card Verification\r\n` +
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="document"; filename="test_doc.pdf"\r\n` +
            `Content-Type: application/pdf\r\n\r\n` +
            `${dummyPdfContent}\r\n` +
            `--${boundary}--\r\n`;

        const uploadRes = await request({
            path: '/api/donors/documents',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${donorToken}`,
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': Buffer.byteLength(multipartBody)
            }
        }, multipartBody, true);
        assert(uploadRes.status === 201 && uploadRes.body.data.document.originalName === 'test_doc.pdf', 'Multer: Valid PDF document upload');
        const docId = uploadRes.body?.data?.document?._id;

        if (docId) {
            // View document metadata
            const getDocs = await request({
                path: '/api/donors/documents',
                headers: { 'Authorization': `Bearer ${donorToken}` }
            });
            assert(getDocs.status === 200 && getDocs.body.data.documents.some(d => d._id === docId), 'Multer: Fetch uploaded donor documents list');

            // Delete document
            const delDoc = await request({
                path: `/api/donors/documents/${docId}`,
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${donorToken}` }
            });
            assert(delDoc.status === 200, 'Multer: Delete uploaded donor document');
        }

    } catch (err) {
        console.error('Fatal test error:', err);
        failed++;
    }

    console.log('\n================================================================');
    console.log(`  E2E SUMMARY: Passed ${passed}, Failed ${failed}`);
    console.log('================================================================');

    if (failed > 0) {
        process.exit(1);
    }
}

runE2E();
