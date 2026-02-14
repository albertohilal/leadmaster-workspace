# 🔍 ANÁLISIS: SCHEMA DE BASE DE DATOS PARA INTEGRATION TESTS
## Requisitos de Tablas para CI/CD

**Fecha**: 14 de febrero de 2026  
**Contexto**: Configuración de GitHub Actions para integration tests  
**Criticidad**: 🟡 MEDIA - Bloquea ejecución de tests en CI  

---

## 📋 PREGUNTA CRÍTICA

### ¿Los integration tests crean las tablas automáticamente?

**RESPUESTA: ❌ NO**

Los tests **NO crean tablas**. Solo ejecutan operaciones `INSERT`, `UPDATE`, `DELETE` contra tablas que **deben existir previamente**.

---

## 🔎 EVIDENCIA DEL CÓDIGO

### Archivo: `tests/helpers/dbTestHelpers.js`

```javascript
/**
 * Limpia todas las tablas relacionadas con campañas de test
 * ORDEN CRÍTICO: Eliminar primero hijos, luego padres (foreign keys)
 */
async function cleanupTestData() {
  // 1. Tabla de contadores diarios (sin FK pero asociada)
  await connection.query('DELETE FROM ll_programacion_envios_diarios WHERE programacion_id >= 9000');
  
  // 2. Envíos (FK a campañas)
  await connection.query('DELETE FROM ll_envios_whatsapp WHERE campania_id >= 9000');
  
  // 3. Programaciones (FK a campañas)
  await connection.query('DELETE FROM ll_programaciones WHERE id >= 9000');
  
  // 4. Campañas (tabla padre)
  await connection.query('DELETE FROM ll_campanias_whatsapp WHERE id >= 9000');
}
```

**Operaciones ejecutadas**:
- ✅ `DELETE FROM ...` (asume que la tabla existe)
- ✅ `INSERT INTO ...` (asume que la tabla existe)
- ✅ `UPDATE ...` (asume que la tabla existe)
- ❌ **NUNCA ejecuta `CREATE TABLE`**

### Archivo: `tests/campaign-send.integration.test.js`

```javascript
describe('Campaign Send Integration Tests', () => {
  
  beforeAll(async () => {
    // Verificar conexión a DB
    await connection.query('SELECT 1');  // ← Solo verifica conexión
  });

  beforeEach(async () => {
    // Limpiar datos de test anteriores ANTES de cada test
    await dbHelpers.cleanupTestData();  // ← DELETE, no CREATE
    
    // Reset del stub para estado limpio
    sessionManagerStub.reset();
    sessionManagerStub.setStatusResponse({ status: 'READY', connected: true });
  });

  // Tests...
  test('debe marcar registros como enviados...', async () => {
    await dbHelpers.createTestCampaign({...});      // ← INSERT
    await dbHelpers.createTestProgramacion({...});  // ← INSERT
    await dbHelpers.createTestEnvios({...});        // ← INSERT
    
    // ... validaciones
  });
});
```

**Comportamiento en `beforeAll()`**:
- Solo ejecuta `SELECT 1` para verificar conectividad
- **NO verifica si las tablas existen**
- **NO crea las tablas si no existen**

**Resultado**: Si las tablas no existen → **Los tests FALLAN inmediatamente**

---

## 📊 TABLAS REQUERIDAS POR LOS TESTS

### Tablas Principales (5)

| Tabla | Usada En | Operaciones |
|-------|----------|-------------|
| `ll_campanias_whatsapp` | Todos los tests | INSERT, DELETE, SELECT |
| `ll_programaciones` | Tests de scheduler | INSERT, DELETE, SELECT, UPDATE |
| `ll_envios_whatsapp` | Todos los tests | INSERT, DELETE, SELECT, UPDATE |
| `ll_programacion_envios_diarios` | Tests de cupo diario | INSERT, DELETE, SELECT, UPDATE |
| `ll_envios_whatsapp_historial` | estadoService.js | INSERT, SELECT |

### Esquema de Relaciones

```
ll_campanias_whatsapp (padre)
  ↓ FK campania_id
ll_programaciones
  ↓ FK programacion_id
ll_programacion_envios_diarios

ll_campanias_whatsapp (padre)
  ↓ FK campania_id
ll_envios_whatsapp
  ↓ FK envio_id
ll_envios_whatsapp_historial
```

---

## 🗂️ ESTADO DEL REPOSITORIO

### Archivos de Schema Existentes

#### ❌ NO existe `schema.sql` consolidado

**Búsqueda realizada**:
```bash
find . -name "schema.sql"
find . -name "*.sql"
```

**Resultado**: Solo existen 2 migrations específicas, NO el schema completo.

#### ✅ Migrations Existentes

