# Implementación: Listener + Persistencia WhatsApp (MySQL)

**Destino:** docs/05-REPORTES/2026-02/IMPLEMENTACION-LISTENER-PERSISTENCIA-WHATSAPP-2026-02-28.md  
**Fecha:** 2026-02-28  
**Servicios impactados:** `services/central-hub`, `services/session-manager`  
**Objetivo:** registrar mensajes entrantes (y salientes opcional) de WhatsApp en MySQL, con multi-tenant por `cliente_id`, contrato HTTP formal, logging claro e idempotencia básica.

---

## 1) Resumen ejecutivo

Se implementó una capa de persistencia para mensajes WhatsApp en MySQL (tabla `ll_whatsapp_messages`) y endpoints internos en Central Hub para registrar:

- **IN** (entrantes): `POST /api/listener/incoming-message`
- **OUT** (salientes, bonus): `POST /api/listener/outgoing-message`

Ambos endpoints son **idempotentes** vía `UNIQUE (cliente_id, message_hash)` y devuelven `200 { ok: true, duplicated: boolean }` tanto en inserción como en duplicado.

Además, se agregó un endpoint **debug** (JWT) para inspección manual:

- `GET /api/listener/messages?cliente_id=...&from=...&limit=...`

Finalmente, `session-manager` fue extendido para postear los eventos reales de WhatsApp hacia estos endpoints (manteniendo intacto el bridge previo a `/api/listener/test-message`, por lo que no se rompe el comportamiento actual de IA/intervención humana).

---

## 2) Contrato HTTP (alineación)

**Referencia:** docs/07-CONTRATOS/Contratos-HTTP-LeadMaster-Workspace.md (sección 5.1)

- El contrato documentado en 5.1 figura como **PLANNED** y muestra un request sin `cliente_id`.
- El objetivo implementado en esta iteración (según requerimiento) exige **multi-tenant obligatorio**, por lo que:
  - `cliente_id` es **requerido** (`400` si falta o es inválido).

**Estado resultante:** se implementó el endpoint planificado, pero con `cliente_id` requerido para consistencia multi-tenant del workspace.

---

## 3) Persistencia MySQL

### 3.1 Migración

Archivo:
- services/central-hub/db/migrations/004_create_ll_whatsapp_messages.sql

Tabla creada:
- `ll_whatsapp_messages`

Campos (mínimos solicitados, más `direction` y `wa_to` para OUT):
- `id` INT PK autoincrement
- `cliente_id` INT NOT NULL
- `direction` ENUM('IN','OUT') NOT NULL DEFAULT 'IN'
- `wa_from` VARCHAR(32) NOT NULL
- `wa_to` VARCHAR(32) NULL
- `message` TEXT NOT NULL
- `ts_wa` DATETIME NOT NULL
- `message_hash` CHAR(64) NOT NULL
- `raw_json` JSON NULL
- `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP

Índices:
- `KEY idx_cliente_ts (cliente_id, ts_wa)`
- `UNIQUE KEY uq_cliente_hash (cliente_id, message_hash)`

Notas:
- La migración usa `CREATE TABLE IF NOT EXISTS` (idempotente a nivel tabla).

### 3.2 Idempotencia

Se calcula `message_hash` con `sha256` y se inserta con:
- `INSERT ... ON DUPLICATE KEY UPDATE id = id`

Resultado:
- Inserción nueva: `duplicated = false`
- Duplicado por `uq_cliente_hash`: `duplicated = true` y se responde igualmente `200 ok`

Hash actual:
- IN: `${cliente_id}|${from}|${message}|${ts_iso_normalizado}`
- OUT: `${cliente_id}|OUT|${from}|${to}|${message}|${ts_iso_normalizado}`

---

## 4) Central Hub: endpoints + wiring

Central Hub monta el módulo listener bajo `/api/listener` en:
- services/central-hub/src/index.js

### 4.1 POST /api/listener/incoming-message (interno)

Ruta:
- services/central-hub/src/modules/listener/routes/listenerRoutes.js

Controller:
- services/central-hub/src/modules/listener/controllers/incomingMessageController.js

Service DB:
- services/central-hub/src/modules/listener/services/messagePersistence.js

Validaciones:
- `cliente_id` requerido y numérico > 0
- `from` requerido, se normaliza a solo dígitos
- `message` requerido, string no vacío
- `timestamp` requerido, ISO parseable

Persistencia:
- Inserta `direction='IN'`, `wa_from=fromDigits`, `ts_wa=UTC DATETIME`, `raw_json=payload`

Respuesta:
- `200 { ok: true, duplicated: boolean }`
- `400 { error: true, code: 'INVALID_REQUEST', message: '...' }`
- `500 { error: true, code: 'DB_ERROR', message: '...' }`

Auth:
- Este endpoint se monta **antes** de `router.use(authenticate)` para ser consumido internamente.

### 4.2 POST /api/listener/outgoing-message (interno, bonus)

Análogo a incoming, con:
- `to` requerido
- Persistencia `direction='OUT'`, `wa_to=toDigits`

### 4.3 GET /api/listener/messages (debug, JWT)

- Protegido por el middleware JWT del módulo listener (queda detrás de `router.use(authenticate)`)
- Query:
  - `cliente_id` requerido
  - `from` opcional
  - `limit` opcional (default 50, max 200)
- Orden:
  - `ORDER BY ts_wa DESC`

---

## 5) Session Manager: bridge hacia el contrato formal

Archivo modificado:
- services/session-manager/whatsapp/wwebjs-session.js

Comportamiento:

1) **Inbound** (`waClient.on('message')`)
- Sigue posteando al endpoint previo: `POST /api/listener/test-message` (para el flujo de IA actual)
- Además postea al nuevo contrato formal: `POST /api/listener/incoming-message`
  - `from`: teléfono normalizado (solo dígitos)
  - `message`: texto
  - `timestamp`: ISO derivado de `msg.timestamp` (epoch seconds) o fallback `new Date().toISOString()`

2) **Outbound** (`waClient.on('message_create')`)
- Sigue posteando al endpoint previo: `POST /api/listener/test-message` con `esHumano: true`
- Además postea a: `POST /api/listener/outgoing-message`
  - `from`: teléfono normalizado de `msg.from` (si existe/parseable)
  - `to`: teléfono normalizado de `msg.to`
  - `message`: texto
  - `timestamp`: ISO

Auth:
- `session-manager` mantiene el login existente a Central Hub (`/api/auth/login`) y envía `Authorization: Bearer ...`.
- Los endpoints internos nuevos no requieren JWT; el header extra no afecta.

---

## 6) Operación (pasos de despliegue)

### 6.1 Aplicar migración

Desde el servidor:

- `cd /root/leadmaster-workspace/services/central-hub`
- `mysql -u root -p leadmaster < db/migrations/004_create_ll_whatsapp_messages.sql`

### 6.2 Reinicios

- Reiniciar `central-hub`
- Reiniciar `session-manager`

### 6.3 Smoke tests manuales

Insert IN (ejemplo):

- `curl -s -X POST http://localhost:3012/api/listener/incoming-message -H 'Content-Type: application/json' -d '{"cliente_id":51,"from":"5491112345678","message":"hola","timestamp":"2026-02-28T12:00:00.000Z"}'`

