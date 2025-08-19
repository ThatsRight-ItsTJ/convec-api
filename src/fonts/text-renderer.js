const canvasManager = require('../canvas/canvas-manager');
const fontManager = require('./font-manager');
const config = require('../config/fonts');
const Vectorizer = require('../vectorization/vectorizer');

class TextRenderer {
  /**
   * Render text to canvas
   */
  static async renderText(options = {}) {
    const {
      text,
      fontFamily = config.textRendering.defaultFontFamily,
      fontSize = config.textRendering.defaultFontSize,
      color = config.textRendering.defaultColor,
      backgroundColor = 'transparent',
      width = 800,
      height = 400,
      alignment = 'left',
      lineHeight = fontSize * 1.2,
      padding = 20,
      maxWidth = width - (padding * 2),
      wordWrap = true,
      effects = {}
    } = options;

    // Ensure font manager is initialized
    await fontManager.initialize();

    // Create canvas
    const { canvasId, canvas, ctx } = canvasManager.createCanvas(width, height);

    try {
      // Set background
      if (backgroundColor !== 'transparent') {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, width, height);
      }

      // Load and set font
      await this.loadFont(ctx, fontFamily, fontSize);
      
      // Prepare text lines
      const lines = wordWrap ? this.wrapText(ctx, text, maxWidth) : [text];
      
      // Calculate text positioning
      const textHeight = lines.length * lineHeight;
      let startY = this.calculateStartY(height, textHeight, alignment, padding);

      // Apply text effects if specified
      if (effects.shadow) {
        this.applyShadowEffect(ctx, effects.shadow);
      }

      if (effects.outline) {
        this.applyOutlineEffect(ctx, effects.outline);
      }

      // Render each line
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const y = startY + (i * lineHeight);
        const x = this.calculateTextX(ctx, line, width, alignment, padding);

        // Apply gradient if specified
        if (effects.gradient) {
          ctx.fillStyle = this.createGradient(ctx, effects.gradient, x, y, ctx.measureText(line).width);
        } else {
          ctx.fillStyle = color;
        }

        // Draw shadow first if specified
        if (effects.shadow) {
          const shadowColor = ctx.fillStyle;
          ctx.fillStyle = effects.shadow.color || 'rgba(0,0,0,0.5)';
          ctx.fillText(line, x + (effects.shadow.offsetX || 2), y + (effects.shadow.offsetY || 2));
          ctx.fillStyle = shadowColor;
        }

        // Draw outline if specified
        if (effects.outline) {
          ctx.strokeStyle = effects.outline.color || '#000000';
          ctx.lineWidth = effects.outline.width || 2;
          ctx.strokeText(line, x, y);
        }

        // Draw main text
        ctx.fillText(line, x, y);
      }