**Ubicación**: `services/central-hub/migrations/`

1. **001_create_ll_whatsapp_qr_sessions.sql** (117 líneas)
   - Tabla para control de autorización de QR WhatsApp
   - NO usada por integration tests actuales

2. **002_create_ll_envios_manual.sql**
   - Tabla para registro de envíos manuales vía WhatsApp Web
   - NO usada por integration tests actuales

#### ⚠️ Definiciones Solo en Documentación

Las 5 tablas necesarias tienen sus definiciones **solo en archivos .md**:

**Ubicaciones**:
- `docs/CAMPAIGN_SCHEDULER_PROPOSAL.md` (líneas 29-123)
  - ✅ `CREATE TABLE ll_campanias_whatsapp`
  - ✅ `CREATE TABLE ll_programaciones`
  - ✅ `CREATE TABLE ll_envios_whatsapp`
  - ✅ `CREATE TABLE ll_programacion_envios_diarios`

- `docs/MAQUINA_DE_ESTADOS_ENVIO_WHATSAPP.md` (línea 168)
  - ✅ `CREATE TABLE ll_envios_whatsapp_historial`

**Problema**: Estos archivos son documentación, NO scripts ejecutables.

---

## 💡 SOLUCIONES DISPONIBLES

### Opción A: Base de Datos Remota (RECOMENDADA)

**Estado**: Ya tienes `iunaorg_dyd_test` creada en `sv46.byethost46.org`

#### Ventajas

✅ No requiere MySQL en GitHub Actions  
✅ Misma base de datos para desarrollo local y CI  
✅ Sin overhead de crear/destruir containers  
✅ Tests más rápidos (sin setup inicial)  

#### Requisitos

1. **Las tablas deben existir en la base de datos remota**

   Verificar con:
   ```bash
   mysql -h sv46.byethost46.org -u iunaorg_b3toh -p iunaorg_dyd_test
   ```
   ```sql
   SHOW TABLES;
   ```

   **Si retorna las 5 tablas** → Opción A funciona ✅  
   **Si está vacía** → Necesitas copiar tablas desde producción

2. **Workflow de GitHub Actions configurado**:

   ```yaml
   jobs:
     build:
       runs-on: ubuntu-latest
       
       env:
         NODE_ENV: test
         DB_HOST: sv46.byethost46.org  # ← Base remota
         DB_NAME: iunaorg_dyd_test
         DB_USER: iunaorg_b3toh
         DB_PASSWORD: ${{ secrets.TEST_DB_PASSWORD }}
         DB_PORT: 3306
         AUTO_CAMPAIGNS_ENABLED: false
         DRY_RUN: true

       steps:
         - name: Checkout repository
           uses: actions/checkout@v3

         - name: Setup Node.js
           uses: actions/setup-node@v3
           with:
             node-version: lts/*

         - name: Install dependencies
           run: npm ci || npm install
           working-directory: services/central-hub

         - name: Run tests
           run: npm test
           working-directory: services/central-hub
   ```

   **NO necesita step de `Load schema`** porque las tablas ya existen remotamente.

#### Cómo Copiar Tablas desde Producción

Si la base de datos `iunaorg_dyd_test` está vacía:

```bash
# 1. Exportar SOLO estructura (sin datos) desde producción
mysqldump -h sv46.byethost46.org -u iunaorg_b3toh -p \
  --no-data \
  --tables \
    ll_campanias_whatsapp \
    ll_programaciones \
    ll_envios_whatsapp \
    ll_programacion_envios_diarios \
    ll_envios_whatsapp_historial \
  iunaorg_dyd > /tmp/test-schema.sql

# 2. Importar en base de datos de testing
mysql -h sv46.byethost46.org -u iunaorg_b3toh -p iunaorg_dyd_test < /tmp/test-schema.sql

# 3. Verificar
mysql -h sv46.byethost46.org -u iunaorg_b3toh -p iunaorg_dyd_test -e "SHOW TABLES;"
```

---

### Opción B: MySQL Local en GitHub Actions

**Usar cuando**: No puedes/quieres conectar a base de datos remota desde CI.

#### Ventajas

✅ Tests aislados de infraestructura externa  
✅ No depende de conectividad a servidor remoto  
✅ Completa reproducibilidad del entorno  

#### Desventajas

❌ Requiere crear `schema.sql` consolidado  
❌ Overhead de iniciar MySQL container  
❌ Tests más lentos (setup inicial ~30s)  

#### Implementación

##### 1. Crear `schema.sql` consolidado

