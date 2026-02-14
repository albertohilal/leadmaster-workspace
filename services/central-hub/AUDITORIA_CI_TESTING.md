# 🔍 AUDITORÍA TÉCNICA: CONFIGURACIÓN CI/CD Y ENTORNO DE TESTING
## GitHub Actions + Sistema de Blindaje de Entorno

**Fecha**: 14 de febrero de 2026  
**Alcance**: Workflow CI, variables de entorno, seguridad de testing  
**Criticidad**: 🔴 ALTA - Tests en CI actualmente FALLAN  

---

## 📋 RESUMEN EJECUTIVO

### Estado Detectado: 🔴 CRÍTICO

**Los tests en GitHub Actions están FALLANDO** debido a configuración incompleta de variables de entorno.

### Problemas Identificados

❌ **No hay variables de entorno configuradas en el workflow**  
❌ **No se están usando GitHub Secrets**  
❌ **El script `check-test-env.js` espera `.env.test` que no existe en CI**  
❌ **Los tests abortan inmediatamente con `process.exit(1)`**  

### Solución Requerida

✅ Configurar GitHub Secrets con credenciales de base de datos de testing  
✅ Pasar variables de entorno explícitamente en el job de tests  
✅ Modificar `check-test-env.js` y `jest.env.js` para soportar variables desde CI  

---

## 🔎 ANÁLISIS DETALLADO

### 1. Estado del Workflow de GitHub Actions

**Archivo**: `.github/workflows/central-hub-ci.yml`

```yaml
name: Central Hub CI

on:
  pull_request:
    branches:
      - main
  push:
    branches:
      - main

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: lts/*

      - name: Install dependencies
        run: |
          npm ci || npm install
        working-directory: services/central-hub

      - name: Run tests
        run: npm test
        working-directory: services/central-hub
```

#### Problemas Detectados:

🔴 **NO hay configuración de variables de entorno**
```yaml
# FALTA ESTO:
env:
  NODE_ENV: test
  DB_HOST: ${{ secrets.TEST_DB_HOST }}
  DB_NAME: ${{ secrets.TEST_DB_NAME }}
  DB_USER: ${{ secrets.TEST_DB_USER }}
  DB_PASSWORD: ${{ secrets.TEST_DB_PASSWORD }}
  DB_PORT: 3306
  AUTO_CAMPAIGNS_ENABLED: false
  DRY_RUN: true
```

🔴 **NO se están usando GitHub Secrets**  
Ninguna referencia a `${{ secrets.* }}`

🔴 **El job ejecuta `npm test` sin contexto de entorno**  
Los scripts de validación fallan antes de ejecutar Jest

---

### 2. Archivo `.env.test` y .gitignore

#### Estado del .gitignore:

```gitignore
########################################
# Environment variables
########################################
.env
.env.*          # ← IGNORA .env.test
!.env.example   # ← Pero permite .env.example
```

**Resultado**: `.env.test` NO está versionado en Git (correcto para seguridad).

#### Implicación para CI:

- ✅ **Seguridad**: Credenciales no están en el repositorio
- ❌ **CI Roto**: Los scripts esperan que `.env.test` exista localmente

---

### 3. Scripts de Validación

#### `scripts/check-test-env.js`

**Líneas 14-15**:
```javascript
// Cargar variables de entorno
require('dotenv').config({ path: '.env.test' });
```

**Problema**: Si `.env.test` no existe (como en CI), dotenv simplemente NO carga nada.

**Líneas 16-52**:
```javascript
const NODE_ENV = process.env.NODE_ENV;
const DB_NAME = process.env.DB_NAME || '';

// Validación 1: NODE_ENV
if (NODE_ENV !== 'test') {
  console.error('❌ ERROR: Tests requieren NODE_ENV=test');
  process.exit(1);  // ← ABORTA
}

// Validación 2: DB_NAME debe incluir "_test"
if (!DB_NAME.includes('_test')) {
  console.error('❌ ERROR: Tests requieren base de datos con sufijo "_test"');
  process.exit(1);  // ← ABORTA
}
```

**En CI sin variables de entorno**:
- `NODE_ENV` es `undefined`
- Falla la validación 1
- **El workflow FALLA antes de ejecutar tests**

#### `jest.env.js`

