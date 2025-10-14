#!/usr/bin/env node
/**
 * Multi-Server Plugin Test Suite
 * Tests all functionality of the multi-server plugin
 */

const sqlite3 = require('sqlite3').verbose();
const { promisify } = require('util');

// Initialize in-memory database for testing
const db = new sqlite3.Database(':memory:');
db.run = promisify(db.run.bind(db));
db.get = promisify(db.get.bind(db));
db.all = promisify(db.all.bind(db));
db.exec = promisify(db.exec.bind(db));

// Load plugin
const multiServerPlugin = require('./plugins/multi-server');

// Test configuration
const TEST_TENANT = 'tenant-test-123';
const testServers = [];
const testGroups = [];
const testScans = [];

// Colors for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function runTests() {
  console.log('\n' + '='.repeat(80));
  log('🧪 MULTI-SERVER PLUGIN TEST SUITE', 'cyan');
  console.log('='.repeat(80) + '\n');

  try {
    // Phase 1: Initialize
    await testInitialization();

    // Phase 2: Server Management
    await testServerManagement();

    // Phase 3: Group Management
    await testGroupManagement();

    // Phase 4: Connection Testing
    await testConnectionManager();

    // Phase 5: Scan Operations (mock)
    await testScanOrchestrator();

    // Phase 6: Report Generation
    await testReportAggregator();

    // Phase 7: Integration
    await testIntegration();

    console.log('\n' + '='.repeat(80));
    log('✅ ALL TESTS PASSED!', 'green');
    console.log('='.repeat(80) + '\n');

    process.exit(0);

  } catch (error) {
    console.log('\n' + '='.repeat(80));
    log('❌ TEST FAILED', 'red');
    console.log('='.repeat(80));
    console.error(error);
    process.exit(1);
  }
}

/**
 * Phase 1: Test initialization
 */
async function testInitialization() {
  log('\n📦 Phase 1: Initialize Plugin', 'cyan');
  log('-'.repeat(80));

  const services = await multiServerPlugin.init(db);

  if (!services.serverManager) throw new Error('ServerManager not initialized');
  if (!services.groupManager) throw new Error('GroupManager not initialized');
  if (!services.connectionManager) throw new Error('ConnectionManager not initialized');
  if (!services.scanOrchestrator) throw new Error('ScanOrchestrator not initialized');
  if (!services.reportAggregator) throw new Error('ReportAggregator not initialized');

  log('   ✅ Plugin initialized', 'green');
  log('   ✅ ServerManager ready', 'green');
  log('   ✅ GroupManager ready', 'green');
  log('   ✅ ConnectionManager ready', 'green');
  log('   ✅ ScanOrchestrator ready', 'green');
  log('   ✅ ReportAggregator ready', 'green');

  // Verify database tables
  const tables = await db.all(`
    SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
  `);
  
  const expectedTables = ['servers', 'server_groups', 'multi_server_scans', 'server_scan_results'];
  for (const table of expectedTables) {
    if (!tables.find(t => t.name === table)) {
      throw new Error(`Table ${table} not created`);
    }
  }

  log(`   ✅ Database tables created: ${tables.length}`, 'green');
}

/**
 * Phase 2: Test server management
 */
