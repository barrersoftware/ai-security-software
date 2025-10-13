/**
 * Backup Service
 * Handles local and remote backup operations with SFTP support
 */

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const archiver = require('archiver');
const { createWriteStream } = require('fs');

const execAsync = promisify(exec);

class BackupService {
  constructor(core) {
    this.core = core;
    this.logger = core.getService('logger');
    this.config = core.getConfig('storage') || {};
    this.encryption = core.getService('encryption-service');
    
    // Backup directories
    this.backupDir = path.join(process.cwd(), this.config.backupDir || 'data/backups');
    this.reportsDir = path.join(process.cwd(), this.config.reportsDir || 'data/reports');
    this.configDir = path.join(process.cwd(), this.config.configDir || 'data/config');
    
    // Backup metadata
    this.backups = [];
    this.sftpClients = new Map();
  }
  
  async init() {
    // Create backup directories
    await fs.mkdir(this.backupDir, { recursive: true });
    await fs.mkdir(this.reportsDir, { recursive: true });
    await fs.mkdir(this.configDir, { recursive: true });
    
    // Load backup metadata
    await this.loadBackupMetadata();
    
    if (this.logger) {
      this.logger.info('Backup service initialized');
      this.logger.info(`Local backup directory: ${this.backupDir}`);
      
      // Initialize SFTP if enabled
      if (this.config.enableSFTP && this.config.sftpHosts?.length > 0) {
        this.logger.info(`SFTP backup enabled for ${this.config.sftpHosts.length} host(s)`);
      }
    }
  }
  
  /**
   * Create a backup of all data
   */
  async createBackup(options = {}) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = options.name || `backup-${timestamp}`;
    const backupPath = path.join(this.backupDir, `${backupName}.tar.gz`);
    
