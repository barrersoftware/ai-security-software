/**
 * Admin Routes - Backup, Restore, Audit Logs
 */

const express = require('express');
const router = express.Router();
const auth = require('../auth');
const backup = require('../backup');
const security = require('../security');
const path = require('path');

// Create backup
router.post('/backup/create', auth.requireAuth, auth.requireAdmin, async (req, res) => {
    try {
        const backupFile = await backup.createBackup();
        
        await security.logUserAction('BACKUP_CREATED', req.user.userId, req.user.username, {
            backupFile: path.basename(backupFile),
            ip: req.ip
        });
        
        res.json({ 
            success: true, 
            backupFile: path.basename(backupFile),
            message: 'Backup created successfully'
        });
    } catch (error) {
        await security.logApp('error', 'Backup creation failed', { error: error.message });
        res.status(500).json({ error: 'Failed to create backup' });
    }
});

// List backups
router.get('/backup/list', auth.requireAuth, auth.requireAdmin, async (req, res) => {
    try {
        const backups = await backup.listBackups();
        res.json({ backups });
    } catch (error) {
        await security.logApp('error', 'List backups failed', { error: error.message });
        res.status(500).json({ error: 'Failed to list backups' });
    }
});

// Download backup
router.get('/backup/download/:filename', auth.requireAuth, auth.requireAdmin, async (req, res) => {
    try {
        const { filename } = req.params;
        const backupPath = path.join(__dirname, '../backups', filename);
        
        await security.logUserAction('BACKUP_DOWNLOADED', req.user.userId, req.user.username, {
            backupFile: filename,
            ip: req.ip
        });
        
        res.download(backupPath, filename);
    } catch (error) {
        await security.logApp('error', 'Backup download failed', { error: error.message });
        res.status(500).json({ error: 'Failed to download backup' });
    }
});

// Restore backup
router.post('/backup/restore', auth.requireAuth, auth.requireAdmin, async (req, res) => {
    try {
        const { filename } = req.body;
        const backupPath = path.join(__dirname, '../backups', filename);
        
        await backup.restoreBackup(backupPath);
        
        await security.logUserAction('BACKUP_RESTORED', req.user.userId, req.user.username, {
            backupFile: filename,
            ip: req.ip
        });
        
        res.json({ 
            success: true, 
            message: 'Backup restored successfully. Please restart the server.' 
        });
    } catch (error) {
        await security.logApp('error', 'Backup restore failed', { error: error.message });
        res.status(500).json({ error: 'Failed to restore backup: ' + error.message });
    }
});

// Cleanup old backups
router.post('/backup/cleanup', auth.requireAuth, auth.requireAdmin, async (req, res) => {
    try {
        const { keep = 10 } = req.body;
        const result = await backup.cleanupOldBackups(keep);
        
        await security.logUserAction('BACKUP_CLEANUP', req.user.userId, req.user.username, {
            deleted: result.deleted,
            kept: result.kept,
            ip: req.ip
        });
        
        res.json({ 
            success: true, 
            ...result,
            message: `Cleaned up ${result.deleted} old backups` 
        });
    } catch (error) {
        await security.logApp('error', 'Backup cleanup failed', { error: error.message });
        res.status(500).json({ error: 'Failed to cleanup backups' });
    }
});

