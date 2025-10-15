/**
 * Plugin Views for AI Security Scanner Dashboard
 * Detailed interfaces for each of the 18 plugins
 */

// Plugin view registry
const pluginViews = {
    'scanner': renderScannerView,
    'policies': renderPoliciesView,
    'vpn': renderVPNView,
    'rate-limiting': renderRateLimitingView,
    'security': renderSecurityView,
    'auth': renderAuthView,
    'admin': renderAdminView,
    'tenants': renderTenantsView,
    'audit-log': renderAuditLogView,
    'api-analytics': renderAPIAnalyticsView,
    'system-info': renderSystemInfoView,
    'multi-server': renderMultiServerView,
    'reporting': renderReportingView,
    'storage': renderStorageView,
    'backup-recovery': renderBackupRecoveryView,
    'webhooks': renderWebhooksView,
    'notifications': renderNotificationsView,
    'update': renderUpdateView
};

// Override the loadPluginView function
async function loadPluginView(plugin) {
    const renderer = pluginViews[plugin];
    
    if (renderer) {
        return await renderer();
    }
    
    // Fallback for plugins without detailed views
    return {
        title: plugin.charAt(0).toUpperCase() + plugin.slice(1).replace(/-/g, ' '),
        html: `<div class="card"><p>Plugin interface coming soon...</p></div>`,
        init: () => {}
    };
}

// ===== SCANNER PLUGIN =====
async function renderScannerView() {
    return {
        title: 'Security Scanner',
        html: `
            <div class="grid-2">
                <div class="card">
                    <div class="card-header">🔍 New Scan</div>
                    <form id="scanForm">
                        <div class="form-group">
                            <label>Scan Name</label>
                            <input type="text" id="scanName" placeholder="e.g., Weekly Security Audit" required>
                        </div>
                        <div class="form-group">
                            <label>Target</label>
                            <input type="text" id="scanTarget" placeholder="IP or hostname" required>
                        </div>
                        <div class="form-group">
                            <label>Scan Type</label>
                            <select id="scanType">
                                <option value="quick">Quick Scan</option>
                                <option value="full">Full Scan</option>
                                <option value="deep">Deep Scan</option>
                                <option value="compliance">Compliance Scan</option>
                            </select>
                        </div>
                        <button type="submit" class="btn btn-primary">🚀 Start Scan</button>
                    </form>
                </div>
                
                <div class="card">
                    <div class="card-header">📊 Recent Scans</div>
                    <div id="recentScansList">
                        <div class="scan-item">
                            <div class="scan-info">
                                <strong>System Security Audit</strong>
                                <span class="scan-meta">192.168.1.1 • 2 hours ago</span>
                            </div>
                            <span class="badge badge-success">Completed</span>
                        </div>
                        <div class="scan-item">
                            <div class="scan-info">
                                <strong>Network Vulnerability Scan</strong>
                                <span class="scan-meta">10.0.0.0/24 • 5 hours ago</span>
                            </div>
                            <span class="badge badge-warning">In Progress</span>
                        </div>
                        <div class="scan-item">
                            <div class="scan-info">
                                <strong>Compliance Check</strong>
                                <span class="scan-meta">web-server-01 • 1 day ago</span>
                            </div>
                            <span class="badge badge-success">Completed</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="card mt-3">
                <div class="card-header">🎯 Active Scans</div>
                <div id="activeScans">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Scan Name</th>
                                <th>Target</th>
                                <th>Progress</th>
                                <th>Findings</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>Network Vulnerability Scan</td>
                                <td>10.0.0.0/24</td>
                                <td><div class="progress-bar"><div class="progress-fill" style="width: 65%">65%</div></div></td>
                                <td><span class="badge badge-warning">3 issues</span></td>
                                <td><button class="btn-sm btn-outline">View</button></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `,
        init: initScannerView
    };
}

function initScannerView() {
    document.getElementById('scanForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('scanName').value;
        const target = document.getElementById('scanTarget').value;
        const type = document.getElementById('scanType').value;
        
        showToast('info', `Starting ${type} scan on ${target}...`);
        
        try {
            const result = await api.startScan({ name, target, type });
            showToast('success', 'Scan started successfully!');
            e.target.reset();
        } catch (error) {
            showToast('error', 'Failed to start scan');
        }
    });
}

// ===== ADMIN PLUGIN (Users) =====
async function renderAdminView() {
    return {
        title: 'User Management',
        html: `
            <div class="card">
                <div class="card-header">
                    👥 Users
                    <button class="btn btn-primary btn-sm" onclick="showAddUserModal()">+ Add User</button>
                </div>
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Username</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Last Login</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="usersTable">
                            <tr>
                                <td><strong>admin</strong></td>
                                <td>admin@localhost</td>
                                <td><span class="badge badge-danger">Admin</span></td>
                                <td><span class="badge badge-success">Active</span></td>
                                <td>2 hours ago</td>
                                <td>
                                    <button class="btn-sm btn-outline">Edit</button>
                                    <button class="btn-sm btn-outline">Delete</button>
                                </td>
                            </tr>
                            <tr>
                                <td><strong>security_auditor</strong></td>
                                <td>auditor@company.com</td>
                                <td><span class="badge badge-info">Auditor</span></td>
                                <td><span class="badge badge-success">Active</span></td>
                                <td>1 day ago</td>
                                <td>
                                    <button class="btn-sm btn-outline">Edit</button>
                                    <button class="btn-sm btn-outline">Delete</button>
                                </td>
                            </tr>
                            <tr>
                                <td><strong>developer</strong></td>
                                <td>dev@company.com</td>
                                <td><span class="badge badge-secondary">User</span></td>
                                <td><span class="badge badge-success">Active</span></td>
                                <td>3 days ago</td>
                                <td>
                                    <button class="btn-sm btn-outline">Edit</button>
                                    <button class="btn-sm btn-outline">Delete</button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div class="grid-4 mt-3">
                <div class="stat-card">
                    <div class="stat-icon" style="color: var(--primary-color)">👥</div>
                    <div class="stat-value">12</div>
                    <div class="stat-label">Total Users</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon" style="color: var(--success-color)">✓</div>
                    <div class="stat-value">10</div>
                    <div class="stat-label">Active Users</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon" style="color: var(--danger-color)">👑</div>
                    <div class="stat-value">2</div>
                    <div class="stat-label">Administrators</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon" style="color: var(--info-color)">📅</div>
                    <div class="stat-value">3</div>
                    <div class="stat-label">New This Week</div>
                </div>
            </div>
        `,
        init: () => {}
    };
}

