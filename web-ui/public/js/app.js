// WebSocket connection
let ws = null;
let reconnectInterval = null;
let currentScanId = null;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    initWebSocket();
    initTabs();
    initButtons();
    loadDashboard();
    loadReports();
    loadSystemInfo();
    setupChatInput();
});

// WebSocket functions
function initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
        console.log('WebSocket connected');
        updateConnectionStatus(true);
        if (reconnectInterval) {
            clearInterval(reconnectInterval);
            reconnectInterval = null;
        }
    };
    
    ws.onclose = () => {
        console.log('WebSocket disconnected');
        updateConnectionStatus(false);
        
        if (!reconnectInterval) {
            reconnectInterval = setInterval(() => {
                console.log('Reconnecting...');
                initWebSocket();
            }, 5000);
        }
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
    
    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
        }
    };
}

function handleWebSocketMessage(data) {
    switch (data.type) {
        case 'new_report':
            addActivity(`New report generated: ${data.filename}`, 'success');
            loadReports();
            break;
        case 'report_updated':
            addActivity(`Report updated: ${data.filename}`, 'success');
            break;
        case 'scan_progress':
            updateScanOutput(data.output);
            break;
        case 'scan_complete':
            addActivity(`Scan ${data.scanId} completed with status: ${data.status}`, 
                       data.status === 'completed' ? 'success' : 'error');
            loadReports();
            break;
    }
}

function updateConnectionStatus(connected) {
    const indicator = document.getElementById('connectionStatus');
    if (connected) {
        indicator.classList.add('connected');
        indicator.classList.remove('disconnected');
        indicator.querySelector('.text').textContent = 'Connected';
    } else {
        indicator.classList.remove('connected');
        indicator.classList.add('disconnected');
        indicator.querySelector('.text').textContent = 'Disconnected';
    }
}

// Tab navigation
function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;
            
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            button.classList.add('active');
            document.getElementById(tabName).classList.add('active');
            
            // Load content when tab is opened
            if (tabName === 'reports') loadReports();
            if (tabName === 'system') loadSystemInfo();
            if (tabName === 'scanner') loadActiveScans();
        });
    });
}

// Button handlers
function initButtons() {
    // Start comprehensive scan
    document.getElementById('startComprehensiveScan').addEventListener('click', async () => {
        const button = document.getElementById('startComprehensiveScan');
        button.disabled = true;
        button.textContent = 'Starting...';
        
        try {
            const response = await fetch('/api/scanner/start', { method: 'POST' });
            const data = await response.json();
            
            if (data.success) {
                currentScanId = data.scanId;
                addActivity('Comprehensive scan started', 'success');
                showTab('scanner');
                loadActiveScans();
            } else {
                addActivity('Failed to start scan', 'error');
            }
        } catch (error) {
            console.error('Error starting scan:', error);
            addActivity('Error starting scan: ' + error.message, 'error');
        } finally {
            button.disabled = false;
            button.innerHTML = '<span class="btn-icon">🔍</span><span class="btn-text"><strong>Comprehensive Scan</strong><small>Full system security audit</small></span>';
        }
    });
    
    // Start code review
    document.getElementById('startCodeReview').addEventListener('click', () => {
        showModal('codeReviewModal');
    });
    
    // Start malware scan
    document.getElementById('startMalwareScan').addEventListener('click', async () => {
        const button = document.getElementById('startMalwareScan');
        const originalHTML = button.innerHTML;
        button.disabled = true;
        button.innerHTML = '<span class="btn-icon">🦠</span><span class="btn-text"><strong>Starting...</strong><small>Please wait</small></span>';
        
        try {
            const response = await fetch('/api/scanner/malware-scan', { method: 'POST' });
            const data = await response.json();
            
            if (data.success) {
                currentScanId = data.scanId;
                addActivity('Malware & rootkit scan started (this may take 15-30 minutes)', 'success');
                showTab('scanner');
                loadActiveScans();
            } else {
                addActivity('Failed to start malware scan', 'error');
            }
        } catch (error) {
            console.error('Error starting malware scan:', error);
            addActivity('Error starting malware scan: ' + error.message, 'error');
        } finally {
            button.disabled = false;
            button.innerHTML = originalHTML;
        }
    });
    
    document.getElementById('confirmCodeReview').addEventListener('click', async () => {
        const path = document.getElementById('codePathInput').value.trim();
        if (!path) {
            alert('Please enter a path');
            return;
        }
        
        hideModal('codeReviewModal');
        
        try {
            const response = await fetch('/api/scanner/code-review', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path })
            });
            
            const data = await response.json();
            if (data.success) {
                currentScanId = data.scanId;
                addActivity(`Code review started for ${path}`, 'success');
                showTab('scanner');
                loadActiveScans();
            }
        } catch (error) {
            console.error('Error starting code review:', error);
            addActivity('Error starting code review: ' + error.message, 'error');
        }
    });
    
    document.getElementById('cancelCodeReview').addEventListener('click', () => {
        hideModal('codeReviewModal');
    });
    
    // Refresh reports
    document.getElementById('refreshReports').addEventListener('click', () => {
        loadReports();
    });
    
    // Modal close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            hideModal(modal.id);
        });
    });
    
    // Close modal on background click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                hideModal(modal.id);
            }
        });
    });
}

