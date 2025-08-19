# Convec API - Advanced Vectorization with Canvas & Font Integration

A powerful API combining vectorization, background removal, and text rendering capabilities built on Canvas API and FontFace API.

## Features

- 🎨 **Advanced Background Removal**
  - Color-based removal
  - Chroma key (green screen)
  - Edge-preserving algorithms
  - Flood fill removal
  - Fuzzy color matching

- 🖋️ **Font Management & Text Rendering**
  - System font discovery
  - Custom font uploads
  - Advanced text effects (shadows, gradients, outlines)
  - Multi-line text with word wrapping
  - Text-to-vector conversion

- 🖼️ **Image Processing**
  - Multiple format support (PNG, JPEG, WebP, SVG)
  - Canvas-based manipulation
  - Batch processing
  - Memory-efficient operations

- 🔄 **Vectorization Integration**
  - Seamless integration with existing Convec vectorizer
  - Background removal + vectorization pipeline
  - SVG output with transparency support

## Installation

```bash
# Clone the repository
git clone https://github.com/ThatsRight-ItsTJ/convec-api.git
cd convec-api

# Install dependencies
npm install

# Start the server
npm start
```

## API Endpoints

### Background Removal

- `POST /api/background/remove` - Color-based background removal
- `POST /api/background/chroma-key` - Green screen removal
- `POST /api/background/flood-fill` - Flood fill removal
- `POST /api/background/replace` - Replace background with color/image
- `POST /api/background/batch` - Batch processing

### Font Management

- `GET /api/fonts/list` - List available fonts
- `GET /api/fonts/families` - Get font families
- `POST /api/fonts/upload` - Upload custom fonts
- `DELETE /api/fonts/cache` - Clear font cache

### Text Processing

- `POST /api/text/render` - Render text to image
- `POST /api/text/measure` - Calculate text dimensions
- `POST /api/text/vectorize` - Convert text to vectors

### Combined Processing

- `POST /api/process/complete` - Background removal + vectorization
- `POST /api/process/text-overlay` - Add text overlay to images

## Usage Examples

### Background Removal

```bash
curl -X POST http://localhost:3000/api/background/remove \
  -F "image=@input.png" \
  -F "targetColor=[255,255,255]" \
  -F "tolerance=10" \
  --output result.png
```

### Text Rendering

```bash
curl -X POST http://localhost:3000/api/text/render \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello World",
    "fontFamily": "Arial",
    "fontSize": 48,
    "color": "#ff0000",
    "width": 800,
    "height": 400
  }' \
  --output text.png
```

### Custom Font Upload

```bash
curl -X POST http://localhost:3000/api/fonts/upload \
  -F "font=@custom-font.ttf" \
  -F "familyName=MyCustomFont"
```

## Configuration

Environment variables can be set in `.env`:

```env
NODE_ENV=development
PORT=3000
MAX_FILE_SIZE=52428800
CANVAS_MAX_SIZE=2400
FONT_CACHE_SIZE=100
ENABLE_CLEANUP=true
```

## Web Interface

Access the web interface at `http://localhost:3000` for interactive image processing with:

- Drag & drop image upload
- Real-time background removal
- Text overlay capabilities
- Vectorization integration
- Download processed results

## Development

```bash
# Development with hot reload
npm run dev

# Run tests
npm test

# Check health
curl http://localhost:3000/health
```

## Architecture

```
src/
├── api/
│   ├── canvas-endpoints.js    # Background removal & processing
│   └── font-endpoints.js      # Font management & text rendering
├── canvas/
│   ├── canvas-manager.js      # Canvas lifecycle management
│   └── background-removal.js  # Background removal algorithms
├── fonts/
│   ├── font-manager.js        # Font discovery & management
│   └── text-renderer.js       # Text rendering engine
└── config/
    ├── canvas.js              # Canvas configuration
    └── fonts.js               # Font configuration
```

## Key Advantages

- ✅ **100% Free** - No API limits or external dependencies
- ✅ **Server-side Processing** - Full control over algorithms
- ✅ **Memory Efficient** - Automatic cleanup and optimization
- ✅ **Extensible** - Easy to add new processing methods
- ✅ **Production Ready** - Error handling and validation

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Support

For issues and questions, please use the GitHub issue tracker.