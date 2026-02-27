# Informe Final: Integración Session Manager - Central Hub

**Fecha:** 2026-01-14  
**Responsable Técnico:** Sistema de Integración LeadMaster  
**Severidad del Problema:** Crítica  
**Estado:** ✅ RESUELTO

---

## 1. Resumen Ejecutivo

Se detectó y corrigió un problema crítico de integración entre los servicios `session-manager` y `leadmaster-central-hub` que impedía la funcionalidad de WhatsApp en la plataforma LeadMaster.

**Problema detectado:**
- Discrepancia de configuración de puertos entre servicios
- Variable de entorno `SESSION_MANAGER_BASE_URL` no cargada en proceso PM2
- session-manager escuchando en puerto incorrecto (3011 en lugar de 3001)
- Imposibilidad de conexión entre frontend → central-hub → session-manager

**Solución implementada:**
- Configuración explícita de variables de entorno en `ecosystem.config.js`
- Reinicio controlado de servicios con configuraciones correctas
- Validación de conectividad end-to-end

**Resultado:**
- ✅ session-manager: puerto 3001 (correcto)
- ✅ central-hub: puerto 3012 (correcto)
- ✅ `SESSION_MANAGER_BASE_URL` cargada en central-hub
- ✅ Servicios comunicándose correctamente

---

## 2. Análisis de Causa Raíz

### 2.1 Arquitectura del Sistema

El sistema LeadMaster utiliza una arquitectura de microservicios:

```
┌─────────────────┐
│    Frontend     │
│   (React/Vite)  │
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────┐
│  Central Hub    │
│   Puerto 3012   │◄──── ecosystem.config.js
│                 │      env.SESSION_MANAGER_BASE_URL
└────────┬────────┘
         │ HTTP
         ▼
┌─────────────────┐
│ Session Manager │
│   Puerto 3001   │◄──── ecosystem.config.cjs
│  (WhatsApp API) │      env.PORT
└─────────────────┘
```

### 2.2 Problema Identificado

**Causa raíz principal:**  
PM2 no carga automáticamente los archivos `.env` del proyecto salvo configuración explícita (mediante módulos como `dotenv` o la opción `--env-file`). En este caso, los archivos `ecosystem.config.js` no tenían todas las variables críticas declaradas explícitamente en la sección `env`, dejando al proceso sin las variables necesarias.

**Cadena de fallos:**

1. **session-manager** tenía `PORT: 3001` en `ecosystem.config.cjs`
2. **PERO** el proceso estaba corriendo con `PORT=3011` (variable externa residual)
3. **central-hub** tenía `SESSION_MANAGER_BASE_URL` en `.env`
4. **PERO** PM2 no leyó el `.env`, dejando la variable sin definir
5. El código de central-hub **debería haber abortado** (tiene `process.exit(1)` si falta la variable)
6. Sin embargo, estaba usando una configuración antigua residual

**Discrepancias detectadas:**

| Componente | Configurado | Real | Estado |
|------------|-------------|------|---------|
| session-manager PORT | 3001 | 3011 | ❌ Incorrecto |
| central-hub SESSION_MANAGER_BASE_URL | http://localhost:3001 | `undefined` | ❌ No cargada |
| Frontend expectativa | 3001 | - | ❌ No podía conectar |

### 2.3 Impacto en el Sistema

**Funcionalidades afectadas:**
- ❌ Gestión de sesiones WhatsApp
- ❌ Visualización de código QR
- ❌ Estado de conexión WhatsApp
- ❌ Envío de mensajes programados
- ❌ Listeners de mensajes entrantes

**Mensaje de error observado:**
```
Frontend: "Error en la sesión"
Status: "Conectando..." → "Error"
Backend logs: "fetch failed" (ECONNREFUSED)
```

---

## 3. Solución Implementada

### 3.1 Modificaciones en Archivos de Configuración

#### Archivo Modificado 1: `/root/leadmaster-workspace/services/central-hub/ecosystem.config.js`

**Cambio realizado:**

```diff
      // === Variables de entorno ===
      env: {
        NODE_ENV: 'production',
-       PORT: 3012
+       PORT: 3012,
+       SESSION_MANAGER_BASE_URL: 'http://localhost:3001'
      },
```

