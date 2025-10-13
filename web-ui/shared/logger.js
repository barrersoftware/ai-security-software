/**
 * Shared Logger
 * Simple, consistent logging across all plugins
 */

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const os = require('os');

const LOG_DIR = path.join(os.homedir(), 'security-reports', 'logs');

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'ai-security-scanner' },
  transports: [
    // Console output
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
          let msg = `${timestamp} [${service}] ${level}: ${message}`;
          if (Object.keys(meta).length > 0) {
            msg += ` ${JSON.stringify(meta)}`;
          }
          return msg;
        })
      )
    }),
    
    // File output with rotation
    new DailyRotateFile({
      dirname: LOG_DIR,
      filename: 'app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      level: 'info'
    }),
    
    // Error file
    new DailyRotateFile({
      dirname: LOG_DIR,
      filename: 'error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      level: 'error'
    })
  ]
});

// Create plugin-specific logger
function createPluginLogger(pluginName) {
  return {
    debug: (message, meta = {}) => logger.debug(message, { plugin: pluginName, ...meta }),
    info: (message, meta = {}) => logger.info(message, { plugin: pluginName, ...meta }),
    warn: (message, meta = {}) => logger.warn(message, { plugin: pluginName, ...meta }),
    error: (message, meta = {}) => logger.error(message, { plugin: pluginName, ...meta })
  };
}

module.exports = {
  logger,
  createPluginLogger
};
