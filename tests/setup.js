// Global test setup
const fontManager = require('../src/fonts/font-manager');
const performanceMonitor = require('../src/utils/performance-monitor');

// Increase timeout for font loading
jest.setTimeout(30000);

// Initialize font manager before tests
beforeAll(async () => {
  await fontManager.initialize();
  
  // Set up performance monitoring
  performanceMonitor.setThresholds({
    slowOperation: 10000, // 10 seconds for tests
    memoryWarning: 200, // 200MB
    errorRate: 0.2 // 20%
  });
});

// Cleanup after tests
afterAll(async () => {
  // Shutdown managers
  const memoryManager = require('../src/utils/memory-manager');
  const cacheManager = require('../src/utils/cache-manager');
  
  memoryManager.shutdown();
  cacheManager.shutdown();
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
});

// Mock console methods for cleaner test output
const originalConsole = { ...console };
beforeEach(() => {
  // Silence console output during tests unless explicitly needed
  if (!process.env.VERBOSE_TESTS) {
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  }
});

afterEach(() => {
  // Restore console methods
  if (!process.env.VERBOSE_TESTS) {
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  }
});

// Global test utilities
global.testUtils = {
  createTestBuffer: (width = 100, height = 100) => {
    const { createCanvas } = require('canvas');
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = 'black';
    ctx.fillRect(25, 25, 50, 50);
    
    return canvas.toBuffer('image/png');
  },
  
  waitFor: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  expectValidSVG: (svgString) => {
    expect(typeof svgString).toBe('string');
    expect(svgString).toContain('<svg');
    expect(svgString).toContain('</svg>');
    expect(svgString).toMatch(/width="\d+"/);
    expect(svgString).toMatch(/height="\d+"/);
  }
};