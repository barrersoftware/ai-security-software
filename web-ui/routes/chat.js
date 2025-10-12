const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

// Chat with AI assistant
router.post('/message', async (req, res) => {
  const { message } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    const proc = spawn('ollama', ['run', 'llama3.1:8b'], {
      env: { ...process.env, HOME: os.homedir() }
    });

    let response = '';
    let errorOutput = '';

    proc.stdout.on('data', (data) => {
      response += data.toString();
    });

    proc.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    // Send the message
    proc.stdin.write(`You are a cybersecurity expert assistant. Answer the following security question concisely and accurately:\n\n${message}\n`);
    proc.stdin.end();

    proc.on('close', (code) => {
      if (code === 0) {
        res.json({
          success: true,
          response: response.trim(),
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(500).json({
          error: 'Failed to get response',
          message: errorOutput || 'Unknown error'
        });
      }
    });

    // Timeout after 60 seconds
    setTimeout(() => {
      if (proc.exitCode === null) {
        proc.kill();
        res.status(504).json({ error: 'Request timeout' });
      }
    }, 60000);

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      error: 'Failed to process message',
      message: error.message
    });
  }
});

// Check if AI model is available
router.get('/status', async (req, res) => {
  try {
    const proc = spawn('ollama', ['list']);
    
    let output = '';
    let errorOutput = '';

    proc.stdout.on('data', (data) => {
      output += data.toString();
    });

    proc.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        const models = output
          .split('\n')
          .slice(1)
          .filter(line => line.trim())
          .map(line => {
            const parts = line.trim().split(/\s+/);
            return {
              name: parts[0],
              id: parts[1],
              size: parts[2],
              modified: parts.slice(3).join(' ')
            };
          });

        res.json({
          available: true,
          models,
          recommended: models.find(m => m.name.includes('llama3.1:8b')) ? 'llama3.1:8b' :
                       models.find(m => m.name.includes('llama3.2:3b')) ? 'llama3.2:3b' :
                       models[0]?.name || 'none'
        });
      } else {
        res.json({
          available: false,
          error: errorOutput || 'Ollama not responding'
        });
      }
    });

  } catch (error) {
    res.json({
      available: false,
      error: error.message
    });
  }
});

module.exports = router;
