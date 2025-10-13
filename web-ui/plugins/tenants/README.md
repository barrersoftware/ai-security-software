# Tenants Plugin

Multi-tenancy support for AI Security Scanner with complete data isolation and resource management.

## Features

- **Complete Tenant Isolation** - Data separation between organizations
- **Resource Limits** - Configurable limits per tenant (users, scans, storage, etc.)
- **Usage Tracking** - Real-time monitoring of resource consumption
- **Flexible Tenant Detection** - Subdomain, header, or user-based tenant resolution
- **Feature Flags** - Enable/disable features per tenant
- **Billing Integration** - Track tenant plans and billing status
- **Audit Logging** - Complete audit trail of tenant operations

## Architecture

### Components

1. **TenantManager** - Core tenant CRUD operations
2. **TenantMiddleware** - Request context and tenant extraction
3. **ResourceLimiter** - Enforce resource limits
4. **UsageTracker** - Track and report resource usage

### Tenant Model

```javascript
{
  id: "tenant-abc123...",
  name: "Acme Corporation",
  slug: "acme-corp",
  status: "active|suspended|trial",
  settings: {
    allowedDomains: ["acme.com"],
    customBranding: {},
    features: {
      vpn: true,
      scanning: true,
      storage: true,
      admin: true
    }
  },
  limits: {
    users: 100,
    scans: 1000,
    storage: "100GB",
    vpnClients: 50,
    apiRequests: 10000
  },
  usage: {
    users: 25,
    scans: 450,
    storage: "45GB",
    vpnClients: 12,
    apiRequests: 3250
  },
  billing: {
    plan: "enterprise",
    status: "active",
    nextBillingDate: "2025-11-13"
  },
  createdAt: "2025-10-13T20:00:00Z",
  updatedAt: "2025-10-13T20:30:00Z"
}
```

## API Endpoints

### Tenant Management

```
POST   /api/tenants              - Create tenant (super-admin)
GET    /api/tenants              - List tenants
GET    /api/tenants/:id          - Get tenant details
PUT    /api/tenants/:id          - Update tenant
DELETE /api/tenants/:id          - Delete tenant (super-admin)
```

### Tenant Operations

```
GET    /api/tenants/:id/stats    - Get usage statistics
PUT    /api/tenants/:id/limits   - Update resource limits (super-admin)
GET    /api/tenants/:id/users    - List tenant users
POST   /api/tenants/:id/users    - Add user to tenant
```

## Usage Examples

### Creating a Tenant

```bash
curl -X POST http://localhost:3000/api/tenants \
  -H "Authorization: Bearer <super-admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corporation",
    "slug": "acme-corp",
    "settings": {
      "allowedDomains": ["acme.com"],
      "features": {
        "vpn": true,
        "scanning": true
      }
    },
    "limits": {
      "users": 100,
      "scans": 1000,
      "storage": "100GB"
    }
  }'
```

### Getting Tenant Statistics

```bash
curl http://localhost:3000/api/tenants/tenant-abc123.../stats \
  -H "Authorization: Bearer <tenant-admin-token>"
```

Response:
```json
{
  "success": true,
  "stats": {
    "tenant": {
      "id": "tenant-abc123...",
      "name": "Acme Corporation",
      "status": "active"
    },
    "usage": {
      "users": 25,
      "scans": 450,
      "storage": "45GB"
    },
    "limits": {
      "users": 100,
      "scans": 1000,
      "storage": "100GB"
    },
    "percentages": {
      "users": 25,
      "scans": 45,
      "storage": 45
    },
    "warnings": []
  }
}
```

## Middleware Usage

### Extract and Validate Tenant

```javascript
const tenantPlugin = core.pluginManager.getPlugin('tenants');
const middleware = tenantPlugin.middleware();

router.get('/api/data',
  middleware.extractTenant(),    // Extract tenant from request
  middleware.validateTenant(),   // Ensure tenant is active
  middleware.checkLimits('scans'), // Check resource limits
  async (req, res) => {
    // req.tenant and req.tenantId are now available
    // Perform tenant-specific operation
  }
);
```

### Tracking Usage

```javascript
router.post('/api/scan',
  middleware.extractTenant(),
  middleware.checkLimits('scans'),
  async (req, res) => {
    // Perform scan...
    
    // Track usage
    const usageTracker = core.getService('usage-tracker');
    await usageTracker.trackUsage(req.tenantId, 'scans', 1);
    
    res.json({ success: true });
  }
);
```

## Tenant Detection Methods

The plugin supports multiple methods for tenant detection (in order of precedence):

1. **Header-based**: `X-Tenant-ID` or `X-Tenant-Slug`
   ```bash
   curl -H "X-Tenant-Slug: acme-corp" http://api.example.com/data
   ```

2. **Subdomain-based**: `tenant.example.com`
   ```bash
   curl http://acme-corp.example.com/api/data
   ```

