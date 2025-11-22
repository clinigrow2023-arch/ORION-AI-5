// Development server to simulate Netlify Functions locally
import express from 'express';
import cors from 'cors';
import 'dotenv/config';

// Import Netlify Functions
import { handler as authRegisterHandler } from '../netlify/functions/auth-register';
import { handler as authLoginHandler } from '../netlify/functions/auth-login';
import { handler as authVerifyHandler } from '../netlify/functions/auth-verify';
import { handler as conversationsHandler } from '../netlify/functions/conversations';
import { handler as adminUsersHandler } from '../netlify/functions/admin-users';
import { handler as geminiHandler } from '../netlify/functions/gemini';

const app = express();
const PORT = 8888;

app.use(cors());
app.use(express.json());

// Helper to convert Express request to Netlify Function event
const createNetlifyEvent = (req: express.Request): any => ({
  httpMethod: req.method,
  path: req.path,
  headers: req.headers as any,
  body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
  queryStringParameters: req.query as any,
});

// Helper to convert Netlify Function response to Express response
const sendNetlifyResponse = async (res: express.Response, handler: any, event: any) => {
  try {
    const result = await handler(event, {});
    
    // Set headers
    if (result.headers) {
      Object.keys(result.headers).forEach(key => {
        res.setHeader(key, result.headers[key]);
      });
    }
    
    // Send response
    res.status(result.statusCode || 200);
    
    if (result.body) {
      if (typeof result.body === 'string') {
        res.send(result.body);
      } else {
        res.json(result.body);
      }
    } else {
      res.end();
    }
  } catch (error: any) {
    console.error('Function error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// OPTIONS for CORS - handle all function routes (must be before other routes)
app.options('/.netlify/functions/:functionName', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.sendStatus(200);
});

// Routes
app.post('/.netlify/functions/auth-register', async (req, res) => {
  const event = createNetlifyEvent(req);
  await sendNetlifyResponse(res, authRegisterHandler, event);
});

app.post('/.netlify/functions/auth-login', async (req, res) => {
  const event = createNetlifyEvent(req);
  await sendNetlifyResponse(res, authLoginHandler, event);
});

app.get('/.netlify/functions/auth-verify', async (req, res) => {
  const event = createNetlifyEvent(req);
  await sendNetlifyResponse(res, authVerifyHandler, event);
});

app.get('/.netlify/functions/conversations', async (req, res) => {
  const event = createNetlifyEvent(req);
  await sendNetlifyResponse(res, conversationsHandler, event);
});

app.post('/.netlify/functions/conversations', async (req, res) => {
  const event = createNetlifyEvent(req);
  await sendNetlifyResponse(res, conversationsHandler, event);
});

app.get('/.netlify/functions/admin-users', async (req, res) => {
  const event = createNetlifyEvent(req);
  await sendNetlifyResponse(res, adminUsersHandler, event);
});

app.put('/.netlify/functions/admin-users', async (req, res) => {
  const event = createNetlifyEvent(req);
  await sendNetlifyResponse(res, adminUsersHandler, event);
});

app.post('/.netlify/functions/gemini', async (req, res) => {
  const event = createNetlifyEvent(req);
  await sendNetlifyResponse(res, geminiHandler, event);
});

app.listen(PORT, () => {
  console.log(`🚀 Development server running on http://localhost:${PORT}`);
  console.log(`📡 Netlify Functions available at http://localhost:${PORT}/.netlify/functions/`);
});

