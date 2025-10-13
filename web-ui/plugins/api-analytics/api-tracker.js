/**
 * API Tracker Service
 * Records all API requests with detailed metadata
 */

const fs = require('fs').promises;
const path = require('path');

class ApiTracker {
  constructor(core) {
    this.core = core;
    this.logger = core.getService('logger');
    
    // In-memory storage for recent requests (last 1000)
    this.recentRequests = [];
    this.maxRecentRequests = 1000;
    
    // Request counters per tenant
    this.tenantCounters = new Map();
    
    // Storage path
    this.dataDir = path.join(process.cwd(), 'data', 'api-analytics');
  }

  async init() {
    // Create data directory
    await fs.mkdir(this.dataDir, { recursive: true });
    
    // Load recent data if exists
    await this.loadRecentData();
    
    // Start periodic flush
    this.startPeriodicFlush();
    
    this.logger?.info('API Tracker initialized');
  }

  /**
   * Track an API request
   */
  async trackRequest(requestData) {
    const {
      tenantId,
      userId,
      method,
      path,
      statusCode,
      duration,
      timestamp,
      userAgent,
      ip
    } = requestData;

    // Create request record
    const record = {
      id: this.generateId(),
      tenantId,
      userId,
      method,
      path,
      statusCode,
      duration,
      timestamp,
      userAgent,
      ip,
      success: statusCode >= 200 && statusCode < 300,
      error: statusCode >= 400
    };

    // Add to recent requests
    this.recentRequests.push(record);
    if (this.recentRequests.length > this.maxRecentRequests) {
      this.recentRequests.shift(); // Remove oldest
    }

    // Update tenant counter
    if (tenantId) {
      const counter = this.tenantCounters.get(tenantId) || {
        total: 0,
        success: 0,
        error: 0,
        totalDuration: 0
      };
      
      counter.total++;
      if (record.success) counter.success++;
      if (record.error) counter.error++;
      counter.totalDuration += duration;
      
      this.tenantCounters.set(tenantId, counter);
    }

    return record;
  }

  /**
   * Get recent requests for a tenant
   */
  getRecentRequests(tenantId, limit = 100) {
    return this.recentRequests
      .filter(r => r.tenantId === tenantId)
      .slice(-limit)
      .reverse();
  }

  /**
   * Get all recent requests (admin only)
   */
  getAllRecentRequests(limit = 100) {
    return this.recentRequests
      .slice(-limit)
      .reverse();
  }

  /**
   * Get request count for tenant
   */
  getTenantRequestCount(tenantId) {
    return this.tenantCounters.get(tenantId) || {
      total: 0,
      success: 0,
      error: 0,
      totalDuration: 0
    };
  }

  /**
   * Get requests by endpoint
   */
  getRequestsByEndpoint(tenantId) {
    const requests = this.recentRequests.filter(r => r.tenantId === tenantId);
    const endpoints = {};

    for (const req of requests) {
      const key = `${req.method} ${req.path}`;
      if (!endpoints[key]) {
        endpoints[key] = {
          method: req.method,
          path: req.path,
          count: 0,
          successCount: 0,
          errorCount: 0,
          totalDuration: 0,
          avgDuration: 0
        };
      }
      
      endpoints[key].count++;
      if (req.success) endpoints[key].successCount++;
      if (req.error) endpoints[key].errorCount++;
      endpoints[key].totalDuration += req.duration;
    }

    // Calculate averages
    for (const endpoint of Object.values(endpoints)) {
      endpoint.avgDuration = Math.round(endpoint.totalDuration / endpoint.count);
    }

    return Object.values(endpoints)
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Get requests by user
   */
  getRequestsByUser(tenantId) {
    const requests = this.recentRequests.filter(r => r.tenantId === tenantId);
    const users = {};

    for (const req of requests) {
      const userId = req.userId || 'anonymous';
      if (!users[userId]) {
        users[userId] = {
          userId,
          count: 0,
          successCount: 0,
          errorCount: 0
        };
      }
      
      users[userId].count++;
      if (req.success) users[userId].successCount++;
      if (req.error) users[userId].errorCount++;
    }

    return Object.values(users)
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Get request statistics
   */
  getStatistics(tenantId = null) {
    const requests = tenantId 
      ? this.recentRequests.filter(r => r.tenantId === tenantId)
      : this.recentRequests;

    if (requests.length === 0) {
      return {
        total: 0,
        success: 0,
        error: 0,
        avgDuration: 0,
        minDuration: 0,
        maxDuration: 0
      };
    }

    const durations = requests.map(r => r.duration);
    
    return {
      total: requests.length,
      success: requests.filter(r => r.success).length,
      error: requests.filter(r => r.error).length,
      avgDuration: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations)
    };
  }

  /**
   * Clear old data
   */
  clearOldData(maxAge = 7 * 24 * 60 * 60 * 1000) { // 7 days default
    const cutoff = Date.now() - maxAge;
    this.recentRequests = this.recentRequests.filter(r => {
      return new Date(r.timestamp).getTime() > cutoff;
    });
  }

  /**
   * Periodic flush to disk
   */
  startPeriodicFlush() {
    // Flush every 5 minutes
    this.flushInterval = setInterval(() => {
      this.flushToDisk().catch(error => {
        this.logger?.error('Error flushing API tracker data:', error);
      });
    }, 5 * 60 * 1000);
  }

  /**
   * Flush data to disk
   */
  async flushToDisk() {
    try {
      const date = new Date().toISOString().split('T')[0];
      const filepath = path.join(this.dataDir, `requests-${date}.json`);
      
      // Append to daily file
      const existingData = await this.loadDailyFile(filepath);
      const newData = [...existingData, ...this.recentRequests];
      
      await fs.writeFile(filepath, JSON.stringify(newData, null, 2));
      
      this.logger?.debug(`Flushed ${this.recentRequests.length} requests to ${filepath}`);
    } catch (error) {
      this.logger?.error('Error flushing to disk:', error);
    }
  }

  /**
   * Load daily file
   */
  async loadDailyFile(filepath) {
    try {
      const content = await fs.readFile(filepath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      return [];
    }
  }

  /**
   * Load recent data on startup
   */
  async loadRecentData() {
    try {
      const files = await fs.readdir(this.dataDir);
      const recentFile = files
        .filter(f => f.startsWith('requests-'))
        .sort()
        .pop();
      
      if (recentFile) {
        const filepath = path.join(this.dataDir, recentFile);
        const data = await this.loadDailyFile(filepath);
        this.recentRequests = data.slice(-this.maxRecentRequests);
        this.logger?.info(`Loaded ${this.recentRequests.length} recent requests`);
      }
    } catch (error) {
      this.logger?.error('Error loading recent data:', error);
    }
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup on shutdown
   */
  async cleanup() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    await this.flushToDisk();
  }
}

module.exports = ApiTracker;
