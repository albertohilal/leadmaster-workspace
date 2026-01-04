# QR Authorization System - Executive Summary

## 📌 Decisión Arquitectónica

**Persistencia:** MySQL (única fuente de verdad)  
**Descartados:** Memoria + cron, Redis

---

## 🎯 Objetivo

Implementar control de autorización para que clientes puedan escanear QR de WhatsApp **solo cuando un admin lo autorice**.

---

## 🏗️ Arquitectura

```
Admin Dashboard
    ↓ POST /admin/whatsapp/authorize-qr
Central Hub
    ↓ checkAuthorization(clienteId)
MySQL (whatsapp_qr_sessions)
    ↓ authorized = true/false
Client Dashboard (GET /api/whatsapp/:clienteId/qr)
```

---

## 📋 Reglas de Negocio

1. ❌ Cliente NO puede enviar campañas
2. ✅ Admin autoriza envíos y escaneo de QR
3. ✅ Autorizaciones expiran automáticamente
4. ✅ Sistema auditable (quién, cuándo)
5. ✅ Sobrevive reinicios (MySQL)

---

## 🗄️ Modelo de Datos

```sql
CREATE TABLE whatsapp_qr_sessions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  cliente_id BIGINT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  enabled_by_admin_id BIGINT NOT NULL,
  enabled_at DATETIME NOT NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cliente_id (cliente_id),
  INDEX idx_expires_at (expires_at),
  INDEX idx_enabled (enabled)
);
```

---

## 🚀 Implementación Faseada

### FASE 1: Autorización Básica (1-2 días)

**Componentes:**
- ✅ Migration SQL
- ✅ `qrAuthorizationService.js` (6 métodos)
- ✅ `adminMiddleware.js` (requireAdmin)
- ✅ `adminWhatsappRoutes.js` (3 endpoints)

**Endpoints creados:**
- `POST /admin/whatsapp/authorize-qr` (crear autorización)
- `DELETE /admin/whatsapp/:clienteId/qr` (revocar)
- `GET /admin/whatsapp/qr-sessions` (listar activas)

**Estado al final:**
- ✅ Admin puede autorizar/revocar
- ✅ Datos persisten en MySQL
- ⏳ Rutas públicas AÚN NO verifican (sin breaking changes)

---

### FASE 2: Enforcement + Automatización (1 día)

**Modificaciones:**
- ✅ `whatsappQrProxy.js` → Verificar auth antes de retornar QR
- ✅ Cron job (cada 5 min) → Limpiar expiradas
- ✅ Logging estructurado

**Nuevo comportamiento:**
- Cliente sin auth → `403 QR_ACCESS_DENIED`
- Autorizaciones expiran automáticamente
- Sistema auditable

**Estado al final:**
- ✅ Producción-ready
- ✅ Seguro contra abusos
- ✅ Escalable

---

## 📐 API Specification

### Admin Endpoints (Auth + Role Required)

#### Autorizar cliente
```http
POST /admin/whatsapp/authorize-qr
Authorization: Bearer <admin_token>

{
  "clienteId": 51,
  "durationMinutes": 60
}

→ 200 { authorization: { id, expiresAt } }
→ 409 Already authorized
→ 403 Not admin
```

#### Revocar autorización
```http
DELETE /admin/whatsapp/:clienteId/qr
Authorization: Bearer <admin_token>

→ 200 { message: "Revoked" }
→ 404 No active authorization
```

#### Listar activas
```http
GET /admin/whatsapp/qr-sessions
Authorization: Bearer <admin_token>

→ 200 { sessions: [...] }
```

---

### Public Endpoint (Modified in Phase 2)

#### Obtener QR
```http
GET /api/whatsapp/:clienteId/qr

FASE 1: Proxy directo (sin cambios)
FASE 2: Verifica autorización primero
  - Autorizado → 200 { qr: "base64..." }
  - NO autorizado → 403 QR_ACCESS_DENIED
```

---

## 🔒 Seguridad

### Logs Estructurados

Cada acción genera un log JSON:

```javascript
// Autorización creada
{ action: 'QR_AUTHORIZATION_CREATED', adminId, clienteId, durationMinutes, expiresAt }

// Acceso denegado
{ action: 'QR_ACCESS_DENIED', clienteId, reason: 'NO_ACTIVE_AUTHORIZATION' }

// Revocación
{ action: 'QR_AUTHORIZATION_REVOKED', adminId, clienteId }

// Limpieza automática
{ action: 'QR_SESSIONS_CLEANED', expiredCount }
```

