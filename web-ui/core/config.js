/**
 * Configuration Manager
 * Centralized configuration for core and plugins
 */

require('dotenv').config();
const path = require('path');
const os = require('os');

class Config {
  constructor() {
    this.config = {
      // Server configuration
      server: {
        port: parseInt(process.env.PORT) || 3000,
        host: process.env.HOST || '0.0.0.0',
        env: process.env.NODE_ENV || 'development',
        ssl: {
          enabled: !!(process.env.SSL_CERT_PATH && process.env.SSL_KEY_PATH),
          cert: process.env.SSL_CERT_PATH,
          key: process.env.SSL_KEY_PATH
        }
      },
      
      // Paths
      paths: {
        root: path.join(__dirname, '../..'),
        webui: path.join(__dirname, '..'),
        scripts: path.join(__dirname, '../..', 'scripts'),
        reports: path.join(os.homedir(), 'security-reports'),
        logs: path.join(os.homedir(), 'security-reports', 'logs'),
        data: path.join(__dirname, '..', 'data'),
        plugins: path.join(__dirname, '..', 'plugins')
      },
      
      // Plugin system
      plugins: {
        directory: './plugins',
        autoLoad: true,
        enabled: process.env.PLUGINS_ENABLED ? 
          process.env.PLUGINS_ENABLED.split(',').map(p => p.trim()) : 
          null // null = load all
      },
      
      // Logging
      logging: {
        level: process.env.LOG_LEVEL || 'info',
        console: process.env.LOG_CONSOLE !== 'false',
        file: process.env.LOG_FILE !== 'false'
      },
      
      // Security
      security: {
        sessionSecret: process.env.SESSION_SECRET || 'change-in-production',
        sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
        cookieSecure: process.env.NODE_ENV === 'production'
      }
    };
  }
  
  /**
   * Get configuration value
   * @param {string} namespace - Dot-separated path (e.g., 'server.port')
   * @returns {*} Configuration value
   */
  get(namespace) {
    if (!namespace) return this.config;
    
    const parts = namespace.split('.');
    let value = this.config;
    
    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        return undefined;
      }
    }
    
    return value;
  }
  
  /**
   * Set configuration value
   * @param {string} namespace - Dot-separated path
   * @param {*} value - Value to set
   */
  set(namespace, value) {
    const parts = namespace.split('.');
    let obj = this.config;
    
    for (let i = 0; i < parts.length - 1; i++) {
      if (!obj[parts[i]]) {
        obj[parts[i]] = {};
      }
      obj = obj[parts[i]];
    }
    
    obj[parts[parts.length - 1]] = value;
  }
  
  /**
   * Check if value exists
   * @param {string} namespace - Dot-separated path
   * @returns {boolean}
   */
  has(namespace) {
    return this.get(namespace) !== undefined;
  }
  
  /**
   * Get all configuration
   * @returns {object} Full configuration object
   */
  getAll() {
    return { ...this.config };
  }
  
  /**
   * Check if running in production
   * @returns {boolean}
   */
  isProduction() {
    return this.config.server.env === 'production';
  }
  
  /**
   * Check if running in development
   * @returns {boolean}
   */
  isDevelopment() {
    return this.config.server.env === 'development';
  }
}

// Export singleton instance
module.exports = new Config();
