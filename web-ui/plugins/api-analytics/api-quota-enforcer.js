/**
 * API Quota Enforcer
 * Enforces API request limits per tenant
 */

class ApiQuotaEnforcer {
  constructor(core) {
    this.core = core;
    this.logger = core.getService('logger');
    
    // Cache for quota checks (to reduce database lookups)
    this.quotaCache = new Map();
    this.cacheTTL = 60 * 1000; // 1 minute
  }

  async init() {
    // Start cache cleanup
    this.startCacheCleanup();
    
    this.logger?.info('API Quota Enforcer initialized');
  }

  /**
   * Check if tenant can make more API requests
   */
  async checkQuota(tenantId) {
    if (!tenantId) {
      return true; // No tenant = no limit
    }

    // Check cache first
    const cached = this.quotaCache.get(tenantId);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.allowed;
    }

    try {
      // Get resource limiter
      const resourceLimiter = this.core.getService('resource-limiter');
      if (!resourceLimiter) {
        return true; // No limiter = no enforcement
      }

      // Check if tenant can make more requests
      const allowed = await resourceLimiter.checkLimit(tenantId, 'apiRequests');
      
      // Cache result
      this.quotaCache.set(tenantId, {
        allowed,
        timestamp: Date.now()
      });

      return allowed;
    } catch (error) {
      this.logger?.error('Error checking quota:', error);
      return true; // Fail open (don't block on error)
    }
  }

  /**
   * Get quota status for tenant
   */
  async getQuotaStatus(tenantId) {
    if (!tenantId) {
      return {
        hasQuota: false,
        message: 'No tenant context'
      };
    }

    try {
      const usageTracker = this.core.getService('usage-tracker');
      const tenantManager = this.core.getService('tenant-manager');
      
      if (!usageTracker || !tenantManager) {
        return {
          hasQuota: false,
          message: 'Services not available'
        };
      }

      const stats = await usageTracker.getTenantStats(tenantId);
      const tenant = await tenantManager.getTenant(tenantId);
      
      const usage = stats.usage.apiRequests || 0;
      const limit = stats.limits.apiRequests || 0;
      const percentage = stats.percentages.apiRequests || 0;
      const remaining = Math.max(0, limit - usage);
      
      // Determine status
      let status = 'healthy';
      let message = `${remaining} requests remaining`;
      
      if (percentage >= 100) {
        status = 'exceeded';
        message = 'Quota exceeded - requests blocked';
      } else if (percentage >= 95) {
        status = 'critical';
        message = `Only ${remaining} requests remaining`;
      } else if (percentage >= 80) {
        status = 'warning';
        message = `${percentage.toFixed(1)}% of quota used`;
      }
      
      return {
        tenantId,
        tenantName: tenant?.name || 'Unknown',
        hasQuota: true,
        quota: {
          current: usage,
          limit: limit,
          remaining: remaining,
          percentage: percentage.toFixed(2) + '%'
        },
        status,
        message,
        canMakeRequests: percentage < 100,
        resetInfo: this.getResetInfo(tenant)
      };
    } catch (error) {
      this.logger?.error('Error getting quota status:', error);
      return {
        hasQuota: false,
        error: error.message
      };
    }
  }

  /**
   * Get quota reset information
   */
  getResetInfo(tenant) {
    // Quotas typically reset monthly or based on billing cycle
    // For now, return generic info
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const daysUntilReset = Math.ceil((nextMonth - now) / (1000 * 60 * 60 * 24));
    
    return {
      resetDate: nextMonth.toISOString(),
      daysUntilReset,
      resetType: 'monthly'
    };
  }

  /**
   * Invalidate cache for tenant
   */
  invalidateCache(tenantId) {
    this.quotaCache.delete(tenantId);
  }

  /**
   * Start cache cleanup
   */
  startCacheCleanup() {
    // Clean cache every minute
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [tenantId, data] of this.quotaCache.entries()) {
        if (now - data.timestamp > this.cacheTTL) {
          this.quotaCache.delete(tenantId);
        }
      }
    }, 60 * 1000);
  }

  /**
   * Cleanup on shutdown
   */
  cleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

module.exports = ApiQuotaEnforcer;
