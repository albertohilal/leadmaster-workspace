#!/usr/bin/env node
/**
 * Test manual paso a paso del sistema de intervención humana
 */

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const BASE_URL = 'http://localhost:3011';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwiY2xpZW50ZV9pZCI6NTEsInVzdWFyaW8iOiJIYWJ5IiwidGlwbyI6ImNsaWVudGUiLCJpYXQiOjE3NjYxODc2MTMsImV4cCI6MTc2NjI3NDAxM30.5IiuYLNVY58iT164LmmnuLma6hQq-O2btPJRB4Pdvzo';

async function testStep(step, description, curlCommand) {
  console.log(`\n${step}. ${description}`);
  try {
    const { stdout } = await execPromise(curlCommand);
    console.log('✅ Respuesta:', stdout);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function runTest() {
  console.log('🤖 === TEST PASO A PASO: INTERVENCIÓN HUMANA ===');

  // 1. Mensaje inicial IA
  await testStep(
    '1',
    'Mensaje inicial de IA',
    `curl -X POST ${BASE_URL}/listener/test-message \\
      -H "Content-Type: application/json" \\
      -H "Authorization: Bearer ${TOKEN}" \\
      -d '{"telefono":"5491168777888","texto":"Hola! Soy tu asistente virtual","cliente_id":51,"simulateIA":true}'`
  );

  // 2. Respuesta del lead
  await testStep(
    '2',
    'Lead responde',
    `curl -X POST ${BASE_URL}/listener/test-message \\
      -H "Content-Type: application/json" \\
      -H "Authorization: Bearer ${TOKEN}" \\
      -d '{"telefono":"5491168777888","texto":"Hola, necesito información","cliente_id":51}'`
  );

  // 3. Intervención humana
  await testStep(
    '3', 
    'Intervención humana',
    `curl -X POST ${BASE_URL}/listener/human-intervention \\
      -H "Content-Type: application/json" \\
      -H "Authorization: Bearer ${TOKEN}" \\
      -d '{"telefono":"5491168777888","mensaje":"Hola! Soy Juan, agente humano","cliente_id":51}'`
  );

  // 4. Intentar respuesta IA (debe fallar)
  await testStep(
    '4',
    'Intento de respuesta IA (debe estar pausada)',
    `curl -X POST ${BASE_URL}/listener/test-message \\
      -H "Content-Type: application/json" \\
      -H "Authorization: Bearer ${TOKEN}" \\
      -d '{"telefono":"5491168777888","texto":"Este mensaje IA NO debería enviarse","cliente_id":51,"simulateIA":true}'`
  );

  // 5. Reactivar IA
  await testStep(
    '5',
    'Reactivar IA',
    `curl -X POST ${BASE_URL}/listener/reactivate-ia \\
      -H "Content-Type: application/json" \\
      -H "Authorization: Bearer ${TOKEN}" \\
      -d '{"telefono":"5491168777888","cliente_id":51}'`
  );

  // 6. IA funciona nuevamente
  await testStep(
    '6',
    'IA funciona nuevamente',
    `curl -X POST ${BASE_URL}/listener/test-message \\
      -H "Content-Type: application/json" \\
      -H "Authorization: Bearer ${TOKEN}" \\
      -d '{"telefono":"5491168777888","texto":"Ahora la IA debería funcionar","cliente_id":51,"simulateIA":true}'`
  );

  console.log('\n🎉 Test completado!');
}

runTest().catch(console.error);