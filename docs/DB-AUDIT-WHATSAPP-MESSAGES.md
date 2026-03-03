# Database Audit: WhatsApp Messages Storage

**Date:** February 23, 2026  
**Database:** `iunaorg_dyd`  
**Scope:** Identify and analyze tables storing WhatsApp messages (inbound/outbound)  
**Status:** IMPLEMENTED + VERIFIED (Phase 3 listener persistence) — Updated: 2026-03-01

---

## 0. Phase 3 Status Update (IMPLEMENTED + VERIFIED)

> **Update notice (2026-03-01):** This audit was originally written in a pre-Phase-3 state.
> As of 2026-03-01, a unified persistence table exists and is verified in production-like operation.

### 0.1 What is implemented

- Central Hub exposes listener endpoints for WhatsApp event ingestion:
  - `POST /api/listener/incoming-message`
  - `POST /api/listener/outgoing-message`
- Listener endpoints require `Authorization: Bearer <jwt>` (missing token → `401` with `"Token no proporcionado"`).
- Central Hub persists WhatsApp messages in a unified table:
  - DB: `iunaorg_dyd`
  - Table: `ll_whatsapp_messages`

### 0.2 Observed columns (as-is)

Visible columns verified:

- `id`
- `cliente_id`
- `direction` (`IN` / `OUT`)
- `wa_from`
- `wa_to`
- `message`
- `ts_wa`
- `message_hash`
- `raw_json`

### 0.3 Idempotency (as-is)

- The persistence layer deduplicates by `message_hash`.
- If the DB has a `UNIQUE` constraint on `message_hash`, duplicates are prevented at DB level.
- If not, Central Hub applies deduplication by hash at application level.

### 0.4 Verification evidence (2026-03-01)

Evidence of end-to-end persistence in `ll_whatsapp_messages`:

- Record `id=36` → `direction=IN`, `cliente_id=51`, `ts_wa=2026-03-01 12:48:27`
- Record `id=37` → `direction=OUT`, `cliente_id=51`, `ts_wa=2026-03-01 12:49:10`

---

## 1. Executive Summary (Historical / pre-Phase-3 context)

This audit analyzed 39 custom tables with prefix `ll_` in the LeadMaster database to identify WhatsApp message storage structures. Three primary tables were identified (pre-Phase-3):

- **`ll_mensajes`** - Generic messages table (currently empty, not in use)
- **`ll_envios_whatsapp`** - Outbound campaign messages (852 records, active)
- **`ll_ia_conversaciones`** - AI conversation messages (98 records, active)

**Key Finding (historical, superseded):** There is no unified table for inbound/outbound WhatsApp messages. Current architecture splits:
- Outbound messages → `ll_envios_whatsapp`
- Inbound messages → `ll_ia_conversaciones` (rol='user')

**Current Key Finding (2026-03-01, verified):** A unified table exists: `ll_whatsapp_messages`.

---

## 2. Complete Table Inventory: `ll_%` Prefix

> **Historical note (pre-Phase-3):** Sections 2–9 below were written before `ll_whatsapp_messages` existed.
> They analyze legacy candidate tables and are kept for context. For the **current, implemented** Phase 3 storage schema, see Section 0.

**Total tables found:** 39

```
ll_bot_respuestas
ll_busquedas
ll_busquedas_realizadas
ll_campanias_whatsapp
ll_cliente_google_tokens
ll_envios_manual
ll_envios_whatsapp
ll_envios_whatsapp_46
ll_envios_whatsapp_backup_20260217
ll_envios_whatsapp_historial
ll_envios_whatsapp_historial_backup_20260217
ll_fuentes
ll_grilla
ll_grillas
ll_grilla_rubros
ll_haby_leads
ll_ia_control
ll_ia_conversaciones
ll_intervenciones_humanas
ll_lugares
ll_lugares_clientes
ll_lugares_clientes_backup_20251210
ll_lugares_haby
ll_lugares_scrap
ll_mensajes
ll_programaciones
ll_programacion_envios_diarios
ll_reactivaciones_ia
ll_rubros
ll_societe_extended
ll_sync_contactos_config
ll_sync_contactos_log
ll_sync_contactos_mapping
ll_temp_telefonos
ll_usuarios
ll_usuarios_wa
ll_whatsapp_qr_authorizations
ll_whatsapp_qr_sessions
ll_zonas
```

