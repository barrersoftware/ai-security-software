/**
 * Enhanced Audit Logging Plugin
 * 
 * Provides comprehensive audit trail logging for security, compliance, and forensics.
 * Tracks all user actions, security events, and system changes.
 */

const express = require('express');

class AuditLogPlugin {
  constructor() {
    this.name = 'audit-log';
    this.version = '1.0.0';
    this.logger = null;
    this.auditLogger = null;
    this.auditQuery = null;
    this.complianceReporter = null;
    this.securityMonitor = null;
    this.auditMiddleware = null;
  }

  /**
   * Initialize the audit logging plugin
   */
  async init(context) {
    this.logger = context.logger;
    this.db = context.db;
    this.services = context.services;
    
    this.logger.info('[AuditLog] Initializing Enhanced Audit Logging plugin...');

    // Load services
    const AuditLogger = require('./audit-logger');
    const AuditQuery = require('./audit-query');
    const ComplianceReporter = require('./compliance-reporter');
    const SecurityMonitor = require('./security-monitor');
    const AuditMiddleware = require('./audit-middleware');

    // Initialize services
    this.auditLogger = new AuditLogger(this.db, this.logger);
    this.auditQuery = new AuditQuery(this.db, this.logger);
    this.complianceReporter = new ComplianceReporter(this.db, this.logger);
    // TEMPORARY: Disabled security monitor due to DB issues
    // this.securityMonitor = new SecurityMonitor(this.db, this.logger, this.auditLogger);
    this.auditMiddleware = new AuditMiddleware(this.auditLogger, this.logger);

    await this.auditLogger.init();
    // TEMPORARY: Disabled security monitor
    // await this.securityMonitor.init();

    // Register services
    context.services.register('AuditLogger', this.auditLogger);
    context.services.register('AuditQuery', this.auditQuery);
    context.services.register('ComplianceReporter', this.complianceReporter);
    // context.services.register('SecurityMonitor', this.securityMonitor);
    context.services.register('AuditMiddleware', this.auditMiddleware);

    this.logger.info('[AuditLog] ✅ Enhanced Audit Logging plugin initialized (SecurityMonitor temporarily disabled)');
    this.logger.info('[AuditLog] 📡 Global audit middleware available via middleware()');
    
    return true;
  }
  
  /**
   * Get middleware for automatic audit logging
   */
  middleware() {
    if (!this.auditMiddleware) {
      this.logger.warn('[AuditLog] Middleware requested before initialization');
      return (req, res, next) => next();
    }
    // Return the middleware function directly
    return this.auditMiddleware.middleware();
  }

