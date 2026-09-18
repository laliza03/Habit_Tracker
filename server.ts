import crypto from 'node:crypto';
import express, { NextFunction, Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'node:path';
import dotenv from 'dotenv';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

dotenv.config();
const PORT = Number(process.env.PORT || 3000);
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;
type AuthedRequest = Request & { userId?: string };

function admin() {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccount) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is required for connected activity sources.');
  if (!getApps().length) initializeApp({ credential: cert(JSON.parse(serviceAccount)) });
  return { auth: getAuth(), db: getFirestore() };
}

function tokenKey() {
  const value = process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY;
  const key = value ? Buffer.from(value, 'base64') : Buffer.alloc(0);
  if (key.length !== 32) throw new Error('INTEGRATION_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
  return key;
}

function encrypt(value: unknown) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', tokenKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: encrypted.toString('base64') };
}

function decrypt<T>(stored: { iv: string; tag: string; ciphertext: string }) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', tokenKey(), Buffer.from(stored.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(stored.tag, 'base64'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(stored.ciphertext, 'base64')), decipher.final()]).toString()) as T;
}

function makeState(userId: string) {
  const state = `${userId}.${Date.now()}.${crypto.randomBytes(18).toString('base64url')}`;
  const secret = process.env.FITBIT_STATE_SECRET || process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY;
  if (!secret) throw new Error('FITBIT_STATE_SECRET is required.');
  return `${state}.${crypto.createHmac('sha256', secret).update(state).digest('base64url')}`;
}

function validState(state: string) {
  const parts = state.split('.');
  if (parts.length !== 4) return null;
  const [userId, createdAt, nonce, signature] = parts;
  const unsigned = `${userId}.${createdAt}.${nonce}`;
  const secret = process.env.FITBIT_STATE_SECRET || process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY;
  if (!secret || Date.now() - Number(createdAt) > 600_000) return null;
  const expected = crypto.createHmac('sha256', secret).update(unsigned).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  return { userId, state };
}

async function requireUser(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const token = req.header('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'Sign in to connect an activity source.' });
    req.userId = (await admin().auth.verifyIdToken(token)).uid;
    next();
  } catch { res.status(401).json({ error: 'Your sign-in session could not be verified.' }); }
}

