const fontManager = require('../../src/fonts/font-manager');
const TextRenderer = require('../../src/fonts/text-renderer');
const canvasManager = require('../../src/canvas/canvas-manager');

describe('Font Manager', () => {
  beforeAll(async () => {
    await fontManager.initialize();
  });

  describe('Font Discovery', () => {
    test('should initialize and discover system fonts', async () => {
      expect(fontManager.initialized).toBe(true);
      expect(fontManager.systemFonts.size).toBeGreaterThan(0);
    });

    test('should get available fonts list', () => {
      const fonts = fontManager.getAvailableFonts();
      expect(Array.isArray(fonts)).toBe(true);
      expect(fonts.length).toBeGreaterThan(0);
      
      // Check font structure
      if (fonts.length > 0) {
        const font = fonts[0];
        expect(font).toHaveProperty('familyName');
        expect(font).toHaveProperty('type');
      }
    });

    test('should get font families grouped by type', () => {
      const families = fontManager.getFontFamilies();
      expect(families).toHaveProperty('system');
      expect(families).toHaveProperty('custom');
      expect(families).toHaveProperty('generic');
      expect(Array.isArray(families.system)).toBe(true);
      expect(Array.isArray(families.custom)).toBe(true);
      expect(Array.isArray(families.generic)).toBe(true);
    });

    test('should provide font manager statistics', () => {
      const stats = fontManager.getStats();
      expect(stats).toHaveProperty('systemFonts');
      expect(stats).toHaveProperty('customFonts');
      expect(stats).toHaveProperty('cachedFonts');
      expect(stats).toHaveProperty('initialized');
      expect(typeof stats.systemFonts).toBe('number');
      expect(stats.initialized).toBe(true);
    });
  });

  describe('Font Loading', () => {
    test('should load system font successfully', async () => {
      // Try to load a common system font
      const commonFonts = ['Arial', 'Times New Roman', 'Helvetica'];
      
      let fontLoaded = false;
      for (const fontName of commonFonts) {
        try {
          const font = await fontManager.loadFont(fontName, false);
          if (font) {
            expect(font).toBeDefined();
            fontLoaded = true;
            break;
          }
        } catch (error) {
          // Continue to next font
        }
      }
      
      // At least one common font should be available
      expect(fontLoaded).toBe(true);
    });

    test('should handle fallback when font not found', async () => {
      const font = await fontManager.loadFont('NonExistentFont123', true);
      expect(font).toBeDefined(); // Should fallback to a default font
    });

    test('should throw error when font not found and no fallback', async () => {
      await expect(
        fontManager.loadFont('NonExistentFont123', false)
      ).rejects.toThrow();
    });
  });

  describe('Custom Font Management', () => {
    test('should validate font file format', () => {
      const validBuffer = Buffer.from('mock font data');
      
      expect(() => {
        fontManager.constructor.validateFontFile(validBuffer, 'test.txt');
      }).toThrow('Unsupported font format');
      
      // Test file size limit
      const largeBuffer = Buffer.alloc(20 * 1024 * 1024); // 20MB
      expect(() => {
        fontManager.constructor.validateFontFile(largeBuffer, 'test.ttf');
      }).toThrow('Font file too large');
    });

    test('should clear font cache', () => {
      fontManager.clearCache();
      const stats = fontManager.getStats();
      expect(stats.cachedFonts).toBe(0);
    });
  });
});

describe('Text Renderer', () => {
  let canvasId;

  afterEach(() => {
    if (canvasId) {
      canvasManager.cleanup(canvasId);
      canvasId = null;
    }
  });

  describe('Text Rendering', () => {
    test('should render text to canvas', async () => {
      const result = await TextRenderer.renderText({
        text: 'Test Text',
        width: 400,
        height: 200,
        fontSize: 24
      });

      expect(result).toHaveProperty('canvasId');
      expect(result).toHaveProperty('canvas');
      expect(result).toHaveProperty('ctx');
      expect(result).toHaveProperty('metrics');
      
      canvasId = result.canvasId;
      expect(result.canvas.width).toBe(400);
      expect(result.canvas.height).toBe(200);
    });

    test('should handle word wrapping', async () => {
      const result = await TextRenderer.renderText({
        text: 'This is a very long text that should wrap to multiple lines when rendered',
        width: 200,
        height: 300,
        fontSize: 16,
        wordWrap: true
      });

      canvasId = result.canvasId;
      expect(result.metrics.lines).toBeGreaterThan(1);
    });

    test('should apply text effects', async () => {
      const result = await TextRenderer.renderText({
        text: 'Effects Test',
        width: 300,
        height: 150,
        fontSize: 20,
        effects: {
          shadow: {
            color: 'rgba(0,0,0,0.5)',
            offsetX: 2,
            offsetY: 2,
            blur: 4
          },
          outline: {
            color: '#000000',
            width: 2
          }
        }
      });

      canvasId = result.canvasId;
      expect(result).toBeDefined();
    });

    test('should measure text dimensions', async () => {
      const metrics = await TextRenderer.measureText('Sample Text', 'Arial', 24);
      
      expect(metrics).toHaveProperty('width');
      expect(metrics).toHaveProperty('height');
      expect(typeof metrics.width).toBe('number');
      expect(typeof metrics.height).toBe('number');
      expect(metrics.width).toBeGreaterThan(0);
      expect(metrics.height).toBeGreaterThan(0);
    });
  });

  describe('Text Alignment', () => {
    test('should handle different text alignments', async () => {
      const alignments = ['left', 'center', 'right'];
      
      for (const alignment of alignments) {
        const result = await TextRenderer.renderText({
          text: 'Alignment Test',
          width: 300,
          height: 100,
          alignment
        });

        expect(result).toBeDefined();
        canvasManager.cleanup(result.canvasId);
      }
    });
  });

  describe('Text Overlay', () => {
    test('should add text overlay to existing canvas', async () => {
      // Create base canvas
      const { canvasId: baseCanvasId, ctx } = canvasManager.createCanvas(300, 200);
      
      // Draw background
      ctx.fillStyle = 'lightblue';
      ctx.fillRect(0, 0, 300, 200);
      
      // Add text overlay
      const resultId = await TextRenderer.addTextOverlay(baseCanvasId, {
        text: 'Overlay Text',
        x: 50,
        y: 100,
        fontSize: 24,
        color: '#333333'
      });

      expect(resultId).toBe(baseCanvasId);
      canvasManager.cleanup(baseCanvasId);
    });
  });
});