// Schedule automated backups
router.post('/backup/schedule', auth.requireAuth, auth.requireAdmin, async (req, res) => {
    try {
        const { schedule = '0 2 * * *' } = req.body;
        const result = await backup.scheduleBackups(schedule);
        
        await security.logUserAction('BACKUP_SCHEDULED', req.user.userId, req.user.username, {
            schedule: schedule,
            ip: req.ip
        });
        
        res.json({ 
            success: true, 
            ...result,
            message: 'Backup schedule configured' 
        });
    } catch (error) {
        await security.logApp('error', 'Backup schedule failed', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// Get audit logs
router.get('/audit/logs', auth.requireAuth, auth.requireAdmin, async (req, res) => {
    try {
        const { startDate, endDate, limit = 100 } = req.query;
        
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;
        
        const events = await security.generateAuditReport(start, end);
        const limitedEvents = events.slice(0, parseInt(limit));
        
        res.json({ 
            events: limitedEvents,
            total: events.length,
            returned: limitedEvents.length
        });
    } catch (error) {
        await security.logApp('error', 'Audit log retrieval failed', { error: error.message });
        res.status(500).json({ error: 'Failed to retrieve audit logs' });
    }
});

// Get audit log statistics
router.get('/audit/stats', auth.requireAuth, auth.requireAdmin, async (req, res) => {
    try {
        const { days = 7 } = req.query;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));
        
        const events = await security.generateAuditReport(startDate, new Date());
        
        // Calculate statistics
        const stats = {
            total: events.length,
            byType: {},
            byUser: {},
            authFailures: 0,
            securityEvents: 0
        };
        
        for (const event of events) {
            // Count by event type
            stats.byType[event.eventType] = (stats.byType[event.eventType] || 0) + 1;
            
            // Count by user
            if (event.username) {
                stats.byUser[event.username] = (stats.byUser[event.username] || 0) + 1;
            }
            
            // Count failures
            if (event.eventType.includes('FAILED')) {
                stats.authFailures++;
            }
            
            // Count security events
            if (event.eventType.includes('SECURITY') || event.eventType.includes('RATE_LIMIT')) {
                stats.securityEvents++;
            }
        }
        
        res.json({ stats, period: `Last ${days} days` });
    } catch (error) {
        await security.logApp('error', 'Audit stats failed', { error: error.message });
        res.status(500).json({ error: 'Failed to get audit statistics' });
    }
});

// Export disaster recovery config
router.get('/disaster-recovery/export', auth.requireAuth, auth.requireAdmin, async (req, res) => {
    try {
        const config = await backup.exportConfig();
        
        await security.logUserAction('DR_CONFIG_EXPORTED', req.user.userId, req.user.username, {
            ip: req.ip
        });
        
        res.json({ success: true, config });
    } catch (error) {
        await security.logApp('error', 'DR config export failed', { error: error.message });
        res.status(500).json({ error: 'Failed to export disaster recovery config' });
    }
});

// System health check
router.get('/health', auth.requireAuth, auth.requireAdmin, async (req, res) => {
    try {
        const os = require('os');
        const fs = require('fs').promises;
        
        // Check disk space
        const dataDir = path.join(__dirname, '../data');
        const backupDir = path.join(__dirname, '../backups');
        
        let dataSize = 0;
        let backupSize = 0;
        
        try {
            const dataFiles = await fs.readdir(dataDir);
            for (const file of dataFiles) {
                const stats = await fs.stat(path.join(dataDir, file));
                dataSize += stats.size;
            }
        } catch (e) {
            // Ignore
        }
        
        try {
            const backupFiles = await fs.readdir(backupDir);
            for (const file of backupFiles) {
                const stats = await fs.stat(path.join(backupDir, file));
                backupSize += stats.size;
            }
        } catch (e) {
            // Ignore
        }
        
        const health = {
            status: 'healthy',
            uptime: process.uptime(),
            memory: {
                total: os.totalmem(),
                free: os.freemem(),
                used: os.totalmem() - os.freemem(),
                processUsed: process.memoryUsage()
            },
            cpu: {
                loadAverage: os.loadavg(),
                cpuCount: os.cpus().length
            },
            storage: {
                dataSize: dataSize,
                backupSize: backupSize,
                total: dataSize + backupSize
            },
            platform: {
                type: os.type(),
                platform: os.platform(),
                arch: os.arch(),
                hostname: os.hostname()
            }
        };
        
        res.json(health);
    } catch (error) {
        await security.logApp('error', 'Health check failed', { error: error.message });
        res.status(500).json({ error: 'Failed to get system health' });
    }
});

// Intrusion Detection - Get stats
router.get('/security/ids/stats', auth.requireAuth, auth.requireAdmin, async (req, res) => {
    try {
        const ids = require('../intrusion-detection');
        const stats = await ids.getStats();
        res.json(stats);
    } catch (error) {
        await security.logApp('error', 'IDS stats failed', { error: error.message });
        res.status(500).json({ error: 'Failed to get IDS statistics' });
    }
});

// Intrusion Detection - Whitelist IP
router.post('/security/ids/whitelist', auth.requireAuth, auth.requireAdmin, async (req, res) => {
    try {
        const { ip } = req.body;
        const ids = require('../intrusion-detection');
        
        await ids.addToWhitelist(ip);
        await security.logUserAction('IP_WHITELISTED', req.user.userId, req.user.username, {
            ip: ip,
            adminIp: req.ip
        });
        
        res.json({ success: true, message: `IP ${ip} added to whitelist` });
    } catch (error) {
        await security.logApp('error', 'Whitelist IP failed', { error: error.message });
        res.status(500).json({ error: 'Failed to whitelist IP' });
    }
});

// Intrusion Detection - Blacklist IP
router.post('/security/ids/blacklist', auth.requireAuth, auth.requireAdmin, async (req, res) => {
    try {
        const { ip } = req.body;
        const ids = require('../intrusion-detection');
        
        await ids.addToBlacklist(ip);
        await security.logUserAction('IP_BLACKLISTED', req.user.userId, req.user.username, {
            ip: ip,
            adminIp: req.ip
        });
        
        res.json({ success: true, message: `IP ${ip} added to blacklist` });
    } catch (error) {
        await security.logApp('error', 'Blacklist IP failed', { error: error.message });
        res.status(500).json({ error: 'Failed to blacklist IP' });
    }
});

// Intrusion Detection - Remove from blacklist
router.delete('/security/ids/blacklist/:ip', auth.requireAuth, auth.requireAdmin, async (req, res) => {
    try {
        const { ip } = req.params;
        const ids = require('../intrusion-detection');
        
        await ids.removeFromBlacklist(ip);
        await security.logUserAction('IP_UNBLACKLISTED', req.user.userId, req.user.username, {
            ip: ip,
            adminIp: req.ip
        });
        
        res.json({ success: true, message: `IP ${ip} removed from blacklist` });
    } catch (error) {
        await security.logApp('error', 'Unblacklist IP failed', { error: error.message });
        res.status(500).json({ error: 'Failed to remove IP from blacklist' });
    }
});

// Secrets Rotation - Get status
router.get('/security/rotation/status', auth.requireAuth, auth.requireAdmin, async (req, res) => {
    try {
        const rotation = require('../secrets-rotation');
        const status = await rotation.getRotationStatus();
        const recommendations = await rotation.getRecommendations();
        
        res.json({ status, recommendations });
    } catch (error) {
        await security.logApp('error', 'Rotation status failed', { error: error.message });
        res.status(500).json({ error: 'Failed to get rotation status' });
    }
});

// Secrets Rotation - Rotate session secret
router.post('/security/rotation/session', auth.requireAuth, auth.requireAdmin, async (req, res) => {
    try {
        const rotation = require('../secrets-rotation');
        const result = await rotation.rotateSessionSecret();
        
        await security.logUserAction('SESSION_SECRET_ROTATED', req.user.userId, req.user.username, {
            adminIp: req.ip
        });
        
        res.json(result);
    } catch (error) {
        await security.logApp('error', 'Session secret rotation failed', { error: error.message });
        res.status(500).json({ error: 'Failed to rotate session secret' });
    }
});

// Secrets Rotation - Rotate MFA key
router.post('/security/rotation/mfa', auth.requireAuth, auth.requireAdmin, async (req, res) => {
    try {
        const rotation = require('../secrets-rotation');
        const result = await rotation.rotateMFAKey();
        
        await security.logUserAction('MFA_KEY_ROTATED', req.user.userId, req.user.username, {
            adminIp: req.ip
        });
        
        res.json(result);
    } catch (error) {
        await security.logApp('error', 'MFA key rotation failed', { error: error.message });
        res.status(500).json({ error: 'Failed to rotate MFA key' });
    }
});

// Secrets Rotation - Get history
router.get('/security/rotation/history', auth.requireAuth, auth.requireAdmin, async (req, res) => {
    try {
        const rotation = require('../secrets-rotation');
        const history = await rotation.getHistory(50);
        
        res.json({ history });
    } catch (error) {
        await security.logApp('error', 'Rotation history failed', { error: error.message });
        res.status(500).json({ error: 'Failed to get rotation history' });
    }
});

module.exports = router;
