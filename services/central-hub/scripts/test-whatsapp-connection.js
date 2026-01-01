#!/usr/bin/env node
/**
 * Test de conexión WhatsApp completo
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3012';

async function testWhatsAppConnection() {
  console.log('🧪 Test de conexión WhatsApp\n');
  
  try {
    // 1. Login
    console.log('1️⃣  Autenticando...');
    const login = await axios.post(`${BASE_URL}/auth/login`, {
      usuario: 'Haby',
      password: 'haby1973'
    });
    
    const token = login.data.token;
    const headers = { Authorization: `Bearer ${token}` };
    console.log('✅ Autenticado correctamente\n');

    // 2. Verificar estado inicial
    console.log('2️⃣  Verificando estado inicial...');
    const initialState = await axios.get(`${BASE_URL}/session-manager/state`, { headers });
    console.log('   Estado:', initialState.data);
    console.log('');

    // 3. Iniciar conexión WhatsApp
    console.log('3️⃣  Iniciando conexión WhatsApp...');
    const loginWA = await axios.post(`${BASE_URL}/session-manager/login`, {}, { headers });
    console.log('   Respuesta:', loginWA.data);
    console.log('');

    // 4. Esperar y verificar estado (cada 3 segundos)
    console.log('4️⃣  Esperando QR o conexión...');
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const state = await axios.get(`${BASE_URL}/session-manager/state`, { headers });
      console.log(`   [${i+1}/10] Estado:`, state.data);
      
      if (state.data.hasQR) {
        console.log('\n📱 QR DISPONIBLE - Intenta obtenerlo en:');
        console.log(`   GET ${BASE_URL}/session-manager/qr`);
        console.log('   (con el token de autorización)\n');
      }
      
      if (state.data.ready) {
        console.log('\n✅ WHATSAPP CONECTADO');
        break;
      }
    }

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
  }
}

testWhatsAppConnection();