// Dashboard functions
async function loadDashboard() {
    try {
        // Load stats
        const statsResponse = await fetch('/api/reports/stats/summary');
        const stats = await statsResponse.json();
        
        document.getElementById('totalReports').textContent = stats.totalReports || 0;
        
        // Load system info
        const systemResponse = await fetch('/api/system/info');
        const systemInfo = await systemResponse.json();
        
        document.getElementById('hostname').textContent = systemInfo.hostname;
        document.getElementById('uptime').textContent = `${systemInfo.uptime}h uptime`;
        document.getElementById('cpuCount').textContent = systemInfo.cpus;
        document.getElementById('memoryUsage').textContent = 
            `${systemInfo.totalMemory - systemInfo.freeMemory}/${systemInfo.totalMemory} GB`;
        
        // Load security status
        await loadSecurityStatus();
        
        // Load latest report
        if (stats.latestReport) {
            const reportResponse = await fetch(`/api/reports/${stats.latestReport.filename}`);
            const report = await reportResponse.json();
            
            const preview = report.content.substring(0, 500) + '...';
            document.getElementById('latestReport').innerHTML = 
                `<pre>${preview}</pre><button class="btn btn-sm" onclick="viewReport('${stats.latestReport.filename}')">View Full Report</button>`;
        }
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

async function loadSecurityStatus() {
    try {
        const [securityResponse, ollamaResponse] = await Promise.all([
            fetch('/api/system/security/summary'),
            fetch('/api/system/ollama/status')
        ]);
        
        const security = await securityResponse.json();
        const ollama = await ollamaResponse.json();
        
        const firewallEl = document.getElementById('firewallStatus');
        firewallEl.textContent = security.firewall?.status || 'Unknown';
        firewallEl.className = `value ${security.firewall?.status === 'active' ? 'active' : 'inactive'}`;
        
        const fail2banEl = document.getElementById('fail2banStatus');
        fail2banEl.textContent = security.fail2ban?.status || 'Unknown';
        fail2banEl.className = `value ${security.fail2ban?.status === 'active' ? 'active' : 'inactive'}`;
        
        const ollamaEl = document.getElementById('ollamaStatus');
        ollamaEl.textContent = ollama.running ? 'Running' : 'Stopped';
        ollamaEl.className = `value ${ollama.running ? 'active' : 'inactive'}`;
        
        // Update active scans count
        const scansResponse = await fetch('/api/scanner/status');
        const scans = await scansResponse.json();
        document.getElementById('activeScans').textContent = 
            scans.scans.filter(s => s.status === 'running').length;
        
    } catch (error) {
        console.error('Error loading security status:', error);
    }
}

function addActivity(message, type = 'info') {
    const log = document.getElementById('activityLog');
    const item = document.createElement('div');
    item.className = `activity-item ${type}`;
    item.textContent = `${new Date().toLocaleTimeString()} - ${message}`;
    log.insertBefore(item, log.firstChild);
    
    // Keep only last 50 items
    while (log.children.length > 50) {
        log.removeChild(log.lastChild);
    }
}

// Scanner functions
async function loadActiveScans() {
    try {
        const response = await fetch('/api/scanner/status');
        const data = await response.json();
        
        const container = document.getElementById('activeScansList');
        
        if (data.scans.length === 0) {
            container.innerHTML = '<p class="empty">No active scans</p>';
            return;
        }
        
        container.innerHTML = data.scans.map(scan => `
            <div class="scan-item ${scan.status}">
                <div class="scan-header">
                    <div>
                        <strong>${scan.type}</strong>
                        <div style="font-size: 0.9em; color: var(--text-secondary);">
                            Started: ${new Date(scan.startTime).toLocaleString()}
                        </div>
                    </div>
                    <span class="scan-status ${scan.status}">${scan.status}</span>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading active scans:', error);
    }
}

function updateScanOutput(lines) {
    const output = document.getElementById('scanOutput');
    const existingContent = output.querySelector('p.empty') ? '' : output.textContent;
    output.innerHTML = `<pre>${existingContent}\n${lines.join('\n')}</pre>`;
    output.scrollTop = output.scrollHeight;
}

// Reports functions
async function loadReports() {
    try {
        const response = await fetch('/api/reports/');
        const data = await response.json();
        
        const container = document.getElementById('reportsList');
        
        if (data.reports.length === 0) {
            container.innerHTML = '<p class="empty">No reports found</p>';
            return;
        }
        
        container.innerHTML = data.reports.map(report => `
            <div class="report-item" onclick="viewReport('${report.filename}')">
                <div class="report-header">
                    <div class="report-filename">${report.filename}</div>
                    <span class="report-type">${report.type}</span>
                </div>
                <div class="report-meta">
                    <span>📅 ${new Date(report.modified).toLocaleString()}</span>
                    <span>📦 ${formatSize(report.size)}</span>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading reports:', error);
        document.getElementById('reportsList').innerHTML = 
            '<p class="empty">Error loading reports</p>';
    }
}

async function viewReport(filename) {
    try {
        const response = await fetch(`/api/reports/${filename}?format=html`);
        const data = await response.json();
        
        document.getElementById('reportTitle').textContent = filename;
        
        if (data.html) {
            document.getElementById('reportContent').innerHTML = data.html;
        } else {
            document.getElementById('reportContent').innerHTML = 
                `<pre>${data.content}</pre>`;
        }
        
        showModal('reportViewerModal');
        
    } catch (error) {
        console.error('Error loading report:', error);
        alert('Failed to load report');
    }
}

// System functions
async function loadSystemInfo() {
    try {
        const [systemResponse, diskResponse, modelsResponse] = await Promise.all([
            fetch('/api/system/info'),
            fetch('/api/system/disk'),
            fetch('/api/chat/status')
        ]);
        
        const system = await systemResponse.json();
        const disk = await diskResponse.json();
        const models = await modelsResponse.json();
        
        // System details
        document.getElementById('sysHostname').textContent = system.hostname;
        document.getElementById('sysPlatform').textContent = system.platform;
        document.getElementById('sysArch').textContent = system.arch;
        document.getElementById('sysCpus').textContent = system.cpus;
        document.getElementById('sysTotalMem').textContent = `${system.totalMemory} GB`;
        document.getElementById('sysFreeMem').textContent = `${system.freeMemory} GB`;
        document.getElementById('sysUptime').textContent = `${system.uptime} hours`;
        
        // Disk info
        document.getElementById('diskInfo').innerHTML = `
            <div class="detail-item">
                <span class="label">Total:</span>
                <span class="value">${disk.size}</span>
            </div>
            <div class="detail-item">
                <span class="label">Used:</span>
                <span class="value">${disk.used}</span>
            </div>
            <div class="detail-item">
                <span class="label">Available:</span>
                <span class="value">${disk.available}</span>
            </div>
            <div class="detail-item">
                <span class="label">Use:</span>
                <span class="value">${disk.usePercent}</span>
            </div>
        `;
        
        // AI Models
        if (models.available && models.models.length > 0) {
            document.getElementById('aiModels').innerHTML = models.models.map(model => `
                <div class="model-item">
                    <strong>${model.name}</strong>
                    <div style="font-size: 0.9em; color: var(--text-secondary); margin-top: 5px;">
                        Size: ${model.size} | Modified: ${model.modified}
                    </div>
                </div>
            `).join('');
        } else {
            document.getElementById('aiModels').innerHTML = 
                '<p class="empty">No AI models found. Run: ollama pull llama3.1:8b</p>';
        }
        
    } catch (error) {
        console.error('Error loading system info:', error);
    }
}

// Chat functions
function setupChatInput() {
    const input = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendMessage');
    
    sendBtn.addEventListener('click', () => sendChatMessage());
    
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChatMessage();
        }
    });
}