  /**
   * Register API routes
   */
  routes(app) {
    const router = express.Router();

    // Helper to check authentication
    const requireAuth = (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      next();
    };

    // Helper to check admin role
    const requireAdmin = (req, res, next) => {
      if (!req.user || !req.user.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }
      next();
    };

    // Helper to check auditor role
    const requireAuditor = (req, res, next) => {
      if (!req.user || (!req.user.isAdmin && req.user.role !== 'auditor')) {
        return res.status(403).json({ error: 'Auditor or admin access required' });
      }
      next();
    };

    /**
     * GET /api/audit/logs
     * Query audit logs with filtering and pagination
     */
    router.get('/logs', requireAuth, requireAuditor, async (req, res) => {
      try {
        const {
          tenantId = req.user.tenantId,
          category,
          severity,
          userId,
          startDate,
          endDate,
          page = 1,
          limit = 50,
          sort = '-timestamp'
        } = req.query;

        // Admin can query all tenants, users can only query their own
        const effectiveTenantId = req.user.isAdmin ? tenantId : req.user.tenantId;

        const filters = {
          tenantId: effectiveTenantId,
          category,
          severity,
          userId,
          startDate,
          endDate
        };

        const result = await this.auditQuery.queryLogs(filters, {
          page: parseInt(page),
          limit: parseInt(limit),
          sort
        });

        // Log this audit query
        await this.auditLogger.log({
          tenantId: req.user.tenantId,
          userId: req.user.id,
          category: 'data_access',
          action: 'audit_logs_queried',
          severity: 'info',
          details: { filters, resultCount: result.data.length }
        });

        res.json(result);
      } catch (error) {
        this.logger.error('[AuditLog] Error querying logs:', error);
        res.status(500).json({ error: 'Failed to query audit logs' });
      }
    });

    /**
     * GET /api/audit/events/:id
     * Get details of a specific audit event
     */
    router.get('/events/:id', requireAuth, requireAuditor, async (req, res) => {
      try {
        const { id } = req.params;
        const event = await this.auditQuery.getEvent(id);

        if (!event) {
          return res.status(404).json({ error: 'Audit event not found' });
        }

        // Check tenant access
        if (!req.user.isAdmin && event.tenantId !== req.user.tenantId) {
          return res.status(403).json({ error: 'Access denied' });
        }

        // Log this access
        await this.auditLogger.log({
          tenantId: req.user.tenantId,
          userId: req.user.id,
          category: 'data_access',
          action: 'audit_event_viewed',
          severity: 'info',
          details: { eventId: id }
        });

        res.json(event);
      } catch (error) {
        this.logger.error('[AuditLog] Error getting event:', error);
        res.status(500).json({ error: 'Failed to get audit event' });
      }
    });

    /**
     * GET /api/audit/security-events
     * Get security-specific events (logins, failures, permission changes)
     */
    router.get('/security-events', requireAuth, requireAdmin, async (req, res) => {
      try {
        const {
          tenantId,
          startDate,
          endDate,
          page = 1,
          limit = 50
        } = req.query;

        const events = await this.auditQuery.getSecurityEvents({
          tenantId,
          startDate,
          endDate
        }, {
          page: parseInt(page),
          limit: parseInt(limit)
        });

        res.json(events);
      } catch (error) {
        this.logger.error('[AuditLog] Error getting security events:', error);
        res.status(500).json({ error: 'Failed to get security events' });
      }
    });

    /**
     * GET /api/audit/user-activity/:userId
     * Get audit trail for a specific user
     */
    router.get('/user-activity/:userId', requireAuth, requireAuditor, async (req, res) => {
      try {
        const { userId } = req.params;
        const {
          startDate,
          endDate,
          page = 1,
          limit = 50
        } = req.query;

        const activity = await this.auditQuery.getUserActivity(userId, {
          startDate,
          endDate
        }, {
          page: parseInt(page),
          limit: parseInt(limit)
        });

        // Check tenant access for the target user
        if (!req.user.isAdmin && activity.data.length > 0) {
          const firstEvent = activity.data[0];
          if (firstEvent.tenantId !== req.user.tenantId) {
            return res.status(403).json({ error: 'Access denied' });
          }
        }

        res.json(activity);
      } catch (error) {
        this.logger.error('[AuditLog] Error getting user activity:', error);
        res.status(500).json({ error: 'Failed to get user activity' });
      }
    });

    /**
     * GET /api/audit/compliance/report
     * Generate compliance report for specified standard
     */
    router.get('/compliance/report', requireAuth, requireAdmin, async (req, res) => {
      try {
        const {
          standard = 'GDPR',
          tenantId,
          startDate,
          endDate,
          format = 'json'
        } = req.query;

        const report = await this.complianceReporter.generateReport({
          standard,
          tenantId,
          startDate,
          endDate
        });

        // Log report generation
        await this.auditLogger.log({
          tenantId: req.user.tenantId,
          userId: req.user.id,
          category: 'compliance',
          action: 'compliance_report_generated',
          severity: 'info',
          details: { standard, tenantId, startDate, endDate }
        });

        if (format === 'pdf') {
          // Use reporting plugin to generate PDF
          try {
            const reportingService = this.services.get('ReportGenerator');
            if (!reportingService) {
              throw new Error('Reporting service not available');
            }

            // Prepare report data
            const reportData = {
              name: `Compliance Report - ${standard}`,
              description: `${standard} compliance report from ${startDate} to ${endDate}`,
              template: 'compliance_report',
              format: 'pdf',
              data: {
                standard,
                report,
                generatedDate: new Date().toISOString(),
                tenantId,
                dateRange: { start: startDate, end: endDate }
              },
              options: {
                includeCharts: true,
                pageSize: 'A4'
              },
              generatedBy: req.user.id
            };

            const result = await reportingService.generateReport(tenantId, reportData);
            
            // Return the PDF file
            const filePath = result.file_path || `reports/${result.id}.pdf`;
            res.download(filePath, `compliance-report-${standard}-${Date.now()}.pdf`);
          } catch (error) {
            this.logger.error('[AuditLog] Error generating PDF report:', error);
            // Fallback to JSON if PDF generation fails
            this.logger.warn('[AuditLog] Falling back to JSON format');
            res.json(report);
          }
        } else if (format === 'csv') {
          // Convert to CSV
          const csv = this.complianceReporter.toCSV(report);
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename="compliance-report-${standard}-${Date.now()}.csv"`);
          res.send(csv);
        } else {
          res.json(report);
        }
      } catch (error) {
        this.logger.error('[AuditLog] Error generating compliance report:', error);
        res.status(500).json({ error: 'Failed to generate compliance report' });
      }
    });

    /**
     * GET /api/audit/export
     * Export audit logs in various formats
     */
    router.get('/export', requireAuth, requireAuditor, async (req, res) => {
      try {
        const {
          tenantId = req.user.tenantId,
          startDate,
          endDate,
          format = 'json'
        } = req.query;

        // Admin can export all tenants, users can only export their own
        const effectiveTenantId = req.user.isAdmin ? tenantId : req.user.tenantId;

        const logs = await this.auditQuery.exportLogs({
          tenantId: effectiveTenantId,
          startDate,
          endDate
        });

        // Log the export
        await this.auditLogger.log({
          tenantId: req.user.tenantId,
          userId: req.user.id,
          category: 'data_access',
          action: 'audit_logs_exported',
          severity: 'info',
          details: { format, recordCount: logs.length, startDate, endDate }
        });

        if (format === 'csv') {
          const csv = this.auditQuery.toCSV(logs);
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${Date.now()}.csv"`);
          res.send(csv);
        } else if (format === 'json') {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${Date.now()}.json"`);
          res.json(logs);
        } else {
          res.status(400).json({ error: 'Unsupported format. Use json or csv.' });
        }
      } catch (error) {
        this.logger.error('[AuditLog] Error exporting logs:', error);
        res.status(500).json({ error: 'Failed to export audit logs' });
      }
    });

