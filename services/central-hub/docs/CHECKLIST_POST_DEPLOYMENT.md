# Checklist Post-Deployment - LeadMaster Central Hub

**Sistema:** leadmaster-central-hub  
**Última actualización:** 5 de enero de 2026

---

## 📋 PRE-DEPLOYMENT

### Código y Repositorio

- [ ] Branch feature mergeada a `main`
- [ ] Tests unitarios pasando: `npm run test:unit`
- [ ] Tests E2E pasando: `npm run test:e2e` (opcional)
- [ ] No hay errores de lint o typescript
- [ ] Código commiteado y pusheado: `git status` limpio

### Servidor

- [ ] Acceso SSH al servidor funcional
- [ ] Usuario root o sudo disponible
- [ ] PM2 instalado: `pm2 --version`
- [ ] Node.js >= 14.x: `node --version`
- [ ] Git instalado: `git --version`

### Variables de Entorno

- [ ] Archivo `.env` existe en `/root/leadmaster-workspace/services/central-hub/`
- [ ] `DB_HOST` configurado correctamente
- [ ] `DB_USER` configurado correctamente
- [ ] `DB_PASSWORD` configurado correctamente
- [ ] `DB_NAME` configurado correctamente
- [ ] `DB_PORT` configurado (default: 3306)
- [ ] `PORT` configurado (default: 3012)
- [ ] `SESSION_MANAGER_BASE_URL` configurado (si aplica)
- [ ] `JWT_SECRET` configurado (si usa autenticación)

---

## 🚀 DEPLOYMENT

### 1. Pull Código

```bash
cd /root/leadmaster-workspace/services/central-hub
git pull origin main
```

**Verificaciones:**
- [ ] Pull exitoso sin conflictos
- [ ] Branch actual es `main`: `git branch --show-current`

---

### 2. Instalar Dependencias

```bash
npm install
```

**Verificaciones:**
- [ ] `npm install` sin errores
- [ ] `node_modules/` existe y tiene contenido
- [ ] `package-lock.json` actualizado

---

### 3. Iniciar/Reiniciar PM2

#### Si es primera vez (proceso NO existe)

```bash
cd /root/leadmaster-workspace
pm2 start ecosystem.config.js
```

#### Si proceso ya existe

```bash
cd /root/leadmaster-workspace
pm2 restart leadmaster-hub
```

**Verificaciones:**
- [ ] Comando ejecutado sin errores
- [ ] Esperar 5 segundos antes de continuar

---

### 4. Verificar Estado PM2

```bash
pm2 status
```

**Verificaciones:**
- [ ] Proceso `leadmaster-hub` aparece en la lista
- [ ] Estado es `online` (NO `errored`, `stopped`, `launching`)
- [ ] Uptime > 0 segundos
- [ ] Restarts = 0 (no debe crashear inmediatamente)

**Output esperado:**
```
┌────┬─────────────────┬─────────┬─────────┬─────────┬──────────┬────────┐
│ id │ name            │ mode    │ ↺       │ status  │ cpu      │ memory │
├────┼─────────────────┼─────────┼─────────┼─────────┼──────────┼────────┤
│ 0  │ leadmaster-hub  │ fork    │ 0       │ online  │ 0%       │ 50.0mb │
└────┴─────────────────┴─────────┴─────────┴─────────┴──────────┴────────┘
```

---

### 5. Revisar Logs

#### Ver últimas líneas (sin streaming)

```bash
pm2 logs leadmaster-hub --lines 30 --nostream
```

**Verificaciones:**
- [ ] Log muestra: `🚀 Leadmaster Central Hub corriendo en http://localhost:3012`
- [ ] NO hay errores en stderr
- [ ] NO hay `ECONNREFUSED` (DB inalcanzable)
- [ ] NO hay `EADDRINUSE` (puerto ocupado)
- [ ] NO hay `Cannot find module` (dependencias faltantes)
- [ ] NO hay `SyntaxError` (error de código)

#### Ver solo errores

```bash
pm2 logs leadmaster-hub --err --lines 20 --nostream
```

**Verificaciones:**
- [ ] NO hay logs de error recientes (últimos 30 segundos)
- [ ] Si hay warnings, documentar y evaluar criticidad

---

### 6. Test de Conectividad Local

#### Test básico del servidor

```bash
curl -f http://localhost:3012/health
```

**Verificaciones:**
- [ ] Responde HTTP 200 OK
- [ ] JSON válido
- [ ] Contiene `"status": "healthy"`

**Output esperado:**
```json
{
  "status": "healthy",
  "service": "central-hub",
  "timestamp": "2026-01-05T10:00:00.000Z"
}
```

#### Test con formato

```bash
curl -s http://localhost:3012/health | jq .
```

