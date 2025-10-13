# Core Server Rebuild Plan 🔧

**Goal:** Create a clean, modular core with a plugin system that makes adding features trivial.

**Date:** October 13, 2025  
**Status:** In Progress

---

## 🎯 Vision

**Before:** Monolithic server.js with everything hardcoded  
**After:** Lightweight core + plugin system where features register themselves

```javascript
// OLD WAY (262 lines of spaghetti)
require('./security');
require('./ids');
require('./mfa');
require('./oauth');
require('./backup');
require('./config-validator');
require('./secrets-rotation');
app.use('/api/auth', authRoutes);
app.use('/api/scanner', scannerRoutes);
app.use('/api/admin', adminRoutes);
// ... 100 more lines

// NEW WAY (clean, extensible)
const core = require('./core');
core.loadPlugins('./plugins');
core.start();
```

---

## 🏗️ New Structure

```
web-ui/
├── core/                          # Core system (minimal)
│   ├── server.js                  # Clean core server
│   ├── plugin-manager.js          # Plugin loader and manager
│   ├── service-registry.js        # Service discovery
│   ├── api-router.js              # Dynamic API routing
│   ├── middleware.js              # Core middleware only
│   └── config.js                  # Configuration management
│
├── plugins/                       # All features as plugins
│   ├── auth/                      # Authentication plugin
│   │   ├── index.js               # Plugin entry point
│   │   ├── auth.js                # Auth logic
│   │   ├── mfa.js                 # MFA logic
│   │   ├── oauth.js               # OAuth logic
│   │   ├── routes.js              # Auth routes
│   │   └── plugin.json            # Plugin manifest
│   │
│   ├── security/                  # Security plugin
│   │   ├── index.js
│   │   ├── intrusion-detection.js
│   │   ├── rate-limiting.js
│   │   ├── validation.js
│   │   ├── routes.js
│   │   └── plugin.json
│   │
│   ├── scanner/                   # Scanner plugin
│   │   ├── index.js
│   │   ├── scanner-manager.js
│   │   ├── routes.js
│   │   └── plugin.json
│   │
│   ├── storage/                   # Storage & backup plugin
│   │   ├── index.js
│   │   ├── backup.js
│   │   ├── reports.js
│   │   ├── routes.js
│   │   └── plugin.json
│   │
│   ├── admin/                     # Admin features plugin
│   │   ├── index.js
│   │   ├── user-management.js
│   │   ├── system-management.js
│   │   ├── routes.js
│   │   └── plugin.json
│   │
│   ├── compliance/                # Compliance plugin
│   │   ├── index.js
│   │   ├── compliance-manager.js
│   │   ├── routes.js
│   │   └── plugin.json
│   │
│   └── analytics/                 # Analytics plugin
│       ├── index.js
│       ├── ai-chat.js
│       ├── routes.js
│       └── plugin.json
│
├── shared/                        # Shared utilities
│   ├── logger.js                  # Logging
│   ├── utils.js                   # Common utilities
│   └── constants.js               # Constants
│
├── public/                        # Frontend (unchanged for now)
│
├── server.js                      # Entry point (super simple)
└── package.json
```

---

## 📋 Plugin System Design

### Plugin Manifest (plugin.json)

```json
{
  "name": "auth",
  "version": "1.0.0",
  "description": "Authentication and authorization",
  "author": "AI Security Scanner",
  "main": "index.js",
  "dependencies": {
    "plugins": [],
    "npm": ["bcrypt", "jsonwebtoken"]
  },
  "provides": {
    "services": ["auth", "mfa", "oauth"],
    "routes": [
      { "method": "POST", "path": "/api/auth/login" },
      { "method": "POST", "path": "/api/auth/logout" }
    ],
    "middleware": ["requireAuth", "checkMFA"],
    "hooks": ["onUserLogin", "onUserLogout"]
  },
  "requires": {
    "plugins": [],
    "services": ["logger", "database"]
  },
  "config": {
    "sessionTimeout": 3600,
    "mfaRequired": false
  },
  "enabled": true,
  "priority": 10
}
```

