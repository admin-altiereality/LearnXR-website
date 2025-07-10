import express from 'express';
import paymentRoutes from './payment';
import skyboxRoutes from './skybox';
import linkedinRoutes from './linkedin';

const router = express.Router();

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
router.use('/payment', paymentRoutes);
console.log('Payment routes mounted at /payment');

// Mount skybox routes
console.log('Mounting skybox routes...');
router.use('/skybox', skyboxRoutes);
console.log('Skybox routes mounted at /skybox');

// Mount LinkedIn routes
console.log('Mounting LinkedIn routes...');
router.use('/api', linkedinRoutes);
console.log('LinkedIn routes mounted at /api');

// Debug: List all registered routes
const listRoutes = (router: express.Router, basePath: string = '') => {
  const routes: string[] = [];
  router.stack.forEach((layer) => {
    if (layer.route) {
      const path = basePath + layer.route.path;
      const methods = Object.keys(layer.route.methods).join(',').toUpperCase();
      routes.push(`${methods} ${path}`);
    } else if (layer.name === 'router') {
      const newBasePath = basePath + (layer.regexp.source
        .replace('^\\/','')
        .replace('\\/?(?=\\/|$)','')
        .replace(/\\\//g, '/'));
      routes.push(...listRoutes(layer.handle, newBasePath));
    }
  });
  return routes;
};

console.log('Registered routes:', listRoutes(router));

// Export the router
export { router }; 