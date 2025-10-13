/**
 * Usage Tracker
 * Tracks resource usage for tenants
 */

const fs = require('fs').promises;
const path = require('path');

class UsageTracker {
  constructor(core) {
    this.core = core;
    this.logger = core.getService('logger');
    this.usageHistory = new Map(); // tenantId -> usage events
    this.dataDir = path.join(__dirname, '../../data/tenants');
  }

  /**
   * Track resource usage
   */
  async trackUsage(tenantId, resource, amount = 1) {
    try {
      const tenantManager = this.core.getService('tenant-manager');
      
      if (!tenantManager) {
        this.logger?.warn('Tenant manager not available');
        return false;
      }

      const tenant = await tenantManager.getTenant(tenantId);
      
      if (!tenant) {
        this.logger?.warn(`Tenant ${tenantId} not found`);
        return false;
      }

      // Update usage
      const currentUsage = tenant.usage[resource];
      
      if (resource === 'storage') {
        // Handle storage (string format)
        const resourceLimiter = this.core.getService('resource-limiter');
        const currentBytes = resourceLimiter.parseStorage(currentUsage || '0B');
        const newBytes = currentBytes + amount;
        tenant.usage[resource] = resourceLimiter.formatStorage(newBytes);
      } else if (typeof currentUsage === 'number') {
        // Handle numeric resources
        tenant.usage[resource] = (currentUsage || 0) + amount;
      } else {
        // Initialize if not exists
        tenant.usage[resource] = amount;
      }

      // Update tenant
      await tenantManager.updateTenant(tenantId, {
        usage: tenant.usage
      });

      // Record usage event
      await this.recordUsageEvent(tenantId, resource, amount);

      this.logger?.debug(`Tracked ${amount} ${resource} usage for tenant ${tenant.name}`);
      return true;
    } catch (error) {
      this.logger?.error('Error tracking usage:', error);
      return false;
    }
  }

  /**
   * Record usage event for history/analytics
   */
  async recordUsageEvent(tenantId, resource, amount) {
    try {
      const event = {
        timestamp: new Date().toISOString(),
        resource,
        amount
      };

      // Add to in-memory history
      if (!this.usageHistory.has(tenantId)) {
        this.usageHistory.set(tenantId, []);
      }
      
      const history = this.usageHistory.get(tenantId);
      history.push(event);
      
      // Keep only last 1000 events per tenant
      if (history.length > 1000) {
        history.shift();
      }

      // Periodically save to disk (every 100 events)
      if (history.length % 100 === 0) {
        await this.saveUsageHistory(tenantId);
      }
    } catch (error) {
      this.logger?.error('Error recording usage event:', error);
    }
  }

  /**
   * Save usage history to disk
   */
  async saveUsageHistory(tenantId) {
    try {
      const history = this.usageHistory.get(tenantId);
      if (!history) return;

      const historyFile = path.join(this.dataDir, `${tenantId}-usage.json`);
      await fs.writeFile(
        historyFile,
        JSON.stringify(history, null, 2),
        'utf8'
      );
    } catch (error) {
      this.logger?.error('Error saving usage history:', error);
    }
  }

  /**
   * Get tenant statistics
   */
  async getTenantStats(tenantId) {
    try {
      const tenantManager = this.core.getService('tenant-manager');
      const tenant = await tenantManager.getTenant(tenantId);
      
      if (!tenant) {
        throw new Error('Tenant not found');
      }

      const resourceLimiter = this.core.getService('resource-limiter');
      
      // Calculate usage percentages
      const stats = {
        tenant: {
          id: tenant.id,
          name: tenant.name,
          status: tenant.status
        },
        usage: {},
        limits: {},
        percentages: {},
        warnings: []
      };

      // Get usage for each resource
      const resources = Object.keys(tenant.limits || {});
      
      for (const resource of resources) {
        stats.usage[resource] = tenant.usage?.[resource] || 0;
        stats.limits[resource] = tenant.limits?.[resource];
        
        if (resourceLimiter) {
          stats.percentages[resource] = await resourceLimiter.getUsagePercentage(
            tenantId,
            resource
          );
        }
      }

      // Get warnings
      if (resourceLimiter) {
        stats.warnings = await resourceLimiter.checkLimitWarnings(tenantId);
      }

      // Get usage trends (last 24 hours)
      stats.trends = await this.getUsageTrends(tenantId, 24);

      return stats;
    } catch (error) {
      this.logger?.error('Error getting tenant stats:', error);
      throw error;
    }
  }

