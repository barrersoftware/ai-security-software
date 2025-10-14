/**
 * Webhooks Plugin
 * External system integrations via webhooks
 */

const WebhookManager = require('./webhook-manager');
const DeliveryManager = require('./delivery-manager');
const SecurityManager = require('./security-manager');
const EventDispatcher = require('./event-dispatcher');
const { logger } = require('../../shared/logger');

class WebhooksPlugin {
  constructor() {
    this.name = 'webhooks';
    this.version = '1.0.0';
    this.logger = logger;
    
    // Services
    this.webhookManager = null;
    this.deliveryManager = null;
    this.securityManager = null;
    this.eventDispatcher = null;
  }

  /**
   * Initialize plugin
   */
  async init(db, services = {}) {
    this.logger.info('[WebhooksPlugin] Initializing...');

    // Initialize services
    this.webhookManager = new WebhookManager(db);
    await this.webhookManager.init();

    this.securityManager = new SecurityManager();

    this.deliveryManager = new DeliveryManager(db, this.webhookManager, this.securityManager);
    await this.deliveryManager.init();

    this.eventDispatcher = new EventDispatcher(
      this.webhookManager,
      this.deliveryManager,
      this.securityManager
    );

    // Start retry processor
    this.startRetryProcessor();

    this.logger.info('[WebhooksPlugin] ✅ Initialized');

    return {
      webhookManager: this.webhookManager,
      deliveryManager: this.deliveryManager,
      securityManager: this.securityManager,
      eventDispatcher: this.eventDispatcher
    };
  }

  /**
   * Start retry processor (runs every minute)
   */
  startRetryProcessor() {
    this.retryInterval = setInterval(async () => {
      try {
        const processed = await this.deliveryManager.processRetries();
        if (processed > 0) {
          this.logger.debug(`[WebhooksPlugin] Processed ${processed} retries`);
        }
      } catch (error) {
        this.logger.error('[WebhooksPlugin] Retry processor error:', error);
      }
    }, 60000); // Every minute

    this.logger.info('[WebhooksPlugin] Retry processor started');
  }

  /**
   * Stop retry processor
   */
  stopRetryProcessor() {
    if (this.retryInterval) {
      clearInterval(this.retryInterval);
      this.logger.info('[WebhooksPlugin] Retry processor stopped');
    }
  }