      return { canvasId, canvas, ctx, metrics: this.getTextMetrics(ctx, lines, lineHeight) };

    } catch (error) {
      canvasManager.cleanup(canvasId);
      throw error;
    }
  }

  /**
   * Load font into canvas context
   */
  static async loadFont(ctx, fontFamily, fontSize) {
    try {
      // Try to load custom font first
      const font = await fontManager.loadFont(fontFamily);
      ctx.font = `${fontSize}px "${fontFamily}"`;
    } catch (error) {
      // Fallback to system font
      ctx.font = `${fontSize}px ${fontFamily}, ${config.textRendering.defaultFontFamily}`;
    }
  }

  /**
   * Wrap text to fit within specified width
   */
  static wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      const testWidth = ctx.measureText(testLine).width;

      if (testWidth <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          // Word is too long, break it
          lines.push(word);
        }
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  }

  /**
   * Calculate starting Y position based on alignment
   */
  static calculateStartY(canvasHeight, textHeight, alignment, padding) {
    switch (alignment) {
      case 'center':
        return (canvasHeight - textHeight) / 2 + padding;
      case 'bottom':
        return canvasHeight - textHeight - padding;
      default: // top
        return padding;
    }
  }

  /**
   * Calculate X position for text alignment
   */
  static calculateTextX(ctx, text, canvasWidth, alignment, padding) {
    const textWidth = ctx.measureText(text).width;
    
    switch (alignment) {
      case 'center':
        return (canvasWidth - textWidth) / 2;
      case 'right':
        return canvasWidth - textWidth - padding;
      default: // left
        return padding;
    }
  }

  /**
   * Apply shadow effect
   */
  static applyShadowEffect(ctx, shadow) {
    ctx.shadowColor = shadow.color || 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = shadow.blur || 4;
    ctx.shadowOffsetX = shadow.offsetX || 2;
    ctx.shadowOffsetY = shadow.offsetY || 2;
  }

  /**
   * Apply outline effect
   */
  static applyOutlineEffect(ctx, outline) {
    ctx.strokeStyle = outline.color || '#000000';
    ctx.lineWidth = outline.width || 2;
    ctx.lineJoin = 'round';
  }

  /**
   * Create gradient for text
   */
  static createGradient(ctx, gradient, x, y, width) {
    let grad;
    
    switch (gradient.type) {
      case 'linear':
        grad = ctx.createLinearGradient(x, y, x + width, y);
        break;
      case 'radial':
        grad = ctx.createRadialGradient(x + width/2, y, 0, x + width/2, y, width/2);
        break;
      default:
        grad = ctx.createLinearGradient(x, y, x + width, y);
    }

    gradient.stops.forEach(stop => {
      grad.addColorStop(stop.position, stop.color);
    });

    return grad;
  }

  /**
   * Get text metrics
   */
  static getTextMetrics(ctx, lines, lineHeight) {
    let maxWidth = 0;
    
    for (const line of lines) {
      const lineWidth = ctx.measureText(line).width;
      maxWidth = Math.max(maxWidth, lineWidth);
    }

    return {
      width: maxWidth,
      height: lines.length * lineHeight,
      lines: lines.length
    };
  }

  /**
   * Measure text dimensions
   */
  static async measureText(text, fontFamily, fontSize) {
    await fontManager.initialize();
    
    const { canvasId, ctx } = canvasManager.createCanvas(1, 1);
    
    try {
      await this.loadFont(ctx, fontFamily, fontSize);
      const metrics = ctx.measureText(text);
      
      return {
        width: metrics.width,
        height: fontSize, // Approximate height
        actualBoundingBoxLeft: metrics.actualBoundingBoxLeft || 0,
        actualBoundingBoxRight: metrics.actualBoundingBoxRight || metrics.width,
        actualBoundingBoxAscent: metrics.actualBoundingBoxAscent || fontSize * 0.8,
        actualBoundingBoxDescent: metrics.actualBoundingBoxDescent || fontSize * 0.2
      };
    } finally {
      canvasManager.cleanup(canvasId);
    }
  }

  /**
   * Render text and convert to vectors
   */
  static async renderToVectors(options = {}, vectorizeOptions = {}) {
    const { canvasId, canvas } = await this.renderText(options);
    
    try {
      // Vectorize the rendered text
      const defaultVectorizeOptions = {
        scale: 1,
        fillColor: options.color || '#000000',
        threshold: 128,
        turdsize: 2, // Lower threshold for text details
        optcurve: true,
        opttolerance: 0.5
      };

      const finalOptions = { ...defaultVectorizeOptions, ...vectorizeOptions };
      const svg = await Vectorizer.vectorizeCanvas(canvasId, finalOptions);
      
      return { canvasId, canvas, svg };
    } catch (error) {
      canvasManager.cleanup(canvasId);
      throw error;
    }
  }

  /**
   * Add text overlay to existing canvas
   */
  static async addTextOverlay(targetCanvasId, textOptions = {}) {
    const { canvas: targetCanvas, ctx: targetCtx } = canvasManager.getCanvas(targetCanvasId);
    
    const {
      text,
      x = 50,
      y = 50,
      fontFamily = config.textRendering.defaultFontFamily,
      fontSize = config.textRendering.defaultFontSize,
      color = config.textRendering.defaultColor,
      effects = {}
    } = textOptions;

    await fontManager.initialize();
    await this.loadFont(targetCtx, fontFamily, fontSize);

    // Apply effects
    if (effects.shadow) {
      this.applyShadowEffect(targetCtx, effects.shadow);
    }

    if (effects.outline) {
      this.applyOutlineEffect(targetCtx, effects.outline);
    }

    // Set text color
    if (effects.gradient) {
      const textWidth = targetCtx.measureText(text).width;
      targetCtx.fillStyle = this.createGradient(targetCtx, effects.gradient, x, y, textWidth);
    } else {
      targetCtx.fillStyle = color;
    }

    // Draw text
    if (effects.outline) {
      targetCtx.strokeText(text, x, y);
    }
    targetCtx.fillText(text, x, y);

    return targetCanvasId;
  }
}

module.exports = TextRenderer;