async function currentFitbitToken(userId: string) {
  const stored = (await admin().db.doc(`private_integrations/${userId}`).get()).data()?.fitbit;
  if (!stored) throw new Error('Fitbit is not connected.');
  const token = decrypt<{ access_token: string; refresh_token: string; expires_at: number }>(stored);
  if (token.expires_at > Date.now() + 60_000) return token.access_token;
  const response = await fetch('https://api.fitbit.com/oauth2/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${process.env.FITBIT_CLIENT_ID}:${process.env.FITBIT_CLIENT_SECRET}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: token.refresh_token }),
  });
  if (!response.ok) throw new Error('Fitbit token refresh failed. Please reconnect Fitbit.');
  const refreshed = await response.json() as { access_token: string; refresh_token: string; expires_in: number };
  await admin().db.doc(`private_integrations/${userId}`).set({ fitbit: encrypt({ ...refreshed, expires_at: Date.now() + refreshed.expires_in * 1000 }) }, { merge: true });
  return refreshed.access_token;
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/activity-sources', requireUser, async (req: AuthedRequest, res) => {
    try {
      const connected = Boolean((await admin().db.doc(`private_integrations/${req.userId}`).get()).data()?.fitbit);
      res.json({ sources: [
        { id: 'manual', label: 'Manual logging', status: 'available' },
        { id: 'fitbit', label: 'Fitbit', status: connected ? 'connected' : 'available' },
        { id: 'apple-health', label: 'Apple Health', status: 'native-app-required' },
        { id: 'health-connect', label: 'Health Connect', status: 'native-app-required' },
      ] });
    } catch (error) { res.status(503).json({ error: error instanceof Error ? error.message : 'Sources unavailable.' }); }
  });

  app.post('/api/activity-sources/fitbit/start', requireUser, async (req: AuthedRequest, res) => {
    try {
      if (!process.env.FITBIT_CLIENT_ID || !process.env.FITBIT_CLIENT_SECRET) return res.status(503).json({ error: 'Fitbit is not configured yet.' });
      const state = makeState(req.userId!);
      await admin().db.doc(`integration_states/${crypto.createHash('sha256').update(state).digest('hex')}`).set({ userId: req.userId, expiresAt: Date.now() + 600_000 });
      const redirectUri = process.env.FITBIT_REDIRECT_URI || `${APP_URL}/api/activity-sources/fitbit/callback`;
      const url = new URL('https://www.fitbit.com/oauth2/authorize');
      url.search = new URLSearchParams({ response_type: 'code', client_id: process.env.FITBIT_CLIENT_ID, redirect_uri: redirectUri, scope: 'activity nutrition profile', state }).toString();
      res.json({ url: url.toString() });
    } catch (error) { res.status(503).json({ error: error instanceof Error ? error.message : 'Fitbit unavailable.' }); }
  });

  app.get('/api/activity-sources/fitbit/callback', async (req, res) => {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? validState(req.query.state) : null;
    if (!code || !state) return res.status(400).send('The Fitbit connection link is invalid or expired.');
    try {
      const stateRef = admin().db.doc(`integration_states/${crypto.createHash('sha256').update(state.state).digest('hex')}`);
      const stateDoc = await stateRef.get();
      if (!stateDoc.exists || stateDoc.data()?.userId !== state.userId || stateDoc.data()?.expiresAt < Date.now()) return res.status(400).send('The Fitbit connection link is invalid or expired.');
      await stateRef.delete();
      const redirectUri = process.env.FITBIT_REDIRECT_URI || `${APP_URL}/api/activity-sources/fitbit/callback`;
      const response = await fetch('https://api.fitbit.com/oauth2/token', {
        method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${process.env.FITBIT_CLIENT_ID}:${process.env.FITBIT_CLIENT_SECRET}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code, grant_type: 'authorization_code', redirect_uri: redirectUri }),
      });
      if (!response.ok) throw new Error('Fitbit did not accept the authorization code.');
      const token = await response.json() as { access_token: string; refresh_token: string; expires_in: number; user_id: string };
      await admin().db.doc(`private_integrations/${state.userId}`).set({ fitbit: encrypt({ ...token, expires_at: Date.now() + token.expires_in * 1000 }), fitbitUserId: token.user_id, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      res.redirect(`${APP_URL}/?source=fitbit&status=connected`);
    } catch (error) { res.status(500).send(error instanceof Error ? error.message : 'Fitbit could not be connected.'); }
  });

  app.post('/api/activity-sources/fitbit/sync', requireUser, async (req: AuthedRequest, res) => {
    try {
      const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body?.date)) ? req.body.date : new Date().toISOString().slice(0, 10);
      const headers = { Authorization: `Bearer ${await currentFitbitToken(req.userId!)}` };
      const [activityResult, waterResult] = await Promise.all([fetch(`https://api.fitbit.com/1/user/-/activities/date/${date}.json`, { headers }), fetch(`https://api.fitbit.com/1/user/-/foods/log/water/date/${date}.json`, { headers })]);
      if (!activityResult.ok || !waterResult.ok) throw new Error('Fitbit data could not be fetched.');
      const activity = await activityResult.json() as { summary?: { steps?: number; caloriesOut?: number } };
      const water = await waterResult.json() as { summary?: { water?: number } };
      const metrics = { steps: activity.summary?.steps || 0, water: Math.round(water.summary?.water || 0), calories: activity.summary?.caloriesOut || 0 };
      await admin().db.doc(`logs/${req.userId}_${date}`).set({ uid: req.userId, date, ...metrics, source: 'fitbit', syncedAt: FieldValue.serverTimestamp() }, { merge: true });
      res.json({ date, metrics });
    } catch (error) { res.status(502).json({ error: error instanceof Error ? error.message : 'Fitbit sync failed.' }); }
  });

  if (process.env.NODE_ENV !== 'production') app.use((await createViteServer({ server: { middlewareMode: true }, appType: 'spa' })).middlewares);
  else { const dist = path.join(process.cwd(), 'dist'); app.use(express.static(dist)); app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html'))); }
  app.listen(PORT, '0.0.0.0', () => console.log(`Server running on http://localhost:${PORT}`));
}
startServer();
