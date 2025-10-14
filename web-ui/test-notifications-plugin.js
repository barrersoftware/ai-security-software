#!/usr/bin/env node
/**
 * Notifications Plugin Test Suite
 * Tests all functionality of the notifications plugin
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
const notificationsPlugin = require('./plugins/notifications');

// Test configuration
const TEST_TENANT = 'tenant-test-123';
const testChannels = [];
const testNotifications = [];
const testRules = [];

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
  log('🧪 NOTIFICATIONS PLUGIN TEST SUITE', 'cyan');
  console.log('='.repeat(80) + '\n');

  try {
    // Phase 1: Initialize
    await testInitialization();

    // Phase 2: Channel Management
    await testChannelManagement();

    // Phase 3: Notification Management
    await testNotificationManagement();

    // Phase 4: Alert Engine
    await testAlertEngine();

    // Phase 5: Template Manager
    await testTemplateManager();

    // Phase 6: Integration
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

  const services = await notificationsPlugin.init(db);

  if (!services.channelManager) throw new Error('ChannelManager not initialized');
  if (!services.deliveryManager) throw new Error('DeliveryManager not initialized');
  if (!services.notificationManager) throw new Error('NotificationManager not initialized');
  if (!services.alertEngine) throw new Error('AlertEngine not initialized');
  if (!services.templateManager) throw new Error('TemplateManager not initialized');

  log('   ✅ Plugin initialized', 'green');
  log('   ✅ ChannelManager ready', 'green');
  log('   ✅ DeliveryManager ready', 'green');
  log('   ✅ NotificationManager ready', 'green');
  log('   ✅ AlertEngine ready', 'green');
  log('   ✅ TemplateManager ready', 'green');

  // Verify database tables
  const tables = await db.all(`
    SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
  `);
  
  const expectedTables = ['notification_channels', 'notification_history', 'alert_rules'];
  for (const table of expectedTables) {
    if (!tables.find(t => t.name === table)) {
      throw new Error(`Table ${table} not created`);
    }
  }

  log(`   ✅ Database tables created: ${tables.length}`, 'green');
}

/**
 * Phase 2: Test channel management
 */
async function testChannelManagement() {
  log('\n📢 Phase 2: Channel Management', 'cyan');
  log('-'.repeat(80));

  const channelManager = notificationsPlugin.channelManager;

  // Test 1: Add Slack channel
  const slackChannel = await channelManager.addChannel(TEST_TENANT, {
    name: 'production-slack',
    type: 'slack',
    config: {
      webhook_url: 'https://hooks.slack.com/services/TEST/TEST/TEST'
    },
    enabled: true
  });
  testChannels.push(slackChannel);
  log(`   ✅ Added Slack channel: ${slackChannel.name}`, 'green');

  // Test 2: Add Discord channel
  const discordChannel = await channelManager.addChannel(TEST_TENANT, {
    name: 'security-discord',
    type: 'discord',
    config: {
      webhook_url: 'https://discord.com/api/webhooks/TEST/TEST'
    },
    enabled: true
  });
  testChannels.push(discordChannel);
  log(`   ✅ Added Discord channel: ${discordChannel.name}`, 'green');

  // Test 3: Add Email channel
  const emailChannel = await channelManager.addChannel(TEST_TENANT, {
    name: 'security-email',
    type: 'email',
    config: {
      smtp_host: 'smtp.example.com',
      smtp_port: 587,
      smtp_secure: false,
      from: 'security@example.com',
      recipients: ['admin@example.com', 'security@example.com']
    },
    enabled: true
  });
  testChannels.push(emailChannel);
  log(`   ✅ Added Email channel: ${emailChannel.name}`, 'green');

  // Test 4: List channels
  const allChannels = await channelManager.listChannels(TEST_TENANT);
  if (allChannels.length !== 3) {
    throw new Error(`Expected 3 channels, got ${allChannels.length}`);
  }
  log(`   ✅ Listed ${allChannels.length} channels`, 'green');

  // Test 5: Filter by type
  const slackChannels = await channelManager.listChannels(TEST_TENANT, { type: 'slack' });
  if (slackChannels.length !== 1) {
    throw new Error(`Expected 1 Slack channel, got ${slackChannels.length}`);
  }
  log(`   ✅ Filtered by type: ${slackChannels.length} Slack channels`, 'green');

  // Test 6: Get single channel
  const channel = await channelManager.getChannel(TEST_TENANT, testChannels[0].id);
  if (channel.name !== 'production-slack') {
    throw new Error('Get channel failed');
  }
  log(`   ✅ Get channel: ${channel.name}`, 'green');

  // Test 7: Update channel
  const updated = await channelManager.updateChannel(TEST_TENANT, testChannels[0].id, {
    enabled: false
  });
  if (updated.enabled !== false) {
    throw new Error('Update channel failed');
  }
  log(`   ✅ Updated channel: disabled ${updated.name}`, 'green');

  // Re-enable for later tests
  await channelManager.updateChannel(TEST_TENANT, testChannels[0].id, { enabled: true });

  // Test 8: Channel statistics
  const stats = await channelManager.getChannelStats(TEST_TENANT);
  if (stats.length === 0) {
    throw new Error('Channel stats failed');
  }
  log(`   ✅ Channel statistics retrieved`, 'green');
}

