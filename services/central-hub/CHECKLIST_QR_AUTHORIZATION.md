# ✅ Checklist Ejecutiva - QR Authorization System

## 🎯 Objetivo
Implementar control de autorización temporal para escaneo de QR WhatsApp con persistencia en MySQL.

---

## 📊 Estado del Proyecto

- [ ] **FASE 1 COMPLETA** (Autorización Básica)
- [ ] **FASE 2 COMPLETA** (Enforcement + Automatización)
- [ ] **PRODUCCIÓN** (Deployed)

---

## 🏗️ FASE 1: Autorización Básica (MVP)

### 1. Base de Datos

- [ ] Migration ejecutada: `001_create_whatsapp_qr_sessions.sql`
  ```bash
  mysql -u root -p leadmaster < migrations/001_create_whatsapp_qr_sessions.sql
  ```

- [ ] Tabla creada correctamente
  ```sql
  DESCRIBE whatsapp_qr_sessions;
  ```

- [ ] Índices verificados (4 índices)
  ```sql
  SHOW INDEX FROM whatsapp_qr_sessions;
  ```

### 2. Backend - Servicios

- [ ] Archivo: `src/services/qrAuthorizationService.js`
- [ ] Métodos implementados:
  - [ ] `createAuthorization(clienteId, adminId, durationMinutes)`
  - [ ] `checkAuthorization(clienteId)`
  - [ ] `revokeAuthorization(clienteId, adminId)`
  - [ ] `getActiveSession(clienteId)`
  - [ ] `listActiveSessions()`
  - [ ] `cleanExpiredSessions()`

### 3. Backend - Middleware

- [ ] Archivo: `src/middleware/adminMiddleware.js`
- [ ] Función: `requireAdmin(req, res, next)`
- [ ] Verifica: `req.user.role === 'admin'`

### 4. Backend - Rutas Admin

- [ ] Archivo: `src/routes/adminWhatsappRoutes.js`
- [ ] Endpoints implementados:
  - [ ] `POST /admin/whatsapp/authorize-qr`
  - [ ] `DELETE /admin/whatsapp/:clienteId/qr`
  - [ ] `GET /admin/whatsapp/qr-sessions`
- [ ] Middleware aplicado: `authenticate` + `requireAdmin`

### 5. Backend - Registro

- [ ] Rutas registradas en `src/index.js`
  ```javascript
  app.use('/admin/whatsapp', adminWhatsappRoutes);
  ```

### 6. Testing Fase 1

#### Test 1: Autorizar QR (Admin)
```bash
curl -X POST http://localhost:3012/admin/whatsapp/authorize-qr \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"clienteId": 51, "durationMinutes": 60}'
```
- [ ] Respuesta: 200 con `authorization { id, expiresAt }`

#### Test 2: Listar Sesiones
```bash
curl http://localhost:3012/admin/whatsapp/qr-sessions \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
- [ ] Respuesta: 200 con array de `sessions`

#### Test 3: Revocar Autorización
```bash
curl -X DELETE http://localhost:3012/admin/whatsapp/51/qr \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
- [ ] Respuesta: 200 con mensaje de confirmación

#### Test 4: Seguridad - Cliente intenta autorizar
```bash
curl -X POST http://localhost:3012/admin/whatsapp/authorize-qr \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CLIENT_TOKEN" \
  -d '{"clienteId": 51, "durationMinutes": 60}'
```
- [ ] Respuesta: 403 Forbidden

#### Test 5: Seguridad - Sin token
```bash
curl -X POST http://localhost:3012/admin/whatsapp/authorize-qr \
  -H "Content-Type: application/json" \
  -d '{"clienteId": 51, "durationMinutes": 60}'
```
- [ ] Respuesta: 401 Unauthorized

### 7. Verificación en MySQL

```sql
-- Ver todas las sesiones
SELECT * FROM whatsapp_qr_sessions ORDER BY id DESC LIMIT 10;
```
- [ ] Registros creados correctamente
- [ ] Campos `enabled_at`, `expires_at` con timestamps correctos
- [ ] Campo `revoked_at` NULL para activas, timestamp para revocadas

### 8. Logs

- [ ] Logs estructurados funcionando:
  - [ ] `QR_AUTHORIZATION_CREATED`
  - [ ] `QR_AUTHORIZATION_REVOKED`

---

## 🚀 FASE 2: Enforcement + Automatización

### 1. Modificar Proxy Público

- [ ] Archivo modificado: `src/routes/whatsappQrProxy.js`
- [ ] Import agregado: `const qrAuthService = require('../services/qrAuthorizationService')`
- [ ] Verificación agregada en `GET /:clienteId/qr`:
  ```javascript
  const authorized = await qrAuthService.checkAuthorization(clienteIdNum);
  if (!authorized) {
    return res.status(403).json({ error: 'QR_ACCESS_DENIED' });
  }
  ```