async function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    // Add user message to chat
    addChatMessage(message, 'user');
    input.value = '';
    
    // Show loading indicator
    const loadingId = Date.now();
    addChatMessage('Thinking...', 'assistant', loadingId);
    
    try {
        const response = await fetch('/api/chat/message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        });
        
        const data = await response.json();
        
        // Remove loading message
        document.getElementById(`msg-${loadingId}`)?.remove();
        
        if (data.success) {
            addChatMessage(data.response, 'assistant');
        } else {
            addChatMessage('Error: ' + (data.message || 'Failed to get response'), 'assistant');
        }
        
    } catch (error) {
        console.error('Chat error:', error);
        document.getElementById(`msg-${loadingId}`)?.remove();
        addChatMessage('Error: ' + error.message, 'assistant');
    }
}

function addChatMessage(text, sender, id = null) {
    const messages = document.getElementById('chatMessages');
    const message = document.createElement('div');
    message.className = `chat-message ${sender}`;
    if (id) message.id = `msg-${id}`;
    
    const content = document.createElement('div');
    content.className = 'message-content';
    content.textContent = text;
    
    message.appendChild(content);
    messages.appendChild(message);
    messages.scrollTop = messages.scrollHeight;
}

// Utility functions
function showModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function hideModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function showTab(tabName) {
    document.querySelector(`[data-tab="${tabName}"]`).click();
}

function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Auto-refresh dashboard every 30 seconds
setInterval(() => {
    const activeTab = document.querySelector('.tab-button.active').dataset.tab;
    if (activeTab === 'dashboard') {
        loadDashboard();
    } else if (activeTab === 'scanner') {
        loadActiveScans();
    }
}, 30000);
