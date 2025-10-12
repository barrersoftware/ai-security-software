/**
 * Backup and Restore Module
 * Automated backups and disaster recovery
 */

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const archiver = require('archiver');
const unzipper = require('unzipper');

const BACKUP_DIR = path.join(__dirname, 'backups');
const DATA_DIR = path.join(__dirname, 'data');

class BackupManager {
    constructor() {
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;

        // Create backup directory
        try {
            await fs.mkdir(BACKUP_DIR, { recursive: true });
        } catch (error) {
            // Directory already exists
        }

        this.initialized = true;
    }

    /**
     * Create a full backup
     * @returns {string} Backup filename
     */
    async createBackup() {
        await this.init();

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(BACKUP_DIR, `backup-${timestamp}.zip`);

        return new Promise((resolve, reject) => {
            const output = require('fs').createWriteStream(backupFile);
            const archive = archiver('zip', { zlib: { level: 9 } });

            output.on('close', () => {
                resolve(backupFile);
            });

            archive.on('error', (err) => {
                reject(err);
            });

            archive.pipe(output);

            // Add data directory
            archive.directory(DATA_DIR, 'data');

            // Add logs directory
            const logsDir = path.join(__dirname, 'logs');
            archive.directory(logsDir, 'logs');

            // Add configuration
            archive.file(path.join(__dirname, 'package.json'), { name: 'package.json' });

            // Add environment file if exists
            const envFile = path.join(__dirname, '.env');
            require('fs').access(envFile, require('fs').constants.F_OK, (err) => {
                if (!err) {
                    archive.file(envFile, { name: '.env' });
                }
                archive.finalize();
            });
        });
    }

    /**
     * Restore from backup
     * @param {string} backupFile - Path to backup file
     */
    async restoreBackup(backupFile) {
        await this.init();

        const tempDir = path.join(__dirname, 'temp_restore');

        try {
            // Extract backup to temp directory
            await fs.mkdir(tempDir, { recursive: true });

            await new Promise((resolve, reject) => {
                require('fs').createReadStream(backupFile)
                    .pipe(unzipper.Extract({ path: tempDir }))
                    .on('close', resolve)
                    .on('error', reject);
            });

            // Backup current data
            const currentBackup = await this.createBackup();
            console.log(`Current data backed up to: ${currentBackup}`);

            // Restore data directory
            const tempDataDir = path.join(tempDir, 'data');
            const files = await fs.readdir(tempDataDir);
            
            for (const file of files) {
                const srcFile = path.join(tempDataDir, file);
                const destFile = path.join(DATA_DIR, file);
                await fs.copyFile(srcFile, destFile);
            }

            // Restore environment if exists
            const tempEnvFile = path.join(tempDir, '.env');
            try {
                await fs.access(tempEnvFile);
                const destEnvFile = path.join(__dirname, '.env');
                await fs.copyFile(tempEnvFile, destEnvFile);
            } catch (error) {
                // No .env file in backup
            }

            // Clean up temp directory
            await this.rmdir(tempDir);

            return true;
        } catch (error) {
            // Clean up temp directory on error
            try {
                await this.rmdir(tempDir);
            } catch (e) {
                // Ignore cleanup errors
            }
            throw error;
        }
    }

    /**
     * List available backups
     * @returns {Array} List of backup files
     */
    async listBackups() {
        await this.init();

        try {
            const files = await fs.readdir(BACKUP_DIR);
            const backups = [];

            for (const file of files) {
                if (file.endsWith('.zip')) {
                    const filePath = path.join(BACKUP_DIR, file);
                    const stats = await fs.stat(filePath);
                    
                    backups.push({
                        filename: file,
                        path: filePath,
                        size: stats.size,
                        created: stats.mtime
                    });
                }
            }

            return backups.sort((a, b) => b.created - a.created);
        } catch (error) {
            return [];
        }
    }

    /**
     * Delete old backups (keep last N backups)
     * @param {number} keep - Number of backups to keep
     */
    async cleanupOldBackups(keep = 10) {
        await this.init();

        const backups = await this.listBackups();

        if (backups.length <= keep) {
            return { deleted: 0, kept: backups.length };
        }

        const toDelete = backups.slice(keep);
        let deleted = 0;

        for (const backup of toDelete) {
            try {
                await fs.unlink(backup.path);
                deleted++;
            } catch (error) {
                console.error(`Failed to delete backup ${backup.filename}:`, error);
            }
        }

        return { deleted, kept: backups.length - deleted };
    }

    /**
     * Schedule automated backups
     * @param {string} schedule - Cron schedule (e.g., '0 2 * * *' for daily at 2 AM)
     */
    async scheduleBackups(schedule = '0 2 * * *') {
        await this.init();

        const cronScript = `#!/bin/bash
# Automated backup script for AI Security Scanner
# Schedule: ${schedule}

cd ${__dirname}
node -e "require('./backup.js').createBackup().then(f => console.log('Backup created:', f)).catch(console.error)"
`;

        const scriptPath = path.join(__dirname, 'scripts', 'backup-cron.sh');
        await fs.writeFile(scriptPath, cronScript);
        await fs.chmod(scriptPath, '755');

        // Add to crontab
        try {
            const { stdout } = await execAsync('crontab -l 2>/dev/null || true');
            const existingCron = stdout.trim();
            
            if (!existingCron.includes('backup-cron.sh')) {
                const newCron = existingCron + `\n${schedule} ${scriptPath}\n`;
                await execAsync(`echo "${newCron}" | crontab -`);
                return { scheduled: true, schedule };
            }
            
            return { scheduled: false, message: 'Backup already scheduled' };
        } catch (error) {
            throw new Error('Failed to schedule backups: ' + error.message);
        }
    }

    /**
     * Export configuration for disaster recovery
     */
    async exportConfig() {
        await this.init();

        const config = {
            version: require('./package.json').version,
            exportDate: new Date().toISOString(),
            environment: {
                nodeVersion: process.version,
                platform: process.platform
            }
        };

        // Add environment variables (sanitized)
        const envFile = path.join(__dirname, '.env');
        try {
            const envContent = await fs.readFile(envFile, 'utf8');
            const envVars = envContent.split('\n')
                .filter(line => line.trim() && !line.startsWith('#'))
                .map(line => {
                    const [key] = line.split('=');
                    return key.trim();
                });
            
            config.environmentVariables = envVars;
        } catch (error) {
            config.environmentVariables = [];
        }

        return config;
    }

    /**
     * Recursively remove directory
     */
    async rmdir(dir) {
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                
                if (entry.isDirectory()) {
                    await this.rmdir(fullPath);
                } else {
                    await fs.unlink(fullPath);
                }
            }
            
            await fs.rmdir(dir);
        } catch (error) {
            // Ignore errors
        }
    }
}

module.exports = new BackupManager();
