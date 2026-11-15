/**
 * RAKT-SETU — PRODUCTION SECURITY & CONCURRENCY VERIFICATION TEST SUITE
 * 
 * Strict independent verification covering:
 *  1. Atomic Inventory Concurrency & Race Condition Elimination
 *  2. Request Lifecycle State Machine Transitions
 *  3. Cancellation Unit Release Integrity (Dispatched vs Reserved)
 *  4. Hospital Facility Isolation (Cross-facility profile & request tampering prevention)
 *  5. Private Document Ownership, Unindexed Probing & Path Traversal Defense
 *  6. True Server-Side Session Revocation via Token Versioning
 *  7. Ambient Cookie CSRF Defense & Malicious Origin Rejection
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');
const mongoose = require('mongoose');

// Load environment variables
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'production-grade-super-secret-key-32-chars-long';

const app = require('../src/app');
const User = require('../src/models/User');
const BloodUnit = require('../src/models/BloodUnit');
const Request = require('../src/models/Request');
const Hospital = require('../src/models/Hospital');
const Document = require('../src/models/Document');
const { uploadDir } = require('../src/middleware/upload.middleware');

let server;
let serverPort;

const startTestServer = () => {
    return new Promise((resolve) => {
        server = http.createServer(app);
        server.listen(0, '127.0.0.1', () => {
            serverPort = server.address().port;
            resolve(serverPort);
        });
    });
};

const makeRequest = (method, endpoint, body = null, headers = {}) => {
    return new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : null;
        const reqHeaders = {
            'Content-Type': 'application/json',
            ...headers
        };
        if (payload && !reqHeaders['Content-Length']) {
            reqHeaders['Content-Length'] = Buffer.byteLength(payload);
        }

        const req = http.request({
            hostname: '127.0.0.1',
            port: serverPort,
            path: endpoint,
            method,
            headers: reqHeaders
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                let parsed = null;
                try {
                    parsed = JSON.parse(data);
                } catch (e) {
                    parsed = data;
                }
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    data: parsed
                });
            });
        });

        req.on('error', reject);
        if (payload) req.write(payload);
        req.end();
    });
};

const extractSetCookie = (res) => {
    const raw = res.headers['set-cookie'];
    if (!raw) return '';
    const cookie = Array.isArray(raw) ? raw[0] : raw;
    return cookie.split(';')[0];
};

async function runSecuritySuite() {
    console.log('\n================================================================');
    console.log('  🔒 RAKT-SETU — PRODUCTION SECURITY & CONCURRENCY TEST SUITE');
    console.log('================================================================');

    let replSet = null;
    const { MongoMemoryReplSet } = require('mongodb-memory-server');
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    const mongoUri = replSet.getUri();
    await mongoose.connect(mongoUri);
    console.log('[DB Connected to ReplicaSet]:', mongoUri);

    await startTestServer();
    console.log('[Test Server Running on Port]:', serverPort);

    let passedCount = 0;
    const totalTests = 10;

    try {
        // Setup Test Identities
        const ts = Date.now().toString().slice(-5);
        const donorEmail = `sec_donor_${ts}@test.org`;
        const hospAEmail = `staff_a_${ts}@test.org`;
        const hospBEmail = `staff_b_${ts}@test.org`;
        const adminEmail = `admin_depot_${ts}@test.org`;

        // 1. Create Users
        const donor = await User.create({
            name: 'Security Test Donor',
            email: donorEmail,
            password: 'Password123!',
            role: 'DONOR',
            bloodGroup: 'O+',
            verified: true,
            tokenVersion: 0
        });

        const hospA = await Hospital.create({
            name: `Security Hospital Alpha ${ts}`,
            facilityId: `HOSP-ALPHA-${ts}`,
            type: 'Hospital',
            city: 'Patiala',
            verified: true,
            inventory: {
                'A+': { wholeBlood: 5, total: 10, status: 'Adequate' },
                'O+': { wholeBlood: 4, total: 8, status: 'Adequate' }
            }
        });

        const hospB = await Hospital.create({
            name: `Security Hospital Beta ${ts}`,
            facilityId: `HOSP-BETA-${ts}`,
            type: 'Hospital',
            city: 'Patiala',
            verified: true,
            inventory: {
                'B+': { wholeBlood: 6, total: 12, status: 'Adequate' },
                'AB+': { wholeBlood: 2, total: 4, status: 'Low Stock' }
            }
        });

        const staffA = await User.create({
            name: 'Staff Alpha',
            email: hospAEmail,
            password: 'Password123!',
            role: 'HOSPITAL_STAFF',
            hospitalId: hospA._id,
            hospitalName: hospA.name,
            verified: true,
            tokenVersion: 0
        });

        const staffB = await User.create({
            name: 'Staff Beta',
            email: hospBEmail,
            password: 'Password123!',
            role: 'HOSPITAL_STAFF',
            hospitalId: hospB._id,
            hospitalName: hospB.name,
            verified: true,
            tokenVersion: 0
        });

        const admin = await User.create({
            name: 'Admin Depot Officer',
            email: adminEmail,
            password: 'Password123!',
            role: 'ADMIN',
            bloodBankName: 'Patiala Central Blood Centre',
            verified: true,
            tokenVersion: 0
        });

        // Log in identities
        const loginDonor = await makeRequest('POST', '/api/auth/login', { email: donorEmail, password: 'Password123!' });
        const donorCookie = extractSetCookie(loginDonor);
        const donorToken = loginDonor.data.data.token;

        const loginStaffA = await makeRequest('POST', '/api/auth/login', { email: hospAEmail, password: 'Password123!' });
        const staffACookie = extractSetCookie(loginStaffA);

        const loginStaffB = await makeRequest('POST', '/api/auth/login', { email: hospBEmail, password: 'Password123!' });
        const staffBCookie = extractSetCookie(loginStaffB);

        const loginAdmin = await makeRequest('POST', '/api/auth/login', { email: adminEmail, password: 'Password123!' });
        const adminCookie = extractSetCookie(loginAdmin);

        // -------------------------------------------------------------
        // TEST 1: Atomic Inventory Concurrency & Race Condition Elimination
        // -------------------------------------------------------------
        {
            const raceUnit = await BloodUnit.create({
                unitId: `RK-RACE-${ts}`,
                bloodType: 'O+',
                componentType: 'Packed RBCs',
                collectionDate: new Date(),
                expiryDate: new Date(Date.now() + 30 * 86400000),
                status: 'available',
                facilityName: 'Patiala Central Blood Centre'
            });

            // Fire 2 concurrent reservation requests at the exact same millisecond
            const [res1, res2] = await Promise.all([
                makeRequest('POST', `/api/inventory/${raceUnit.unitId}/reserve`, {}, { 'Cookie': adminCookie }),
                makeRequest('POST', `/api/inventory/${raceUnit.unitId}/reserve`, {}, { 'Cookie': adminCookie })
            ]);

            const statuses = [res1.status, res2.status].sort();
            assert.deepStrictEqual(statuses, [200, 409], 'Exactly one concurrent reservation must succeed (200) and one must be rejected (409 Conflict)');

            // Verify single unit state in MongoDB
            const finalUnit = await BloodUnit.findById(raceUnit._id);
            assert.strictEqual(finalUnit.status, 'reserved');

            console.log('  ✓ [Test 1] Atomic reservation concurrency verified: Zero double-allocations under simultaneous requests.');
            passedCount++;
        }

        // -------------------------------------------------------------
        // TEST 2: Fulfilled Requests Cannot Be Dispatched Again
        // -------------------------------------------------------------
        {
            const testReq = await Request.create({
                requestId: `REQ-STATE-${ts}`,
                bloodGroup: 'O+',
                unitsRequired: 1,
                hospitalId: hospA._id,
                hospitalName: hospA.name,
                status: 'Fulfilled',
                requestedBy: staffA._id
            });

            const dispatchAttempt = await makeRequest('PUT', `/api/requests/${testReq._id}/status`, {
                status: 'Dispatched',
                courier: 'Express Ambulance'
            }, {
                'Cookie': adminCookie
            });

            assert.strictEqual(dispatchAttempt.status, 400, 'Attempting to dispatch a fulfilled request must return 400 Bad Request');
            assert.strictEqual(dispatchAttempt.data.success, false);

            console.log('  ✓ [Test 2] State machine integrity verified: Fulfilled requests cannot be transitioned or re-dispatched.');
            passedCount++;
        }

        // -------------------------------------------------------------
        // TEST 3: Cancellation Releases Only Truly Reserved Units
        // -------------------------------------------------------------
        {
            const testReq2 = await Request.create({
                requestId: `REQ-CANCEL-${ts}`,
                bloodGroup: 'A+',
                unitsRequired: 2,
                hospitalId: hospA._id,
                hospitalName: hospA.name,
                status: 'Approved',
                requestedBy: staffA._id
            });

            // Unit 1: Reserved for request
            const unitReserved = await BloodUnit.create({
                unitId: `RK-RES-${ts}`,
                bloodType: 'A+',
                status: 'reserved',
                reservedForRequest: testReq2._id,
                expiryDate: new Date(Date.now() + 20 * 86400000)
            });

            // Unit 2: Already used/dispatched for request
            const unitUsed = await BloodUnit.create({
                unitId: `RK-USED-${ts}`,
                bloodType: 'A+',
                status: 'used',
                reservedForRequest: testReq2._id,
                expiryDate: new Date(Date.now() + 20 * 86400000)
            });

            // Hospital cancels request
            const cancelRes = await makeRequest('PUT', `/api/requests/${testReq2._id}/status`, {
                status: 'Cancelled',
                note: 'Patient surgery postponed'
            }, {
                'Cookie': staffACookie
            });

            assert.strictEqual(cancelRes.status, 200);

            // Unit 1 was reserved -> must now be available
            const updatedReservedUnit = await BloodUnit.findById(unitReserved._id);
            assert.strictEqual(updatedReservedUnit.status, 'available');
            assert.strictEqual(updatedReservedUnit.reservedForRequest, null);

            // Unit 2 was used -> MUST REMAIN USED, never available!
            const updatedUsedUnit = await BloodUnit.findById(unitUsed._id);
            assert.strictEqual(updatedUsedUnit.status, 'used', 'Dispatched/used units must NEVER be released back to available upon cancellation');

            console.log('  ✓ [Test 3] Cancellation integrity verified: Only genuinely reserved units are freed; dispatched units remain locked.');
            passedCount++;
        }

        // -------------------------------------------------------------
        // TEST 4: Hospital Facility Data Isolation (Profile Modification)
        // -------------------------------------------------------------
        {
            // Staff A attempts to modify Hospital B's inventory and name
            const breachAttempt = await makeRequest('PUT', `/api/hospitals/${hospB._id}`, {
                name: 'Compromised Hospital Name',
                inventory: { 'B+': 0 }
            }, {
                'Cookie': staffACookie
            });

            assert.strictEqual(breachAttempt.status, 403, 'Hospital Staff A must be forbidden (403) from editing Hospital B');
            assert.strictEqual(breachAttempt.data.success, false);

            // Verify Hospital B was NOT modified
            const intactHospB = await Hospital.findById(hospB._id);
            assert.strictEqual(intactHospB.name, hospB.name);

            console.log('  ✓ [Test 4] Facility isolation verified: Hospital staff cannot alter another hospital facility profile or inventory.');
            passedCount++;
        }

        // -------------------------------------------------------------
        // TEST 5: Hospital Staff Cannot Tamper With Another Hospital Requisition
        // -------------------------------------------------------------
        {
            const reqB = await Request.create({
                requestId: `REQ-HOSPB-${ts}`,
                bloodGroup: 'B+',
                unitsRequired: 3,
                hospitalId: hospB._id,
                hospitalName: hospB.name,
                status: 'Pending',
                requestedBy: staffB._id
            });

            // Staff A attempts to cancel Hospital B's requisition
            const tamperRes = await makeRequest('PUT', `/api/requests/${reqB._id}/status`, {
                status: 'Cancelled'
            }, {
                'Cookie': staffACookie
            });

            assert.strictEqual(tamperRes.status, 403, 'Hospital Staff A cannot modify Hospital B blood requests');

            console.log('  ✓ [Test 5] Requisition boundary isolation verified: Cross-hospital request status changes strictly rejected (403).');
            passedCount++;
        }

        // -------------------------------------------------------------
        // TEST 6: Hospital Staff Cannot Mark Requisitions Dispatched
        // -------------------------------------------------------------
        {
            const reqA = await Request.create({
                requestId: `REQ-HOSPA-${ts}`,
                bloodGroup: 'O+',
                unitsRequired: 2,
                hospitalId: hospA._id,
                hospitalName: hospA.name,
                status: 'Approved',
                requestedBy: staffA._id
            });

            // Staff A attempts to dispatch blood (dispatching belongs to blood bank admin)
            const staffDispatchAttempt = await makeRequest('PUT', `/api/requests/${reqA._id}/status`, {
                status: 'Dispatched'
            }, {
                'Cookie': staffACookie
            });

            assert.strictEqual(staffDispatchAttempt.status, 403, 'Hospital staff cannot dispatch blood');

            console.log('  ✓ [Test 6] Role boundary enforcement verified: Hospital staff prohibited from executing blood dispatch.');
            passedCount++;
        }

        // -------------------------------------------------------------
        // TEST 7: Private Document Ownership & Cross-Donor Access Defense
        // -------------------------------------------------------------
        {
            // Create dummy file in uploadDir conforming to application generated format
            const docFilename = `${Date.now()}-a1b2c3d4e5f60718.pdf`;
            const docPath = path.resolve(uploadDir, docFilename);
            fs.writeFileSync(docPath, '%PDF-1.4 test document');

            const donorDoc = await Document.create({
                userId: donor._id,
                ownerRole: 'DONOR',
                documentType: 'DONOR_ID',
                originalName: 'passport.pdf',
                filename: docFilename,
                filePath: docPath,
                mimeType: 'application/pdf',
                fileSize: 22
            });

            // Staff A (or another donor) attempts to download Donor's private document
            const unauthorizedDownload = await makeRequest('GET', `/api/documents/${donorDoc._id}`, null, {
                'Cookie': staffACookie
            });

            assert.strictEqual(unauthorizedDownload.status, 403, 'Private donor documents must reject unauthorized access (403)');

            // Clean up test file
            try { fs.unlinkSync(docPath); } catch (e) {}

            console.log('  ✓ [Test 7] Private document ownership verified: Unauthorized users blocked from accessing private donor records.');
            passedCount++;
        }

        // -------------------------------------------------------------
        // TEST 8: Unindexed File Probing & Path Traversal Defense
        // -------------------------------------------------------------
        {
            // 1. Probe for an orphaned file using a valid filename format that does NOT exist in MongoDB
            const validOrphanName = `${Date.now()}-0123456789abcdef.pdf`;
            const probeRes = await makeRequest('GET', `/api/documents/file/${validOrphanName}`);
            assert.strictEqual(probeRes.status, 404);
            assert.strictEqual(probeRes.data.message, 'Document record not found.');

            // 2. Attempt directory traversal and illegal filename characters -> rejected with 400
            const traversalRes = await makeRequest('GET', '/api/documents/file/%2e%2e%2f%2e%2e%2fpackage.json');
            assert.strictEqual(traversalRes.status, 400);
            assert.ok(traversalRes.data.message.includes('Invalid filename format') || traversalRes.data.message.includes('Path traversal'));

            console.log('  ✓ [Test 8] Document storage security verified: Probing unindexed files and directory traversal strictly blocked.');
            passedCount++;
        }

        // -------------------------------------------------------------
        // TEST 9: True Server-Side Session Revocation via Token Versioning
        // -------------------------------------------------------------
        {
            // 1. Profile request with active token -> 200 OK
            const meBeforeLogout = await makeRequest('GET', '/api/auth/me', null, {
                'Authorization': `Bearer ${donorToken}`
            });
            assert.strictEqual(meBeforeLogout.status, 200, 'Authenticated profile retrieval must return 200');

            // 2. Execute Logout (server-side invalidation)
            const logoutRes = await makeRequest('POST', '/api/auth/logout', {}, {
                'Authorization': `Bearer ${donorToken}`,
                'Cookie': donorCookie
            });
            assert.strictEqual(logoutRes.status, 200);

            // 3. User tokenVersion in MongoDB must be incremented
            const updatedUser = await User.findById(donor._id);
            assert.strictEqual(updatedUser.tokenVersion, 1, 'tokenVersion in MongoDB must be incremented upon logout');

            // 4. Reusing the intercepted/stored old token MUST NOW BE REJECTED!
            const meAfterLogout = await makeRequest('GET', '/api/auth/me', null, {
                'Authorization': `Bearer ${donorToken}`
            });
            assert.strictEqual(meAfterLogout.status, 401, 'Old token must be rejected with 401 Session Revoked after logout');
            assert.strictEqual(meAfterLogout.data.message, 'Session has been invalidated or logged out. Please log in again.');

            console.log('  ✓ [Test 9] Server-side token revocation verified: Old JWTs instantly rejected after logout via tokenVersion.');
            passedCount++;
        }

        // -------------------------------------------------------------
        // TEST 10: Anti-CSRF Defense for Ambient Cookie Authentication
        // -------------------------------------------------------------
        {
            // 1. Attempt state-changing mutation with cookie from an unauthorized cross-origin
            const crossOriginAttack = await makeRequest('POST', '/api/requests', {
                bloodGroup: 'A+',
                unitsRequired: 1
            }, {
                'Cookie': staffACookie,
                'Origin': 'https://malicious-cross-origin.com'
            });

            assert.strictEqual(crossOriginAttack.status, 403, 'Cross-origin request with ambient cookies must be rejected with 403 Forbidden');
            assert.ok(
                crossOriginAttack.data.message.includes('CORS blocked') || crossOriginAttack.data.message.includes('CSRF protection'),
                'Must be blocked with forbidden origin message'
            );

            // 2. Attempt simple HTML form-encoded submission with cookie credentials (bypasses CORS preflight)
            const formEncodedAttack = await makeRequest('POST', '/api/requests', 'bloodGroup=A%2B&unitsRequired=1', {
                'Cookie': staffACookie,
                'Content-Type': 'application/x-www-form-urlencoded'
            });
            assert.strictEqual(formEncodedAttack.status, 403, 'Form-encoded submission with ambient cookies must be rejected by anti-CSRF check');
            assert.ok(formEncodedAttack.data.message.includes('CSRF protection'));

            console.log('  ✓ [Test 10] Anti-CSRF protection verified: Malicious cross-origin and form-encoded ambient attacks blocked (403).');
            passedCount++;
        }

    } finally {
        if (server) server.close();
        await mongoose.connection.close();
        if (replSet) {
            await replSet.stop();
        }
    }

    console.log('\n================================================================');
    console.log(`  SECURITY VERIFICATION SUMMARY: ${passedCount} / ${totalTests} PASSED`);
    console.log('================================================================');

    if (passedCount === totalTests) {
        console.log('  🎉 ALL 10 COMPREHENSIVE PRODUCTION SECURITY CHECKS PASSED PERFECTLY!\n');
    } else {
        process.exit(1);
    }
}

runSecuritySuite().catch(err => {
    console.error('\n❌ Security Suite Failed:', err);
    process.exit(1);
});
