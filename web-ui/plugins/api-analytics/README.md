# API Analytics Plugin

Real-time API request tracking, usage analytics, and quota enforcement for multi-tenant environments.

## Features

- ✅ **Real-time Request Tracking** - Track all API requests with detailed metadata
- ✅ **Quota Enforcement** - Enforce per-tenant API request limits
- ✅ **Usage Analytics** - Comprehensive analytics and insights
- ✅ **Performance Monitoring** - Track response times and identify slow endpoints
- ✅ **User Analytics** - Track usage by user within tenants
- ✅ **Trend Analysis** - Usage trends over time
- ✅ **System-wide Statistics** - Admin view of all tenant activity

## Services

### ApiTracker
Records all API requests with metadata including:
- Tenant ID and User ID
- HTTP method and path
- Response status code and duration
- Timestamp, IP address, user agent
- Success/error classification

### ApiAnalytics
Provides analytics and insights:
- Usage summaries per tenant
- Endpoint statistics
- User activity analysis
- Usage trends over time
- Top users and endpoints

### ApiQuotaEnforcer
Enforces API request quotas:
- Pre-request quota checking
- Blocks requests when quota exceeded
- Quota status and warnings
- Reset information

## API Endpoints

### GET /api/analytics/usage
Get current tenant's API usage summary.

**Auth:** Required  
**Response:**
```json
{
  "success": true,
  "data": {
    "tenantId": "tenant-xxx",
    "tenantName": "Acme Corp",
    "usage": {
      "current": 450,
      "limit": 1000,
      "percentage": 45.0
    },
    "statistics": {
      "total": 450,
      "success": 445,
      "error": 5,
      "avgDuration": 125
    },
    "topEndpoints": [...],
    "topUsers": [...],
    "warnings": []
  }
}
```

### GET /api/analytics/endpoints
Get API usage by endpoint.

**Auth:** Required  
**Query Params:**
- `timeRange` - Time range (default: "24h")

**Response:**
```json
{
  "success": true,
  "data": {
    "timeRange": "24h",
    "totalEndpoints": 15,
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/scanner/status",
        "requests": 120,
        "successRate": "98.33%",
        "errorRate": "1.67%",
        "avgResponseTime": "45ms"
      }
    ]
  }
}
```

### GET /api/analytics/trends
Get usage trends over time.

**Auth:** Required  
**Query Params:**
- `timeRange` - Time range (default: "7d")
- `interval` - Data point interval (default: "1h")

**Response:**
```json
{
  "success": true,
  "data": {
    "tenantId": "tenant-xxx",
    "timeRange": "7d",
    "interval": "1h",
    "dataPoints": [
      {
        "timestamp": "2025-10-13T00:00:00.000Z",
        "count": 45,
        "success": 43,
        "error": 2,
        "avgDuration": 120
      }
    ]
  }
}
```

### GET /api/analytics/top-users
Get top users by API usage.

**Auth:** Required (Admin)  
**Query Params:**
- `limit` - Number of users (default: 10)
- `timeRange` - Time range (default: "24h")

**Response:**
```json
{
  "success": true,
  "data": {
    "tenantId": "tenant-xxx",
    "timeRange": "24h",
    "topUsers": [
      {
        "userId": "1",
        "username": "john.doe",
        "email": "john@acme.com",
        "requests": 85,
        "successRate": "97.65%",
        "errorRate": "2.35%"
      }
    ]
  }
}
```

### GET /api/analytics/quota
Get API quota status.

**Auth:** Required  
**Response:**
```json
{
  "success": true,
  "data": {
    "tenantId": "tenant-xxx",
    "tenantName": "Acme Corp",
    "hasQuota": true,
    "quota": {
      "current": 450,
      "limit": 1000,
      "remaining": 550,
      "percentage": "45.00%"
    },
    "status": "healthy",
    "message": "550 requests remaining",
    "canMakeRequests": true,
    "resetInfo": {
      "resetDate": "2025-11-01T00:00:00.000Z",
      "daysUntilReset": 18,
      "resetType": "monthly"
    }
  }
}
```

