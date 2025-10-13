/**
 * ComplianceReporter Service
 * 
 * Generates compliance reports for various standards (GDPR, SOC2, HIPAA).
 * Analyzes audit logs to verify compliance requirements are met.
 */

class ComplianceReporter {
  constructor(db, logger) {
    this.db = db;
    this.logger = logger;

    // Compliance requirements for each standard
    this.standards = {
      GDPR: {
        name: 'General Data Protection Regulation',
        requirements: [
          {
            id: 'gdpr_access_logs',
            name: 'Access Logging',
            description: 'All data access must be logged',
            categories: ['data_access']
          },
          {
            id: 'gdpr_auth_logs',
            name: 'Authentication Logging',
            description: 'All authentication attempts must be logged',
            categories: ['authentication']
          },
          {
            id: 'gdpr_consent',
            name: 'Consent Management',
            description: 'User consent changes must be tracked',
            categories: ['user_management', 'compliance']
          },
          {
            id: 'gdpr_data_changes',
            name: 'Data Modification Logging',
            description: 'All personal data changes must be logged',
            categories: ['user_management', 'data_access']
          },
          {
            id: 'gdpr_retention',
            name: 'Log Retention',
            description: 'Logs must be retained for required period',
            minDays: 90
          }
        ]
      },
      SOC2: {
        name: 'Service Organization Control 2',
        requirements: [
          {
            id: 'soc2_access_control',
            name: 'Access Control Logging',
            description: 'All access control events must be logged',
            categories: ['authentication', 'authorization']
          },
          {
            id: 'soc2_config_changes',
            name: 'Configuration Change Logging',
            description: 'All system configuration changes must be logged',
            categories: ['configuration', 'system_changes']
          },
          {
            id: 'soc2_security_events',
            name: 'Security Event Logging',
            description: 'All security events must be logged and monitored',
            categories: ['security_scan', 'authentication']
          },
          {
            id: 'soc2_user_management',
            name: 'User Management Logging',
            description: 'All user provisioning and deprovisioning must be logged',
            categories: ['user_management']
          },
          {
            id: 'soc2_retention',
            name: 'Log Retention',
            description: 'Logs must be retained for at least 90 days',
            minDays: 90
          }
        ]
      },
      HIPAA: {
        name: 'Health Insurance Portability and Accountability Act',
        requirements: [
          {
            id: 'hipaa_access_logs',
            name: 'PHI Access Logging',
            description: 'All protected health information access must be logged',
            categories: ['data_access']
          },
          {
            id: 'hipaa_auth_logs',
            name: 'Authentication Logging',
            description: 'All user authentication must be logged',
            categories: ['authentication']
          },
          {
            id: 'hipaa_audit_trail',
            name: 'Audit Trail',
            description: 'Comprehensive audit trail of all PHI access',
            categories: ['data_access', 'user_management']
          },
          {
            id: 'hipaa_emergency_access',
            name: 'Emergency Access Logging',
            description: 'Emergency access must be logged and reviewed',
            categories: ['authorization', 'data_access']
          },
          {
            id: 'hipaa_retention',
            name: 'Log Retention',
            description: 'Logs must be retained for at least 6 years',
            minDays: 2190 // 6 years
          }
        ]
      }
    };
  }

  /**
   * Generate compliance report
   */
  async generateReport(params = {}) {
    const {
      standard = 'GDPR',
      tenantId,
      startDate,
      endDate
    } = params;

    if (!this.standards[standard]) {
      throw new Error(`Unknown compliance standard: ${standard}`);
    }

    this.logger.info(`[ComplianceReporter] Generating ${standard} compliance report...`);

    const standardInfo = this.standards[standard];
    const report = {
      standard,
      standardName: standardInfo.name,
      generatedAt: new Date().toISOString(),
      tenantId: tenantId || 'all',
      period: {
        startDate: startDate || null,
        endDate: endDate || null
      },
      requirements: [],
      overallCompliance: 0,
      summary: {}
    };

    try {
      // Check each requirement
      for (const requirement of standardInfo.requirements) {
        const result = await this.checkRequirement(
          requirement,
          tenantId,
          startDate,
          endDate
        );
        report.requirements.push(result);
      }

      // Calculate overall compliance
      const metRequirements = report.requirements.filter(r => r.status === 'compliant').length;
      report.overallCompliance = (metRequirements / report.requirements.length * 100).toFixed(2);

      // Generate summary
      report.summary = {
        totalRequirements: report.requirements.length,
        compliant: metRequirements,
        nonCompliant: report.requirements.filter(r => r.status === 'non-compliant').length,
        warnings: report.requirements.filter(r => r.status === 'warning').length,
        compliancePercentage: report.overallCompliance
      };

      this.logger.info(`[ComplianceReporter] ✅ ${standard} report generated: ${report.overallCompliance}% compliant`);

      return report;
    } catch (error) {
      this.logger.error('[ComplianceReporter] Error generating report:', error);
      throw error;
    }
  }