---

## 3. Candidate Tables Analysis

### 3.1 Tables with Message-Related Columns

Query used:
```sql
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'iunaorg_dyd'
  AND TABLE_NAME LIKE 'll\_%'
  AND COLUMN_NAME IN (
    'telefono', 'message', 'mensaje', 
    'cliente_id', 'campaign_id', 
    'direction', 'provider', 'raw_payload'
  )
ORDER BY TABLE_NAME;
```

**Result:** 29 matches across multiple tables. Key findings:

| Table | Message Column | Phone Column | Client Column |
|-------|---------------|--------------|---------------|
| `ll_mensajes` | ✅ `mensaje` | ✅ `telefono` | ❌ No |
| `ll_envios_whatsapp` | ❌ No | ❌ No | ✅ `cliente_id` |
| `ll_ia_conversaciones` | ✅ `mensaje` | ✅ `telefono` | ✅ `cliente_id` |
| `ll_campanias_whatsapp` | ✅ `mensaje` | ❌ No | ✅ `cliente_id` |
| `ll_envios_manual` | ✅ `mensaje` | ✅ `telefono` | ❌ No |

---

## 4. Complete Schema: Primary Candidates

### 4.1 `ll_mensajes` (Generic Messages)

**Record count:** 0 (empty table, not in use)

```sql
CREATE TABLE `ll_mensajes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `telefono` varchar(20) DEFAULT NULL,
  `mensaje` text DEFAULT NULL,
  `respuesta` text DEFAULT NULL,
  `fecha` datetime DEFAULT current_timestamp(),
  `fuente` enum('whatsapp','email','web') DEFAULT NULL,
  `lugar_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_lugar` (`lugar_id`),
  CONSTRAINT `fk_lugar` FOREIGN KEY (`lugar_id`) 
    REFERENCES `ll_lugares` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci
```

**Indexes:**
```
PRIMARY KEY: id
KEY: fk_lugar (lugar_id)
```

**Field Analysis:**
- ❌ `cliente_id` - Not present
- ❌ `direction` - Not present (no inbound/outbound distinction)
- ❌ `provider` - Not present
- ❌ `raw_payload` - Not present
- ❌ Index on `telefono` - Not present
- ✅ `fuente` enum - Multi-source support (whatsapp/email/web)
- ⚠️ Table is empty - Not currently used in production

---

### 4.2 `ll_envios_whatsapp` (Outbound Campaign Messages)

**Record count:** 852 (active table)

```sql
CREATE TABLE `ll_envios_whatsapp` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `campania_id` int(11) NOT NULL,
  `cliente_id` int(10) unsigned DEFAULT NULL,
  `telefono_wapp` varchar(255) NOT NULL,
  `nombre_destino` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mensaje_final` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `estado` enum('pendiente','enviado','error') DEFAULT 'pendiente',
  `operador_id` int(10) unsigned DEFAULT NULL,
  `fecha_envio` datetime DEFAULT NULL,
  `message_id` varchar(255) DEFAULT NULL,
  `fecha_apertura` datetime DEFAULT NULL,
  `fecha_confirmacion` datetime DEFAULT NULL,
  `lugar_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_unico_envio` (`campania_id`,`telefono_wapp`),
  UNIQUE KEY `uniq_campania_mobile` (`campania_id`,`telefono_wapp`),
  KEY `idx_envios_lugar_camp_estado` (`lugar_id`,`campania_id`,`estado`),
  KEY `idx_envios_camp_estado` (`campania_id`,`estado`),
  KEY `idx_cliente_id` (`cliente_id`),
  CONSTRAINT `ll_envios_whatsapp_ibfk_1` FOREIGN KEY (`campania_id`) 
    REFERENCES `ll_campanias_whatsapp` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5193 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci
```