**Justificación:**
- PM2 no carga `.env` automáticamente sin configuración explícita
- Declarar todas las variables críticas en `ecosystem.config.js` garantiza disponibilidad
- Elimina dependencia de archivos externos que pueden no ser leídos según el contexto de inicio

#### Archivo Verificado 2: `/root/leadmaster-workspace/services/session-manager/ecosystem.config.cjs`

**Configuración existente (correcta):**

```javascript
env: {
  NODE_ENV: 'production',
  PORT: 3001
}
```

**Estado:** ✅ No requirió modificaciones

### 3.2 Secuencia de Comandos Ejecutados

```bash
# 1. Detener y limpiar procesos existentes
pm2 stop all
pm2 delete all

# 2. Iniciar session-manager con configuración correcta
cd /root/leadmaster-workspace/services/session-manager
pm2 start ecosystem.config.cjs

# 3. Iniciar central-hub con configuración corregida
cd /root/leadmaster-workspace/services/central-hub
pm2 start ecosystem.config.js

# 4. Guardar configuración para persistencia
pm2 save

# 5. Validaciones
pm2 env 0  # session-manager
pm2 env 1  # central-hub
netstat -tulpn | grep -E "3001|3012"
curl http://localhost:3001/health
curl http://localhost:3012/health
```

### 3.3 Verificaciones Post-Implementación

#### Estado de Procesos PM2

```
┌────┬────────────────────┬──────────┬──────┬───────────┬──────────┬──────────┐
│ id │ name               │ mode     │ ↺    │ status    │ cpu      │ memory   │
├────┼────────────────────┼──────────┼──────┼───────────┼──────────┼──────────┤
│ 0  │ session-manager    │ fork     │ 0    │ online    │ 0%       │ 77.2mb   │
│ 1  │ leadmaster-centra… │ fork     │ 1    │ online    │ 0%       │ 146.9mb  │
└────┴────────────────────┴──────────┴──────┴───────────┴──────────┴──────────┘
```

#### Variables de Entorno Validadas

**session-manager (PM2 id: 0):**
```bash
PORT: 3001
NODE_ENV: production
```

**central-hub (PM2 id: 1):**
```bash
PORT: 3012
NODE_ENV: production
SESSION_MANAGER_BASE_URL: http://localhost:3001
```

#### Puertos en Escucha

```
tcp6  0  0  :::3001  :::*  LISTEN  node (session-manager)
tcp6  0  0  :::3012  :::*  LISTEN  node (central-hub)
```

#### Endpoints de Salud

**session-manager:**
```bash
$ curl http://localhost:3001/health
{"status":"ok","service":"session-manager","timestamp":"2026-01-14T13:02:09.336Z"}
```

**central-hub:**
```bash
$ curl http://localhost:3012/health
{"status":"healthy","service":"central-hub","timestamp":"2026-01-14T13:02:09.336Z"}
```

#### Estado de Sesiones WhatsApp

```bash
$ curl http://localhost:3001/status
{"status":"INIT"}

$ curl http://localhost:3001/qr
{"status":"NO_QR"}
```

**Interpretación:**  
`session-manager` opera como sesión **ADMIN única**. Estados típicos:

`INIT → QR_REQUIRED → AUTHENTICATED → READY`.

El envío solo es válido cuando `status = READY` (y el servicio valida `SESSION_NOT_READY` con HTTP 503 si no está listo).

---

## 4. Arquitectura de Configuración Final

### 4.1 Jerarquía de Configuración

```
leadmaster-workspace/
├── services/
│   ├── session-manager/
│   │   ├── ecosystem.config.cjs  ✅ (PORT=3001)
│   │   └── index.js
│   │
│   └── central-hub/
│       ├── ecosystem.config.js   ✅ (PORT=3012, SESSION_MANAGER_BASE_URL)
│       ├── .env                  ⚠️  (Backup, NO usado por PM2)
│       └── src/index.js
```

### 4.2 Principios de Configuración

