const { body, query, param, validationResult } = require('express-validator');

/**
 * Validation middleware for API endpoints
 */

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// Background removal validation
const backgroundRemovalValidation = [
  body('targetColor')
    .optional()
    .custom((value) => {
      if (typeof value === 'string' && value.startsWith('#')) {
        return /^#[0-9A-Fa-f]{6}$/.test(value);
      }
      if (Array.isArray(value)) {
        return value.length === 3 && value.every(v => Number.isInteger(v) && v >= 0 && v <= 255);
      }
      return false;
    })
    .withMessage('Target color must be a valid hex color or RGB array'),
  
  body('tolerance')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Tolerance must be between 0 and 100'),
  
  body('method')
    .optional()
    .isIn(['color', 'fuzzy', 'chroma-key', 'flood-fill', 'edge-preserving'])
    .withMessage('Invalid background removal method'),
  
  body('outputFormat')
    .optional()
    .isIn(['png', 'jpeg', 'jpg', 'webp'])
    .withMessage('Invalid output format'),
  
  handleValidationErrors
];

// Chroma key validation
const chromaKeyValidation = [
  body('targetHue')
    .optional()
    .isFloat({ min: 0, max: 360 })
    .withMessage('Target hue must be between 0 and 360'),
  
  body('hueTolerance')
    .optional()
    .isFloat({ min: 0, max: 180 })
    .withMessage('Hue tolerance must be between 0 and 180'),
  
  body('saturationMin')
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage('Minimum saturation must be between 0 and 1'),
  
  handleValidationErrors
];

// Text rendering validation
const textRenderValidation = [
  body('text')
    .notEmpty()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Text must be between 1 and 1000 characters'),
  
  body('fontSize')
    .optional()
    .isInt({ min: 8, max: 200 })
    .withMessage('Font size must be between 8 and 200'),
  
  body('width')
    .optional()
    .isInt({ min: 100, max: 2400 })
    .withMessage('Width must be between 100 and 2400'),
  
  body('height')
    .optional()
    .isInt({ min: 100, max: 2400 })
    .withMessage('Height must be between 100 and 2400'),
  
  body('color')
    .optional()
    .matches(/^#[0-9A-Fa-f]{6}$/)
    .withMessage('Color must be a valid hex color'),
  
  body('alignment')
    .optional()
    .isIn(['left', 'center', 'right'])
    .withMessage('Alignment must be left, center, or right'),
  
  handleValidationErrors
];

// Text overlay validation
const textOverlayValidation = [
  body('text')
    .notEmpty()
    .isLength({ min: 1, max: 500 })
    .withMessage('Text must be between 1 and 500 characters'),
  
  body('x')
    .optional()
    .isInt({ min: 0 })
    .withMessage('X coordinate must be a positive integer'),
  
  body('y')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Y coordinate must be a positive integer'),
  
  body('fontSize')
    .optional()
    .isInt({ min: 8, max: 200 })
    .withMessage('Font size must be between 8 and 200'),
  
  handleValidationErrors
];

// Font upload validation
const fontUploadValidation = [
  body('familyName')
    .optional()
    .isLength({ min: 1, max: 100 })
    .matches(/^[a-zA-Z0-9\s-_]+$/)
    .withMessage('Family name must be alphanumeric with spaces, hyphens, or underscores'),
  
  handleValidationErrors
];

// Text measurement validation
const textMeasureValidation = [
  body('text')
    .notEmpty()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Text must be between 1 and 1000 characters'),
  
  body('fontSize')
    .optional()
    .isInt({ min: 8, max: 200 })
    .withMessage('Font size must be between 8 and 200'),
  
  handleValidationErrors
];

module.exports = {
  backgroundRemovalValidation,
  chromaKeyValidation,
  textRenderValidation,
  textOverlayValidation,
  fontUploadValidation,
  textMeasureValidation,
  handleValidationErrors
};