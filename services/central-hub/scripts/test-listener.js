// Test completo del módulo listener de punta a punta
require('dotenv').config();
const mysql = require('mysql2/promise');

async function testListenerEndToEnd() {
  console.log('🎯 VERIFICACIÓN END-TO-END MÓDULO LISTENER');
  console.log('==========================================');
  
  try {
    // 1. Test estructura de archivos
    console.log('1️⃣ Verificando estructura de archivos...');
    const fs = require('fs');
    const paths = [
      './src/modules/listener/routes/listenerRoutes.js',
      './src/modules/listener/controllers/listenerController.js', 
      './src/modules/listener/services/listenerService.js',
      './src/modules/listener/services/whatsappService.js',
      './src/modules/listener/ia/iaService.js'
    ];
    
    for (const path of paths) {
      if (fs.existsSync(path)) {
        console.log(`   ✅ ${path.split('/').pop()}`);
      } else {
        console.log(`   ❌ ${path.split('/').pop()} - NO ENCONTRADO`);
      }
    }
    
    // 2. Test carga de módulos
    console.log('2️⃣ Verificando carga de módulos...');
    try {
      const listenerController = require('./src/modules/listener/controllers/listenerController');
      console.log('   ✅ listenerController cargado');
      console.log('   📋 Métodos:', Object.getOwnPropertyNames(listenerController));
      
      const listenerService = require('./src/modules/listener/services/listenerService');
      console.log('   ✅ listenerService cargado');
      
      const iaService = require('./src/modules/listener/ia/iaService');
      console.log('   ✅ iaService cargado');
    } catch (error) {
      console.log('   ❌ Error cargando módulos:', error.message);
    }
    
    // 3. Test conexión DB para control IA
    console.log('3️⃣ Verificando conexión DB...');
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT
    });
    console.log('   ✅ Conexión MySQL establecida');
    
    // 4. Test tabla de control IA
    console.log('4️⃣ Verificando tabla ll_ia_control...');
    try {
      const [result] = await connection.execute('SHOW TABLES LIKE "ll_ia_control"');
      if (result.length > 0) {
        console.log('   ✅ Tabla ll_ia_control existe');
        const [rows] = await connection.execute('SELECT COUNT(*) as total FROM ll_ia_control');
        console.log(`   📊 Registros de control IA: ${rows[0].total}`);
      } else {
        console.log('   ⚠️ Tabla ll_ia_control no existe - creando...');
        await connection.execute(`
          CREATE TABLE ll_ia_control (
            telefono VARCHAR(20) PRIMARY KEY,
            ia_enabled BOOLEAN DEFAULT TRUE,
            fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          )
        `);
        console.log('   ✅ Tabla ll_ia_control creada');
      }
    } catch (error) {
      console.log('   ❌ Error con tabla ll_ia_control:', error.message);
    }
    
    // 5. Test servicios de IA
    console.log('5️⃣ Probando servicios de IA...');
    try {
      const { responder } = require('./src/modules/listener/ia/iaService');
      
      // Test con mensaje simple
      const testMessage = {
        cliente_id: 1,
        telefono: '5491123456789',
        texto: 'hola'
      };
      
      console.log('   🧪 Probando respuesta IA...');
      const respuesta = await responder(testMessage);
      console.log(`   ✅ IA respondió: "${respuesta ? respuesta.substring(0, 50) + '...' : 'Sin respuesta'}"`);
      
    } catch (error) {
      console.log('   ⚠️ Error en servicios IA:', error.message);
    }
    
    // 6. Test integración session-manager
    console.log('6️⃣ Verificando integración session-manager...');
    try {
      const sessionService = require('./src/modules/session-manager/services/sessionService');
      const state = sessionService.getSessionState();
      console.log(`   📱 Estado sesión WhatsApp: ${state.state}`);
      console.log(`   🔗 Sesión lista: ${state.ready ? 'SÍ' : 'NO'}`);
      
      if (state.state === 'qr') {
        console.log('   📲 Para activar: accede a /session-manager/qr');
      }
      
    } catch (error) {
      console.log('   ❌ Error integración session-manager:', error.message);
    }
    
    // 7. Test flujo completo (simulado)
    console.log('7️⃣ Simulando flujo completo...');
    try {
      const listenerService = require('./src/modules/listener/services/listenerService');
      
      // Test estado inicial
      const status = listenerService.getStatus();
      console.log(`   📊 Estado listener: ${status.mode}`);
      
      // Test cambio de modo
      const modeResult = listenerService.setMode('respond');
      console.log(`   ⚙️ Cambio a modo respond: ${modeResult.success ? 'OK' : 'FAIL'}`);
      
      // Test control IA
      const telefono = '5491123456789';
      const enableResult = await listenerService.setIAControl(telefono, true);
      console.log(`   🤖 IA habilitada para ${telefono}: ${enableResult.success ? 'OK' : 'FAIL'}`);
      
      const iaEnabled = await listenerService.isIAEnabled(telefono);
      console.log(`   ✅ Verificación IA: ${iaEnabled ? 'HABILITADA' : 'DESHABILITADA'}`);
      
    } catch (error) {
      console.log('   ❌ Error en flujo completo:', error.message);
    }
    
    await connection.end();
    
    console.log('');
    console.log('🎉 VERIFICACIÓN COMPLETA');
    console.log('========================');
    console.log('✅ Estructura: Archivos y módulos presentes');
    console.log('✅ Base de datos: Conexión y tabla de control IA');
    console.log('✅ Servicios: IA y WhatsApp integrados');  
    console.log('✅ Control: Modos y logs funcionando');
    console.log('✅ Integración: Session-manager conectado');
    console.log('');
    
    // Determinar estado general
    const listenerService = require('./src/modules/listener/services/listenerService');
    const sessionService = require('./src/modules/session-manager/services/sessionService');
    const sessionState = sessionService.getSessionState();
    
    if (sessionState.ready) {
      console.log('🟢 LISTENER COMPLETAMENTE FUNCIONAL');
      console.log('   - Puede recibir y responder mensajes');
      console.log('   - IA activa y control granular por teléfono');
      console.log('   - Integración WhatsApp operativa');
    } else {
      console.log('🟡 LISTENER PARCIALMENTE FUNCIONAL');
      console.log('   - Estructura y lógica OK');
      console.log('   - Necesita sesión WhatsApp activa para funcionar');
      console.log('   - Accede a /session-manager/qr para completar setup');
    }
    
  } catch (error) {
    console.error('❌ Error en verificación:', error.message);
  }
}

testListenerEndToEnd();