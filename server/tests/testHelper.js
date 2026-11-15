const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const tempFilesDir = path.resolve(__dirname, 'temp_files');
if (!fs.existsSync(tempFilesDir)) {
    fs.mkdirSync(tempFilesDir, { recursive: true });
}

// Generate valid test file buffers with authentic magic bytes
const createTestFiles = () => {
    // Valid JPEG: starts with FF D8 FF E0
    const jpegPath = path.join(tempFilesDir, 'sample_valid.jpg');
    const jpegBuffer = Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
        0xFF, 0xD9
    ]);
    fs.writeFileSync(jpegPath, jpegBuffer);

    // Valid PNG: starts with 89 50 4E 47 0D 0A 1A 0A
    const pngPath = path.join(tempFilesDir, 'sample_valid.png');
    const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01
    ]);
    fs.writeFileSync(pngPath, pngBuffer);

    // Valid PDF: starts with %PDF-1.4
    const pdfPath = path.join(tempFilesDir, 'sample_valid.pdf');
    const pdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');
    fs.writeFileSync(pdfPath, pdfBuffer);

    // Invalid executable / script (.exe or .sh)
    const exePath = path.join(tempFilesDir, 'malicious_script.exe');
    fs.writeFileSync(exePath, Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xFF\xFF'));

    // Oversized dummy file (> 6MB)
    const oversizedPath = path.join(tempFilesDir, 'oversized_doc.pdf');
    const largeBuffer = Buffer.alloc(6 * 1024 * 1024);
    largeBuffer.write('%PDF-1.4', 0, 'ascii');
    fs.writeFileSync(oversizedPath, largeBuffer);

    return {
        jpegPath,
        pngPath,
        pdfPath,
        exePath,
        oversizedPath
    };
};

const cleanupTestFiles = () => {
    try {
        if (fs.existsSync(tempFilesDir)) {
            const files = fs.readdirSync(tempFilesDir);
            for (const f of files) {
                fs.unlinkSync(path.join(tempFilesDir, f));
            }
            fs.rmdirSync(tempFilesDir);
        }
    } catch (e) {}
};

module.exports = {
    createTestFiles,
    cleanupTestFiles,
    tempFilesDir
};