```bash
# Exportar SOLO estructura desde producción
mysqldump -h sv46.byethost46.org -u iunaorg_b3toh -p \
  --no-data \
  --skip-add-drop-table \
  --tables \
    ll_campanias_whatsapp \
    ll_programaciones \
    ll_envios_whatsapp \
    ll_programacion_envios_diarios \
    ll_envios_whatsapp_historial \
  iunaorg_dyd > services/central-hub/migrations/schema-test.sql

# Editar archivo y agregar CREATE TABLE IF NOT EXISTS
sed -i 's/CREATE TABLE/CREATE TABLE IF NOT EXISTS/g' services/central-hub/migrations/schema-test.sql
```

##### 2. Modificar Workflow

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    
    # ⭐ Agregar servicio MySQL
    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: root
          MYSQL_DATABASE: iunaorg_dyd_test
        ports:
          - 3306:3306
        options: >-
          --health-cmd="mysqladmin ping"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=3

    env:
      NODE_ENV: test
      DB_HOST: 127.0.0.1  # ← MySQL local
      DB_NAME: iunaorg_dyd_test
      DB_USER: root
      DB_PASSWORD: root
      DB_PORT: 3306
      AUTO_CAMPAIGNS_ENABLED: false
      DRY_RUN: true

    steps:
      - name: Checkout repository
        uses: actions/checkout@v3

      # ⭐ Agregar step de carga de schema
      - name: Load database schema
        run: |
          mysql -h 127.0.0.1 -uroot -proot iunaorg_dyd_test < services/central-hub/migrations/schema-test.sql

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: lts/*

      - name: Install dependencies
        run: npm ci || npm install
        working-directory: services/central-hub

      - name: Run tests
        run: npm test
        working-directory: services/central-hub
```

---

## 📊 COMPARATIVA DE OPCIONES

| Criterio | Opción A (Remota) | Opción B (Local) |
|----------|-------------------|------------------|
| **Setup inicial** | Copiar tablas 1 vez | Crear schema.sql + modificar workflow |
| **Tiempo de test** | ~2-3 min | ~3-4 min (+ 30s MySQL startup) |
| **Mantenimiento** | Mínimo | Medio (sincronizar schema) |
| **Dependencias** | Base remota accesible | Solo GitHub Actions |
| **Reproducibilidad** | Media | Alta |
| **Complejidad** | Baja | Media |

---

## 🎯 RECOMENDACIÓN FINAL

### Para tu proyecto: **OPCIÓN A (Base Remota)**

#### Razones:

1. ✅ Ya tienes la base de datos `iunaorg_dyd_test` creada
2. ✅ Ifastnet permite conexiones externas
3. ✅ Menos cambios en el workflow
4. ✅ Más rápido de implementar
5. ✅ No requiere crear schema.sql

#### Acción Requerida:

1. **Verificar si las tablas existen**:
   ```bash
   mysql -h sv46.byethost46.org -u iunaorg_b3toh -p iunaorg_dyd_test -e "SHOW TABLES;"
   ```

2. **Si NO existen** (resultado esperado: `Empty set`):
   - Copiarlas desde producción (script en Opción A)

3. **Si SÍ existen**:
   - Solo configurar variables de entorno en el workflow
   - Tests funcionarán inmediatamente ✅

---

## 📋 CHECKLIST DE IMPLEMENTACIÓN

### Fase 1: Verificar Estado de Base de Datos ⏱️ 2 min

- [ ] Conectar a `iunaorg_dyd_test`
- [ ] Ejecutar `SHOW TABLES;`
- [ ] Verificar existencia de 5 tablas necesarias
- [ ] Si faltan → Ir a Fase 2
- [ ] Si existen → Ir a Fase 3

### Fase 2: Copiar Tablas (Solo si están vacías) ⏱️ 10 min

- [ ] Exportar estructura desde producción (`mysqldump`)
- [ ] Revisar archivo generado
- [ ] Importar en `iunaorg_dyd_test`
- [ ] Verificar con `SHOW TABLES;`
- [ ] Verificar estructura de cada tabla

### Fase 3: Configurar Workflow ⏱️ 5 min

- [ ] Editar `.github/workflows/central-hub-ci.yml`
- [ ] Agregar bloque `env:` con variables
- [ ] Crear GitHub Secret `TEST_DB_PASSWORD`
- [ ] Commit y push
- [ ] Verificar ejecución en GitHub Actions

**Tiempo total estimado**: 15-20 minutos

---

## 🚀 COMANDOS DE VERIFICACIÓN

### Verificar Tablas en Base Remota

```bash
# Conectar
mysql -h sv46.byethost46.org -u iunaorg_b3toh -p

# Usar base de testing
USE iunaorg_dyd_test;

# Ver tablas
SHOW TABLES;

# Ver estructura de tabla específica
DESCRIBE ll_campanias_whatsapp;
DESCRIBE ll_programaciones;
DESCRIBE ll_envios_whatsapp;
DESCRIBE ll_programacion_envios_diarios;
DESCRIBE ll_envios_whatsapp_historial;

# Salir
EXIT;
```

### Copiar Tablas (Si están vacías)

```bash
# Exportar estructura desde producción
mysqldump -h sv46.byethost46.org \
  -u iunaorg_b3toh \
  -p \
  --no-data \
  --skip-add-drop-table \
  --tables \
    ll_campanias_whatsapp \
    ll_programaciones \
    ll_envios_whatsapp \
    ll_programacion_envios_diarios \
    ll_envios_whatsapp_historial \
  iunaorg_dyd > /tmp/test-schema.sql

# Revisar archivo
cat /tmp/test-schema.sql | head -50

# Importar a base de testing
mysql -h sv46.byethost46.org \
  -u iunaorg_b3toh \
  -p \
  iunaorg_dyd_test < /tmp/test-schema.sql

# Verificar importación
mysql -h sv46.byethost46.org \
  -u iunaorg_b3toh \
  -p \
  iunaorg_dyd_test \
  -e "SHOW TABLES;"
```

---

## ⚠️ CONSIDERACIONES DE SEGURIDAD

### Base de Datos Remota

#### ✅ Seguro

- Tests solo usan IDs >= 9000 (aislamiento por convención)
- Cleanup automático en `beforeEach()` y `afterEach()`
- No hay riesgo de colisión con datos reales (si se respeta el rango)

#### ⚠️ Riesgos Potenciales

1. **Si alguien usa IDs >= 9000 en producción**
   - Los tests los ELIMINARÍAN en la base de test
   - Solución: Documentar claramente el rango reservado

2. **Conectividad de GitHub Actions**
   - Si Ifastnet bloquea IPs de GitHub → tests fallarían
   - Solución: Probar primero o usar Opción B como fallback

3. **Rate limiting de Ifastnet**
   - Múltiples ejecuciones de tests podrían ser bloqueadas
   - Solución: Review de logs, posible throttling

### Base de Datos Local (Opción B)

#### ✅ Más Seguro

- Completamente aislado de producción
- Sin riesgo de acceso no autorizado
- Reproducible en cualquier entorno

---

## 📖 REFERENCIAS

### Archivos Analizados

- `tests/helpers/dbTestHelpers.js` - Funciones de setup/teardown
- `tests/campaign-send.integration.test.js` - Integration tests principales
- `docs/CAMPAIGN_SCHEDULER_PROPOSAL.md` - Definiciones de tablas
- `docs/MAQUINA_DE_ESTADOS_ENVIO_WHATSAPP.md` - Schema de historial
- `migrations/001_create_ll_whatsapp_qr_sessions.sql` - Ejemplo de migration
- `migrations/002_create_ll_envios_manual.sql` - Ejemplo de migration

### Documentación Relacionada

- [AUDITORIA_CI_TESTING.md](AUDITORIA_CI_TESTING.md) - Auditoría de configuración CI
- [INFORME_IMPLEMENTACION_BLINDAJE_ENTORNO.md](INFORME_IMPLEMENTACION_BLINDAJE_ENTORNO.md) - Sistema de protección
- [INFORME_RIESGO_INTEGRATION_TESTS.md](INFORME_RIESGO_INTEGRATION_TESTS.md) - Análisis de riesgos

---

## 🎯 CONCLUSIONES

### Hallazgos Principales

1. ✅ **Tests NO crean tablas** - Solo ejecutan operaciones CRUD
2. ✅ **Requieren 5 tablas preexistentes** - Deben estar en la base de datos antes de ejecutar
3. ⚠️ **NO existe schema.sql consolidado** - Solo definiciones en documentación
4. ✅ **Base remota disponible** - `iunaorg_dyd_test` ya creada

### Acción Inmediata Requerida

🟡 **MEDIA PRIORIDAD** - Sin estas tablas, los tests en CI fallarán

**Próximo paso crítico**: Verificar si las tablas existen en `iunaorg_dyd_test`

```bash
mysql -h sv46.byethost46.org -u iunaorg_b3toh -p iunaorg_dyd_test -e "SHOW TABLES;"
```

**Resultado esperado**: 
- Si retorna 5 tablas → Configurar workflow (Fase 3)
- Si está vacío → Copiar tablas (Fase 2) + Configurar workflow (Fase 3)

### Estimación de Tiempo

- ✅ **Si tablas existen**: 5 minutos (solo configurar workflow)
- ⚠️ **Si tablas NO existen**: 15-20 minutos (copiar + configurar)

---

**Analizado por**: Sistema de análisis de código  
**Fecha**: 14 de febrero de 2026  
**Versión**: 1.0  
**Estado**: ⏳ PENDIENTE VERIFICACIÓN DE TABLAS
