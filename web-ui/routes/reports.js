const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { marked } = require('marked');

const REPORTS_DIR = path.join(os.homedir(), 'security-reports');

// List all reports
router.get('/', async (req, res) => {
  try {
    await fs.mkdir(REPORTS_DIR, { recursive: true });
    const files = await fs.readdir(REPORTS_DIR);
    
    const reports = await Promise.all(
      files
        .filter(f => f.endsWith('.md') || f.endsWith('.txt'))
        .map(async (filename) => {
          const filepath = path.join(REPORTS_DIR, filename);
          const stats = await fs.stat(filepath);
          
          return {
            filename,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime,
            type: filename.includes('security_analysis') ? 'comprehensive' : 
                  filename.includes('code_review') ? 'code-review' :
                  filename.includes('monitor') ? 'monitor' : 'other'
          };
        })
    );

    // Sort by modified date, newest first
    reports.sort((a, b) => b.modified - a.modified);
    
    res.json({ reports });
  } catch (error) {
    console.error('Error listing reports:', error);
    res.status(500).json({ error: 'Failed to list reports', message: error.message });
  }
});

// Get specific report content
router.get('/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const { format = 'raw' } = req.query;
    
    // Security: prevent directory traversal
    const safeName = path.basename(filename);
    const filepath = path.join(REPORTS_DIR, safeName);
    
    const content = await fs.readFile(filepath, 'utf8');
    
    if (format === 'html' && safeName.endsWith('.md')) {
      const html = marked(content);
      res.json({ filename: safeName, html, raw: content });
    } else {
      res.json({ filename: safeName, content });
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.status(404).json({ error: 'Report not found' });
    } else {
      console.error('Error reading report:', error);
      res.status(500).json({ error: 'Failed to read report', message: error.message });
    }
  }
});

// Delete a report
router.delete('/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const safeName = path.basename(filename);
    const filepath = path.join(REPORTS_DIR, safeName);
    
    await fs.unlink(filepath);
    
    res.json({
      success: true,
      message: 'Report deleted successfully'
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.status(404).json({ error: 'Report not found' });
    } else {
      console.error('Error deleting report:', error);
      res.status(500).json({ error: 'Failed to delete report', message: error.message });
    }
  }
});

// Get report statistics
router.get('/stats/summary', async (req, res) => {
  try {
    await fs.mkdir(REPORTS_DIR, { recursive: true });
    const files = await fs.readdir(REPORTS_DIR);
    
    const stats = {
      totalReports: 0,
      comprehensive: 0,
      codeReviews: 0,
      monitors: 0,
      other: 0,
      totalSize: 0,
      latestReport: null
    };

    let latestTime = 0;
    
    for (const filename of files) {
      if (!filename.endsWith('.md') && !filename.endsWith('.txt')) continue;
      
      const filepath = path.join(REPORTS_DIR, filename);
      const fileStats = await fs.stat(filepath);
      
      stats.totalReports++;
      stats.totalSize += fileStats.size;
      
      if (filename.includes('security_analysis')) stats.comprehensive++;
      else if (filename.includes('code_review')) stats.codeReviews++;
      else if (filename.includes('monitor')) stats.monitors++;
      else stats.other++;
      
      if (fileStats.mtime.getTime() > latestTime) {
        latestTime = fileStats.mtime.getTime();
        stats.latestReport = {
          filename,
          modified: fileStats.mtime
        };
      }
    }
    
    res.json(stats);
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: 'Failed to get statistics', message: error.message });
  }
});

module.exports = router;
