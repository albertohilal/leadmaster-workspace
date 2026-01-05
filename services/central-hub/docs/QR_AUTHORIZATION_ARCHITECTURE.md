# Arquitectura Final – Escaneo de QR WhatsApp Controlado (LeadMaster)

## 🎯 Decisión Arquitectónica

**Persistencia de autorización de QR: MySQL**

- ✅ MySQL como única fuente de verdad
- ❌ Memoria + cron (descartado)
- ❌ Redis (descartado)

---

## 📋 Contexto del Sistema

LeadMaster es una plataforma de **envíos controlados de WhatsApp** con estas reglas inmutables:

### Reglas de Negocio NO NEGOCIABLES

1. ❌ El **cliente NO puede enviar campañas**
2. ✅ El **admin es el único que autoriza y ejecuta envíos**
3. ✅ El cliente **DEBE poder escanear el QR remotamente**
4. ✅ El sistema debe:
   - Prevenir abusos
   - Ser auditable
   - Sobrevivir reinicios
   - Escalar sin rediseño

### Arquitectura Existente

- **Central Hub** (Node.js + Express) - Puerto 3012
- **Session Manager** (microservicio WhatsApp) - Puerto 3001
- **MySQL** como DB principal
- **RBAC** implementado (roles: `cliente` / `admin`)
- **Dashboard activo**: https://desarrolloydisenioweb.com.ar/dashboard

---

## 🏗️ Arquitectura de Autorización de QR

### Diagrama de Componentes

