# Enhanced Audit Logging Plugin

Comprehensive audit trail logging system for security, compliance, and forensics.

## Overview

The Enhanced Audit Logging Plugin provides enterprise-grade audit logging capabilities for the AI Security Scanner. It tracks all user actions, security events, and system changes, enabling compliance with GDPR, SOC2, HIPAA, and other regulatory standards.

## Features

### 🔍 Comprehensive Logging
- **All Events Tracked**: Every user action, API call, and system change
- **Automatic Middleware**: Auto-tracks all HTTP requests
- **Detailed Metadata**: Captures user, tenant, IP, timestamps, and more
- **Sensitive Data Masking**: Automatically masks passwords, tokens, and secrets

### 📊 Advanced Querying
- **Flexible Filtering**: Filter by tenant, user, category, severity, date range
- **Full-Text Search**: Search across all audit log fields
- **Pagination**: Efficient handling of large result sets
- **Custom Sorting**: Sort by any field, ascending or descending

### 📋 Compliance Reporting
- **GDPR**: General Data Protection Regulation compliance
- **SOC2**: Service Organization Control 2 compliance
- **HIPAA**: Health Insurance Portability and Accountability Act compliance
- **Automated Checks**: Automatic verification of compliance requirements
- **Trend Analysis**: Track compliance over time

### 🚨 Security Monitoring
- **Real-Time Alerts**: Automatic detection of suspicious activity
- **7 Built-in Rules**: Failed logins, privilege escalation, bulk deletes, etc.
- **Customizable Rules**: Define custom security monitoring rules
- **Alert Management**: View, resolve, and track security alerts

### 📤 Export Capabilities
- **Multiple Formats**: JSON, CSV export support
- **Bulk Export**: Export entire audit trails
- **Date Range Filtering**: Export specific time periods
- **Compliance Reports**: Export formatted compliance reports

## Services

### AuditLogger

Core logging service that records all audit events.

**Key Methods:**
- `log(event)` - Log any audit event
- `logAuth(data)` - Log authentication events
- `logAuthz(data)` - Log authorization events
- `logUserManagement(data)` - Log user management events
- `logTenantManagement(data)` - Log tenant management events
- `logConfigChange(data)` - Log configuration changes
- `logDataAccess(data)` - Log data access events
- `logSecurityScan(data)` - Log security scan events
- `logSystemChange(data)` - Log system changes

**Features:**
- Automatic sensitive data masking
- Buffered writes for performance
- Dual storage (database + file system)
- 90-day default retention
- Automatic cleanup of old logs

### AuditQuery

Advanced querying and search capabilities.

**Key Methods:**
- `queryLogs(filters, options)` - Query logs with filters
- `getEvent(id)` - Get specific event by ID
- `getSecurityEvents(filters, options)` - Get security events
- `getUserActivity(userId, filters, options)` - Get user activity trail
- `exportLogs(filters)` - Export logs
- `getStatistics(filters)` - Get audit statistics
- `advancedSearch(params, options)` - Complex search queries

**Features:**
- Flexible filtering
- Pagination support
- Statistics and aggregations
- CSV export
- User activity summaries

### ComplianceReporter

Generates compliance reports for various standards.

**Key Methods:**
- `generateReport(params)` - Generate compliance report
- `getComplianceTrends(standard, tenantId, months)` - Compliance over time
- `getSupportedStandards()` - List supported compliance standards

**Supported Standards:**
- **GDPR**: 5 requirements tracked
- **SOC2**: 5 requirements tracked
- **HIPAA**: 5 requirements tracked

**Report Includes:**
- Overall compliance percentage
- Requirement-by-requirement analysis
- Evidence of compliance
- Issues and warnings
- Recommendations

### SecurityMonitor

Real-time security monitoring and alerting.

**Key Methods:**
- `getAlerts(filters, options)` - Get security alerts
- `resolveAlert(alertId, resolvedBy, notes)` - Resolve alert
- `getAlertStats(tenantId)` - Get alert statistics

**Built-in Rules:**
1. **Failed Login Attempts**: Detects 5+ failures in 5 minutes
2. **Privilege Escalation**: Detects unauthorized escalation attempts
3. **Sensitive Data Access**: Detects unusual access patterns
4. **Config Changes**: Monitors critical configuration changes
5. **Bulk Delete**: Detects 50+ deletes in 5 minutes
6. **After-Hours Access**: Detects access during 10 PM - 6 AM
7. **Geographic Anomaly**: Detects impossible travel patterns

## API Endpoints

### Query Logs
```http
GET /api/audit/logs?category=authentication&severity=warning&page=1&limit=50
```

