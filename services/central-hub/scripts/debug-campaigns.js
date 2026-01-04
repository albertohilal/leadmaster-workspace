#!/usr/bin/env node
/**
 * Debug específico del endpoint campaigns
 */

const axios = require('axios');

async function debugCampaigns() {
  try {
    // 1. Autenticarse
    const authResponse = await axios.post('http://localhost:3011/auth/login', {
      usuario: 'Haby',
      password: 'haby1973'
    });
    
    const token = authResponse.data.token;
    
    // 2. Probar endpoint con más detalles de error
    try {
      const response = await axios.get('http://localhost:3011/sender/campaigns', {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('✅ Campaigns endpoint working:', response.data);
    } catch (error) {
      console.log('❌ Error details:');
      console.log('Status:', error.response?.status);
      console.log('Data:', error.response?.data);
      console.log('Full error:', error.message);
    }
    
    // 3. Probar consulta directa a BD
    console.log('\n🔍 Testing direct DB query...');
    const mysql = require('mysql2/promise');
    
    const connection = await mysql.createConnection({
      host: 'sv46.byethost46.org',
      user: 'iunaorg_b3toh',
      password: 'elgeneral2018',
      database: 'iunaorg_dyd'
    });
    
    const [rows] = await connection.execute(
      'SELECT id, nombre, mensaje, estado, fecha_creacion FROM ll_campanias_whatsapp WHERE cliente_id = ?',
      [51]
    );
    
    console.log('✅ Direct DB query result:', rows);
    
    await connection.end();
    
  } catch (error) {
    console.error('❌ Debug error:', error);
  }
}

debugCampaigns();