// ===== AUDIT LOG PLUGIN =====
async function renderAuditLogView() {
    return {
        title: 'Audit Logs',
        html: `
            <div class="card">
                <div class="card-header">
                    📝 Audit Trail
                    <div style="display: flex; gap: 10px;">
                        <select id="logCategory" class="form-control-sm">
                            <option value="">All Categories</option>
                            <option value="authentication">Authentication</option>
                            <option value="user_management">User Management</option>
                            <option value="security_scan">Security Scans</option>
                            <option value="configuration">Configuration</option>
                        </select>
                        <button class="btn btn-outline btn-sm">Export</button>
                    </div>
                </div>
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Timestamp</th>
                                <th>User</th>
                                <th>Action</th>
                                <th>Category</th>
                                <th>Status</th>
                                <th>Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>2025-10-14 05:30:15</td>
                                <td>admin</td>
                                <td>User Login</td>
                                <td><span class="badge badge-info">Authentication</span></td>
                                <td><span class="badge badge-success">Success</span></td>
                                <td>IP: 192.168.1.100</td>
                            </tr>
                            <tr>
                                <td>2025-10-14 05:25:42</td>
                                <td>security_auditor</td>
                                <td>Scan Started</td>
                                <td><span class="badge badge-warning">Security</span></td>
                                <td><span class="badge badge-success">Success</span></td>
                                <td>Target: web-server-01</td>
                            </tr>
                            <tr>
                                <td>2025-10-14 05:20:10</td>
                                <td>admin</td>
                                <td>User Created</td>
                                <td><span class="badge badge-primary">User Mgmt</span></td>
                                <td><span class="badge badge-success">Success</span></td>
                                <td>Username: developer</td>
                            </tr>
                            <tr>
                                <td>2025-10-14 05:15:33</td>
                                <td>unknown</td>
                                <td>Failed Login</td>
                                <td><span class="badge badge-info">Authentication</span></td>
                                <td><span class="badge badge-danger">Failed</span></td>
                                <td>IP: 203.0.113.42</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div class="grid-3 mt-3">
                <div class="card">
                    <div class="card-header">📊 Activity by Category</div>
                    <div id="activityChart" style="height: 200px; display: flex; align-items: center; justify-content: center; color: #999;">
                        Chart placeholder
                    </div>
                </div>
                <div class="card">
                    <div class="card-header">🔐 Security Events</div>
                    <div class="stat-list">
                        <div class="stat-item"><span>Failed Logins:</span> <strong>5</strong></div>
                        <div class="stat-item"><span>Blocked IPs:</span> <strong>2</strong></div>
                        <div class="stat-item"><span>MFA Challenges:</span> <strong>8</strong></div>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header">📋 Compliance</div>
                    <button class="btn btn-primary btn-block mb-2">Generate GDPR Report</button>
                    <button class="btn btn-outline btn-block mb-2">Generate SOC2 Report</button>
                    <button class="btn btn-outline btn-block">Generate HIPAA Report</button>
                </div>
            </div>
        `,
        init: () => {}
    };
}

// ===== REPORTING PLUGIN =====
async function renderReportingView() {
    return {
        title: 'Reports',
        html: `
            <div class="grid-2">
                <div class="card">
                    <div class="card-header">📄 Generate New Report</div>
                    <form id="reportForm">
                        <div class="form-group">
                            <label>Report Name</label>
                            <input type="text" id="reportName" placeholder="e.g., Monthly Security Report" required>
                        </div>
                        <div class="form-group">
                            <label>Report Type</label>
                            <select id="reportType">
                                <option value="security">Security Scan Report</option>
                                <option value="compliance">Compliance Report</option>
                                <option value="audit">Audit Report</option>
                                <option value="vulnerability">Vulnerability Report</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Format</label>
                            <div class="btn-group">
                                <button type="button" class="btn btn-outline active" data-format="pdf">PDF</button>
                                <button type="button" class="btn btn-outline" data-format="html">HTML</button>
                                <button type="button" class="btn btn-outline" data-format="csv">CSV</button>
                                <button type="button" class="btn btn-outline" data-format="json">JSON</button>
                            </div>
                        </div>
                        <button type="submit" class="btn btn-primary btn-block">📊 Generate Report</button>
                    </form>
                </div>
                
                <div class="card">
                    <div class="card-header">📑 Recent Reports</div>
                    <div class="report-list">
                        <div class="report-item">
                            <div class="report-icon">📄</div>
                            <div class="report-info">
                                <strong>Weekly Security Audit</strong>
                                <span class="report-meta">PDF • 2.4 MB • 2 hours ago</span>
                            </div>
                            <button class="btn-sm btn-primary">Download</button>
                        </div>
                        <div class="report-item">
                            <div class="report-icon">📄</div>
                            <div class="report-info">
                                <strong>Compliance Report - GDPR</strong>
                                <span class="report-meta">PDF • 1.8 MB • 1 day ago</span>
                            </div>
                            <button class="btn-sm btn-primary">Download</button>
                        </div>
                        <div class="report-item">
                            <div class="report-icon">📊</div>
                            <div class="report-info">
                                <strong>Vulnerability Assessment</strong>
                                <span class="report-meta">HTML • 850 KB • 3 days ago</span>
                            </div>
                            <button class="btn-sm btn-primary">Download</button>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="card mt-3">
                <div class="card-header">📈 Report Statistics</div>
                <div class="grid-4">
                    <div class="stat-item-vertical">
                        <div class="stat-number">28</div>
                        <div class="stat-label">Total Reports</div>
                    </div>
                    <div class="stat-item-vertical">
                        <div class="stat-number">12</div>
                        <div class="stat-label">This Month</div>
                    </div>
                    <div class="stat-item-vertical">
                        <div class="stat-number">5.2 GB</div>
                        <div class="stat-label">Total Size</div>
                    </div>
                    <div class="stat-item-vertical">
                        <div class="stat-number">PDF</div>
                        <div class="stat-label">Most Popular</div>
                    </div>
                </div>
            </div>
        `,
        init: () => {}
    };
}

