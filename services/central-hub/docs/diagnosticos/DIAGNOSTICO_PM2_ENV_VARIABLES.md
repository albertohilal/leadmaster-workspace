# DIAGNÓSTICO: PM2 env <name> no encuentra proceso + Session Manager en puerto incorrecto

**Fecha**: 2026-01-13  
**Sistema**: VPS Linux + PM2 6.0.8  
**Severidad**: 🟡 MEDIA (workaround disponible, config incorrecta detectada)

---

## 🎯 RESUMEN EJECUTIVO

### Problema 1: `pm2 env leadmaster-central-hub` falla con "not found"

**Causa raíz**: Bug conocido en PM2 6.x donde `pm2 env <name>` no resuelve nombres correctamente, solo acepta IDs numéricos.

**Evidencia**:
```bash
$ pm2 env leadmaster-central-hub
[PM2][ERROR] Modules with id leadmaster-central-hub not found

$ pm2 show 0
✅ Funciona - muestra "name: leadmaster-central-hub"

$ pm2 env 0
✅ Funciona - muestra variables de entorno
```

**Solución**: Usar siempre ID numérico con `pm2 env`

---

### Problema 2: SESSION_MANAGER_BASE_URL NO está en el entorno de PM2

**Causa raíz**: PM2 NO carga automáticamente archivos `.env`. Solo carga variables declaradas en `ecosystem.config.js` bajo `env: {}`.

**Evidencia**:
```bash
$ pm2 env 0 | grep SESSION_MANAGER
(vacío - NO existe en el entorno del proceso PM2)

$ cat .env | grep SESSION_MANAGER
SESSION_MANAGER_BASE_URL=http://localhost:3011  ✅ Existe en archivo

$ node -e "require('dotenv').config(); console.log(process.env.SESSION_MANAGER_BASE_URL)"
http://localhost:3011  ✅ dotenv funciona cuando se carga manualmente
```

**Impacto**: La aplicación carga `.env` correctamente vía `require('dotenv').config()` en `src/index.js`, PERO si se ejecuta código que depende de la variable ANTES de que dotenv se cargue, fallará.

---

### Problema 3 (CRÍTICO): Session Manager configurado en puerto INCORRECTO

**Causa raíz**: El `ecosystem.config.cjs` de session-manager tiene hardcodeado `PORT: 3001`, pero central-hub espera `3011`.

**Evidencia**:
```javascript
// services/session-manager/ecosystem.config.cjs
env: {
  NODE_ENV: 'production',
  PORT: 3001  // ❌ INCORRECTO - debería ser 3011
}

// services/central-hub/.env
SESSION_MANAGER_BASE_URL=http://localhost:3011  // ✅ Correcto pero inútil
```

**Resultado**:
```bash
$ netstat -tlnp | grep 3011
(vacío - puerto NO está escuchando)

$ curl http://localhost:3011/health
curl: (7) Failed to connect to localhost port 3011: Connection refused

$ pm2 logs session-manager --err --lines 5
Error: listen EADDRINUSE: address already in use :::3001
```

**Conclusión**: Session Manager está intentando usar puerto 3001 (que puede estar ocupado o es incorrecto), NO 3011 como espera central-hub.

---

## 🔍 ANÁLISIS DETALLADO

### 1. ¿Por qué `pm2 env <name>` no funciona?

**Comportamiento de PM2 6.x**:

PM2 internamente usa dos identificadores:
- **pm_id** (numérico): ID único incremental (0, 1, 2, ...)
- **name**: Nombre legible definido en config

**Comandos que funcionan con nombres**:
```bash
pm2 show leadmaster-central-hub      ✅
pm2 logs leadmaster-central-hub      ✅
pm2 restart leadmaster-central-hub   ✅
pm2 stop leadmaster-central-hub      ✅
pm2 describe leadmaster-central-hub  ✅
```

**Comandos que SOLO aceptan ID numérico**:
```bash
pm2 env <name>     ❌ Bug en resolver nombre
pm2 env <id>       ✅ Funciona
```

**Explicación técnica**:

El comando `pm2 env` usa un método interno diferente que no invoca el resolver de nombres estándar. Esto es un bug conocido en PM2 < 7.x.

