# 🔴 INFORME TÉCNICO: RIESGO DE MODIFICACIÓN DE DATOS PRODUCTIVOS
## Análisis de Integration Tests - Campaign Send

**Fecha**: 14 de febrero de 2026  
**Archivo analizado**: `tests/campaign-send.integration.test.js`  
**Módulos relacionados**: `src/modules/sender/*`

---

## ❌ CONCLUSIÓN PRINCIPAL: RIESGO ALTO CONFIRMADO

Los integration tests **ejecutan operaciones reales contra la base de datos configurada en las variables de entorno**, sin ningún mecanismo de aislamiento o base de datos de testing.

**⚠️ ESTADO ACTUAL**: Si ejecutas `npm test` con la configuración actual, modificarás datos en la base de datos de producción `iunaorg_dyd`.

---

## 📊 OPERACIONES SQL EJECUTADAS POR LOS TESTS

### 1. Operaciones de Cleanup (`tests/helpers/dbTestHelpers.js`)

Ejecutado en **beforeEach()** y **afterEach()** de CADA test:

```sql
DELETE FROM ll_programacion_envios_diarios WHERE programacion_id >= 9000;
DELETE FROM ll_envios_whatsapp WHERE campania_id >= 9000;
DELETE FROM ll_programaciones WHERE id >= 9000;
DELETE FROM ll_campanias_whatsapp WHERE id >= 9000;
```

**Impacto**: Si existen registros con estos IDs en producción, serán **ELIMINADOS PERMANENTEMENTE**.

### 2. Operaciones de Setup (Datos de prueba)

#### createTestCampaign()
```sql
INSERT INTO ll_campanias_whatsapp (id, nombre, estado, cliente_id, fecha_creacion)
VALUES (9001, 'Campaña Test', 'en_progreso', 1, NOW());
```

#### createTestProgramacion()
```sql
INSERT INTO ll_programaciones 
(id, campania_id, cliente_id, cupo_diario, estado, dias_semana, hora_inicio, hora_fin, fecha_inicio)
VALUES (9001, 9001, 1, 10, 'aprobada', 'mon,tue,wed,thu,fri,sat,sun', '00:00:00', '23:59:59', CURDATE());
```

#### createTestEnvios() (Ejecutado en bucle)
```sql
INSERT INTO ll_envios_whatsapp 
(campania_id, telefono_wapp, nombre_destino, mensaje_final, estado)
VALUES (9001, '5491112340000', 'Destinatario Test 1', 'Mensaje de prueba', 'pendiente');
-- Se repite N veces según el parámetro count
```

### 3. Operaciones del Scheduler (Código real ejecutado)

#### Locking de programaciones
```sql
UPDATE ll_programaciones 
SET locked_at = NOW(), locked_by = 'hostname_pid_timestamp' 
WHERE id = 9001 AND locked_at IS NULL;

UPDATE ll_programaciones 
SET locked_at = NULL, locked_by = NULL 
WHERE id = 9001 AND locked_by = 'hostname_pid_timestamp';
```

#### Incremento de contador diario
```sql
INSERT INTO ll_programacion_envios_diarios (programacion_id, fecha, enviados)
VALUES (9001, CURDATE(), 5)
ON DUPLICATE KEY UPDATE enviados = enviados + VALUES(enviados), actualizado_en = NOW();
```

### 4. Operaciones de Estado (Con transacciones)

#### Flujo transaccional completo (`estadoService.js`)
```sql
BEGIN;

-- Lock pesimista
SELECT estado FROM ll_envios_whatsapp WHERE id = 1234 FOR UPDATE;

-- Auditoría
INSERT INTO ll_envios_whatsapp_historial 
(envio_id, estado_anterior, estado_nuevo, origen, detalle, usuario_id) 
VALUES (1234, 'pendiente', 'enviado', 'scheduler', 'Envío automático exitoso', NULL);

-- Cambio de estado
UPDATE ll_envios_whatsapp 
SET estado = 'enviado', fecha_envio = NOW(), message_id = 'msg_stub_1_12345' 
WHERE id = 1234;

COMMIT;
```

