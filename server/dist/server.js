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
    RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID ? 'Present' : 'Missing',
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET ? 'Present' : 'Missing'
});
const app = (0, express_1.default)();
const buildPath = path_1.default.resolve(process.cwd(), 'client/dist');
app.use(express_1.default.static(buildPath));
app.get('*', (req, res) => {
    res.sendFile(path_1.default.join(buildPath, 'index.html'));
});
// Middleware
app.use((0, cors_1.default)({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true
}));
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
// Mount payment routes directly
console.log('Mounting payment routes at /api/payment');
app.use('/api/payment', payment_1.default);
// Mount API routes
console.log('Mounting API routes at /api');
app.use('/api', routes_1.router);
// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});
// 404 handler
app.use((req, res, next) => {
    console.log('404 Not Found:', req.method, req.originalUrl);
    res.status(404).json({
        status: 'error',
        message: `Cannot ${req.method} ${req.originalUrl}`
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
const PORT = process.env.PORT || 5002;
app.listen(PORT, () => {
    console.log(`app is running at http://localhost:${PORT}`);
    console.log(`Health check endpoint: http://localhost:${PORT}/health`);
});
app.use(express_1.default.static(buildPath, {
    setHeaders: (res) => {
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'GET');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
    }
}));
const corsOptions = {
    origin: [
        'https://in3d.evoneural.ai',
        'http://localhost:3000',
        'http://localhost:5173',
        '${apiUrl}'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};
app.use((0, cors_1.default)(corsOptions));
// Handle React routing, return all requests to React app
app.get('*', function (req, res) {
    const indexPath = path_1.default.join(buildPath, 'index.html');
    // Log the path being accessed (helpful for debugging)
    console.log('Attempting to serve:', indexPath);
    res.sendFile(indexPath, function (err) {
        if (err) {
            console.error('Error serving index.html:', err);
            res.status(500).send(err);
        }
    });
});
