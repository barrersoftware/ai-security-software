/**
 * Multi-Server Plugin - Connection Manager Service
 * Handles SSH connections and testing
 */

const { spawn } = require('child_process');
const { logger } = require('../../shared/logger');
const path = require('path');
const os = require('os');

class ConnectionManager {
  constructor() {
    this.logger = logger;
    this.activeConnections = new Map();
  }

  /**
   * Test SSH connection to a server
   */
  async testConnection(server, timeout = 10000) {
    this.logger.info(`[ConnectionManager] Testing connection to ${server.host}`);

    return new Promise((resolve) => {
      const startTime = Date.now();
      
      // Build SSH command
      const args = [
        '-o', 'ConnectTimeout=10',
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'BatchMode=yes',
        '-p', server.port.toString(),
      ];

      // Add SSH key if specified
      if (server.ssh_key_path) {
        const keyPath = server.ssh_key_path.replace('~', os.homedir());
        args.push('-i', keyPath);
      }

      args.push(`${server.username}@${server.host}`, 'echo', 'ok');

      const ssh = spawn('ssh', args);
      let output = '';
      let error = '';

      ssh.stdout.on('data', (data) => {
        output += data.toString();
      });

      ssh.stderr.on('data', (data) => {
        error += data.toString();
      });

      // Timeout handler
      const timeoutId = setTimeout(() => {
        ssh.kill('SIGTERM');
        resolve({
          success: false,
          error: 'Connection timeout',
          duration: Date.now() - startTime
        });
      }, timeout);

      ssh.on('close', (code) => {
        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;

        if (code === 0 && output.trim() === 'ok') {
          this.logger.info(`[ConnectionManager] ✅ Connected to ${server.host} (${duration}ms)`);
          resolve({
            success: true,
            duration,
            output: output.trim()
          });
        } else {
          this.logger.warn(`[ConnectionManager] ❌ Failed to connect to ${server.host}: ${error}`);
          resolve({
            success: false,
            error: error || 'Connection failed',
            exitCode: code,
            duration
          });
        }
      });

      ssh.on('error', (err) => {
        clearTimeout(timeoutId);
        this.logger.error(`[ConnectionManager] Connection error to ${server.host}:`, err);
        resolve({
          success: false,
          error: err.message,
          duration: Date.now() - startTime
        });
      });
    });
  }

  /**
   * Execute command on remote server via SSH
   */
  async executeRemoteCommand(server, command, timeout = 30000) {
    this.logger.info(`[ConnectionManager] Executing on ${server.host}: ${command}`);

    return new Promise((resolve) => {
      const startTime = Date.now();

      // Build SSH command
      const args = [
        '-o', 'ConnectTimeout=10',
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'BatchMode=yes',
        '-p', server.port.toString(),
      ];

      if (server.ssh_key_path) {
        const keyPath = server.ssh_key_path.replace('~', os.homedir());
        args.push('-i', keyPath);
      }

      args.push(`${server.username}@${server.host}`, command);

      const ssh = spawn('ssh', args);
      let stdout = '';
      let stderr = '';

      ssh.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      ssh.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      const timeoutId = setTimeout(() => {
        ssh.kill('SIGTERM');
        resolve({
          success: false,
          error: 'Command timeout',
          duration: Date.now() - startTime
        });
      }, timeout);

      ssh.on('close', (code) => {
        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;

        resolve({
          success: code === 0,
          exitCode: code,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          duration
        });
      });

      ssh.on('error', (err) => {
        clearTimeout(timeoutId);
        resolve({
          success: false,
          error: err.message,
          duration: Date.now() - startTime
        });
      });
    });
  }

  /**
   * Copy file to remote server
   */
  async copyToServer(server, localPath, remotePath) {
    this.logger.info(`[ConnectionManager] Copying ${localPath} to ${server.host}:${remotePath}`);

    return new Promise((resolve) => {
      const args = [
        '-o', 'ConnectTimeout=10',
        '-o', 'StrictHostKeyChecking=no',
        '-P', server.port.toString(),
      ];

      if (server.ssh_key_path) {
        const keyPath = server.ssh_key_path.replace('~', os.homedir());
        args.push('-i', keyPath);
      }

      args.push(localPath, `${server.username}@${server.host}:${remotePath}`);

      const scp = spawn('scp', args);
      let error = '';

      scp.stderr.on('data', (data) => {
        error += data.toString();
      });

      scp.on('close', (code) => {
        if (code === 0) {
          this.logger.info(`[ConnectionManager] ✅ Copied to ${server.host}`);
          resolve({ success: true });
        } else {
          this.logger.error(`[ConnectionManager] ❌ Failed to copy to ${server.host}: ${error}`);
          resolve({ success: false, error });
        }
      });

      scp.on('error', (err) => {
        resolve({ success: false, error: err.message });
      });
    });
  }

  /**
   * Copy file from remote server
   */
  async copyFromServer(server, remotePath, localPath) {
    this.logger.info(`[ConnectionManager] Copying ${server.host}:${remotePath} to ${localPath}`);

    return new Promise((resolve) => {
      const args = [
        '-o', 'ConnectTimeout=10',
        '-o', 'StrictHostKeyChecking=no',
        '-P', server.port.toString(),
      ];

      if (server.ssh_key_path) {
        const keyPath = server.ssh_key_path.replace('~', os.homedir());
        args.push('-i', keyPath);
      }

      args.push(`${server.username}@${server.host}:${remotePath}`, localPath);

      const scp = spawn('scp', args);
      let error = '';

      scp.stderr.on('data', (data) => {
        error += data.toString();
      });

      scp.on('close', (code) => {
        if (code === 0) {
          this.logger.info(`[ConnectionManager] ✅ Copied from ${server.host}`);
          resolve({ success: true });
        } else {
          this.logger.error(`[ConnectionManager] ❌ Failed to copy from ${server.host}: ${error}`);
          resolve({ success: false, error });
        }
      });

      scp.on('error', (err) => {
        resolve({ success: false, error: err.message });
      });
    });
  }

  /**
   * Get server information
   */
  async getServerInfo(server) {
    const commands = {
      hostname: 'hostname',
      os: 'uname -s',
      kernel: 'uname -r',
      arch: 'uname -m',
      uptime: 'uptime -p || uptime',
      memory: 'free -h | grep Mem | awk \'{print $2}\'',
      cpu: 'nproc',
      disk: 'df -h / | tail -1 | awk \'{print $2}\''
    };

    const info = {};

    for (const [key, command] of Object.entries(commands)) {
      const result = await this.executeRemoteCommand(server, command, 5000);
      if (result.success) {
        info[key] = result.stdout;
      }
    }

    return info;
  }

  /**
   * Check if SSH is available on the system
   */
  static checkSSHAvailable() {
    return new Promise((resolve) => {
      const check = spawn('which', ['ssh']);
      check.on('close', (code) => {
        resolve(code === 0);
      });
      check.on('error', () => {
        resolve(false);
      });
    });
  }
}

module.exports = ConnectionManager;
