/**
 * System Info Plugin
 * Provides system information and platform detection
 * This is a test plugin to validate the core system
 */

const express = require('express');
const os = require('os');

module.exports = {
  name: 'system-info',
  version: '1.0.0',
  
  async init(core) {
    this.core = core;
    this.logger = core.getService('logger');
    this.platform = core.getService('platform');
    this.integrations = core.getService('integrations');
    this.utils = core.getService('utils');
    
    this.logger.info('System Info plugin initialized');
    this.logger.info('Detected platform: ' + (
      this.platform.details.isWindows ? 'Windows' :
      this.platform.details.isLinux ? 'Linux' :
      this.platform.details.isMacOS ? 'macOS' :
      this.platform.details.isBSD ? 'BSD' : 'Unknown'
    ));
  },
  
  routes() {
    const router = express.Router();
    
    // Get system information
    router.get('/api/system/info', (req, res) => {
      try {
        const info = this.platform.getSystemInfo();
        res.json({
          success: true,
          data: info
        });
      } catch (err) {
        this.logger.error('Error getting system info:', err);
        res.status(500).json({
          success: false,
          error: err.message
        });
      }
    });
    
    // Get platform details
    router.get('/api/system/platform', (req, res) => {
      try {
        res.json({
          success: true,
          data: {
            ...this.platform.details,
            scriptsDir: this.platform.getScriptsDir(),
            configDir: this.platform.getConfigDir(),
            dataDir: this.platform.getDataDir(),
            logsDir: this.platform.getLogsDir()
          }
        });
      } catch (err) {
        this.logger.error('Error getting platform info:', err);
        res.status(500).json({
          success: false,
          error: err.message
        });
      }
    });
    
    // Health check
    router.get('/api/system/health', (req, res) => {
      try {
        const info = os;
        const health = {
          status: 'healthy',
          uptime: process.uptime(),
          systemUptime: info.uptime(),
          memory: {
            total: info.totalmem(),
            free: info.freemem(),
            used: info.totalmem() - info.freemem(),
            percentUsed: ((info.totalmem() - info.freemem()) / info.totalmem() * 100).toFixed(2)
          },
          cpu: {
            count: info.cpus().length,
            model: info.cpus()[0]?.model || 'Unknown',
            loadAvg: info.loadavg()
          },
          platform: this.platform.details.platform,
          nodeVersion: process.version,
          timestamp: new Date().toISOString()
        };
        
        // Determine health status
        if (health.memory.percentUsed > 90) {
          health.status = 'warning';
          health.message = 'High memory usage';
        }
        
        res.json({
          success: true,
          data: health
        });
      } catch (err) {
        this.logger.error('Error checking health:', err);
        res.status(500).json({
          success: false,
          error: err.message
        });
      }
    });
    
    // Test integrations
    router.post('/api/system/test-notification', async (req, res) => {
      try {
        const { channel = 'all', message = 'Test notification' } = req.body;
        
        const result = await this.integrations.notify(message, {
          title: 'System Test',
          severity: 'info',
          channels: channel === 'all' ? ['all'] : [channel]
        });
        
        res.json({
          success: true,
          data: result
        });
      } catch (err) {
        this.logger.error('Error sending test notification:', err);
        res.status(500).json({
          success: false,
          error: err.message
        });
      }
    });
    
    // Get integrations status
    router.get('/api/system/integrations', (req, res) => {
      try {
        const status = this.integrations.getStatus();
        res.json({
          success: true,
          data: status
        });
      } catch (err) {
        this.logger.error('Error getting integrations status:', err);
        res.status(500).json({
          success: false,
          error: err.message
        });
      }
    });
    
    return router;
  },
  
  services() {
    return {
      systemInfo: {
        getInfo: () => this.platform.getSystemInfo(),
        getPlatform: () => this.platform.details,
        isWindows: () => this.platform.isWindows(),
        isLinux: () => this.platform.isLinux(),
        isMacOS: () => this.platform.isMacOS(),
        getScriptsDir: () => this.platform.getScriptsDir(),
        executeScript: (script, args, options) => 
          this.platform.executeScript(script, args, options)
      }
    };
  },
  
  async destroy() {
    this.logger.info('System Info plugin destroyed');
  }
};
