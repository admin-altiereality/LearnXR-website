import request from 'supertest';
import express from 'express';
import skyboxRoutes from '../routes/skybox';

// Create a test app
const app = express();
app.use(express.json());
app.use('/api/skybox', skyboxRoutes);

describe('Skybox API Endpoints', () => {
  describe('GET /api/skybox/health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/skybox/health')
        .expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('data.status');
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('GET /api/skybox/styles', () => {
    it('should return skybox styles with pagination', async () => {
      const response = await request(app)
        .get('/api/skybox/styles?page=1&limit=5')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data.styles');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('page', 1);
      expect(response.body.pagination).toHaveProperty('limit', 5);
    });

    it('should validate pagination parameters', async () => {
      const response = await request(app)
        .get('/api/skybox/styles?page=0&limit=0')
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'VALIDATION_ERROR');
      expect(response.body.message).toContain('page and limit must be positive integers');
    });
  });

  describe('POST /api/skybox/generate', () => {
    it('should generate skybox with valid parameters', async () => {
      const validRequest = {
        prompt: 'A beautiful sunset over mountains',
        skybox_style_id: 1
      };

      const response = await request(app)
        .post('/api/skybox/generate')
        .send(validRequest)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('status');
    });

    it('should validate required fields', async () => {
      const invalidRequest = {
        prompt: '',
        skybox_style_id: null
      };

      const response = await request(app)
        .post('/api/skybox/generate')
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'VALIDATION_ERROR');
      expect(response.body.message).toContain('Missing required fields');
    });

    it('should validate prompt length', async () => {
      const invalidRequest = {
        prompt: 'ab', // Too short
        skybox_style_id: 1
      };

      const response = await request(app)
        .post('/api/skybox/generate')
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'VALIDATION_ERROR');
      expect(response.body.message).toContain('Prompt must be');
    });

    it('should validate skybox_style_id', async () => {
      const invalidRequest = {
        prompt: 'A beautiful landscape',
        skybox_style_id: 0 // Invalid ID
      };

      const response = await request(app)
        .post('/api/skybox/generate')
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'VALIDATION_ERROR');
      expect(response.body.message).toContain('skybox_style_id must be a positive integer');
    });
  });

  describe('GET /api/skybox/status/:generationId', () => {
    it('should validate generation ID parameter', async () => {
      const response = await request(app)
        .get('/api/skybox/status/')
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'VALIDATION_ERROR');
      expect(response.body.message).toContain('Valid generation ID is required');
    });

    it('should get skybox status with valid ID', async () => {
      const response = await request(app)
        .get('/api/skybox/status/test-generation-id')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
    });
  });

  describe('GET /api/skybox/user', () => {
    it('should return user skyboxes with pagination', async () => {
      const response = await request(app)
        .get('/api/skybox/user?page=1&limit=10')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data.data');
      expect(response.body).toHaveProperty('data.pagination');
    });

    it('should validate pagination parameters', async () => {
      const response = await request(app)
        .get('/api/skybox/user?page=-1&limit=0')
        .expect(400);

      expect(response.body).toHaveProperty('error', 'VALIDATION_ERROR');
    });
  });

  describe('DELETE /api/skybox/cache', () => {
    it('should clear cache successfully', async () => {
      const response = await request(app)
        .delete('/api/skybox/cache')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('cache cleared successfully');
    });
  });

  describe('Legacy Endpoints', () => {
    it('should support legacy getSkyboxStyles endpoint', async () => {
      const response = await request(app)
        .get('/api/skybox/getSkyboxStyles')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data.styles');
    });

    it('should support legacy generateSkybox endpoint', async () => {
      const validRequest = {
        prompt: 'A beautiful sunset over mountains',
        skybox_style_id: 1
      };

      const response = await request(app)
        .post('/api/skybox/generateSkybox')
        .send(validRequest)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
    });
  });
}); 