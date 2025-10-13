/**
 * API Analytics Plugin
 * Tracks API requests, enforces quotas, and provides usage analytics
 */

const express = require('express');
const ApiTracker = require('./api-tracker');
const ApiAnalytics = require('./api-analytics');
const ApiQuotaEnforcer = require('./api-quota-enforcer');

module.exports = {
  name: 'api-analytics',
  version: '1.0.0',

  async init(core) {
    this.core = core;
    this.logger = core.getService('logger');

    // Initialize services
    this.apiTracker = new ApiTracker(core);
    this.apiAnalytics = new ApiAnalytics(core);
    this.quotaEnforcer = new ApiQuotaEnforcer(core);

    await this.apiTracker.init();
    await this.apiAnalytics.init();
    await this.quotaEnforcer.init();

    // Register services
    core.registerService('api-tracker', this.apiTracker);
    core.registerService('api-analytics', this.apiAnalytics);
    core.registerService('api-quota-enforcer', this.quotaEnforcer);

    this.logger?.info('API Analytics plugin initialized');
  },

  routes() {
    const router = express.Router();

    // Get auth middleware
    const authPlugin = this.core.getPlugins().getAll().find(p => p.name === 'auth');
    const requireAuth = authPlugin?.instance.requireAuth?.bind(authPlugin.instance) || 
      ((req, res, next) => next());
    const requireAdmin = authPlugin?.instance.requireAdmin?.bind(authPlugin.instance) || 
      ((req, res, next) => next());

    // Get current tenant's API usage
    router.get('/api/analytics/usage', requireAuth, async (req, res) => {
      try {
        const tenantId = req.tenantId || req.user?.tenantId;
        
        if (!tenantId) {
          return res.status(400).json({
            success: false,
            error: 'Tenant context required'
          });
        }

        const usage = await this.apiAnalytics.getTenantUsage(tenantId);
        
        res.json({
          success: true,
          data: usage
        });
      } catch (error) {
        this.logger?.error('Error getting API usage:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Get API usage by endpoint
    router.get('/api/analytics/endpoints', requireAuth, async (req, res) => {
      try {
        const tenantId = req.tenantId || req.user?.tenantId;
        
        if (!tenantId) {
          return res.status(400).json({
            success: false,
            error: 'Tenant context required'
          });
        }

        const { timeRange = '24h' } = req.query;
        const endpoints = await this.apiAnalytics.getEndpointStats(tenantId, timeRange);
        
        res.json({
          success: true,
          data: endpoints
        });
      } catch (error) {
        this.logger?.error('Error getting endpoint stats:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Get API usage trends
    router.get('/api/analytics/trends', requireAuth, async (req, res) => {
      try {
        const tenantId = req.tenantId || req.user?.tenantId;
        
        if (!tenantId) {
          return res.status(400).json({
            success: false,
            error: 'Tenant context required'
          });
        }

        const { timeRange = '7d', interval = '1h' } = req.query;
        const trends = await this.apiAnalytics.getUsageTrends(tenantId, timeRange, interval);
        
        res.json({
          success: true,
          data: trends
        });
      } catch (error) {
        this.logger?.error('Error getting usage trends:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Get top users by API usage
    router.get('/api/analytics/top-users', requireAuth, requireAdmin, async (req, res) => {
      try {
        const tenantId = req.tenantId || req.user?.tenantId;
        
        if (!tenantId) {
          return res.status(400).json({
            success: false,
            error: 'Tenant context required'
          });
        }

        const { limit = 10, timeRange = '24h' } = req.query;
        const topUsers = await this.apiAnalytics.getTopUsers(tenantId, parseInt(limit), timeRange);
        
        res.json({
          success: true,
          data: topUsers
        });
      } catch (error) {
        this.logger?.error('Error getting top users:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Get API quota status
    router.get('/api/analytics/quota', requireAuth, async (req, res) => {
      try {
        const tenantId = req.tenantId || req.user?.tenantId;
        
        if (!tenantId) {
          return res.status(400).json({
            success: false,
            error: 'Tenant context required'
          });
        }

        const quotaStatus = await this.quotaEnforcer.getQuotaStatus(tenantId);
        
        res.json({
          success: true,
          data: quotaStatus
        });
      } catch (error) {
        this.logger?.error('Error getting quota status:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Admin: Get all tenants' API usage
    router.get('/api/analytics/all-tenants', requireAuth, requireAdmin, async (req, res) => {
      try {
        const { timeRange = '24h' } = req.query;
        const allTenants = await this.apiAnalytics.getAllTenantsUsage(timeRange);
        
        res.json({
          success: true,
          data: allTenants
        });
      } catch (error) {
        this.logger?.error('Error getting all tenants usage:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Admin: Get system-wide statistics
    router.get('/api/analytics/system', requireAuth, requireAdmin, async (req, res) => {
      try {
        const { timeRange = '24h' } = req.query;
        const systemStats = await this.apiAnalytics.getSystemStats(timeRange);
        
        res.json({
          success: true,
          data: systemStats
        });
      } catch (error) {
        this.logger?.error('Error getting system stats:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    return router;
  },

  middleware() {
    return {
      // Track all API requests
      trackApiRequest: async (req, res, next) => {
        // Skip tracking for static files and health checks
        if (req.path.startsWith('/static') || 
            req.path === '/health' || 
            req.path === '/api/health') {
          return next();
        }

        const startTime = Date.now();
        const tenantId = req.tenantId || req.user?.tenantId || null;
        const userId = req.user?.id || null;

        // Check quota before processing request
        if (tenantId) {
          try {
            const allowed = await this.quotaEnforcer.checkQuota(tenantId);
            if (!allowed) {
              return res.status(429).json({
                success: false,
                error: 'API request quota exceeded for your organization',
                quotaExceeded: true
              });
            }
          } catch (error) {
            this.logger?.error('Error checking quota:', error);
            // Don't block request on quota check failure
          }
        }

        // Capture response
        const originalSend = res.send;
        let responseBody;
        
        res.send = function(data) {
          responseBody = data;
          return originalSend.call(this, data);
        };

        // Track request after response is sent
        res.on('finish', async () => {
          const duration = Date.now() - startTime;

          try {
            await this.apiTracker.trackRequest({
              tenantId,
              userId,
              method: req.method,
              path: req.path,
              statusCode: res.statusCode,
              duration,
              timestamp: new Date().toISOString(),
              userAgent: req.get('user-agent'),
              ip: req.ip
            });

            // Track usage in tenant stats if tenant context available
            if (tenantId) {
              const usageTracker = this.core.getService('usage-tracker');
              if (usageTracker) {
                await usageTracker.trackUsage(tenantId, 'apiRequests', 1);
              }
            }
          } catch (error) {
            this.logger?.error('Error tracking API request:', error);
          }
        });

        next();
      }
    };
  }
};
