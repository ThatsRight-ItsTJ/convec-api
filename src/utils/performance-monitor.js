const EventEmitter = require('events');

class PerformanceMonitor extends EventEmitter {
  constructor() {
    super();
    this.metrics = new Map();
    this.activeOperations = new Map();
    this.thresholds = {
      slowOperation: 5000, // 5 seconds
      memoryWarning: 100, // 100MB
      errorRate: 0.1 // 10%
    };
    
    this.startSystemMonitoring();
  }

  /**
   * Start timing an operation
   */
  startTimer(operationId, metadata = {}) {
    this.activeOperations.set(operationId, {
      startTime: Date.now(),
      startMemory: process.memoryUsage(),
      metadata
    });
  }

  /**
   * End timing and record metrics
   */
  endTimer(operationId, success = true, error = null) {
    const operation = this.activeOperations.get(operationId);
    if (!operation) return;

    const endTime = Date.now();
    const endMemory = process.memoryUsage();
    const duration = endTime - operation.startTime;
    const memoryDelta = endMemory.heapUsed - operation.startMemory.heapUsed;

    const metric = {
      operationId,
      duration,
      memoryDelta,
      success,
      error: error ? error.message : null,
      timestamp: endTime,
      metadata: operation.metadata
    };

    this.recordMetric(metric);
    this.activeOperations.delete(operationId);

    // Check thresholds and emit warnings
    this.checkThresholds(metric);

    return metric;
  }

  /**
   * Record a metric
   */
  recordMetric(metric) {
    const { operationId } = metric;
    
    if (!this.metrics.has(operationId)) {
      this.metrics.set(operationId, {
        count: 0,
        totalDuration: 0,
        totalMemory: 0,
        errors: 0,
        lastRun: 0,
        avgDuration: 0,
        avgMemory: 0,
        errorRate: 0
      });
    }

    const stats = this.metrics.get(operationId);
    stats.count++;
    stats.totalDuration += metric.duration;
    stats.totalMemory += Math.abs(metric.memoryDelta);
    stats.lastRun = metric.timestamp;
    
    if (!metric.success) {
      stats.errors++;
    }

    // Update averages
    stats.avgDuration = Math.round(stats.totalDuration / stats.count);
    stats.avgMemory = Math.round(stats.totalMemory / stats.count);
    stats.errorRate = stats.errors / stats.count;

    this.metrics.set(operationId, stats);
  }

  /**
   * Check performance thresholds
   */
  checkThresholds(metric) {
    // Slow operation warning
    if (metric.duration > this.thresholds.slowOperation) {
      this.emit('slowOperation', {
        operationId: metric.operationId,
        duration: metric.duration,
        threshold: this.thresholds.slowOperation
      });
    }

    // Memory usage warning
    const memoryMB = Math.abs(metric.memoryDelta) / 1024 / 1024;
    if (memoryMB > this.thresholds.memoryWarning) {
      this.emit('memoryWarning', {
        operationId: metric.operationId,
        memoryDelta: memoryMB,
        threshold: this.thresholds.memoryWarning
      });
    }

    // Error rate warning
    const stats = this.metrics.get(metric.operationId);
    if (stats && stats.errorRate > this.thresholds.errorRate && stats.count >= 10) {
      this.emit('highErrorRate', {
        operationId: metric.operationId,
        errorRate: stats.errorRate,
        threshold: this.thresholds.errorRate
      });
    }
  }

  /**
   * Start system monitoring
   */
  startSystemMonitoring() {
    setInterval(() => {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      this.emit('systemMetrics', {
        memory: {
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
          external: Math.round(memUsage.external / 1024 / 1024),
          rss: Math.round(memUsage.rss / 1024 / 1024)
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system
        },
        uptime: process.uptime(),
        activeOperations: this.activeOperations.size
      });
    }, 30000); // Every 30 seconds
  }

  /**
   * Get performance statistics
   */
  getStats(operationId = null) {
    if (operationId) {
      return this.metrics.get(operationId) || null;
    }

    const allStats = {};
    for (const [id, stats] of this.metrics.entries()) {
      allStats[id] = { ...stats };
    }

    return {
      operations: allStats,
      activeOperations: this.activeOperations.size,
      totalOperations: Array.from(this.metrics.values())
        .reduce((sum, stats) => sum + stats.count, 0)
    };
  }

  /**
   * Get top slow operations
   */
  getSlowOperations(limit = 10) {
    return Array.from(this.metrics.entries())
      .sort((a, b) => b[1].avgDuration - a[1].avgDuration)
      .slice(0, limit)
      .map(([id, stats]) => ({ operationId: id, ...stats }));
  }

  /**
   * Get operations with high error rates
   */
  getHighErrorOperations(limit = 10) {
    return Array.from(this.metrics.entries())
      .filter(([_, stats]) => stats.errorRate > 0)
      .sort((a, b) => b[1].errorRate - a[1].errorRate)
      .slice(0, limit)
      .map(([id, stats]) => ({ operationId: id, ...stats }));
  }

  /**
   * Reset metrics for an operation
   */
  resetMetrics(operationId = null) {
    if (operationId) {
      this.metrics.delete(operationId);
    } else {
      this.metrics.clear();
    }
  }

  /**
   * Set performance thresholds
   */
  setThresholds(thresholds) {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }
}

module.exports = new PerformanceMonitor();