**Nota**: En caso de error, se ejecuta `ROLLBACK`, pero **SOLO para esta transacción individual**, no para todo el test.

---

## 🔍 ANÁLISIS DE CONFIGURACIÓN

### Conexión a Base de Datos

**Archivo**: `src/modules/sender/db/connection.js`

```javascript
const pool = mysql.createPool({
  host: process.env.DB_HOST,          // sv46.byethost46.org
  user: process.env.DB_USER,          // iunaorg_b3toh
  password: process.env.DB_PASSWORD,  // elgeneral2018
  database: process.env.DB_NAME,      // iunaorg_dyd ← PRODUCCIÓN
  port: process.env.DB_PORT || 3306,
  charset: 'utf8mb4',
  timezone: '-03:00',
  waitForConnections: true,
  connectionLimit: 5,
  maxIdle: 3,
  idleTimeout: 60000,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

module.exports = pool;
```

**🔴 PROBLEMA CRÍTICO**: 
- No existe diferenciación entre entornos de test y producción
- No hay archivo `.env.test`
- La variable `DB_NAME` apunta directamente a producción

### Configuración Actual de Variables de Entorno

**Archivo**: `.env` (raíz del proyecto)

```dotenv
DB_HOST=sv46.byethost46.org
DB_USER=iunaorg_b3toh
DB_PASSWORD=elgeneral2018
DB_NAME=iunaorg_dyd        # ← BASE DE DATOS PRODUCTIVA
DB_PORT=3306
NODE_ENV=development
```

**⚠️ CONFIRMADO**: La configuración actual apunta a la base de datos de producción.

### Mocks y Stubs

#### ✅ Session Manager - MOCKEADO
```javascript
// tests/campaign-send.integration.test.js
jest.mock('../src/integrations/sessionManager/sessionManagerClient', () => {
  return require('./stubs/sessionManagerStub');
});
```

**Resultado**: NO se envían mensajes de WhatsApp reales durante los tests.

#### ❌ Base de Datos - NO MOCKEADA
```javascript
// jest.setup.js
jest.mock('./src/config/db');  // ← Mockea la conexión principal, NO la de sender
```

**Resultado**: El módulo sender usa su propia conexión (`sender/db/connection.js`) que **NO está mockeada**.

### Estrategia de Aislamiento

**Mecanismo implementado**:
- Uso de IDs >= 9000 para datos de prueba
- Cleanup en `beforeEach()` y `afterEach()`

**🟡 AISLAMIENTO FRÁGIL**:

```javascript
// tests/helpers/dbTestHelpers.js
async function cleanupTestData() {
  await connection.query('DELETE FROM ll_programacion_envios_diarios WHERE programacion_id >= 9000');
  await connection.query('DELETE FROM ll_envios_whatsapp WHERE campania_id >= 9000');
  await connection.query('DELETE FROM ll_programaciones WHERE id >= 9000');
  await connection.query('DELETE FROM ll_campanias_whatsapp WHERE id >= 9000');
}
```

**Problemas**:
1. Si ya existen registros legítimos con ID >= 9000 en producción, serán eliminados
2. No hay validación de entorno antes de ejecutar el cleanup
3. Si `afterEach()` falla, los datos de prueba permanecen en producción

### Transacciones y Rollbacks

#### ❌ NO hay transacciones globales por test

```javascript
// Patrón actual (NO seguro)
beforeEach(async () => {
  await dbHelpers.cleanupTestData();  // DELETE real
  sessionManagerStub.reset();
});

afterEach(async () => {
  await dbHelpers.cleanupTestData();  // DELETE real
  sessionManagerStub.reset();
});
```

#### ✅ SÍ hay transacciones en operaciones individuales

```javascript
// estadoService.js - Solo para operaciones atómicas
async function cambiarEstado(...) {
  const conn = connection;
  try {
    await conn.beginTransaction();
    // ... operaciones
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  }
}
```

**Limitación**: El rollback solo aplica a la operación individual, no a todo el test.

