const { parentPort } = require('worker_threads');
const { createCanvas } = require('canvas');

/**
 * Worker thread for CPU-intensive vectorization tasks
 */

parentPort.on('message', async (data) => {
  try {
    const { imageData, options, operation } = data;

    let result;
    switch (operation) {
      case 'vectorize':
        result = await performVectorization(imageData, options);
        break;
      case 'backgroundRemoval':
        result = await performBackgroundRemoval(imageData, options);
        break;
      case 'preprocessing':
        result = await performPreprocessing(imageData, options);
        break;
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    parentPort.postMessage({ success: true, result });
  } catch (error) {
    parentPort.postMessage({ 
      success: false, 
      error: error.message,
      stack: error.stack 
    });
  }
});

/**
 * Perform vectorization in worker thread
 */
async function performVectorization(imageData, options) {
  const { width, height, data } = imageData;
  const { threshold = 128, turdsize = 5, scale = 1 } = options;

  // Create binary bitmap
  const bitmap = createBitmap(data, width, height, threshold);
  
  // Trace paths
  const paths = tracePaths(bitmap, width, height, turdsize);
  
  // Generate path data
  let pathData = '';
  for (const path of paths) {
    if (path.length < 2) continue;
    
    let d = `M ${path[0].x * scale} ${path[0].y * scale}`;
    for (let i = 1; i < path.length; i++) {
      d += ` L ${path[i].x * scale} ${path[i].y * scale}`;
    }
    d += ' Z';
    pathData += d + ' ';
  }

  return {
    pathData: pathData.trim(),
    pathCount: paths.length,
    dimensions: { width: width * scale, height: height * scale }
  };
}

/**
 * Perform background removal in worker thread
 */
async function performBackgroundRemoval(imageData, options) {
  const { width, height, data } = imageData;
  const { targetColor = [255, 255, 255], tolerance = 10, method = 'color' } = options;
  
  const processedData = new Uint8ClampedArray(data);

  switch (method) {
    case 'color':
      removeByColor(processedData, targetColor, tolerance);
      break;
    case 'chroma-key':
      chromaKeyRemoval(processedData, options.targetHue || 120, options.hueTolerance || 15);
      break;
    default:
      removeByColor(processedData, targetColor, tolerance);
  }

  return { width, height, data: Array.from(processedData) };
}

/**
 * Perform image preprocessing in worker thread
 */
async function performPreprocessing(imageData, options) {
  const { width, height, data } = imageData;
  const processedData = new Uint8ClampedArray(data);

  if (options.blur) {
    applyBlur(processedData, width, height, options.blur);
  }

  if (options.contrast) {
    applyContrast(processedData, options.contrast);
  }

  if (options.brightness) {
    applyBrightness(processedData, options.brightness);
  }

  return { width, height, data: Array.from(processedData) };
}

// Helper functions
function createBitmap(data, width, height, threshold) {
  const bitmap = new Array(width * height);
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const alpha = data[i + 3];
    
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    const pixelIndex = Math.floor(i / 4);
    
    bitmap[pixelIndex] = (alpha < 128 || gray > threshold) ? 0 : 1;
  }

  return { data: bitmap, width, height };
}

function tracePaths(bitmap, width, height, turdsize) {
  const paths = [];
  const visited = new Array(width * height).fill(false);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      
      if (bitmap.data[index] === 1 && !visited[index]) {
        const path = traceContour(bitmap, x, y, width, height, visited);
        if (path && path.length >= turdsize) {
          paths.push(path);
        }
      }
    }
  }

  return paths;
}

function traceContour(bitmap, startX, startY, width, height, visited) {
  const path = [];
  const directions = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  
  let x = startX;
  let y = startY;
  let dir = 0;
  
  do {
    const index = y * width + x;
    if (index >= 0 && index < visited.length) {
      visited[index] = true;
    }
    
    path.push({ x, y });
    
    let found = false;
    for (let i = 0; i < 4; i++) {
      const newDir = (dir + i) % 4;
      const dx = directions[newDir][0];
      const dy = directions[newDir][1];
      const newX = x + dx;
      const newY = y + dy;
      
      if (isValidPixel(bitmap, newX, newY, width, height)) {
        x = newX;
        y = newY;
        dir = newDir;
        found = true;
        break;
      }
    }
    
    if (!found) break;
    if (path.length > width * height) break;
    
  } while (x !== startX || y !== startY);

  return path.length > 2 ? path : null;
}

function isValidPixel(bitmap, x, y, width, height) {
  if (x < 0 || x >= width || y < 0 || y >= height) return false;
  return bitmap.data[y * width + x] === 1;
}

function removeByColor(data, targetColor, tolerance) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    if (Math.abs(r - targetColor[0]) < tolerance &&
        Math.abs(g - targetColor[1]) < tolerance &&
        Math.abs(b - targetColor[2]) < tolerance) {
      data[i + 3] = 0;
    }
  }
}

function chromaKeyRemoval(data, targetHue, hueTolerance) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;

    const hsl = rgbToHsl(r, g, b);
    
    if (Math.abs(hsl.h * 360 - targetHue) < hueTolerance && hsl.s > 0.3) {
      data[i + 3] = 0;
    }
  }
}

function rgbToHsl(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s;
  const l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
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

function applyBlur(data, width, height, radius) {
  const kernelSize = Math.floor(radius) * 2 + 1;
  const halfKernel = Math.floor(kernelSize / 2);
  const blurred = new Uint8ClampedArray(data);

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

  data.set(blurred);
}

function applyContrast(data, contrast) {
  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.max(0, Math.min(255, factor * (data[i] - 128) + 128));
    data[i + 1] = Math.max(0, Math.min(255, factor * (data[i + 1] - 128) + 128));
    data[i + 2] = Math.max(0, Math.min(255, factor * (data[i + 2] - 128) + 128));
  }
}

function applyBrightness(data, brightness) {
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.max(0, Math.min(255, data[i] + brightness));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + brightness));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + brightness));
  }
}