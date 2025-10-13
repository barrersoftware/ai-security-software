/**
 * Tenant Middleware
 * Extracts and validates tenant context from requests
 */

class TenantMiddleware {
  constructor(core) {
    this.core = core;
    this.logger = core.getService('logger');
  }

  /**
   * Extract tenant from request
   * Supports multiple methods:
   * 1. Subdomain (tenant.example.com)
   * 2. Header (X-Tenant-ID or X-Tenant-Slug)
   * 3. User's tenantId
   * 4. Query parameter (?tenant=slug)
   */
  extractTenant() {
    return async (req, res, next) => {
      try {
        const tenantManager = this.core.getService('tenant-manager');
        
        if (!tenantManager) {
          this.logger?.warn('Tenant manager not available');
          return next();
        }

        let tenant = null;

        // Method 1: Check for tenant header (ID or slug)
        const tenantId = req.headers['x-tenant-id'];
        const tenantSlug = req.headers['x-tenant-slug'];

        if (tenantId) {
          tenant = await tenantManager.getTenant(tenantId);
        } else if (tenantSlug) {
          tenant = await tenantManager.getTenantBySlug(tenantSlug);
        }

        // Method 2: Extract from subdomain
        if (!tenant && req.hostname) {
          const parts = req.hostname.split('.');
          if (parts.length > 2) {
            // First part is potential tenant slug
            const slug = parts[0];
            if (slug !== 'www' && slug !== 'api') {
              tenant = await tenantManager.getTenantBySlug(slug);
            }
          }
        }

        // Method 3: Use authenticated user's tenant
        if (!tenant && req.user && req.user.tenantId) {
          tenant = await tenantManager.getTenant(req.user.tenantId);
        }

        // Method 4: Check query parameter
        if (!tenant && req.query.tenant) {
          tenant = await tenantManager.getTenantBySlug(req.query.tenant);
        }

        // Method 5: Use default tenant as fallback
        if (!tenant) {
          tenant = await tenantManager.getTenantBySlug('default');
        }

        // Attach tenant to request
        if (tenant) {
          req.tenant = tenant;
          req.tenantId = tenant.id;
          
          this.logger?.debug(`Request associated with tenant: ${tenant.name}`);
        } else {
          this.logger?.warn('No tenant found for request');
        }

        next();
      } catch (error) {
        this.logger?.error('Error extracting tenant:', error);
        next(); // Continue without tenant context
      }
    };
  }

  /**
   * Validate that tenant exists and is active
   */
  validateTenant() {
    return async (req, res, next) => {
      try {
        if (!req.tenant) {
          return res.status(400).json({
            error: 'Tenant context required',
            message: 'Please specify tenant via header, subdomain, or authentication'
          });
        }

        // Check if tenant is active
        if (req.tenant.status !== 'active') {
          return res.status(403).json({
            error: 'Tenant suspended',
            message: `This tenant is ${req.tenant.status}. Please contact support.`
          });
        }

        next();
      } catch (error) {
        this.logger?.error('Error validating tenant:', error);
        res.status(500).json({
          error: 'Failed to validate tenant'
        });
      }
    };
  }

  /**
   * Check if user has access to tenant
   */
  requireTenantAccess() {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          error: 'Authentication required'
        });
      }

      if (!req.tenant) {
        return res.status(400).json({
          error: 'Tenant context required'
        });
      }

      // Super admins have access to all tenants
      if (req.user.role === 'super-admin') {
        return next();
      }

      // Check if user belongs to this tenant
      if (req.user.tenantId !== req.tenant.id) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You do not have access to this tenant'
        });
      }

      next();
    };
  }

  /**
   * Check if tenant has feature enabled
   */
  requireFeature(featureName) {
    return (req, res, next) => {
      if (!req.tenant) {
        return res.status(400).json({
          error: 'Tenant context required'
        });
      }

      const hasFeature = req.tenant.settings?.features?.[featureName];
      
      if (!hasFeature) {
        return res.status(403).json({
          error: 'Feature not available',
          message: `The ${featureName} feature is not enabled for this tenant`
        });
      }

      next();
    };
  }

  /**
   * Isolate data by tenant
   * Adds tenant filter to queries
   */
  isolateData() {
    return (req, res, next) => {
      if (!req.tenant) {
        return res.status(400).json({
          error: 'Tenant context required for data operations'
        });
      }

      // Add tenant filter to request for database queries
      req.dataFilter = req.dataFilter || {};
      req.dataFilter.tenantId = req.tenant.id;

      next();
    };
  }
}

module.exports = TenantMiddleware;