```
┌────────────────────────────────────────────────────────────────────┐
│                         Admin Dashboard                             │
│                  (Autoriza escaneo de QR)                           │
└────────────────────────────┬───────────────────────────────────────┘
                             │
                             │ POST /admin/whatsapp/authorize-qr
                             │ { clienteId, durationMinutes }
                             │
┌────────────────────────────▼───────────────────────────────────────┐
│                       Central Hub (Port 3012)                       │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  Admin Routes: /admin/whatsapp/*                             │ │
│  │  • POST /authorize-qr     (crear autorización)               │ │
│  │  • DELETE /:clienteId/qr  (revocar autorización)             │ │
│  │  • GET /qr-sessions       (listar autorizaciones)            │ │
│  └────────────────────┬─────────────────────────────────────────┘ │
│                       │                                              │
│                       ▼                                              │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  QR Authorization Service                                     │ │
│  │  • createAuthorization(clienteId, adminId, minutes)          │ │
│  │  • checkAuthorization(clienteId) → boolean                   │ │
│  │  • revokeAuthorization(clienteId, adminId)                   │ │
│  │  • cleanExpiredAuthorizations() → cron job                   │ │
│  └────────────────────┬─────────────────────────────────────────┘ │
│                       │                                              │
│                       ▼                                              │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │                   MySQL Database                              │ │
│  │         TABLE: ll_whatsapp_qr_sessions                           │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                       ▲                                              │
│                       │ check authorization                          │
│  ┌────────────────────┴─────────────────────────────────────────┐ │
│  │  Public Routes: /api/whatsapp/:clienteId/*                    │ │
│  │  • GET /qr  (verifica autorización antes de proxy)            │ │
│  └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┬─┘
                                                                    │
                             ┌──────────────────────────────────────┘
                             │
┌────────────────────────────▼───────────────────────────────────────┐
│                  Cliente Dashboard                                  │
│              (Escanea QR cuando autorizado)                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Modelo de Datos

### Tabla: `ll_whatsapp_qr_sessions`

```sql
CREATE TABLE ll_whatsapp_qr_sessions (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Campos Explicados

| Campo | Tipo | Propósito | Regla |
|-------|------|-----------|-------|
| `id` | BIGINT | PK autoincremental | Único |
| `cliente_id` | BIGINT | FK al cliente autorizado | NOT NULL, indexado |
| `enabled` | BOOLEAN | Estado actual (true=activo) | Default false |
| `enabled_by_admin_id` | BIGINT | Admin que autorizó | Auditoría |
| `enabled_at` | DATETIME | Timestamp de autorización | UTC |
| `expires_at` | DATETIME | Timestamp de expiración | UTC, indexado |
| `revoked_at` | DATETIME | Si fue revocado manualmente | NULL = no revocado |
| `created_at` | DATETIME | Timestamp de creación | Auto |

### Índices

- `idx_cliente_id`: Búsqueda rápida por cliente
- `idx_expires_at`: Limpieza eficiente de expirados
- `idx_enabled`: Filtrado de sesiones activas

---

## 🚀 Implementación Faseada

### **FASE 1: Autorización Básica (MVP)**

#### Objetivo
Implementar el control básico de autorización sin modificar rutas existentes.

#### Componentes a Crear

1. **Migration SQL**
   - Crear tabla `ll_whatsapp_qr_sessions`
   - Ubicación: `/migrations/001_create_ll_whatsapp_qr_sessions.sql`

2. **Service: QR Authorization Service**
   - Ubicación: `/src/services/qrAuthorizationService.js`
   - Métodos:
     - `createAuthorization(clienteId, adminId, durationMinutes)`
     - `checkAuthorization(clienteId) → boolean`
     - `revokeAuthorization(clienteId, adminId)`
     - `getActiveSession(clienteId)`
     - `listActiveSessions()`

3. **Admin Routes**
   - Ubicación: `/src/routes/adminWhatsappRoutes.js`
   - Endpoints:
     - `POST /admin/whatsapp/authorize-qr`
     - `DELETE /admin/whatsapp/:clienteId/qr`
     - `GET /admin/whatsapp/qr-sessions`
   - Middleware: `authenticate` + `requireAdmin`

4. **Middleware: Admin Authorization**
   - Ubicación: `/src/middleware/adminMiddleware.js`
   - Función: `requireAdmin(req, res, next)`
   - Verifica que `req.user.role === 'admin'`

#### Estado al Final de Fase 1
- ✅ Admin puede autorizar/revocar acceso a QR
- ✅ Sistema persiste autorizaciones en MySQL
- ✅ Rutas públicas AÚN NO verifican autorización
- ⏳ Limpieza de expirados: manual

---

### **FASE 2: Enforcement + Automatización**

#### Objetivo
Aplicar verificación en rutas públicas y automatizar limpieza.

#### Componentes a Modificar/Crear

1. **Modificar: `whatsappQrProxy.js`**
   - En `GET /:clienteId/qr`:
     - ANTES de llamar a `sessionManagerClient.getQR()`
     - Verificar: `await qrAuthorizationService.checkAuthorization(clienteId)`
     - Si NO autorizado → `403 Forbidden`

2. **Cron Job: Limpieza Automática**
   - Ubicación: `/src/jobs/cleanExpiredQrSessions.js`
   - Frecuencia: Cada 5 minutos
   - Acción: `UPDATE ll_whatsapp_qr_sessions SET enabled=false WHERE expires_at < NOW() AND enabled=true`

3. **Registro de Cron en `index.js`**
   - Usar `node-cron` o similar
   - Iniciar job al arrancar servidor

4. **Logging y Auditoría**
   - Registrar en logs cada:
     - Autorización creada
     - Intento de QR sin autorización
     - Revocación manual
     - Limpieza automática

#### Estado al Final de Fase 2
- ✅ Cliente solo puede obtener QR si admin autorizó
- ✅ Autorizaciones expiran automáticamente
- ✅ Sistema auditable y seguro
- ✅ Producción-ready

---

## 📐 Especificación de Servicios

### QR Authorization Service

```javascript
// src/services/qrAuthorizationService.js

/**
 * Crear autorización para que un cliente escanee QR
 * @param {number} clienteId - ID del cliente a autorizar
 * @param {number} adminId - ID del admin que autoriza
 * @param {number} durationMinutes - Duración en minutos (default: 60)
 * @returns {Promise<Object>} { id, expiresAt }
 */
async function createAuthorization(clienteId, adminId, durationMinutes = 60)

/**
 * Verificar si un cliente tiene autorización activa
 * @param {number} clienteId - ID del cliente
 * @returns {Promise<boolean>} true si autorizado y no expirado
 */
async function checkAuthorization(clienteId)

/**
 * Revocar autorización activa de un cliente
 * @param {number} clienteId - ID del cliente
 * @param {number} adminId - ID del admin que revoca
 * @returns {Promise<boolean>} true si se revocó algo
 */
async function revokeAuthorization(clienteId, adminId)

/**
 * Obtener sesión activa de un cliente
 * @param {number} clienteId - ID del cliente
 * @returns {Promise<Object|null>} Sesión o null
 */
async function getActiveSession(clienteId)

/**
 * Listar todas las sesiones activas
 * @returns {Promise<Array>} Lista de sesiones
 */
async function listActiveSessions()

/**
 * Limpiar sesiones expiradas (llamado por cron)
 * @returns {Promise<number>} Cantidad de sesiones deshabilitadas
 */
async function cleanExpiredSessions()
```

---

## 🔒 Especificación de Endpoints

### Admin Endpoints (Requieren Auth + Role Admin)

#### 1. Autorizar escaneo de QR

```http
POST /admin/whatsapp/authorize-qr
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json

{
  "clienteId": 51,
  "durationMinutes": 60
}
```

**Respuesta 200:**
```json
{
  "ok": true,
  "authorization": {
    "id": 123,
    "clienteId": 51,
    "enabledAt": "2026-01-03T15:30:00.000Z",
    "expiresAt": "2026-01-03T16:30:00.000Z"
  },
  "message": "QR access authorized for 60 minutes"
}
```

**Errores:**
- `400`: clienteId inválido o missing
- `401`: No autenticado
- `403`: No es admin
- `409`: Ya existe autorización activa

---

#### 2. Revocar autorización de QR

```http
DELETE /admin/whatsapp/:clienteId/qr
Authorization: Bearer <admin_jwt_token>
```

**Respuesta 200:**
```json
{
  "ok": true,
  "message": "QR access revoked for client 51"
}
```

**Errores:**
- `401`: No autenticado
- `403`: No es admin
- `404`: No hay autorización activa

---

#### 3. Listar autorizaciones activas

```http
GET /admin/whatsapp/qr-sessions
Authorization: Bearer <admin_jwt_token>
```

**Respuesta 200:**
```json
{
  "ok": true,
  "sessions": [
    {
      "id": 123,
      "clienteId": 51,
      "enabledByAdminId": 1,
      "enabledAt": "2026-01-03T15:30:00.000Z",
      "expiresAt": "2026-01-03T16:30:00.000Z",
      "remainingMinutes": 45
    }
  ]
}
```

---

### Public Endpoints (Modificado en Fase 2)

#### GET /api/whatsapp/:clienteId/qr

**Comportamiento en Fase 1:**
- Sin cambios (funciona como proxy directo)

**Comportamiento en Fase 2:**
```javascript
// ANTES de llamar a sessionManagerClient.getQR():
const authorized = await qrAuthorizationService.checkAuthorization(clienteId);

if (!authorized) {
  return res.status(403).json({
    ok: false,
    error: 'QR_ACCESS_DENIED',
    message: 'QR access not authorized. Contact administrator.'
  });
}

// Continuar con proxy normal...
```

**Nueva respuesta 403:**
```json
{
  "ok": false,
  "error": "QR_ACCESS_DENIED",
  "message": "QR access not authorized. Contact administrator."
}
```

---

## 🔄 Flujos de Trabajo

### Flujo 1: Admin Autoriza Cliente

```
┌──────┐                ┌─────────────┐              ┌──────────────┐
│Admin │                │Central Hub  │              │    MySQL     │
└──┬───┘                └──────┬──────┘              └──────┬───────┘
   │                           │                            │
   │ POST /admin/whatsapp/     │                            │
   │      authorize-qr         │                            │
   │ { clienteId: 51,          │                            │
   │   durationMinutes: 60 }   │                            │
   ├──────────────────────────►│                            │
   │                           │                            │
   │                           │ Verify JWT + role=admin    │
   │                           │                            │
   │                           │ Check existing auth        │
   │                           ├───────────────────────────►│
   │                           │ SELECT * FROM              │
   │                           │ ll_whatsapp_qr_sessions       │
   │                           │ WHERE cliente_id=51        │
   │                           │ AND enabled=true           │
   │                           │◄───────────────────────────┤
   │                           │ (empty)                    │
   │                           │                            │
   │                           │ Create authorization       │
   │                           ├───────────────────────────►│
   │                           │ INSERT INTO                │
   │                           │ ll_whatsapp_qr_sessions       │
   │                           │ (cliente_id,               │
   │                           │  enabled_by_admin_id,      │
   │                           │  enabled_at,               │
   │                           │  expires_at,               │
   │                           │  enabled)                  │
   │                           │ VALUES                     │
   │                           │ (51, 1, NOW(),             │
   │                           │  NOW()+60min, true)        │
   │                           │◄───────────────────────────┤
   │                           │ OK                         │
   │                           │                            │
   │ 200 OK                    │                            │
   │ { authorization: {...} }  │                            │
   │◄──────────────────────────┤                            │
   │                           │                            │
   │ [Log] "Admin 1 authorized │                            │
   │  QR for client 51         │                            │
   │  until 16:30"             │                            │
```

---

### Flujo 2: Cliente Escanea QR (Fase 2)

```
┌────────┐           ┌─────────────┐           ┌──────────────┐           ┌──────────────┐
│Cliente │           │Central Hub  │           │    MySQL     │           │Session Mgr   │
└───┬────┘           └──────┬──────┘           └──────┬───────┘           └──────┬───────┘
    │                       │                         │                          │
    │ GET /api/whatsapp/    │                         │                          │
    │     51/qr             │                         │                          │
    ├──────────────────────►│                         │                          │
    │                       │                         │                          │
    │                       │ Check authorization     │                          │
    │                       ├────────────────────────►│                          │
    │                       │ SELECT * FROM           │                          │
    │                       │ ll_whatsapp_qr_sessions    │                          │
    │                       │ WHERE cliente_id=51     │                          │
    │                       │ AND enabled=true        │                          │
    │                       │ AND expires_at > NOW()  │                          │
    │                       │◄────────────────────────┤                          │
    │                       │ { id: 123, ... }        │                          │
    │                       │                         │                          │
    │                       │ ✅ Authorized           │                          │
    │                       │                         │                          │
    │                       │ Call Session Manager    │                          │
    │                       ├────────────────────────────────────────────────────►│
    │                       │ GET /qr                 │                          │
    │                       │ X-Cliente-Id: 51        │                          │
    │                       │◄────────────────────────────────────────────────────┤
    │                       │ 200 { qr: "base64..." } │                          │
    │                       │                         │                          │
    │ 200 OK                │                         │                          │
    │ { qr: "base64..." }   │                         │                          │
    │◄──────────────────────┤                         │                          │
    │                       │                         │                          │
```

---

### Flujo 3: Cliente SIN Autorización Intenta QR (Fase 2)

```
┌────────┐           ┌─────────────┐           ┌──────────────┐
│Cliente │           │Central Hub  │           │    MySQL     │
└───┬────┘           └──────┬──────┘           └──────┬───────┘
    │                       │                         │
    │ GET /api/whatsapp/    │                         │
    │     51/qr             │                         │
    ├──────────────────────►│                         │
    │                       │                         │
    │                       │ Check authorization     │
    │                       ├────────────────────────►│
    │                       │ SELECT * FROM           │
    │                       │ ll_whatsapp_qr_sessions    │
    │                       │ WHERE cliente_id=51     │
    │                       │ AND enabled=true        │
    │                       │ AND expires_at > NOW()  │
    │                       │◄────────────────────────┤
    │                       │ (empty)                 │
    │                       │                         │
    │                       │ ❌ NOT Authorized       │
    │                       │                         │
    │ 403 Forbidden         │ [Log] "Client 51        │
    │ { error:              │  attempted QR access    │
    │   "QR_ACCESS_DENIED"} │  without authorization" │
    │◄──────────────────────┤                         │
    │                       │                         │
```

---

### Flujo 4: Cron Limpia Autorizaciones Expiradas

```
┌──────────┐                ┌─────────────┐                ┌──────────────┐
│Cron Job  │                │Central Hub  │                │    MySQL     │
│(every 5m)│                │             │                │              │
└────┬─────┘                └──────┬──────┘                └──────┬───────┘
     │                             │                              │
     │ Trigger (every 5 minutes)   │                              │
     ├────────────────────────────►│                              │
     │                             │                              │
     │                             │ Clean expired sessions       │
     │                             ├─────────────────────────────►│
     │                             │ UPDATE                       │
     │                             │ ll_whatsapp_qr_sessions         │
     │                             │ SET enabled=false            │
     │                             │ WHERE enabled=true           │
     │                             │ AND expires_at < NOW()       │
     │                             │◄─────────────────────────────┤
     │                             │ Rows affected: 3             │
     │                             │                              │
     │ [Log] "Cleaned 3 expired    │                              │
     │  QR authorizations"         │                              │
     │◄────────────────────────────┤                              │
     │                             │                              │
```

---

## 🛡️ Seguridad y Auditoría

### Logs Obligatorios

Cada acción debe generar un log estructurado:

```javascript
// Autorización creada
console.log({
  timestamp: new Date().toISOString(),
  action: 'QR_AUTHORIZATION_CREATED',
  adminId: 1,
  clienteId: 51,
  durationMinutes: 60,
  expiresAt: '2026-01-03T16:30:00.000Z'
});

// Intento sin autorización
console.log({
  timestamp: new Date().toISOString(),
  action: 'QR_ACCESS_DENIED',
  clienteId: 51,
  reason: 'NO_ACTIVE_AUTHORIZATION'
});

// Revocación manual
console.log({
  timestamp: new Date().toISOString(),
  action: 'QR_AUTHORIZATION_REVOKED',
  adminId: 1,
  clienteId: 51
});

// Limpieza automática
console.log({
  timestamp: new Date().toISOString(),
  action: 'QR_SESSIONS_CLEANED',
  expiredCount: 3
});
```

### Queries Optimizadas

```sql
-- Verificar autorización (usado en cada request GET /qr)
SELECT id, expires_at
FROM ll_whatsapp_qr_sessions
WHERE cliente_id = ?
  AND enabled = true
  AND expires_at > NOW()
LIMIT 1;

-- Limpiar expiradas (cron cada 5 minutos)
UPDATE ll_whatsapp_qr_sessions
SET enabled = false
WHERE enabled = true
  AND expires_at < NOW();

-- Listar activas para admin dashboard
SELECT 
  ws.id,
  ws.cliente_id,
  ws.enabled_by_admin_id,
  ws.enabled_at,
  ws.expires_at,
  TIMESTAMPDIFF(MINUTE, NOW(), ws.expires_at) as remaining_minutes
FROM ll_whatsapp_qr_sessions ws
WHERE ws.enabled = true
  AND ws.expires_at > NOW()
ORDER BY ws.expires_at ASC;
```

---

## 📊 Métricas y Monitoreo

### Métricas Clave

1. **Autorizaciones creadas por día**
   - Métrica: `qr_authorizations_created_total`
   - Alerta si > 100/día (posible abuso)

2. **Intentos denegados**
   - Métrica: `qr_access_denied_total`
   - Alerta si > 50/hora de un mismo cliente

3. **Sesiones activas concurrentes**
   - Métrica: `qr_active_sessions_gauge`
   - Alerta si > 50 (capacidad Session Manager)

4. **Duración promedio de autorizaciones**
   - Métrica: `qr_authorization_duration_minutes_avg`
   - Info para ajustar defaults

### Health Checks

```javascript
// GET /admin/whatsapp/health
{
  "ok": true,
  "qrAuthorization": {
    "activeSessions": 12,
    "expiredLast24h": 45,
    "deniedAttemptsLast1h": 3
  }
}
```

---

## 🧪 Testing

### Unit Tests

```javascript
// qrAuthorizationService.test.js

describe('createAuthorization', () => {
  it('should create authorization with correct expiration', async () => {
    const result = await qrAuthService.createAuthorization(51, 1, 60);
    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('expiresAt');
    // Verify expiresAt is ~60 minutes from now
  });

  it('should reject duplicate active authorization', async () => {
    await qrAuthService.createAuthorization(51, 1, 60);
    await expect(
      qrAuthService.createAuthorization(51, 1, 60)
    ).rejects.toThrow('ACTIVE_AUTHORIZATION_EXISTS');
  });
});

describe('checkAuthorization', () => {
  it('should return true for valid authorization', async () => {
    await qrAuthService.createAuthorization(51, 1, 60);
    const authorized = await qrAuthService.checkAuthorization(51);
    expect(authorized).toBe(true);
  });

  it('should return false for expired authorization', async () => {
    // Create authorization that expires in 1ms
    await qrAuthService.createAuthorization(51, 1, 0.001);
    await sleep(10);
    const authorized = await qrAuthService.checkAuthorization(51);
    expect(authorized).toBe(false);
  });
});
```

### Integration Tests

```javascript
// adminWhatsappRoutes.e2e.test.js

describe('POST /admin/whatsapp/authorize-qr', () => {
  it('should authorize QR access with admin token', async () => {
    const adminToken = await getAdminToken();
    const response = await request(app)
      .post('/admin/whatsapp/authorize-qr')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ clienteId: 51, durationMinutes: 60 });
    
    expect(response.status).toBe(200);
    expect(response.body.authorization).toHaveProperty('expiresAt');
  });

  it('should reject with client token', async () => {
    const clientToken = await getClientToken();
    const response = await request(app)
      .post('/admin/whatsapp/authorize-qr')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ clienteId: 51, durationMinutes: 60 });
    
    expect(response.status).toBe(403);
  });
});
```

---

## 📦 Checklist de Implementación

### Fase 1: Autorización Básica

- [ ] Crear migration `001_create_ll_whatsapp_qr_sessions.sql`
- [ ] Implementar `qrAuthorizationService.js`
  - [ ] `createAuthorization()`
  - [ ] `checkAuthorization()`
  - [ ] `revokeAuthorization()`
  - [ ] `getActiveSession()`
  - [ ] `listActiveSessions()`
- [ ] Crear middleware `adminMiddleware.js` con `requireAdmin()`
- [ ] Implementar `adminWhatsappRoutes.js`
  - [ ] `POST /authorize-qr`
  - [ ] `DELETE /:clienteId/qr`
  - [ ] `GET /qr-sessions`
- [ ] Registrar rutas admin en `index.js`
- [ ] Escribir tests unitarios
- [ ] Escribir tests de integración
- [ ] Ejecutar migration en DB
- [ ] Testing manual con Postman/curl
- [ ] Documentar endpoints en Swagger/OpenAPI (opcional)

### Fase 2: Enforcement + Automatización

- [ ] Modificar `whatsappQrProxy.js`
  - [ ] Agregar `checkAuthorization()` en GET /qr
  - [ ] Manejar error 403
  - [ ] Agregar logging
- [ ] Implementar `cleanExpiredQrSessions.js` (cron job)
- [ ] Instalar dependencia `node-cron`
- [ ] Registrar cron en `index.js`
- [ ] Agregar métricas/logging estructurado
- [ ] Testing E2E:
  - [ ] Admin autoriza → Cliente obtiene QR → Expira → 403
  - [ ] Cron limpia expirados
  - [ ] Revocación manual funciona
- [ ] Deployment a staging
- [ ] Validación con cliente real
- [ ] Deployment a producción

---

## 🚨 Consideraciones de Producción

### Escalabilidad

1. **Índices de MySQL**: Asegurar que `idx_cliente_id`, `idx_expires_at` existan
2. **Connection Pool**: Verificar que `connectionLimit` en `db.js` sea >= 10
3. **Caching**: Considerar cache de autorizaciones en memoria (invalidar con TTL)

### Failover

1. **DB Unavailable**: Si MySQL cae, denegar acceso a QR (fail-safe)
2. **Cron Failure**: Log si cron falla, alerta si no ejecuta por 15 minutos

### Rollback Plan

1. **Fase 2 → Fase 1**: Comentar verificación en `whatsappQrProxy.js`, detener cron
2. **Fase 1 → Legacy**: Rutas admin quedan sin efecto, QR vuelve a ser público

---

## 📚 Referencias

- [Documentación MySQL - DATETIME vs TIMESTAMP](https://dev.mysql.com/doc/refman/8.0/en/datetime.html)
- [node-cron](https://www.npmjs.com/package/node-cron)
- [Express Middleware Patterns](https://expressjs.com/en/guide/using-middleware.html)
- [LeadMaster - WhatsApp Proxy Architecture](./WHATSAPP_PROXY_ARCHITECTURE.md)

---

## 📝 Resumen Ejecutivo

Esta arquitectura implementa **control granular de acceso a QR de WhatsApp** con estas garantías:

✅ **Solo admin autoriza** escaneo de QR  
✅ **Persistencia en MySQL** (sobrevive reinicios)  
✅ **Expiración automática** (no requiere intervención)  
✅ **Auditable** (logs estructurados)  
✅ **Escalable** (índices optimizados)  
✅ **Fail-safe** (DB down → deny access)  
✅ **Reversible** (rollback sin data loss)

**Implementación progresiva:**
- **Fase 1** (1-2 días): Admin puede autorizar, sistema persiste
- **Fase 2** (1 día): Cliente bloqueado sin autorización, limpieza automática

**Zero breaking changes** hasta Fase 2.

---

**Autor:** Arquitecto de Software Senior - LeadMaster  
**Fecha:** 3 de enero de 2026  
**Versión:** 1.0 (Final, No Negociable)
