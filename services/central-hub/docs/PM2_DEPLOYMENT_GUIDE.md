# Guía de Deployment con PM2 - LeadMaster

## 🎯 Arquitectura de Procesos

```
┌─────────────────────────────────────────────┐
│  PM2 Process Manager                        │
├─────────────────────────────────────────────┤
│                                             │
│  ┌───────────────────────────────────┐     │
│  │ leadmaster-central-hub            │     │
│  │ Puerto: 3012                      │     │
│  │ Instancias: 1 (fork mode)         │     │
│  │ Script: src/index.js              │     │
│  │                                   │     │
│  │ Embeds:                           │     │
│  │  - Session Manager (multi-tenant) │     │
│  │  - Auth Module                    │     │
│  │  - Sender Module                  │     │
│  │  - Sync Contacts                  │     │
│  └───────────────────────────────────┘     │
│                                             │
└─────────────────────────────────────────────┘
```

## ⚠️ **PROBLEMAS IDENTIFICADOS**

### 1. Loop de Reinicio EADDRINUSE
**Causa**: Múltiples instancias PM2 intentando bind al puerto 3001

**Síntoma**:
```
Error: listen EADDRINUSE: address already in use :::3001
[Init] WhatsApp client initialization started  (x12 veces)
```

**Solución**: Ecosystem config con `instances: 1` y `exec_mode: 'fork'`

### 2. Session Manager Independiente Mal Configurado
**Problema**: Session Manager corre como servicio separado SIN PM2 config

**Consecuencias**:
- PM2 lo inicia automáticamente en cada restart
- No hay control de reinicio exponential backoff
- Logs mezclados sin identificación

### 3. WhatsApp Client Llega a READY pero Server Crashea
**Problema**: El cliente WhatsApp se autentica correctamente pero el servidor HTTP falla

**Flujo del error**:
```
1. PM2 inicia session-manager
2. WhatsApp client initialize()
3. Puppeteer inicia Chrome headless
4. QR generado → Authenticated → READY ✅
5. app.listen(3001) → EADDRINUSE ❌
6. Process crash → PM2 restart
7. GOTO 1 (loop infinito)
```

## ✅ **SOLUCIONES**

### Solución 1: Central Hub con PM2 (RECOMENDADO)

**Arquitectura**: Session Manager embebido en Central Hub

```bash
# 1. Detener procesos huérfanos
pm2 delete all
killall node
pkill -f session-manager

# 2. Limpiar PM2
pm2 kill
pm2 cleardump

# 3. Iniciar con ecosystem
cd /root/leadmaster-workspace/services/central-hub
pm2 start ecosystem.config.js

# 4. Verificar
pm2 list
pm2 logs leadmaster-central-hub --lines 50

# 5. Guardar configuración
pm2 save

# 6. Auto-start en reboot
pm2 startup
# Ejecutar el comando que PM2 muestra
```

**Endpoints resultantes**:
- Central Hub: `http://localhost:3012`
- Session Manager (proxy): `http://localhost:3012/session-manager/*`
- WhatsApp QR: `http://localhost:3012/api/whatsapp/:clienteId/qr`

### Solución 2: Session Manager Standalone (SOLO SI NECESARIO)

**Arquitectura**: Session Manager como microservicio independiente

```bash
# 1. Detener todo
pm2 delete all

# 2. Iniciar Session Manager PRIMERO
cd /root/leadmaster-workspace/services/session-manager
CLIENTE_ID=51 pm2 start ecosystem.config.js

# 3. Esperar 30 segundos (WhatsApp tarda en iniciar)
sleep 30

# 4. Verificar que puerto 3001 está libre
curl http://localhost:3001/health

# 5. Iniciar Central Hub
cd /root/leadmaster-workspace/services/central-hub
pm2 start ecosystem.config.js

# 6. Verificar
pm2 list
pm2 logs --lines 50
```

**Endpoints resultantes**:
- Session Manager: `http://localhost:3001`
- Central Hub: `http://localhost:3012`

## 🛠️ **COMANDOS ESENCIALES**

### Verificar Estado
```bash
# Ver procesos PM2
pm2 list

# Ver logs en tiempo real
pm2 logs leadmaster-central-hub --lines 100

# Ver solo errores
pm2 logs leadmaster-central-hub --err --lines 50

# Ver uso de recursos
pm2 monit

# Ver información detallada
pm2 show leadmaster-central-hub
```

### Detener Loop de Reinicio
```bash
# Opción 1: Detener solo el servicio problemático
pm2 stop leadmaster-central-hub

# Opción 2: Desactivar auto-restart temporalmente
pm2 stop leadmaster-central-hub
pm2 start leadmaster-central-hub --no-autorestart

# Opción 3: Detener todo PM2
pm2 kill

# Opción 4: Matar procesos Node.js huérfanos
killall node
pkill -f "node.*index.js"
```

