/**
 * Webhooks Plugin - Delivery Manager Service
 * Handles HTTP delivery of webhook payloads
 */

const https = require('https');
const http = require('http');
const { v4: uuidv4 } = require('uuid');
const { logger } = require('../../shared/logger');

class DeliveryManager {
  constructor(db, webhookManager, securityManager) {
    this.db = db;
    this.webhookManager = webhookManager;
    this.securityManager = securityManager;
    this.logger = logger;
  }

  /**
   * Initialize database tables
   */
  async init() {
    this.logger.info('[DeliveryManager] Initializing...');

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS webhook_deliveries (
        id TEXT PRIMARY KEY,
        webhook_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        event TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        status_code INTEGER,
        response TEXT,
        error TEXT,
        attempts INTEGER DEFAULT 0,
        next_retry DATETIME,
        delivered_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_deliveries_webhook ON webhook_deliveries(webhook_id);
      CREATE INDEX IF NOT EXISTS idx_deliveries_status ON webhook_deliveries(status);
      CREATE INDEX IF NOT EXISTS idx_deliveries_event ON webhook_deliveries(event);
      CREATE INDEX IF NOT EXISTS idx_deliveries_retry ON webhook_deliveries(next_retry);
    `);

    this.logger.info('[DeliveryManager] ✅ Initialized');
  }

  /**
   * Deliver webhook payload
   */
  async deliver(tenantId, webhookId, event, data) {
    const deliveryId = uuidv4();

    try {
      const webhook = await this.webhookManager.getWebhook(tenantId, webhookId);

      if (!webhook.enabled) {
        throw new Error('Webhook is disabled');
      }

      // Build payload
      const payload = {
        event,
        timestamp: new Date().toISOString(),
        tenant_id: tenantId,
        data
      };

      // Add HMAC signature if secret exists
      if (webhook.secret) {
        payload.signature = this.securityManager.generateSignature(
          JSON.stringify(payload),
          webhook.secret
        );
      }

      // Record delivery attempt
      await this.db.run(`
        INSERT INTO webhook_deliveries (
          id, webhook_id, tenant_id, event, payload, status, attempts
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [deliveryId, webhookId, tenantId, event, JSON.stringify(payload), 'pending', 0]);

      // Attempt delivery
      const result = await this.sendHttpRequest(webhook, payload);

      // Update delivery record
      await this.db.run(`
        UPDATE webhook_deliveries 
        SET status = ?, status_code = ?, response = ?, delivered_at = ?, attempts = 1
        WHERE id = ?
      `, ['success', result.statusCode, result.response, new Date().toISOString(), deliveryId]);

      // Update webhook stats
      await this.webhookManager.updateWebhookStats(tenantId, webhookId, true);

      this.logger.info(`[DeliveryManager] Delivered ${event} to ${webhook.name}`);

      return {
        success: true,
        delivery_id: deliveryId,
        status_code: result.statusCode
      };

    } catch (error) {
      // Record failure
      await this.db.run(`
        UPDATE webhook_deliveries 
        SET status = ?, error = ?, attempts = attempts + 1
        WHERE id = ?
      `, ['failed', error.message, deliveryId]);

      // Update webhook stats
      await this.webhookManager.updateWebhookStats(tenantId, webhookId, false);

      // Schedule retry if enabled
      const webhook = await this.webhookManager.getWebhook(tenantId, webhookId);
      if (webhook.retry_enabled) {
        await this.scheduleRetry(deliveryId, webhook);
      }

      this.logger.error(`[DeliveryManager] Failed to deliver ${event}:`, error.message);

      return {
        success: false,
        delivery_id: deliveryId,
        error: error.message
      };
    }
  }

  /**
   * Send HTTP request
   */
  async sendHttpRequest(webhook, payload) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(webhook.url);
      const protocol = urlObj.protocol === 'https:' ? https : http;

      const postData = JSON.stringify(payload);

      // Build headers
      const headers = {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'AI-Security-Scanner-Webhook/1.0',
        ...webhook.headers
      };

