module.exports = {
  // Font Management Configuration
  fontPaths: [
    '/System/Library/Fonts/',
    '/usr/share/fonts/',
    '/usr/local/share/fonts/',
    process.cwd() + '/fonts/',
  ],
  
  // Supported Font Formats
  supportedFormats: ['ttf', 'otf', 'woff', 'woff2'],
  
  // Font Cache Settings
  cache: {
    enabled: true,
    maxSize: 100, // Max number of fonts to cache
    ttl: 3600000, // 1 hour in milliseconds
  },
  
  // Text Rendering Settings
  textRendering: {
    defaultFontSize: 24,
    maxFontSize: 200,
    defaultFontFamily: 'Arial',
    supportedAlignments: ['left', 'center', 'right', 'justify'],
    defaultColor: '#000000',
    maxLineHeight: 300,
  },
  
  // Font Upload Settings
  upload: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: [
      'font/ttf',
      'font/otf', 
      'font/woff',
      'font/woff2',
      'application/font-woff',
      'application/x-font-ttf',
      'application/x-font-otf'
    ]
  },
  
  // Fallback Fonts
  fallbacks: {
    serif: ['Times New Roman', 'serif'],
    'sans-serif': ['Arial', 'Helvetica', 'sans-serif'],
    monospace: ['Courier New', 'monospace']
  }
};