import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: __dirname + '/.env.local' });

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid request: messages array is required' });
    }

    if (!DEEPSEEK_API_KEY) {
      console.error('DeepSeek API key is not configured');
      return res.status(500).json({ error: 'API configuration error' });
    }

    console.log('Sending request to DeepSeek API:', {
      messages,
      apiKey: DEEPSEEK_API_KEY ? '***' : 'missing'
    });

    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('DeepSeek API Error:', responseData);
      return res.status(response.status).json({
        error: responseData.error?.message || 'Failed to get response from DeepSeek API'
      });
    }

    return res.status(200).json({ message: responseData.choices[0].message.content });
  } catch (error) {
    console.error('Chat API Error:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to process chat request'
    });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('DeepSeek API Key:', DEEPSEEK_API_KEY ? 'Configured' : 'Missing');
}); 