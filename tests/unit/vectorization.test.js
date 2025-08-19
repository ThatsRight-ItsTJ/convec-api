const Vectorizer = require('../../src/vectorization/vectorizer');
const canvasManager = require('../../src/canvas/canvas-manager');

describe('Vectorizer', () => {
  let canvasId, ctx;

  beforeEach(() => {
    const result = canvasManager.createCanvas(100, 100);
    canvasId = result.canvasId;
    ctx = result.ctx;
    
    // Create simple test pattern
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 100, 100);
    ctx.fillStyle = 'black';
    ctx.fillRect(25, 25, 50, 50);
  });

  afterEach(() => {
    if (canvasId) {
      canvasManager.cleanup(canvasId);
    }
  });

  describe('Basic Vectorization', () => {
    test('should vectorize canvas to SVG', async () => {
      const svg = await Vectorizer.vectorizeCanvas(canvasId);
      
      expect(typeof svg).toBe('string');
      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
      expect(svg).toContain('<path');
      expect(svg).toContain('fill="#000000"');
    });

    test('should generate path data only', async () => {
      const pathData = await Vectorizer.generatePathData(canvasId);
      
      expect(typeof pathData).toBe('string');
      expect(pathData).toContain('M'); // Move command
      expect(pathData).toContain('L'); // Line command
      expect(pathData).toContain('Z'); // Close path command
    });

    test('should respect scale parameter', async () => {
      const svg1 = await Vectorizer.vectorizeCanvas(canvasId, { scale: 1 });
      const svg2 = await Vectorizer.vectorizeCanvas(canvasId, { scale: 2 });
      
      expect(svg1).toContain('width="100"');
      expect(svg1).toContain('height="100"');
      expect(svg2).toContain('width="200"');
      expect(svg2).toContain('height="200"');
    });

    test('should apply custom fill color', async () => {
      const svg = await Vectorizer.vectorizeCanvas(canvasId, { 
        fillColor: '#ff0000' 
      });
      
      expect(svg).toContain('fill="#ff0000"');
    });
  });

  describe('Vectorization Options', () => {
    test('should handle different threshold values', async () => {
      const svg1 = await Vectorizer.vectorizeCanvas(canvasId, { threshold: 64 });
      const svg2 = await Vectorizer.vectorizeCanvas(canvasId, { threshold: 192 });
      
      expect(typeof svg1).toBe('string');
      expect(typeof svg2).toBe('string');
      // Results should be different due to different thresholds
      expect(svg1).not.toBe(svg2);
    });

    test('should filter small paths with turdsize', async () => {
      const svg1 = await Vectorizer.vectorizeCanvas(canvasId, { turdsize: 1 });
      const svg2 = await Vectorizer.vectorizeCanvas(canvasId, { turdsize: 100 });
      
      // Higher turdsize should result in fewer paths
      const paths1 = (svg1.match(/<path/g) || []).length;
      const paths2 = (svg2.match(/<path/g) || []).length;
      expect(paths1).toBeGreaterThanOrEqual(paths2);
    });

    test('should enable/disable curve optimization', async () => {
      const svg1 = await Vectorizer.vectorizeCanvas(canvasId, { optcurve: false });
      const svg2 = await Vectorizer.vectorizeCanvas(canvasId, { optcurve: true });
      
      expect(typeof svg1).toBe('string');
      expect(typeof svg2).toBe('string');
    });
  });

  describe('Preprocessing', () => {
    test('should apply blur preprocessing', async () => {
      const svg = await Vectorizer.vectorizeWithPreprocessing(
        canvasId,
        { blur: 2 },
        { scale: 1 }
      );
      
      expect(typeof svg).toBe('string');
      expect(svg).toContain('<svg');
    });

    test('should apply contrast adjustment', async () => {
      const svg = await Vectorizer.vectorizeWithPreprocessing(
        canvasId,
        { contrast: 50 },
        { scale: 1 }
      );
      
      expect(typeof svg).toBe('string');
      expect(svg).toContain('<svg');
    });

    test('should apply brightness adjustment', async () => {
      const svg = await Vectorizer.vectorizeWithPreprocessing(
        canvasId,
        { brightness: 20 },
        { scale: 1 }
      );
      
      expect(typeof svg).toBe('string');
      expect(svg).toContain('<svg');
    });

    test('should apply multiple preprocessing filters', async () => {
      const svg = await Vectorizer.vectorizeWithPreprocessing(
        canvasId,
        { 
          blur: 1,
          contrast: 20,
          brightness: 10
        },
        { scale: 1.5 }
      );
      
      expect(typeof svg).toBe('string');
      expect(svg).toContain('<svg');
      expect(svg).toContain('width="150"'); // 100 * 1.5
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid canvas ID', async () => {
      await expect(
        Vectorizer.vectorizeCanvas('invalid-id')
      ).rejects.toThrow();
    });

    test('should handle empty canvas', async () => {
      const { canvasId: emptyCanvasId } = canvasManager.createCanvas(50, 50);
      
      try {
        const svg = await Vectorizer.vectorizeCanvas(emptyCanvasId);
        expect(typeof svg).toBe('string');
        expect(svg).toContain('<svg');
      } finally {
        canvasManager.cleanup(emptyCanvasId);
      }
    });
  });

  describe('Complex Patterns', () => {
    test('should vectorize multiple shapes', async () => {
      // Create more complex pattern
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, 100, 100);
      
      ctx.fillStyle = 'black';
      ctx.fillRect(10, 10, 20, 20); // Square 1
      ctx.fillRect(70, 70, 20, 20); // Square 2
      ctx.beginPath();
      ctx.arc(50, 30, 10, 0, 2 * Math.PI); // Circle
      ctx.fill();
      
      const svg = await Vectorizer.vectorizeCanvas(canvasId);
      
      expect(svg).toContain('<svg');
      expect(svg).toContain('<path');
      
      // Should have multiple paths for multiple shapes
      const pathCount = (svg.match(/<path/g) || []).length;
      expect(pathCount).toBeGreaterThanOrEqual(1);
    });
  });
});