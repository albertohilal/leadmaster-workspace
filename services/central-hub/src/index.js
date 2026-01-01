// Punto de entrada principal
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Rutas principales
app.get('/', (req, res) => {
  res.json({
    name: 'Leadmaster Central Hub',
    status: 'ok',
    version: '1.0.0',
    modules: ['session-manager', 'sender', 'listener', 'auth', 'sync-contacts'],
    endpoints: {
      'session-manager': '/session-manager/*',
      'sender': '/sender/*',
      'listener': '/listener/*',
      'auth': '/auth/*',
      'sync-contacts': '/sync-contacts/*'
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Integración de módulos
try {
  console.log('🔄 Cargando módulos...');
  
  // Autenticación (activado)
  app.use('/auth', require('./modules/auth/routes/authRoutes'));
  console.log('✅ Módulo auth activado');
  
  // Session Manager (activando)
  app.use('/session-manager', require('./modules/session-manager/routes/index'));
  console.log('✅ Módulo session-manager activado');
  
  // Sender (activando)
  app.use('/sender', require('./modules/sender/routes/index'));
  console.log('✅ Módulo sender activado');
  
  // Listener (activando)
  app.use('/listener', require('./modules/listener/routes/listenerRoutes'));
  console.log('✅ Módulo listener activado');
  
  // Sync Contacts (Gmail integration)
  app.use('/sync-contacts', require('./modules/sync-contacts/routes/index'));
  console.log('✅ Módulo sync-contacts activado');
  
  // Iniciar cron job para sincronización automática
  const syncCronJob = require('./modules/sync-contacts/cron/syncCronJob');
  syncCronJob.start();
  
  // Test module (comentado temporalmente)
  // app.use('/test', require('./modules/test/routes/testRoutes'));
  // console.log('✅ Módulo test activado');
  
  // Ya no necesitamos rutas mock - todos los módulos están activos
  console.log('🎉 TODOS LOS MÓDULOS ACTIVADOS - SISTEMA LISTO PARA PRODUCCIÓN');
  
  console.log('✅ Endpoints de prueba configurados');
} catch (error) {
  console.error('❌ Error integrando módulos:', error.message);
  console.error('Stack:', error.stack);
}

// Ruta catch-all para SPA - debe ir DESPUÉS de todas las rutas API
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

const PORT = process.env.PORT || 3010;
app.listen(PORT, () => {
  console.log(`🚀 Leadmaster Central Hub corriendo en http://localhost:${PORT}`);
  console.log('📋 Endpoints disponibles:');
  console.log('   - GET / (info general)');
  console.log('   - GET /health (health check)');
  console.log('   - POST /auth/* (autenticación)');
  console.log('   - GET /session-manager/* (gestión sesión WhatsApp)');
  console.log('   - GET /sender/* (envíos masivos)');
  console.log('   - GET /listener/* (respuestas automáticas)');
  console.log('   - GET /sync-contacts/* (sincronización Gmail Contacts)');
});
