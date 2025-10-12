/**
 * Intrusion Detection System (IDS)
 * Detects and prevents suspicious activities
 */

const fs = require('fs').promises;
const path = require('path');

const THREAT_DATA_FILE = path.join(__dirname, 'data', 'threats.json');
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
const MAX_FAILED_ATTEMPTS = 5;
const SUSPICIOUS_ACTIVITY_THRESHOLD = 10;

class IntrusionDetection {
    constructor() {
        this.threats = {
            failedLogins: {},
            suspiciousIPs: {},
            blockedIPs: new Set(),
            whitelist: new Set(),
            blacklist: new Set()
        };
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;

        try {
            const data = await fs.readFile(THREAT_DATA_FILE, 'utf8');
            const loaded = JSON.parse(data);
            this.threats = {
                ...loaded,
                blockedIPs: new Set(loaded.blockedIPs || []),
                whitelist: new Set(loaded.whitelist || []),
                blacklist: new Set(loaded.blacklist || [])
            };
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error('Error loading threat data:', error);
            }
        }

        this.initialized = true;

        // Cleanup expired blocks every minute
        setInterval(() => this.cleanupExpiredBlocks(), 60000);
    }

    async save() {
        const data = {
            failedLogins: this.threats.failedLogins,
            suspiciousIPs: this.threats.suspiciousIPs,
            blockedIPs: Array.from(this.threats.blockedIPs),
            whitelist: Array.from(this.threats.whitelist),
            blacklist: Array.from(this.threats.blacklist)
        };
        await fs.writeFile(THREAT_DATA_FILE, JSON.stringify(data, null, 2));
    }

    /**
     * Check if IP is blocked
     */
    async isBlocked(ip) {
        await this.init();

        // Check whitelist first
        if (this.threats.whitelist.has(ip)) {
            return false;
        }

        // Check blacklist
        if (this.threats.blacklist.has(ip)) {
            return true;
        }

        // Check temporary blocks
        if (this.threats.blockedIPs.has(ip)) {
            const blockData = this.threats.failedLogins[ip];
            if (blockData && blockData.blockedUntil > Date.now()) {
                return true;
            } else {
                this.threats.blockedIPs.delete(ip);
            }
        }

        return false;
    }

    /**
     * Record failed login attempt
     */
    async recordFailedLogin(ip, username) {
        await this.init();

        if (!this.threats.failedLogins[ip]) {
            this.threats.failedLogins[ip] = {
                attempts: 0,
                firstAttempt: Date.now(),
                lastAttempt: Date.now(),
                usernames: []
            };
        }

        const record = this.threats.failedLogins[ip];
        record.attempts++;
        record.lastAttempt = Date.now();
        
        if (!record.usernames.includes(username)) {
            record.usernames.push(username);
        }

        // Check if should be blocked
        if (record.attempts >= MAX_FAILED_ATTEMPTS) {
            record.blockedUntil = Date.now() + LOCKOUT_DURATION;
            this.threats.blockedIPs.add(ip);
            await this.save();
            return {
                blocked: true,
                until: new Date(record.blockedUntil),
                attempts: record.attempts
            };
        }

        await this.save();
        return {
            blocked: false,
            attempts: record.attempts,
            remaining: MAX_FAILED_ATTEMPTS - record.attempts
        };
    }

    /**
     * Record successful login (clears failed attempts)
     */
    async recordSuccessfulLogin(ip) {
        await this.init();

        if (this.threats.failedLogins[ip]) {
            delete this.threats.failedLogins[ip];
            this.threats.blockedIPs.delete(ip);
            await this.save();
        }
    }

    /**
     * Record suspicious activity
     */
    async recordSuspiciousActivity(ip, activityType, details = {}) {
        await this.init();

        if (!this.threats.suspiciousIPs[ip]) {
            this.threats.suspiciousIPs[ip] = {
                activities: [],
                score: 0,
                firstSeen: Date.now()
            };
        }

        const record = this.threats.suspiciousIPs[ip];
        record.activities.push({
            type: activityType,
            timestamp: Date.now(),
            details
        });

        // Calculate threat score
        record.score = this.calculateThreatScore(record.activities);

        // Auto-block if threat score too high
        if (record.score >= SUSPICIOUS_ACTIVITY_THRESHOLD) {
            this.threats.blacklist.add(ip);
            this.threats.blockedIPs.add(ip);
        }

        await this.save();
        return record.score;
    }

    /**
     * Calculate threat score based on activities
     */
    calculateThreatScore(activities) {
        let score = 0;
        const recentActivities = activities.filter(
            a => Date.now() - a.timestamp < 60 * 60 * 1000 // Last hour
        );

        for (const activity of recentActivities) {
            switch (activity.type) {
                case 'FAILED_LOGIN':
                    score += 1;
                    break;
                case 'RATE_LIMIT_EXCEEDED':
                    score += 2;
                    break;
                case 'INVALID_TOKEN':
                    score += 1;
                    break;
                case 'SQL_INJECTION_ATTEMPT':
                    score += 5;
                    break;
                case 'XSS_ATTEMPT':
                    score += 5;
                    break;
                case 'PATH_TRAVERSAL':
                    score += 5;
                    break;
                case 'SUSPICIOUS_USER_AGENT':
                    score += 1;
                    break;
                default:
                    score += 1;
            }
        }

        return score;
    }

    /**
     * Add IP to whitelist
     */
    async addToWhitelist(ip) {
        await this.init();
        this.threats.whitelist.add(ip);
        this.threats.blacklist.delete(ip);
        this.threats.blockedIPs.delete(ip);
        await this.save();
    }

    /**
     * Add IP to blacklist
     */
    async addToBlacklist(ip) {
        await this.init();
        this.threats.blacklist.add(ip);
        this.threats.blockedIPs.add(ip);
        await this.save();
    }

    /**
     * Remove IP from blacklist
     */
    async removeFromBlacklist(ip) {
        await this.init();
        this.threats.blacklist.delete(ip);
        this.threats.blockedIPs.delete(ip);
        await this.save();
    }

    /**
     * Get threat statistics
     */
    async getStats() {
        await this.init();

        const now = Date.now();
        const activeBlocks = Array.from(this.threats.blockedIPs).filter(ip => {
            const record = this.threats.failedLogins[ip];
            return record && record.blockedUntil > now;
        });

        return {
            totalFailedLogins: Object.keys(this.threats.failedLogins).length,
            activeBlocks: activeBlocks.length,
            suspiciousIPs: Object.keys(this.threats.suspiciousIPs).length,
            whitelistedIPs: this.threats.whitelist.size,
            blacklistedIPs: this.threats.blacklist.size,
            recentThreats: this.getRecentThreats(24) // Last 24 hours
        };
    }

    /**
     * Get recent threats
     */
    getRecentThreats(hours = 24) {
        const cutoff = Date.now() - (hours * 60 * 60 * 1000);
        const threats = [];

        for (const [ip, data] of Object.entries(this.threats.suspiciousIPs)) {
            const recentActivities = data.activities.filter(a => a.timestamp > cutoff);
            if (recentActivities.length > 0) {
                threats.push({
                    ip,
                    score: data.score,
                    activities: recentActivities.length,
                    lastActivity: Math.max(...recentActivities.map(a => a.timestamp))
                });
            }
        }

        return threats.sort((a, b) => b.score - a.score);
    }

    /**
     * Clean up expired blocks
     */
    async cleanupExpiredBlocks() {
        await this.init();

        const now = Date.now();
        let cleaned = 0;

        for (const [ip, data] of Object.entries(this.threats.failedLogins)) {
            if (data.blockedUntil && data.blockedUntil < now) {
                delete this.threats.failedLogins[ip];
                this.threats.blockedIPs.delete(ip);
                cleaned++;
            }
        }

        // Clean old suspicious activity records (older than 7 days)
        const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
        for (const [ip, data] of Object.entries(this.threats.suspiciousIPs)) {
            if (data.firstSeen < weekAgo && data.score < 5) {
                delete this.threats.suspiciousIPs[ip];
                cleaned++;
            }
        }

        if (cleaned > 0) {
            await this.save();
        }
    }

    /**
     * Middleware to check IP blocks
     */
    blockMiddleware() {
        return async (req, res, next) => {
            const ip = req.ip || req.connection.remoteAddress;
            
            if (await this.isBlocked(ip)) {
                const security = require('./security');
                await security.logSecurityEvent('IP_BLOCKED', {
                    ip,
                    path: req.path,
                    method: req.method
                });
                
                return res.status(403).json({
                    error: 'Access denied',
                    message: 'Your IP has been blocked due to suspicious activity'
                });
            }
            
            next();
        };
    }

    /**
     * Get lockout information for IP
     */
    async getLockoutInfo(ip) {
        await this.init();

        const record = this.threats.failedLogins[ip];
        if (!record) {
            return null;
        }

        return {
            attempts: record.attempts,
            maxAttempts: MAX_FAILED_ATTEMPTS,
            blockedUntil: record.blockedUntil ? new Date(record.blockedUntil) : null,
            isBlocked: record.blockedUntil > Date.now()
        };
    }
}

module.exports = new IntrusionDetection();
