/**
 * Integrations Manager
 * Handles Slack, Discord, Teams notifications and other integrations
 */

const fs = require('fs').promises;
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const platform = require('./platform');
const { logger } = require('./logger');

const execFileAsync = promisify(execFile);

class IntegrationsManager {
  constructor() {
    this.configDir = platform.getConfigDir();
    this.configFile = path.join(this.configDir, 'integrations.conf');
    this.integrations = {};
    this.initialized = false;
  }
  
  /**
   * Initialize integrations
   */
  async init() {
    if (this.initialized) return;
    
    try {
      // Ensure config directory exists
      await fs.mkdir(this.configDir, { recursive: true });
      
      // Load configuration
      await this.loadConfig();
      
      this.initialized = true;
      logger.info('Integrations manager initialized');
      
    } catch (err) {
      logger.error('Failed to initialize integrations:', err);
      throw err;
    }
  }
  
  /**
   * Load integration configuration
   */
  async loadConfig() {
    try {
      const content = await fs.readFile(this.configFile, 'utf8');
      const lines = content.split('\n');
      
      for (const line of lines) {
        // Skip comments and empty lines
        if (line.trim().startsWith('#') || !line.trim()) continue;
        
        // Parse KEY=VALUE
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim();
          this.integrations[key.trim()] = value;
        }
      }
      
      logger.debug('Loaded integrations config:', Object.keys(this.integrations));
      
    } catch (err) {
      if (err.code === 'ENOENT') {
        logger.info('No integrations config found, using defaults');
        this.integrations = {};
      } else {
        logger.error('Error loading integrations config:', err);
        throw err;
      }
    }
  }
  
  /**
   * Save integration configuration
   */
  async saveConfig() {
    try {
      const lines = [
        '# AI Security Scanner - Integrations Configuration',
        '# Generated: ' + new Date().toISOString(),
        ''
      ];
      
      for (const [key, value] of Object.entries(this.integrations)) {
        lines.push(`${key}=${value}`);
      }
      
      await fs.writeFile(this.configFile, lines.join('\n'), 'utf8');
      logger.info('Saved integrations config');
      
    } catch (err) {
      logger.error('Error saving integrations config:', err);
      throw err;
    }
  }
  
  /**
   * Set integration value
   */
  async set(key, value) {
    this.integrations[key] = value;
    await this.saveConfig();
  }
  
  /**
   * Get integration value
   */
  get(key, defaultValue = null) {
    return this.integrations[key] || defaultValue;
  }
  
  /**
   * Check if integration is configured
   */
  isConfigured(integration) {
    switch (integration.toLowerCase()) {
      case 'slack':
        return !!this.integrations.SLACK_WEBHOOK_URL;
        
      case 'discord':
        return !!this.integrations.DISCORD_WEBHOOK_URL;
        
      case 'teams':
        return !!this.integrations.TEAMS_WEBHOOK_URL;
        
      case 'email':
        return !!this.integrations.EMAIL_TO;
        
      default:
        return false;
    }
  }
  
  /**
   * Send notification to configured integrations
   */
  async notify(message, options = {}) {
    const {
      title = 'AI Security Scanner Alert',
      severity = 'info',
      channels = ['all']
    } = options;
    
    const results = [];
    
    // Determine which channels to use
    const targetChannels = channels.includes('all') 
      ? ['slack', 'discord', 'teams', 'email']
      : channels;
    
    // Send to each configured channel
    for (const channel of targetChannels) {
      if (this.isConfigured(channel)) {
        try {
          const result = await this.sendToChannel(channel, title, message, severity);
          results.push({ channel, success: true, result });
          logger.info(`Notification sent to ${channel}`);
        } catch (err) {
          results.push({ channel, success: false, error: err.message });
          logger.error(`Failed to send notification to ${channel}:`, err);
        }
      }
    }
    
    return results;
  }
  
  /**
   * Send to specific channel
   */
  async sendToChannel(channel, title, message, severity) {
    const rootDir = path.join(__dirname, '../..');
    const notifyScript = platform.getScriptPath('integrations/notify.sh');
    
    // Format message based on severity
    const icon = this.getSeverityIcon(severity);
    const fullMessage = `${icon} ${title}\n\n${message}`;
    
    // Use the existing notify.sh script
    try {
      if (platform.isWindows()) {
        // On Windows, we'd need a PowerShell version or call the bash script via WSL
        // For now, use direct HTTP for webhooks
        return await this.sendWebhook(channel, title, message, severity);
      } else {
        // On Unix, use the existing bash script
        const { stdout, stderr } = await execFileAsync(
          '/bin/bash',
          [notifyScript, channel.toUpperCase(), title, fullMessage],
          { timeout: 30000 }
        );
        
        return { stdout, stderr };
      }
    } catch (err) {
      // Fallback to direct webhook
      return await this.sendWebhook(channel, title, message, severity);
    }
  }
  
  /**
   * Send webhook directly (cross-platform)
   */
  async sendWebhook(channel, title, message, severity) {
    const webhookUrl = this.getWebhookUrl(channel);
    if (!webhookUrl) {
      throw new Error(`No webhook URL configured for ${channel}`);
    }
    
    const payload = this.formatWebhookPayload(channel, title, message, severity);
    
    // Use native fetch or https module
    const https = require('https');
    const url = new URL(webhookUrl);
    
    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, (res) => {
        let data = '';
        
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ statusCode: res.statusCode, body: data });
          } else {
            reject(new Error(`Webhook failed with status ${res.statusCode}: ${data}`));
          }
        });
      });
      
      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }
  
  /**
   * Get webhook URL for channel
   */
  getWebhookUrl(channel) {
    switch (channel.toLowerCase()) {
      case 'slack':
        return this.integrations.SLACK_WEBHOOK_URL;
      case 'discord':
        return this.integrations.DISCORD_WEBHOOK_URL;
      case 'teams':
        return this.integrations.TEAMS_WEBHOOK_URL;
      default:
        return null;
    }
  }
  
  /**
   * Format webhook payload for specific platform
   */
  formatWebhookPayload(channel, title, message, severity) {
    const color = this.getSeverityColor(severity);
    const icon = this.getSeverityIcon(severity);
    
    switch (channel.toLowerCase()) {
      case 'slack':
        return JSON.stringify({
          text: `${icon} *${title}*`,
          attachments: [{
            color: color,
            text: message,
            footer: 'AI Security Scanner',
            ts: Math.floor(Date.now() / 1000)
          }]
        });
        
      case 'discord':
        return JSON.stringify({
          embeds: [{
            title: `${icon} ${title}`,
            description: message,
            color: parseInt(color.replace('#', ''), 16),
            footer: { text: 'AI Security Scanner' },
            timestamp: new Date().toISOString()
          }]
        });
        
      case 'teams':
        return JSON.stringify({
          '@type': 'MessageCard',
          '@context': 'https://schema.org/extensions',
          summary: title,
          themeColor: color,
          title: `${icon} ${title}`,
          text: message,
          sections: [{
            activityTitle: 'AI Security Scanner',
            activitySubtitle: new Date().toISOString()
          }]
        });
        
      default:
        return JSON.stringify({ title, message });
    }
  }
  
  /**
   * Get severity icon
   */
  getSeverityIcon(severity) {
    switch (severity.toLowerCase()) {
      case 'critical':
        return '🔴';
      case 'high':
        return '🟠';
      case 'medium':
        return '🟡';
      case 'low':
        return '🔵';
      case 'info':
        return 'ℹ️';
      case 'success':
        return '✅';
      default:
        return '📢';
    }
  }
  
  /**
   * Get severity color
   */
  getSeverityColor(severity) {
    switch (severity.toLowerCase()) {
      case 'critical':
        return '#DC143C';
      case 'high':
        return '#FF8C00';
      case 'medium':
        return '#FFD700';
      case 'low':
        return '#4169E1';
      case 'info':
        return '#808080';
      case 'success':
        return '#32CD32';
      default:
        return '#000000';
    }
  }
  
  /**
   * Test integration
   */
  async test(channel) {
    return await this.notify(
      `This is a test notification from AI Security Scanner`,
      {
        title: 'Integration Test',
        severity: 'info',
        channels: [channel]
      }
    );
  }
  
  /**
   * Get integration status
   */
  getStatus() {
    return {
      slack: this.isConfigured('slack'),
      discord: this.isConfigured('discord'),
      teams: this.isConfigured('teams'),
      email: this.isConfigured('email'),
      total: Object.keys(this.integrations).length
    };
  }
}

// Export singleton instance
module.exports = new IntegrationsManager();
