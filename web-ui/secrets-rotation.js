/**
 * Secrets Rotation Module
 * Manages automatic rotation of security keys
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const ROTATION_FILE = path.join(__dirname, 'data', 'rotation.json');
const DEFAULT_ROTATION_DAYS = 90; // Rotate every 90 days

class SecretsRotation {
    constructor() {
        this.rotationData = {
            lastRotation: {},
            rotationHistory: []
        };
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;

        try {
            const data = await fs.readFile(ROTATION_FILE, 'utf8');
            this.rotationData = JSON.parse(data);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error('Error loading rotation data:', error);
            }
        }

        this.initialized = true;
    }

    async save() {
        await fs.writeFile(ROTATION_FILE, JSON.stringify(this.rotationData, null, 2));
    }

    /**
     * Generate a new secure key
     */
    generateSecureKey(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }

    /**
     * Check if rotation is needed
     */
    async needsRotation(keyName, daysSinceRotation = DEFAULT_ROTATION_DAYS) {
        await this.init();

        const lastRotation = this.rotationData.lastRotation[keyName];
        
        if (!lastRotation) {
            return true; // Never rotated
        }

        const daysSince = (Date.now() - lastRotation) / (1000 * 60 * 60 * 24);
        return daysSince >= daysSinceRotation;
    }

    /**
     * Get rotation status
     */
    async getRotationStatus() {
        await this.init();

        const secrets = [
            'SESSION_SECRET',
            'MFA_ENCRYPTION_KEY',
            'CSRF_SECRET'
        ];

        const status = [];

        for (const secret of secrets) {
            const lastRotation = this.rotationData.lastRotation[secret];
            const daysSince = lastRotation 
                ? (Date.now() - lastRotation) / (1000 * 60 * 60 * 24)
                : null;

            status.push({
                secret,
                lastRotated: lastRotation ? new Date(lastRotation) : null,
                daysSinceRotation: daysSince ? Math.floor(daysSince) : null,
                needsRotation: await this.needsRotation(secret),
                recommended: DEFAULT_ROTATION_DAYS
            });
        }

        return status;
    }

    /**
     * Record rotation
     */
    async recordRotation(keyName, oldKey, newKey) {
        await this.init();

        this.rotationData.lastRotation[keyName] = Date.now();
        this.rotationData.rotationHistory.push({
            keyName,
            timestamp: Date.now(),
            oldKeyHash: crypto.createHash('sha256').update(oldKey).digest('hex').substring(0, 16),
            newKeyHash: crypto.createHash('sha256').update(newKey).digest('hex').substring(0, 16)
        });

        // Keep only last 100 rotation records
        if (this.rotationData.rotationHistory.length > 100) {
            this.rotationData.rotationHistory = this.rotationData.rotationHistory.slice(-100);
        }

        await this.save();
    }

    /**
     * Rotate session secret
     * WARNING: This will invalidate all existing sessions
     */
    async rotateSessionSecret() {
        const oldSecret = process.env.SESSION_SECRET;
        const newSecret = this.generateSecureKey(32);

        // Update .env file
        await this.updateEnvFile('SESSION_SECRET', newSecret);

        // Record rotation
        await this.recordRotation('SESSION_SECRET', oldSecret, newSecret);

        return {
            rotated: true,
            warning: 'All existing sessions have been invalidated. Users will need to login again.',
            newSecret: newSecret.substring(0, 8) + '...' // Show partial for verification
        };
    }

    /**
     * Rotate MFA encryption key
     * WARNING: This will require re-setup of MFA for all users
     */
    async rotateMFAKey() {
        const oldKey = process.env.MFA_ENCRYPTION_KEY;
        const newKey = this.generateSecureKey(32);

        // Update .env file
        await this.updateEnvFile('MFA_ENCRYPTION_KEY', newKey);

        // Record rotation
        await this.recordRotation('MFA_ENCRYPTION_KEY', oldKey, newKey);

        return {
            rotated: true,
            warning: 'MFA encryption key rotated. Existing MFA setups may need to be reconfigured.',
            newKey: newKey.substring(0, 8) + '...'
        };
    }

    /**
     * Rotate CSRF secret
     */
    async rotateCSRFSecret() {
        const oldSecret = process.env.CSRF_SECRET || '';
        const newSecret = this.generateSecureKey(32);

        // Update .env file
        await this.updateEnvFile('CSRF_SECRET', newSecret);

        // Record rotation
        await this.recordRotation('CSRF_SECRET', oldSecret, newSecret);

        return {
            rotated: true,
            warning: 'CSRF secret rotated. Active forms may need refresh.',
            newSecret: newSecret.substring(0, 8) + '...'
        };
    }

    /**
     * Update environment file
     */
    async updateEnvFile(key, value) {
        const envPath = path.join(__dirname, '.env');
        
        try {
            let envContent = await fs.readFile(envPath, 'utf8');
            
            // Check if key exists
            const regex = new RegExp(`^${key}=.*$`, 'm');
            
            if (regex.test(envContent)) {
                // Update existing key
                envContent = envContent.replace(regex, `${key}=${value}`);
            } else {
                // Add new key
                envContent += `\n${key}=${value}\n`;
            }
            
            await fs.writeFile(envPath, envContent);
            
            // Update process.env
            process.env[key] = value;
            
            return true;
        } catch (error) {
            console.error(`Error updating .env file:`, error);
            return false;
        }
    }

    /**
     * Get rotation recommendations
     */
    async getRecommendations() {
        const status = await this.getRotationStatus();
        const recommendations = [];

        for (const item of status) {
            if (item.needsRotation) {
                recommendations.push({
                    secret: item.secret,
                    urgency: item.daysSinceRotation > 180 ? 'HIGH' : 'MEDIUM',
                    message: `${item.secret} should be rotated (${item.daysSinceRotation || 'never'} days since last rotation)`
                });
            }
        }

        return recommendations;
    }

    /**
     * Schedule automatic rotation check
     */
    scheduleRotationCheck() {
        // Check daily at 2 AM
        const checkInterval = 24 * 60 * 60 * 1000; // 24 hours
        
        setInterval(async () => {
            const recommendations = await this.getRecommendations();
            
            if (recommendations.length > 0) {
                console.log('\n⚠️  SECURITY NOTICE: Key rotation recommended');
                for (const rec of recommendations) {
                    console.log(`   ${rec.urgency}: ${rec.message}`);
                }
                console.log('   Run rotation via admin panel or API\n');
                
                // Log to security logs
                const security = require('./security');
                await security.logSecurityEvent('ROTATION_RECOMMENDED', {
                    recommendations
                });
            }
        }, checkInterval);

        // Run initial check after 1 minute
        setTimeout(async () => {
            const recommendations = await this.getRecommendations();
            if (recommendations.length > 0) {
                console.log('\n📋 Key Rotation Status: Some secrets may need rotation');
                console.log('   Check admin panel for details\n');
            }
        }, 60000);
    }

    /**
     * Get rotation history
     */
    async getHistory(limit = 50) {
        await this.init();
        
        return this.rotationData.rotationHistory
            .slice(-limit)
            .reverse()
            .map(entry => ({
                keyName: entry.keyName,
                timestamp: new Date(entry.timestamp),
                oldKeyHash: entry.oldKeyHash,
                newKeyHash: entry.newKeyHash
            }));
    }
}

module.exports = new SecretsRotation();
