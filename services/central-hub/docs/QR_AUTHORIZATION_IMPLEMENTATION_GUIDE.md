# Guía de Implementación - QR Authorization System

## 🎯 Objetivo

Implementar control de autorización para escaneo de QR de WhatsApp, siguiendo arquitectura faseada.

---

## 📋 Pre-requisitos

- [x] MySQL configurado y accesible
- [x] Central Hub funcionando (puerto 3012)
- [x] Session Manager funcionando (puerto 3001)
- [x] RBAC implementado (roles: `cliente` / `admin`)
- [x] JWT authentication activo

---

## 🚀 FASE 1: Autorización Básica (MVP)

### Paso 1: Ejecutar Migration

```bash
# Conectar a MySQL
mysql -u root -p

# Seleccionar base de datos
USE leadmaster;

# Ejecutar migration
source /root/leadmaster-workspace/services/central-hub/migrations/001_create_whatsapp_qr_sessions.sql

# Verificar tabla creada
DESCRIBE whatsapp_qr_sessions;

# Verificar índices
SHOW INDEX FROM whatsapp_qr_sessions;
```

**Resultado esperado:**
```
Table: whatsapp_qr_sessions
Rows: 9 columns (id, cliente_id, enabled, enabled_by_admin_id, enabled_at, expires_at, revoked_at, created_at)
Indexes: 4 (PRIMARY, idx_cliente_id, idx_expires_at, idx_enabled)
```

---

### Paso 2: Crear QR Authorization Service

**Archivo:** `src/services/qrAuthorizationService.js`

```bash
# El servicio ya está documentado en:
# docs/QR_AUTHORIZATION_ARCHITECTURE.md
# Sección: "Especificación de Servicios"

# Implementar métodos:
# - createAuthorization(clienteId, adminId, durationMinutes)
# - checkAuthorization(clienteId)
# - revokeAuthorization(clienteId, adminId)
# - getActiveSession(clienteId)
# - listActiveSessions()
# - cleanExpiredSessions()
```

**Template básico:**

```javascript
// src/services/qrAuthorizationService.js
const pool = require('../config/db');

/**
 * Crear autorización para escaneo de QR
 */
async function createAuthorization(clienteId, adminId, durationMinutes = 60) {
  const connection = await pool.getConnection();
  
  try {
    // 1. Verificar si ya existe autorización activa
    const [existing] = await connection.query(
      `SELECT id FROM whatsapp_qr_sessions 
       WHERE cliente_id = ? AND enabled = true AND expires_at > NOW()`,
      [clienteId]
    );
    
    if (existing.length > 0) {
      throw new Error('ACTIVE_AUTHORIZATION_EXISTS');
    }
    
    // 2. Crear nueva autorización
    const enabledAt = new Date();
    const expiresAt = new Date(enabledAt.getTime() + durationMinutes * 60000);
    
    const [result] = await connection.query(
      `INSERT INTO whatsapp_qr_sessions 
       (cliente_id, enabled_by_admin_id, enabled_at, expires_at, enabled)
       VALUES (?, ?, ?, ?, true)`,
      [clienteId, adminId, enabledAt, expiresAt]
    );
    
    // 3. Log
    console.log({
      timestamp: new Date().toISOString(),
      action: 'QR_AUTHORIZATION_CREATED',
      adminId,
      clienteId,
      durationMinutes,
      expiresAt: expiresAt.toISOString()
    });
    
    return {
      id: result.insertId,
      clienteId,
      enabledAt,
      expiresAt
    };
    
  } finally {
    connection.release();
  }
}

/**
 * Verificar si cliente tiene autorización activa
 */
async function checkAuthorization(clienteId) {
  const [rows] = await pool.query(
    `SELECT id FROM whatsapp_qr_sessions 
     WHERE cliente_id = ? AND enabled = true AND expires_at > NOW()
     LIMIT 1`,
    [clienteId]
  );
  
  return rows.length > 0;
}

/**
 * Revocar autorización activa
 */
async function revokeAuthorization(clienteId, adminId) {
  const [result] = await pool.query(
    `UPDATE whatsapp_qr_sessions 
     SET enabled = false, revoked_at = NOW() 
     WHERE cliente_id = ? AND enabled = true`,
    [clienteId]
  );
  
  if (result.affectedRows > 0) {
    console.log({
      timestamp: new Date().toISOString(),
      action: 'QR_AUTHORIZATION_REVOKED',
      adminId,
      clienteId
    });
  }
  
  return result.affectedRows > 0;
}

/**
 * Obtener sesión activa de un cliente
 */
async function getActiveSession(clienteId) {
  const [rows] = await pool.query(
    `SELECT * FROM whatsapp_qr_sessions 
     WHERE cliente_id = ? AND enabled = true AND expires_at > NOW()
     LIMIT 1`,
    [clienteId]
  );
  
  return rows[0] || null;
}

/**
 * Listar todas las sesiones activas
 */
async function listActiveSessions() {
  const [rows] = await pool.query(
    `SELECT 
       id,
       cliente_id,
       enabled_by_admin_id,
       enabled_at,
       expires_at,
       TIMESTAMPDIFF(MINUTE, NOW(), expires_at) as remaining_minutes
     FROM whatsapp_qr_sessions 
     WHERE enabled = true AND expires_at > NOW()
     ORDER BY expires_at ASC`
  );
  
  return rows;
}

/**
 * Limpiar sesiones expiradas (llamado por cron)
 */
async function cleanExpiredSessions() {
  const [result] = await pool.query(
    `UPDATE whatsapp_qr_sessions 
     SET enabled = false 
     WHERE enabled = true AND expires_at < NOW()`
  );
  
  if (result.affectedRows > 0) {
    console.log({
      timestamp: new Date().toISOString(),
      action: 'QR_SESSIONS_CLEANED',
      expiredCount: result.affectedRows
    });
  }
  
  return result.affectedRows;
}

module.exports = {
  createAuthorization,
  checkAuthorization,
  revokeAuthorization,
  getActiveSession,
  listActiveSessions,
  cleanExpiredSessions
};
```

