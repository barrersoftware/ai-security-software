/**
 * Multi-Server Management Plugin
 * Enables centralized scanning and management of multiple servers
 */

const ServerManager = require('./server-manager');
const GroupManager = require('./group-manager');
const ConnectionManager = require('./connection-manager');
const ScanOrchestrator = require('./scan-orchestrator');
const ReportAggregator = require('./report-aggregator');
const { logger } = require('../../shared/logger');

class MultiServerPlugin {
  constructor() {
    this.name = 'multi-server';
    this.version = '1.0.0';
    this.logger = logger;
    
    // Services
    this.serverManager = null;
    this.groupManager = null;
    this.connectionManager = null;
    this.scanOrchestrator = null;
    this.reportAggregator = null;
  }

  /**
   * Initialize plugin
   */
  async init(db, services = {}) {
    this.logger.info('[MultiServerPlugin] Initializing...');

    // Check SSH availability
    const sshAvailable = await ConnectionManager.checkSSHAvailable();
    if (!sshAvailable) {
      this.logger.warn('[MultiServerPlugin] ⚠️  SSH not available - connection features disabled');
    }

    // Initialize services
    this.serverManager = new ServerManager(db);
    await this.serverManager.init();

    this.groupManager = new GroupManager(db);
    await this.groupManager.init();

    this.connectionManager = new ConnectionManager();

    this.scanOrchestrator = new ScanOrchestrator(db, this.serverManager, this.connectionManager);
    await this.scanOrchestrator.init();

    this.reportAggregator = new ReportAggregator(db, this.serverManager);

    this.logger.info('[MultiServerPlugin] ✅ Initialized');

    return {
      serverManager: this.serverManager,
      groupManager: this.groupManager,
      connectionManager: this.connectionManager,
      scanOrchestrator: this.scanOrchestrator,
      reportAggregator: this.reportAggregator
    };
  }

