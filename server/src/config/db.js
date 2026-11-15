const path = require('path');
const dns = require('dns');
try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}
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
 * Connect to MongoDB with connection caching and concurrent cold-start deduplication.
 * Safe for both traditional long-running servers and serverless invocations (Vercel Functions).
 */
const connectDB = async () => {
    // 1. If connection is already open and ready, reuse it immediately (0ms overhead)
    if (mongoose.connection && mongoose.connection.readyState === 1) {
        return mongoose.connection;
    }

    // 2. If a connection attempt is already in flight (e.g. concurrent cold start requests), return the shared promise
    if (cachedPromise && mongoose.connection && mongoose.connection.readyState === 2) {
        return cachedPromise;
    }

    const isProduction = process.env.NODE_ENV === 'production';
    const useReplSetExplicit = process.env.USE_REPLICA_SET === 'true';
    const targetDbName = process.env.DB_NAME || 'raktsetu';

    // 3. Optional MongoMemoryReplSet for local transactional evaluation/testing
    if (useReplSetExplicit && !isProduction) {
        try {
            console.log('[DB]: Initializing MongoMemoryReplSet for transactional evaluation...');
            const { MongoMemoryReplSet } = require('mongodb-memory-server');
            mongoMemoryServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
            const memoryUri = mongoMemoryServer.getUri();
            const conn = await mongoose.connect(memoryUri, { dbName: targetDbName });
            console.log(`[MongoMemoryReplSet Connected]: ${memoryUri}/${targetDbName} (Database: ${targetDbName})`);

            // Optional auto-seed for test/eval
            if (process.env.AUTO_SEED !== 'false') {
                const seedInitialData = require('./seedData');
                await seedInitialData();
            }
            return conn;
        } catch (replErr) {
            console.warn('[DB]: MongoMemoryReplSet initialization failed:', replErr.message);
        }
    }

    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/raktsetu';

    // 4. Create shared connection promise to coalesce concurrent cold-start invocations
    cachedPromise = (async () => {
        try {
            const maskedUri = mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
            console.log(`[DB]: Attempting MongoDB connection to: ${maskedUri}...`);
            const targetDbName = process.env.DB_NAME || 'raktsetu';
            const conn = await mongoose.connect(mongoUri, {
                dbName: targetDbName,
                authSource: 'admin',
                serverSelectionTimeoutMS: 5000,
                maxPoolSize: 10
            });
            const activeDbName = conn.connection.name || conn.connection.db?.databaseName || targetDbName;
            console.log(`[MongoDB Connected]: ${conn.connection.host}/${activeDbName} (Database: ${activeDbName})`);

            // Never run automatic seeding or multi-document mutations on request invocations in production
            if (!isProduction && process.env.AUTO_SEED === 'true') {
                const seedInitialData = require('./seedData');
                await seedInitialData();
            }

            return conn;
        } catch (err) {
            cachedPromise = null;
            console.warn(`[DB]: Primary MongoDB connection failed: ${err.message}`);

            if (isProduction) {
                console.error('[DB Fatal Error]: Running in PRODUCTION. Fallback to in-memory database is strictly forbidden.');
                throw err;
            }

            console.log('[DB]: Initializing MongoMemoryServer in-memory fallback for portable evaluation...');
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

                const conn = await mongoose.connect(memoryUri, { dbName: targetDbName });
                console.log(`[MongoMemoryServer Connected]: ${memoryUri}/${targetDbName} (Database: ${targetDbName})`);

                if (process.env.AUTO_SEED !== 'false') {
                    const seedInitialData = require('./seedData');
                    await seedInitialData();
                }
                return conn;
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
        await mongoose.disconnect();
        if (mongoMemoryServer) {
            await mongoMemoryServer.stop();
            mongoMemoryServer = null;
        }
    } catch (err) {
        console.error('[DB Disconnect Error]:', err.message);
    }
};

module.exports = {
    connectDB,
    disconnectDB
};