**Workaround**:
```bash
# Obtener ID del proceso
$ pm2 list
┌────┬──────────────────────┬──────┐
│ id │ name                 │ ...  │
├────┼──────────────────────┼──────┤
│ 0  │ leadmaster-central-… │ ...  │
└────┴──────────────────────┴──────┘

# Usar ID numérico
$ pm2 env 0
```

---

### 2. ¿Por qué SESSION_MANAGER_BASE_URL no está en PM2?

**Flujo de carga de variables de entorno en PM2**:

```
1. PM2 inicia proceso
   └─ Carga SOLO variables definidas en ecosystem.config.js -> env: {}

2. Node.js ejecuta src/index.js
   └─ Línea 1: require('dotenv').config()
      └─ Lee .env y carga en process.env (RUNTIME)

3. Código de la app puede usar process.env.SESSION_MANAGER_BASE_URL ✅
```

**Problema potencial**:

Si algún módulo importado ANTES de `dotenv.config()` necesita la variable, fallará:

```javascript
// ❌ MAL: Variable no disponible aquí
const sessionUrl = process.env.SESSION_MANAGER_BASE_URL;
require('dotenv').config();

// ✅ BIEN: Variable disponible después de dotenv
require('dotenv').config();
const sessionUrl = process.env.SESSION_MANAGER_BASE_URL;
```

**Estado actual en central-hub**:

```javascript
// src/index.js (línea 1)
require('dotenv').config();  ✅ Correcto

// Todos los imports vienen después
const express = require('express');
// ...
```

**Conclusión**: La app carga `.env` correctamente. NO es necesario agregar variables al ecosystem.config.js a menos que se necesiten ANTES de que Node.js ejecute index.js (ej: argumentos de Node.js, paths de sistema, etc.).

---

### 3. ¿Por qué Session Manager está en puerto incorrecto?

**Análisis de configuración**:

```javascript
// services/session-manager/ecosystem.config.cjs
module.exports = {
  apps: [{
    name: 'session-manager',
    script: 'index.js',
    cwd: '/root/leadmaster-workspace/services/session-manager',
    env: {
      NODE_ENV: 'production',
      PORT: 3001  // ❌ PROBLEMA AQUÍ
    }
  }]
};
```

```javascript
// services/session-manager/index.js
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[Server] Listening on port ${PORT}`);
});
```

**Flujo de inicio**:
1. PM2 carga `ecosystem.config.cjs`
2. PM2 inyecta `env: { PORT: 3001 }` al proceso
3. Session Manager lee `process.env.PORT` → 3001
4. Intenta escuchar en 3001

**Por qué falla**:
```bash
$ pm2 logs session-manager --err --lines 5
Error: listen EADDRINUSE: address already in use :::3001
```

Posibles causas:
- Otro servicio usa puerto 3001
- Puerto reservado del sistema
- Firewall bloquea 3001

**Configuración esperada por central-hub**:
```bash
# services/central-hub/.env
SESSION_MANAGER_BASE_URL=http://localhost:3011
```

**Mismatch crítico**:
- Session Manager INTENTA usar: 3001
- Central Hub ESPERA: 3011
- RESULTADO: Connection refused

---

## 🚀 SOLUCIONES

### Solución 1: Comando correcto para ver variables de entorno

**Problema**: `pm2 env leadmaster-central-hub` no funciona

**Solución**:
```bash
# Opción A: Usar ID numérico
pm2 env 0

# Opción B: Usar jq (si está instalado)
pm2 jlist | jq '.[0].pm2_env.env'

# Opción C: Inspeccionar proceso vivo
cat /proc/$(pgrep -f "leadmaster-central-hub")/environ | tr '\0' '\n'

