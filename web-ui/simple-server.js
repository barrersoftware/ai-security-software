#!/usr/bin/env node
/**
 * Simple HTTP Server for AI Security Scanner Dashboard
 * Serves static files from public/ directory
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// MIME types
const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);

    // Handle API endpoints with mock data
    if (req.url.startsWith('/api/')) {
        handleAPI(req, res);
        return;
    }

    // Serve static files
    let filePath = path.join(PUBLIC_DIR, req.url === '/' ? 'dashboard.html' : req.url);
    
    // Security: prevent directory traversal
    if (!filePath.startsWith(PUBLIC_DIR)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    const ext = path.extname(filePath);
    const mimeType = mimeTypes[ext] || 'text/plain';

    fs.readFile(filePath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('404 - File Not Found');
            } else {
                res.writeHead(500);
                res.end('500 - Internal Server Error');
            }
            return;
        }

        res.writeHead(200, { 'Content-Type': mimeType });
        res.end(data);
    });
});

// Handle API requests with mock data
function handleAPI(req, res) {
    res.setHeader('Content-Type', 'application/json');

    // Mock responses for different endpoints
    const mockResponses = {
        '/api/ping': { status: 'ok' },
        '/api/stats': {
            totalScans: 42,
            totalUsers: 12,
            alerts: 3,
            reports: 28
        },
        '/api/scans/recent': [
            { id: 1, name: 'Weekly Scan', status: 'completed', date: new Date().toISOString() },
            { id: 2, name: 'Security Audit', status: 'running', date: new Date().toISOString() }
        ],
        '/api/system/health': {
            cpu: 45,
            memory: 62,
            disk: 38,
            uptime: '5d 3h'
        },
        '/api/system/info': {
            hostname: 'security-scanner',
            platform: 'linux',
            version: '4.11.0'
        }
    };

    // Check for matching endpoint
    for (const [endpoint, data] of Object.entries(mockResponses)) {
        if (req.url.startsWith(endpoint)) {
            res.writeHead(200);
            res.end(JSON.stringify(data));
            return;
        }
    }

    // Default response for plugin status endpoints
    if (req.url.includes('/status')) {
        res.writeHead(200);
        res.end(JSON.stringify({
            status: 'active',
            version: '1.0.0',
            lastUpdate: new Date().toISOString()
        }));
        return;
    }

    // Default 404 for API
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'API endpoint not found' }));
}

server.listen(PORT, '0.0.0.0', () => {
    console.log('╔════════════════════════════════════════════════════╗');
    console.log('║   AI Security Scanner - Dashboard Server          ║');
    console.log('╚════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`🚀 Server running on port ${PORT}`);
    console.log('');
    console.log('📱 Access the dashboard:');
    console.log(`   Local:    http://localhost:${PORT}`);
    console.log(`   Network:  http://$(hostname -I | awk '{print $1}'):${PORT}`);
    console.log('');
    console.log('📂 Serving files from: ${PUBLIC_DIR}');
    console.log('');
    console.log('Press Ctrl+C to stop the server');
    console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('\n👋 Shutting down gracefully...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('\n👋 Shutting down gracefully...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});