### Debugging
```bash
# Ver qué proceso usa puerto 3001
lsof -i :3001

# Ver procesos Node.js
ps aux | grep node

# Ver variables de entorno del proceso
pm2 env 0  # ID del proceso

# Restart con delay
pm2 restart leadmaster-central-hub --update-env

# Ver configuración actual
pm2 prettylist
```

### Limpiar Estado Corrupto
```bash
# 1. Detener PM2 completamente
pm2 kill

# 2. Limpiar dumps
pm2 cleardump

# 3. Eliminar logs antiguos
rm -rf /root/.pm2/logs/*.log

# 4. Eliminar procesos Node.js huérfanos
killall -9 node

# 5. Verificar puertos libres
lsof -i :3001
lsof -i :3012

# 6. Reiniciar desde cero
pm2 start ecosystem.config.js
```

## 📋 **CHECKLIST DE DEPLOYMENT**

### Pre-deployment
- [ ] Verificar puerto 3012 libre: `lsof -i :3012`
- [ ] Verificar puerto 3001 libre: `lsof -i :3001`
- [ ] No hay procesos Node.js huérfanos: `ps aux | grep node`
- [ ] PM2 está limpio: `pm2 list` (vacío)
- [ ] Tokens WhatsApp limpios (opcional): `rm -rf tokens/.wwebjs_*`

### Deployment
- [ ] Crear `ecosystem.config.js` en central-hub
- [ ] Iniciar con PM2: `pm2 start ecosystem.config.js`
- [ ] Verificar logs sin errores: `pm2 logs --lines 50 --nostream`
- [ ] Esperar 30 segundos (WhatsApp init)
- [ ] Verificar status: `curl http://localhost:3012/health`
- [ ] Verificar WhatsApp: `curl http://localhost:3012/session-manager/status`

### Post-deployment
- [ ] Guardar configuración: `pm2 save`
- [ ] Configurar auto-start: `pm2 startup`
- [ ] Ejecutar comando systemd que PM2 muestra
- [ ] Reiniciar servidor y verificar: `pm2 list`
- [ ] Monitorear logs: `pm2 logs --lines 100`

## 🔧 **CONFIGURACIÓN ÓPTIMA**

### ecosystem.config.js (Central Hub)

**Parámetros críticos**:
```javascript
{
  instances: 1,              // UNA sola instancia
  exec_mode: 'fork',         // NO cluster con WhatsApp
  autorestart: true,
  max_restarts: 10,          // Límite de reinicios
  min_uptime: '10s',         // Uptime mínimo antes de "stable"
  restart_delay: 4000,       // 4 segundos entre reinicios
  exp_backoff_restart_delay: 100,  // Backoff exponencial
  watch: false,              // NUNCA watch con WhatsApp
  kill_timeout: 10000,       // 10s para graceful shutdown
}
```

**¿Por qué estos valores?**
- `instances: 1`: WhatsApp sessions son stateful, no se pueden replicar
- `max_restarts: 10`: Previene loops infinitos
- `min_uptime: '10s'`: Da tiempo a que server haga bind al puerto
- `restart_delay: 4000`: Da tiempo a que puerto anterior se libere
- `exp_backoff_restart_delay: 100`: Aumenta delay en cada fallo
- `watch: false`: Evita reinicios innecesarios que desconectan WhatsApp

## 🚫 **ANTI-PATRONES**

### ❌ NO hacer:
```bash
# NO usar npm start con PM2
pm2 start npm --name app -- start  # ❌

# NO usar cluster mode
pm2 start index.js -i 4  # ❌

# NO usar watch con WhatsApp
pm2 start index.js --watch  # ❌

# NO mezclar PM2 con systemd directo
systemctl start leadmaster  # ❌

# NO iniciar múltiples veces el mismo servicio
pm2 start ecosystem.config.js
pm2 start ecosystem.config.js  # ❌ DUPLICADO
```

### ✅ HACER:
```bash
# Usar node directo
pm2 start src/index.js --name app  # ✅

# Usar ecosystem.config.js
pm2 start ecosystem.config.js  # ✅

# Fork mode para stateful apps
exec_mode: 'fork'  # ✅

# Detener antes de reiniciar
pm2 delete all && pm2 start ecosystem.config.js  # ✅
```

## 🐛 **TROUBLESHOOTING**

### Loop de Reinicio Infinito

**Síntomas**:
```
pm2 list → restarts: 43, 44, 45...
pm2 logs → EADDRINUSE :::3001
```

