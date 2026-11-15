const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const app = require('./app');
const { connectDB, disconnectDB } = require('./config/db');
const { getJwtSecret } = require('./config/jwt');

const PORT = process.env.PORT || 5000;

let server;

const startServer = async () => {
    try {
        // Enforce cryptographic security check before database initialization
        getJwtSecret();

        await connectDB();

        server = app.listen(PORT, '0.0.0.0', () => {
            console.log(`\n======================================================`);
            console.log(`  🩸 RAKT-SETU — EVALUATION 2 FULL-STACK SERVER`);
            console.log(`======================================================`);
            console.log(`  Port:        http://localhost:${PORT}`);
            console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`  Health:      http://localhost:${PORT}/api/health`);
            console.log(`======================================================\n`);
        });

        server.on('error', (err) => {
            console.error('[Server Error]:', err.message);
        });
    } catch (err) {
        console.error('[Server Fatal Startup Error]:', err.message);
        process.exit(1);
    }
};

const handleGracefulShutdown = async (signal) => {
    console.log(`\n[Server]: Received ${signal}. Shutting down gracefully...`);
    if (server) {
        server.close(async () => {
            await disconnectDB();
            console.log('[Server]: All connections closed. Exiting process.');
            process.exit(0);
        });
    } else {
        process.exit(0);
    }
};

process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));

startServer();

