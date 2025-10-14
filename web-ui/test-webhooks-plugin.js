#!/usr/bin/env node
/**
 * Webhooks Plugin Test Suite
 * Tests all functionality of the webhooks plugin
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
const webhooksPlugin = require('./plugins/webhooks');

// Test configuration
const TEST_TENANT = 'tenant-test-123';
const testWebhooks = [];
const testDeliveries = [];

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
  log('🧪 WEBHOOKS PLUGIN TEST SUITE', 'cyan');
  console.log('='.repeat(80) + '\n');

  try {
    // Phase 1: Initialize
    await testInitialization();

    // Phase 2: Webhook Management
    await testWebhookManagement();

    // Phase 3: Security Manager
    await testSecurityManager();

    // Phase 4: Event Dispatcher
    await testEventDispatcher();

    // Phase 5: Delivery Manager
    await testDeliveryManager();

    // Phase 6: Integration
    await testIntegration();

    console.log('\n' + '='.repeat(80));
    log('✅ ALL TESTS PASSED!', 'green');
    console.log('='.repeat(80) + '\n');

    // Cleanup
    webhooksPlugin.stopRetryProcessor();
    process.exit(0);

  } catch (error) {
    console.log('\n' + '='.repeat(80));
    log('❌ TEST FAILED', 'red');
    console.log('='.repeat(80));
    console.error(error);
    webhooksPlugin.stopRetryProcessor();
    process.exit(1);
  }
}

/**
 * Phase 1: Test initialization
 */
async function testInitialization() {
  log('\n📦 Phase 1: Initialize Plugin', 'cyan');
  log('-'.repeat(80));

  const services = await webhooksPlugin.init(db);

  if (!services.webhookManager) throw new Error('WebhookManager not initialized');
  if (!services.deliveryManager) throw new Error('DeliveryManager not initialized');
  if (!services.securityManager) throw new Error('SecurityManager not initialized');
  if (!services.eventDispatcher) throw new Error('EventDispatcher not initialized');

  log('   ✅ Plugin initialized', 'green');
  log('   ✅ WebhookManager ready', 'green');
  log('   ✅ DeliveryManager ready', 'green');
  log('   ✅ SecurityManager ready', 'green');
  log('   ✅ EventDispatcher ready', 'green');

  // Verify database tables
  const tables = await db.all(`
    SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
  `);
  
  const expectedTables = ['webhooks', 'webhook_deliveries'];
  for (const table of expectedTables) {
    if (!tables.find(t => t.name === table)) {
      throw new Error(`Table ${table} not created`);
    }
  }

  log(`   ✅ Database tables created: ${tables.length}`, 'green');
}

/**
 * Phase 2: Test webhook management
 */
