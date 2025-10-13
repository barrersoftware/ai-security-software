/**
 * Security Headers Service
 * Apply security headers to protect against common attacks
 */

class HeadersService {
  constructor(core) {
    this.core = core;
    this.logger = core.getService('logger');
    this.config = core.getConfig('security.headers') || {};
    
    // Default configuration
    this.headers = {
      // HSTS - Force HTTPS
      hsts: this.config.hsts !== false,
      hstsMaxAge: 31536000, // 1 year
      hstsIncludeSubDomains: true,
      
      // Content Security Policy
      csp: this.config.csp !== false,
      cspDirectives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"]
      },
      
      // X-Content-Type-Options
      noSniff: this.config.noSniff !== false,
      
      // X-Frame-Options
      frameOptions: 'DENY',
      
      // X-XSS-Protection
      xssProtection: this.config.xssProtection !== false,
      
      // Referrer-Policy
      referrerPolicy: 'strict-origin-when-cross-origin',
      
      // Permissions-Policy
      permissionsPolicy: {
        geolocation: [],
        microphone: [],
        camera: [],
        payment: [],
        usb: []
      }
    };
  }
  
  async init() {
    this.logger.info('Headers service initialized');
  }
  
  /**
   * Apply security headers to response
   */
  applyHeaders(res) {
    // HSTS
    if (this.headers.hsts) {
      let hstsValue = `max-age=${this.headers.hstsMaxAge}`;
      if (this.headers.hstsIncludeSubDomains) {
        hstsValue += '; includeSubDomains';
      }
      res.set('Strict-Transport-Security', hstsValue);
    }
    
    // CSP
    if (this.headers.csp) {
      const cspValue = this.buildCSPHeader();
      res.set('Content-Security-Policy', cspValue);
    }
    
    // X-Content-Type-Options
    if (this.headers.noSniff) {
      res.set('X-Content-Type-Options', 'nosniff');
    }
    
    // X-Frame-Options
    res.set('X-Frame-Options', this.headers.frameOptions);
    
    // X-XSS-Protection
    if (this.headers.xssProtection) {
      res.set('X-XSS-Protection', '1; mode=block');
    }
    
    // Referrer-Policy
    res.set('Referrer-Policy', this.headers.referrerPolicy);
    
    // Permissions-Policy
    const permissionsValue = this.buildPermissionsHeader();
    if (permissionsValue) {
      res.set('Permissions-Policy', permissionsValue);
    }
    
    // Remove identifying headers
    res.removeHeader('X-Powered-By');
    res.removeHeader('Server');
  }
  
  /**
   * Build Content-Security-Policy header
   */
  buildCSPHeader() {
    const directives = [];
    
    for (const [key, value] of Object.entries(this.headers.cspDirectives)) {
      const directive = this.camelToKebab(key);
      const sources = Array.isArray(value) ? value.join(' ') : value;
      directives.push(`${directive} ${sources}`);
    }
    
    return directives.join('; ');
  }
  
  /**
   * Build Permissions-Policy header
   */
  buildPermissionsHeader() {
    const policies = [];
    
    for (const [feature, allowlist] of Object.entries(this.headers.permissionsPolicy)) {
      if (Array.isArray(allowlist)) {
        if (allowlist.length === 0) {
          policies.push(`${feature}=()`);
        } else {
          policies.push(`${feature}=(${allowlist.join(' ')})`);
        }
      }
    }
    
    return policies.join(', ');
  }
  
  /**
   * Convert camelCase to kebab-case
   */
  camelToKebab(str) {
    return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  }
  
  /**
   * Express middleware to apply headers
   */
  middleware() {
    return (req, res, next) => {
      this.applyHeaders(res);
      next();
    };
  }
  
  /**
   * Get status
   */
  getStatus() {
    return {
      hsts: this.headers.hsts,
      csp: this.headers.csp,
      noSniff: this.headers.noSniff,
      frameOptions: this.headers.frameOptions,
      xssProtection: this.headers.xssProtection,
      referrerPolicy: this.headers.referrerPolicy
    };
  }
}

module.exports = HeadersService;
