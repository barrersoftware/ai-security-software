#!/usr/bin/env node
/**
 * v4 Complete Integration Test Suite
 * Tests all 18 plugins and their integrations
 */

const path = require('path');
const fs = require('fs').promises;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(80));
  log(`  ${title}`, 'cyan');
  console.log('='.repeat(80) + '\n');
}

function logTest(name, passed, details = '') {
  const status = passed ? '✓' : '✗';
  const color = passed ? 'green' : 'red';
  log(`${status} ${name}`, color);
  if (details && !passed) {
    log(`  └─ ${details}`, 'yellow');
  }
}

// Test results tracker
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: []
};

function recordTest(name, passed, details = '', category = 'general') {
  results.total++;
  if (passed) {
    results.passed++;
  } else {
    results.failed++;
  }
  results.tests.push({ name, passed, details, category });
  logTest(name, passed, details);
}

// Main test execution
async function runTests() {
  log('AI Security Scanner v4 - Complete Integration Test Suite', 'blue');
  log('Testing all 18 plugins and integrations\n', 'blue');

  try {
    // Test 1: Directory Structure
    logSection('Test 1: Directory Structure');
    await testDirectoryStructure();

    // Test 2: Plugin Files
    logSection('Test 2: Plugin Files');
    await testPluginFiles();

    // Test 3: User Manager (v4.10.0)
    logSection('Test 3: User Manager SQLite (v4.10.0)');
    await testUserManager();

    // Test 4: Audit-Log PDF Fix (v4.10.1)
    logSection('Test 4: Audit-Log PDF Integration (v4.10.1)');
    await testAuditLogPDF();

    // Test 5: Dependencies
    logSection('Test 5: NPM Dependencies');
    await testDependencies();

    // Test 6: Plugin Configurations
    logSection('Test 6: Plugin Configurations');
    await testPluginConfigurations();

    // Test 7: Database Files
    logSection('Test 7: Database Files');
    await testDatabaseFiles();

    // Test 8: Cross-Plugin Integration Points
    logSection('Test 8: Cross-Plugin Integration Points');
    await testCrossPluginIntegrations();

    // Print Summary
    printSummary();

  } catch (error) {
    log(`\nFatal Error: ${error.message}`, 'red');
    log(error.stack, 'red');
    process.exit(1);
  }
}

async function testDirectoryStructure() {
  const requiredDirs = [
    'web-ui',
    'web-ui/plugins',
    'web-ui/data',
    'web-ui/reports',
    'docs',
    'compliance'
  ];

  for (const dir of requiredDirs) {
    try {
      await fs.access(dir);
      recordTest(`Directory exists: ${dir}`, true, '', 'structure');
    } catch (error) {
      recordTest(`Directory exists: ${dir}`, false, error.message, 'structure');
    }
  }
}

async function testPluginFiles() {
  const plugins = [
    'admin', 'api-analytics', 'audit-log', 'auth', 'backup-recovery',
    'multi-server', 'notifications', 'policies', 'rate-limiting',
    'reporting', 'scanner', 'security', 'storage', 'system-info',
    'tenants', 'update', 'vpn', 'webhooks'
  ];

  for (const plugin of plugins) {
    const pluginDir = `web-ui/plugins/${plugin}`;
    const indexFile = `${pluginDir}/index.js`;
    const configFile = `${pluginDir}/plugin.json`;

    // Check if plugin directory exists
    try {
      await fs.access(pluginDir);
      recordTest(`Plugin ${plugin}: directory exists`, true, '', 'plugins');
    } catch (error) {
      recordTest(`Plugin ${plugin}: directory exists`, false, error.message, 'plugins');
      continue;
    }

    // Check if index.js exists
    try {
      await fs.access(indexFile);
      const content = await fs.readFile(indexFile, 'utf8');
      const hasInit = content.includes('init') || content.includes('async init');
      recordTest(`Plugin ${plugin}: has index.js with init()`, hasInit, hasInit ? '' : 'Missing init method', 'plugins');
    } catch (error) {
      recordTest(`Plugin ${plugin}: has index.js`, false, error.message, 'plugins');
    }

    // Check if plugin.json exists
    try {
      await fs.access(configFile);
      const config = JSON.parse(await fs.readFile(configFile, 'utf8'));
      const hasRequired = config.name && config.version;
      recordTest(`Plugin ${plugin}: has valid plugin.json`, hasRequired, hasRequired ? '' : 'Missing name or version', 'plugins');
    } catch (error) {
      recordTest(`Plugin ${plugin}: has plugin.json`, false, error.message, 'plugins');
    }
  }
}

