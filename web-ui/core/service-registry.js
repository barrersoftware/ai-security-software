/**
 * Service Registry
 * Manages services that plugins provide and consume
 */

const { logger } = require('../shared/logger');

class ServiceRegistry {
  constructor() {
    this.services = new Map();
    this.listeners = new Map();
  }
  
  /**
   * Register a service
   * @param {string} name - Service name
   * @param {*} service - Service instance/object
   */
  register(name, service) {
    if (this.services.has(name)) {
      logger.warn(`Service '${name}' already registered, overwriting`);
    }
    
    this.services.set(name, service);
    logger.debug(`Registered service: ${name}`);
    
    // Notify listeners
    if (this.listeners.has(name)) {
      for (const callback of this.listeners.get(name)) {
        callback(service);
      }
    }
  }
  
  /**
   * Get a service
   * @param {string} name - Service name
   * @returns {*} Service instance
   */
  get(name) {
    if (!this.services.has(name)) {
      throw new Error(`Service not found: ${name}`);
    }
    
    return this.services.get(name);
  }
  
  /**
   * Check if service exists
   * @param {string} name - Service name
   * @returns {boolean}
   */
  has(name) {
    return this.services.has(name);
  }
  
  /**
   * Get all services
   * @returns {Array} Array of [name, service] pairs
   */
  getAll() {
    return Array.from(this.services.entries());
  }
  
  /**
   * Remove a service
   * @param {string} name - Service name
   */
  unregister(name) {
    if (this.services.delete(name)) {
      logger.debug(`Unregistered service: ${name}`);
    }
  }
  
  /**
   * Wait for a service to be registered
   * @param {string} name - Service name
   * @returns {Promise} Resolves when service is available
   */
  waitFor(name) {
    if (this.has(name)) {
      return Promise.resolve(this.get(name));
    }
    
    return new Promise((resolve) => {
      if (!this.listeners.has(name)) {
        this.listeners.set(name, []);
      }
      
      this.listeners.get(name).push(resolve);
    });
  }
  
  /**
   * List all registered services
   * @returns {Array<string>} Service names
   */
  list() {
    return Array.from(this.services.keys());
  }
  
  /**
   * Clear all services (mainly for testing)
   */
  clear() {
    this.services.clear();
    this.listeners.clear();
    logger.debug('Cleared all services');
  }
}

module.exports = ServiceRegistry;
