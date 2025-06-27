"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const routes_1 = require("./routes");
const payment_1 = __importDefault(require("./routes/payment"));
// Load environment variables
dotenv_1.default.config();
console.log('Starting app...');
// Log environment variables (without sensitive data)
console.log('Environment variables loaded:', {
    NODE_ENV: process.env.NODE_ENV,
    RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID ? 'Present' : 'Missing (payment features disabled)',
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET ? 'Present' : 'Missing (payment features disabled)'
});
// Warn about missing payment configuration
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    console.warn('⚠️  Razorpay credentials not found. Payment features will be disabled.');
    console.warn('   To enable payments, set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables.');
}
const app = (0, express_1.default)();
const buildPath = path_1.default.resolve(process.cwd(), 'client/dist');
// CORS configuration
const corsOptions = {
    origin: [
        'https://in3d.evoneural.ai',
        'http://localhost:3000',
        'http://localhost:5173',
        'http://localhost:5002'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};
// Middleware
app.use((0, cors_1.default)(corsOptions));
app.use(express_1.default.json());
// Debug middleware
app.use((req, res, next) => {
    console.log('Incoming request:', {
        method: req.method,
        path: req.path,
        originalUrl: req.originalUrl,
        body: req.body,
        headers: req.headers
    });
    next();
});
// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});
// API routes (must come before static file serving)
console.log('Mounting payment routes at /api/payment');
app.use('/api/payment', payment_1.default);
console.log('Mounting API routes at /api');
app.use('/api', routes_1.router);
// Serve static files from the React build
app.use(express_1.default.static(buildPath, {
    setHeaders: (res) => {
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'GET');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
    }
}));
// Handle React routing - serve index.html for all non-API routes
app.get('*', (req, res) => {
    // Skip API routes
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({
            status: 'error',
            message: `API endpoint not found: ${req.path}`
        });
    }
    const indexPath = path_1.default.join(buildPath, 'index.html');
    console.log('Serving React app from:', indexPath);
    res.sendFile(indexPath, (err) => {
        if (err) {
            console.error('Error serving index.html:', err);
            res.status(500).json({
                status: 'error',
                message: 'Failed to serve application'
            });
        }
    });
});
// Error handling middleware
app.use((err, req, res, next) => {
    console.error('app error:', err);
    res.status(500).json({
        status: 'error',
        message: err.message || 'Internal app error'
    });
});
const PORT = process.env.SERVER_PORT || process.env.PORT || 5002;
app.listen(PORT, () => {
    console.log(`🚀 Server is running at http://localhost:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🔧 API endpoints: http://localhost:${PORT}/api`);
    console.log(`📁 Static files served from: ${buildPath}`);
});