  /**
   * Check a specific compliance requirement
   */
  async checkRequirement(requirement, tenantId, startDate, endDate) {
    const result = {
      id: requirement.id,
      name: requirement.name,
      description: requirement.description,
      status: 'compliant',
      evidence: {},
      issues: []
    };

    try {
      if (requirement.categories) {
        // Check if events in these categories exist
        for (const category of requirement.categories) {
          const count = await this.countEventsByCategory(
            category,
            tenantId,
            startDate,
            endDate
          );

          result.evidence[category] = {
            eventCount: count,
            hasLogs: count > 0
          };

          // If no logs found for critical categories, mark as non-compliant
          if (count === 0) {
            result.status = 'warning';
            result.issues.push(`No ${category} events found in the specified period`);
          }
        }
      }

      if (requirement.minDays) {
        // Check log retention
        const oldestLog = await this.getOldestLog(tenantId);
        if (oldestLog) {
          const retentionDays = this.calculateRetentionDays(oldestLog.timestamp);
          result.evidence.retention = {
            oldestLogDate: oldestLog.timestamp,
            retentionDays,
            required: requirement.minDays
          };

          if (retentionDays < requirement.minDays) {
            result.status = 'warning';
            result.issues.push(`Log retention (${retentionDays} days) is less than required (${requirement.minDays} days)`);
          }
        } else {
          result.status = 'warning';
          result.issues.push('No audit logs found to verify retention');
        }
      }

      // If there are issues, downgrade from compliant
      if (result.issues.length > 0 && result.status === 'compliant') {
        result.status = 'warning';
      }

    } catch (error) {
      this.logger.error('[ComplianceReporter] Error checking requirement:', error);
      result.status = 'error';
      result.issues.push(`Error checking requirement: ${error.message}`);
    }

    return result;
  }

  /**
   * Count events by category
   */
  async countEventsByCategory(category, tenantId, startDate, endDate) {
    try {
      const conditions = ['category = ?'];
      const params = [category];

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
      
      const result = await this.db.get(`
        SELECT COUNT(*) as count FROM audit_logs ${whereClause}
      `, params);

      return result.count;
    } catch (error) {
      this.logger.error('[ComplianceReporter] Error counting events:', error);
      return 0;
    }
  }

  /**
   * Get oldest log entry
   */
  async getOldestLog(tenantId) {
    try {
      const conditions = [];
      const params = [];

      if (tenantId) {
        conditions.push('tenant_id = ?');
        params.push(tenantId);
      }

      const whereClause = conditions.length > 0
        ? 'WHERE ' + conditions.join(' AND ')
        : '';

      const result = await this.db.get(`
        SELECT timestamp FROM audit_logs ${whereClause}
        ORDER BY timestamp ASC
        LIMIT 1
      `, params);

      return result;
    } catch (error) {
      this.logger.error('[ComplianceReporter] Error getting oldest log:', error);
      return null;
    }
  }

  /**
   * Calculate retention days
   */
  calculateRetentionDays(timestamp) {
    const logDate = new Date(timestamp);
    const now = new Date();
    const diffTime = Math.abs(now - logDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  /**
   * Convert report to CSV format
   */
  toCSV(report) {
    const rows = [];

    // Header
    rows.push([
      'Requirement ID',
      'Requirement Name',
      'Status',
      'Issues'
    ].join(','));

    // Requirements
    for (const req of report.requirements) {
      const issues = req.issues.join('; ').replace(/,/g, ';');
      rows.push([
        req.id,
        req.name,
        req.status,
        `"${issues}"`
      ].join(','));
    }

    return rows.join('\n');
  }

  /**
   * Get compliance trends over time
   */
  async getComplianceTrends(standard, tenantId, months = 6) {
    const trends = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const endDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

      const report = await this.generateReport({
        standard,
        tenantId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });

      trends.push({
        month: endDate.toISOString().substring(0, 7), // YYYY-MM
        compliance: report.overallCompliance,
        compliantRequirements: report.summary.compliant,
        totalRequirements: report.summary.totalRequirements
      });
    }

    return trends;
  }

  /**
   * Get all supported standards
   */
  getSupportedStandards() {
    return Object.keys(this.standards).map(key => ({
      id: key,
      name: this.standards[key].name,
      requirementCount: this.standards[key].requirements.length
    }));
  }
}

module.exports = ComplianceReporter;