// ===== VPN PLUGIN =====
async function renderVPNView() {
    return {
        title: 'VPN Management',
        html: `
            <div class="grid-2">
                <div class="card">
                    <div class="card-header">🔒 VPN Status</div>
                    <div class="vpn-status">
                        <div class="status-indicator-large status-disconnected">
                            <div class="status-icon">🔌</div>
                            <div class="status-text">Disconnected</div>
                        </div>
                        <button class="btn btn-success btn-lg btn-block mt-3">Connect to VPN</button>
                        <div class="vpn-details mt-3">
                            <div class="detail-row"><span>Protocol:</span> <strong>OpenVPN</strong></div>
                            <div class="detail-row"><span>Server:</span> <strong>vpn.example.com</strong></div>
                            <div class="detail-row"><span>Port:</span> <strong>1194</strong></div>
                        </div>
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-header">⚙️ VPN Configuration</div>
                    <form>
                        <div class="form-group">
                            <label>VPN Provider</label>
                            <select>
                                <option>OpenVPN</option>
                                <option>WireGuard</option>
                                <option>IPSec</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Server Address</label>
                            <input type="text" value="vpn.example.com">
                        </div>
                        <div class="form-group">
                            <label>Port</label>
                            <input type="number" value="1194">
                        </div>
                        <div class="form-group">
                            <label>
                                <input type="checkbox" checked> Auto-connect on startup
                            </label>
                        </div>
                        <button type="submit" class="btn btn-primary">Save Configuration</button>
                    </form>
                </div>
            </div>
            
            <div class="card mt-3">
                <div class="card-header">📊 Connection History</div>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Date/Time</th>
                            <th>Duration</th>
                            <th>Data Transferred</th>
                            <th>Server</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>2025-10-14 03:15:00</td>
                            <td>2h 45m</td>
                            <td>1.2 GB</td>
                            <td>vpn.example.com</td>
                            <td><span class="badge badge-success">Completed</span></td>
                        </tr>
                        <tr>
                            <td>2025-10-13 22:30:00</td>
                            <td>4h 15m</td>
                            <td>850 MB</td>
                            <td>vpn.example.com</td>
                            <td><span class="badge badge-success">Completed</span></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `,
        init: () => {}
    };
}

// Add more view renderers for other plugins...
// For now, let's add a few more key ones

// ===== SYSTEM INFO PLUGIN =====
async function renderSystemInfoView() {
    return {
        title: 'System Information',
        html: `
            <div class="grid-3">
                <div class="card">
                    <div class="card-header">💻 System</div>
                    <div class="info-list">
                        <div class="info-item"><span>Hostname:</span> <strong>security-scanner</strong></div>
                        <div class="info-item"><span>OS:</span> <strong>Ubuntu 22.04 LTS</strong></div>
                        <div class="info-item"><span>Kernel:</span> <strong>5.15.0-88-generic</strong></div>
                        <div class="info-item"><span>Uptime:</span> <strong>5 days, 3 hours</strong></div>
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-header">📊 Resources</div>
                    <div class="resource-item">
                        <span>CPU Usage</span>
                        <div class="progress-bar"><div class="progress-fill" style="width: 45%; background: #007bff;">45%</div></div>
                    </div>
                    <div class="resource-item">
                        <span>Memory</span>
                        <div class="progress-bar"><div class="progress-fill" style="width: 62%; background: #28a745;">62%</div></div>
                    </div>
                    <div class="resource-item">
                        <span>Disk</span>
                        <div class="progress-bar"><div class="progress-fill" style="width: 38%; background: #17a2b8;">38%</div></div>
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-header">🌐 Network</div>
                    <div class="info-list">
                        <div class="info-item"><span>IP Address:</span> <strong>54.37.254.74</strong></div>
                        <div class="info-item"><span>Gateway:</span> <strong>54.37.254.1</strong></div>
                        <div class="info-item"><span>DNS:</span> <strong>8.8.8.8</strong></div>
                        <div class="info-item"><span>Bandwidth:</span> <strong>100 Mbps</strong></div>
                    </div>
                </div>
            </div>
        `,
        init: () => {}
    };
}

// Stub renderers for remaining plugins
// ===== POLICIES PLUGIN =====
async function renderPoliciesView() {
    const policies = await apiClient.get('/api/policies') || [];
    
    return {
        title: 'Scanning Policies',
        html: `
            <div class="grid-2">
                <div class="card">
                    <div class="card-header">📋 Active Policies</div>
                    <div id="policiesList">
                        ${policies.length > 0 ? policies.map(p => `
                            <div class="policy-item">
                                <div class="policy-info">
                                    <strong>${p.name}</strong>
                                    <span class="policy-meta">${p.description || 'No description'}</span>
                                </div>
                                <span class="badge badge-${p.enabled ? 'success' : 'secondary'}">${p.enabled ? 'Enabled' : 'Disabled'}</span>
                            </div>
                        `).join('') : '<p class="text-muted">No policies configured</p>'}
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-header">➕ Create Policy</div>
                    <form id="policyForm">
                        <div class="form-group">
                            <label>Policy Name</label>
                            <input type="text" id="policyName" placeholder="e.g., PCI-DSS Compliance" required>
                        </div>
                        <div class="form-group">
                            <label>Description</label>
                            <textarea id="policyDescription" rows="3" placeholder="Policy description"></textarea>
                        </div>
                        <div class="form-group">
                            <label>Scan Rules</label>
                            <select id="policyRules" multiple>
                                <option value="port-scan">Port Scanning</option>
                                <option value="vuln-check">Vulnerability Check</option>
                                <option value="ssl-audit">SSL/TLS Audit</option>
                                <option value="compliance">Compliance Checks</option>
                            </select>
                        </div>
                        <button type="submit" class="btn btn-primary">Create Policy</button>
                    </form>
                </div>
            </div>
        `,
        init: () => {
            const form = document.getElementById('policyForm');
            if (form) {
                form.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const data = {
                        name: document.getElementById('policyName').value,
                        description: document.getElementById('policyDescription').value,
                        rules: Array.from(document.getElementById('policyRules').selectedOptions).map(o => o.value)
                    };
                    await apiClient.post('/api/plugins/policies/create', data);
                    showToast('success', 'Policy created successfully');
                    setTimeout(() => loadPluginView('policies'), 1000);
                });
            }
        }
    };
}

