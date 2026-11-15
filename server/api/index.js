/**
 * RAKT-SETU — VERCEL SERVERLESS FUNCTION ENTRYPOINT
 * Routes serverless invocations directly into the Express application.
 * Database connection lifecycle is handled via cached connection middleware.
 */

const app = require('../src/app');

module.exports = app;
