const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const passport = require('passport');
require('dotenv').config();

// Initialize Passport configuration
require('./config/passport');

const authRoutes = require('./routes/auth');
const expenseRoutes = require('./routes/expenses');
const googleSheetsRoutes = require('./routes/google-sheets');

const app = express();

// Trust proxy - Required for Railway/Heroku deployment behind reverse proxy
app.set('trust proxy', 1);

// Security Middleware - Configured for mobile compatibility and Google OAuth
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://vercel.app", "https://*.vercel.app", "https://accounts.google.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://vercel.app", "https://*.vercel.app"],
            imgSrc: ["'self'", "data:", "blob:", "https://res.cloudinary.com", "https://*.cloudinary.com", "https://*.googleusercontent.com"],
            connectSrc: ["'self'", "https://vercel.app", "https://*.vercel.app", "https://railway.app", "https://*.railway.app", "https://accounts.google.com"],
            fontSrc: ["'self'", "data:"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'", "blob:", "data:"],
            frameSrc: ["'self'", "https://accounts.google.com"]
        }
    }
}));

// CORS Configuration - Enhanced for mobile and Vercel preview deployments
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        // Allow localhost for development
        if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
            return callback(null, true);
        }

        // Allow all Vercel deployments (production and preview)
        if (origin.includes('vercel.app')) {
            return callback(null, true);
        }

        // Allow production frontend URL
        if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) {
            return callback(null, true);
        }

        console.log('CORS blocked origin:', origin);
        callback(null, false);
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Length', 'X-Requested-With'],
    maxAge: 86400 // 24 hours
};
app.use(cors(corsOptions));

// Handle preflight requests for mobile browsers
app.options('*', cors(corsOptions));

// Body Parser Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session Configuration (Required for Passport)
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // HTTPS in production
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Logging Middleware
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// ===== CRITICAL: Health Check Route BEFORE Rate Limiting =====
// This must come BEFORE rate limiter so Railway can health-check without limits
app.get('/api/health', (req, res) => {
    console.log('📊 Health check endpoint hit');
    res.status(200).json({
        status: 'ok',
        message: 'Server is running',
        time: new Date().toISOString(),
        port: process.env.PORT || 5000,
        environment: process.env.NODE_ENV || 'development'
    });
});

// Root health check (Railway sometimes checks root)
app.get('/', (req, res) => {
    console.log('📊 Root endpoint hit');
    res.status(200).json({
        status: 'ok',
        message: 'Expense Tracker API',
        health: '/api/health',
        time: new Date().toISOString()
    });
});

// Rate Limiting - Applied AFTER health checks
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
.then(() => console.log('✅ MongoDB connected successfully'))
.catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/google-sheets', googleSheetsRoutes);

// 404 Error Handler
app.use((req, res) => {
    console.log('⚠️ 404 - Route not found:', req.method, req.url);
    res.status(404).json({
        status: 'error',
        message: 'Route not found'
    });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('❌ Server Error:', err.stack);
    res.status(err.status || 500).json({
        status: 'error',
        message: err.message || 'Internal server error'
    });
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log('='.repeat(50));
    console.log(`🚀 Server started successfully!`);
    console.log(`📍 Port: ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Health Check: http://localhost:${PORT}/api/health`);
    console.log('='.repeat(50));

    // Keep-alive mechanism to prevent Railway from sleeping
    // Uses localhost to avoid DNS issues with external URLs
    if (process.env.NODE_ENV === 'production') {
        const KEEP_ALIVE_INTERVAL = 14 * 60 * 1000; // 14 minutes
        const http = require('http');

        setInterval(() => {
            // Ping localhost instead of external URL to avoid DNS issues
            http.get(`http://localhost:${PORT}/api/health`, (res) => {
                console.log(`⏰ Keep-alive ping - Status: ${res.statusCode} - ${new Date().toISOString()}`);
            }).on('error', (err) => {
                console.error(`❌ Keep-alive ping failed: ${err.message}`);
            });
        }, KEEP_ALIVE_INTERVAL);

        console.log(`✅ Keep-alive enabled - Pinging localhost:${PORT} every 14 minutes`);
    }
});

module.exports = app;
