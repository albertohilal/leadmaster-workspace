#!/usr/bin/env node
/**
 * Script para probar el login y obtención de campañas
 * Uso: node test-login-api.js
 */

const axios = require('axios');

const API_URL = 'http://localhost:3012';

async function testLogin() {
  console.log('🔐 Probando sistema de autenticación y campañas\n');
  
  try {
    // 1. Login con usuario Haby
    console.log('1️⃣ Intentando login con usuario "Haby"...');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      usuario: 'Haby',
      password: 'haby1973'
    });
    
    if (loginResponse.data.success) {
      console.log('✅ Login exitoso');
      console.log('   Token recibido:', loginResponse.data.token.substring(0, 20) + '...');
      console.log('   Usuario:', loginResponse.data.user.usuario);
      console.log('   Cliente ID:', loginResponse.data.user.cliente_id);
      
      const token = loginResponse.data.token;
      
      // 2. Obtener campañas con el token
      console.log('\n2️⃣ Obteniendo campañas con el token...');
      const campanasResponse = await axios.get(`${API_URL}/sender/campaigns`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const campanas = campanasResponse.data;
      console.log(`✅ Campañas obtenidas: ${campanas.length}`);
      
      if (campanas.length > 0) {
        console.log('\n📢 Campañas disponibles:');
        campanas.forEach((c, i) => {
          console.log(`   ${i + 1}. ${c.nombre} (ID: ${c.id}) - Estado: ${c.estado}`);
        });
      } else {
        console.log('⚠️  No hay campañas para este cliente');
      }
      
      // 3. Test con usuario b3toh (admin)
      console.log('\n3️⃣ Intentando login con usuario "b3toh" (admin)...');
      const adminLogin = await axios.post(`${API_URL}/auth/login`, {
        usuario: 'b3toh',
        password: 'elgeneral2018'
      });
      
      if (adminLogin.data.success) {
        console.log('✅ Login admin exitoso');
        console.log('   Usuario:', adminLogin.data.user.usuario);
        console.log('   Cliente ID:', adminLogin.data.user.cliente_id);
        
        const adminToken = adminLogin.data.token;
        const adminCampanasResponse = await axios.get(`${API_URL}/sender/campaigns`, {
          headers: {
            'Authorization': `Bearer ${adminToken}`
          }
        });
        
        console.log(`✅ Campañas admin: ${adminCampanasResponse.data.length}`);
      }
      
      console.log('\n✅ ¡Todos los tests pasaron correctamente!');
      console.log('\n💡 Instrucciones:');
      console.log('   1. Ve a http://localhost:5174/login');
      console.log('   2. Ingresa: Usuario "Haby" / Password "haby1973"');
      console.log('   3. Navega a "Seleccionar Prospectos"');
      console.log('   4. Deberías ver las campañas en el selector');
      
    } else {
      console.log('❌ Login falló:', loginResponse.data.message);
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.response?.data?.message || error.message);
    if (error.response?.status === 401) {
      console.log('   Causa: Token inválido o credenciales incorrectas');
    }
    if (error.code === 'ECONNREFUSED') {
      console.log('   Causa: El servidor no está corriendo en', API_URL);
      console.log('   Solución: Ejecuta "npm start" en otra terminal');
    }
  }
}

testLogin();
