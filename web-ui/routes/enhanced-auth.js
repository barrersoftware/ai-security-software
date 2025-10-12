/**
 * Enhanced Authentication Routes with MFA and OAuth
 */

const express = require('express');
const router = express.Router();
const auth = require('../auth');
const mfa = require('../mfa');
const security = require('../security');

// Get auth rate limiter
const authRateLimiter = security.getAuthRateLimiter();

// Setup check
router.get('/setup/needed', async (req, res) => {
    try {
        const needed = await auth.needsSetup();
        res.json({ setupNeeded: needed });
    } catch (error) {
        await security.logApp('error', 'Setup check failed', { error: error.message });
        res.status(500).json({ error: 'Failed to check setup status' });
    }
});

// Initial setup
router.post('/setup', authRateLimiter, async (req, res) => {
    try {
        const { username, password, email } = req.body;

        // Validate inputs
        const usernameValidation = security.validateUsername(username);
        if (!usernameValidation.valid) {
            return res.status(400).json({ error: usernameValidation.error });
        }

        const passwordValidation = security.validatePassword(password);
        if (!passwordValidation.valid) {
            return res.status(400).json({ error: passwordValidation.error });
        }

        const user = await auth.createAdminUser(usernameValidation.username, password, email);
        
        await security.logAuth('SETUP', user.id, user.username, true, { ip: req.ip });
        
        res.json({ success: true, user });
    } catch (error) {
        await security.logApp('error', 'Setup failed', { error: error.message });
        res.status(400).json({ error: error.message });
    }
});

// Login
router.post('/login', authRateLimiter, async (req, res) => {
    try {
        const { username, password, mfaToken } = req.body;
        const ip = req.ip || req.connection.remoteAddress;
        const ids = require('../intrusion-detection');

        // Check if IP is blocked
        if (await ids.isBlocked(ip)) {
            await security.logAuth('LOGIN_BLOCKED', null, username, false, { 
                reason: 'ip_blocked', 
                ip 
            });
            return res.status(403).json({ 
                error: 'Access denied',
                message: 'Your IP has been temporarily blocked due to suspicious activity'
            });
        }

        // Validate inputs
        const usernameValidation = security.validateUsername(username);
        if (!usernameValidation.valid) {
            await ids.recordFailedLogin(ip, username);
            await security.logAuth('LOGIN_FAILED', null, username, false, { 
                reason: 'invalid_username', 
                ip 
            });
            return res.status(400).json({ error: usernameValidation.error });
        }

        // Authenticate with password
        const result = await auth.authenticate(usernameValidation.username, password);

        if (!result) {
            // Record failed login
            const lockoutInfo = await ids.recordFailedLogin(ip, username);
            
            await security.logAuth('LOGIN_FAILED', null, username, false, { 
                reason: 'invalid_credentials', 
                ip,
                attempts: lockoutInfo.attempts
            });

            if (lockoutInfo.blocked) {
                return res.status(429).json({ 
                    error: 'Account temporarily locked',
                    message: `Too many failed attempts. Account locked until ${lockoutInfo.until.toLocaleTimeString()}`,
                    blockedUntil: lockoutInfo.until
                });
            }

            return res.status(401).json({ 
                error: 'Invalid credentials',
                attemptsRemaining: lockoutInfo.remaining
            });
        }

        // Check if MFA is enabled
        const mfaEnabled = await mfa.isMFAEnabled(result.user.id);

        if (mfaEnabled) {
            if (!mfaToken) {
                // MFA required but not provided
                await security.logAuth('LOGIN_MFA_REQUIRED', result.user.id, result.user.username, false, { 
                    ip 
                });
                return res.json({ 
                    mfaRequired: true,
                    tempToken: result.token // Temporary token for MFA verification
                });
            }

            // Verify MFA token
            const mfaValid = await mfa.verifyToken(result.user.id, mfaToken) || 
                             await mfa.verifyBackupCode(result.user.id, mfaToken);

            if (!mfaValid) {
                // Record failed MFA attempt
                await ids.recordSuspiciousActivity(ip, 'FAILED_MFA', {
                    username: result.user.username
                });
                
                await security.logAuth('LOGIN_MFA_FAILED', result.user.id, result.user.username, false, { 
                    ip 
                });
                return res.status(401).json({ error: 'Invalid MFA token' });
            }
        }

        // Successful login - clear failed attempts
        await ids.recordSuccessfulLogin(ip);

        await security.logAuth('LOGIN_SUCCESS', result.user.id, result.user.username, true, { 
            ip,
            mfaUsed: mfaEnabled
        });

        res.json({ 
            token: result.token, 
            user: result.user,
            mfaEnabled: mfaEnabled
        });
    } catch (error) {
        await security.logApp('error', 'Login error', { error: error.message });
        res.status(500).json({ error: 'Authentication error' });
    }
});

// Verify session
router.get('/me', auth.requireAuth, async (req, res) => {
    try {
        const mfaStatus = await mfa.getMFAStatus(req.user.userId);
        res.json({ 
            user: req.user,
            mfaEnabled: mfaStatus.enabled,
            mfaBackupCodes: mfaStatus.backupCodesRemaining
        });
    } catch (error) {
        await security.logApp('error', 'Session verification failed', { error: error.message });
        res.status(500).json({ error: 'Failed to verify session' });
    }
});