// ===== RATE LIMITING PLUGIN =====
async function renderRateLimitingView() {
    const stats = await apiClient.get('/api/rate-limiting/limits') || { blocked: 0, allowed: 0, rules: [] };
    
    return {
        title: 'Rate Limiting',
        html: `
            <div class="grid-3">
                <div class="stat-card">
                    <div class="stat-icon">✅</div>
                    <div class="stat-value">${stats.allowed || 0}</div>
                    <div class="stat-label">Allowed Requests</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">🚫</div>
                    <div class="stat-value">${stats.blocked || 0}</div>
                    <div class="stat-label">Blocked Requests</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">⚙️</div>
                    <div class="stat-value">${stats.rules?.length || 0}</div>
                    <div class="stat-label">Active Rules</div>
                </div>
            </div>
            
            <div class="grid-2">
                <div class="card">
                    <div class="card-header">🔧 Rate Limit Rules</div>
                    <div id="rateLimitRules">
                        ${stats.rules?.length > 0 ? stats.rules.map(r => `
                            <div class="rule-item">
                                <strong>${r.endpoint || r.pattern}</strong>
                                <span class="text-muted">${r.limit} req/${r.window}</span>
                            </div>
                        `).join('') : '<p class="text-muted">No rules configured</p>'}
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-header">➕ Add Rule</div>
                    <form id="rateLimitForm">
                        <div class="form-group">
                            <label>Endpoint Pattern</label>
                            <input type="text" id="rulePattern" placeholder="/api/*" required>
                        </div>
                        <div class="form-group">
                            <label>Requests Limit</label>
                            <input type="number" id="ruleLimit" value="100" required>
                        </div>
                        <div class="form-group">
                            <label>Time Window</label>
                            <select id="ruleWindow">
                                <option value="1m">1 minute</option>
                                <option value="5m">5 minutes</option>
                                <option value="15m">15 minutes</option>
                                <option value="1h">1 hour</option>
                            </select>
                        </div>
                        <button type="submit" class="btn btn-primary">Add Rule</button>
                    </form>
                </div>
            </div>
        `,
        init: () => {
            const form = document.getElementById('rateLimitForm');
            if (form) {
                form.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const data = {
                        pattern: document.getElementById('rulePattern').value,
                        limit: parseInt(document.getElementById('ruleLimit').value),
                        window: document.getElementById('ruleWindow').value
                    };
                    await apiClient.post('/api/plugins/rate-limiting/rules', data);
                    showToast('success', 'Rate limit rule added');
                    setTimeout(() => loadPluginView('rate-limiting'), 1000);
                });
            }
        }
    };
}

// ===== SECURITY PLUGIN =====
async function renderSecurityView() {
    const config = await apiClient.get('/api/security/config') || {};
    
    return {
        title: 'Security Services',
        html: `
            <div class="grid-2">
                <div class="card">
                    <div class="card-header">🔐 Security Features</div>
                    <div class="security-features">
                        <div class="feature-item">
                            <label class="toggle-label">
                                <input type="checkbox" id="csrfEnabled" ${config.csrf?.enabled ? 'checked' : ''}>
                                <span>CSRF Protection</span>
                            </label>
                            <span class="feature-status ${config.csrf?.enabled ? 'active' : ''}">
                                ${config.csrf?.enabled ? '✅ Active' : '⚠️ Inactive'}
                            </span>
                        </div>
                        <div class="feature-item">
                            <label class="toggle-label">
                                <input type="checkbox" id="encryptionEnabled" ${config.encryption?.enabled ? 'checked' : ''}>
                                <span>Data Encryption</span>
                            </label>
                            <span class="feature-status ${config.encryption?.enabled ? 'active' : ''}">
                                ${config.encryption?.enabled ? '✅ Active' : '⚠️ Inactive'}
                            </span>
                        </div>
                        <div class="feature-item">
                            <label class="toggle-label">
                                <input type="checkbox" id="headersEnabled" ${config.headers?.enabled ? 'checked' : ''}>
                                <span>Security Headers</span>
                            </label>
                            <span class="feature-status ${config.headers?.enabled ? 'active' : ''}">
                                ${config.headers?.enabled ? '✅ Active' : '⚠️ Inactive'}
                            </span>
                        </div>
                    </div>
                    <button onclick="saveSecurityConfig()" class="btn btn-primary">Save Configuration</button>
                </div>
                
                <div class="card">
                    <div class="card-header">📊 Security Stats</div>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <div class="stat-number">${config.stats?.blocked || 0}</div>
                            <div class="stat-label">Threats Blocked</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-number">${config.stats?.encrypted || 0}</div>
                            <div class="stat-label">Data Encrypted</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-number">${config.stats?.validated || 0}</div>
                            <div class="stat-label">Requests Validated</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="card">
                <div class="card-header">🔑 Encryption Keys</div>
                <div class="encryption-info">
                    <p><strong>Algorithm:</strong> ${config.encryption?.algorithm || 'AES-256-GCM'}</p>
                    <p><strong>Key Rotation:</strong> ${config.encryption?.rotation || 'Every 90 days'}</p>
                    <button onclick="rotateKeys()" class="btn btn-warning">🔄 Rotate Keys Now</button>
                </div>
            </div>
        `,
        init: () => {
            window.saveSecurityConfig = async () => {
                const data = {
                    csrf: { enabled: document.getElementById('csrfEnabled').checked },
                    encryption: { enabled: document.getElementById('encryptionEnabled').checked },
                    headers: { enabled: document.getElementById('headersEnabled').checked }
                };
                await apiClient.post('/api/security/config', data);
                showToast('success', 'Security configuration updated');
            };
            
            window.rotateKeys = async () => {
                if (confirm('Rotate encryption keys? This may require re-encryption of data.')) {
                    await apiClient.post('/api/plugins/security/rotate-keys');
                    showToast('success', 'Keys rotated successfully');
                }
            };
        }
    };
}

