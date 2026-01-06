# PM2 Production Deployment - LeadMaster Central Hub

## Flujo Completo de Despliegue

### 1. Pre-requisitos

```bash
# Verificar instalación PM2
pm2 --version

# Verificar Node.js
node --version  # Debe ser >= 14.x

# Verificar que existe ecosystem.config.js
ls -la /root/leadmaster-workspace/ecosystem.config.js
```

---

### 2. Iniciar Aplicación con PM2

```bash
# Navegar al workspace root
cd /root/leadmaster-workspace

# Iniciar con ecosystem.config.js
pm2 start ecosystem.config.js

# Verificar estado
pm2 status
```

**Output esperado:**
```
┌────┬─────────────────┬─────────┬─────────┬─────────┬──────────┬────────┐
│ id │ name            │ mode    │ ↺       │ status  │ cpu      │ memory │
├────┼─────────────────┼─────────┼─────────┼─────────┼──────────┼────────┤
│ 0  │ leadmaster-hub  │ fork    │ 0       │ online  │ 0%       │ 50.0mb │
└────┴─────────────────┴─────────┴─────────┴─────────┴──────────┴────────┘
```

---

### 3. Guardar Configuración Actual (Persistencia)

```bash
# Guardar lista de procesos en /root/.pm2/dump.pm2
pm2 save

# Confirmar guardado
cat /root/.pm2/dump.pm2 | grep leadmaster-hub
```

**Resultado esperado:**
```json
{
  "name": "leadmaster-hub",
  "pm_id": 0,
  "status": "online",
  ...
}
```

---

### 4. Configurar Auto-Start en Reboot (systemd)

```bash
# Generar comando de startup
pm2 startup systemd

# PM2 mostrará un comando como:
# sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u root --hp /root

# IMPORTANTE: Copiar y ejecutar ese comando exacto
# Ejemplo:
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u root --hp /root
```

**Output esperado:**
```
[PM2] Init System found: systemd
[PM2] To setup the Startup Script, copy/paste the following command:
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u root --hp /root
[PM2] Writing init configuration in /etc/systemd/system/pm2-root.service
[PM2] Making script booting at startup...
[PM2] Target system found: systemd
[PM2] Startup Script copied to /etc/systemd/system/pm2-root.service
```

---

### 5. Verificar Servicio Systemd

```bash
# Verificar que el servicio está activo
systemctl status pm2-root

# Si no está activo, iniciarlo
sudo systemctl start pm2-root

# Habilitar para boot
sudo systemctl enable pm2-root
```

**Output esperado:**
```
● pm2-root.service - PM2 process manager
     Loaded: loaded (/etc/systemd/system/pm2-root.service; enabled)
     Active: active (exited) since Sun 2026-01-05 10:00:00 CST; 1min ago
```

---

### 6. Validar Logs

```bash
# Logs en tiempo real
pm2 logs leadmaster-hub

# Solo últimas 50 líneas (sin streaming)
pm2 logs leadmaster-hub --lines 50 --nostream

# Solo errores
pm2 logs leadmaster-hub --err --lines 30

# Solo stdout
pm2 logs leadmaster-hub --out --lines 30
```

**Logs esperados:**
```
PM2      | 2026-01-05 10:00:00: PM2 log: App [leadmaster-hub:0] online
0|leadma  | 🚀 Leadmaster Central Hub corriendo en http://localhost:3012
```

---

### 7. Test de Healthcheck

```bash
# Test local del /health endpoint
curl http://localhost:3012/health

# Test con formato
curl -s http://localhost:3012/health | jq .
```

**Respuesta esperada:**
```json
{
  "status": "healthy",
  "service": "central-hub",
  "timestamp": "2026-01-05T10:00:00.000Z"
}
```

---

## Comandos de Gestión Cotidiana

### Ver Estado

```bash
# Lista de procesos
pm2 list

# Dashboard interactivo
pm2 monit

# Detalles de un proceso
pm2 show leadmaster-hub

# Logs archivados
ls -lh /root/.pm2/logs/
```

### Reiniciar

```bash
# Restart (zero-downtime con wait_ready)
pm2 restart leadmaster-hub

# Reload (graceful restart)
pm2 reload leadmaster-hub

# Stop (sin eliminar de PM2)
pm2 stop leadmaster-hub

# Start (si está stopped)
pm2 start leadmaster-hub
```

### Actualizar Código

```bash
# 1. Pull cambios
cd /root/leadmaster-workspace/services/central-hub
git pull origin main

# 2. Instalar dependencias (si hay cambios en package.json)
npm install

# 3. Restart con PM2
cd /root/leadmaster-workspace
pm2 restart leadmaster-hub

# 4. Verificar logs
pm2 logs leadmaster-hub --lines 20 --nostream
```

### Limpiar Logs

```bash
# Vaciar logs de un proceso
pm2 flush leadmaster-hub

# Vaciar logs de todos los procesos
pm2 flush
```

---

## Configuración Actual (ecosystem.config.js)

```javascript
{
  name: 'leadmaster-hub',
  cwd: '/root/leadmaster-workspace/services/central-hub',
  script: 'src/index.js',
  instances: 1,
  exec_mode: 'fork',
  
  // Auto-restart
  autorestart: true,           // ✅ Restart en crash
  max_restarts: 10,            // ✅ Máximo 10 restarts en min_uptime
  min_uptime: '10s',           // ✅ Uptime mínimo para no contar como crash
  
  // Memoria
  max_memory_restart: '300M',  // ✅ Restart si excede 300 MB
  
  // Watch (deshabilitado en producción)
  watch: false,                // ✅ No watch files
  
  // Logs
  error_file: '/root/.pm2/logs/leadmaster-hub-error.log',
  out_file: '/root/.pm2/logs/leadmaster-hub-out.log',
  log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
  merge_logs: true,
  
  // Graceful shutdown
  kill_timeout: 5000,          // ✅ 5 segundos para SIGTERM
  wait_ready: true,            // ✅ Espera señal process.send('ready')
  listen_timeout: 10000        // ✅ 10 segundos para que app envíe 'ready'
}
```

