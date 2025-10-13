/**
 * Security Plugin
 * Comprehensive security hardening for the application
 */

const express = require('express');
const RateLimitService = require('./rate-limit-service');
const ValidatorService = require('./validator-service');
const CSRFService = require('./csrf-service');
const HeadersService = require('./headers-service');
const EncryptionService = require('./encryption-service');

module.exports = {
  name: 'security',
  version: '1.0.0',
  
  async init(core) {
    this.core = core;
    this.logger = core.getService('logger');
    this.config = core.getConfig('security') || {};
    this.integrations = core.getService('integrations');
    
    // Initialize services
    this.rateLimitService = new RateLimitService(core);
    this.validatorService = new ValidatorService(core);
    this.csrfService = new CSRFService(core);
    this.headersService = new HeadersService(core);
    this.encryptionService = new EncryptionService(core);
    
    await this.rateLimitService.init();
    await this.validatorService.init();
    await this.csrfService.init();
    await this.headersService.init();
    await this.encryptionService.init();
    
    // Register services for other plugins to use
    core.registerService('rate-limit-service', this.rateLimitService);
    core.registerService('validator-service', this.validatorService);
    core.registerService('csrf-service', this.csrfService);
    core.registerService('headers-service', this.headersService);
    core.registerService('encryption-service', this.encryptionService);
    
    // Register middleware for easy access
    core.registerService('security-middleware', this.middleware());
    
    this.logger.info('Security plugin initialized');
  },
  
  routes() {
    const router = express.Router();
    
    // Health check endpoint
    router.get('/api/security/health', (req, res) => {
      try {
        res.json({
          success: true,
          status: 'healthy',
          plugin: 'security',
          version: '1.0.0',
          services: {
            rateLimit: this.rateLimitService ? 'active' : 'inactive',
            validator: this.validatorService ? 'active' : 'inactive',
            csrf: this.csrfService ? 'active' : 'inactive',
            headers: this.headersService ? 'active' : 'inactive',
            encryption: this.encryptionService ? 'active' : 'inactive'
          }
        });
      } catch (err) {
        this.logger.error('Health check error:', err);
        res.status(500).json({ success: false, error: err.message });
      }
    });
    
    // Get CSRF token
    router.get('/api/security/csrf-token', (req, res) => {
      try {
        const token = this.csrfService.generateToken(req);
        res.json({
          success: true,
          data: { token }
        });
      } catch (err) {
        this.logger.error('CSRF token error:', err);
        res.status(500).json({ success: false, error: err.message });
      }
    });
    
    // Security status (admin only)
    router.get('/api/security/status', async (req, res) => {
      try {
        const status = {
          rateLimit: this.rateLimitService.getStatus(),
          csrf: this.csrfService.getStatus(),
          headers: this.headersService.getStatus(),
          encryption: this.encryptionService.getStatus()
        };
        
        res.json({ success: true, data: status });
      } catch (err) {
        this.logger.error('Security status error:', err);
        res.status(500).json({ success: false, error: err.message });
      }
    });
    
    // Rate limit stats (admin only)
    router.get('/api/security/rate-limits', async (req, res) => {
      try {
        const stats = this.rateLimitService.getStats();
        res.json({ success: true, data: stats });
      } catch (err) {
        this.logger.error('Rate limit stats error:', err);
        res.status(500).json({ success: false, error: err.message });
      }
    });
    
    // Reset rate limit for IP (admin only)
    router.post('/api/security/rate-limits/reset', async (req, res) => {
      try {
        const { ip } = req.body;
        
        if (!ip) {
          return res.status(400).json({
            success: false,
            error: 'IP address required'
          });
        }
        
        this.rateLimitService.resetLimit(ip);
        
        res.json({
          success: true,
          message: `Rate limit reset for ${ip}`
        });
      } catch (err) {
        this.logger.error('Rate limit reset error:', err);
        res.status(500).json({ success: false, error: err.message });
      }
    });
    
    // Test input validation
    router.post('/api/security/validate', (req, res) => {
      try {
        const { type, value, schema } = req.body;
        
        // If schema provided, validate against schema
        if (schema) {
          const result = this.validatorService.validate({ value }, { value: schema });
          return res.json({
            success: true,
            data: {
              valid: result.valid,
              errors: result.errors,
              sanitized: result.sanitized
            }
          });
        }
        
        // Otherwise validate by type
        let result;
        switch (type) {
          case 'email':
            result = this.validatorService.isValidEmail(value);
            break;
          case 'url':
            result = this.validatorService.isValidURL(value);
            break;
          case 'ip':
            result = this.validatorService.isValidIP(value);
            break;
          default:
            return res.status(400).json({
              success: false,
              error: 'Invalid validation type'
            });
        }
        
        res.json({
          success: true,
          data: { valid: result, type, value }
        });
      } catch (err) {
        this.logger.error('Validation error:', err);
        res.status(500).json({ success: false, error: err.message });
      }
    });
    
    // Sanitize input
    router.post('/api/security/sanitize', (req, res) => {
      try {
        const { input } = req.body;
        
        if (!input) {
          return res.status(400).json({
            success: false,
            error: 'Input required'
          });
        }
        
        // Use the sanitize method which works on strings and objects
        const sanitized = this.validatorService.sanitize(input);
        
        res.json({
          success: true,
          data: {
            original: input,
            sanitized: sanitized,
            changed: JSON.stringify(input) !== JSON.stringify(sanitized)
          }
        });
      } catch (err) {
        this.logger.error('Sanitization error:', err);
        res.status(500).json({ success: false, error: err.message });
      }
    });
    
    // Encrypt data
    router.post('/api/security/encrypt', (req, res) => {
      try {
        const { data } = req.body;
        
        if (!data) {
          return res.status(400).json({
            success: false,
            error: 'Data required'
          });
        }
        
        const result = this.encryptionService.encrypt(data);
        
        res.json({
          success: true,
          data: result
        });
      } catch (err) {
        this.logger.error('Encryption error:', err);
        res.status(500).json({ success: false, error: err.message });
      }
    });
    
    // Decrypt data
    router.post('/api/security/decrypt', (req, res) => {
      try {
        const { encrypted, iv, tag } = req.body;
        
        if (!encrypted || !iv || !tag) {
          return res.status(400).json({
            success: false,
            error: 'Encrypted data, IV, and tag required'
          });
        }
        
        const decrypted = this.encryptionService.decrypt(encrypted, iv, tag);
        
        res.json({
          success: true,
          data: { decrypted }
        });
      } catch (err) {
        this.logger.error('Decryption error:', err);
        res.status(500).json({ success: false, error: err.message });
      }
    });
    
    // Hash data
    router.post('/api/security/hash', (req, res) => {
      try {
        const { data } = req.body;
        
        if (!data) {
          return res.status(400).json({
            success: false,
            error: 'Data required'
          });
        }
        
        const hash = this.encryptionService.hash(data);
        
        res.json({
          success: true,
          data: { hash }
        });
      } catch (err) {
        this.logger.error('Hashing error:', err);
        res.status(500).json({ success: false, error: err.message });
      }
    });
    
    // Generate secure token
    router.post('/api/security/generate-token', (req, res) => {
      try {
        const { length = 32 } = req.body;
        
        const token = this.encryptionService.generateToken(length);
        
        res.json({
          success: true,
          data: { token }
        });
      } catch (err) {
        this.logger.error('Token generation error:', err);
        res.status(500).json({ success: false, error: err.message });
      }
    });
    
    // Rate limit statistics
    router.get('/api/security/rate-limit/stats', (req, res) => {
      try {
        const stats = this.rateLimitService.getStats();
        res.json({ success: true, data: stats });
      } catch (err) {
        this.logger.error('Rate limit stats error:', err);
        res.status(500).json({ success: false, error: err.message });
      }
    });
    
    return router;
  },
  
  middleware() {
    return {
      // Apply security headers to all responses
      securityHeaders: (req, res, next) => {
        this.headersService.applyHeaders(res);
        next();
      },
      
      // Rate limiting
      rateLimiter: (options = {}) => {
        return async (req, res, next) => {
          try {
            const result = await this.rateLimitService.checkLimit(req, options);
            
            if (!result.allowed) {
              return res.status(429).json({
                success: false,
                error: 'Too many requests',
                retryAfter: result.retryAfter
              });
            }
            
            // Add rate limit headers
            res.set('X-RateLimit-Limit', result.limit);
            res.set('X-RateLimit-Remaining', result.remaining);
            res.set('X-RateLimit-Reset', result.reset);
            
            next();
          } catch (err) {
            this.logger.error('Rate limiter error:', err);
            next(); // Don't block on error
          }
        };
      },
      
      // Strict rate limiting for login endpoints
      loginRateLimiter: () => {
        return this.middleware().rateLimiter({
          windowMs: 5 * 60 * 1000, // 5 minutes
          maxRequests: 5, // 5 attempts
          keyPrefix: 'login'
        });
      },
      
      // CSRF protection
      csrfProtection: (req, res, next) => {
        // Skip for GET, HEAD, OPTIONS
        if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
          return next();
        }
        
        // Skip for API key authentication
        if (req.headers['x-api-key']) {
          return next();
        }
        
        try {
          const token = req.headers['x-csrf-token'] || req.body._csrf;
          
          if (!this.csrfService.verifyToken(req, token)) {
            return res.status(403).json({
              success: false,
              error: 'Invalid CSRF token'
            });
          }
          
          next();
        } catch (err) {
          this.logger.error('CSRF protection error:', err);
          res.status(403).json({
            success: false,
            error: 'CSRF validation failed'
          });
        }
      },
      
      // Input validation and sanitization
      validateInput: (schema) => {
        return (req, res, next) => {
          try {
            const validation = this.validatorService.validate(req.body, schema);
            
            if (!validation.valid) {
              return res.status(400).json({
                success: false,
                error: 'Validation failed',
                errors: validation.errors
              });
            }
            
            // Replace body with sanitized data
            req.body = validation.sanitized;
            
            next();
          } catch (err) {
            this.logger.error('Input validation error:', err);
            res.status(400).json({
              success: false,
              error: 'Validation error'
            });
          }
        };
      },
      
      // Sanitize request
      sanitizeRequest: (req, res, next) => {
        try {
          // Sanitize body
          if (req.body) {
            req.body = this.validatorService.sanitize(req.body);
          }
          
          // Sanitize query
          if (req.query) {
            req.query = this.validatorService.sanitize(req.query);
          }
          
          // Sanitize params
          if (req.params) {
            req.params = this.validatorService.sanitize(req.params);
          }
          
          next();
        } catch (err) {
          this.logger.error('Request sanitization error:', err);
          next(); // Don't block on error
        }
      }
    };
  },
  
  services() {
    return {
      rateLimit: this.rateLimitService,
      validator: this.validatorService,
      csrf: this.csrfService,
      headers: this.headersService,
      encryption: this.encryptionService
    };
  },
  
  async destroy() {
    await this.rateLimitService.cleanup();
    this.logger.info('Security plugin destroyed');
  }
};
