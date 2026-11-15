/**
 * RAKT-SETU MODULAR STORAGE ADAPTER
 * Provides a unified abstraction layer for file persistence.
 * - Defaults to Local Disk Storage (development, evaluation, and local servers)
 * - Prepared for S3-Compatible Cloud Object Storage (AWS S3, Cloudflare R2, MinIO)
 */

const fs = require('fs');
const path = require('path');

const uploadDir = path.resolve(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const getStorageProvider = () => {
    return process.env.STORAGE_PROVIDER || 'local';
};

/**
 * Resolves safe local filesystem path, preventing path traversal
 */
const getSafeLocalPath = (filename) => {
    const cleanBasename = path.basename(filename);
    return path.resolve(uploadDir, cleanBasename);
};

/**
 * Checks if file exists on storage
 */
const fileExists = async (filename) => {
    const provider = getStorageProvider();
    if (provider === 'local') {
        const safePath = getSafeLocalPath(filename);
        return fs.existsSync(safePath);
    }
    // S3 implementation hook
    return false;
};

/**
 * Safely removes a file from storage
 */
const removeFile = async (filename) => {
    const provider = getStorageProvider();
    if (provider === 'local') {
        const safePath = getSafeLocalPath(filename);
        if (fs.existsSync(safePath)) {
            try {
                fs.unlinkSync(safePath);
                return true;
            } catch (err) {
                console.warn(`[StorageAdapter]: Could not delete file '${filename}':`, err.message);
                return false;
            }
        }
        return false;
    }
    return false;
};

/**
 * Obtains a readable stream for file download/viewing
 */
const getReadStream = (filename) => {
    const provider = getStorageProvider();
    if (provider === 'local') {
        const safePath = getSafeLocalPath(filename);
        if (!fs.existsSync(safePath)) {
            throw new Error(`File '${filename}' not found on storage.`);
        }
        return fs.createReadStream(safePath);
    }
    throw new Error(`Cloud streaming provider '${provider}' requires S3 credentials configuration.`);
};

module.exports = {
    uploadDir,
    getStorageProvider,
    getSafeLocalPath,
    fileExists,
    removeFile,
    getReadStream
};