### Plugin Interface (index.js)

```javascript
// plugins/auth/index.js
module.exports = {
  // Plugin metadata
  name: 'auth',
  version: '1.0.0',
  
  // Initialize plugin
  async init(core) {
    this.core = core;
    this.logger = core.getService('logger');
    this.config = core.getConfig('auth');
    
    // Initialize auth service
    this.auth = require('./auth');
    await this.auth.init(core);
    
    this.logger.info('Auth plugin initialized');
  },
  
  // Register routes
  routes() {
    return require('./routes');
  },
  
  // Provide middleware
  middleware() {
    return {
      requireAuth: this.auth.requireAuth,
      checkMFA: this.auth.checkMFA
    };
  },
  
  // Provide services to other plugins
  services() {
    return {
      auth: this.auth,
      mfa: require('./mfa'),
      oauth: require('./oauth')
    };
  },
  
  // Event hooks
  hooks() {
    return {
      onUserLogin: this.onUserLogin.bind(this),
      onUserLogout: this.onUserLogout.bind(this)
    };
  },
  
  // Cleanup on shutdown
  async destroy() {
    await this.auth.cleanup();
    this.logger.info('Auth plugin destroyed');
  },
  
  // Event handlers
  async onUserLogin(user) {
    this.logger.info(`User logged in: ${user.username}`);
  },
  
  async onUserLogout(user) {
    this.logger.info(`User logged out: ${user.username}`);
  }
};
```

---

## 🔧 Core Components

### 1. Core Server (core/server.js)

```javascript
const express = require('express');
const PluginManager = require('./plugin-manager');
const ServiceRegistry = require('./service-registry');
const ApiRouter = require('./api-router');
const config = require('./config');
const { logger } = require('../shared/logger');

class CoreServer {
  constructor() {
    this.app = express();
    this.plugins = new PluginManager(this);
    this.services = new ServiceRegistry();
    this.router = new ApiRouter(this);
    this.config = config;
  }
  
  async init() {
    logger.info('Initializing core server...');
    
    // 1. Setup basic middleware
    this.setupMiddleware();
    
    // 2. Register core services
    this.registerCoreServices();
    
    // 3. Load plugins
    await this.plugins.loadAll('./plugins');
    
    // 4. Setup routes from plugins
    this.router.setupRoutes(this.plugins.getAll());
    
    // 5. Setup error handling
    this.setupErrorHandling();
    
    logger.info('Core server initialized');
  }
  
  setupMiddleware() {
    // Only essential middleware here
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(express.static('public'));
  }
  
  registerCoreServices() {
    // Register services that plugins can use
    this.services.register('logger', logger);
    this.services.register('config', config);
    this.services.register('app', this.app);
  }
  
  setupErrorHandling() {
    this.app.use((err, req, res, next) => {
      logger.error('Unhandled error:', err);
      res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    });
  }
  
  // Allow plugins to access services
  getService(name) {
    return this.services.get(name);
  }
  
  // Allow plugins to register services
  registerService(name, service) {
    this.services.register(name, service);
  }
  
  // Get configuration
  getConfig(namespace) {
    return config.get(namespace);
  }
  
  async start(port = 3000) {
    await this.init();
    
    this.server = this.app.listen(port, () => {
      logger.info(`🛡️  AI Security Scanner v4.0.0`);
      logger.info(`📡 Server running on http://localhost:${port}`);
      logger.info(`🔌 Plugins loaded: ${this.plugins.getAll().length}`);
      
      // Show loaded plugins
      this.plugins.getAll().forEach(plugin => {
        logger.info(`   ✅ ${plugin.name} v${plugin.version}`);
      });
    });
    
    // Graceful shutdown
    this.setupShutdown();
  }
  
  setupShutdown() {
    const shutdown = async () => {
      logger.info('Shutting down...');
      
      // Destroy plugins in reverse order
      await this.plugins.destroyAll();
      
      // Close server
      this.server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    };
    
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  }
}

