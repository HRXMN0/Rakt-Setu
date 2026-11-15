const path = require('path');
const dns = require('dns');

// Only configure external DNS servers in local development when not running on Vercel
// Vercel serverless functions (AWS Lambda) must use the platform's native internal resolver
const isVercelRuntime = process.env.VERCEL === '1' || process.env.VERCEL === 'true' || Boolean(process.env.VERCEL);
const isProdRuntime = process.env.NODE_ENV === 'production';
if (!isVercelRuntime && !isProdRuntime) {
    try {
        dns.setServers(['8.8.8.8', '1.1.1.1']);
    } catch (e) {}
}

const serverEnv = path.resolve(__dirname, '../../.env');
const rootEnv = path.resolve(__dirname, '../../../.env');
require('dotenv').config({ path: serverEnv });
if (!process.env.MONGODB_URI) {
    require('dotenv').config({ path: rootEnv });
}
const mongoose = require('mongoose');

let mongoMemoryServer = null;
let cachedPromise = null;

// Attach connection event handlers to reset cached promise on unexpected drops
if (mongoose.connection) {
    mongoose.connection.on('disconnected', () => {
        cachedPromise = null;
    });
    mongoose.connection.on('close', () => {
        cachedPromise = null;
    });
    mongoose.connection.on('error', () => {
        cachedPromise = null;
    });
}

/**
 * Sanitizes MongoDB connection URIs to avoid exposing credentials in logs.
 */
const sanitizeMongoUri = (uri) => {
    if (!uri || typeof uri !== 'string') return 'unknown';
    return uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
};

/**
 * Sanitizes error messages by masking credentials if any appear.
 */
const sanitizeError = (err) => {
    if (!err) return 'Unknown database error';
    const msg = typeof err === 'string' ? err : (err.message || String(err));
    return msg.replace(/\/\/[^:]+:[^@]+@/g, '//***:***@');
};

/**
 * Returns true if running in production or Vercel serverless deployment.
 */
const isProductionOrVercelEnv = () => {
    return process.env.NODE_ENV === 'production' || process.env.VERCEL === '1' || Boolean(process.env.VERCEL);
};

/**
 * Returns true only if in-memory fallback is explicitly and intentionally enabled
 * for local development or testing. Strictly prohibited in production and Vercel.
 */
const isMemoryDbExplicitlyEnabled = () => {
    if (isProductionOrVercelEnv()) {
        return false;
    }
    return (
        process.env.ENABLE_IN_MEMORY_DB === 'true' ||
        process.env.USE_MEMORY_DB === 'true' ||
        process.env.ALLOW_MEMORY_DB === 'true'
    );
};

/**
 * Connect to MongoDB with connection caching and concurrent cold-start deduplication.
 * Safe for both traditional long-running servers and serverless invocations (Vercel Functions).
 */
