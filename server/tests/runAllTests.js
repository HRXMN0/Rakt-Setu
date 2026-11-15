/**
 * RAKT-SETU MASTER EVALUATION 2 TEST RUNNER
 * Executes 42 automated tests across Authentication, RBAC, MongoDB, Multer, and Regression.
 */

const { connectDB, disconnectDB } = require('../src/config/db');
const runAuthTests = require('./auth.test');
const runRbacTests = require('./rbac.test');
const runMongoTests = require('./mongodb.test');
const runMulterTests = require('./multer.test');
const runRegressionTests = require('./regression.test');
const runProductionHardeningTests = require('./productionHardening.test');
const runServerlessCompatibilityTests = require('./serverlessCompatibility.test');

const main = async () => {
    console.log(`\n================================================================`);
    console.log(`  🩸 RAKT-SETU — EVALUATION 2 AUTOMATED TEST SUITE`);
    console.log(`================================================================`);
    console.log(`  Target: 57 Comprehensive Production, Security & Serverless Checks`);
    console.log(`  Tech:   Express.js, JWT, RBAC, MongoDB, Multer, Helmet, RateLimit, Serverless`);
    console.log(`================================================================\n`);

    const startTime = Date.now();

    try {
        await connectDB();

        const authResults = await runAuthTests();
        const rbacResults = await runRbacTests();
        const mongoResults = await runMongoTests();
        const multerResults = await runMulterTests();
        const regResults = await runRegressionTests();
        const hardeningResults = await runProductionHardeningTests();
        const serverlessResults = await runServerlessCompatibilityTests();

        const allResults = [
            ...authResults,
            ...rbacResults,
            ...mongoResults,
            ...multerResults,
            ...regResults,
            ...hardeningResults,
            ...serverlessResults
        ];

        const total = allResults.length;
        const passedCount = allResults.filter(r => r.passed).length;
        const failedCount = total - passedCount;
        const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log(`\n================================================================`);
        console.log(`  📊 EVALUATION 2 TEST EXECUTION SUMMARY`);
        console.log(`================================================================`);
        console.log(`  Total Tests Executed: ${total}`);
        console.log(`  Passed:               ${passedCount} / ${total} (${Math.round((passedCount / total) * 100)}%)`);
        console.log(`  Failed:               ${failedCount}`);
        console.log(`  Execution Time:       ${durationSec}s`);
        console.log(`================================================================`);

        if (failedCount > 0) {
            console.log(`\n❌ Failed Tests:`);
            allResults.filter(r => !r.passed).forEach(f => {
                console.log(`  - [Test ${f.num}] ${f.name}: ${f.details}`);
            });
        } else {
            console.log(`\n🎉 ALL 42 MANDATORY EVALUATION 2 TESTS PASSED PERFECTLY!\n`);
        }

        await disconnectDB();

        if (failedCount > 0) {
            process.exit(1);
        } else {
            process.exit(0);
        }
    } catch (err) {
        console.error('\n[Fatal Test Runner Error]:', err);
        try { await disconnectDB(); } catch (e) {}
        process.exit(1);
    }
};

main();