module.exports = CoreServer;
```

### 2. Plugin Manager (core/plugin-manager.js)

```javascript
const fs = require('fs').promises;
const path = require('path');
const { logger } = require('../shared/logger');

class PluginManager {
  constructor(core) {
    this.core = core;
    this.plugins = new Map();
    this.loadOrder = [];
  }
  
  async loadAll(pluginsDir) {
    logger.info(`Loading plugins from ${pluginsDir}...`);
    
    try {
      const dirs = await fs.readdir(pluginsDir);
      
      // Load plugin manifests first
      const manifests = [];
      for (const dir of dirs) {
        const pluginPath = path.join(pluginsDir, dir);
        const manifestPath = path.join(pluginPath, 'plugin.json');
        
        try {
          const manifestData = await fs.readFile(manifestPath, 'utf8');
          const manifest = JSON.parse(manifestData);
          
          if (manifest.enabled !== false) {
            manifests.push({ manifest, pluginPath, dir });
          }
        } catch (err) {
          logger.warn(`Skipping ${dir}: ${err.message}`);
        }
      }
      
      // Sort by priority (higher = load first)
      manifests.sort((a, b) => 
        (b.manifest.priority || 0) - (a.manifest.priority || 0)
      );
      
      // Load plugins in order
      for (const { manifest, pluginPath, dir } of manifests) {
        await this.load(dir, pluginPath, manifest);
      }
      
      logger.info(`Loaded ${this.plugins.size} plugins`);
      
    } catch (err) {
      logger.error('Error loading plugins:', err);
      throw err;
    }
  }
  
  async load(name, pluginPath, manifest) {
    try {
      logger.info(`Loading plugin: ${name}...`);
      
      // Check dependencies
      if (manifest.requires?.plugins) {
        for (const dep of manifest.requires.plugins) {
          if (!this.plugins.has(dep)) {
            throw new Error(`Missing dependency: ${dep}`);
          }
        }
      }
      
      // Load plugin module
      const Plugin = require(pluginPath);
      
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
      const services = Plugin.services?.() || {};
      for (const [serviceName, service] of Object.entries(services)) {
        this.core.registerService(`${name}.${serviceName}`, service);
      }
      
      logger.info(`✅ Loaded plugin: ${name} v${manifest.version}`);
      
    } catch (err) {
      logger.error(`Failed to load plugin ${name}:`, err);
      throw err;
    }
  }
  
  get(name) {
    return this.plugins.get(name);
  }
  
  getAll() {
    return Array.from(this.plugins.values());
  }
  
  async destroyAll() {
    // Destroy in reverse order
    for (let i = this.loadOrder.length - 1; i >= 0; i--) {
      const name = this.loadOrder[i];
      const plugin = this.plugins.get(name);
      
      if (plugin?.instance.destroy) {
        try {
          await plugin.instance.destroy();
          logger.info(`Destroyed plugin: ${name}`);
        } catch (err) {
          logger.error(`Error destroying plugin ${name}:`, err);
        }
      }
    }
  }
}

module.exports = PluginManager;
```

### 3. Service Registry (core/service-registry.js)

```javascript
const { logger } = require('../shared/logger');

class ServiceRegistry {
  constructor() {
    this.services = new Map();
  }
  
  register(name, service) {
    if (this.services.has(name)) {
      logger.warn(`Service ${name} already registered, overwriting`);
    }
    
    this.services.set(name, service);
    logger.debug(`Registered service: ${name}`);
  }
  
  get(name) {
    if (!this.services.has(name)) {
      throw new Error(`Service not found: ${name}`);
    }
    
    return this.services.get(name);
  }
  
  has(name) {
    return this.services.has(name);
  }
  
  getAll() {
    return Array.from(this.services.entries());
  }
}

module.exports = ServiceRegistry;
```

### 4. API Router (core/api-router.js)

```javascript
const express = require('express');
const { logger } = require('../shared/logger');

class ApiRouter {
  constructor(core) {
    this.core = core;
    this.routes = [];
  }
  
