const canvasManager = require('../canvas/canvas-manager');
const WorkerPool = require('../utils/worker-pool');
const performanceMonitor = require('../utils/performance-monitor');
const path = require('path');

class Vectorizer {
  constructor() {
    this.workerPool = null;
    this.useWorkers = process.env.USE_WORKER_THREADS === 'true';
    this.defaultOptions = {
      turdsize: 5,
      turnpolicy: 'minority',
      alphamax: 1,
      opttolerance: 1,
      optcurve: true
    };

    if (this.useWorkers) {
      this.initializeWorkerPool();
    }
  }

  /**
   * Initialize worker pool for CPU-intensive operations
   */
  initializeWorkerPool() {
    try {
      const workerFile = path.join(__dirname, '../workers/vectorization-worker.js');
      this.workerPool = new WorkerPool(workerFile, 2);
    } catch (error) {
      console.warn('Failed to initialize worker pool:', error.message);
      this.useWorkers = false;
    }
  }

  /**
   * Vectorize canvas data and return SVG
   */
  async vectorizeCanvas(canvasId, options = {}) {
    const opts = { ...this.defaultOptions, ...options };
    const { canvas, ctx } = canvasManager.getCanvas(canvasId);
    
    // Get image data for processing
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Convert to binary bitmap for potrace-like algorithm
    const bitmap = this.createBitmap(imageData, opts.threshold || 128);
    
    // Trace paths
    const paths = this.tracePaths(bitmap, canvas.width, canvas.height, opts);
    
    // Generate SVG
    const svg = this.generateSVG(paths, canvas.width, canvas.height, opts);
    
    return svg;
  }

  /**
   * Create binary bitmap from image data
   */
  createBitmap(imageData, threshold = 128) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const bitmap = new Array(width * height);

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const alpha = data[i + 3];
      
      // Convert to grayscale and apply threshold
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      const pixelIndex = Math.floor(i / 4);
      