    /**
     * GET /api/audit/statistics
     * Get audit log statistics and summaries
     */
    router.get('/statistics', requireAuth, requireAdmin, async (req, res) => {
      try {
        const {
          tenantId,
          startDate,
          endDate
        } = req.query;

        const stats = await this.auditQuery.getStatistics({
          tenantId,
          startDate,
          endDate
        });

        res.json(stats);
      } catch (error) {
        this.logger.error('[AuditLog] Error getting statistics:', error);
        res.status(500).json({ error: 'Failed to get audit statistics' });
      }
    });

    /**
     * GET /api/audit/alerts
     * Get security alerts triggered by audit monitoring
     */
    router.get('/alerts', requireAuth, requireAdmin, async (req, res) => {
      try {
        const {
          tenantId,
          severity,
          status = 'active',
          page = 1,
          limit = 50
        } = req.query;

        const alerts = await this.securityMonitor.getAlerts({
          tenantId,
          severity,
          status
        }, {
          page: parseInt(page),
          limit: parseInt(limit)
        });

        res.json(alerts);
      } catch (error) {
        this.logger.error('[AuditLog] Error getting alerts:', error);
        res.status(500).json({ error: 'Failed to get security alerts' });
      }
    });

    /**
     * POST /api/audit/search
     * Advanced search of audit logs with complex queries
     */
    router.post('/search', requireAuth, requireAuditor, async (req, res) => {
      try {
        const {
          tenantId = req.user.tenantId,
          query,
          page = 1,
          limit = 50
        } = req.body;

        // Admin can search all tenants, users can only search their own
        const effectiveTenantId = req.user.isAdmin ? tenantId : req.user.tenantId;

        const results = await this.auditQuery.advancedSearch({
          tenantId: effectiveTenantId,
          query
        }, {
          page: parseInt(page),
          limit: parseInt(limit)
        });

        // Log the search
        await this.auditLogger.log({
          tenantId: req.user.tenantId,
          userId: req.user.id,
          category: 'data_access',
          action: 'audit_logs_searched',
          severity: 'info',
          details: { query: query, resultCount: results.data.length }
        });

        res.json(results);
      } catch (error) {
        this.logger.error('[AuditLog] Error searching logs:', error);
        res.status(500).json({ error: 'Failed to search audit logs' });
      }
    });

    app.use('/api/audit', router);
    
    this.logger.info('[AuditLog] ✅ Registered 9 audit API endpoints');
  }

  /**
   * Cleanup on plugin unload
   */
  async cleanup() {
    this.logger.info('[AuditLog] Cleaning up Enhanced Audit Logging plugin...');
    
    if (this.securityMonitor) {
      await this.securityMonitor.cleanup();
    }
    
    if (this.auditLogger) {
      await this.auditLogger.cleanup();
    }
    
    this.logger.info('[AuditLog] ✅ Enhanced Audit Logging plugin cleaned up');
  }
}

module.exports = AuditLogPlugin;
