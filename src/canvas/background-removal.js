const canvasManager = require('./canvas-manager');

class BackgroundRemoval {
  /**
   * Remove background using simple color matching
   */
  static removeByColor(canvasId, targetColor = [255, 255, 255], tolerance = 10) {
    const { canvas, ctx } = canvasManager.getCanvas(canvasId);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Check if pixel matches target color within tolerance
      if (Math.abs(r - targetColor[0]) < tolerance &&
          Math.abs(g - targetColor[1]) < tolerance &&
          Math.abs(b - targetColor[2]) < tolerance) {
        data[i + 3] = 0; // Set alpha to 0 (transparent)
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvasId;
  }

  /**
   * Advanced chroma key removal (green screen)
   */
  static chromaKey(canvasId, targetHue = 120, hueTolerance = 15, saturationMin = 0.3) {
    const { canvas, ctx } = canvasManager.getCanvas(canvasId);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;

      const hsl = this.rgbToHsl(r, g, b);
      
      // Check if pixel is within chroma key range
      if (Math.abs(hsl.h * 360 - targetHue) < hueTolerance && hsl.s > saturationMin) {
        data[i + 3] = 0; // Make transparent
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvasId;
  }

  /**
   * Fuzzy color matching with wider tolerance
   */
  static fuzzyRemoval(canvasId, targetColor = [255, 255, 255], tolerance = 30) {
    const { canvas, ctx } = canvasManager.getCanvas(canvasId);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Use Euclidean distance for better color matching
      const distance = Math.sqrt(
        Math.pow(r - targetColor[0], 2) +
        Math.pow(g - targetColor[1], 2) +
        Math.pow(b - targetColor[2], 2)
      );

      if (distance < tolerance) {
        // Gradual transparency based on distance
        const alpha = Math.max(0, (distance / tolerance) * 255);
        data[i + 3] = alpha;
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvasId;
  }

  /**
   * Flood fill background removal
   */
  static floodFill(canvasId, startX = 0, startY = 0, tolerance = 10) {
    const { canvas, ctx } = canvasManager.getCanvas(canvasId);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;

    // Get starting pixel color
    const startIndex = (startY * width + startX) * 4;
    const targetColor = [data[startIndex], data[startIndex + 1], data[startIndex + 2]];

    const visited = new Set();
    const stack = [[startX, startY]];

    while (stack.length > 0) {
      const [x, y] = stack.pop();
      const key = `${x},${y}`;

      if (visited.has(key) || x < 0 || x >= width || y < 0 || y >= height) {
        continue;
      }

      visited.add(key);
      const index = (y * width + x) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];

      // Check if pixel matches target color within tolerance
      if (Math.abs(r - targetColor[0]) <= tolerance &&
          Math.abs(g - targetColor[1]) <= tolerance &&
          Math.abs(b - targetColor[2]) <= tolerance) {
        data[index + 3] = 0; // Make transparent

        // Add neighbors to stack
        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvasId;
  }

  /**
   * Edge-preserving background removal
   */
  static edgePreserving(canvasId, targetColor = [255, 255, 255], tolerance = 15) {
    const { canvas, ctx } = canvasManager.getCanvas(canvasId);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;

    // First pass: identify background pixels
    const backgroundPixels = new Set();
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];

        if (Math.abs(r - targetColor[0]) < tolerance &&
            Math.abs(g - targetColor[1]) < tolerance &&
            Math.abs(b - targetColor[2]) < tolerance) {
          backgroundPixels.add(`${x},${y}`);
        }
      }
    }

    // Second pass: apply anti-aliasing to edges
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const key = `${x},${y}`;
        
        if (backgroundPixels.has(key)) {
          const index = (y * width + x) * 4;
          
          // Check neighboring pixels for edge detection
          let neighborCount = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              if (backgroundPixels.has(`${x + dx},${y + dy}`)) {
                neighborCount++;
              }
            }
          }

          // Apply gradual transparency for edge pixels
          if (neighborCount < 8) {
            const alpha = Math.floor((neighborCount / 8) * 255);
            data[index + 3] = alpha;
          } else {
            data[index + 3] = 0; // Fully transparent
          }
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvasId;
  }

  /**
   * Replace background with new color/image
   */
  static replaceBackground(canvasId, replacement) {
    const { canvas, ctx } = canvasManager.getCanvas(canvasId);
    const originalData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Create new canvas for background
    const bgCanvas = canvasManager.createCanvas(canvas.width, canvas.height);
    const bgCtx = bgCanvas.ctx;

    if (typeof replacement === 'string') {
      // Solid color replacement
      bgCtx.fillStyle = replacement;
      bgCtx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      // Image replacement
      bgCtx.drawImage(replacement, 0, 0, canvas.width, canvas.height);
    }

    // Composite original over new background
    bgCtx.drawImage(canvas, 0, 0);
    
    // Copy result back to original canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bgCanvas.canvas, 0, 0);
    
    // Cleanup temporary canvas
    canvasManager.cleanup(bgCanvas.canvasId);
    
    return canvasId;
  }

  /**
   * Batch background removal
   */
  static async batchRemoval(canvasIds, method = 'color', options = {}) {
    const results = [];
    
    for (const canvasId of canvasIds) {
      try {
        let result;
        switch (method) {
          case 'color':
            result = this.removeByColor(canvasId, options.targetColor, options.tolerance);
            break;
          case 'chroma-key':
            result = this.chromaKey(canvasId, options.targetHue, options.hueTolerance, options.saturationMin);
            break;
          case 'fuzzy':
            result = this.fuzzyRemoval(canvasId, options.targetColor, options.tolerance);
            break;
          case 'flood-fill':
            result = this.floodFill(canvasId, options.startX, options.startY, options.tolerance);
            break;
          case 'edge-preserving':
            result = this.edgePreserving(canvasId, options.targetColor, options.tolerance);
            break;
          default:
            throw new Error(`Unknown method: ${method}`);
        }
        results.push({ canvasId, success: true, result });
      } catch (error) {
        results.push({ canvasId, success: false, error: error.message });
      }
    }
    
    return results;
  }

  /**
   * RGB to HSL conversion utility
   */
  static rgbToHsl(r, g, b) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s;
    const l = (max + min) / 2;

    if (max === min) {
      h = s = 0; // Achromatic
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }

    return { h, s, l };
  }
}

module.exports = BackgroundRemoval;