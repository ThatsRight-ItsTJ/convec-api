const express = require('express');
const multer = require('multer');
const fontManager = require('../fonts/font-manager');
const TextRenderer = require('../fonts/text-renderer');
const config = require('../config/fonts');

const router = express.Router();

// Configure multer for font uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.upload.maxFileSize
  },
  fileFilter: (req, file, cb) => {
    if (config.upload.allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid font type. Allowed types: ${config.upload.allowedMimeTypes.join(', ')}`));
    }
  }
});

// Font Discovery Endpoints

/**
 * GET /api/fonts/list
 * Get list of all available fonts
 */
router.get('/list', async (req, res) => {
  try {
    await fontManager.initialize();
    const fonts = fontManager.getAvailableFonts();
    
    res.json({
      success: true,
      count: fonts.length,
      fonts: fonts
    });
  } catch (error) {
    console.error('Font list error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/fonts/families
 * Get font families grouped by type
 */
router.get('/families', async (req, res) => {
  try {
    await fontManager.initialize();
    const families = fontManager.getFontFamilies();
    
    res.json({
      success: true,
      families: families
    });
  } catch (error) {
    console.error('Font families error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/fonts/stats
 * Get font manager statistics
 */
router.get('/stats', (req, res) => {
  try {
    const stats = fontManager.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/fonts/upload
 * Upload custom font
 */
router.post('/upload', upload.single('font'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No font file provided' });
    }

    const { familyName } = req.body;

    // Validate font file
    const validation = fontManager.constructor.validateFontFile(req.file.buffer, req.file.originalname);
    
    if (!validation.valid) {
      return res.status(400).json({ error: 'Invalid font file' });
    }

    // Add custom font
    const fontInfo = await fontManager.addCustomFont(req.file.buffer, familyName);

    res.json({
      success: true,
      message: 'Font uploaded successfully',
      font: fontInfo
    });

  } catch (error) {
    console.error('Font upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/fonts/cache
 * Clear font cache
 */
router.delete('/cache', (req, res) => {
  try {
    fontManager.clearCache();
    res.json({
      success: true,
      message: 'Font cache cleared'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Text Processing Endpoints

/**
 * POST /api/text/render
 * Render text to image
 */
router.post('/render', async (req, res) => {
  try {
    const {
      text = 'Sample Text',
      fontFamily = config.textRendering.defaultFontFamily,
      fontSize = config.textRendering.defaultFontSize,
      color = config.textRendering.defaultColor,
      backgroundColor = 'transparent',
      width = 800,
      height = 400,
      alignment = 'left',
      lineHeight,
      padding = 20,
      wordWrap = true,
      effects = {},
      outputFormat = 'png'
    } = req.body;

    const options = {
      text,
      fontFamily,
      fontSize: parseInt(fontSize),
      color,
      backgroundColor,
      width: parseInt(width),
      height: parseInt(height),
      alignment,
      lineHeight: lineHeight ? parseInt(lineHeight) : undefined,
      padding: parseInt(padding),
      wordWrap: wordWrap === 'true' || wordWrap === true,
      effects: typeof effects === 'string' ? JSON.parse(effects) : effects
    };

    const { canvasId, canvas, metrics } = await TextRenderer.renderText(options);
    
    if (outputFormat === 'json') {
      // Return metrics only
      res.json({
        success: true,
        metrics: metrics,
        canvasId: canvasId
      });
    } else {
      // Return image
      const buffer = canvas.toBuffer(`image/${outputFormat}`);
      
      res.setHeader('Content-Type', `image/${outputFormat}`);
      res.setHeader('Content-Disposition', `attachment; filename="rendered_text.${outputFormat}"`);
      res.send(buffer);
    }

  } catch (error) {
    console.error('Text render error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/text/measure
 * Calculate text dimensions
 */
router.post('/measure', async (req, res) => {
  try {
    const {
      text = 'Sample Text',
      fontFamily = config.textRendering.defaultFontFamily,
      fontSize = config.textRendering.defaultFontSize
    } = req.body;

    const metrics = await TextRenderer.measureText(text, fontFamily, parseInt(fontSize));

    res.json({
      success: true,
      text: text,
      fontFamily: fontFamily,
      fontSize: parseInt(fontSize),
      metrics: metrics
    });

  } catch (error) {
    console.error('Text measure error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/text/vectorize
 * Convert text to vectors
 */
router.post('/vectorize', async (req, res) => {
  try {
    const {
      text = 'Sample Text',
      fontFamily = config.textRendering.defaultFontFamily,
      fontSize = config.textRendering.defaultFontSize,
      color = config.textRendering.defaultColor,
      width = 800,
      height = 400,
      alignment = 'left',
      effects = {}
    } = req.body;

    const options = {
      text,
      fontFamily,
      fontSize: parseInt(fontSize),
      color,
      width: parseInt(width),
      height: parseInt(height),
      alignment,
      effects: typeof effects === 'string' ? JSON.parse(effects) : effects
    };

    const { canvasId, canvas } = await TextRenderer.renderToVectors(options);
    
    // For now, return the canvas as data URL
    // In a full implementation, this would integrate with vectorization
    const dataURL = canvas.toDataURL('image/png');
    
    res.json({
      success: true,
      message: 'Text rendered. Use client-side vectorization for SVG conversion.',
      image: dataURL,
      canvasId: canvasId
    });

  } catch (error) {
    console.error('Text vectorize error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'Font file too large' });
    }
    return res.status(400).json({ error: error.message });
  }
  next(error);
});

module.exports = router;