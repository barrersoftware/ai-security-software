const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

const SCRIPTS_DIR = path.join(__dirname, '..', '..', 'scripts');
const activeScans = new Map();

// Get scan status
router.get('/status', (req, res) => {
  const scans = Array.from(activeScans.entries()).map(([id, scan]) => ({
    id,
    type: scan.type,
    status: scan.status,
    startTime: scan.startTime,
    output: scan.output.slice(-100) // Last 100 lines
  }));
  res.json({ scans });
});

// Start comprehensive security scan
router.post('/start', (req, res) => {
  const scanId = Date.now().toString();
  const scriptPath = path.join(SCRIPTS_DIR, 'security-scanner.sh');
  
  const scan = {
    type: 'comprehensive',
    status: 'running',
    startTime: new Date().toISOString(),
    output: [],
    process: null
  };

  const proc = spawn('bash', [scriptPath], {
    cwd: SCRIPTS_DIR,
    env: { ...process.env, HOME: os.homedir() }
  });

  scan.process = proc;
  activeScans.set(scanId, scan);

  proc.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    scan.output.push(...lines);
    
    if (global.broadcast) {
      global.broadcast({
        type: 'scan_progress',
        scanId,
        output: lines
      });
    }
  });

  proc.stderr.on('data', (data) => {
    const lines = data.toString().split('\n');
    scan.output.push(...lines);
  });

  proc.on('close', (code) => {
    scan.status = code === 0 ? 'completed' : 'failed';
    scan.endTime = new Date().toISOString();
    scan.exitCode = code;

    if (global.broadcast) {
      global.broadcast({
        type: 'scan_complete',
        scanId,
        status: scan.status,
        exitCode: code
      });
    }

    setTimeout(() => activeScans.delete(scanId), 300000); // Clean up after 5 minutes
  });

  res.json({
    success: true,
    scanId,
    message: 'Scan started successfully'
  });
});

// Start code review
router.post('/code-review', (req, res) => {
  const { path: codePath } = req.body;
  
  if (!codePath) {
    return res.status(400).json({ error: 'Code path is required' });
  }

  const scanId = Date.now().toString();
  const scriptPath = path.join(SCRIPTS_DIR, 'code-review.sh');
  
  const scan = {
    type: 'code-review',
    status: 'running',
    startTime: new Date().toISOString(),
    output: [],
    process: null,
    targetPath: codePath
  };

  const proc = spawn('bash', [scriptPath, codePath], {
    cwd: SCRIPTS_DIR,
    env: { ...process.env, HOME: os.homedir() }
  });

  scan.process = proc;
  activeScans.set(scanId, scan);

  proc.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    scan.output.push(...lines);
    
    if (global.broadcast) {
      global.broadcast({
        type: 'scan_progress',
        scanId,
        output: lines
      });
    }
  });

  proc.stderr.on('data', (data) => {
    scan.output.push(...data.toString().split('\n'));
  });

  proc.on('close', (code) => {
    scan.status = code === 0 ? 'completed' : 'failed';
    scan.endTime = new Date().toISOString();
    scan.exitCode = code;

    if (global.broadcast) {
      global.broadcast({
        type: 'scan_complete',
        scanId,
        status: scan.status,
        exitCode: code
      });
    }

    setTimeout(() => activeScans.delete(scanId), 300000);
  });

  res.json({
    success: true,
    scanId,
    message: 'Code review started successfully'
  });
});

// Get specific scan details
router.get('/:scanId', (req, res) => {
  const { scanId } = req.params;
  const scan = activeScans.get(scanId);
  
  if (!scan) {
    return res.status(404).json({ error: 'Scan not found' });
  }

  res.json({
    id: scanId,
    type: scan.type,
    status: scan.status,
    startTime: scan.startTime,
    endTime: scan.endTime,
    output: scan.output,
    exitCode: scan.exitCode
  });
});

// Start malware scan
router.post('/malware-scan', (req, res) => {
  const scanId = Date.now().toString();
  const scriptPath = path.join(SCRIPTS_DIR, 'malware-scanner.sh');
  
  const scan = {
    type: 'malware',
    status: 'running',
    startTime: new Date().toISOString(),
    output: [],
    process: null
  };

  const proc = spawn('bash', [scriptPath], {
    cwd: SCRIPTS_DIR,
    env: { ...process.env, HOME: os.homedir() }
  });

  scan.process = proc;
  activeScans.set(scanId, scan);

  proc.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    scan.output.push(...lines);
    
    if (global.broadcast) {
      global.broadcast({
        type: 'scan_progress',
        scanId,
        output: lines
      });
    }
  });

  proc.stderr.on('data', (data) => {
    const lines = data.toString().split('\n');
    scan.output.push(...lines);
  });

  proc.on('close', (code) => {
    scan.status = code === 0 ? 'completed' : 'failed';
    scan.endTime = new Date().toISOString();
    scan.exitCode = code;

    if (global.broadcast) {
      global.broadcast({
        type: 'scan_complete',
        scanId,
        status: scan.status,
        exitCode: code
      });
    }

    setTimeout(() => activeScans.delete(scanId), 300000);
  });

  res.json({
    success: true,
    scanId,
    message: 'Malware scan started successfully'
  });
});

// Stop a running scan
router.post('/:scanId/stop', (req, res) => {
  const { scanId } = req.params;
  const scan = activeScans.get(scanId);
  
  if (!scan) {
    return res.status(404).json({ error: 'Scan not found' });
  }

  if (scan.process && scan.status === 'running') {
    scan.process.kill('SIGTERM');
    scan.status = 'stopped';
    scan.endTime = new Date().toISOString();
    
    res.json({
      success: true,
      message: 'Scan stopped successfully'
    });
  } else {
    res.status(400).json({ error: 'Scan is not running' });
  }
});

module.exports = router;
