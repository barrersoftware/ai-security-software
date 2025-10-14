/**
 * Multi-Server Plugin - Scan Orchestrator Service
 * Handles distributed scan execution across multiple servers
 */

const { v4: uuidv4 } = require('uuid');
const { spawn } = require('child_process');
const path = require('path');
const { logger } = require('../../shared/logger');
const EventEmitter = require('events');

class ScanOrchestrator extends EventEmitter {
  constructor(db, serverManager, connectionManager) {
    super();
    this.db = db;
    this.serverManager = serverManager;
    this.connectionManager = connectionManager;
    this.logger = logger;
    this.activeScans = new Map();
    this.maxParallelScans = 4;
  }

  /**
   * Initialize database tables
   */
  async init() {
    this.logger.info('[ScanOrchestrator] Initializing...');

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS multi_server_scans (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        name TEXT,
        server_ids TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        started_at DATETIME,
        completed_at DATETIME,
        total_servers INTEGER,
        completed_servers INTEGER DEFAULT 0,
        failed_servers INTEGER DEFAULT 0,
        results TEXT,
        config TEXT,
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS server_scan_results (
        id TEXT PRIMARY KEY,
        scan_id TEXT NOT NULL,
        server_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        status TEXT,
        started_at DATETIME,
        completed_at DATETIME,
        duration INTEGER,
        vulnerabilities TEXT,
        report_path TEXT,
        error TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_multi_scans_tenant ON multi_server_scans(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_multi_scans_status ON multi_server_scans(status);
      CREATE INDEX IF NOT EXISTS idx_server_results_scan ON server_scan_results(scan_id);
      CREATE INDEX IF NOT EXISTS idx_server_results_server ON server_scan_results(server_id);
    `);

    this.logger.info('[ScanOrchestrator] ✅ Initialized');
  }

  /**
   * Start a multi-server scan
   */
  async startScan(tenantId, scanConfig, userId = null) {
    const scanId = uuidv4();
    const {
      name = `Multi-Server Scan ${new Date().toISOString()}`,
      server_ids = [],
      parallel = this.maxParallelScans,
      quick = false,
      config = {}
    } = scanConfig;

    if (server_ids.length === 0) {
      throw new Error('No servers specified for scan');
    }

    // Get server details
    const servers = await this.serverManager.getServersByIds(tenantId, server_ids);
    
    if (servers.length === 0) {
      throw new Error('No valid servers found');
    }

    // Create scan record
    await this.db.run(`
      INSERT INTO multi_server_scans (
        id, tenant_id, name, server_ids, status, 
        total_servers, config, created_by, started_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      scanId,
      tenantId,
      name,
      JSON.stringify(server_ids),
      'running',
      servers.length,
      JSON.stringify({ parallel, quick, ...config }),
      userId,
      new Date().toISOString()
    ]);

    this.logger.info(`[ScanOrchestrator] Started scan ${scanId} for ${servers.length} servers`);

    // Start scan execution (non-blocking)
    this.executeScan(scanId, tenantId, servers, { parallel, quick, ...config }).catch(err => {
      this.logger.error(`[ScanOrchestrator] Scan ${scanId} failed:`, err);
    });

    return {
      scan_id: scanId,
      status: 'running',
      total_servers: servers.length
    };
  }

  /**
   * Execute scan across servers
   */
  async executeScan(scanId, tenantId, servers, config) {
    const { parallel = 4, quick = false } = config;
    
    this.activeScans.set(scanId, {
      status: 'running',
      completed: 0,
      failed: 0,
      total: servers.length
    });

    // Execute scans in parallel batches
    const results = [];
    for (let i = 0; i < servers.length; i += parallel) {
      const batch = servers.slice(i, i + parallel);
      const batchPromises = batch.map(server => 
        this.scanServer(scanId, tenantId, server, quick)
      );
      
      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...batchResults);

      // Update progress
      const completed = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      await this.updateScanProgress(scanId, completed, failed);
      this.emit('progress', { scanId, completed, failed, total: servers.length });
    }

    // Mark scan as completed
    const failed = results.filter(r => r.status === 'rejected').length;
    const status = failed === servers.length ? 'failed' : 'completed';

    await this.db.run(`
      UPDATE multi_server_scans 
      SET status = ?, completed_at = ?, completed_servers = ?, failed_servers = ?
      WHERE id = ?
    `, [status, new Date().toISOString(), servers.length - failed, failed, scanId]);

    this.activeScans.delete(scanId);
    this.emit('completed', { scanId, status, completed: servers.length - failed, failed });

    this.logger.info(`[ScanOrchestrator] Scan ${scanId} completed: ${servers.length - failed} succeeded, ${failed} failed`);
  }

  /**
   * Scan a single server
   */
  async scanServer(scanId, tenantId, server, quick = false) {
    const resultId = uuidv4();
    const startTime = Date.now();

    this.logger.info(`[ScanOrchestrator] Scanning server: ${server.name} (${server.host})`);

    try {
      // Record scan start
      await this.db.run(`
        INSERT INTO server_scan_results (
          id, scan_id, server_id, tenant_id, status, started_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `, [resultId, scanId, server.id, tenantId, 'running', new Date().toISOString()]);

      // Test connection first
      const connectionTest = await this.connectionManager.testConnection(server);
      
      if (!connectionTest.success) {
        throw new Error(`Connection failed: ${connectionTest.error}`);
      }

      // Execute security scan on remote server
      const scanResult = await this.executeRemoteScan(server, quick);

      // Update result
      const duration = Date.now() - startTime;
      await this.db.run(`
        UPDATE server_scan_results 
        SET status = 'completed', 
            completed_at = ?, 
            duration = ?,
            vulnerabilities = ?,
            report_path = ?
        WHERE id = ?
      `, [
        new Date().toISOString(),
        duration,
        JSON.stringify(scanResult.vulnerabilities || {}),
        scanResult.reportPath || null,
        resultId
      ]);

      // Update server status
      await this.serverManager.updateServerStatus(tenantId, server.id, 'success');

      this.logger.info(`[ScanOrchestrator] ✅ Completed scan of ${server.name} (${duration}ms)`);

      return {
        server: server.name,
        status: 'success',
        duration,
        vulnerabilities: scanResult.vulnerabilities
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Record error
      await this.db.run(`
        UPDATE server_scan_results 
        SET status = 'failed', 
            completed_at = ?, 
            duration = ?,
            error = ?
        WHERE id = ?
      `, [new Date().toISOString(), duration, error.message, resultId]);

      // Update server status
      await this.serverManager.updateServerStatus(tenantId, server.id, 'failed');

      this.logger.error(`[ScanOrchestrator] ❌ Failed to scan ${server.name}:`, error.message);

      throw error;
    }
  }

  /**
   * Execute security scan on remote server
   */
  async executeRemoteScan(server, quick = false) {
    // Build scan command
    const scanCommand = quick 
      ? 'curl -s https://raw.githubusercontent.com/ssfdre38/ai-security-scanner/main/scripts/quick-scan.sh | bash'
      : 'curl -s https://raw.githubusercontent.com/ssfdre38/ai-security-scanner/main/scripts/security-scanner.sh | bash';

    const result = await this.connectionManager.executeRemoteCommand(
      server,
      scanCommand,
      300000 // 5 minute timeout
    );

    if (!result.success) {
      throw new Error(`Scan failed: ${result.error || result.stderr}`);
    }

    // Parse scan output
    const vulnerabilities = this.parseScanOutput(result.stdout);

    return {
      vulnerabilities,
      output: result.stdout,
      reportPath: null // Could save to file
    };
  }

  /**
   * Parse scan output for vulnerabilities
   */
  parseScanOutput(output) {
    const vulns = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    // Parse vulnerability counts from output
    const lines = output.split('\n');
    for (const line of lines) {
      if (line.includes('Critical:')) {
        const match = line.match(/Critical:\s*(\d+)/);
        if (match) vulns.critical = parseInt(match[1]);
      }
      if (line.includes('High:')) {
        const match = line.match(/High:\s*(\d+)/);
        if (match) vulns.high = parseInt(match[1]);
      }
      if (line.includes('Medium:')) {
        const match = line.match(/Medium:\s*(\d+)/);
        if (match) vulns.medium = parseInt(match[1]);
      }
      if (line.includes('Low:')) {
        const match = line.match(/Low:\s*(\d+)/);
        if (match) vulns.low = parseInt(match[1]);
      }
    }

    return vulns;
  }

  /**
   * Update scan progress
   */
  async updateScanProgress(scanId, completed, failed) {
    await this.db.run(`
      UPDATE multi_server_scans 
      SET completed_servers = ?, failed_servers = ?
      WHERE id = ?
    `, [completed, failed, scanId]);
  }

  /**
   * Get scan status
   */
  async getScanStatus(tenantId, scanId) {
    const scan = await this.db.get(
      'SELECT * FROM multi_server_scans WHERE tenant_id = ? AND id = ?',
      [tenantId, scanId]
    );

    if (!scan) {
      throw new Error('Scan not found');
    }

    // Get individual server results
    const results = await this.db.all(
      'SELECT * FROM server_scan_results WHERE scan_id = ? ORDER BY started_at ASC',
      [scanId]
    );

    return {
      ...scan,
      server_ids: JSON.parse(scan.server_ids || '[]'),
      config: JSON.parse(scan.config || '{}'),
      results: results.map(r => ({
        ...r,
        vulnerabilities: JSON.parse(r.vulnerabilities || '{}')
      }))
    };
  }

  /**
   * List scans
   */
  async listScans(tenantId, filters = {}) {
    const { status, limit = 50, offset = 0 } = filters;
    
    let query = 'SELECT * FROM multi_server_scans WHERE tenant_id = ?';
    const params = [tenantId];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const scans = await this.db.all(query, params);

    return scans.map(scan => ({
      ...scan,
      server_ids: JSON.parse(scan.server_ids || '[]'),
      config: JSON.parse(scan.config || '{}')
    }));
  }

  /**
   * Cancel a running scan
   */
  async cancelScan(tenantId, scanId) {
    const scan = await this.db.get(
      'SELECT * FROM multi_server_scans WHERE tenant_id = ? AND id = ?',
      [tenantId, scanId]
    );

    if (!scan) {
      throw new Error('Scan not found');
    }

    if (scan.status !== 'running') {
      throw new Error('Scan is not running');
    }

    await this.db.run(
      'UPDATE multi_server_scans SET status = ?, completed_at = ? WHERE id = ?',
      ['cancelled', new Date().toISOString(), scanId]
    );

    this.activeScans.delete(scanId);

    this.logger.info(`[ScanOrchestrator] Cancelled scan: ${scanId}`);

    return { success: true };
  }
}

module.exports = ScanOrchestrator;
