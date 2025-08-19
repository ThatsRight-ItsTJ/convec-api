module.exports = {
  // Canvas API Configuration
  maxImageSize: 2400,
  defaultCanvasSize: { width: 1000, height: 1000 },
  supportedFormats: ['png', 'jpg', 'jpeg', 'webp', 'svg'],
  maxFileSize: 50 * 1024 * 1024, // 50MB
  
  // Background Removal Settings
  backgroundRemoval: {
    defaultTolerance: 10,
    maxTolerance: 100,
    defaultTargetColor: [255, 255, 255], // white
    algorithms: ['color', 'chroma-key', 'edge-detection', 'flood-fill']
  },
  
  // Processing Options
  processing: {
    useAntiAliasing: true,
    useFeathering: true,
    enableBatch: true,
    maxBatchSize: 10
  },
  
  // Memory Management
  memory: {
    enableCleanup: true,
    gcInterval: 30000, // 30 seconds
    maxCanvasInstances: 20
  }
};