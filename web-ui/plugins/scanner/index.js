/**
 * Scanner Plugin
 * Executes security scan scripts (bash/PowerShell) and manages scan lifecycle
 * Cross-platform compatible
 */

const express = require('express');
const path = require('path');

module.exports = {
  name: 'scanner',
  version: '1.0.0',
  
  async init(core) {
    this.core = core;
    this.logger = core.getService('logger');
    this.platform = core.getService('platform');
    this.broadcast = core.getService('broadcast');
    this.integrations = core.getService('integrations');
    this.utils = core.getService('utils');
    
    // Active scans tracking
    this.activeScans = new Map();
    
    // Configuration
    this.config = {
      maxConcurrentScans: 5,
      scanTimeout: 3600000, // 1 hour
      cleanupDelay: 300000   // 5 minutes
    };
    
    this.logger.info('Scanner plugin initialized');
    this.logger.info(`Scripts directory: ${this.platform.getScriptsDir()}`);
  },
  
  routes() {
    const router = express.Router();
    
    // Get all scans status
    router.get('/api/scanner/status', (req, res) => {
      try {
        const scans = Array.from(this.activeScans.entries()).map(([id, scan]) => ({
          id,
          type: scan.type,
          status: scan.status,
          startTime: scan.startTime,
          endTime: scan.endTime,
          outputLines: scan.output.length,
          preview: scan.output.slice(-10) // Last 10 lines
        }));
        
        res.json({
          success: true,
          data: {
            active: scans.filter(s => s.status === 'running').length,
            total: scans.length,
            scans
          }
        });
      } catch (err) {
        this.logger.error('Error getting scan status:', err);
        res.status(500).json({ success: false, error: err.message });
      }
    });
    
    // Start comprehensive security scan
    router.post('/api/scanner/start', async (req, res) => {
      try {
        if (this.activeScans.size >= this.config.maxConcurrentScans) {
          return res.status(429).json({
            success: false,
            error: 'Maximum concurrent scans reached'
          });
        }
        
        const scanId = await this.startScan('security-scanner', 'comprehensive');
        
        res.json({
          success: true,
          data: {
            scanId,
            message: 'Security scan started successfully'
          }
        });
      } catch (err) {
        this.logger.error('Error starting scan:', err);
        res.status(500).json({ success: false, error: err.message });
      }
    });
    
    // Start code review
    router.post('/api/scanner/code-review', async (req, res) => {
      try {
        const { path: codePath } = req.body;
        
        if (!codePath) {
          return res.status(400).json({
            success: false,
            error: 'Code path is required'
          });
        }
        
        const scanId = await this.startScan('code-review', 'code-review', [codePath]);
        
        res.json({
          success: true,
          data: {
            scanId,
            message: 'Code review started successfully',
            targetPath: codePath
          }
        });
      } catch (err) {
        this.logger.error('Error starting code review:', err);
        res.status(500).json({ success: false, error: err.message });
      }
    });
    
    // Start malware scan
    router.post('/api/scanner/malware-scan', async (req, res) => {
      try {
        const scanId = await this.startScan('malware-scanner', 'malware');
        
        res.json({
          success: true,
          data: {
            scanId,
            message: 'Malware scan started successfully'
          }
        });
      } catch (err) {
        this.logger.error('Error starting malware scan:', err);
        res.status(500).json({ success: false, error: err.message });
      }
    });
    
    // Get specific scan details
    router.get('/api/scanner/:scanId', (req, res) => {
      try {
        const { scanId } = req.params;
        const scan = this.activeScans.get(scanId);
        
        if (!scan) {
          return res.status(404).json({
            success: false,
            error: 'Scan not found'
          });
        }
        
        res.json({
          success: true,
          data: {
            id: scanId,
            type: scan.type,
            status: scan.status,
            startTime: scan.startTime,
            endTime: scan.endTime,
            output: scan.output,
            exitCode: scan.exitCode,
            error: scan.error
          }
        });
      } catch (err) {
        this.logger.error('Error getting scan details:', err);
        res.status(500).json({ success: false, error: err.message });
      }
    });
    
    // Stop a running scan
    router.post('/api/scanner/:scanId/stop', (req, res) => {
      try {
        const { scanId } = req.params;
        const scan = this.activeScans.get(scanId);
        
        if (!scan) {
          return res.status(404).json({
            success: false,
            error: 'Scan not found'
          });
        }
        
        if (scan.process && scan.status === 'running') {
          scan.process.kill('SIGTERM');
          scan.status = 'stopped';
          scan.endTime = new Date().toISOString();
          
          this.logger.info(`Scan ${scanId} stopped by user`);
          
          res.json({
            success: true,
            data: {
              message: 'Scan stopped successfully'
            }
          });
        } else {
          res.status(400).json({
            success: false,
            error: 'Scan is not running'
          });
        }
      } catch (err) {
        this.logger.error('Error stopping scan:', err);
        res.status(500).json({ success: false, error: err.message });
      }
    });
    
    // TEST ROUTE - Start test scan (for validation)
    router.post('/api/scanner/test', async (req, res) => {
      try {
        const scanId = await this.startScan('test-scanner', 'test');
        
        res.json({
          success: true,
          data: {
            scanId,
            message: 'Test scan started successfully'
          }
        });
      } catch (err) {
        this.logger.error('Error starting test scan:', err);
        res.status(500).json({ success: false, error: err.message });
      }
    });
    
    return router;
  },
  
  /**
   * Start a scan
   */
  async startScan(scriptName, scanType, args = []) {
    const scanId = Date.now().toString();
    
    this.logger.info(`Starting ${scanType} scan (ID: ${scanId})`);
    
    // Get platform-specific script path
    const scriptPath = this.platform.getScriptPath(scriptName);
    
    this.logger.debug(`Script path: ${scriptPath}`);
    
    // Create scan object
    const scan = {
      type: scanType,
      status: 'running',
      startTime: new Date().toISOString(),
      endTime: null,
      output: [],
      process: null,
      exitCode: null,
      error: null
    };
    
    try {
      // Execute script with platform-appropriate interpreter
      const proc = this.platform.executeScript(scriptPath, args, {
        cwd: this.platform.getScriptsDir(),
        env: process.env
      });
      
      scan.process = proc;
      this.activeScans.set(scanId, scan);
      
      // Handle stdout
      proc.stdout.on('data', (data) => {
        const lines = data.toString().split('\n').filter(l => l.trim());
        scan.output.push(...lines);
        
        // Broadcast to WebSocket clients
        this.broadcast({
          type: 'scan_progress',
          scanId,
          output: lines,
          linesCount: scan.output.length
        });
      });
      
      // Handle stderr
      proc.stderr.on('data', (data) => {
        const lines = data.toString().split('\n').filter(l => l.trim());
        scan.output.push(...lines);
      });
      
      // Handle process completion
      proc.on('close', async (code) => {
        scan.status = code === 0 ? 'completed' : 'failed';
        scan.endTime = new Date().toISOString();
        scan.exitCode = code;
        
        this.logger.info(`Scan ${scanId} ${scan.status} with exit code ${code}`);
        
        // Broadcast completion
        this.broadcast({
          type: 'scan_complete',
          scanId,
          status: scan.status,
          exitCode: code
        });
        
        // Send notification if configured
        try {
          const severity = code === 0 ? 'success' : 'high';
          await this.integrations.notify(
            `${scanType} scan ${scan.status}`,
            {
              title: 'Security Scan Complete',
              severity,
              channels: ['all']
            }
          );
        } catch (err) {
          this.logger.error('Error sending scan notification:', err);
        }
        
        // Schedule cleanup
        setTimeout(() => {
          this.activeScans.delete(scanId);
          this.logger.debug(`Cleaned up scan ${scanId}`);
        }, this.config.cleanupDelay);
      });
      
      // Handle errors
      proc.on('error', (err) => {
        scan.status = 'error';
        scan.error = err.message;
        scan.endTime = new Date().toISOString();
        
        this.logger.error(`Scan ${scanId} error:`, err);
        
        this.broadcast({
          type: 'scan_error',
          scanId,
          error: err.message
        });
      });
      
      // Set timeout
      setTimeout(() => {
        if (scan.status === 'running' && scan.process) {
          this.logger.warn(`Scan ${scanId} timed out, killing process`);
          scan.process.kill('SIGTERM');
          scan.status = 'timeout';
        }
      }, this.config.scanTimeout);
      
      return scanId;
      
    } catch (err) {
      this.logger.error('Error executing scan:', err);
      scan.status = 'error';
      scan.error = err.message;
      scan.endTime = new Date().toISOString();
      this.activeScans.set(scanId, scan);
      throw err;
    }
  },
  
  services() {
    return {
      scanner: {
        startScan: (scriptName, scanType, args) => 
          this.startScan(scriptName, scanType, args),
        getScan: (scanId) => this.activeScans.get(scanId),
        getAllScans: () => Array.from(this.activeScans.entries()),
        stopScan: (scanId) => {
          const scan = this.activeScans.get(scanId);
          if (scan?.process && scan.status === 'running') {
            scan.process.kill('SIGTERM');
            scan.status = 'stopped';
            return true;
          }
          return false;
        }
      }
    };
  },
  
  async destroy() {
    this.logger.info('Stopping all active scans...');
    
    // Stop all running scans
    for (const [scanId, scan] of this.activeScans.entries()) {
      if (scan.process && scan.status === 'running') {
        scan.process.kill('SIGTERM');
        this.logger.info(`Stopped scan ${scanId}`);
      }
    }
    
    this.activeScans.clear();
    this.logger.info('Scanner plugin destroyed');
  }
};
