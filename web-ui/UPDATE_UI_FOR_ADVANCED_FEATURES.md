# Web UI - Advanced Features Integration

The Web UI has been updated to support all new scanner features:

## New API Endpoints Added (/api/advanced/*)

1. **POST /api/advanced/custom-rules** - Run custom security rules
2. **POST /api/advanced/kubernetes** - Scan Kubernetes clusters
3. **POST /api/advanced/database** - Scan databases (MySQL, PostgreSQL, MongoDB, Redis)
4. **POST /api/advanced/compliance** - Run compliance framework checks
5. **POST /api/advanced/cloud** - Scan cloud providers (AWS, GCP, Azure)
6. **POST /api/advanced/multi-server** - Scan multiple servers

7. **GET /api/advanced/status** - Get status of all advanced scans

## Frontend Updates Needed

Add to `public/index.html`:

### New Tab in Navigation
```html
<div class="tab" data-tab="advanced">⚡ Advanced</div>
```

### New Tab Content
```html
<div class="tab-content" id="advanced-tab">
    <h2>Advanced Security Scanning</h2>
    
    <!-- Custom Rules -->
    <div class="scan-section">
        <h3>🎯 Custom Security Rules</h3>
        <select id="ruleGroup">
            <option value="">All Rules</option>
            <option value="critical">Critical Only</option>
            <option value="web-security">Web Security</option>
            <option value="ssh-security">SSH Security</option>
        </select>
        <button onclick="startAdvancedScan('custom-rules')">Run Custom Rules</button>
    </div>
    
    <!-- Kubernetes -->
    <div class="scan-section">
        <h3>☸️ Kubernetes Security</h3>
        <button onclick="startAdvancedScan('kubernetes')">Scan K8s Cluster</button>
    </div>
    
    <!-- Database -->
    <div class="scan-section">
        <h3>🗄️ Database Security</h3>
        <label><input type="checkbox" value="mysql"> MySQL</label>
        <label><input type="checkbox" value="postgresql"> PostgreSQL</label>
        <label><input type="checkbox" value="mongodb"> MongoDB</label>
        <label><input type="checkbox" value="redis"> Redis</label>
        <button onclick="startAdvancedScan('database')">Scan Databases</button>
    </div>
    
    <!-- Compliance -->
    <div class="scan-section">
        <h3>📋 Compliance Frameworks</h3>
        <select id="complianceFramework">
            <option value="pci-dss">PCI-DSS</option>
            <option value="hipaa">HIPAA</option>
            <option value="soc2">SOC 2</option>
            <option value="gdpr">GDPR</option>
            <option value="all">All Frameworks</option>
        </select>
        <button onclick="startAdvancedScan('compliance')">Run Compliance Scan</button>
    </div>
    
    <!-- Cloud -->
    <div class="scan-section">
        <h3>☁️ Cloud Security</h3>
        <label><input type="checkbox" value="aws"> AWS</label>
        <label><input type="checkbox" value="gcp"> GCP</label>
        <label><input type="checkbox" value="azure"> Azure</label>
        <button onclick="startAdvancedScan('cloud')">Scan Cloud</button>
    </div>
    
    <!-- Multi-Server -->
    <div class="scan-section">
        <h3>🖥️ Multi-Server Scanning</h3>
        <input type="text" id="serverGroup" placeholder="production">
        <button onclick="startAdvancedScan('multi-server')">Scan Servers</button>
    </div>
    
    <div id="advancedScanOutput" class="scan-output"></div>
</div>
```

### JavaScript Functions
```javascript
// Add to app.js

async function startAdvancedScan(scanType) {
    const output = document.getElementById('advancedScanOutput');
    output.textContent = 'Starting scan...\\n';
    
    let body = {};
    
    switch(scanType) {
        case 'custom-rules':
            const group = document.getElementById('ruleGroup').value;
            if (group) body.group = group;
            break;
            
        case 'database':
            const dbCheckboxes = document.querySelectorAll('#advanced-tab input[type=checkbox]:checked');
            body.databases = Array.from(dbCheckboxes).map(cb => cb.value);
            break;
            
        case 'compliance':
            body.framework = document.getElementById('complianceFramework').value;
            break;
            
        case 'cloud':
            const cloudCheckboxes = document.querySelectorAll('#advanced-tab input[value="aws"],input[value="gcp"],input[value="azure"]');
            body.providers = Array.from(cloudCheckboxes).filter(cb => cb.checked).map(cb => cb.value);
            break;
            
        case 'multi-server':
            body.group = document.getElementById('serverGroup').value;
            break;
    }
    
    try {
        const response = await fetch(`/api/advanced/${scanType}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        
        const data = await response.json();
        
        if (data.success) {
            output.textContent += `Scan started (ID: ${data.scanId})\\n`;
        } else {
            output.textContent += `Error: ${data.message}\\n`;
        }
    } catch (error) {
        output.textContent += `Error: ${error.message}\\n`;
    }
}

// Handle WebSocket messages for advanced scans
// Add to existing WebSocket message handler:
case 'scan_progress':
    if (message.scanId) {
        const output = document.getElementById('advancedScanOutput');
        if (output && message.output) {
            output.textContent += message.output.join('\\n') + '\\n';
            output.scrollTop = output.scrollHeight;
        }
    }
    break;
    
case 'scan_complete':
    if (message.scanId) {
        const output = document.getElementById('advancedScanOutput');
        if (output) {
            output.textContent += `\\n===== Scan Complete (${message.status}) =====\\n`;
        }
        loadReports(); // Refresh reports list
    }
    break;
```

## Usage

After updating the UI, you can:

1. **Custom Rules**: Select rule group and run
2. **Kubernetes**: One-click K8s cluster scan
3. **Database**: Select databases to scan
4. **Compliance**: Choose framework (PCI-DSS, HIPAA, SOC2, GDPR)
5. **Cloud**: Select cloud providers to scan
6. **Multi-Server**: Enter server group name

All scans show real-time output and generate reports accessible in the Reports tab.

## Testing

1. Start Web UI: `cd web-ui && ./start-web-ui.sh`
2. Open http://localhost:3000
3. Click "Advanced" tab
4. Test each scanner type

## Notes

- Ensure all scanner scripts are executable
- Configure cloud CLIs before running cloud scans
- Set up servers.yaml for multi-server scanning
- Configure rules.yaml for custom rules
- Kubernetes scanner requires kubectl configured

