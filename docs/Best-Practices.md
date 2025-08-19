# Convec API Best Practices Guide

This guide provides recommendations for optimal usage of the Convec API to achieve the best performance, quality, and reliability.

## Image Processing Guidelines

### Image Size and Quality

**Optimal Image Sizes:**
- **Small images (< 500px)**: Good for icons, logos, simple graphics
- **Medium images (500-1200px)**: Ideal for most processing tasks
- **Large images (1200-2400px)**: Use only when high detail is required

**Recommendations:**
- Keep images under 2MB when possible for faster processing
- Use PNG for images with transparency or sharp edges
- Use JPEG for photographic content without transparency needs
- Avoid uploading images larger than 2400x2400px (automatically resized)

### Background Removal Best Practices

**Color-Based Removal:**
```javascript
// Good: High contrast, solid background
{
  targetColor: [255, 255, 255], // Pure white
  tolerance: 10,
  method: 'color'
}

// Better: For near-white backgrounds
{
  targetColor: [248, 248, 248], // Slightly off-white
  tolerance: 20,
  method: 'fuzzy'
}
```

**Chroma Key (Green Screen):**
```javascript
// Optimal settings for standard green screen
{
  targetHue: 120,        // Pure green
  hueTolerance: 15,      // Moderate tolerance
  saturationMin: 0.4     // Ensure vivid greens
}

// For blue screen
{
  targetHue: 240,        // Blue
  hueTolerance: 20,
  saturationMin: 0.3
}
```

**When to Use Each Method:**
- **Color removal**: Solid, uniform backgrounds (white, black, single colors)
- **Chroma key**: Green/blue screen photography
- **Fuzzy removal**: Slightly varied backgrounds (cream, off-white)
- **Edge-preserving**: Complex backgrounds requiring smooth transitions
- **Flood fill**: Specific regions or connected areas

### Vectorization Guidelines

**Parameter Tuning:**

```javascript
// For clean logos/graphics
{
  threshold: 128,
  turdsize: 5,
  optcurve: true,
  opttolerance: 0.5
}

// For detailed illustrations
{
  threshold: 100,
  turdsize: 2,
  optcurve: true,
  opttolerance: 0.2
}

// For photographs (not recommended, but if needed)
{
  threshold: 140,
  turdsize: 10,
  optcurve: false,
  opttolerance: 1.0
}
```

**Preprocessing for Better Results:**
```javascript
// Enhance contrast before vectorization
const preprocessing = {
  contrast: 30,      // Increase edge definition
  brightness: 5,     // Slight brightness boost
  blur: 0.5         // Minimal blur to reduce noise
};
```

## Text Rendering Best Practices

### Font Selection

**System Fonts (Reliable):**
- Arial, Helvetica (sans-serif)
- Times New Roman, Times (serif)
- Courier New (monospace)

**Custom Fonts:**
- Upload TTF or OTF for best compatibility
- Keep font files under 5MB
- Test font rendering before batch operations

### Text Layout Optimization

**Readable Text:**
```javascript
{
  fontSize: 24,           // Minimum for readability
  lineHeight: 36,         // 1.5x fontSize
  padding: 20,            // Adequate margins
  wordWrap: true,         // Prevent overflow
  alignment: 'left'       // Most readable for body text
}
```

**Display Text:**
```javascript
{
  fontSize: 48,           // Large for headers
  lineHeight: 58,         // Tighter line spacing
  alignment: 'center',    // Centered headlines
  effects: {
    outline: {
      color: '#000000',
      width: 2
    }
  }
}
```

### Text Effects Guidelines

**Subtle Shadow (Recommended):**
```javascript
{
  shadow: {
    color: 'rgba(0,0,0,0.3)',
    offsetX: 2,
    offsetY: 2,
    blur: 4
  }
}
```

**Strong Outline:**
```javascript
{
  outline: {
    color: '#000000',
    width: 3
  }
}
```

**Gradient Effects:**
```javascript
{
  gradient: {
    type: 'linear',
    stops: [
      { position: 0, color: '#ff6b6b' },
      { position: 1, color: '#4ecdc4' }
    ]
  }
}
```

## Performance Optimization

### Request Optimization

**Batch Processing:**
```javascript
// Good: Process similar images together
const images = ['logo1.png', 'logo2.png', 'logo3.png'];
const batchRequest = {
  method: 'color',
  targetColor: [255, 255, 255],
  tolerance: 10
};

// Better: Use appropriate batch sizes (5-10 images)
const batches = chunkArray(images, 5);
```

**Caching Strategy:**
```javascript
// Identical requests are automatically cached
const request1 = {
  targetColor: [255, 255, 255],
  tolerance: 10,
  method: 'color'
};

// This will be served from cache if same image + parameters
const request2 = {
  targetColor: [255, 255, 255],
  tolerance: 10,
  method: 'color'
};
```

### Memory Management

**Large Image Handling:**
```javascript
// Avoid: Processing many large images simultaneously
const promises = largeImages.map(processImage); // Memory intensive

// Better: Process in smaller batches
async function processBatch(images, batchSize = 3) {
  for (let i = 0; i < images.length; i += batchSize) {
    const batch = images.slice(i, i + batchSize);
    await Promise.all(batch.map(processImage));
    // Allow garbage collection between batches
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}
```

### Error Handling

