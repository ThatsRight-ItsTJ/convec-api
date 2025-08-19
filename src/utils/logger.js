const fs = require('fs');
const path = require('path');

class Logger {
  constructor() {
    this.logDir = path.join(process.cwd(), 'logs');
    this.ensureLogDir();
  }

  ensureLogDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  getTimestamp() {
    return new Date().toISOString();
  }

  formatMessage(level, message, meta = {}) {
    return JSON.stringify({
      timestamp: this.getTimestamp(),
      level,
      message,
      ...meta
    }) + '\n';
  }

  writeToFile(filename, content) {
    const filepath = path.join(this.logDir, filename);
    fs.appendFileSync(filepath, content);
  }

  info(message, meta = {}) {
    const formatted = this.formatMessage('INFO', message, meta);
    console.log(`[INFO] ${message}`, meta);
    this.writeToFile('app.log', formatted);
  }

  error(message, error = null, meta = {}) {
    const errorMeta = error ? {
      error: error.message,
      stack: error.stack,
      ...meta
    } : meta;
    
    const formatted = this.formatMessage('ERROR', message, errorMeta);
    console.error(`[ERROR] ${message}`, errorMeta);
    this.writeToFile('error.log', formatted);
  }

  warn(message, meta = {}) {
    const formatted = this.formatMessage('WARN', message, meta);
    console.warn(`[WARN] ${message}`, meta);
    this.writeToFile('app.log', formatted);
  }

  debug(message, meta = {}) {
    if (process.env.NODE_ENV === 'development') {
      const formatted = this.formatMessage('DEBUG', message, meta);
      console.log(`[DEBUG] ${message}`, meta);
      this.writeToFile('debug.log', formatted);
    }
  }

  logApiRequest(req, res, next) {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      this.info('API Request', {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
    });
    
    next();
  }
}

module.exports = new Logger();