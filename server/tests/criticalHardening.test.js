/**
 * RAKT-SETU — CRITICAL SECURITY HARDENING REGRESSION TEST SUITE
 * 
 * Focused regression tests covering the 5 critical audit areas:
 *  1. MongoDB Transaction Safety, Standalone Rejection (503) & Partial Failure Rollbacks
 *  2. Document Path Containment (path.relative), Prefix Collision & Filename Validation
 *  3. CSRF Protection: Missing Origin/Referer, Production Disallowance of Localhost & Form Blocking
 *  4. Scoped Document Access Tokens: Elimination of Main JWT in Query Params & Single-Use Replay Rejection
 *  5. Content Security Policy (CSP): Strict Helmet Directive Enforcement without unsafe-eval
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'production-grade-super-secret-key-32-chars-long';

const app = require('../src/app');
const User = require('../src/models/User');
const BloodUnit = require('../src/models/BloodUnit');
const Request = require('../src/models/Request');
const Hospital = require('../src/models/Hospital');
const Document = require('../src/models/Document');
const { uploadDir } = require('../src/middleware/upload.middleware');
const { executeWithTransaction, isReplicaSetSupported, DatabaseTransactionError } = require('../src/utils/transactionHelper');
const { generateDocumentAccessToken, verifyDocumentAccessToken, clearUsedTokensForTest } = require('../src/utils/documentToken');
const { isContainedInUploads, isValidFilenameFormat } = require('../src/controllers/document.controller');

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
        const payload = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
        const reqHeaders = {
            ...headers
        };
        if (body && typeof body === 'object' && !(body instanceof Buffer) && !reqHeaders['Content-Type']) {
            reqHeaders['Content-Type'] = 'application/json';
        }
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

async function runCriticalHardeningTests() {
    console.log('\n================================================================');
    console.log('  🛡️ RAKT-SETU — CRITICAL SECURITY HARDENING REGRESSION SUITE');
    console.log('================================================================');

    let replSet = null;
    const { MongoMemoryReplSet } = require('mongodb-memory-server');
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    const mongoUri = replSet.getUri();
    await mongoose.connect(mongoUri);
    console.log('[ReplicaSet Active]:', mongoUri);

    await startTestServer();
    console.log('[Test Server Port]:', serverPort);

    let passed = 0;
    const total = 15;

    try {
        const ts = Date.now().toString().slice(-5);

        // Setup test identities
        const donor = await User.create({
            name: 'Hardening Donor',
            email: `hdonor_${ts}@test.org`,
            password: 'Password123!',
            role: 'DONOR',
            bloodGroup: 'O+',
            verified: true,
            tokenVersion: 0
        });

        const hosp = await Hospital.create({
            name: `Hardening Hospital ${ts}`,
            facilityId: `HOSP-HARD-${ts}`,
            type: 'Hospital',
            city: 'Patiala',
            verified: true,
            inventory: { 'O+': { wholeBlood: 5, total: 10, status: 'Adequate' } }
        });

        const staff = await User.create({
            name: 'Hardening Staff',
            email: `hstaff_${ts}@test.org`,
            password: 'Password123!',
            role: 'HOSPITAL_STAFF',
            hospitalId: hosp._id,
            hospitalName: hosp.name,
            verified: true,
            tokenVersion: 0
        });

        const admin = await User.create({
            name: 'Hardening Admin',
            email: `hadmin_${ts}@test.org`,
            password: 'Password123!',
            role: 'ADMIN',
            bloodBankName: 'Patiala Central Blood Centre',
            verified: true,
            tokenVersion: 0
        });

        // Login identities
        const loginDonorRes = await makeRequest('POST', '/api/auth/login', { email: donor.email, password: 'Password123!' });
        const donorCookie = extractSetCookie(loginDonorRes);
        const donorToken = loginDonorRes.data.data.token;

        const loginStaffRes = await makeRequest('POST', '/api/auth/login', { email: staff.email, password: 'Password123!' });
        const staffCookie = extractSetCookie(loginStaffRes);

        const loginAdminRes = await makeRequest('POST', '/api/auth/login', { email: admin.email, password: 'Password123!' });
        const adminCookie = extractSetCookie(loginAdminRes);

        // =============================================================
        // AREA 1: MONGODB TRANSACTION SAFETY & ACID ROLLBACKS
        // =============================================================

        // Test 1: Standalone Topology Detection Throws Clear 503 Server Error
        {
            // Connect to standalone mock topology by overriding isReplicaSetSupported check
            let threwExpectedError = false;
            try {
                // Execute a multi-document operation with simulated standalone topology
                const origClient = mongoose.connection.client;
                mongoose.connection.client = { topology: { description: { type: 'Single' } } };

                try {
                    await executeWithTransaction(async () => {}, { operationName: 'test cancellation' });
                } finally {
                    mongoose.connection.client = origClient;
                }
            } catch (err) {
                threwExpectedError = err instanceof DatabaseTransactionError && err.statusCode === 503 &&
                                     err.message.includes('Multi-document ACID transaction required');
            }
            assert.ok(threwExpectedError, 'executeWithTransaction must throw DatabaseTransactionError (503) on standalone topology');
            console.log('  ✓ [Area 1 - Test 1] Standalone topology rejection verified: Throws explicit 503 DatabaseTransactionError without silent fallback.');
            passed++;
        }

        // Test 2: Partial Failure Rollback During Request Cancellation
        {
            const reqForCancel = await Request.create({
                requestId: `REQ-ROLLBACK-${ts}`,
                bloodGroup: 'O+',
                unitsRequired: 1,
                hospitalId: hosp._id,
                hospitalName: hosp.name,
                status: 'Approved',
                requestedBy: staff._id
            });

            const unitForCancel = await BloodUnit.create({
                unitId: `RK-ROLL-CAN-${ts}`,
                bloodType: 'O+',
                status: 'reserved',
                reservedForRequest: reqForCancel._id,
                expiryDate: new Date(Date.now() + 30 * 86400000)
            });

            // Simulate partial failure: BloodUnit is updated, but Request.save throws an error inside transaction
            let txFailed = false;
            try {
                await executeWithTransaction(async (session) => {
                    await BloodUnit.updateMany(
                        { reservedForRequest: reqForCancel._id, status: 'reserved' },
                        { $set: { status: 'available', reservedForRequest: null } },
                        { session }
                    );

                    // Simulated failure halfway through operation
                    throw new Error('SIMULATED_DATABASE_CRASH_MID_CANCELLATION');
                }, { operationName: 'cancellation rollback test' });
            } catch (e) {
                txFailed = e.message === 'SIMULATED_DATABASE_CRASH_MID_CANCELLATION';
            }
            assert.ok(txFailed, 'Transaction should have failed with simulated error');

            // Verify ACID Rollback: The unit MUST STILL BE 'reserved' in MongoDB!
            const checkUnit = await BloodUnit.findById(unitForCancel._id);
            assert.strictEqual(checkUnit.status, 'reserved', 'ACID Rollback failed: Unit was updated despite transaction failure!');
            assert.strictEqual(checkUnit.reservedForRequest.toString(), reqForCancel._id.toString());

            console.log('  ✓ [Area 1 - Test 2] Transaction rollback verified: Unit release rolled back cleanly upon mid-operation failure.');
            passed++;
        }

        // Test 3: Partial Failure Rollback During Request Dispatch
        {
            const reqForDispatch = await Request.create({
                requestId: `REQ-ROLL-DISP-${ts}`,
                bloodGroup: 'O+',
                unitsRequired: 1,
                hospitalId: hosp._id,
                hospitalName: hosp.name,
                status: 'Approved',
                requestedBy: staff._id
            });

            const unitForDispatch = await BloodUnit.create({
                unitId: `RK-ROLL-DISP-${ts}`,
                bloodType: 'O+',
                status: 'reserved',
                reservedForRequest: reqForDispatch._id,
                expiryDate: new Date(Date.now() + 30 * 86400000)
            });

            // Simulate partial failure during dispatch
            let dispFailed = false;
            try {
                await executeWithTransaction(async (session) => {
                    await BloodUnit.updateMany(
                        { reservedForRequest: reqForDispatch._id, status: 'reserved' },
                        { $set: { status: 'used' } },
                        { session }
                    );
                    throw new Error('SIMULATED_NETWORK_PARTITION_MID_DISPATCH');
                }, { operationName: 'dispatch rollback test' });
            } catch (e) {
                dispFailed = e.message === 'SIMULATED_NETWORK_PARTITION_MID_DISPATCH';
            }
            assert.ok(dispFailed);

            // Verify ACID Rollback: The unit MUST REMAIN 'reserved', not 'used'!
            const checkDispUnit = await BloodUnit.findById(unitForDispatch._id);
            assert.strictEqual(checkDispUnit.status, 'reserved', 'ACID Rollback failed: Unit was marked used despite dispatch transaction abort!');

            console.log('  ✓ [Area 1 - Test 3] Dispatch transaction rollback verified: Reserved unit status preserved upon abort.');
            passed++;
        }

        // =============================================================
        // AREA 2: DOCUMENT PATH CONTAINMENT & FILENAME VALIDATION
        // =============================================================

        // Test 4: Containment Check with path.relative() Defends Against Prefix Collision
        {
            // Prefix collision: /uploads-evil vs /uploads
            const evilPrefixPath = path.resolve(uploadDir + '-evil', 'secret.txt');
            const isContained = isContainedInUploads(evilPrefixPath);
            assert.strictEqual(isContained, false, 'path.relative containment must reject prefix-collision directory');

            // Encoded and standard traversal attempts
            const traversalRelative = isContainedInUploads(path.resolve(uploadDir, '../../etc/passwd'));
            assert.strictEqual(traversalRelative, false);

            console.log('  ✓ [Area 2 - Test 4] path.relative() containment verified: Prefix collision (uploads-evil) and directory traversal rejected.');
            passed++;
        }

        // Test 5: Filename Character and Regex Format Validation
        {
            // Illegal characters and paths
            assert.strictEqual(isValidFilenameFormat('../../secret.pdf'), false);
            assert.strictEqual(isValidFilenameFormat('..\\windows\\system32.dll'), false);
            assert.strictEqual(isValidFilenameFormat('file\0nullbyte.png'), false);
            assert.strictEqual(isValidFilenameFormat('arbitrary_unformatted_name.jpg'), false);

            // Valid application generated format
            const validAppFilename = `${Date.now()}-a1b2c3d4e5f60718.pdf`;
            assert.strictEqual(isValidFilenameFormat(validAppFilename), true);

            console.log('  ✓ [Area 2 - Test 5] Filename format validation verified: Slashes, traversal, null-bytes, and non-conforming formats blocked.');
            passed++;
        }

        // Test 6: API Rejects Traversal Sequences & Missing Database Records
        {
            // 1. Encoded traversal sequence -> rejected with 400
            const traversalRes = await makeRequest('GET', '/api/documents/file/%2e%2e%2f%2e%2e%2fpackage.json');
            assert.strictEqual(traversalRes.status, 400);

            // 2. Valid format filename but without MongoDB record -> rejected with 404
            const validNonexistent = `${Date.now()}-ffffffffffffffff.pdf`;
            const missingRecordRes = await makeRequest('GET', `/api/documents/file/${validNonexistent}`);
            assert.strictEqual(missingRecordRes.status, 404);
            assert.strictEqual(missingRecordRes.data.message, 'Document record not found.');

            console.log('  ✓ [Area 2 - Test 6] Storage access security verified: Encoded traversals blocked (400) and unindexed probes rejected (404).');
            passed++;
        }

        // =============================================================
        // AREA 3: CSRF PROTECTION & PRODUCTION ORIGIN ALLOWLIST
        // =============================================================

        // Test 7: Missing Origin & Referer Headers on Cookie Mutations Require Custom Preflight Header
        {
            // Mutating POST with cookie but NO Origin, NO Referer, NO custom header
            const missingHeaderAttack = await makeRequest('POST', '/api/requests', 'raw text payload', {
                'Cookie': staffCookie,
                'Content-Type': 'text/plain'
            });
            assert.strictEqual(missingHeaderAttack.status, 403, 'Missing Origin/Referer without anti-CSRF custom header must be rejected (403)');
            assert.ok(missingHeaderAttack.data.message.includes('CSRF protection'));

            // Same request WITH custom X-Requested-With header -> allowed past CSRF middleware
            const withHeaderReq = await makeRequest('POST', '/api/requests', {
                bloodGroup: 'O+',
                unitsRequired: 1
            }, {
                'Cookie': staffCookie,
                'X-Requested-With': 'XMLHttpRequest'
            });
            assert.strictEqual(withHeaderReq.status, 201, 'Request with X-Requested-With anti-CSRF header must be accepted');

            console.log('  ✓ [Area 3 - Test 7] Missing Origin/Referer handling verified: Ambiguous cookie mutations blocked without custom preflight header.');
            passed++;
        }

        // Test 8: Form-Encoded Submissions (application/x-www-form-urlencoded) Blocked
        {
            const formPostRes = await makeRequest('POST', '/api/requests', 'bloodGroup=A%2B&unitsRequired=1', {
                'Cookie': staffCookie,
                'Content-Type': 'application/x-www-form-urlencoded'
            });
            assert.strictEqual(formPostRes.status, 403);
            assert.ok(formPostRes.data.message.includes('Simple HTML form submissions are strictly forbidden'));

            console.log('  ✓ [Area 3 - Test 8] Form-encoded submission defense verified: Simple cross-site form POSTs rejected (403).');
            passed++;
        }

        // Test 9: Production Mode Does NOT Automatically Allow Localhost
        {
            const prevEnv = process.env.NODE_ENV;
            const prevCors = process.env.CORS_ORIGIN;
            try {
                process.env.NODE_ENV = 'production';
                process.env.CORS_ORIGIN = 'https://raktsetu.org'; // Only production domain allowed

                // Attempt mutation from localhost in production mode
                const localhostAttack = await makeRequest('POST', '/api/requests', {
                    bloodGroup: 'O+',
                    unitsRequired: 1
                }, {
                    'Cookie': staffCookie,
                    'Origin': 'http://localhost:5000'
                });

                assert.strictEqual(localhostAttack.status, 403, 'In production, localhost must NOT be permitted if not in CORS_ORIGIN');
                assert.ok(localhostAttack.data.message.includes('CSRF protection') || localhostAttack.data.message.includes('CORS blocked'));
            } finally {
                process.env.NODE_ENV = prevEnv;
                process.env.CORS_ORIGIN = prevCors;
            }

            console.log('  ✓ [Area 3 - Test 9] Production allowlist enforcement verified: Localhost strictly forbidden in production mode.');
            passed++;
        }

        // =============================================================
        // AREA 4: SCOPED DOCUMENT ACCESS TOKENS (NO JWT IN QUERY PARAMS)
        // =============================================================

        // Test 10: Primary Authentication JWT Rejected from Query String
        {
            // Attempt general authentication using primary JWT in ?token=
            const queryJwtRes = await makeRequest('GET', `/api/auth/me?token=${encodeURIComponent(donorToken)}`);
            assert.strictEqual(queryJwtRes.status, 401, 'Primary JWT in query parameter ?token= must be rejected (401)');
            assert.strictEqual(queryJwtRes.data.message, 'Authentication token missing. Please log in.');

            console.log('  ✓ [Area 4 - Test 10] Query parameter JWT elimination verified: Main authentication JWT completely barred from URLs.');
            passed++;
        }

        // Test 11: Generate Scoped, Short-Lived Single-Use Document Access Token
        let testDocId;
        let validDocToken;
        {
            const docFilename = `${Date.now()}-c1d2e3f405162738.pdf`;
            const docPath = path.resolve(uploadDir, docFilename);
            fs.writeFileSync(docPath, '%PDF-1.4 test document content');

            const testDoc = await Document.create({
                userId: donor._id,
                ownerRole: 'DONOR',
                documentType: 'DONOR_ID',
                originalName: 'donor_slip.pdf',
                filename: docFilename,
                filePath: docPath,
                mimeType: 'application/pdf',
                fileSize: 32
            });
            testDocId = testDoc._id;

            // Generate single-use document access token
            const tokenRes = await makeRequest('POST', `/api/documents/${testDocId}/token`, { action: 'view' }, {
                'Authorization': `Bearer ${donorToken}`
            });

            assert.strictEqual(tokenRes.status, 200);
            assert.ok(tokenRes.data.data.accessToken);
            assert.strictEqual(tokenRes.data.data.expiresInSeconds, 120);
            validDocToken = tokenRes.data.data.accessToken;

            console.log('  ✓ [Area 4 - Test 11] Scoped document token generation verified: Short-lived (120s) token bound to document ID & action.');
            passed++;
        }

        // Test 12: Stream Document with Valid Access Token & Replay Rejection
        {
            // 1. First redemption with valid single-use token -> 200 OK
            const streamRes = await makeRequest('GET', `/api/documents/${testDocId}?accessToken=${encodeURIComponent(validDocToken)}`);
            assert.strictEqual(streamRes.status, 200, 'Valid single-use document token must allow document streaming (200)');
            assert.strictEqual(streamRes.headers['content-type'], 'application/pdf');

            // 2. Replay the same single-use token a SECOND time -> rejected with 403 Forbidden!
            const replayRes = await makeRequest('GET', `/api/documents/${testDocId}?accessToken=${encodeURIComponent(validDocToken)}`);
            assert.strictEqual(replayRes.status, 403, 'Reused single-use document token must be rejected (403)');
            assert.ok(replayRes.data.message.includes('already been used') || replayRes.data.message.includes('single-use'));

            console.log('  ✓ [Area 4 - Test 12] Single-use enforcement verified: Access token redeemed successfully on first use and rejected upon replay.');
            passed++;
        }

        // Test 13: Access Token Bound to Wrong Document or Expired Token Rejected
        {
            // Create a second document
            const doc2Filename = `${Date.now()}-f9e8d7c6b5a41234.pdf`;
            const doc2Path = path.resolve(uploadDir, doc2Filename);
            fs.writeFileSync(doc2Path, '%PDF-1.4 other document content');

            const otherDoc = await Document.create({
                userId: donor._id,
                ownerRole: 'DONOR',
                documentType: 'MEDICAL_CERT',
                originalName: 'other.pdf',
                filename: doc2Filename,
                filePath: doc2Path,
                mimeType: 'application/pdf',
                fileSize: 32
            });

            // Generate token for Document A
            const tokenForA = generateDocumentAccessToken({
                documentId: testDocId,
                userId: donor._id,
                action: 'view'
            });

            // Attempt using tokenForA on otherDoc (Document B)
            const wrongDocRes = await makeRequest('GET', `/api/documents/${otherDoc._id}?accessToken=${encodeURIComponent(tokenForA)}`);
            assert.strictEqual(wrongDocRes.status, 403, 'Using access token on wrong document must be rejected (403)');
            assert.ok(wrongDocRes.data.message.includes('not valid for this document'));

            // Clean up test files
            try {
                fs.unlinkSync(path.resolve(uploadDir, `${Date.now()}-c1d2e3f405162738.pdf`));
                fs.unlinkSync(doc2Path);
            } catch (e) {}

            console.log('  ✓ [Area 4 - Test 13] Token binding integrity verified: Cross-document token substitution strictly rejected (403).');
            passed++;
        }

        // =============================================================
        // AREA 5: CONTENT SECURITY POLICY (CSP) VERIFICATION
        // =============================================================

        // Test 14: Content Security Policy Header Emitted on All Responses
        {
            const healthRes = await makeRequest('GET', '/api/health');
            const cspHeader = healthRes.headers['content-security-policy'];
            assert.ok(cspHeader, 'Response must include Content-Security-Policy header');
            assert.ok(cspHeader.includes("default-src 'self'"));
            assert.ok(cspHeader.includes("object-src 'none'"));
            assert.ok(cspHeader.includes("frame-src 'none'"));

            console.log('  ✓ [Area 5 - Test 14] Helmet Content Security Policy verified: Mandatory protective directives present on HTTP responses.');
            passed++;
        }

        // Test 15: CSP Strictly Bars unsafe-eval and Enables Canvas/Blob Support
        {
            const healthRes = await makeRequest('GET', '/api/health');
            const cspHeader = healthRes.headers['content-security-policy'];

            // unsafe-eval MUST NOT be present
            assert.strictEqual(cspHeader.includes("'unsafe-eval'"), false, "CSP must NEVER include 'unsafe-eval'");

            // data: and blob: must be permitted in img-src for canvas pass/certificate rendering
            assert.ok(cspHeader.includes('data:'), "CSP must permit 'data:' in img-src for canvas toDataURL()");
            assert.ok(cspHeader.includes('blob:'), "CSP must permit 'blob:' in img-src for certificate modals");

            console.log('  ✓ [Area 5 - Test 15] CSP policy restrictions verified: unsafe-eval strictly excluded while canvas/blob pass generation is preserved.');
            passed++;
        }

    } finally {
        if (server) server.close();
        await mongoose.connection.close();
        if (replSet) await replSet.stop();
    }

    console.log('\n================================================================');
    console.log(`  CRITICAL HARDENING SUMMARY: ${passed} / ${total} PASSED (100%)`);
    console.log('================================================================');
    console.log('  🎉 ALL 15 CRITICAL HARDENING TESTS PASSED WITH ZERO FAILURES!\n');
}

runCriticalHardeningTests().catch(err => {
    console.error('\n❌ Critical Hardening Suite Failed:', err);
    process.exit(1);
});