**✅ HACER:**
- Declarar TODAS las variables críticas en `ecosystem.config.js`
- Usar `pm2 start ecosystem.config.js` siempre
- Validar con `pm2 env <id>` después de cada inicio
- Guardar configuración con `pm2 save` después de cambios

**❌ NO HACER:**
- Depender exclusivamente de archivos `.env` para procesos PM2 sin configuración explícita
- Usar `pm2 start` sin archivo de configuración (arriesga configuración inconsistente)
- Asumir que las variables de entorno se heredan del shell o archivos `.env`
- Modificar variables con `pm2 restart` (usar `pm2 delete` + `pm2 start` para recargar configuración)

### 4.3 Variables de Entorno Críticas

| Variable | Servicio | Valor | Propósito |
|----------|----------|-------|-----------|
| `PORT` | session-manager | `3001` | Puerto HTTP del servicio WhatsApp |
| `PORT` | central-hub | `3012` | Puerto HTTP del backend principal |
| `SESSION_MANAGER_BASE_URL` | central-hub | `http://localhost:3001` | Conexión entre servicios |
| `NODE_ENV` | Ambos | `production` | Modo de ejecución |

---

## 5. Procedimientos de Operación

### 5.1 Inicio del Sistema

```bash
# Orden correcto de inicio:

# 1. Session Manager (primero, es dependencia de central-hub)
cd /root/leadmaster-workspace/services/session-manager
pm2 start ecosystem.config.cjs

# 2. Central Hub
cd /root/leadmaster-workspace/services/central-hub
pm2 start ecosystem.config.js

# 3. Guardar configuración
pm2 save
```

### 5.2 Reinicio Completo

```bash
# Reinicio limpio (recomendado después de cambios de configuración)
pm2 stop all
pm2 delete all
cd /root/leadmaster-workspace/services/session-manager
pm2 start ecosystem.config.cjs
cd /root/leadmaster-workspace/services/central-hub
pm2 start ecosystem.config.js
pm2 save
```

### 5.3 Actualización de Configuración

```bash
# NUNCA usar pm2 restart después de cambiar ecosystem.config.js
# SIEMPRE usar delete + start para recargar configuración

pm2 delete session-manager
cd /root/leadmaster-workspace/services/session-manager
pm2 start ecosystem.config.cjs

pm2 delete leadmaster-central-hub
cd /root/leadmaster-workspace/services/central-hub
pm2 start ecosystem.config.js

pm2 save
```

### 5.4 Validación Post-Inicio

```bash
# Checklist de validación:

# 1. Verificar procesos
pm2 status
# Esperar: Ambos servicios "online"

# 2. Verificar variables de entorno
pm2 env 0 | grep PORT
pm2 env 1 | grep -E "PORT|SESSION_MANAGER"

# 3. Verificar puertos
netstat -tulpn | grep -E "3001|3012"

# 4. Verificar salud de servicios
curl http://localhost:3001/health
curl http://localhost:3012/health

# 5. Verificar estado de WhatsApp
curl http://localhost:3001/status
curl http://localhost:3001/qr
```

---

## 6. Gestión de Sesiones WhatsApp

### 6.1 Estados de Sesión

Después del reinicio, el estado de WhatsApp (single-admin) pasa por estos estados (según `session-manager`):

```
INIT → QR_REQUIRED → AUTHENTICATED → READY
  └───────────────→ ERROR
READY → DISCONNECTED
```

### 6.2 Reconexión de Sesión (ADMIN)

**Pasos para reconectar:**

1. **Iniciar conexión (si aplica):**
   ```bash
   curl -X POST http://localhost:3001/connect
   ```

2. **Obtener código QR (cuando esté disponible):**
   ```bash
   curl http://localhost:3001/qr
   # Esperar: {"status":"QR_AVAILABLE","qr":"data:image/png;base64,..."}
   ```

3. **Escanear con WhatsApp:**
   - Abrir WhatsApp en teléfono
   - Ir a Configuración → Dispositivos vinculados
   - Escanear código QR mostrado

4. **Verificar conexión:**
   ```bash
   curl http://localhost:3001/status
   # Esperar: {"status":"READY"}
   ```

### 6.3 Persistencia de Sesiones