### GET /api/analytics/all-tenants
Get all tenants' API usage (admin only).

**Auth:** Required (Admin)  
**Query Params:**
- `timeRange` - Time range (default: "24h")

**Response:**
```json
{
  "success": true,
  "data": {
    "timeRange": "24h",
    "totalTenants": 5,
    "tenants": [
      {
        "tenantId": "tenant-xxx",
        "tenantName": "Acme Corp",
        "requests": 450,
        "successRate": "98.89%",
        "errorRate": "1.11%",
        "avgDuration": "125ms",
        "quota": {
          "current": 450,
          "limit": 1000,
          "percentage": 45.0
        }
      }
    ]
  }
}
```

### GET /api/analytics/system
Get system-wide statistics (admin only).

**Auth:** Required (Admin)  
**Query Params:**
- `timeRange` - Time range (default: "24h")

**Response:**
```json
{
  "success": true,
  "data": {
    "timeRange": "24h",
    "overview": {
      "totalRequests": 2450,
      "successfulRequests": 2420,
      "failedRequests": 30,
      "successRate": "98.78%",
      "avgResponseTime": "135ms",
      "minResponseTime": "12ms",
      "maxResponseTime": "1250ms"
    },
    "activity": {
      "activeTenants": 5,
      "activeUsers": 18
    },
    "performance": {
      "slowestEndpoints": [...]
    }
  }
}
```

## Middleware

### trackApiRequest
Automatically tracks all API requests (except static files and health checks).

**Features:**
- Pre-request quota checking
- Blocks requests when quota exceeded
- Records request metadata
- Updates tenant usage statistics
- Returns 429 status when quota exceeded

**Usage:**
```javascript
// Middleware is automatically applied to all routes
// Skips: /static/*, /health, /api/health
```

## Integration with Multi-Tenancy

### Automatic Usage Tracking
When a request is made with tenant context:
1. Checks quota before processing
2. Tracks request in ApiTracker
3. Updates tenant's `apiRequests` counter
4. Records in usage history

### Quota Enforcement
Quotas are enforced via the `apiRequests` limit in tenant settings:

```javascript
const tenant = await tenantManager.createTenant({
  name: 'Acme Corp',
  limits: {
    users: 10,
    scans: 100,
    storage: '1GB',
    vpnClients: 5,
    apiRequests: 1000  // <- API quota
  }
});
```

### Warning System
Warnings are generated at:
- **80%** - Warning threshold
- **95%** - Critical threshold  
- **100%** - Requests blocked

## Configuration

No configuration required. The plugin:
- Auto-detects tenant context from requests
- Uses multi-tenancy services for quota enforcement
- Stores data in `data/api-analytics/`
- Flushes to disk every 5 minutes

## Data Storage

### In-Memory
- Last 1000 requests per tenant
- Real-time counters and statistics
- 1-minute quota cache

### On-Disk
- Daily request logs: `data/api-analytics/requests-YYYY-MM-DD.json`
- Automatic daily rotation
- 7-day retention (configurable)

## Performance

- **Overhead:** <2ms per request
- **Memory:** ~1MB per 1000 requests
- **Disk I/O:** Batched every 5 minutes
- **Quota Cache:** 1-minute TTL

## Examples

### Check Your Quota
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/analytics/quota
```

### View Usage
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/analytics/usage
```

### Get Trends
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/analytics/trends?timeRange=7d&interval=1h"
```

### Admin: View All Tenants
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/analytics/all-tenants
```

## Testing

Run the integration test:
```bash
node test-api-analytics-integration.js
```

Tests cover:
- Request tracking
- Quota enforcement
- Analytics generation
- Trend analysis
- Multi-tenant isolation

## Dependencies

Required plugins:
- `auth` - For authentication
- `tenants` - For multi-tenancy support

Required services:
- `usage-tracker` - For quota tracking
- `resource-limiter` - For limit enforcement
- `tenant-manager` - For tenant info

## Version

**1.0.0** - Initial release

## License

Part of AI Security Scanner v4.1.0