    try {
      this.logger.info(`Creating backup: ${backupName}`);
      
      // Create tar.gz archive
      await this.createArchive(backupPath, [
        { path: 'data/users.json', name: 'users.json' },
        { path: 'data/sessions.json', name: 'sessions.json' },
        { path: 'data/mfa.json', name: 'mfa.json' },
        { path: 'data/ids.json', name: 'ids.json' },
        { path: this.reportsDir, name: 'reports' },
        { path: this.configDir, name: 'config' }
      ]);
      
      // Get backup size
      const stats = await fs.stat(backupPath);
      const backupSize = stats.size;
      
      // Calculate checksum for verification
      const checksum = await this.calculateChecksum(backupPath);
      
      // Encrypt backup if encryption service available
      let encryptedPath = null;
      if (this.encryption && options.encrypt) {
        encryptedPath = await this.encryptBackup(backupPath);
      }
      
      // Create backup metadata
      const backup = {
        id: this.generateId(),
        name: backupName,
        path: backupPath,
        encryptedPath,
        size: backupSize,
        checksum,
        created: new Date().toISOString(),
        type: options.type || 'manual',
        encrypted: !!encryptedPath,
        verified: false,
        remote: []
      };
      
      this.backups.push(backup);
      await this.saveBackupMetadata();
      
      this.logger.info(`Backup created: ${backupName} (${this.formatBytes(backupSize)})`);
      
      // Upload to remote SFTP servers if configured
      if (this.config.enableSFTP && this.config.sftpHosts?.length > 0) {
        await this.uploadToRemote(backup);
      }
      
      // Apply retention policy
      await this.applyRetentionPolicy();
      
      return backup;
    } catch (err) {
      this.logger.error('Backup creation failed:', err);
      throw err;
    }
  }
  
  /**
   * Create tar.gz archive
   */
  async createArchive(outputPath, sources) {
    return new Promise((resolve, reject) => {
      const output = createWriteStream(outputPath);
      const archive = archiver('tar', {
        gzip: true,
        gzipOptions: { level: 9 }
      });
      
      output.on('close', () => resolve());
      archive.on('error', reject);
      
      archive.pipe(output);
      
      // Add sources to archive
      for (const source of sources) {
        const sourcePath = path.isAbsolute(source.path) 
          ? source.path 
          : path.join(process.cwd(), source.path);
        
        fs.access(sourcePath).then(() => {
          fs.stat(sourcePath).then(stats => {
            if (stats.isDirectory()) {
              archive.directory(sourcePath, source.name);
            } else {
              archive.file(sourcePath, { name: source.name });
            }
          }).catch(() => {
            // Skip if file doesn't exist
          });
        }).catch(() => {
          // Skip if file doesn't exist
        });
      }
      
      archive.finalize();
    });
  }
  
  /**
   * Calculate SHA-256 checksum
   */
  async calculateChecksum(filePath) {
    const { stdout } = await execAsync(`sha256sum "${filePath}" | awk '{print $1}'`);
    return stdout.trim();
  }
  
  /**
   * Encrypt backup file
   */
  async encryptBackup(backupPath) {
    if (!this.encryption) return null;
    
    const encryptedPath = `${backupPath}.enc`;
    const data = await fs.readFile(backupPath);
    const encrypted = this.encryption.encrypt(data.toString('base64'));
    
    await fs.writeFile(encryptedPath, JSON.stringify(encrypted));
    
    this.logger.info('Backup encrypted');
    return encryptedPath;
  }
  
  /**
   * Upload backup to remote SFTP servers
   */
  async uploadToRemote(backup) {
    const uploadPromises = this.config.sftpHosts.map(async (host) => {
      try {
        this.logger.info(`Uploading to SFTP: ${host.host}`);
        
        const filePath = backup.encrypted ? backup.encryptedPath : backup.path;
        const remoteFile = path.basename(filePath);
        const remotePath = `${host.path || '/backups'}/${remoteFile}`;
        
        // Use scp for upload (simpler than SFTP library)
        const scpCommand = `scp -P ${host.port || 22} -o StrictHostKeyChecking=no "${filePath}" ${host.username}@${host.host}:${remotePath}`;
        
        if (host.keyFile) {
          await execAsync(`${scpCommand} -i ${host.keyFile}`);
        } else if (host.password) {
          // For password auth, use sshpass if available
          await execAsync(`sshpass -p "${host.password}" ${scpCommand}`);
        } else {
          await execAsync(scpCommand);
        }
        
        backup.remote.push({
          host: host.host,
          path: remotePath,
          uploaded: new Date().toISOString(),
          verified: false
        });
        
        this.logger.info(`Uploaded to ${host.host}: ${remotePath}`);
        
        // Verify remote backup
        await this.verifyRemoteBackup(host, remotePath, backup.checksum);
        
      } catch (err) {
        this.logger.error(`Failed to upload to ${host.host}:`, err.message);
        // Don't throw - continue with other hosts
      }
    });
    
    await Promise.allSettled(uploadPromises);
    await this.saveBackupMetadata();
  }
  
  /**
   * Verify remote backup integrity
   */
  async verifyRemoteBackup(host, remotePath, expectedChecksum) {
    try {
      const checksumCmd = `ssh -p ${host.port || 22} ${host.username}@${host.host} "sha256sum ${remotePath} | awk '{print \\$1}'"`;
      
      let command = checksumCmd;
      if (host.keyFile) {
        command = `${checksumCmd} -i ${host.keyFile}`;
      } else if (host.password) {
        command = `sshpass -p "${host.password}" ${checksumCmd}`;
      }
      
      const { stdout } = await execAsync(command);
      const remoteChecksum = stdout.trim();
      
      if (remoteChecksum === expectedChecksum) {
        this.logger.info(`Remote backup verified: ${host.host}`);
        
        // Update backup metadata
        const backup = this.backups.find(b => b.checksum === expectedChecksum);
        if (backup) {
          const remote = backup.remote.find(r => r.host === host.host && r.path === remotePath);
          if (remote) {
            remote.verified = true;
            await this.saveBackupMetadata();
          }
        }
        
        return true;
      } else {
        this.logger.error(`Remote backup checksum mismatch: ${host.host}`);
        return false;
      }
    } catch (err) {
      this.logger.error(`Failed to verify remote backup on ${host.host}:`, err.message);
      return false;
    }
  }
  
  /**
   * Restore from backup
   */
  async restoreBackup(backupId) {
    const backup = this.backups.find(b => b.id === backupId);
    if (!backup) {
      throw new Error('Backup not found');
    }
    
    try {
      this.logger.info(`Restoring backup: ${backup.name}`);
      
      let restorePath = backup.path;
      
      // Decrypt if encrypted
      if (backup.encrypted && backup.encryptedPath) {
        restorePath = await this.decryptBackup(backup.encryptedPath);
      }
      
      // Verify checksum before restore
      const checksum = await this.calculateChecksum(restorePath);
      if (checksum !== backup.checksum) {
        throw new Error('Backup integrity check failed - checksum mismatch');
      }
      
      // Extract archive
      await execAsync(`tar -xzf "${restorePath}" -C "${process.cwd()}/data"`);
      
      this.logger.info('Backup restored successfully');
      
      return { success: true, backup };
    } catch (err) {
      this.logger.error('Restore failed:', err);
      throw err;
    }
  }
  
  /**
   * Decrypt backup file
   */
  async decryptBackup(encryptedPath) {
    if (!this.encryption) throw new Error('Encryption service not available');
    
    const encryptedData = JSON.parse(await fs.readFile(encryptedPath, 'utf8'));
    const decrypted = this.encryption.decrypt(
      encryptedData.data,
      encryptedData.iv,
      encryptedData.authTag
    );
    
    const decryptedPath = encryptedPath.replace('.enc', '.decrypted');
    await fs.writeFile(decryptedPath, Buffer.from(decrypted, 'base64'));
    
    return decryptedPath;
  }
  
  /**
   * Delete backup
   */
  async deleteBackup(backupId) {
    const index = this.backups.findIndex(b => b.id === backupId);
    if (index === -1) {
      throw new Error('Backup not found');
    }
    
    const backup = this.backups[index];
    
    try {
      // Delete local files
      await fs.unlink(backup.path).catch(() => {});
      if (backup.encryptedPath) {
        await fs.unlink(backup.encryptedPath).catch(() => {});
      }
      
      // Delete from remote servers
      if (backup.remote?.length > 0) {
        await this.deleteRemoteBackups(backup);
      }
      
      this.backups.splice(index, 1);
      await this.saveBackupMetadata();
      
      this.logger.info(`Backup deleted: ${backup.name}`);
    } catch (err) {
      this.logger.error('Delete backup failed:', err);
      throw err;
    }
  }
  
  /**
   * Delete backups from remote servers
   */
  async deleteRemoteBackups(backup) {
    for (const remote of backup.remote) {
      try {
        const host = this.config.sftpHosts.find(h => h.host === remote.host);
        if (!host) continue;
        
        const deleteCmd = `ssh -p ${host.port || 22} ${host.username}@${host.host} "rm -f ${remote.path}"`;
        
        let command = deleteCmd;
        if (host.keyFile) {
          command = `${deleteCmd} -i ${host.keyFile}`;
        } else if (host.password) {
          command = `sshpass -p "${host.password}" ${deleteCmd}`;
        }
        
        await execAsync(command);
        this.logger.info(`Deleted remote backup: ${remote.host}:${remote.path}`);
      } catch (err) {
        this.logger.error(`Failed to delete remote backup on ${remote.host}:`, err.message);
      }
    }
  }
  
  /**
   * Apply retention policy
   */
  async applyRetentionPolicy() {
    const maxBackups = this.config.maxBackups || 10;
    const retentionDays = this.config.retentionDays || 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    // Find backups to delete
    const toDelete = this.backups.filter((backup, index) => {
      // Keep most recent backups
      if (index < maxBackups) return false;
      
      // Delete backups older than retention period
      const backupDate = new Date(backup.created);
      return backupDate < cutoffDate;
    });
    
    for (const backup of toDelete) {
      try {
        await this.deleteBackup(backup.id);
        this.logger.info(`Retention policy: deleted old backup ${backup.name}`);
      } catch (err) {
        this.logger.error(`Failed to delete old backup ${backup.name}:`, err.message);
      }
    }
  }
  
  /**
   * List all backups
   */
  listBackups() {
    return this.backups.map(b => ({
      id: b.id,
      name: b.name,
      size: b.size,
      sizeFormatted: this.formatBytes(b.size),
      created: b.created,
      type: b.type,
      encrypted: b.encrypted,
      verified: b.verified,
      remote: b.remote.map(r => ({
        host: r.host,
        verified: r.verified,
        uploaded: r.uploaded
      }))
    }));
  }
  
  /**
   * Get backup status
   */
  getStatus() {
    const totalSize = this.backups.reduce((sum, b) => sum + b.size, 0);
    const remoteHosts = this.config.sftpHosts?.length || 0;
    const totalRemoteBackups = this.backups.reduce((sum, b) => sum + (b.remote?.length || 0), 0);
    
    return {
      totalBackups: this.backups.length,
      totalSize,
      totalSizeFormatted: this.formatBytes(totalSize),
      oldestBackup: this.backups[this.backups.length - 1]?.created,
      newestBackup: this.backups[0]?.created,
      remoteHosts,
      totalRemoteBackups,
      sftpEnabled: this.config.enableSFTP,
      retentionDays: this.config.retentionDays || 30,
      maxBackups: this.config.maxBackups || 10
    };
  }
  
  /**
   * Load backup metadata
   */
  async loadBackupMetadata() {
    const metadataPath = path.join(this.backupDir, 'metadata.json');
    try {
      const data = await fs.readFile(metadataPath, 'utf8');
      this.backups = JSON.parse(data);
      this.logger.info(`Loaded ${this.backups.length} backup(s) from metadata`);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        this.logger.error('Failed to load backup metadata:', err);
      }
      this.backups = [];
    }
  }
  
  /**
   * Save backup metadata
   */
  async saveBackupMetadata() {
    const metadataPath = path.join(this.backupDir, 'metadata.json');
    await fs.writeFile(metadataPath, JSON.stringify(this.backups, null, 2));
  }
  
  /**
   * Generate unique ID
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
  
  /**
   * Format bytes to human-readable string
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
  
  async cleanup() {
    this.sftpClients.clear();
  }
}

module.exports = BackupService;
