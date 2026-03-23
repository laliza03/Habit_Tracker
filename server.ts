import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Fitbit OAuth Endpoints
  app.get('/api/auth/fitbit/url', (req, res) => {
    const clientId = process.env.FITBIT_CLIENT_ID;
    const redirectUri = `${process.env.APP_URL}/auth/fitbit/callback`;
    
    if (!clientId) {
      return res.status(500).json({ error: 'FITBIT_CLIENT_ID not configured' });
    }

    const scope = 'activity heartrate location nutrition profile settings sleep social weight';
    const authUrl = `https://www.fitbit.com/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&expires_in=604800`;
    
    res.json({ url: authUrl });
  });

  app.get('/auth/fitbit/callback', async (req, res) => {
    const { code } = req.query;
    const clientId = process.env.FITBIT_CLIENT_ID;
    const clientSecret = process.env.FITBIT_CLIENT_SECRET;
    const redirectUri = `${process.env.APP_URL}/auth/fitbit/callback`;

    if (!code || !clientId || !clientSecret) {
      return res.status(400).send('Missing code or configuration');
    }

    try {
      const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const response = await axios.post('https://api.fitbit.com/oauth2/token', 
        new URLSearchParams({
          code: code as string,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }),
        {
          headers: {
            Authorization: `Basic ${authHeader}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const { access_token, refresh_token, user_id } = response.data;

      // Send success message to parent window and close popup
      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'FITBIT_AUTH_SUCCESS', 
                  payload: ${JSON.stringify({ access_token, refresh_token, user_id })} 
                }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Authentication successful. This window should close automatically.</p>
          </body>
        </html>
      `);
    } catch (error: any) {
      console.error('Fitbit OAuth error:', error.response?.data || error.message);
      res.status(500).send('Authentication failed');
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
