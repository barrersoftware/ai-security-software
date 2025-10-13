/**
 * AuditLogger Service
 * 
 * Core service for recording audit events to database and file system.
 * Handles sensitive data masking, event validation, and persistent storage.
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class AuditLogger {
  constructor(db, logger) {
    this.db = db;
    this.logger = logger;
    this.dataDir = path.join(process.cwd(), 'data', 'audit-logs');
    this.bufferSize = 100; // Flush to disk after this many events
    this.buffer = [];
    this.flushInterval = null;
    this.retentionDays = 90; // Default retention: 90 days
    
    // Sensitive fields to mask in logs
    this.sensitiveFields = [
      'password',
      'token',
      'apiKey',
      'secret',
      'privateKey',
      'accessToken',
      'refreshToken',
      'sessionId',
      'cookie'
    ];
  }

  /**
   * Initialize the audit logger
   */
  async init() {
    this.logger.info('[AuditLogger] Initializing...');
    
    // Create data directory
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch (error) {
      this.logger.error('[AuditLogger] Failed to create data directory:', error);
    }

    // Start periodic flush
    this.flushInterval = setInterval(() => {
      this.flushBuffer();
    }, 30000); // Flush every 30 seconds

    // Clean up old logs
    await this.cleanupOldLogs();

    this.logger.info('[AuditLogger] ✅ Initialized');
  }

  /**
   * Log an audit event
   */
  async log(event) {
    try {
      // Validate required fields
      if (!event.category || !event.action) {
        throw new Error('Category and action are required');
      }

      // Create audit entry
      const auditEntry = {
        id: this.generateId(),
        timestamp: new Date().toISOString(),
        tenantId: event.tenantId || null,
        userId: event.userId || null,
        category: event.category,
        action: event.action,
        severity: event.severity || 'info',
        details: this.maskSensitiveData(event.details || {}),
        metadata: this.maskSensitiveData(event.metadata || {}),
        ipAddress: event.ipAddress || null,
        userAgent: event.userAgent || null,
        success: event.success !== false, // Default to true
        errorMessage: event.errorMessage || null
      };

      // Add to buffer
      this.buffer.push(auditEntry);

      // Flush if buffer is full
      if (this.buffer.length >= this.bufferSize) {
        await this.flushBuffer();
      }

      return auditEntry.id;
    } catch (error) {
      this.logger.error('[AuditLogger] Error logging event:', error);
      throw error;
    }
  }

  /**
   * Log authentication event
   */
  async logAuth(data) {
    return this.log({
      category: 'authentication',
      action: data.action,
      tenantId: data.tenantId,
      userId: data.userId,
      severity: data.success ? 'info' : 'security',
      success: data.success,
      details: {
        username: data.username,
        method: data.method || 'password',
        reason: data.reason
      },
      ipAddress: data.ipAddress,
      userAgent: data.userAgent
    });
  }

  /**
   * Log authorization event
   */
  async logAuthz(data) {
    return this.log({
      category: 'authorization',
      action: data.action,
      tenantId: data.tenantId,
      userId: data.userId,
      severity: data.granted ? 'info' : 'warning',
      success: data.granted,
      details: {
        resource: data.resource,
        permission: data.permission,
        reason: data.reason
      }
    });
  }

  /**
   * Log user management event
   */
  async logUserManagement(data) {
    return this.log({
      category: 'user_management',
      action: data.action,
      tenantId: data.tenantId,
      userId: data.userId,
      severity: 'info',
      details: {
        targetUserId: data.targetUserId,
        targetUsername: data.targetUsername,
        changes: data.changes
      }
    });
  }

  /**
   * Log tenant management event
   */
  async logTenantManagement(data) {
    return this.log({
      category: 'tenant_management',
      action: data.action,
      tenantId: data.tenantId,
      userId: data.userId,
      severity: 'info',
      details: {
        targetTenantId: data.targetTenantId,
        targetTenantName: data.targetTenantName,
        changes: data.changes
      }
    });
  }

  /**
   * Log configuration change
   */
  async logConfigChange(data) {
    return this.log({
      category: 'configuration',
      action: data.action,
      tenantId: data.tenantId,
      userId: data.userId,
      severity: 'warning',
      details: {
        configKey: data.configKey,
        oldValue: this.maskSensitiveData(data.oldValue),
        newValue: this.maskSensitiveData(data.newValue),
        scope: data.scope
      }
    });
  }

  /**
   * Log data access event
   */
  async logDataAccess(data) {
    return this.log({
      category: 'data_access',
      action: data.action,
      tenantId: data.tenantId,
      userId: data.userId,
      severity: 'info',
      details: {
        dataType: data.dataType,
        dataId: data.dataId,
        operation: data.operation,
        recordCount: data.recordCount
      }
    });
  }

  /**
   * Log security scan event
   */
  async logSecurityScan(data) {
    return this.log({
      category: 'security_scan',
      action: data.action,
      tenantId: data.tenantId,
      userId: data.userId,
      severity: data.severity || 'info',
      details: {
        scanId: data.scanId,
        target: data.target,
        scanType: data.scanType,
        result: data.result,
        vulnerabilitiesFound: data.vulnerabilitiesFound
      }
    });
  }

  /**
   * Log system change event
   */
  async logSystemChange(data) {
    return this.log({
      category: 'system_changes',
      action: data.action,
      tenantId: data.tenantId,
      userId: data.userId,
      severity: 'warning',
      details: {
        component: data.component,
        changeType: data.changeType,
        description: data.description
      }
    });
  }

  /**
   * Flush buffer to database and file
   */
  async flushBuffer() {
    if (this.buffer.length === 0) return;

    const events = [...this.buffer];
    this.buffer = [];

    try {
      // Write to database
      await this.writeToDatabase(events);

      // Write to file for backup
      await this.writeToFile(events);

      this.logger.info(`[AuditLogger] Flushed ${events.length} audit events`);
    } catch (error) {
      this.logger.error('[AuditLogger] Error flushing buffer:', error);
      // Put events back in buffer to retry
      this.buffer.unshift(...events);
    }
  }

  /**
   * Write events to database
   */
  async writeToDatabase(events) {
    if (!this.db) return;

    try {
      for (const event of events) {
        await this.db.run(`
          INSERT INTO audit_logs (
            id, timestamp, tenant_id, user_id, category, action,
            severity, details, metadata, ip_address, user_agent,
            success, error_message
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          event.id,
          event.timestamp,
          event.tenantId,
          event.userId,
          event.category,
          event.action,
          event.severity,
          JSON.stringify(event.details),
          JSON.stringify(event.metadata),
          event.ipAddress,
          event.userAgent,
          event.success ? 1 : 0,
          event.errorMessage
        ]);
      }
    } catch (error) {
      // If table doesn't exist, create it
      if (error.message.includes('no such table')) {
        await this.createTable();
        // Retry insert
        await this.writeToDatabase(events);
      } else {
        throw error;
      }
    }
  }

  /**
   * Create audit_logs table
   */
  async createTable() {
    if (!this.db) return;

    await this.db.run(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        tenant_id TEXT,
        user_id TEXT,
        category TEXT NOT NULL,
        action TEXT NOT NULL,
        severity TEXT NOT NULL,
        details TEXT,
        metadata TEXT,
        ip_address TEXT,
        user_agent TEXT,
        success INTEGER DEFAULT 1,
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for common queries
    await this.db.run('CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_logs(tenant_id)');
    await this.db.run('CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id)');
    await this.db.run('CREATE INDEX IF NOT EXISTS idx_audit_category ON audit_logs(category)');
    await this.db.run('CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp)');
    await this.db.run('CREATE INDEX IF NOT EXISTS idx_audit_severity ON audit_logs(severity)');

    this.logger.info('[AuditLogger] Created audit_logs table with indexes');
  }

  /**
   * Write events to daily log file
   */
  async writeToFile(events) {
    const today = new Date().toISOString().split('T')[0];
    const filename = path.join(this.dataDir, `audit-${today}.jsonl`);

    const lines = events.map(event => JSON.stringify(event)).join('\n') + '\n';

    try {
      await fs.appendFile(filename, lines);
    } catch (error) {
      this.logger.error('[AuditLogger] Error writing to file:', error);
    }
  }

  /**
   * Mask sensitive data in objects
   */
  maskSensitiveData(obj) {
    if (!obj || typeof obj !== 'object') return obj;

    const masked = Array.isArray(obj) ? [] : {};

    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      
      // Check if field is sensitive
      const isSensitive = this.sensitiveFields.some(field => 
        lowerKey.includes(field.toLowerCase())
      );

      if (isSensitive && value) {
        masked[key] = '***MASKED***';
      } else if (typeof value === 'object' && value !== null) {
        masked[key] = this.maskSensitiveData(value);
      } else {
        masked[key] = value;
      }
    }

    return masked;
  }

  /**
   * Generate unique ID for audit event
   */
  generateId() {
    return `audit_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Clean up old audit logs
   */
  async cleanupOldLogs() {
    if (!this.db) return;

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);
      const cutoff = cutoffDate.toISOString();

      const result = await this.db.run(
        'DELETE FROM audit_logs WHERE timestamp < ?',
        [cutoff]
      );

      if (result.changes > 0) {
        this.logger.info(`[AuditLogger] Cleaned up ${result.changes} old audit logs`);
      }

      // Clean up old log files
      const files = await fs.readdir(this.dataDir);
      for (const file of files) {
        if (file.startsWith('audit-') && file.endsWith('.jsonl')) {
          const datePart = file.substring(6, 16); // Extract YYYY-MM-DD
          const fileDate = new Date(datePart);
          
          if (fileDate < cutoffDate) {
            await fs.unlink(path.join(this.dataDir, file));
            this.logger.info(`[AuditLogger] Deleted old log file: ${file}`);
          }
        }
      }
    } catch (error) {
      this.logger.error('[AuditLogger] Error cleaning up old logs:', error);
    }
  }

  /**
   * Cleanup on shutdown
   */
  async cleanup() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }

    // Final flush
    await this.flushBuffer();

    this.logger.info('[AuditLogger] Cleanup complete');
  }
}

module.exports = AuditLogger;