**Query Parameters:**
- `tenantId` - Filter by tenant (admin only)
- `category` - Filter by category
- `severity` - Filter by severity
- `userId` - Filter by user
- `startDate` - Filter from date (ISO 8601)
- `endDate` - Filter to date (ISO 8601)
- `page` - Page number (default: 1)
- `limit` - Results per page (default: 50, max: 100)
- `sort` - Sort field (prefix with `-` for descending)

**Response:**
```json
{
  "data": [
    {
      "id": "audit_1234567890_abc123",
      "timestamp": "2025-10-13T21:00:00.000Z",
      "tenantId": "tenant-123",
      "userId": "user-456",
      "category": "authentication",
      "action": "login_success",
      "severity": "info",
      "details": {
        "username": "john@example.com",
        "method": "password"
      },
      "ipAddress": "192.168.1.1",
      "success": true
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1523,
    "totalPages": 31,
    "hasMore": true
  }
}
```

### Get Event Details
```http
GET /api/audit/events/:id
```

### Get Security Events
```http
GET /api/audit/security-events?startDate=2025-10-01T00:00:00.000Z
```

### Get User Activity
```http
GET /api/audit/user-activity/:userId?startDate=2025-10-01T00:00:00.000Z
```

**Response includes activity summary:**
```json
{
  "data": [...],
  "summary": {
    "totalActions": 1234,
    "byCategory": [
      { "category": "authentication", "count": 45 },
      { "category": "data_access", "count": 892 }
    ],
    "lastActivity": {
      "timestamp": "2025-10-13T21:00:00.000Z",
      "category": "data_access",
      "action": "view_report"
    }
  },
  "pagination": {...}
}
```

### Generate Compliance Report
```http
GET /api/audit/compliance/report?standard=GDPR&format=json
```

**Query Parameters:**
- `standard` - Compliance standard (GDPR, SOC2, HIPAA)
- `tenantId` - Filter by tenant (admin only)
- `startDate` - Report start date
- `endDate` - Report end date
- `format` - Output format (json, csv, pdf)

**Response:**
```json
{
  "standard": "GDPR",
  "standardName": "General Data Protection Regulation",
  "generatedAt": "2025-10-13T21:00:00.000Z",
  "tenantId": "tenant-123",
  "overallCompliance": "95.00",
  "requirements": [
    {
      "id": "gdpr_access_logs",
      "name": "Access Logging",
      "description": "All data access must be logged",
      "status": "compliant",
      "evidence": {
        "data_access": {
          "eventCount": 4532,
          "hasLogs": true
        }
      },
      "issues": []
    }
  ],
  "summary": {
    "totalRequirements": 5,
    "compliant": 4,
    "nonCompliant": 0,
    "warnings": 1,
    "compliancePercentage": "95.00"
  }
}
```

### Export Logs
```http
GET /api/audit/export?startDate=2025-10-01T00:00:00.000Z&format=csv
```

Downloads audit logs in the specified format.

### Get Statistics
```http
GET /api/audit/statistics?tenantId=tenant-123
```

**Response:**
```json
{
  "total": 15234,
  "byCategory": [
    { "category": "authentication", "count": 1234 },
    { "category": "data_access", "count": 8432 }
  ],
  "bySeverity": [
    { "severity": "info", "count": 12000 },
    { "severity": "warning", "count": 234 }
  ],
  "successRate": "98.50",
  "successful": 15005,
  "failed": 229,
  "topUsers": [
    { "user_id": "user-123", "count": 234 }
  ],
  "timeline": [
    { "date": "2025-10-13", "count": 456 }
  ]
}
```

### Get Security Alerts
```http
GET /api/audit/alerts?severity=critical&status=active
```

**Response:**
```json
{
  "data": [
    {
      "id": "alert_1234567890_abc",
      "timestamp": "2025-10-13T21:00:00.000Z",
      "tenantId": "tenant-123",
      "ruleId": "failed_login_attempts",
      "ruleName": "Multiple Failed Login Attempts",
      "severity": "critical",
      "status": "active",
      "description": "5 failed login attempts detected",
      "details": {
        "userId": "user-456",
        "ipAddress": "192.168.1.1",
        "attempts": 5
      },
      "eventCount": 1,
      "firstSeen": "2025-10-13T21:00:00.000Z",
      "lastSeen": "2025-10-13T21:00:00.000Z"
    }
  ],
  "pagination": {...}
}
```

### Advanced Search
```http
POST /api/audit/search
Content-Type: application/json

{
  "query": "password reset",
  "page": 1,
  "limit": 50
}
```

## Event Categories

- **authentication** - Login/logout, password changes
- **authorization** - Permission checks, access grants/denials
- **user_management** - User creation, updates, deletion
- **tenant_management** - Tenant operations
- **configuration** - System configuration changes
- **data_access** - Data viewing, queries, exports
- **security_scan** - Security scans and results
- **api_access** - API requests and responses
- **system_changes** - System updates, service restarts
- **compliance** - Compliance-related events

