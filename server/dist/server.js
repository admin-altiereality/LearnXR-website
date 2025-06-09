"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const firebase_admin_1 = require("./config/firebase-admin");
Object.defineProperty(exports, "db", { enumerable: true, get: function () { return firebase_admin_1.db; } });
const payment_1 = __importDefault(require("./routes/payment"));
// Load environment variables
dotenv_1.default.config();
console.log('Starting server...');
const app = (0, express_1.default)();
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Routes
app.use('/api/payment', payment_1.default);
// Health check endpoint
app.get('/health', (req, res) => {
    console.log('Health check endpoint called');
    res.json({ status: 'ok' });
});
const PORT = process.env.PORT || 3000;
const startServer = async () => {
    try {
        await new Promise((resolve, reject) => {
            const server = app.listen(PORT, () => {
                console.log(`Server is running at http://localhost:${PORT}`);
                console.log(`Health check endpoint: http://localhost:${PORT}/health`);
                resolve(true);
            });
            server.on('error', (error) => {
                if (error.code === 'EADDRINUSE') {
                    console.error(`Port ${PORT} is already in use. Please try a different port or free up the port.`);
                }
                else {
                    console.error('Failed to start server:', error);
                }
                reject(error);
            });
        });
    }
    catch (error) {
        console.error('Server startup failed:', error);
        process.exit(1);
    }
};
startServer();
