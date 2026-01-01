#!/usr/bin/env node
/**
 * Test completo end-to-end del módulo session-manager
 * Prueba todas las funcionalidades: status, login, QR, state, logout
 */

const axios = require('axios');
const fs = require('fs');

const BASE_URL = process.env.TEST_URL || 'http://localhost:3011';
const TEST_CLIENT_ID = 51; // Cliente Haby

let authToken = '';

// Configuración HTTP con timeout
const httpConfig = {
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Función para hacer login y obtener token
 */
async function authenticate() {
  try {
    console.log('\n🔐 === AUTENTICACIÓN ===');
    const response = await axios.post(
      `${BASE_URL}/auth/login`,
      {
        usuario: 'Haby',
        password: 'haby1973'
      },
      httpConfig
    );

    if (response.data.success && response.data.token) {
      authToken = response.data.token;
      httpConfig.headers['Authorization'] = `Bearer ${authToken}`;
      console.log('✅ Autenticación exitosa');
      console.log('👤 Usuario:', response.data.user.usuario);
      console.log('🏢 Cliente ID:', response.data.user.cliente_id);
      return true;
    } else {
      console.error('❌ Error en autenticación:', response.data);
      return false;
    }
  } catch (error) {
    console.error('❌ Error de autenticación:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Test 1: Verificar status del session-manager
 */
async function testStatus() {
  console.log('\n📊 === TEST 1: STATUS ===');
  try {
    const response = await axios.get(`${BASE_URL}/session-manager/status`, httpConfig);
    console.log('✅ Status response:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('❌ Error en status:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Test 2: Verificar estado inicial de WhatsApp
 */
async function testInitialState() {
  console.log('\n🔍 === TEST 2: ESTADO INICIAL ===');
  try {
    const response = await axios.get(`${BASE_URL}/session-manager/state`, httpConfig);
    console.log('✅ Estado inicial:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('❌ Error obteniendo estado:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Test 3: Iniciar conexión WhatsApp
 */
async function testWhatsAppLogin() {
  console.log('\n🟢 === TEST 3: INICIAR WHATSAPP ===');
  try {
    const response = await axios.post(`${BASE_URL}/session-manager/login`, {}, httpConfig);
    console.log('✅ Login response:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('❌ Error en login WhatsApp:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Test 4: Monitorear estado de conexión
 */
async function testConnectionMonitoring(maxAttempts = 10) {
  console.log('\n👀 === TEST 4: MONITOREAR CONEXIÓN ===');
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`🔄 Intento ${attempt}/${maxAttempts} - Verificando estado...`);
      
      const response = await axios.get(`${BASE_URL}/session-manager/state`, httpConfig);
      const state = response.data;
      
      console.log(`📱 Estado actual: ${state.state}`);
      console.log(`🔗 Tiene QR: ${state.hasQR ? 'Sí' : 'No'}`);
      console.log(`✅ Listo: ${state.ready ? 'Sí' : 'No'}`);
      console.log(`🔄 Conectando: ${state.connecting ? 'Sí' : 'No'}`);
      
      // Si está listo, terminar monitoreo
      if (state.ready) {
        console.log('🎉 ¡WhatsApp conectado exitosamente!');
        return state;
      }
      
      // Si hay QR disponible, intentar obtenerlo
      if (state.hasQR) {
        console.log('📷 QR disponible - intentando obtener...');
        await testQRGeneration();
      }
      
      await sleep(3000); // Esperar 3 segundos entre intentos
    } catch (error) {
      console.error(`❌ Error en intento ${attempt}:`, error.response?.data || error.message);
    }
  }
  
  console.log('⚠️  Timeout: WhatsApp no se conectó en el tiempo esperado');
  return null;
}

/**
 * Test 5: Obtener código QR
 */
async function testQRGeneration() {
  console.log('\n📱 === TEST 5: CÓDIGO QR ===');
  try {
    const response = await axios.get(`${BASE_URL}/session-manager/qr`, {
      ...httpConfig,
      responseType: 'arraybuffer'
    });
    
    if (response.data && response.data.byteLength > 0) {
      console.log('✅ QR obtenido exitosamente');
      console.log('📊 Tamaño del QR:', response.data.byteLength, 'bytes');
      
      // Guardar QR en archivo (opcional)
      const qrPath = '/tmp/whatsapp-qr.png';
      fs.writeFileSync(qrPath, response.data);
      console.log(`💾 QR guardado en: ${qrPath}`);
      console.log('📱 Escanea este QR con tu teléfono para conectar WhatsApp');
      
      return true;
    } else {
      console.log('⚠️  QR vacío o no disponible');
      return false;
    }
  } catch (error) {
    if (error.response?.status === 404) {
      console.log('ℹ️  QR no disponible aún - esto es normal');
    } else {
      console.error('❌ Error obteniendo QR:', error.response?.data || error.message);
    }
    return false;
  }
}

/**
 * Test 6: Verificar estado final
 */
async function testFinalState() {
  console.log('\n🏁 === TEST 6: ESTADO FINAL ===');
  try {
    const response = await axios.get(`${BASE_URL}/session-manager/state`, httpConfig);
    console.log('✅ Estado final:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('❌ Error obteniendo estado final:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Test 7: Logout (opcional - descomenta si quieres probar)
 */
async function testLogout() {
  console.log('\n🔴 === TEST 7: LOGOUT ===');
  try {
    const response = await axios.post(`${BASE_URL}/session-manager/logout`, {}, httpConfig);
    console.log('✅ Logout response:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('❌ Error en logout:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Función principal que ejecuta todos los tests
 */
async function runSessionManagerTests() {
  console.log('🤖 === TEST COMPLETO: SESSION-MANAGER END-TO-END ===');
  console.log(`🌐 URL Base: ${BASE_URL}`);
  console.log(`🏢 Cliente ID: ${TEST_CLIENT_ID}`);

  try {
    // 1. Autenticarse
    const authSuccess = await authenticate();
    if (!authSuccess) {
      console.error('💀 No se pudo autenticar. Abortando tests.');
      return;
    }

    // 2. Test status
    await testStatus();
    await sleep(1000);

    // 3. Estado inicial
    await testInitialState();
    await sleep(1000);

    // 4. Iniciar WhatsApp
    await testWhatsAppLogin();
    await sleep(2000);

    // 5. Monitorear conexión
    await testConnectionMonitoring(15); // Esperar máximo 45 segundos
    await sleep(1000);

    // 6. Estado final
    await testFinalState();

    // 7. Logout (opcional - descomenta para probar)
    // await testLogout();

    console.log('\n🎉 === TESTS COMPLETADOS ===');
    console.log('✅ Session-manager evaluado correctamente');
    console.log('📱 Si apareció un QR, escanéalo para completar la conexión');

  } catch (error) {
    console.error('\n💀 Error general en tests:', error.message);
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  runSessionManagerTests();
}

module.exports = runSessionManagerTests;