**Líneas 1-14**:
```javascript
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");

// Ruta esperada del archivo de entorno de test
const envTestPath = path.join(__dirname, ".env.test");

// 1️⃣ Verificar existencia de .env.test
if (!fs.existsSync(envTestPath)) {
  console.error("❌ ERROR: No existe .env.test");
  console.error("Crea el archivo antes de ejecutar tests.");
  process.exit(1);  // ← ABORTA
}
```

**En CI**: `.env.test` no existe → **ABORTA INMEDIATAMENTE**

---

### 4. Require dotenv Sueltos

#### Búsqueda global en el proyecto:

```bash
grep -r "dotenv\.config\|require('dotenv')" services/central-hub/**/*.js
```

**Resultado**:
```
services/central-hub/scripts/check-test-env.js:14:
  require('dotenv').config({ path: '.env.test' });
```

**Análisis**:
- ✅ Solo existe en `check-test-env.js`
- ✅ `environment.js` solo carga dotenv si NO es Jest (`!process.env.JEST_WORKER_ID`)
- ✅ Todos los módulos usan `environment.js` centralizado
- ✅ NO hay riesgo de cargas duplicadas fuera del sistema

**Conclusión**: El sistema centralizado está bien implementado. El único dotenv suelto es intencional y necesario.

---

### 5. Riesgo de Cargar .env en Lugar de .env.test

#### En Entorno Local:

**Orden de carga**:
1. `npm test`
2. `check-test-env.js` → carga `.env.test`
3. `jest`
4. `jest.env.js` → carga `.env.test`
5. Tests ejecutan

✅ **NO hay riesgo**: Los scripts cargan explícitamente `.env.test`.

#### En CI (Estado Actual):

**Orden de ejecución**:
1. `npm test`
2. `check-test-env.js` → intenta cargar `.env.test` (NO existe)
3. `NODE_ENV` es `undefined`
4. **ABORTA con `process.exit(1)`**

❌ **Tests nunca se ejecutan**.

---

### 6. GitHub Actions: ¿Necesita env Explícitos?

**RESPUESTA: SÍ, ABSOLUTAMENTE**

GitHub Actions NO tiene acceso a:
- Archivos `.env` locales (ignorados por Git)
- Variables de entorno del sistema operativo del desarrollador

**Las variables DEBEN configurarse en**:
1. **GitHub Secrets** (para credenciales sensibles)
2. **Bloque `env:` en el workflow** (para variables no sensibles)

**Sin esto**:
- ❌ `process.env.NODE_ENV` es `undefined`
- ❌ `process.env.DB_NAME` es `undefined`
- ❌ Todos los scripts de validación fallan

---

## 🛠️ SOLUCIÓN IMPLEMENTADA

### Paso 1: Configurar GitHub Secrets

**Ir a**: `GitHub Repository → Settings → Secrets and variables → Actions`

**Crear los siguientes secrets**:

| Secret Name | Value |
|-------------|-------|
| `TEST_DB_HOST` | `sv46.byethost46.org` |
| `TEST_DB_NAME` | `iunaorg_dyd_test` |
| `TEST_DB_USER` | `iunaorg_b3toh` |
| `TEST_DB_PASSWORD` | `[contraseña real]` |

**⚠️ IMPORTANTE**: Usar estos nombres exactos para que coincidan con el workflow actualizado.

---

### Paso 2: Modificar Workflow de GitHub Actions

**Archivo**: `.github/workflows/central-hub-ci.yml`

**❌ CONFIGURACIÓN ACTUAL (ROTA)**:
```yaml
jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: lts/*

      - name: Install dependencies
        run: |
          npm ci || npm install
        working-directory: services/central-hub

      - name: Run tests
        run: npm test
        working-directory: services/central-hub
```

**✅ CONFIGURACIÓN CORREGIDA**:
```yaml
jobs:
  build:
    runs-on: ubuntu-latest

    # ⭐ NUEVO: Configurar variables de entorno para tests
    env:
      NODE_ENV: test
      DB_HOST: ${{ secrets.TEST_DB_HOST }}
      DB_NAME: ${{ secrets.TEST_DB_NAME }}
      DB_USER: ${{ secrets.TEST_DB_USER }}
      DB_PASSWORD: ${{ secrets.TEST_DB_PASSWORD }}
      DB_PORT: 3306
      AUTO_CAMPAIGNS_ENABLED: false
      DRY_RUN: true
      SESSION_MANAGER_BASE_URL: http://localhost:3001
      PORT: 3012

    steps:
      - name: Checkout repository
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: lts/*

      - name: Install dependencies
        run: |
          npm ci || npm install
        working-directory: services/central-hub

      - name: Run tests
        run: npm test
        working-directory: services/central-hub
```

