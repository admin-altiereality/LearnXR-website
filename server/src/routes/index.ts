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
import authRoutes from './auth';
import classSessionRoutes from './classSessions';

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

// Decode path-safe base64url (from getProxyAssetUrlForThreejs) back to target URL
function decodeProxyAssetEncoded(encoded: string): string | null {
  try {
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const decoded = Buffer.from(padded, 'base64').toString('utf8');
    return decodeURIComponent(decoded);
  } catch {
    return null;
  }
}

// Path-based proxy for krpano Three.js: URL must end in .glb so plugin accepts it. Target URL is in path.
router.get('/proxy-asset/:encoded/model.glb', async (req, res) => {
  try {
    const targetUrl = decodeProxyAssetEncoded(req.params.encoded);
    if (!targetUrl) {
      return res.status(400).json({ error: 'Invalid encoded URL in path' });
    }
    console.log('🔗 Proxying asset (path-based):', targetUrl.slice(0, 100) + (targetUrl.length > 100 ? '...' : ''));
    const origin = (req.get('origin') || req.get('referer') || '').replace(/\/$/, '') || 'https://learnxr-evoneuralai.web.app';
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Referer': origin + '/',
      },
    });
    if (!response.ok) {
      console.error('❌ Asset proxy (path) failed:', response.status, response.statusText);
      return res.status(response.status).json({ error: `Failed to fetch asset: ${response.status} ${response.statusText}` });
    }
    let contentType = response.headers.get('content-type')?.split(';')[0]?.trim() || '';
    if (!contentType) contentType = 'model/gltf-binary';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (response.body) {
      Readable.fromWeb(response.body as any).pipe(res);
    }
    console.log('✅ Asset proxy (path) successful');
  } catch (error) {
    console.error('❌ Asset proxy (path) error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Proxy route for Meshy assets to handle CORS (query-based)
router.get('/proxy-asset', async (req, res) => {
  try {
    let urlParam = req.query.url;
    // Some query parsers split on & and break signed URLs; use raw query if parsed value looks truncated
    if (typeof urlParam !== 'string' || (typeof urlParam === 'string' && urlParam.includes('assets.meshy.ai') && !urlParam.includes('Key-Pair-Id') && req.originalUrl?.includes('url='))) {
      const raw = req.originalUrl || '';
      const match = raw.match(/[?&]url=([^&]+(?:\&(?:Key-Pair-Id|Signature|Policy)=[^&]*)*)/);
      if (match?.[1]) urlParam = match[1];
    }
    let targetUrl = typeof urlParam === 'string' ? urlParam : '';

    if (!targetUrl) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    // Decode until stable so single- or double-encoded query params (e.g. signed URLs with &) work
    let prev = '';
    while (prev !== targetUrl) {
      prev = targetUrl;
      try {
        targetUrl = decodeURIComponent(targetUrl);
      } catch {
        break;
      }
    }

    console.log('🔗 Proxying asset request:', targetUrl.slice(0, 100) + (targetUrl.length > 100 ? '...' : ''));

    const origin = (req.get('origin') || req.get('referer') || '').replace(/\/$/, '') || 'https://learnxr-evoneuralai.web.app';
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Referer': origin + '/',
      },
    });

    if (!response.ok) {
      console.error('❌ Asset proxy failed:', response.status, response.statusText);
      return res.status(response.status).json({
        error: `Failed to fetch asset: ${response.status} ${response.statusText}`
      });
    }

    // Get the content type; for GLB/GLTF URLs with no type from upstream, set correct type so krpano accepts it
    let contentType = response.headers.get('content-type')?.split(';')[0]?.trim() || '';
    if (!contentType && /\.(glb|gltf)$/i.test(targetUrl)) {
      contentType = targetUrl.toLowerCase().endsWith('.glb') ? 'model/gltf-binary' : 'model/gltf+json';
    }
    if (!contentType) contentType = 'application/octet-stream';
    
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

// Mount Class Session routes
console.log('Mounting Class Session routes...');
router.use('/class-sessions', classSessionRoutes);
console.log('Class Session routes mounted at /class-sessions');

// Mount AI Education routes (personalized learning, teacher support)
console.log('Mounting AI Education routes...');
router.use('/ai-education', aiEducationRoutes);
console.log('AI Education routes mounted at /ai-education');

// Mount Assessment routes (automated assessment & evaluation)
console.log('Mounting Assessment routes...');
router.use('/assessment', assessmentRoutes);
console.log('Assessment routes mounted at /assessment');

// Mount Auth routes
console.log('Mounting Auth routes...');
router.use('/auth', authRoutes);
console.log('Auth routes mounted at /auth');

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
