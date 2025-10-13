#!/usr/bin/env node
/**
 * AI Security Scanner v4.0.0
 * Entry Point - Clean, Simple, Plugin-Based
 * 
 * This is the new core system entry point.
 * The old server.js has been backed up to server.js.old
 */

const CoreServer = require('./core/server');

// Create and start the core server
const server = new CoreServer();

server.start(process.env.PORT || 3000)
  .then(() => {
    // Server started successfully
    // All initialization is handled by CoreServer
  })
  .catch((err) => {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  });

// Export for testing
module.exports = server;