      // Consider transparent pixels as background (white)
      bitmap[pixelIndex] = (alpha < 128 || gray > threshold) ? 0 : 1;
    }

    return { data: bitmap, width, height };
  }

  /**
   * Trace paths using a simplified potrace-like algorithm
   */
  tracePaths(bitmap, width, height, options) {
    const paths = [];
    const visited = new Array(width * height).fill(false);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        
        if (bitmap.data[index] === 1 && !visited[index]) {
          const path = this.traceContour(bitmap, x, y, width, height, visited);
          if (path && path.length >= options.turdsize) {
            const smoothPath = this.smoothPath(path, options);
            paths.push(smoothPath);
          }
        }
      }
    }

    return paths;
  }

  /**
   * Trace contour starting from a point
   */
  traceContour(bitmap, startX, startY, width, height, visited) {
    const path = [];
    const directions = [
      [1, 0],   // right
      [0, 1],   // down
      [-1, 0],  // left
      [0, -1]   // up
    ];
    
    let x = startX;
    let y = startY;
    let dir = 0; // start going right
    
    do {
      const index = y * width + x;
      if (index >= 0 && index < visited.length) {
        visited[index] = true;
      }
      
      path.push({ x, y });
      
      // Find next direction
      let found = false;
      for (let i = 0; i < 4; i++) {
        const newDir = (dir + i) % 4;
        const dx = directions[newDir][0];
        const dy = directions[newDir][1];
        const newX = x + dx;
        const newY = y + dy;
        
        if (this.isValidPixel(bitmap, newX, newY, width, height)) {
          x = newX;
          y = newY;
          dir = newDir;
          found = true;
          break;
        }
      }
      
      if (!found) break;
      
      // Prevent infinite loops
      if (path.length > width * height) break;
      
    } while (x !== startX || y !== startY);

    return path.length > 2 ? path : null;
  }

  /**
   * Check if pixel is valid (black and within bounds)
   */
  isValidPixel(bitmap, x, y, width, height) {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    return bitmap.data[y * width + x] === 1;
  }

  /**
   * Smooth path using curve fitting
   */
  smoothPath(path, options) {
    if (!options.optcurve || path.length < 3) {
      return path;
    }

    const smoothed = [];
    const tolerance = options.opttolerance || 1;

    for (let i = 0; i < path.length; i++) {
      const prev = path[(i - 1 + path.length) % path.length];
      const curr = path[i];
      const next = path[(i + 1) % path.length];

      // Simple curve fitting - could be enhanced with Bezier curves
      if (this.shouldSmooth(prev, curr, next, tolerance)) {
        smoothed.push({
          x: (prev.x + curr.x + next.x) / 3,
          y: (prev.y + curr.y + next.y) / 3,
          smooth: true
        });
      } else {
        smoothed.push(curr);
      }
    }

    return smoothed;
  }

  /**
   * Determine if point should be smoothed
   */
  shouldSmooth(prev, curr, next, tolerance) {
    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;

    // Calculate angle between vectors
    const dot = dx1 * dx2 + dy1 * dy2;
    const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

    if (len1 === 0 || len2 === 0) return false;

    const angle = Math.acos(dot / (len1 * len2));
    return angle < Math.PI - tolerance;
  }

  /**
   * Generate SVG from paths
   */
  generateSVG(paths, width, height, options) {
    const scale = options.scale || 1;
    const scaledWidth = width * scale;
    const scaledHeight = height * scale;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${scaledWidth} ${scaledHeight}" width="${scaledWidth}" height="${scaledHeight}">`;
    
    for (const path of paths) {
      if (path.length < 2) continue;

      let pathData = `M ${path[0].x * scale} ${path[0].y * scale}`;
      
      for (let i = 1; i < path.length; i++) {
        const point = path[i];
        if (point.smooth) {
          // Could add curve commands here for smoother results
          pathData += ` L ${point.x * scale} ${point.y * scale}`;
        } else {
          pathData += ` L ${point.x * scale} ${point.y * scale}`;
        }
      }
      
      pathData += ' Z'; // Close path

      svg += `<path d="${pathData}" fill="${options.fillColor || '#000000'}" fill-rule="evenodd"/>`;
    }

    svg += '</svg>';
    return svg;
  }

  /**
   * Vectorize with custom preprocessing
   */
  async vectorizeWithPreprocessing(canvasId, preprocessOptions = {}, vectorizeOptions = {}) {
    const { canvas, ctx } = canvasManager.getCanvas(canvasId);

    // Apply preprocessing filters
    if (preprocessOptions.blur) {
      this.applyBlur(ctx, canvas.width, canvas.height, preprocessOptions.blur);
    }

    if (preprocessOptions.contrast) {
      this.applyContrast(ctx, canvas.width, canvas.height, preprocessOptions.contrast);
    }

    if (preprocessOptions.brightness) {
      this.applyBrightness(ctx, canvas.width, canvas.height, preprocessOptions.brightness);
    }

    // Vectorize the processed image
    return this.vectorizeCanvas(canvasId, vectorizeOptions);
  }

  /**
   * Apply blur filter
   */
  applyBlur(ctx, width, height, radius) {
    // Simple box blur implementation
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const blurred = new Uint8ClampedArray(data);

    const kernelSize = Math.floor(radius) * 2 + 1;
    const halfKernel = Math.floor(kernelSize / 2);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0, g = 0, b = 0, a = 0;
        let count = 0;

        for (let ky = -halfKernel; ky <= halfKernel; ky++) {
          for (let kx = -halfKernel; kx <= halfKernel; kx++) {
            const px = x + kx;
            const py = y + ky;

            if (px >= 0 && px < width && py >= 0 && py < height) {
              const index = (py * width + px) * 4;
              r += data[index];
              g += data[index + 1];
              b += data[index + 2];
              a += data[index + 3];
              count++;
            }
          }
        }

        const index = (y * width + x) * 4;
        blurred[index] = r / count;
        blurred[index + 1] = g / count;
        blurred[index + 2] = b / count;
        blurred[index + 3] = a / count;
      }
    }

    const newImageData = new ImageData(blurred, width, height);
    ctx.putImageData(newImageData, 0, 0);
  }

  /**
   * Apply contrast filter
   */
  applyContrast(ctx, width, height, contrast) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.max(0, Math.min(255, factor * (data[i] - 128) + 128));
      data[i + 1] = Math.max(0, Math.min(255, factor * (data[i + 1] - 128) + 128));
      data[i + 2] = Math.max(0, Math.min(255, factor * (data[i + 2] - 128) + 128));
    }

    ctx.putImageData(imageData, 0, 0);
  }

  /**
   * Apply brightness filter
   */
  applyBrightness(ctx, width, height, brightness) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.max(0, Math.min(255, data[i] + brightness));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + brightness));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + brightness));
    }

    ctx.putImageData(imageData, 0, 0);
  }

  /**
   * Generate SVG path data only (without wrapper)
   */
  async generatePathData(canvasId, options = {}) {
    const opts = { ...this.defaultOptions, ...options };
    const { canvas, ctx } = canvasManager.getCanvas(canvasId);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const bitmap = this.createBitmap(imageData, opts.threshold || 128);
    const paths = this.tracePaths(bitmap, canvas.width, canvas.height, opts);
    
    const scale = options.scale || 1;
    let pathData = '';
    
    for (const path of paths) {
      if (path.length < 2) continue;

      let d = `M ${path[0].x * scale} ${path[0].y * scale}`;
      
      for (let i = 1; i < path.length; i++) {
        const point = path[i];
        d += ` L ${point.x * scale} ${point.y * scale}`;
      }
      
      d += ' Z';
      pathData += d + ' ';
    }

    return pathData.trim();
  }
}

module.exports = new Vectorizer();