// Compliance scanner frontend

class ComplianceScanner {
    constructor() {
        this.setupEventListeners();
        this.checkOpenSCAPStatus();
    }

    async checkOpenSCAPStatus() {
        try {
            const response = await authManager.apiCall('/api/compliance/openscap/status');
            const data = await response.json();
            
            const statusEl = document.getElementById('openscapStatus');
            if (statusEl) {
                if (data.installed && data.contentAvailable) {
                    statusEl.innerHTML = `<span class="status-ok">✅ Installed (${data.contentFiles} profiles)</span>`;
                } else if (data.installed) {
                    statusEl.innerHTML = `<span class="status-warning">⚠️ Installed but no content</span>`;
                } else {
                    statusEl.innerHTML = `<span class="status-error">❌ Not installed</span>`;
                }
            }

            // Show/hide install instructions
            const installMsg = document.getElementById('openscapInstallMsg');
            if (installMsg) {
                installMsg.style.display = data.installed ? 'none' : 'block';
            }
        } catch (error) {
            console.error('Error checking OpenSCAP status:', error);
        }
    }

    async loadProfiles() {
        try {
            const response = await authManager.apiCall('/api/compliance/openscap/profiles');
            const data = await response.json();
            
            const select = document.getElementById('openscapProfile');
            if (select) {
                select.innerHTML = data.profiles.map(p => 
                    `<option value="${p.id}">${p.name} - ${p.description}</option>`
                ).join('');
            }
        } catch (error) {
            console.error('Error loading profiles:', error);
        }
    }

    setupEventListeners() {
        // Standard compliance scan
        const complianceForm = document.getElementById('complianceForm');
        if (complianceForm) {
            complianceForm.addEventListener('submit', (e) => this.runComplianceScan(e));
        }

        // NIST scan
        const nistForm = document.getElementById('nistForm');
        if (nistForm) {
            nistForm.addEventListener('submit', (e) => this.runNISTScan(e));
        }

        // ISO 27001 scan
        const isoForm = document.getElementById('isoForm');
        if (isoForm) {
            isoForm.addEventListener('submit', (e) => this.runISOScan(e));
        }

        // OpenSCAP scan
        const openscapForm = document.getElementById('openscapForm');
        if (openscapForm) {
            openscapForm.addEventListener('submit', (e) => this.runOpenSCAPScan(e));
        }

        // DISA STIG scan
        const disaStigForm = document.getElementById('disaStigForm');
        if (disaStigForm) {
            disaStigForm.addEventListener('submit', (e) => this.runDISASTIGScan(e));
        }
    }

