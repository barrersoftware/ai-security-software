/**
 * Authentication Service
 * Core user authentication, session management
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

class AuthService {
  constructor(core) {
    this.core = core;
    this.logger = core.getService('logger');
    this.config = core.getConfig('auth') || {};
    
    this.usersFile = path.join(core.getConfig('paths.data'), 'users.json');
    this.sessionsFile = path.join(core.getConfig('paths.data'), 'sessions.json');
    
    this.users = { users: [] };
    this.sessions = { sessions: [] };
  }
  
  async init() {
    // Ensure data directory exists
    const dataDir = this.core.getConfig('paths.data');
    await fs.mkdir(dataDir, { recursive: true });
    
    // Load users and sessions
    await this.loadUsers();
    await this.loadSessions();
    
    // Create default admin if no users exist
    if (this.users.users.length === 0) {
      await this.createDefaultAdmin();
    }
    
    this.logger.info('Auth service initialized');
  }
  
  async loadUsers() {
    try {
      const data = await fs.readFile(this.usersFile, 'utf8');
      this.users = JSON.parse(data);
    } catch (err) {
      if (err.code === 'ENOENT') {
        this.users = { users: [] };
        await this.saveUsers();
      }
    }
  }
  
  async saveUsers() {
    await fs.writeFile(this.usersFile, JSON.stringify(this.users, null, 2));
  }
  
  async loadSessions() {
    try {
      const data = await fs.readFile(this.sessionsFile, 'utf8');
      this.sessions = JSON.parse(data);
      
      // Ensure sessions is an object with sessions array
      if (!this.sessions || typeof this.sessions !== 'object') {
        this.sessions = { sessions: [] };
      }
      if (!Array.isArray(this.sessions.sessions)) {
        this.sessions.sessions = [];
      }
    } catch (err) {
      if (err.code === 'ENOENT') {
        this.sessions = { sessions: [] };
        await this.saveSessions();
      } else {
        this.logger.error('Error loading sessions:', err);
        this.sessions = { sessions: [] };
      }
    }
  }
  
  async saveSessions() {
    await fs.writeFile(this.sessionsFile, JSON.stringify(this.sessions, null, 2));
  }
  
  async createDefaultAdmin() {
    const password = crypto.randomBytes(8).toString('hex');
    const { hash, salt } = this.hashPassword(password);
    
    const admin = {
      id: crypto.randomUUID(),
      username: 'admin',
      email: 'admin@localhost',
      password: hash,
      salt,
      role: 'admin',
      mfaEnabled: false,
      createdAt: new Date().toISOString()
    };
    
    this.users.users.push(admin);
    await this.saveUsers();
    
    this.logger.info(`Default admin created - Username: admin, Password: ${password}`);
    console.log(`\n⚠️  DEFAULT ADMIN CREDENTIALS ⚠️`);
    console.log(`Username: admin`);
    console.log(`Password: ${password}`);
    console.log(`Please change this password after first login!\n`);
  }
  
  hashPassword(password, salt = null) {
    if (!salt) {
      salt = crypto.randomBytes(16).toString('hex');
    }
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return { hash, salt };
  }
  
  generateToken() {
    return crypto.randomBytes(32).toString('hex');
  }
  
  async login(username, password, mfaToken = null) {
    const user = this.users.users.find(u => u.username === username);
    
    if (!user) {
      return { success: false, error: 'Invalid credentials' };
    }
    
    // Verify password
    const { hash } = this.hashPassword(password, user.salt);
    if (hash !== user.password) {
      return { success: false, error: 'Invalid credentials' };
    }
    
    // Check if MFA is enabled
    if (user.mfaEnabled && !mfaToken) {
      return { success: false, mfaRequired: true };
    }
    
    // Create session
    const token = this.generateToken();
    const session = {
      token: token,
      userId: user.id,
      username: user.username,
      role: user.role,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + (this.config.sessionTimeout || 86400000)).toISOString()
    };
    
    // Ensure sessions array exists
    if (!this.sessions) {
      this.sessions = { sessions: [] };
    }
    if (!Array.isArray(this.sessions.sessions)) {
      this.sessions.sessions = [];
    }
    
    this.sessions.sessions.push(session);
    await this.saveSessions();
    
    this.logger.info(`User logged in: ${username}`);
    
    // Remove sensitive data
    const userResponse = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      mfaEnabled: user.mfaEnabled
    };
    
    this.logger.info(`User logged in: ${username}`);
    
    return {
      success: true,
      token,
      user: userResponse
    };
  }
  
  async logout(token) {
    this.sessions.sessions = this.sessions.sessions.filter(s => s.token !== token);
    await this.saveSessions();
    
    this.logger.info('User logged out');
    
    return { success: true };
  }
  
  async register(username, password, email) {
    // Check if user exists
    if (this.users.users.find(u => u.username === username)) {
      return { success: false, error: 'Username already exists' };
    }
    
    if (this.users.users.find(u => u.email === email)) {
      return { success: false, error: 'Email already exists' };
    }
    
    // Create user
    const { hash, salt } = this.hashPassword(password);
    const user = {
      id: crypto.randomUUID(),
      username,
      email,
      password: hash,
      salt,
      role: 'user',
      mfaEnabled: false,
      createdAt: new Date().toISOString()
    };
    
    this.users.users.push(user);
    await this.saveUsers();
    
    this.logger.info(`New user registered: ${username}`);
    
    return { success: true, message: 'User registered successfully' };
  }
  
  async validateToken(token) {
    const session = this.sessions.sessions.find(s => s.token === token);
    
    if (!session) {
      return null;
    }
    
    // Check if expired
    if (new Date(session.expiresAt) < new Date()) {
      this.sessions.sessions = this.sessions.sessions.filter(s => s.token !== token);
      await this.saveSessions();
      return null;
    }
    
    // Get user
    const user = this.users.users.find(u => u.id === session.userId);
    
    if (!user) {
      return null;
    }
    
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      mfaEnabled: user.mfaEnabled
    };
  }
  
  async cleanup() {
    // Remove expired sessions
    const now = new Date();
    this.sessions.sessions = this.sessions.sessions.filter(s => new Date(s.expiresAt) > now);
    await this.saveSessions();
  }
}

module.exports = AuthService;
