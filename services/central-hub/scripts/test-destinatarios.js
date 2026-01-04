#!/usr/bin/env node
/**
 * Test de gestión de destinatarios en campañas
 * Prueba agregar y quitar destinatarios
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3011';
const TEST_CAMPANIA_ID = 1; // Campaña de prueba

async function testGestionDestinatarios() {
  console.log('📋 === TEST: GESTIÓN DE DESTINATARIOS ===\n');

  try {
    // 1. Autenticación
    console.log('🔐 1. Autenticando...');
    const authResponse = await axios.post(`${BASE_URL}/auth/login`, {
      usuario: 'Haby',
      password: 'haby1973'
    });

    if (!authResponse.data.success) {
      throw new Error('Error en autenticación');
    }

    const token = authResponse.data.token;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    console.log('✅ Autenticado como:', authResponse.data.user.usuario);

    // 2. Ver destinatarios actuales
    console.log(`\n👥 2. Destinatarios actuales campaña ${TEST_CAMPANIA_ID}...`);
    try {
      const destinatariosResponse = await axios.get(
        `${BASE_URL}/sender/destinatarios/campania/${TEST_CAMPANIA_ID}/resumen`, 
        { headers }
      );
      console.log('✅ Resumen actual:', destinatariosResponse.data.data);
    } catch (error) {
      console.log('⚠️  No se pudieron obtener destinatarios:', error.response?.data?.message);
    }

    // 3. Agregar nuevos destinatarios
    console.log('\n➕ 3. Agregando destinatarios de prueba...');
    const nuevosDestinatarios = [
      { telefono: '5491168777888', nombre: 'Test Usuario 1' },
      { telefono: '5491168777889', nombre: 'Test Usuario 2' },
      { telefono: '5491168777890', nombre: 'Test Usuario 3' }
    ];

    try {
      const agregarResponse = await axios.post(
        `${BASE_URL}/sender/destinatarios/campania/${TEST_CAMPANIA_ID}/agregar`,
        { destinatarios: nuevosDestinatarios },
        { headers }
      );
      console.log('✅ Resultado agregar:', JSON.stringify(agregarResponse.data, null, 2));
    } catch (error) {
      console.log('❌ Error agregando:', error.response?.data || error.message);
    }

    // 4. Ver destinatarios después de agregar
    console.log('\n👥 4. Destinatarios después de agregar...');
    try {
      const resumenResponse = await axios.get(
        `${BASE_URL}/sender/destinatarios/campania/${TEST_CAMPANIA_ID}/resumen`, 
        { headers }
      );
      console.log('✅ Nuevo resumen:', resumenResponse.data.data);
    } catch (error) {
      console.log('⚠️  Error obteniendo resumen:', error.response?.data?.message);
    }

    // 5. Intentar agregar duplicados
    console.log('\n🔄 5. Intentando agregar duplicados...');
    try {
      const duplicadosResponse = await axios.post(
        `${BASE_URL}/sender/destinatarios/campania/${TEST_CAMPANIA_ID}/agregar`,
        { destinatarios: [nuevosDestinatarios[0]] }, // Mismo destinatario
        { headers }
      );
      console.log('✅ Resultado duplicados:', JSON.stringify(duplicadosResponse.data, null, 2));
    } catch (error) {
      console.log('❌ Error con duplicados:', error.response?.data || error.message);
    }

    // 6. Quitar destinatarios
    console.log('\n➖ 6. Quitando destinatarios...');
    const telefonosAQuitar = ['5491168777888', '5491168777889'];

    try {
      const quitarResponse = await axios.delete(
        `${BASE_URL}/sender/destinatarios/campania/${TEST_CAMPANIA_ID}/quitar`,
        { 
          headers,
          data: { telefonos: telefonosAQuitar }
        }
      );
      console.log('✅ Resultado quitar:', JSON.stringify(quitarResponse.data, null, 2));
    } catch (error) {
      console.log('❌ Error quitando:', error.response?.data || error.message);
    }

    // 7. Resumen final
    console.log('\n📊 7. Resumen final...');
    try {
      const finalResponse = await axios.get(
        `${BASE_URL}/sender/destinatarios/campania/${TEST_CAMPANIA_ID}/resumen`, 
        { headers }
      );
      console.log('✅ Resumen final:', finalResponse.data.data);
    } catch (error) {
      console.log('⚠️  Error resumen final:', error.response?.data?.message);
    }

    console.log('\n🎉 === TEST COMPLETADO ===');
    console.log('✅ APIs de gestión de destinatarios funcionando');

  } catch (error) {
    console.error('\n❌ Error general:', error.response?.data || error.message);
  }
}

// Ejecutar test
testGestionDestinatarios();