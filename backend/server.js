const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const expenseRoutes = require('./routes/expenses');
const googleSheetsRoutes = require('./routes/google-sheets');

const app = express();

// Trust proxy - Required for Railway/Heroku deployment behind reverse proxy
app.set('trust proxy', 1);

// Security Middleware - Configured for mobile compatibility
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    contentSecurityPolicy: false // Disable CSP as it blocks mobile requests
}));

// Rate Limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// CORS Configuration - Enhanced for mobile compatibility
const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'https://expense-tracker-delta-ashy.vercel.app', // Vercel deployment
    'http://localhost:3000', // Local development
    'http://127.0.0.1:3000'  // Alternative localhost
];

const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.log('CORS blocked origin:', origin);
            callback(null, false);
        }
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

// Logging Middleware
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
.then(() => console.log('✅ MongoDB connected successfully'))
.catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/google-sheets', googleSheetsRoutes);

// Health Check Route
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'Expense Tracker API is running',
        timestamp: new Date().toISOString()
    });
});

// 404 Error Handler
app.use((req, res) => {
    res.status(404).json({
        status: 'error',
        message: 'Route not found'
    });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        status: 'error',
        message: err.message || 'Internal server error'
    });
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);

    // Keep-alive mechanism to prevent Railway from sleeping
    // Uses localhost to avoid DNS issues with external URLs
    if (process.env.NODE_ENV === 'production') {
        const KEEP_ALIVE_INTERVAL = 14 * 60 * 1000; // 14 minutes (Railway sleeps after ~15 min)
        const http = require('http');

        setInterval(() => {
            // Ping localhost instead of external URL to avoid DNS issues
            http.get(`http://localhost:${PORT}/api/health`, (res) => {
                console.log(`⏰ Keep-alive ping sent - Status: ${res.statusCode} - ${new Date().toISOString()}`);
            }).on('error', (err) => {
                console.error(`❌ Keep-alive ping failed: ${err.message}`);
            });
        }, KEEP_ALIVE_INTERVAL);

        console.log(`✅ Keep-alive mechanism enabled - Pinging localhost:${PORT} every 14 minutes`);
    }
});

module.exports = app;
