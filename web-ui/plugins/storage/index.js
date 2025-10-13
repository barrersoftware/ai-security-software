/**
 * Storage Plugin
 * Backup, storage, and disaster recovery management with remote SFTP support
 */

const express = require('express');
const BackupService = require('./backup-service');
const ReportService = require('./report-service');

module.exports = {
  name: 'storage',
  version: '1.0.0',
  
  async init(core) {
    this.core = core;
    this.logger = core.getService('logger');
    this.config = core.getConfig('storage') || {};
    this.integrations = core.getService('integrations');
    
    // Initialize services
    this.backupService = new BackupService(core);
    this.reportService = new ReportService(core);
    
    await this.backupService.init();
    await this.reportService.init();
    
    // Register services
    core.registerService('backup', this.backupService);
    core.registerService('reports', this.reportService);
    
    this.logger.info('Storage plugin initialized');
  },
  
  routes() {
    const router = express.Router();
    
    // Get auth middleware
    const authPlugin = this.core.getPlugins().getAll().find(p => p.name === 'auth');
    const requireAuth = authPlugin ? authPlugin.instance.requireAuth.bind(authPlugin.instance) : null;
    const requireAdmin = authPlugin ? authPlugin.instance.requireAdmin.bind(authPlugin.instance) : null;
    
    // Get security middleware
    const securityMiddleware = this.core.getService('security-middleware');
    const rateLimiter = securityMiddleware?.rateLimiter;
    const sanitizeRequest = securityMiddleware?.sanitizeRequest;
    
    // Helper to apply middleware
    const applyMiddleware = (middleware) => {
      return middleware || ((req, res, next) => next());
    };
    
    // ===== BACKUP ROUTES =====
    
    // Create backup
    router.post('/api/storage/backup',
      applyMiddleware(requireAdmin),
      applyMiddleware(rateLimiter ? rateLimiter({ maxRequests: 5, windowMs: 60000 }) : null),
      async (req, res) => {
        try {
          const { name, encrypt, type } = req.body;
          
          const backup = await this.backupService.createBackup({
            name,
            encrypt: encrypt || false,
            type: type || 'manual'
          });
          
          res.json({
            success: true,
            data: backup
          });
          
          // Send notification if integrations available
          if (this.integrations) {
            await this.integrations.notify(
              `Backup created: ${backup.name} (${backup.sizeFormatted})`,
              { title: 'Backup Complete', priority: 'normal' }
            );
          }
        } catch (err) {
          this.logger.error('Backup creation failed:', err);
          res.status(500).json({ success: false, error: err.message });
        }
      }
    );
    
    // List backups
    router.get('/api/storage/backups',
      applyMiddleware(requireAuth),
      async (req, res) => {
        try {
          const backups = this.backupService.listBackups();
          res.json({
            success: true,
            data: backups
          });
        } catch (err) {
          this.logger.error('List backups failed:', err);
          res.status(500).json({ success: false, error: err.message });
        }
      }
    );
    
    // Get backup status
    router.get('/api/storage/backup/status',
      applyMiddleware(requireAuth),
      async (req, res) => {
        try {
          const status = this.backupService.getStatus();
          res.json({
            success: true,
            data: status
          });
        } catch (err) {
          this.logger.error('Get backup status failed:', err);
          res.status(500).json({ success: false, error: err.message });
        }
      }
    );
    
    // Restore backup
    router.post('/api/storage/backup/restore',
      applyMiddleware(requireAdmin),
      async (req, res) => {
        try {
          const { backupId } = req.body;
          
          if (!backupId) {
            return res.status(400).json({
              success: false,
              error: 'Backup ID required'
            });
          }
          
          const result = await this.backupService.restoreBackup(backupId);
          
          res.json({
            success: true,
            data: result
          });
          
          // Send notification
          if (this.integrations) {
            await this.integrations.notify(
              `Backup restored: ${result.backup.name}`,
              { title: 'Backup Restored', priority: 'high' }
            );
          }
        } catch (err) {
          this.logger.error('Restore backup failed:', err);
          res.status(500).json({ success: false, error: err.message });
        }
      }
    );
    
    // Delete backup
    router.delete('/api/storage/backup/:id',
      applyMiddleware(requireAdmin),
      async (req, res) => {
        try {
          await this.backupService.deleteBackup(req.params.id);
          res.json({
            success: true,
            message: 'Backup deleted successfully'
          });
        } catch (err) {
          this.logger.error('Delete backup failed:', err);
          res.status(500).json({ success: false, error: err.message });
        }
      }
    );
    
    // Apply retention policy
    router.post('/api/storage/backup/retention',
      applyMiddleware(requireAdmin),
      async (req, res) => {
        try {
          await this.backupService.applyRetentionPolicy();
          res.json({
            success: true,
            message: 'Retention policy applied'
          });
        } catch (err) {
          this.logger.error('Apply retention policy failed:', err);
          res.status(500).json({ success: false, error: err.message });
        }
      }
    );
    
    // ===== REPORT ROUTES =====
    
    // Save report
    router.post('/api/storage/report',
      applyMiddleware(requireAuth),
      applyMiddleware(sanitizeRequest),
      async (req, res) => {
        try {
          const report = await this.reportService.saveReport(req.body);
          res.json({
            success: true,
            data: {
              id: report.id,
              filename: report.filename,
              created: report.created
            }
          });
        } catch (err) {
          this.logger.error('Save report failed:', err);
          res.status(500).json({ success: false, error: err.message });
        }
      }
    );
    
    // Get report
    router.get('/api/storage/report/:id',
      applyMiddleware(requireAuth),
      async (req, res) => {
        try {
          const report = await this.reportService.getReport(req.params.id);
          res.json({
            success: true,
            data: report
          });
        } catch (err) {
          this.logger.error('Get report failed:', err);
          res.status(500).json({ success: false, error: err.message });
        }
      }
    );
    
    // List reports
    router.get('/api/storage/reports',
      applyMiddleware(requireAuth),
      async (req, res) => {
        try {
          const { type, from, to, page, limit } = req.query;
          const result = this.reportService.listReports({
            type,
            from,
            to,
            page: parseInt(page) || 1,
            limit: parseInt(limit) || 50
          });
          res.json({
            success: true,
            data: result
          });
        } catch (err) {
          this.logger.error('List reports failed:', err);
          res.status(500).json({ success: false, error: err.message });
        }
      }
    );
    
    // Delete report
    router.delete('/api/storage/report/:id',
      applyMiddleware(requireAuth),
      async (req, res) => {
        try {
          await this.reportService.deleteReport(req.params.id);
          res.json({
            success: true,
            message: 'Report deleted successfully'
          });
        } catch (err) {
          this.logger.error('Delete report failed:', err);
          res.status(500).json({ success: false, error: err.message });
        }
      }
    );
    
    // Clean old reports
    router.post('/api/storage/reports/clean',
      applyMiddleware(requireAdmin),
      async (req, res) => {
        try {
          const { days } = req.body;
          const deleted = await this.reportService.cleanOldReports(days || 90);
          res.json({
            success: true,
            data: { deleted }
          });
        } catch (err) {
          this.logger.error('Clean reports failed:', err);
          res.status(500).json({ success: false, error: err.message });
        }
      }
    );
    
    // Get report statistics
    router.get('/api/storage/reports/stats',
      applyMiddleware(requireAuth),
      async (req, res) => {
        try {
          const stats = this.reportService.getStatistics();
          res.json({
            success: true,
            data: stats
          });
        } catch (err) {
          this.logger.error('Get report stats failed:', err);
          res.status(500).json({ success: false, error: err.message });
        }
      }
    );
    
    // ===== STORAGE INFO =====
    
    // Get storage overview
    router.get('/api/storage/overview',
      applyMiddleware(requireAuth),
      async (req, res) => {
        try {
          const backupStatus = this.backupService.getStatus();
          const reportStats = this.reportService.getStatistics();
          
          res.json({
            success: true,
            data: {
              backups: backupStatus,
              reports: reportStats
            }
          });
        } catch (err) {
          this.logger.error('Get storage overview failed:', err);
          res.status(500).json({ success: false, error: err.message });
        }
      }
    );
    
    return router;
  },
  
  async destroy() {
    await this.backupService.cleanup();
    this.logger.info('Storage plugin destroyed');
  }
};
