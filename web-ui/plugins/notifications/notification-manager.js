/**
 * Notifications Plugin - Notification Manager Service
 * Central hub for managing and sending notifications
 */

const { v4: uuidv4 } = require('uuid');
const { logger } = require('../../shared/logger');

class NotificationManager {
  constructor(db, channelManager, deliveryManager) {
    this.db = db;
    this.channelManager = channelManager;
    this.deliveryManager = deliveryManager;
    this.logger = logger;
    this.throttleCache = new Map();
  }

  /**
   * Initialize database tables
   */
  async init() {
    this.logger.info('[NotificationManager] Initializing...');

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS notification_history (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        channel_ids TEXT NOT NULL,
        type TEXT,
        priority TEXT,
        subject TEXT,
        message TEXT,
        status TEXT,
        sent_at DATETIME,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON notification_history(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_type ON notification_history(type);
      CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notification_history(priority);
      CREATE INDEX IF NOT EXISTS idx_notifications_status ON notification_history(status);
      CREATE INDEX IF NOT EXISTS idx_notifications_sent ON notification_history(sent_at);
    `);

    this.logger.info('[NotificationManager] ✅ Initialized');
  }

  /**
   * Send a notification
   */
  async sendNotification(tenantId, notificationData, userId = null) {
    const notificationId = uuidv4();
    const {
      channel_ids = [],
      type = 'info',
      priority = 'medium',
      subject,
      message,
      metadata = {},
      skipThrottle = false
    } = notificationData;

    // Validate required fields
    if (!subject || !message) {
      throw new Error('Subject and message are required');
    }

    if (channel_ids.length === 0) {
      throw new Error('At least one channel is required');
    }

    // Check throttling (unless skipped)
    if (!skipThrottle && this.isThrottled(tenantId, subject, priority)) {
      this.logger.warn(`[NotificationManager] Throttled notification: ${subject}`);
      return {
        success: false,
        throttled: true,
        message: 'Notification throttled - similar notification sent recently'
      };
    }

    // Get channels
    const channels = await this.channelManager.getChannelsByIds(tenantId, channel_ids);
    
    if (channels.length === 0) {
      throw new Error('No valid channels found');
    }

    // Build notification object
    const notification = {
      subject,
      message,
      priority,
      type,
      timestamp: new Date().toISOString(),
      metadata
    };

    // Send to all channels
    const results = await this.deliveryManager.sendToChannels(
      tenantId,
      channel_ids,
      notification
    );

    const successCount = results.filter(r => r.success).length;
    const status = successCount > 0 ? 'sent' : 'failed';

    // Record in history
    await this.db.run(`
      INSERT INTO notification_history (
        id, tenant_id, channel_ids, type, priority, 
        subject, message, status, sent_at, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      notificationId,
      tenantId,
      JSON.stringify(channel_ids),
      type,
      priority,
      subject,
      message,
      status,
      new Date().toISOString(),
      JSON.stringify({ userId, results, ...metadata })
    ]);

    // Update throttle cache
    if (!skipThrottle) {
      this.updateThrottleCache(tenantId, subject, priority);
    }

    this.logger.info(`[NotificationManager] Sent notification ${notificationId}: ${successCount}/${results.length} channels`);

    return {
      success: true,
      notification_id: notificationId,
      status,
      channels: results.length,
      successful: successCount,
      failed: results.length - successCount,
      results
    };
  }

  /**
   * Check if notification should be throttled
   */
  isThrottled(tenantId, subject, priority) {
    const key = `${tenantId}:${subject}:${priority}`;
    const lastSent = this.throttleCache.get(key);
    
    if (!lastSent) {
      return false;
    }

    // Throttle window based on priority
    const windows = {
      critical: 60000,    // 1 minute
      high: 300000,       // 5 minutes
      medium: 900000,     // 15 minutes
      low: 1800000        // 30 minutes
    };

    const window = windows[priority] || 300000;
    const elapsed = Date.now() - lastSent;

    return elapsed < window;
  }

  /**
   * Update throttle cache
   */
  updateThrottleCache(tenantId, subject, priority) {
    const key = `${tenantId}:${subject}:${priority}`;
    this.throttleCache.set(key, Date.now());

    // Clean old entries periodically
    if (this.throttleCache.size > 1000) {
      this.cleanThrottleCache();
    }
  }

  /**
   * Clean throttle cache
   */
  cleanThrottleCache() {
    const now = Date.now();
    const maxAge = 1800000; // 30 minutes

    for (const [key, timestamp] of this.throttleCache.entries()) {
      if (now - timestamp > maxAge) {
        this.throttleCache.delete(key);
      }
    }
  }

  /**
   * List notification history
   */
  async listNotifications(tenantId, filters = {}) {
    const { type, priority, status, limit = 100, offset = 0 } = filters;
    
    let query = 'SELECT * FROM notification_history WHERE tenant_id = ?';
    const params = [tenantId];

    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }

    if (priority) {
      query += ' AND priority = ?';
      params.push(priority);
    }

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY sent_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const notifications = await this.db.all(query, params);

    return notifications.map(n => ({
      ...n,
      channel_ids: JSON.parse(n.channel_ids || '[]'),
      metadata: JSON.parse(n.metadata || '{}')
    }));
  }

