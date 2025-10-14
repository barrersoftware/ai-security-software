/**
 * Webhooks Plugin - Event Dispatcher Service
 * Routes events to appropriate webhooks
 */

const { logger } = require('../../shared/logger');

class EventDispatcher {
  constructor(webhookManager, deliveryManager, securityManager) {
    this.webhookManager = webhookManager;
    this.deliveryManager = deliveryManager;
    this.securityManager = securityManager;
    this.logger = logger;
  }

  /**
   * Dispatch an event to all subscribed webhooks
   */
  async dispatchEvent(tenantId, event, data) {
    try {
      // Validate event type
      const validEvents = this.webhookManager.getValidEvents();
      if (!validEvents.includes(event)) {
        this.logger.warn(`[EventDispatcher] Invalid event type: ${event}`);
        return { success: false, error: 'Invalid event type' };
      }

      // Get webhooks subscribed to this event
      const webhooks = await this.webhookManager.getWebhooksByEvent(tenantId, event);

      if (webhooks.length === 0) {
        this.logger.debug(`[EventDispatcher] No webhooks subscribed to ${event}`);
        return { success: true, webhooks: 0, dispatched: 0 };
      }

      // Validate payload size
      try {
        this.securityManager.validatePayloadSize({ event, data });
      } catch (error) {
        this.logger.error(`[EventDispatcher] Payload too large:`, error.message);
        return { success: false, error: error.message };
      }

      // Dispatch to all webhooks
      const results = [];
      for (const webhook of webhooks) {
        // Check rate limit
        const rateLimit = this.securityManager.checkRateLimit(webhook.id);
        if (!rateLimit.allowed) {
          this.logger.warn(`[EventDispatcher] Rate limit exceeded for webhook ${webhook.id}`);
          results.push({
            webhook_id: webhook.id,
            webhook_name: webhook.name,
            success: false,
            error: 'Rate limit exceeded'
          });
          continue;
        }

        // Deliver webhook
        try {
          const result = await this.deliveryManager.deliver(
            tenantId,
            webhook.id,
            event,
            data
          );

          results.push({
            webhook_id: webhook.id,
            webhook_name: webhook.name,
            ...result
          });
        } catch (error) {
          this.logger.error(`[EventDispatcher] Error dispatching to ${webhook.name}:`, error);
          results.push({
            webhook_id: webhook.id,
            webhook_name: webhook.name,
            success: false,
            error: error.message
          });
        }
      }

      const successCount = results.filter(r => r.success).length;

      this.logger.info(`[EventDispatcher] Dispatched ${event} to ${successCount}/${webhooks.length} webhooks`);

      return {
        success: true,
        event,
        webhooks: webhooks.length,
        dispatched: successCount,
        failed: webhooks.length - successCount,
        results
      };

    } catch (error) {
      this.logger.error(`[EventDispatcher] Failed to dispatch ${event}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Dispatch multiple events in batch
   */
  async dispatchBatch(tenantId, events) {
    const results = [];

    for (const { event, data } of events) {
      const result = await this.dispatchEvent(tenantId, event, data);
      results.push({
        event,
        ...result
      });
    }

    return {
      success: true,
      total: events.length,
      results
    };
  }

  /**
   * Get event types
   */
  getEventTypes() {
    return this.webhookManager.getValidEvents().map(event => {
      const [category, action] = event.split('.');
      return {
        event,
        category,
        action,
        description: this.getEventDescription(event)
      };
    });
  }

  /**
   * Get event description
   */
  getEventDescription(event) {
    const descriptions = {
      'scan.started': 'Security scan has started',
      'scan.completed': 'Security scan completed successfully',
      'scan.failed': 'Security scan failed',
      'vulnerability.found': 'New vulnerability detected',
      'policy.executed': 'Security policy executed',
      'policy.passed': 'Security policy check passed',
      'policy.failed': 'Security policy check failed',
      'server.added': 'New server added to inventory',
      'server.removed': 'Server removed from inventory',
      'alert.triggered': 'Security alert triggered',
      'notification.sent': 'Notification sent',
      'user.created': 'New user created',
      'user.deleted': 'User deleted',
      'tenant.created': 'New tenant created'
    };

    return descriptions[event] || 'Event triggered';
  }

  /**
   * Test webhook delivery
   */
  async testWebhook(tenantId, webhookId) {
    const testData = {
      test: true,
      message: 'This is a test webhook delivery',
      timestamp: new Date().toISOString()
    };

    return await this.deliveryManager.deliver(
      tenantId,
      webhookId,
      'test.webhook',
      testData
    );
  }
}

module.exports = EventDispatcher;
