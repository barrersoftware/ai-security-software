/**
 * API Analytics Service
 * Provides analytics and insights on API usage
 */

class ApiAnalytics {
  constructor(core) {
    this.core = core;
    this.logger = core.getService('logger');
    this.apiTracker = null;
  }

  async init() {
    // API tracker will be set after it's registered
    // We'll get it lazily when needed
    
    this.logger?.info('API Analytics initialized');
  }
  
  /**
   * Get API tracker (lazy loading)
   */
  getApiTracker() {
    if (!this.apiTracker) {
      this.apiTracker = this.core.getService('api-tracker');
    }
    return this.apiTracker;
  }

  /**
   * Get tenant's API usage summary
   */
  async getTenantUsage(tenantId) {
    const usageTracker = this.core.getService('usage-tracker');
    const tenantManager = this.core.getService('tenant-manager');
    
    // Get current usage from usage tracker
    const stats = await usageTracker?.getTenantStats(tenantId);
    
    // Get detailed stats from API tracker
    const trackerStats = this.getApiTracker().getStatistics(tenantId);
    const endpointStats = this.getApiTracker().getRequestsByEndpoint(tenantId);
    const userStats = this.getApiTracker().getRequestsByUser(tenantId);
    
    // Get tenant info
    const tenant = await tenantManager?.getTenant(tenantId);
    
    return {
      tenantId,
      tenantName: tenant?.name || 'Unknown',
      usage: {
        current: stats?.usage?.apiRequests || 0,
        limit: stats?.limits?.apiRequests || 0,
        percentage: stats?.percentages?.apiRequests || 0
      },
      statistics: trackerStats,
      topEndpoints: endpointStats.slice(0, 10),
      topUsers: userStats.slice(0, 10),
      warnings: stats?.warnings?.filter(w => w.resource === 'apiRequests') || []
    };
  }

  /**
   * Get endpoint statistics
   */
  async getEndpointStats(tenantId, timeRange = '24h') {
    const endpoints = this.getApiTracker().getRequestsByEndpoint(tenantId);
    
    return {
      timeRange,
      totalEndpoints: endpoints.length,
      endpoints: endpoints.map(e => ({
        method: e.method,
        path: e.path,
        requests: e.count,
        successRate: ((e.successCount / e.count) * 100).toFixed(2) + '%',
        errorRate: ((e.errorCount / e.count) * 100).toFixed(2) + '%',
        avgResponseTime: e.avgDuration + 'ms'
      }))
    };
  }

  /**
   * Get usage trends over time
   */
  async getUsageTrends(tenantId, timeRange = '7d', interval = '1h') {
    const requests = this.getApiTracker().getRecentRequests(tenantId, 1000);
    
    // Group by time interval
    const trends = this.groupByTimeInterval(requests, interval);
    
    return {
      tenantId,
      timeRange,
      interval,
      dataPoints: trends
    };
  }

  /**
   * Group requests by time interval
   */
  groupByTimeInterval(requests, interval) {
    const intervalMs = this.parseInterval(interval);
    const groups = {};
    
    for (const req of requests) {
      const timestamp = new Date(req.timestamp).getTime();
      const bucket = Math.floor(timestamp / intervalMs) * intervalMs;
      const key = new Date(bucket).toISOString();
      
      if (!groups[key]) {
        groups[key] = {
          timestamp: key,
          count: 0,
          success: 0,
          error: 0,
          avgDuration: 0,
          totalDuration: 0
        };
      }
      
      groups[key].count++;
      if (req.success) groups[key].success++;
      if (req.error) groups[key].error++;
      groups[key].totalDuration += req.duration;
    }
    
    // Calculate averages
    for (const group of Object.values(groups)) {
      group.avgDuration = Math.round(group.totalDuration / group.count);
      delete group.totalDuration;
    }
    
    return Object.values(groups).sort((a, b) => 
      new Date(a.timestamp) - new Date(b.timestamp)
    );
  }

  /**
   * Parse interval string to milliseconds
   */
  parseInterval(interval) {
    const matches = interval.match(/^(\d+)(m|h|d)$/);
    if (!matches) return 60 * 60 * 1000; // Default 1 hour
    
    const value = parseInt(matches[1]);
    const unit = matches[2];
    
    switch (unit) {
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 60 * 60 * 1000;
    }
  }

