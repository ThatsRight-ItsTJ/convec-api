const { createCanvas, loadImage } = require('canvas');
const config = require('../config/canvas');

class CanvasManager {
  constructor() {
    this.canvases = new Map();
    this.setupCleanup();
  }

  /**
   * Create a new canvas with specified dimensions
   */
  createCanvas(width = config.defaultCanvasSize.width, height = config.defaultCanvasSize.height) {
    if (width > config.maxImageSize) width = config.maxImageSize;
    if (height > config.maxImageSize) height = config.maxImageSize;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    const canvasId = this.generateId();
    this.canvases.set(canvasId, { canvas, ctx, created: Date.now() });
    
    return { canvasId, canvas, ctx };
  }

  /**
   * Load image from various sources
   */
  async loadImage(source) {
    try {
      let image;
      
      if (Buffer.isBuffer(source)) {
        image = await loadImage(source);
      } else if (typeof source === 'string') {
        // URL or file path
        image = await loadImage(source);
      } else {
        throw new Error('Unsupported image source type');
      }
      
      return image;
    } catch (error) {
      throw new Error(`Failed to load image: ${error.message}`);
    }
  }

  /**
   * Initialize canvas with image
   */
  async initializeWithImage(imageSource, resize = true) {
    const image = await this.loadImage(imageSource);
    
    let { width, height } = image;
    
    if (resize) {
      const maxSize = config.maxImageSize;
      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height);
        width = Math.floor(width * ratio);
        height = Math.floor(height * ratio);
      }
    }
    
    const { canvasId, canvas, ctx } = this.createCanvas(width, height);
    ctx.drawImage(image, 0, 0, width, height);
    
    return { canvasId, canvas, ctx, originalImage: image };
  }

  /**
   * Get canvas by ID
   */
  getCanvas(canvasId) {
    const canvasData = this.canvases.get(canvasId);
    if (!canvasData) {
      throw new Error(`Canvas not found: ${canvasId}`);
    }
    return canvasData;
  }

  /**
   * Clone canvas
   */
  cloneCanvas(canvasId) {
    const { canvas: sourceCanvas } = this.getCanvas(canvasId);
    const { canvasId: newCanvasId, canvas: newCanvas, ctx: newCtx } = this.createCanvas(sourceCanvas.width, sourceCanvas.height);
    
    newCtx.drawImage(sourceCanvas, 0, 0);
    
    return { canvasId: newCanvasId, canvas: newCanvas, ctx: newCtx };
  }

  /**
   * Convert canvas to buffer
   */
  toBuffer(canvasId, format = 'png') {
    const { canvas } = this.getCanvas(canvasId);
    
    switch (format.toLowerCase()) {
      case 'png':
        return canvas.toBuffer('image/png');
      case 'jpeg':
      case 'jpg':
        return canvas.toBuffer('image/jpeg');
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Convert canvas to data URL
   */
  toDataURL(canvasId, format = 'png') {
    const { canvas } = this.getCanvas(canvasId);
    
    switch (format.toLowerCase()) {
      case 'png':
        return canvas.toDataURL('image/png');
      case 'jpeg':
      case 'jpg':
        return canvas.toDataURL('image/jpeg');
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Clean up canvas resources
   */
  cleanup(canvasId) {
    if (this.canvases.has(canvasId)) {
      this.canvases.delete(canvasId);
      return true;
    }
    return false;
  }

  /**
   * Clean up old canvases
   */
  cleanupOld(maxAge = 3600000) { // 1 hour default
    const now = Date.now();
    const toDelete = [];
    
    for (const [id, data] of this.canvases.entries()) {
      if (now - data.created > maxAge) {
        toDelete.push(id);
      }
    }
    
    toDelete.forEach(id => this.cleanup(id));
    return toDelete.length;
  }

  /**
   * Setup automatic cleanup
   */
  setupCleanup() {
    if (config.memory.enableCleanup) {
      setInterval(() => {
        this.cleanupOld();
        if (global.gc && this.canvases.size === 0) {
          global.gc();
        }
      }, config.memory.gcInterval);
    }
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return `canvas_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      activeCanvases: this.canvases.size,
      memoryUsage: process.memoryUsage(),
      config: config
    };
  }
}

module.exports = new CanvasManager();