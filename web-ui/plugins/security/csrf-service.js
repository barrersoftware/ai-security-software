/**
 * CSRF Protection Service
 * Cross-Site Request Forgery protection
 */

const crypto = require('crypto');

class CSRFService {
  constructor(core) {
    this.core = core;
    this.logger = core.getService('logger');
    this.config = core.getConfig('security.csrf') || {};
    
    // Token store (session-based)
    this.tokens = new Map();
    
    // Configuration
    this.enabled = this.config.enabled !== false;
    this.cookieName = this.config.cookieName || '_csrf';
    this.headerName = this.config.headerName || 'X-CSRF-Token';
    this.tokenLength = 32;
  }
  
  async init() {
    // Clean up old tokens every hour
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 60 * 1000);
    
    this.logger.info('CSRF service initialized');
  }
  
  /**
   * Generate CSRF token
   */
  generateToken(req) {
    if (!this.enabled) {
      return 'disabled';
    }
    
    // Get session ID or generate one
    const sessionId = req.session?.id || req.sessionID || this.generateSessionId();
    
    // Generate token
    const token = crypto.randomBytes(this.tokenLength).toString('hex');
    
    // Store token
    this.tokens.set(sessionId, {
      token,
      createdAt: Date.now(),
      ip: req.ip || req.connection.remoteAddress
    });
    
    return token;
  }
  
  /**
   * Verify CSRF token
   */
  verifyToken(req, token) {
    if (!this.enabled) {
      return true;
    }
    
    if (!token) {
      this.logger.warn('CSRF token missing');
      return false;
    }
    
    const sessionId = req.session?.id || req.sessionID;
    
    if (!sessionId) {
      this.logger.warn('Session ID missing for CSRF verification');
      return false;
    }
    
    const stored = this.tokens.get(sessionId);
    
    if (!stored) {
      this.logger.warn(`No CSRF token found for session ${sessionId}`);
      return false;
    }
    
    // Check if token matches
    if (stored.token !== token) {
      this.logger.warn(`CSRF token mismatch for session ${sessionId}`);
      return false;
    }
    
    // Check if token is expired (24 hours)
    const age = Date.now() - stored.createdAt;
    if (age > 24 * 60 * 60 * 1000) {
      this.logger.warn(`CSRF token expired for session ${sessionId}`);
      this.tokens.delete(sessionId);
      return false;
    }
    
    // Verify IP hasn't changed
    const currentIP = req.ip || req.connection.remoteAddress;
    if (stored.ip !== currentIP) {
      this.logger.warn(`IP mismatch for CSRF token: ${stored.ip} vs ${currentIP}`);
      return false;
    }
    
    return true;
  }
  
  /**
   * Generate session ID
   */
  generateSessionId() {
    return crypto.randomBytes(16).toString('hex');
  }
  
  /**
   * Get status
   */
  getStatus() {
    return {
      enabled: this.enabled,
      cookieName: this.cookieName,
      headerName: this.headerName,
      activeTokens: this.tokens.size
    };
  }
  
  /**
   * Clean up old tokens
   */
  cleanup() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    let cleaned = 0;
    for (const [sessionId, data] of this.tokens.entries()) {
      if (now - data.createdAt > maxAge) {
        this.tokens.delete(sessionId);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      this.logger.debug(`Cleaned up ${cleaned} expired CSRF tokens`);
    }
  }
  
  async destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

module.exports = CSRFService;
