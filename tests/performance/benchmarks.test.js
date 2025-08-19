const { performance } = require('perf_hooks');
const canvasManager = require('../../src/canvas/canvas-manager');
const BackgroundRemoval = require('../../src/canvas/background-removal');
const Vectorizer = require('../../src/vectorization/vectorizer');
const TextRenderer = require('../../src/fonts/text-renderer');

describe('Performance Benchmarks', () => {
  const createTestCanvas = (width, height) => {
    const { canvasId, ctx } = canvasManager.createCanvas(width, height);
    
    // Create test pattern
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = 'black';
    
    // Add various shapes for complexity
    for (let i = 0; i < 10; i++) {
      const x = Math.random() * (width - 50);
      const y = Math.random() * (height - 50);
      const size = 20 + Math.random() * 30;
      
      if (i % 2 === 0) {
        ctx.fillRect(x, y, size, size);
      } else {
        ctx.beginPath();
        ctx.arc(x + size/2, y + size/2, size/2, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
    
    return canvasId;
  };

  const measureTime = async (operation) => {
    const start = performance.now();
    const result = await operation();
    const end = performance.now();
    return { result, duration: end - start };
  };

  const logBenchmark = (testName, duration, iterations = 1) => {
    const avgTime = duration / iterations;
    console.log(`${testName}: ${avgTime.toFixed(2)}ms avg (${iterations} iterations)`);
  };

  describe('Canvas Operations', () => {
    test('Canvas creation performance', async () => {
      const sizes = [
        [100, 100],
        [500, 500],
        [1000, 1000],
        [2000, 2000]
      ];

      for (const [width, height] of sizes) {
        const { duration } = await measureTime(async () => {
          const canvasIds = [];
          for (let i = 0; i < 10; i++) {
            const { canvasId } = canvasManager.createCanvas(width, height);
            canvasIds.push(canvasId);
          }
          
          // Cleanup
          canvasIds.forEach(id => canvasManager.cleanup(id));
          return canvasIds;
        });

        logBenchmark(`Canvas creation ${width}x${height}`, duration, 10);
        expect(duration).toBeLessThan(5000); // Should take less than 5 seconds
      }
    });

    test('Canvas cloning performance', async () => {
      const sizes = [[200, 200], [800, 800]];
      
      for (const [width, height] of sizes) {
        const originalId = createTestCanvas(width, height);
        
        const { duration } = await measureTime(async () => {
          const clonedIds = [];
          for (let i = 0; i < 5; i++) {
            const { canvasId } = canvasManager.cloneCanvas(originalId);
            clonedIds.push(canvasId);
          }
          
          // Cleanup
          clonedIds.forEach(id => canvasManager.cleanup(id));
          return clonedIds;
        });

        logBenchmark(`Canvas cloning ${width}x${height}`, duration, 5);
        canvasManager.cleanup(originalId);
      }
    });
  });

  describe('Background Removal Performance', () => {
    test('Color-based background removal', async () => {
      const sizes = [[200, 200], [500, 500], [1000, 1000]];
      
      for (const [width, height] of sizes) {
        const canvasId = createTestCanvas(width, height);
        
        const { duration } = await measureTime(async () => {
          BackgroundRemoval.removeByColor(canvasId, [255, 255, 255], 10);
        });

        logBenchmark(`Background removal ${width}x${height}`, duration);
        expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
        
        canvasManager.cleanup(canvasId);
      }
    });

    test('Batch background removal performance', async () => {
      const canvasIds = [];
      for (let i = 0; i < 5; i++) {
        canvasIds.push(createTestCanvas(300, 300));
      }
      
      const { duration } = await measureTime(async () => {
        return BackgroundRemoval.batchRemoval(canvasIds, 'color', {
          targetColor: [255, 255, 255],
          tolerance: 10
        });
      });

      logBenchmark('Batch background removal (5 images)', duration);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
      
      // Cleanup
      canvasIds.forEach(id => canvasManager.cleanup(id));
    });
  });

  describe('Vectorization Performance', () => {
    test('Vectorization speed by complexity', async () => {
      const testCases = [
        { name: 'Simple', shapes: 1 },
        { name: 'Medium', shapes: 5 },
        { name: 'Complex', shapes: 20 }
      ];

      for (const testCase of testCases) {
        const { canvasId, ctx } = canvasManager.createCanvas(400, 400);
        
        // Create pattern with specified complexity
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 400, 400);
        ctx.fillStyle = 'black';
        
        for (let i = 0; i < testCase.shapes; i++) {
          const x = Math.random() * 350;
          const y = Math.random() * 350;
          const size = 20 + Math.random() * 30;
          ctx.fillRect(x, y, size, size);
        }
        
        const { duration } = await measureTime(async () => {
          return Vectorizer.vectorizeCanvas(canvasId);
        });

        logBenchmark(`Vectorization - ${testCase.name}`, duration);
        expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
        
        canvasManager.cleanup(canvasId);
      }
    });

    test('Vectorization with preprocessing', async () => {
      const canvasId = createTestCanvas(500, 500);
      
      const { duration } = await measureTime(async () => {
        return Vectorizer.vectorizeWithPreprocessing(
          canvasId,
          { blur: 2, contrast: 20, brightness: 10 },
          { scale: 1, threshold: 128 }
        );
      });

      logBenchmark('Vectorization with preprocessing', duration);
      expect(duration).toBeLessThan(8000); // Should complete within 8 seconds
      
      canvasManager.cleanup(canvasId);
    });
  });

  describe('Text Rendering Performance', () => {
    test('Text rendering speed', async () => {
      const testCases = [
        { text: 'Short text', width: 200, height: 100 },
        { text: 'This is a much longer text that will require word wrapping and multiple lines to render properly', width: 300, height: 200 },
        { text: 'A' + 'very '.repeat(100) + 'long text', width: 400, height: 300 }
      ];

      for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        
        const { duration, result } = await measureTime(async () => {
          return TextRenderer.renderText({
            text: testCase.text,
            width: testCase.width,
            height: testCase.height,
            fontSize: 16,
            wordWrap: true
          });
        });

        logBenchmark(`Text rendering - Case ${i + 1}`, duration);
        expect(duration).toBeLessThan(3000); // Should complete within 3 seconds
        
        canvasManager.cleanup(result.canvasId);
      }
    });

    test('Text vectorization performance', async () => {
      const { duration, result } = await measureTime(async () => {
        return TextRenderer.renderToVectors({
          text: 'Performance Test Text',
          width: 400,
          height: 200,
          fontSize: 24
        });
      });

      logBenchmark('Text vectorization', duration);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      
      canvasManager.cleanup(result.canvasId);
    });
  });

  describe('Memory Usage', () => {
    test('Memory usage during operations', async () => {
      const getMemoryUsage = () => {
        const usage = process.memoryUsage();
        return Math.round(usage.heapUsed / 1024 / 1024); // MB
      };

      const initialMemory = getMemoryUsage();
      console.log(`Initial memory usage: ${initialMemory}MB`);

      // Perform multiple operations
      const canvasIds = [];
      for (let i = 0; i < 10; i++) {
        const canvasId = createTestCanvas(800, 600);
        BackgroundRemoval.removeByColor(canvasId, [255, 255, 255], 10);
        await Vectorizer.vectorizeCanvas(canvasId);
        canvasIds.push(canvasId);
      }

      const peakMemory = getMemoryUsage();
      console.log(`Peak memory usage: ${peakMemory}MB`);

      // Cleanup
      canvasIds.forEach(id => canvasManager.cleanup(id));

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // Wait a bit for cleanup
      await new Promise(resolve => setTimeout(resolve, 1000));

      const finalMemory = getMemoryUsage();
      console.log(`Final memory usage: ${finalMemory}MB`);

      // Memory should not grow excessively
      const memoryGrowth = finalMemory - initialMemory;
      expect(memoryGrowth).toBeLessThan(50); // Should not grow by more than 50MB
    });
  });
});