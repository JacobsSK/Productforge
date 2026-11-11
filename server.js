const express = require('express');
const path = require('path');
const security = require('./security');
const app = express();

// The AI call is fixed here on the server. Whatever model or reply length the
// browser sends is ignored.
const AI_MODEL = 'claude-sonnet-4-6';
const AI_MAX_TOKENS = 4000;

// Folder that holds index.html
const PAGE_DIR = __dirname;

// App password on every /api route (except /api/health) + serves /auth.js.
// Runs before the body is read, so strangers can't even upload data.
security.install(app);

app.use(express.json({ limit: '10mb' }));
// index.html sits next to server.js here, so it's served by the catch-all below (the folder itself is not exposed).

// Secure proxy — API key never touches the browser
app.post('/api/claude', security.aiLimit, async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY environment variable not set' });
  }

  const body = security.lockedClaudeBody(req.body, { model: AI_MODEL, maxTokens: AI_MAX_TOKENS });
  if (!body) return res.status(400).json({ error: 'messages[] is required' });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (error) {
    console.error('Proxy error:', error.message);
    res.status(500).json({ error: 'Failed to reach Anthropic API', details: error.message });
  }
});

// Catch-all — serves your index.html for any unmatched route
app.get('*', (req, res) => {
  res.sendFile(path.join(PAGE_DIR, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
