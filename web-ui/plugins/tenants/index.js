/**
 * Tenants Plugin - Multi-Tenancy Support
 * Provides tenant isolation, management, and resource limits
 * v4.1.0
 */

const express = require('express');
const TenantManager = require('./tenant-manager');
const TenantMiddleware = require('./tenant-middleware');
const ResourceLimiter = require('./resource-limiter');
const UsageTracker = require('./usage-tracker');

module.exports = {
  name: 'tenants',
  version: '1.0.0',
  description: 'Multi-tenancy support with data isolation and resource limits',

  async init(core) {
    this.core = core;
    this.logger = core.getService('logger');

    // Initialize tenant management services
    this.tenantManager = new TenantManager(core);
    this.tenantMiddleware = new TenantMiddleware(core);
    this.resourceLimiter = new ResourceLimiter(core);
    this.usageTracker = new UsageTracker(core);

    // Register services for other plugins to use
    core.registerService('tenant-manager', this.tenantManager);
    core.registerService('tenant-middleware', this.tenantMiddleware);
    core.registerService('resource-limiter', this.resourceLimiter);
    core.registerService('usage-tracker', this.usageTracker);

    // Load existing tenants from storage
    await this.tenantManager.loadTenants();

    // Create default tenant if none exist
    const tenants = await this.tenantManager.listTenants();
    if (tenants.length === 0) {
      await this.tenantManager.createTenant({
        name: 'Default Organization',
        slug: 'default',
        status: 'active',
        settings: {
          allowedDomains: ['*'],
          features: {
            vpn: true,
            scanning: true,
            storage: true,
            admin: true
          }
        },
        limits: {
          users: 1000,
          scans: 10000,
          storage: '1TB',
          vpnClients: 100
        }
      });
      this.logger?.info('Default tenant created');
    }

    this.logger?.info('Tenants plugin initialized');
  },

  /**
   * Get middleware for tenant context
   */
  middleware() {
    return {
      // Extract tenant from request (subdomain, header, or token)
      extractTenant: this.tenantMiddleware.extractTenant.bind(this.tenantMiddleware),
      
      // Validate tenant exists and is active
      validateTenant: this.tenantMiddleware.validateTenant.bind(this.tenantMiddleware),
      
      // Check resource limits before operation
      checkLimits: (resource) => this.resourceLimiter.checkLimit.bind(this.resourceLimiter, resource),
      
      // Track usage after operation
      trackUsage: (resource) => this.usageTracker.trackUsage.bind(this.usageTracker, resource)
    };
  },

  routes() {
    const router = express.Router();

    // Get auth plugin middleware
    const authPlugin = this.core.pluginManager?.getPlugin('auth');
    let requireAuth = (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      next();
    };

    if (authPlugin && authPlugin.middleware) {
      const authMiddleware = authPlugin.middleware();
      requireAuth = authMiddleware.requireAuth || requireAuth;
    }

    // Super admin only middleware
    const requireSuperAdmin = (req, res, next) => {
      if (!req.user || req.user.role !== 'super-admin') {
        return res.status(403).json({ error: 'Super admin access required' });
      }
      next();
    };

    // Tenant admin middleware
    const requireTenantAdmin = (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const tenantId = req.params.id || req.tenantId;
      
      // Super admins can access all tenants
      if (req.user.role === 'super-admin') {
        return next();
      }
      
      // Check if user is admin of this specific tenant
      if (req.user.role === 'admin' && req.user.tenantId === tenantId) {
        return next();
      }
      
      return res.status(403).json({ error: 'Tenant admin access required' });
    };

    // ==========================================
    // TENANT MANAGEMENT ROUTES
    // ==========================================

    /**
     * POST /api/tenants
     * Create a new tenant (super-admin only)
     */
    router.post('/', requireAuth, requireSuperAdmin, async (req, res) => {
      try {
        const { name, slug, settings, limits } = req.body;

        if (!name || !slug) {
          return res.status(400).json({ 
            error: 'Name and slug are required' 
          });
        }

        const tenant = await this.tenantManager.createTenant({
          name,
          slug,
          status: 'active',
          settings: settings || {},
          limits: limits || {}
        });

        // Log audit event
        const auditLogger = this.core.getService('audit-logger');
        if (auditLogger) {
          auditLogger.log({
            userId: req.user.id,
            username: req.user.username,
            action: 'tenant_created',
            resource: `/api/tenants/${tenant.id}`,
            details: { tenantName: name, slug },
            status: 'success',
            ip: req.ip
          });
        }

        res.status(201).json({ 
          success: true, 
          tenant 
        });
      } catch (error) {
        this.logger?.error('Error creating tenant:', error);
        res.status(500).json({ 
          error: error.message || 'Failed to create tenant' 
        });
      }
    });

    /**
     * GET /api/tenants
     * List all tenants (super-admin) or current tenant (tenant-admin)
     */
    router.get('/', requireAuth, async (req, res) => {
      try {
        let tenants;

        if (req.user.role === 'super-admin') {
          // Super admin can see all tenants
          tenants = await this.tenantManager.listTenants();
        } else if (req.user.tenantId) {
          // Regular users see only their tenant
          const tenant = await this.tenantManager.getTenant(req.user.tenantId);
          tenants = tenant ? [tenant] : [];
        } else {
          tenants = [];
        }

        res.json({ 
          success: true, 
          tenants,
          count: tenants.length 
        });
      } catch (error) {
        this.logger?.error('Error listing tenants:', error);
        res.status(500).json({ 
          error: 'Failed to list tenants' 
        });
      }
    });

    /**
     * GET /api/tenants/:id
     * Get tenant details
     */
    router.get('/:id', requireAuth, requireTenantAdmin, async (req, res) => {
      try {
        const tenant = await this.tenantManager.getTenant(req.params.id);
        
        if (!tenant) {
          return res.status(404).json({ 
            error: 'Tenant not found' 
          });
        }

        res.json({ 
          success: true, 
          tenant 
        });
      } catch (error) {
        this.logger?.error('Error getting tenant:', error);
        res.status(500).json({ 
          error: 'Failed to get tenant' 
        });
      }
    });

    /**
     * PUT /api/tenants/:id
     * Update tenant details
     */
    router.put('/:id', requireAuth, requireTenantAdmin, async (req, res) => {
      try {
        const { name, settings, status } = req.body;
        const updates = {};

        if (name) updates.name = name;
        if (settings) updates.settings = settings;
        
        // Only super-admins can change status
        if (status && req.user.role === 'super-admin') {
          updates.status = status;
        }

        const tenant = await this.tenantManager.updateTenant(
          req.params.id, 
          updates
        );

        // Log audit event
        const auditLogger = this.core.getService('audit-logger');
        if (auditLogger) {
          auditLogger.log({
            userId: req.user.id,
            username: req.user.username,
            action: 'tenant_updated',
            resource: `/api/tenants/${req.params.id}`,
            details: updates,
            status: 'success',
            ip: req.ip
          });
        }

        res.json({ 
          success: true, 
          tenant 
        });
      } catch (error) {
        this.logger?.error('Error updating tenant:', error);
        res.status(500).json({ 
          error: error.message || 'Failed to update tenant' 
        });
      }
    });

    /**
     * DELETE /api/tenants/:id
     * Delete a tenant (super-admin only)
     */
    router.delete('/:id', requireAuth, requireSuperAdmin, async (req, res) => {
      try {
        // Don't allow deleting default tenant
        const tenant = await this.tenantManager.getTenant(req.params.id);
        if (tenant && tenant.slug === 'default') {
          return res.status(400).json({ 
            error: 'Cannot delete default tenant' 
          });
        }

        await this.tenantManager.deleteTenant(req.params.id);

        // Log audit event
        const auditLogger = this.core.getService('audit-logger');
        if (auditLogger) {
          auditLogger.log({
            userId: req.user.id,
            username: req.user.username,
            action: 'tenant_deleted',
            resource: `/api/tenants/${req.params.id}`,
            status: 'success',
            severity: 'high',
            ip: req.ip
          });
        }

        res.json({ 
          success: true, 
          message: 'Tenant deleted successfully' 
        });
      } catch (error) {
        this.logger?.error('Error deleting tenant:', error);
        res.status(500).json({ 
          error: error.message || 'Failed to delete tenant' 
        });
      }
    });

    /**
     * GET /api/tenants/:id/stats
     * Get tenant usage statistics
     */
    router.get('/:id/stats', requireAuth, requireTenantAdmin, async (req, res) => {
      try {
        const stats = await this.usageTracker.getTenantStats(req.params.id);
        
        res.json({ 
          success: true, 
          stats 
        });
      } catch (error) {
        this.logger?.error('Error getting tenant stats:', error);
        res.status(500).json({ 
          error: 'Failed to get tenant statistics' 
        });
      }
    });

    /**
     * PUT /api/tenants/:id/limits
     * Update resource limits (super-admin only)
     */
    router.put('/:id/limits', requireAuth, requireSuperAdmin, async (req, res) => {
      try {
        const { limits } = req.body;
        
        if (!limits) {
          return res.status(400).json({ 
            error: 'Limits object required' 
          });
        }

        const tenant = await this.tenantManager.updateTenant(
          req.params.id,
          { limits }
        );

        // Log audit event
        const auditLogger = this.core.getService('audit-logger');
        if (auditLogger) {
          auditLogger.log({
            userId: req.user.id,
            username: req.user.username,
            action: 'tenant_limits_updated',
            resource: `/api/tenants/${req.params.id}/limits`,
            details: { limits },
            status: 'success',
            ip: req.ip
          });
        }

        res.json({ 
          success: true, 
          tenant 
        });
      } catch (error) {
        this.logger?.error('Error updating tenant limits:', error);
        res.status(500).json({ 
          error: 'Failed to update limits' 
        });
      }
    });

    /**
     * GET /api/tenants/:id/users
     * List users in a tenant
     */
    router.get('/:id/users', requireAuth, requireTenantAdmin, async (req, res) => {
      try {
        const userManager = this.core.getService('user-manager');
        
        if (!userManager) {
          return res.status(503).json({ 
            error: 'User manager service not available' 
          });
        }

        // Get all users and filter by tenant
        const allUsers = await userManager.listUsers({ limit: 1000 });
        const tenantUsers = allUsers.users.filter(
          user => user.tenantId === req.params.id
        );

        res.json({ 
          success: true, 
          users: tenantUsers,
          count: tenantUsers.length 
        });
      } catch (error) {
        this.logger?.error('Error listing tenant users:', error);
        res.status(500).json({ 
          error: 'Failed to list tenant users' 
        });
      }
    });

    /**
     * POST /api/tenants/:id/users
     * Add user to tenant
     */
    router.post('/:id/users', requireAuth, requireTenantAdmin, async (req, res) => {
      try {
        const { username, email, password, role } = req.body;
        const userManager = this.core.getService('user-manager');
        
        if (!userManager) {
          return res.status(503).json({ 
            error: 'User manager service not available' 
          });
        }

        // Check tenant user limit
        const canAdd = await this.resourceLimiter.checkLimit(
          req.params.id,
          'users'
        );

        if (!canAdd) {
          return res.status(429).json({ 
            error: 'Tenant user limit reached' 
          });
        }

        // Create user with tenant association
        const user = await userManager.createUser({
          username,
          email,
          password,
          role: role || 'user',
          tenantId: req.params.id
        });

        // Track usage
        await this.usageTracker.trackUsage(req.params.id, 'users', 1);

        // Log audit event
        const auditLogger = this.core.getService('audit-logger');
        if (auditLogger) {
          auditLogger.log({
            userId: req.user.id,
            username: req.user.username,
            action: 'tenant_user_added',
            resource: `/api/tenants/${req.params.id}/users`,
            details: { newUser: username },
            status: 'success',
            ip: req.ip
          });
        }

        res.status(201).json({ 
          success: true, 
          user 
        });
      } catch (error) {
        this.logger?.error('Error adding user to tenant:', error);
        res.status(500).json({ 
          error: error.message || 'Failed to add user' 
        });
      }
    });

    return router;
  }
};
