/**
 * Rate Limiting Service
 * Prevent brute force and DDoS attacks
 */

class RateLimitService {
  constructor(core) {
    this.core = core;
    this.logger = core.getService('logger');
    this.config = core.getConfig('security.rateLimit') || {};
    
    // In-memory store (can be replaced with Redis for distributed systems)
    this.store = new Map();
    
    // Default configuration
    this.defaults = {
      windowMs: this.config.windowMs || 15 * 60 * 1000, // 15 minutes
      maxRequests: this.config.maxRequests || 100,
      skipSuccessfulRequests: false,
      skipFailedRequests: false
    };
  }
  
  async init() {
    // Clean up old entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 1000);
    
    this.logger.info('Rate limit service initialized');
  }
  
  /**
   * Check if request is within rate limit
   */
  async checkLimit(req, options = {}) {
    const config = { ...this.defaults, ...options };
    
    // Get client identifier (IP address)
    const key = this.getKey(req, config.keyPrefix);
    
    // Get current window
    const now = Date.now();
    const windowStart = now - config.windowMs;
    
    // Get or create record
    let record = this.store.get(key);
    
    if (!record) {
      record = {
        requests: [],
        firstRequest: now
      };
      this.store.set(key, record);
    }
    
    // Filter requests within current window
    record.requests = record.requests.filter(time => time > windowStart);
    
    // Check if limit exceeded
    const allowed = record.requests.length < config.maxRequests;
    
    if (allowed) {
      record.requests.push(now);
    } else {
      // Log rate limit exceeded
      this.logger.warn(`Rate limit exceeded for ${key}`);
      
      // Send notification for repeated violations
      if (record.requests.length > config.maxRequests * 2) {
        try {
          const integrations = this.core.getService('integrations');
          await integrations.notify(
            `Rate limit severely exceeded by ${key}`,
            {
              title: 'Security Alert - Rate Limit Violation',
              severity: 'high',
              channels: ['security']
            }
          );
        } catch (err) {
          this.logger.error('Failed to send rate limit notification:', err);
        }
      }
    }
    
    // Calculate retry after
    const oldestRequest = record.requests[0];
    const retryAfter = oldestRequest ? Math.ceil((oldestRequest + config.windowMs - now) / 1000) : 0;
    
    return {
      allowed,
      limit: config.maxRequests,
      remaining: Math.max(0, config.maxRequests - record.requests.length),
      reset: new Date(now + config.windowMs).toISOString(),
      retryAfter
    };
  }
  
  /**
   * Get unique key for client
   */
  getKey(req, prefix = 'default') {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userId = req.user?.id || '';
    return `${prefix}:${ip}:${userId}`;
  }
  
  /**
   * Reset rate limit for specific key
   */
  resetLimit(identifier) {
    // Find and remove all keys matching the identifier
    for (const [key, _] of this.store.entries()) {
      if (key.includes(identifier)) {
        this.store.delete(key);
      }
    }
    
    this.logger.info(`Rate limit reset for ${identifier}`);
  }
  
  /**
   * Get statistics
   */
  getStats() {
    const stats = {
      totalKeys: this.store.size,
      topOffenders: [],
      windowMs: this.defaults.windowMs,
      maxRequests: this.defaults.maxRequests
    };
    
    // Get top offenders
    const offenders = [];
    for (const [key, record] of this.store.entries()) {
      offenders.push({
        key,
        requests: record.requests.length,
        firstRequest: record.firstRequest
      });
    }
    
    offenders.sort((a, b) => b.requests - a.requests);
    stats.topOffenders = offenders.slice(0, 10);
    
    return stats;
  }
  
  /**
   * Get status
   */
  getStatus() {
    return {
      enabled: true,
      windowMs: this.defaults.windowMs,
      maxRequests: this.defaults.maxRequests,
      activeKeys: this.store.size
    };
  }
  
  /**
   * Clean up old entries
   */
  cleanup() {
    const now = Date.now();
    const windowStart = now - this.defaults.windowMs * 2; // Keep double window for safety
    
    let cleaned = 0;
    for (const [key, record] of this.store.entries()) {
      if (record.firstRequest < windowStart && record.requests.length === 0) {
        this.store.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      this.logger.debug(`Cleaned up ${cleaned} rate limit entries`);
    }
  }
  
  async destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

module.exports = RateLimitService;
