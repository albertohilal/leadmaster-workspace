# Integration Plan: Central Hub ↔ Session Manager

**Version:** 2.1  
**Status:** Active (As-is aligned)  
**Date:** 2026-02-27

---

## 1. Objective

Define the integration boundaries and requirements for `leadmaster-central-hub` to consume WhatsApp functionality from `session-manager` via HTTP.

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

## 3. HTTP Client Requirements

### 3.1 Configuration

**Environment Variable:**
```bash
SESSION_MANAGER_BASE_URL=http://localhost:3001
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

**Identity rule (as-is):**

- `session-manager` es **single-admin** (no `instance_id`).
- `cliente_id` es requerido por `POST /send` (validación), pero es **metadata** (no selecciona sesión).
- `X-Cliente-Id` no es requerido por el upstream `session-manager`.

**Timeouts:**
- Connection timeout: `5s`
- Read timeout: `30s` (WhatsApp operations can be slow)
- No automatic retries at HTTP client level

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
- Resolve and authorize an `instance_id` for the authenticated context
- Call session-manager using canonical instance-based routes
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
- Maintain WhatsApp session per `instance_id`
- Respond to HTTP requests synchronously
- Return session state accurately
- Handle one message send at a time

**MUST NOT:**
- Access central-hub database
- Store business logic (campaigns, leads, etc.)
- Make decisions about when/what to send
- Call external services (IA, webhooks, etc.)
- Listen to or process incoming WhatsApp messages (listener service)

---

## 5. Integration Contract (AS-IS)

### 5.1 Send Message Flow

```
Client Request
    ↓
Central Hub API
    ├─ Authenticate user
    ├─ Resolve instance_id
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
❌ Incoming message handling  
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
