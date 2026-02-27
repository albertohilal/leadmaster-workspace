const express = require('express');
const axios = require('axios');

const router = express.Router();

const sessionManagerHttp = axios.create({
  baseURL: 'http://localhost:3001',
  timeout: 10000
});

function normalizeStatus(value) {
  if (typeof value !== 'string') return 'error';
  return value.toLowerCase();
}

// GET /status
router.get('/status', async (_req, res) => {
  try {
    const upstream = await sessionManagerHttp.get('/status');
    return res.json({
      status: normalizeStatus(upstream?.data?.status)
    });
  } catch {
    return res.json({ status: 'error' });
  }
});

// GET /qr
router.get('/qr', async (_req, res) => {
  try {
    const upstream = await sessionManagerHttp.get('/qr');

    const qr =
      upstream?.data?.qr ||
      upstream?.data?.qr_code_base64;

    if (typeof qr === 'string' && qr.length > 0) {
      return res.json({
        status: 'qr_available',
        qr
      });
    }

    return res.json({ status: 'qr_not_available' });
  } catch {
    return res.json({ status: 'error' });
  }
});

// POST /connect
router.post('/connect', async (_req, res) => {
  try {
    const upstream = await sessionManagerHttp.post('/connect', {});

    const rawStatus =
      upstream?.data?.state ??
      upstream?.data?.status;

    return res.json({
      status: normalizeStatus(rawStatus)
    });
  } catch {
    return res.json({ status: 'error' });
  }
});

module.exports = router;