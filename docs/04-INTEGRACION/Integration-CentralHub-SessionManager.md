# Integration Plan: Central Hub ↔ Session Manager

**Version:** 2.2  
**Status:** Active (As-is aligned)  
**Date:** 2026-03-01

---

## 1. Objective

Define the integration boundaries and requirements between `leadmaster-central-hub` and `session-manager` for WhatsApp operations.

This document covers two directions:

1) Central Hub → Session Manager (send/status/qr/connect)
2) Session Manager → Central Hub (Phase 3 bridge: listener + persistence with JWT)

**Scope:** HTTP client setup and responsibility definition only.  
**Out of scope:** Business logic, retries, queues, scheduling, deployment.

---

## 2. Session Manager Endpoints to Consume (IMPLEMENTED)

### Essential Operations

| Endpoint | Method | Purpose | Priority |
|----------|--------|---------|----------|
| `/health` | GET | Service availability check | High |
| `/status` | GET | Current session state (single-admin) | High |
| `/qr` | GET | Current QR (if available) | High |
| `/connect` | POST | Start/ensure connection | High |
| `/disconnect` | POST | Controlled disconnect | Medium |
| `/send` | POST | Send WhatsApp message | Critical |

### Not implemented in session-manager today

- Multi-instance routes (`/api/session-manager/sessions/:instance_id/...`)
- Account-info endpoint

---

## 2.2 Central Hub Endpoints Consumed by Session Manager (IMPLEMENTED + VERIFIED)

### Auth (JWT)

| Endpoint | Method | Purpose | Notes |
|----------|--------|---------|-------|
| `/api/auth/login` | POST | Obtain JWT for internal listener calls | Body: `username/password` (alias `usuario/password`) |

### Listener (persistence)

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/api/listener/incoming-message` | POST | Persist inbound message events (IN) | `Authorization: Bearer <jwt>` |
| `/api/listener/outgoing-message` | POST | Persist outbound message events (OUT) | `Authorization: Bearer <jwt>` |

---

## 3. HTTP Client Requirements

### 3.1 Configuration

**Environment Variable:**
```bash
SESSION_MANAGER_BASE_URL=http://localhost:3001
```

**Environment Variables (Phase 3 bridge in session-manager):**

```bash
CENTRAL_HUB_BASE_URL=http://localhost:3012
CENTRAL_HUB_USER=<user>
CENTRAL_HUB_PASS=<pass>

# Opcionales
INTERNAL_LISTENER_TOKEN=<token>
CENTRAL_HUB_CLIENTE_ID=51
```

**Validation:**
- Must be set at startup
- Must be a valid HTTP/HTTPS URL
- Should fail fast if missing or unreachable

### 3.2 Request Standards

**Headers:**
```http
Content-Type: application/json
```

**Headers (Session Manager → Central Hub listener):**

```http
Authorization: Bearer <jwt>       # OBLIGATORIO
X-Internal-Token: <token>         # OPCIONAL (si existe INTERNAL_LISTENER_TOKEN)
Content-Type: application/json
```

**Identity rule (as-is):**

- `session-manager` es **single-admin** (no `instance_id`).
- `cliente_id` es requerido por `POST /send` (validación), pero es **metadata** (no selecciona sesión).
- `X-Cliente-Id` no es requerido por el upstream `session-manager`.

**Timeouts:**
- Connection timeout: `5s`
- Read timeout: `30s` (WhatsApp operations can be slow)
- No automatic retries at HTTP client level

**JWT behavior (as-is, implemented):**

- Session Manager obtiene JWT via `POST /api/auth/login` usando `CENTRAL_HUB_USER/CENTRAL_HUB_PASS`.
- Cache en memoria con TTL de ~20 min.
- Si un POST al listener devuelve `401`, Session Manager limpia el token y hace re-login 1 vez.

### 3.3 Error Handling

**Error Propagation:**

| Session Manager Response | Central Hub Action |
|--------------------------|-------------------|
| `200 OK` | Return success to caller |
| `400 Bad Request` | Return validation error to caller |
| `409 Conflict` (session not ready) | Return `SERVICE_UNAVAILABLE` to caller |
| `500 Internal Error` | Return `WHATSAPP_ERROR` to caller |
| Network timeout | Return `SESSION_MANAGER_TIMEOUT` to caller |
| Connection refused | Return `SESSION_MANAGER_UNREACHABLE` to caller |

**No retries.** Caller decides whether to retry.

---

## 4. Responsibility Boundaries

### 4.1 Central Hub Responsibilities

**MUST:**
- Consume session-manager endpoints as-is (`/send`, `/status`, `/qr`, `/connect`, `/disconnect`)
- Expose `POST /api/auth/login` and issue JWT for internal calls
- Protect listener endpoints with `Authorization: Bearer <jwt>`
- Validate and persist `cliente_id` (multi-tenant)
- Persist WhatsApp events into `ll_whatsapp_messages`
- Handle HTTP errors gracefully
- Return meaningful errors to API consumers
- Log all session-manager interactions

**MUST NOT:**
- Manage WhatsApp sessions directly
- Import `whatsapp-web.js` or any WhatsApp library
- Store WhatsApp session state
- Retry failed sends automatically (business logic decision)
- Queue messages (separate service responsibility)
- Translate or remap session-manager enums (consume as-is)

### 4.2 Session Manager Responsibilities

**MUST:**
- Maintain WhatsApp session (single-admin)
- Respond to HTTP requests synchronously
- Return session state accurately
- Handle one message send at a time

- Capture WhatsApp events (IN/OUT) and emit them to Central Hub listener endpoints for persistence

**MUST NOT:**
- Access central-hub database
- Store business logic (campaigns, leads, etc.)
- Make decisions about when/what to send
- Call external services (IA, webhooks, etc.)
- Process business logic for incoming messages (Central Hub owns listener + persistence)

---

## 5. Integration Contract (AS-IS)

### 5.1 Send Message Flow

```
Client Request
    ↓