**Indexes:**
```
PRIMARY KEY: id
UNIQUE KEY: idx_unico_envio (campania_id, telefono_wapp)
UNIQUE KEY: uniq_campania_mobile (campania_id, telefono_wapp)
KEY: idx_envios_lugar_camp_estado (lugar_id, campania_id, estado)
KEY: idx_envios_camp_estado (campania_id, estado)
KEY: idx_cliente_id (cliente_id)
```

**Field Analysis:**
- ✅ `cliente_id` - Present (int(10) unsigned)
- ✅ Implicit direction - Outbound only (campaign sends)
- ❌ `provider` - Not present
- ❌ `raw_payload` - Not present
- ❌ Index on `telefono_wapp` - Only as part of composite unique key
- ✅ `message_id` - WhatsApp message identifier
- ✅ State tracking - `estado` enum (pendiente/enviado/error)
- ✅ Read receipts - `fecha_apertura`, `fecha_confirmacion`
- ✅ Multi-tenant ready - Has `cliente_id` with index

---

### 4.3 `ll_ia_conversaciones` (AI Conversation Messages)

**Record count:** 98 (active table)

```sql
CREATE TABLE `ll_ia_conversaciones` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `cliente_id` int(11) DEFAULT 51,
  `telefono` varchar(20) NOT NULL,
  `rol` enum('user','assistant') NOT NULL,
  `origen_mensaje` enum('ia','humano','sistema') DEFAULT 'ia',
  `pauso_ia` tinyint(1) DEFAULT 0,
  `mensaje` text NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_cliente_telefono` (`cliente_id`,`telefono`)
) ENGINE=InnoDB AUTO_INCREMENT=199 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci
```

**Indexes:**
```
PRIMARY KEY: id
KEY: idx_cliente_telefono (cliente_id, telefono)
```

**Field Analysis:**
- ✅ `cliente_id` - Present (int(11), default 51)
- ✅ Direction distinction - Via `rol` enum (user=inbound, assistant=outbound)
- ❌ `provider` - Not present
- ❌ `raw_payload` - Not present
- ✅ Index on `telefono` - Composite index with `cliente_id`
- ✅ Message origin - `origen_mensaje` enum (ia/humano/sistema)
- ✅ AI control - `pauso_ia` flag for human intervention
- ✅ Multi-tenant ready - Has `cliente_id` with composite index

---

## 5. Related Tables

### 5.1 `ll_campanias_whatsapp` (Campaign Definitions)

Contains campaign template and configuration.

**Key columns:**
- `cliente_id` int
- `mensaje` text - Campaign template message

---

### 5.2 `ll_envios_manual` (Manual Single Sends)

Individual (non-campaign) message sends.

**Key columns:**
- `telefono` varchar
- `mensaje` text

---

### 5.3 Support Tables

| Table | Purpose |
|-------|---------|
| `ll_bot_respuestas` | Automated response templates |
| `ll_intervenciones_humanas` | Human intervention log |
| `ll_ia_control` | AI state control per phone |
| `ll_reactivaciones_ia` | Reactivation triggers |
| `ll_sync_contactos_log` | Contact sync audit trail |

---

## 6. Critical Field Analysis (Historical / pre-Phase-3)

### 6.1 `cliente_id` Presence

| Table | Has `cliente_id` | Type | Default | Index |
|-------|-----------------|------|---------|-------|
| `ll_mensajes` | ❌ No | - | - | - |
| `ll_envios_whatsapp` | ✅ Yes | int(10) unsigned | NULL | ✅ Single-column index |
| `ll_ia_conversaciones` | ✅ Yes | int(11) | 51 | ✅ Composite with `telefono` |

**Conclusion:** Only active tables have `cliente_id`. `ll_mensajes` lacks multi-tenant support.

---

### 6.2 Inbound/Outbound Direction

| Table | Direction Support | Implementation |
|-------|------------------|----------------|
| `ll_mensajes` | ❌ None | No direction field |
| `ll_envios_whatsapp` | ⚠️ Implicit | Outbound only (campaign sends) |
| `ll_ia_conversaciones` | ✅ Explicit | `rol` enum ('user'=inbound, 'assistant'=outbound) |

**Conclusion (historical):** No table has a dedicated `direction` column. Direction is implicit or role-based.

---

### 6.3 Provider Field

**Result:** ❌ None of the candidate tables have a `provider` field.

This means there is currently **no distinction between**:
- WhatsApp Web (whatsapp-web.js)
- WhatsApp Business API (Meta Cloud API)
- Future providers

---

### 6.4 Raw Payload Storage

**Result:** ❌ None of the candidate tables have a `raw_payload` or similar field.

Current tables only store:
- Processed message text (`mensaje`)
- Structured metadata (timestamps, IDs, status)

**Impact:** Cannot reconstruct original webhook payloads or debug provider-specific issues.

---

### 6.5 Phone Number Indexing

| Table | Phone Column | Indexed | Index Type |
|-------|-------------|---------|------------|
| `ll_mensajes` | `telefono` varchar(20) | ❌ No | - |
| `ll_envios_whatsapp` | `telefono_wapp` varchar(255) | ⚠️ Partial | Part of UNIQUE composite key |
| `ll_ia_conversaciones` | `telefono` varchar(20) | ✅ Yes | Composite with `cliente_id` |

**Conclusion:** Only `ll_ia_conversaciones` has proper phone number indexing for lookups.

---

## 7. Technical Conclusions

> **Scope note:** This section is primarily **historical (pre-Phase-3)** and refers to the legacy tables analyzed in Sections 2–6.
> The current Phase 3 storage is `ll_whatsapp_messages` (see Section 0).

### 7.1 State Assessment (Historical / pre-Phase-3)

**Strengths:**
- ✅ Multi-tenant support in active tables (`cliente_id`)
- ✅ Campaign tracking well-structured (`ll_envios_whatsapp`)
- ✅ AI conversation flow properly indexed (`ll_ia_conversaciones`)
- ✅ State machine for outbound messages (`estado` enum)
- ✅ WhatsApp `message_id` tracking

**Weaknesses (historical, superseded by Phase 3):**
- ❌ No unified inbound/outbound message table
- ❌ No `provider` field (cannot distinguish Web vs Meta API)
- ❌ No `raw_payload` storage (debugging limitation)
- ❌ `ll_mensajes` designed but unused (0 records)
- ❌ Phone number indexing inconsistent
- ⚠️ Implicit direction logic (split across tables)

### 7.2 Current (Phase 3) gaps / hardening opportunities

Based on the **implemented** table `ll_whatsapp_messages` (Section 0, as-is columns observed):

- Confirm whether `message_hash` is enforced as `UNIQUE` at DB level; otherwise, ensure dedup remains reliable at app level.
- Document and verify the exact mapping rules:
  - incoming/outgoing → `direction` (`IN`/`OUT`)
  - WhatsApp sender/recipient → `wa_from` / `wa_to`
  - WhatsApp timestamp source → `ts_wa`
- Improve observability for listener ingestion:
  - explicit 4xx/5xx responses
  - structured logs (without secrets) including status and error reason
- Provider/source tagging is not represented as a dedicated column in the observed schema; if provider distinction is needed, document how it is currently inferred (if at all).

---

### 7.3 Multi-Provider Support (Web + Meta API)

**Question:** Does the current schema support both WhatsApp Web and Meta Cloud API?

**Answer:** ❌ **No, not properly.**

**Issues:**
1. No `provider` field to distinguish source
2. `message_id` format differs between providers:
   - Web: Internal session-based IDs
   - Meta: `wamid.XXX` format from webhook
3. Payload structure differs:
   - Web: whatsapp-web.js events
   - Meta: Webhook JSON payloads
4. No storage for provider-specific metadata

**Required for proper support:**
- `provider` enum('web', 'meta', 'business_api')
- `raw_payload` JSON/TEXT for webhook data
- `external_message_id` (provider's native ID)
- `metadata` JSON for provider-specific fields

---

### 7.4 Multi-Tenant Readiness

**Question:** Is the schema properly prepared for multi-tenant operation?

| Table | Multi-Tenant Ready | Evidence |
|-------|-------------------|----------|
| `ll_mensajes` | ❌ No | No `cliente_id` field |
| `ll_envios_whatsapp` | ✅ Yes | Has `cliente_id` + index |
| `ll_ia_conversaciones` | ✅ Yes | Has `cliente_id` + composite index |

**Conclusion:** Active tables (852 + 98 records) are multi-tenant ready. Unused `ll_mensajes` is not.

---

## 8. Recommended Schema Migration (Historical / superseded)

> **Status (2026-03-01):** A unified table `ll_whatsapp_messages` is **implemented + verified** (Section 0).
> **Schema selection is CLOSED.** The options below are preserved only as historical design notes and do not represent current next steps.

### 8.1 Option A: Extend `ll_ia_conversaciones` (Minimal Change) — Historical

**Rationale:** Already in use, has proper indexing, supports direction via `rol`.

```sql
-- Add provider support
ALTER TABLE `ll_ia_conversaciones`
  ADD COLUMN `provider` ENUM('web', 'meta', 'business_api') NOT NULL DEFAULT 'web' AFTER `telefono`,
  ADD COLUMN `external_message_id` VARCHAR(255) DEFAULT NULL AFTER `provider`,
  ADD COLUMN `raw_payload` JSON DEFAULT NULL AFTER `mensaje`,
  ADD INDEX `idx_provider_external_id` (`provider`, `external_message_id`);