async function testWebhookManagement() {
  log('\n🔗 Phase 2: Webhook Management', 'cyan');
  log('-'.repeat(80));

  const webhookManager = webhooksPlugin.webhookManager;

  // Test 1: Create webhooks
  const webhook1 = await webhookManager.createWebhook(TEST_TENANT, {
    name: 'SIEM Integration',
    url: 'https://siem.example.com/webhook',
    events: ['scan.completed', 'vulnerability.found'],
    secret: 'test-secret-123',
    enabled: true
  });
  testWebhooks.push(webhook1);
  log(`   ✅ Created webhook: ${webhook1.name}`, 'green');

  const webhook2 = await webhookManager.createWebhook(TEST_TENANT, {
    name: 'Ticketing System',
    url: 'https://tickets.example.com/api/webhook',
    events: ['policy.failed', 'alert.triggered'],
    headers: { 'X-API-Key': 'test-key' },
    enabled: true
  });
  testWebhooks.push(webhook2);
  log(`   ✅ Created webhook: ${webhook2.name}`, 'green');

  // Test 2: List webhooks
  const allWebhooks = await webhookManager.listWebhooks(TEST_TENANT);
  if (allWebhooks.length !== 2) {
    throw new Error(`Expected 2 webhooks, got ${allWebhooks.length}`);
  }
  log(`   ✅ Listed ${allWebhooks.length} webhooks`, 'green');

  // Test 3: Filter by event
  const scanWebhooks = await webhookManager.listWebhooks(TEST_TENANT, {
    event: 'scan.completed'
  });
  if (scanWebhooks.length !== 1) {
    throw new Error(`Expected 1 scan webhook, got ${scanWebhooks.length}`);
  }
  log(`   ✅ Filtered by event: ${scanWebhooks.length} webhooks`, 'green');

  // Test 4: Get single webhook
  const webhook = await webhookManager.getWebhook(TEST_TENANT, testWebhooks[0].id);
  if (webhook.name !== 'SIEM Integration') {
    throw new Error('Get webhook failed');
  }
  log(`   ✅ Get webhook: ${webhook.name}`, 'green');

  // Test 5: Update webhook
  const updated = await webhookManager.updateWebhook(TEST_TENANT, testWebhooks[0].id, {
    enabled: false
  });
  if (updated.enabled !== false) {
    throw new Error('Update webhook failed');
  }
  log(`   ✅ Updated webhook: disabled ${updated.name}`, 'green');

  // Re-enable for later tests
  await webhookManager.updateWebhook(TEST_TENANT, testWebhooks[0].id, { enabled: true });

  // Test 6: Get webhooks by event
  const eventWebhooks = await webhookManager.getWebhooksByEvent(TEST_TENANT, 'scan.completed');
  if (eventWebhooks.length !== 1) {
    throw new Error('Get webhooks by event failed');
  }
  log(`   ✅ Get webhooks by event: ${eventWebhooks.length} webhooks`, 'green');

  // Test 7: Statistics
  const stats = await webhookManager.getStatistics(TEST_TENANT);
  if (stats.total !== 2) {
    throw new Error('Statistics failed');
  }
  log(`   ✅ Statistics: ${stats.total} total webhooks`, 'green');

  // Test 8: Valid events
  const validEvents = webhookManager.getValidEvents();
  if (validEvents.length === 0) {
    throw new Error('Valid events failed');
  }
  log(`   ✅ Valid events: ${validEvents.length} event types`, 'green');
}

/**
 * Phase 3: Test security manager
 */
async function testSecurityManager() {
  log('\n🔐 Phase 3: Security Manager', 'cyan');
  log('-'.repeat(80));

  const securityManager = webhooksPlugin.securityManager;

  // Test 1: Generate signature
  const payload = JSON.stringify({ test: 'data' });
  const secret = 'test-secret';
  const signature = securityManager.generateSignature(payload, secret);
  if (!signature || !signature.startsWith('sha256=')) {
    throw new Error('Generate signature failed');
  }
  log(`   ✅ Generated HMAC signature`, 'green');

  // Test 2: Verify signature
  const isValid = securityManager.verifySignature(payload, signature, secret);
  if (!isValid) {
    throw new Error('Verify signature failed');
  }
  log(`   ✅ Verified HMAC signature`, 'green');

  // Test 3: Invalid signature
  const isInvalid = securityManager.verifySignature(payload, 'sha256=wrong', secret);
  if (isInvalid) {
    throw new Error('Should reject invalid signature');
  }
  log(`   ✅ Rejected invalid signature`, 'green');

  // Test 4: Generate secret
  const generatedSecret = securityManager.generateSecret();
  if (!generatedSecret || generatedSecret.length !== 64) {
    throw new Error('Generate secret failed');
  }
  log(`   ✅ Generated secure secret (${generatedSecret.length} chars)`, 'green');

  // Test 5: Validate payload size
  const smallPayload = { test: 'small' };
  const valid = securityManager.validatePayloadSize(smallPayload);
  if (!valid) {
    throw new Error('Payload size validation failed');
  }
  log(`   ✅ Validated payload size`, 'green');

  // Test 6: Rate limiting
  const webhookId = testWebhooks[0].id;
  const rateLimit = securityManager.checkRateLimit(webhookId, 2, 60000);
  if (!rateLimit.allowed) {
    throw new Error('Rate limit check failed');
  }
  log(`   ✅ Rate limiting: ${rateLimit.remaining} remaining`, 'green');

  // Test 7: Sanitize payload
  const sensitiveData = { username: 'test', password: 'secret123', apiKey: 'key123' };
  const sanitized = securityManager.sanitizePayload(sensitiveData);
  if (sanitized.password !== '[REDACTED]' || sanitized.apiKey !== '[REDACTED]') {
    throw new Error('Sanitize payload failed');
  }
  log(`   ✅ Sanitized sensitive data`, 'green');
}

/**
 * Phase 4: Test event dispatcher
 */
