/**
 * Notifications Plugin - Delivery Manager Service
 * Handles actual delivery of notifications to various channels
 */

const https = require('https');
const http = require('http');
const nodemailer = require('nodemailer');
const { logger } = require('../../shared/logger');

class DeliveryManager {
  constructor(channelManager) {
    this.channelManager = channelManager;
    this.logger = logger;
    this.emailTransporters = new Map();
  }

  /**
   * Send notification to a channel
   */
  async sendToChannel(tenantId, channelId, notification) {
    try {
      const channel = await this.channelManager.getChannel(tenantId, channelId);
      
      if (!channel.enabled) {
        throw new Error('Channel is disabled');
      }

      let result;
      switch (channel.type) {
        case 'slack':
          result = await this.sendToSlack(channel, notification);
          break;
        case 'discord':
          result = await this.sendToDiscord(channel, notification);
          break;
        case 'email':
          result = await this.sendToEmail(channel, notification);
          break;
        case 'teams':
          result = await this.sendToTeams(channel, notification);
          break;
        case 'webhook':
          result = await this.sendToWebhook(channel, notification);
          break;
        default:
          throw new Error(`Unsupported channel type: ${channel.type}`);
      }

      // Update success stats
      await this.channelManager.updateChannelStats(tenantId, channelId, true);

      return { success: true, channel: channel.name, ...result };

    } catch (error) {
      // Update failure stats
      await this.channelManager.updateChannelStats(tenantId, channelId, false);
      
      this.logger.error(`[DeliveryManager] Failed to send to channel ${channelId}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send to Slack
   */
  async sendToSlack(channel, notification) {
    const { subject, message, priority } = notification;
    const config = channel.config;

    const payload = {
      text: subject,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: subject
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: message
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Priority: *${priority}* | ${new Date().toISOString()}`
            }
          ]
        }
      ]
    };

    // Add color based on priority
    if (priority === 'critical') {
      payload.attachments = [{ color: '#ff0000' }];
    } else if (priority === 'high') {
      payload.attachments = [{ color: '#ff6600' }];
    } else if (priority === 'medium') {
      payload.attachments = [{ color: '#ffcc00' }];
    }

    const url = config.webhook_url;
    return await this.sendHttpPost(url, payload);
  }

  /**
   * Send to Discord
   */
  async sendToDiscord(channel, notification) {
    const { subject, message, priority } = notification;
    const config = channel.config;

    // Color based on priority
    let color = 0x3498db; // blue (default)
    if (priority === 'critical') color = 0xff0000; // red
    else if (priority === 'high') color = 0xff6600; // orange
    else if (priority === 'medium') color = 0xffcc00; // yellow

    const payload = {
      embeds: [{
        title: subject,
        description: message,
        color: color,
        timestamp: new Date().toISOString(),
        footer: {
          text: `Priority: ${priority}`
        }
      }]
    };

    const url = config.webhook_url;
    return await this.sendHttpPost(url, payload);
  }

  /**
   * Send to Email
   */
  async sendToEmail(channel, notification) {
    const { subject, message, priority } = notification;
    const config = channel.config;

    // Get or create transporter
    const transporterKey = `${config.smtp_host}:${config.smtp_port}`;
    let transporter = this.emailTransporters.get(transporterKey);

    if (!transporter) {
      transporter = nodemailer.createTransporter({
        host: config.smtp_host,
        port: config.smtp_port,
        secure: config.smtp_secure !== false, // true for 465, false for other ports
        auth: config.smtp_user ? {
          user: config.smtp_user,
          pass: config.smtp_pass
        } : undefined
      });
      this.emailTransporters.set(transporterKey, transporter);
    }

    // Build HTML email
    const html = this.buildEmailHtml(subject, message, priority);

    // Send email
    const info = await transporter.sendMail({
      from: config.from,
      to: config.recipients.join(', '),
      subject: `[${priority.toUpperCase()}] ${subject}`,
      text: message,
      html: html
    });

    return { messageId: info.messageId };
  }

  /**
   * Send to Microsoft Teams
   */
  async sendToTeams(channel, notification) {
    const { subject, message, priority } = notification;
    const config = channel.config;

    // Color based on priority
    let themeColor = '0078D4'; // blue (default)
    if (priority === 'critical') themeColor = 'FF0000'; // red
    else if (priority === 'high') themeColor = 'FF6600'; // orange
    else if (priority === 'medium') themeColor = 'FFCC00'; // yellow

    const payload = {
      '@type': 'MessageCard',
      '@context': 'https://schema.org/extensions',
      summary: subject,
      themeColor: themeColor,
      title: subject,
      sections: [{
        activityTitle: `Priority: ${priority}`,
        activitySubtitle: new Date().toISOString(),
        text: message
      }]
    };

    const url = config.webhook_url;
    return await this.sendHttpPost(url, payload);
  }

  /**
   * Send to custom webhook
   */
  async sendToWebhook(channel, notification) {
    const config = channel.config;
    
    const payload = {
      event: 'notification',
      timestamp: new Date().toISOString(),
      notification: notification
    };

    // Add custom headers if specified
    const headers = {
      'Content-Type': 'application/json',
      ...config.headers
    };

    return await this.sendHttpPost(config.url, payload, headers);
  }

  /**
   * Send HTTP POST request
   */
  async sendHttpPost(url, payload, customHeaders = {}) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const protocol = urlObj.protocol === 'https:' ? https : http;

      const postData = JSON.stringify(payload);

      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          ...customHeaders
        }
      };

      const req = protocol.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ statusCode: res.statusCode, response: data });
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * Build HTML email template
   */
  buildEmailHtml(subject, message, priority) {
    const priorityColors = {
      critical: '#ff0000',
      high: '#ff6600',
      medium: '#ffcc00',
      low: '#3498db'
    };

    const color = priorityColors[priority] || '#3498db';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: ${color}; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
          .footer { background-color: #333; color: white; padding: 10px; text-align: center; font-size: 12px; }
          .priority { display: inline-block; padding: 5px 10px; background-color: ${color}; color: white; border-radius: 3px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>${subject}</h2>
          </div>
          <div class="content">
            <p><span class="priority">${priority.toUpperCase()}</span></p>
            <p>${message.replace(/\n/g, '<br>')}</p>
            <p><small>Sent: ${new Date().toLocaleString()}</small></p>
          </div>
          <div class="footer">
            AI Security Scanner - Automated Notification
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Test channel delivery
   */
  async testChannel(tenantId, channelId) {
    const testNotification = {
      subject: 'Test Notification',
      message: 'This is a test notification from AI Security Scanner. If you receive this, your channel is configured correctly!',
      priority: 'low',
      type: 'test'
    };

    return await this.sendToChannel(tenantId, channelId, testNotification);
  }

  /**
   * Send to multiple channels
   */
  async sendToChannels(tenantId, channelIds, notification) {
    const results = [];

    for (const channelId of channelIds) {
      const result = await this.sendToChannel(tenantId, channelId, notification);
      results.push({
        channelId,
        ...result
      });
    }

    return results;
  }
}

module.exports = DeliveryManager;