```

**Impact:**
- ✅ Minimal disruption (table already in use)
- ✅ Preserves existing 98 records
- ✅ Maintains multi-tenant indexing
- ⚠️ Mixes AI conversation logic with raw message storage

---

### 8.2 Option B: Activate and Extend `ll_mensajes` (Clean Separation) — Historical

**Rationale:** Purpose-built for messages but currently unused.

```sql
-- Add missing multi-tenant and provider support
ALTER TABLE `ll_mensajes`
  ADD COLUMN `cliente_id` INT(11) NOT NULL DEFAULT 51 AFTER `id`,
  ADD COLUMN `direction` ENUM('inbound', 'outbound') NOT NULL AFTER `telefono`,
  ADD COLUMN `provider` ENUM('web', 'meta', 'business_api') NOT NULL DEFAULT 'web' AFTER `direction`,
  ADD COLUMN `external_message_id` VARCHAR(255) DEFAULT NULL AFTER `provider`,
  ADD COLUMN `raw_payload` JSON DEFAULT NULL AFTER `respuesta`,
  ADD INDEX `idx_cliente_telefono` (`cliente_id`, `telefono`),
  ADD INDEX `idx_provider_external_id` (`provider`, `external_message_id`),
  ADD INDEX `idx_direction_fecha` (`direction`, `fecha`);