  /**
   * Register API routes
   */
  routes(router, authenticateToken, getTenantId) {
    // ============================================
    // Webhook Management Routes
    // ============================================

    // Create webhook
    router.post('/api/webhooks', authenticateToken, async (req, res) => {
      try {
        const tenantId = await getTenantId(req);
        const webhook = await this.webhookManager.createWebhook(tenantId, req.body);
        res.json({ success: true, webhook });
      } catch (error) {
        this.logger.error('[Webhooks] Error creating webhook:', error);
        res.status(400).json({ success: false, error: error.message });
      }
    });

    // List webhooks
    router.get('/api/webhooks', authenticateToken, async (req, res) => {
      try {
        const tenantId = await getTenantId(req);
        const filters = {
          enabled: req.query.enabled === 'true' ? true : req.query.enabled === 'false' ? false : undefined,
          event: req.query.event,
          limit: parseInt(req.query.limit) || 100,
          offset: parseInt(req.query.offset) || 0
        };
        const webhooks = await this.webhookManager.listWebhooks(tenantId, filters);
        res.json({ success: true, webhooks, count: webhooks.length });
      } catch (error) {
        this.logger.error('[Webhooks] Error listing webhooks:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Get webhook
    router.get('/api/webhooks/:id', authenticateToken, async (req, res) => {
      try {
        const tenantId = await getTenantId(req);
        const webhook = await this.webhookManager.getWebhook(tenantId, req.params.id);
        res.json({ success: true, webhook });
      } catch (error) {
        this.logger.error('[Webhooks] Error getting webhook:', error);
        res.status(404).json({ success: false, error: error.message });
      }
    });

    // Update webhook
    router.put('/api/webhooks/:id', authenticateToken, async (req, res) => {
      try {
        const tenantId = await getTenantId(req);
        const webhook = await this.webhookManager.updateWebhook(tenantId, req.params.id, req.body);
        res.json({ success: true, webhook });
      } catch (error) {
        this.logger.error('[Webhooks] Error updating webhook:', error);
        res.status(400).json({ success: false, error: error.message });
      }
    });

    // Delete webhook
    router.delete('/api/webhooks/:id', authenticateToken, async (req, res) => {
      try {
        const tenantId = await getTenantId(req);
        const result = await this.webhookManager.deleteWebhook(tenantId, req.params.id);
        res.json({ success: true, ...result });
      } catch (error) {
        this.logger.error('[Webhooks] Error deleting webhook:', error);
        res.status(400).json({ success: false, error: error.message });
      }
    });

    // Test webhook
    router.post('/api/webhooks/:id/test', authenticateToken, async (req, res) => {
      try {
        const tenantId = await getTenantId(req);
        const result = await this.eventDispatcher.testWebhook(tenantId, req.params.id);
        res.json({ success: true, test: result });
      } catch (error) {
        this.logger.error('[Webhooks] Error testing webhook:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Get webhook statistics
    router.get('/api/webhooks/:id/stats', authenticateToken, async (req, res) => {
      try {
        const tenantId = await getTenantId(req);
        const stats = await this.deliveryManager.getStatistics(tenantId, req.params.id);
        res.json({ success: true, statistics: stats });
      } catch (error) {
        this.logger.error('[Webhooks] Error getting stats:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // ============================================
    // Delivery Routes
    // ============================================

    // List deliveries
    router.get('/api/webhooks/:id/deliveries', authenticateToken, async (req, res) => {
      try {
        const tenantId = await getTenantId(req);
        const filters = {
          status: req.query.status,
          event: req.query.event,
          limit: parseInt(req.query.limit) || 100,
          offset: parseInt(req.query.offset) || 0
        };
        const deliveries = await this.deliveryManager.listDeliveries(tenantId, req.params.id, filters);
        res.json({ success: true, deliveries, count: deliveries.length });
      } catch (error) {
        this.logger.error('[Webhooks] Error listing deliveries:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Get delivery
    router.get('/api/webhooks/:id/deliveries/:deliveryId', authenticateToken, async (req, res) => {
      try {
        const tenantId = await getTenantId(req);
        const delivery = await this.deliveryManager.getDelivery(
          tenantId,
          req.params.id,
          req.params.deliveryId
        );
        res.json({ success: true, delivery });
      } catch (error) {
        this.logger.error('[Webhooks] Error getting delivery:', error);
        res.status(404).json({ success: false, error: error.message });
      }
    });

    // Redeliver webhook
    router.post('/api/webhooks/:id/deliveries/:deliveryId/redeliver', authenticateToken, async (req, res) => {
      try {
        const tenantId = await getTenantId(req);
        const result = await this.deliveryManager.redeliver(
          tenantId,
          req.params.id,
          req.params.deliveryId
        );
        res.json({ success: true, ...result });
      } catch (error) {
        this.logger.error('[Webhooks] Error redelivering:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // ============================================
    // Event Routes
    // ============================================

    // Get event types
    router.get('/api/webhooks/events', authenticateToken, async (req, res) => {
      try {
        const events = this.eventDispatcher.getEventTypes();
        res.json({ success: true, events, count: events.length });
      } catch (error) {
        this.logger.error('[Webhooks] Error getting events:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Dispatch event (manual trigger)
    router.post('/api/webhooks/dispatch', authenticateToken, async (req, res) => {
      try {
        const tenantId = await getTenantId(req);
        const { event, data } = req.body;
        
        if (!event || !data) {
          return res.status(400).json({ success: false, error: 'Event and data are required' });
        }

        const result = await this.eventDispatcher.dispatchEvent(tenantId, event, data);
        res.json(result);
      } catch (error) {
        this.logger.error('[Webhooks] Error dispatching event:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Get overall statistics
    router.get('/api/webhooks/stats/summary', authenticateToken, async (req, res) => {
      try {
        const tenantId = await getTenantId(req);
        const stats = await this.webhookManager.getStatistics(tenantId);
        res.json({ success: true, statistics: stats });
      } catch (error) {
        this.logger.error('[Webhooks] Error getting summary:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.logger.info('[WebhooksPlugin] ✅ Routes registered');
  }

  /**
   * Middleware (optional)
   */
  middleware() {
    return (req, res, next) => {
      // Could add webhook-specific middleware here
      next();
    };
  }

  /**
   * Get plugin metadata
   */
  getMetadata() {
    return {
      name: this.name,
      version: this.version,
      description: 'External system integrations via webhooks',
      services: [
        'WebhookManager',
        'DeliveryManager',
        'SecurityManager',
        'EventDispatcher'
      ],
      endpoints: 13,
      features: [
        'Webhook configuration management',
        'Event-driven dispatching',
        'HMAC signature verification',
        'Automatic retry with exponential backoff',
        'Delivery tracking and history',
        'Rate limiting',
        'Payload size validation',
        'Multi-tenant isolation'
      ],
      events: this.webhookManager ? this.webhookManager.getValidEvents() : []
    };
  }

  /**
   * Trigger webhook event (for use by other plugins)
   */
  async triggerEvent(tenantId, event, data) {
    return await this.eventDispatcher.dispatchEvent(tenantId, event, data);
  }

  /**
   * Cleanup on shutdown
   */
  async shutdown() {
    this.stopRetryProcessor();
    this.logger.info('[WebhooksPlugin] Shutdown complete');
  }
}

module.exports = new WebhooksPlugin();
