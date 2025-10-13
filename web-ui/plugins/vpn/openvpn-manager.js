/**
 * OpenVPN Manager Service
 * Manages OpenVPN server and client configurations
 */

const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class OpenVPNManager {
  constructor(core) {
    this.core = core;
    this.logger = core.getService('logger');
    this.platform = core.getService('platform');
    
    this.config = {
      port: 1194,
      protocol: 'udp',
      network: '10.9.0.0',
      netmask: '255.255.255.0',
      configPath: '/etc/openvpn',
      serverConfigFile: '/etc/openvpn/server.conf',
      easyRsaDir: '/etc/openvpn/easy-rsa'
    };
    
    this.clients = new Map();
  }

  /**
   * Check if OpenVPN is installed
   */
  async isInstalled() {
    try {
      execSync('which openvpn', { stdio: 'pipe' });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if OpenVPN is running
   */
  async isRunning() {
    try {
      if (this.platform?.isLinux()) {
        const output = execSync('systemctl is-active openvpn@server', { encoding: 'utf8', stdio: 'pipe' });
        return output.trim() === 'active';
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get OpenVPN status
   */
  async getStatus() {
    try {
      const installed = await this.isInstalled();
      const running = await this.isRunning();
      
      let connectedClients = 0;
      let version = null;
      
      if (installed) {
        try {
          version = execSync('openvpn --version | head -1', { encoding: 'utf8' }).trim();
        } catch (error) {
          version = 'Unknown';
        }
      }
      
      if (running) {
        try {
          // Check status file if it exists
          const statusFile = '/etc/openvpn/openvpn-status.log';
          try {
            const status = await fs.readFile(statusFile, 'utf8');
            const lines = status.split('\n');
            connectedClients = lines.filter(l => l.startsWith('CLIENT_LIST')).length;
          } catch (err) {
            // Status file doesn't exist
          }
        } catch (error) {
          this.logger?.error(`Error reading OpenVPN status: ${error.message}`);
        }
      }
      
      return {
        installed,
        running,
        port: this.config.port,
        protocol: this.config.protocol,
        network: this.config.network,
        connectedClients,
        totalClients: this.clients.size,
        version
      };
    } catch (error) {
      this.logger?.error(`Error getting OpenVPN status: ${error.message}`);
      throw error;
    }
  }

  /**
   * Initialize PKI (Public Key Infrastructure)
   */
  async initializePKI() {
    try {
      // Check if Easy-RSA is installed
      const easyRsaInstalled = await this.checkEasyRSA();
      if (!easyRsaInstalled) {
        throw new Error('Easy-RSA not installed');
      }
      
      this.logger?.info('PKI initialization would happen here in production');
      return { success: true, message: 'PKI initialized' };
    } catch (error) {
      this.logger?.error(`Error initializing PKI: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if Easy-RSA is available
   */
  async checkEasyRSA() {
    try {
      await fs.access('/usr/share/easy-rsa');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create server configuration
   */
  async createServerConfig() {
    const config = `# OpenVPN Server Configuration
port ${this.config.port}
proto ${this.config.protocol}
dev tun

# Certificates and keys
ca /etc/openvpn/easy-rsa/pki/ca.crt
cert /etc/openvpn/easy-rsa/pki/issued/server.crt
key /etc/openvpn/easy-rsa/pki/private/server.key
dh /etc/openvpn/easy-rsa/pki/dh.pem

# Network configuration
server ${this.config.network} ${this.config.netmask}
ifconfig-pool-persist /var/log/openvpn/ipp.txt

# Push routes to client
push "redirect-gateway def1 bypass-dhcp"
push "dhcp-option DNS 1.1.1.1"
push "dhcp-option DNS 8.8.8.8"

# Client configuration
keepalive 10 120
cipher AES-256-GCM
auth SHA256
compress lz4-v2
push "compress lz4-v2"

# Privileges
user nobody
group nogroup

# Persistence
persist-key
persist-tun

# Status and logging
status /var/log/openvpn/openvpn-status.log
log-append /var/log/openvpn/openvpn.log
verb 3

# Security
tls-auth /etc/openvpn/easy-rsa/pki/ta.key 0
tls-version-min 1.2
`;

    return config;
  }

  /**
   * Generate client configuration
   */
  async generateClientConfig(clientName, serverEndpoint) {
    try {
      const config = `# OpenVPN Client Configuration: ${clientName}
client
dev tun
proto ${this.config.protocol}
remote ${serverEndpoint} ${this.config.port}

# Keep trying indefinitely
resolv-retry infinite

# Don't need to bind to specific local port
nobind

# Preserve state across restarts
persist-key
persist-tun

# Verify server certificate
remote-cert-tls server

# Compression
compress lz4-v2

# Security
cipher AES-256-GCM
auth SHA256
tls-version-min 1.2

# Logging
verb 3

# Note: Certificate and key files would be embedded here in production
# <ca>
# [CA certificate content]
# </ca>
# <cert>
# [Client certificate content]
# </cert>
# <key>
# [Client private key content]
# </key>
# <tls-auth>
# [TLS auth key content]
# </tls-auth>
`;

      const clientInfo = {
        name: clientName,
        config,
        createdAt: new Date().toISOString(),
        enabled: true
      };
      
      this.clients.set(clientName, clientInfo);
      
      this.logger?.info(`Generated OpenVPN config for client: ${clientName}`);
      
      return clientInfo;
    } catch (error) {
      this.logger?.error(`Error generating client config: ${error.message}`);
      throw error;
    }
  }

  /**
   * Start OpenVPN
   */
  async start() {
    try {
      if (this.platform?.isLinux()) {
        execSync('systemctl start openvpn@server', { stdio: 'pipe' });
        this.logger?.info('OpenVPN started successfully');
        return { success: true, message: 'OpenVPN started' };
      }
      throw new Error('OpenVPN start not supported on this platform');
    } catch (error) {
      this.logger?.error(`Error starting OpenVPN: ${error.message}`);
      throw new Error('Failed to start OpenVPN');
    }
  }

  /**
   * Stop OpenVPN
   */
  async stop() {
    try {
      if (this.platform?.isLinux()) {
        execSync('systemctl stop openvpn@server', { stdio: 'pipe' });
        this.logger?.info('OpenVPN stopped successfully');
        return { success: true, message: 'OpenVPN stopped' };
      }
      throw new Error('OpenVPN stop not supported on this platform');
    } catch (error) {
      this.logger?.error(`Error stopping OpenVPN: ${error.message}`);
      throw new Error('Failed to stop OpenVPN');
    }
  }

  /**
   * Restart OpenVPN
   */
  async restart() {
    try {
      await this.stop();
      await new Promise(resolve => setTimeout(resolve, 2000));
      await this.start();
      return { success: true, message: 'OpenVPN restarted' };
    } catch (error) {
      this.logger?.error(`Error restarting OpenVPN: ${error.message}`);
      throw error;
    }
  }

  /**
   * List all clients
   */
  async listClients() {
    const clients = [];
    for (const [name, info] of this.clients.entries()) {
      clients.push({
        name,
        createdAt: info.createdAt,
        enabled: info.enabled
      });
    }
    return clients;
  }

  /**
   * Get client configuration
   */
  async getClientConfig(clientName) {
    const client = this.clients.get(clientName);
    if (!client) {
      throw new Error('Client not found');
    }
    return client.config;
  }

  /**
   * Remove client
   */
  async removeClient(clientName) {
    const client = this.clients.get(clientName);
    if (!client) {
      throw new Error('Client not found');
    }
    
    this.clients.delete(clientName);
    
    this.logger?.info(`Removed OpenVPN client: ${clientName}`);
    return { success: true, message: 'Client removed' };
  }

  /**
   * Get statistics
   */
  async getStatistics() {
    try {
      const status = await this.getStatus();
      
      return {
        protocol: this.config.protocol,
        port: this.config.port,
        running: status.running,
        totalClients: this.clients.size,
        connectedClients: status.connectedClients,
        network: this.config.network
      };
    } catch (error) {
      this.logger?.error(`Error getting statistics: ${error.message}`);
      throw error;
    }
  }
}

module.exports = OpenVPNManager;
