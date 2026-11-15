const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const { rateLimit } = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');
const errorHandler = require('./middleware/error.middleware');
const csrfProtection = require('./middleware/csrf.middleware');
const { errorResponse } = require('./utils/responseHelper');

const authRoutes = require('./routes/auth.routes');
const donorRoutes = require('./routes/donor.routes');
const inventoryRoutes = require('./routes/inventory.routes');
const requestRoutes = require('./routes/request.routes');
const hospitalRoutes = require('./routes/hospital.routes');
const documentRoutes = require('./routes/document.routes');

const app = express();

// 1. HTTP Security Headers with Helmet
const isProduction = process.env.NODE_ENV === 'production';
const configuredOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
    : ['http://localhost:5000', 'http://127.0.0.1:5000'];

const connectSrcOrigins = [
    "'self'",
    ...(isProduction ? configuredOrigins : ["http://localhost:5000", "http://127.0.0.1:5000", "http://localhost:5500", "http://127.0.0.1:5500", "http://localhost:3000"])
];

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'",
                "'unsafe-inline'" // Permits portal script entrypoints; unsafe-eval is strictly barred
            ],
            styleSrc: [
                "'self'",
                "'unsafe-inline'" // Permits dynamic component inline styles
            ],
            imgSrc: [
                "'self'",
                "data:",
                "blob:" // Enables canvas toDataURL() and blob generation for donor cards, passes & certificates
            ],
            fontSrc: ["'self'"],
            connectSrc: connectSrcOrigins,
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"]
        }
    },
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// 2. Cross-Origin Resource Sharing (CORS) with Strict Whitelist

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (e.g., server-to-server, curl, automated test suites)
        if (!origin) return callback(null, true);

        // In non-production, permit all localhost / loopback ports
        if (process.env.NODE_ENV !== 'production') {
            if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
                return callback(null, true);
            }
        }

        if (configuredOrigins.includes(origin)) {
            return callback(null, true);
        }

        return callback(new Error(`CORS blocked: Origin '${origin}' is not authorized.`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Enable trust proxy for reverse proxies (NGINX, Cloudflare, Render, AWS ALB)
app.set('trust proxy', 1);

// 3. Rate Limiting Middleware
const isTestMode = process.env.NODE_ENV === 'test';

const globalRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: isTestMode ? 10000 : 500,
    standardHeaders: true,
    legacyHeaders: true,
    message: { success: false, message: 'Too many requests from this IP. Please try again after 15 minutes.' }
});
app.use('/api', globalRateLimiter);

const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: isTestMode ? 10000 : 30, // 30 login/registration attempts per 15 min
    standardHeaders: true,
    legacyHeaders: true,
    message: { success: false, message: 'Too many authentication attempts. Please try again after 15 minutes.' }
});
app.use('/api/auth/login', authRateLimiter);
app.use('/api/auth/register', authRateLimiter);

// 4. Cookie Parser Middleware (Zero-dependency HttpOnly Cookie Support)
app.use((req, res, next) => {
    req.cookies = {};
    const cookieHeader = req.headers.cookie;
    if (cookieHeader) {
        cookieHeader.split(';').forEach(c => {
            const parts = c.split('=');
            if (parts.length >= 2) {
                const key = parts[0].trim();
                const val = decodeURIComponent(parts.slice(1).join('=').trim());
                req.cookies[key] = val;
            }
        });
    }
    next();
});

// 3. Request Parsers with secure payload limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Anti-CSRF defense for cookie-authenticated mutating requests
app.use('/api', csrfProtection);

// 4. Request Logging
if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
}

// 4. API Health Check with Database Status and Uptime
app.get('/api/health', (req, res) => {
    const isDbConnected = mongoose.connection && mongoose.connection.readyState === 1;
    res.status(isDbConnected ? 200 : 503).json({
        success: isDbConnected,
        message: isDbConnected
            ? 'Rakt-Setu Full-Stack Server & Database are operational.'
            : 'Server operational, but Database is not connected.',
        version: '2.1.0',
        environment: process.env.NODE_ENV || 'development',
        database: isDbConnected ? 'connected' : 'disconnected',
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
    });
});

// 5. Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/donors', donorRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/hospitals', hospitalRoutes);
app.use('/api/bloodbanks', hospitalRoutes);
app.use('/api/bloodbank', hospitalRoutes);
app.use('/api/documents', documentRoutes);

// 6. Serve static files from frontend root
const frontendRoot = path.resolve(__dirname, '../../');
app.use(express.static(frontendRoot));

// 7. 404 Handler for undefined API routes
app.all('/api/*', (req, res) => {
    return errorResponse(res, 404, `Cannot ${req.method} ${req.originalUrl} — API Endpoint Not Found.`);
});

// 8. Centralized Global Error Handler Middleware
app.use(errorHandler);

module.exports = app;

