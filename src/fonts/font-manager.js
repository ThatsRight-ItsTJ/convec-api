const fs = require('fs').promises;
const path = require('path');
const fontkit = require('fontkit');
const config = require('../config/fonts');

class FontManager {
  constructor() {
    this.fontCache = new Map();
    this.systemFonts = new Map();
    this.customFonts = new Map();
    this.initialized = false;
  }

  /**
   * Initialize font manager and discover system fonts
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      await this.discoverSystemFonts();
      this.initialized = true;
      console.log(`FontManager initialized with ${this.systemFonts.size} system fonts`);
    } catch (error) {
      console.error('Failed to initialize FontManager:', error.message);
    }
  }

  /**
   * Discover system fonts
   */
  async discoverSystemFonts() {
    for (const fontPath of config.fontPaths) {
      try {
        await this.scanFontDirectory(fontPath, this.systemFonts);
      } catch (error) {
        // Silently continue if directory doesn't exist
        continue;
      }
    }
  }

  /**
   * Scan directory for fonts
   */
  async scanFontDirectory(directory, fontMap) {
    try {
      const entries = await fs.readdir(directory, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);
        
        if (entry.isDirectory()) {
          await this.scanFontDirectory(fullPath, fontMap);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase().slice(1);
          if (config.supportedFormats.includes(ext)) {
            try {
              const fontInfo = await this.analyzeFontFile(fullPath);
              if (fontInfo) {
                fontMap.set(fontInfo.familyName, {
                  ...fontInfo,
                  path: fullPath,
                  type: 'system'
                });
              }
            } catch (error) {
              // Skip invalid font files
              continue;
            }
          }
        }
      }
    } catch (error) {
      throw new Error(`Failed to scan font directory ${directory}: ${error.message}`);
    }
  }

  /**
   * Analyze font file and extract metadata
   */
  async analyzeFontFile(fontPath) {
    try {
      const font = fontkit.openSync(fontPath);
      
      return {
        familyName: font.familyName || path.basename(fontPath, path.extname(fontPath)),
        fullName: font.fullName,
        postscriptName: font.postscriptName,
        style: this.determineFontStyle(font),
        weight: font.weight || 400,
        format: path.extname(fontPath).slice(1).toLowerCase(),
        glyphCount: font.numGlyphs,
        hasKerning: font.hasKerningTable,
        isMonospace: font.isMonospace
      };
    } catch (error) {
      console.error(`Failed to analyze font ${fontPath}:`, error.message);
      return null;
    }
  }

  /**
   * Determine font style from font properties
   */
  determineFontStyle(font) {
    const style = [];
    
    if (font.isItalic) style.push('italic');
    if (font.isBold) style.push('bold');
    
    return style.length > 0 ? style.join(' ') : 'normal';
  }

  /**
   * Load font by family name
   */
  async loadFont(familyName, fallback = true) {
    // Check cache first
    if (this.fontCache.has(familyName)) {
      const cached = this.fontCache.get(familyName);
      if (Date.now() - cached.timestamp < config.cache.ttl) {
        return cached.font;
      }
    }

    // Try to find font
    let fontInfo = this.customFonts.get(familyName) || this.systemFonts.get(familyName);
    
    // Apply fallbacks if font not found
    if (!fontInfo && fallback) {
      fontInfo = this.findFallbackFont(familyName);
    }

    if (!fontInfo) {
      throw new Error(`Font not found: ${familyName}`);
    }

    try {
      const font = fontkit.openSync(fontInfo.path);
      
      // Cache the loaded font
      if (config.cache.enabled && this.fontCache.size < config.cache.maxSize) {
        this.fontCache.set(familyName, {
          font,
          timestamp: Date.now()
        });
      }
      
      return font;
    } catch (error) {
      throw new Error(`Failed to load font ${familyName}: ${error.message}`);
    }
  }

  /**
   * Find fallback font
   */
  findFallbackFont(familyName) {
    const lowerFamily = familyName.toLowerCase();
    
    // Check if it's a generic family
    if (config.fallbacks[lowerFamily]) {
      for (const fallbackName of config.fallbacks[lowerFamily]) {
        const fallbackFont = this.systemFonts.get(fallbackName);
        if (fallbackFont) return fallbackFont;
      }
    }

    // Try to find similar font by partial matching
    for (const [name, info] of this.systemFonts.entries()) {
      if (name.toLowerCase().includes(lowerFamily) || 
          lowerFamily.includes(name.toLowerCase())) {
        return info;
      }
    }

    // Return default system font
    return this.systemFonts.get('Arial') || 
           this.systemFonts.get('sans-serif') ||
           this.systemFonts.values().next().value;
  }

  /**
   * Add custom font
   */
  async addCustomFont(fontBuffer, familyName = null) {
    try {
      const font = fontkit.create(fontBuffer);
      const name = familyName || font.familyName;
      
      if (!name) {
        throw new Error('Could not determine font family name');
      }

      const fontInfo = {
        familyName: name,
        fullName: font.fullName,
        postscriptName: font.postscriptName,
        style: this.determineFontStyle(font),
        weight: font.weight || 400,
        format: 'buffer',
        glyphCount: font.numGlyphs,
        hasKerning: font.hasKerningTable,
        isMonospace: font.isMonospace,
        buffer: fontBuffer,
        type: 'custom'
      };

      this.customFonts.set(name, fontInfo);
      
      // Cache the loaded font
      if (config.cache.enabled) {
        this.fontCache.set(name, {
          font,
          timestamp: Date.now()
        });
      }

      return fontInfo;
    } catch (error) {
      throw new Error(`Failed to add custom font: ${error.message}`);
    }
  }

  /**
   * Get available fonts list
   */
  getAvailableFonts() {
    const fonts = [];
    
    // Add system fonts
    for (const [name, info] of this.systemFonts.entries()) {
      fonts.push({
        familyName: name,
        type: 'system',
        ...info
      });
    }
    
    // Add custom fonts
    for (const [name, info] of this.customFonts.entries()) {
      fonts.push({
        familyName: name,
        type: 'custom',
        ...info
      });
    }
    
    return fonts.sort((a, b) => a.familyName.localeCompare(b.familyName));
  }

  /**
   * Get font families grouped by type
   */
  getFontFamilies() {
    return {
      system: Array.from(this.systemFonts.keys()).sort(),
      custom: Array.from(this.customFonts.keys()).sort(),
      generic: Object.keys(config.fallbacks)
    };
  }

  /**
   * Validate font file
   */
  static validateFontFile(buffer, filename) {
    const ext = path.extname(filename).toLowerCase().slice(1);
    
    if (!config.supportedFormats.includes(ext)) {
      throw new Error(`Unsupported font format: ${ext}`);
    }

    if (buffer.length > config.upload.maxFileSize) {
      throw new Error('Font file too large');
    }

    try {
      // Try to create font to validate
      const font = fontkit.create(buffer);
      return {
        valid: true,
        familyName: font.familyName,
        format: ext
      };
    } catch (error) {
      throw new Error(`Invalid font file: ${error.message}`);
    }
  }

  /**
   * Clear font cache
   */
  clearCache() {
    this.fontCache.clear();
  }

  /**
   * Get font manager statistics
   */
  getStats() {
    return {
      systemFonts: this.systemFonts.size,
      customFonts: this.customFonts.size,
      cachedFonts: this.fontCache.size,
      initialized: this.initialized,
      config: config
    };
  }
}

module.exports = new FontManager();