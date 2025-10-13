/**
 * Test Tenants Plugin
 */

const TenantManager = require('./plugins/tenants/tenant-manager');
const TenantMiddleware = require('./plugins/tenants/tenant-middleware');
const ResourceLimiter = require('./plugins/tenants/resource-limiter');
const UsageTracker = require('./plugins/tenants/usage-tracker');

console.log('Testing Tenants Plugin Components...\n');

// Mock core object
const mockCore = {
  getService: (name) => {
    console.log(`Service requested: ${name}`);
    return null;
  },
  registerService: (name, service) => {
    console.log(`Service registered: ${name}`);
  }
};

// Test TenantManager
console.log('✓ TenantManager loaded');
const tenantManager = new TenantManager(mockCore);
console.log('✓ TenantManager instantiated');

// Test TenantMiddleware
console.log('✓ TenantMiddleware loaded');
const tenantMiddleware = new TenantMiddleware(mockCore);
console.log('✓ TenantMiddleware instantiated');

// Test ResourceLimiter
console.log('✓ ResourceLimiter loaded');
const resourceLimiter = new ResourceLimiter(mockCore);
console.log('✓ ResourceLimiter instantiated');

// Test storage parsing
const testStorage = resourceLimiter.parseStorage('100GB');
console.log(`✓ Storage parsing: 100GB = ${testStorage} bytes`);
const formatted = resourceLimiter.formatStorage(testStorage);
console.log(`✓ Storage formatting: ${testStorage} bytes = ${formatted}`);

// Test UsageTracker
console.log('✓ UsageTracker loaded');
const usageTracker = new UsageTracker(mockCore);
console.log('✓ UsageTracker instantiated');

console.log('\n✅ All components loaded successfully!');
console.log('Plugin is ready for integration testing.');
