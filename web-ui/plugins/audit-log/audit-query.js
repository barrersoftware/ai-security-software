/**
 * AuditQuery Service
 * 
 * Provides advanced querying, searching, and filtering of audit logs.
 * Supports pagination, sorting, and complex search criteria.
 */

class AuditQuery {
  constructor(db, logger) {
    this.db = db;
    this.logger = logger;
  }

  /**
   * Query audit logs with filters and pagination
   */
  async queryLogs(filters = {}, options = {}) {
    const {
      tenantId,
      category,
      severity,
      userId,
      startDate,
      endDate
    } = filters;

    const {
      page = 1,
      limit = 50,
      sort = '-timestamp'
    } = options;

    try {
      // Build WHERE clause
      const conditions = [];
      const params = [];

      if (tenantId) {
        conditions.push('tenant_id = ?');
        params.push(tenantId);
      }

      if (category) {
        conditions.push('category = ?');
        params.push(category);
      }

      if (severity) {
        conditions.push('severity = ?');
        params.push(severity);
      }

      if (userId) {
        conditions.push('user_id = ?');
        params.push(userId);
      }

      if (startDate) {
        conditions.push('timestamp >= ?');
        params.push(startDate);
      }

      if (endDate) {
        conditions.push('timestamp <= ?');
        params.push(endDate);
      }

      const whereClause = conditions.length > 0 
        ? 'WHERE ' + conditions.join(' AND ')
        : '';

      // Determine sort order
      const sortField = sort.startsWith('-') ? sort.substring(1) : sort;
      const sortOrder = sort.startsWith('-') ? 'DESC' : 'ASC';

      // Get total count
      const countQuery = `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`;
      const countResult = await this.db.get(countQuery, params);
      const total = countResult.total;

      // Get paginated results
      const offset = (page - 1) * limit;
      const dataQuery = `
        SELECT * FROM audit_logs 
        ${whereClause}
        ORDER BY ${sortField} ${sortOrder}
        LIMIT ? OFFSET ?
      `;
      
      const rows = await this.db.all(dataQuery, [...params, limit, offset]);

      // Parse JSON fields
      const data = rows.map(row => ({
        ...row,
        details: row.details ? JSON.parse(row.details) : {},
        metadata: row.metadata ? JSON.parse(row.metadata) : {},
        success: row.success === 1
      }));

      return {
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: page * limit < total
        }
      };
    } catch (error) {
      this.logger.error('[AuditQuery] Error querying logs:', error);
      throw error;
    }
  }

  /**
   * Get a single audit event by ID
   */
  async getEvent(id) {
    try {
      const row = await this.db.get(
        'SELECT * FROM audit_logs WHERE id = ?',
        [id]
      );

      if (!row) return null;

      return {
        ...row,
        details: row.details ? JSON.parse(row.details) : {},
        metadata: row.metadata ? JSON.parse(row.metadata) : {},
        success: row.success === 1
      };
    } catch (error) {
      this.logger.error('[AuditQuery] Error getting event:', error);
      throw error;
    }
  }

  /**
   * Get security-specific events
   */
  async getSecurityEvents(filters = {}, options = {}) {
    const { tenantId, startDate, endDate } = filters;
    const { page = 1, limit = 50 } = options;

    const securityCategories = ['authentication', 'authorization', 'security_scan'];

    try {
      const conditions = ['category IN (?, ?, ?)'];
      const params = securityCategories;

      if (tenantId) {
        conditions.push('tenant_id = ?');
        params.push(tenantId);
      }

      if (startDate) {
        conditions.push('timestamp >= ?');
        params.push(startDate);
      }

      if (endDate) {
        conditions.push('timestamp <= ?');
        params.push(endDate);
      }

      const whereClause = 'WHERE ' + conditions.join(' AND ');

      // Get total count
      const countQuery = `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`;
      const countResult = await this.db.get(countQuery, params);
      const total = countResult.total;

      // Get paginated results
      const offset = (page - 1) * limit;
      const dataQuery = `
        SELECT * FROM audit_logs 
        ${whereClause}
        ORDER BY timestamp DESC
        LIMIT ? OFFSET ?
      `;
      
      const rows = await this.db.all(dataQuery, [...params, limit, offset]);

      const data = rows.map(row => ({
        ...row,
        details: row.details ? JSON.parse(row.details) : {},
        metadata: row.metadata ? JSON.parse(row.metadata) : {},
        success: row.success === 1
      }));

      return {
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: page * limit < total
        }
      };
    } catch (error) {
      this.logger.error('[AuditQuery] Error getting security events:', error);
      throw error;
    }
  }

  /**
   * Get user activity trail
   */
  async getUserActivity(userId, filters = {}, options = {}) {
    const { startDate, endDate } = filters;
    const { page = 1, limit = 50 } = options;

    try {
      const conditions = ['user_id = ?'];
      const params = [userId];

      if (startDate) {
        conditions.push('timestamp >= ?');
        params.push(startDate);
      }

      if (endDate) {
        conditions.push('timestamp <= ?');
        params.push(endDate);
      }

      const whereClause = 'WHERE ' + conditions.join(' AND ');

      // Get total count
      const countQuery = `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`;
      const countResult = await this.db.get(countQuery, params);
      const total = countResult.total;

      // Get paginated results
      const offset = (page - 1) * limit;
      const dataQuery = `
        SELECT * FROM audit_logs 
        ${whereClause}
        ORDER BY timestamp DESC
        LIMIT ? OFFSET ?
      `;
      
      const rows = await this.db.all(dataQuery, [...params, limit, offset]);

      const data = rows.map(row => ({
        ...row,
        details: row.details ? JSON.parse(row.details) : {},
        metadata: row.metadata ? JSON.parse(row.metadata) : {},
        success: row.success === 1
      }));

      // Get activity summary
      const summary = await this.getUserActivitySummary(userId, { startDate, endDate });

      return {
        data,
        summary,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: page * limit < total
        }
      };
    } catch (error) {
      this.logger.error('[AuditQuery] Error getting user activity:', error);
      throw error;
    }
  }

  /**
   * Get user activity summary
   */
  async getUserActivitySummary(userId, filters = {}) {
    const { startDate, endDate } = filters;

    try {
      const conditions = ['user_id = ?'];
      const params = [userId];

      if (startDate) {
        conditions.push('timestamp >= ?');
        params.push(startDate);
      }

      if (endDate) {
        conditions.push('timestamp <= ?');
        params.push(endDate);
      }

      const whereClause = 'WHERE ' + conditions.join(' AND ');

      // Get activity counts by category
      const categoryCounts = await this.db.all(`
        SELECT category, COUNT(*) as count
        FROM audit_logs
        ${whereClause}
        GROUP BY category
        ORDER BY count DESC
      `, params);

      // Get last activity
      const lastActivity = await this.db.get(`
        SELECT timestamp, category, action
        FROM audit_logs
        ${whereClause}
        ORDER BY timestamp DESC
        LIMIT 1
      `, params);

      // Get total actions
      const totalResult = await this.db.get(`
        SELECT COUNT(*) as total
        FROM audit_logs
        ${whereClause}
      `, params);

      return {
        totalActions: totalResult.total,
        byCategory: categoryCounts,
        lastActivity: lastActivity ? {
          timestamp: lastActivity.timestamp,
          category: lastActivity.category,
          action: lastActivity.action
        } : null
      };
    } catch (error) {
      this.logger.error('[AuditQuery] Error getting activity summary:', error);
      throw error;
    }
  }

  /**
   * Export audit logs
   */
  async exportLogs(filters = {}) {
    const { tenantId, startDate, endDate } = filters;

    try {
      const conditions = [];
      const params = [];

      if (tenantId) {
        conditions.push('tenant_id = ?');
        params.push(tenantId);
      }

      if (startDate) {
        conditions.push('timestamp >= ?');
        params.push(startDate);
      }

      if (endDate) {
        conditions.push('timestamp <= ?');
        params.push(endDate);
      }

      const whereClause = conditions.length > 0 
        ? 'WHERE ' + conditions.join(' AND ')
        : '';

      const query = `
        SELECT * FROM audit_logs 
        ${whereClause}
        ORDER BY timestamp DESC
        LIMIT 10000
      `;

      const rows = await this.db.all(query, params);

      return rows.map(row => ({
        ...row,
        details: row.details ? JSON.parse(row.details) : {},
        metadata: row.metadata ? JSON.parse(row.metadata) : {},
        success: row.success === 1
      }));
    } catch (error) {
      this.logger.error('[AuditQuery] Error exporting logs:', error);
      throw error;
    }
  }

  /**
   * Get audit log statistics
   */
  async getStatistics(filters = {}) {
    const { tenantId, startDate, endDate } = filters;

    try {
      const conditions = [];
      const params = [];

      if (tenantId) {
        conditions.push('tenant_id = ?');
        params.push(tenantId);
      }

      if (startDate) {
        conditions.push('timestamp >= ?');
        params.push(startDate);
      }

      if (endDate) {
        conditions.push('timestamp <= ?');
        params.push(endDate);
      }

      const whereClause = conditions.length > 0 
        ? 'WHERE ' + conditions.join(' AND ')
        : '';

      // Total events
      const totalResult = await this.db.get(`
        SELECT COUNT(*) as total FROM audit_logs ${whereClause}
      `, params);

      // Events by category
      const byCategory = await this.db.all(`
        SELECT category, COUNT(*) as count
        FROM audit_logs ${whereClause}
        GROUP BY category
        ORDER BY count DESC
      `, params);

      // Events by severity
      const bySeverity = await this.db.all(`
        SELECT severity, COUNT(*) as count
        FROM audit_logs ${whereClause}
        GROUP BY severity
        ORDER BY count DESC
      `, params);

      // Success rate
      const successResult = await this.db.get(`
        SELECT 
          SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
          SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed
        FROM audit_logs ${whereClause}
      `, params);

      // Top users
      const topUsers = await this.db.all(`
        SELECT user_id, COUNT(*) as count
        FROM audit_logs
        ${whereClause}
        GROUP BY user_id
        ORDER BY count DESC
        LIMIT 10
      `, params);

      // Events over time (daily)
      const timeline = await this.db.all(`
        SELECT 
          DATE(timestamp) as date,
          COUNT(*) as count
        FROM audit_logs ${whereClause}
        GROUP BY DATE(timestamp)
        ORDER BY date DESC
        LIMIT 30
      `, params);

      return {
        total: totalResult.total,
        byCategory,
        bySeverity,
        successRate: totalResult.total > 0 
          ? (successResult.successful / totalResult.total * 100).toFixed(2)
          : 0,
        successful: successResult.successful,
        failed: successResult.failed,
        topUsers,
        timeline
      };
    } catch (error) {
      this.logger.error('[AuditQuery] Error getting statistics:', error);
      throw error;
    }
  }

  /**
   * Advanced search with complex queries
   */
  async advancedSearch(searchParams = {}, options = {}) {
    const { tenantId, query } = searchParams;
    const { page = 1, limit = 50 } = options;

    try {
      // Parse query (simple keyword search for now)
      const conditions = [];
      const params = [];

      if (tenantId) {
        conditions.push('tenant_id = ?');
        params.push(tenantId);
      }

      if (query) {
        // Search in action, details, and metadata
        conditions.push(`(
          action LIKE ? OR 
          details LIKE ? OR 
          metadata LIKE ?
        )`);
        const searchTerm = `%${query}%`;
        params.push(searchTerm, searchTerm, searchTerm);
      }

      const whereClause = conditions.length > 0 
        ? 'WHERE ' + conditions.join(' AND ')
        : '';

      // Get total count
      const countQuery = `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`;
      const countResult = await this.db.get(countQuery, params);
      const total = countResult.total;

      // Get paginated results
      const offset = (page - 1) * limit;
      const dataQuery = `
        SELECT * FROM audit_logs 
        ${whereClause}
        ORDER BY timestamp DESC
        LIMIT ? OFFSET ?
      `;
      
      const rows = await this.db.all(dataQuery, [...params, limit, offset]);

      const data = rows.map(row => ({
        ...row,
        details: row.details ? JSON.parse(row.details) : {},
        metadata: row.metadata ? JSON.parse(row.metadata) : {},
        success: row.success === 1
      }));

      return {
        data,
        query,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: page * limit < total
        }
      };
    } catch (error) {
      this.logger.error('[AuditQuery] Error in advanced search:', error);
      throw error;
    }
  }

  /**
   * Convert logs to CSV format
   */
  toCSV(logs) {
    if (!logs || logs.length === 0) {
      return 'No data';
    }

    // CSV headers
    const headers = [
      'ID',
      'Timestamp',
      'Tenant ID',
      'User ID',
      'Category',
      'Action',
      'Severity',
      'Success',
      'IP Address',
      'User Agent'
    ];

    const rows = [headers.join(',')];

    for (const log of logs) {
      const row = [
        log.id,
        log.timestamp,
        log.tenant_id || log.tenantId || '',
        log.user_id || log.userId || '',
        log.category,
        log.action,
        log.severity,
        log.success ? 'Yes' : 'No',
        log.ip_address || log.ipAddress || '',
        log.user_agent || log.userAgent || ''
      ];

      // Escape and quote fields
      const escapedRow = row.map(field => {
        const str = String(field || '');
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      });

      rows.push(escapedRow.join(','));
    }

    return rows.join('\n');
  }
}

module.exports = AuditQuery;
