# ARCHITECTURE STATE — 2026-02 (WhatsApp Contract Freeze)

**Status:** Active (AS-IS + Planned target)  
**Purpose:** Documentar el contrato real actual de WhatsApp y el objetivo de “contract freeze” para evitar deriva  
**Date:** 2026-02-27  
**Related:** [SYSTEM_BOUNDARIES.md](./SYSTEM_BOUNDARIES.md), [Contratos-HTTP-LeadMaster-Workspace.md](../07-CONTRATOS/Contratos-HTTP-LeadMaster-Workspace.md)

---

## 0. Reality snapshot (IMPLEMENTED)

### 0.1 Identity model (as-is)

- `session-manager` opera como **single-admin** (una sesión WhatsApp para todo el sistema).
- No existe `instance_id` en la API real hoy.
- `cliente_id` es requerido por `POST /send` como **metadata** (no selecciona sesión).

### 0.2 API surface (as-is)

- `GET /health` → `{ status: "ok", service: "session-manager", timestamp }`
- `GET /status` → `{ status: "READY" | ... }`
- `GET /qr` → `{ status: "NO_QR" }` o `{ status: "QR_AVAILABLE", qr: "data:image/png;base64,..." }`
- `POST /connect`
- `POST /disconnect`
- `POST /send` (body requiere `cliente_id`, `to`, `message`)

### 0.3 Enums (as-is)

**SessionStatus (uppercase, legacy):**

- `INIT`
- `QR_REQUIRED`
- `AUTHENTICATED`
- `READY`
- `DISCONNECTED`
- `ERROR`

Nota: en central-hub existen capas que normalizan/mapean estados. Eso hoy es parte del comportamiento real del sistema.

---

## 1. Non-negotiable invariants (PLANNED TARGET)

### 1.1 Identity model (WhatsApp layer)

- **Target: WhatsApp identity = `instance_id` only.**
- `instance_id` es un string opaco y estable (ej: `"acme-01"`).
Objetivo:

- Prohibido transportar `cliente_id` a la capa WhatsApp (session-manager / listener / etc.).
- Prohibido el header `X-Cliente-Id` en contratos WhatsApp.

> Nota: la relación entre `cliente_id` y `instance_id` (si existe) pertenece al dominio de central-hub y no forma parte del contrato WhatsApp.

### 1.2 Frozen enums (no new states)

**Target SessionStatus** (únicos valores válidos):

- `init`
- `qr_required`
- `connecting`
- `connected`
- `disconnected`
- `error`

**Target QRStatus** (únicos valores válidos):

- `none`
- `generated`
- `expired`
- `used`

Reglas:

- No se agregan estados nuevos.
- No se renombran estados.
- No se aceptan estados “legacy” (`READY`, `AUTHENTICATED`, `QR_GENERATED`, etc.).

### 1.3 No translation / mapping

Objetivo:

- central-hub consume `SessionStatus` y `QRStatus` tal cual vienen del contrato.
- No existe capa de “mapeo” (ej: `READY → connected`).

AS-IS: hoy existen capas en central-hub que hacen normalización/mapeo.

---

## 2. Canonical HTTP surface (PLANNED TARGET)

Este documento fija el **contrato objetivo** para consumo de WhatsApp.

### 2.1 Session Manager API

- `GET /health` (sin identidad)
- `GET /api/session-manager/sessions/{instance_id}`
- `POST /api/session-manager/sessions/{instance_id}/qr`
- `POST /api/session-manager/sessions/{instance_id}/send`
- `POST /api/session-manager/sessions/{instance_id}/disconnect`

### 2.2 Response shape (normative)

`GET /api/session-manager/sessions/{instance_id}` retorna un snapshot mínimo:

```json
{
  "instance_id": "acme-01",
  "status": "connected",
  "qr_status": "none",
  "qr_string": null,
  "updated_at": "2026-02-27T12:00:00Z"
}
```

Reglas:

- `status` y `qr_status` deben ser valores válidos de los enums congelados.
- `qr_string` solo puede existir cuando `qr_status = generated` (o `expired` si se decide retener el último QR). Si no aplica, debe ser `null`.

---

## 3. Error contract

Los errores deben ser explícitos y tipificados.

Formato sugerido:

```json
{
  "error": true,
  "code": "SESSION_NOT_CONNECTED",
  "message": "WhatsApp session is not connected"
}
```

Ejemplos de `code` comunes:

- `INVALID_INSTANCE_ID`
- `SESSION_NOT_CONNECTED`
- `ALREADY_CONNECTED`
- `QR_NOT_AVAILABLE`
- `WHATSAPP_ERROR`

---

## 4. Change control

Cualquier cambio en:

- identidad (`instance_id`),
- enums (`SessionStatus`, `QRStatus`),
- o rutas canónicas de la capa WhatsApp,

requiere:

- entrada explícita en [DECISION_LOG.md](./DECISION_LOG.md),
- y actualización coordinada en contratos e integración.