-- Update fuente enum to be more precise
ALTER TABLE `ll_mensajes`
  MODIFY COLUMN `fuente` ENUM('whatsapp','email','web','api') DEFAULT 'whatsapp';
```

**Impact:**
- ✅ Clean separation: messages vs AI conversation logic
- ✅ Unified inbound/outbound storage
- ✅ Proper multi-tenant architecture
- ✅ Provider-agnostic design
- ⚠️ Table is currently empty (requires data migration from existing tables)

---

### 8.3 Option C: Create New `ll_whatsapp_messages` (Future-Proof) — Historical

**Rationale (historical):** Fresh design specifically for WhatsApp message storage.

> **Important:** The SQL below is a **pre-implementation proposal** and does **not** describe the verified as-is schema.
> The observed, implemented columns are listed in Section 0.2.

```sql
CREATE TABLE `ll_whatsapp_messages` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `cliente_id` INT(11) NOT NULL,
  `direction` ENUM('inbound', 'outbound') NOT NULL,
  `provider` ENUM('web', 'meta', 'business_api') NOT NULL DEFAULT 'web',
  `from_number` VARCHAR(20) NOT NULL,
  `to_number` VARCHAR(20) NOT NULL,
  `message_body` TEXT NOT NULL,
  `message_type` ENUM('text', 'image', 'audio', 'video', 'document', 'location', 'contact') DEFAULT 'text',
  `external_message_id` VARCHAR(255) DEFAULT NULL COMMENT 'Provider message ID (wamid for Meta)',
  `conversation_id` VARCHAR(255) DEFAULT NULL COMMENT 'Thread/conversation identifier',
  `campaign_id` INT(11) DEFAULT NULL COMMENT 'NULL for inbound or non-campaign outbound',
  `status` ENUM('pending', 'sent', 'delivered', 'read', 'failed', 'error') DEFAULT 'pending',
  `error_message` TEXT DEFAULT NULL,
  `raw_payload` JSON DEFAULT NULL COMMENT 'Full webhook/event payload',
  `metadata` JSON DEFAULT NULL COMMENT 'Provider-specific metadata',
  `timestamp` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_provider_external_id` (`provider`, `external_message_id`),
  KEY `idx_cliente_direction` (`cliente_id`, `direction`),
  KEY `idx_from_number_timestamp` (`from_number`, `timestamp`),
  KEY `idx_to_number_timestamp` (`to_number`, `timestamp`),
  KEY `idx_conversation_id` (`conversation_id`),
  KEY `idx_campaign_id` (`campaign_id`),
  KEY `idx_status_timestamp` (`status`, `timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Impact:**
