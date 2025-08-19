# Convec API Reference

Complete API documentation for the Convec image processing and vectorization service.

## Base URL
```
http://localhost:3000/api
```

## Authentication
Currently no authentication is required. Rate limiting is applied per IP address.

## Rate Limits
- General API: 100 requests per 15 minutes
- Upload endpoints: 20 requests per 15 minutes  
- Batch processing: 5 requests per hour

---

## Background Removal Endpoints

### Remove Background by Color
Remove background pixels matching a target color within tolerance.

```http
POST /background/remove
```

**Parameters:**
- `image` (file, required) - Image file (PNG, JPEG, WebP)
- `targetColor` (string|array, optional) - Target color as hex (#ffffff) or RGB array [255,255,255]. Default: [255,255,255]
- `tolerance` (number, optional) - Color matching tolerance (0-100). Default: 10
- `method` (string, optional) - Removal method: color, fuzzy, edge-preserving. Default: color
- `outputFormat` (string, optional) - Output format: png, jpeg, webp. Default: png

**Response:**
- Binary image data with background removed
- Content-Type: image/{outputFormat}

**Example:**
```bash
curl -X POST http://localhost:3000/api/background/remove \
  -F "image=@photo.jpg" \
  -F "targetColor=#ffffff" \
  -F "tolerance=15" \
  --output result.png
```

### Chroma Key Background Removal
Advanced green screen / chroma key background removal.

```http
POST /background/chroma-key
```

**Parameters:**
- `image` (file, required) - Image file
- `targetHue` (number, optional) - Target hue in degrees (0-360). Default: 120 (green)
- `hueTolerance` (number, optional) - Hue tolerance in degrees (0-180). Default: 15
- `saturationMin` (number, optional) - Minimum saturation (0-1). Default: 0.3
- `outputFormat` (string, optional) - Output format. Default: png

**Example:**
```bash
curl -X POST http://localhost:3000/api/background/chroma-key \
  -F "image=@greenscreen.jpg" \
  -F "targetHue=120" \
  -F "hueTolerance=20" \
  --output chroma_key_result.png
```

### Flood Fill Background Removal
Remove background using flood fill from starting point.

```http
POST /background/flood-fill
```

**Parameters:**
- `image` (file, required) - Image file
- `startX` (number, optional) - Starting X coordinate. Default: 0
- `startY` (number, optional) - Starting Y coordinate. Default: 0
- `tolerance` (number, optional) - Color tolerance. Default: 10
- `outputFormat` (string, optional) - Output format. Default: png

### Replace Background
Replace background with solid color or another image.

```http
POST /background/replace
```

**Parameters:**
- `image` (file, required) - Main image file
- `background` (file, optional) - Background image file
- `backgroundColor` (string, optional) - Background color if no image provided. Default: #ffffff
- `outputFormat` (string, optional) - Output format. Default: png

**Example:**
```bash
curl -X POST http://localhost:3000/api/background/replace \
  -F "image=@subject.png" \
  -F "background=@new_background.jpg" \
  --output replaced.png
```

### Batch Background Removal
Process multiple images with same settings.

```http
POST /background/batch
```

**Parameters:**
- `images` (files, required) - Multiple image files (max 10)
- `method` (string, optional) - Processing method. Default: color
- `targetColor` (string|array, optional) - Target color. Default: [255,255,255]
- `tolerance` (number, optional) - Color tolerance. Default: 10
- `outputFormat` (string, optional) - Output format. Default: png

**Response:**
```json
{
  "processed": 3,
  "results": [
    {
      "index": 0,
      "success": true,
      "filename": "processed_0.png",
      "data": "base64_encoded_image_data"
    },
    {
      "index": 1,
      "success": false,
      "error": "Processing failed"
    }
  ]
}
```

---

## Vectorization Endpoints

### Pure Vectorization
Convert raster image to vector format without background processing.

```http
POST /vectorize
```

**Parameters:**
- `image` (file, required) - Image file
- `scale` (number, optional) - Output scaling factor. Default: 1
- `outputFormat` (string, optional) - svg, path. Default: svg
- `fillColor` (string, optional) - Fill color for vectors. Default: #000000
- `threshold` (number, optional) - Binary threshold (0-255). Default: 128
- `turdsize` (number, optional) - Minimum path size. Default: 5
- `optcurve` (boolean, optional) - Enable curve optimization. Default: true
- `opttolerance` (number, optional) - Curve tolerance. Default: 1
- `preprocessing` (object, optional) - Preprocessing options

**Preprocessing Options:**
```json
{
  "blur": 2,
  "contrast": 20,
  "brightness": 10
}
```

**Response (SVG):**
- Content-Type: image/svg+xml
- SVG document as text

**Response (Path):**
```json
{
  "success": true,
  "pathData": "M 25 25 L 75 25 L 75 75 L 25 75 Z",
  "width": 100,
  "height": 100
}
```

### Complete Processing
Remove background and vectorize in single operation.

```http
POST /process/complete
```

**Parameters:**
Combines all background removal and vectorization parameters.

**Example:**
```bash
curl -X POST http://localhost:3000/api/process/complete \
  -F "image=@logo.png" \
  -F "targetColor=#ffffff" \
  -F "tolerance=15" \
  -F "outputFormat=svg" \
  -F "scale=2" \
  --output vectorized_logo.svg
```

---

## Font Management Endpoints

### List Available Fonts
Get all available system and custom fonts.

```http
GET /fonts/list
```

**Response:**
```json
{
  "success": true,
  "count": 156,
  "fonts": [
    {
      "familyName": "Arial",
      "type": "system",
      "fullName": "Arial Regular",
      "style": "normal",
      "weight": 400,
      "format": "ttf"
    }
  ]
}
```

### Get Font Families
Get font families grouped by type.

```http
GET /fonts/families
```

**Response:**
```json
{
  "success": true,
  "families": {
    "system": ["Arial", "Times New Roman", "Helvetica"],
    "custom": ["MyCustomFont"],
    "generic": ["serif", "sans-serif", "monospace"]
  }
}
```

### Upload Custom Font
Upload and register a custom font file.

```http
POST /fonts/upload
```

**Parameters:**
- `font` (file, required) - Font file (TTF, OTF, WOFF, WOFF2)
- `familyName` (string, optional) - Custom family name

**Response:**
```json
{
  "success": true,
  "message": "Font uploaded successfully",
  "font": {
    "familyName": "MyCustomFont",
    "format": "ttf",
    "glyphCount": 256
  }
}
```

### Font Statistics
Get font manager statistics.

```http
GET /fonts/stats
```

---

## Text Processing Endpoints

### Render Text to Image
Render text to a raster image with advanced formatting.

```http
POST /text/render
```

**Parameters:**
- `text` (string, required) - Text to render
- `fontFamily` (string, optional) - Font family name. Default: Arial
- `fontSize` (number, optional) - Font size in pixels (8-200). Default: 24
- `color` (string, optional) - Text color as hex. Default: #000000
- `backgroundColor` (string, optional) - Background color. Default: transparent
- `width` (number, optional) - Canvas width. Default: 800
- `height` (number, optional) - Canvas height. Default: 400
- `alignment` (string, optional) - Text alignment: left, center, right. Default: left
- `lineHeight` (number, optional) - Line height in pixels. Default: fontSize * 1.2
- `padding` (number, optional) - Canvas padding. Default: 20
- `wordWrap` (boolean, optional) - Enable word wrapping. Default: true
- `effects` (object, optional) - Text effects
- `outputFormat` (string, optional) - png, jpeg, json. Default: png

**Text Effects:**
```json
{
  "shadow": {
    "color": "rgba(0,0,0,0.5)",
    "offsetX": 2,
    "offsetY": 2,
    "blur": 4
  },
  "outline": {
    "color": "#000000",
    "width": 2
  },
  "gradient": {
    "type": "linear",
    "stops": [
      {"position": 0, "color": "#ff0000"},
      {"position": 1, "color": "#0000ff"}
    ]
  }
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/text/render \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello World",
    "fontSize": 48,
    "color": "#ff0000",
    "effects": {
      "shadow": {
        "color": "rgba(0,0,0,0.3)",
        "offsetX": 3,
        "offsetY": 3
      }
    }
  }' \
  --output rendered_text.png
```

### Measure Text Dimensions
Calculate text dimensions without rendering.

```http
POST /text/measure
```

**Parameters:**
- `text` (string, required) - Text to measure
- `fontFamily` (string, optional) - Font family. Default: Arial
- `fontSize` (number, optional) - Font size. Default: 24

**Response:**
```json
{
  "success": true,
  "text": "Sample Text",
  "fontFamily": "Arial",
  "fontSize": 24,
  "metrics": {
    "width": 142.5,
    "height": 24,
    "actualBoundingBoxLeft": 0,
    "actualBoundingBoxRight": 142.5
  }
}
```

### Vectorize Text
Render text and convert to vector paths.

```http
POST /text/vectorize
```

**Parameters:**
Combines text rendering and vectorization parameters.

**Response (SVG):**
- Complete SVG with vectorized text paths

**Response (Path):**
```json
{
  "success": true,
  "pathData": "M 10 30 L 45 30 L 45 50 L 10 50 Z",
  "width": 400,
  "height": 200
}
```

---

## Combined Processing Endpoints

### Add Text Overlay
Add text overlay to existing image.

```http
POST /process/text-overlay
```

**Parameters:**
- `image` (file, required) - Base image file
- `text` (string, required) - Overlay text
- `x` (number, optional) - Text X position. Default: 50
- `y` (number, optional) - Text Y position. Default: 50
- `fontFamily` (string, optional) - Font family. Default: Arial
- `fontSize` (number, optional) - Font size. Default: 48
- `color` (string, optional) - Text color. Default: #ffffff
- `effects` (object, optional) - Text effects
- `outputFormat` (string, optional) - Output format. Default: png

---

## System Endpoints

### Health Check
Check API health status.

```http
GET /health
```

**Response:**
```json
{
  "status": "OK",
  "message": "Convec API is running"
}
```

### Canvas Statistics
Get canvas manager statistics and performance metrics.

```http
GET /canvas/stats
```

**Response:**
```json
{
  "activeCanvases": 3,
  "memoryUsage": {
    "heapUsed": "45MB",
    "heapTotal": "67MB"
  },
  "config": {
    "maxImageSize": 2400,
    "maxCanvasInstances": 20
  }
}
```

### Manual Cleanup
Trigger manual cleanup of old canvases.

```http
POST /canvas/cleanup
```

**Response:**
```json
{
  "success": true,
  "message": "Cleaned up 5 old canvases"
}
```

---

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "Error type",
  "message": "Detailed error description"
}
```

### Common HTTP Status Codes
- `400 Bad Request` - Invalid parameters or missing required fields
- `413 Payload Too Large` - File size exceeds limits
- `415 Unsupported Media Type` - Invalid file format
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server processing error

### Error Types
- `Validation failed` - Parameter validation errors
- `File too large` - Exceeds maximum file size
- `Canvas not found` - Invalid canvas ID
- `Font not found` - Font loading failed
- `Processing failed` - Image/text processing error

---

## Performance Tips

1. **Image Size**: Keep images under 2400x2400px for optimal performance
2. **Batch Processing**: Use batch endpoints for multiple similar operations
3. **Caching**: Identical requests are cached automatically
4. **Format Selection**: Use PNG for transparency, JPEG for photos
5. **Text Rendering**: Pre-measure text for layout calculations
6. **Vectorization**: Use appropriate threshold and turdsize for clean results

## Rate Limiting Headers

All responses include rate limiting headers:
- `X-RateLimit-Limit` - Request limit per window
- `X-RateLimit-Remaining` - Remaining requests in current window
- `X-RateLimit-Reset` - Window reset time (Unix timestamp)

## Caching Headers

Processed results include caching information:
- `X-Cache: HIT` - Result served from cache
- `X-Cache: MISS` - Result computed and cached

---

## SDK Examples

### JavaScript (Node.js)
```javascript
const FormData = require('form-data');
const fs = require('fs');
const fetch = require('node-fetch');

async function removeBackground(imagePath) {
  const form = new FormData();
  form.append('image', fs.createReadStream(imagePath));
  form.append('targetColor', '#ffffff');
  form.append('tolerance', '15');
  
  const response = await fetch('http://localhost:3000/api/background/remove', {
    method: 'POST',
    body: form
  });
  
  return response.buffer();
}
```

### Python
```python
import requests

def vectorize_image(image_path):
    with open(image_path, 'rb') as f:
        files = {'image': f}
        data = {
            'outputFormat': 'svg',
            'scale': 2,
            'threshold': 128
        }
        
        response = requests.post(
            'http://localhost:3000/api/vectorize',
            files=files,
            data=data
        )
        
    return response.text
```

### cURL Examples
See individual endpoint documentation above for specific cURL examples.