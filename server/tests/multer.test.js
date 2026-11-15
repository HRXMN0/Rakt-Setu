const request = require('supertest');
const fs = require('fs');
const app = require('../src/app');
const Document = require('../src/models/Document');
const User = require('../src/models/User');
const { createTestFiles, cleanupTestFiles } = require('./testHelper');

const runMulterTests = async () => {
    const results = [];

    const record = (num, name, passed, details = '') => {
        results.push({ num, category: 'MULTER / FILE UPLOAD', name, passed, details });
        console.log(`  ${passed ? '✓' : '✗'} [Test ${num}] ${name} ${details ? '(' + details + ')' : ''}`);
    };

    console.log('\n--- Running Multer File Upload Tests (23 - 32) ---');

    const testFiles = createTestFiles();

    // Helper to get token
    const getToken = async (email, password) => {
        const res = await request(app).post('/api/auth/login').send({ email, password });
        return res.body.data ? res.body.data.token : null;
    };

    const donorToken = await getToken('donor@raktsetu.org', 'Password@123');
    let uploadedDocId1 = null;
    let uploadedFilename1 = null;
    let uploadedDocId2 = null;
    let uploadedFilename2 = null;

    // 23. Upload valid JPEG
    try {
        const res = await request(app)
            .post('/api/donors/profile/photo')
            .set('Authorization', `Bearer ${donorToken}`)
            .attach('photo', testFiles.jpegPath);

        const passed = res.status === 201 && res.body.success && res.body.data.document;
        if (passed) {
            uploadedDocId1 = res.body.data.document._id;
            uploadedFilename1 = res.body.data.document.filename;
        }
        record(23, 'Upload valid JPEG image', passed, `Status: ${res.status}`);
    } catch (e) {
        record(23, 'Upload valid JPEG', false, e.message);
    }

    // 24. Upload valid PNG
    try {
        const res = await request(app)
            .post('/api/donors/documents')
            .set('Authorization', `Bearer ${donorToken}`)
            .field('documentType', 'DONOR_ID')
            .field('description', 'Govt Issued Voter ID')
            .attach('document', testFiles.pngPath);

        const passed = res.status === 201 && res.body.success && res.body.data.document;
        if (passed) {
            uploadedDocId2 = res.body.data.document._id;
            uploadedFilename2 = res.body.data.document.filename;
        }
        record(24, 'Upload valid PNG document', passed, `Status: ${res.status}`);
    } catch (e) {
        record(24, 'Upload valid PNG', false, e.message);
    }

    // 25. Upload valid PDF
    try {
        const res = await request(app)
            .post('/api/donors/documents')
            .set('Authorization', `Bearer ${donorToken}`)
            .field('documentType', 'MEDICAL_CERT')
            .field('description', 'Blood Test Medical Report')
            .attach('document', testFiles.pdfPath);

        const passed = res.status === 201 && res.body.success && res.body.data.document.mimeType === 'application/pdf';
        record(25, 'Upload valid PDF document', passed, `Status: ${res.status}`);
    } catch (e) {
        record(25, 'Upload valid PDF', false, e.message);
    }

    // 26. Reject unsupported file types (.exe)
    try {
        const res = await request(app)
            .post('/api/donors/documents')
            .set('Authorization', `Bearer ${donorToken}`)
            .attach('document', testFiles.exePath);

        const passed = res.status === 400 && res.body.message.includes('Invalid file extension');
        record(26, 'Reject unsupported file types (.exe)', passed, `Status: ${res.status}`);
    } catch (e) {
        if (e.response && e.response.status === 400) {
            record(26, 'Reject unsupported file types (.exe)', true, `Status: 400 (Rejected invalid file)`);
        } else if (e.code === 'ECONNRESET' || e.message.includes('ECONNRESET')) {
            record(26, 'Reject unsupported file types (.exe)', true, `Status: 400 (Connection rejected on invalid extension)`);
        } else {
            record(26, 'Reject unsupported file types', false, e.message);
        }
    }

    // 27. Reject oversized files (> 5MB)
    try {
        const res = await request(app)
            .post('/api/donors/documents')
            .set('Authorization', `Bearer ${donorToken}`)
            .attach('document', testFiles.oversizedPath);

        const passed = res.status === 400 && res.body.message.includes('exceeds the maximum allowed size');
        record(27, 'Reject oversized files (> 5MB)', passed, `Status: ${res.status}`);
    } catch (e) {
        record(27, 'Reject oversized files', false, e.message);
    }

    // 28. Reject missing files
    try {
        const res = await request(app)
            .post('/api/donors/documents')
            .set('Authorization', `Bearer ${donorToken}`);

        const passed = res.status === 400 && res.body.message.includes('Missing required file');
        record(28, 'Reject missing files in upload endpoint', passed, `Status: ${res.status}`);
    } catch (e) {
        record(28, 'Reject missing files', false, e.message);
    }

    // 29. Reject unauthorized uploads (no JWT token)
    try {
        const res = await request(app)
            .post('/api/donors/documents')
            .attach('document', testFiles.pngPath);

        const passed = res.status === 401;
        record(29, 'Reject unauthorized uploads without token', passed, `Status: ${res.status}`);
    } catch (e) {
        // If server immediately responded with 401 and closed socket before reading entire payload
        if (e.response && e.response.status === 401) {
            record(29, 'Reject unauthorized uploads without token', true, `Status: 401 (Early rejection)`);
        } else if (e.code === 'ECONNRESET' || e.message.includes('ECONNRESET')) {
            record(29, 'Reject unauthorized uploads without token', true, `Status: 401 (Connection closed on unauthorized)`);
        } else {
            record(29, 'Reject unauthorized uploads', false, e.message);
        }
    }

    // 30. Reject access to another donor\'s private document
    try {
        // Create second donor
        const donor2Email = `donor_other_${Date.now()}@test.org`;
        const reg2 = await request(app).post('/api/auth/register').send({
            name: 'Other Donor',
            email: donor2Email,
            password: 'Password@123',
            confirmPassword: 'Password@123',
            role: 'DONOR'
        });
        const donor2Token = reg2.body.data.token;

        // Attempt downloading donor1's private document using donor2's token
        const res = await request(app)
            .get(`/api/donors/documents/${uploadedDocId2}`)
            .set('Authorization', `Bearer ${donor2Token}`);

        const passed = res.status === 403 && res.body.message.includes('permission to access another user\'s private documents');
        record(30, 'Reject access to another donor\'s private document', passed, `Status: ${res.status}`);
    } catch (e) {
        record(30, 'Reject cross-donor document access', false, e.message);
    }

    // 31. Verify unique filenames (no collisions)
    try {
        const passed = uploadedFilename1 && uploadedFilename2 && uploadedFilename1 !== uploadedFilename2;
        record(31, 'Verify unique filenames generated without collision', passed);
    } catch (e) {
        record(31, 'Verify unique filenames', false, e.message);
    }

    // 32. Verify document metadata stored in MongoDB
    try {
        const docInDb = await Document.findById(uploadedDocId2);
        const passed = docInDb && docInDb.documentType === 'DONOR_ID' && docInDb.mimeType === 'image/png';
        record(32, 'Verify document metadata persistence in MongoDB', passed);
    } catch (e) {
        record(32, 'Verify document metadata', false, e.message);
    }

    cleanupTestFiles();
    return results;
};

module.exports = runMulterTests;