Central Hub API
    ├─ Authenticate user
    ├─ Validate payload
    ↓
HTTP POST to Session Manager
        POST /send
    {
            "cliente_id": 51,
            "to": "5491123456789",
            "message": "..."
    }
    ↓
Session Manager Response
    ↓
Central Hub API
    ├─ Log result
    └─ Return to client
```

**Central Hub does NOT:**
- Retry on failure
- Queue if session not ready
- Transform phone numbers
- Add message metadata

### 5.2 Health Check Flow

```
Central Hub Startup
    ↓
GET /health to Session Manager
    ↓
If 200 OK → Proceed
If timeout/error → Log warning, continue
    ↓
Periodic health check (optional)
```

**Do NOT block startup** if session-manager is unreachable.

### 5.3 Status Check Flow

```
API Request: "Can I send WhatsApp?"
    ↓
Central Hub
    ↓
GET /status from Session Manager
    ↓
Return state to caller
```

GET `/status` from Session Manager
    ↓
**Caller decides** whether to proceed based on `status`.

**Enums implementados (uppercase):**

- `status`: `INIT | QR_REQUIRED | AUTHENTICATED | READY | DISCONNECTED | ERROR`

---

### 5.4 Phase 3 Bridge Flow (Session Manager → Central Hub Listener)

This flow persists WhatsApp events (IN/OUT) in Central Hub.

```
WhatsApp Web (wwebjs events)
    ↓
Session Manager
    ├─ POST /api/auth/login (Central Hub) → obtain JWT
    ├─ Cache token (TTL ~20 min)
    ↓
HTTP POST to Central Hub listener (with Authorization Bearer)
        POST /api/listener/incoming-message
        POST /api/listener/outgoing-message
    {
        "cliente_id": 51,
        "from": "...",
        "to": "..." (OUT only),
        "message": "...",
        "timestamp": "..."
    }
    ↓
Central Hub
    └─ Persist in MySQL: ll_whatsapp_messages
```

**Error behavior (as-is):**

- If listener returns `401`, Session Manager clears cached JWT and retries login once.
- If POST fails, Session Manager logs HTTP status and response body.

---

## 6. Configuration Summary

### Environment Variables

| Variable | Service | Required | Example |
|----------|---------|----------|---------|
| `SESSION_MANAGER_BASE_URL` | central-hub | Yes | `http://localhost:3001` |
| `PORT` | session-manager | No | `3001` |

### Startup Validation

**Central Hub:**
1. Check `SESSION_MANAGER_BASE_URL` is set
2. Attempt `GET /health` (log warning if fails, don't block)
3. Continue startup

**Session Manager:**
1. Start HTTP server
2. Best-effort connect on startup (single-admin)

---

## 7. Error Code Mapping (AS-IS)

### Session Manager → Central Hub API

| Session Manager | HTTP | Central Hub API | HTTP | Caller Action |
|-----------------|------|-----------------|------|---------------|
| Success | 200 | Success | 200 | Continue |
| Invalid request | 400 | Validation error | 400 | Fix request |
| Session not ready | 503 | Service unavailable | 503 | Wait/retry |
| Internal error | 500 | WhatsApp error | 502 | Investigate |
| Timeout | - | Gateway timeout | 504 | Retry later |

---

## 8. What This Integration Does NOT Include

❌ Message queuing  
❌ Automatic retries  
❌ Rate limiting  
❌ Campaign scheduling  
❌ Incoming message business logic (beyond persistence)  
❌ AI processing  
❌ Database access from session-manager  
❌ PM2 configuration changes  
❌ Docker setup  

---

## 9. Implementation Checklist

**Before coding:**
- [x] Review HTTP contracts document
- [x] Confirm session-manager API shape
- [x] Define HTTP client module structure in central-hub

**During implementation:**
- [x] Add `SESSION_MANAGER_BASE_URL` env var
- [x] Create HTTP client utility (axios/fetch)
- [ ] Implement endpoints: `/status`, `/qr`, `/connect`, `/disconnect`, `/send`
- [ ] Add error handling and logging
- [ ] Test with session-manager running locally

**After implementation:**
- [ ] Validate error scenarios (timeout, 409, 500)
- [ ] Update central-hub README with new env var
- [ ] Document in migration guide

---

## 10. Known Gaps / Mismatches in Current Code

Estos puntos son relevantes porque hoy existen **múltiples capas** en central-hub que no están alineadas entre sí ni con session-manager:

- `session-manager` implementa `GET /qr`, pero el cliente `sessionManagerClient.getQrCode()` en central-hub apunta a `GET /qr-code` (no existe en session-manager).
- `session-manager` responde `POST /send` con `{ success: true, data: ... }`, pero algunas capas en central-hub esperan `{ ok: true, message_id }`.
- `session-manager` expone `GET /status` como `{ status: "READY" }`, pero hay código en central-hub que espera campos adicionales (`state`, `connected`).

## 11. Next Steps

1. Review this document with team
2. Implement minimal HTTP client in central-hub
3. Test `/send` integration with real WhatsApp session
4. Validate error handling under failure conditions
5. Update architecture guide with integration status

---

**This document defines intent, not implementation.**  
Code must follow these boundaries strictly.
