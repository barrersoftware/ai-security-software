/**
 * Audit Middleware
 * 
 * Global middleware that automatically tracks all API requests and user actions.
 * Integrates with the Enhanced Audit Logging plugin.
 */

class AuditMiddleware {
  constructor(auditLogger, logger) {
    this.auditLogger = auditLogger;
    this.logger = logger;
    
    // Paths to skip audit logging (too noisy or not relevant)
    this.skipPaths = [
      '/health',
      '/ping',
      '/favicon.ico',
      '/api/audit/logs', // Don't log audit queries themselves
      '/api/audit/events'
    ];
    
    // Map HTTP methods to action types
    this.actionMap = {
      'GET': 'read',
      'POST': 'create',
      'PUT': 'update',
      'PATCH': 'update',
      'DELETE': 'delete'
    };
  }
  
  /**
   * Get Express middleware function
   */
  middleware() {
    return async (req, res, next) => {
      // Skip paths that shouldn't be audited
      if (this.shouldSkip(req.path)) {
        return next();
      }
      
      // Skip static files
      if (req.path.startsWith('/public') || req.path.includes('.')) {
        return next();
      }
      
      // Store start time for duration calculation
      const startTime = Date.now();
      
      // Capture the original res.json to log after response
      const originalJson = res.json.bind(res);
      const originalSend = res.send.bind(res);
      let responseLogged = false;
      
      // Override res.json to capture response
      res.json = (data) => {
        if (!responseLogged) {
          responseLogged = true;
          this.logRequest(req, res, startTime, data);
        }
        return originalJson(data);
      };
      
      // Override res.send for non-JSON responses
      res.send = (data) => {
        if (!responseLogged) {
          responseLogged = true;
          this.logRequest(req, res, startTime, data);
        }
        return originalSend(data);
      };
      
      // Handle response finish event as fallback
      res.on('finish', () => {
        if (!responseLogged) {
          responseLogged = true;
          this.logRequest(req, res, startTime);
        }
      });
      
      next();
    };
  }
  
  /**
   * Check if path should be skipped
   */
  shouldSkip(path) {
    return this.skipPaths.some(skipPath => path.startsWith(skipPath));
  }
  
  /**
   * Log the request to audit log
   */
  async logRequest(req, res, startTime, responseData = null) {
    try {
      const duration = Date.now() - startTime;
      const success = res.statusCode >= 200 && res.statusCode < 400;
      
      // Determine category based on path
      const category = this.getCategory(req.path);
      
      // Determine action
      const action = this.getAction(req.method, req.path);
      
      // Determine severity
      const severity = this.getSeverity(res.statusCode, req.method);
      
      // Build audit event
      const auditEvent = {
        tenantId: req.user?.tenantId || null,
        userId: req.user?.id || null,
        category,
        action,
        severity,
        success,
        details: {
          method: req.method,
          path: req.path,
          query: req.query,
          statusCode: res.statusCode,
          duration: `${duration}ms`,
          userAgent: req.get('user-agent'),
          contentType: res.get('content-type')
        },
        metadata: {
          endpoint: `${req.method} ${req.path}`,
          authenticated: !!req.user,
          username: req.user?.username || 'anonymous'
        },
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent'),
        errorMessage: !success ? this.getErrorMessage(res.statusCode, responseData) : null
      };
      
      // Log to audit system
      await this.auditLogger.log(auditEvent);
      
    } catch (error) {
      // Don't let audit logging errors break the application
      this.logger.error('[AuditMiddleware] Error logging request:', error);
    }
  }
  
  /**
   * Get category based on request path
   */
  getCategory(path) {
    if (path.includes('/auth')) return 'authentication';
    if (path.includes('/user')) return 'user_management';
    if (path.includes('/tenant')) return 'tenant_management';
    if (path.includes('/config') || path.includes('/settings')) return 'configuration';
    if (path.includes('/scan')) return 'security_scan';
    if (path.includes('/vpn')) return 'system_changes';
    if (path.includes('/admin')) return 'user_management';
    if (path.includes('/compliance')) return 'compliance';
    return 'api_access';
  }
  
  /**
   * Get action based on method and path
   */
  getAction(method, path) {
    const baseAction = this.actionMap[method] || 'access';
    
    // Try to extract resource from path
    const parts = path.split('/').filter(p => p);
    const resource = parts[parts.length - 1];
    
    if (method === 'POST' && path.includes('/login')) return 'login_attempt';
    if (method === 'POST' && path.includes('/logout')) return 'logout';
    if (method === 'GET' && path.includes('/logs')) return 'view_logs';
    if (method === 'DELETE') return `delete_${resource}`;
    
    return `${baseAction}_${resource || 'api'}`;
  }
  
  /**
   * Get severity based on status code and method
   */
  getSeverity(statusCode, method) {
    if (statusCode >= 500) return 'critical';
    if (statusCode >= 400) {
      // Failed auth attempts are more severe
      if (statusCode === 401 || statusCode === 403) return 'warning';
      return 'error';
    }
    if (method === 'DELETE') return 'warning';
    if (method === 'POST' || method === 'PUT') return 'info';
    return 'info';
  }
  
  /**
   * Extract error message from response
   */
  getErrorMessage(statusCode, responseData) {
    if (responseData && typeof responseData === 'object') {
      return responseData.error || responseData.message || `HTTP ${statusCode}`;
    }
    return `HTTP ${statusCode}`;
  }
}

module.exports = AuditMiddleware;