---

### Paso 3: Crear Admin Middleware

**Archivo:** `src/middleware/adminMiddleware.js`

```javascript
/**
 * Middleware para verificar rol de administrador
 */
function requireAdmin(req, res, next) {
  // Verificar que el usuario esté autenticado
  if (!req.user) {
    return res.status(401).json({
      ok: false,
      error: 'UNAUTHORIZED',
      message: 'Authentication required'
    });
  }
  
  // Verificar que el usuario sea admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      ok: false,
      error: 'FORBIDDEN',
      message: 'Admin role required'
    });
  }
  
  next();
}

module.exports = {
  requireAdmin
};
```

---

### Paso 4: Crear Admin Routes

**Archivo:** `src/routes/adminWhatsappRoutes.js`

```javascript
const express = require('express');
const qrAuthService = require('../services/qrAuthorizationService');
const { authenticate } = require('../modules/auth/middleware/authMiddleware');
const { requireAdmin } = require('../middleware/adminMiddleware');

const router = express.Router();

// Todas las rutas requieren autenticación + rol admin
router.use(authenticate);
router.use(requireAdmin);

/**
 * POST /admin/whatsapp/authorize-qr
 * Autorizar a un cliente para escanear QR
 */
router.post('/authorize-qr', async (req, res) => {
  const { clienteId, durationMinutes = 60 } = req.body;
  
  // Validación
  if (!clienteId || typeof clienteId !== 'number' || clienteId <= 0) {
    return res.status(400).json({
      ok: false,
      error: 'INVALID_CLIENT_ID',
      message: 'clienteId must be a positive number'
    });
  }
  
  if (durationMinutes <= 0 || durationMinutes > 1440) { // max 24 hours
    return res.status(400).json({
      ok: false,
      error: 'INVALID_DURATION',
      message: 'durationMinutes must be between 1 and 1440'
    });
  }
  
  try {
    const authorization = await qrAuthService.createAuthorization(
      clienteId,
      req.user.id,
      durationMinutes
    );
    
    res.json({
      ok: true,
      authorization: {
        id: authorization.id,
        clienteId: authorization.clienteId,
        enabledAt: authorization.enabledAt,
        expiresAt: authorization.expiresAt
      },
      message: `QR access authorized for ${durationMinutes} minutes`
    });
    
  } catch (error) {
    if (error.message === 'ACTIVE_AUTHORIZATION_EXISTS') {
      return res.status(409).json({
        ok: false,
        error: 'ACTIVE_AUTHORIZATION_EXISTS',
        message: 'Client already has an active QR authorization'
      });
    }
    
    console.error('[admin-whatsapp] Error creating authorization:', error);
    res.status(500).json({
      ok: false,
      error: 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

/**
 * DELETE /admin/whatsapp/:clienteId/qr
 * Revocar autorización de QR de un cliente
 */
router.delete('/:clienteId/qr', async (req, res) => {
  const clienteId = parseInt(req.params.clienteId, 10);
  
  if (isNaN(clienteId) || clienteId <= 0) {
    return res.status(400).json({
      ok: false,
      error: 'INVALID_CLIENT_ID',
      message: 'clienteId must be a positive number'
    });
  }
  
  try {
    const revoked = await qrAuthService.revokeAuthorization(
      clienteId,
      req.user.id
    );
    
    if (!revoked) {
      return res.status(404).json({
        ok: false,
        error: 'NO_ACTIVE_AUTHORIZATION',
        message: 'No active authorization found for this client'
      });
    }
    
    res.json({
      ok: true,
      message: `QR access revoked for client ${clienteId}`
    });
    
  } catch (error) {
    console.error('[admin-whatsapp] Error revoking authorization:', error);
    res.status(500).json({
      ok: false,
      error: 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

/**
 * GET /admin/whatsapp/qr-sessions
 * Listar todas las sesiones de QR activas
 */
router.get('/qr-sessions', async (req, res) => {
  try {
    const sessions = await qrAuthService.listActiveSessions();
    
    res.json({
      ok: true,
      sessions: sessions.map(s => ({
        id: s.id,
        clienteId: s.cliente_id,
        enabledByAdminId: s.enabled_by_admin_id,
        enabledAt: s.enabled_at,
        expiresAt: s.expires_at,
        remainingMinutes: s.remaining_minutes
      }))
    });
    
  } catch (error) {
    console.error('[admin-whatsapp] Error listing sessions:', error);
    res.status(500).json({
      ok: false,
      error: 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

module.exports = router;
```

