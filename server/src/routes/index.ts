import express from 'express';
import { Readable } from 'stream';
import paymentRoutes from './payment';
import skyboxRoutes from './skybox';
import linkedinRoutes from './linkedin';
// Subscription removed
import userRoutes from './user';
import aiDetectionRoutes from './aiDetection';
import assistantRoutes from './assistant';
import apiKeyRoutes from './apiKey';
import lmsRoutes from './lms';
import aiEducationRoutes from './aiEducation';
import assessmentRoutes from './assessment';

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

// Proxy route for Meshy assets to handle CORS
router.get('/proxy-asset', async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    console.log('🔗 Proxying asset request:', url);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'In3D.ai-WebApp/1.0',
      },
    });

    if (!response.ok) {
      console.error('❌ Asset proxy failed:', response.status, response.statusText);
      return res.status(response.status).json({ 
        error: `Failed to fetch asset: ${response.status} ${response.statusText}` 
      });
    }

    // Get the content type
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    
    // Set appropriate headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Stream the response
    if (response.body) {
      Readable.fromWeb(response.body as any).pipe(res);
    }
    
    console.log('✅ Asset proxy successful');
  } catch (error) {
    console.error('❌ Asset proxy error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mount payment routes
console.log('Mounting payment routes...');
router.use('/payment', paymentRoutes);
console.log('Payment routes mounted at /payment');

// Subscription routes removed

// Mount skybox routes
console.log('Mounting skybox routes...');
router.use('/skybox', skyboxRoutes);
console.log('Skybox routes mounted at /skybox');

// Mount LinkedIn routes
console.log('Mounting LinkedIn routes...');
router.use('/api', linkedinRoutes);
console.log('LinkedIn routes mounted at /api');

// Mount user routes
console.log('Mounting user routes...');
router.use('/user', userRoutes);
console.log('User routes mounted at /user');

// Mount AI detection routes
console.log('Mounting AI detection routes...');
router.use('/ai-detection', aiDetectionRoutes);
console.log('AI detection routes mounted at /ai-detection');

// Mount assistant routes
console.log('Mounting assistant routes...');
router.use('/assistant', assistantRoutes);
console.log('Assistant routes mounted at /assistant');

// Mount API key routes (Developer Portal)
console.log('Mounting API key routes...');
router.use('/dev/api-keys', apiKeyRoutes);
console.log('API key routes mounted at /dev/api-keys');

// Mount LMS routes
console.log('Mounting LMS routes...');
router.use('/lms', lmsRoutes);
console.log('LMS routes mounted at /lms');

// Mount AI Education routes (personalized learning, teacher support)
console.log('Mounting AI Education routes...');
router.use('/ai-education', aiEducationRoutes);
console.log('AI Education routes mounted at /ai-education');

// Mount Assessment routes (automated assessment & evaluation)
console.log('Mounting Assessment routes...');
router.use('/assessment', assessmentRoutes);
console.log('Assessment routes mounted at /assessment');

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