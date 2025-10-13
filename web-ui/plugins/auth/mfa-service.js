/**
 * MFA Service
 * Multi-Factor Authentication with TOTP
 */

const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const fs = require('fs').promises;
const path = require('path');

class MFAService {
  constructor(core) {
    this.core = core;
    this.logger = core.getService('logger');
    this.mfaFile = path.join(core.getConfig('paths.data'), 'mfa.json');
    this.mfaData = {};
  }
  
  async init() {
    try {
      const data = await fs.readFile(this.mfaFile, 'utf8');
      this.mfaData = JSON.parse(data);
    } catch (err) {
      if (err.code === 'ENOENT') {
        this.mfaData = {};
        await this.save();
      }
    }
    
    this.logger.info('MFA service initialized');
  }
  
  async save() {
    await fs.writeFile(this.mfaFile, JSON.stringify(this.mfaData, null, 2));
  }
  
  async setupMFA(userId, username) {
    const secret = speakeasy.generateSecret({
      name: `AI Security Scanner (${username})`,
      issuer: 'AI Security Scanner'
    });
    
    this.mfaData[userId] = {
      secret: secret.base32,
      enabled: false,
      backupCodes: this.generateBackupCodes()
    };
    
    await this.save();
    
    const qrCode = await QRCode.toDataURL(secret.otpauth_url);
    
    return {
      secret: secret.base32,
      qrCode,
      backupCodes: this.mfaData[userId].backupCodes
    };
  }
  
  async verifyToken(userId, token) {
    const userData = this.mfaData[userId];
    
    if (!userData) {
      return { success: false, error: 'MFA not set up' };
    }
    
    const verified = speakeasy.totp.verify({
      secret: userData.secret,
      encoding: 'base32',
      token,
      window: 2
    });
    
    if (verified) {
      return { success: true };
    } else {
      // Check backup codes
      const codeIndex = userData.backupCodes.indexOf(token);
      if (codeIndex !== -1) {
        userData.backupCodes.splice(codeIndex, 1);
        await this.save();
        return { success: true, usedBackupCode: true };
      }
    }
    
    return { success: false, error: 'Invalid token' };
  }
  
  async enableMFA(userId) {
    if (this.mfaData[userId]) {
      this.mfaData[userId].enabled = true;
      await this.save();
      this.logger.info(`MFA enabled for user: ${userId}`);
      return { success: true };
    }
    return { success: false, error: 'MFA not set up' };
  }
  
  async disableMFA(userId, token) {
    const verification = await this.verifyToken(userId, token);
    
    if (!verification.success) {
      return { success: false, error: 'Invalid token' };
    }
    
    delete this.mfaData[userId];
    await this.save();
    
    this.logger.info(`MFA disabled for user: ${userId}`);
    
    return { success: true };
  }
  
  async isEnabled(userId) {
    return this.mfaData[userId]?.enabled || false;
  }
  
  generateBackupCodes(count = 10) {
    const codes = [];
    for (let i = 0; i < count; i++) {
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      codes.push(code);
    }
    return codes;
  }
}

module.exports = MFAService;
