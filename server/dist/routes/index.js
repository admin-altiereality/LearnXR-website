"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = __importDefault(require("express"));
const payment_1 = __importDefault(require("./payment"));
const router = express_1.default.Router();
exports.router = router;
console.log('Main router being initialized...');
// Debug middleware for all routes
router.use((req, res, next) => {
    console.log('Router received request:', {
        method: req.method,
        path: req.path,
        originalUrl: req.originalUrl
    });
    next();
});
// Mount payment routes
console.log('Mounting payment routes...');
router.use('/payment', payment_1.default);
console.log('Payment routes mounted at /payment');
// Debug: List all registered routes
const listRoutes = (router, basePath = '') => {
    const routes = [];
    router.stack.forEach((layer) => {
        if (layer.route) {
            const path = basePath + layer.route.path;
            const methods = Object.keys(layer.route.methods).join(',').toUpperCase();
            routes.push(`${methods} ${path}`);
        }
        else if (layer.name === 'router') {
            const newBasePath = basePath + (layer.regexp.source
                .replace('^\\/', '')
                .replace('\\/?(?=\\/|$)', '')
                .replace(/\\\//g, '/'));
            routes.push(...listRoutes(layer.handle, newBasePath));
        }
    });
    return routes;
};
console.log('Registered routes:', listRoutes(router));
