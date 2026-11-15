/**
 * RAKT-SETU MODULAR STORAGE ADAPTER
 * Provides a unified abstraction layer for file persistence.
 * - Defaults to Local Disk Storage (development, evaluation, and local testing)
 * - Implements S3-Compatible Cloud Object Storage (AWS S3, Cloudflare R2, MinIO) for production
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
 * Checks if S3/R2 cloud object storage is fully configured with credentials
 */
const isCloudConfigured = () => {
    return Boolean(
        process.env.S3_BUCKET_NAME &&
        process.env.S3_ACCESS_KEY_ID &&
        process.env.S3_SECRET_ACCESS_KEY
    );
};

/**
 * Lazily loads and initializes S3Client instance
 */
let _s3Client = null;
const getS3Client = () => {
    if (_s3Client) return _s3Client;
    if (!isCloudConfigured()) {
        throw new Error('Cloud storage credentials (S3_BUCKET_NAME, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY) are not configured.');
    }
    const { S3Client } = require('@aws-sdk/client-s3');
    _s3Client = new S3Client({
        region: process.env.S3_REGION || 'auto',
        endpoint: process.env.S3_ENDPOINT || undefined,
        credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
        }
    });
    return _s3Client;
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
    if ((provider === 's3' || provider === 'r2') && isCloudConfigured()) {
        try {
            const { HeadObjectCommand } = require('@aws-sdk/client-s3');
            const s3 = getS3Client();
            const key = filename.startsWith('documents/') ? filename : `documents/${filename}`;
            await s3.send(new HeadObjectCommand({
                Bucket: process.env.S3_BUCKET_NAME,
                Key: key
            }));
            return true;
        } catch (err) {
            return false;
        }
    }
    return false;
};

/**
 * Saves a file buffer or existing file to persistent storage
 */
const saveFile = async ({ filename, buffer, mimeType, localPath }) => {
    const provider = getStorageProvider();
    if (provider === 'local') {
        const dest = getSafeLocalPath(filename);
        if (buffer) {
            fs.writeFileSync(dest, buffer);
        } else if (localPath && localPath !== dest) {
            fs.copyFileSync(localPath, dest);
        }
        return { filename, storageProvider: 'local', key: filename, path: dest };
    }

    if (provider === 's3' || provider === 'r2') {
        if (!isCloudConfigured()) {
            throw new Error('Persistent cloud object storage (AWS S3 or Cloudflare R2) is required for document uploads in serverless production.');
        }
        const { PutObjectCommand } = require('@aws-sdk/client-s3');
        const s3 = getS3Client();
        const key = filename.startsWith('documents/') ? filename : `documents/${filename}`;
        const fileContent = buffer || (localPath ? fs.readFileSync(localPath) : null);
        if (!fileContent) {
            throw new Error('No file content provided to save to cloud storage.');
        }

        await s3.send(new PutObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: key,
            Body: fileContent,
            ContentType: mimeType
        }));

        return { filename, storageProvider: provider, key };
    }

    throw new Error(`Unsupported storage provider '${provider}'.`);
};

/**
 * Safely removes a file from storage (used for deletions and orphaned cleanup)
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

    if ((provider === 's3' || provider === 'r2') && isCloudConfigured()) {
        try {
            const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
            const s3 = getS3Client();
            const key = filename.startsWith('documents/') ? filename : `documents/${filename}`;
            await s3.send(new DeleteObjectCommand({
                Bucket: process.env.S3_BUCKET_NAME,
                Key: key
            }));
            return true;
        } catch (err) {
            console.warn(`[StorageAdapter]: Could not delete S3 object '${filename}':`, err.message);
            return false;
        }
    }
    return false;
};

/**
 * Obtains a readable stream for file download/viewing
 */
const getReadStream = async (filename) => {
    const provider = getStorageProvider();
    if (provider === 'local') {
        const safePath = getSafeLocalPath(filename);
        if (!fs.existsSync(safePath)) {
            throw new Error(`File '${filename}' not found on storage.`);
        }
        return fs.createReadStream(safePath);
    }

    if (provider === 's3' || provider === 'r2') {
        if (!isCloudConfigured()) {
            throw new Error('Cloud storage credentials required to stream document.');
        }
        const { GetObjectCommand } = require('@aws-sdk/client-s3');
        const s3 = getS3Client();
        const key = filename.startsWith('documents/') ? filename : `documents/${filename}`;
        const response = await s3.send(new GetObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: key
        }));
        return response.Body; // Readable stream
    }

    throw new Error(`Unsupported storage provider '${provider}'.`);
};

module.exports = {
    uploadDir,
    getStorageProvider,
    isCloudConfigured,
    getSafeLocalPath,
    fileExists,
    saveFile,
    removeFile,
    getReadStream
};
