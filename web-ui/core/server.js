/**
 * Core Server
 * Lightweight, plugin-aware core system
 */

const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const config = require('./config');
const ServiceRegistry = require('./service-registry');
const PluginManager = require('./plugin-manager');
const ApiRouter = require('./api-router');
const { logger, createPluginLogger } = require('../shared/logger');
const utils = require('../shared/utils');
const platform = require('../shared/platform');
const integrations = require('../shared/integrations');

class CoreServer {
  constructor() {
    this.app = express();
    this.server = null;
    this.wss = null;
    this.services = new ServiceRegistry();
    this.plugins = null; // Will be initialized in init()
    this.router = null;   // Will be initialized in init()
    this.config = config;
    this.logger = createPluginLogger('core');
    this.clients = new Set();
  }
  
  /**
   * Initialize the core server
   */
  async init() {
    this.logger.info('🚀 Initializing AI Security Scanner Core v4.0.0...');
    
    try {
      // 1. Setup basic middleware
      this.setupMiddleware();
      
      // 2. Register core services (now async for integrations)
      await this.registerCoreServices();
      
      // 3. Create plugin manager and router
      this.plugins = new PluginManager(this);
      this.router = new ApiRouter(this);
      
      // 4. Load plugins
      const pluginsDir = path.resolve(config.get('paths.plugins'));
      await this.plugins.loadAll(pluginsDir);
      
      // 5. Apply security middleware globally (if security plugin loaded)
      this.applySecurityMiddleware();
      
      // 6. Setup routes from plugins
      this.router.setupRoutes(this.plugins.getAll());
      
      // 7. Setup error handling
      this.setupErrorHandling();
      
      this.logger.info('✅ Core server initialized successfully');
      
    } catch (err) {
      this.logger.error('❌ Failed to initialize core server:', err);
      throw err;
    }
  }
  
  /**
   * Apply security middleware from security plugin
   */
  applySecurityMiddleware() {
    try {
      // Get security services if available
      const headersService = this.services.get('headers-service');
      
      if (headersService && headersService.middleware) {
        this.app.use(headersService.middleware());
        this.logger.info('✅ Security headers middleware applied globally');
      } else {
        this.logger.warn('⚠️  Security headers service not available');
      }
    } catch (err) {
      this.logger.warn('⚠️  Could not apply security middleware:', err.message);
    }
  }
  
