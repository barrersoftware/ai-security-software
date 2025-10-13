/**
 * Intrusion Detection System Service
 * Monitor and block suspicious activity
 */

const fs = require('fs').promises;
const path = require('path');

class IDSService {
  constructor(core) {
    this.core = core;
    this.logger = core.getService('logger');
    this.integrations = core.getService('integrations');
    
    this.idsFile = path.join(core.getConfig('paths.data'), 'ids.json');
    this.data = {
      blockedIPs: [],
      failedAttempts: {},
      suspiciousActivity: []
    };
    
    this.config = {
      maxAttempts: 5,
      lockoutDuration: 15 * 60 * 1000, // 15 minutes
      windowDuration: 5 * 60 * 1000 // 5 minutes
    };
  }
  
  async init() {
    try {
      const data = await fs.readFile(this.idsFile, 'utf8');
      this.data = JSON.parse(data);
    } catch (err) {
      if (err.code === 'ENOENT') {
        await this.save();
      }
    }
    
    // Clean up old data every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
    
    this.logger.info('IDS service initialized');
  }
  
  async save() {
    await fs.writeFile(this.idsFile, JSON.stringify(this.data, null, 2));
  }
  
  async isBlocked(ipAddress) {
    const blocked = this.data.blockedIPs.find(b => 
      b.ip === ipAddress && new Date(b.expiresAt) > new Date()
    );
    
    return !!blocked;
  }
  
  async recordFailedAttempt(ipAddress, username) {
    const now = Date.now();
    const key = `${ipAddress}:${username}`;
    
    if (!this.data.failedAttempts[key]) {
      this.data.failedAttempts[key] = [];
    }
    
    // Add attempt
    this.data.failedAttempts[key].push({
      timestamp: now,
      ipAddress,
      username
    });
    
    // Filter recent attempts (within window)
    this.data.failedAttempts[key] = this.data.failedAttempts[key].filter(
      a => now - a.timestamp < this.config.windowDuration
    );
    
    // Check if should block
    if (this.data.failedAttempts[key].length >= this.config.maxAttempts) {
      await this.blockIP(ipAddress, `Too many failed login attempts for ${username}`);
    }
    
    await this.save();
  }
  
  async recordSuccessfulLogin(ipAddress, username) {
    // Clear failed attempts on successful login
    const key = `${ipAddress}:${username}`;
    delete this.data.failedAttempts[key];
    await this.save();
  }
  
  async blockIP(ipAddress, reason) {
    const expiresAt = new Date(Date.now() + this.config.lockoutDuration);
    
    this.data.blockedIPs.push({
      ip: ipAddress,
      reason,
      blockedAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString()
    });
    
    this.logger.warn(`IP blocked: ${ipAddress} - ${reason}`);
    
    // Send notification
    try {
      await this.integrations.notify(
        `IP address ${ipAddress} has been blocked due to: ${reason}`,
        {
          title: 'Security Alert - IP Blocked',
          severity: 'high',
          channels: ['all']
        }
      );
    } catch (err) {
      this.logger.error('Failed to send IDS notification:', err);
    }
    
    await this.save();
  }
  
  async unblockIP(ipAddress) {
    this.data.blockedIPs = this.data.blockedIPs.filter(b => b.ip !== ipAddress);
    await this.save();
    
    this.logger.info(`IP unblocked: ${ipAddress}`);
  }
  
  async getStatus() {
    const activeBlocks = this.data.blockedIPs.filter(b => 
      new Date(b.expiresAt) > new Date()
    );
    
    const recentAttempts = Object.values(this.data.failedAttempts).reduce(
      (sum, attempts) => sum + attempts.length, 0
    );
    
    return {
      blockedIPs: activeBlocks.length,
      activeBlocks,
      recentFailedAttempts: recentAttempts,
      suspiciousActivity: this.data.suspiciousActivity.length
    };
  }
  
  async cleanup() {
    const now = new Date();
    
    // Remove expired blocks
    this.data.blockedIPs = this.data.blockedIPs.filter(b => 
      new Date(b.expiresAt) > now
    );
    
    // Remove old failed attempts
    const windowStart = Date.now() - this.config.windowDuration;
    for (const key in this.data.failedAttempts) {
      this.data.failedAttempts[key] = this.data.failedAttempts[key].filter(
        a => a.timestamp > windowStart
      );
      
      if (this.data.failedAttempts[key].length === 0) {
        delete this.data.failedAttempts[key];
      }
    }
    
    await this.save();
  }
}

module.exports = IDSService;
