/**
 * WireGuard Manager Service
 * Manages WireGuard VPN server and client configurations
 */

const { execSync, exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class WireGuardManager {
  constructor(core) {
    this.core = core;
    this.logger = core.getService('logger');
    this.platform = core.getService('platform');
    
    this.config = {
      interface: 'wg0',
      port: 51820,
      address: '10.8.0.1/24',
      configPath: '/etc/wireguard',
      serverConfigFile: '/etc/wireguard/wg0.conf'
    };
    
    this.clients = new Map();
    this.nextClientIP = 2; // Start from 10.8.0.2
  }

  /**
   * Check if WireGuard is installed
   */
  async isInstalled() {
    try {
      execSync('which wg', { stdio: 'pipe' });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if WireGuard is running
   */
  async isRunning() {
    try {
      const output = execSync('wg show', { encoding: 'utf8', stdio: 'pipe' });
      return output.includes(this.config.interface);
    } catch (error) {
      return false;
    }
  }

  /**
   * Get WireGuard status
   */
  async getStatus() {
    try {
      const installed = await this.isInstalled();
      const running = await this.isRunning();
      
      let serverPublicKey = null;
      let peers = [];
      
      if (running) {
        try {
          const output = execSync(`wg show ${this.config.interface}`, { encoding: 'utf8' });
          
          // Parse server public key
          const keyMatch = output.match(/public key: ([A-Za-z0-9+/=]+)/);
          if (keyMatch) {
            serverPublicKey = keyMatch[1];
          }
          
          // Parse peer information
          const peerBlocks = output.split('\n\npeer:');
          for (let i = 1; i < peerBlocks.length; i++) {
            const block = peerBlocks[i];
            const pubKeyMatch = block.match(/^([A-Za-z0-9+/=]+)/);
            const endpointMatch = block.match(/endpoint: ([^\n]+)/);
            const latestMatch = block.match(/latest handshake: ([^\n]+)/);
            const transferMatch = block.match(/transfer: ([\d.]+\s+\w+) received, ([\d.]+\s+\w+) sent/);
            
            if (pubKeyMatch) {
              peers.push({
                publicKey: pubKeyMatch[1],
                endpoint: endpointMatch ? endpointMatch[1] : 'N/A',
                lastHandshake: latestMatch ? latestMatch[1] : 'Never',
                received: transferMatch ? transferMatch[1] : '0 B',
                sent: transferMatch ? transferMatch[2] : '0 B'
              });
            }
          }
        } catch (error) {
          this.logger?.error(`Error getting WireGuard details: ${error.message}`);
        }
      }
      
      return {
        installed,
        running,
        interface: this.config.interface,
        port: this.config.port,
        address: this.config.address,
        serverPublicKey,
        peerCount: peers.length,
        peers,
        version: installed ? this.getVersion() : null
      };
    } catch (error) {
      this.logger?.error(`Error getting WireGuard status: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get WireGuard version
   */
  getVersion() {
    try {
      const output = execSync('wg --version', { encoding: 'utf8' });
      return output.trim();
    } catch (error) {
      return 'Unknown';
    }
  }

  /**
   * Generate key pair
   */
  async generateKeyPair() {
    try {
      const privateKey = execSync('wg genkey', { encoding: 'utf8' }).trim();
      const publicKey = execSync(`echo "${privateKey}" | wg pubkey`, { encoding: 'utf8' }).trim();
      
      return { privateKey, publicKey };
    } catch (error) {
      this.logger?.error(`Error generating key pair: ${error.message}`);
      throw new Error('Failed to generate WireGuard keys');
    }
  }

  /**
   * Generate preshared key
   */
  async generatePresharedKey() {
    try {
      const psk = execSync('wg genpsk', { encoding: 'utf8' }).trim();
      return psk;
    } catch (error) {
      this.logger?.error(`Error generating PSK: ${error.message}`);
      return null;
    }
  }

  /**
   * Create server configuration
   */
  async createServerConfig(serverKeys) {
    const config = `[Interface]
# Server configuration for WireGuard
Address = ${this.config.address}
ListenPort = ${this.config.port}
PrivateKey = ${serverKeys.privateKey}

# Forwarding and NAT rules
PostUp = iptables -A FORWARD -i ${this.config.interface} -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i ${this.config.interface} -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE

# DNS (optional)
# DNS = 1.1.1.1, 8.8.8.8
`;

    return config;
  }

  /**
   * Add client peer to server config
   */
  async addPeerToServer(clientPublicKey, clientAddress, presharedKey = null) {
    try {
      let peerConfig = `\n# Client peer
[Peer]
PublicKey = ${clientPublicKey}
AllowedIPs = ${clientAddress}/32
`;

      if (presharedKey) {
        peerConfig += `PresharedKey = ${presharedKey}\n`;
      }

      // Append to server config file
      await fs.appendFile(this.config.serverConfigFile, peerConfig);
      
      this.logger?.info(`Added peer to WireGuard config: ${clientAddress}`);
      return true;
    } catch (error) {
      this.logger?.error(`Error adding peer to server: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate client configuration
   */
  async generateClientConfig(clientName, serverEndpoint) {
    try {
      // Generate keys for client
      const clientKeys = await this.generateKeyPair();
      const presharedKey = await this.generatePresharedKey();
      
      // Assign IP address
      const clientIP = `10.8.0.${this.nextClientIP}`;
      this.nextClientIP++;
      
      // Get server public key
      const status = await this.getStatus();
      if (!status.serverPublicKey) {
        throw new Error('Server public key not available. Is WireGuard running?');
      }
      
      // Create client config
      const clientConfig = `[Interface]
# Client configuration: ${clientName}
PrivateKey = ${clientKeys.privateKey}
Address = ${clientIP}/32
DNS = 1.1.1.1, 8.8.8.8

[Peer]
# Server
PublicKey = ${status.serverPublicKey}
PresharedKey = ${presharedKey}
Endpoint = ${serverEndpoint}:${this.config.port}
AllowedIPs = 0.0.0.0/0, ::/0
PersistentKeepalive = 25
`;

      // Store client info
      const clientInfo = {
        name: clientName,
        publicKey: clientKeys.publicKey,
        privateKey: clientKeys.privateKey,
        presharedKey,
        address: clientIP,
        config: clientConfig,
        createdAt: new Date().toISOString(),
        enabled: true
      };
      
      this.clients.set(clientName, clientInfo);
      
      // Add peer to server config
      await this.addPeerToServer(clientKeys.publicKey, clientIP, presharedKey);
      
      this.logger?.info(`Generated WireGuard config for client: ${clientName}`);
      
      return clientInfo;
    } catch (error) {
      this.logger?.error(`Error generating client config: ${error.message}`);
      throw error;
    }
  }

  /**
   * Start WireGuard
   */
  async start() {
    try {
      execSync(`wg-quick up ${this.config.interface}`, { stdio: 'pipe' });
      this.logger?.info('WireGuard started successfully');
      return { success: true, message: 'WireGuard started' };
    } catch (error) {
      this.logger?.error(`Error starting WireGuard: ${error.message}`);
      throw new Error('Failed to start WireGuard');
    }
  }

  /**
   * Stop WireGuard
   */
  async stop() {
    try {
      execSync(`wg-quick down ${this.config.interface}`, { stdio: 'pipe' });
      this.logger?.info('WireGuard stopped successfully');
      return { success: true, message: 'WireGuard stopped' };
    } catch (error) {
      this.logger?.error(`Error stopping WireGuard: ${error.message}`);
      throw new Error('Failed to stop WireGuard');
    }
  }

  /**
   * Restart WireGuard
   */
  async restart() {
    try {
      await this.stop();
      await new Promise(resolve => setTimeout(resolve, 1000));
      await this.start();
      return { success: true, message: 'WireGuard restarted' };
    } catch (error) {
      this.logger?.error(`Error restarting WireGuard: ${error.message}`);
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
        address: info.address,
        publicKey: info.publicKey,
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
    
    // Remove from clients map
    this.clients.delete(clientName);
    
    this.logger?.info(`Removed WireGuard client: ${clientName}`);
    return { success: true, message: 'Client removed' };
  }

  /**
   * Get statistics
   */
  async getStatistics() {
    try {
      const status = await this.getStatus();
      
      // Calculate total traffic
      let totalReceived = 0;
      let totalSent = 0;
      
      for (const peer of status.peers) {
        // Parse traffic (simplified - would need proper parsing in production)
        totalReceived += 1; // Placeholder
        totalSent += 1; // Placeholder
      }
      
      return {
        interface: this.config.interface,
        running: status.running,
        totalClients: this.clients.size,
        connectedPeers: status.peerCount,
        totalReceived: `${totalReceived} MB`,
        totalSent: `${totalSent} MB`,
        uptime: 'N/A' // Would need to track start time
      };
    } catch (error) {
      this.logger?.error(`Error getting statistics: ${error.message}`);
      throw error;
    }
  }
}

module.exports = WireGuardManager;
