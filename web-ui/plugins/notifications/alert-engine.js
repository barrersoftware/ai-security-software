/**
 * Notifications Plugin - Alert Engine Service
 * Rule-based alerting system
 */

const { v4: uuidv4 } = require('uuid');
const { logger } = require('../../shared/logger');

class AlertEngine {
  constructor(db, notificationManager) {
    this.db = db;
    this.notificationManager = notificationManager;
    this.logger = logger;
  }

  /**
   * Initialize database tables
   */
  async init() {
    this.logger.info('[AlertEngine] Initializing...');

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS alert_rules (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        condition TEXT NOT NULL,
        channels TEXT NOT NULL,
        priority TEXT DEFAULT 'medium',
        enabled INTEGER DEFAULT 1,
        last_triggered DATETIME,
        trigger_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, name)
      )
    `);

    await this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_alert_rules_tenant ON alert_rules(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled ON alert_rules(enabled);
    `);

    this.logger.info('[AlertEngine] ✅ Initialized');
  }

  /**
   * Create alert rule
   */
  async createRule(tenantId, ruleData) {
    const ruleId = uuidv4();
    const {
      name,
      description = '',
      condition,
      channels = [],
      priority = 'medium',
      enabled = true
    } = ruleData;

    // Validate required fields
    if (!name || !condition) {
      throw new Error('Name and condition are required');
    }

    if (channels.length === 0) {
      throw new Error('At least one channel is required');
    }

    // Validate condition format
    this.validateCondition(condition);

    // Check for duplicate name
    const existing = await this.db.get(
      'SELECT id FROM alert_rules WHERE tenant_id = ? AND name = ?',
      [tenantId, name]
    );

    if (existing) {
      throw new Error(`Alert rule with name "${name}" already exists`);
    }

    await this.db.run(`
      INSERT INTO alert_rules (
        id, tenant_id, name, description, condition, 
        channels, priority, enabled
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      ruleId,
      tenantId,
      name,
      description,
      JSON.stringify(condition),
      JSON.stringify(channels),
      priority,
      enabled ? 1 : 0
    ]);

    this.logger.info(`[AlertEngine] Created alert rule: ${name}`);

    return await this.getRule(tenantId, ruleId);
  }

  /**
   * Validate condition format
   */
  validateCondition(condition) {
    const requiredFields = ['event', 'operator', 'value'];
    
    for (const field of requiredFields) {
      if (!(field in condition)) {
        throw new Error(`Condition missing required field: ${field}`);
      }
    }

    // Validate event type
    const validEvents = [
      'vulnerability.found',
      'scan.completed',
      'scan.failed',
      'policy.violated',
      'server.offline',
      'threshold.exceeded'
    ];

    if (!validEvents.includes(condition.event)) {
      throw new Error(`Invalid event type: ${condition.event}`);
    }

    // Validate operator
    const validOperators = ['equals', 'not_equals', 'greater_than', 'less_than', 'contains'];
    
    if (!validOperators.includes(condition.operator)) {
      throw new Error(`Invalid operator: ${condition.operator}`);
    }
  }

  /**
   * List alert rules
   */
  async listRules(tenantId, filters = {}) {
    const { enabled, limit = 100, offset = 0 } = filters;
    
    let query = 'SELECT * FROM alert_rules WHERE tenant_id = ?';
    const params = [tenantId];

    if (enabled !== undefined) {
      query += ' AND enabled = ?';
      params.push(enabled ? 1 : 0);
    }

    query += ' ORDER BY name ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rules = await this.db.all(query, params);

    return rules.map(rule => ({
      ...rule,
      condition: JSON.parse(rule.condition),
      channels: JSON.parse(rule.channels),
      enabled: rule.enabled === 1
    }));
  }

  /**
   * Get a single rule
   */
  async getRule(tenantId, ruleId) {
    const rule = await this.db.get(
      'SELECT * FROM alert_rules WHERE tenant_id = ? AND id = ?',
      [tenantId, ruleId]
    );

    if (!rule) {
      throw new Error('Alert rule not found');
    }

    return {
      ...rule,
      condition: JSON.parse(rule.condition),
      channels: JSON.parse(rule.channels),
      enabled: rule.enabled === 1
    };
  }

  /**
   * Update alert rule
   */
  async updateRule(tenantId, ruleId, updates) {
    await this.getRule(tenantId, ruleId); // Verify exists

    const { name, description, condition, channels, priority, enabled } = updates;
    const fields = [];
    const params = [];

    if (name !== undefined) {
      fields.push('name = ?');
      params.push(name);
    }

    if (description !== undefined) {
      fields.push('description = ?');
      params.push(description);
    }

    if (condition !== undefined) {
      this.validateCondition(condition);
      fields.push('condition = ?');
      params.push(JSON.stringify(condition));
    }

    if (channels !== undefined) {
      fields.push('channels = ?');
      params.push(JSON.stringify(channels));
    }

    if (priority !== undefined) {
      fields.push('priority = ?');
      params.push(priority);
    }

    if (enabled !== undefined) {
      fields.push('enabled = ?');
      params.push(enabled ? 1 : 0);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(tenantId, ruleId);

    await this.db.run(`
      UPDATE alert_rules SET ${fields.join(', ')}
      WHERE tenant_id = ? AND id = ?
    `, params);

    this.logger.info(`[AlertEngine] Updated alert rule: ${ruleId}`);

    return await this.getRule(tenantId, ruleId);
  }

  /**
   * Delete alert rule
   */
  async deleteRule(tenantId, ruleId) {
    const rule = await this.getRule(tenantId, ruleId);

    await this.db.run(
      'DELETE FROM alert_rules WHERE tenant_id = ? AND id = ?',
      [tenantId, ruleId]
    );

    this.logger.info(`[AlertEngine] Deleted alert rule: ${rule.name}`);

    return { success: true, rule: rule.name };
  }

  /**
   * Evaluate event against alert rules
   */
  async evaluateEvent(tenantId, event) {
    // Get all enabled rules for this tenant
    const rules = await this.listRules(tenantId, { enabled: true });

    const triggeredRules = [];

    for (const rule of rules) {
      if (this.doesEventMatchCondition(event, rule.condition)) {
        triggeredRules.push(rule);
      }
    }

    // Trigger alerts for matched rules
    for (const rule of triggeredRules) {
      await this.triggerAlert(tenantId, rule, event);
    }

    return {
      evaluated: rules.length,
      triggered: triggeredRules.length,
      rules: triggeredRules.map(r => r.name)
    };
  }

  /**
   * Check if event matches condition
   */
  doesEventMatchCondition(event, condition) {
    // Check event type
    if (event.type !== condition.event) {
      return false;
    }

    // Check condition based on operator
    const { operator, field, value } = condition;
    const eventValue = this.getEventFieldValue(event, field);

    switch (operator) {
      case 'equals':
        return eventValue === value;
      
      case 'not_equals':
        return eventValue !== value;
      
      case 'greater_than':
        return Number(eventValue) > Number(value);
      
      case 'less_than':
        return Number(eventValue) < Number(value);
      
      case 'contains':
        return String(eventValue).includes(String(value));
      
      default:
        return false;
    }
  }

  /**
   * Get field value from event
   */
  getEventFieldValue(event, field) {
    const parts = field.split('.');
    let value = event;

    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Trigger alert
   */
  async triggerAlert(tenantId, rule, event) {
    try {
      // Build alert message
      const subject = `Alert: ${rule.name}`;
      const message = this.buildAlertMessage(rule, event);

      // Send notification
      await this.notificationManager.sendNotification(tenantId, {
        channel_ids: rule.channels,
        type: 'alert',
        priority: rule.priority,
        subject,
        message,
        metadata: {
          rule_id: rule.id,
          rule_name: rule.name,
          event
        }
      });

      // Update rule statistics
      await this.db.run(`
        UPDATE alert_rules 
        SET last_triggered = CURRENT_TIMESTAMP, trigger_count = trigger_count + 1
        WHERE id = ?
      `, [rule.id]);

      this.logger.info(`[AlertEngine] Triggered alert: ${rule.name}`);

    } catch (error) {
      this.logger.error(`[AlertEngine] Failed to trigger alert ${rule.name}:`, error);
    }
  }

  /**
   * Build alert message
   */
  buildAlertMessage(rule, event) {
    let message = `Alert Rule: ${rule.name}\n`;
    
    if (rule.description) {
      message += `Description: ${rule.description}\n`;
    }

    message += `\nEvent Details:\n`;
    message += `Type: ${event.type}\n`;
    
    if (event.data) {
      message += `\nData:\n`;
      for (const [key, value] of Object.entries(event.data)) {
        message += `  ${key}: ${JSON.stringify(value)}\n`;
      }
    }

    message += `\nTriggered: ${new Date().toISOString()}`;

    return message;
  }

  /**
   * Get alert statistics
   */
  async getRuleStatistics(tenantId) {
    const stats = await this.db.get(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) as enabled,
        SUM(CASE WHEN enabled = 0 THEN 1 ELSE 0 END) as disabled,
        SUM(trigger_count) as total_triggers
      FROM alert_rules
      WHERE tenant_id = ?
    `, [tenantId]);

    return stats;
  }
}

module.exports = AlertEngine;
