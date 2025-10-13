/**
 * Tenant Manager
 * Handles tenant CRUD operations and data persistence
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class TenantManager {
  constructor(core) {
    this.core = core;
    this.logger = core.getService('logger');
    this.tenants = new Map();
    this.dataDir = path.join(__dirname, '../../data/tenants');
    this.dataFile = path.join(this.dataDir, 'tenants.json');
  }

  /**
   * Load tenants from storage
   */
  async loadTenants() {
    try {
      // Ensure data directory exists
      await fs.mkdir(this.dataDir, { recursive: true });

      // Try to load existing tenants
      try {
        const data = await fs.readFile(this.dataFile, 'utf8');
        const tenants = JSON.parse(data);
        
        tenants.forEach(tenant => {
          this.tenants.set(tenant.id, tenant);
        });

        this.logger?.info(`Loaded ${this.tenants.size} tenants`);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
        // File doesn't exist yet, that's ok
        this.logger?.debug('No existing tenants file, starting fresh');
      }
    } catch (error) {
      this.logger?.error('Error loading tenants:', error);
      throw error;
    }
  }

  /**
   * Save tenants to storage
   */
  async saveTenants() {
    try {
      const tenants = Array.from(this.tenants.values());
      await fs.writeFile(
        this.dataFile,
        JSON.stringify(tenants, null, 2),
        'utf8'
      );
    } catch (error) {
      this.logger?.error('Error saving tenants:', error);
      throw error;
    }
  }

  /**
   * Generate unique tenant ID
   */
  generateId() {
    return `tenant-${crypto.randomBytes(16).toString('hex')}`;
  }

  /**
   * Validate tenant slug (URL-safe identifier)
   */
  validateSlug(slug) {
    const slugRegex = /^[a-z0-9-]+$/;
    return slugRegex.test(slug);
  }

  /**
   * Create a new tenant
   */
  async createTenant(data) {
    try {
      // Validate required fields
      if (!data.name) {
        throw new Error('Tenant name is required');
      }

      if (!data.slug) {
        throw new Error('Tenant slug is required');
      }

      if (!this.validateSlug(data.slug)) {
        throw new Error('Invalid slug format (use lowercase letters, numbers, and hyphens)');
      }

      // Check if slug already exists
      const existingSlug = Array.from(this.tenants.values()).find(
        t => t.slug === data.slug
      );
      if (existingSlug) {
        throw new Error('Tenant slug already exists');
      }

      const now = new Date().toISOString();
      const tenant = {
        id: this.generateId(),
        name: data.name,
        slug: data.slug,
        status: data.status || 'active',
        settings: {
          allowedDomains: data.settings?.allowedDomains || [],
          customBranding: data.settings?.customBranding || {},
          features: {
            vpn: data.settings?.features?.vpn !== false,
            scanning: data.settings?.features?.scanning !== false,
            storage: data.settings?.features?.storage !== false,
            admin: data.settings?.features?.admin !== false,
            ...data.settings?.features
          },
          ...data.settings
        },
        limits: {
          users: data.limits?.users || 100,
          scans: data.limits?.scans || 1000,
          storage: data.limits?.storage || '100GB',
          vpnClients: data.limits?.vpnClients || 50,
          apiRequests: data.limits?.apiRequests || 10000,
          ...data.limits
        },
        usage: {
          users: 0,
          scans: 0,
          storage: '0GB',
          vpnClients: 0,
          apiRequests: 0
        },
        billing: data.billing || {
          plan: 'enterprise',
          status: 'active',
          nextBillingDate: null
        },
        createdAt: now,
        updatedAt: now,
        metadata: data.metadata || {}
      };

      this.tenants.set(tenant.id, tenant);
      await this.saveTenants();

      this.logger?.info(`Created tenant: ${tenant.name} (${tenant.slug})`);
      return tenant;
    } catch (error) {
      this.logger?.error('Error creating tenant:', error);
      throw error;
    }
  }

  /**
   * Get tenant by ID
   */
  async getTenant(id) {
    return this.tenants.get(id) || null;
  }

  /**
   * Get tenant by slug
   */
  async getTenantBySlug(slug) {
    return Array.from(this.tenants.values()).find(
      t => t.slug === slug
    ) || null;
  }

  /**
   * List all tenants
   */
  async listTenants(filters = {}) {
    let tenants = Array.from(this.tenants.values());

    // Apply filters
    if (filters.status) {
      tenants = tenants.filter(t => t.status === filters.status);
    }

    if (filters.search) {
      const search = filters.search.toLowerCase();
      tenants = tenants.filter(t => 
        t.name.toLowerCase().includes(search) ||
        t.slug.toLowerCase().includes(search)
      );
    }

    // Sort by creation date (newest first)
    tenants.sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );

    return tenants;
  }

  /**
   * Update tenant
   */
  async updateTenant(id, updates) {
    try {
      const tenant = this.tenants.get(id);
      
      if (!tenant) {
        throw new Error('Tenant not found');
      }

      // Validate slug if being updated
      if (updates.slug) {
        if (!this.validateSlug(updates.slug)) {
          throw new Error('Invalid slug format');
        }

        // Check if new slug conflicts with existing
        const existingSlug = Array.from(this.tenants.values()).find(
          t => t.slug === updates.slug && t.id !== id
        );
        if (existingSlug) {
          throw new Error('Tenant slug already exists');
        }
      }

      // Update allowed fields
      const allowedFields = ['name', 'slug', 'status', 'settings', 'limits', 'billing', 'metadata'];
      allowedFields.forEach(field => {
        if (updates[field] !== undefined) {
          if (field === 'settings' || field === 'limits' || field === 'billing') {
            // Merge objects
            tenant[field] = {
              ...tenant[field],
              ...updates[field]
            };
          } else {
            tenant[field] = updates[field];
          }
        }
      });

      tenant.updatedAt = new Date().toISOString();
      
      this.tenants.set(id, tenant);
      await this.saveTenants();

      this.logger?.info(`Updated tenant: ${tenant.name}`);
      return tenant;
    } catch (error) {
      this.logger?.error('Error updating tenant:', error);
      throw error;
    }
  }

  /**
   * Delete tenant
   */
  async deleteTenant(id) {
    try {
      const tenant = this.tenants.get(id);
      
      if (!tenant) {
        throw new Error('Tenant not found');
      }

      // Don't allow deleting default tenant
      if (tenant.slug === 'default') {
        throw new Error('Cannot delete default tenant');
      }

      this.tenants.delete(id);
      await this.saveTenants();

      this.logger?.info(`Deleted tenant: ${tenant.name}`);
      return true;
    } catch (error) {
      this.logger?.error('Error deleting tenant:', error);
      throw error;
    }
  }

  /**
   * Check if tenant exists
   */
  async exists(id) {
    return this.tenants.has(id);
  }

  /**
   * Get tenant count
   */
  async count() {
    return this.tenants.size;
  }

  /**
   * Activate tenant
   */
  async activateTenant(id) {
    return this.updateTenant(id, { status: 'active' });
  }

  /**
   * Suspend tenant
   */
  async suspendTenant(id) {
    return this.updateTenant(id, { status: 'suspended' });
  }

  /**
   * Get active tenants
   */
  async getActiveTenants() {
    return Array.from(this.tenants.values()).filter(
      t => t.status === 'active'
    );
  }
}

module.exports = TenantManager;
