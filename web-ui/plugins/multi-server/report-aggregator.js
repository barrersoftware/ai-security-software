/**
 * Multi-Server Plugin - Report Aggregator Service
 * Handles consolidated reporting across multiple servers
 */

const { logger } = require('../../shared/logger');

class ReportAggregator {
  constructor(db, serverManager) {
    this.db = db;
    this.serverManager = serverManager;
    this.logger = logger;
  }

  /**
   * Generate consolidated report for a multi-server scan
   */
  async generateConsolidatedReport(tenantId, scanId) {
    this.logger.info(`[ReportAggregator] Generating consolidated report for scan ${scanId}`);

    // Get scan details
    const scan = await this.db.get(
      'SELECT * FROM multi_server_scans WHERE tenant_id = ? AND id = ?',
      [tenantId, scanId]
    );

    if (!scan) {
      throw new Error('Scan not found');
    }

    // Get all server results
    const results = await this.db.all(
      'SELECT * FROM server_scan_results WHERE scan_id = ? ORDER BY started_at ASC',
      [scanId]
    );

    // Get server details
    const serverIds = JSON.parse(scan.server_ids || '[]');
    const servers = await this.serverManager.getServersByIds(tenantId, serverIds);
    const serverMap = new Map(servers.map(s => [s.id, s]));

    // Aggregate statistics
    const stats = this.calculateStatistics(results);
    
    // Build report
    const report = {
      scan_id: scanId,
      scan_name: scan.name,
      started_at: scan.started_at,
      completed_at: scan.completed_at,
      status: scan.status,
      statistics: stats,
      servers: results.map(r => {
        const server = serverMap.get(r.server_id);
        return {
          server_id: r.server_id,
          server_name: server ? server.name : 'Unknown',
          server_host: server ? server.host : 'Unknown',
          status: r.status,
          duration: r.duration,
          vulnerabilities: JSON.parse(r.vulnerabilities || '{}'),
          error: r.error
        };
      }),
      summary: this.generateSummary(results, servers),
      generated_at: new Date().toISOString()
    };

    this.logger.info(`[ReportAggregator] Generated report for ${results.length} servers`);

    return report;
  }

  /**
   * Calculate aggregate statistics
   */
  calculateStatistics(results) {
    const stats = {
      total_servers: results.length,
      successful_scans: 0,
      failed_scans: 0,
      total_duration: 0,
      average_duration: 0,
      vulnerabilities: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        total: 0
      },
      servers_by_status: {
        completed: 0,
        failed: 0,
        running: 0
      }
    };

    let totalDuration = 0;
    let completedCount = 0;

    for (const result of results) {
      // Count by status
      if (result.status === 'completed') {
        stats.successful_scans++;
        stats.servers_by_status.completed++;
        
        if (result.duration) {
          totalDuration += result.duration;
          completedCount++;
        }
      } else if (result.status === 'failed') {
        stats.failed_scans++;
        stats.servers_by_status.failed++;
      } else if (result.status === 'running') {
        stats.servers_by_status.running++;
      }

      // Aggregate vulnerabilities
      if (result.vulnerabilities) {
        const vulns = JSON.parse(result.vulnerabilities);
        stats.vulnerabilities.critical += vulns.critical || 0;
        stats.vulnerabilities.high += vulns.high || 0;
        stats.vulnerabilities.medium += vulns.medium || 0;
        stats.vulnerabilities.low += vulns.low || 0;
      }
    }

    stats.vulnerabilities.total = 
      stats.vulnerabilities.critical +
      stats.vulnerabilities.high +
      stats.vulnerabilities.medium +
      stats.vulnerabilities.low;

    stats.total_duration = totalDuration;
    stats.average_duration = completedCount > 0 
      ? Math.round(totalDuration / completedCount) 
      : 0;