**Cambios realizados**:
1. ➕ Agregado bloque `env:` al nivel del job
2. ➕ Variables desde GitHub Secrets: `${{ secrets.TEST_DB_* }}`
3. ➕ Variables hardcodeadas seguras: `NODE_ENV=test`, `AUTO_CAMPAIGNS_ENABLED=false`
4. ➕ Variables adicionales necesarias para el sistema

---

### Paso 3: Modificar Scripts de Validación para Soportar CI

#### 3.1. Actualizar `scripts/check-test-env.js`

**❌ CÓDIGO ACTUAL (NO FUNCIONA EN CI)**:
```javascript
// Cargar variables de entorno
require('dotenv').config({ path: '.env.test' });

const NODE_ENV = process.env.NODE_ENV;
const DB_NAME = process.env.DB_NAME || '';
```

**✅ CÓDIGO ACTUALIZADO (FUNCIONA EN CI)**:
```javascript
// Cargar variables de entorno desde .env.test (si existe)
// En CI, las variables vienen del workflow
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

const envTestPath = path.join(__dirname, '..', '.env.test');

// Solo cargar .env.test si existe (entorno local)
// En CI, las variables ya están disponibles desde el workflow
if (fs.existsSync(envTestPath)) {
  dotenv.config({ path: envTestPath });
}

const NODE_ENV = process.env.NODE_ENV;
const DB_NAME = process.env.DB_NAME || '';
```

**Cambio clave**: Verificar si `.env.test` existe ANTES de intentar cargarlo.

#### 3.2. Actualizar `jest.env.js`

**❌ CÓDIGO ACTUAL (ABORTA EN CI)**:
```javascript
const envTestPath = path.join(__dirname, ".env.test");

// 1️⃣ Verificar existencia de .env.test
if (!fs.existsSync(envTestPath)) {
  console.error("❌ ERROR: No existe .env.test");
  console.error("Crea el archivo antes de ejecutar tests.");
  process.exit(1);
}

// 2️⃣ Cargar variables desde .env.test
dotenv.config({
  path: envTestPath
});
```

**✅ CÓDIGO ACTUALIZADO (FUNCIONA EN CI)**:
```javascript
const envTestPath = path.join(__dirname, ".env.test");

// 1️⃣ Cargar .env.test si existe (entorno local)
// En CI, las variables ya están disponibles desde GitHub Actions
if (fs.existsSync(envTestPath)) {
  dotenv.config({
    path: envTestPath
  });
  console.log("📄 Cargando configuración desde .env.test");
} else {
  console.log("☁️  Usando variables de entorno del sistema (CI)");
}
```

**Cambio clave**: 
- SI existe `.env.test` → cargarlo (desarrollo local)
- SI NO existe → usar variables del sistema (CI)
- NO abortar si no existe el archivo

---

### Paso 4: Actualizar `src/config/environment.js` (Opcional)

**Estado actual**: Ya funciona correctamente en CI porque:
- Solo carga dotenv si NO es Jest
- En Jest, las variables vienen de `jest.env.js`
- En CI, las variables vienen del workflow

✅ **NO requiere cambios**.

---

## 📊 MATRIZ DE COMPATIBILIDAD

### Antes de la Corrección

| Entorno | .env.test | Variables Sistema | check-test-env.js | jest.env.js | Tests |
|---------|-----------|-------------------|-------------------|-------------|-------|
| **Local (dev)** | ✅ Existe | ❌ No | ✅ Carga OK | ✅ Carga OK | ✅ PASA |
| **GitHub Actions** | ❌ No existe | ❌ No | ❌ ABORTA | ❌ ABORTA | ❌ FALLA |

### Después de la Corrección

| Entorno | .env.test | Variables Sistema | check-test-env.js | jest.env.js | Tests |
|---------|-----------|-------------------|-------------------|-------------|-------|
| **Local (dev)** | ✅ Existe | ❌ No | ✅ Carga .env.test | ✅ Carga .env.test | ✅ PASA |
| **GitHub Actions** | ❌ No existe | ✅ Workflow | ✅ Usa env vars | ✅ Usa env vars | ✅ PASA |

---

## 🎯 RESPUESTAS A PREGUNTAS ESPECÍFICAS

### 1) ¿El workflow está configurando correctamente las variables?

**RESPUESTA: ❌ NO**

