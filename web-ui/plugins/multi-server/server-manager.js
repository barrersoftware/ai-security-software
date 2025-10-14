/**
 * Multi-Server Plugin - Server Manager Service
 * Handles server inventory CRUD operations
 */

const { v4: uuidv4 } = require('uuid');
const { logger } = require('../../shared/logger');

class ServerManager {
  constructor(db) {
    this.db = db;
    this.logger = logger;
  }

  /**
   * Initialize database tables
   */
  async init() {
    this.logger.info('[ServerManager] Initializing...');

    // Create servers table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS servers (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        host TEXT NOT NULL,
        port INTEGER DEFAULT 22,
        username TEXT NOT NULL,
        ssh_key_path TEXT,
        ssh_password TEXT,
        description TEXT,
        tags TEXT,
        status TEXT DEFAULT 'active',
        last_scan DATETIME,
        last_status TEXT,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, name)
      )
    `);

    // Create indexes
    await this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_servers_tenant ON servers(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_servers_status ON servers(status);
      CREATE INDEX IF NOT EXISTS idx_servers_tags ON servers(tags);
    `);

    this.logger.info('[ServerManager] ✅ Initialized');
  }

  /**
   * Add a new server
   */
  async addServer(tenantId, serverData) {
    const serverId = uuidv4();
    const {
      name,
      host,
      port = 22,
      username,
      ssh_key_path,
      ssh_password,
      description = '',
      tags = [],
      metadata = {}
    } = serverData;

    // Validate required fields
    if (!name || !host || !username) {
      throw new Error('Missing required fields: name, host, username');
    }

    // Check for duplicate name within tenant
    const existing = await this.db.get(
      'SELECT id FROM servers WHERE tenant_id = ? AND name = ?',
      [tenantId, name]
    );

    if (existing) {
      throw new Error(`Server with name "${name}" already exists`);
    }

    await this.db.run(`
      INSERT INTO servers (
        id, tenant_id, name, host, port, username, 
        ssh_key_path, ssh_password, description, tags, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      serverId,
      tenantId,
      name,
      host,
      port,
      username,
      ssh_key_path || null,
      ssh_password || null,
      description,
      JSON.stringify(tags),
      JSON.stringify(metadata)
    ]);

    this.logger.info(`[ServerManager] Added server: ${name} (${host})`);

    return await this.getServer(tenantId, serverId);
  }

  /**
   * Get all servers for a tenant
   */
  async listServers(tenantId, filters = {}) {
    const { status, tags, search, limit = 100, offset = 0 } = filters;
    
    let query = 'SELECT * FROM servers WHERE tenant_id = ?';
    const params = [tenantId];

    // Add filters
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    if (search) {
      query += ' AND (name LIKE ? OR host LIKE ? OR description LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    query += ' ORDER BY name ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const servers = await this.db.all(query, params);

    // Parse JSON fields
    return servers.map(server => ({
      ...server,
      tags: JSON.parse(server.tags || '[]'),
      metadata: JSON.parse(server.metadata || '{}')
    })).filter(server => {
      // Filter by tags if specified
      if (tags && tags.length > 0) {
        return tags.some(tag => server.tags.includes(tag));
      }
      return true;
    });
  }

  /**
   * Get a single server
   */
  async getServer(tenantId, serverId) {
    const server = await this.db.get(
      'SELECT * FROM servers WHERE tenant_id = ? AND id = ?',
      [tenantId, serverId]
    );

    if (!server) {
      throw new Error('Server not found');
    }

    return {
      ...server,
      tags: JSON.parse(server.tags || '[]'),
      metadata: JSON.parse(server.metadata || '{}')
    };
  }

  /**
   * Update a server
   */
  async updateServer(tenantId, serverId, updates) {
    const server = await this.getServer(tenantId, serverId);

    const {
      name,
      host,
      port,
      username,
      ssh_key_path,
      ssh_password,
      description,
      tags,
      status,
      metadata
    } = updates;

    // Build update query dynamically
    const fields = [];
    const params = [];

    if (name !== undefined) {
      fields.push('name = ?');
      params.push(name);
    }
    if (host !== undefined) {
      fields.push('host = ?');
      params.push(host);
    }
    if (port !== undefined) {
      fields.push('port = ?');
      params.push(port);
    }
    if (username !== undefined) {
      fields.push('username = ?');
      params.push(username);
    }
    if (ssh_key_path !== undefined) {
      fields.push('ssh_key_path = ?');
      params.push(ssh_key_path);
    }
    if (ssh_password !== undefined) {
      fields.push('ssh_password = ?');
      params.push(ssh_password);
    }
    if (description !== undefined) {
      fields.push('description = ?');
      params.push(description);
    }
    if (tags !== undefined) {
      fields.push('tags = ?');
      params.push(JSON.stringify(tags));
    }
    if (status !== undefined) {
      fields.push('status = ?');
      params.push(status);
    }
    if (metadata !== undefined) {
      fields.push('metadata = ?');
      params.push(JSON.stringify(metadata));
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');

    params.push(tenantId, serverId);

    await this.db.run(`
      UPDATE servers SET ${fields.join(', ')}
      WHERE tenant_id = ? AND id = ?
    `, params);

    this.logger.info(`[ServerManager] Updated server: ${serverId}`);

    return await this.getServer(tenantId, serverId);
  }

  /**
   * Delete a server
   */
  async deleteServer(tenantId, serverId) {
    const server = await this.getServer(tenantId, serverId);

    await this.db.run(
      'DELETE FROM servers WHERE tenant_id = ? AND id = ?',
      [tenantId, serverId]
    );

    this.logger.info(`[ServerManager] Deleted server: ${server.name}`);

    return { success: true, server: server.name };
  }

  /**
   * Update server status after scan
   */
  async updateServerStatus(tenantId, serverId, status, lastScan = null) {
    await this.db.run(`
      UPDATE servers 
      SET last_status = ?, last_scan = ?, updated_at = CURRENT_TIMESTAMP
      WHERE tenant_id = ? AND id = ?
    `, [status, lastScan || new Date().toISOString(), tenantId, serverId]);
  }

  /**
   * Get servers by IDs
   */
  async getServersByIds(tenantId, serverIds) {
    if (!serverIds || serverIds.length === 0) {
      return [];
    }

    const placeholders = serverIds.map(() => '?').join(',');
    const servers = await this.db.all(`
      SELECT * FROM servers 
      WHERE tenant_id = ? AND id IN (${placeholders})
    `, [tenantId, ...serverIds]);

    return servers.map(server => ({
      ...server,
      tags: JSON.parse(server.tags || '[]'),
      metadata: JSON.parse(server.metadata || '{}')
    }));
  }

  /**
   * Get server statistics
   */
  async getStatistics(tenantId) {
    const stats = await this.db.get(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive,
        SUM(CASE WHEN last_scan IS NOT NULL THEN 1 ELSE 0 END) as scanned
      FROM servers
      WHERE tenant_id = ?
    `, [tenantId]);

    return stats;
  }
}

module.exports = ServerManager;