async function testServerManagement() {
  log('\n🖥️  Phase 2: Server Management', 'cyan');
  log('-'.repeat(80));

  const serverManager = multiServerPlugin.serverManager;

  // Test 1: Add servers
  const servers = [
    {
      name: 'web-prod-01',
      host: '192.168.1.10',
      username: 'ubuntu',
      ssh_key_path: '~/.ssh/id_rsa',
      tags: ['production', 'web'],
      description: 'Production web server'
    },
    {
      name: 'db-prod-01',
      host: '192.168.1.20',
      username: 'ubuntu',
      ssh_key_path: '~/.ssh/id_rsa',
      tags: ['production', 'database'],
      description: 'Production database server'
    },
    {
      name: 'api-dev-01',
      host: '192.168.1.30',
      username: 'developer',
      ssh_key_path: '~/.ssh/id_rsa',
      tags: ['development', 'api'],
      description: 'Development API server'
    }
  ];

  for (const serverData of servers) {
    const server = await serverManager.addServer(TEST_TENANT, serverData);
    testServers.push(server);
    log(`   ✅ Added server: ${server.name}`, 'green');
  }

  // Test 2: List servers
  const allServers = await serverManager.listServers(TEST_TENANT);
  if (allServers.length !== 3) {
    throw new Error(`Expected 3 servers, got ${allServers.length}`);
  }
  log(`   ✅ Listed ${allServers.length} servers`, 'green');

  // Test 3: Filter by tags
  const prodServers = await serverManager.listServers(TEST_TENANT, { tags: ['production'] });
  if (prodServers.length !== 2) {
    throw new Error(`Expected 2 production servers, got ${prodServers.length}`);
  }
  log(`   ✅ Filtered by tags: ${prodServers.length} production servers`, 'green');

  // Test 4: Search
  const webServers = await serverManager.listServers(TEST_TENANT, { search: 'web' });
  if (webServers.length !== 1) {
    throw new Error(`Expected 1 web server, got ${webServers.length}`);
  }
  log(`   ✅ Search working: found ${webServers[0].name}`, 'green');

  // Test 5: Get single server
  const server = await serverManager.getServer(TEST_TENANT, testServers[0].id);
  if (server.name !== 'web-prod-01') {
    throw new Error('Get server failed');
  }
  log(`   ✅ Get server: ${server.name}`, 'green');

  // Test 6: Update server
  const updated = await serverManager.updateServer(TEST_TENANT, testServers[0].id, {
    description: 'Updated description',
    status: 'active'
  });
  if (updated.description !== 'Updated description') {
    throw new Error('Update server failed');
  }
  log(`   ✅ Updated server: ${updated.name}`, 'green');

  // Test 7: Statistics
  const stats = await serverManager.getStatistics(TEST_TENANT);
  if (stats.total !== 3) {
    throw new Error(`Expected 3 total servers, got ${stats.total}`);
  }
  log(`   ✅ Statistics: ${stats.total} total, ${stats.active} active`, 'green');
}

/**
 * Phase 3: Test group management
 */
async function testGroupManagement() {
  log('\n👥 Phase 3: Group Management', 'cyan');
  log('-'.repeat(80));

  const groupManager = multiServerPlugin.groupManager;

  // Test 1: Create groups
  const groups = [
    {
      name: 'production',
      description: 'Production servers',
      server_ids: [testServers[0].id, testServers[1].id]
    },
    {
      name: 'development',
      description: 'Development servers',
      server_ids: [testServers[2].id]
    }
  ];

  for (const groupData of groups) {
    const group = await groupManager.createGroup(TEST_TENANT, groupData);
    testGroups.push(group);
    log(`   ✅ Created group: ${group.name} (${group.server_ids.length} servers)`, 'green');
  }

  // Test 2: List groups
  const allGroups = await groupManager.listGroups(TEST_TENANT);
  if (allGroups.length !== 2) {
    throw new Error(`Expected 2 groups, got ${allGroups.length}`);
  }
  log(`   ✅ Listed ${allGroups.length} groups`, 'green');

  // Test 3: Get group
  const group = await groupManager.getGroup(TEST_TENANT, testGroups[0].id);
  if (group.name !== 'production') {
    throw new Error('Get group failed');
  }
  log(`   ✅ Get group: ${group.name}`, 'green');

  // Test 4: Update group
  const updated = await groupManager.updateGroup(TEST_TENANT, testGroups[0].id, {
    description: 'Critical production infrastructure'
  });
  if (updated.description !== 'Critical production infrastructure') {
    throw new Error('Update group failed');
  }
  log(`   ✅ Updated group: ${updated.name}`, 'green');

  // Test 5: Add server to group
  const withNew = await groupManager.addServers(TEST_TENANT, testGroups[1].id, [testServers[0].id]);
  if (withNew.server_ids.length !== 2) {
    throw new Error('Add servers to group failed');
  }
  log(`   ✅ Added server to group: now ${withNew.server_ids.length} servers`, 'green');

  // Test 6: Remove server from group
  const withRemoved = await groupManager.removeServers(TEST_TENANT, testGroups[1].id, [testServers[0].id]);
  if (withRemoved.server_ids.length !== 1) {
    throw new Error('Remove servers from group failed');
  }
  log(`   ✅ Removed server from group: now ${withRemoved.server_ids.length} servers`, 'green');
}