  setupRoutes(plugins) {
    logger.info('Setting up routes from plugins...');
    
    for (const plugin of plugins) {
      const routes = plugin.instance.routes?.();
      const middleware = plugin.instance.middleware?.();
      
      if (routes) {
        this.registerRoutes(plugin.name, routes, middleware);
      }
    }
    
    logger.info(`Registered ${this.routes.length} routes`);
  }
  
  registerRoutes(pluginName, routerOrRoutes, middleware = {}) {
    const app = this.core.app;
    
    // If it's an Express router, use it directly
    if (routerOrRoutes.stack) {
      app.use(routerOrRoutes);
      logger.debug(`Registered router from plugin: ${pluginName}`);
      return;
    }
    
    // If it's a route definition object
    if (typeof routerOrRoutes === 'object') {
      for (const [path, config] of Object.entries(routerOrRoutes)) {
        this.registerRoute(pluginName, path, config, middleware);
      }
    }
  }
  
  registerRoute(pluginName, path, config, middleware) {
    const app = this.core.app;
    const method = (config.method || 'get').toLowerCase();
    const handler = config.handler;
    const routeMiddleware = [];
    
    // Add middleware if specified
    if (config.middleware) {
      for (const mw of config.middleware) {
        if (typeof mw === 'string' && middleware[mw]) {
          routeMiddleware.push(middleware[mw]);
        } else if (typeof mw === 'function') {
          routeMiddleware.push(mw);
        }
      }
    }
    
    // Register route
    app[method](path, ...routeMiddleware, handler);
    
    this.routes.push({
      plugin: pluginName,
      method: method.toUpperCase(),
      path,
      middleware: routeMiddleware.length
    });
    
    logger.debug(`Registered route: ${method.toUpperCase()} ${path} [${pluginName}]`);
  }
}

module.exports = ApiRouter;
```

### 5. Configuration Manager (core/config.js)

```javascript
require('dotenv').config();

class Config {
  constructor() {
    this.config = {
      server: {
        port: process.env.PORT || 3000,
        env: process.env.NODE_ENV || 'development',
        ssl: {
          enabled: !!process.env.SSL_CERT_PATH,
          cert: process.env.SSL_CERT_PATH,
          key: process.env.SSL_KEY_PATH
        }
      },
      auth: {
        sessionSecret: process.env.SESSION_SECRET,
        sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
        mfaRequired: process.env.MFA_REQUIRED === 'true'
      },
      security: {
        rateLimiting: {
          enabled: true,
          windowMs: 15 * 60 * 1000, // 15 minutes
          max: 100 // requests per window
        },
        helmet: {
          enabled: true
        }
      },
      plugins: {
        directory: './plugins',
        autoLoad: true
      }
    };
  }
  
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
}

module.exports = new Config();
```

---

## 🔌 Example Plugins

### Auth Plugin (plugins/auth/index.js)

```javascript
const auth = require('./auth');
const mfa = require('./mfa');
const oauth = require('./oauth');
const routes = require('./routes');

module.exports = {
  name: 'auth',
  version: '1.0.0',
  
  async init(core) {
    this.core = core;
    this.logger = core.getService('logger');
    
    // Initialize auth components
    await auth.init(core);
    await mfa.init(core);
    await oauth.init(core);
    
    this.logger.info('Auth plugin initialized');
  },
  
  routes() {
    return routes;
  },
  
  middleware() {
    return {
      requireAuth: auth.requireAuth,
      requireAdmin: auth.requireAdmin,
      checkMFA: mfa.checkMFA
    };
  },
  
  services() {
    return {
      auth,
      mfa,
      oauth
    };
  },
  
  async destroy() {
    await auth.cleanup();
    this.logger.info('Auth plugin destroyed');
  }
};
```

### Scanner Plugin (plugins/scanner/index.js)

```javascript
const scanner = require('./scanner-manager');
const routes = require('./routes');