---

## 🎯 RESPUESTAS A PREGUNTAS CLAVE

### ¿Los integration tests ejecutan INSERT, UPDATE o DELETE reales?

**✅ SÍ, CONFIRMADO**

Ejecutan contra la base de datos real:
- **DELETE**: En cleanup (antes y después de cada test)
- **INSERT**: Campañas, programaciones, envíos de prueba
- **UPDATE**: Estados, locks, contadores diarios
- **SELECT FOR UPDATE**: Locks pesimistas transaccionales

### ¿Se utilizan transacciones con rollback?

**⚠️ PARCIALMENTE**

**SÍ** en operaciones individuales:
- `estadoService.js` usa `BEGIN TRANSACTION` + `COMMIT/ROLLBACK`
- Scope limitado a operaciones atómicas de cambio de estado

**NO** en nivel de test:
- No hay `START TRANSACTION` al inicio del test
- No hay `ROLLBACK` global al finalizar el test
- Cada operación se persiste inmediatamente en la BD

### ¿Se usan mocks o base de datos real?

| Componente | Estado |
|-----------|---------|
| Session Manager | ✅ Mockeado (stub) |
| Base de datos principal (`config/db`) | ✅ Mockeada (jest.setup.js) |
| Base de datos sender (`sender/db/connection.js`) | ❌ **REAL** |
| WhatsApp API | ✅ Stubbed |

**Conclusión**: Los tests de sender operan sobre base de datos real sin aislamiento.

### ¿Existe riesgo de modificar datos productivos?

**✅ SÍ, RIESGO ALTO**

#### Escenario 1: Ejecución directa con variables productivas
```bash
# Con .env apuntando a producción
npm test  # ← Ejecutará DELETE/INSERT/UPDATE en iunaorg_dyd
```

#### Escenario 2: Colisión de IDs

Si en producción ya existen:
- `ll_campanias_whatsapp` con `id IN (9001, 9002, 9003, 9004, 9005, 9006)`
- `ll_envios_whatsapp` con `campania_id >= 9000`

**Los tests los ELIMINARÁN**:
```sql
DELETE FROM ll_envios_whatsapp WHERE campania_id >= 9000;
DELETE FROM ll_campanias_whatsapp WHERE id >= 9000;
```

#### Escenario 3: Fallo en cleanup

Si `afterEach()` falla (timeout de BD, error de red, excepción no controlada):
- Los datos de prueba quedan en producción
- Contaminan las estadísticas reales
- Pueden ejecutar envíos no deseados si `AUTO_CAMPAIGNS_ENABLED=true`

#### Escenario 4: CI/CD con variables incorrectas

Si el pipeline CI/CD ejecuta:
```bash
npm test  # Sin validación de entorno
```

Y las variables apuntan a producción → **modificación masiva de datos en producción**.

---

## 🛡️ RECOMENDACIONES URGENTES

### 1. Crear base de datos de testing separada

#### Opción A: Base de datos espejo
```sql
CREATE DATABASE iunaorg_dyd_test;
-- Copiar estructura (sin datos) desde iunaorg_dyd
```

#### Opción B: SQLite en memoria (solo para tests)
```javascript
// Para tests que no requieren MySQL específico
const sqlite3 = require('sqlite3');
const db = new sqlite3.Database(':memory:');
```

### 2. Crear archivo `.env.test`

```dotenv
# services/central-hub/.env.test
DB_HOST=sv46.byethost46.org
DB_USER=iunaorg_b3toh
DB_PASSWORD=elgeneral2018
DB_NAME=iunaorg_dyd_test    # ← Base de datos de testing
DB_PORT=3306
NODE_ENV=test
AUTO_CAMPAIGNS_ENABLED=false
DRY_RUN=true
```

### 3. Configurar Jest para cargar variables de testing

