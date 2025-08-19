class MemoryManager {
  constructor() {
    this.bufferPool = new Map();
    this.maxPoolSize = parseInt(process.env.MAX_BUFFER_POOL_SIZE) || 10;
    this.gcThreshold = parseInt(process.env.GC_THRESHOLD_MB) || 100;
    this.monitoringInterval = null;
    this.startMonitoring();
  }

  /**
   * Get reusable buffer from pool or create new one
   */
  getBuffer(size, type = 'uint8') {
    const key = `${type}_${size}`;
    
    if (this.bufferPool.has(key) && this.bufferPool.get(key).length > 0) {
      return this.bufferPool.get(key).pop();
    }

    // Create new buffer
    switch (type) {
      case 'uint8':
        return new Uint8ClampedArray(size);
      case 'uint32':
        return new Uint32Array(size);
      case 'buffer':
        return Buffer.alloc(size);
      default:
        return new Uint8ClampedArray(size);
    }
  }

  /**
   * Return buffer to pool for reuse
   */
  returnBuffer(buffer, type = 'uint8') {
    const key = `${type}_${buffer.length}`;
    
    if (!this.bufferPool.has(key)) {
      this.bufferPool.set(key, []);
    }

    const pool = this.bufferPool.get(key);
    if (pool.length < this.maxPoolSize) {
      // Clear buffer before returning to pool
      if (buffer.fill) {
        buffer.fill(0);
      }
      pool.push(buffer);
    }
  }

  /**
   * Monitor memory usage and trigger GC if needed
   */
  startMonitoring() {
    if (this.monitoringInterval) return;

    this.monitoringInterval = setInterval(() => {
      const usage = process.memoryUsage();
      const heapUsedMB = usage.heapUsed / 1024 / 1024;

      if (heapUsedMB > this.gcThreshold) {
        this.forceCleanup();
        if (global.gc) {
          global.gc();
          console.log(`Memory cleanup triggered at ${heapUsedMB.toFixed(2)}MB`);
        }
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Force cleanup of buffer pools
   */
  forceCleanup() {
    // Clear half of each pool
    for (const [key, pool] of this.bufferPool.entries()) {
      const keepSize = Math.floor(pool.length / 2);
      this.bufferPool.set(key, pool.slice(0, keepSize));
    }
  }

  /**
   * Get memory statistics
   */
  getStats() {
    const memUsage = process.memoryUsage();
    const poolStats = {};
    
    for (const [key, pool] of this.bufferPool.entries()) {
      poolStats[key] = pool.length;
    }

    return {
      memoryUsage: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
        external: Math.round(memUsage.external / 1024 / 1024) + 'MB'
      },
      bufferPools: poolStats,
      totalPooledBuffers: Object.values(poolStats).reduce((sum, count) => sum + count, 0)
    };
  }

  /**
   * Shutdown memory manager
   */
  shutdown() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.bufferPool.clear();
  }
}

module.exports = new MemoryManager();