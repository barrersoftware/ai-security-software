/**
 * Input Validation and Sanitization Service
 * Prevent XSS, SQL injection, and other injection attacks
 */

const validator = require('validator');

class ValidatorService {
  constructor(core) {
    this.core = core;
    this.logger = core.getService('logger');
  }
  
  async init() {
    this.logger.info('Validator service initialized');
  }
  
  /**
   * Validate data against schema
   */
  validate(data, schema) {
    const errors = [];
    const sanitized = {};
    
    for (const [field, rules] of Object.entries(schema)) {
      const value = data[field];
      
      // Required check
      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push(`${field} is required`);
        continue;
      }
      
      // Skip validation if not required and empty
      if (!rules.required && (value === undefined || value === null || value === '')) {
        continue;
      }
      
      // Type validation
      if (rules.type) {
        const typeValid = this.validateType(value, rules.type);
        if (!typeValid) {
          errors.push(`${field} must be of type ${rules.type}`);
          continue;
        }
      }
      
      // Custom validation
      if (rules.validate) {
        const customValid = rules.validate(value);
        if (customValid !== true) {
          errors.push(customValid || `${field} validation failed`);
          continue;
        }
      }
      
      // Sanitize value
      sanitized[field] = this.sanitizeValue(value, rules);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      sanitized
    };
  }
  
  /**
   * Validate type
   */
  validateType(value, type) {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'email':
        return this.isValidEmail(value);
      case 'url':
        return this.isValidURL(value);
      case 'ip':
        return this.isValidIP(value);
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      default:
        return true;
    }
  }
  
  /**
   * Sanitize value
   */
  sanitizeValue(value, rules) {
    if (typeof value === 'string') {
      // Trim whitespace
      value = value.trim();
      
      // Escape HTML
      if (rules.escapeHTML !== false) {
        value = validator.escape(value);
      }
      
      // Max length
      if (rules.maxLength) {
        value = value.substring(0, rules.maxLength);
      }
    }
    
    return value;
  }
  
  /**
   * Sanitize object recursively
   */
  sanitize(obj) {
    if (typeof obj === 'string') {
      return validator.escape(obj.trim());
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitize(item));
    }
    
    if (typeof obj === 'object' && obj !== null) {
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = this.sanitize(value);
      }
      return sanitized;
    }
    
    return obj;
  }
  
  /**
   * Validate email
   */
  isValidEmail(email) {
    if (typeof email !== 'string') return false;
    return validator.isEmail(email);
  }
  
  /**
   * Validate URL
   */
  isValidURL(url) {
    if (typeof url !== 'string') return false;
    return validator.isURL(url, {
      protocols: ['http', 'https'],
      require_protocol: true
    });
  }
  
  /**
   * Validate IP address
   */
  isValidIP(ip) {
    if (typeof ip !== 'string') return false;
    return validator.isIP(ip);
  }
  
  /**
   * Validate username
   */
  isValidUsername(username) {
    if (typeof username !== 'string') return false;
    // Alphanumeric, underscore, hyphen, 3-20 characters
    return /^[a-zA-Z0-9_-]{3,20}$/.test(username);
  }
  
  /**
   * Validate password strength
   */
  isStrongPassword(password) {
    if (typeof password !== 'string') return false;
    return validator.isStrongPassword(password, {
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 1
    });
  }
  
  /**
   * Check for SQL injection patterns
   */
  containsSQLInjection(value) {
    if (typeof value !== 'string') return false;
    
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
      /(UNION.*SELECT)/i,
      /(\bOR\b.*=.*)/i,
      /(--|\#|\/\*|\*\/)/,
      /(\bAND\b.*=.*)/i
    ];
    
    return sqlPatterns.some(pattern => pattern.test(value));
  }
  
  /**
   * Check for XSS patterns
   */
  containsXSS(value) {
    if (typeof value !== 'string') return false;
    
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /<iframe[^>]*>.*?<\/iframe>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi, // Event handlers like onclick=
      /<object[^>]*>.*?<\/object>/gi,
      /<embed[^>]*>/gi
    ];
    
    return xssPatterns.some(pattern => pattern.test(value));
  }
  
  /**
   * Check for path traversal
   */
  containsPathTraversal(value) {
    if (typeof value !== 'string') return false;
    
    const pathTraversalPatterns = [
      /\.\.\//,
      /\.\.\\/,
      /%2e%2e%2f/i,
      /%2e%2e%5c/i
    ];
    
    return pathTraversalPatterns.some(pattern => pattern.test(value));
  }
  
  /**
   * Check for command injection
   */
  containsCommandInjection(value) {
    if (typeof value !== 'string') return false;
    
    const commandPatterns = [
      /[;&|`$()]/,
      /\$\{.*\}/,
      /\$\(.*\)/
    ];
    
    return commandPatterns.some(pattern => pattern.test(value));
  }
  
  /**
   * Comprehensive security check
   */
  isSafe(value) {
    return !this.containsSQLInjection(value) &&
           !this.containsXSS(value) &&
           !this.containsPathTraversal(value) &&
           !this.containsCommandInjection(value);
  }
}

module.exports = ValidatorService;