### Queries Optimizadas

```sql
-- Verificar autorización (usado en cada GET /qr)
SELECT id FROM whatsapp_qr_sessions
WHERE cliente_id = ? AND enabled = true AND expires_at > NOW()
LIMIT 1;

-- Limpiar expiradas (cron cada 5 min)
UPDATE whatsapp_qr_sessions SET enabled = false
WHERE enabled = true AND expires_at < NOW();
```

---

## 📊 Testing

### Unit Tests
- `qrAuthorizationService.test.js`
  - createAuthorization()
  - checkAuthorization()
  - revokeAuthorization()

### Integration Tests
- `adminWhatsappRoutes.e2e.test.js`
  - Admin puede autorizar (200)
  - Cliente no puede autorizar (403)
  - Autorización duplicada falla (409)

### E2E Tests (Fase 2)
- Admin autoriza → Cliente obtiene QR → 200
- Cliente sin auth → 403
- Expiración automática → 403
- Cron limpia expiradas

---

## 📦 Archivos Creados/Modificados

### Nuevos Archivos
```
migrations/001_create_whatsapp_qr_sessions.sql
src/services/qrAuthorizationService.js
src/middleware/adminMiddleware.js
src/routes/adminWhatsappRoutes.js
src/jobs/cleanExpiredQrSessions.js
docs/QR_AUTHORIZATION_ARCHITECTURE.md
docs/QR_AUTHORIZATION_IMPLEMENTATION_GUIDE.md
```

### Archivos Modificados
```
src/index.js (registrar rutas + cron)
src/routes/whatsappQrProxy.js (Fase 2: verificar auth)
package.json (añadir node-cron)
```

---

## ✅ Checklist de Implementación

### Fase 1
- [ ] Ejecutar migration
- [ ] Implementar qrAuthorizationService
- [ ] Implementar adminMiddleware
- [ ] Implementar adminWhatsappRoutes
- [ ] Registrar rutas en index.js
- [ ] Testing manual (POST/DELETE/GET)
- [ ] Verificar en MySQL

### Fase 2
- [ ] Modificar whatsappQrProxy.js
- [ ] Implementar cleanExpiredQrSessions
- [ ] Instalar node-cron
- [ ] Registrar cron en index.js
- [ ] Testing E2E completo
- [ ] Verificar logs
- [ ] Deploy a staging
- [ ] Deploy a producción

---

## 🚨 Rollback Plan

**Fase 2 → Fase 1:**
- Comentar verificación en `whatsappQrProxy.js`
- Detener cron job
- QR vuelve a ser público (sin breaking changes)

**Fase 1 → Legacy:**
- Rutas admin sin efecto
- Tabla queda en DB (sin impacto)
- QR público como antes

---

## 📈 Métricas

- **Autorizaciones creadas/día** (alerta si > 100)
- **Intentos denegados/hora** (alerta si > 50 de un cliente)
- **Sesiones activas concurrentes** (alerta si > 50)
- **Duración promedio de auth** (info para ajustar defaults)

---

## 🎓 Documentación Completa

1. **Arquitectura detallada:** `docs/QR_AUTHORIZATION_ARCHITECTURE.md`
2. **Guía de implementación:** `docs/QR_AUTHORIZATION_IMPLEMENTATION_GUIDE.md`
3. **Migration SQL:** `migrations/001_create_whatsapp_qr_sessions.sql`

---

## 📞 Soporte

- **Repositorio:** `/root/leadmaster-workspace/services/central-hub`
- **Logs:** `tail -f logs/central-hub.log | grep "QR_"`
- **MySQL:** `mysql -u root -p leadmaster`
- **Dashboard:** https://desarrolloydisenioweb.com.ar/dashboard

---

## 🎯 Resultado Final

✅ **Solo admin autoriza** escaneo de QR  
✅ **Persistencia en MySQL** (sobrevive reinicios)  
✅ **Expiración automática** (cron cada 5 min)  
✅ **Auditable** (logs estructurados)  
✅ **Escalable** (índices optimizados)  
✅ **Fail-safe** (DB down → deny access)  
✅ **Reversible** (rollback sin data loss)  

**Tiempo estimado:** 2-3 días (Fase 1 + Fase 2)  
**Breaking changes:** Ninguno hasta Fase 2
