// speech-token.js — Azure Speech token endpoint (Node.js + Express)
//
// 1) npm install express dotenv
// 2) .env file (never commit it, never send the key to the browser):
//      AZURE_SPEECH_KEY=paste KEY 1 from Azure "Keys and Endpoint"
//      AZURE_SPEECH_REGION=eastus
// 3) In your existing Express app:
//      const speechToken = require('./speech-token');
//      app.use('/api', yourAuthMiddleware, speechToken);   // only logged-in doctors/patients
//
// The browser calls GET /api/speech-token and gets { token, region }.
// The token is valid for 10 minutes; the call page refreshes it every 9 minutes.

require('dotenv').config();
const express = require('express');
const router = express.Router();

const KEY = process.env.AZURE_SPEECH_KEY;
const REGION = process.env.AZURE_SPEECH_REGION || 'eastus';

router.get('/speech-token', async (req, res) => {
  if (!KEY) return res.status(500).json({ error: 'AZURE_SPEECH_KEY is not set' });

  // Optional: allow tokens only for users who are in an active consultation
  // if (!req.user || !(await isInActiveCall(req.user.id))) return res.status(403).end();

  try {
    const r = await fetch(`https://${REGION}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
      method: 'POST',
      headers: { 'Ocp-Apim-Subscription-Key': KEY, 'Content-Length': '0' }
    });
    if (!r.ok) return res.status(502).json({ error: 'Azure token request failed', status: r.status });

    const token = await r.text();
    res.set('Cache-Control', 'no-store');
    res.json({ token, region: REGION });
  } catch (err) {
    console.error('speech-token error', err);
    res.status(500).json({ error: 'Could not get speech token' });
  }
});

module.exports = router;