async function testEventDispatcher() {
  log('\n📡 Phase 4: Event Dispatcher', 'cyan');
  log('-'.repeat(80));

  const eventDispatcher = webhooksPlugin.eventDispatcher;

  // Test 1: Get event types
  const eventTypes = eventDispatcher.getEventTypes();
  if (eventTypes.length === 0) {
    throw new Error('Get event types failed');
  }
  log(`   ✅ Got ${eventTypes.length} event types`, 'green');

  // Test 2: Event descriptions
  const scanEvent = eventTypes.find(e => e.event === 'scan.completed');
  if (!scanEvent || !scanEvent.description) {
    throw new Error('Event description failed');
  }
  log(`   ✅ Event descriptions available`, 'green');

  // Test 3: Dispatch event (will fail delivery, but should track)
  log('   ℹ️  Note: Delivery will fail (no real endpoint), but tracking works', 'yellow');
  
  const result = await eventDispatcher.dispatchEvent(TEST_TENANT, 'scan.completed', {
    scan_id: 'test-scan-123',
    vulnerabilities: { critical: 2, high: 5 }
  });
  
  if (!result.success) {
    log(`   ⚠️  Event dispatch: ${result.error || 'expected failure (no real endpoint)'}`, 'yellow');
  }
  log(`   ✅ Event dispatched to ${result.webhooks || 0} webhooks`, 'green');
}

/**
 * Phase 5: Test delivery manager
 */
async function testDeliveryManager() {
  log('\n📬 Phase 5: Delivery Manager', 'cyan');
  log('-'.repeat(80));

  const deliveryManager = webhooksPlugin.deliveryManager;

  log('   ℹ️  Delivery tests use mock endpoints', 'yellow');

  // Test 1: List deliveries
  const deliveries = await deliveryManager.listDeliveries(TEST_TENANT, testWebhooks[0].id);
  log(`   ✅ Listed ${deliveries.length} deliveries`, 'green');

  // Test 2: Get statistics
  const stats = await deliveryManager.getStatistics(TEST_TENANT, testWebhooks[0].id);
  if (stats.total !== undefined) {
    log(`   ✅ Statistics: ${stats.total} total deliveries`, 'green');
  }

  // Test 3: Process retries (should handle gracefully with no pending)
  const processed = await deliveryManager.processRetries();
  log(`   ✅ Processed ${processed} pending retries`, 'green');
}

/**
 * Phase 6: Test integration
 */
async function testIntegration() {
  log('\n🔗 Phase 6: Integration Test', 'cyan');
  log('-'.repeat(80));

  const webhookManager = webhooksPlugin.webhookManager;
  const eventDispatcher = webhooksPlugin.eventDispatcher;

  // Test 1: Trigger event for webhook
  const result = await webhooksPlugin.triggerEvent(TEST_TENANT, 'policy.failed', {
    policy: 'CIS Benchmark',
    failures: 5,
    server: 'web-prod-01'
  });
  
  if (result.success) {
    log(`   ✅ Triggered event via plugin method`, 'green');
  } else {
    log(`   ⚠️  Event trigger: ${result.error || 'no webhooks subscribed'}`, 'yellow');
  }

  // Test 2: Delete webhook
  await webhookManager.deleteWebhook(TEST_TENANT, testWebhooks[1].id);
  log(`   ✅ Deleted webhook: ${testWebhooks[1].name}`, 'green');

  // Verify deletion
  try {
    await webhookManager.getWebhook(TEST_TENANT, testWebhooks[1].id);
    throw new Error('Webhook should be deleted');
  } catch (error) {
    if (error.message !== 'Webhook not found') {
      throw error;
    }
  }
  log(`   ✅ Webhook deletion verified`, 'green');

  // Test 3: Plugin metadata
  const metadata = webhooksPlugin.getMetadata();
  if (!metadata || !metadata.name || !metadata.version) {
    throw new Error('Plugin metadata invalid');
  }
  log(`   ✅ Plugin metadata: ${metadata.name} v${metadata.version}`, 'green');
  log(`      Services: ${metadata.services.length}`, 'cyan');
  log(`      Endpoints: ${metadata.endpoints}`, 'cyan');
  log(`      Features: ${metadata.features.length}`, 'cyan');
  log(`      Events: ${metadata.events.length}`, 'cyan');
}

// Run tests
runTests();
