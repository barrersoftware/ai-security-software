const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const os = require('os');

// Default to smaller model that fits in available RAM (21GB available)
// llama3.1:70b requires 42GB, use llama3.1:latest (4.9GB) instead
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:latest';

// Check if AI model is available - PUBLIC endpoint (no auth required for status check)
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
          primary: 'llama3.1:latest',
          recommended: models.find(m => m.name.includes('llama3.1:latest')) ? 'llama3.1:latest' :
                       models.find(m => m.name.includes('llama3.1')) ? 'llama3.1:latest' :
                       models.find(m => m.name.includes('llama3.2')) ? 'llama3.2:latest' :
                       models[0]?.name || 'none',
          description: 'Using llama3.1:latest (4.9GB) - fits in available RAM (21GB), good for cybersecurity analysis. Note: llama3.1:70b requires 42GB RAM.'
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

// Chat with AI assistant - Using Ollama HTTP API for better control
router.post('/message', async (req, res) => {
  const { message, model } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const selectedModel = model || DEFAULT_MODEL;

  try {
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

    // Use Ollama HTTP API with native http module
    const postData = JSON.stringify({
      model: selectedModel,
      prompt: prompt,
      stream: false
    });

    const options = {
      hostname: 'localhost',
      port: 11434,
      path: '/api/generate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 90000
    };

    const ollamaReq = http.request(options, (ollamaRes) => {
      let responseData = '';

      ollamaRes.on('data', (chunk) => {
        responseData += chunk;
      });

      ollamaRes.on('end', () => {
        try {
          const data = JSON.parse(responseData);
          res.json({
            success: true,
            response: data.response.trim(),
            model: selectedModel,
            timestamp: new Date().toISOString()
          });
        } catch (parseError) {
          res.status(500).json({
            error: 'Failed to parse response from AI model',
            message: parseError.message,
            model: selectedModel
          });
        }
      });
    });

    ollamaReq.on('error', (error) => {
      res.status(500).json({
        error: 'Failed to connect to AI model',
        message: error.message,
        model: selectedModel
      });
    });

    ollamaReq.on('timeout', () => {
      ollamaReq.destroy();
      res.status(504).json({
        error: 'Request timeout',
        message: 'The AI model took too long to respond. Try a shorter question.',
        model: selectedModel
      });
    });

    ollamaReq.write(postData);
    ollamaReq.end();

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      error: 'Failed to process message',
      message: error.message,
      model: selectedModel
    });
  }
});

module.exports = router;