/**
 * Phase 4: Test connection manager
 */
async function testConnectionManager() {
  log('\n🔐 Phase 4: Connection Manager', 'cyan');
  log('-'.repeat(80));

  const connectionManager = multiServerPlugin.connectionManager;

  // Note: These tests won't actually connect (no real SSH available in test)
  log('   ℹ️  Connection tests are mocked (no real SSH in test environment)', 'yellow');

  // Test 1: SSH availability check
  const sshAvailable = await connectionManager.constructor.checkSSHAvailable();
  log(`   ✅ SSH availability checked: ${sshAvailable ? 'available' : 'not available'}`, 'green');

  // Test 2: Connection manager methods exist
  if (typeof connectionManager.testConnection !== 'function') {
    throw new Error('testConnection method not found');
  }
  if (typeof connectionManager.executeRemoteCommand !== 'function') {
    throw new Error('executeRemoteCommand method not found');
  }
  if (typeof connectionManager.copyToServer !== 'function') {
    throw new Error('copyToServer method not found');
  }
  if (typeof connectionManager.copyFromServer !== 'function') {
    throw new Error('copyFromServer method not found');
  }

  log('   ✅ Connection manager methods available', 'green');
}

/**
 * Phase 5: Test scan orchestrator
 */
async function testScanOrchestrator() {
  log('\n⚡ Phase 5: Scan Orchestrator', 'cyan');
  log('-'.repeat(80));

  const scanOrchestrator = multiServerPlugin.scanOrchestrator;

  // Test 1: Create mock scan (won't actually execute)
  log('   ℹ️  Scan execution is mocked (no real servers)', 'yellow');

  // Insert mock scan directly into database
  const scanId = 'test-scan-' + Date.now();
  await db.run(`
    INSERT INTO multi_server_scans (
      id, tenant_id, name, server_ids, status, 
      total_servers, completed_servers, failed_servers, started_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    scanId,
    TEST_TENANT,
    'Test Production Scan',
    JSON.stringify([testServers[0].id, testServers[1].id]),
    'completed',
    2,
    2,
    0,
    new Date().toISOString()
  ]);

  // Insert mock results
  for (let i = 0; i < 2; i++) {
    await db.run(`
      INSERT INTO server_scan_results (
        id, scan_id, server_id, tenant_id, status,
        started_at, completed_at, duration, vulnerabilities
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      `result-${i}`,
      scanId,
      testServers[i].id,
      TEST_TENANT,
      'completed',
      new Date().toISOString(),
      new Date().toISOString(),
      5000,
      JSON.stringify({ critical: 0, high: 2, medium: 3, low: 5 })
    ]);
  }

  testScans.push(scanId);
  log(`   ✅ Created mock scan: ${scanId}`, 'green');

  // Test 2: Get scan status
  const scan = await scanOrchestrator.getScanStatus(TEST_TENANT, scanId);
  if (!scan || scan.status !== 'completed') {
    throw new Error('Get scan status failed');
  }
  log(`   ✅ Get scan status: ${scan.status}`, 'green');

  // Test 3: List scans
  const scans = await scanOrchestrator.listScans(TEST_TENANT);
  if (scans.length !== 1) {
    throw new Error(`Expected 1 scan, got ${scans.length}`);
  }
  log(`   ✅ Listed ${scans.length} scans`, 'green');
}

