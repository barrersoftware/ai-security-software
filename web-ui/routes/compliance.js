const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

const COMPLIANCE_DIR = path.join(__dirname, '..', '..', 'compliance');
const REPORTS_DIR = path.join(os.homedir(), 'security-reports');

// Run standard compliance scan
router.post('/scan', async (req, res) => {
    try {
        const { framework, notify } = req.body;
        
        const scriptPath = path.join(COMPLIANCE_DIR, 'scan-compliance.sh');
        const args = ['--framework', framework || 'pci-dss'];
        
        if (notify) {
            args.push('--notify');
        }
        
        const childProcess = spawn(scriptPath, args, {
            cwd: COMPLIANCE_DIR,
            env: { ...process.env }
        });
        
        let output = '';
        let errorOutput = '';
        
        childProcess.stdout.on('data', (data) => {
            output += data.toString();
            if (global.broadcast) {
                global.broadcast({
                    type: 'compliance_output',
                    data: data.toString(),
                    framework
                });
            }
        });
        
        childProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });
        
        childProcess.on('close', (code) => {
            if (global.broadcast) {
                global.broadcast({
                    type: 'compliance_complete',
                    framework,
                    code,
                    success: code === 0
                });
            }
        });
        
        res.json({ 
            success: true, 
            message: `Compliance scan started (${framework})`,
            framework
        });
    } catch (error) {
        console.error('Error starting compliance scan:', error);
        res.status(500).json({ error: 'Failed to start compliance scan' });
    }
});

// Run NIST scan
router.post('/nist', async (req, res) => {
    try {
        const { framework, notify } = req.body;
        
        const scriptPath = path.join(COMPLIANCE_DIR, 'scan-nist.sh');
        const args = ['--framework', framework || 'csf'];
        
        if (notify) {
            args.push('--notify');
        }
        
        const childProcess = spawn(scriptPath, args, {
            cwd: COMPLIANCE_DIR,
            env: { ...process.env }
        });
        
        let output = '';
        
        childProcess.stdout.on('data', (data) => {
            output += data.toString();
            if (global.broadcast) {
                global.broadcast({
                    type: 'nist_output',
                    data: data.toString(),
                    framework
                });
            }
        });
        
        childProcess.on('close', (code) => {
            if (global.broadcast) {
                global.broadcast({
                    type: 'nist_complete',
                    framework,
                    code,
                    success: code === 0
                });
            }
        });
        
        res.json({ 
            success: true, 
            message: `NIST scan started (${framework})`,
            framework
        });
    } catch (error) {
        console.error('Error starting NIST scan:', error);
        res.status(500).json({ error: 'Failed to start NIST scan' });
    }
});

// Run ISO 27001 scan
router.post('/iso27001', async (req, res) => {
    try {
        const { notify } = req.body;
        
        const scriptPath = path.join(COMPLIANCE_DIR, 'scan-iso27001.sh');
        const args = [];
        
        if (notify) {
            args.push('--notify');
        }
        
        const childProcess = spawn(scriptPath, args, {
            cwd: COMPLIANCE_DIR,
            env: { ...process.env }
        });
        
        let output = '';
        
        childProcess.stdout.on('data', (data) => {
            output += data.toString();
            if (global.broadcast) {
                global.broadcast({
                    type: 'iso27001_output',
                    data: data.toString()
                });
            }
        });
        
        childProcess.on('close', (code) => {
            if (global.broadcast) {
                global.broadcast({
                    type: 'iso27001_complete',
                    code,
                    success: code === 0
                });
            }
        });
        
        res.json({ 
            success: true, 
            message: 'ISO 27001 scan started'
        });
    } catch (error) {
        console.error('Error starting ISO 27001 scan:', error);
        res.status(500).json({ error: 'Failed to start ISO 27001 scan' });
    }
});

// Run OpenSCAP scan
router.post('/openscap', async (req, res) => {
    try {
        const { profile, analyze, fix, notify } = req.body;
        
        const scriptPath = path.join(COMPLIANCE_DIR, 'scan-openscap.sh');
        const args = ['--profile', profile || 'standard'];
        
        if (analyze) {
            args.push('--analyze');
        }
        
        if (fix) {
            args.push('--fix');
        }
        
        if (notify) {
            args.push('--notify');
        }
        
        // Check if OpenSCAP is installed
        try {
            const { spawn: spawnSync } = require('child_process');
            const check = spawnSync('which', ['oscap']);
            if (check.status !== 0) {
                return res.status(400).json({ 
                    error: 'OpenSCAP not installed',
                    message: 'Please install OpenSCAP first: cd scripts && sudo ./install-openscap.sh'
                });
            }
        } catch (e) {
            // Continue anyway
        }
        
        const childProcess = spawn('sudo', [scriptPath, ...args], {
            cwd: COMPLIANCE_DIR,
            env: { ...process.env }
        });
        
        let output = '';
        let errorOutput = '';
        
        childProcess.stdout.on('data', (data) => {
            output += data.toString();
            if (global.broadcast) {
                global.broadcast({
                    type: 'openscap_output',
                    data: data.toString(),
                    profile
                });
            }
        });
        
        childProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });
        
        childProcess.on('close', (code) => {
            if (global.broadcast) {
                global.broadcast({
                    type: 'openscap_complete',
                    profile,
                    code,
                    success: code === 0 || code === 2 // 2 means some checks failed but scan completed
                });
            }
        });
        
        res.json({ 
            success: true, 
            message: `OpenSCAP scan started (profile: ${profile})`,
            profile
        });
    } catch (error) {
        console.error('Error starting OpenSCAP scan:', error);
        res.status(500).json({ error: 'Failed to start OpenSCAP scan' });
    }
});

