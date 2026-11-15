/**
 * RAKT-SETU — SERVERLESS COMPATIBILITY & DATABASE LIFECYCLE TEST SUITE
 * 
 * Verifies Phase 1 Backend Serverless requirements:
 * 1. Cached database connections reuse existing active connection.
 * 2. Concurrent cold-start requests coalesce on a single shared promise.
 * 3. Failed database connection handling gracefully returns HTTP 503 without crashing.
 * 4. Automatic production seeding is strictly barred in production.
 * 5. Local server startup compatibility and Vercel serverless entrypoint exports.
 */

const assert = require('assert');
const request = require('supertest');
const mongoose = require('mongoose');
const { connectDB, disconnectDB, getMongoMemoryServerInstance } = require('../src/config/db');
const seedInitialData = require('../src/config/seedData');
const app = require('../src/app');
const serverlessEntry = require('../api/index');

const runServerlessCompatibilityTests = async () => {
    console.log(`\n================================================================`);
    console.log(`  ⚡ RAKT-SETU — SERVERLESS COMPATIBILITY TEST SUITE`);
    console.log(`================================================================\n`);

    const results = [];
    let testNum = 1;

    const record = (name, passed, details = '') => {
        results.push({ num: testNum++, name, passed, details });
        const icon = passed ? '✓' : '❌';
        console.log(`  ${icon} [Test ${results.length}] ${name} ${details ? `(${details})` : ''}`);
    };

    try {
        // --- Test 1: Cached Database Connections ---
        console.log('--- Checking Connection Caching ---');
        await connectDB();
        const conn1 = mongoose.connection;
        assert.strictEqual(conn1.readyState, 1, 'Initial connection should be in connected state (1)');

        // Second call should return immediately using cached active connection
        const start = Date.now();
        const conn2 = await connectDB();
        const durationMs = Date.now() - start;

        const isSameConnection = conn1 === conn2;
        record(
            'Cached database connection reused with zero overhead',
            isSameConnection && durationMs < 50,
            `Duration: ${durationMs}ms, readyState: ${conn2.readyState}`
        );

        // --- Test 2: Concurrent Cold-Start Requests ---
        console.log('\n--- Checking Concurrent Cold-Start Deduplication ---');
        // Launch 5 simultaneous connectDB calls concurrently
        const concurrentPromises = [
            connectDB(),
            connectDB(),
            connectDB(),
            connectDB(),
            connectDB()
        ];
        const concurrentResults = await Promise.all(concurrentPromises);
        const allIdentical = concurrentResults.every(c => c === conn1);

        record(
            'Concurrent cold-start requests resolve to single shared connection',
            allIdentical && concurrentResults.length === 5,
            `Coalesced: ${concurrentResults.length} simultaneous calls`
        );

        // --- Test 3: No Automatic Production Seeding ---
        console.log('\n--- Checking Production Seeding Guard ---');
        const originalNodeEnv = process.env.NODE_ENV;
        const originalAllowSeed = process.env.ALLOW_PRODUCTION_SEED;
        try {
            process.env.NODE_ENV = 'production';
            delete process.env.ALLOW_PRODUCTION_SEED;

            // In production, seedInitialData should log warning and abort without modifying data
            let warningLogged = false;
            const originalWarn = console.warn;
            console.warn = (...args) => {
                if (args[0] && args[0].includes('strictly prohibited')) {
                    warningLogged = true;
                }
                originalWarn(...args);
            };

            await seedInitialData();
            console.warn = originalWarn;

            record(
                'Automatic seeding strictly prohibited in production mode',
                warningLogged === true,
                'Production guard triggered successfully'
            );
        } finally {
            process.env.NODE_ENV = originalNodeEnv;
            if (originalAllowSeed !== undefined) {
                process.env.ALLOW_PRODUCTION_SEED = originalAllowSeed;
            }
        }

        // --- Test 4: Failed Database Connection Handling (503 Service Unavailable) ---
        console.log('\n--- Checking Graceful Database Failure Handling ---');
        // Disconnect to simulate dropped connection, and test /api/health reports state
        await disconnectDB();

        const healthRes = await request(app).get('/api/health');
        record(
            '/api/health correctly reports 503 and disconnected state when DB is down',
            healthRes.status === 503 && healthRes.body.database === 'disconnected',
            `Status: ${healthRes.status}, DB: ${healthRes.body?.database}`
        );

        // Verify database-dependent route (/api/donors/profile) fails with 503 on disconnected state in production
        const prevEnv = process.env.NODE_ENV;
        const prevMongoUri = process.env.MONGODB_URI;
        let protectedStatus = null;
        let protectedMessage = '';
        try {
            process.env.NODE_ENV = 'production';
            process.env.MONGODB_URI = 'mongodb://127.0.0.1:9999/unreachable_db_test';

            const protectedRes = await request(app)
                .get('/api/donors/profile')
                .set('X-Requested-With', 'XMLHttpRequest');

            protectedStatus = protectedRes.status;
            protectedMessage = protectedRes.body?.message || '';
        } finally {
            process.env.NODE_ENV = prevEnv;
            process.env.MONGODB_URI = prevMongoUri;
        }

        record(
            'Database-dependent API requests return 503 when connection fails',
            protectedStatus === 503,
            `Status: ${protectedStatus}, Message: ${protectedMessage}`
        );

        // --- Test 5: Local Server Startup & Vercel Entrypoint Compatibility ---
        console.log('\n--- Checking Entrypoint Exports ---');
        // Reconnect DB for remaining tests
        await connectDB();

        // 1. Check serverless function export
        const isAppExported = typeof serverlessEntry === 'function' && typeof serverlessEntry.use === 'function';
        record(
            'Vercel serverless entrypoint exports valid Express application',
            isAppExported,
            'server/api/index.js exports callable Express instance'
        );

        // 2. Check root / endpoint responds with API metadata
        const rootRes = await request(app).get('/').set('Accept', 'application/json');
        record(
            'Root endpoint (/) provides standalone API service metadata',
            rootRes.status === 200 && rootRes.body.name === 'Rakt-Setu API',
            `API Name: ${rootRes.body?.name}, Health: ${rootRes.body?.health}`
        );

        // --- Test 6: Production + Atlas failure does NOT initialize MongoMemoryServer ---
        console.log('\n--- Checking Production MongoMemoryServer Prohibition ---');
        await disconnectDB();
        const savedNodeEnv = process.env.NODE_ENV;
        const savedVercel = process.env.VERCEL;
        const savedMongoUri = process.env.MONGODB_URI;
        const savedEnableMem = process.env.ENABLE_IN_MEMORY_DB;
        try {
            process.env.NODE_ENV = 'production';
            delete process.env.VERCEL;
            process.env.MONGODB_URI = 'mongodb://127.0.0.1:9999/unreachable_prod_db';
            delete process.env.ENABLE_IN_MEMORY_DB;

            let threwExpectedError = false;
            try {
                await connectDB();
            } catch (e) {
                threwExpectedError = true;
            }

            const mmsInstance = getMongoMemoryServerInstance();
            const isProhibited = threwExpectedError && mmsInstance === null && mongoose.connection.readyState === 0;

            record(
                'Production + Atlas failure strictly rejects connection without initializing MongoMemoryServer',
                isProhibited,
                `Threw error: ${threwExpectedError}, MMS instance: ${mmsInstance}, readyState: ${mongoose.connection.readyState}`
            );
        } finally {
            process.env.NODE_ENV = savedNodeEnv;
            if (savedVercel !== undefined) process.env.VERCEL = savedVercel; else delete process.env.VERCEL;
            process.env.MONGODB_URI = savedMongoUri;
            if (savedEnableMem !== undefined) process.env.ENABLE_IN_MEMORY_DB = savedEnableMem; else delete process.env.ENABLE_IN_MEMORY_DB;
        }

        // --- Test 7: Vercel + Atlas failure does NOT initialize MongoMemoryServer ---
        console.log('\n--- Checking Vercel MongoMemoryServer Prohibition ---');
        await disconnectDB();
        try {
            process.env.NODE_ENV = 'development';
            process.env.VERCEL = '1';
            process.env.MONGODB_URI = 'mongodb://127.0.0.1:9999/unreachable_vercel_db';
            process.env.ENABLE_IN_MEMORY_DB = 'true'; // Even if explicitly enabled in env, VERCEL=1 must forbid it

            let threwExpectedError = false;
            try {
                await connectDB();
            } catch (e) {
                threwExpectedError = true;
            }

            const mmsInstance = getMongoMemoryServerInstance();
            const isProhibited = threwExpectedError && mmsInstance === null && mongoose.connection.readyState === 0;

            record(
                'Vercel (VERCEL=1) + Atlas failure strictly rejects connection without initializing MongoMemoryServer',
                isProhibited,
                `Threw error: ${threwExpectedError}, MMS instance: ${mmsInstance}, readyState: ${mongoose.connection.readyState}`
            );
        } finally {
            process.env.NODE_ENV = savedNodeEnv;
            if (savedVercel !== undefined) process.env.VERCEL = savedVercel; else delete process.env.VERCEL;
            process.env.MONGODB_URI = savedMongoUri;
            if (savedEnableMem !== undefined) process.env.ENABLE_IN_MEMORY_DB = savedEnableMem; else delete process.env.ENABLE_IN_MEMORY_DB;
        }

        // --- Test 8: Development/test can still use the explicitly enabled test fallback ---
        console.log('\n--- Checking Explicitly Enabled Test Fallback ---');
        await disconnectDB();
        try {
            process.env.NODE_ENV = 'development';
            delete process.env.VERCEL;
            process.env.ENABLE_IN_MEMORY_DB = 'true';
            process.env.MONGODB_URI = 'mongodb://127.0.0.1:9999/unreachable_local_dev_db';

            await connectDB();
            const mmsInstance = getMongoMemoryServerInstance();
            const isFallbackWorking = mmsInstance !== null && mongoose.connection.readyState === 1;

            record(
                'Development/test successfully utilizes explicitly enabled in-memory test fallback',
                isFallbackWorking,
                `MMS active: ${mmsInstance !== null}, readyState: ${mongoose.connection.readyState}`
            );
        } finally {
            await disconnectDB();
            process.env.NODE_ENV = savedNodeEnv;
            if (savedVercel !== undefined) process.env.VERCEL = savedVercel; else delete process.env.VERCEL;
            process.env.MONGODB_URI = savedMongoUri;
            if (savedEnableMem !== undefined) process.env.ENABLE_IN_MEMORY_DB = savedEnableMem; else delete process.env.ENABLE_IN_MEMORY_DB;
        }

        // --- Test 9: Successful Atlas connection is reused across warm requests ---
        console.log('\n--- Checking Warm Atlas Connection Reuse ---');
        await disconnectDB();
        process.env.NODE_ENV = savedNodeEnv;
        if (savedVercel !== undefined) process.env.VERCEL = savedVercel; else delete process.env.VERCEL;
        process.env.MONGODB_URI = savedMongoUri;

        const connInitial = await connectDB();
        const startWarm = Date.now();
        const connWarm1 = await connectDB();
        const connWarm2 = await connectDB();
        const connWarm3 = await connectDB();
        const warmDuration = Date.now() - startWarm;

        const allReused = (connInitial === connWarm1) && (connWarm1 === connWarm2) && (connWarm2 === connWarm3) && (connInitial.readyState === 1);

        record(
            'Successful Atlas connection is reused across warm requests with zero overhead',
            allReused && warmDuration < 100,
            `Duration for 3 warm calls: ${warmDuration}ms, readyState: ${connInitial.readyState}`
        );

    } catch (err) {
        console.error('[Serverless Test Error]:', err);
        record('Serverless compatibility execution without uncaught exceptions', false, err.message);
    } finally {
        await disconnectDB();
    }

    const passed = results.filter(r => r.passed).length;
    const total = results.length;

    console.log(`\n================================================================`);
    console.log(`  SERVERLESS COMPATIBILITY SUMMARY: ${passed} / ${total} PASSED`);
    console.log(`================================================================\n`);

    return results;
};

if (require.main === module) {
    runServerlessCompatibilityTests().then(results => {
        const failed = results.filter(r => !r.passed).length;
        process.exit(failed > 0 ? 1 : 0);
    });
}

module.exports = runServerlessCompatibilityTests;
