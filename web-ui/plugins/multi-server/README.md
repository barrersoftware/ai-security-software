# Multi-Server Management Plugin

Centralized management and distributed scanning of multiple servers through SSH.

## Features

- 🖥️ **Server Inventory** - Manage 100+ servers from central dashboard
- 👥 **Group Management** - Organize servers into logical groups
- 🔐 **SSH Authentication** - Secure key-based authentication
- ⚡ **Parallel Scanning** - Scan multiple servers simultaneously
- 📊 **Consolidated Reports** - Aggregate results across infrastructure
- 📈 **Historical Analysis** - Track security trends over time
- 🏢 **Multi-Tenant** - Complete tenant isolation
- 🔍 **Connection Testing** - Verify SSH connectivity

## Services

### ServerManager
Handles server inventory CRUD operations.

**Methods:**
- `addServer(tenantId, serverData)` - Add new server
- `listServers(tenantId, filters)` - List servers
- `getServer(tenantId, serverId)` - Get server details
- `updateServer(tenantId, serverId, updates)` - Update server
- `deleteServer(tenantId, serverId)` - Delete server
- `getStatistics(tenantId)` - Get server statistics

### GroupManager
Manages server groups for bulk operations.

**Methods:**
- `createGroup(tenantId, groupData)` - Create group
- `listGroups(tenantId)` - List groups
- `updateGroup(tenantId, groupId, updates)` - Update group
- `deleteGroup(tenantId, groupId)` - Delete group
- `addServers(tenantId, groupId, serverIds)` - Add servers to group
- `removeServers(tenantId, groupId, serverIds)` - Remove servers from group

### ConnectionManager
Handles SSH connections and remote command execution.

**Methods:**
- `testConnection(server, timeout)` - Test SSH connection
- `executeRemoteCommand(server, command, timeout)` - Execute command
- `copyToServer(server, localPath, remotePath)` - Upload file
- `copyFromServer(server, remotePath, localPath)` - Download file
- `getServerInfo(server)` - Get server information

### ScanOrchestrator
Orchestrates distributed scans across multiple servers.

**Methods:**
- `startScan(tenantId, scanConfig, userId)` - Start multi-server scan
- `getScanStatus(tenantId, scanId)` - Get scan status
- `listScans(tenantId, filters)` - List scans
- `cancelScan(tenantId, scanId)` - Cancel running scan

**Events:**
- `progress` - Scan progress updates
- `completed` - Scan completed

### ReportAggregator
Generates consolidated reports and analytics.

**Methods:**
- `generateConsolidatedReport(tenantId, scanId)` - Generate report
- `generateServerReport(tenantId, serverId, limit)` - Server history
- `generateComparisonReport(tenantId, scanId1, scanId2)` - Compare scans
- `exportReport(report, format)` - Export to JSON/CSV/Text

## API Endpoints

### Server Management

**POST /api/multi-server/servers**
Add a new server to inventory.

```json
{
  "name": "web-prod-01",
  "host": "192.168.1.10",
  "port": 22,
  "username": "ubuntu",
  "ssh_key_path": "~/.ssh/id_rsa",
  "description": "Production web server",
  "tags": ["production", "web", "critical"]
}
```

**GET /api/multi-server/servers**
List all servers.

Query parameters:
- `status` - Filter by status (active, inactive)
- `tags` - Comma-separated tags
- `search` - Search in name, host, description
- `limit` - Results per page (default: 100)
- `offset` - Pagination offset

**GET /api/multi-server/servers/:id**
Get server details.

**PUT /api/multi-server/servers/:id**
Update server.

**DELETE /api/multi-server/servers/:id**
Delete server.

**POST /api/multi-server/servers/:id/test**
Test SSH connection to server.

### Group Management

**POST /api/multi-server/groups**
Create server group.

```json
{
  "name": "production",
  "description": "Production servers",
  "server_ids": ["server-1", "server-2", "server-3"]
}
```

**GET /api/multi-server/groups**
List all groups.

**GET /api/multi-server/groups/:id**
Get group details.

**PUT /api/multi-server/groups/:id**
Update group.

**DELETE /api/multi-server/groups/:id**
Delete group.

### Scan Operations

**POST /api/multi-server/scan**
Start multi-server scan.

```json
{
  "name": "Weekly Production Scan",
  "server_ids": ["server-1", "server-2", "server-3"],
  "parallel": 4,
  "quick": false
}
```

**GET /api/multi-server/scans**
List scans.

Query parameters:
- `status` - Filter by status (pending, running, completed, failed)
- `limit` - Results per page (default: 50)
- `offset` - Pagination offset

**GET /api/multi-server/scans/:id**
Get scan status and results.

**DELETE /api/multi-server/scans/:id**
Cancel running scan.

### Reporting

**GET /api/multi-server/reports/:scanId**
Generate consolidated report.