// ===== AUTH PLUGIN =====
async function renderAuthView() {
    const config = await apiClient.get('/api/auth/config') || {};
    
    return {
        title: 'Authentication Services',
        html: `
            <div class="grid-2">
                <div class="card">
                    <div class="card-header">🔐 Authentication Methods</div>
                    <div class="auth-methods">
                        <div class="method-item">
                            <label class="toggle-label">
                                <input type="checkbox" id="mfaEnabled" ${config.mfa?.enabled ? 'checked' : ''}>
                                <span>Multi-Factor Authentication (MFA)</span>
                            </label>
                        </div>
                        <div class="method-item">
                            <label class="toggle-label">
                                <input type="checkbox" id="oauthEnabled" ${config.oauth?.enabled ? 'checked' : ''}>
                                <span>OAuth 2.0</span>
                            </label>
                        </div>
                        <div class="method-item">
                            <label class="toggle-label">
                                <input type="checkbox" id="ldapEnabled" ${config.ldap?.enabled ? 'checked' : ''}>
                                <span>LDAP/Active Directory</span>
                            </label>
                        </div>
                        <div class="method-item">
                            <label class="toggle-label">
                                <input type="checkbox" id="samlEnabled" ${config.saml?.enabled ? 'checked' : ''}>
                                <span>SAML 2.0</span>
                            </label>
                        </div>
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-header">📊 Authentication Stats</div>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <div class="stat-number">${config.stats?.successful || 0}</div>
                            <div class="stat-label">Successful Logins</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-number">${config.stats?.failed || 0}</div>
                            <div class="stat-label">Failed Attempts</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-number">${config.stats?.mfa || 0}</div>
                            <div class="stat-label">MFA Enabled Users</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="card">
                <div class="card-header">⚙️ Session Configuration</div>
                <form id="authConfigForm">
                    <div class="grid-2">
                        <div class="form-group">
                            <label>Session Timeout (minutes)</label>
                            <input type="number" id="sessionTimeout" value="${config.session?.timeout || 30}" min="5" max="1440">
                        </div>
                        <div class="form-group">
                            <label>Max Failed Attempts</label>
                            <input type="number" id="maxAttempts" value="${config.security?.maxAttempts || 5}" min="3" max="10">
                        </div>
                    </div>
                    <button type="submit" class="btn btn-primary">Save Configuration</button>
                </form>
            </div>
        `,
        init: () => {
            const form = document.getElementById('authConfigForm');
            if (form) {
                form.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const data = {
                        mfa: { enabled: document.getElementById('mfaEnabled').checked },
                        oauth: { enabled: document.getElementById('oauthEnabled').checked },
                        ldap: { enabled: document.getElementById('ldapEnabled').checked },
                        saml: { enabled: document.getElementById('samlEnabled').checked },
                        session: { timeout: parseInt(document.getElementById('sessionTimeout').value) },
                        security: { maxAttempts: parseInt(document.getElementById('maxAttempts').value) }
                    };
                    await apiClient.post('/api/auth/config', data);
                    showToast('success', 'Authentication configuration updated');
                });
            }
        }
    };
}

// ===== TENANTS PLUGIN =====
async function renderTenantsView() {
    const tenants = await apiClient.get('/api/tenants') || [];
    
    return {
        title: 'Multi-Tenant Management',
        html: `
            <div class="grid-2">
                <div class="card">
                    <div class="card-header">🏢 Tenants (${tenants.length})</div>
                    <div id="tenantsList">
                        ${tenants.length > 0 ? tenants.map(t => `
                            <div class="tenant-item">
                                <div class="tenant-info">
                                    <strong>${t.name}</strong>
                                    <span class="tenant-meta">${t.users || 0} users • ${t.resources || 0} resources</span>
                                </div>
                                <span class="badge badge-${t.active ? 'success' : 'secondary'}">${t.active ? 'Active' : 'Inactive'}</span>
                            </div>
                        `).join('') : '<p class="text-muted">No tenants configured</p>'}
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-header">➕ Add Tenant</div>
                    <form id="tenantForm">
                        <div class="form-group">
                            <label>Tenant Name</label>
                            <input type="text" id="tenantName" placeholder="Organization Name" required>
                        </div>
                        <div class="form-group">
                            <label>Tenant ID</label>
                            <input type="text" id="tenantId" placeholder="unique-identifier" required>
                        </div>
                        <div class="form-group">
                            <label>Admin Email</label>
                            <input type="email" id="tenantEmail" placeholder="admin@example.com" required>
                        </div>
                        <div class="form-group">
                            <label>Resource Quota</label>
                            <select id="tenantQuota">
                                <option value="small">Small (10 users, 100 GB)</option>
                                <option value="medium">Medium (50 users, 500 GB)</option>
                                <option value="large">Large (200 users, 2 TB)</option>
                                <option value="enterprise">Enterprise (Unlimited)</option>
                            </select>
                        </div>
                        <button type="submit" class="btn btn-primary">Create Tenant</button>
                    </form>
                </div>
            </div>
        `,
        init: () => {
            const form = document.getElementById('tenantForm');
            if (form) {
                form.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const data = {
                        name: document.getElementById('tenantName').value,
                        id: document.getElementById('tenantId').value,
                        email: document.getElementById('tenantEmail').value,
                        quota: document.getElementById('tenantQuota').value
                    };
                    await apiClient.post('/api/plugins/tenants/create', data);
                    showToast('success', 'Tenant created successfully');
                    setTimeout(() => loadPluginView('tenants'), 1000);
                });
            }
        }
    };
}