    return stats;
  }

  /**
   * Generate text summary
   */
  generateSummary(results, servers) {
    const stats = this.calculateStatistics(results);
    
    let summary = `Multi-Server Scan Summary\n`;
    summary += `========================\n\n`;
    summary += `Total Servers: ${stats.total_servers}\n`;
    summary += `Successful Scans: ${stats.successful_scans}\n`;
    summary += `Failed Scans: ${stats.failed_scans}\n`;
    summary += `Average Duration: ${(stats.average_duration / 1000).toFixed(2)}s\n\n`;
    
    summary += `Total Vulnerabilities Found: ${stats.vulnerabilities.total}\n`;
    summary += `  🔴 Critical: ${stats.vulnerabilities.critical}\n`;
    summary += `  🟠 High: ${stats.vulnerabilities.high}\n`;
    summary += `  🟡 Medium: ${stats.vulnerabilities.medium}\n`;
    summary += `  🔵 Low: ${stats.vulnerabilities.low}\n\n`;

    // List servers with critical vulnerabilities
    const criticalServers = results.filter(r => {
      const vulns = JSON.parse(r.vulnerabilities || '{}');
      return vulns.critical > 0;
    });

    if (criticalServers.length > 0) {
      summary += `⚠️ Servers with Critical Vulnerabilities:\n`;
      for (const result of criticalServers) {
        const server = servers.find(s => s.id === result.server_id);
        const vulns = JSON.parse(result.vulnerabilities);
        summary += `  - ${server ? server.name : 'Unknown'}: ${vulns.critical} critical\n`;
      }
      summary += `\n`;
    }

    // List failed servers
    const failedServers = results.filter(r => r.status === 'failed');
    if (failedServers.length > 0) {
      summary += `❌ Failed Scans:\n`;
      for (const result of failedServers) {
        const server = servers.find(s => s.id === result.server_id);
        summary += `  - ${server ? server.name : 'Unknown'}: ${result.error || 'Unknown error'}\n`;
      }
    }

    return summary;
  }

  /**
   * Generate comparison report between scans
   */
  async generateComparisonReport(tenantId, scanId1, scanId2) {
    const report1 = await this.generateConsolidatedReport(tenantId, scanId1);
    const report2 = await this.generateConsolidatedReport(tenantId, scanId2);

    const comparison = {
      scan1: {
        id: scanId1,
        date: report1.started_at,
        statistics: report1.statistics
      },
      scan2: {
        id: scanId2,
        date: report2.started_at,
        statistics: report2.statistics
      },
      changes: {
        vulnerabilities: {
          critical: report2.statistics.vulnerabilities.critical - report1.statistics.vulnerabilities.critical,
          high: report2.statistics.vulnerabilities.high - report1.statistics.vulnerabilities.high,
          medium: report2.statistics.vulnerabilities.medium - report1.statistics.vulnerabilities.medium,
          low: report2.statistics.vulnerabilities.low - report1.statistics.vulnerabilities.low
        },
        success_rate: {
          before: (report1.statistics.successful_scans / report1.statistics.total_servers * 100).toFixed(1),
          after: (report2.statistics.successful_scans / report2.statistics.total_servers * 100).toFixed(1)
        }
      },
      generated_at: new Date().toISOString()
    };

    return comparison;
  }

  /**
   * Generate server-specific report
   */
  async generateServerReport(tenantId, serverId, limit = 10) {
    // Get server details
    const server = await this.serverManager.getServer(tenantId, serverId);

    // Get scan history for this server
    const results = await this.db.all(`
      SELECT ssr.*, mss.name as scan_name, mss.started_at as scan_started
      FROM server_scan_results ssr
      JOIN multi_server_scans mss ON ssr.scan_id = mss.id
      WHERE ssr.server_id = ? AND ssr.tenant_id = ?
      ORDER BY ssr.started_at DESC
      LIMIT ?
    `, [serverId, tenantId, limit]);

    // Calculate trends
    const trends = this.calculateTrends(results);

    return {
      server,
      scan_history: results.map(r => ({
        scan_id: r.scan_id,
        scan_name: r.scan_name,
        status: r.status,
        started_at: r.started_at,
        duration: r.duration,
        vulnerabilities: JSON.parse(r.vulnerabilities || '{}'),
        error: r.error
      })),
      trends,
      generated_at: new Date().toISOString()
    };
  }

  /**
   * Calculate vulnerability trends over time
   */
  calculateTrends(results) {
    if (results.length < 2) {
      return { trend: 'insufficient_data' };
    }

    const recent = results[0];
    const previous = results[1];

    const recentVulns = JSON.parse(recent.vulnerabilities || '{}');
    const previousVulns = JSON.parse(previous.vulnerabilities || '{}');

    const recentTotal = (recentVulns.critical || 0) + (recentVulns.high || 0) + 
                        (recentVulns.medium || 0) + (recentVulns.low || 0);
    const previousTotal = (previousVulns.critical || 0) + (previousVulns.high || 0) + 
                          (previousVulns.medium || 0) + (previousVulns.low || 0);

    const change = recentTotal - previousTotal;
    const changePercent = previousTotal > 0 
      ? ((change / previousTotal) * 100).toFixed(1) 
      : 0;

    return {
      trend: change > 0 ? 'worsening' : change < 0 ? 'improving' : 'stable',
      change,
      change_percent: changePercent,
      recent_total: recentTotal,
      previous_total: previousTotal
    };
  }

  /**
   * Export report to different formats
   */
  async exportReport(report, format = 'json') {
    switch (format) {
      case 'json':
        return JSON.stringify(report, null, 2);
      
      case 'text':
        return report.summary || this.generateSummary(report.servers, []);
      
      case 'csv':
        return this.generateCSV(report);
      
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Generate CSV format
   */
  generateCSV(report) {
    let csv = 'Server,Host,Status,Duration,Critical,High,Medium,Low,Error\n';
    
    for (const server of report.servers) {
      const vulns = server.vulnerabilities || {};
      csv += `"${server.server_name}",`;
      csv += `"${server.server_host}",`;
      csv += `"${server.status}",`;
      csv += `"${server.duration || 0}",`;
      csv += `"${vulns.critical || 0}",`;
      csv += `"${vulns.high || 0}",`;
      csv += `"${vulns.medium || 0}",`;
      csv += `"${vulns.low || 0}",`;
      csv += `"${server.error || ''}"\n`;
    }

    return csv;
  }
}

module.exports = ReportAggregator;