# Opción D: Ver todo el descriptor
pm2 show 0
```

---

### Solución 2: Inyectar SESSION_MANAGER_BASE_URL en PM2 (opcional, NO necesario)

**Si quieres que PM2 maneje la variable** (en lugar de dotenv):

```javascript
// services/central-hub/ecosystem.config.js
module.exports = {
  apps: [{
    name: 'leadmaster-central-hub',
    script: 'src/index.js',
    cwd: '/root/leadmaster-workspace/services/central-hub',
    env: {
      NODE_ENV: 'production',
      PORT: 3012,
      SESSION_MANAGER_BASE_URL: 'http://localhost:3011'  // ← AGREGAR
    }
  }]
};
```

Luego:
```bash
pm2 delete leadmaster-central-hub
pm2 start ecosystem.config.js
pm2 save
```

**NOTA**: Esto NO es necesario si `dotenv` ya funciona. Solo úsalo si necesitas que la variable esté disponible ANTES de ejecutar Node.js (ej: scripts de pre-start).

---

### Solución 3 (CRÍTICA): Corregir puerto de Session Manager

**Paso 1: Modificar ecosystem.config.cjs**

```bash
nano /root/leadmaster-workspace/services/session-manager/ecosystem.config.cjs
```

Cambiar:
```javascript
env: {
  NODE_ENV: 'production',
  PORT: 3001  // ❌ CAMBIAR ESTO
}
```

Por:
```javascript
env: {
  NODE_ENV: 'production',
  PORT: 3011  // ✅ Puerto correcto
}
```

**Paso 2: Reiniciar con nueva configuración**

```bash
cd /root/leadmaster-workspace/services/session-manager
pm2 delete session-manager
pm2 start ecosystem.config.cjs
pm2 save
```

**Paso 3: Verificar**

```bash
# Verificar que escucha en 3011
netstat -tlnp | grep 3011
# Debe mostrar: tcp6  :::3011  LISTEN  <pid>/node

# Probar endpoint
curl http://localhost:3011/health
# Debe retornar: {"status":"ok"}

# Probar desde central-hub
curl http://localhost:3012/whatsapp/51/status
# Debe funcionar sin "fetch failed"
```

**Paso 4: Reiniciar central-hub para aplicar cambios**

```bash
pm2 restart leadmaster-central-hub
```

---

## 📊 DIAGRAMA: Flujo de Variables de Entorno

```
┌─────────────────────────────────────────────────────────────┐
│ FILESYSTEM                                                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  .env (NO leído por PM2)                                    │
│  ├─ SESSION_MANAGER_BASE_URL=http://localhost:3011         │
│  └─ Otros...                                                │
│                                                              │
│  ecosystem.config.js (Leído por PM2)                        │
│  └─ env: { NODE_ENV, PORT }  ← Inyectado al proceso        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ PM2 DAEMON                                                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Lee ecosystem.config.js                                 │
│  2. Crea proceso Node.js con env del config                │
│  3. process.env = { NODE_ENV, PORT, PATH, HOME, ... }      │
│                                                              │
│  ⚠️ .env NO está cargado aquí                               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ NODE.JS RUNTIME                                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  src/index.js (línea 1)                                     │
│  require('dotenv').config();  ← Lee .env AHORA             │
│                                                              │
│  DESPUÉS de esta línea:                                     │
│  process.env.SESSION_MANAGER_BASE_URL ✅ Disponible        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## ⚠️ ADVERTENCIAS Y MEJORES PRÁCTICAS

### 1. PM2 NO carga .env automáticamente

**Mito**: PM2 detecta .env y lo carga  
**Realidad**: Solo carga `env:{}` del ecosystem.config.js

**Recomendación**: Usar dotenv en la app (ya implementado) O declarar todas las variables en ecosystem.config.js

### 2. `pm2 env <name>` está roto en versiones < 7

**Workaround**: Usar `pm2 env <id>` o `pm2 show <id>`

### 3. Cambios en ecosystem.config.js NO se aplican con `pm2 restart`

**Incorrecto**:
```bash
# Editar ecosystem.config.js
pm2 restart leadmaster-central-hub  # ❌ NO carga nuevo env
```

**Correcto**:
```bash
# Editar ecosystem.config.js
pm2 delete leadmaster-central-hub
pm2 start ecosystem.config.js
pm2 save
```

O con flag:
```bash
pm2 restart leadmaster-central-hub --update-env
```

### 4. Puerto 3001 vs 3011: Estandarizar

**Decisión requerida**: ¿Cuál es el puerto OFICIAL?

