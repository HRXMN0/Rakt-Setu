const http = require('http');
const fs = require('fs');
const path = require('path');

function makeRequest(options, postData) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    resolve({ status: res.statusCode, headers: res.headers, body: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, headers: res.headers, raw: body });
                }
            });
        });
        req.on('error', reject);
        if (postData) {
            req.write(postData);
        }
        req.end();
    });
}

async function run() {
    console.log("=== Testing Registration & Upload Flow ===");
    const testEmail = `newdonor_${Date.now()}@raktsetu.org`;
    const regPayload = JSON.stringify({
        name: "Test New Donor",
        email: testEmail,
        password: "Password@123",
        confirmPassword: "Password@123",
        role: "DONOR",
        bloodGroup: "O+",
        phone: "+91 98765 43210",
        city: "Patiala",
        area: "Model Town"
    });

    console.log("1. Registering donor...");
    const regRes = await makeRequest({
        hostname: 'localhost',
        port: 5000,
        path: '/api/auth/register',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(regPayload)
        }
    }, regPayload);

    console.log("Registration status:", regRes.status, regRes.body);
    if (!regRes.body || !regRes.body.data || !regRes.body.data.token) {
        console.error("Failed to get token!");
        return;
    }
    const token = regRes.body.data.token;
    console.log("Got token successfully!");

    // Create a dummy valid PNG file with PNG magic bytes (89 50 4E 47 0D 0A 1A 0A)
    const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]);
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';

    // 2. Upload Profile Photo
    console.log("\n2. Uploading profile photo...");
    let photoBody = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="avatar.png"\r\nContent-Type: image/png\r\n\r\n`),
        pngHeader,
        Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    const photoRes = await makeRequest({
        hostname: 'localhost',
        port: 5000,
        path: '/api/donors/profile/photo',
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': photoBody.length
        }
    }, photoBody);

    console.log("Photo upload status:", photoRes.status, photoRes.body);

    // 3. Upload Document
    console.log("\n3. Uploading document...");
    const pdfHeader = Buffer.from('%PDF-1.4\n%test pdf content\n');
    let docBody = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="document"; filename="donor_id.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
        pdfHeader,
        Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="documentType"\r\n\r\nDONOR_ID\r\n`),
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="description"\r\n\r\nGovernment Aadhaar ID\r\n`),
        Buffer.from(`--${boundary}--\r\n`)
    ]);

    const docRes = await makeRequest({
        hostname: 'localhost',
        port: 5000,
        path: '/api/donors/documents',
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': docBody.length
        }
    }, docBody);

    console.log("Document upload status:", docRes.status, docRes.body);

    // 4. Get Documents
    console.log("\n4. Getting documents...");
    const getDocsRes = await makeRequest({
        hostname: 'localhost',
        port: 5000,
        path: '/api/donors/documents',
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    console.log("Get docs status:", getDocsRes.status, getDocsRes.body);
}

run().catch(console.error);
