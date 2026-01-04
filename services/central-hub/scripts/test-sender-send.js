/**
 * Manual smoke test for sender → central-hub → session-manager flow
 * This script is NOT used in production
 * 
 * Script de prueba manual para POST /sender/send
 * Requiere Central Hub corriendo y Session Manager según el caso.
 *
 * Uso:
 *   export AUTH_TOKEN=your_jwt_token
 *   node test-sender-send.js
 */

const fetch = global.fetch || require('node-fetch'); // Node 18+ ya tiene fetch

const CENTRAL_HUB_BASE_URL = process.env.CENTRAL_HUB_BASE_URL || 'http://localhost:3012';
const ENDPOINT = '/sender/send';

// ⚠️ Requiere AUTH_TOKEN en .env o variable de entorno
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'dummy-token-for-testing';

// Payload de prueba - usa valores dummy
const payload = {
  to: process.env.TEST_PHONE || '5491100000000',
  message: 'Test message from Central Hub smoke test'
};

async function run() {
  console.log('➡️ Enviando POST /sender/send');

  try {
    const res = await fetch(`${CENTRAL_HUB_BASE_URL}${ENDPOINT}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`
      },
      body: JSON.stringify(payload)
    });

    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }

    console.log('⬅️ Status:', res.status);
    console.log('⬅️ Body:', body);

  } catch (err) {
    console.error('❌ Error de red:', err.message);
  }
}

run();
