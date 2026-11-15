const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const seedInitialData = require('./seedData');

let mongoMemoryServer = null;

const connectDB = async () => {
    const isProduction = process.env.NODE_ENV === 'production';
    const useReplSetExplicit = process.env.USE_REPLICA_SET === 'true';

    if (useReplSetExplicit && !isProduction) {
        try {
            console.log('[DB]: Initializing MongoMemoryReplSet for transactional evaluation...');
            const { MongoMemoryReplSet } = require('mongodb-memory-server');
            mongoMemoryServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
            const memoryUri = mongoMemoryServer.getUri();
            const conn = await mongoose.connect(memoryUri);
            console.log(`[MongoMemoryReplSet Connected]: ${memoryUri}`);
            await seedInitialData();
            return conn;
        } catch (replErr) {
            console.warn('[DB]: MongoMemoryReplSet initialization failed:', replErr.message);
        }
    }

    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/raktsetu';

    try {
        console.log(`[DB]: Attempting MongoDB connection to: ${mongoUri}...`);
        const conn = await mongoose.connect(mongoUri, {
            serverSelectionTimeoutMS: 2500
        });
        console.log(`[MongoDB Connected]: ${conn.connection.host}/${conn.connection.name}`);
        
        // Auto-seed if needed
        await seedInitialData();
        // Sanitize any existing records to guarantee role isolation
        const User = require('../models/User');
        await User.updateMany({ role: 'DONOR' }, { $set: { hospitalName: null, hospitalId: null, bloodBankName: null, bloodBankId: null } });
        await User.updateMany({ role: 'HOSPITAL_STAFF' }, { $set: { bloodBankName: null, bloodBankId: null } });
        await User.updateMany({ role: 'ADMIN' }, { $set: { hospitalName: null, hospitalId: null } });
        await User.updateMany({ role: 'SUPER_ADMIN' }, { $set: { hospitalId: null, bloodBankId: null } });
        return conn;
    } catch (err) {
        console.warn(`[DB]: Primary MongoDB connection failed: ${err.message}`);

        if (isProduction) {
            console.error('[DB Fatal Error]: Running in PRODUCTION. Fallback to in-memory database is strictly forbidden.');
            throw err;
        }

        console.log('[DB]: Initializing MongoMemoryServer in-memory fallback for portable evaluation...');
        try {
            const { MongoMemoryServer } = require('mongodb-memory-server');
            mongoMemoryServer = await MongoMemoryServer.create();
            const memoryUri = mongoMemoryServer.getUri();
            
            const conn = await mongoose.connect(memoryUri);
            console.log(`[MongoMemoryServer Connected]: ${memoryUri}`);

            // Seed initial data into in-memory database
            await seedInitialData();
            return conn;
        } catch (memErr) {
            console.error(`[DB Fatal Error]: Failed to start in-memory database: ${memErr.message}`);
            throw memErr;
        }
    }
};

const disconnectDB = async () => {
    try {
        await mongoose.disconnect();
        if (mongoMemoryServer) {
            await mongoMemoryServer.stop();
        }
    } catch (err) {
        console.error('[DB Disconnect Error]:', err.message);
    }
};

module.exports = {
    connectDB,
    disconnectDB
};

