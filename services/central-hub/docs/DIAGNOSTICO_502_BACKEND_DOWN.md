# Diagnóstico: Backend Down - 502 Bad Gateway

**Fecha**: 5 de enero de 2026  
**Sistema**: leadmaster-central-hub  
**Servidor**: VPS Linux con PM2  
**Síntoma**: Frontend login retorna HTTP 502 Bad Gateway

---

## 🔴 ROOT CAUSE

**PM2 NO tiene procesos corriendo. El backend `leadmaster-hub` nunca fue iniciado o fue detenido manualmente.**

---

## EVIDENCIA RECOLECTADA

### ✅ Archivos y Configuración OK

| Componente | Estado | Ubicación |
|------------|--------|-----------|
| ecosystem.config.js | ✓ Existe | `/root/leadmaster-workspace/ecosystem.config.js` |
| src/index.js | ✓ Existe | `/root/leadmaster-workspace/services/central-hub/src/index.js` |
| .env | ✓ Configurado | PORT=3012, DB configurada |
| Puerto 3012 | ✓ Libre | No hay conflicto |
| Node modules | ✓ Instalados | package.json presente |

**Configuración ecosystem.config.js**:
```javascript
{
  name: 'leadmaster-hub',
  cwd: '/root/leadmaster-workspace/services/central-hub',
  script: 'src/index.js',
  instances: 1,
  exec_mode: 'fork',
  env: { NODE_ENV: 'production' }
}
```

**Variables de entorno (.env)**:
```
DB_HOST=sv46.byethost46.org
DB_USER=iunaorg_b3toh
DB_PASSWORD=elgeneral2018
DB_NAME=iunaorg_dyd
DB_PORT=3306
PORT=3012
```

### ❌ Proceso Ausente

**Comando ejecutado**: `pm2 list`
```
┌────┬────────────────────┬──────────┬──────┬───────────┬──────────┬──────────┐
│ id │ name               │ mode     │ ↺    │ status    │ cpu      │ memory   │
└────┴────────────────────┴──────────┴──────┴───────────┴──────────┴──────────┘
```
**Resultado**: Lista vacía (0 procesos)

**Logs PM2** (`pm2 logs --lines 30`):
- Último proceso activo: `session-manager-51` (diferente aplicación)
- Fecha: 4 de enero de 2026, 09:30:32
- Estado: Detenido con `SIGINT` (stop manual)
- **NO hay registros de `leadmaster-hub`**

**PM2 Dump** (`/root/.pm2/dump.pm2`):
- Contiene solo: `crud-bares` (otra aplicación, stopped)
- **NO contiene `leadmaster-hub`**

**Conclusión**: El proceso `leadmaster-hub` nunca fue iniciado en esta sesión de PM2.

### ✅ Red y Puertos

**Comando**: `netstat -tulpn | grep :3012`  
**Resultado**: Puerto 3012 está **libre** (no hay conflicto)

**Comando**: `pm2 startup`  
**Resultado**: PM2 startup NO está configurado correctamente para reinicio automático

---

## RESTAURACIÓN DEL SERVICIO

### PASO 1: Iniciar Backend con PM2

```bash
# Navegar al workspace root
cd /root/leadmaster-workspace

# Iniciar usando ecosystem.config.js
pm2 start ecosystem.config.js

# Verificar estado
pm2 status
```

**Resultado esperado**:
```
┌────┬─────────────────┬─────────┬─────────┬─────────┬──────────┬────────┬──────┬───────────┐
│ id │ name            │ mode    │ ↺       │ status  │ cpu      │ memory │      │           │
├────┼─────────────────┼─────────┼─────────┼─────────┼──────────┼────────┼──────┼───────────┤
│ 0  │ leadmaster-hub  │ fork    │ 0       │ online  │ 0%       │ 50.0mb │      │           │
└────┴─────────────────┴─────────┴─────────┴─────────┴──────────┴────────┴──────┴───────────┘
```

---

### PASO 2: Verificar Logs Inmediatamente

