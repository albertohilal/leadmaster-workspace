# PM2 Deployment - Resumen Ejecutivo

## 🔴 PROBLEMA IDENTIFICADO

**Loop de Reinicio con EADDRINUSE en Puerto 3001**

### Causa Raíz
1. ❌ **No existe `ecosystem.config.js`** → PM2 sin control de instancias
2. ❌ **Múltiples inicializaciones simultáneas** → 12 intentos de bind al mismo puerto
3. ❌ **WhatsApp llega a READY** ✅ pero **servidor HTTP crashea** ❌ por EADDRINUSE
4. ❌ **PM2 reinicia automáticamente** → loop infinito
5. ❌ **`headless: false` en VPS** → Modo no headless en producción

### Evidencia
```bash
# 12 inicializaciones idénticas en logs:
Cliente ID: 51
Port: 3001
[Init] WhatsApp client initialization started

# Error recurrente:
Error: listen EADDRINUSE: address already in use :::3001
```

---

## ✅ SOLUCIÓN IMPLEMENTADA

### 1. Ecosystem Config Creado
**Archivo**: `/root/leadmaster-workspace/services/central-hub/ecosystem.config.js`

**Configuración crítica**:
```javascript
{
  name: 'leadmaster-central-hub',
  script: 'src/index.js',  // ✅ Directo, NO npm start
  instances: 1,            // ✅ UNA sola instancia
  exec_mode: 'fork',       // ✅ NO cluster (WhatsApp es stateful)
  autorestart: true,
  max_restarts: 10,        // ✅ Límite de reinicios
  min_uptime: '10s',       // ✅ Mínimo uptime antes de "stable"
  restart_delay: 4000,     // ✅ 4s entre reinicios (liberar puerto)
  exp_backoff_restart_delay: 100,  // ✅ Backoff exponencial
  watch: false,            // ✅ NUNCA watch con WhatsApp
  kill_timeout: 10000      // ✅ Graceful shutdown
}
```

### 2. Puppeteer Headless Corregido
**Archivo**: `src/modules/session-manager/services/sessionService.js`

**Cambio**:
```javascript
// ❌ ANTES (línea 95):
headless: false,  // NO HEADLESS en VPS

// ✅ AHORA:
headless: true,
args: [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--disable-software-rasterizer',
  '--disable-blink-features=AutomationControlled',  // Anti-bot detection
  '--user-agent=Mozilla/5.0 (X11; Linux x86_64)...'
]
```

### 3. Script de Deployment Automatizado
**Archivo**: `scripts/deploy-pm2-clean.sh`

**Funciones**:
- Detiene todos los procesos Node.js
- Limpia PM2 completamente
- Verifica puertos libres
- Inicia con ecosystem.config.js
- Verifica health endpoints
- Guarda configuración

---

## 🚀 DEPLOYMENT

### Opción A: Deployment Automatizado (RECOMENDADO)
```bash
cd /root/leadmaster-workspace/services/central-hub
./scripts/deploy-pm2-clean.sh
```

### Opción B: Deployment Manual
```bash
# 1. Limpiar todo
pm2 kill
killall -9 node
pm2 cleardump

# 2. Verificar puertos libres
lsof -i :3001 && echo "PUERTO OCUPADO" || echo "OK"
lsof -i :3012 && echo "PUERTO OCUPADO" || echo "OK"

# 3. Iniciar con PM2
cd /root/leadmaster-workspace/services/central-hub
pm2 start ecosystem.config.js

# 4. Verificar
pm2 list
pm2 logs --lines 50

# 5. Guardar
pm2 save

# 6. Auto-start (opcional)
pm2 startup
```

---

## 🔧 CORRECCIONES APLICADAS

### Error 1: Arquitectura sin PM2 Config
- ✅ Creado `ecosystem.config.js` con control de instancias
- ✅ Configurado `instances: 1` para evitar múltiples binds
- ✅ Añadido backoff exponencial para prevenir loops

### Error 2: Uso de `npm start`
- ✅ Cambiado a `node src/index.js` directo
- ✅ Eliminada capa intermedia que complicaba debugging

### Error 3: WhatsApp Cluster Mode
- ✅ Configurado `exec_mode: 'fork'` (NO cluster)
- ✅ Razón: WhatsApp sessions son stateful, no se pueden replicar

### Error 4: Watch Mode con WhatsApp
- ✅ Configurado `watch: false`
- ✅ Razón: File changes reinician sesiones WhatsApp innecesariamente

### Error 5: Reinicios Ilimitados
- ✅ `max_restarts: 10` limita loops infinitos
- ✅ `min_uptime: '10s'` previene crash-restart inmediato
- ✅ `restart_delay: 4000` da tiempo a liberar puerto

### Error 6: Headless Mode Incorrecto
- ✅ Cambiado `headless: false` → `headless: true`
- ✅ Añadidos flags anti-bot detection
- ✅ User-Agent correcto para Linux

