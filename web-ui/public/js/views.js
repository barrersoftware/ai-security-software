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
function renderPoliciesView() { return { title: 'Policies', html: '<div class="card"><p>Policies view - Create and manage custom scanning policies</p></div>', init: () => {} }; }
function renderRateLimitingView() { return { title: 'Rate Limiting', html: '<div class="card"><p>Rate limiting configuration and monitoring</p></div>', init: () => {} }; }
function renderSecurityView() { return { title: 'Security Services', html: '<div class="card"><p>CSRF protection, encryption, security headers configuration</p></div>', init: () => {} }; }
function renderAuthView() { return { title: 'Authentication', html: '<div class="card"><p>MFA, OAuth, LDAP configuration</p></div>', init: () => {} }; }
function renderTenantsView() { return { title: 'Tenants', html: '<div class="card"><p>Multi-tenant management and isolation</p></div>', init: () => {} }; }
function renderAPIAnalyticsView() { return { title: 'API Analytics', html: '<div class="card"><p>API usage statistics and monitoring</p></div>', init: () => {} }; }
function renderMultiServerView() { return { title: 'Multi-Server', html: '<div class="card"><p>Manage and monitor multiple servers</p></div>', init: () => {} }; }
function renderStorageView() { return { title: 'Storage', html: '<div class="card"><p>File storage management</p></div>', init: () => {} }; }
function renderBackupRecoveryView() { return { title: 'Backup & Recovery', html: '<div class="card"><p>Backup and recovery operations</p></div>', init: () => {} }; }
function renderWebhooksView() { return { title: 'Webhooks', html: '<div class="card"><p>Webhook configuration and testing</p></div>', init: () => {} }; }
function renderNotificationsView() { return { title: 'Notifications', html: '<div class="card"><p>Alert and notification management</p></div>', init: () => {} }; }
function renderUpdateView() { return { title: 'System Updates', html: '<div class="card"><p>Check for and install system updates</p></div>', init: () => {} }; }

// Export to global scope
window.loadPluginView = loadPluginView;
window.showAddUserModal = function() {
    showToast('info', 'Add User modal coming soon');
};