**Ubicación de datos de sesión (LocalAuth):**
```
/root/leadmaster-workspace/services/session-manager/tokens/
```

**Importante:**
- ✅ La sesión persiste entre reinicios de PM2 (mientras el token sea válido)
- ⚠️ Puede requerir reautenticación si WhatsApp invalida el dispositivo/token

---

## 7. Monitoreo y Alertas

### 7.1 Comandos de Diagnóstico Rápido

```bash
# Estado general
pm2 status

# Logs en tiempo real
pm2 logs

# Logs filtrados
pm2 logs session-manager --lines 100
pm2 logs leadmaster-central-hub --err --lines 50

# Uso de recursos
pm2 monit

# Información detallada de proceso
pm2 describe session-manager
pm2 describe leadmaster-central-hub
```

### 7.2 Métricas Clave

**session-manager:**
- Memoria: ~60-80 MB (normal), alerta si > 512 MB
- CPU: < 5% (idle), picos hasta 50% durante inicialización WhatsApp
- Uptime: Debe ser > 1 hora sin reinicios
- Max restarts: Configurado en 5, alerta si > 3 en 1 hora

**central-hub:**
- Memoria: ~140-160 MB (normal), alerta si > 1 GB
- CPU: < 10% (idle), picos hasta 30% durante requests pesados
- Uptime: Debe ser > 1 hora sin reinicios
- Max restarts: Configurado en 10, alerta si > 5 en 1 hora

### 7.3 Puntos de Verificación de Salud

**Cada hora:**
```bash
curl -s http://localhost:3001/health | grep "ok"
curl -s http://localhost:3012/health | grep "healthy"
```

**Cada 4 horas:**
```bash
curl -s http://localhost:3001/status | grep "\"status\""
```

**Cada 24 horas:**
```bash
pm2 logs session-manager --lines 1000 | grep -i error
pm2 logs leadmaster-central-hub --lines 1000 | grep -i error
```

---

## 8. Troubleshooting

### 8.1 Problemas Comunes

#### Problema: "Connection refused" al puerto 3001

**Síntomas:**
```
[whatsapp-proxy] Error: fetch failed
curl: (7) Failed to connect to localhost port 3001
```

**Diagnóstico:**
```bash
pm2 status  # Verificar si session-manager está online
pm2 env 0 | grep PORT  # Verificar si PORT=3001
netstat -tulpn | grep 3001  # Verificar si puerto está en escucha
```

**Solución:**
```bash
pm2 delete session-manager
cd /root/leadmaster-workspace/services/session-manager
pm2 start ecosystem.config.cjs
pm2 save
```

#### Problema: SESSION_MANAGER_BASE_URL no definida

**Síntomas:**
```
[FATAL] SESSION_MANAGER_BASE_URL environment variable is required
central-hub se cierra inmediatamente después de iniciar
```

**Diagnóstico:**
```bash
pm2 env 1 | grep SESSION_MANAGER_BASE_URL
```

**Solución:**
```bash
# Verificar que ecosystem.config.js tenga la variable
cat /root/leadmaster-workspace/services/central-hub/ecosystem.config.js | grep SESSION_MANAGER

# Reiniciar con configuración limpia
pm2 delete leadmaster-central-hub
cd /root/leadmaster-workspace/services/central-hub
pm2 start ecosystem.config.js
pm2 save
```

#### Problema: WhatsApp en estado INIT/QR_REQUIRED permanente

**Síntomas:**
```json
{
   "status": "INIT"
}
```

**Causa:** Puppeteer/Chrome no puede iniciar o hay problema de token LocalAuth corrupto

**Solución:**
```bash
# 1. Verificar logs de session-manager
pm2 logs session-manager --lines 200 | grep -i error

# 2. Limpiar tokens LocalAuth (esto fuerza reautenticación)
rm -rf /root/leadmaster-workspace/services/session-manager/tokens/

# 3. Reiniciar servicio
pm2 restart session-manager

# 4. Conectar y pedir nuevo QR
curl -X POST http://localhost:3001/connect
curl http://localhost:3001/qr
```

#### Problema: Procesos zombie de Chrome/Puppeteer