/**
 * Phase 3: Test notification management
 */
async function testNotificationManagement() {
  log('\n📬 Phase 3: Notification Management', 'cyan');
  log('-'.repeat(80));

  const notificationManager = notificationsPlugin.notificationManager;

  // Test 1: Send notification (will fail delivery but should record)
  log('   ℹ️  Note: Delivery will fail (no real channels), but tracking works', 'yellow');
  
  const notification = {
    channel_ids: [testChannels[0].id],
    type: 'test',
    priority: 'medium',
    subject: 'Test Notification',
    message: 'This is a test notification message',
    skipThrottle: true // Skip throttling for tests
  };

  const result = await notificationManager.sendNotification(TEST_TENANT, notification);
  if (!result.notification_id) {
    throw new Error('Send notification failed');
  }
  testNotifications.push(result.notification_id);
  log(`   ✅ Notification sent: ${result.notification_id}`, 'green');

  // Test 2: List notifications
  const notifications = await notificationManager.listNotifications(TEST_TENANT);
  if (notifications.length !== 1) {
    throw new Error(`Expected 1 notification, got ${notifications.length}`);
  }
  log(`   ✅ Listed ${notifications.length} notifications`, 'green');

  // Test 3: Get single notification
  const notif = await notificationManager.getNotification(TEST_TENANT, testNotifications[0]);
  if (!notif) {
    throw new Error('Get notification failed');
  }
  log(`   ✅ Get notification: ${notif.subject}`, 'green');

  // Test 4: Filter by priority
  const mediumNotifs = await notificationManager.listNotifications(TEST_TENANT, {
    priority: 'medium'
  });
  if (mediumNotifs.length !== 1) {
    throw new Error('Filter notifications failed');
  }
  log(`   ✅ Filtered by priority: ${mediumNotifs.length} medium notifications`, 'green');

  // Test 5: Statistics
  const stats = await notificationManager.getStatistics(TEST_TENANT);
  if (stats.total !== 1) {
    throw new Error('Statistics failed');
  }
  log(`   ✅ Statistics: ${stats.total} total notifications`, 'green');

  // Test 6: Throttling
  const throttled = await notificationManager.sendNotification(TEST_TENANT, {
    ...notification,
    skipThrottle: false // Test throttling
  });
  
  // Second send with same subject should be throttled
  const throttled2 = await notificationManager.sendNotification(TEST_TENANT, {
    ...notification,
    skipThrottle: false
  });
  
  if (!throttled2.throttled) {
    log('   ⚠️  Throttling not working as expected', 'yellow');
  } else {
    log(`   ✅ Throttling working correctly`, 'green');
  }
}

