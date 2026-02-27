# ARCHITECTURE STATE — 2026-02 (WhatsApp Contract Freeze)

**Status:** Active (Constitutional)  
**Purpose:** Congelar el contrato de la capa WhatsApp para evitar deriva (identidad, enums, reglas de consumo)  
**Date:** 2026-02-27  
**Related:** [SYSTEM_BOUNDARIES.md](./SYSTEM_BOUNDARIES.md), [Contratos-HTTP-LeadMaster-Workspace.md](../07-CONTRATOS/Contratos-HTTP-LeadMaster-Workspace.md)

---

## 1. Non-negotiable invariants

### 1.1 Identity model (WhatsApp layer)

- **WhatsApp identity = `instance_id` only.**
- `instance_id` es un string opaco y estable (ej: `"acme-01"`).
- **Prohibido** transportar `cliente_id` a la capa WhatsApp (session-manager / listener / etc.).
- **Prohibido** el header `X-Cliente-Id` en contratos WhatsApp.

> Nota: la relación entre `cliente_id` y `instance_id` (si existe) pertenece al dominio de central-hub y no forma parte del contrato WhatsApp.

### 1.2 Frozen enums (no new states)

**SessionStatus** (únicos valores válidos):

- `init`
- `qr_required`
- `connecting`
- `connected`
- `disconnected`
- `error`

**QRStatus** (únicos valores válidos):

- `none`
- `generated`
- `expired`
- `used`

Reglas:

- No se agregan estados nuevos.
- No se renombran estados.
- No se aceptan estados “legacy” (`READY`, `AUTHENTICATED`, `QR_GENERATED`, etc.).

### 1.3 No translation / mapping

- central-hub **consume** `SessionStatus` y `QRStatus` **tal cual** vienen del contrato.
- No existe capa de “mapeo” (ej: `READY → connected`).
- Si un estado no está en los enums congelados, es un **bug**.

---

## 2. Canonical HTTP surface (WhatsApp layer)

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
