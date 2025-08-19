const { Worker } = require('worker_threads');
const path = require('path');

class WorkerPool {
  constructor(workerFile, poolSize = 2) {
    this.workerFile = workerFile;
    this.poolSize = poolSize;
    this.workers = [];
    this.availableWorkers = [];
    this.taskQueue = [];
    this.initialize();
  }

  /**
   * Initialize worker pool
   */
  initialize() {
    for (let i = 0; i < this.poolSize; i++) {
      this.createWorker();
    }
  }

  /**
   * Create a new worker
   */
  createWorker() {
    const worker = new Worker(this.workerFile);
    
    worker.on('error', (error) => {
      console.error('Worker error:', error);
      this.replaceWorker(worker);
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        console.error(`Worker exited with code ${code}`);
        this.replaceWorker(worker);
      }
    });

    this.workers.push(worker);
    this.availableWorkers.push(worker);
  }

  /**
   * Replace a failed worker
   */
  replaceWorker(failedWorker) {
    const index = this.workers.indexOf(failedWorker);
    if (index > -1) {
      this.workers.splice(index, 1);
      const availableIndex = this.availableWorkers.indexOf(failedWorker);
      if (availableIndex > -1) {
        this.availableWorkers.splice(availableIndex, 1);
      }
    }

    failedWorker.terminate();
    this.createWorker();
  }

  /**
   * Execute task in worker pool
   */
  async execute(data) {
    return new Promise((resolve, reject) => {
      const task = { data, resolve, reject };

      if (this.availableWorkers.length > 0) {
        this.runTask(task);
      } else {
        this.taskQueue.push(task);
      }
    });
  }

  /**
   * Run task on available worker
   */
  runTask(task) {
    const worker = this.availableWorkers.pop();
    
    const handleMessage = (result) => {
      worker.off('message', handleMessage);
      worker.off('error', handleError);
      this.availableWorkers.push(worker);
      
      // Process next task if any
      if (this.taskQueue.length > 0) {
        this.runTask(this.taskQueue.shift());
      }
      
      task.resolve(result);
    };

    const handleError = (error) => {
      worker.off('message', handleMessage);
      worker.off('error', handleError);
      this.replaceWorker(worker);
      task.reject(error);
    };

    worker.on('message', handleMessage);
    worker.on('error', handleError);
    worker.postMessage(task.data);
  }

  /**
   * Shutdown worker pool
   */
  async shutdown() {
    const terminationPromises = this.workers.map(worker => {
      return worker.terminate();
    });

    await Promise.all(terminationPromises);
    this.workers = [];
    this.availableWorkers = [];
    this.taskQueue = [];
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      totalWorkers: this.workers.length,
      availableWorkers: this.availableWorkers.length,
      queuedTasks: this.taskQueue.length,
      busyWorkers: this.workers.length - this.availableWorkers.length
    };
  }
}

module.exports = WorkerPool;