import express from 'express';
import fetch from 'node-fetch';

const app = express();
const API_BASE_URL = 'https://agent-backend-typescript.onrender.com';
//const API_BASE_URL = 'http://localhost:3000/api';

const OPENAI_API_URL = 'https://api.openai.com/v1';

// Parse JSON request body
app.use(express.json());

// Enable CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Proxy OpenAI API requests
app.post('/api/openai.com/:path(*)', async (req, res) => {
  try {
    const path = req.params.path;
    const url = `${OPENAI_API_URL}/${path}`;
    
    console.log(`Proxying OpenAI request to: ${url}`);
    
    // Get the OpenAI API key from the request headers or environment variable
    let apiKey = req.headers['authorization'];
    if (apiKey && apiKey.startsWith('Bearer ')) {
      apiKey = apiKey.substring(7); // Remove 'Bearer ' prefix
    } else {
      apiKey = req.headers['x-openai-api-key'] || process.env.VITE_OPENAI_API_KEY;
    }
    
    if (!apiKey) {
      return res.status(401).json({ error: 'OpenAI API key is required' });
    }
    
    console.log('Using API key format:', apiKey.substring(0, 10) + '...');
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(req.body),
    });
    
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      return res.status(response.status).json(data);
    } else {
      const text = await response.text();
      return res.status(response.status).send(text);
    }
  } catch (error) {
    console.error('OpenAI proxy error:', error);
    res.status(500).json({ error: 'OpenAI proxy error', details: error.message });
  }
});

// Fallback speech synthesis for browsers
app.post('/api/synthesize', async (req, res) => {
  try {
    const { text, persona } = req.body;
    
    // First try to proxy to the EC2 instance
    try {
      const url = `${API_BASE_URL}/synthesize`;
      console.log(`Proxying synthesize request to: ${url}`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(req.body),
      });
      
      if (response.ok) {
        // If the EC2 instance returns audio, stream it back
        const contentType = response.headers.get('content-type');
        if (contentType && !contentType.includes('application/json')) {
          // Stream the audio data back
          response.body.pipe(res);
          return;
        }
      }
      
      // If we get here, the EC2 instance didn't return audio
      throw new Error('EC2 instance did not return audio');
    } catch (error) {
      console.log('Falling back to browser speech synthesis');
      // Return a JSON response that will trigger the browser's fallback speech synthesis
      return res.status(200).json({
        fallback: true,
        text: text,
        message: 'Using browser speech synthesis as fallback'
      });
    }
  } catch (error) {
    console.error('Speech synthesis error:', error);
    res.status(500).json({ error: 'Speech synthesis failed', details: error.message });
  }
});

// Get available voices
app.get('/api/voices', async (req, res) => {
  try {
    // Try to proxy to the EC2 instance
    try {
      const url = `${API_BASE_URL}/voices`;
      console.log(`Proxying voices request to: ${url}`);
      
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        return res.status(200).json(data);
      }
      
      throw new Error('Failed to fetch voices from EC2 instance');
    } catch (error) {
      console.log('Returning default voices');
      // Return some default voices as fallback
      return res.status(200).json([
        { voice_id: "default_male", name: "Default Male" },
        { voice_id: "default_female", name: "Default Female" }
      ]);
    }
  } catch (error) {
    console.error('Voices fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch voices', details: error.message });
  }
});

// Proxy all other API requests
app.all('/api/:path(*)', async (req, res, next) => {
  try {
    const path = req.params.path;
    
    // Skip OpenAI API requests, they're handled separately
    if (path.startsWith('openai/')) {
      return next();
    }
    
    const url = `${API_BASE_URL}/${path}`;
    
    console.log(`Proxying request to: ${url}`);
    
    const response = await fetch(url, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        ...req.headers,
      },
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
    });
    
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      return res.status(response.status).json(data);
    } else {
      const text = await response.text();
      return res.status(response.status).send(text);
    }
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Proxy server error', details: error.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

export default app;