// ===== API ANALYTICS PLUGIN =====
async function renderAPIAnalyticsView() {
    const analytics = await apiClient.get('/api/api-analytics/stats') || {};
    
    return {
        title: 'API Analytics',
        html: `
            <div class="grid-4">
                <div class="stat-card">
                    <div class="stat-icon">📊</div>
                    <div class="stat-value">${analytics.totalRequests || 0}</div>
                    <div class="stat-label">Total Requests</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">✅</div>
                    <div class="stat-value">${analytics.successRate || 0}%</div>
                    <div class="stat-label">Success Rate</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">⚡</div>
                    <div class="stat-value">${analytics.avgResponseTime || 0}ms</div>
                    <div class="stat-label">Avg Response Time</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">🔥</div>
                    <div class="stat-value">${analytics.activeEndpoints || 0}</div>
                    <div class="stat-label">Active Endpoints</div>
                </div>
            </div>
            
            <div class="grid-2">
                <div class="card">
                    <div class="card-header">🎯 Top Endpoints</div>
                    <div id="topEndpoints">
                        ${analytics.topEndpoints?.length > 0 ? analytics.topEndpoints.map(e => `
                            <div class="endpoint-item">
                                <span class="endpoint-path">${e.path}</span>
                                <span class="endpoint-count">${e.count} requests</span>
                            </div>
                        `).join('') : '<p class="text-muted">No data available</p>'}
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-header">🌍 Request Origin</div>
                    <div id="requestOrigins">
                        ${analytics.origins?.length > 0 ? analytics.origins.map(o => `
                            <div class="origin-item">
                                <span>${o.country || 'Unknown'}</span>
                                <span class="badge">${o.count}</span>
                            </div>
                        `).join('') : '<p class="text-muted">No data available</p>'}
                    </div>
                </div>
            </div>
            
            <div class="card">
                <div class="card-header">📈 Request Timeline (Last 24h)</div>
                <div id="analyticsChart" style="height: 250px; display: flex; align-items: center; justify-content: center;">
                    <p class="text-muted">Timeline visualization coming soon</p>
                </div>
            </div>
        `,
        init: () => {
            // Chart initialization could go here
        }
    };
}

// ===== MULTI-SERVER PLUGIN =====
async function renderMultiServerView() {
    const servers = await apiClient.get('/api/multi-server/servers') || [];
    
    return {
        title: 'Multi-Server Management',
        html: `
            <div class="grid-3">
                ${servers.length > 0 ? servers.map(s => `
                    <div class="card server-card">
                        <div class="server-header">
                            <span class="server-status ${s.status}">${s.status === 'online' ? '🟢' : '🔴'}</span>
                            <h3>${s.name}</h3>
                        </div>
                        <div class="server-details">
                            <p><strong>IP:</strong> ${s.ip}</p>
                            <p><strong>CPU:</strong> ${s.cpu || 0}%</p>
                            <p><strong>Memory:</strong> ${s.memory || 0}%</p>
                            <p><strong>Uptime:</strong> ${s.uptime || 'N/A'}</p>
                        </div>
                        <button onclick="manageServer('${s.id}')" class="btn btn-sm">Manage</button>
                    </div>
                `).join('') : '<div class="card"><p class="text-muted">No servers registered</p></div>'}
            </div>
            
            <div class="card">
                <div class="card-header">➕ Register New Server</div>
                <form id="serverForm" class="grid-2">
                    <div class="form-group">
                        <label>Server Name</label>
                        <input type="text" id="serverName" placeholder="prod-server-01" required>
                    </div>
                    <div class="form-group">
                        <label>IP Address</label>
                        <input type="text" id="serverIp" placeholder="192.168.1.100" required>
                    </div>
                    <div class="form-group">
                        <label>API Token</label>
                        <input type="password" id="serverToken" placeholder="Server authentication token" required>
                    </div>
                    <div class="form-group">
                        <label>Region</label>
                        <select id="serverRegion">
                            <option value="us-east">US East</option>
                            <option value="us-west">US West</option>
                            <option value="eu-central">EU Central</option>
                            <option value="asia-pacific">Asia Pacific</option>
                        </select>
                    </div>
                    <div class="form-group" style="grid-column: 1 / -1;">
                        <button type="submit" class="btn btn-primary">Register Server</button>
                    </div>
                </form>
            </div>
        `,
        init: () => {
            const form = document.getElementById('serverForm');
            if (form) {
                form.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const data = {
                        name: document.getElementById('serverName').value,
                        ip: document.getElementById('serverIp').value,
                        token: document.getElementById('serverToken').value,
                        region: document.getElementById('serverRegion').value
                    };
                    await apiClient.post('/api/plugins/multi-server/register', data);
                    showToast('success', 'Server registered successfully');
                    setTimeout(() => loadPluginView('multi-server'), 1000);
                });
            }
            
            window.manageServer = (id) => {
                showToast('info', `Server management for ${id} coming soon`);
            };
        }
    };
}

// ===== STORAGE PLUGIN =====
async function renderStorageView() {
    const storage = await apiClient.get('/api/storage/info') || {};
    
    return {
        title: 'File Storage Management',
        html: `
            <div class="grid-3">
                <div class="stat-card">
                    <div class="stat-icon">💾</div>
                    <div class="stat-value">${storage.totalSize || '0 GB'}</div>
                    <div class="stat-label">Total Storage</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">📁</div>
                    <div class="stat-value">${storage.fileCount || 0}</div>
                    <div class="stat-label">Total Files</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">📊</div>
                    <div class="stat-value">${storage.usagePercent || 0}%</div>
                    <div class="stat-label">Storage Used</div>
                </div>
            </div>
            
            <div class="card">
                <div class="card-header">📂 Storage Locations</div>
                <div id="storageLocations">
                    ${storage.locations?.length > 0 ? storage.locations.map(loc => `
                        <div class="storage-item">
                            <div class="storage-info">
                                <strong>${loc.name}</strong>
                                <span class="text-muted">${loc.path}</span>
                            </div>
                            <div class="storage-usage">
                                <div class="progress-bar">
                                    <div class="progress-fill" style="width: ${loc.usage}%"></div>
                                </div>
                                <span>${loc.used} / ${loc.total}</span>
                            </div>
                        </div>
                    `).join('') : '<p class="text-muted">No storage locations configured</p>'}
                </div>
            </div>
            
            <div class="card">
                <div class="card-header">⚙️ Storage Configuration</div>
                <form id="storageConfigForm" class="grid-2">
                    <div class="form-group">
                        <label>Default Storage Location</label>
                        <input type="text" id="storagePath" value="${storage.defaultPath || '/data/storage'}" required>
                    </div>
                    <div class="form-group">
                        <label>Auto-cleanup Old Files</label>
                        <select id="cleanupDays">
                            <option value="30">After 30 days</option>
                            <option value="60">After 60 days</option>
                            <option value="90" selected>After 90 days</option>
                            <option value="0">Never</option>
                        </select>
                    </div>
                    <div class="form-group" style="grid-column: 1 / -1;">
                        <button type="submit" class="btn btn-primary">Save Configuration</button>
                    </div>
                </form>
            </div>
        `,
        init: () => {
            const form = document.getElementById('storageConfigForm');
            if (form) {
                form.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const data = {
                        path: document.getElementById('storagePath').value,
                        cleanupDays: parseInt(document.getElementById('cleanupDays').value)
                    };
                    await apiClient.post('/api/plugins/storage/config', data);
                    showToast('success', 'Storage configuration updated');
                });
            }
        }
    };
}