Insert OUT (ejemplo):

- `curl -s -X POST http://localhost:3012/api/listener/outgoing-message -H 'Content-Type: application/json' -d '{"cliente_id":51,"from":"5491100000000","to":"5491112345678","message":"respuesta","timestamp":"2026-02-28T12:00:01.000Z"}'`

Ver duplicado (repetir el mismo payload):
- Debe responder `duplicated: true`.

Consulta debug (requiere JWT):
- `GET http://localhost:3012/api/listener/messages?cliente_id=51&limit=50`

---

## 7) Verificación en DB

Validar tabla:

- `DESCRIBE ll_whatsapp_messages;`

Validar índices:

- `SHOW INDEX FROM ll_whatsapp_messages;`

Validar inserción:

- `SELECT cliente_id, direction, wa_from, wa_to, ts_wa, LEFT(message, 40) AS preview FROM ll_whatsapp_messages WHERE cliente_id=51 ORDER BY ts_wa DESC LIMIT 20;`

---

## 8) Riesgos / consideraciones

- **Zona horaria:** `ts_wa` se guarda como string DATETIME derivado de `Date.toISOString()` (UTC). MySQL `DATETIME` no guarda TZ. Si se requiere reporteo en AR (UTC-3), se recomienda normalizar a una convención (p.ej. UTC siempre) y ajustar en consultas/vistas.
- **Contrato documentado vs implementado:** el contrato 5.1 del documento está marcado como PLANNED y no incluye `cliente_id`. La implementación lo requiere por multi-tenant. Recomendación: actualizar contrato en docs/07-CONTRATOS para reflejar el estado real.
- **Colisión de hash:** el hash IN no incluye `direction`. En la práctica IN/OUT se diferencian por `wa_to` y por el patrón de datos; aun así, si se desea aislamiento total, se puede incorporar `IN` explícito al hash de IN (sin cambiar el esquema), con impacto en idempotencia histórica.

---

## 9) Archivos (referencia)

- docs/07-CONTRATOS/Contratos-HTTP-LeadMaster-Workspace.md
- services/central-hub/db/migrations/004_create_ll_whatsapp_messages.sql
- services/central-hub/db/migrations/README.md
- services/central-hub/src/modules/listener/routes/listenerRoutes.js
- services/central-hub/src/modules/listener/controllers/incomingMessageController.js
- services/central-hub/src/modules/listener/services/messagePersistence.js
- services/session-manager/whatsapp/wwebjs-session.js