async function testUserManager() {
  const userManagerFile = 'web-ui/plugins/admin/user-manager.js';

  try {
    const content = await fs.readFile(userManagerFile, 'utf8');

    // Check for SQLite implementation
    const hasSQLite = content.includes('sqlite3') && content.includes('require(\'sqlite3\')');
    recordTest('User Manager: Uses SQLite', hasSQLite, '', 'user-manager');

    // Check for database initialization
    const hasInit = content.includes('initDatabase') && content.includes('CREATE TABLE');
    recordTest('User Manager: Has database initialization', hasInit, '', 'user-manager');

    // Check for indexes
    const hasIndexes = content.includes('CREATE INDEX') && content.includes('idx_users_');
    recordTest('User Manager: Has database indexes', hasIndexes, '', 'user-manager');

    // Check for CRUD operations
    const hasCRUD = content.includes('createUser') && 
                    content.includes('getUserById') &&
                    content.includes('updateUser') &&
                    content.includes('deleteUser');
    recordTest('User Manager: Has CRUD operations', hasCRUD, '', 'user-manager');

    // Check for async/await
    const hasAsync = content.includes('async ') && content.includes('await ');
    recordTest('User Manager: Uses async/await', hasAsync, '', 'user-manager');

    // Check if users.db exists
    try {
      await fs.access('web-ui/data/users.db');
      recordTest('User Manager: Database file exists', true, '', 'user-manager');
    } catch (error) {
      recordTest('User Manager: Database file exists', false, 'Run plugin to create', 'user-manager');
    }

  } catch (error) {
    recordTest('User Manager: File exists', false, error.message, 'user-manager');
  }
}

async function testAuditLogPDF() {
  const auditIndexFile = 'web-ui/plugins/audit-log/index.js';
  const reportingTemplateFile = 'web-ui/plugins/reporting/templates/compliance_report.hbs';

  try {
    const content = await fs.readFile(auditIndexFile, 'utf8');

    // Check that TODO is removed
    const hasTODO = content.includes('TODO: Generate PDF report');
    recordTest('Audit-Log: PDF TODO removed', !hasTODO, hasTODO ? 'TODO still present' : '', 'audit-log');

    // Check for reporting service integration
    const hasReportingService = content.includes('ReportGenerator') || content.includes('reportingService');
    recordTest('Audit-Log: Integrates with ReportGenerator', hasReportingService, '', 'audit-log');

    // Check for PDF generation logic
    const hasPDFLogic = content.includes('generateReport') && content.includes('format: \'pdf\'');
    recordTest('Audit-Log: Has PDF generation logic', hasPDFLogic, '', 'audit-log');

    // Check for error handling
    const hasErrorHandling = content.includes('catch') && content.includes('Falling back');
    recordTest('Audit-Log: Has error handling with fallback', hasErrorHandling, '', 'audit-log');

  } catch (error) {
    recordTest('Audit-Log: File exists', false, error.message, 'audit-log');
  }

  // Check template file
  try {
    await fs.access(reportingTemplateFile);
    const templateContent = await fs.readFile(reportingTemplateFile, 'utf8');
    const hasHTML = templateContent.includes('<!DOCTYPE html>');
    const hasCompliance = templateContent.includes('Compliance') && templateContent.includes('{{report');
    recordTest('Reporting: Compliance template exists', true, '', 'audit-log');
    recordTest('Reporting: Template is valid HTML', hasHTML, '', 'audit-log');
    recordTest('Reporting: Template has compliance data', hasCompliance, '', 'audit-log');
  } catch (error) {
    recordTest('Reporting: Compliance template exists', false, error.message, 'audit-log');
  }
}

async function testDependencies() {
  try {
    const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
    const deps = packageJson.dependencies || {};

    const requiredDeps = {
      'sqlite3': 'User Manager persistence',
      'chart.js': 'Chart generation',
      'pdfkit': 'PDF generation',
      'puppeteer': 'HTML to PDF conversion',
      'handlebars': 'Template rendering',
      'node-cron': 'Scheduled tasks'
    };

    for (const [dep, purpose] of Object.entries(requiredDeps)) {
      const exists = deps.hasOwnProperty(dep);
      recordTest(`Dependency: ${dep} (${purpose})`, exists, exists ? `v${deps[dep]}` : 'Missing', 'dependencies');
    }

  } catch (error) {
    recordTest('package.json exists', false, error.message, 'dependencies');
  }
}

