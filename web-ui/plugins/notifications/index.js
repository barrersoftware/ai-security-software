/**
 * Notifications & Alerting Plugin
 * Real-time notifications and alerting system
 */

const ChannelManager = require('./channel-manager');
const DeliveryManager = require('./delivery-manager');
const NotificationManager = require('./notification-manager');
const AlertEngine = require('./alert-engine');
const TemplateManager = require('./template-manager');
const { logger } = require('../../shared/logger');

class NotificationsPlugin {
  constructor() {
    this.name = 'notifications';
    this.version = '1.0.0';
    this.logger = logger;
    
    // Services
    this.channelManager = null;
    this.deliveryManager = null;
    this.notificationManager = null;
    this.alertEngine = null;
    this.templateManager = null;
  }

  /**
   * Initialize plugin
   */
  async init(db, services = {}) {
    this.logger.info('[NotificationsPlugin] Initializing...');

    // Initialize services
    this.channelManager = new ChannelManager(db);
    await this.channelManager.init();

    this.deliveryManager = new DeliveryManager(this.channelManager);

    this.notificationManager = new NotificationManager(
      db,
      this.channelManager,
      this.deliveryManager
    );
    await this.notificationManager.init();

    this.alertEngine = new AlertEngine(db, this.notificationManager);
    await this.alertEngine.init();

    this.templateManager = new TemplateManager();

    this.logger.info('[NotificationsPlugin] ✅ Initialized');

    return {
      channelManager: this.channelManager,
      deliveryManager: this.deliveryManager,
      notificationManager: this.notificationManager,
      alertEngine: this.alertEngine,
      templateManager: this.templateManager
    };
  }

