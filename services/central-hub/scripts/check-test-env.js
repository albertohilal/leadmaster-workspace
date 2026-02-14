/**
 * Guard de seguridad para ejecución de tests
 * 
 * Validaciones:
 * - NODE_ENV debe ser "test"
 * - DB_NAME debe incluir "_test"
 * 
 * Previene:
 * - Ejecución accidental de tests contra producción
 * - Modificación de datos productivos por integration tests
 */

const fs = require('fs');
const path = require('path');

// Cargar .env.test SOLO si existe (desarrollo local)
// En CI, las variables vienen del workflow env: block
const envTestPath = path.join(__dirname, '..', '.env.test');
if (fs.existsSync(envTestPath)) {
  require('dotenv').config({ path: envTestPath });
  console.log('📄 .env.test cargado correctamente');
} else {
  console.log('⚙️ .env.test no encontrado, usando variables del entorno (CI)');
}

const NODE_ENV = process.env.NODE_ENV;
const DB_NAME = process.env.DB_NAME || '';

// Validación 1: NODE_ENV
if (NODE_ENV !== 'test') {
  console.error(`
❌ ERROR: Tests requieren NODE_ENV=test

Actual: NODE_ENV=${NODE_ENV}

Solución:
1. Crear archivo .env.test con NODE_ENV=test
2. Verificar que jest.env.js esté configurado correctamente
`);
  process.exit(1);
}

// Validación 2: DB_NAME debe incluir "_test"
if (!DB_NAME.includes('_test')) {
  console.error(`
❌ ERROR: Tests requieren base de datos con sufijo "_test"

Actual: DB_NAME=${DB_NAME}

PELIGRO: No se pueden ejecutar tests contra base de datos productiva

Solución:
1. Crear base de datos de testing: ${DB_NAME}_test
2. Actualizar .env.test con DB_NAME=${DB_NAME}_test
3. Ejecutar migrations en la base de datos de test
`);
  process.exit(1);
}

// Validaciones OK
console.log(`✅ Entorno de test validado: ${DB_NAME}\n`);