**Justificación de valores:**

| Parámetro | Valor | Razón |
|-----------|-------|-------|
| `autorestart` | `true` | Backend debe auto-recuperarse en crash |
| `max_restarts` | `10` | Previene restart loops infinitos |
| `min_uptime` | `10s` | App debe correr 10s para ser "estable" |
| `max_memory_restart` | `300M` | Previene memory leaks (Express apps ~50-150MB) |
| `watch` | `false` | Evita restarts accidentales en producción |
| `kill_timeout` | `5s` | Graceful shutdown tiene 5s para cerrar conexiones |
| `wait_ready` | `true` | PM2 espera señal de que app está lista |
| `listen_timeout` | `10s` | Tiempo máximo para enviar 'ready' (DB puede tardar) |

---

## Graceful Shutdown (src/index.js)

El backend ahora maneja correctamente:

```javascript
// SIGTERM: PM2 restart/reload
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// SIGINT: Ctrl+C manual
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Uncaught exceptions: loguea pero NO crash (PM2 decide)
process.on('uncaughtException', (error) => {
  console.error('❌ UNCAUGHT EXCEPTION:', error);
  // PM2 reinicia si max_memory_restart o max_restarts excedidos
});

// Unhandled promises: loguea pero NO crash
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ UNHANDLED REJECTION:', reason);
});
```

**Flujo de cierre:**
1. PM2 envía SIGTERM
2. App cierra servidor Express (deja de aceptar nuevas conexiones)
3. Espera hasta 5 segundos a que terminen requests activos
4. Si no termina, fuerza cierre a los 10 segundos
5. PM2 confirma proceso terminado y puede iniciar nuevo

---

## Troubleshooting

### Proceso crashea inmediatamente

```bash
# Ver error exacto
pm2 logs leadmaster-hub --err --lines 50 --nostream

# Revisar último error
tail -n 100 /root/.pm2/logs/leadmaster-hub-error.log
```

**Errores comunes:**

| Error | Causa | Solución |
|-------|-------|----------|
| `ECONNREFUSED DB` | MySQL inalcanzable | Verificar .env DB_HOST/USER/PASSWORD |
| `Cannot find module` | npm install faltante | `npm install` en central-hub |
| `EADDRINUSE :3012` | Puerto ocupado | `netstat -tulpn \| grep 3012` y kill proceso |
| `SyntaxError` | Error de código | `git log`, rollback commit malo |

### Proceso online pero no responde

```bash
# Test healthcheck
curl http://localhost:3012/health

# Ver recursos
pm2 show leadmaster-hub

# Si usa > 280 MB, está cerca del límite
# PM2 lo reiniciará automáticamente en 300 MB
```

### Logs vacíos

```bash
# Verificar permisos
ls -la /root/.pm2/logs/

# Verificar que PM2 escribe
pm2 logs leadmaster-hub --lines 5

# Si no hay logs, reiniciar
pm2 restart leadmaster-hub
```

### No arranca después de reboot

```bash
# Verificar servicio systemd
systemctl status pm2-root

# Si está inactivo
sudo systemctl start pm2-root

# Ver procesos
pm2 list

# Si lista está vacía, restaurar
pm2 resurrect

# Si no funciona, volver a configurar
pm2 startup systemd
# Ejecutar comando que muestra
pm2 save
```

---

## Checklist Post-Deployment

Ejecutar en orden:

```bash
# 1. Proceso online
pm2 list | grep leadmaster-hub | grep online

# 2. Logs sin errores
pm2 logs leadmaster-hub --err --lines 20 --nostream

# 3. Healthcheck responde
curl -f http://localhost:3012/health

# 4. Configuración guardada
grep leadmaster-hub /root/.pm2/dump.pm2

# 5. Systemd activo
systemctl is-active pm2-root

# 6. Test graceful shutdown
pm2 restart leadmaster-hub && sleep 2 && pm2 logs leadmaster-hub --lines 10 --nostream
```

**Resultado esperado:**
```
✅ leadmaster-hub │ online
✅ No hay errores en logs
✅ {"status":"healthy","service":"central-hub"}
✅ "name":"leadmaster-hub" presente en dump.pm2
✅ active
✅ Logs muestran "Server running on port 3012" después del restart
```

---

## Comandos Rápidos

```bash
# Ver estado
pm2 status

# Ver logs (últimas 30 líneas)
pm2 logs leadmaster-hub --lines 30 --nostream

# Restart
pm2 restart leadmaster-hub

# Test healthcheck
curl http://localhost:3012/health

# Ver memoria
pm2 show leadmaster-hub | grep memory

# Limpiar logs
pm2 flush leadmaster-hub

# Guardar estado actual
pm2 save
```

---

## Notas Importantes

1. **NUNCA** ejecutar `pm2 delete leadmaster-hub` en producción sin backup
2. **SIEMPRE** ejecutar `pm2 save` después de `pm2 start`
3. **SIEMPRE** verificar logs después de `pm2 restart`
4. **Graceful shutdown** requiere `wait_ready: true` + `process.send('ready')` en código
5. **max_memory_restart** previene memory leaks silenciosos
6. **Logs** están en `/root/.pm2/logs/leadmaster-hub-*.log`
7. **Systemd** debe estar enabled para auto-start en reboot

---

**Fin de la guía**