      // Add signature header if present
      if (payload.signature) {
        headers['X-Webhook-Signature'] = payload.signature;
      }

      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers,
        timeout: webhook.timeout
      };

      const req = protocol.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({
              statusCode: res.statusCode,
              response: data.substring(0, 1000) // Limit response size
            });
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * Schedule retry
   */
  async scheduleRetry(deliveryId, webhook) {
    const delivery = await this.db.get(
      'SELECT * FROM webhook_deliveries WHERE id = ?',
      [deliveryId]
    );

    if (delivery.attempts >= webhook.max_retries) {
      this.logger.warn(`[DeliveryManager] Max retries reached for delivery ${deliveryId}`);
      return;
    }

    // Exponential backoff: 5s, 10s, 20s, 40s...
    const delayMs = webhook.retry_enabled ? 5000 * Math.pow(2, delivery.attempts) : 0;
    const nextRetry = new Date(Date.now() + delayMs).toISOString();

    await this.db.run(`
      UPDATE webhook_deliveries 
      SET status = 'pending', next_retry = ?
      WHERE id = ?
    `, [nextRetry, deliveryId]);

    this.logger.info(`[DeliveryManager] Scheduled retry for ${deliveryId} at ${nextRetry}`);
  }

  /**
   * Process pending retries
   */
  async processRetries() {
    const now = new Date().toISOString();
    
    const pending = await this.db.all(`
      SELECT * FROM webhook_deliveries 
      WHERE status = 'pending' AND next_retry IS NOT NULL AND next_retry <= ?
      LIMIT 10
    `, [now]);

    for (const delivery of pending) {
      try {
        const webhook = await this.webhookManager.getWebhook(
          delivery.tenant_id,
          delivery.webhook_id
        );

        const payload = JSON.parse(delivery.payload);
        const result = await this.sendHttpRequest(webhook, payload);

        await this.db.run(`
          UPDATE webhook_deliveries 
          SET status = 'success', status_code = ?, response = ?, 
              delivered_at = ?, attempts = attempts + 1, next_retry = NULL
          WHERE id = ?
        `, [result.statusCode, result.response, new Date().toISOString(), delivery.id]);

        await this.webhookManager.updateWebhookStats(delivery.tenant_id, delivery.webhook_id, true);

        this.logger.info(`[DeliveryManager] Retry successful for ${delivery.id}`);

      } catch (error) {
        await this.db.run(`
          UPDATE webhook_deliveries 
          SET attempts = attempts + 1, error = ?
          WHERE id = ?
        `, [error.message, delivery.id]);

        // Schedule next retry if needed
        const webhook = await this.webhookManager.getWebhook(
          delivery.tenant_id,
          delivery.webhook_id
        );
        await this.scheduleRetry(delivery.id, webhook);

        this.logger.error(`[DeliveryManager] Retry failed for ${delivery.id}:`, error.message);
      }
    }

    return pending.length;
  }

  /**
   * List deliveries for a webhook
   */
  async listDeliveries(tenantId, webhookId, filters = {}) {
    const { status, event, limit = 100, offset = 0 } = filters;
    
    let query = 'SELECT * FROM webhook_deliveries WHERE tenant_id = ? AND webhook_id = ?';
    const params = [tenantId, webhookId];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    if (event) {
      query += ' AND event = ?';
      params.push(event);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const deliveries = await this.db.all(query, params);

    return deliveries.map(d => ({
      ...d,
      payload: JSON.parse(d.payload || '{}')
    }));
  }

  /**
   * Get a single delivery
   */
  async getDelivery(tenantId, webhookId, deliveryId) {
    const delivery = await this.db.get(
      'SELECT * FROM webhook_deliveries WHERE tenant_id = ? AND webhook_id = ? AND id = ?',
      [tenantId, webhookId, deliveryId]
    );

    if (!delivery) {
      throw new Error('Delivery not found');
    }

    return {
      ...delivery,
      payload: JSON.parse(delivery.payload || '{}')
    };
  }

  /**
   * Redeliver a webhook
   */
  async redeliver(tenantId, webhookId, deliveryId) {
    const delivery = await this.getDelivery(tenantId, webhookId, deliveryId);
    const payload = delivery.payload;

    // Create new delivery
    return await this.deliver(tenantId, webhookId, delivery.event, payload.data);
  }

  /**
   * Get delivery statistics
   */
  async getStatistics(tenantId, webhookId) {
    const stats = await this.db.get(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        AVG(CASE WHEN status = 'success' THEN attempts ELSE NULL END) as avg_attempts
      FROM webhook_deliveries
      WHERE tenant_id = ? AND webhook_id = ?
    `, [tenantId, webhookId]);

    return {
      ...stats,
      success_rate: stats.total > 0 
        ? ((stats.successful / stats.total) * 100).toFixed(1)
        : 0
    };
  }

  /**
   * Cleanup old deliveries
   */
  async cleanupOldDeliveries(tenantId, daysToKeep = 30) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysToKeep);

    const result = await this.db.run(
      'DELETE FROM webhook_deliveries WHERE tenant_id = ? AND created_at < ?',
      [tenantId, cutoff.toISOString()]
    );

    this.logger.info(`[DeliveryManager] Cleaned up ${result.changes} old deliveries`);

    return { deleted: result.changes };
  }
}

module.exports = DeliveryManager;