  /**
   * Register API routes
   */
  routes(router, authenticateToken, getTenantId) {
    // ============================================
    // Server Management Routes
    // ============================================

    // Create server
    router.post('/api/multi-server/servers', authenticateToken, async (req, res) => {
      try {
        const tenantId = await getTenantId(req);
        const server = await this.serverManager.addServer(tenantId, req.body);
        res.json({ success: true, server });
      } catch (error) {
        this.logger.error('[MultiServer] Error creating server:', error);
        res.status(400).json({ success: false, error: error.message });
      }
    });

    // List servers
    router.get('/api/multi-server/servers', authenticateToken, async (req, res) => {
      try {
        const tenantId = await getTenantId(req);
        const filters = {
          status: req.query.status,
          tags: req.query.tags ? req.query.tags.split(',') : undefined,
          search: req.query.search,
          limit: parseInt(req.query.limit) || 100,
          offset: parseInt(req.query.offset) || 0
        };
        const servers = await this.serverManager.listServers(tenantId, filters);
        res.json({ success: true, servers, count: servers.length });
      } catch (error) {
        this.logger.error('[MultiServer] Error listing servers:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Get server details
    router.get('/api/multi-server/servers/:id', authenticateToken, async (req, res) => {
      try {
        const tenantId = await getTenantId(req);
        const server = await this.serverManager.getServer(tenantId, req.params.id);
        res.json({ success: true, server });
      } catch (error) {
        this.logger.error('[MultiServer] Error getting server:', error);
        res.status(404).json({ success: false, error: error.message });
      }
    });

    // Update server
    router.put('/api/multi-server/servers/:id', authenticateToken, async (req, res) => {
      try {
        const tenantId = await getTenantId(req);
        const server = await this.serverManager.updateServer(tenantId, req.params.id, req.body);
        res.json({ success: true, server });
      } catch (error) {
        this.logger.error('[MultiServer] Error updating server:', error);
        res.status(400).json({ success: false, error: error.message });
      }
    });

    // Delete server
    router.delete('/api/multi-server/servers/:id', authenticateToken, async (req, res) => {
      try {
        const tenantId = await getTenantId(req);
        const result = await this.serverManager.deleteServer(tenantId, req.params.id);
        res.json({ success: true, ...result });
      } catch (error) {
        this.logger.error('[MultiServer] Error deleting server:', error);
        res.status(400).json({ success: false, error: error.message });
      }
    });

    // Test server connection
    router.post('/api/multi-server/servers/:id/test', authenticateToken, async (req, res) => {
      try {
        const tenantId = await getTenantId(req);
        const server = await this.serverManager.getServer(tenantId, req.params.id);
        const result = await this.connectionManager.testConnection(server);
        
        if (result.success) {
          // Get additional server info
          const info = await this.connectionManager.getServerInfo(server);
          result.info = info;
        }
        
        res.json({ success: true, connection: result });
      } catch (error) {
        this.logger.error('[MultiServer] Error testing connection:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Get server statistics
    router.get('/api/multi-server/servers/stats/summary', authenticateToken, async (req, res) => {
      try {
        const tenantId = await getTenantId(req);
        const stats = await this.serverManager.getStatistics(tenantId);
        res.json({ success: true, statistics: stats });
      } catch (error) {
        this.logger.error('[MultiServer] Error getting statistics:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // ============================================
    // Group Management Routes
    // ============================================

    // Create group
    router.post('/api/multi-server/groups', authenticateToken, async (req, res) => {
      try {
        const tenantId = await getTenantId(req);
        const group = await this.groupManager.createGroup(tenantId, req.body);
        res.json({ success: true, group });
      } catch (error) {
        this.logger.error('[MultiServer] Error creating group:', error);
        res.status(400).json({ success: false, error: error.message });
      }
    });

    // List groups
    router.get('/api/multi-server/groups', authenticateToken, async (req, res) => {
      try {
        const tenantId = await getTenantId(req);
        const groups = await this.groupManager.listGroups(tenantId);
        res.json({ success: true, groups, count: groups.length });
      } catch (error) {
        this.logger.error('[MultiServer] Error listing groups:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Get group
    router.get('/api/multi-server/groups/:id', authenticateToken, async (req, res) => {
      try {
        const tenantId = await getTenantId(req);
        const group = await this.groupManager.getGroup(tenantId, req.params.id);
        res.json({ success: true, group });
      } catch (error) {
        this.logger.error('[MultiServer] Error getting group:', error);
        res.status(404).json({ success: false, error: error.message });
      }
    });

    // Update group
    router.put('/api/multi-server/groups/:id', authenticateToken, async (req, res) => {
      try {
        const tenantId = await getTenantId(req);
        const group = await this.groupManager.updateGroup(tenantId, req.params.id, req.body);
        res.json({ success: true, group });
      } catch (error) {
        this.logger.error('[MultiServer] Error updating group:', error);
        res.status(400).json({ success: false, error: error.message });
      }
    });

    // Delete group
    router.delete('/api/multi-server/groups/:id', authenticateToken, async (req, res) => {
      try {
        const tenantId = await getTenantId(req);
        const result = await this.groupManager.deleteGroup(tenantId, req.params.id);
        res.json({ success: true, ...result });
      } catch (error) {
        this.logger.error('[MultiServer] Error deleting group:', error);
        res.status(400).json({ success: false, error: error.message });
      }
    });

    // ============================================
    // Scan Operations Routes
    // ============================================

    // Start multi-server scan
    router.post('/api/multi-server/scan', authenticateToken, async (req, res) => {
      try {
        const tenantId = await getTenantId(req);
        const userId = req.user?.id || req.user?.username;
        
        const result = await this.scanOrchestrator.startScan(tenantId, req.body, userId);
        res.json({ success: true, ...result });
      } catch (error) {
        this.logger.error('[MultiServer] Error starting scan:', error);
        res.status(400).json({ success: false, error: error.message });
      }
    });

    // List scans
    router.get('/api/multi-server/scans', authenticateToken, async (req, res) => {
      try {
        const tenantId = await getTenantId(req);
        const filters = {
          status: req.query.status,
          limit: parseInt(req.query.limit) || 50,
          offset: parseInt(req.query.offset) || 0
        };
        const scans = await this.scanOrchestrator.listScans(tenantId, filters);
        res.json({ success: true, scans, count: scans.length });
      } catch (error) {
        this.logger.error('[MultiServer] Error listing scans:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Get scan status
    router.get('/api/multi-server/scans/:id', authenticateToken, async (req, res) => {
      try {
        const tenantId = await getTenantId(req);
        const scan = await this.scanOrchestrator.getScanStatus(tenantId, req.params.id);
        res.json({ success: true, scan });
      } catch (error) {
        this.logger.error('[MultiServer] Error getting scan status:', error);
        res.status(404).json({ success: false, error: error.message });
      }
    });

    // Cancel scan
    router.delete('/api/multi-server/scans/:id', authenticateToken, async (req, res) => {
      try {
        const tenantId = await getTenantId(req);
        const result = await this.scanOrchestrator.cancelScan(tenantId, req.params.id);
        res.json(result);
      } catch (error) {
        this.logger.error('[MultiServer] Error cancelling scan:', error);
        res.status(400).json({ success: false, error: error.message });
      }
    });

    // ============================================
    // Reporting Routes
    // ============================================

    // Generate consolidated report
    router.get('/api/multi-server/reports/:scanId', authenticateToken, async (req, res) => {
      try {
        const tenantId = await getTenantId(req);
        const format = req.query.format || 'json';
        
        const report = await this.reportAggregator.generateConsolidatedReport(tenantId, req.params.scanId);
        
        if (format === 'json') {
          res.json({ success: true, report });
        } else {
          const exported = await this.reportAggregator.exportReport(report, format);
          res.type(format === 'csv' ? 'text/csv' : 'text/plain');
          res.send(exported);
        }
      } catch (error) {
        this.logger.error('[MultiServer] Error generating report:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Generate server-specific report
    router.get('/api/multi-server/reports/server/:serverId', authenticateToken, async (req, res) => {
      try {
        const tenantId = await getTenantId(req);
        const limit = parseInt(req.query.limit) || 10;
        
        const report = await this.reportAggregator.generateServerReport(tenantId, req.params.serverId, limit);
        res.json({ success: true, report });
      } catch (error) {
        this.logger.error('[MultiServer] Error generating server report:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Generate comparison report
    router.get('/api/multi-server/reports/compare/:scanId1/:scanId2', authenticateToken, async (req, res) => {
      try {
        const tenantId = await getTenantId(req);
        
        const comparison = await this.reportAggregator.generateComparisonReport(
          tenantId,
          req.params.scanId1,
          req.params.scanId2
        );
        
        res.json({ success: true, comparison });
      } catch (error) {
        this.logger.error('[MultiServer] Error generating comparison:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.logger.info('[MultiServerPlugin] ✅ Routes registered');
  }

  /**
   * Middleware (optional)
   */
  middleware() {
    return (req, res, next) => {
      // Could add multi-server specific middleware here
      next();
    };
  }

  /**
   * Get plugin metadata
   */
  getMetadata() {
    return {
      name: this.name,
      version: this.version,
      description: 'Multi-server management and distributed scanning',
      services: [
        'ServerManager',
        'GroupManager',
        'ConnectionManager',
        'ScanOrchestrator',
        'ReportAggregator'
      ],
      endpoints: 16,
      features: [
        'Server inventory management',
        'Group management',
        'SSH connection testing',
        'Distributed scanning',
        'Parallel execution',
        'Consolidated reporting',
        'Historical analysis',
        'Multi-tenant isolation'
      ]
    };
  }
}

module.exports = new MultiServerPlugin();
