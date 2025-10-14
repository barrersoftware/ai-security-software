/**
 * Webhooks Plugin - Security Manager Service
 * Handles webhook security (HMAC signing, IP validation)
 */

const crypto = require('crypto');
const { logger } = require('../../shared/logger');

class SecurityManager {
  constructor() {
    this.logger = logger;
  }

  /**
   * Generate HMAC signature for payload
   */
  generateSignature(payload, secret) {
    if (!secret) {
      return null;
    }

    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    return 'sha256=' + hmac.digest('hex');
  }

  /**
   * Verify HMAC signature
   */
  verifySignature(payload, signature, secret) {
    if (!secret || !signature) {
      return false;
    }

    const expectedSignature = this.generateSignature(payload, secret);
    
    // Use timing-safe comparison
    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate IP address against whitelist
   */
  validateIP(ip, whitelist) {
    if (!whitelist || whitelist.length === 0) {
      return true; // No whitelist = allow all
    }

    // Check if IP is in whitelist
    for (const allowed of whitelist) {
      if (this.matchIP(ip, allowed)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Match IP against pattern (supports CIDR and wildcards)
   */
  matchIP(ip, pattern) {
    // Exact match
    if (ip === pattern) {
      return true;
    }

    // CIDR notation (basic implementation)
    if (pattern.includes('/')) {
      return this.matchCIDR(ip, pattern);
    }

    // Wildcard support (e.g., 192.168.1.*)
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return regex.test(ip);
    }

    return false;
  }

  /**
   * Match IP against CIDR range (simplified)
   */
  matchCIDR(ip, cidr) {
    // This is a simplified CIDR check
    // For production, consider using a library like 'ip-range-check'
    const [range, bits] = cidr.split('/');
    const ipParts = ip.split('.').map(Number);
    const rangeParts = range.split('.').map(Number);
    const mask = bits ? parseInt(bits) : 32;

    // Convert to binary and compare
    const ipBinary = ipParts.reduce((acc, part) => acc + part.toString(2).padStart(8, '0'), '');
    const rangeBinary = rangeParts.reduce((acc, part) => acc + part.toString(2).padStart(8, '0'), '');

    return ipBinary.substring(0, mask) === rangeBinary.substring(0, mask);
  }

  /**
   * Generate a secure random secret
   */
  generateSecret(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Hash sensitive data
   */
  hashData(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Sanitize payload (remove sensitive fields)
   */
  sanitizePayload(payload, sensitiveFields = ['password', 'token', 'secret', 'apiKey']) {
    const sanitized = JSON.parse(JSON.stringify(payload));

    const sanitize = (obj) => {
      for (const key in obj) {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitize(obj[key]);
        }
      }
    };

    sanitize(sanitized);
    return sanitized;
  }

  /**
   * Validate payload size
   */
  validatePayloadSize(payload, maxSize = 1048576) { // 1MB default
    const size = Buffer.byteLength(JSON.stringify(payload));
    
    if (size > maxSize) {
      throw new Error(`Payload size ${size} bytes exceeds maximum ${maxSize} bytes`);
    }

    return true;
  }

  /**
   * Rate limit check (simple in-memory implementation)
   */
  checkRateLimit(webhookId, limit = 100, window = 60000) {
    // In production, use Redis or similar for distributed rate limiting
    if (!this.rateLimitCache) {
      this.rateLimitCache = new Map();
    }

    const now = Date.now();
    const key = `webhook:${webhookId}`;
    const record = this.rateLimitCache.get(key) || { count: 0, resetAt: now + window };

    // Reset if window expired
    if (now >= record.resetAt) {
      record.count = 0;
      record.resetAt = now + window;
    }

    // Check limit
    if (record.count >= limit) {
      return {
        allowed: false,
        limit,
        remaining: 0,
        resetAt: record.resetAt
      };
    }

    // Increment count
    record.count++;
    this.rateLimitCache.set(key, record);

    return {
      allowed: true,
      limit,
      remaining: limit - record.count,
      resetAt: record.resetAt
    };
  }

  /**
   * Clean rate limit cache
   */
  cleanRateLimitCache() {
    if (!this.rateLimitCache) {
      return;
    }

    const now = Date.now();
    
    for (const [key, record] of this.rateLimitCache.entries()) {
      if (now >= record.resetAt) {
        this.rateLimitCache.delete(key);
      }
    }
  }
}

module.exports = SecurityManager;