```javascript
// jest.config.js
module.exports = {
  rootDir: "./",
  testEnvironment: "node",
  
  // NUEVO: Cargar variables de entorno de test
  setupFiles: ['<rootDir>/jest.env.js'],
  
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  
  testMatch: [
    "**/src/**/?(*.)+(test).js",
    "**/?(*.)+(test).js",
    "**/tests/**/?(*.)+(integration.test).js"
  ],
  
  testPathIgnorePatterns: [
    "/node_modules/",
    "/frontend/",
    "/tests/.*\\.spec\\.ts$",
    "/tests/.*\\.spec\\.js$"
  ],
  
  collectCoverage: true,
  collectCoverageFrom: [
    "src/modules/whatsappQrAuthorization/repositories/**/*.js",
    "src/modules/whatsappQrAuthorization/services/**/*.js"
  ],
  
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov"]
};
```

```javascript
// jest.env.js (NUEVO)
const dotenv = require('dotenv');
const path = require('path');

// Cargar .env.test si existe, sino .env
const envFile = path.join(__dirname, '.env.test');
const result = dotenv.config({ path: envFile });

if (result.error) {
  console.warn('⚠️  .env.test no encontrado, usando .env por defecto');
  dotenv.config();
}

// Forzar entorno de test
process.env.NODE_ENV = 'test';
process.env.AUTO_CAMPAIGNS_ENABLED = 'false';

console.log(`📋 Tests usando DB: ${process.env.DB_NAME}`);
```

### 4. Validar entorno antes de ejecutar tests

```javascript
// tests/helpers/dbTestHelpers.js (AGREGAR AL INICIO)

/**
 * Valida que estamos en entorno de testing
 * Previene ejecución accidental contra producción
 */
function validateTestEnvironment() {
  const dbName = process.env.DB_NAME;
  
  // Lista negra de nombres de BD productivas
  const productionDatabases = [
    'iunaorg_dyd',
    'leadmaster_prod',
    'leadmaster_production'
  ];
  
  if (productionDatabases.includes(dbName)) {
    throw new Error(`
      ❌ ABORTAR: NO se pueden ejecutar tests contra base de datos productiva
      
      Base de datos actual: ${dbName}
      
      Soluciones:
      1. Crear .env.test con DB_NAME=iunaorg_dyd_test
      2. Configurar variable de entorno: export DB_NAME=iunaorg_dyd_test
      3. Ejecutar: NODE_ENV=test DB_NAME=iunaorg_dyd_test npm test
    `);
  }
  
  if (!dbName.includes('test') && process.env.NODE_ENV !== 'test') {
    console.warn(`
      ⚠️  ADVERTENCIA: Posible base de datos productiva
      DB_NAME: ${dbName}
      NODE_ENV: ${process.env.NODE_ENV}
      
      Continúa solo si estás seguro...
    `);
  }
  
  console.log(`✅ Entorno validado: ${dbName}`);
}

// EXPORTAR Y LLAMAR EN beforeAll
module.exports = {
  validateTestEnvironment,  // ← NUEVO
  cleanupTestData,
  createTestCampaign,
  // ...resto de exports
};
```

```javascript
// tests/campaign-send.integration.test.js (MODIFICAR)
const dbHelpers = require('./helpers/dbTestHelpers');

describe('Campaign Send Integration Tests', () => {
  
  beforeAll(async () => {
    // NUEVO: Validar entorno ANTES de cualquier operación
    dbHelpers.validateTestEnvironment();
    
    // Verificar conexión a DB
    await connection.query('SELECT 1');
  });
  
  // ... resto del código
});
```

### 5. Implementar transacciones globales por test

```javascript
// tests/helpers/dbTestHelpers.js

let testConnection = null;

/**
 * Inicia una transacción global para el test
 * Debe llamarse en beforeEach()
 */
async function startTestTransaction() {
  testConnection = await connection.getConnection();
  await testConnection.beginTransaction();
  console.log('🔄 Transacción de test iniciada');
  return testConnection;
}

/**
 * Revierte la transacción global del test
 * Debe llamarse en afterEach()
 */
async function rollbackTestTransaction() {
  if (testConnection) {
    await testConnection.rollback();
    testConnection.release();
    testConnection = null;
    console.log('↩️  Transacción de test revertida');
  }
}

/**
 * Obtiene la conexión transaccional actual
 * Usar esta conexión en lugar de la global
 */
function getTestConnection() {
  if (!testConnection) {
    throw new Error('No hay transacción activa. Llamar startTestTransaction() primero.');
  }
  return testConnection;
}

module.exports = {
  // ... exports existentes
  startTestTransaction,
  rollbackTestTransaction,
  getTestConnection
};
```

