/**
 * Policies Plugin - Custom Scanning Policies
 * 
 * Provides policy management, compliance templates, scheduled scanning,
 * and compliance tracking over time.
 */

const express = require('express');
const PolicyManager = require('./policy-manager');
const PolicyScheduler = require('./policy-scheduler');
const PolicyExecutor = require('./policy-executor');
const TemplateManager = require('./template-manager');
const ComplianceTracker = require('./compliance-tracker');

module.exports = {
  name: 'policies',
  version: '1.0.0',
  description: 'Custom scanning policies with compliance templates',

  async init(core) {
    this.core = core;
    this.logger = core.getService('logger');
    this.db = core.db;

    this.logger?.info('[Policies] Initializing Custom Scanning Policies plugin...');

    // Initialize services
    this.policyManager = new PolicyManager(core);
    this.policyScheduler = new PolicyScheduler(core);
    this.policyExecutor = new PolicyExecutor(core);
    this.templateManager = new TemplateManager(core);
    this.complianceTracker = new ComplianceTracker(core);

    // Register services
    core.registerService('policy-manager', this.policyManager);
    core.registerService('policy-scheduler', this.policyScheduler);
    core.registerService('policy-executor', this.policyExecutor);
    core.registerService('template-manager', this.templateManager);
    core.registerService('compliance-tracker', this.complianceTracker);

    // Initialize database tables
    await this.policyManager.init();
    await this.policyScheduler.init();
    await this.complianceTracker.init();

    // Load templates
    await this.templateManager.loadTemplates();

    this.logger?.info('[Policies] ✅ Custom Scanning Policies plugin initialized');
    this.logger?.info(`[Policies] 📋 ${this.templateManager.getTemplates().length} policy templates available`);
  },

  routes() {
    const router = express.Router();

    // Get auth middleware
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

    // Role checking middleware
    const requireRole = (...roles) => {
      return (req, res, next) => {
        if (!req.user) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
        
        const userRoles = Array.isArray(req.user.role) ? req.user.role : [req.user.role];
        const hasRole = roles.some(role => userRoles.includes(role) || req.user.isAdmin);
        
        if (!hasRole) {
          return res.status(403).json({ error: 'Insufficient permissions' });
        }
        
        next();
      };
    };

    /**
     * POST /api/policies
     * Create a new policy
     */
    router.post('/', requireAuth, requireRole('admin', 'security'), async (req, res) => {
      try {
        const policyData = {
          ...req.body,
          tenantId: req.user.tenantId,
          createdBy: req.user.id
        };

        const policy = await this.policyManager.createPolicy(policyData);
        
        // Log audit event
        const auditLogger = this.core.getService('AuditLogger');
        if (auditLogger) {
          await auditLogger.log({
            tenantId: req.user.tenantId,
            userId: req.user.id,
            category: 'configuration',
            action: 'create_policy',
            severity: 'info',
            details: { policyId: policy.id, name: policy.name }
          });
        }

        res.json({ success: true, policy });
      } catch (error) {
        this.logger?.error('[Policies] Error creating policy:', error);
        res.status(500).json({ error: error.message });
      }
    });

    /**
     * GET /api/policies
     * List policies (tenant-scoped)
     */
    router.get('/', requireAuth, async (req, res) => {
      try {
        const { page = 1, limit = 50, status, framework } = req.query;
        
        const filters = {
          tenantId: req.user.tenantId,
          status,
          framework
        };

        const result = await this.policyManager.listPolicies(filters, {
          page: parseInt(page),
          limit: parseInt(limit)
        });

        res.json(result);
      } catch (error) {
        this.logger?.error('[Policies] Error listing policies:', error);
        res.status(500).json({ error: error.message });
      }
    });

    /**
     * GET /api/policies/:id
     * Get policy details
     */
    router.get('/:id', requireAuth, async (req, res) => {
      try {
        const policy = await this.policyManager.getPolicy(req.params.id, req.user.tenantId);
        
        if (!policy) {
          return res.status(404).json({ error: 'Policy not found' });
        }

        res.json({ policy });
      } catch (error) {
        this.logger?.error('[Policies] Error getting policy:', error);
        res.status(500).json({ error: error.message });
      }
    });

    /**
     * PUT /api/policies/:id
     * Update policy
     */
    router.put('/:id', requireAuth, requireRole('admin', 'security'), async (req, res) => {
      try {
        const updates = req.body;
        const policy = await this.policyManager.updatePolicy(
          req.params.id,
          req.user.tenantId,
          updates
        );

        // Log audit event
        const auditLogger = this.core.getService('AuditLogger');
        if (auditLogger) {
          await auditLogger.log({
            tenantId: req.user.tenantId,
            userId: req.user.id,
            category: 'configuration',
            action: 'update_policy',
            severity: 'info',
            details: { policyId: req.params.id, updates }
          });
        }

        res.json({ success: true, policy });
      } catch (error) {
        this.logger?.error('[Policies] Error updating policy:', error);
        res.status(500).json({ error: error.message });
      }
    });

    /**
     * DELETE /api/policies/:id
     * Delete policy
     */
    router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
      try {
        await this.policyManager.deletePolicy(req.params.id, req.user.tenantId);

        // Log audit event
        const auditLogger = this.core.getService('AuditLogger');
        if (auditLogger) {
          await auditLogger.log({
            tenantId: req.user.tenantId,
            userId: req.user.id,
            category: 'configuration',
            action: 'delete_policy',
            severity: 'warning',
            details: { policyId: req.params.id }
          });
        }

        res.json({ success: true });
      } catch (error) {
        this.logger?.error('[Policies] Error deleting policy:', error);
        res.status(500).json({ error: error.message });
      }
    });

    /**
     * POST /api/policies/:id/execute
     * Execute policy immediately
     */
    router.post('/:id/execute', requireAuth, requireRole('admin', 'security'), async (req, res) => {
      try {
        const policy = await this.policyManager.getPolicy(req.params.id, req.user.tenantId);
        
        if (!policy) {
          return res.status(404).json({ error: 'Policy not found' });
        }

        // Execute policy
        const execution = await this.policyExecutor.executePolicy(policy, req.user);

        // Log audit event
        const auditLogger = this.core.getService('AuditLogger');
        if (auditLogger) {
          await auditLogger.log({
            tenantId: req.user.tenantId,
            userId: req.user.id,
            category: 'security_scan',
            action: 'execute_policy',
            severity: 'info',
            details: { policyId: policy.id, executionId: execution.id }
          });
        }

        res.json({ success: true, execution });
      } catch (error) {
        this.logger?.error('[Policies] Error executing policy:', error);
        res.status(500).json({ error: error.message });
      }
    });

    /**
     * GET /api/policies/:id/history
     * Get policy execution history
     */
    router.get('/:id/history', requireAuth, async (req, res) => {
      try {
        const { page = 1, limit = 50 } = req.query;
        
        const history = await this.policyExecutor.getExecutionHistory(
          req.params.id,
          req.user.tenantId,
          {
            page: parseInt(page),
            limit: parseInt(limit)
          }
        );

        res.json(history);
      } catch (error) {
        this.logger?.error('[Policies] Error getting history:', error);
        res.status(500).json({ error: error.message });
      }
    });

    /**
     * GET /api/policies/templates
     * List available policy templates
     */
    router.get('/templates/list', requireAuth, async (req, res) => {
      try {
        const { category } = req.query;
        const templates = this.templateManager.getTemplates(category);

        res.json({ templates });
      } catch (error) {
        this.logger?.error('[Policies] Error listing templates:', error);
        res.status(500).json({ error: error.message });
      }
    });

    /**
     * POST /api/policies/from-template
     * Create policy from template
     */
    router.post('/from-template', requireAuth, requireRole('admin', 'security'), async (req, res) => {
      try {
        const { templateId, name, schedule } = req.body;
        
        const policy = await this.policyManager.createFromTemplate(
          templateId,
          {
            name,
            schedule,
            tenantId: req.user.tenantId,
            createdBy: req.user.id
          }
        );

        // Log audit event
        const auditLogger = this.core.getService('AuditLogger');
        if (auditLogger) {
          await auditLogger.log({
            tenantId: req.user.tenantId,
            userId: req.user.id,
            category: 'configuration',
            action: 'create_policy_from_template',
            severity: 'info',
            details: { templateId, policyId: policy.id }
          });
        }

        res.json({ success: true, policy });
      } catch (error) {
        this.logger?.error('[Policies] Error creating from template:', error);
        res.status(500).json({ error: error.message });
      }
    });

    /**
     * GET /api/policies/:id/compliance-score
     * Get current compliance score
     */
    router.get('/:id/compliance-score', requireAuth, async (req, res) => {
      try {
        const score = await this.complianceTracker.getCurrentScore(
          req.params.id,
          req.user.tenantId
        );

        res.json({ score });
      } catch (error) {
        this.logger?.error('[Policies] Error getting compliance score:', error);
        res.status(500).json({ error: error.message });
      }
    });

    /**
     * GET /api/policies/:id/trend
     * Get compliance score trend
     */
    router.get('/:id/trend', requireAuth, async (req, res) => {
      try {
        const { days = 30 } = req.query;
        
        const trend = await this.complianceTracker.getScoreTrend(
          req.params.id,
          req.user.tenantId,
          parseInt(days)
        );

        res.json({ trend });
      } catch (error) {
        this.logger?.error('[Policies] Error getting trend:', error);
        res.status(500).json({ error: error.message });
      }
    });

    /**
     * POST /api/policies/:id/schedule
     * Update policy schedule
     */
    router.post('/:id/schedule', requireAuth, requireRole('admin', 'security'), async (req, res) => {
      try {
        const { schedule, enabled } = req.body;
        
        await this.policyScheduler.updateSchedule(
          req.params.id,
          req.user.tenantId,
          schedule,
          enabled
        );

        // Log audit event
        const auditLogger = this.core.getService('AuditLogger');
        if (auditLogger) {
          await auditLogger.log({
            tenantId: req.user.tenantId,
            userId: req.user.id,
            category: 'configuration',
            action: 'update_policy_schedule',
            severity: 'info',
            details: { policyId: req.params.id, schedule, enabled }
          });
        }

        res.json({ success: true });
      } catch (error) {
        this.logger?.error('[Policies] Error updating schedule:', error);
        res.status(500).json({ error: error.message });
      }
    });

    return router;
  }
};