module.exports = {
  name: 'scanner',
  version: '1.0.0',
  
  async init(core) {
    this.core = core;
    this.logger = core.getService('logger');
    
    await scanner.init(core);
    
    this.logger.info('Scanner plugin initialized');
  },
  
  routes() {
    return routes;
  },
  
  services() {
    return {
      scanner
    };
  },
  
  async destroy() {
    await scanner.cleanup();
    this.logger.info('Scanner plugin destroyed');
  }
};
```

---

## 🚀 Entry Point (server.js)

```javascript
#!/usr/bin/env node
const CoreServer = require('./core/server');

const server = new CoreServer();

server.start(process.env.PORT || 3000)
  .catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });

module.exports = server;
```

**That's it! 10 lines vs 262 lines!**

---

## 📦 Migration Process

### Step 1: Create Core (This Session)
1. Create `core/` directory
2. Implement core server
3. Implement plugin manager
4. Implement service registry
5. Implement API router
6. Implement config manager

### Step 2: Create Plugin Structure
1. Create `plugins/` directory
2. Create plugin templates
3. Document plugin API

### Step 3: Migrate Features to Plugins (One by One)
1. **Auth Plugin** (auth, mfa, oauth, ids)
2. **Security Plugin** (rate limiting, validation, headers)
3. **Scanner Plugin** (scanning functionality)
4. **Storage Plugin** (backups, reports)
5. **Admin Plugin** (admin features)
6. **Compliance Plugin** (compliance frameworks)
7. **Analytics Plugin** (AI chat, analysis)

### Step 4: Test Each Plugin
- Unit tests
- Integration tests
- Verify functionality
- Performance check

### Step 5: Switch Over
- Update server.js to use core
- Test thoroughly
- Update documentation
- Release v4.0.0

---

## 🎯 Benefits

### For Development
- ✅ **Clean separation** - Each feature is isolated
- ✅ **Easy testing** - Test plugins independently
- ✅ **Hot reload** - Reload plugins without restart (future)
- ✅ **Clear dependencies** - plugin.json shows requirements
- ✅ **Easy debugging** - Enable/disable plugins to isolate issues

### For Features
- ✅ **VPN as plugin** - Just drop in plugins/vpn/
- ✅ **Future features** - Add plugin, restart, done
- ✅ **Third-party plugins** - Community can create plugins
- ✅ **Plugin marketplace** - Share plugins (future)

### For Users
- ✅ **Choose features** - Enable only what you need
- ✅ **Lower resource usage** - Disabled plugins don't load
- ✅ **Customizable** - Configure each plugin separately
- ✅ **Updates** - Update individual plugins

### For Maintenance
- ✅ **Less coupling** - Changes don't cascade
- ✅ **Easier refactoring** - Refactor one plugin at a time
- ✅ **Clear structure** - Know where everything is
- ✅ **Self-documenting** - plugin.json documents capabilities

---

## 🛠️ Implementation Plan

### This Session:
1. ✅ Create CORE_REBUILD_PLAN.md (this file)
2. Create core/ directory structure
3. Implement CoreServer class
4. Implement PluginManager class
5. Implement ServiceRegistry class
6. Implement ApiRouter class
7. Implement Config class
8. Create simple server.js entry point

### Next Session:
1. Create plugins/ directory structure
2. Migrate auth functionality to auth plugin
3. Test auth plugin
4. Document plugin creation guide

### Future Sessions:
1. Migrate remaining features to plugins
2. Enhance plugin system (events, hooks)
3. Create plugin marketplace concept
4. Add VPN as new plugin

---

## 📝 Notes

### Design Decisions

**Why Plugin System?**
- Makes code modular and maintainable
- Easy to add/remove features
- Clear boundaries between features
- Industry standard (WordPress, VSCode, etc.)

**Why Not Just Microservices?**
- Plugins are lighter weight
- Easier to develop locally
- Can be converted to microservices later
- Start simple, scale as needed

**Why Keep Monorepo?**
- Easier development
- Shared dependencies
- Consistent versioning
- Can split later if needed

---

## ✅ Ready to Build?

This plan creates a clean, maintainable foundation that will make adding VPN (and any future feature) trivial.

**Next step:** Implement the core system!