  /**
   * Get top users by API usage
   */
  async getTopUsers(tenantId, limit = 10, timeRange = '24h') {
    const userStats = this.getApiTracker().getRequestsByUser(tenantId);
    
    // Get user details
    const userManager = this.core.getService('user-manager');
    const enrichedUsers = [];
    
    for (const stat of userStats.slice(0, limit)) {
      let userInfo = { username: 'Unknown', email: 'N/A' };
      
      if (stat.userId && stat.userId !== 'anonymous' && userManager) {
        try {
          const user = await userManager.getUserById(stat.userId);
          if (user) {
            userInfo = {
              username: user.username,
              email: user.email
            };
          }
        } catch (error) {
          // User not found
        }
      }
      
      enrichedUsers.push({
        userId: stat.userId,
        username: userInfo.username,
        email: userInfo.email,
        requests: stat.count,
        successRate: ((stat.successCount / stat.count) * 100).toFixed(2) + '%',
        errorRate: ((stat.errorCount / stat.count) * 100).toFixed(2) + '%'
      });
    }
    
    return {
      tenantId,
      timeRange,
      topUsers: enrichedUsers
    };
  }

  /**
   * Get all tenants' usage (admin only)
   */
  async getAllTenantsUsage(timeRange = '24h') {
    const tenantManager = this.core.getService('tenant-manager');
    const tenants = await tenantManager?.listTenants() || [];
    
    const usage = [];
    
    for (const tenant of tenants) {
      const stats = this.getApiTracker().getTenantRequestCount(tenant.id);
      const usageTracker = this.core.getService('usage-tracker');
      const tenantStats = await usageTracker?.getTenantStats(tenant.id);
      
      usage.push({
        tenantId: tenant.id,
        tenantName: tenant.name,
        requests: stats.total,
        successRate: stats.total > 0 
          ? ((stats.success / stats.total) * 100).toFixed(2) + '%'
          : '0%',
        errorRate: stats.total > 0
          ? ((stats.error / stats.total) * 100).toFixed(2) + '%'
          : '0%',
        avgDuration: stats.total > 0
          ? Math.round(stats.totalDuration / stats.total) + 'ms'
          : '0ms',
        quota: {
          current: tenantStats?.usage?.apiRequests || 0,
          limit: tenantStats?.limits?.apiRequests || 0,
          percentage: tenantStats?.percentages?.apiRequests || 0
        }
      });
    }
    
    return {
      timeRange,
      totalTenants: usage.length,
      tenants: usage.sort((a, b) => b.requests - a.requests)
    };
  }

  /**
   * Get system-wide statistics (admin only)
   */
  async getSystemStats(timeRange = '24h') {
    const stats = this.getApiTracker().getStatistics();
    const allRequests = this.getApiTracker().getAllRecentRequests(10000);
    
    // Count unique tenants
    const uniqueTenants = new Set(allRequests.map(r => r.tenantId).filter(Boolean));
    
    // Count unique users
    const uniqueUsers = new Set(allRequests.map(r => r.userId).filter(Boolean));
    
    // Get slowest endpoints
    const endpointPerformance = {};
    for (const req of allRequests) {
      const key = `${req.method} ${req.path}`;
      if (!endpointPerformance[key]) {
        endpointPerformance[key] = {
          method: req.method,
          path: req.path,
          count: 0,
          totalDuration: 0,
          maxDuration: 0
        };
      }
      endpointPerformance[key].count++;
      endpointPerformance[key].totalDuration += req.duration;
      endpointPerformance[key].maxDuration = Math.max(
        endpointPerformance[key].maxDuration,
        req.duration
      );
    }
    
    const slowestEndpoints = Object.values(endpointPerformance)
      .map(e => ({
        method: e.method,
        path: e.path,
        avgDuration: Math.round(e.totalDuration / e.count),
        maxDuration: e.maxDuration,
        requests: e.count
      }))
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, 10);
    
    return {
      timeRange,
      overview: {
        totalRequests: stats.total,
        successfulRequests: stats.success,
        failedRequests: stats.error,
        successRate: stats.total > 0 
          ? ((stats.success / stats.total) * 100).toFixed(2) + '%'
          : '0%',
        avgResponseTime: stats.avgDuration + 'ms',
        minResponseTime: stats.minDuration + 'ms',
        maxResponseTime: stats.maxDuration + 'ms'
      },
      activity: {
        activeTenants: uniqueTenants.size,
        activeUsers: uniqueUsers.size
      },
      performance: {
        slowestEndpoints
      }
    };
  }
}

module.exports = ApiAnalytics;
