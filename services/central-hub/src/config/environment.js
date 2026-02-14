/**
 * Configuración centralizada de entorno
 * 
 * Propósito:
 * - Cargar variables de entorno una sola vez
 * - Validar combinaciones peligrosas (test vs producción)
 * - Proveer API normalizada para todo el sistema
 * 
 * Seguridad:
 * - Aborta si DB_NAME productivo en entorno test
 * - Aborta si DB_NAME de test en producción
 */

let envLoaded = false;

function loadEnvironment() {
  if (envLoaded) return;

  // Solo cargar dotenv si no estamos en Jest (Jest usa jest.env.js)
  if (!process.env.JEST_WORKER_ID) {
    require('dotenv').config();
  }

  envLoaded = true;
}

loadEnvironment();

// Detectar entorno
const NODE_ENV = process.env.NODE_ENV || 'development';
const isTest = NODE_ENV === 'test';
const isProduction = NODE_ENV === 'production';
const isDevelopment = NODE_ENV === 'development';

// Variables críticas
const DB_NAME = process.env.DB_NAME || '';
const AUTO_CAMPAIGNS_ENABLED = process.env.AUTO_CAMPAIGNS_ENABLED === 'true';

// Validaciones de seguridad
function validateEnvironment() {
  const hasTestSuffix = DB_NAME.includes('_test');

  // CRÍTICO: Test debe usar DB con _test
  if (isTest && !hasTestSuffix) {
    console.error(`
❌ ABORTAR: Entorno de test con base de datos productiva

NODE_ENV: ${NODE_ENV}
DB_NAME: ${DB_NAME}

Solución:
1. Crear archivo .env.test con DB_NAME que incluya "_test"
2. Ejemplo: DB_NAME=iunaorg_dyd_test
`);
    process.exit(1);
  }

  // CRÍTICO: Producción no debe usar DB de test
  if (isProduction && hasTestSuffix) {
    console.error(`
❌ ABORTAR: Entorno de producción con base de datos de test

NODE_ENV: ${NODE_ENV}
DB_NAME: ${DB_NAME}

Solución:
1. Verificar .env en producción
2. DB_NAME NO debe contener "_test"
`);
    process.exit(1);
  }

  // Validación: DB_NAME debe estar definida
  if (!DB_NAME) {
    console.error('❌ ABORTAR: DB_NAME no definida en variables de entorno');
    process.exit(1);
  }
}

validateEnvironment();

// API pública
module.exports = {
  nodeEnv: NODE_ENV,
  isTest,
  isProduction,
  isDevelopment,
  dbName: DB_NAME,
  autoCampaignsEnabled: AUTO_CAMPAIGNS_ENABLED,
  
  // Métodos de utilidad
  requireProduction() {
    if (!isProduction) {
      throw new Error('Esta operación solo está permitida en producción');
    }
  },
  
  requireNonProduction() {
    if (isProduction) {
      throw new Error('Esta operación no está permitida en producción');
    }
  }
};