  /**
   * Get a single notification
   */
  async getNotification(tenantId, notificationId) {
    const notification = await this.db.get(
      'SELECT * FROM notification_history WHERE tenant_id = ? AND id = ?',
      [tenantId, notificationId]
    );

    if (!notification) {
      throw new Error('Notification not found');
    }

    return {
      ...notification,
      channel_ids: JSON.parse(notification.channel_ids || '[]'),
      metadata: JSON.parse(notification.metadata || '{}')
    };
  }

  /**
   * Get notification statistics
   */
  async getStatistics(tenantId, days = 7) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const stats = await this.db.get(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN priority = 'critical' THEN 1 ELSE 0 END) as critical,
        SUM(CASE WHEN priority = 'high' THEN 1 ELSE 0 END) as high,
        SUM(CASE WHEN priority = 'medium' THEN 1 ELSE 0 END) as medium,
        SUM(CASE WHEN priority = 'low' THEN 1 ELSE 0 END) as low
      FROM notification_history
      WHERE tenant_id = ? AND sent_at >= ?
    `, [tenantId, since.toISOString()]);

    return {
      ...stats,
      days,
      success_rate: stats.total > 0 ? ((stats.sent / stats.total) * 100).toFixed(1) : 0
    };
  }

  /**
   * Delete old notifications (cleanup)
   */
  async cleanupOldNotifications(tenantId, daysToKeep = 90) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysToKeep);

    const result = await this.db.run(
      'DELETE FROM notification_history WHERE tenant_id = ? AND sent_at < ?',
      [tenantId, cutoff.toISOString()]
    );

    this.logger.info(`[NotificationManager] Cleaned up ${result.changes} old notifications`);

    return { deleted: result.changes };
  }

  /**
   * Send critical alert (bypasses throttling)
   */
  async sendCriticalAlert(tenantId, subject, message, channelIds) {
    return await this.sendNotification(tenantId, {
      channel_ids: channelIds,
      type: 'alert',
      priority: 'critical',
      subject,
      message,
      skipThrottle: true
    });
  }

  /**
   * Send scan completion notification
   */
  async sendScanComplete(tenantId, scanData, channelIds) {
    const { scan_name, vulnerabilities = {}, duration, status } = scanData;
    
    const subject = `Scan Complete: ${scan_name}`;
    const message = `
Security scan completed ${status === 'success' ? 'successfully' : 'with errors'}.

Vulnerabilities Found:
🔴 Critical: ${vulnerabilities.critical || 0}
🟠 High: ${vulnerabilities.high || 0}
🟡 Medium: ${vulnerabilities.medium || 0}
🔵 Low: ${vulnerabilities.low || 0}

Duration: ${duration}ms
Status: ${status}
    `.trim();

    const priority = vulnerabilities.critical > 0 ? 'critical' 
                   : vulnerabilities.high > 0 ? 'high'
                   : 'medium';

    return await this.sendNotification(tenantId, {
      channel_ids: channelIds,
      type: 'scan_complete',
      priority,
      subject,
      message,
      metadata: scanData
    });
  }
}

module.exports = NotificationManager;
