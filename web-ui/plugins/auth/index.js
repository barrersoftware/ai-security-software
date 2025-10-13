/**
 * Authentication Plugin
 * Comprehensive auth system with MFA, OAuth, IDS
 */

const express = require('express');
const AuthService = require('./auth-service');
const MFAService = require('./mfa-service');
const OAuthService = require('./oauth-service');
const IDSService = require('./ids-service');
const LDAPService = require('./ldap-service');

module.exports = {
  name: 'auth',
  version: '1.0.0',
  
  async init(core) {
    this.core = core;
    this.logger = core.getService('logger');
    this.config = core.getConfig('auth') || {};
    this.integrations = core.getService('integrations');
    
    // Initialize services
    this.authService = new AuthService(core);
    this.mfaService = new MFAService(core);
    this.oauthService = new OAuthService(core);
    this.idsService = new IDSService(core);
    this.ldapService = new LDAPService(core);
    
    await this.authService.init();
    await this.mfaService.init();
    await this.oauthService.init();
    await this.idsService.init();
    await this.ldapService.init();
    
    this.logger.info('Auth plugin initialized');
  },
  
  routes() {
    const router = express.Router();
    
    // Get security services
    const securityMiddleware = this.core.getService('security-middleware');
    const rateLimiter = securityMiddleware ? securityMiddleware.rateLimiter : null;
    const loginRateLimiter = securityMiddleware ? securityMiddleware.loginRateLimiter : null;
    const validateInput = securityMiddleware ? securityMiddleware.validateInput : null;
    const sanitizeRequest = securityMiddleware ? securityMiddleware.sanitizeRequest : null;
    
    // Helper to apply middleware safely
    const applyMiddleware = (middleware) => {
      return middleware || ((req, res, next) => next());
    };
    
    // Authentication routes
    router.post('/api/auth/login', 
      applyMiddleware(loginRateLimiter ? loginRateLimiter() : null),
      applyMiddleware(sanitizeRequest),
      async (req, res) => {
      try {
        const { username, password, mfaToken, useLDAP } = req.body;
        
        if (!username || !password) {
          return res.status(400).json({
            success: false,
            error: 'Username and password required'
          });
        }
        
        // Check for suspicious activity
        const ipAddress = req.ip || req.connection.remoteAddress;
        if (await this.idsService.isBlocked(ipAddress)) {
          return res.status(403).json({
            success: false,
            error: 'Access temporarily blocked due to suspicious activity'
          });
        }
        
        let result;
        
        // Try LDAP first if enabled and requested
        if (useLDAP || this.ldapService.config.enabled) {
          result = await this.ldapService.authenticate(username, password);
          
          // If LDAP succeeds, create local session
          if (result.success) {
            const token = this.authService.generateToken();
            // Would create session here
            result.token = token;
          }
        }
        
        // Fall back to local authentication
        if (!result || !result.success) {
          result = await this.authService.login(username, password, mfaToken);
        }
        
        if (!result.success) {
          // Record failed attempt
          await this.idsService.recordFailedAttempt(ipAddress, username);
          
          return res.status(401).json(result);
        }
        
        // Check if MFA is required
        if (result.mfaRequired && !mfaToken) {
          return res.json({
            success: false,
            mfaRequired: true,
            message: 'MFA token required'
          });
        }
        
        // Successful login
        await this.idsService.recordSuccessfulLogin(ipAddress, username);
        
        // Token-based authentication (no session cookies needed)
        // Session management is handled via JWT tokens
        
        res.json({
          success: true,
          data: {
            token: result.token,
            user: result.user
          }
        });
        
      } catch (err) {
        this.logger.error('Login error:', err);
        res.status(500).json({ success: false, error: err.message });
      }
    });
    
    // Logout
    router.post('/api/auth/logout', async (req, res) => {
      try {
        const token = req.session.token || req.headers.authorization?.replace('Bearer ', '');
        
        if (token) {
          await this.authService.logout(token);
        }
        
        req.session.destroy();
        
        res.json({ success: true, message: 'Logged out successfully' });
      } catch (err) {
        this.logger.error('Logout error:', err);
        res.status(500).json({ success: false, error: err.message });
      }
    });
    
    // Register new user
    router.post('/api/auth/register',
      applyMiddleware(rateLimiter ? rateLimiter({ maxRequests: 10, windowMs: 60000 }) : null),
      applyMiddleware(sanitizeRequest),
      applyMiddleware(validateInput ? validateInput({
        username: { type: 'string', required: true, minLength: 3, maxLength: 50 },
        password: { type: 'string', required: true, minLength: 8 },
        email: { type: 'email', required: true }
      }) : null),
      async (req, res) => {
      try {
        const { username, password, email } = req.body;
        
        const result = await this.authService.register(username, password, email);
        
        res.json(result);
      } catch (err) {
        this.logger.error('Registration error:', err);
        res.status(500).json({ success: false, error: err.message });
      }
    });
    
    // Get current session
    router.get('/api/auth/session', this.requireAuth.bind(this), async (req, res) => {
      try {
        res.json({
          success: true,
          data: {
            user: req.user
          }
        });
      } catch (err) {
        this.logger.error('Session error:', err);
        res.status(500).json({ success: false, error: err.message });
      }
    });
    
    // MFA Setup
    router.post('/api/auth/mfa/setup', this.requireAuth.bind(this), async (req, res) => {
      try {
        const result = await this.mfaService.setupMFA(req.user.id, req.user.username);
        
        res.json({ success: true, data: result });
      } catch (err) {
        this.logger.error('MFA setup error:', err);
        res.status(500).json({ success: false, error: err.message });
      }
    });
    
    // MFA Verify
    router.post('/api/auth/mfa/verify', this.requireAuth.bind(this), async (req, res) => {
      try {
        const { token } = req.body;
        
        const result = await this.mfaService.verifyToken(req.user.id, token);
        
        if (result.success) {
          await this.mfaService.enableMFA(req.user.id);
        }
        
        res.json(result);
      } catch (err) {
        this.logger.error('MFA verify error:', err);
        res.status(500).json({ success: false, error: err.message });
      }
    });
    
    // MFA Disable
    router.post('/api/auth/mfa/disable', this.requireAuth.bind(this), async (req, res) => {
      try {
        const { token } = req.body;
        
        const result = await this.mfaService.disableMFA(req.user.id, token);
        
        res.json(result);
      } catch (err) {
        this.logger.error('MFA disable error:', err);
        res.status(500).json({ success: false, error: err.message });
      }
    });
    
    // OAuth routes
    router.get('/api/auth/oauth/:provider', (req, res) => {
      const { provider } = req.params;
      const authUrl = this.oauthService.getAuthUrl(provider, req);
      
      if (!authUrl) {
        return res.status(400).json({ success: false, error: 'Invalid OAuth provider' });
      }
      
      res.redirect(authUrl);
    });
    
    router.get('/api/auth/oauth/:provider/callback', async (req, res) => {
      try {
        const { provider } = req.params;
        const result = await this.oauthService.handleCallback(provider, req);
        
        if (result.success) {
          req.session.token = result.token;
          req.session.userId = result.user.id;
          req.session.username = result.user.username;
          
          res.redirect('/dashboard.html');
        } else {
          res.redirect('/login.html?error=oauth_failed');
        }
      } catch (err) {
        this.logger.error('OAuth callback error:', err);
        res.redirect('/login.html?error=oauth_error');
      }
    });
    
    // IDS status (admin only)
    router.get('/api/auth/ids/status', this.requireAdmin.bind(this), async (req, res) => {
      try {
        const status = await this.idsService.getStatus();
        res.json({ success: true, data: status });
      } catch (err) {
        this.logger.error('IDS status error:', err);
        res.status(500).json({ success: false, error: err.message });
      }
    });
    
    // LDAP/AD routes
    router.get('/api/auth/ldap/status', this.requireAdmin.bind(this), async (req, res) => {
      try {
        const status = this.ldapService.getStatus();
        res.json({ success: true, data: status });
      } catch (err) {
        this.logger.error('LDAP status error:', err);
        res.status(500).json({ success: false, error: err.message });
      }
    });
    
    router.post('/api/auth/ldap/verify', this.requireAdmin.bind(this), async (req, res) => {
      try {
        const result = await this.ldapService.verifyConnection();
        res.json(result);
      } catch (err) {
        this.logger.error('LDAP verify error:', err);
        res.status(500).json({ success: false, error: err.message });
      }
    });
    
    router.post('/api/auth/ldap/search', this.requireAdmin.bind(this), async (req, res) => {
      try {
        const { search, limit } = req.body;
        const result = await this.ldapService.searchUsers(search, limit);
        res.json(result);
      } catch (err) {
        this.logger.error('LDAP search error:', err);
        res.status(500).json({ success: false, error: err.message });
      }
    });
    
    // Get CSRF token
    router.get('/api/auth/csrf-token', async (req, res) => {
      try {
        const csrfService = this.core.getService('csrf-service');
        if (!csrfService) {
          return res.status(500).json({
            success: false,
            error: 'CSRF service not available'
          });
        }
        
        const token = csrfService.generateToken(req);
        res.json({
          success: true,
          data: { csrfToken: token }
        });
      } catch (err) {
        this.logger.error('CSRF token error:', err);
        res.status(500).json({ success: false, error: err.message });
      }
    });
    
    return router;
  },
  
  middleware() {
    return {
      requireAuth: this.requireAuth.bind(this),
      requireAdmin: this.requireAdmin.bind(this),
      checkMFA: this.checkMFA.bind(this)
    };
  },
  
  // Middleware: Require authentication
  async requireAuth(req, res, next) {
    try {
      // Get token from Authorization header
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
      
      if (!token) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }
      
      const user = await this.authService.validateToken(token);
      
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Invalid or expired token'
        });
      }
      
      req.user = user;
      next();
    } catch (err) {
      this.logger.error('Auth middleware error:', err);
      res.status(500).json({ success: false, error: 'Authentication error' });
    }
  },
  
  // Middleware: Require admin
  async requireAdmin(req, res, next) {
    await this.requireAuth(req, res, () => {
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Admin access required'
        });
      }
      next();
    });
  },
  
  // Middleware: Check MFA
  async checkMFA(req, res, next) {
    try {
      if (req.user && await this.mfaService.isEnabled(req.user.id)) {
        if (!req.session.mfaVerified) {
          return res.status(403).json({
            success: false,
            error: 'MFA verification required',
            mfaRequired: true
          });
        }
      }
      next();
    } catch (err) {
      this.logger.error('MFA check error:', err);
      next();
    }
  },
  
  services() {
    return {
      auth: this.authService,
      mfa: this.mfaService,
      oauth: this.oauthService,
      ids: this.idsService,
      ldap: this.ldapService
    };
  },
  
  async destroy() {
    await this.authService.cleanup();
    await this.idsService.cleanup();
    this.logger.info('Auth plugin destroyed');
  }
};
