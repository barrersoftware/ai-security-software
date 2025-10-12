#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const SESSIONS_FILE = path.join(__dirname, 'data', 'sessions.json');
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours

// Ensure data directory exists
async function ensureDataDir() {
    const dataDir = path.join(__dirname, 'data');
    try {
        await fs.mkdir(dataDir, { recursive: true });
    } catch (err) {
        if (err.code !== 'EEXIST') throw err;
    }
}

// Hash password with salt
function hashPassword(password, salt = null) {
    if (!salt) {
        salt = crypto.randomBytes(16).toString('hex');
    }
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return { hash, salt };
}

// Verify password
function verifyPassword(password, hash, salt) {
    const { hash: newHash } = hashPassword(password, salt);
    return hash === newHash;
}

// Generate session token
function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

// Load users from file
async function loadUsers() {
    try {
        const data = await fs.readFile(USERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        if (err.code === 'ENOENT') {
            return { users: [] };
        }
        throw err;
    }
}

// Save users to file
async function saveUsers(data) {
    await ensureDataDir();
    await fs.writeFile(USERS_FILE, JSON.stringify(data, null, 2));
}

// Load sessions
async function loadSessions() {
    try {
        const data = await fs.readFile(SESSIONS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        if (err.code === 'ENOENT') {
            return { sessions: {} };
        }
        throw err;
    }
}

// Save sessions
async function saveSessions(data) {
    await ensureDataDir();
    await fs.writeFile(SESSIONS_FILE, JSON.stringify(data, null, 2));
}

// Check if initial setup is needed
async function needsSetup() {
    const data = await loadUsers();
    return data.users.length === 0;
}

// Create initial admin user
async function createAdminUser(username, password, email = '') {
    const data = await loadUsers();
    
    // Check if admin already exists
    const existing = data.users.find(u => u.username === username);
    if (existing) {
        throw new Error('User already exists');
    }
    
    const { hash, salt } = hashPassword(password);
    
    const user = {
        id: crypto.randomUUID(),
        username,
        email,
        role: 'admin',
        hash,
        salt,
        createdAt: new Date().toISOString(),
        lastLogin: null
    };
    
    data.users.push(user);
    await saveUsers(data);
    
    return { id: user.id, username: user.username, role: user.role };
}

// Authenticate user
async function authenticate(username, password) {
    const data = await loadUsers();
    const user = data.users.find(u => u.username === username);
    
    if (!user) {
        return null;
    }
    
    if (!verifyPassword(password, user.hash, user.salt)) {
        return null;
    }
    
    // Update last login
    user.lastLogin = new Date().toISOString();
    await saveUsers(data);
    
    // Create session
    const token = generateToken();
    const sessions = await loadSessions();
    
    sessions.sessions[token] = {
        userId: user.id,
        username: user.username,
        role: user.role,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + SESSION_TIMEOUT).toISOString()
    };
    
    await saveSessions(sessions);
    
    return {
        token,
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role
        }
    };
}

// Validate session token
async function validateSession(token) {
    if (!token) return null;
    
    const sessions = await loadSessions();
    const session = sessions.sessions[token];
    
    if (!session) return null;
    
    // Check if expired
    if (new Date(session.expiresAt) < new Date()) {
        delete sessions.sessions[token];
        await saveSessions(sessions);
        return null;
    }
    
    return session;
}

// Logout
async function logout(token) {
    const sessions = await loadSessions();
    delete sessions.sessions[token];
    await saveSessions(sessions);
}

// List all users (admin only)
async function listUsers() {
    const data = await loadUsers();
    return data.users.map(u => ({
        id: u.id,
        username: u.username,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt,
        lastLogin: u.lastLogin
    }));
}

// Add new user (admin only)
async function addUser(username, password, email = '', role = 'user') {
    const data = await loadUsers();
    
    // Check if user already exists
    const existing = data.users.find(u => u.username === username);
    if (existing) {
        throw new Error('User already exists');
    }
    
    const { hash, salt } = hashPassword(password);
    
    const user = {
        id: crypto.randomUUID(),
        username,
        email,
        role: role === 'admin' ? 'admin' : 'user',
        hash,
        salt,
        createdAt: new Date().toISOString(),
        lastLogin: null
    };
    
    data.users.push(user);
    await saveUsers(data);
    
    return { id: user.id, username: user.username, role: user.role };
}

