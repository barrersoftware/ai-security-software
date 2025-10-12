#!/usr/bin/env node
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');
const chokidar = require('chokidar');
const os = require('os');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
const REPORTS_DIR = path.join(os.homedir(), 'security-reports');
const SCRIPTS_DIR = path.join(__dirname, '..', 'scripts');

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
const scannerRoutes = require('./routes/scanner');
const reportsRoutes = require('./routes/reports');
const chatRoutes = require('./routes/chat');
const systemRoutes = require('./routes/system');

app.use('/api/scanner', scannerRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/system', systemRoutes);

// WebSocket connections for real-time updates
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log('Client connected. Total clients:', clients.size);

  ws.on('close', () => {
    clients.delete(ws);
    console.log('Client disconnected. Total clients:', clients.size);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(ws);
  });
});

// Broadcast to all connected clients
function broadcast(data) {
  const message = JSON.stringify(data);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Watch for new reports
async function setupReportWatcher() {
  try {
    await fs.mkdir(REPORTS_DIR, { recursive: true });
    
    const watcher = chokidar.watch(REPORTS_DIR, {
      ignored: /(^|[\/\\])\../,
      persistent: true,
      ignoreInitial: true
    });

    watcher.on('add', (filepath) => {
      console.log('New report detected:', filepath);
      broadcast({
        type: 'new_report',
        filename: path.basename(filepath),
        timestamp: new Date().toISOString()
      });
    });

    watcher.on('change', (filepath) => {
      broadcast({
        type: 'report_updated',
        filename: path.basename(filepath),
        timestamp: new Date().toISOString()
      });
    });
  } catch (error) {
    console.error('Error setting up report watcher:', error);
  }
}

// Make broadcast available globally
global.broadcast = broadcast;

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// Start server
server.listen(PORT, () => {
  console.log(`🛡️  AI Security Scanner Web UI`);
  console.log(`📡 Server running on http://localhost:${PORT}`);
  console.log(`🔍 Reports directory: ${REPORTS_DIR}`);
  console.log(`📜 Scripts directory: ${SCRIPTS_DIR}`);
  setupReportWatcher();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = { app, broadcast };