/**
 * Phase 6: Test report aggregator
 */
async function testReportAggregator() {
  log('\n📊 Phase 6: Report Aggregator', 'cyan');
  log('-'.repeat(80));

  const reportAggregator = multiServerPlugin.reportAggregator;

  // Test 1: Generate consolidated report
  const report = await reportAggregator.generateConsolidatedReport(TEST_TENANT, testScans[0]);
  if (!report || !report.statistics) {
    throw new Error('Generate consolidated report failed');
  }
  log(`   ✅ Generated consolidated report`, 'green');
  log(`      Total servers: ${report.statistics.total_servers}`, 'cyan');
  log(`      Vulnerabilities: ${report.statistics.vulnerabilities.total}`, 'cyan');

  // Test 2: Export report to different formats
  const jsonExport = await reportAggregator.exportReport(report, 'json');
  if (!jsonExport) {
    throw new Error('Export JSON failed');
  }
  log(`   ✅ Exported report to JSON (${jsonExport.length} bytes)`, 'green');

  const csvExport = await reportAggregator.exportReport(report, 'csv');
  if (!csvExport) {
    throw new Error('Export CSV failed');
  }
  log(`   ✅ Exported report to CSV (${csvExport.length} bytes)`, 'green');

  const textExport = await reportAggregator.exportReport(report, 'text');
  if (!textExport) {
    throw new Error('Export text failed');
  }
  log(`   ✅ Exported report to text (${textExport.length} bytes)`, 'green');

  // Test 3: Server-specific report
  const serverReport = await reportAggregator.generateServerReport(TEST_TENANT, testServers[0].id);
  if (!serverReport || !serverReport.server) {
    throw new Error('Generate server report failed');
  }
  log(`   ✅ Generated server report for ${serverReport.server.name}`, 'green');
}

/**
 * Phase 7: Test integration
 */
async function testIntegration() {
  log('\n🔗 Phase 7: Integration Test', 'cyan');
  log('-'.repeat(80));

  const serverManager = multiServerPlugin.serverManager;
  const groupManager = multiServerPlugin.groupManager;

  // Test 1: Delete server from group
  const group = await groupManager.getGroup(TEST_TENANT, testGroups[0].id);
  const serverToDelete = testServers[1].id;

  // Verify server is in group
  if (!group.server_ids.includes(serverToDelete)) {
    throw new Error('Server not in group before delete');
  }

  // Delete server
  await serverManager.deleteServer(TEST_TENANT, serverToDelete);
  log(`   ✅ Deleted server: ${testServers[1].name}`, 'green');

  // Verify deletion
  try {
    await serverManager.getServer(TEST_TENANT, serverToDelete);
    throw new Error('Server should be deleted');
  } catch (error) {
    if (error.message !== 'Server not found') {
      throw error;
    }
  }
  log(`   ✅ Server deletion verified`, 'green');

  // Test 2: Delete group
  await groupManager.deleteGroup(TEST_TENANT, testGroups[1].id);
  log(`   ✅ Deleted group: ${testGroups[1].name}`, 'green');

  // Verify deletion
  try {
    await groupManager.getGroup(TEST_TENANT, testGroups[1].id);
    throw new Error('Group should be deleted');
  } catch (error) {
    if (error.message !== 'Group not found') {
      throw error;
    }
  }
  log(`   ✅ Group deletion verified`, 'green');

  // Test 3: Plugin metadata
  const metadata = multiServerPlugin.getMetadata();
  if (!metadata || !metadata.name || !metadata.version) {
    throw new Error('Plugin metadata invalid');
  }
  log(`   ✅ Plugin metadata: ${metadata.name} v${metadata.version}`, 'green');
  log(`      Services: ${metadata.services.length}`, 'cyan');
  log(`      Endpoints: ${metadata.endpoints}`, 'cyan');
  log(`      Features: ${metadata.features.length}`, 'cyan');
}

// Run tests
runTests();
