/**
 * API Client for AI Security Scanner
 * Provides methods to interact with all 18 plugins
 */

class APIClient {
    constructor(baseURL = '/api') {
        this.baseURL = baseURL;
        this.token = localStorage.getItem('token');
    }

    // Generic request method
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers
            });

            if (response.status === 401) {
                // Token expired or invalid
                this.handleUnauthorized();
                throw new Error('Unauthorized');
            }

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || `HTTP ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`API Error [${endpoint}]:`, error);
            throw error;
        }
    }

    handleUnauthorized() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login.html';
    }

    // HTTP convenience methods
    async get(endpoint, options = {}) {
        return await this.request(endpoint, {
            ...options,
            method: 'GET'
        });
    }

    async post(endpoint, data, options = {}) {
        return await this.request(endpoint, {
            ...options,
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async put(endpoint, data, options = {}) {
        return await this.request(endpoint, {
            ...options,
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    async delete(endpoint, options = {}) {
        return await this.request(endpoint, {
            ...options,
            method: 'DELETE'
        });
    }

    async patch(endpoint, data, options = {}) {
        return await this.request(endpoint, {
            ...options,
            method: 'PATCH',
            body: JSON.stringify(data)
        });
    }

    // ===== Authentication Plugin =====
    async login(username, password) {
        const response = await this.request('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        
        if (response.token) {
            this.token = response.token;
            localStorage.setItem('token', response.token);
            localStorage.setItem('user', JSON.stringify(response.user));
        }
        
        return response;
    }

    async logout() {
        await this.request('/api/auth/logout', { method: 'POST' });
        this.token = null;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    }

    async checkSession() {
        return await this.request('/api/auth/session');
    }

    // ===== Admin Plugin (User Management) =====
    async getUsers(params = {}) {
        const query = new URLSearchParams(params).toString();
        return await this.request(`/api/admin/users?${query}`);
    }

    async createUser(userData) {
        return await this.request('/api/admin/users', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    }

    async updateUser(userId, userData) {
        return await this.request(`/api/admin/users/${userId}`, {
            method: 'PUT',
            body: JSON.stringify(userData)
        });
    }

    async deleteUser(userId) {
        return await this.request(`/api/admin/users/${userId}`, {
            method: 'DELETE'
        });
    }

    async getUserStats() {
        return await this.request('/api/admin/users/stats');
    }

    // ===== Scanner Plugin =====
    async startScan(scanConfig) {
        return await this.request('/api/scanner/scan', {
            method: 'POST',
            body: JSON.stringify(scanConfig)
        });
    }

    async getScanStatus(scanId) {
        return await this.request(`/api/scanner/status/${scanId}`);
    }

    async getScans(params = {}) {
        const query = new URLSearchParams(params).toString();
        return await this.request(`/api/scanner/scans?${query}`);
    }

    // ===== Reporting Plugin =====
    async generateReport(reportData) {
        return await this.request('/api/reporting/generate', {
            method: 'POST',
            body: JSON.stringify(reportData)
        });
    }

    async getReports(params = {}) {
        const query = new URLSearchParams(params).toString();
        return await this.request(`/api/reporting/reports?${query}`);
    }

    async downloadReport(reportId, format = 'pdf') {
        window.open(`/api/reporting/reports/${reportId}/download?format=${format}`, '_blank');
    }

    // ===== Audit Log Plugin =====
    async getAuditLogs(params = {}) {
        const query = new URLSearchParams(params).toString();
        return await this.request(`/api/audit/logs?${query}`);
    }

    async generateComplianceReport(standard, params = {}) {
        const query = new URLSearchParams(params).toString();
        return await this.request(`/api/audit/compliance/${standard}?${query}`);
    }

    // ===== Tenants Plugin =====
    async getTenants() {
        return await this.request('/api/tenants');
    }

    async createTenant(tenantData) {
        return await this.request('/api/tenants', {
            method: 'POST',
            body: JSON.stringify(tenantData)
        });
    }

    async getTenantStats(tenantId) {
        return await this.request(`/api/tenants/${tenantId}/stats`);
    }

    // ===== Policies Plugin =====
    async getPolicies() {
        return await this.request('/api/policies');
    }

    async createPolicy(policyData) {
        return await this.request('/api/policies', {
            method: 'POST',
            body: JSON.stringify(policyData)
        });
    }

    async executePolicy(policyId) {
        return await this.request(`/api/policies/${policyId}/execute`, {
            method: 'POST'
        });
    }

    // ===== VPN Plugin =====
    async getVPNStatus() {
        return await this.request('/api/vpn/status');
    }

    async connectVPN(config) {
        return await this.request('/api/vpn/connect', {
            method: 'POST',
            body: JSON.stringify(config)
        });
    }

    async disconnectVPN() {
        return await this.request('/api/vpn/disconnect', {
            method: 'POST'
        });
    }

    // ===== Notifications Plugin =====
    async getNotifications(params = {}) {
        const query = new URLSearchParams(params).toString();
        return await this.request(`/api/notifications?${query}`);
    }

    async markNotificationRead(notificationId) {
        return await this.request(`/api/notifications/${notificationId}/read`, {
            method: 'PUT'
        });
    }

    async createAlert(alertData) {
        return await this.request('/api/notifications/alerts', {
            method: 'POST',
            body: JSON.stringify(alertData)
        });
    }

    // ===== Webhooks Plugin =====
    async getWebhooks() {
        return await this.request('/api/webhooks');
    }

    async createWebhook(webhookData) {
        return await this.request('/api/webhooks', {
            method: 'POST',
            body: JSON.stringify(webhookData)
        });
    }

    async testWebhook(webhookId) {
        return await this.request(`/api/webhooks/${webhookId}/test`, {
            method: 'POST'
        });
    }

    // ===== API Analytics Plugin =====
    async getAPIAnalytics(params = {}) {
        const query = new URLSearchParams(params).toString();
        return await this.request(`/api/analytics?${query}`);
    }

    async getAPIStats() {
        return await this.request('/api/analytics/stats');
    }

    // ===== System Info Plugin =====
    async getSystemInfo() {
        return await this.request('/api/system/info');
    }

    async getSystemHealth() {
        return await this.request('/api/system/health');
    }

    // ===== Storage Plugin =====
    async getStorageInfo() {
        return await this.request('/api/storage/info');
    }

    async uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);

        return await fetch(`${this.baseURL}/api/storage/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.token}`
            },
            body: formData
        }).then(r => r.json());
    }

    // ===== Backup & Recovery Plugin =====
    async createBackup(config) {
        return await this.request('/api/backup/create', {
            method: 'POST',
            body: JSON.stringify(config)
        });
    }

    async getBackups() {
        return await this.request('/api/backup/list');
    }

    async restoreBackup(backupId) {
        return await this.request(`/api/backup/${backupId}/restore`, {
            method: 'POST'
        });
    }

    // ===== Multi-Server Plugin =====
    async getServers() {
        return await this.request('/api/multi-server/servers');
    }

    async addServer(serverData) {
        return await this.request('/api/multi-server/servers', {
            method: 'POST',
            body: JSON.stringify(serverData)
        });
    }

    async scanServer(serverId) {
        return await this.request(`/api/multi-server/servers/${serverId}/scan`, {
            method: 'POST'
        });
    }

    // ===== Rate Limiting Plugin =====
    async getRateLimits() {
        return await this.request('/api/rate-limiting/limits');
    }

    async updateRateLimit(limitId, config) {
        return await this.request(`/api/rate-limiting/limits/${limitId}`, {
            method: 'PUT',
            body: JSON.stringify(config)
        });
    }

    // ===== Security Plugin =====
    async getSecurityConfig() {
        return await this.request('/api/security/config');
    }

    async updateSecurityConfig(config) {
        return await this.request('/api/security/config', {
            method: 'PUT',
            body: JSON.stringify(config)
        });
    }

    // ===== Update Plugin =====
    async checkForUpdates() {
        return await this.request('/api/update/check');
    }

    async installUpdate(version) {
        return await this.request('/api/update/install', {
            method: 'POST',
            body: JSON.stringify({ version })
        });
    }

    // ===== Generic Plugin Status =====
    async getPluginStatus(pluginName) {
        return await this.request(`/api/${pluginName}/status`);
    }

    async listPlugins() {
        return await this.request('/api/plugins');
    }
}

// Create global API client instance
const apiClient = new APIClient();
window.apiClient = apiClient;
window.api = apiClient; // Also keep 'api' for backwards compatibility
