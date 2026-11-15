/**
 * RAKT-SETU — VERCEL SERVERLESS FUNCTION ENTRYPOINT
 * Routes all /api/* requests directly into the Express application.
 * Database connection lifecycle is managed via cached connection pooling in db.js.
 */

const app = require('../server/src/app');

module.exports = app;
