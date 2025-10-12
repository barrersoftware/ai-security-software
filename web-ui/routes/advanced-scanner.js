const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

const BASE_DIR = path.join(__dirname, '..', '..');
const activeScans = new Map();

// Start custom rules scan
router.post('/custom-rules', async (req, res) => {
    const { group, severity } = req.body;
    const scanId = Date.now().toString();
    
    const scriptPath = path.join(BASE_DIR, 'custom-rules', 'run-rules.sh');
    const args = [];
    
    if (group) args.push('--group', group);
    if (severity) args.push('--severity', severity);
    
    const scan = {
        type: 'custom-rules',
        status: 'running',
        startTime: new Date().toISOString(),
        output: [],
        process: null
    };

    const proc = spawn('bash', [scriptPath, ...args], {
        cwd: path.join(BASE_DIR, 'custom-rules'),
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
        message: 'Custom rules scan started'
    });
});

// Start Kubernetes scan
router.post('/kubernetes', async (req, res) => {
    const scanId = Date.now().toString();
    const scriptPath = path.join(BASE_DIR, 'kubernetes', 'scan-k8s.sh');
    
    const scan = {
        type: 'kubernetes',
        status: 'running',
        startTime: new Date().toISOString(),
        output: [],
        process: null
    };

    const proc = spawn('bash', [scriptPath], {
        cwd: path.join(BASE_DIR, 'kubernetes'),
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
        message: 'Kubernetes scan started'
    });
});

// Start database scan
router.post('/database', async (req, res) => {
    const { databases } = req.body; // array of: mysql, postgresql, mongodb, redis
    const scanId = Date.now().toString();
    
    const scriptPath = path.join(BASE_DIR, 'database-security', 'scan-databases.sh');
    const args = databases && databases.length > 0 ? databases.map(db => `--${db}`) : ['--all'];
    
    const scan = {
        type: 'database',
        status: 'running',
        startTime: new Date().toISOString(),
        output: [],
        process: null
    };

    const proc = spawn('bash', [scriptPath, ...args], {
        cwd: path.join(BASE_DIR, 'database-security'),
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
        message: 'Database scan started'
    });
});

// Start compliance scan
router.post('/compliance', async (req, res) => {
    const { framework } = req.body; // pci-dss, hipaa, soc2, gdpr, all
    const scanId = Date.now().toString();
    
    const scriptPath = path.join(BASE_DIR, 'compliance', 'scan-compliance.sh');
    const args = ['--framework', framework || 'pci-dss'];
    
    const scan = {
        type: 'compliance',
        status: 'running',
        startTime: new Date().toISOString(),
        output: [],
        process: null,
        framework
    };

    const proc = spawn('bash', [scriptPath, ...args], {
        cwd: path.join(BASE_DIR, 'compliance'),
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
        message: `Compliance scan started (${framework})`
    });
});

// Start cloud scan
router.post('/cloud', async (req, res) => {
    const { providers } = req.body; // array of: aws, gcp, azure
    const scanId = Date.now().toString();
    
    const scriptPath = path.join(BASE_DIR, 'cloud-security', 'scan-all-clouds.sh');
    const args = [];
    
    if (providers && providers.length > 0) {
        providers.forEach(provider => {
            args.push(`--${provider}`);
        });
    } else {
        args.push('--all');
    }
    
    const scan = {
        type: 'cloud',
        status: 'running',
        startTime: new Date().toISOString(),
        output: [],
        process: null,
        providers
    };

    const proc = spawn('bash', [scriptPath, ...args], {
        cwd: path.join(BASE_DIR, 'cloud-security'),
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
        message: 'Cloud scan started'
    });
});

// Start multi-server scan
router.post('/multi-server', async (req, res) => {
    const { group, servers } = req.body;
    const scanId = Date.now().toString();
    
    const scriptPath = path.join(BASE_DIR, 'multi-server', 'scan-servers.sh');
    const args = [];
    
    if (group) {
        args.push('--group', group);
    } else if (servers) {
        args.push('--servers', servers);
    }
    
    const scan = {
        type: 'multi-server',
        status: 'running',
        startTime: new Date().toISOString(),
        output: [],
        process: null,
        target: group || servers
    };

    const proc = spawn('bash', [scriptPath, ...args], {
        cwd: path.join(BASE_DIR, 'multi-server'),
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
        message: 'Multi-server scan started'
    });
});

// Get all active advanced scans
router.get('/status', (req, res) => {
    const scans = Array.from(activeScans.entries()).map(([id, scan]) => ({
        id,
        type: scan.type,
        status: scan.status,
        startTime: scan.startTime,
        endTime: scan.endTime
    }));
    
    res.json({ scans });
});

module.exports = router;
