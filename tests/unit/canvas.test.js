const canvasManager = require('../../src/canvas/canvas-manager');
const BackgroundRemoval = require('../../src/canvas/background-removal');
const { createCanvas } = require('canvas');

describe('Canvas Manager', () => {
  afterEach(() => {
    // Cleanup any created canvases
    jest.clearAllMocks();
  });

  describe('Canvas Creation', () => {
    test('should create canvas with default dimensions', () => {
      const { canvasId, canvas, ctx } = canvasManager.createCanvas();
      
      expect(canvasId).toBeDefined();
      expect(canvas).toBeDefined();
      expect(ctx).toBeDefined();
      expect(canvas.width).toBe(1000);
      expect(canvas.height).toBe(1000);
      
      // Cleanup
      canvasManager.cleanup(canvasId);
    });

    test('should create canvas with custom dimensions', () => {
      const { canvasId, canvas } = canvasManager.createCanvas(800, 600);
      
      expect(canvas.width).toBe(800);
      expect(canvas.height).toBe(600);
      
      canvasManager.cleanup(canvasId);
    });

    test('should limit canvas size to maximum', () => {
      const { canvasId, canvas } = canvasManager.createCanvas(5000, 5000);
      
      expect(canvas.width).toBeLessThanOrEqual(2400);
      expect(canvas.height).toBeLessThanOrEqual(2400);
      
      canvasManager.cleanup(canvasId);
    });
  });

  describe('Canvas Management', () => {
    test('should retrieve canvas by ID', () => {
      const { canvasId } = canvasManager.createCanvas();
      const retrieved = canvasManager.getCanvas(canvasId);
      
      expect(retrieved).toBeDefined();
      expect(retrieved.canvas).toBeDefined();
      expect(retrieved.ctx).toBeDefined();
      
      canvasManager.cleanup(canvasId);
    });

    test('should throw error for non-existent canvas ID', () => {
      expect(() => {
        canvasManager.getCanvas('non-existent-id');
      }).toThrow('Canvas not found');
    });

    test('should clone canvas successfully', () => {
      const { canvasId, canvas, ctx } = canvasManager.createCanvas(100, 100);
      
      // Draw something on original canvas
      ctx.fillStyle = 'red';
      ctx.fillRect(0, 0, 50, 50);
      
      const { canvasId: clonedId, canvas: clonedCanvas } = canvasManager.cloneCanvas(canvasId);
      
      expect(clonedId).not.toBe(canvasId);
      expect(clonedCanvas.width).toBe(canvas.width);
      expect(clonedCanvas.height).toBe(canvas.height);
      
      // Cleanup
      canvasManager.cleanup(canvasId);
      canvasManager.cleanup(clonedId);
    });

    test('should convert canvas to buffer', () => {
      const { canvasId, ctx } = canvasManager.createCanvas(100, 100);
      
      // Draw something
      ctx.fillStyle = 'blue';
      ctx.fillRect(0, 0, 100, 100);
      
      const buffer = canvasManager.toBuffer(canvasId, 'png');
      
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);
      
      canvasManager.cleanup(canvasId);
    });

    test('should cleanup canvas resources', () => {
      const { canvasId } = canvasManager.createCanvas();
      
      expect(canvasManager.cleanup(canvasId)).toBe(true);
      expect(() => {
        canvasManager.getCanvas(canvasId);
      }).toThrow('Canvas not found');
    });
  });
});

describe('Background Removal', () => {
  let canvasId, canvas, ctx;

  beforeEach(() => {
    const result = canvasManager.createCanvas(100, 100);
    canvasId = result.canvasId;
    canvas = result.canvas;
    ctx = result.ctx;
    
    // Create test pattern: white background with black square
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 100, 100);
    ctx.fillStyle = 'black';
    ctx.fillRect(25, 25, 50, 50);
  });

  afterEach(() => {
    canvasManager.cleanup(canvasId);
  });

  test('should remove white background by color', () => {
    const resultId = BackgroundRemoval.removeByColor(canvasId, [255, 255, 255], 10);
    expect(resultId).toBe(canvasId);
    
    // Check that white pixels are now transparent
    const imageData = ctx.getImageData(0, 0, 100, 100);
    const data = imageData.data;
    
    // Check corner pixel (should be transparent)
    expect(data[3]).toBe(0); // Alpha should be 0
    
    // Check center pixel (should still be opaque)
    const centerIndex = (50 * 100 + 50) * 4;
    expect(data[centerIndex + 3]).toBe(255); // Alpha should be 255
  });

  test('should perform fuzzy color removal', () => {
    const resultId = BackgroundRemoval.fuzzyRemoval(canvasId, [255, 255, 255], 30);
    expect(resultId).toBe(canvasId);
    
    // Verify background removal occurred
    const imageData = ctx.getImageData(0, 0, 100, 100);
    expect(imageData).toBeDefined();
  });

  test('should perform chroma key removal', () => {
    // Create green screen test
    ctx.fillStyle = 'lime';
    ctx.fillRect(0, 0, 100, 100);
    ctx.fillStyle = 'red';
    ctx.fillRect(25, 25, 50, 50);
    
    const resultId = BackgroundRemoval.chromaKey(canvasId, 120, 15, 0.3);
    expect(resultId).toBe(canvasId);
  });

  test('should handle batch removal', async () => {
    const canvas2Id = canvasManager.createCanvas(100, 100).canvasId;
    const canvasIds = [canvasId, canvas2Id];
    
    const results = await BackgroundRemoval.batchRemoval(canvasIds, 'color', {
      targetColor: [255, 255, 255],
      tolerance: 10
    });
    
    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(true);
    
    canvasManager.cleanup(canvas2Id);
  });
});