```bash
# Ver últimos 50 líneas de logs (sin streaming)
pm2 logs leadmaster-hub --lines 50 --nostream

# Si necesitas monitoreo en tiempo real
pm2 logs leadmaster-hub
# (Ctrl+C para salir)
```

**Indicadores clave a buscar**:

| Log | Significado | Acción |
|-----|------------|--------|
| `Server running on port 3012` | ✅ Arranque exitoso | Continuar con PASO 3 |
| `ECONNREFUSED` | ❌ Base de datos inalcanzable | Ver sección "Error de Base de Datos" |
| `EADDRINUSE :3012` | ❌ Puerto ocupado | Verificar con `netstat -tulpn \| grep :3012` |
| `Cannot find module 'express'` | ❌ Dependencia faltante | Ejecutar `npm install` |
| `SyntaxError` | ❌ Error de código | Ver sección "Error de Código" |

---

### PASO 3: Habilitar Reinicio Automático en Reboot

```bash
# 1. Guardar configuración actual de PM2
pm2 save

# 2. Configurar PM2 para arrancar con el sistema
pm2 startup systemd

# 3. Ejecutar el comando que PM2 muestra
# Ejemplo de output:
# [PM2] You have to run this command as root. Execute the following command:
# sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u root --hp /root

# 4. Copiar y ejecutar ese comando

# 5. Verificar servicio systemd
systemctl status pm2-root
```

**Resultado esperado**:
```
● pm2-root.service - PM2 process manager
     Loaded: loaded (/etc/systemd/system/pm2-root.service; enabled; vendor preset: enabled)
     Active: active (running) since Sun 2026-01-05 10:00:00 CST; 1min ago
```

---

### PASO 4: Test del Backend

```bash
# Test básico de conectividad
curl http://localhost:3012/

# Test del endpoint de auth (ejemplo)
curl -X POST http://localhost:3012/auth/login \
  -H "Content-Type: application/json" \
  -d '{"usuario":"test","password":"test"}'
```

**Si responde**: ✅ Backend está operativo  
**Si no responde**: Ver sección "Árbol de Decisión" abajo

---

## ÁRBOL DE DECISIÓN POST-START

### ESCENARIO A: Proceso arranca y queda "online" ✅

```bash
# 1. Verificar respuesta del backend
curl http://localhost:3012/

# 2. Si responde → Backend OK
# El problema está en:
# - Frontend apuntando a URL incorrecta
# - Nginx/proxy reverso mal configurado
# - Cloudflare/firewall bloqueando

# 3. Verificar configuración Nginx
cat /etc/nginx/sites-enabled/desarrolloydisenioweb.com.ar.conf | grep -A 5 "location /api"

# 4. Verificar CORS en backend
# Debe permitir el origen del frontend
```

**Checklist de verificación**:
- [ ] Nginx configurado con proxy_pass a `http://localhost:3012`
- [ ] Frontend apunta a URL correcta (ej: `/api/auth/login`)
- [ ] CORS habilitado en backend para origen del frontend
- [ ] Cloudflare/firewall permite tráfico al backend

---

### ESCENARIO B: Proceso crashea inmediatamente ❌

#### B1. Error de Base de Datos

**Síntoma en logs**:
```
Error: connect ETIMEDOUT sv46.byethost46.org:3306
Error: ER_ACCESS_DENIED_ERROR
```

**Diagnóstico**:
```bash
# 1. Verificar conectividad a MySQL
telnet sv46.byethost46.org 3306

# 2. Test de conexión MySQL
mysql -h sv46.byethost46.org -u iunaorg_b3toh -pelgeneral2018 iunaorg_dyd

# 3. Verificar credenciales en .env
cat /root/leadmaster-workspace/services/central-hub/.env | grep DB_
```

**Soluciones**:
- Si timeout → Verificar firewall del servidor DB o IP whitelisting
- Si access denied → Verificar credenciales en .env
- Si base no existe → Crear base de datos o corregir DB_NAME

---

#### B2. Dependencias Faltantes

**Síntoma en logs**:
```
Error: Cannot find module 'express'
Error: Cannot find module 'mysql2'
```