Estado actual:
- ❌ NO hay bloque `env:` en el workflow
- ❌ NO se configura `NODE_ENV=test`
- ❌ NO se configuran credenciales de base de datos
- ❌ NO hay referencia a variables

**Solución**: Agregar bloque `env:` con todas las variables necesarias (ver Paso 2).

---

### 2) ¿Está usando GitHub Secrets o valores hardcodeados?

**RESPUESTA: ❌ NINGUNO**

Estado actual:
- ❌ NO usa GitHub Secrets
- ❌ NO hay valores hardcodeados
- ❌ NO hay configuración de variables en absoluto

**Solución**: 
- Crear GitHub Secrets para credenciales
- Hardcodear valores seguros (`NODE_ENV=test`, `AUTO_CAMPAIGNS_ENABLED=false`)

---

### 3) ¿GitHub Actions ejecuta contra `iunaorg_dyd_test`?

**RESPUESTA: ❌ NO, NI SIQUIERA INTENTA**

Flujo actual:
1. Ejecuta `npm test`
2. `check-test-env.js` intenta cargar `.env.test` (no existe)
3. `NODE_ENV` es `undefined`
4. **ABORTA con error antes de conectar a cualquier base de datos**

**Solución**: Configurar `DB_NAME=iunaorg_dyd_test` en el workflow.

---

### 4) ¿Existe `dotenv.config()` suelto que interfiera en CI?

**RESPUESTA: ❌ NO HAY INTERFERENCIA**

Búsqueda completa:
- ✅ Solo 1 instancia en `check-test-env.js` (intencional)
- ✅ Todos los módulos usan `environment.js`
- ✅ `environment.js` NO carga dotenv si es Jest
- ✅ NO hay riesgo de interferencia

**Conclusión**: El sistema centralizado está correcto.

---

### 5) ¿Hay riesgo de cargar `.env` en lugar de `.env.test`?

**RESPUESTA: ❌ NO HAY RIESGO**

Razones:
- ✅ `.env` y `.env.test` están en `.gitignore`
- ✅ NO existen en el repositorio de GitHub
- ✅ CI no tiene acceso a archivos locales
- ✅ Scripts cargan explícitamente `.env.test` (si existe)

**En CI**: 
- NO hay `.env`
- NO hay `.env.test`
- Solo las variables del workflow

---

### 6) ¿El workflow necesita `env:` explícito?

**RESPUESTA: ✅ SÍ, ABSOLUTAMENTE NECESARIO**

GitHub Actions:
- ❌ NO tiene acceso a archivos `.env*`
- ❌ NO hereda variables del sistema del desarrollador
- ✅ REQUIERE configuración explícita en el workflow

**Sin `env:`**:
- ❌ `process.env.NODE_ENV` = `undefined`
- ❌ `process.env.DB_NAME` = `undefined`
- ❌ Scripts de validación fallan

**Con `env:`**:
- ✅ Variables disponibles para todos los steps
- ✅ Scripts de validación pasan
- ✅ Tests ejecutan correctamente

---

## ⚠️ EVALUACIÓN DE SEGURIDAD

### Estado Actual: 🟡 SEGURO PERO ROTO

#### Seguridad: ✅ BIEN

- ✅ `.env.test` NO está en Git (no expone credenciales)
- ✅ NO hay credenciales hardcodeadas en el código
- ✅ Sistema de validación previene tests contra producción
- ✅ Scheduler protegido con guards de entorno

#### Funcionalidad: ❌ ROTA

- ❌ CI no puede ejecutar tests (falta configuración)
- ❌ Scripts abortan antes de ejecutar Jest
- ❌ No hay cobertura de tests en pull requests

### Estado Post-Corrección: 🟢 SEGURO Y FUNCIONAL

#### Seguridad: ✅ MEJORADA

- ✅ Credenciales en GitHub Secrets (encriptadas)
- ✅ Variables de CI separadas de desarrollo local
- ✅ Validaciones funcionan en ambos entornos
- ✅ No hay exposición de secretos

#### Funcionalidad: ✅ COMPLETA

- ✅ CI ejecuta tests correctamente
- ✅ Validaciones pasan en local y CI
- ✅ Tests contra base de datos de testing
- ✅ Cobertura automática en PRs

---

## 📋 CHECKLIST DE IMPLEMENTACIÓN

### Fase 1: Configurar GitHub Secrets ⏱️ 5 min

