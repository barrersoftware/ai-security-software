/**
 * SecurityMonitor Service
 * 
 * Monitors audit logs in real-time for suspicious activity and security events.
 * Triggers alerts when threshold violations or suspicious patterns are detected.
 */

class SecurityMonitor {
  constructor(db, logger, auditLogger) {
    this.db = db;
    this.logger = logger;
    this.auditLogger = auditLogger;
    this.alerts = [];
    this.rules = [];
    this.monitorInterval = null;

    // Default security monitoring rules
    this.defaultRules = [
      {
        id: 'failed_login_attempts',
        name: 'Multiple Failed Login Attempts',
        description: 'Detect multiple failed login attempts from same user/IP',
        category: 'authentication',
        threshold: 5,
        timeWindow: 300, // 5 minutes
        severity: 'critical',
        action: 'create_alert'
      },
      {
        id: 'privilege_escalation',
        name: 'Privilege Escalation Attempt',
        description: 'Detect unauthorized privilege escalation attempts',
        category: 'authorization',
        pattern: 'escalation',
        severity: 'critical',
        action: 'create_alert'
      },
      {
        id: 'sensitive_data_access',
        name: 'Unusual Sensitive Data Access',
        description: 'Detect abnormal patterns in sensitive data access',
        category: 'data_access',
        threshold: 100,
        timeWindow: 3600, // 1 hour
        severity: 'warning',
        action: 'create_alert'
      },
      {
        id: 'config_changes',
        name: 'Critical Configuration Changes',
        description: 'Monitor critical system configuration changes',
        category: 'configuration',
        severity: 'warning',
        action: 'create_alert'
      },
      {
        id: 'bulk_delete',
        name: 'Bulk Delete Operations',
        description: 'Detect potentially malicious bulk delete operations',
        pattern: 'delete',
        threshold: 50,
        timeWindow: 300, // 5 minutes
        severity: 'critical',
        action: 'create_alert'
      },
      {
        id: 'after_hours_access',
        name: 'After-Hours Access',
        description: 'Detect access during non-business hours',
        timeRange: { start: 22, end: 6 }, // 10 PM to 6 AM
        severity: 'warning',
        action: 'log_only'
      },
      {
        id: 'geographic_anomaly',
        name: 'Geographic Access Anomaly',
        description: 'Detect impossible travel (access from different locations)',
        category: 'authentication',
        severity: 'warning',
        action: 'create_alert'
      }
    ];
  }

  /**
   * Initialize security monitor
   */
  async init() {
    this.logger.info('[SecurityMonitor] Initializing...');

    // Load rules from database or use defaults
    await this.loadRules();

    // Create alerts table
    await this.createAlertsTable();

    // Start monitoring
    this.startMonitoring();

    this.logger.info('[SecurityMonitor] ✅ Initialized with ' + this.rules.length + ' monitoring rules');
  }

  /**
   * Load monitoring rules
   */
  async loadRules() {
    // For now, use default rules
    // In future, load from database and allow customization
    this.rules = [...this.defaultRules];
  }