**Solución**:
```bash
cd /root/leadmaster-workspace/services/central-hub

# Instalar dependencias
npm install

# Reiniciar proceso PM2
pm2 restart leadmaster-hub

# Verificar logs
pm2 logs leadmaster-hub --lines 20
```

---

#### B3. Error de Código

**Síntoma en logs**:
```
SyntaxError: Unexpected token '}'
ReferenceError: variable is not defined
```

**Diagnóstico**:
```bash
# Ver últimos commits
git log --oneline -5

# Ver cambios recientes
git diff HEAD~1 src/index.js
git diff HEAD~1 src/

# Ver rama actual
git branch
```

**Solución temporal (rollback)**:
```bash
# Volver al commit anterior
git checkout HEAD~1 src/index.js

# O cambiar a rama estable
git checkout main

# Reinstalar dependencias por si acaso
npm install

# Reiniciar PM2
pm2 restart leadmaster-hub
```

---

#### B4. Conflicto de Puerto

**Síntoma en logs**:
```
Error: listen EADDRINUSE: address already in use :::3012
```

**Diagnóstico**:
```bash
# Verificar qué proceso usa el puerto
netstat -tulpn | grep :3012
# O con lsof
lsof -i :3012

# Ejemplo de output:
# tcp    0    0 0.0.0.0:3012    0.0.0.0:*    LISTEN    12345/node
```

**Solución**:
```bash
# Opción 1: Matar el proceso conflictivo
kill -9 12345

# Opción 2: Cambiar puerto en .env
nano /root/leadmaster-workspace/services/central-hub/.env
# PORT=3013

# Reiniciar PM2
pm2 restart leadmaster-hub
```

---

### ESCENARIO C: Proceso queda en estado "errored" ❌

```bash
# 1. Ver detalles del error
pm2 logs leadmaster-hub --err --lines 100

# 2. Ver información completa del proceso
pm2 show leadmaster-hub

# 3. Reiniciar en modo debug
pm2 delete leadmaster-hub
NODE_ENV=development pm2 start ecosystem.config.js --log-date-format 'YYYY-MM-DD HH:mm:ss.SSS'

# 4. Monitorear logs en vivo
pm2 logs leadmaster-hub
```

---

## COMANDOS ÚTILES DE PM2

### Gestión Básica

```bash
# Ver estado de todos los procesos
pm2 status

# Ver logs (últimas 100 líneas)
pm2 logs leadmaster-hub --lines 100

# Ver solo errores
pm2 logs leadmaster-hub --err

# Reiniciar proceso
pm2 restart leadmaster-hub

# Detener proceso
pm2 stop leadmaster-hub

# Eliminar proceso de PM2
pm2 delete leadmaster-hub

# Reiniciar TODOS los procesos
pm2 restart all
```

### Monitoreo

```bash
# Dashboard interactivo
pm2 monit

# Ver info detallada de un proceso
pm2 show leadmaster-hub

# Ver uso de recursos
pm2 list
```

### Persistencia

```bash
# Guardar configuración actual
pm2 save

# Configurar auto-start en reboot
pm2 startup systemd

# Deshabilitar auto-start
pm2 unstartup systemd

# Ver procesos guardados
cat /root/.pm2/dump.pm2
```

### Logs

```bash
# Logs en tiempo real
pm2 logs leadmaster-hub

# Logs sin streaming (últimas N líneas)
pm2 logs leadmaster-hub --lines 50 --nostream

# Solo stdout
pm2 logs leadmaster-hub --out

# Solo stderr
pm2 logs leadmaster-hub --err

# Limpiar logs
pm2 flush leadmaster-hub
```

---

## CAUSAS COMUNES DEL 502 BAD GATEWAY