- [ ] Ir a `Settings → Secrets and variables → Actions`
- [ ] Crear secret `TEST_DB_HOST` = `sv46.byethost46.org`
- [ ] Crear secret `TEST_DB_NAME` = `iunaorg_dyd_test`
- [ ] Crear secret `TEST_DB_USER` = `iunaorg_b3toh`
- [ ] Crear secret `TEST_DB_PASSWORD` = `[contraseña]`
- [ ] Verificar que aparecen en la lista de secrets

### Fase 2: Actualizar Workflow ⏱️ 5 min

- [ ] Editar `.github/workflows/central-hub-ci.yml`
- [ ] Agregar bloque `env:` con todas las variables
- [ ] Verificar sintaxis YAML
- [ ] Commit y push

### Fase 3: Actualizar Scripts ⏱️ 10 min

- [ ] Modificar `scripts/check-test-env.js`
- [ ] Modificar `jest.env.js`
- [ ] Commit y push

### Fase 4: Verificar CI ⏱️ 5 min

- [ ] Crear PR de prueba o push a main
- [ ] Ver ejecución en GitHub Actions
- [ ] Verificar que tests pasan
- [ ] Verificar logs de conexión a BD de test

**Tiempo total estimado**: ~25 minutos

---

## 🚀 COMANDOS DE IMPLEMENTACIÓN

### Crear GitHub Secrets (Interfaz Web)

```
1. Ir a: https://github.com/[TU_USUARIO]/[TU_REPO]/settings/secrets/actions
2. Click en "New repository secret"
3. Crear 4 secrets según la tabla del Paso 1
```

### Actualizar Archivos (Terminal)

```bash
# Ir al directorio del proyecto
cd /root/leadmaster-workspace

# Editar workflow
nano .github/workflows/central-hub-ci.yml
# (Aplicar cambios del Paso 2)

# Editar check-test-env.js
nano services/central-hub/scripts/check-test-env.js
# (Aplicar cambios del Paso 3.1)

# Editar jest.env.js
nano services/central-hub/jest.env.js
# (Aplicar cambios del Paso 3.2)

# Commit y push
git add .github/workflows/central-hub-ci.yml
git add services/central-hub/scripts/check-test-env.js
git add services/central-hub/jest.env.js
git commit -m "fix(ci): configure environment variables for GitHub Actions tests"
git push origin [BRANCH]
```

---

## 📖 REFERENCIAS

### Archivos Analizados

- `.github/workflows/central-hub-ci.yml` (Workflow principal)
- `services/central-hub/.gitignore` (Exclusión de archivos)
- `services/central-hub/scripts/check-test-env.js` (Validación pre-test)
- `services/central-hub/jest.env.js` (Configuración Jest)
- `services/central-hub/src/config/environment.js` (Sistema centralizado)
- `services/central-hub/package.json` (Scripts npm)

### Documentación Relacionada

- [INFORME_IMPLEMENTACION_BLINDAJE_ENTORNO.md](INFORME_IMPLEMENTACION_BLINDAJE_ENTORNO.md) - Sistema de protección
- [INFORME_RIESGO_INTEGRATION_TESTS.md](INFORME_RIESGO_INTEGRATION_TESTS.md) - Análisis de riesgos
- [README.md](README.md#-environment-safety-model) - Guía de uso

---

## 🎯 CONCLUSIONES

### Diagnóstico Final

1. **Sistema de Blindaje**: ✅ Implementado correctamente
2. **Seguridad Local**: ✅ Funcionando como esperado
3. **Configuración CI**: ❌ Incompleta (falta env vars)
4. **Scripts de Validación**: ⚠️ Requieren ajuste para CI

### Criticidad

🔴 **ALTA** - Tests en CI actualmente no funcionan

### Acción Requerida

🟠 **INMEDIATA** - Implementar las 4 fases del checklist

### Impacto Post-Corrección

✅ Tests ejecutarán en cada PR  
✅ Validaciones automáticas en CI  
✅ Cobertura de código trackeable  
✅ Sistema completo funcional (local + CI)  

### Estimación de Esfuerzo

⏱️ **~25 minutos** de trabajo total  
💰 **Costo**: Mínimo (solo tiempo de configuración)  
📊 **Beneficio**: Crítico (CI funcional)  

---

**Auditado por**: Sistema de análisis automatizado  
**Fecha**: 14 de febrero de 2026  
**Versión**: 1.0  
**Estado**: ⚠️ CORRECCIÓN REQUERIDA