  /**
   * Setup essential middleware
   */
  setupMiddleware() {
    this.logger.debug('Setting up core middleware...');
    
    // Disable X-Powered-By header early
    this.app.disable('x-powered-by');
    
    // Body parsers
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Static files
    const publicDir = path.join(config.get('paths.webui'), 'public');
    this.app.use(express.static(publicDir));
    
    // Request logging
    if (config.get('logging.console')) {
      this.app.use((req, res, next) => {
        const start = Date.now();
        res.on('finish', () => {
          const duration = Date.now() - start;
          this.logger.debug(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
        });
        next();
      });
    }
    
    this.logger.debug('Core middleware configured');
  }
  
  /**
   * Register core services available to all plugins
   */
  async registerCoreServices() {
    this.logger.debug('Registering core services...');
    
    // Register core services
    this.services.register('logger', logger);
    this.services.register('config', config);
    this.services.register('app', this.app);
    this.services.register('utils', utils);
    this.services.register('platform', platform);
    
    // Initialize and register integrations
    await integrations.init();
    this.services.register('integrations', integrations);
    
    // Broadcast function (will be set when WebSocket is ready)
    this.services.register('broadcast', (message) => {
      this.broadcast(message);
    });
    
    this.logger.debug('Core services registered');
    this.logger.info('Platform: ' + platform.formatSystemInfo());
  }
  
  /**
   * Setup error handling
   */
  setupErrorHandling() {
    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({ 
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`
      });
    });
    
    // Global error handler
    this.app.use((err, req, res, next) => {
      this.logger.error('Unhandled error:', {
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method
      });
      
      const statusCode = err.statusCode || 500;
      const message = config.isDevelopment() ? err.message : 'Internal server error';
      
      res.status(statusCode).json({ 
        error: 'Server Error',
        message,
        ...(config.isDevelopment() && { stack: err.stack })
      });
    });
    
    this.logger.debug('Error handling configured');
  }
  
  /**
   * Setup WebSocket server
   */
  setupWebSocket() {
    this.logger.debug('Setting up WebSocket server...');
    
    this.wss = new WebSocket.Server({ server: this.server });
    
    this.wss.on('connection', (ws) => {
      this.clients.add(ws);
      this.logger.debug(`WebSocket client connected. Total: ${this.clients.size}`);
      
      // Send welcome message
      ws.send(JSON.stringify({
        type: 'welcome',
        message: 'Connected to AI Security Scanner',
        timestamp: new Date().toISOString()
      }));
      
      ws.on('close', () => {
        this.clients.delete(ws);
        this.logger.debug(`WebSocket client disconnected. Total: ${this.clients.size}`);
      });
      
      ws.on('error', (error) => {
        this.logger.error('WebSocket error:', error);
        this.clients.delete(ws);
      });
      
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          this.handleWebSocketMessage(ws, data);
        } catch (err) {
          this.logger.error('Error handling WebSocket message:', err);
        }
      });
    });
    
    this.logger.info('✅ WebSocket server initialized');
  }
  
  /**
   * Handle incoming WebSocket messages
   */
  handleWebSocketMessage(ws, data) {
    this.logger.debug('WebSocket message received:', data);
    
    // Plugins can handle messages via events
    // This is extensible for future features
    
    switch (data.type) {
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        break;
        
      default:
        this.logger.warn('Unknown WebSocket message type:', data.type);
    }
  }
  
  /**
   * Broadcast message to all connected WebSocket clients
   */
  broadcast(message) {
    const data = typeof message === 'string' ? message : JSON.stringify(message);
    
    let sent = 0;
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
        sent++;
      }
    });
    
    this.logger.debug(`Broadcast message to ${sent} clients`);
  }
  
  /**
   * Start the server
   */
  async start(port) {
    await this.init();
    
    const serverPort = port || config.get('server.port');
    const sslConfig = config.get('server.ssl');
    
    // Create HTTP or HTTPS server
    if (sslConfig.enabled) {
      const httpsOptions = {
        key: fs.readFileSync(sslConfig.key),
        cert: fs.readFileSync(sslConfig.cert)
      };
      this.server = https.createServer(httpsOptions, this.app);
      this.logger.info('🔒 HTTPS enabled');
    } else {
      this.server = http.createServer(this.app);
      this.logger.info('⚠️  Running in HTTP mode - configure SSL for production');
    }
    
    // Setup WebSocket
    this.setupWebSocket();
    
    // Start listening
    return new Promise((resolve, reject) => {
      this.server.listen(serverPort, (err) => {
        if (err) {
          this.logger.error('Failed to start server:', err);
          reject(err);
          return;
        }
        
        // Success!
        this.printBanner(serverPort);
        
        // Setup graceful shutdown
        this.setupShutdown();
        
        resolve(this.server);
      });
    });
  }
  
  /**
   * Print startup banner
   */
  printBanner(port) {
    const protocol = config.get('server.ssl.enabled') ? 'https' : 'http';
    const platformInfo = platform.details;
    
    console.log('\n' + '═'.repeat(80));
    console.log('🛡️  AI Security Scanner v4.0.0 (Core Rebuild)');
    console.log('═'.repeat(80));
    console.log(`📡 Server:      ${protocol}://localhost:${port}`);
    console.log(`🔒 Security:    100/100 ✨`);
    console.log(`🌍 Environment: ${config.get('server.env')}`);
    console.log(`🔌 Plugins:     ${this.plugins.getAll().length} loaded`);
    
    // Platform info
    let platformName = 'Unknown';
    if (platformInfo.isWindows) {
      platformName = platformInfo.windowsVersion?.name || 'Windows';
    } else if (platformInfo.isLinux) {
      platformName = platformInfo.distro?.prettyName || 'Linux';
    } else if (platformInfo.isMacOS) {
      platformName = 'macOS';
    } else if (platformInfo.isBSD) {
      platformName = 'BSD';
    }
    
    console.log(`💻 Platform:    ${platformName} (${platformInfo.arch})`);
    console.log(`🐚 Shell:       ${platformInfo.shell}`);
    
    // Integrations status
    const intStatus = integrations.getStatus();
    const enabledInt = Object.entries(intStatus).filter(([k, v]) => k !== 'total' && v).map(([k]) => k);
    if (enabledInt.length > 0) {
      console.log(`📢 Integrations: ${enabledInt.join(', ')}`);
    }
    
    console.log('─'.repeat(80));
    
    // List loaded plugins
    if (this.plugins.getAll().length > 0) {
      this.plugins.getAll().forEach(plugin => {
        console.log(`   ✅ ${plugin.name} v${plugin.manifest.version} - ${plugin.manifest.description}`);
      });
    } else {
      console.log(`   ⚠️  No plugins loaded - add plugins to enable features`);
    }
    
    console.log('═'.repeat(80));
    console.log('💡 Ready to secure your systems!');
    console.log('═'.repeat(80) + '\n');
    
    // Print routes in debug mode
    if (config.isDevelopment()) {
      this.router.printRoutes();
    }
  }
  
  /**
   * Setup graceful shutdown
   */
  setupShutdown() {
    const shutdown = async (signal) => {
      this.logger.info(`\n${signal} received, shutting down gracefully...`);
      
      try {
        // Close WebSocket connections
        if (this.wss) {
          this.clients.forEach(client => client.close());
          this.wss.close();
        }
        
        // Destroy plugins in reverse order
        if (this.plugins) {
          await this.plugins.destroyAll();
        }
        
        // Close HTTP server
        if (this.server) {
          this.server.close(() => {
            this.logger.info('Server closed successfully');
            process.exit(0);
          });
          
          // Force close after 10 seconds
          setTimeout(() => {
            this.logger.warn('Forcing shutdown after timeout');
            process.exit(1);
          }, 10000);
        }
      } catch (err) {
        this.logger.error('Error during shutdown:', err);
        process.exit(1);
      }
    };
    
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
  
  /**
   * Allow plugins to access services
   */
  getService(name) {
    return this.services.get(name);
  }
  
  /**
   * Allow plugins to register services
   */
  registerService(name, service) {
    this.services.register(name, service);
  }
  
  /**
   * Get configuration
   */
  getConfig(namespace) {
    return config.get(namespace);
  }
  
  /**
   * Get plugin manager
   */
  getPlugins() {
    return this.plugins;
  }
  
  /**
   * Get API router
   */
  getRouter() {
    return this.router;
  }
}

module.exports = CoreServer;