// ===== BACKUP & RECOVERY PLUGIN =====
async function renderBackupRecoveryView() {
    const backups = await apiClient.get('/api/backup/list') || [];
    
    return {
        title: 'Backup & Recovery',
        html: `
            <div class="grid-2">
                <div class="card">
                    <div class="card-header">💾 Create Backup</div>
                    <form id="backupForm">
                        <div class="form-group">
                            <label>Backup Name</label>
                            <input type="text" id="backupName" placeholder="backup-${new Date().toISOString().split('T')[0]}" required>
                        </div>
                        <div class="form-group">
                            <label>Backup Type</label>
                            <select id="backupType">
                                <option value="full">Full Backup</option>
                                <option value="incremental">Incremental</option>
                                <option value="differential">Differential</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Include</label>
                            <label><input type="checkbox" checked> Database</label>
                            <label><input type="checkbox" checked> Files</label>
                            <label><input type="checkbox"> Logs</label>
                            <label><input type="checkbox"> Configuration</label>
                        </div>
                        <button type="submit" class="btn btn-primary">🚀 Start Backup</button>
                    </form>
                </div>
                
                <div class="card">
                    <div class="card-header">📋 Recent Backups (${backups.length})</div>
                    <div id="backupsList">
                        ${backups.length > 0 ? backups.map(b => `
                            <div class="backup-item">
                                <div class="backup-info">
                                    <strong>${b.name}</strong>
                                    <span class="text-muted">${b.size} • ${b.date}</span>
                                </div>
                                <div class="backup-actions">
                                    <button onclick="restoreBackup('${b.id}')" class="btn btn-sm">Restore</button>
                                    <button onclick="deleteBackup('${b.id}')" class="btn btn-sm btn-danger">Delete</button>
                                </div>
                            </div>
                        `).join('') : '<p class="text-muted">No backups found</p>'}
                    </div>
                </div>
            </div>
            
            <div class="card">
                <div class="card-header">⚙️ Automated Backups</div>
                <form id="autoBackupForm" class="grid-2">
                    <div class="form-group">
                        <label>Schedule</label>
                        <select id="backupSchedule">
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Retention Period</label>
                        <select id="backupRetention">
                            <option value="7">7 days</option>
                            <option value="30">30 days</option>
                            <option value="90">90 days</option>
                            <option value="365">1 year</option>
                        </select>
                    </div>
                    <div class="form-group" style="grid-column: 1 / -1;">
                        <button type="submit" class="btn btn-primary">Save Schedule</button>
                    </div>
                </form>
            </div>
        `,
        init: () => {
            const form = document.getElementById('backupForm');
            if (form) {
                form.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const data = {
                        name: document.getElementById('backupName').value,
                        type: document.getElementById('backupType').value
                    };
                    await apiClient.post('/api/plugins/backup-recovery/create', data);
                    showToast('success', 'Backup started');
                    setTimeout(() => loadPluginView('backup-recovery'), 2000);
                });
            }
            
            window.restoreBackup = async (id) => {
                if (confirm('Restore this backup? Current data will be replaced.')) {
                    await apiClient.post(`/api/plugins/backup-recovery/restore/${id}`);
                    showToast('success', 'Backup restore started');
                }
            };
            
            window.deleteBackup = async (id) => {
                if (confirm('Delete this backup? This cannot be undone.')) {
                    await apiClient.delete(`/api/plugins/backup-recovery/delete/${id}`);
                    showToast('success', 'Backup deleted');
                    setTimeout(() => loadPluginView('backup-recovery'), 1000);
                }
            };
        }
    };
}

// ===== WEBHOOKS PLUGIN =====
async function renderWebhooksView() {
    const webhooks = await apiClient.get('/api/webhooks') || [];
    
    return {
        title: 'Webhooks',
        html: `
            <div class="grid-2">
                <div class="card">
                    <div class="card-header">🔗 Active Webhooks (${webhooks.length})</div>
                    <div id="webhooksList">
                        ${webhooks.length > 0 ? webhooks.map(w => `
                            <div class="webhook-item">
                                <div class="webhook-info">
                                    <strong>${w.name}</strong>
                                    <span class="text-muted">${w.url}</span>
                                    <span class="webhook-events">${w.events?.join(', ') || 'All events'}</span>
                                </div>
                                <div class="webhook-status">
                                    <span class="badge badge-${w.active ? 'success' : 'secondary'}">${w.active ? 'Active' : 'Inactive'}</span>
                                    <button onclick="testWebhook('${w.id}')" class="btn btn-sm">Test</button>
                                </div>
                            </div>
                        `).join('') : '<p class="text-muted">No webhooks configured</p>'}
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-header">➕ Add Webhook</div>
                    <form id="webhookForm">
                        <div class="form-group">
                            <label>Webhook Name</label>
                            <input type="text" id="webhookName" placeholder="My Webhook" required>
                        </div>
                        <div class="form-group">
                            <label>Payload URL</label>
                            <input type="url" id="webhookUrl" placeholder="https://example.com/webhook" required>
                        </div>
                        <div class="form-group">
                            <label>Events</label>
                            <select id="webhookEvents" multiple>
                                <option value="scan.completed">Scan Completed</option>
                                <option value="alert.created">Alert Created</option>
                                <option value="user.login">User Login</option>
                                <option value="backup.completed">Backup Completed</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Secret (optional)</label>
                            <input type="password" id="webhookSecret" placeholder="Webhook signing secret">
                        </div>
                        <button type="submit" class="btn btn-primary">Create Webhook</button>
                    </form>
                </div>
            </div>
            
            <div class="card">
                <div class="card-header">📊 Recent Deliveries</div>
                <div id="webhookDeliveries">
                    <p class="text-muted">No recent deliveries</p>
                </div>
            </div>
        `,
        init: () => {
            const form = document.getElementById('webhookForm');
            if (form) {
                form.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const data = {
                        name: document.getElementById('webhookName').value,
                        url: document.getElementById('webhookUrl').value,
                        events: Array.from(document.getElementById('webhookEvents').selectedOptions).map(o => o.value),
                        secret: document.getElementById('webhookSecret').value
                    };
                    await apiClient.post('/api/plugins/webhooks/create', data);
                    showToast('success', 'Webhook created');
                    setTimeout(() => loadPluginView('webhooks'), 1000);
                });
            }
            
            window.testWebhook = async (id) => {
                await apiClient.post(`/api/plugins/webhooks/test/${id}`);
                showToast('info', 'Test payload sent');
            };
        }
    };
}