### 2. Cron Job

- [ ] Archivo: `src/jobs/cleanExpiredQrSessions.js`
- [ ] Función: `cleanExpiredQrSessions()`
- [ ] Limpia sesiones donde `enabled=true AND expires_at < NOW()`

### 3. Dependencias

- [ ] `node-cron` instalado
  ```bash
  npm install node-cron
  ```

### 4. Registro de Cron

- [ ] Cron registrado en `src/index.js`:
  ```javascript
  cron.schedule('*/5 * * * *', async () => {
    await cleanExpiredQrSessions();
  });
  ```
- [ ] Log de inicio visible: `"⏰ Cron job iniciado..."`

### 5. Testing Fase 2

#### Test 1: Cliente SIN autorización
```bash
curl http://localhost:3012/api/whatsapp/51/qr
```
- [ ] Respuesta: 403 `QR_ACCESS_DENIED`

#### Test 2: Admin autoriza → Cliente obtiene QR
```bash
# 1. Admin autoriza (2 minutos para testing)
curl -X POST http://localhost:3012/admin/whatsapp/authorize-qr \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"clienteId": 51, "durationMinutes": 2}'

# 2. Cliente obtiene QR inmediatamente
curl http://localhost:3012/api/whatsapp/51/qr
```
- [ ] Respuesta: 200 con `qr` (base64 o string)

#### Test 3: Expiración Automática
```bash
# Esperar 3 minutos
sleep 180

# Intentar obtener QR
curl http://localhost:3012/api/whatsapp/51/qr
```
- [ ] Respuesta: 403 `QR_ACCESS_DENIED`

#### Test 4: Cron Limpia Expiradas
- [ ] Esperar 5 minutos (o forzar ejecución)
- [ ] Verificar log: `"Cleaned X expired QR authorization(s)"`
- [ ] Verificar en MySQL:
  ```sql
  SELECT * FROM whatsapp_qr_sessions 
  WHERE enabled = false AND expires_at < NOW();
  ```

#### Test 5: Revocación Manual Funciona
```bash
# 1. Admin autoriza
curl -X POST http://localhost:3012/admin/whatsapp/authorize-qr \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"clienteId": 51, "durationMinutes": 60}'

# 2. Cliente obtiene QR (funciona)
curl http://localhost:3012/api/whatsapp/51/qr

# 3. Admin revoca
curl -X DELETE http://localhost:3012/admin/whatsapp/51/qr \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 4. Cliente intenta obtener QR (falla)
curl http://localhost:3012/api/whatsapp/51/qr
```
- [ ] Paso 2: 200 OK
- [ ] Paso 3: 200 Revoked
- [ ] Paso 4: 403 Forbidden

### 6. Logs Estructurados

- [ ] Logs funcionando:
  - [ ] `QR_AUTHORIZATION_CREATED`
  - [ ] `QR_ACCESS_DENIED` (cuando cliente intenta sin auth)
  - [ ] `QR_AUTHORIZATION_REVOKED`
  - [ ] `QR_SESSIONS_CLEANED`

### 7. Verificación en MySQL

```sql
-- Ver sesiones activas
SELECT 
  cliente_id,
  enabled,
  expires_at,
  TIMESTAMPDIFF(MINUTE, NOW(), expires_at) as remaining_min
FROM whatsapp_qr_sessions
WHERE enabled = true;

-- Ver sesiones expiradas (limpiadas por cron)
SELECT COUNT(*) FROM whatsapp_qr_sessions 
WHERE enabled = false AND expires_at < NOW();
```
- [ ] Sesiones expiradas tienen `enabled = false`
- [ ] Cron actualiza automáticamente

---

## 🧪 Testing E2E Completo

### Escenario 1: Flujo Completo Normal
1. [ ] Admin autoriza cliente (60 min)
2. [ ] Cliente escanea QR exitosamente
3. [ ] Esperan 60 minutos
4. [ ] Cliente intenta escanear QR → 403
5. [ ] Cron limpia la sesión expirada
6. [ ] MySQL muestra sesión con `enabled=false`

### Escenario 2: Revocación Manual
1. [ ] Admin autoriza cliente (60 min)
2. [ ] Cliente escanea QR exitosamente
3. [ ] Admin revoca inmediatamente
4. [ ] Cliente intenta escanear QR → 403

### Escenario 3: Intento Sin Autorización
1. [ ] Cliente (sin autorización) intenta escanear QR → 403
2. [ ] Log registra `QR_ACCESS_DENIED`

### Escenario 4: Doble Autorización
1. [ ] Admin autoriza cliente (60 min)
2. [ ] Admin intenta autorizar de nuevo → 409 Conflict
3. [ ] Solo existe UNA autorización en MySQL

---

## 📊 Métricas y Monitoreo

