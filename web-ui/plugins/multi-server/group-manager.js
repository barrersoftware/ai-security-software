/**
 * Multi-Server Plugin - Group Manager Service
 * Handles server group management
 */

const { v4: uuidv4 } = require('uuid');
const { logger } = require('../../shared/logger');

class GroupManager {
  constructor(db) {
    this.db = db;
    this.logger = logger;
  }

  /**
   * Initialize database tables
   */
  async init() {
    this.logger.info('[GroupManager] Initializing...');

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS server_groups (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        server_ids TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, name)
      )
    `);

    await this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_groups_tenant ON server_groups(tenant_id);
    `);

    this.logger.info('[GroupManager] ✅ Initialized');
  }

  /**
   * Create a new group
   */
  async createGroup(tenantId, groupData) {
    const groupId = uuidv4();
    const { name, description = '', server_ids = [] } = groupData;

    if (!name) {
      throw new Error('Group name is required');
    }

    // Check for duplicate
    const existing = await this.db.get(
      'SELECT id FROM server_groups WHERE tenant_id = ? AND name = ?',
      [tenantId, name]
    );

    if (existing) {
      throw new Error(`Group with name "${name}" already exists`);
    }

    await this.db.run(`
      INSERT INTO server_groups (id, tenant_id, name, description, server_ids)
      VALUES (?, ?, ?, ?, ?)
    `, [groupId, tenantId, name, description, JSON.stringify(server_ids)]);

    this.logger.info(`[GroupManager] Created group: ${name}`);

    return await this.getGroup(tenantId, groupId);
  }

  /**
   * List all groups
   */
  async listGroups(tenantId) {
    const groups = await this.db.all(
      'SELECT * FROM server_groups WHERE tenant_id = ? ORDER BY name ASC',
      [tenantId]
    );

    return groups.map(group => ({
      ...group,
      server_ids: JSON.parse(group.server_ids || '[]')
    }));
  }

  /**
   * Get a single group
   */
  async getGroup(tenantId, groupId) {
    const group = await this.db.get(
      'SELECT * FROM server_groups WHERE tenant_id = ? AND id = ?',
      [tenantId, groupId]
    );

    if (!group) {
      throw new Error('Group not found');
    }

    return {
      ...group,
      server_ids: JSON.parse(group.server_ids || '[]')
    };
  }

  /**
   * Update a group
   */
  async updateGroup(tenantId, groupId, updates) {
    await this.getGroup(tenantId, groupId); // Verify exists

    const { name, description, server_ids } = updates;
    const fields = [];
    const params = [];

    if (name !== undefined) {
      fields.push('name = ?');
      params.push(name);
    }
    if (description !== undefined) {
      fields.push('description = ?');
      params.push(description);
    }
    if (server_ids !== undefined) {
      fields.push('server_ids = ?');
      params.push(JSON.stringify(server_ids));
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(tenantId, groupId);

    await this.db.run(`
      UPDATE server_groups SET ${fields.join(', ')}
      WHERE tenant_id = ? AND id = ?
    `, params);

    this.logger.info(`[GroupManager] Updated group: ${groupId}`);

    return await this.getGroup(tenantId, groupId);
  }

  /**
   * Delete a group
   */
  async deleteGroup(tenantId, groupId) {
    const group = await this.getGroup(tenantId, groupId);

    await this.db.run(
      'DELETE FROM server_groups WHERE tenant_id = ? AND id = ?',
      [tenantId, groupId]
    );

    this.logger.info(`[GroupManager] Deleted group: ${group.name}`);

    return { success: true, group: group.name };
  }

  /**
   * Add servers to group
   */
  async addServers(tenantId, groupId, serverIds) {
    const group = await this.getGroup(tenantId, groupId);
    const currentIds = new Set(group.server_ids);
    
    serverIds.forEach(id => currentIds.add(id));

    return await this.updateGroup(tenantId, groupId, {
      server_ids: Array.from(currentIds)
    });
  }

  /**
   * Remove servers from group
   */
  async removeServers(tenantId, groupId, serverIds) {
    const group = await this.getGroup(tenantId, groupId);
    const removeSet = new Set(serverIds);
    const newIds = group.server_ids.filter(id => !removeSet.has(id));

    return await this.updateGroup(tenantId, groupId, {
      server_ids: newIds
    });
  }
}

module.exports = GroupManager;