---

### Paso 5: Registrar Routes en index.js

**Archivo:** `src/index.js`

```javascript
// ... existing code ...

/* =========================
   API ROUTES (ANTES del frontend)
========================= */

// Proxy QR / status WhatsApp (OBLIGATORIO antes del static)
const whatsappQrProxy = require('./routes/whatsappQrProxy');
app.use('/api/whatsapp', whatsappQrProxy);

// Admin WhatsApp (nuevo)
const adminWhatsappRoutes = require('./routes/adminWhatsappRoutes');
app.use('/admin/whatsapp', adminWhatsappRoutes);

/* =========================
   Rutas de módulos internos
========================= */
// ... resto del código ...
```

---

### Paso 6: Testing Manual (Fase 1)

#### 6.1. Obtener token de admin

```bash
# Login como admin
curl -X POST http://localhost:3012/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@leadmaster.com",
    "password": "admin_password"
  }'

# Guardar el token JWT
export ADMIN_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

#### 6.2. Autorizar cliente para escanear QR

```bash
curl -X POST http://localhost:3012/admin/whatsapp/authorize-qr \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "clienteId": 51,
    "durationMinutes": 60
  }'

# Respuesta esperada (200):
# {
#   "ok": true,
#   "authorization": {
#     "id": 1,
#     "clienteId": 51,
#     "enabledAt": "2026-01-03T16:00:00.000Z",
#     "expiresAt": "2026-01-03T17:00:00.000Z"
#   },
#   "message": "QR access authorized for 60 minutes"
# }
```

#### 6.3. Listar autorizaciones activas

```bash
curl http://localhost:3012/admin/whatsapp/qr-sessions \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Respuesta esperada (200):
# {
#   "ok": true,
#   "sessions": [
#     {
#       "id": 1,
#       "clienteId": 51,
#       "enabledByAdminId": 1,
#       "enabledAt": "2026-01-03T16:00:00.000Z",
#       "expiresAt": "2026-01-03T17:00:00.000Z",
#       "remainingMinutes": 45
#     }
#   ]
# }
```

#### 6.4. Revocar autorización

```bash
curl -X DELETE http://localhost:3012/admin/whatsapp/51/qr \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Respuesta esperada (200):
# {
#   "ok": true,
#   "message": "QR access revoked for client 51"
# }
```

#### 6.5. Verificar en MySQL

```sql
-- Conectar a MySQL
mysql -u root -p leadmaster

-- Ver todas las sesiones
SELECT 
  id,
  cliente_id,
  enabled,
  enabled_by_admin_id,
  enabled_at,
  expires_at,
  revoked_at