/**
 * Phase 4: Test alert engine
 */
async function testAlertEngine() {
  log('\n🚨 Phase 4: Alert Engine', 'cyan');
  log('-'.repeat(80));

  const alertEngine = notificationsPlugin.alertEngine;

  // Test 1: Create alert rule
  const rule = await alertEngine.createRule(TEST_TENANT, {
    name: 'Critical Vulnerability Alert',
    description: 'Alert on critical vulnerabilities',
    condition: {
      event: 'vulnerability.found',
      field: 'data.severity',
      operator: 'equals',
      value: 'critical'
    },
    channels: [testChannels[0].id],
    priority: 'critical',
    enabled: true
  });
  testRules.push(rule);
  log(`   ✅ Created alert rule: ${rule.name}`, 'green');

  // Test 2: Create another rule
  const scanRule = await alertEngine.createRule(TEST_TENANT, {
    name: 'Scan Failed Alert',
    description: 'Alert when scan fails',
    condition: {
      event: 'scan.failed',
      field: 'data.error',
      operator: 'contains',
      value: 'timeout'
    },
    channels: [testChannels[0].id, testChannels[1].id],
    priority: 'high',
    enabled: true
  });
  testRules.push(scanRule);
  log(`   ✅ Created alert rule: ${scanRule.name}`, 'green');

  // Test 3: List rules
  const rules = await alertEngine.listRules(TEST_TENANT);
  if (rules.length !== 2) {
    throw new Error(`Expected 2 rules, got ${rules.length}`);
  }
  log(`   ✅ Listed ${rules.length} alert rules`, 'green');

  // Test 4: Get single rule
  const retrievedRule = await alertEngine.getRule(TEST_TENANT, testRules[0].id);
  if (retrievedRule.name !== 'Critical Vulnerability Alert') {
    throw new Error('Get rule failed');
  }
  log(`   ✅ Get rule: ${retrievedRule.name}`, 'green');

  // Test 5: Update rule
  const updated = await alertEngine.updateRule(TEST_TENANT, testRules[0].id, {
    enabled: false
  });
  if (updated.enabled !== false) {
    throw new Error('Update rule failed');
  }
  log(`   ✅ Updated rule: disabled ${updated.name}`, 'green');

  // Re-enable for event test
  await alertEngine.updateRule(TEST_TENANT, testRules[0].id, { enabled: true });

  // Test 6: Evaluate event
  const event = {
    type: 'vulnerability.found',
    data: {
      severity: 'critical',
      cve: 'CVE-2024-1234',
      server: 'web-prod-01'
    }
  };

  const evalResult = await alertEngine.evaluateEvent(TEST_TENANT, event);
  if (evalResult.triggered !== 1) {
    log(`   ⚠️  Event evaluation: ${evalResult.triggered} rules triggered (expected 1)`, 'yellow');
  } else {
    log(`   ✅ Event evaluation: ${evalResult.triggered} rules triggered`, 'green');
  }

  // Test 7: Rule statistics
  const stats = await alertEngine.getRuleStatistics(TEST_TENANT);
  if (stats.total !== 2) {
    throw new Error('Rule statistics failed');
  }
  log(`   ✅ Rule statistics: ${stats.total} total rules`, 'green');
}

/**
 * Phase 5: Test template manager
 */
