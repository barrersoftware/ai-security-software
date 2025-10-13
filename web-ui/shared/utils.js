/**
 * Shared Utilities
 * Common helper functions used across plugins
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

/**
 * Generate a random token
 */
function generateToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash a password or string
 */
function hash(text, algorithm = 'sha256') {
  return crypto.createHash(algorithm).update(text).digest('hex');
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Ensure directory exists
 */
async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
    return true;
  } catch (err) {
    console.error(`Error creating directory ${dir}:`, err);
    return false;
  }
}

/**
 * Safe JSON parse
 */
function safeJsonParse(str, defaultValue = null) {
  try {
    return JSON.parse(str);
  } catch (err) {
    return defaultValue;
  }
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Get timestamp string
 */
function timestamp(format = 'iso') {
  const now = new Date();
  
  if (format === 'iso') {
    return now.toISOString();
  } else if (format === 'unix') {
    return Math.floor(now.getTime() / 1000);
  } else if (format === 'filename') {
    return now.toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
           now.toTimeString().split(' ')[0].replace(/:/g, '');
  }
  
  return now.toString();
}

/**
 * Async wrapper for error handling
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Validate email format
 */
function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * Sanitize filename
 */
function sanitizeFilename(filename) {
  return filename.replace(/[^a-z0-9_\-\.]/gi, '_');
}

/**
 * Deep clone object
 */
function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Retry function with exponential backoff
 */
async function retry(fn, options = {}) {
  const { retries = 3, delay = 1000, factor = 2 } = options;
  
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
      await sleep(delay * Math.pow(factor, i));
    }
  }
}

module.exports = {
  generateToken,
  hash,
  sleep,
  ensureDir,
  safeJsonParse,
  formatBytes,
  timestamp,
  asyncHandler,
  isValidEmail,
  sanitizeFilename,
  clone,
  retry
};