FROM whatsapp_qr_sessions
ORDER BY id DESC;
```

---

### ✅ Checklist Fase 1

- [ ] Migration ejecutada correctamente
- [ ] Tabla `whatsapp_qr_sessions` existe con todos los índices
- [ ] `qrAuthorizationService.js` implementado y testeado
- [ ] `adminMiddleware.js` implementado
- [ ] `adminWhatsappRoutes.js` implementado
- [ ] Rutas registradas en `index.js`
- [ ] Testing manual exitoso:
  - [ ] POST /authorize-qr con admin token → 200
  - [ ] POST /authorize-qr con client token → 403
  - [ ] POST /authorize-qr sin token → 401
  - [ ] DELETE /:clienteId/qr → 200
  - [ ] GET /qr-sessions → 200 con lista
- [ ] Logs estructurados funcionando
- [ ] Registros en MySQL correctos

**Resultado Fase 1:**
✅ Admin puede autorizar/revocar acceso a QR  
✅ Sistema persiste autorizaciones en MySQL  
⏳ Rutas públicas AÚN NO verifican autorización (Fase 2)

---

## 🚀 FASE 2: Enforcement + Automatización

### Paso 1: Modificar whatsappQrProxy.js

**Archivo:** `src/routes/whatsappQrProxy.js`

Agregar verificación de autorización:

```javascript
const qrAuthService = require('../services/qrAuthorizationService');

// ... código existente ...

/**
 * GET /api/whatsapp/:clienteId/qr
 * Obtiene el código QR de WhatsApp para un cliente
 * 
 * FASE 2: Verifica autorización antes de retornar QR
 */
router.get('/:clienteId/qr', async (req, res) => {
  const { clienteId } = req.params;
  
  // Validación básica
  const clienteIdNum = parseInt(clienteId, 10);
  if (isNaN(clienteIdNum) || clienteIdNum <= 0) {
    return res.status(400).json({
      ok: false,
      error: 'INVALID_CLIENT_ID',
      message: 'clienteId debe ser un número positivo'
    });
  }

  try {
    // ⚠️ FASE 2: Verificar autorización ANTES de proxy
    const authorized = await qrAuthService.checkAuthorization(clienteIdNum);
    
    if (!authorized) {
      // Log intento denegado
      console.log({
        timestamp: new Date().toISOString(),
        action: 'QR_ACCESS_DENIED',
        clienteId: clienteIdNum,
        reason: 'NO_ACTIVE_AUTHORIZATION'
      });
      
      return res.status(403).json({
        ok: false,
        error: 'QR_ACCESS_DENIED',
        message: 'QR access not authorized. Contact administrator.'
      });
    }
    
    // Cliente autorizado → continuar con proxy normal
    const qrData = await sessionManagerClient.getQR(clienteIdNum);
    res.json(qrData);
    
  } catch (error) {
    // ... manejo de errores existente ...
  }
});
```

---

### Paso 2: Crear Cron Job

**Archivo:** `src/jobs/cleanExpiredQrSessions.js`

```javascript
const qrAuthService = require('../services/qrAuthorizationService');

/**
 * Job para limpiar autorizaciones expiradas
 * Se ejecuta cada 5 minutos
 */
async function cleanExpiredQrSessions() {
  try {
    const count = await qrAuthService.cleanExpiredSessions();
    
    if (count > 0) {
      console.log(`[cron] Cleaned ${count} expired QR authorization(s)`);
    }
  } catch (error) {
    console.error('[cron] Error cleaning expired QR sessions:', error);
  }
}

module.exports = cleanExpiredQrSessions;
```

---

### Paso 3: Registrar Cron en index.js

**Instalar dependencia:**

```bash
npm install node-cron
```

**Modificar `src/index.js`:**

```javascript
const cron = require('node-cron');
const cleanExpiredQrSessions = require('./jobs/cleanExpiredQrSessions');

// ... existing code ...

/* =========================
   Server
========================= */
const PORT = process.env.PORT || 3012;

app.listen(PORT, () => {
  console.log(`🚀 Leadmaster Central Hub corriendo en http://localhost:${PORT}`);
  
  // Iniciar cron job para limpiar QR sessions expiradas
  // Ejecutar cada 5 minutos
  cron.schedule('*/5 * * * *', async () => {
    await cleanExpiredQrSessions();
  });
  
  console.log('⏰ Cron job iniciado: limpieza de QR sessions (cada 5 min)');
});
```

---

### Paso 4: Testing E2E (Fase 2)

#### Test 1: Cliente sin autorización → 403

```bash
# Intentar obtener QR sin autorización
curl http://localhost:3012/api/whatsapp/51/qr

# Respuesta esperada (403):
# {
#   "ok": false,
#   "error": "QR_ACCESS_DENIED",
#   "message": "QR access not authorized. Contact administrator."
# }
```

#### Test 2: Admin autoriza → Cliente obtiene QR

```bash
# 1. Admin autoriza (2 minutos para testing)
curl -X POST http://localhost:3012/admin/whatsapp/authorize-qr \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "clienteId": 51,
    "durationMinutes": 2
  }'

