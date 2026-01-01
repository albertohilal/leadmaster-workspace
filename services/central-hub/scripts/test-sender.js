// Test del módulo sender de punta a punta
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Test solo del módulo sender esencial
try {
  console.log('🧪 Probando módulo sender...');
  
  // Probar solo las rutas principales del sender
  const express = require('express');
  const senderRouter = express.Router();
  
  // Ruta de status básica
  senderRouter.get('/status', (req, res) => {
    res.json({ 
      status: 'sender ok', 
      module: 'sender',
      timestamp: new Date().toISOString()
    });
  });
  
  // Probar el controlador de destinatarios
  try {
    const destinatariosController = require('./src/modules/sender/controllers/destinatariosController');
    senderRouter.get('/test-destinatarios', (req, res) => {
      res.json({ 
        status: 'destinatarios controller loaded ok',
        methods: Object.getOwnPropertyNames(destinatariosController)
      });
    });
    console.log('✅ Controller destinatarios cargado');
  } catch (error) {
    console.log('⚠️ Error en destinatarios controller:', error.message);
  }
  
  // Probar conexión a DB
  senderRouter.get('/test-db', async (req, res) => {
    try {
      const mysql = require('mysql2/promise');
      const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT
      });
      
      const [result] = await connection.execute('SELECT 1 as test');
      await connection.end();
      
      res.json({
        status: 'db connection ok',
        test: result[0]
      });
    } catch (error) {
      res.status(500).json({
        status: 'db connection failed',
        error: error.message
      });
    }
  });
  
  app.use('/sender', senderRouter);
  console.log('✅ Rutas de sender test configuradas');
  
} catch (error) {
  console.error('❌ Error configurando sender:', error.message);
}

const PORT = process.env.PORT || 3013;
app.listen(PORT, () => {
  console.log(`🚀 Servidor test sender en http://localhost:${PORT}`);
  console.log('📋 Endpoints test:');
  console.log('   - GET /health');
  console.log('   - GET /sender/status');
  console.log('   - GET /sender/test-destinatarios');
  console.log('   - GET /sender/test-db');
});