### Queries de Monitoreo

```sql
-- Sesiones activas ahora
SELECT COUNT(*) as active_sessions
FROM whatsapp_qr_sessions
WHERE enabled = true AND expires_at > NOW();

-- Autorizaciones creadas hoy
SELECT COUNT(*) as today_authorizations
FROM whatsapp_qr_sessions
WHERE DATE(enabled_at) = CURDATE();

-- Autorizaciones por admin (última semana)
SELECT 
  enabled_by_admin_id,
  COUNT(*) as total,
  AVG(TIMESTAMPDIFF(MINUTE, enabled_at, expires_at)) as avg_duration_min
FROM whatsapp_qr_sessions
WHERE enabled_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY enabled_by_admin_id;
```

- [ ] Query 1 ejecuta sin errores
- [ ] Query 2 ejecuta sin errores
- [ ] Query 3 ejecuta sin errores

### Logs de Monitoreo

```bash
# Ver intentos denegados
grep "QR_ACCESS_DENIED" logs/central-hub.log | tail -20

# Ver autorizaciones creadas
grep "QR_AUTHORIZATION_CREATED" logs/central-hub.log | tail -20

# Ver limpiezas del cron
grep "QR_SESSIONS_CLEANED" logs/central-hub.log | tail -10
```

- [ ] Logs accesibles y legibles
- [ ] Formato JSON estructurado

---

## 🚀 Deployment

### Pre-deployment

- [ ] Todos los tests de Fase 1 pasan
- [ ] Todos los tests de Fase 2 pasan
- [ ] Tests E2E completos pasan
- [ ] Logs verificados
- [ ] MySQL verificado
- [ ] No hay errores en consola

### Staging

- [ ] Migration ejecutada en staging
- [ ] Código deployado a staging
- [ ] Testing manual en staging
- [ ] Verificación con cliente real (opcional)

### Producción

- [ ] Backup de base de datos
- [ ] Migration ejecutada en producción
- [ ] Código deployado a producción
- [ ] Verificación de endpoints públicos
- [ ] Verificación de endpoints admin
- [ ] Monitoring activo (primeras 24h)

---

## 🔄 Rollback Plan

### Si Fase 2 falla:

```javascript
// En src/routes/whatsappQrProxy.js
// Comentar estas líneas:
/*
const authorized = await qrAuthService.checkAuthorization(clienteIdNum);
if (!authorized) {
  return res.status(403).json({ error: 'QR_ACCESS_DENIED' });
}
*/
```

```javascript
// En src/index.js
// Comentar el cron:
/*
cron.schedule('*/5 * * * *', async () => {
  await cleanExpiredQrSessions();
});
*/
```

- [ ] Código comentado
- [ ] Servidor reiniciado
- [ ] QR vuelve a ser público
- [ ] Sin data loss (tabla intacta)

---

## 📝 Documentación Completada

- [ ] `docs/QR_AUTHORIZATION_ARCHITECTURE.md` (arquitectura completa)
- [ ] `docs/QR_AUTHORIZATION_IMPLEMENTATION_GUIDE.md` (guía de implementación)
- [ ] `docs/QR_AUTHORIZATION_SUMMARY.md` (resumen ejecutivo)
- [ ] `docs/INDEX.md` (índice actualizado)
- [ ] `migrations/001_create_whatsapp_qr_sessions.sql` (migration)

---

## 🎓 Capacitación del Equipo

- [ ] Equipo conoce la arquitectura
- [ ] Equipo conoce los endpoints
- [ ] Equipo sabe ejecutar tests
- [ ] Equipo sabe hacer rollback
- [ ] Equipo sabe consultar métricas

---

## ✅ Sign-off

### Fase 1
- [ ] **Desarrollador Backend**: ___________________
- [ ] **QA**: ___________________
- [ ] **Tech Lead**: ___________________

### Fase 2
- [ ] **Desarrollador Backend**: ___________________
- [ ] **QA**: ___________________
- [ ] **Tech Lead**: ___________________

### Producción
- [ ] **Tech Lead**: ___________________
- [ ] **DevOps**: ___________________
- [ ] **Product Owner**: ___________________

---

## 🎯 Resultado Final Esperado

✅ Solo admin puede autorizar escaneo de QR  
✅ Autorizaciones persisten en MySQL (sobreviven reinicios)  
✅ Autorizaciones expiran automáticamente (cron cada 5 min)  
✅ Sistema auditable (logs estructurados)  
✅ Queries optimizadas (índices correctos)  
✅ Fail-safe (DB down → deny access)  
✅ Rollback plan documentado y probado

---

**Fecha de inicio:** ___________________  
**Fecha estimada Fase 1:** ___________________ (1-2 días)  
**Fecha estimada Fase 2:** ___________________ (1 día)  
**Fecha de producción:** ___________________
