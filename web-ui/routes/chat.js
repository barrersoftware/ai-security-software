const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

// Default to best available model (llama3.1:70b is superior for security)
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:70b';

// Chat with AI assistant
router.post('/message', async (req, res) => {
  const { message, model } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const selectedModel = model || DEFAULT_MODEL;

  try {
    const proc = spawn('ollama', ['run', selectedModel], {
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

    // Enhanced cybersecurity expert prompt
    const prompt = `You are an expert cybersecurity professional and security analyst with deep knowledge of:
- Network security, penetration testing, and vulnerability assessment
- Application security (OWASP Top 10, secure coding, API security)
- Cloud security (AWS, Azure, GCP security best practices)
- Compliance frameworks (PCI-DSS, HIPAA, GDPR, SOC 2, ISO 27001)
- Incident response and threat intelligence
- Security tools and technologies
- Cryptography and encryption standards

Provide clear, actionable, and technically accurate security guidance. Be concise but comprehensive.

User Question: ${message}

Response:`;

    // Send the message
    proc.stdin.write(prompt);
    proc.stdin.end();

    proc.on('close', (code) => {
      if (code === 0) {
        res.json({
          success: true,
          response: response.trim(),
          model: selectedModel,
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(500).json({
          error: 'Failed to get response from AI model',
          message: errorOutput || 'Unknown error',
          model: selectedModel
        });
      }
    });

    // Timeout after 90 seconds (70b model needs more time)
    setTimeout(() => {
      if (proc.exitCode === null) {
        proc.kill();
        res.status(504).json({ 
          error: 'Request timeout', 
          message: 'The AI model took too long to respond. Try a shorter question.' 
        });
      }
    }, 90000);

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
          primary: 'llama3.1:70b',
          recommended: models.find(m => m.name.includes('llama3.1:70b')) ? 'llama3.1:70b' :
                       models.find(m => m.name.includes('llama3.1')) ? 'llama3.1:latest' :
                       models.find(m => m.name.includes('llama3.2:3b')) ? 'llama3.2:3b' :
                       models.find(m => m.name.includes('llama3.2')) ? 'llama3.2:latest' :
                       models[0]?.name || 'none',
          description: 'Using llama3.1:70b - superior model for cybersecurity analysis'
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
