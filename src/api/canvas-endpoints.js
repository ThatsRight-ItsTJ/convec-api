const express = require('express');
const multer = require('multer');
const canvasManager = require('../canvas/canvas-manager');
const BackgroundRemoval = require('../canvas/background-removal');
const TextRenderer = require('../fonts/text-renderer');
const Vectorizer = require('../vectorization/vectorizer');
const cacheManager = require('../utils/cache-manager');
const performanceMonitor = require('../utils/performance-monitor');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PNG, JPEG, and WebP are allowed.'));
    }
  }
});

// Background Removal Endpoints

/**
 * POST /api/background/remove
 * Remove background using color matching
 */
router.post('/remove', upload.single('image'), async (req, res) => {
  try {
    const operationId = `bg-remove-${Date.now()}`;
    performanceMonitor.startTimer(operationId, { 
      method: req.body.method || 'color',
      fileSize: req.file ? req.file.size : 0 
    });

    if (!req.file) {
      performanceMonitor.endTimer(operationId, false, new Error('No image file provided'));
      return res.status(400).json({ error: 'No image file provided' });
    }

    const {
      targetColor = [255, 255, 255],
      tolerance = 10,
      method = 'color',
      outputFormat = 'png'
    } = req.body;

    // Check cache for processed image
    const cachedResult = await cacheManager.getCachedProcessedImage(
      req.file.buffer, 
      { method, targetColor: parsedTargetColor, tolerance }
    );

    if (cachedResult) {
      performanceMonitor.endTimer(operationId, true);
      res.setHeader('Content-Type', `image/${outputFormat}`);
      res.setHeader('X-Cache', 'HIT');
      return res.send(cachedResult);
    }

    // Initialize canvas with uploaded image
    const { canvasId } = await canvasManager.initializeWithImage(req.file.buffer);

    // Parse target color if it's a string
    let parsedTargetColor = targetColor;
    if (typeof targetColor === 'string') {
      if (targetColor.startsWith('#')) {
        // Convert hex to RGB
        const hex = targetColor.slice(1);
        parsedTargetColor = [
          parseInt(hex.slice(0, 2), 16),
          parseInt(hex.slice(2, 4), 16),
          parseInt(hex.slice(4, 6), 16)
        ];
      } else {
        parsedTargetColor = JSON.parse(targetColor);
      }
    }

    // Apply background removal
    let resultCanvasId;
    switch (method) {
      case 'color':
        resultCanvasId = BackgroundRemoval.removeByColor(canvasId, parsedTargetColor, parseInt(tolerance));
        break;
      case 'fuzzy':
        resultCanvasId = BackgroundRemoval.fuzzyRemoval(canvasId, parsedTargetColor, parseInt(tolerance));
        break;
      case 'edge-preserving':
        resultCanvasId = BackgroundRemoval.edgePreserving(canvasId, parsedTargetColor, parseInt(tolerance));
        break;
      default:
        resultCanvasId = BackgroundRemoval.removeByColor(canvasId, parsedTargetColor, parseInt(tolerance));
    }

    // Convert to buffer and send response
    const resultBuffer = canvasManager.toBuffer(resultCanvasId, outputFormat);
    
    // Cache the result
    await cacheManager.cacheProcessedImage(
      req.file.buffer,
      { method, targetColor: parsedTargetColor, tolerance },
      resultBuffer
    );

    performanceMonitor.endTimer(operationId, true);
    res.setHeader('Content-Type', `image/${outputFormat}`);
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Content-Disposition', `attachment; filename="background_removed.${outputFormat}"`);
    res.send(resultBuffer);

    // Cleanup
    canvasManager.cleanup(canvasId);

  } catch (error) {
    performanceMonitor.endTimer(operationId, false, error);
    console.error('Background removal error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/background/chroma-key
 * Chroma key (green screen) background removal
 */
router.post('/chroma-key', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const {
      targetHue = 120, // Green
      hueTolerance = 15,
      saturationMin = 0.3,
      outputFormat = 'png'
    } = req.body;

    const { canvasId } = await canvasManager.initializeWithImage(req.file.buffer);
    const resultCanvasId = BackgroundRemoval.chromaKey(
      canvasId, 
      parseFloat(targetHue), 
      parseFloat(hueTolerance), 
      parseFloat(saturationMin)
    );

    const resultBuffer = canvasManager.toBuffer(resultCanvasId, outputFormat);
    
    res.setHeader('Content-Type', `image/${outputFormat}`);
    res.setHeader('Content-Disposition', `attachment; filename="chroma_key_removed.${outputFormat}"`);
    res.send(resultBuffer);

    canvasManager.cleanup(canvasId);

  } catch (error) {
    console.error('Chroma key error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/background/flood-fill
 * Flood fill background removal
 */
router.post('/flood-fill', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const {
      startX = 0,
      startY = 0,
      tolerance = 10,
      outputFormat = 'png'
    } = req.body;

    const { canvasId } = await canvasManager.initializeWithImage(req.file.buffer);
    const resultCanvasId = BackgroundRemoval.floodFill(
      canvasId,
      parseInt(startX),
      parseInt(startY),
      parseInt(tolerance)
    );

    const resultBuffer = canvasManager.toBuffer(resultCanvasId, outputFormat);
    
    res.setHeader('Content-Type', `image/${outputFormat}`);
    res.setHeader('Content-Disposition', `attachment; filename="flood_fill_removed.${outputFormat}"`);
    res.send(resultBuffer);

    canvasManager.cleanup(canvasId);

  } catch (error) {
    console.error('Flood fill error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/background/replace
 * Replace background with color or image
 */
router.post('/replace', upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'background', maxCount: 1 }
]), async (req, res) => {
  try {
    if (!req.files || !req.files.image) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const { backgroundColor = '#ffffff', outputFormat = 'png' } = req.body;

    const { canvasId } = await canvasManager.initializeWithImage(req.files.image[0].buffer);
    
    // First remove the background
    const bgRemovedId = BackgroundRemoval.removeByColor(canvasId, [255, 255, 255], 10);
    
    // Then replace with new background
    let replacement = backgroundColor;
    if (req.files.background) {
      // Use uploaded background image
      const bgImage = await canvasManager.loadImage(req.files.background[0].buffer);
      replacement = bgImage;
    }

    const resultCanvasId = BackgroundRemoval.replaceBackground(bgRemovedId, replacement);
    const resultBuffer = canvasManager.toBuffer(resultCanvasId, outputFormat);
    
    res.setHeader('Content-Type', `image/${outputFormat}`);
    res.setHeader('Content-Disposition', `attachment; filename="background_replaced.${outputFormat}"`);
    res.send(resultBuffer);

    canvasManager.cleanup(canvasId);

  } catch (error) {
    console.error('Background replacement error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/background/batch
 * Batch background removal
 */
router.post('/batch', upload.array('images', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No image files provided' });
    }

    const {
      method = 'color',
      targetColor = [255, 255, 255],
      tolerance = 10,
      outputFormat = 'png'
    } = req.body;

    const results = [];
    const canvasIds = [];

    // Initialize all canvases
    for (const file of req.files) {
      const { canvasId } = await canvasManager.initializeWithImage(file.buffer);
      canvasIds.push(canvasId);
    }

    // Process batch
    const options = { targetColor, tolerance };
    const batchResults = await BackgroundRemoval.batchRemoval(canvasIds, method, options);

    // Convert results to buffers
    for (let i = 0; i < batchResults.length; i++) {
      const result = batchResults[i];
      if (result.success) {
        const buffer = canvasManager.toBuffer(result.canvasId, outputFormat);
        results.push({
          index: i,
          success: true,
          filename: `processed_${i}.${outputFormat}`,
          data: buffer.toString('base64')
        });
      } else {
        results.push({
          index: i,
          success: false,
          error: result.error
        });
      }
    }

    res.json({
      processed: results.length,
      results: results
    });

    // Cleanup
    canvasIds.forEach(id => canvasManager.cleanup(id));

  } catch (error) {
    console.error('Batch processing error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Combined Processing Endpoints

/**
 * POST /api/process/complete
 * Remove background and vectorize
 */
router.post('/complete', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const {
      targetColor = [255, 255, 255],
      tolerance = 10,
      scale = 1,
      outputFormat = 'svg',
      fillColor = '#000000',
      threshold = 128,
      turdsize = 5,
      optcurve = true,
      opttolerance = 1
    } = req.body;

    const { canvasId } = await canvasManager.initializeWithImage(req.file.buffer);
    
    // Remove background
    let parsedTargetColor = targetColor;
    if (typeof targetColor === 'string') {
      if (targetColor.startsWith('#')) {
        const hex = targetColor.slice(1);
        parsedTargetColor = [
          parseInt(hex.slice(0, 2), 16),
          parseInt(hex.slice(2, 4), 16),
          parseInt(hex.slice(4, 6), 16)
        ];
      } else {
        parsedTargetColor = JSON.parse(targetColor);
      }
    }
    
    const bgRemovedId = BackgroundRemoval.removeByColor(canvasId, parsedTargetColor, parseInt(tolerance));
    
    // Vectorize the background-removed image
    const vectorizeOptions = {
      scale: parseFloat(scale),
      fillColor,
      threshold: parseInt(threshold),
      turdsize: parseInt(turdsize),
      optcurve: optcurve === 'true' || optcurve === true,
      opttolerance: parseFloat(opttolerance)
    };
    
    if (outputFormat === 'svg') {
      const svg = await Vectorizer.vectorizeCanvas(bgRemovedId, vectorizeOptions);
      
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Content-Disposition', 'attachment; filename="vectorized_background_removed.svg"');
      res.send(svg);
    } else if (outputFormat === 'path') {
      const pathData = await Vectorizer.generatePathData(bgRemovedId, vectorizeOptions);
      
      res.json({
        success: true,
        pathData: pathData,
        width: canvasManager.getCanvas(bgRemovedId).canvas.width * parseFloat(scale),
        height: canvasManager.getCanvas(bgRemovedId).canvas.height * parseFloat(scale)
      });
    } else {
      // Return processed PNG
      const resultBuffer = canvasManager.toBuffer(bgRemovedId, outputFormat);
      
      res.setHeader('Content-Type', `image/${outputFormat}`);
      res.setHeader('Content-Disposition', `attachment; filename="background_removed.${outputFormat}"`);
      res.send(resultBuffer);
    }

    canvasManager.cleanup(canvasId);

  } catch (error) {
    console.error('Complete processing error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/vectorize
 * Pure vectorization without background removal
 */
router.post('/vectorize', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const {
      scale = 1,
      outputFormat = 'svg',
      fillColor = '#000000',
      threshold = 128,
      turdsize = 5,
      optcurve = true,
      opttolerance = 1,
      preprocessing = {}
    } = req.body;

    const { canvasId } = await canvasManager.initializeWithImage(req.file.buffer);
    
    const vectorizeOptions = {
      scale: parseFloat(scale),
      fillColor,
      threshold: parseInt(threshold),
      turdsize: parseInt(turdsize),
      optcurve: optcurve === 'true' || optcurve === true,
      opttolerance: parseFloat(opttolerance)
    };

    // Parse preprocessing options
    let parsedPreprocessing = preprocessing;
    if (typeof preprocessing === 'string') {
      try {
        parsedPreprocessing = JSON.parse(preprocessing);
      } catch (e) {
        parsedPreprocessing = {};
      }
    }
    
    if (outputFormat === 'svg') {
      const svg = await Vectorizer.vectorizeWithPreprocessing(canvasId, parsedPreprocessing, vectorizeOptions);
      
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Content-Disposition', 'attachment; filename="vectorized.svg"');
      res.send(svg);
    } else if (outputFormat === 'path') {
      const pathData = await Vectorizer.generatePathData(canvasId, vectorizeOptions);
      
      res.json({
        success: true,
        pathData: pathData,
        width: canvasManager.getCanvas(canvasId).canvas.width * parseFloat(scale),
        height: canvasManager.getCanvas(canvasId).canvas.height * parseFloat(scale)
      });
    } else {
      return res.status(400).json({ error: 'Vectorization only supports svg or path output formats' });
    }

    canvasManager.cleanup(canvasId);

  } catch (error) {
    console.error('Vectorization error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/process/text-overlay
 * Add text overlay to image
 */
router.post('/text-overlay', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const {
      text = 'Sample Text',
      x = 50,
      y = 50,
      fontFamily = 'Arial',
      fontSize = 48,
      color = '#ffffff',
      outputFormat = 'png',
      effects = {}
    } = req.body;

    const { canvasId } = await canvasManager.initializeWithImage(req.file.buffer);
    
    // Parse effects if it's a string
    let parsedEffects = effects;
    if (typeof effects === 'string') {
      try {
        parsedEffects = JSON.parse(effects);
      } catch (e) {
        parsedEffects = {};
      }
    }

    const textOptions = {
      text,
      x: parseInt(x),
      y: parseInt(y),
      fontFamily,
      fontSize: parseInt(fontSize),
      color,
      effects: parsedEffects
    };

    await TextRenderer.addTextOverlay(canvasId, textOptions);
    
    const resultBuffer = canvasManager.toBuffer(canvasId, outputFormat);
    
    res.setHeader('Content-Type', `image/${outputFormat}`);
    res.setHeader('Content-Disposition', `attachment; filename="text_overlay.${outputFormat}"`);
    res.send(resultBuffer);

    canvasManager.cleanup(canvasId);

  } catch (error) {
    console.error('Text overlay error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Canvas Management Endpoints

/**
 * GET /api/canvas/stats
 * Get canvas manager statistics
 */
router.get('/stats', (req, res) => {
  try {
    const stats = canvasManager.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/canvas/cleanup
 * Trigger manual cleanup
 */
router.post('/cleanup', (req, res) => {
  try {
    const cleaned = canvasManager.cleanupOld();
    res.json({ 
      success: true, 
      message: `Cleaned up ${cleaned} old canvases` 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large' });
    }
    return res.status(400).json({ error: error.message });
  }
  next(error);
});

module.exports = router;