**Verificaciones:**
- [ ] jq parsea JSON correctamente
- [ ] Timestamp es reciente (< 1 minuto de diferencia)

---

### 7. Guardar Configuración PM2

```bash
pm2 save
```

**Verificaciones:**
- [ ] Comando ejecutado sin errores
- [ ] Output muestra: `[PM2] Saving current process list...`

#### Verificar dump.pm2

```bash
cat /root/.pm2/dump.pm2 | grep leadmaster-hub
```

**Verificaciones:**
- [ ] Archivo contiene entrada con `"name":"leadmaster-hub"`
- [ ] Estado guardado es `"status":"online"`

---

### 8. Configurar Auto-Start (Primera vez solamente)

#### Generar comando de startup

```bash
pm2 startup systemd
```

**Verificaciones:**
- [ ] PM2 muestra comando para copiar/ejecutar
- [ ] Comando tiene formato: `sudo env PATH=$PATH:... pm2 startup systemd -u root --hp /root`

#### Ejecutar comando mostrado por PM2

```bash
# Copiar y ejecutar el comando EXACTO que PM2 muestra
# Ejemplo:
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u root --hp /root
```

**Verificaciones:**
- [ ] Comando ejecutado sin errores
- [ ] Output muestra: `[PM2] Writing init configuration in /etc/systemd/system/pm2-root.service`

#### Verificar servicio systemd

```bash
systemctl status pm2-root
```

**Verificaciones:**
- [ ] Servicio existe
- [ ] Estado es `active (exited)` o `active (running)`
- [ ] `Loaded:` muestra `enabled` (auto-start habilitado)

**Output esperado:**
```
● pm2-root.service - PM2 process manager
     Loaded: loaded (/etc/systemd/system/pm2-root.service; enabled)
     Active: active (exited) since Sun 2026-01-05 10:00:00 CST; 1min ago
```

---

### 9. Test de Graceful Shutdown

```bash
pm2 restart leadmaster-hub
sleep 2
pm2 logs leadmaster-hub --lines 10 --nostream
```

**Verificaciones:**
- [ ] Log muestra: `⚠️ SIGTERM recibido. Cerrando servidor...`
- [ ] Log muestra: `✅ Servidor cerrado correctamente`
- [ ] Log muestra: `🚀 Leadmaster Central Hub corriendo en...` (nuevo inicio)
- [ ] Proceso vuelve a estado `online`
- [ ] NO hay errores durante shutdown

---

## ✅ POST-DEPLOYMENT

### 10. Test Funcional Básico (desde servidor)

#### Test endpoint de autenticación

```bash
curl -X POST http://localhost:3012/auth/login \
  -H "Content-Type: application/json" \
  -d '{"usuario":"test","password":"test"}'
```

**Verificaciones:**
- [ ] Responde (aunque sea 401 Unauthorized es OK)
- [ ] NO responde 502 Bad Gateway
- [ ] NO responde timeout

#### Test frontend (si está en el mismo servidor)

```bash
curl -I http://localhost:3012/
```

**Verificaciones:**
- [ ] Responde HTTP 200 OK
- [ ] Content-Type es `text/html` (frontend estático)

---

### 11. Test desde Cliente Externo

#### Desde tu máquina local

```bash
curl -f https://desarrolloydisenioweb.com.ar/api/health
```

**Verificaciones:**
- [ ] Responde HTTP 200 OK
- [ ] JSON con `"status": "healthy"`
- [ ] Responde en < 2 segundos

#### Desde navegador

```
https://desarrolloydisenioweb.com.ar/
```

**Verificaciones:**
- [ ] Frontend carga correctamente
- [ ] NO hay error 502 Bad Gateway
- [ ] Console del navegador (F12) sin errores de red
- [ ] Login funciona (test básico)

---

### 12. Monitoreo Continuo (primeros 5 minutos)

#### Ver logs en tiempo real

```bash
pm2 logs leadmaster-hub
```

**Verificaciones (durante 5 minutos):**
- [ ] NO hay crashes (restarts automáticos)
- [ ] NO hay errores recurrentes en logs
- [ ] Memoria se mantiene estable (< 80% de 300M)
- [ ] Proceso permanece en estado `online`

#### Verificar recursos

```bash
pm2 show leadmaster-hub
```

**Verificaciones:**
- [ ] Uptime > 5 minutos
- [ ] Memory < 240 MB (80% de 300M)
- [ ] Restarts = 0

---

### 13. Nginx / Proxy Reverso (si aplica)

#### Verificar configuración Nginx

```bash
cat /etc/nginx/sites-enabled/desarrolloydisenioweb.com.ar.conf | grep -A 5 "location /api"
```

**Verificaciones:**
- [ ] `proxy_pass` apunta a `http://localhost:3012`
- [ ] Headers `X-Real-IP`, `X-Forwarded-For` configurados
- [ ] Configuración existe y es correcta

