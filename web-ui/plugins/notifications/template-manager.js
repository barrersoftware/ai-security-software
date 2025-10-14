/**
 * Notifications Plugin - Template Manager Service
 * Manages notification templates
 */

const { logger } = require('../../shared/logger');

class TemplateManager {
  constructor() {
    this.logger = logger;
    this.templates = new Map();
    this.initializeDefaultTemplates();
  }

  /**
   * Initialize default templates
   */
  initializeDefaultTemplates() {
    // Scan completion template
    this.registerTemplate('scan_complete', {
      subject: 'Scan Complete: {scan_name}',
      message: `
Security scan completed {status}.

Vulnerabilities Found:
🔴 Critical: {vulnerabilities.critical}
🟠 High: {vulnerabilities.high}
🟡 Medium: {vulnerabilities.medium}
🔵 Low: {vulnerabilities.low}

Duration: {duration}
Server: {server}
      `.trim()
    });

    // Critical vulnerability template
    this.registerTemplate('critical_vulnerability', {
      subject: '🚨 Critical Vulnerability Detected',
      message: `
A critical vulnerability has been detected!

Server: {server}
CVE: {cve}
Severity: CRITICAL
CVSS Score: {cvss_score}

Description: {description}

Immediate action required!
      `.trim()
    });

    // Scan failed template
    this.registerTemplate('scan_failed', {
      subject: '❌ Scan Failed: {scan_name}',
      message: `
Security scan failed to complete.

Server: {server}
Error: {error}
Duration: {duration}

Please investigate and retry.
      `.trim()
    });

    // Policy violation template
    this.registerTemplate('policy_violation', {
      subject: '⚠️  Policy Violation: {policy_name}',
      message: `
Security policy violation detected.

Policy: {policy_name}
Server: {server}
Violation: {violation}

Compliance score: {score}%
      `.trim()
    });

    // System health alert
    this.registerTemplate('system_health', {
      subject: 'System Health Alert: {alert_type}',
      message: `
System health issue detected.

Type: {alert_type}
Severity: {severity}
Details: {details}

Status: {status}
      `.trim()
    });

    // Multi-server scan complete
    this.registerTemplate('multi_scan_complete', {
      subject: 'Multi-Server Scan Complete: {scan_name}',
      message: `
Multi-server security scan completed.

Servers Scanned: {total_servers}
Successful: {successful}
Failed: {failed}

Total Vulnerabilities:
🔴 Critical: {vulnerabilities.critical}
🟠 High: {vulnerabilities.high}
🟡 Medium: {vulnerabilities.medium}
🔵 Low: {vulnerabilities.low}

Duration: {duration}
      `.trim()
    });

    // Daily summary template
    this.registerTemplate('daily_summary', {
      subject: 'Daily Security Summary - {date}',
      message: `
Daily Security Summary

Scans Today: {scans_today}
New Vulnerabilities: {new_vulnerabilities}
Resolved Issues: {resolved_issues}

Status: {overall_status}

Top Concerns:
{top_concerns}
      `.trim()
    });

    // Server offline alert
    this.registerTemplate('server_offline', {
      subject: '🔌 Server Offline: {server_name}',
      message: `
Server has gone offline.

Server: {server_name}
Host: {host}
Last Seen: {last_seen}
Duration: {offline_duration}

Attempting to reconnect...
      `.trim()
    });

    this.logger.info(`[TemplateManager] Loaded ${this.templates.size} default templates`);
  }

  /**
   * Register a template
   */
  registerTemplate(name, template) {
    if (!template.subject || !template.message) {
      throw new Error('Template must have subject and message');
    }

    this.templates.set(name, template);
  }

  /**
   * Get a template
   */
  getTemplate(name) {
    const template = this.templates.get(name);
    
    if (!template) {
      throw new Error(`Template not found: ${name}`);
    }

    return template;
  }

  /**
   * List all templates
   */
  listTemplates() {
    return Array.from(this.templates.entries()).map(([name, template]) => ({
      name,
      subject: template.subject,
      variables: this.extractVariables(template)
    }));
  }

  /**
   * Render a template with data
   */
  renderTemplate(name, data) {
    const template = this.getTemplate(name);
    
    return {
      subject: this.substituteVariables(template.subject, data),
      message: this.substituteVariables(template.message, data)
    };
  }

  /**
   * Substitute variables in text
   */
  substituteVariables(text, data) {
    let result = text;

    // Replace simple variables {var}
    result = result.replace(/\{([^}]+)\}/g, (match, path) => {
      const value = this.getNestedValue(data, path);
      return value !== undefined ? value : match;
    });

    return result;
  }

  /**
   * Get nested value from object
   */
  getNestedValue(obj, path) {
    const parts = path.split('.');
    let value = obj;

    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Extract variables from template
   */
  extractVariables(template) {
    const variables = new Set();
    const text = template.subject + ' ' + template.message;
    const regex = /\{([^}]+)\}/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      variables.add(match[1]);
    }

    return Array.from(variables);
  }

  /**
   * Validate template data
   */
  validateTemplateData(name, data) {
    const template = this.getTemplate(name);
    const variables = this.extractVariables(template);
    const missing = [];

    for (const variable of variables) {
      if (this.getNestedValue(data, variable) === undefined) {
        missing.push(variable);
      }
    }

    if (missing.length > 0) {
      throw new Error(`Missing template variables: ${missing.join(', ')}`);
    }

    return true;
  }

  /**
   * Create notification from template
   */
  createFromTemplate(name, data, options = {}) {
    const { priority = 'medium', channelIds = [] } = options;
    
    // Validate data
    const template = this.getTemplate(name);
    
    // Render template
    const rendered = this.renderTemplate(name, data);

    return {
      subject: rendered.subject,
      message: rendered.message,
      priority,
      channel_ids: channelIds,
      type: name,
      metadata: {
        template: name,
        ...data
      }
    };
  }
}

module.exports = TemplateManager;