| Síntoma | Causa Raíz | Verificación | Solución |
|---------|-----------|--------------|----------|
| PM2 lista vacía | Proceso nunca iniciado o detenido | `pm2 list` | `pm2 start ecosystem.config.js` |
| Proceso "errored" | Error en código o configuración | `pm2 logs --err` | Ver logs y corregir error |
| Puerto incorrecto | Frontend apunta a puerto equivocado | Comparar `.env PORT` vs config frontend | Alinear puertos |
| Nginx sin proxy | Proxy pass no configurado | `cat /etc/nginx/sites-enabled/*` | Configurar proxy_pass |
| DB inalcanzable | MySQL remota caída o timeout | `telnet host 3306` | Verificar DB server |
| CORS bloqueado | Backend rechaza origen | Logs backend + Network tab browser | Configurar CORS |
| Firewall | Puerto cerrado externamente | `ufw status` | Abrir puerto en firewall |
| Dependencias | node_modules faltantes | `npm list` | `npm install` |

---

## CHECKLIST DE VALIDACIÓN POST-RESTAURACIÓN

### Backend (PM2)
- [ ] `pm2 list` muestra `leadmaster-hub` en estado "online"
- [ ] `pm2 logs leadmaster-hub` muestra "Server running on port 3012"
- [ ] `curl http://localhost:3012/` responde (200, 404, cualquier respuesta HTTP)
- [ ] `pm2 save` ejecutado
- [ ] `pm2 startup systemd` configurado
- [ ] `systemctl status pm2-root` muestra "active (running)"

### Conectividad
- [ ] `telnet sv46.byethost46.org 3306` conecta (si usa MySQL remota)
- [ ] `netstat -tulpn | grep :3012` muestra proceso escuchando
- [ ] No hay conflictos de puerto
- [ ] .env tiene configuración correcta

### Integración
- [ ] Frontend puede hacer login (test desde navegador)
- [ ] Nginx proxy_pass configurado (si aplica)
- [ ] CORS permite origen del frontend
- [ ] Network tab del browser muestra respuestas del backend (no 502)

---

## PRÓXIMOS PASOS (EN ORDEN)

### 1. Iniciar Backend
```bash
cd /root/leadmaster-workspace
pm2 start ecosystem.config.js
```

### 2. Verificar Logs
```bash
pm2 logs leadmaster-hub --lines 50 --nostream
```

### 3. Test Local
```bash
curl http://localhost:3012/
```

### 4. Persistencia
```bash
pm2 save
pm2 startup systemd
# Ejecutar comando que PM2 muestra
```

### 5. Test desde Frontend
- Abrir browser
- Intentar login
- Verificar Network tab (F12)
- Buscar respuestas del backend

---

## TIEMPO ESTIMADO DE RESTAURACIÓN

| Escenario | Tiempo |
|-----------|--------|
| Simple start (sin errores) | 30 segundos |
| Con errores de configuración | 5-10 minutos |
| Con errores de código | 10-30 minutos |
| Con errores de DB | 15-60 minutos |

---

## CONTACTOS Y RECURSOS

**Logs importantes**:
- PM2 logs: `/root/.pm2/logs/leadmaster-hub-out.log`
- PM2 errors: `/root/.pm2/logs/leadmaster-hub-error.log`
- PM2 config: `/root/.pm2/dump.pm2`

**Archivos clave**:
- Ecosystem: `/root/leadmaster-workspace/ecosystem.config.js`
- Entry point: `/root/leadmaster-workspace/services/central-hub/src/index.js`
- Variables: `/root/leadmaster-workspace/services/central-hub/.env`
- Package: `/root/leadmaster-workspace/services/central-hub/package.json`

**Documentación**:
- PM2: https://pm2.keymetrics.io/docs/usage/quick-start/
- Systemd integration: https://pm2.keymetrics.io/docs/usage/startup/

---

## RESUMEN EJECUTIVO

🔴 **Problema**: Backend `leadmaster-hub` NO está corriendo en PM2  
🔍 **Causa**: Proceso nunca fue iniciado o fue detenido manualmente  
✅ **Configuración**: ecosystem.config.js + src/index.js + .env OK  
✅ **Puerto**: 3012 está libre (no hay conflicto)  
🔧 **Solución**: `pm2 start ecosystem.config.js` desde `/root/leadmaster-workspace`  
⏱️ **ETA**: 30 segundos si no hay errores de código/DB  
🎯 **Objetivo**: Estado "online" en `pm2 list` + logs sin errores

---

**Fin del diagnóstico**  
**Generado**: 5 de enero de 2026
