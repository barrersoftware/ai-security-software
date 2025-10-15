/**
 * Simple Database-Based Authentication
 * Uses the users table in SQLite database
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'system.db');
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';

// Login endpoint
router.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({
            success: false,
            error: 'Username and password required'
        });
    }
    
    const db = new sqlite3.Database(DB_PATH);
    
    db.get(
        'SELECT * FROM users WHERE username = ? AND status = ?',
        [username, 'active'],
        async (err, user) => {
            if (err) {
                db.close();
                return res.status(500).json({
                    success: false,
                    error: 'Database error'
                });
            }
            
            if (!user) {
                db.close();
                return res.status(401).json({
                    success: false,
                    error: 'Invalid credentials'
                });
            }
            
            // Verify password
            const passwordMatch = await bcrypt.compare(password, user.password);
            
            if (!passwordMatch) {
                db.close();
                return res.status(401).json({
                    success: false,
                    error: 'Invalid credentials'
                });
            }
            
            // Update last login
            db.run(
                'UPDATE users SET lastLogin = datetime(\'now\') WHERE id = ?',
                [user.id],
                (err) => {
                    if (err) {
                        console.error('Error updating last login:', err);
                    }
                }
            );
            
            // Generate JWT token
            const token = jwt.sign(
                { 
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    role: user.role
                },
                JWT_SECRET,
                { expiresIn: '24h' }
            );
            
            db.close();
            
            res.json({
                success: true,
                data: {
                    token,
                    user: {
                        id: user.id,
                        username: user.username,
                        email: user.email,
                        role: user.role
                    }
                }
            });
        }
    );
});

// Verify token middleware
function verifyToken(req, res, next) {
    const token = req.headers['authorization']?.replace('Bearer ', '');
    
    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'No token provided'
        });
    }
    
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({
                success: false,
                error: 'Invalid token'
            });
        }
        
        req.user = decoded;
        next();
    });
}

// Check session / verify token
router.get('/api/session', verifyToken, (req, res) => {
    res.json({
        success: true,
        user: req.user
    });
});

// Logout (client-side should delete token)
router.post('/api/logout', (req, res) => {
    res.json({
        success: true,
        message: 'Logged out successfully'
    });
});

module.exports = router;