  /**
   * Register API routes
   */
  routes(router, authenticateToken, getTenantId) {
    // ============================================
    // Channel Management Routes
    // ============================================

    // Create channel
    router.post('/api/notifications/channels', authenticateToken, async (req, res) => {
      try {
        const tenantId = await getTenantId(req);
        const channel = await this.channelManager.addChannel(tenantId, req.body);
        res.json({ success: true, channel });
      } catch (error) {
        this.logger.error('[Notifications] Error creating channel:', error);
        res.status(400).json({ success: false, error: error.message });
      }
    });

    // List channels
    router.get('/api/notifications/channels', authenticateToken, async (req, res) => {
      try {
        const tenantId = await getTenantId(req);
        const filters = {
          type: req.query.type,
          enabled: req.query.enabled === 'true' ? true : req.query.enabled === 'false' ? false : undefined,
          limit: parseInt(req.query.limit) || 100,
          offset: parseInt(req.query.offset) || 0
        };
        const channels = await this.channelManager.listChannels(tenantId, filters);
        res.json({ success: true, channels, count: channels.length });
      } catch (error) {
        this.logger.error('[Notifications] Error listing channels:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Get channel
    router.get('/api/notifications/channels/:id', authenticateToken, async (req, res) => {
      try {
        const tenantId = await getTenantId(req);
        const channel = await this.channelManager.getChannel(tenantId, req.params.id);
        res.json({ success: true, channel });
      } catch (error) {
        this.logger.error('[Notifications] Error getting channel:', error);
        res.status(404).json({ success: false, error: error.message });
      }
    });

    // Update channel
    router.put('/api/notifications/channels/:id', authenticateToken, async (req, res) => {
      try {
        const tenantId = await getTenantId(req);
        const channel = await this.channelManager.updateChannel(tenantId, req.params.id, req.body);
        res.json({ success: true, channel });
      } catch (error) {
        this.logger.error('[Notifications] Error updating channel:', error);
        res.status(400).json({ success: false, error: error.message });
      }
    });

    // Delete channel
    router.delete('/api/notifications/channels/:id', authenticateToken, async (req, res) => {
      try {
        const tenantId = await getTenantId(req);
        const result = await this.channelManager.deleteChannel(tenantId, req.params.id);
        res.json({ success: true, ...result });
      } catch (error) {
        this.logger.error('[Notifications] Error deleting channel:', error);
        res.status(400).json({ success: false, error: error.message });
      }
    });

    // Test channel
    router.post('/api/notifications/channels/:id/test', authenticateToken, async (req, res) => {
      try {
        const tenantId = await getTenantId(req);
        const result = await this.deliveryManager.testChannel(tenantId, req.params.id);
        res.json({ success: true, test: result });
      } catch (error) {
        this.logger.error('[Notifications] Error testing channel:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Get channel statistics
    router.get('/api/notifications/channels/stats/summary', authenticateToken, async (req, res) => {
      try {
        const tenantId = await getTenantId(req);
        const stats = await this.channelManager.getChannelStats(tenantId);
        res.json({ success: true, statistics: stats });
      } catch (error) {
        this.logger.error('[Notifications] Error getting stats:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // ============================================
    // Notification Routes
    // ============================================

    // Send notification
    router.post('/api/notifications/send', authenticateToken, async (req, res) => {
      try {
        const tenantId = await getTenantId(req);
        const userId = req.user?.id || req.user?.username;
        const result = await this.notificationManager.sendNotification(tenantId, req.body, userId);
        res.json(result);
      } catch (error) {
        this.logger.error('[Notifications] Error sending notification:', error);
        res.status(400).json({ success: false, error: error.message });
      }
    });

    // List notifications
    router.get('/api/notifications', authenticateToken, async (req, res) => {
      try {
        const tenantId = await getTenantId(req);
        const filters = {
          type: req.query.type,
          priority: req.query.priority,
          status: req.query.status,
          limit: parseInt(req.query.limit) || 100,
          offset: parseInt(req.query.offset) || 0
        };
        const notifications = await this.notificationManager.listNotifications(tenantId, filters);
        res.json({ success: true, notifications, count: notifications.length });
      } catch (error) {
        this.logger.error('[Notifications] Error listing notifications:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Get notification
    router.get('/api/notifications/:id', authenticateToken, async (req, res) => {
      try {
        const tenantId = await getTenantId(req);
        const notification = await this.notificationManager.getNotification(tenantId, req.params.id);
        res.json({ success: true, notification });
      } catch (error) {
        this.logger.error('[Notifications] Error getting notification:', error);
        res.status(404).json({ success: false, error: error.message });
      }
    });

    // Get notification statistics
    router.get('/api/notifications/stats/summary', authenticateToken, async (req, res) => {
      try {
        const tenantId = await getTenantId(req);
        const days = parseInt(req.query.days) || 7;
        const stats = await this.notificationManager.getStatistics(tenantId, days);
        res.json({ success: true, statistics: stats });
      } catch (error) {
        this.logger.error('[Notifications] Error getting statistics:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // ============================================
    // Alert Rules Routes
    // ============================================

    // Create alert rule
    router.post('/api/notifications/rules', authenticateToken, async (req, res) => {
      try {
        const tenantId = await getTenantId(req);
        const rule = await this.alertEngine.createRule(tenantId, req.body);
        res.json({ success: true, rule });
      } catch (error) {
        this.logger.error('[Notifications] Error creating rule:', error);
        res.status(400).json({ success: false, error: error.message });
      }
    });

    // List alert rules
    router.get('/api/notifications/rules', authenticateToken, async (req, res) => {
      try {
        const tenantId = await getTenantId(req);
        const filters = {
          enabled: req.query.enabled === 'true' ? true : req.query.enabled === 'false' ? false : undefined,
          limit: parseInt(req.query.limit) || 100,
          offset: parseInt(req.query.offset) || 0
        };
        const rules = await this.alertEngine.listRules(tenantId, filters);
        res.json({ success: true, rules, count: rules.length });
      } catch (error) {
        this.logger.error('[Notifications] Error listing rules:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Get alert rule
    router.get('/api/notifications/rules/:id', authenticateToken, async (req, res) => {
      try {
        const tenantId = await getTenantId(req);
        const rule = await this.alertEngine.getRule(tenantId, req.params.id);
        res.json({ success: true, rule });
      } catch (error) {
        this.logger.error('[Notifications] Error getting rule:', error);
        res.status(404).json({ success: false, error: error.message });
      }
    });

    // Update alert rule
    router.put('/api/notifications/rules/:id', authenticateToken, async (req, res) => {
      try {
        const tenantId = await getTenantId(req);
        const rule = await this.alertEngine.updateRule(tenantId, req.params.id, req.body);
        res.json({ success: true, rule });
      } catch (error) {
        this.logger.error('[Notifications] Error updating rule:', error);
        res.status(400).json({ success: false, error: error.message });
      }
    });

    // Delete alert rule
    router.delete('/api/notifications/rules/:id', authenticateToken, async (req, res) => {
      try {
        const tenantId = await getTenantId(req);
        const result = await this.alertEngine.deleteRule(tenantId, req.params.id);
        res.json({ success: true, ...result });
      } catch (error) {
        this.logger.error('[Notifications] Error deleting rule:', error);
        res.status(400).json({ success: false, error: error.message });
      }
    });

    // Get alert statistics
    router.get('/api/notifications/rules/stats/summary', authenticateToken, async (req, res) => {
      try {
        const tenantId = await getTenantId(req);
        const stats = await this.alertEngine.getRuleStatistics(tenantId);
        res.json({ success: true, statistics: stats });
      } catch (error) {
        this.logger.error('[Notifications] Error getting rule stats:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // ============================================
    // Template Routes
    // ============================================

    // List templates
    router.get('/api/notifications/templates', authenticateToken, async (req, res) => {
      try {
        const templates = this.templateManager.listTemplates();
        res.json({ success: true, templates, count: templates.length });
      } catch (error) {
        this.logger.error('[Notifications] Error listing templates:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Get template
    router.get('/api/notifications/templates/:name', authenticateToken, async (req, res) => {
      try {
        const template = this.templateManager.getTemplate(req.params.name);
        res.json({ success: true, template });
      } catch (error) {
        this.logger.error('[Notifications] Error getting template:', error);
        res.status(404).json({ success: false, error: error.message });
      }
    });

    // Render template
    router.post('/api/notifications/templates/:name/render', authenticateToken, async (req, res) => {
      try {
        const rendered = this.templateManager.renderTemplate(req.params.name, req.body);
        res.json({ success: true, rendered });
      } catch (error) {
        this.logger.error('[Notifications] Error rendering template:', error);
        res.status(400).json({ success: false, error: error.message });
      }
    });

    // Send from template
    router.post('/api/notifications/templates/:name/send', authenticateToken, async (req, res) => {
      try {
        const tenantId = await getTenantId(req);
        const userId = req.user?.id || req.user?.username;
        
        const notification = this.templateManager.createFromTemplate(
          req.params.name,
          req.body.data,
          {
            priority: req.body.priority,
            channelIds: req.body.channel_ids
          }
        );
        
        const result = await this.notificationManager.sendNotification(tenantId, notification, userId);
        res.json(result);
      } catch (error) {
        this.logger.error('[Notifications] Error sending from template:', error);
        res.status(400).json({ success: false, error: error.message });
      }
    });

    this.logger.info('[NotificationsPlugin] ✅ Routes registered');
  }

  /**
   * Middleware (optional)
   */
  middleware() {
    return (req, res, next) => {
      // Could add notification-specific middleware here
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
      description: 'Real-time notifications and alerting system',
      services: [
        'ChannelManager',
        'DeliveryManager',
        'NotificationManager',
        'AlertEngine',
        'TemplateManager'
      ],
      endpoints: 19,
      channels: ['slack', 'discord', 'email', 'teams', 'webhook'],
      features: [
        'Multi-channel notifications',
        'Real-time alerting',
        'Rule-based alerts',
        'Template system',
        'Throttling',
        'Delivery tracking',
        'Priority levels',
        'Channel statistics'
      ]
    };
  }

  /**
   * Trigger event for alert evaluation
   */
  async triggerEvent(tenantId, event) {
    return await this.alertEngine.evaluateEvent(tenantId, event);
  }
}

module.exports = new NotificationsPlugin();
