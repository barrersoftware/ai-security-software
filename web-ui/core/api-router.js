/**
 * API Router
 * Dynamically sets up routes from plugins
 */

const express = require('express');
const { createPluginLogger } = require('../shared/logger');

class ApiRouter {
  constructor(core) {
    this.core = core;
    this.routes = [];
    this.logger = createPluginLogger('api-router');
  }
  
  /**
   * Setup routes from all plugins
   * @param {Array} plugins - Array of plugin objects
   */
  setupRoutes(plugins) {
    this.logger.info('Setting up routes from plugins...');
    
    for (const plugin of plugins) {
      if (!plugin.instance.routes) continue;
      
      try {
        const routes = plugin.instance.routes();
        const middleware = plugin.instance.middleware?.() || {};
        
        if (routes) {
          this.registerPluginRoutes(plugin.name, routes, middleware);
        }
      } catch (err) {
        this.logger.error(`Error setting up routes for plugin ${plugin.name}:`, err);
      }
    }
    
    this.logger.info(`Registered ${this.routes.length} routes from ${plugins.length} plugins`);
  }
  
  /**
   * Register routes from a plugin
   * @param {string} pluginName - Name of the plugin
   * @param {*} routerOrRoutes - Express router or route definitions
   * @param {object} middleware - Middleware functions from plugin
   */
  registerPluginRoutes(pluginName, routerOrRoutes, middleware = {}) {
    const app = this.core.app;
    
    // If it's an Express router, use it directly
    // Check for Express router by checking if it has a stack property (layer stack)
    if (routerOrRoutes && typeof routerOrRoutes === 'function' && routerOrRoutes.stack) {
      app.use(routerOrRoutes);
      this.logger.info(`Registered Express router from plugin: ${pluginName} (${routerOrRoutes.stack.length} routes)`);
      this.routes.push({
        plugin: pluginName,
        type: 'router',
        count: routerOrRoutes.stack.length
      });
      return;
    }
    
    // If it's a route definition object
    if (typeof routerOrRoutes === 'object' && !Array.isArray(routerOrRoutes)) {
      for (const [path, config] of Object.entries(routerOrRoutes)) {
        this.registerRoute(pluginName, path, config, middleware);
      }
    }
  }
  
  /**
   * Register a single route
   * @param {string} pluginName - Plugin name
   * @param {string} path - Route path
   * @param {object} config - Route configuration
   * @param {object} middleware - Available middleware
   */
  registerRoute(pluginName, path, config, middleware) {
    const app = this.core.app;
    const method = (config.method || 'get').toLowerCase();
    const handler = config.handler;
    const routeMiddleware = [];
    
    if (!handler || typeof handler !== 'function') {
      this.logger.error(`Invalid handler for route ${method.toUpperCase()} ${path} in plugin ${pluginName}`);
      return;
    }
    
    // Add middleware if specified
    if (config.middleware) {
      const middlewareList = Array.isArray(config.middleware) ? config.middleware : [config.middleware];
      
      for (const mw of middlewareList) {
        if (typeof mw === 'string' && middleware[mw]) {
          routeMiddleware.push(middleware[mw]);
        } else if (typeof mw === 'function') {
          routeMiddleware.push(mw);
        } else {
          this.logger.warn(`Middleware ${mw} not found for route ${path} in plugin ${pluginName}`);
        }
      }
    }
    
    // Register route with Express
    app[method](path, ...routeMiddleware, handler);
    
    this.routes.push({
      plugin: pluginName,
      method: method.toUpperCase(),
      path,
      middleware: routeMiddleware.length
    });
    
    this.logger.debug(`Registered route: ${method.toUpperCase()} ${path} [${pluginName}]`);
  }
  
  /**
   * Get all registered routes
   * @returns {Array} Array of route objects
   */
  getRoutes() {
    return [...this.routes];
  }
  
  /**
   * Get routes for a specific plugin
   * @param {string} pluginName - Plugin name
   * @returns {Array} Array of route objects
   */
  getPluginRoutes(pluginName) {
    return this.routes.filter(route => route.plugin === pluginName);
  }
  
  /**
   * Print route table (useful for debugging)
   */
  printRoutes() {
    console.log('\n📋 Registered Routes:');
    console.log('─'.repeat(80));
    
    const byPlugin = {};
    for (const route of this.routes) {
      if (!byPlugin[route.plugin]) {
        byPlugin[route.plugin] = [];
      }
      byPlugin[route.plugin].push(route);
    }
    
    for (const [plugin, routes] of Object.entries(byPlugin)) {
      console.log(`\n🔌 ${plugin}:`);
      
      for (const route of routes) {
        if (route.type === 'router') {
          console.log(`   Router with ${route.count} routes`);
        } else {
          const mw = route.middleware > 0 ? ` (+${route.middleware} middleware)` : '';
          console.log(`   ${route.method.padEnd(7)} ${route.path}${mw}`);
        }
      }
    }
    
    console.log('\n' + '─'.repeat(80));
    console.log(`Total: ${this.routes.length} routes from ${Object.keys(byPlugin).length} plugins\n`);
  }
}

module.exports = ApiRouter;