```javascript
// tests/campaign-send.integration.test.js (MODIFICAR)
describe('Campaign Send Integration Tests', () => {
  
  let testConn;
  
  beforeEach(async () => {
    // Iniciar transacción global
    testConn = await dbHelpers.startTestTransaction();
    
    // Limpiar datos (dentro de la transacción)
    await dbHelpers.cleanupTestData();
    
    // Reset del stub
    sessionManagerStub.reset();
    sessionManagerStub.setStatusResponse({ status: 'READY', connected: true });
  });

  afterEach(async () => {
    // Revertir TODO el test (incluyendo cleanup)
    await dbHelpers.rollbackTestTransaction();
    
    // Reset del stub
    sessionManagerStub.reset();
  });
  
  // ... resto de tests
});
```

**⚠️ LIMITACIÓN**: MySQL por defecto no permite transacciones para operaciones DDL (CREATE, ALTER, DROP). Asegurar que los tests solo usen DML (INSERT, UPDATE, DELETE, SELECT).

### 6. Agregar guard en package.json

```jsonc
// package.json
{
  "scripts": {
    "test": "node scripts/check-test-env.js && jest",
    "test:unsafe": "jest",
    "test:watch": "node scripts/check-test-env.js && jest --watch"
  }
}
```

```javascript
// scripts/check-test-env.js (NUEVO)
const dbName = process.env.DB_NAME || 'NO_DEFINIDO';
const productionDbs = ['iunaorg_dyd', 'leadmaster_prod'];

if (productionDbs.includes(dbName)) {
  console.error(`
❌ ERROR: NO se pueden ejecutar tests contra base de datos productiva

Base de datos actual: ${dbName}

Para ejecutar tests correctamente:
  1. Crear archivo .env.test con DB_NAME=iunaorg_dyd_test
  2. Ejecutar: npm test

Si REALMENTE necesitas ejecutar tests con esta configuración (NO recomendado):
  npm run test:unsafe
  `);
  process.exit(1);
}

console.log(`✅ Tests autorizados para: ${dbName}\n`);
```

### 7. Actualizar documentación

```markdown
# README.md (Agregar sección)

## 🧪 Testing

### Ejecución de Tests

**IMPORTANTE**: Los tests de integración requieren una base de datos de testing separada.

#### Setup inicial

1. Crear base de datos de testing:
   \`\`\`sql
   CREATE DATABASE iunaorg_dyd_test;
   USE iunaorg_dyd_test;
   SOURCE migrations/schema.sql;
   \`\`\`

2. Crear archivo \`.env.test\`:
   \`\`\`dotenv
   DB_NAME=iunaorg_dyd_test
   # Copiar resto de variables desde .env
   \`\`\`

3. Ejecutar tests:
   \`\`\`bash
   npm test
   \`\`\`

#### Validaciones de seguridad

- ❌ **NUNCA** ejecutar tests con \`DB_NAME=iunaorg_dyd\` (producción)
- ✅ El script valida automáticamente el entorno antes de ejecutar
- ⚠️ Para bypass (solo desarrollo): \`npm run test:unsafe\`

#### Estructura de tests

- **Unit tests**: \`src/**/*.test.js\` (mocks completos)
- **Integration tests**: \`tests/**/*.integration.test.js\` (BD real)
- **E2E tests**: \`e2e/**/*.spec.js\` (Playwright)
\`\`\`
```

---

## 📋 CHECKLIST DE IMPLEMENTACIÓN