const connectDB = async () => {
    // 1. If connection is already open and ready, reuse it immediately (0ms overhead)
    if (mongoose.connection && mongoose.connection.readyState === 1) {
        return mongoose.connection;
    }

    // 2. If a connection attempt is in-flight (connecting or promise active), return existing promise
    if (cachedPromise) {
        return cachedPromise;
    }

    const isProductionOrVercel = isProductionOrVercelEnv();
    const isVercel = process.env.VERCEL === '1' || Boolean(process.env.VERCEL);
    const useReplSetExplicit = !isProductionOrVercel && process.env.USE_REPLICA_SET === 'true';
    const targetDbName = process.env.DB_NAME || 'raktsetu';

    // 3. Optional MongoMemoryReplSet ONLY for local transactional evaluation/testing when explicitly requested
    if (useReplSetExplicit) {
        try {
            console.log('[DB]: Initializing MongoMemoryReplSet for local transactional testing...');
            const { MongoMemoryReplSet } = require('mongodb-memory-server');
            mongoMemoryServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
            const memoryUri = mongoMemoryServer.getUri();
            await mongoose.connect(memoryUri, { dbName: targetDbName });
            console.log(`[MongoMemoryReplSet Connected]: in-memory/${targetDbName} (Database: ${targetDbName})`);

            if (process.env.AUTO_SEED !== 'false') {
                const seedInitialData = require('./seedData');
                await seedInitialData();
            }
            return mongoose.connection;
        } catch (replErr) {
            console.warn('[DB]: MongoMemoryReplSet initialization failed:', replErr.message);
            throw replErr;
        }
    }

    // In production or Vercel, MONGODB_URI is strictly required
    if (isProductionOrVercel && !process.env.MONGODB_URI) {
        const missingErr = new Error('MONGODB_URI environment variable is required in production and Vercel environments.');
        console.error('[DB Fatal Error]: MONGODB_URI environment variable is missing.');
        throw missingErr;
    }

    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/raktsetu';

    // 4. Create shared connection promise to coalesce concurrent cold-start invocations
    cachedPromise = (async () => {
        try {
            console.log(`[DB]: Attempting MongoDB connection to: ${sanitizeMongoUri(mongoUri)}...`);
            await mongoose.connect(mongoUri, {
                dbName: targetDbName,
                authSource: 'admin',
                serverSelectionTimeoutMS: 5000,
                maxPoolSize: 10
            });
            const activeHost = mongoose.connection.host || 'cluster';
            const activeDbName = mongoose.connection.name || mongoose.connection.db?.databaseName || targetDbName;
            console.log(`[MongoDB Connected]: ${activeHost}/${activeDbName} (Database: ${activeDbName})`);

            // Never run automatic seeding or multi-document mutations on request invocations in production or Vercel
            if (!isProductionOrVercel && process.env.AUTO_SEED === 'true') {
                const seedInitialData = require('./seedData');
                await seedInitialData();
            }

            return mongoose.connection;
        } catch (err) {
            cachedPromise = null;
            const sanitizedMsg = sanitizeError(err.message);
            console.error(`[DB Connection Error]: Primary MongoDB connection failed: ${sanitizedMsg}`);

            // In production or Vercel, fallback to in-memory database is strictly forbidden
            if (isProductionOrVercel) {
                console.error(`[DB Fatal Error]: Running in ${isVercel ? 'Vercel' : 'Production'} environment. Fallback to in-memory database is strictly forbidden.`);
                throw err;
            }

            // In local development or test environments, in-memory fallback must be explicitly and intentionally enabled
            if (!isMemoryDbExplicitlyEnabled()) {
                console.error('[DB Fatal Error]: MongoDB connection failed and in-memory database fallback is not explicitly enabled. Set ENABLE_IN_MEMORY_DB=true or USE_MEMORY_DB=true in local development/test.');
                throw err;
            }

            console.log('[DB]: Initializing MongoMemoryServer in-memory fallback (explicitly enabled for local/test)...');
            try {
                let MongoMemoryServer;
                try {
                    MongoMemoryServer = require('mongodb-memory-server').MongoMemoryServer;
                } catch (loadErr) {
                    console.error('[DB Fatal Error]: mongodb-memory-server is not installed. Please provide a valid MONGODB_URI.');
                    throw err;
                }

                mongoMemoryServer = await MongoMemoryServer.create();
                const memoryUri = mongoMemoryServer.getUri();
                await mongoose.connect(memoryUri, { dbName: targetDbName });
                console.log(`[MongoMemoryServer Connected]: in-memory/${targetDbName} (Database: ${targetDbName})`);

                if (process.env.AUTO_SEED !== 'false') {
                    const seedInitialData = require('./seedData');
                    await seedInitialData();
                }
                return mongoose.connection;
            } catch (memErr) {
                console.error(`[DB Fatal Error]: Failed to start in-memory database: ${memErr.message}`);
                throw memErr;
            }
        }
    })();

    try {
        const result = await cachedPromise;
        return result;
    } catch (err) {
        cachedPromise = null;
        throw err;
    }
};

const disconnectDB = async () => {
    cachedPromise = null;
    try {
        if (mongoose.connection && mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
        if (mongoMemoryServer) {
            await mongoMemoryServer.stop();
            mongoMemoryServer = null;
        }
    } catch (err) {
        console.error('[DB Disconnect Error]:', err.message);
    }
};

const getMongoMemoryServerInstance = () => mongoMemoryServer;

module.exports = {
    connectDB,
    disconnectDB,
    sanitizeMongoUri,
    sanitizeError,
    isProductionOrVercelEnv,
    isMemoryDbExplicitlyEnabled,
    getMongoMemoryServerInstance
};