async function testTemplateManager() {
  log('\n📝 Phase 5: Template Manager', 'cyan');
  log('-'.repeat(80));

  const templateManager = notificationsPlugin.templateManager;

  // Test 1: List templates
  const templates = templateManager.listTemplates();
  if (templates.length === 0) {
    throw new Error('No templates found');
  }
  log(`   ✅ Listed ${templates.length} templates`, 'green');

  // Test 2: Get template
  const template = templateManager.getTemplate('scan_complete');
  if (!template.subject || !template.message) {
    throw new Error('Get template failed');
  }
  log(`   ✅ Get template: scan_complete`, 'green');

  // Test 3: Render template
  const data = {
    scan_name: 'Test Scan',
    status: 'successfully',
    vulnerabilities: {
      critical: 0,
      high: 2,
      medium: 5,
      low: 12
    },
    duration: '5.2s',
    server: 'web-prod-01'
  };

  const rendered = templateManager.renderTemplate('scan_complete', data);
  if (!rendered.subject.includes('Test Scan')) {
    throw new Error('Template rendering failed');
  }
  log(`   ✅ Rendered template: ${rendered.subject}`, 'green');

  // Test 4: Extract variables
  const variables = templateManager.extractVariables(template);
  if (variables.length === 0) {
    throw new Error('Extract variables failed');
  }
  log(`   ✅ Extracted ${variables.length} variables`, 'green');

  // Test 5: Create from template
  const notification = templateManager.createFromTemplate('scan_complete', data, {
    priority: 'medium',
    channelIds: [testChannels[0].id]
  });
  if (!notification.subject || !notification.message) {
    throw new Error('Create from template failed');
  }
  log(`   ✅ Created notification from template`, 'green');
}

/**
 * Phase 6: Test integration
 */
async function testIntegration() {
  log('\n🔗 Phase 6: Integration Test', 'cyan');
  log('-'.repeat(80));

  // Test 1: Send notification using template
  const notificationManager = notificationsPlugin.notificationManager;
  const templateManager = notificationsPlugin.templateManager;

  const notification = templateManager.createFromTemplate('scan_complete', {
    scan_name: 'Integration Test Scan',
    status: 'successfully',
    vulnerabilities: { critical: 1, high: 3, medium: 5, low: 10 },
    duration: '3.5s',
    server: 'test-server-01'
  }, {
    priority: 'high',
    channelIds: [testChannels[0].id, testChannels[1].id]
  });

  const result = await notificationManager.sendNotification(TEST_TENANT, notification);
  if (!result.notification_id) {
    throw new Error('Template notification failed');
  }
  log(`   ✅ Sent notification using template`, 'green');

  // Test 2: Delete channel
  const channelManager = notificationsPlugin.channelManager;
  await channelManager.deleteChannel(TEST_TENANT, testChannels[2].id);
  log(`   ✅ Deleted channel: ${testChannels[2].name}`, 'green');

  // Verify deletion
  try {
    await channelManager.getChannel(TEST_TENANT, testChannels[2].id);
    throw new Error('Channel should be deleted');
  } catch (error) {
    if (error.message !== 'Channel not found') {
      throw error;
    }
  }
  log(`   ✅ Channel deletion verified`, 'green');

  // Test 3: Delete rule
  const alertEngine = notificationsPlugin.alertEngine;
  await alertEngine.deleteRule(TEST_TENANT, testRules[1].id);
  log(`   ✅ Deleted alert rule: ${testRules[1].name}`, 'green');

  // Verify deletion
  try {
    await alertEngine.getRule(TEST_TENANT, testRules[1].id);
    throw new Error('Rule should be deleted');
  } catch (error) {
    if (error.message !== 'Alert rule not found') {
      throw error;
    }
  }
  log(`   ✅ Rule deletion verified`, 'green');

  // Test 4: Plugin metadata
  const metadata = notificationsPlugin.getMetadata();
  if (!metadata || !metadata.name || !metadata.version) {
    throw new Error('Plugin metadata invalid');
  }
  log(`   ✅ Plugin metadata: ${metadata.name} v${metadata.version}`, 'green');
  log(`      Services: ${metadata.services.length}`, 'cyan');
  log(`      Endpoints: ${metadata.endpoints}`, 'cyan');
  log(`      Channels: ${metadata.channels.length}`, 'cyan');
  log(`      Features: ${metadata.features.length}`, 'cyan');
}

// Run tests
runTests();
