#!/usr/bin/env node
/**
 * Test directo del session-manager sin autenticación
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3012';

async function testSessionManager() {
  console.log('🧪 Test directo del session-manager\n');
  
  try {
    // 1. Test de health check
    console.log('1️⃣  Probando health check...');
    const health = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health:', health.data);
    console.log('');

    // 2. Test de login (auth)
    console.log('2️⃣  Probando login con credenciales de Haby...');
    const login = await axios.post(`${BASE_URL}/auth/login`, {
      usuario: 'Haby',
      password: 'haby1973'
    });
    
    if (!login.data.token) {
      console.error('❌ No se recibió token JWT');
      console.log('Respuesta:', login.data);
      return;
    }
    
    const token = login.data.token;
    const clienteId = login.data.cliente_id;
    console.log('✅ Login exitoso');
    console.log('   Cliente ID:', clienteId);
    console.log('   Token:', token.substring(0, 50) + '...');
    console.log('');

    // 3. Test de status del session-manager
    console.log('3️⃣  Probando status del session-manager...');
    const status = await axios.get(`${BASE_URL}/session-manager/status`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ Status:', status.data);
    console.log('');

    // 4. Test de state del session-manager
    console.log('4️⃣  Probando state del session-manager...');
    const state = await axios.get(`${BASE_URL}/session-manager/state`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ State:', state.data);
    console.log('');

    console.log('✅ TODOS LOS TESTS PASARON');

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
  }
}

testSessionManager();