  /**
   * Get usage trends over time
   */
  async getUsageTrends(tenantId, hours = 24) {
    try {
      const history = this.usageHistory.get(tenantId) || [];
      const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
      
      // Filter events within time window
      const recentEvents = history.filter(event => 
        new Date(event.timestamp) >= cutoff
      );

      // Group by resource
      const trends = {};
      
      recentEvents.forEach(event => {
        if (!trends[event.resource]) {
          trends[event.resource] = {
            total: 0,
            count: 0,
            events: []
          };
        }
        
        trends[event.resource].total += event.amount;
        trends[event.resource].count += 1;
        trends[event.resource].events.push({
          timestamp: event.timestamp,
          amount: event.amount
        });
      });

      // Calculate averages
      Object.keys(trends).forEach(resource => {
        trends[resource].average = trends[resource].total / trends[resource].count;
      });

      return trends;
    } catch (error) {
      this.logger?.error('Error getting usage trends:', error);
      return {};
    }
  }

  /**
   * Reset usage for a resource (e.g., monthly reset for API calls)
   */
  async resetUsage(tenantId, resource) {
    try {
      const tenantManager = this.core.getService('tenant-manager');
      const tenant = await tenantManager.getTenant(tenantId);
      
      if (!tenant) {
        throw new Error('Tenant not found');
      }

      // Reset to 0 or appropriate default
      if (resource === 'storage') {
        tenant.usage[resource] = '0B';
      } else {
        tenant.usage[resource] = 0;
      }

      await tenantManager.updateTenant(tenantId, {
        usage: tenant.usage
      });

      this.logger?.info(`Reset ${resource} usage for tenant ${tenant.name}`);
      return true;
    } catch (error) {
      this.logger?.error('Error resetting usage:', error);
      throw error;
    }
  }

  /**
   * Middleware to track API request usage
   */
  trackApiUsage() {
    return async (req, res, next) => {
      const tenantId = req.tenantId || req.tenant?.id;
      
      if (tenantId) {
        // Track after response is sent
        res.on('finish', async () => {
          try {
            await this.trackUsage(tenantId, 'apiRequests', 1);
          } catch (error) {
            this.logger?.error('Error tracking API usage:', error);
          }
        });
      }
      
      next();
    };
  }

  /**
   * Get all tenants approaching limits
   */
  async getTenantsApproachingLimits(threshold = 80) {
    try {
      const tenantManager = this.core.getService('tenant-manager');
      const tenants = await tenantManager.listTenants({ status: 'active' });
      
      const approaching = [];
      
      for (const tenant of tenants) {
        const stats = await this.getTenantStats(tenant.id);
        
        if (stats.warnings.length > 0) {
          approaching.push({
            tenant: stats.tenant,
            warnings: stats.warnings
          });
        }
      }
      
      return approaching;
    } catch (error) {
      this.logger?.error('Error getting tenants approaching limits:', error);
      return [];
    }
  }

  /**
   * Generate usage report for tenant
   */
  async generateUsageReport(tenantId, period = 'month') {
    try {
      const hours = {
        'day': 24,
        'week': 24 * 7,
        'month': 24 * 30,
        'year': 24 * 365
      }[period] || 24 * 30;

      const stats = await this.getTenantStats(tenantId);
      const trends = await this.getUsageTrends(tenantId, hours);
      
      return {
        period,
        generatedAt: new Date().toISOString(),
        tenant: stats.tenant,
        currentUsage: stats.usage,
        limits: stats.limits,
        percentages: stats.percentages,
        trends,
        warnings: stats.warnings,
        summary: {
          totalResources: Object.keys(stats.usage).length,
          resourcesAtLimit: stats.warnings.filter(w => w.severity === 'critical').length,
          resourcesNearLimit: stats.warnings.filter(w => w.severity === 'warning').length
        }
      };
    } catch (error) {
      this.logger?.error('Error generating usage report:', error);
      throw error;
    }
  }
}

module.exports = UsageTracker;
