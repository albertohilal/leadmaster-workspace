#!/usr/bin/env node
/**
 * VERIFICACIÓN COMPLETA DE SERVICIOS LEADMASTER CENTRAL HUB
 * Chequea el estado de todos los módulos y APIs
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3013';
let authToken = '';

// Configuración HTTP
const httpConfig = {
  timeout: 5000,
  headers: { 'Content-Type': 'application/json' }
};

// Función para autenticarse
async function authenticate() {
  try {
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      usuario: 'Haby',
      password: 'haby1973'
    }, httpConfig);
    
    if (response.data.success) {
      authToken = response.data.token;
      httpConfig.headers['Authorization'] = `Bearer ${authToken}`;
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ Error autenticación:', error.message);
    return false;
  }
}

// Función para verificar endpoint
async function checkEndpoint(name, method, url, data = null) {
  try {
    let response;
    const config = { ...httpConfig };
    
    switch (method.toUpperCase()) {
      case 'GET':
        response = await axios.get(url, config);
        break;
      case 'POST':
        response = await axios.post(url, data, config);
        break;
      case 'PUT':
        response = await axios.put(url, data, config);
        break;
      case 'DELETE':
        response = await axios.delete(url, config);
        break;
    }
    
    console.log(`✅ ${name}: OK (${response.status})`);
    return { status: 'OK', data: response.data, statusCode: response.status };
  } catch (error) {
    const status = error.response?.status || 'TIMEOUT';
    const message = error.response?.data?.message || error.message;
    console.log(`❌ ${name}: ${status} - ${message}`);
    return { status: 'ERROR', error: message, statusCode: status };
  }
}

async function verifyServices() {
  console.log('🔍 === VERIFICACIÓN COMPLETA DE SERVICIOS ===\n');
  console.log(`🌐 Base URL: ${BASE_URL}`);
  console.log(`📅 Fecha: ${new Date().toISOString()}\n`);

  const results = {
    core: {},
    auth: {},
    sessionManager: {},
    sender: {},
    listener: {},
    database: {}
  };

  // 1. SERVICIOS CORE
  console.log('🔧 === SERVICIOS CORE ===');
  results.core.health = await checkEndpoint('Health Check', 'GET', `${BASE_URL}/health`);
  results.core.info = await checkEndpoint('Info General', 'GET', `${BASE_URL}/`);

  // 2. AUTENTICACIÓN
  console.log('\n🔐 === MÓDULO AUTH ===');
  const authSuccess = await authenticate();
  if (authSuccess) {
    console.log('✅ Autenticación: OK');
    results.auth.login = { status: 'OK' };
    results.auth.verify = await checkEndpoint('Verify Token', 'POST', `${BASE_URL}/auth/verify`);
    results.auth.me = await checkEndpoint('User Info', 'GET', `${BASE_URL}/auth/me`);
  } else {
    console.log('❌ Autenticación: FAILED');
    results.auth.login = { status: 'ERROR', error: 'Login failed' };
  }

  if (authSuccess) {
    // 3. SESSION MANAGER
    console.log('\n📱 === MÓDULO SESSION-MANAGER ===');
    results.sessionManager.status = await checkEndpoint('SM Status', 'GET', `${BASE_URL}/session-manager/status`);
    results.sessionManager.state = await checkEndpoint('SM State', 'GET', `${BASE_URL}/session-manager/state`);

    // 4. SENDER
    console.log('\n📤 === MÓDULO SENDER ===');
    results.sender.status = await checkEndpoint('Sender Status', 'GET', `${BASE_URL}/sender/status`);
    results.sender.campaigns = await checkEndpoint('Sender Campaigns', 'GET', `${BASE_URL}/sender/campaigns`);

    // 5. LISTENER  
    console.log('\n👂 === MÓDULO LISTENER ===');
    results.listener.status = await checkEndpoint('Listener Status', 'GET', `${BASE_URL}/listener/status`);

    // 6. VERIFICACIONES ADICIONALES
    console.log('\n🔍 === VERIFICACIONES ADICIONALES ===');
    
    // Test de destinatarios
    try {
      results.database.destinatarios = await checkEndpoint(
        'Destinatarios Campaña', 
        'GET', 
        `${BASE_URL}/sender/destinatarios/campania/1/resumen`
      );
    } catch (error) {
      results.database.destinatarios = { status: 'ERROR', error: error.message };
    }

    // Test de intervención humana
    try {
      results.listener.humanIntervention = await checkEndpoint(
        'Human Intervention', 
        'POST', 
        `${BASE_URL}/listener/human-intervention`,
        { telefono: '5491168777888', mensaje: 'Test verificación', cliente_id: 51 }
      );
    } catch (error) {
      results.listener.humanIntervention = { status: 'ERROR', error: error.message };
    }
  }

  // 7. RESUMEN FINAL
  console.log('\n📊 === RESUMEN DE VERIFICACIÓN ===');
  
  const moduleStatus = {
    'Core Services': results.core.health?.status === 'OK' ? '✅' : '❌',
    'Auth Module': results.auth.login?.status === 'OK' ? '✅' : '❌', 
    'Session Manager': results.sessionManager.status?.status === 'OK' ? '✅' : '❌',
    'Sender Module': results.sender.status?.status === 'OK' ? '✅' : '❌',
    'Listener Module': results.listener.status?.status === 'OK' ? '✅' : '❌'
  };

  Object.entries(moduleStatus).forEach(([module, status]) => {
    console.log(`${status} ${module}`);
  });

  // 8. DETALLES IMPORTANTES
  console.log('\n📋 === DETALLES IMPORTANTES ===');
  
  if (results.sessionManager.state?.data) {
    const whatsappState = results.sessionManager.state.data;
    console.log(`📱 WhatsApp: ${whatsappState.state} (Ready: ${whatsappState.ready ? 'Sí' : 'No'})`);
  }

  if (results.auth.me?.data) {
    const user = results.auth.me.data.user;
    console.log(`👤 Usuario activo: ${user.usuario} (Cliente: ${user.cliente_id})`);
  }

  // 9. RECOMENDACIONES
  console.log('\n💡 === RECOMENDACIONES ===');
  
  let allOk = true;
  let recommendations = [];

  Object.values(moduleStatus).forEach(status => {
    if (status === '❌') allOk = false;
  });

  if (allOk) {
    console.log('🎉 Todos los servicios están funcionando correctamente');
    console.log('🚀 Sistema listo para producción');
  } else {
    console.log('⚠️  Algunos servicios necesitan atención');
    if (results.sessionManager.state?.data?.state !== 'conectado') {
      recommendations.push('📱 Verificar conexión WhatsApp');
    }
    if (results.auth.login?.status !== 'OK') {
      recommendations.push('🔐 Verificar credenciales de autenticación');
    }
    recommendations.forEach(rec => console.log(`   ${rec}`));
  }

  console.log('\n🔄 Verificación completada a las:', new Date().toLocaleString());
  
  return results;
}

// Ejecutar verificación
if (require.main === module) {
  verifyServices().catch(console.error);
}

module.exports = verifyServices;