#### Recargar Nginx (si se hicieron cambios)

```bash
sudo nginx -t
sudo systemctl reload nginx
```

**Verificaciones:**
- [ ] `nginx -t` muestra `syntax is ok`
- [ ] Reload exitoso sin errores

---

### 14. Base de Datos

#### Verificar conectividad MySQL

```bash
telnet sv46.byethost46.org 3306
# Ctrl+C para salir
```

**Verificaciones:**
- [ ] Conecta exitosamente
- [ ] NO hay timeout

#### Test de query (opcional)

```bash
mysql -h sv46.byethost46.org -u iunaorg_b3toh -pelgeneral2018 iunaorg_dyd -e "SELECT 1"
```

**Verificaciones:**
- [ ] Query ejecuta sin errores
- [ ] Retorna resultado

---

## 🔍 VALIDACIÓN FINAL

### Checklist de Estado del Sistema

Ejecutar todos estos comandos en secuencia:

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

**Resultado esperado de cada comando:**

1. ✅ Output contiene: `leadmaster-hub │ online`
2. ✅ Sin output de errores (o solo warnings menores)
3. ✅ JSON: `{"status":"healthy","service":"central-hub",...}`
4. ✅ JSON contiene: `"name":"leadmaster-hub"`
5. ✅ Output: `active`
6. ✅ Logs muestran: `🚀 Leadmaster Central Hub corriendo en...`

---

### Checklist de Funcionalidad

- [ ] Frontend carga desde navegador externo
- [ ] Login funciona (test con usuario real)
- [ ] Backend responde a requests de API
- [ ] WhatsApp QR puede generarse (si aplica)
- [ ] Envío de mensajes funciona (si aplica)

---

## ⚠️ ROLLBACK (si algo falló)

### Indicadores de que debes hacer rollback

- ❌ Proceso crashea repetidamente (restarts > 5)
- ❌ Logs muestran errores críticos (DB, módulos faltantes)
- ❌ Frontend no carga (502 Bad Gateway persistente)
- ❌ Test básico de API falla

### Procedimiento de Rollback

```bash
# 1. Detener proceso actual
pm2 stop leadmaster-hub

# 2. Volver al commit anterior
cd /root/leadmaster-workspace/services/central-hub
git log --oneline -5
git checkout <commit-hash-anterior>

# 3. Reinstalar dependencias
npm install

# 4. Reiniciar PM2
cd /root/leadmaster-workspace
pm2 restart leadmaster-hub

# 5. Verificar logs
pm2 logs leadmaster-hub --lines 20 --nostream

# 6. Test healthcheck
curl -f http://localhost:3012/health
```

---

## 📊 MÉTRICAS POST-DEPLOYMENT (primeras 24 horas)

### Comandos de Monitoreo

```bash
# Cada hora, revisar:

# 1. Estado del proceso
pm2 status

# 2. Uso de memoria
pm2 show leadmaster-hub | grep memory

# 3. Restarts
pm2 show leadmaster-hub | grep restarts

# 4. Errores en logs
pm2 logs leadmaster-hub --err --lines 50 --nostream
```

### Alertas a Configurar

- ⚠️ Si restarts > 3 en 1 hora → Investigar causa
- ⚠️ Si memoria > 250 MB → Investigar memory leak
- ⚠️ Si errores de DB > 10 por minuto → Revisar conectividad
- ⚠️ Si CPU > 80% por > 5 minutos → Investigar load

---

## 📞 CONTACTOS Y ESCALAMIENTO

### Errores Comunes y Soluciones Rápidas

| Error | Solución Rápida | Escalamiento |
|-------|-----------------|--------------|
| 502 Bad Gateway | `pm2 restart leadmaster-hub` | Si persiste, revisar logs y rollback |
| ECONNREFUSED DB | Verificar MySQL corriendo | Contactar proveedor DB |
| Memory > 300M | `pm2 restart leadmaster-hub` | Investigar memory leak en código |
| Proceso stopped | `pm2 start leadmaster-hub` | Revisar logs de crash |

### Logs Importantes

- PM2 stdout: `/root/.pm2/logs/leadmaster-hub-out.log`
- PM2 stderr: `/root/.pm2/logs/leadmaster-hub-error.log`
- Nginx access: `/var/log/nginx/access.log`
- Nginx error: `/var/log/nginx/error.log`

---

## ✅ FIRMA DE APROBACIÓN

**Deployment completado por:** _______________  
**Fecha/Hora:** _______________  
**Commit hash:** _______________  
**Todos los checks pasaron:** [ ] Sí [ ] No  
**Observaciones:** _______________

---

**FIN DEL CHECKLIST**

**IMPORTANTE:** Guarda este checklist en el historial de deployments para referencia futura.
