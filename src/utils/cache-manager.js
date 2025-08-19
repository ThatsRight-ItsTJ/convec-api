const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class CacheManager {
  constructor() {
    this.memoryCache = new Map();
    this.diskCacheDir = path.join(process.cwd(), 'cache');
    this.maxMemorySize = parseInt(process.env.CACHE_MAX_MEMORY_MB) || 50; // MB
    this.maxDiskSize = parseInt(process.env.CACHE_MAX_DISK_MB) || 200; // MB
    this.currentMemorySize = 0;
    this.ttl = parseInt(process.env.CACHE_TTL_MINUTES) || 30; // minutes
    this.cleanupInterval = null;
    
    this.initialize();
  }

  /**
   * Initialize cache directories and cleanup
   */
  async initialize() {
    try {
      await fs.mkdir(this.diskCacheDir, { recursive: true });
      this.startCleanup();
    } catch (error) {
      console.error('Cache initialization error:', error);
    }
  }

  /**
   * Generate cache key from data
   */
  generateKey(data) {
    const hash = crypto.createHash('md5');
    
    if (typeof data === 'string') {
      hash.update(data);
    } else if (Buffer.isBuffer(data)) {
      hash.update(data);
    } else {
      hash.update(JSON.stringify(data));
    }
    
    return hash.digest('hex');
  }

  /**
   * Store data in memory cache
   */
  setMemory(key, data, customTTL = null) {
    const ttl = customTTL || this.ttl;
    const expiresAt = Date.now() + (ttl * 60 * 1000);
    const size = this.calculateSize(data);

    // Check if adding this item would exceed memory limit
    if (this.currentMemorySize + size > this.maxMemorySize * 1024 * 1024) {
      this.evictMemoryCache(size);
    }

    this.memoryCache.set(key, {
      data,
      size,
      expiresAt,
      createdAt: Date.now()
    });

    this.currentMemorySize += size;
  }

  /**
   * Get data from memory cache
   */
  getMemory(key) {
    const item = this.memoryCache.get(key);
    
    if (!item) return null;
    
    if (Date.now() > item.expiresAt) {
      this.memoryCache.delete(key);
      this.currentMemorySize -= item.size;
      return null;
    }

    return item.data;
  }

  /**
   * Store data in disk cache
   */
  async setDisk(key, data, metadata = {}) {
    try {
      const filePath = path.join(this.diskCacheDir, key);
      const cacheItem = {
        data: Buffer.isBuffer(data) ? data.toString('base64') : data,
        metadata,
        expiresAt: Date.now() + (this.ttl * 60 * 1000),
        createdAt: Date.now()
      };

      await fs.writeFile(filePath, JSON.stringify(cacheItem));
      return true;
    } catch (error) {
      console.error('Disk cache write error:', error);
      return false;
    }
  }

  /**
   * Get data from disk cache
   */
  async getDisk(key) {
    try {
      const filePath = path.join(this.diskCacheDir, key);
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const item = JSON.parse(fileContent);

      if (Date.now() > item.expiresAt) {
        await fs.unlink(filePath).catch(() => {}); // Silent cleanup
        return null;
      }

      // Convert base64 back to buffer if needed
      if (item.metadata.isBuffer) {
        item.data = Buffer.from(item.data, 'base64');
      }

      return item;
    } catch (error) {
      return null;
    }
  }

  /**
   * Smart cache: try memory first, then disk
   */
  async get(key) {
    // Try memory cache first
    const memoryData = this.getMemory(key);
    if (memoryData) return memoryData;

    // Try disk cache
    const diskData = await this.getDisk(key);
    if (diskData) {
      // Promote to memory cache
      this.setMemory(key, diskData.data);
      return diskData.data;
    }

    return null;
  }

  /**
   * Smart cache: store in both memory and disk
   */
  async set(key, data, options = {}) {
    const { memoryOnly = false, diskOnly = false, ttl = null } = options;

    if (!diskOnly) {
      this.setMemory(key, data, ttl);
    }

    if (!memoryOnly) {
      const metadata = {
        isBuffer: Buffer.isBuffer(data),
        type: typeof data,
        size: this.calculateSize(data)
      };
      await this.setDisk(key, data, metadata);
    }
  }

  /**
   * Cache processed images
   */
  async cacheProcessedImage(imageBuffer, processingOptions, result) {
    const key = this.generateKey({
      imageHash: crypto.createHash('md5').update(imageBuffer).digest('hex'),
      options: processingOptions
    });

    await this.set(key, result, { ttl: 60 }); // 1 hour for processed images
    return key;
  }

  /**
   * Get cached processed image
   */
  async getCachedProcessedImage(imageBuffer, processingOptions) {
    const key = this.generateKey({
      imageHash: crypto.createHash('md5').update(imageBuffer).digest('hex'),
      options: processingOptions
    });

    return await this.get(key);
  }

  /**
   * Calculate data size in bytes
   */
  calculateSize(data) {
    if (Buffer.isBuffer(data)) {
      return data.length;
    } else if (typeof data === 'string') {
      return Buffer.byteLength(data, 'utf8');
    } else {
      return Buffer.byteLength(JSON.stringify(data), 'utf8');
    }
  }

  /**
   * Evict items from memory cache to make space
   */
  evictMemoryCache(requiredSpace) {
    const items = Array.from(this.memoryCache.entries())
      .sort((a, b) => a[1].createdAt - b[1].createdAt); // Oldest first

    let freedSpace = 0;
    for (const [key, item] of items) {
      if (freedSpace >= requiredSpace) break;
      
      this.memoryCache.delete(key);
      this.currentMemorySize -= item.size;
      freedSpace += item.size;
    }
  }

  /**
   * Start cleanup interval
   */
  startCleanup() {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(async () => {
      await this.cleanup();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Cleanup expired items
   */
  async cleanup() {
    const now = Date.now();

    // Cleanup memory cache
    for (const [key, item] of this.memoryCache.entries()) {
      if (now > item.expiresAt) {
        this.memoryCache.delete(key);
        this.currentMemorySize -= item.size;
      }
    }

    // Cleanup disk cache
    try {
      const files = await fs.readdir(this.diskCacheDir);
      
      for (const file of files) {
        try {
          const filePath = path.join(this.diskCacheDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const item = JSON.parse(content);
          
          if (now > item.expiresAt) {
            await fs.unlink(filePath);
          }
        } catch (error) {
          // Remove corrupted files
          await fs.unlink(path.join(this.diskCacheDir, file)).catch(() => {});
        }
      }
    } catch (error) {
      console.error('Disk cache cleanup error:', error);
    }
  }

  /**
   * Clear all caches
   */
  async clear() {
    this.memoryCache.clear();
    this.currentMemorySize = 0;

    try {
      const files = await fs.readdir(this.diskCacheDir);
      await Promise.all(files.map(file => 
        fs.unlink(path.join(this.diskCacheDir, file))
      ));
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    const diskFiles = await fs.readdir(this.diskCacheDir).catch(() => []);
    
    return {
      memory: {
        items: this.memoryCache.size,
        sizeMB: Math.round(this.currentMemorySize / 1024 / 1024 * 100) / 100,
        maxSizeMB: this.maxMemorySize
      },
      disk: {
        items: diskFiles.length,
        maxSizeMB: this.maxDiskSize
      },
      config: {
        ttlMinutes: this.ttl
      }
    };
  }

  /**
   * Shutdown cache manager
   */
  shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

module.exports = new CacheManager();