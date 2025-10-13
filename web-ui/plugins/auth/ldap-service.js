/**
 * LDAP/Active Directory Service
 * Enterprise authentication via LDAP/AD
 */

const ldap = require('ldapjs');

class LDAPService {
  constructor(core) {
    this.core = core;
    this.logger = core.getService('logger');
    
    // LDAP Configuration
    this.config = {
      enabled: process.env.LDAP_ENABLED === 'true',
      url: process.env.LDAP_URL || 'ldap://localhost:389',
      bindDN: process.env.LDAP_BIND_DN || '',
      bindPassword: process.env.LDAP_BIND_PASSWORD || '',
      baseDN: process.env.LDAP_BASE_DN || 'dc=example,dc=com',
      userSearchBase: process.env.LDAP_USER_SEARCH_BASE || 'ou=users,dc=example,dc=com',
      groupSearchBase: process.env.LDAP_GROUP_SEARCH_BASE || 'ou=groups,dc=example,dc=com',
      usernameAttribute: process.env.LDAP_USERNAME_ATTR || 'uid',
      emailAttribute: process.env.LDAP_EMAIL_ATTR || 'mail',
      nameAttribute: process.env.LDAP_NAME_ATTR || 'cn',
      groupAttribute: process.env.LDAP_GROUP_ATTR || 'memberOf',
      
      // Active Directory specific
      isActiveDirectory: process.env.LDAP_IS_AD === 'true',
      adDomain: process.env.AD_DOMAIN || 'DOMAIN',
      
      // Role mapping
      roleMapping: {
        'cn=admins,ou=groups,dc=example,dc=com': 'admin',
        'cn=users,ou=groups,dc=example,dc=com': 'user',
        'cn=security,ou=groups,dc=example,dc=com': 'security_analyst'
      },
      
      // Connection options
      timeout: 5000,
      connectTimeout: 10000,
      tlsOptions: {
        rejectUnauthorized: process.env.LDAP_TLS_REJECT_UNAUTHORIZED !== 'false'
      }
    };
    
    this.client = null;
  }
  
  async init() {
    if (!this.config.enabled) {
      this.logger.info('LDAP authentication disabled');
      return;
    }
    
    this.logger.info('LDAP service initialized');
    this.logger.info(`LDAP URL: ${this.config.url}`);
    this.logger.info(`Base DN: ${this.config.baseDN}`);
    
    if (this.config.isActiveDirectory) {
      this.logger.info(`Active Directory mode enabled - Domain: ${this.config.adDomain}`);
    }
  }
  
  /**
   * Authenticate user via LDAP/AD
   */
  async authenticate(username, password) {
    if (!this.config.enabled) {
      return { success: false, error: 'LDAP authentication not enabled' };
    }
    
    try {
      // Create LDAP client
      const client = ldap.createClient({
        url: this.config.url,
        timeout: this.config.timeout,
        connectTimeout: this.config.connectTimeout,
        tlsOptions: this.config.tlsOptions
      });
      
      // Construct user DN
      let userDN;
      if (this.config.isActiveDirectory) {
        // Active Directory: Use UPN (user@domain.com) or DOMAIN\user format
        userDN = username.includes('@') 
          ? username 
          : `${this.config.adDomain}\\${username}`;
      } else {
        // Standard LDAP: Use full DN
        userDN = `${this.config.usernameAttribute}=${username},${this.config.userSearchBase}`;
      }
      
      // Attempt bind (authentication)
      await this.bindUser(client, userDN, password);
      
      // Get user details
      const userInfo = await this.getUserInfo(client, username);
      
      // Get user groups/roles
      const groups = await this.getUserGroups(client, userInfo.dn);
      
      // Map LDAP groups to application roles
      const role = this.mapGroupsToRole(groups);
      
      // Close connection
      client.unbind();
      
      this.logger.info(`LDAP authentication successful: ${username}`);
      
      return {
        success: true,
        user: {
          username: userInfo.username,
          email: userInfo.email,
          name: userInfo.name,
          role: role,
          groups: groups,
          source: 'ldap',
          dn: userInfo.dn
        }
      };
      
    } catch (err) {
      this.logger.error('LDAP authentication failed:', err);
      return {
        success: false,
        error: 'LDAP authentication failed: ' + err.message
      };
    }
  }
  
  /**
   * Bind user to LDAP
   */
  bindUser(client, userDN, password) {
    return new Promise((resolve, reject) => {
      client.bind(userDN, password, (err) => {
        if (err) {
          reject(new Error('Invalid credentials'));
        } else {
          resolve();
        }
      });
    });
  }
  