# 2. Cliente obtiene QR (inmediatamente)
curl http://localhost:3012/api/whatsapp/51/qr

# Respuesta esperada (200):
# {
#   "ok": true,
#   "qr": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
# }
```

#### Test 3: Esperar expiración → 403

```bash
# Esperar 3 minutos (autorización expiró)
sleep 180

# Intentar obtener QR nuevamente
curl http://localhost:3012/api/whatsapp/51/qr

# Respuesta esperada (403):
# {
#   "ok": false,
#   "error": "QR_ACCESS_DENIED",
#   "message": "QR access not authorized. Contact administrator."
# }
```

#### Test 4: Cron limpia expiradas

```bash
# Verificar en logs (cada 5 minutos)
tail -f logs/central-hub.log | grep "Cleaned"

# Output esperado:
# [cron] Cleaned 1 expired QR authorization(s)
```

---

### ✅ Checklist Fase 2

- [ ] `whatsappQrProxy.js` modificado con verificación
- [ ] `cleanExpiredQrSessions.js` implementado
- [ ] `node-cron` instalado
- [ ] Cron registrado en `index.js`
- [ ] Testing E2E exitoso:
  - [ ] Cliente sin auth → 403
  - [ ] Admin autoriza → Cliente obtiene QR → 200
  - [ ] Expiración automática → 403
  - [ ] Cron limpia expiradas
- [ ] Logs estructurados funcionando
- [ ] Verificación en MySQL correcta

**Resultado Fase 2:**
✅ Cliente solo puede obtener QR si admin autorizó  
✅ Autorizaciones expiran automáticamente  
✅ Sistema auditable y seguro  
✅ Producción-ready

---

## 📊 Monitoring en Producción

### Queries útiles para administración

```sql
-- Ver todas las sesiones activas
SELECT 
  cliente_id,
  enabled_by_admin_id,
  enabled_at,
  expires_at,
  TIMESTAMPDIFF(MINUTE, NOW(), expires_at) as remaining_min
FROM whatsapp_qr_sessions
WHERE enabled = true AND expires_at > NOW();

-- Contar autorizaciones por admin (últimos 7 días)
SELECT 
  enabled_by_admin_id,
  COUNT(*) as total_authorizations,
  AVG(TIMESTAMPDIFF(MINUTE, enabled_at, expires_at)) as avg_duration_min
FROM whatsapp_qr_sessions
WHERE enabled_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY enabled_by_admin_id;

-- Ver intentos denegados (requiere parsear logs)
grep "QR_ACCESS_DENIED" logs/central-hub.log | tail -20
```

---

## 🚨 Troubleshooting

### Problema: Migration falla

```bash
# Verificar que la tabla no exista
mysql -u root -p leadmaster -e "SHOW TABLES LIKE 'whatsapp_qr_sessions';"

# Si existe, borrar y recrear
mysql -u root -p leadmaster -e "DROP TABLE IF EXISTS whatsapp_qr_sessions;"
```

### Problema: Admin no puede autorizar (403)

```bash
# Verificar rol del usuario
mysql -u root -p leadmaster -e "SELECT id, email, role FROM users WHERE id = 1;"

# El role debe ser 'admin'
```

### Problema: Cron no ejecuta

```bash
# Verificar logs al iniciar servidor
# Debe aparecer: "⏰ Cron job iniciado: limpieza de QR sessions"

# Verificar que node-cron esté instalado
npm list node-cron
```

### Problema: Cliente obtiene 403 aunque admin autorizó

```sql
-- Verificar en MySQL si la autorización existe y está activa
SELECT * FROM whatsapp_qr_sessions 
WHERE cliente_id = 51 
  AND enabled = true 
  AND expires_at > NOW();

-- Si no hay resultados, la autorización expiró o fue revocada
```

---

## 📝 Resumen

**Fase 1:** Infraestructura de autorización (sin enforcement)  
**Fase 2:** Enforcement + limpieza automática

**Total estimado:** 2-3 días de desarrollo + testing

**Zero breaking changes** hasta activar Fase 2.

---

**Próximos pasos después de Fase 2:**
1. Integrar UI en dashboard admin
2. Integrar UI en dashboard cliente
3. Agregar notificaciones (email/SMS cuando se autoriza)
4. Métricas en dashboard (sesiones activas, intentos denegados)