// ===== NOTIFICATIONS PLUGIN =====
async function renderNotificationsView() {
    const notifications = await apiClient.get('/api/notifications') || [];
    
    return {
        title: 'Notifications',
        html: `
            <div class="grid-2">
                <div class="card">
                    <div class="card-header">🔔 Recent Notifications</div>
                    <div id="notificationsList">
                        ${notifications.length > 0 ? notifications.map(n => `
                            <div class="notification-item ${n.read ? 'read' : 'unread'}">
                                <div class="notification-icon">${n.icon || '📢'}</div>
                                <div class="notification-content">
                                    <strong>${n.title}</strong>
                                    <p>${n.message}</p>
                                    <span class="text-muted">${n.time}</span>
                                </div>
                            </div>
                        `).join('') : '<p class="text-muted">No notifications</p>'}
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-header">⚙️ Notification Settings</div>
                    <form id="notificationSettingsForm">
                        <div class="form-group">
                            <h4>Email Notifications</h4>
                            <label><input type="checkbox" id="emailAlerts" checked> Security Alerts</label>
                            <label><input type="checkbox" id="emailReports"> Daily Reports</label>
                            <label><input type="checkbox" id="emailUpdates"> System Updates</label>
                        </div>
                        
                        <div class="form-group">
                            <h4>Push Notifications</h4>
                            <label><input type="checkbox" id="pushAlerts" checked> Critical Alerts</label>
                            <label><input type="checkbox" id="pushScans"> Scan Completion</label>
                        </div>
                        
                        <div class="form-group">
                            <h4>Slack Integration</h4>
                            <input type="text" id="slackWebhook" placeholder="Slack webhook URL">
                        </div>
                        
                        <button type="submit" class="btn btn-primary">Save Settings</button>
                    </form>
                </div>
            </div>
            
            <div class="card">
                <div class="card-header">🎯 Alert Rules</div>
                <p class="text-muted">Configure when to send notifications based on events and conditions</p>
                <button onclick="addAlertRule()" class="btn btn-primary">Add Alert Rule</button>
            </div>
        `,
        init: () => {
            const form = document.getElementById('notificationSettingsForm');
            if (form) {
                form.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const data = {
                        email: {
                            alerts: document.getElementById('emailAlerts').checked,
                            reports: document.getElementById('emailReports').checked,
                            updates: document.getElementById('emailUpdates').checked
                        },
                        push: {
                            alerts: document.getElementById('pushAlerts').checked,
                            scans: document.getElementById('pushScans').checked
                        },
                        slack: {
                            webhook: document.getElementById('slackWebhook').value
                        }
                    };
                    await apiClient.post('/api/plugins/notifications/settings', data);
                    showToast('success', 'Notification settings updated');
                });
            }
            
            window.addAlertRule = () => {
                showToast('info', 'Alert rule builder coming soon');
            };
        }
    };
}

// ===== UPDATE PLUGIN =====
async function renderUpdateView() {
    const updateInfo = await apiClient.get('/api/update/check') || {};
    
    return {
        title: 'System Updates',
        html: `
            <div class="card">
                <div class="card-header">📦 Current Version</div>
                <div class="version-info">
                    <h2>${updateInfo.currentVersion || 'v4.10.0'}</h2>
                    <p>Installed: ${updateInfo.installDate || 'Unknown'}</p>
                    ${updateInfo.updateAvailable ? `
                        <div class="update-available">
                            <strong>🎉 Update Available: ${updateInfo.latestVersion}</strong>
                            <p>${updateInfo.updateDescription || 'New features and improvements'}</p>
                            <button onclick="installUpdate()" class="btn btn-success">Install Update</button>
                        </div>
                    ` : '<p class="text-success">✅ You are running the latest version</p>'}
                </div>
            </div>
            
            <div class="grid-2">
                <div class="card">
                    <div class="card-header">🔍 Check for Updates</div>
                    <p>Last checked: ${updateInfo.lastCheck || 'Never'}</p>
                    <button onclick="checkUpdates()" class="btn btn-primary">Check Now</button>
                    
                    <div class="form-group" style="margin-top: 20px;">
                        <label>
                            <input type="checkbox" id="autoUpdate" ${updateInfo.autoUpdate ? 'checked' : ''}>
                            Automatically check for updates
                        </label>
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-header">📋 Update History</div>
                    <div id="updateHistory">
                        ${updateInfo.history?.length > 0 ? updateInfo.history.map(h => `
                            <div class="update-item">
                                <strong>${h.version}</strong>
                                <span class="text-muted">${h.date}</span>
                            </div>
                        `).join('') : '<p class="text-muted">No update history</p>'}
                    </div>
                </div>
            </div>
            
            <div class="card">
                <div class="card-header">📝 Release Notes</div>
                <div id="releaseNotes">
                    ${updateInfo.releaseNotes || '<p class="text-muted">No release notes available</p>'}
                </div>
            </div>
        `,
        init: () => {
            window.checkUpdates = async () => {
                showToast('info', 'Checking for updates...');
                const result = await apiClient.get('/api/update/check');
                if (result.updateAvailable) {
                    showToast('success', `Update available: ${result.latestVersion}`);
                } else {
                    showToast('info', 'No updates available');
                }
                setTimeout(() => loadPluginView('update'), 1000);
            };
            
            window.installUpdate = async () => {
                if (confirm('Install update? The system may restart.')) {
                    showToast('info', 'Installing update...');
                    await apiClient.post('/api/plugins/update/install');
                    showToast('success', 'Update installed successfully');
                }
            };
        }
    };
}

// Export to global scope
window.loadPluginView = loadPluginView;
window.showAddUserModal = function() {
    showToast('info', 'Add User modal coming soon');
};