    async runComplianceScan(e) {
        e.preventDefault();
        
        const framework = document.getElementById('complianceFramework').value;
        const notify = document.getElementById('complianceNotify').checked;
        const btn = e.target.querySelector('button[type="submit"]');
        
        btn.disabled = true;
        btn.textContent = 'Scanning...';
        
        try {
            const response = await authManager.apiCall('/api/compliance/scan', {
                method: 'POST',
                body: JSON.stringify({ framework, notify })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showNotification('Compliance scan started', 'success');
            } else {
                this.showNotification('Failed to start scan', 'error');
            }
        } catch (error) {
            console.error('Error starting compliance scan:', error);
            this.showNotification('Error starting scan', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Run Compliance Scan';
        }
    }

    async runNISTScan(e) {
        e.preventDefault();
        
        const framework = document.getElementById('nistFramework').value;
        const notify = document.getElementById('nistNotify').checked;
        const btn = e.target.querySelector('button[type="submit"]');
        
        btn.disabled = true;
        btn.textContent = 'Scanning...';
        
        try {
            const response = await authManager.apiCall('/api/compliance/nist', {
                method: 'POST',
                body: JSON.stringify({ framework, notify })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showNotification(`NIST ${framework.toUpperCase()} scan started`, 'success');
            } else {
                this.showNotification('Failed to start NIST scan', 'error');
            }
        } catch (error) {
            console.error('Error starting NIST scan:', error);
            this.showNotification('Error starting NIST scan', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Run NIST Scan';
        }
    }

    async runISOScan(e) {
        e.preventDefault();
        
        const notify = document.getElementById('isoNotify').checked;
        const btn = e.target.querySelector('button[type="submit"]');
        
        btn.disabled = true;
        btn.textContent = 'Scanning...';
        
        try {
            const response = await authManager.apiCall('/api/compliance/iso27001', {
                method: 'POST',
                body: JSON.stringify({ notify })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showNotification('ISO 27001 scan started', 'success');
            } else {
                this.showNotification('Failed to start ISO 27001 scan', 'error');
            }
        } catch (error) {
            console.error('Error starting ISO 27001 scan:', error);
            this.showNotification('Error starting ISO 27001 scan', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Run ISO 27001 Scan';
        }
    }

    async runOpenSCAPScan(e) {
        e.preventDefault();
        
        const profile = document.getElementById('openscapProfile').value;
        const analyze = document.getElementById('openscapAnalyze').checked;
        const notify = document.getElementById('openscapNotify').checked;
        const fix = document.getElementById('openscapFix')?.checked || false;
        const btn = e.target.querySelector('button[type="submit"]');
        
        // Confirm if fix is enabled
        if (fix) {
            if (!confirm('⚠️  AUTO-FIX ENABLED\n\nThis will modify your system configuration. Are you sure?\n\nMake sure you have backups!')) {
                return;
            }
        }
        
        btn.disabled = true;
        btn.textContent = 'Scanning...';
        
        try {
            const response = await authManager.apiCall('/api/compliance/openscap', {
                method: 'POST',
                body: JSON.stringify({ profile, analyze, fix, notify })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showNotification(`OpenSCAP scan started (${data.profile})`, 'success');
            } else if (data.error === 'OpenSCAP not installed') {
                this.showNotification(data.message, 'error');
            } else {
                this.showNotification('Failed to start OpenSCAP scan', 'error');
            }
        } catch (error) {
            console.error('Error starting OpenSCAP scan:', error);
            this.showNotification('Error starting scan', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Run OpenSCAP Scan';
        }
    }

    async runDISASTIGScan(e) {
        e.preventDefault();
        
        const category = document.getElementById('stigCategory').value;
        const analyze = document.getElementById('stigAnalyze').checked;
        const notify = document.getElementById('stigNotify').checked;
        const fix = document.getElementById('stigFix')?.checked || false;
        const btn = e.target.querySelector('button[type="submit"]');
        
        // Confirm if fix is enabled
        if (fix) {
            if (!confirm('⚠️  ⚠️  ⚠️  AUTO-FIX ENABLED FOR DISA STIG\n\nThis will enforce DoD security requirements and may significantly change your system.\n\nHave you backed up your system?\n\nAre you ABSOLUTELY SURE?')) {
                return;
            }
        }
        
        btn.disabled = true;
        btn.textContent = 'Scanning...';
        
        try {
            const response = await authManager.apiCall('/api/compliance/disa-stig', {
                method: 'POST',
                body: JSON.stringify({ 
                    category: category || undefined, 
                    analyze, 
                    fix, 
                    notify 
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showNotification(`DISA STIG scan started${data.category !== 'all' ? ' (' + data.category + ')' : ''}`, 'success');
            } else if (data.error === 'OpenSCAP not installed') {
                this.showNotification(data.message, 'error');
            } else {
                this.showNotification('Failed to start DISA STIG scan', 'error');
            }
        } catch (error) {
            console.error('Error starting DISA STIG scan:', error);
            this.showNotification('Error starting scan', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Run DISA STIG Scan';
        }
    }

    showNotification(message, type = 'info') {
        // Add to activity log
        const activityLog = document.getElementById('activityLog');
        if (activityLog) {
            const item = document.createElement('div');
            item.className = `activity-item ${type}`;
            item.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
            activityLog.insertBefore(item, activityLog.firstChild);
            
            // Keep only last 10 items
            while (activityLog.children.length > 10) {
                activityLog.removeChild(activityLog.lastChild);
            }
        }
    }
}

// Initialize on page load
let complianceScanner;
document.addEventListener('DOMContentLoaded', () => {
    complianceScanner = new ComplianceScanner();
    complianceScanner.loadProfiles();
});

// Handle WebSocket messages
if (typeof ws !== 'undefined') {
    const originalOnMessage = ws.onmessage;
    ws.onmessage = function(event) {
        const message = JSON.parse(event.data);
        
        if (message.type === 'openscap_complete' || 
            message.type === 'disa_stig_complete' ||
            message.type === 'compliance_complete' ||
            message.type === 'nist_complete' ||
            message.type === 'iso27001_complete') {
            if (complianceScanner) {
                const scanType = message.type.replace('_complete', '').replace('_', ' ').toUpperCase();
                complianceScanner.showNotification(`${scanType} scan completed`, 'success');
                
                // Reload reports list
                if (typeof loadReports === 'function') {
                    loadReports();
                }
            }
        }
        
        // Call original handler
        if (originalOnMessage) {
            originalOnMessage.call(this, event);
        }
    };
}
