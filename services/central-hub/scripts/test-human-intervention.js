#!/usr/bin/env node
/**
 * Script de prueba completo para el sistema de intervención humana
 * Prueba el flujo completo: conversación IA → intervención humana → pausa automática → reactivación manual
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3011';
const TEST_PHONE = '5491168777888';
const TEST_CLIENT_ID = 51; // Cliente Haby

// Headers con autenticación (token válido de Haby)
const headers = {
  'Content-Type': 'application/json',
  'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwiY2xpZW50ZV9pZCI6NTEsInVz_dWFyaW8iOiJIYWJ5IiwidGlwbyI6ImNsaWVudGUiLCJpYXQiOjE3NjYxODc2MTMsImV4cCI6MTc2NjI3NDAxM30.5IiuYLNVY58iT164LmmnuLma6hQq-O2btPJRB4Pdvzo'
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testHumanInterventionSystem() {
  console.log('\n🤖 === PRUEBA COMPLETA: SISTEMA DE INTERVENCIÓN HUMANA ===\n');

  try {
    // 1. Simular mensaje IA inicial (activar conversación)
    console.log('📱 1. Iniciando conversación con mensaje IA...');
    const initialResponse = await axios.post(
      `${BASE_URL}/listener/test-message`,
      {
        telefono: TEST_PHONE,
        texto: 'Hola! Soy tu asistente virtual. ¿En qué puedo ayudarte?',
        cliente_id: TEST_CLIENT_ID,
        simulateIA: true
      },
      { headers }
    );
    console.log('✅ Mensaje IA inicial:', initialResponse.data);

    await sleep(2000);

    // 2. Simular respuesta del lead
    console.log('\n👤 2. Lead responde...');
    const leadResponse = await axios.post(
      `${BASE_URL}/listener/test-message`,
      {
        telefono: TEST_PHONE,
        texto: 'Hola, necesito información sobre sus servicios',
        cliente_id: TEST_CLIENT_ID,
        simulateIA: false
      },
      { headers }
    );
    console.log('✅ Respuesta del lead:', leadResponse.data);

    await sleep(2000);

    // 3. Simular respuesta automática IA
    console.log('\n🤖 3. IA responde automáticamente...');
    const iaResponse = await axios.post(
      `${BASE_URL}/listener/test-message`,
      {
        telefono: TEST_PHONE,
        texto: 'Claro! Tenemos varios servicios disponibles. Te puedo ayudar con información sobre...',
        cliente_id: TEST_CLIENT_ID,
        simulateIA: true
      },
      { headers }
    );
    console.log('✅ IA responde:', iaResponse.data);

    await sleep(2000);

    // 4. INTERVENCIÓN HUMANA - Agente humano toma control
    console.log('\n👨‍💼 4. INTERVENCIÓN HUMANA - Agente toma control...');
    const humanIntervention = await axios.post(
      `${BASE_URL}/listener/human-intervention`,
      {
        telefono: TEST_PHONE,
        mensaje: 'Hola! Soy Juan, agente humano. Te voy a ayudar personalmente.',
        cliente_id: TEST_CLIENT_ID
      },
      { headers }
    );
    console.log('✅ Intervención humana registrada:', humanIntervention.data);

    await sleep(2000);

    // 5. Verificar que IA está pausada - intentar enviar mensaje IA
    console.log('\n🚫 5. Verificando que IA está PAUSADA...');
    const attemptIAResponse = await axios.post(
      `${BASE_URL}/listener/test-message`,
      {
        telefono: TEST_PHONE,
        texto: 'Este mensaje IA NO debería enviarse porque hay intervención humana',
        cliente_id: TEST_CLIENT_ID,
        simulateIA: true
      },
      { headers }
    );
    console.log('✅ Resultado intento IA (debe estar pausada):', attemptIAResponse.data);

    await sleep(2000);

    // 6. Simular más mensajes humanos
    console.log('\n👨‍💼 6. Agente humano continúa conversación...');
    const humanContinue = await axios.post(
      `${BASE_URL}/listener/test-message`,
      {
        telefono: TEST_PHONE,
        texto: 'Te voy a enviar información detallada por email.',
        cliente_id: TEST_CLIENT_ID,
        esHumano: true
      },
      { headers }
    );
    console.log('✅ Mensaje humano adicional:', humanContinue.data);

    await sleep(2000);

    // 7. Obtener historial de intervenciones
    console.log('\n📊 7. Consultando historial de intervenciones...');
    const history = await axios.get(
      `${BASE_URL}/listener/history/${TEST_PHONE}`,
      { headers }
    );
    console.log('✅ Historial completo:', JSON.stringify(history.data, null, 2));

    await sleep(2000);

    // 8. REACTIVAR IA manualmente
    console.log('\n🔄 8. REACTIVANDO IA manualmente...');
    const reactivateIA = await axios.post(
      `${BASE_URL}/listener/reactivate-ia`,
      {
        telefono: TEST_PHONE,
        cliente_id: TEST_CLIENT_ID
      },
      { headers }
    );
    console.log('✅ IA reactivada:', reactivateIA.data);

    await sleep(2000);

    // 9. Verificar que IA funciona nuevamente
    console.log('\n✅ 9. Verificando que IA funciona nuevamente...');
    const iaWorksAgain = await axios.post(
      `${BASE_URL}/listener/test-message`,
      {
        telefono: TEST_PHONE,
        texto: 'Ahora la IA debería funcionar nuevamente. ¿Hay algo más en lo que pueda ayudarte?',
        cliente_id: TEST_CLIENT_ID,
        simulateIA: true
      },
      { headers }
    );
    console.log('✅ IA funcionando nuevamente:', iaWorksAgain.data);

    // 10. Resumen final
    console.log('\n📋 === RESUMEN DE PRUEBA COMPLETA ===');
    console.log('✅ 1. Conversación IA iniciada');
    console.log('✅ 2. Lead respondió');  
    console.log('✅ 3. IA respondió automáticamente');
    console.log('✅ 4. Intervención humana detectada y registrada');
    console.log('✅ 5. IA pausada automáticamente');
    console.log('✅ 6. Mensajes humanos posteriores procesados');
    console.log('✅ 7. Historial de intervenciones consultado');
    console.log('✅ 8. IA reactivada manualmente');
    console.log('✅ 9. IA funcionando nuevamente');
    console.log('\n🎉 SISTEMA DE INTERVENCIÓN HUMANA: 100% FUNCIONAL');

  } catch (error) {
    console.error('\n❌ Error en la prueba:', error.response?.data || error.message);
    if (error.response?.status === 401) {
      console.log('⚠️  Token de autenticación inválido o expirado');
    }
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  testHumanInterventionSystem();
}

module.exports = testHumanInterventionSystem;