Query parameters:
- `format` - Report format (json, csv, text)

**GET /api/multi-server/reports/server/:serverId**
Get server scan history.

Query parameters:
- `limit` - Number of scans to include (default: 10)

**GET /api/multi-server/reports/compare/:scanId1/:scanId2**
Compare two scans.

## Database Schema

### servers
```sql
CREATE TABLE servers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  host TEXT NOT NULL,
  port INTEGER DEFAULT 22,
  username TEXT NOT NULL,
  ssh_key_path TEXT,
  description TEXT,
  tags TEXT, -- JSON array
  status TEXT DEFAULT 'active',
  last_scan DATETIME,
  last_status TEXT,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, name)
);
```

### server_groups
```sql
CREATE TABLE server_groups (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  server_ids TEXT NOT NULL, -- JSON array
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, name)
);
```

### multi_server_scans
```sql
CREATE TABLE multi_server_scans (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT,
  server_ids TEXT NOT NULL, -- JSON array
  status TEXT DEFAULT 'pending',
  started_at DATETIME,
  completed_at DATETIME,
  total_servers INTEGER,
  completed_servers INTEGER DEFAULT 0,
  failed_servers INTEGER DEFAULT 0,
  results TEXT,
  config TEXT,
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### server_scan_results
```sql
CREATE TABLE server_scan_results (
  id TEXT PRIMARY KEY,
  scan_id TEXT NOT NULL,
  server_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  status TEXT,
  started_at DATETIME,
  completed_at DATETIME,
  duration INTEGER,
  vulnerabilities TEXT, -- JSON
  report_path TEXT,
  error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Usage Examples

### Add a Server

```javascript
const response = await fetch('/api/multi-server/servers', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'web-prod-01',
    host: '192.168.1.10',
    username: 'ubuntu',
    ssh_key_path: '~/.ssh/id_rsa',
    tags: ['production', 'web']
  })
});

const { server } = await response.json();
console.log('Server added:', server.id);
```

### Test Connection

```javascript
const response = await fetch(`/api/multi-server/servers/${serverId}/test`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
});

const { connection } = await response.json();
if (connection.success) {
  console.log('Connected!', connection.info);
} else {
  console.error('Failed:', connection.error);
}
```

### Start Multi-Server Scan

```javascript
const response = await fetch('/api/multi-server/scan', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'Production Infrastructure Scan',
    server_ids: ['server-1', 'server-2', 'server-3'],
    parallel: 3,
    quick: false
  })
});

const { scan_id } = await response.json();
console.log('Scan started:', scan_id);
```

### Monitor Scan Progress

```javascript
const checkStatus = async () => {
  const response = await fetch(`/api/multi-server/scans/${scanId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const { scan } = await response.json();
  console.log(`Progress: ${scan.completed_servers}/${scan.total_servers}`);
  
  if (scan.status === 'completed') {
    console.log('Scan finished!');
    return scan;
  }
  
  // Check again in 5 seconds
  setTimeout(checkStatus, 5000);
};

checkStatus();
```

### Generate Report

```javascript
const response = await fetch(`/api/multi-server/reports/${scanId}`, {
  headers: { 'Authorization': `Bearer ${token}` }
});

const { report } = await response.json();

console.log('Total Servers:', report.statistics.total_servers);
console.log('Vulnerabilities:', report.statistics.vulnerabilities);
console.log('Summary:', report.summary);
```

## Prerequisites

- SSH client installed (`ssh`, `scp`)
- SSH key access to target servers
- Network connectivity to target servers
- Proper SSH permissions on remote servers

## Security Considerations

1. **SSH Keys** - Store SSH keys securely, use proper permissions (600)
2. **Network Access** - Use VPN for remote server access
3. **Credentials** - Never store passwords in database
4. **Tenant Isolation** - Complete isolation between tenants
5. **Audit Logging** - All operations are logged
6. **Rate Limiting** - API endpoints are rate-limited

## Troubleshooting

### SSH Connection Fails

1. Verify SSH key exists and has proper permissions:
   ```bash
   chmod 600 ~/.ssh/id_rsa
   ```

2. Test connection manually:
   ```bash
   ssh -i ~/.ssh/id_rsa user@host
   ```

3. Check server firewall and SSH service

### Scan Timeout

- Increase timeout in scan configuration
- Check network latency
- Reduce parallel scan count

### Permission Denied

- Verify SSH key is added to server's authorized_keys
- Check username is correct
- Ensure user has necessary sudo privileges

## Performance

- **Small Environment** (10 servers): ~2-5 minutes
- **Medium Environment** (50 servers): ~10-15 minutes (parallel=8)
- **Large Environment** (200+ servers): ~30-60 minutes (parallel=16)

## License

MIT License - Part of AI Security Scanner

## Version

1.0.0 - Multi-Server Management Plugin