3. **User-based**: From authenticated user's `tenantId`
   ```javascript
   // Automatically uses user's tenant after authentication
   ```

4. **Query parameter**: `?tenant=slug`
   ```bash
   curl http://api.example.com/data?tenant=acme-corp
   ```

5. **Default tenant**: Falls back to 'default' tenant

## Resource Limits

### Supported Resources

- `users` - Number of users per tenant
- `scans` - Number of security scans
- `storage` - Storage space (supports B, KB, MB, GB, TB)
- `vpnClients` - Number of VPN connections
- `apiRequests` - API calls (useful for rate limiting)

### Limit Enforcement

```javascript
const resourceLimiter = core.getService('resource-limiter');

// Check if operation is allowed
const canAddUser = await resourceLimiter.checkLimit(tenantId, 'users');

if (!canAddUser) {
  return res.status(429).json({
    error: 'User limit reached'
  });
}

// Perform operation and track usage
await userManager.createUser({...});
await usageTracker.trackUsage(tenantId, 'users', 1);
```

### Usage Warnings

The system automatically warns when tenants approach limits:

- **Warning**: 80-94% of limit
- **Critical**: 95%+ of limit

```javascript
const warnings = await resourceLimiter.checkLimitWarnings(tenantId);
// [
//   { resource: 'storage', percentage: 92, severity: 'warning' },
//   { resource: 'users', percentage: 97, severity: 'critical' }
// ]
```

## User Roles

### Super Admin
- Create/delete tenants
- Update any tenant
- Update resource limits
- Access all tenants

### Tenant Admin
- Update their tenant settings
- Manage users within their tenant
- View tenant statistics
- Cannot modify resource limits

### User
- Access their tenant's resources
- View their own usage
- Limited to tenant-specific operations

## Data Isolation

All data is automatically isolated by tenant:

```javascript
// Use the isolateData middleware
router.get('/api/data',
  middleware.extractTenant(),
  middleware.isolateData(),  // Adds tenantId filter
  async (req, res) => {
    // req.dataFilter.tenantId is set
    // All queries automatically filtered by tenant
  }
);
```

## Feature Flags

Enable/disable features per tenant:

```javascript
// Require specific feature
router.get('/api/vpn',
  middleware.extractTenant(),
  middleware.requireFeature('vpn'),  // Check if VPN enabled
  async (req, res) => {
    // VPN operations...
  }
);
```

## Integration with Other Plugins

### User Management

Users should include `tenantId`:

```javascript
await userManager.createUser({
  username: 'john',
  email: 'john@acme.com',
  password: 'secure',
  role: 'user',
  tenantId: 'tenant-abc123...'  // Associate with tenant
});
```

### Security Scanner

Track scans per tenant:

```javascript
router.post('/api/scan',
  middleware.extractTenant(),
  middleware.checkLimits('scans'),
  async (req, res) => {
    // Perform scan
    const result = await scanner.scan(req.body);
    
    // Track usage
    await usageTracker.trackUsage(req.tenantId, 'scans', 1);
    
    res.json(result);
  }
);
```

### Storage

Track storage usage:

```javascript
router.post('/api/upload',
  middleware.extractTenant(),
  middleware.checkLimits('storage'),
  async (req, res) => {
    const fileSize = req.file.size;
    
    // Check if storage available
    const canStore = await resourceLimiter.checkLimit(
      req.tenantId,
      'storage'
    );
    
    if (!canStore) {
      return res.status(429).json({ error: 'Storage limit exceeded' });
    }
    
    // Store file...
    
    // Track storage usage (in bytes)
    await usageTracker.trackUsage(req.tenantId, 'storage', fileSize);
    
    res.json({ success: true });
  }
);
```

## Best Practices

1. **Always extract tenant context** for multi-tenant operations
2. **Check limits before operations** that consume resources
3. **Track usage after successful operations**
4. **Use feature flags** to enable/disable functionality
5. **Isolate data** using tenant filters in all queries
6. **Log tenant operations** for audit trail
7. **Set appropriate limits** based on tenant plans
8. **Monitor usage trends** to predict limit issues

## Security Considerations

- Tenant IDs are cryptographically random (32-byte hex)
- Tenant slugs are validated (alphanumeric + hyphens only)
- Default tenant cannot be deleted
- Super admin role required for critical operations
- Complete data isolation between tenants
- Audit logging for all tenant operations
- Resource limits prevent abuse

## Performance

- In-memory tenant cache for fast lookups
- Periodic disk writes for usage history
- Efficient limit checking with early returns
- Minimal overhead on request processing

## Testing

Run tenant plugin tests:

```bash
cd web-ui
npm test -- plugins/tenants
```

## Version

v1.0.0 - Initial release for v4.1.0

## License

Part of AI Security Scanner - See main LICENSE file