- ✅ Complete WhatsApp-specific design
- ✅ Multi-provider support (Web + Meta + future)
- ✅ Full message lifecycle tracking
- ✅ Supports rich media types
- ✅ Proper indexing for common queries
- ✅ JSON columns for flexibility
- ✅ UTF8MB4 for emoji support
- ⚠️ Requires full data migration strategy
- ⚠️ Most invasive option (new table, new code integration)

---

## 9. Recommendation

### 9.1 Historical recommendation (Feb 23, 2026)

At the time of the original audit, the recommended approach was **Option B** (activate and extend `ll_mensajes`) as a low-risk path to unified storage.

### 9.2 Current status (Mar 1, 2026)

- **IMPLEMENTED + VERIFIED:** Central Hub persists WhatsApp messages in `iunaorg_dyd.ll_whatsapp_messages`.
- Listener ingestion endpoints exist and require `Authorization: Bearer <jwt>`.
- Evidence records exist (Section 0.4: `id=36` IN, `id=37` OUT, `cliente_id=51`).

**Recommendation status:** CLOSED — no schema migration is recommended in this document. Focus is hardening/observability and documentation of the as-is behavior.

---

## 10. Next Steps

> **Update (2026-03-01):** Listener persistence is implemented. Next steps should focus on hardening and observability rather than schema selection.

1. Confirm and document whether `message_hash` is enforced as `UNIQUE` (or explicitly confirm dedup is app-level).
2. Ensure listener endpoints return explicit 4xx/5xx payloads for troubleshooting, and log errors with enough context (without logging tokens or secrets).
3. Validate multi-tenant behavior with multiple `cliente_id` values (not only `51`).
4. Document the exact message ingestion mapping (incoming/outgoing → `direction`, sender/recipient → `wa_from`/`wa_to`, timestamp source → `ts_wa`).

---

## Appendix A: Query Commands Used

```sql
-- List all ll_% tables
SELECT TABLE_NAME
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'iunaorg_dyd'
  AND TABLE_NAME LIKE 'll\_%'
ORDER BY TABLE_NAME;

-- Find message-related columns
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'iunaorg_dyd'
  AND TABLE_NAME LIKE 'll\_%'
  AND COLUMN_NAME IN ('telefono', 'mensaje', 'cliente_id')
ORDER BY TABLE_NAME;

-- Get table schema
SHOW CREATE TABLE ll_mensajes;
SHOW CREATE TABLE ll_envios_whatsapp;
SHOW CREATE TABLE ll_ia_conversaciones;

-- Get indexes
SHOW INDEX FROM ll_mensajes;
SHOW INDEX FROM ll_envios_whatsapp;
SHOW INDEX FROM ll_ia_conversaciones;

-- Count records
SELECT COUNT(*) FROM ll_mensajes;
SELECT COUNT(*) FROM ll_envios_whatsapp;
SELECT COUNT(*) FROM ll_ia_conversaciones;
```

---

**Report Generated:** February 23, 2026  
**Database (environment at time of the initial audit):** `iunaorg_dyd` @ `sv46.byethost46.org`  
**Total Tables Audited:** 39  
**Primary Candidates Analyzed:** 3  
**Status:** IMPLEMENTED + VERIFIED (updated 2026-03-01)
