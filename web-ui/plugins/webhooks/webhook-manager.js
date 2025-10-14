/**
 * Webhooks Plugin - Webhook Manager Service
 * Manages webhook configurations
 */

const { v4: uuidv4 } = require('uuid');
const { logger } = require('../../shared/logger');

class WebhookManager {
  constructor(db) {
    this.db = db;
    this.logger = logger;
  }

  /**
   * Initialize database tables
   */
  async init() {
    this.logger.info('[WebhookManager] Initializing...');

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS webhooks (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        events TEXT NOT NULL,
        secret TEXT,
        enabled INTEGER DEFAULT 1,
        headers TEXT,
        retry_enabled INTEGER DEFAULT 1,
        max_retries INTEGER DEFAULT 3,
        timeout INTEGER DEFAULT 30000,
        last_triggered DATETIME,
        success_count INTEGER DEFAULT 0,
        failure_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, name)
      )
    `);

    await this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_webhooks_tenant ON webhooks(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_webhooks_enabled ON webhooks(enabled);
      CREATE INDEX IF NOT EXISTS idx_webhooks_events ON webhooks(events);
    `);

    this.logger.info('[WebhookManager] ✅ Initialized');
  }

  /**
   * Create a webhook
   */
  async createWebhook(tenantId, webhookData) {
    const webhookId = uuidv4();
    const {
      name,
      url,
      events = [],
      secret,
      enabled = true,
      headers = {},
      retry_enabled = true,
      max_retries = 3,
      timeout = 30000
    } = webhookData;

    // Validate required fields
    if (!name || !url) {
      throw new Error('Name and URL are required');
    }

    if (events.length === 0) {
      throw new Error('At least one event must be specified');
    }

    // Validate URL
    try {
      new URL(url);
    } catch (error) {
      throw new Error('Invalid URL format');
    }

    // Validate events
    const validEvents = this.getValidEvents();
    const invalidEvents = events.filter(e => !validEvents.includes(e));
    if (invalidEvents.length > 0) {
      throw new Error(`Invalid events: ${invalidEvents.join(', ')}`);
    }

    // Check for duplicate name
    const existing = await this.db.get(
      'SELECT id FROM webhooks WHERE tenant_id = ? AND name = ?',
      [tenantId, name]
    );

    if (existing) {
      throw new Error(`Webhook with name "${name}" already exists`);
    }

    await this.db.run(`
      INSERT INTO webhooks (
        id, tenant_id, name, url, events, secret, enabled,
        headers, retry_enabled, max_retries, timeout
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      webhookId,
      tenantId,
      name,
      url,
      JSON.stringify(events),
      secret || null,
      enabled ? 1 : 0,
      JSON.stringify(headers),
      retry_enabled ? 1 : 0,
      max_retries,
      timeout
    ]);

    this.logger.info(`[WebhookManager] Created webhook: ${name} (${url})`);

    return await this.getWebhook(tenantId, webhookId);
  }

  /**
   * List webhooks
   */
  async listWebhooks(tenantId, filters = {}) {
    const { enabled, event, limit = 100, offset = 0 } = filters;
    
    let query = 'SELECT * FROM webhooks WHERE tenant_id = ?';
    const params = [tenantId];

    if (enabled !== undefined) {
      query += ' AND enabled = ?';
      params.push(enabled ? 1 : 0);
    }

    if (event) {
      query += ' AND events LIKE ?';
      params.push(`%"${event}"%`);
    }

    query += ' ORDER BY name ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const webhooks = await this.db.all(query, params);

    return webhooks.map(webhook => ({
      ...webhook,
      events: JSON.parse(webhook.events || '[]'),
      headers: JSON.parse(webhook.headers || '{}'),
      enabled: webhook.enabled === 1,
      retry_enabled: webhook.retry_enabled === 1
    }));
  }

  /**
   * Get a single webhook
   */
  async getWebhook(tenantId, webhookId) {
    const webhook = await this.db.get(
      'SELECT * FROM webhooks WHERE tenant_id = ? AND id = ?',
      [tenantId, webhookId]
    );

    if (!webhook) {
      throw new Error('Webhook not found');
    }

    return {
      ...webhook,
      events: JSON.parse(webhook.events || '[]'),
      headers: JSON.parse(webhook.headers || '{}'),
      enabled: webhook.enabled === 1,
      retry_enabled: webhook.retry_enabled === 1
    };
  }

  /**
   * Update a webhook
   */
  async updateWebhook(tenantId, webhookId, updates) {
    await this.getWebhook(tenantId, webhookId); // Verify exists

    const { name, url, events, secret, enabled, headers, retry_enabled, max_retries, timeout } = updates;
    const fields = [];
    const params = [];

    if (name !== undefined) {
      fields.push('name = ?');
      params.push(name);
    }

    if (url !== undefined) {
      try {
        new URL(url);
      } catch (error) {
        throw new Error('Invalid URL format');
      }
      fields.push('url = ?');
      params.push(url);
    }

    if (events !== undefined) {
      const validEvents = this.getValidEvents();
      const invalidEvents = events.filter(e => !validEvents.includes(e));
      if (invalidEvents.length > 0) {
        throw new Error(`Invalid events: ${invalidEvents.join(', ')}`);
      }
      fields.push('events = ?');
      params.push(JSON.stringify(events));
    }

    if (secret !== undefined) {
      fields.push('secret = ?');
      params.push(secret);
    }

    if (enabled !== undefined) {
      fields.push('enabled = ?');
      params.push(enabled ? 1 : 0);
    }

    if (headers !== undefined) {
      fields.push('headers = ?');
      params.push(JSON.stringify(headers));
    }

    if (retry_enabled !== undefined) {
      fields.push('retry_enabled = ?');
      params.push(retry_enabled ? 1 : 0);
    }

    if (max_retries !== undefined) {
      fields.push('max_retries = ?');
      params.push(max_retries);
    }

    if (timeout !== undefined) {
      fields.push('timeout = ?');
      params.push(timeout);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(tenantId, webhookId);

    await this.db.run(`
      UPDATE webhooks SET ${fields.join(', ')}
      WHERE tenant_id = ? AND id = ?
    `, params);

    this.logger.info(`[WebhookManager] Updated webhook: ${webhookId}`);

    return await this.getWebhook(tenantId, webhookId);
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(tenantId, webhookId) {
    const webhook = await this.getWebhook(tenantId, webhookId);

    await this.db.run(
      'DELETE FROM webhooks WHERE tenant_id = ? AND id = ?',
      [tenantId, webhookId]
    );

    this.logger.info(`[WebhookManager] Deleted webhook: ${webhook.name}`);

    return { success: true, webhook: webhook.name };
  }

  /**
   * Update webhook statistics
   */
  async updateWebhookStats(tenantId, webhookId, success) {
    const field = success ? 'success_count' : 'failure_count';
    
    await this.db.run(`
      UPDATE webhooks 
      SET ${field} = ${field} + 1, 
          last_triggered = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE tenant_id = ? AND id = ?
    `, [tenantId, webhookId]);
  }

  /**
   * Get webhooks by event
   */
  async getWebhooksByEvent(tenantId, event) {
    const webhooks = await this.db.all(`
      SELECT * FROM webhooks 
      WHERE tenant_id = ? AND enabled = 1 AND events LIKE ?
      ORDER BY name ASC
    `, [tenantId, `%"${event}"%`]);

    return webhooks.map(webhook => ({
      ...webhook,
      events: JSON.parse(webhook.events || '[]'),
      headers: JSON.parse(webhook.headers || '{}'),
      enabled: webhook.enabled === 1,
      retry_enabled: webhook.retry_enabled === 1
    }));
  }

  /**
   * Get webhook statistics
   */
  async getStatistics(tenantId) {
    const stats = await this.db.get(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) as enabled,
        SUM(CASE WHEN enabled = 0 THEN 1 ELSE 0 END) as disabled,
        SUM(success_count) as total_successes,
        SUM(failure_count) as total_failures
      FROM webhooks
      WHERE tenant_id = ?
    `, [tenantId]);

    return {
      ...stats,
      success_rate: stats.total_successes + stats.total_failures > 0
        ? ((stats.total_successes / (stats.total_successes + stats.total_failures)) * 100).toFixed(1)
        : 0
    };
  }

  /**
   * Get valid event types
   */
  getValidEvents() {
    return [
      'scan.started',
      'scan.completed',
      'scan.failed',
      'vulnerability.found',
      'policy.executed',
      'policy.passed',
      'policy.failed',
      'server.added',
      'server.removed',
      'alert.triggered',
      'notification.sent',
      'user.created',
      'user.deleted',
      'tenant.created'
    ];
  }
}

module.exports = WebhookManager;