// Run DISA STIG scan
router.post('/disa-stig', async (req, res) => {
    try {
        const { category, analyze, fix, notify } = req.body;
        
        const scriptPath = path.join(COMPLIANCE_DIR, 'scan-disa-stig.sh');
        const args = [];
        
        if (category) {
            args.push('--category', category);
        }
        
        if (analyze) {
            args.push('--analyze');
        }
        
        if (fix) {
            args.push('--fix');
        }
        
        if (notify) {
            args.push('--notify');
        }
        
        // Check if OpenSCAP is installed
        try {
            const { spawn: spawnSync } = require('child_process');
            const check = spawnSync('which', ['oscap']);
            if (check.status !== 0) {
                return res.status(400).json({ 
                    error: 'OpenSCAP not installed',
                    message: 'Please install OpenSCAP first: cd scripts && sudo ./install-openscap.sh'
                });
            }
        } catch (e) {
            // Continue anyway
        }
        
        const childProcess = spawn('sudo', [scriptPath, ...args], {
            cwd: COMPLIANCE_DIR,
            env: { ...process.env }
        });
        
        let output = '';
        let errorOutput = '';
        
        childProcess.stdout.on('data', (data) => {
            output += data.toString();
            if (global.broadcast) {
                global.broadcast({
                    type: 'disa_stig_output',
                    data: data.toString(),
                    category: category || 'all'
                });
            }
        });
        
        childProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });
        
        childProcess.on('close', (code) => {
            if (global.broadcast) {
                global.broadcast({
                    type: 'disa_stig_complete',
                    category: category || 'all',
                    code,
                    success: code === 0 || code === 2
                });
            }
        });
        
        res.json({ 
            success: true, 
            message: `DISA STIG scan started${category ? ' (category: ' + category + ')' : ''}`,
            category: category || 'all'
        });
    } catch (error) {
        console.error('Error starting DISA STIG scan:', error);
        res.status(500).json({ error: 'Failed to start DISA STIG scan' });
    }
});

// List available OpenSCAP profiles
router.get('/openscap/profiles', async (req, res) => {
    try {
        res.json({
            profiles: [
                { id: 'standard', name: 'Standard Security Baseline', description: 'Basic security hardening' },
                { id: 'pci-dss', name: 'PCI-DSS', description: 'Payment Card Industry compliance' },
                { id: 'hipaa', name: 'HIPAA', description: 'Healthcare data protection' },
                { id: 'cis', name: 'CIS Benchmark Level 1', description: 'Industry best practices' },
                { id: 'cis-server-l2', name: 'CIS Server Level 2', description: 'Stricter server hardening' },
                { id: 'stig', name: 'DISA STIG', description: 'DoD/Government compliance' },
                { id: 'ospp', name: 'OSPP', description: 'Common Criteria OSPP' },
                { id: 'cui', name: 'CUI', description: 'Controlled Unclassified Information' }
            ]
        });
    } catch (error) {
        console.error('Error listing profiles:', error);
        res.status(500).json({ error: 'Failed to list profiles' });
    }
});

// Check OpenSCAP installation status
router.get('/openscap/status', async (req, res) => {
    try {
        const { spawn: spawnSync } = require('child_process');
        
        // Check if oscap is installed
        const oscapCheck = spawnSync('which', ['oscap']);
        const oscapInstalled = oscapCheck.status === 0;
        
        // Check for SCAP content
        const contentDir = '/usr/share/xml/scap/ssg/content';
        let contentFiles = [];
        try {
            const files = await fs.readdir(contentDir);
            contentFiles = files.filter(f => f.endsWith('.xml'));
        } catch (e) {
            // Directory doesn't exist
        }
        
        res.json({
            installed: oscapInstalled,
            contentAvailable: contentFiles.length > 0,
            contentFiles: contentFiles.length,
            installCommand: 'cd scripts && sudo ./install-openscap.sh'
        });
    } catch (error) {
        console.error('Error checking OpenSCAP status:', error);
        res.json({
            installed: false,
            contentAvailable: false,
            error: error.message
        });
    }
});

module.exports = router;