// Delete user (admin only)
async function deleteUser(userId) {
    const data = await loadUsers();
    const index = data.users.findIndex(u => u.id === userId);
    
    if (index === -1) {
        throw new Error('User not found');
    }
    
    // Don't allow deleting the last admin
    const user = data.users[index];
    if (user.role === 'admin') {
        const adminCount = data.users.filter(u => u.role === 'admin').length;
        if (adminCount <= 1) {
            throw new Error('Cannot delete the last admin user');
        }
    }
    
    data.users.splice(index, 1);
    await saveUsers(data);
}

// Update user password (admin or self)
async function updatePassword(userId, newPassword) {
    const data = await loadUsers();
    const user = data.users.find(u => u.id === userId);
    
    if (!user) {
        throw new Error('User not found');
    }
    
    const { hash, salt } = hashPassword(newPassword);
    user.hash = hash;
    user.salt = salt;
    
    await saveUsers(data);
}

// Get user by ID
async function getUserById(userId) {
    const data = await loadUsers();
    const user = data.users.find(u => u.id === userId);
    
    if (!user) return null;
    
    return {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        oauth_provider: user.oauth_provider
    };
}

// Get user by email
async function getUserByEmail(email) {
    const data = await loadUsers();
    const user = data.users.find(u => u.email === email);
    
    if (!user) return null;
    
    return {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        oauth_provider: user.oauth_provider
    };
}

// Create user (for OAuth)
async function createUser(userData) {
    const data = await loadUsers();
    
    // Check if user already exists
    const existing = data.users.find(u => u.username === userData.username || u.email === userData.email);
    if (existing) {
        throw new Error('User already exists');
    }
    
    const user = {
        id: crypto.randomUUID(),
        username: userData.username,
        email: userData.email,
        name: userData.name || userData.username,
        role: userData.role || 'viewer',
        oauth_provider: userData.oauth_provider,
        oauth_id: userData.oauth_id,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString()
    };
    
    data.users.push(user);
    await saveUsers(data);
    
    return {
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role
        }
    };
}

// Link OAuth to existing account
async function linkOAuth(userId, provider, oauthId) {
    const data = await loadUsers();
    const user = data.users.find(u => u.id === userId);
    
    if (!user) {
        throw new Error('User not found');
    }
    
    user.oauth_provider = provider;
    user.oauth_id = oauthId;
    
    await saveUsers(data);
}

// Generate token for user (used by OAuth)
async function generateTokenForUser(userId) {
    const user = await getUserById(userId);
    if (!user) {
        throw new Error('User not found');
    }
    
    const token = generateToken();
    const sessions = await loadSessions();
    
    sessions.sessions[token] = {
        userId: user.id,
        username: user.username,
        role: user.role,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + SESSION_TIMEOUT).toISOString()
    };
    
    await saveSessions(sessions);
    return token;
}

// Clean up expired sessions (run periodically)
async function cleanupSessions() {
    const sessions = await loadSessions();
    const now = new Date();
    let cleaned = 0;
    
    for (const [token, session] of Object.entries(sessions.sessions)) {
        if (new Date(session.expiresAt) < now) {
            delete sessions.sessions[token];
            cleaned++;
        }
    }
    
    if (cleaned > 0) {
        await saveSessions(sessions);
        console.log(`Cleaned up ${cleaned} expired sessions`);
    }
}

// Middleware for Express
function requireAuth(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    validateSession(token).then(session => {
        if (!session) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        req.user = session;
        next();
    }).catch(err => {
        console.error('Auth error:', err);
        res.status(500).json({ error: 'Authentication error' });
    });
}

// Middleware for admin only
function requireAdmin(req, res, next) {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden - Admin access required' });
    }
    next();
}

module.exports = {
    needsSetup,
    createAdminUser,
    authenticate,
    validateSession,
    logout,
    listUsers,
    addUser,
    deleteUser,
    updatePassword,
    cleanupSessions,
    requireAuth,
    requireAdmin,
    getUserById,
    getUserByEmail,
    createUser,
    linkOAuth,
    generateToken: generateTokenForUser
};