**Diagnóstico**:
```bash
# 1. Ver cuántos reinicios
pm2 list

# 2. Ver último error
pm2 logs --err --lines 10 --nostream

# 3. Ver procesos huérfanos
ps aux | grep -E "node|PM2"

# 4. Ver qué usa el puerto
lsof -i :3001
```

**Solución**:
```bash
# 1. Detener TODO
pm2 kill
killall -9 node

# 2. Verificar puertos libres
lsof -i :3001 || echo "Puerto libre"

# 3. Iniciar limpio
pm2 start ecosystem.config.js

# 4. Monitorear
pm2 logs --lines 50
```

### WhatsApp READY pero Server Crashea

**Síntomas**:
```
✅ [session-manager] Cliente 51 WhatsApp listo
❌ Error: listen EADDRINUSE: address already in use :::3001
```

**Causa**: Otra instancia ya hizo bind al puerto

**Solución**:
```bash
# 1. Identificar proceso duplicado
lsof -i :3001

# 2. Matar proceso específico
kill -9 <PID>

# 3. Verificar PM2 tiene UNA sola instancia
pm2 list | grep session-manager

# 4. Si hay duplicados, limpiar
pm2 delete all
pm2 start ecosystem.config.js
```

### Proceso Zombie (Exit Code 0 pero sigue reiniciando)

**Causa**: PM2 interpreta exit 0 como crash

**Solución en ecosystem.config.js**:
```javascript
{
  stop_exit_codes: [0],  // Solo exit 0 es stop intencional
  autorestart: true
}
```

## 📊 **MONITOREO**

### PM2 Built-in
```bash
# Dashboard interactivo
pm2 monit

# Logs en tiempo real
pm2 logs

# Estadísticas
pm2 show leadmaster-central-hub

# Métricas de recursos
pm2 describe 0
```

### Verificación de Health
```bash
# Central Hub
curl http://localhost:3012/health

# Session Manager (via proxy)
curl http://localhost:3012/session-manager/status

# Verificar múltiples endpoints
for port in 3012; do
  echo "Port $port:"
  curl -s http://localhost:$port/health | jq
done
```

## 🔄 **WORKFLOW DE ACTUALIZACIÓN**

```bash
# 1. Pull cambios
cd /root/leadmaster-workspace/services/central-hub
git pull

# 2. Instalar dependencias si hubo cambios
npm install

# 3. Reiniciar servicio con zero-downtime (SOLO si hay 1 instancia)
pm2 reload leadmaster-central-hub

# 4. O restart completo si hay problemas
pm2 restart leadmaster-central-hub

# 5. Verificar logs
pm2 logs --lines 50 --nostream

# 6. Guardar nueva configuración
pm2 save
```

## 🎯 **DECISIÓN: ¿Central Hub o Session Manager Standalone?**

### Opción A: Central Hub con Session Manager Embebido (RECOMENDADO)

**Pros**:
- ✅ 1 solo proceso PM2
- ✅ 1 solo puerto (3012)
- ✅ Más fácil de monitorear
- ✅ Menos riesgo de EADDRINUSE
- ✅ Arquitectura más simple

**Contras**:
- ❌ Escalabilidad limitada (1 cliente = 1 hub completo)

**Cuándo usar**: Sistema con pocos clientes (< 10)

### Opción B: Session Manager Standalone

**Pros**:
- ✅ Escalabilidad horizontal (N clientes)
- ✅ Despliegue independiente
- ✅ Actualizaciones separadas

**Contras**:
- ❌ 2 procesos PM2 a gestionar
- ❌ 2 puertos a mantener libres
- ❌ Mayor complejidad de deployment
- ❌ Mayor riesgo de EADDRINUSE

**Cuándo usar**: Sistema multi-cliente grande (> 10 clientes)

## 📝 **RESUMEN EJECUTIVO**

### Problema Raíz
PM2 sin ecosystem config → múltiples instancias → EADDRINUSE loop

### Solución Principal
1. Crear `ecosystem.config.js`
2. Configurar `instances: 1` + `exec_mode: 'fork'`
3. Usar `pm2 start ecosystem.config.js` (NO `npm start`)
4. Configurar backoff exponencial
5. Limitar reinicios automáticos

### Comando Final
```bash
pm2 kill && \
killall -9 node && \
cd /root/leadmaster-workspace/services/central-hub && \
pm2 start ecosystem.config.js && \
pm2 save && \
pm2 logs --lines 50
```

### Verificación
```bash
pm2 list
# Debe mostrar:
# - 1 proceso: leadmaster-central-hub
# - status: online
# - restarts: 0
# - uptime: > 10s
```