  /**
   * Get user information from LDAP
   */
  async getUserInfo(client, username) {
    return new Promise((resolve, reject) => {
      const searchFilter = `(${this.config.usernameAttribute}=${username})`;
      const searchOptions = {
        scope: 'sub',
        filter: searchFilter,
        attributes: [
          this.config.usernameAttribute,
          this.config.emailAttribute,
          this.config.nameAttribute,
          this.config.groupAttribute,
          'dn'
        ]
      };
      
      client.search(this.config.userSearchBase, searchOptions, (err, res) => {
        if (err) {
          return reject(err);
        }
        
        let userInfo = null;
        
        res.on('searchEntry', (entry) => {
          userInfo = {
            dn: entry.objectName,
            username: entry.object[this.config.usernameAttribute],
            email: entry.object[this.config.emailAttribute],
            name: entry.object[this.config.nameAttribute],
            groups: entry.object[this.config.groupAttribute] || []
          };
        });
        
        res.on('error', (err) => {
          reject(err);
        });
        
        res.on('end', () => {
          if (userInfo) {
            resolve(userInfo);
          } else {
            reject(new Error('User not found'));
          }
        });
      });
    });
  }
  
  /**
   * Get user groups from LDAP
   */
  async getUserGroups(client, userDN) {
    return new Promise((resolve, reject) => {
      const searchFilter = `(member=${userDN})`;
      const searchOptions = {
        scope: 'sub',
        filter: searchFilter,
        attributes: ['cn', 'dn']
      };
      
      client.search(this.config.groupSearchBase, searchOptions, (err, res) => {
        if (err) {
          // If group search fails, return empty array (not critical)
          this.logger.warn('Group search failed:', err);
          return resolve([]);
        }
        
        const groups = [];
        
        res.on('searchEntry', (entry) => {
          groups.push({
            name: entry.object.cn,
            dn: entry.objectName
          });
        });
        
        res.on('error', (err) => {
          this.logger.warn('Group search error:', err);
          resolve([]);
        });
        
        res.on('end', () => {
          resolve(groups);
        });
      });
    });
  }
  
  /**
   * Map LDAP groups to application roles
   */
  mapGroupsToRole(groups) {
    // Check each group against role mapping
    for (const group of groups) {
      const role = this.config.roleMapping[group.dn];
      if (role) {
        return role;
      }
    }
    
    // Default role
    return 'user';
  }
  
  /**
   * Verify LDAP connection
   */
  async verifyConnection() {
    if (!this.config.enabled) {
      return { success: false, error: 'LDAP not enabled' };
    }
    
    try {
      const client = ldap.createClient({
        url: this.config.url,
        timeout: this.config.timeout,
        connectTimeout: this.config.connectTimeout
      });
      
      // Try to bind with service account
      await this.bindUser(client, this.config.bindDN, this.config.bindPassword);
      
      client.unbind();
      
      return { success: true, message: 'LDAP connection successful' };
      
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
  
  /**
   * Search LDAP users (admin function)
   */
  async searchUsers(searchTerm, limit = 10) {
    if (!this.config.enabled) {
      return { success: false, error: 'LDAP not enabled' };
    }
    
    try {
      const client = ldap.createClient({ url: this.config.url });
      
      await this.bindUser(client, this.config.bindDN, this.config.bindPassword);
      
      const searchFilter = `(|(${this.config.usernameAttribute}=*${searchTerm}*)(${this.config.emailAttribute}=*${searchTerm}*)(${this.config.nameAttribute}=*${searchTerm}*))`;
      const searchOptions = {
        scope: 'sub',
        filter: searchFilter,
        attributes: [
          this.config.usernameAttribute,
          this.config.emailAttribute,
          this.config.nameAttribute
        ],
        sizeLimit: limit
      };
      
      const users = await new Promise((resolve, reject) => {
        const results = [];
        
        client.search(this.config.userSearchBase, searchOptions, (err, res) => {
          if (err) return reject(err);
          
          res.on('searchEntry', (entry) => {
            results.push({
              username: entry.object[this.config.usernameAttribute],
              email: entry.object[this.config.emailAttribute],
              name: entry.object[this.config.nameAttribute]
            });
          });
          
          res.on('error', reject);
          res.on('end', () => resolve(results));
        });
      });
      
      client.unbind();
      
      return { success: true, users };
      
    } catch (err) {
      this.logger.error('LDAP search failed:', err);
      return { success: false, error: err.message };
    }
  }
  
  /**
   * Get LDAP configuration status (safe for API)
   */
  getStatus() {
    return {
      enabled: this.config.enabled,
      url: this.config.url,
      baseDN: this.config.baseDN,
      isActiveDirectory: this.config.isActiveDirectory,
      domain: this.config.adDomain,
      configured: !!(this.config.url && this.config.baseDN)
    };
  }
}

module.exports = LDAPService;