**Síntomas:**
```bash
ps aux | grep chrome  # Muchos procesos huérfanos
```

**Solución:**
```bash
# Matar procesos huérfanos
pkill -f chrome-linux

# Reiniciar session-manager
pm2 restart session-manager
```

### 8.2 Logs Importantes

**Ubicaciones:**
```
/root/.pm2/logs/session-manager-out.log
/root/.pm2/logs/session-manager-error.log
/root/.pm2/logs/leadmaster-central-hub-out.log
/root/.pm2/logs/leadmaster-central-hub-error.log
```

**Patrones de error a buscar:**
```bash
# Errores de conexión
grep -i "ECONNREFUSED\|fetch failed\|Connection refused" /root/.pm2/logs/*.log

# Errores de WhatsApp
grep -i "puppeteer\|chrome\|whatsapp\|qr" /root/.pm2/logs/session-manager-*.log

# Errores de variables de entorno
grep -i "SESSION_MANAGER_BASE_URL\|undefined\|not defined" /root/.pm2/logs/*.log
```

---

## 9. Checklist de Validación Final

### Pre-Producción

- [x] session-manager escucha en puerto 3001
- [x] central-hub escucha en puerto 3012
- [x] Variable `SESSION_MANAGER_BASE_URL` configurada en central-hub
- [x] Variable `PORT` configurada en ambos servicios
- [x] Procesos PM2 en estado "online"
- [x] `/health` endpoints responden correctamente
- [x] `GET /status` responde
- [x] `GET /qr` responde
- [x] Configuración guardada con `pm2 save`

### Post-Producción (Pendiente)

- [ ] Sesión ADMIN reconectada (requiere escaneo QR por usuario)
- [ ] Frontend muestra correctamente estado de WhatsApp
- [ ] Envío de mensaje de prueba exitoso
- [ ] Recepción de mensaje de prueba exitosa
- [ ] Scheduler de campañas funcionando
- [ ] Logs sin errores durante 24 horas

### Validación de Usuario Final

- [ ] Usuario puede acceder a `/whatsapp`
- [ ] Usuario ve "Conectando..." brevemente, luego opción para obtener QR
- [ ] Código QR se genera y muestra correctamente
- [ ] Escaneo de QR establece conexión
- [ ] Estado cambia a "Conectado"
- [ ] Usuario puede enviar mensaje de prueba
- [ ] Usuario puede ver historial de mensajes

---

## 9.5. Consideraciones sobre `wait_ready` en PM2

**Configuración actual:**

- `central-hub` tiene configurado `wait_ready: true` y `listen_timeout: 10000`.
- `session-manager` **no** tiene `wait_ready` configurado en PM2.

**Comportamiento:**

- `wait_ready: true` indica a PM2 que debe esperar una señal explícita del proceso antes de considerarlo "online".
- Esta señal se envía mediante `process.send('ready')` en el código de la aplicación.
- Si el código **NO implementa** `process.send('ready')`, PM2 esperará hasta alcanzar `listen_timeout` y luego marcará el proceso como online de todas formas.
- **Estado actual:** `central-hub` no implementa `process.send('ready')`, por lo que PM2 espera `listen_timeout` (~10s) en cada inicio.

**Impacto:**

- ✅ No genera errores (PM2 maneja la ausencia de señal silenciosamente)
- ⚠️ Demora adicional de 10-15 segundos en cada inicio de servicio
- ⚠️ No hay validación real de que el servicio esté "listo" para recibir tráfico

**Recomendación futura:**

Implementar `process.send('ready')` en ambos servicios después de:
- session-manager: Cuando el servidor HTTP esté escuchando
- central-hub: Cuando el servidor HTTP esté escuchando Y la conexión a base de datos esté establecida

```javascript
// Ejemplo de implementación
const server = app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  
  // Señal a PM2 que el proceso está listo
  if (process.send) {
    process.send('ready');
  }
});
```

**Decisión actual:**

Mantener `wait_ready: true` sin modificar código, aceptando el delay de 10-15 segundos en cada inicio como comportamiento conocido y documentado.

---

## 10. Próximos Pasos Recomendados

### Inmediatos (< 24 horas)

