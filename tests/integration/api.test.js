const request = require('supertest');
const app = require('../../server');
const fs = require('fs');
const path = require('path');

describe('API Integration Tests', () => {
  // Create test image buffer
  const createTestImage = () => {
    const { createCanvas } = require('canvas');
    const canvas = createCanvas(100, 100);
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 100, 100);
    ctx.fillStyle = 'black';
    ctx.fillRect(25, 25, 50, 50);
    
    return canvas.toBuffer('image/png');
  };

  describe('Background Removal Endpoints', () => {
    test('POST /api/background/remove should remove background', async () => {
      const testImage = createTestImage();
      
      const response = await request(app)
        .post('/api/background/remove')
        .attach('image', testImage, 'test.png')
        .field('targetColor', '[255,255,255]')
        .field('tolerance', '10')
        .field('outputFormat', 'png');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('image/png');
      expect(response.body).toBeDefined();
    });

    test('POST /api/background/chroma-key should perform chroma key removal', async () => {
      const testImage = createTestImage();
      
      const response = await request(app)
        .post('/api/background/chroma-key')
        .attach('image', testImage, 'test.png')
        .field('targetHue', '120')
        .field('hueTolerance', '15')
        .field('outputFormat', 'png');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('image/png');
    });

    test('POST /api/background/remove should handle missing image', async () => {
      const response = await request(app)
        .post('/api/background/remove')
        .field('targetColor', '[255,255,255]');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Vectorization Endpoints', () => {
    test('POST /api/vectorize should return SVG', async () => {
      const testImage = createTestImage();
      
      const response = await request(app)
        .post('/api/vectorize')
        .attach('image', testImage, 'test.png')
        .field('outputFormat', 'svg')
        .field('scale', '1');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('image/svg+xml');
      expect(response.text).toContain('<svg');
      expect(response.text).toContain('</svg>');
    });

    test('POST /api/vectorize should return path data', async () => {
      const testImage = createTestImage();
      
      const response = await request(app)
        .post('/api/vectorize')
        .attach('image', testImage, 'test.png')
        .field('outputFormat', 'path')
        .field('scale', '2');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('pathData');
      expect(response.body).toHaveProperty('width', 200);
      expect(response.body).toHaveProperty('height', 200);
    });

    test('POST /api/process/complete should remove background and vectorize', async () => {
      const testImage = createTestImage();
      
      const response = await request(app)
        .post('/api/process/complete')
        .attach('image', testImage, 'test.png')
        .field('targetColor', '#ffffff')
        .field('tolerance', '15')
        .field('outputFormat', 'svg')
        .field('scale', '1.5');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('image/svg+xml');
      expect(response.text).toContain('<svg');
      expect(response.text).toContain('width="150"'); // 100 * 1.5
    });
  });

  describe('Font Endpoints', () => {
    test('GET /api/fonts/list should return font list', async () => {
      const response = await request(app)
        .get('/api/fonts/list');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('fonts');
      expect(Array.isArray(response.body.fonts)).toBe(true);
    });

    test('GET /api/fonts/families should return font families', async () => {
      const response = await request(app)
        .get('/api/fonts/families');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('families');
      expect(response.body.families).toHaveProperty('system');
      expect(response.body.families).toHaveProperty('custom');
      expect(response.body.families).toHaveProperty('generic');
    });

    test('POST /api/text/render should render text', async () => {
      const response = await request(app)
        .post('/api/text/render')
        .send({
          text: 'Test Text',
          fontSize: 24,
          width: 300,
          height: 100,
          outputFormat: 'png'
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('image/png');
    });

    test('POST /api/text/vectorize should vectorize text', async () => {
      const response = await request(app)
        .post('/api/text/vectorize')
        .send({
          text: 'Vector Text',
          fontSize: 36,
          width: 400,
          height: 150,
          outputFormat: 'svg'
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('image/svg+xml');
      expect(response.text).toContain('<svg');
    });

    test('POST /api/text/measure should return text metrics', async () => {
      const response = await request(app)
        .post('/api/text/measure')
        .send({
          text: 'Measure Me',
          fontSize: 20,
          fontFamily: 'Arial'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('metrics');
      expect(response.body.metrics).toHaveProperty('width');
      expect(response.body.metrics).toHaveProperty('height');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid file uploads', async () => {
      const response = await request(app)
        .post('/api/background/remove')
        .attach('image', Buffer.from('not an image'), 'test.txt');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    test('should handle large file uploads', async () => {
      const largeBuffer = Buffer.alloc(60 * 1024 * 1024); // 60MB
      
      const response = await request(app)
        .post('/api/background/remove')
        .attach('image', largeBuffer, 'large.png');

      expect(response.status).toBe(413);
      expect(response.body).toHaveProperty('error');
    });

    test('should handle invalid JSON in request body', async () => {
      const response = await request(app)
        .post('/api/text/render')
        .send('invalid json');

      expect(response.status).toBe(400);
    });

    test('should return 404 for non-existent endpoints', async () => {
      const response = await request(app)
        .get('/api/non-existent');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Health and Stats', () => {
    test('GET /health should return OK', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'OK');
    });

    test('GET /api/canvas/stats should return canvas statistics', async () => {
      const response = await request(app)
        .get('/api/canvas/stats');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('activeCanvases');
      expect(response.body).toHaveProperty('memoryUsage');
    });

    test('GET /api/fonts/stats should return font statistics', async () => {
      const response = await request(app)
        .get('/api/fonts/stats');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('systemFonts');
      expect(response.body).toHaveProperty('customFonts');
    });
  });

  describe('Text Overlay', () => {
    test('POST /api/process/text-overlay should add text to image', async () => {
      const testImage = createTestImage();
      
      const response = await request(app)
        .post('/api/process/text-overlay')
        .attach('image', testImage, 'test.png')
        .field('text', 'Overlay Text')
        .field('x', '20')
        .field('y', '50')
        .field('fontSize', '18')
        .field('color', '#ff0000')
        .field('outputFormat', 'png');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('image/png');
    });
  });
});