---

## 🎯 PATRÓN CORRECTO DE STARTUP

### Arquitectura Recomendada
```
┌─────────────────────────────────────┐
│  PM2 (Process Manager)              │
│  - 1 proceso único                  │
│  - Fork mode (NO cluster)           │
│  - Auto-restart con límites         │
│  - Logs centralizados               │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  Central Hub (Puerto 3012)          │
│  - Express app                      │
│  - Session Manager embebido         │
│  - Auth, Sender, Sync modules       │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  WhatsApp Web.js                    │
│  - Puppeteer headless: true         │
│  - LocalAuth strategy               │
│  - Multi-tenant (clienteId)         │
└─────────────────────────────────────┘
```

### Secuencia de Inicio Correcta
1. **PM2 inicia proceso único** con ecosystem config
2. **Express hace bind a puerto 3012** (Central Hub)
3. **Session Manager NO hace bind** (embebido, no independiente)
4. **WhatsApp client initialize()** cuando se solicita
5. **Puppeteer inicia Chrome headless**
6. **QR generado → Authenticated → READY**

### Anti-Patrón Anterior (INCORRECTO)
1. ❌ PM2 sin config → múltiples instancias
2. ❌ Session Manager independiente bind a 3001
3. ❌ Primera instancia OK, segunda → EADDRINUSE
4. ❌ Crash → PM2 restart → loop infinito

---

## 📊 VERIFICACIÓN

### Comandos de Verificación
```bash
# Ver estado PM2
pm2 list
# Debe mostrar:
# - 1 proceso: leadmaster-central-hub
# - status: online
# - restarts: 0 (o < 3)
# - uptime: creciente

# Ver logs sin errores
pm2 logs --lines 50 --nostream | grep -i error

# Verificar health
curl http://localhost:3012/health

# Verificar Session Manager (proxy)
curl http://localhost:3012/session-manager/status

# Verificar NO hay procesos huérfanos
ps aux | grep node | grep -v grep | wc -l
# Debe mostrar: 1 (solo PM2 daemon + 1 app)
```

### Señales de Éxito
- ✅ PM2 muestra 1 proceso con status "online"
- ✅ Restarts = 0 o muy bajo (< 3)
- ✅ Uptime creciente (> 1 minuto)
- ✅ No hay EADDRINUSE en logs
- ✅ `/health` responde 200 OK
- ✅ Puerto 3001 LIBRE (Session Manager embebido)

### Señales de Fallo
- ❌ PM2 muestra múltiples instancias del mismo servicio
- ❌ Restarts > 10 y creciendo
- ❌ Uptime reinicia constantemente (< 10s)
- ❌ EADDRINUSE en logs
- ❌ `/health` no responde
- ❌ Puerto 3001 ocupado por proceso separado

---

## 📚 DOCUMENTACIÓN ADICIONAL

- **Guía Completa**: `docs/PM2_DEPLOYMENT_GUIDE.md` (100+ comandos)
- **Ecosystem Config**: `ecosystem.config.js` (Central Hub)
- **Script Deployment**: `scripts/deploy-pm2-clean.sh`
- **Session Manager Config**: `../session-manager/ecosystem.config.js` (standalone)

---

## 🎓 LECCIONES APRENDIDAS

### 1. PM2 sin ecosystem.config.js es peligroso
- Sin config, PM2 puede iniciar múltiples instancias
- Sin límites, loops infinitos consumen recursos

### 2. WhatsApp Web NO soporta cluster mode
- Sessions son stateful (tokens, QR, Puppeteer)
- Única opción viable: `exec_mode: 'fork'` con 1 instancia

### 3. EADDRINUSE en VPS es común
- Puerto no se libera inmediatamente tras crash
- Solución: `restart_delay: 4000` + `exp_backoff`

### 4. `npm start` con PM2 añade complejidad
- PM2 → npm → node → app (3 capas)
- Mejor: PM2 → node → app (2 capas)

### 5. Headless mode requiere flags específicos
- VPS sin GUI necesita `--disable-gpu`, `--no-sandbox`
- Anti-bot detection: `--disable-blink-features=AutomationControlled`

---

## 🚀 PRÓXIMOS PASOS

1. **Ejecutar deployment**:
   ```bash
   ./scripts/deploy-pm2-clean.sh
   ```

2. **Monitorear durante 5 minutos**:
   ```bash
   pm2 logs --lines 100
   ```

3. **Verificar estabilidad**:
   ```bash
   pm2 list  # Restarts debe ser 0
   ```

4. **Configurar auto-start**:
   ```bash
   pm2 startup
   # Ejecutar comando que PM2 muestra
   pm2 save
   ```

5. **Reiniciar VPS y verificar**:
   ```bash
   sudo reboot
   # Tras reboot:
   pm2 list  # Debe mostrar servicio corriendo
   ```