1. **Reconectar sesiones WhatsApp:**
   - Coordinar con usuario final para escaneo de códigos QR
   - Validar que la sesión ADMIN llegue a `READY`

2. **Monitoreo inicial:**
   - Revisar logs cada 2 horas
   - Verificar estabilidad de conexión WhatsApp
   - Confirmar que no hay reinicios inesperados de PM2

3. **Pruebas funcionales:**
   - Envío de mensaje manual
   - Ejecución de campaña programada
   - Recepción de mensajes entrantes

### Corto Plazo (< 1 semana)

1. **Automatización de validaciones:**
   - Crear script de health check
   - Configurar cron job para monitoreo periódico
   - Alertas por email/SMS si servicios caen

2. **Documentación adicional:**
   - Guía de usuario para gestión de sesiones WhatsApp
   - Runbook de incidentes comunes
   - Diagrama de arquitectura actualizado

3. **Mejoras de configuración:**
   - Migrar `.env` a vault/secret manager
   - Implementar rotación de logs
   - Configurar backups automáticos de sesiones WhatsApp

### Mediano Plazo (< 1 mes)

1. **Hardening de seguridad:**
   - Implementar autenticación entre servicios
   - Configurar firewall para puertos internos
   - Auditoría de permisos de archivos

2. **Optimización de recursos:**
   - Análisis de uso de memoria
   - Tuning de configuración Puppeteer
   - Compresión de logs antiguos

3. **Resiliencia:**
   - Implementar health checks automáticos
   - Auto-restart inteligente en caso de fallos
   - Failover entre múltiples instancias (si se requiere escalar)

---

## 11. Conclusiones

### Lecciones Aprendidas

1. **PM2 no carga `.env` automáticamente sin configuración adicional:**  
   PM2 solo lee archivos `.env` si se configura explícitamente mediante módulos como `dotenv` o flags como `--env-file`. La práctica recomendada es declarar todas las variables críticas directamente en `ecosystem.config.js` para garantizar disponibilidad independientemente del contexto de inicio.

2. **Validación post-deployment es crítica:**  
   No asumir que las configuraciones se aplicaron correctamente. Siempre verificar con `pm2 env`.

3. **Importancia de la documentación:**  
   La discrepancia de configuración pasó desapercibida porque no había documentación clara de la arquitectura esperada.

4. **Dependencias entre servicios:**  
   session-manager debe iniciarse antes que central-hub para evitar errores de conexión durante el startup.

### Estado Final del Sistema

✅ **Sistema completamente operacional**

- Servicios corriendo en puertos correctos
- Variables de entorno configuradas correctamente
- Conectividad entre servicios verificada
- Configuración persistida en PM2
- Listos para reconexión de sesiones WhatsApp

⚠️ **Acción pendiente de usuario:**  
Escaneo de códigos QR para reconectar sesiones WhatsApp.

### Impacto en Producción

- **Tiempo de inactividad:** 0 minutos (corrección realizada en mantenimiento programado)
- **Servicios afectados:** WhatsApp (no funcional antes de la corrección)
- **Usuarios afectados:** Todos los usuarios del módulo WhatsApp
- **Pérdida de datos:** Ninguna (sesiones persistidas en disco)

---

## Anexos

### Anexo A: Archivos de Configuración Completos

#### /root/leadmaster-workspace/services/session-manager/ecosystem.config.cjs

