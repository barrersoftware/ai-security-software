/**
 * VPN Monitor Service
 * Monitors VPN connections, traffic, and health
 */

class VPNMonitor {
  constructor(core) {
    this.core = core;
    this.logger = core.getService('logger');
    this.startTime = Date.now();
    
    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      bytesReceived: 0,
      bytesSent: 0,
      errors: 0,
      lastUpdate: new Date().toISOString()
    };
    
    this.connectionHistory = [];
    this.maxHistorySize = 1000;
  }

  /**
   * Get overall VPN status
   */
  async getOverallStatus(wireguardManager, openvpnManager) {
    try {
      const wgStatus = await wireguardManager.getStatus();
      const ovpnStatus = await openvpnManager.getStatus();
      
      return {
        timestamp: new Date().toISOString(),
        uptime: this.getUptime(),
        wireguard: {
          installed: wgStatus.installed,
          running: wgStatus.running,
          connectedPeers: wgStatus.peerCount,
          totalClients: wgStatus.peers?.length || 0
        },
        openvpn: {
          installed: ovpnStatus.installed,
          running: ovpnStatus.running,
          connectedClients: ovpnStatus.connectedClients,
          totalClients: ovpnStatus.totalClients
        },
        summary: {
          totalVPNs: 2,
          runningVPNs: (wgStatus.running ? 1 : 0) + (ovpnStatus.running ? 1 : 0),
          totalConnections: (wgStatus.peerCount || 0) + (ovpnStatus.connectedClients || 0),
          healthy: wgStatus.installed || ovpnStatus.installed
        }
      };
    } catch (error) {
      this.logger?.error(`Error getting overall status: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get traffic statistics
   */
  async getTrafficStats() {
    return {
      timestamp: new Date().toISOString(),
      bytesReceived: this.metrics.bytesReceived,
      bytesSent: this.metrics.bytesSent,
      totalTransfer: this.metrics.bytesReceived + this.metrics.bytesSent,
      activeConnections: this.metrics.activeConnections,
      totalConnections: this.metrics.totalConnections,
      errors: this.metrics.errors
    };
  }

  /**
   * Get connection history
   */
  async getConnectionHistory(limit = 50) {
    const history = this.connectionHistory.slice(-limit);
    return {
      count: history.length,
      connections: history
    };
  }

  /**
   * Record connection event
   */
  recordConnection(type, clientId, action, details = {}) {
    const event = {
      timestamp: new Date().toISOString(),
      type, // 'wireguard' or 'openvpn'
      clientId,
      action, // 'connected', 'disconnected', 'error'
      details
    };
    
    this.connectionHistory.push(event);
    
    // Trim history if too large
    if (this.connectionHistory.length > this.maxHistorySize) {
      this.connectionHistory = this.connectionHistory.slice(-this.maxHistorySize);
    }
    
    // Update metrics
    if (action === 'connected') {
      this.metrics.activeConnections++;
      this.metrics.totalConnections++;
    } else if (action === 'disconnected') {
      this.metrics.activeConnections = Math.max(0, this.metrics.activeConnections - 1);
    } else if (action === 'error') {
      this.metrics.errors++;
    }
    
    this.metrics.lastUpdate = new Date().toISOString();
  }

  /**
   * Get health check
   */
  async getHealthCheck(wireguardManager, openvpnManager) {
    try {
      const wgStatus = await wireguardManager.getStatus();
      const ovpnStatus = await openvpnManager.getStatus();
      
      const issues = [];
      
      // Check installations
      if (!wgStatus.installed && !ovpnStatus.installed) {
        issues.push({
          severity: 'critical',
          message: 'No VPN software installed',
          recommendation: 'Install WireGuard or OpenVPN'
        });
      }
      
      // Check running status
      if (wgStatus.installed && !wgStatus.running) {
        issues.push({
          severity: 'warning',
          message: 'WireGuard installed but not running',
          recommendation: 'Start WireGuard service'
        });
      }
      
      if (ovpnStatus.installed && !ovpnStatus.running) {
        issues.push({
          severity: 'warning',
          message: 'OpenVPN installed but not running',
          recommendation: 'Start OpenVPN service'
        });
      }
      
      // Determine overall health
      let health = 'healthy';
      if (issues.some(i => i.severity === 'critical')) {
        health = 'critical';
      } else if (issues.some(i => i.severity === 'warning')) {
        health = 'warning';
      }
      
      return {
        health,
        timestamp: new Date().toISOString(),
        uptime: this.getUptime(),
        issues,
        recommendations: issues.map(i => i.recommendation)
      };
    } catch (error) {
      this.logger?.error(`Error performing health check: ${error.message}`);
      return {
        health: 'error',
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  /**
   * Get uptime
   */
  getUptime() {
    const uptimeMs = Date.now() - this.startTime;
    const seconds = Math.floor(uptimeMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    return {
      milliseconds: uptimeMs,
      seconds,
      formatted: `${days}d ${hours % 24}h ${minutes % 60}m ${seconds % 60}s`
    };
  }

  /**
   * Update traffic metrics
   */
  updateTraffic(received, sent) {
    this.metrics.bytesReceived += received;
    this.metrics.bytesSent += sent;
    this.metrics.lastUpdate = new Date().toISOString();
  }
}

module.exports = VPNMonitor;