// Logout
router.post('/logout', auth.requireAuth, async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        await auth.logout(token);
        
        await security.logAuth('LOGOUT', req.user.userId, req.user.username, true, { 
            ip: req.ip 
        });
        
        res.json({ success: true });
    } catch (error) {
        await security.logApp('error', 'Logout failed', { error: error.message });
        res.status(500).json({ error: 'Logout failed' });
    }
});

// MFA Setup - Generate secret
router.post('/mfa/setup', auth.requireAuth, async (req, res) => {
    try {
        const userId = req.user.userId;
        const username = req.user.username;

        const mfaData = await mfa.generateSecret(userId, username);
        
        await security.logUserAction('MFA_SETUP_INITIATED', userId, username, { ip: req.ip });
        
        res.json({
            success: true,
            secret: mfaData.secret,
            qrCode: mfaData.qrCode,
            backupCodes: mfaData.backupCodes
        });
    } catch (error) {
        await security.logApp('error', 'MFA setup failed', { error: error.message });
        res.status(500).json({ error: 'Failed to setup MFA' });
    }
});

// MFA Enable - Verify and activate
router.post('/mfa/enable', auth.requireAuth, async (req, res) => {
    try {
        const { token } = req.body;
        const userId = req.user.userId;
        const username = req.user.username;

        if (!token) {
            return res.status(400).json({ error: 'MFA token required' });
        }

        const enabled = await mfa.enableMFA(userId, token);

        if (enabled) {
            await security.logUserAction('MFA_ENABLED', userId, username, { ip: req.ip });
            res.json({ success: true, message: 'MFA enabled successfully' });
        } else {
            await security.logUserAction('MFA_ENABLE_FAILED', userId, username, { 
                ip: req.ip,
                reason: 'invalid_token'
            });
            res.status(400).json({ error: 'Invalid MFA token' });
        }
    } catch (error) {
        await security.logApp('error', 'MFA enable failed', { error: error.message });
        res.status(500).json({ error: 'Failed to enable MFA' });
    }
});

// MFA Disable
router.post('/mfa/disable', auth.requireAuth, async (req, res) => {
    try {
        const { password } = req.body;
        const userId = req.user.userId;
        const username = req.user.username;

        if (!password) {
            return res.status(400).json({ error: 'Password required to disable MFA' });
        }

        // Verify password
        const authResult = await auth.authenticate(username, password);
        if (!authResult) {
            return res.status(401).json({ error: 'Invalid password' });
        }

        await mfa.disableMFA(userId);
        
        await security.logUserAction('MFA_DISABLED', userId, username, { ip: req.ip });
        
        res.json({ success: true, message: 'MFA disabled successfully' });
    } catch (error) {
        await security.logApp('error', 'MFA disable failed', { error: error.message });
        res.status(500).json({ error: 'Failed to disable MFA' });
    }
});

// MFA Status
router.get('/mfa/status', auth.requireAuth, async (req, res) => {
    try {
        const status = await mfa.getMFAStatus(req.user.userId);
        res.json(status);
    } catch (error) {
        await security.logApp('error', 'MFA status check failed', { error: error.message });
        res.status(500).json({ error: 'Failed to get MFA status' });
    }
});

// Regenerate backup codes
router.post('/mfa/backup-codes/regenerate', auth.requireAuth, async (req, res) => {
    try {
        const userId = req.user.userId;
        const username = req.user.username;

        const backupCodes = await mfa.regenerateBackupCodes(userId);
        
        await security.logUserAction('MFA_BACKUP_CODES_REGENERATED', userId, username, { 
            ip: req.ip 
        });
        
        res.json({ success: true, backupCodes });
    } catch (error) {
        await security.logApp('error', 'Backup codes regeneration failed', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// User management routes (admin only)
router.get('/users', auth.requireAuth, auth.requireAdmin, async (req, res) => {
    try {
        const users = await auth.listUsers();
        res.json({ users });
    } catch (error) {
        await security.logApp('error', 'List users failed', { error: error.message });
        res.status(500).json({ error: 'Failed to list users' });
    }
});

router.post('/users', auth.requireAuth, auth.requireAdmin, async (req, res) => {
    try {
        const { username, password, email, role } = req.body;

        const usernameValidation = security.validateUsername(username);
        if (!usernameValidation.valid) {
            return res.status(400).json({ error: usernameValidation.error });
        }

        const passwordValidation = security.validatePassword(password);
        if (!passwordValidation.valid) {
            return res.status(400).json({ error: passwordValidation.error });
        }

        const user = await auth.addUser(usernameValidation.username, password, email, role);
        
        await security.logUserAction('USER_CREATED', req.user.userId, req.user.username, {
            targetUser: user.username,
            role: user.role,
            ip: req.ip
        });
        
        res.json({ success: true, user });
    } catch (error) {
        await security.logApp('error', 'Add user failed', { error: error.message });
        res.status(400).json({ error: error.message });
    }
});

router.delete('/users/:userId', auth.requireAuth, auth.requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        await auth.deleteUser(userId);
        
        await security.logUserAction('USER_DELETED', req.user.userId, req.user.username, {
            targetUserId: userId,
            ip: req.ip
        });
        
        res.json({ success: true });
    } catch (error) {
        await security.logApp('error', 'Delete user failed', { error: error.message });
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