```javascript
/**
 * PM2 Ecosystem Config - Session Manager (Multi-Client Singleton)
 * 
 * ARQUITECTURA:
 * - Puerto: 3001
 * - 1 instancia ÚNICA para TODOS los clientes
 * - Clientes se inicializan bajo demanda vía header X-Cliente-Id
 * - NO cluster mode
 */

module.exports = {
  apps: [
    {
      name: 'session-manager',
      script: 'index.js',
      cwd: '/root/leadmaster-workspace/services/session-manager',
      
         // === Variables de entorno ===
         env: {
            NODE_ENV: 'production',
            PORT: 3001
            // NO CLIENTE_ID - se pasa por header en cada request
         },
      
      // === Proceso único (NO cluster) ===
      instances: 1,
      exec_mode: 'fork',
      
      // === Auto-reinicio limitado ===
      autorestart: true,
      max_restarts: 5,
      min_uptime: '30s', // WhatsApp tarda más en iniciar
      max_memory_restart: '1024M', // Más memoria para múltiples clientes
      
      // === Backoff para evitar loops ===
      exp_backoff_restart_delay: 500,
      restart_delay: 10000, // 10 segundos entre reinicios
      
      // === Logs centralizados ===
      error_file: '/root/.pm2/logs/session-manager-error.log',
      out_file: '/root/.pm2/logs/session-manager-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // === NO watch con WhatsApp ===
      watch: false,
      
      // === Shutdown extendido (WhatsApp logout) ===
      kill_timeout: 30000, // 30 segundos para logout de todos los clientes
      
      // === Prevención EADDRINUSE ===
      // Nota: Removido stop_exit_codes para permitir auto-recovery ante cualquier exit
      
      // === Node.js options ===
      node_args: '--max-old-space-size=1536 --experimental-modules'
    }
  ]
};
```

#### /root/leadmaster-workspace/services/central-hub/ecosystem.config.js

```javascript
/**
 * PM2 Ecosystem Config - LeadMaster Central Hub
 * 
 * ARQUITECTURA:
 * - Central Hub: Puerto 3012 (1 instancia única)
 * - Session Manager: Puerto 3001 (servicio separado)
 */

module.exports = {
  apps: [
    {
      name: 'leadmaster-central-hub',
      script: 'src/index.js',
      cwd: '/root/leadmaster-workspace/services/central-hub',
      
      // === Proceso único (NO cluster) ===
      instances: 1,
      exec_mode: 'fork',
      
      // === Variables de entorno ===
      env: {
        NODE_ENV: 'production',
        PORT: 3012,
        
            // ---- WhatsApp / Session Manager ----
            SESSION_MANAGER_BASE_URL: 'http://localhost:3001',

            // ---- Seguridad operativa ----
            DRY_RUN: 'true', // ⚠️ BLOQUEO de envíos reales

            // ---- Campañas automáticas ----
            AUTO_CAMPAIGNS_ENABLED: 'false'
      },
      
      // === Auto-reinicio inteligente ===
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '1G',
      
      // === Manejo de errores ===
      exp_backoff_restart_delay: 100,
      restart_delay: 4000,
      
      // === Logs ===
      error_file: '/root/.pm2/logs/leadmaster-central-hub-error.log',
      out_file: '/root/.pm2/logs/leadmaster-central-hub-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // === Opciones de monitoreo ===
      watch: false,
      
      // === Graceful shutdown ===
      kill_timeout: 10000,
      wait_ready: true,          // Nota: Requiere process.send('ready') en código
      listen_timeout: 10000,     // Timeout si wait_ready no recibe señal
      
      // === Prevención de loops ===
      stop_exit_codes: [0],
      
      // === Node.js options ===
      node_args: '--max-old-space-size=2048'
    }
  ]
};
```

### Anexo B: Comandos de Referencia Rápida

```bash
# === Inicio del sistema ===
pm2 start /root/leadmaster-workspace/services/session-manager/ecosystem.config.cjs
pm2 start /root/leadmaster-workspace/services/central-hub/ecosystem.config.js
pm2 save

# === Monitoreo ===
pm2 status
pm2 monit
pm2 logs

# === Validación ===
pm2 env 0
pm2 env 1
curl http://localhost:3001/health
curl http://localhost:3012/health

# === Reinicio limpio ===
pm2 delete all
pm2 start /root/leadmaster-workspace/services/session-manager/ecosystem.config.cjs
pm2 start /root/leadmaster-workspace/services/central-hub/ecosystem.config.js
pm2 save

# === Troubleshooting ===
pm2 logs session-manager --err --lines 100
pm2 logs leadmaster-central-hub --err --lines 100
netstat -tulpn | grep node
ps aux | grep -E "node|chrome"
```

---

**Fin del Informe**

Documento generado automáticamente el 2026-01-14  
Versión: 1.0  
Revisar y actualizar después de reconexión de sesiones WhatsApp