async function testPluginConfigurations() {
  const plugins = [
    'admin', 'auth', 'reporting', 'audit-log', 'tenants'
  ];

  for (const plugin of plugins) {
    try {
      const configPath = `web-ui/plugins/${plugin}/plugin.json`;
      const config = JSON.parse(await fs.readFile(configPath, 'utf8'));

      // Check basic fields
      const hasName = config.name === plugin;
      recordTest(`Config ${plugin}: name matches`, hasName, '', 'config');

      const hasVersion = config.version && /^\d+\.\d+\.\d+$/.test(config.version);
      recordTest(`Config ${plugin}: valid version`, hasVersion, config.version || 'Missing', 'config');

      // Check provides section
      if (config.provides) {
        const hasServices = Array.isArray(config.provides.services) && config.provides.services.length > 0;
        recordTest(`Config ${plugin}: provides services`, hasServices, hasServices ? config.provides.services.join(', ') : '', 'config');
      }

    } catch (error) {
      // Skip if file doesn't exist
    }
  }
}

async function testDatabaseFiles() {
  const dbFiles = [
    'web-ui/data/users.db',
    'web-ui/data/system.db'
  ];

  for (const dbFile of dbFiles) {
    try {
      const stats = await fs.stat(dbFile);
      const sizeKB = (stats.size / 1024).toFixed(2);
      recordTest(`Database: ${path.basename(dbFile)} exists`, true, `${sizeKB} KB`, 'database');
    } catch (error) {
      recordTest(`Database: ${path.basename(dbFile)} exists`, false, 'Not created yet', 'database');
    }
  }
}

async function testCrossPluginIntegrations() {
  // Check admin -> auth integration
  try {
    const adminIndex = await fs.readFile('web-ui/plugins/admin/index.js', 'utf8');
    const hasAuthMiddleware = adminIndex.includes('requireAuth') || adminIndex.includes('authPlugin');
    recordTest('Integration: admin uses auth middleware', hasAuthMiddleware, '', 'integration');
  } catch (error) {}

  // Check audit-log -> reporting integration
  try {
    const auditIndex = await fs.readFile('web-ui/plugins/audit-log/index.js', 'utf8');
    const usesReporting = auditIndex.includes('ReportGenerator') || auditIndex.includes('reportingService');
    recordTest('Integration: audit-log uses reporting service', usesReporting, '', 'integration');
  } catch (error) {}

  // Check if admin uses tenant isolation
  try {
    const adminUserManager = await fs.readFile('web-ui/plugins/admin/user-manager.js', 'utf8');
    const hasTenantSupport = adminUserManager.includes('tenantId') || adminUserManager.includes('tenant_id');
    recordTest('Integration: admin supports multi-tenancy', hasTenantSupport, '', 'integration');
  } catch (error) {}

  // Check if plugins use audit logging
  try {
    const adminIndex = await fs.readFile('web-ui/plugins/admin/index.js', 'utf8');
    const usesAudit = adminIndex.includes('auditLogger') || adminIndex.includes('AuditLogger');
    recordTest('Integration: admin uses audit logging', usesAudit, '', 'integration');
  } catch (error) {}
}

function printSummary() {
  logSection('Test Summary');

  // Overall results
  log(`Total Tests: ${results.total}`, 'blue');
  log(`Passed: ${results.passed}`, 'green');
  log(`Failed: ${results.failed}`, results.failed > 0 ? 'red' : 'green');
  log(`Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`, results.failed === 0 ? 'green' : 'yellow');

  // Category breakdown
  const categories = {};
  results.tests.forEach(test => {
    if (!categories[test.category]) {
      categories[test.category] = { total: 0, passed: 0 };
    }
    categories[test.category].total++;
    if (test.passed) categories[test.category].passed++;
  });

  console.log('\n' + 'Category Breakdown:');
  for (const [category, stats] of Object.entries(categories)) {
    const rate = ((stats.passed / stats.total) * 100).toFixed(0);
    const color = stats.passed === stats.total ? 'green' : stats.passed === 0 ? 'red' : 'yellow';
    log(`  ${category}: ${stats.passed}/${stats.total} (${rate}%)`, color);
  }

  // Failed tests
  if (results.failed > 0) {
    console.log('\n' + 'Failed Tests:');
    results.tests.filter(t => !t.passed).forEach(test => {
      log(`  ✗ ${test.name}`, 'red');
      if (test.details) {
        log(`    └─ ${test.details}`, 'yellow');
      }
    });
  }

  console.log('\n' + '='.repeat(80));
  if (results.failed === 0) {
    log('✅ ALL TESTS PASSED!', 'green');
  } else {
    log(`⚠️  ${results.failed} test(s) failed`, 'yellow');
  }
  console.log('='.repeat(80) + '\n');

  // Exit code
  process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  log(`\nUnhandled error: ${error.message}`, 'red');
  console.error(error.stack);
  process.exit(1);
});