### Fase 1: Protección Inmediata (URGENTE)
- [ ] Crear `.env.test` con `DB_NAME=iunaorg_dyd_test`
- [ ] Agregar `scripts/check-test-env.js`
- [ ] Modificar script `"test"` en `package.json`
- [ ] Agregar validación en `dbTestHelpers.js`
- [ ] Documentar en README.md

### Fase 2: Base de Datos de Testing
- [ ] Crear base de datos `iunaorg_dyd_test`
- [ ] Copiar estructura de tablas (sin datos)
- [ ] Verificar conectividad
- [ ] Ejecutar migración de schema

### Fase 3: Configuración de Jest
- [ ] Crear `jest.env.js`
- [ ] Modificar `jest.config.js`
- [ ] Agregar logs de validación
- [ ] Verificar carga de variables

### Fase 4: Mejoras Avanzadas (Opcional)
- [ ] Implementar transacciones globales por test
- [ ] Agregar factory de datos de prueba
- [ ] Implementar snapshots de BD
- [ ] Crear scripts de reset rápido

### Fase 5: CI/CD
- [ ] Configurar variables en GitHub Actions
- [ ] Validar que CI use `.env.test`
- [ ] Agregar step de validación de entorno
- [ ] Documentar proceso en CONTRIBUTING.md

---

## 🔗 ARCHIVOS CLAVE ANALIZADOS

### Tests
- `tests/campaign-send.integration.test.js` (473 líneas)
- `tests/helpers/dbTestHelpers.js` (212 líneas)
- `tests/stubs/sessionManagerStub.js` (159 líneas)

### Módulos de Negocio
- `src/modules/sender/db/connection.js` (20 líneas)
- `src/modules/sender/services/programacionScheduler.js` (434 líneas)
- `src/modules/sender/services/estadoService.js` (119 líneas)
- `src/modules/sender/controllers/destinatariosController.js` (412 líneas)
- `src/modules/sender/controllers/manualController.js`

### Configuración
- `jest.config.js`
- `jest.setup.js`
- `.env`

---

## 📊 ESTADÍSTICAS DE RIESGO

| Operación | Frecuencia | Impacto | Riesgo |
|-----------|-----------|---------|--------|
| DELETE de cleanup | 2x por test (antes + después) | ALTO | 🔴 CRÍTICO |
| INSERT de setup | 1-10x por test | MEDIO | 🟡 ALTO |
| UPDATE de estado | Variable (según test) | MEDIO | 🟡 ALTO |
| SELECT FOR UPDATE | Variable | BAJO | 🟢 BAJO |
| INSERT historial | Variable | BAJO | 🟢 BAJO |

**Tests actuales**: 6 tests en `campaign-send.integration.test.js`  
**Operaciones totales estimadas por suite completa**: ~100-150 queries SQL reales

---

## 🚨 ACCIÓN INMEDIATA REQUERIDA

### Antes de ejecutar ANY test:

1. **Validar variables de entorno**:
   ```bash
   echo "DB_NAME: $DB_NAME"
   # Debe ser: iunaorg_dyd_test (NO iunaorg_dyd)
   ```

2. **Crear backup de producción** (por seguridad):
   ```bash
   mysqldump -h sv46.byethost46.org -u iunaorg_b3toh -p iunaorg_dyd > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

3. **Implementar validación mínima**:
   ```javascript
   // Al inicio de dbTestHelpers.js
   if (process.env.DB_NAME === 'iunaorg_dyd') {
     throw new Error('ABORTAR: No ejecutar tests contra producción');
   }
   ```

4. **NO ejecutar** `npm test` hasta completar Fase 1 del checklist.

---

## 📞 CONTACTO Y SOPORTE

Este informe técnico identifica un **riesgo de seguridad crítico** en la suite de integration tests.

**Prioridad**: 🔴 CRÍTICA  
**Acción requerida**: INMEDIATA  
**Impacto potencial**: Pérdida de datos productivos, corrupción de estadísticas, envíos no autorizados

Para implementación urgente, seguir el checklist en orden de prioridad.

---

**Generado por**: Análisis técnico automatizado  
**Fecha**: 14 de febrero de 2026  
**Versión**: 1.0