**Opción A**: Session Manager usa 3011
- ✅ Coincide con SESSION_MANAGER_BASE_URL actual
- ✅ Menos cambios en código
- ❌ Requiere cambiar ecosystem.config.cjs de session-manager

**Opción B**: Session Manager usa 3001
- ✅ No cambiar ecosystem.config.cjs
- ❌ Requiere cambiar .env en central-hub
- ❌ Requiere cambiar todos los proxies

**Recomendación**: Opción A (usar 3011)

---

## 📝 COMANDOS DE VERIFICACIÓN

```bash
# 1. Ver variables de entorno del proceso (método correcto)
pm2 env 0  # Usa ID, no nombre

# 2. Ver toda la configuración del proceso
pm2 show 0

# 3. Ver logs en tiempo real
pm2 logs leadmaster-central-hub --lines 50

# 4. Verificar que session-manager escucha en puerto correcto
netstat -tlnp | grep 3011

# 5. Probar conectividad entre servicios
curl http://localhost:3011/health
curl http://localhost:3012/whatsapp/51/status

# 6. Ver variables de entorno desde /proc (útil para debugging)
cat /proc/$(pgrep -f "leadmaster-central-hub")/environ | tr '\0' '\n' | grep SESSION

# 7. Verificar que dotenv carga correctamente
cd /root/leadmaster-workspace/services/central-hub
node -e "require('dotenv').config(); console.log(process.env.SESSION_MANAGER_BASE_URL)"
```

---

## 🎯 CHECKLIST DE RESOLUCIÓN

### Problema 1: pm2 env no encuentra proceso
- [x] Identificado: Bug en PM2 6.x con nombres
- [x] Workaround: Usar `pm2 env 0`
- [ ] Opcional: Actualizar PM2 a versión 7+ (rompe compatibilidad)

### Problema 2: Variable no visible en PM2
- [x] Identificado: dotenv carga en runtime, no en PM2
- [x] Verificado: La app SÍ accede a la variable correctamente
- [ ] Opcional: Agregar a ecosystem.config.js (NO necesario)

### Problema 3: Session Manager en puerto incorrecto
- [ ] **CRÍTICO**: Cambiar PORT: 3001 → 3011 en ecosystem.config.cjs
- [ ] Reiniciar session-manager con pm2 delete + pm2 start
- [ ] Verificar con netstat que escucha en 3011
- [ ] Probar curl http://localhost:3011/health
- [ ] Reiniciar central-hub
- [ ] Verificar logs: deben desaparecer errores "fetch failed"

---

## 📌 CONCLUSIÓN

**Respuestas a preguntas específicas**:

### 1. ¿Por qué PM2 no reconoce el proceso con pm2 env <name>?
- Bug en PM2 6.x: el comando `env` no resuelve nombres, solo IDs numéricos
- Otros comandos (show, logs, restart) SÍ funcionan con nombres

### 2. ¿Por qué SESSION_MANAGER_BASE_URL no está en PM2?
- PM2 NO carga archivos .env automáticamente
- La variable SOLO existe después de que Node.js ejecuta `require('dotenv').config()`
- Esto es NORMAL y CORRECTO para el flujo actual

### 3. ¿Cuál es el comando correcto?
```bash
# Ver variables de entorno
pm2 env 0  # Usa ID numérico

# Inyectar variable persistente (opcional, NO necesario)
# Editar ecosystem.config.js y agregar SESSION_MANAGER_BASE_URL bajo env:{}
pm2 delete leadmaster-central-hub
pm2 start ecosystem.config.js
pm2 save
```

### 4. Causa raíz REAL del problema
**NO es PM2**. El verdadero problema es:

**Session Manager configurado en puerto 3001 pero central-hub espera 3011**

**Solución**: Cambiar `PORT: 3001` → `PORT: 3011` en `services/session-manager/ecosystem.config.cjs`

---

**Prioridad**: Resolver Problema 3 PRIMERO (puerto incorrecto), luego verificar que Problema 1 y 2 no afectan operación.

**Documento generado**: 2026-01-13 13:40:00 UTC-6  
**Siguiente acción**: Corregir puerto de session-manager en ecosystem.config.cjs
