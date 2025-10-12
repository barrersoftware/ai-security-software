/**
 * Multi-Factor Authentication Module
 * Supports TOTP-based 2FA with Google Authenticator and Microsoft Authenticator
 */

const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const MFA_DATA_FILE = path.join(__dirname, 'data', 'mfa.json');

class MFAManager {
    constructor() {
        this.mfaData = {};
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;
        
        try {
            const data = await fs.readFile(MFA_DATA_FILE, 'utf8');
            this.mfaData = JSON.parse(data);
        } catch (error) {
            if (error.code === 'ENOENT') {
                this.mfaData = {};
                await this.save();
            } else {
                throw error;
            }
        }
        
        this.initialized = true;
    }

    async save() {
        await fs.writeFile(MFA_DATA_FILE, JSON.stringify(this.mfaData, null, 2));
    }

    /**
     * Generate MFA secret for a user
     * @param {string} userId - User ID
     * @param {string} username - Username for QR code label
     * @returns {Object} Secret and QR code data
     */
    async generateSecret(userId, username) {
        await this.init();

        // Generate secret
        const secret = speakeasy.generateSecret({
            name: `AI Security Scanner (${username})`,
            issuer: 'AI Security Scanner',
            length: 32
        });

        // Store secret (encrypted)
        const encrypted = this.encryptSecret(secret.base32);
        
        this.mfaData[userId] = {
            secret: encrypted,
            enabled: false,
            backupCodes: this.generateBackupCodes(),
            createdAt: new Date().toISOString()
        };

        await this.save();

        // Generate QR code
        const qrCode = await QRCode.toDataURL(secret.otpauth_url);

        return {
            secret: secret.base32,
            qrCode: qrCode,
            backupCodes: this.mfaData[userId].backupCodes
        };
    }

    /**
     * Verify MFA token
     * @param {string} userId - User ID
     * @param {string} token - 6-digit TOTP token
     * @returns {boolean} True if valid
     */
    async verifyToken(userId, token) {
        await this.init();

        const userData = this.mfaData[userId];
        if (!userData || !userData.enabled) {
            return false;
        }

        const secret = this.decryptSecret(userData.secret);

        // Verify TOTP token (with 1 step window for clock drift)
        const verified = speakeasy.totp.verify({
            secret: secret,
            encoding: 'base32',
            token: token,
            window: 1
        });

        return verified;
    }

    /**
     * Verify backup code
     * @param {string} userId - User ID
     * @param {string} code - Backup code
     * @returns {boolean} True if valid (code is removed after use)
     */
    async verifyBackupCode(userId, code) {
        await this.init();

        const userData = this.mfaData[userId];
        if (!userData || !userData.enabled) {
            return false;
        }

        const index = userData.backupCodes.indexOf(code);
        if (index === -1) {
            return false;
        }

        // Remove used backup code
        userData.backupCodes.splice(index, 1);
        await this.save();

        return true;
    }

    /**
     * Enable MFA for a user (after secret verification)
     * @param {string} userId - User ID
     * @param {string} token - Verification token
     * @returns {boolean} True if enabled successfully
     */
    async enableMFA(userId, token) {
        await this.init();

        const userData = this.mfaData[userId];
        if (!userData) {
            return false;
        }

        const secret = this.decryptSecret(userData.secret);

        // Verify the initial token
        const verified = speakeasy.totp.verify({
            secret: secret,
            encoding: 'base32',
            token: token,
            window: 1
        });

        if (verified) {
            userData.enabled = true;
            userData.enabledAt = new Date().toISOString();
            await this.save();
            return true;
        }

        return false;
    }

    /**
     * Disable MFA for a user
     * @param {string} userId - User ID
     */
    async disableMFA(userId) {
        await this.init();

        if (this.mfaData[userId]) {
            delete this.mfaData[userId];
            await this.save();
        }
    }

    /**
     * Check if MFA is enabled for user
     * @param {string} userId - User ID
     * @returns {boolean}
     */
    async isMFAEnabled(userId) {
        await this.init();
        return this.mfaData[userId] && this.mfaData[userId].enabled;
    }

    /**
     * Get MFA status for user
     * @param {string} userId - User ID
     * @returns {Object}
     */
    async getMFAStatus(userId) {
        await this.init();
        
        const userData = this.mfaData[userId];
        if (!userData) {
            return { enabled: false };
        }

        return {
            enabled: userData.enabled,
            backupCodesRemaining: userData.backupCodes ? userData.backupCodes.length : 0,
            enabledAt: userData.enabledAt,
            createdAt: userData.createdAt
        };
    }

    /**
     * Generate new backup codes
     * @returns {Array<string>}
     */
    generateBackupCodes() {
        const codes = [];
        for (let i = 0; i < 10; i++) {
            // Generate 8-character alphanumeric codes
            const code = crypto.randomBytes(4).toString('hex').toUpperCase();
            codes.push(code);
        }
        return codes;
    }

    /**
     * Regenerate backup codes
     * @param {string} userId - User ID
     * @returns {Array<string>} New backup codes
     */
    async regenerateBackupCodes(userId) {
        await this.init();

        const userData = this.mfaData[userId];
        if (!userData || !userData.enabled) {
            throw new Error('MFA not enabled for this user');
        }

        userData.backupCodes = this.generateBackupCodes();
        await this.save();

        return userData.backupCodes;
    }

    /**
     * Encrypt secret for storage
     * @param {string} secret - Secret to encrypt
     * @returns {string} Encrypted secret
     */
    encryptSecret(secret) {
        const algorithm = 'aes-256-gcm';
        const key = crypto.scryptSync(process.env.MFA_ENCRYPTION_KEY || 'default-mfa-key-change-in-production', 'salt', 32);
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(algorithm, key, iv);
        
        let encrypted = cipher.update(secret, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const authTag = cipher.getAuthTag();
        
        return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    }

    /**
     * Decrypt secret from storage
     * @param {string} encryptedSecret - Encrypted secret
     * @returns {string} Decrypted secret
     */
    decryptSecret(encryptedSecret) {
        const algorithm = 'aes-256-gcm';
        const key = crypto.scryptSync(process.env.MFA_ENCRYPTION_KEY || 'default-mfa-key-change-in-production', 'salt', 32);
        
        const [ivHex, authTagHex, encrypted] = encryptedSecret.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        
        const decipher = crypto.createDecipheriv(algorithm, key, iv);
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    }
}

module.exports = new MFAManager();