**Robust Request Handling:**
```javascript
async function safeApiCall(endpoint, data, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(endpoint, data);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      
      return response;
    } catch (error) {
      if (i === retries - 1) throw error;
      
      // Exponential backoff
      await new Promise(resolve => 
        setTimeout(resolve, Math.pow(2, i) * 1000)
      );
    }
  }
}
```

## Quality Guidelines

### Image Quality Assessment

**Before Processing:**
- Check image contrast and clarity
- Ensure subject is well-separated from background
- Verify image format is appropriate

**After Processing:**
- Inspect edges for artifacts
- Check transparency quality
- Verify vectorization accuracy

### Vectorization Quality

**Good Candidates for Vectorization:**
- Clean logos and graphics
- High contrast images
- Simple illustrations
- Text-based images

**Poor Candidates:**
- Detailed photographs
- Complex gradients
- Heavily textured images
- Low contrast images

## API Integration Patterns

### Production Deployment

**Environment Configuration:**
```javascript
const config = {
  apiUrl: process.env.CONVEC_API_URL || 'http://localhost:3000/api',
  timeout: 30000,
  retries: 3,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  supportedFormats: ['png', 'jpg', 'jpeg', 'webp']
};
```

**Error Handling:**
```javascript
class ConvecClient {
  async processImage(imageBuffer, options = {}) {
    try {
      // Validate input
      if (!Buffer.isBuffer(imageBuffer)) {
        throw new Error('Invalid image buffer');
      }
      
      if (imageBuffer.length > this.maxFileSize) {
        throw new Error('File size too large');
      }
      
      // Process request
      const result = await this.makeRequest('/background/remove', {
        image: imageBuffer,
        ...options
      });
      
      return result;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }
  
  handleError(error) {
    // Log errors for monitoring
    console.error('Convec API Error:', {
      message: error.message,
      timestamp: new Date().toISOString(),
      stack: error.stack
    });
  }
}
```

### Rate Limiting Handling

```javascript
class RateLimitedClient {
  constructor() {
    this.requestQueue = [];
    this.isProcessing = false;
  }
  
  async makeRequest(endpoint, data) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ endpoint, data, resolve, reject });
      this.processQueue();
    });
  }
  
  async processQueue() {
    if (this.isProcessing || this.requestQueue.length === 0) {
      return;
    }
    
    this.isProcessing = true;
    
    while (this.requestQueue.length > 0) {
      const { endpoint, data, resolve, reject } = this.requestQueue.shift();
      
      try {
        const response = await fetch(endpoint, data);
        
        if (response.status === 429) {
          // Rate limited, wait and retry
          const retryAfter = response.headers.get('Retry-After') || 60;
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          this.requestQueue.unshift({ endpoint, data, resolve, reject });
          continue;
        }
        
        resolve(response);
      } catch (error) {
        reject(error);
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.isProcessing = false;
  }
}
```

## Security Considerations

### Input Validation

**File Validation:**
```javascript
function validateImageFile(file) {
  const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
  const maxSize = 50 * 1024 * 1024; // 50MB
  
  if (!allowedTypes.includes(file.mimetype)) {
    throw new Error('Invalid file type');
  }
  
  if (file.size > maxSize) {
    throw new Error('File too large');
  }
  
  return true;
}
```

**Parameter Sanitization:**
```javascript
function sanitizeOptions(options) {
  return {
    tolerance: Math.max(0, Math.min(100, Number(options.tolerance) || 10)),
    scale: Math.max(0.1, Math.min(5, Number(options.scale) || 1)),
    fontSize: Math.max(8, Math.min(200, Number(options.fontSize) || 24)),
    targetColor: validateColor(options.targetColor)
  };
}
```

### Production Monitoring

**Health Checks:**
```javascript
async function healthCheck() {
  try {
    const response = await fetch('/health');
    const data = await response.json();
    return data.status === 'OK';
  } catch (error) {
    return false;
  }
}

// Monitor API health
setInterval(async () => {
  const isHealthy = await healthCheck();
  if (!isHealthy) {
    console.error('API health check failed');
    // Trigger alerts
  }
}, 60000); // Check every minute
```

## Common Pitfalls to Avoid

1. **Uploading Unsupported Formats**: Always validate file types
2. **Ignoring Rate Limits**: Implement proper rate limiting in clients
3. **Processing Inappropriate Images**: Don't vectorize complex photographs
4. **Memory Leaks**: Clean up resources in long-running applications
5. **No Error Handling**: Always handle API errors gracefully
6. **Blocking Operations**: Use async/await properly for concurrent processing
7. **Hardcoded Values**: Use configuration for all API endpoints and parameters

## Troubleshooting Guide

### Common Issues

**Background Removal Not Working:**
- Check image contrast
- Adjust tolerance values
- Try different removal methods
- Ensure background is actually removable

**Poor Vectorization Quality:**
- Increase image contrast with preprocessing
- Adjust threshold values
- Use appropriate turdsize for detail level
- Consider if image is suitable for vectorization

**Text Rendering Issues:**
- Verify font availability
- Check text encoding
- Ensure adequate canvas size
- Test with system fonts first

**Performance Problems:**
- Reduce image sizes
- Use batch processing appropriately
- Monitor memory usage
- Implement proper caching

For additional support, check the API logs and error responses for detailed information about any processing issues.