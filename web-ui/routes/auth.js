const express = require('express');
const router = express.Router();
const auth = require('../auth');

// Check if setup is needed
router.get('/setup/needed', async (req, res) => {
    try {
        const needed = await auth.needsSetup();
        res.json({ setupNeeded: needed });
    } catch (error) {
        console.error('Error checking setup:', error);
        res.status(500).json({ error: 'Failed to check setup status' });
    }
});

// Initial setup - create admin account
router.post('/setup', async (req, res) => {
    try {
        const setupNeeded = await auth.needsSetup();
        if (!setupNeeded) {
            return res.status(400).json({ error: 'Setup already completed' });
        }
        
        const { username, password, email } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }
        
        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }
        
        const user = await auth.createAdminUser(username, password, email);
        res.json({ 
            success: true, 
            message: 'Admin account created successfully',
            user 
        });
    } catch (error) {
        console.error('Error during setup:', error);
        res.status(500).json({ error: error.message || 'Setup failed' });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }
        
        const result = await auth.authenticate(username, password);
        
        if (!result) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        res.json(result);
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Logout
router.post('/logout', auth.requireAuth, async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        await auth.logout(token);
        res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Logout failed' });
    }
});

// Get current user info
router.get('/me', auth.requireAuth, (req, res) => {
    res.json({ user: req.user });
});

// List all users (admin only)
router.get('/users', auth.requireAuth, auth.requireAdmin, async (req, res) => {
    try {
        const users = await auth.listUsers();
        res.json({ users });
    } catch (error) {
        console.error('Error listing users:', error);
        res.status(500).json({ error: 'Failed to list users' });
    }
});

// Add new user (admin only)
router.post('/users', auth.requireAuth, auth.requireAdmin, async (req, res) => {
    try {
        const { username, password, email, role } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }
        
        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }
        
        const user = await auth.addUser(username, password, email, role);
        res.json({ 
            success: true, 
            message: 'User created successfully',
            user 
        });
    } catch (error) {
        console.error('Error adding user:', error);
        res.status(400).json({ error: error.message || 'Failed to add user' });
    }
});

// Delete user (admin only)
router.delete('/users/:userId', auth.requireAuth, auth.requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Prevent admin from deleting themselves
        if (userId === req.user.userId) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }
        
        await auth.deleteUser(userId);
        res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(400).json({ error: error.message || 'Failed to delete user' });
    }
});

// Update password
router.put('/password', auth.requireAuth, async (req, res) => {
    try {
        const { newPassword } = req.body;
        
        if (!newPassword) {
            return res.status(400).json({ error: 'New password required' });
        }
        
        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }
        
        await auth.updatePassword(req.user.userId, newPassword);
        res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        console.error('Error updating password:', error);
        res.status(500).json({ error: 'Failed to update password' });
    }
});

// Update user password (admin can change any user's password)
router.put('/users/:userId/password', auth.requireAuth, auth.requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { newPassword } = req.body;
        
        if (!newPassword) {
            return res.status(400).json({ error: 'New password required' });
        }
        
        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }
        
        await auth.updatePassword(userId, newPassword);
        res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        console.error('Error updating password:', error);
        res.status(400).json({ error: error.message || 'Failed to update password' });
    }
});

module.exports = router;
