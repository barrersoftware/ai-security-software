/**
 * Security Enhancement Module
 * Provides rate limiting, CSRF protection, security headers, and audit logging
 */

const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs').promises;

// Ensure logs directory exists
const LOGS_DIR = path.join(__dirname, 'logs');

class SecurityManager {
    constructor() {
        this.logger = null;
        this.auditLogger = null;
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;

        // Create logs directory
        try {
            await fs.mkdir(LOGS_DIR, { recursive: true });
        } catch (error) {
            // Directory already exists
        }

        // Setup application logger
        this.logger = winston.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json()
            ),
            transports: [
                new DailyRotateFile({
                    filename: path.join(LOGS_DIR, 'application-%DATE%.log'),
                    datePattern: 'YYYY-MM-DD',
                    maxSize: '20m',
                    maxFiles: '30d',
                    level: 'info'
                }),
                new DailyRotateFile({
                    filename: path.join(LOGS_DIR, 'error-%DATE%.log'),
                    datePattern: 'YYYY-MM-DD',
                    maxSize: '20m',
                    maxFiles: '30d',
                    level: 'error'
                })
            ]
        });

        // Add console transport in development
        if (process.env.NODE_ENV !== 'production') {
            this.logger.add(new winston.transports.Console({
                format: winston.format.combine(
                    winston.format.colorize(),
                    winston.format.simple()
                )
            }));
        }

        // Setup audit logger
        this.auditLogger = winston.createLogger({
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new DailyRotateFile({
                    filename: path.join(LOGS_DIR, 'audit-%DATE%.log'),
                    datePattern: 'YYYY-MM-DD',
                    maxSize: '20m',
                    maxFiles: '90d' // Keep audit logs for 90 days
                })
            ]
        });

        this.initialized = true;
    }

    /**
     * Get helmet middleware for security headers
     */
    getHelmet() {
        return helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    scriptSrc: ["'self'", "'unsafe-inline'"],
                    imgSrc: ["'self'", "data:", "https:"],
                    connectSrc: ["'self'", "ws:", "wss:"],
                    fontSrc: ["'self'"],
                    objectSrc: ["'none'"],
                    mediaSrc: ["'self'"],
                    frameSrc: ["'none'"],
                },
            },
            hsts: {
                maxAge: 31536000,
                includeSubDomains: true,
                preload: true
            },
            noSniff: true,
            xssFilter: true,
            referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
        });
    }

    /**
     * Get rate limiter for authentication endpoints
     */
    getAuthRateLimiter() {
        return rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 5, // 5 requests per window
            message: 'Too many authentication attempts, please try again later',
            standardHeaders: true,
            legacyHeaders: false,
            handler: (req, res) => {
                this.logSecurityEvent('RATE_LIMIT_EXCEEDED', {
                    ip: req.ip,
                    path: req.path,
                    type: 'auth'
                });
                res.status(429).json({
                    error: 'Too many authentication attempts, please try again later'
                });
            }
        });
    }

    /**
     * Get rate limiter for API endpoints
     */
    getApiRateLimiter() {
        return rateLimit({
            windowMs: 1 * 60 * 1000, // 1 minute
            max: 100, // 100 requests per minute
            message: 'Too many requests, please try again later',
            standardHeaders: true,
            legacyHeaders: false,
            handler: (req, res) => {
                this.logSecurityEvent('API_RATE_LIMIT_EXCEEDED', {
                    ip: req.ip,
                    path: req.path,
                    type: 'api'
                });
                res.status(429).json({
                    error: 'Too many requests, please try again later'
                });
            }
        });
    }

    /**
     * Get rate limiter for scan endpoints (more restrictive)
     */
    getScanRateLimiter() {
        return rateLimit({
            windowMs: 5 * 60 * 1000, // 5 minutes
            max: 10, // 10 scans per 5 minutes
            message: 'Too many scan requests, please try again later',
            standardHeaders: true,
            legacyHeaders: false,
            handler: (req, res) => {
                this.logSecurityEvent('SCAN_RATE_LIMIT_EXCEEDED', {
                    ip: req.ip,
                    path: req.path,
                    user: req.user ? req.user.username : 'unknown'
                });
                res.status(429).json({
                    error: 'Too many scan requests, please try again later'
                });
            }
        });
    }

    /**
     * Log security event to audit log
     */
    async logSecurityEvent(eventType, data) {
        await this.init();

        this.auditLogger.info({
            eventType,
            timestamp: new Date().toISOString(),
            ...data
        });
    }

    /**
     * Log authentication event
     */
    async logAuth(action, userId, username, success, details = {}) {
        await this.logSecurityEvent('AUTH_EVENT', {
            action,
            userId,
            username,
            success,
            ...details
        });
    }

    /**
     * Log authorization event
     */
    async logAuthz(action, userId, username, resource, success, details = {}) {
        await this.logSecurityEvent('AUTHZ_EVENT', {
            action,
            userId,
            username,
            resource,
            success,
            ...details
        });
    }

    /**
     * Log user action
     */
    async logUserAction(action, userId, username, details = {}) {
        await this.logSecurityEvent('USER_ACTION', {
            action,
            userId,
            username,
            ...details
        });
    }

    /**
     * Log application event
     */
    async logApp(level, message, meta = {}) {
        await this.init();
        this.logger.log(level, message, meta);
    }

    /**
     * Sanitize user input
     */
    sanitizeInput(input) {
        if (typeof input !== 'string') {
            return input;
        }

        // Remove potential XSS attempts
        return input
            .replace(/[<>]/g, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+=/gi, '')
            .trim();
    }

    /**
     * Validate username
     */
    validateUsername(username) {
        if (!username || typeof username !== 'string') {
            return { valid: false, error: 'Username is required' };
        }

        const sanitized = this.sanitizeInput(username);
        
        if (sanitized.length < 3 || sanitized.length > 32) {
            return { valid: false, error: 'Username must be 3-32 characters' };
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(sanitized)) {
            return { valid: false, error: 'Username can only contain letters, numbers, underscores, and hyphens' };
        }

        return { valid: true, username: sanitized };
    }

    /**
     * Validate password strength
     */
    validatePassword(password) {
        if (!password || typeof password !== 'string') {
            return { valid: false, error: 'Password is required' };
        }

        if (password.length < 8) {
            return { valid: false, error: 'Password must be at least 8 characters' };
        }

        if (password.length > 128) {
            return { valid: false, error: 'Password must be less than 128 characters' };
        }

        // Check for complexity
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumbers = /\d/.test(password);
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

        if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
            return {
                valid: false,
                error: 'Password must contain uppercase, lowercase, number, and special character'
            };
        }

        return { valid: true };
    }

    /**
     * Generate audit report
     */
    async generateAuditReport(startDate, endDate) {
        await this.init();

        const auditFiles = await fs.readdir(LOGS_DIR);
        const auditLogFiles = auditFiles.filter(f => f.startsWith('audit-'));

        const events = [];

        for (const file of auditLogFiles) {
            const content = await fs.readFile(path.join(LOGS_DIR, file), 'utf8');
            const lines = content.split('\n').filter(l => l.trim());
            
            for (const line of lines) {
                try {
                    const event = JSON.parse(line);
                    const eventDate = new Date(event.timestamp);
                    
                    if ((!startDate || eventDate >= startDate) && (!endDate || eventDate <= endDate)) {
                        events.push(event);
                    }
                } catch (error) {
                    // Skip invalid JSON lines
                }
            }
        }

        return events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }
}

module.exports = new SecurityManager();
