/**
 * Report Service
 * Manages scan reports and results storage
 */

const fs = require('fs').promises;
const path = require('path');

class ReportService {
  constructor(core) {
    this.core = core;
    this.logger = core.getService('logger');
    this.config = core.getConfig('storage') || {};
    
    this.reportsDir = path.join(process.cwd(), this.config.reportsDir || 'data/reports');
    this.reports = [];
  }
  
  async init() {
    await fs.mkdir(this.reportsDir, { recursive: true });
    await this.loadReports();
    if (this.logger) {
      this.logger.info('Report service initialized');
    }
  }
  
  /**
   * Save scan report
   */
  async saveReport(data) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportId = this.generateId();
    const filename = `report-${timestamp}-${reportId}.json`;
    const filepath = path.join(this.reportsDir, filename);
    
    const report = {
      id: reportId,
      filename,
      filepath,
      created: new Date().toISOString(),
      type: data.type || 'scan',
      summary: data.summary || {},
      data: data
    };
    
    await fs.writeFile(filepath, JSON.stringify(report, null, 2));
    
    this.reports.unshift(report);
    await this.saveReportIndex();
    
    this.logger.info(`Report saved: ${filename}`);
    return report;
  }
  
  /**
   * Get report by ID
   */
  async getReport(reportId) {
    const report = this.reports.find(r => r.id === reportId);
    if (!report) {
      throw new Error('Report not found');
    }
    
    const data = await fs.readFile(report.filepath, 'utf8');
    return JSON.parse(data);
  }
  
  /**
   * List all reports
   */
  listReports(options = {}) {
    let reports = [...this.reports];
    
    // Filter by type
    if (options.type) {
      reports = reports.filter(r => r.type === options.type);
    }
    
    // Filter by date range
    if (options.from) {
      const fromDate = new Date(options.from);
      reports = reports.filter(r => new Date(r.created) >= fromDate);
    }
    if (options.to) {
      const toDate = new Date(options.to);
      reports = reports.filter(r => new Date(r.created) <= toDate);
    }
    
    // Pagination
    const page = options.page || 1;
    const limit = options.limit || 50;
    const start = (page - 1) * limit;
    const end = start + limit;
    
    return {
      reports: reports.slice(start, end).map(r => ({
        id: r.id,
        filename: r.filename,
        created: r.created,
        type: r.type,
        summary: r.summary
      })),
      total: reports.length,
      page,
      pages: Math.ceil(reports.length / limit)
    };
  }
  
  /**
   * Delete report
   */
  async deleteReport(reportId) {
    const index = this.reports.findIndex(r => r.id === reportId);
    if (index === -1) {
      throw new Error('Report not found');
    }
    
    const report = this.reports[index];
    await fs.unlink(report.filepath);
    
    this.reports.splice(index, 1);
    await this.saveReportIndex();
    
    this.logger.info(`Report deleted: ${report.filename}`);
  }
  
  /**
   * Clean old reports
   */
  async cleanOldReports(days = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const toDelete = this.reports.filter(r => {
      const reportDate = new Date(r.created);
      return reportDate < cutoffDate;
    });
    
    for (const report of toDelete) {
      try {
        await this.deleteReport(report.id);
        this.logger.info(`Cleaned old report: ${report.filename}`);
      } catch (err) {
        this.logger.error(`Failed to clean report ${report.filename}:`, err.message);
      }
    }
    
    return toDelete.length;
  }
  
  /**
   * Get report statistics
   */
  getStatistics() {
    const typeCount = {};
    let totalSize = 0;
    
    for (const report of this.reports) {
      typeCount[report.type] = (typeCount[report.type] || 0) + 1;
    }
    
    return {
      total: this.reports.length,
      byType: typeCount,
      oldest: this.reports[this.reports.length - 1]?.created,
      newest: this.reports[0]?.created
    };
  }
  
  /**
   * Load report index
   */
  async loadReports() {
    const indexPath = path.join(this.reportsDir, 'index.json');
    try {
      const data = await fs.readFile(indexPath, 'utf8');
      this.reports = JSON.parse(data);
      this.logger.info(`Loaded ${this.reports.length} report(s) from index`);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        this.logger.error('Failed to load report index:', err);
      }
      this.reports = [];
    }
  }
  
  /**
   * Save report index
   */
  async saveReportIndex() {
    const indexPath = path.join(this.reportsDir, 'index.json');
    await fs.writeFile(indexPath, JSON.stringify(this.reports, null, 2));
  }
  
  /**
   * Generate unique ID
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

module.exports = ReportService;
