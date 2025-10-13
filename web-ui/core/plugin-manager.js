/**
 * Plugin Manager
 * Loads, initializes, and manages plugins
 */

const fs = require('fs').promises;
const path = require('path');
const { createPluginLogger } = require('../shared/logger');

class PluginManager {
  constructor(core) {
    this.core = core;
    this.plugins = new Map();
    this.loadOrder = [];
    this.logger = createPluginLogger('plugin-manager');
  }
  
  /**
   * Load all plugins from directory
   * @param {string} pluginsDir - Path to plugins directory
   */
  async loadAll(pluginsDir) {
    this.logger.info(`Loading plugins from ${pluginsDir}...`);
    
    try {
      const fullPath = path.resolve(pluginsDir);
      const dirs = await fs.readdir(fullPath);
      
      // Load plugin manifests first
      const manifests = [];
      
      for (const dir of dirs) {
        const pluginPath = path.join(fullPath, dir);
        
        // Check if it's a directory
        const stat = await fs.stat(pluginPath);
        if (!stat.isDirectory()) continue;
        
        // Load plugin manifest
        const manifestPath = path.join(pluginPath, 'plugin.json');
        
        try {
          const manifestData = await fs.readFile(manifestPath, 'utf8');
          const manifest = JSON.parse(manifestData);
          
          // Check if plugin is enabled
          if (manifest.enabled === false) {
            this.logger.info(`Skipping disabled plugin: ${dir}`);
            continue;
          }
          
          // Check if in enabled list (if specified)
          const enabledPlugins = this.core.getConfig('plugins.enabled');
          if (enabledPlugins && !enabledPlugins.includes(dir)) {
            this.logger.info(`Skipping plugin not in enabled list: ${dir}`);
            continue;
          }
          
          manifests.push({ manifest, pluginPath, dir });
          
        } catch (err) {
          if (err.code === 'ENOENT') {
            this.logger.warn(`No plugin.json found in ${dir}, skipping`);
          } else {
            this.logger.error(`Error reading plugin manifest for ${dir}:`, err);
          }
        }
      }
      
      // Sort by priority (higher = load first)
      manifests.sort((a, b) => 
        (b.manifest.priority || 0) - (a.manifest.priority || 0)
      );
      
      // Load plugins in order
      for (const { manifest, pluginPath, dir } of manifests) {
        try {
          await this.load(dir, pluginPath, manifest);
        } catch (err) {
          this.logger.error(`Failed to load plugin ${dir}:`, err);
          
          // Continue loading other plugins or fail completely?
          if (manifest.required) {
            throw new Error(`Required plugin ${dir} failed to load: ${err.message}`);
          }
        }
      }
      
      this.logger.info(`Successfully loaded ${this.plugins.size} plugins`);
      
    } catch (err) {
      this.logger.error('Error loading plugins:', err);
      throw err;
    }
  }
  
  /**
   * Load a single plugin
   * @param {string} name - Plugin name
   * @param {string} pluginPath - Path to plugin directory
   * @param {object} manifest - Plugin manifest
   */
  async load(name, pluginPath, manifest) {
    this.logger.info(`Loading plugin: ${name}...`);
    
    // Check dependencies
    if (manifest.requires?.plugins) {
      for (const dep of manifest.requires.plugins) {
        if (!this.plugins.has(dep)) {
          throw new Error(`Plugin ${name} requires ${dep} which is not loaded`);
        }
      }
    }
    
    // Load plugin module
    const mainFile = path.join(pluginPath, manifest.main || 'index.js');
    const Plugin = require(mainFile);
    
    // Validate plugin interface
    if (!Plugin || typeof Plugin !== 'object') {
      throw new Error(`Plugin ${name} must export an object`);
    }
    
    if (!Plugin.init || typeof Plugin.init !== 'function') {
      throw new Error(`Plugin ${name} must have an init() function`);
    }
    
    // Initialize plugin
    await Plugin.init(this.core);
    
    // Store plugin
    this.plugins.set(name, {
      name,
      manifest,
      instance: Plugin,
      path: pluginPath
    });
    
    this.loadOrder.push(name);
    
    // Register services provided by plugin
    if (Plugin.services && typeof Plugin.services === 'function') {
      const services = Plugin.services();
      
      for (const [serviceName, service] of Object.entries(services)) {
        const fullServiceName = `${name}.${serviceName}`;
        this.core.registerService(fullServiceName, service);
        this.logger.debug(`Registered service: ${fullServiceName}`);
      }
    }
    
    this.logger.info(`✅ Loaded plugin: ${name} v${manifest.version}`);
  }
  
  /**
   * Get a plugin by name
   * @param {string} name - Plugin name
   * @returns {object} Plugin object
   */
  get(name) {
    return this.plugins.get(name);
  }
  
  /**
   * Get all loaded plugins
   * @returns {Array} Array of plugin objects
   */
  getAll() {
    return Array.from(this.plugins.values());
  }
  
  /**
   * Check if plugin is loaded
   * @param {string} name - Plugin name
   * @returns {boolean}
   */
  has(name) {
    return this.plugins.has(name);
  }
  
  /**
   * Destroy all plugins (in reverse order)
   */
  async destroyAll() {
    this.logger.info('Destroying all plugins...');
    
    // Destroy in reverse order
    for (let i = this.loadOrder.length - 1; i >= 0; i--) {
      const name = this.loadOrder[i];
      const plugin = this.plugins.get(name);
      
      if (plugin?.instance.destroy && typeof plugin.instance.destroy === 'function') {
        try {
          this.logger.info(`Destroying plugin: ${name}...`);
          await plugin.instance.destroy();
          this.logger.info(`Destroyed plugin: ${name}`);
        } catch (err) {
          this.logger.error(`Error destroying plugin ${name}:`, err);
        }
      }
    }
    
    this.plugins.clear();
    this.loadOrder = [];
    this.logger.info('All plugins destroyed');
  }
  
  /**
   * Reload a plugin (useful for development)
   * @param {string} name - Plugin name
   */
  async reload(name) {
    this.logger.info(`Reloading plugin: ${name}...`);
    
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Plugin ${name} not found`);
    }
    
    // Destroy plugin
    if (plugin.instance.destroy) {
      await plugin.instance.destroy();
    }
    
    // Clear require cache
    const mainFile = path.join(plugin.path, plugin.manifest.main || 'index.js');
    delete require.cache[require.resolve(mainFile)];
    
    // Remove from maps
    this.plugins.delete(name);
    const index = this.loadOrder.indexOf(name);
    if (index > -1) {
      this.loadOrder.splice(index, 1);
    }
    
    // Reload
    await this.load(name, plugin.path, plugin.manifest);
    
    this.logger.info(`Reloaded plugin: ${name}`);
  }
  
  /**
   * Get plugin info
   * @param {string} name - Plugin name
   * @returns {object} Plugin information
   */
  getInfo(name) {
    const plugin = this.plugins.get(name);
    if (!plugin) return null;
    
    return {
      name: plugin.name,
      version: plugin.manifest.version,
      description: plugin.manifest.description,
      author: plugin.manifest.author,
      enabled: plugin.manifest.enabled !== false,
      provides: plugin.manifest.provides || {},
      requires: plugin.manifest.requires || {}
    };
  }
  
  /**
   * List all plugins with info
   * @returns {Array} Array of plugin information objects
   */
  list() {
    return this.loadOrder.map(name => this.getInfo(name));
  }
}

module.exports = PluginManager;
