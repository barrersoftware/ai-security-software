/**
 * Encryption Service
 * Provide encryption/decryption utilities
 */

const crypto = require('crypto');

class EncryptionService {
  constructor(core) {
    this.core = core;
    this.logger = core.getService('logger');
    
    // Get or generate encryption key
    this.key = process.env.ENCRYPTION_KEY || this.generateKey();
    this.algorithm = 'aes-256-gcm';
  }
  
  async init() {
    if (!process.env.ENCRYPTION_KEY) {
      this.logger.warn('ENCRYPTION_KEY not set. Using generated key (will change on restart!)');
      this.logger.warn(`Generated key: ${this.key}`);
      this.logger.warn('Set ENCRYPTION_KEY environment variable for production!');
    }
    
    this.logger.info('Encryption service initialized');
  }
  
  /**
   * Generate encryption key
   */
  generateKey() {
    return crypto.randomBytes(32).toString('hex');
  }
  
  /**
   * Encrypt data
   */
  encrypt(text) {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(
        this.algorithm,
        Buffer.from(this.key, 'hex'),
        iv
      );
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      // Combine iv, authTag, and encrypted data
      return JSON.stringify({
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        data: encrypted
      });
    } catch (err) {
      this.logger.error('Encryption error:', err);
      throw new Error('Encryption failed');
    }
  }
  
  /**
   * Decrypt data
   */
  decrypt(encryptedData) {
    try {
      const parsed = JSON.parse(encryptedData);
      
      const decipher = crypto.createDecipheriv(
        this.algorithm,
        Buffer.from(this.key, 'hex'),
        Buffer.from(parsed.iv, 'hex')
      );
      
      decipher.setAuthTag(Buffer.from(parsed.authTag, 'hex'));
      
      let decrypted = decipher.update(parsed.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (err) {
      this.logger.error('Decryption error:', err);
      throw new Error('Decryption failed');
    }
  }
  
  /**
   * Hash data (one-way)
   */
  hash(data, algorithm = 'sha256') {
    return crypto.createHash(algorithm).update(data).digest('hex');
  }
  
  /**
   * Generate HMAC
   */
  hmac(data, secret = this.key, algorithm = 'sha256') {
    return crypto.createHmac(algorithm, secret).update(data).digest('hex');
  }
  
  /**
   * Verify HMAC
   */
  verifyHmac(data, signature, secret = this.key) {
    const expected = this.hmac(data, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  }
  
  /**
   * Generate random bytes
   */
  randomBytes(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }
  
  /**
   * Generate random token
   */
  generateToken(length = 32) {
    return this.randomBytes(length);
  }
  
  /**
   * Generate API key
   */
  generateAPIKey() {
    const prefix = 'sk_';
    const key = this.randomBytes(32);
    return prefix + key;
  }
  
  /**
   * Get status
   */
  getStatus() {
    return {
      algorithm: this.algorithm,
      keyConfigured: !!process.env.ENCRYPTION_KEY,
      keyLength: this.key.length
    };
  }
}

module.exports = EncryptionService;