  /**
   * Create alerts table
   */
  async createAlertsTable() {
    if (!this.db) return;

    try {
      await this.db.run(`
        CREATE TABLE IF NOT EXISTS security_alerts (
          id TEXT PRIMARY KEY,
          timestamp TEXT NOT NULL,
          tenant_id TEXT,
          rule_id TEXT NOT NULL,
          rule_name TEXT NOT NULL,
          severity TEXT NOT NULL,
          status TEXT DEFAULT 'active',
          description TEXT,
          details TEXT,
          affected_users TEXT,
          event_count INTEGER DEFAULT 1,
          first_seen TEXT,
          last_seen TEXT,
          resolved_at TEXT,
          resolved_by TEXT,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await this.db.run('CREATE INDEX IF NOT EXISTS idx_alerts_tenant ON security_alerts(tenant_id)');
      await this.db.run('CREATE INDEX IF NOT EXISTS idx_alerts_status ON security_alerts(status)');
      await this.db.run('CREATE INDEX IF NOT EXISTS idx_alerts_severity ON security_alerts(severity)');

      this.logger.info('[SecurityMonitor] Created security_alerts table');
    } catch (error) {
      this.logger.error('[SecurityMonitor] Error creating alerts table:', error);
    }
  }

  /**
   * Start real-time monitoring
   */
  startMonitoring() {
    // Run checks every minute
    this.monitorInterval = setInterval(() => {
      this.runSecurityChecks();
    }, 60000); // 60 seconds

    this.logger.info('[SecurityMonitor] Started real-time monitoring');
  }

  /**
   * Run all security checks
   */
  async runSecurityChecks() {
    try {
      for (const rule of this.rules) {
        await this.checkRule(rule);
      }
    } catch (error) {
      this.logger.error('[SecurityMonitor] Error running security checks:', error);
    }
  }

  /**
   * Check a specific rule
   */
  async checkRule(rule) {
    try {
      if (rule.id === 'failed_login_attempts') {
        await this.checkFailedLoginAttempts(rule);
      } else if (rule.id === 'sensitive_data_access') {
        await this.checkSensitiveDataAccess(rule);
      } else if (rule.id === 'config_changes') {
        await this.checkConfigChanges(rule);
      } else if (rule.id === 'bulk_delete') {
        await this.checkBulkDeletes(rule);
      }
      // Add more rule checks as needed
    } catch (error) {
      this.logger.error(`[SecurityMonitor] Error checking rule ${rule.id}:`, error);
    }
  }

  /**
   * Check for failed login attempts
   */
  async checkFailedLoginAttempts(rule) {
    const timeWindow = new Date();
    timeWindow.setSeconds(timeWindow.getSeconds() - rule.timeWindow);

    const result = await this.db.all(`
      SELECT user_id, ip_address, COUNT(*) as attempts
      FROM audit_logs
      WHERE category = 'authentication'
        AND success = 0
        AND timestamp >= ?
      GROUP BY user_id, ip_address
      HAVING attempts >= ?
    `, [timeWindow.toISOString(), rule.threshold]);

    for (const row of result) {
      await this.createAlert({
        ruleId: rule.id,
        ruleName: rule.name,
        severity: rule.severity,
        description: `${row.attempts} failed login attempts detected`,
        details: {
          userId: row.user_id,
          ipAddress: row.ip_address,
          attempts: row.attempts,
          timeWindow: rule.timeWindow
        }
      });
    }
  }

  /**
   * Check for unusual sensitive data access
   */
  async checkSensitiveDataAccess(rule) {
    const timeWindow = new Date();
    timeWindow.setSeconds(timeWindow.getSeconds() - rule.timeWindow);

    const result = await this.db.all(`
      SELECT user_id, tenant_id, COUNT(*) as access_count
      FROM audit_logs
      WHERE category = 'data_access'
        AND timestamp >= ?
      GROUP BY user_id, tenant_id
      HAVING access_count >= ?
    `, [timeWindow.toISOString(), rule.threshold]);

    for (const row of result) {
      await this.createAlert({
        tenantId: row.tenant_id,
        ruleId: rule.id,
        ruleName: rule.name,
        severity: rule.severity,
        description: `Unusual data access pattern detected (${row.access_count} accesses in ${rule.timeWindow}s)`,
        details: {
          userId: row.user_id,
          accessCount: row.access_count,
          timeWindow: rule.timeWindow
        }
      });
    }
  }

  /**
   * Check for configuration changes
   */
  async checkConfigChanges(rule) {
    const recentTime = new Date();
    recentTime.setMinutes(recentTime.getMinutes() - 5);

    const result = await this.db.all(`
      SELECT * FROM audit_logs
      WHERE category = 'configuration'
        AND timestamp >= ?
    `, [recentTime.toISOString()]);

    for (const row of result) {
      await this.createAlert({
        tenantId: row.tenant_id,
        ruleId: rule.id,
        ruleName: rule.name,
        severity: rule.severity,
        description: `Configuration change detected: ${row.action}`,
        details: JSON.parse(row.details || '{}')
      });
    }
  }

  /**
   * Check for bulk delete operations
   */
  async checkBulkDeletes(rule) {
    const timeWindow = new Date();
    timeWindow.setSeconds(timeWindow.getSeconds() - rule.timeWindow);

    const result = await this.db.all(`
      SELECT user_id, tenant_id, COUNT(*) as delete_count
      FROM audit_logs
      WHERE action LIKE '%delete%'
        AND timestamp >= ?
      GROUP BY user_id, tenant_id
      HAVING delete_count >= ?
    `, [timeWindow.toISOString(), rule.threshold]);

    for (const row of result) {
      await this.createAlert({
        tenantId: row.tenant_id,
        ruleId: rule.id,
        ruleName: rule.name,
        severity: rule.severity,
        description: `Bulk delete operation detected (${row.delete_count} deletes)`,
        details: {
          userId: row.user_id,
          deleteCount: row.delete_count,
          timeWindow: rule.timeWindow
        }
      });
    }
  }

  /**
   * Create security alert
   */
  async createAlert(alertData) {
    try {
      const alertId = `alert_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const now = new Date().toISOString();

      // Check if similar alert exists in last hour
      const existingAlert = await this.db.get(`
        SELECT id, event_count FROM security_alerts
        WHERE rule_id = ?
          AND tenant_id = ?
          AND status = 'active'
          AND timestamp >= ?
      `, [
        alertData.ruleId,
        alertData.tenantId || null,
        new Date(Date.now() - 3600000).toISOString() // 1 hour ago
      ]);

      if (existingAlert) {
        // Update existing alert
        await this.db.run(`
          UPDATE security_alerts
          SET event_count = event_count + 1,
              last_seen = ?,
              details = ?
          WHERE id = ?
        `, [
          now,
          JSON.stringify(alertData.details),
          existingAlert.id
        ]);

        this.logger.warn(`[SecurityMonitor] Updated existing alert: ${alertData.ruleName}`);
      } else {
        // Create new alert
        await this.db.run(`
          INSERT INTO security_alerts (
            id, timestamp, tenant_id, rule_id, rule_name,
            severity, status, description, details,
            first_seen, last_seen
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          alertId,
          now,
          alertData.tenantId || null,
          alertData.ruleId,
          alertData.ruleName,
          alertData.severity,
          'active',
          alertData.description,
          JSON.stringify(alertData.details),
          now,
          now
        ]);

        this.logger.warn(`[SecurityMonitor] 🚨 Created security alert: ${alertData.ruleName} - ${alertData.description}`);

        // Log alert creation to audit log
        if (this.auditLogger) {
          await this.auditLogger.log({
            tenantId: alertData.tenantId,
            category: 'security_scan',
            action: 'security_alert_created',
            severity: 'security',
            details: {
              alertId,
              ruleId: alertData.ruleId,
              ruleName: alertData.ruleName,
              description: alertData.description
            }
          });
        }
      }
    } catch (error) {
      this.logger.error('[SecurityMonitor] Error creating alert:', error);
    }
  }

  /**
   * Get alerts
   */
  async getAlerts(filters = {}, options = {}) {
    const { tenantId, severity, status = 'active' } = filters;
    const { page = 1, limit = 50 } = options;

    try {
      const conditions = ['status = ?'];
      const params = [status];

      if (tenantId) {
        conditions.push('tenant_id = ?');
        params.push(tenantId);
      }

      if (severity) {
        conditions.push('severity = ?');
        params.push(severity);
      }

      const whereClause = 'WHERE ' + conditions.join(' AND ');

      // Get total count
      const countResult = await this.db.get(`
        SELECT COUNT(*) as total FROM security_alerts ${whereClause}
      `, params);

      // Get paginated results
      const offset = (page - 1) * limit;
      const rows = await this.db.all(`
        SELECT * FROM security_alerts
        ${whereClause}
        ORDER BY timestamp DESC
        LIMIT ? OFFSET ?
      `, [...params, limit, offset]);

      const data = rows.map(row => ({
        ...row,
        details: row.details ? JSON.parse(row.details) : {}
      }));

      return {
        data,
        pagination: {
          page,
          limit,
          total: countResult.total,
          totalPages: Math.ceil(countResult.total / limit)
        }
      };
    } catch (error) {
      this.logger.error('[SecurityMonitor] Error getting alerts:', error);
      throw error;
    }
  }

  /**
   * Resolve alert
   */
  async resolveAlert(alertId, resolvedBy, notes) {
    try {
      await this.db.run(`
        UPDATE security_alerts
        SET status = 'resolved',
            resolved_at = ?,
            resolved_by = ?,
            notes = ?
        WHERE id = ?
      `, [new Date().toISOString(), resolvedBy, notes, alertId]);

      this.logger.info(`[SecurityMonitor] Alert ${alertId} resolved by ${resolvedBy}`);
    } catch (error) {
      this.logger.error('[SecurityMonitor] Error resolving alert:', error);
      throw error;
    }
  }

  /**
   * Get alert statistics
   */
  async getAlertStats(tenantId = null) {
    try {
      const conditions = tenantId ? ['tenant_id = ?'] : [];
      const params = tenantId ? [tenantId] : [];
      const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

      const stats = {
        total: 0,
        active: 0,
        resolved: 0,
        bySeverity: {},
        byRule: []
      };

      // Total counts
      const totals = await this.db.get(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved
        FROM security_alerts ${whereClause}
      `, params);

      stats.total = totals.total;
      stats.active = totals.active;
      stats.resolved = totals.resolved;

      // By severity
      const bySeverity = await this.db.all(`
        SELECT severity, COUNT(*) as count
        FROM security_alerts ${whereClause}
        GROUP BY severity
      `, params);

      for (const row of bySeverity) {
        stats.bySeverity[row.severity] = row.count;
      }

      // By rule
      stats.byRule = await this.db.all(`
        SELECT rule_id, rule_name, COUNT(*) as count
        FROM security_alerts ${whereClause}
        GROUP BY rule_id, rule_name
        ORDER BY count DESC
        LIMIT 10
      `, params);

      return stats;
    } catch (error) {
      this.logger.error('[SecurityMonitor] Error getting alert stats:', error);
      throw error;
    }
  }

  /**
   * Cleanup on shutdown
   */
  async cleanup() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }
    this.logger.info('[SecurityMonitor] Cleanup complete');
  }
}

module.exports = SecurityMonitor;