## Severity Levels

- **info** - Normal operations
- **warning** - Potential issues
- **error** - Errors and failures
- **critical** - Critical system events
- **security** - Security-relevant events

## Integration

### Automatic Logging via Middleware

The plugin automatically logs all HTTP requests via middleware:

```javascript
// Applied automatically to all routes
app.use(auditLogPlugin.middleware());
```

**Features:**
- Skips static files and health checks
- Captures request and response details
- Determines severity from HTTP status
- Categorizes by URL pattern
- Non-blocking (doesn't fail requests)

### Manual Logging

```javascript
const auditLogger = services.get('AuditLogger');

// Log authentication
await auditLogger.logAuth({
  action: 'login_success',
  tenantId: 'tenant-123',
  userId: 'user-456',
  username: 'john@example.com',
  success: true,
  ipAddress: req.ip,
  userAgent: req.get('user-agent')
});

// Log data access
await auditLogger.logDataAccess({
  action: 'view_report',
  tenantId: 'tenant-123',
  userId: 'user-456',
  dataType: 'scan_report',
  dataId: 'report-789',
  operation: 'read'
});

// Log configuration change
await auditLogger.logConfigChange({
  action: 'update_config',
  tenantId: 'tenant-123',
  userId: 'user-456',
  configKey: 'max_scan_depth',
  oldValue: 5,
  newValue: 10
});
```

## Data Storage

### Database
- Table: `audit_logs`
- Indexes on: tenant_id, user_id, category, timestamp, severity
- Buffered writes (100 events or 30 seconds)
- Automatic cleanup (90-day retention)

### File System
- Directory: `data/audit-logs/`
- Format: JSONL (one event per line)
- File naming: `audit-YYYY-MM-DD.jsonl`
- Daily rotation
- Same 90-day retention

## Performance

- **Overhead**: <1ms per request (buffered writes)
- **Memory**: ~100 KB per 100 buffered events
- **Disk**: ~1 KB per event
- **Database**: Indexed for fast queries
- **Non-blocking**: Never fails requests

## Security

### Sensitive Data Masking

Automatically masks these field names:
- password
- token
- apiKey
- secret
- privateKey
- accessToken
- refreshToken
- sessionId
- cookie

Example:
```json
{
  "username": "john@example.com",
  "password": "***MASKED***",
  "token": "***MASKED***"
}
```

### Access Control

- **Admin**: Full access to all tenants
- **Auditor**: Read-only access to logs
- **Security**: Access to security events and alerts
- **Compliance**: Access to compliance reports
- **User**: Access to own tenant's logs only

## Compliance Features

### GDPR Compliance
✅ **Article 30**: Records of processing activities  
✅ **Article 32**: Security of processing  
✅ **Article 33**: Breach notification (via alerts)  
✅ **Article 15**: Right of access (export functionality)  

### SOC2 Compliance
✅ **CC6.1**: Logical access controls  
✅ **CC6.2**: Authentication  
✅ **CC6.3**: Authorization  
✅ **CC7.2**: System monitoring  

### HIPAA Compliance
✅ **§164.308(a)(1)**: Security management process  
✅ **§164.308(a)(5)**: Security awareness and training  
✅ **§164.312(b)**: Audit controls  
✅ **§164.312(d)**: Person or entity authentication  

## Monitoring Rules

### Customization

Rules can be customized by modifying the `SecurityMonitor` service:

```javascript
const rules = [
  {
    id: 'custom_rule',
    name: 'Custom Security Rule',
    description: 'Detects custom pattern',
    category: 'data_access',
    threshold: 100,
    timeWindow: 3600,
    severity: 'warning',
    action: 'create_alert'
  }
];
```

### Alert Actions

- `create_alert` - Create security alert in database
- `log_only` - Log event but don't create alert
- `notify` - Send notification (future feature)

## Testing

See `test-audit-log.js` for comprehensive integration tests.

```bash
node web-ui/test-audit-log.js
```

## Configuration

Plugin configuration in `plugin.json`:

```json
{
  "config": {
    "retention": {
      "days": 90
    },
    "storage": {
      "type": "database"
    },
    "realTimeAlerts": {
      "enabled": true
    },
    "sensitiveDataMasking": {
      "enabled": true
    },
    "compliance": {
      "standards": ["GDPR", "SOC2", "HIPAA"]
    }
  }
}
```

## Future Enhancements

- [ ] PDF report generation
- [ ] Email notifications for alerts
- [ ] Webhook integration
- [ ] Custom rule builder UI
- [ ] Machine learning anomaly detection
- [ ] Integration with SIEM systems
- [ ] Encrypted audit logs
- [ ] Multi-region replication

## Support

For issues or questions, contact the AI Security Scanner Team.

## License

MIT License - See LICENSE file for details.
