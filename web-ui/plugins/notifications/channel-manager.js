/**
 * Notifications Plugin - Channel Manager Service
 * Manages notification channels (Slack, Discord, Email, etc.)
 */

const { v4: uuidv4 } = require('uuid');
const { logger } = require('../../shared/logger');

class ChannelManager {
  constructor(db) {
    this.db = db;
    this.logger = logger;
  }

  /**
   * Initialize database tables
   */
  async init() {
    this.logger.info('[ChannelManager] Initializing...');

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS notification_channels (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        config TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        last_used DATETIME,
        success_count INTEGER DEFAULT 0,
        failure_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, name)
      )
    `);

    await this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_channels_tenant ON notification_channels(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_channels_type ON notification_channels(type);
      CREATE INDEX IF NOT EXISTS idx_channels_enabled ON notification_channels(enabled);
    `);

    this.logger.info('[ChannelManager] ✅ Initialized');
  }

  /**
   * Add a notification channel
   */
  async addChannel(tenantId, channelData) {
    const channelId = uuidv4();
    const { name, type, config, enabled = true } = channelData;

    // Validate required fields
    if (!name || !type || !config) {
      throw new Error('Missing required fields: name, type, config');
    }

    // Validate channel type
    const validTypes = ['slack', 'discord', 'email', 'teams', 'webhook'];
    if (!validTypes.includes(type)) {
      throw new Error(`Invalid channel type: ${type}`);
    }

    // Validate config based on type
    this.validateChannelConfig(type, config);

    // Check for duplicate name
    const existing = await this.db.get(
      'SELECT id FROM notification_channels WHERE tenant_id = ? AND name = ?',
      [tenantId, name]
    );

    if (existing) {
      throw new Error(`Channel with name "${name}" already exists`);
    }

    await this.db.run(`
      INSERT INTO notification_channels (
        id, tenant_id, name, type, config, enabled
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      channelId,
      tenantId,
      name,
      type,
      JSON.stringify(config),
      enabled ? 1 : 0
    ]);

    this.logger.info(`[ChannelManager] Added channel: ${name} (${type})`);

    return await this.getChannel(tenantId, channelId);
  }

  /**
   * Validate channel configuration
   */
  validateChannelConfig(type, config) {
    switch (type) {
      case 'slack':
        if (!config.webhook_url && !config.bot_token) {
          throw new Error('Slack channel requires webhook_url or bot_token');
        }
        break;
      
      case 'discord':
        if (!config.webhook_url) {
          throw new Error('Discord channel requires webhook_url');
        }
        break;
      
      case 'email':
        if (!config.smtp_host || !config.smtp_port || !config.from) {
          throw new Error('Email channel requires smtp_host, smtp_port, and from');
        }
        if (!config.recipients || !Array.isArray(config.recipients)) {
          throw new Error('Email channel requires recipients array');
        }
        break;
      
      case 'teams':
        if (!config.webhook_url) {
          throw new Error('Teams channel requires webhook_url');
        }
        break;
      
      case 'webhook':
        if (!config.url) {
          throw new Error('Webhook channel requires url');
        }
        break;
      
      default:
        throw new Error(`Unknown channel type: ${type}`);
    }
  }

  /**
   * List all channels
   */
  async listChannels(tenantId, filters = {}) {
    const { type, enabled, limit = 100, offset = 0 } = filters;
    
    let query = 'SELECT * FROM notification_channels WHERE tenant_id = ?';
    const params = [tenantId];

    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }

    if (enabled !== undefined) {
      query += ' AND enabled = ?';
      params.push(enabled ? 1 : 0);
    }

    query += ' ORDER BY name ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const channels = await this.db.all(query, params);

    return channels.map(channel => ({
      ...channel,
      config: JSON.parse(channel.config),
      enabled: channel.enabled === 1
    }));
  }

  /**
   * Get a single channel
   */
  async getChannel(tenantId, channelId) {
    const channel = await this.db.get(
      'SELECT * FROM notification_channels WHERE tenant_id = ? AND id = ?',
      [tenantId, channelId]
    );

    if (!channel) {
      throw new Error('Channel not found');
    }

    return {
      ...channel,
      config: JSON.parse(channel.config),
      enabled: channel.enabled === 1
    };
  }

  /**
   * Update a channel
   */
  async updateChannel(tenantId, channelId, updates) {
    await this.getChannel(tenantId, channelId); // Verify exists

    const { name, config, enabled } = updates;
    const fields = [];
    const params = [];

    if (name !== undefined) {
      fields.push('name = ?');
      params.push(name);
    }

    if (config !== undefined) {
      // Validate if type is being changed
      const channel = await this.getChannel(tenantId, channelId);
      this.validateChannelConfig(channel.type, config);
      fields.push('config = ?');
      params.push(JSON.stringify(config));
    }

    if (enabled !== undefined) {
      fields.push('enabled = ?');
      params.push(enabled ? 1 : 0);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(tenantId, channelId);

    await this.db.run(`
      UPDATE notification_channels SET ${fields.join(', ')}
      WHERE tenant_id = ? AND id = ?
    `, params);

    this.logger.info(`[ChannelManager] Updated channel: ${channelId}`);

    return await this.getChannel(tenantId, channelId);
  }

  /**
   * Delete a channel
   */
  async deleteChannel(tenantId, channelId) {
    const channel = await this.getChannel(tenantId, channelId);

    await this.db.run(
      'DELETE FROM notification_channels WHERE tenant_id = ? AND id = ?',
      [tenantId, channelId]
    );

    this.logger.info(`[ChannelManager] Deleted channel: ${channel.name}`);

    return { success: true, channel: channel.name };
  }

  /**
   * Update channel statistics
   */
  async updateChannelStats(tenantId, channelId, success) {
    const field = success ? 'success_count' : 'failure_count';
    
    await this.db.run(`
      UPDATE notification_channels 
      SET ${field} = ${field} + 1, last_used = CURRENT_TIMESTAMP
      WHERE tenant_id = ? AND id = ?
    `, [tenantId, channelId]);
  }

  /**
   * Get channel statistics
   */
  async getChannelStats(tenantId) {
    const stats = await this.db.all(`
      SELECT 
        type,
        COUNT(*) as total,
        SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) as enabled,
        SUM(success_count) as total_success,
        SUM(failure_count) as total_failures
      FROM notification_channels
      WHERE tenant_id = ?
      GROUP BY type
    `, [tenantId]);

    return stats;
  }

  /**
   * Get channels by type
   */
  async getChannelsByType(tenantId, type) {
    const channels = await this.db.all(`
      SELECT * FROM notification_channels 
      WHERE tenant_id = ? AND type = ? AND enabled = 1
      ORDER BY name ASC
    `, [tenantId, type]);

    return channels.map(channel => ({
      ...channel,
      config: JSON.parse(channel.config),
      enabled: channel.enabled === 1
    }));
  }

  /**
   * Get channels by IDs
   */
  async getChannelsByIds(tenantId, channelIds) {
    if (!channelIds || channelIds.length === 0) {
      return [];
    }

    const placeholders = channelIds.map(() => '?').join(',');
    const channels = await this.db.all(`
      SELECT * FROM notification_channels 
      WHERE tenant_id = ? AND id IN (${placeholders}) AND enabled = 1
    `, [tenantId, ...channelIds]);

    return channels.map(channel => ({
      ...channel,
      config: JSON.parse(channel.config),
      enabled: channel.enabled === 1
    }));
  }
}

module.exports = ChannelManager;
