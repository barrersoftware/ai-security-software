const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const util = require('util');
const os = require('os');

const execPromise = util.promisify(exec);

// Get system information
router.get('/info', async (req, res) => {
  try {
    const info = {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemory: Math.round(os.totalmem() / (1024 * 1024 * 1024)), // GB
      freeMemory: Math.round(os.freemem() / (1024 * 1024 * 1024)), // GB
      uptime: Math.round(os.uptime() / 3600), // hours
      loadAverage: os.loadavg()
    };

    res.json(info);
  } catch (error) {
    console.error('Error getting system info:', error);
    res.status(500).json({ error: 'Failed to get system info' });
  }
});

// Get Ollama status
router.get('/ollama/status', async (req, res) => {
  try {
    const { stdout } = await execPromise('systemctl is-active ollama 2>/dev/null || echo "inactive"');
    const status = stdout.trim();
    
    res.json({
      running: status === 'active',
      status: status
    });
  } catch (error) {
    res.json({
      running: false,
      status: 'unknown',
      error: error.message
    });
  }
});

// Check disk space
router.get('/disk', async (req, res) => {
  try {
    const { stdout } = await execPromise('df -h / | tail -1');
    const parts = stdout.trim().split(/\s+/);
    
    res.json({
      filesystem: parts[0],
      size: parts[1],
      used: parts[2],
      available: parts[3],
      usePercent: parts[4],
      mountPoint: parts[5]
    });
  } catch (error) {
    console.error('Error getting disk info:', error);
    res.status(500).json({ error: 'Failed to get disk info' });
  }
});

// Get security summary
router.get('/security/summary', async (req, res) => {
  try {
    const promises = [];
    
    // Check firewall status
    promises.push(
      execPromise('sudo ufw status 2>/dev/null || echo "not installed"').catch(() => ({ stdout: 'unknown' }))
    );
    
    // Check fail2ban
    promises.push(
      execPromise('systemctl is-active fail2ban 2>/dev/null || echo "inactive"').catch(() => ({ stdout: 'inactive' }))
    );
    
    // Check for updates (Debian/Ubuntu)
    promises.push(
      execPromise('apt list --upgradable 2>/dev/null | wc -l').catch(() => ({ stdout: '0' }))
    );

    const [firewall, fail2ban, updates] = await Promise.all(promises);
    
    res.json({
      firewall: {
        status: firewall.stdout.includes('active') ? 'active' : 'inactive',
        raw: firewall.stdout.trim()
      },
      fail2ban: {
        status: fail2ban.stdout.trim()
      },
      updates: {
        available: parseInt(fail2ban.stdout.trim()) || 0
      }
    });
  } catch (error) {
    console.error('Error getting security summary:', error);
    res.status(500).json({ error: 'Failed to get security summary' });
  }
});

module.exports = router;
