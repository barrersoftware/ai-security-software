/**
 * Resource Limiter
 * Enforces tenant resource limits
 */

class ResourceLimiter {
  constructor(core) {
    this.core = core;
    this.logger = core.getService('logger');
  }

  /**
   * Parse storage string to bytes
   */
  parseStorage(storageStr) {
    if (typeof storageStr === 'number') return storageStr;
    
    const units = {
      'B': 1,
      'KB': 1024,
      'MB': 1024 * 1024,
      'GB': 1024 * 1024 * 1024,
      'TB': 1024 * 1024 * 1024 * 1024
    };

    const match = storageStr.match(/^(\d+(?:\.\d+)?)\s*([A-Z]+)$/i);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    
    return value * (units[unit] || 0);
  }

  /**
   * Format bytes to storage string
   */
  formatStorage(bytes) {
    if (bytes === 0) return '0B';
    
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${(bytes / Math.pow(k, i)).toFixed(2)}${units[i]}`;
  }

  /**
   * Check if tenant can perform operation within limits
   */
  async checkLimit(tenantId, resource) {
    try {
      const tenantManager = this.core.getService('tenant-manager');
      
      if (!tenantManager) {
        this.logger?.warn('Tenant manager not available, allowing operation');
        return true;
      }

      const tenant = await tenantManager.getTenant(tenantId);
      
      if (!tenant) {
        this.logger?.warn(`Tenant ${tenantId} not found`);
        return false;
      }

      // Check specific resource limit
      const limit = tenant.limits?.[resource];
      const usage = tenant.usage?.[resource];

      if (limit === undefined || usage === undefined) {
        // No limit defined, allow operation
        return true;
      }

      // Handle storage limits (convert to bytes for comparison)
      if (resource === 'storage') {
        const limitBytes = this.parseStorage(limit);
        const usageBytes = this.parseStorage(usage);
        
        if (usageBytes >= limitBytes) {
          this.logger?.warn(`Tenant ${tenant.name} storage limit reached: ${usage}/${limit}`);
          return false;
        }
        return true;
      }

      // Handle numeric limits
      if (typeof limit === 'number' && typeof usage === 'number') {
        if (usage >= limit) {
          this.logger?.warn(`Tenant ${tenant.name} ${resource} limit reached: ${usage}/${limit}`);
          return false;
        }
        return true;
      }

      // Default to allowing operation
      return true;
    } catch (error) {
      this.logger?.error('Error checking limit:', error);
      // On error, allow operation (fail open)
      return true;
    }
  }

  /**
   * Middleware to check limits before operation
   */
  checkLimitMiddleware(resource) {
    return async (req, res, next) => {
      try {
        const tenantId = req.tenantId || req.tenant?.id;
        
        if (!tenantId) {
          // No tenant context, allow operation
          return next();
        }

        const canProceed = await this.checkLimit(tenantId, resource);
        
        if (!canProceed) {
          const tenantManager = this.core.getService('tenant-manager');
          const tenant = await tenantManager.getTenant(tenantId);
          
          return res.status(429).json({
            error: 'Resource limit exceeded',
            message: `Your ${resource} limit has been reached`,
            limit: tenant?.limits?.[resource],
            usage: tenant?.usage?.[resource],
            contact: 'Please contact support to upgrade your plan'
          });
        }

        next();
      } catch (error) {
        this.logger?.error('Error in limit middleware:', error);
        // On error, allow operation
        next();
      }
    };
  }

  /**
   * Get current usage percentage for a resource
   */
  async getUsagePercentage(tenantId, resource) {
    try {
      const tenantManager = this.core.getService('tenant-manager');
      const tenant = await tenantManager.getTenant(tenantId);
      
      if (!tenant) return 0;

      const limit = tenant.limits?.[resource];
      const usage = tenant.usage?.[resource];

      if (!limit || !usage) return 0;

      // Handle storage
      if (resource === 'storage') {
        const limitBytes = this.parseStorage(limit);
        const usageBytes = this.parseStorage(usage);
        return (usageBytes / limitBytes) * 100;
      }

      // Handle numeric
      if (typeof limit === 'number' && typeof usage === 'number') {
        return (usage / limit) * 100;
      }

      return 0;
    } catch (error) {
      this.logger?.error('Error calculating usage percentage:', error);
      return 0;
    }
  }

  /**
   * Check multiple resource limits at once
   */
  async checkMultipleLimits(tenantId, resources) {
    const results = {};
    
    for (const resource of resources) {
      results[resource] = await this.checkLimit(tenantId, resource);
    }
    
    return results;
  }

  /**
   * Get all limits and usage for tenant
   */
  async getTenantLimits(tenantId) {
    try {
      const tenantManager = this.core.getService('tenant-manager');
      const tenant = await tenantManager.getTenant(tenantId);
      
      if (!tenant) {
        return null;
      }

      const resources = Object.keys(tenant.limits || {});
      const limits = {};

      for (const resource of resources) {
        limits[resource] = {
          limit: tenant.limits[resource],
          usage: tenant.usage[resource],
          percentage: await this.getUsagePercentage(tenantId, resource),
          available: await this.checkLimit(tenantId, resource)
        };
      }

      return limits;
    } catch (error) {
      this.logger?.error('Error getting tenant limits:', error);
      return null;
    }
  }

  /**
   * Warn if approaching limit (80%+)
   */
  async checkLimitWarnings(tenantId) {
    try {
      const limits = await this.getTenantLimits(tenantId);
      
      if (!limits) return [];

      const warnings = [];
      
      for (const [resource, data] of Object.entries(limits)) {
        if (data.percentage >= 80) {
          warnings.push({
            resource,
            percentage: data.percentage,
            limit: data.limit,
            usage: data.usage,
            severity: data.percentage >= 95 ? 'critical' : 'warning'
          });
        }
      }

      return warnings;
    } catch (error) {
      this.logger?.error('Error checking limit warnings:', error);
      return [];
    }
  }
}

module.exports = ResourceLimiter;
