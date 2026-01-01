# Integration Plan: Central Hub ↔ Session Manager

**Version:** 1.0  
**Status:** Planning  
**Date:** 2026-01-01

---

## 1. Objective

Define the integration boundaries and requirements for `leadmaster-central-hub` to consume WhatsApp functionality from `session-manager` via HTTP.

**Scope:** HTTP client setup and responsibility definition only.  
**Out of scope:** Business logic, retries, queues, scheduling, deployment.

---

## 2. Session Manager Endpoints to Consume

### Phase 1: Essential Operations

| Endpoint | Method | Purpose | Priority |
|----------|--------|---------|----------|
| `/health` | GET | Service availability check | High |
| `/status` | GET | WhatsApp session state | High |
| `/send` | POST | Send WhatsApp message | Critical |

### Not in Phase 1:
- `/qr-code` - Manual authentication only
- `/account-info` - Informational, not operational
- `/disconnect` - Maintenance only

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
X-Cliente-Id: <from_req.cliente_id>
```

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
- Validate `cliente_id` from authenticated user
- Call session-manager with proper headers
- Handle HTTP errors gracefully
- Return meaningful errors to API consumers
- Log all session-manager interactions

**MUST NOT:**
- Manage WhatsApp sessions directly
- Import `whatsapp-web.js` or any WhatsApp library
- Store WhatsApp session state
- Retry failed sends automatically (business logic decision)
- Queue messages (separate service responsibility)

### 4.2 Session Manager Responsibilities

**MUST:**
- Maintain WhatsApp session per `cliente_id`
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

## 5. Integration Contract

### 5.1 Send Message Flow

```
Client Request
    ↓
Central Hub API
    ├─ Authenticate user
    ├─ Extract cliente_id
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

**Caller decides** whether to proceed based on `state`.

---

## 6. Configuration Summary

### Environment Variables

| Variable | Service | Required | Example |
|----------|---------|----------|---------|
| `SESSION_MANAGER_BASE_URL` | central-hub | Yes | `http://localhost:3001` |
| `CLIENTE_ID` | session-manager | Yes | `51` |
| `PORT` | session-manager | No | `3001` |

### Startup Validation

**Central Hub:**
1. Check `SESSION_MANAGER_BASE_URL` is set
2. Attempt `GET /health` (log warning if fails, don't block)
3. Continue startup

**Session Manager:**
1. Check `CLIENTE_ID` is set (fail fast if missing)
2. Initialize WhatsApp client
3. Start HTTP server

---

## 7. Error Code Mapping

### Session Manager → Central Hub API

| Session Manager | HTTP | Central Hub API | HTTP | Caller Action |
|-----------------|------|-----------------|------|---------------|
| Success | 200 | Success | 200 | Continue |
| Invalid request | 400 | Validation error | 400 | Fix request |
| Session not ready | 409 | Service unavailable | 503 | Wait/retry |
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
- [ ] Review HTTP contracts document
- [ ] Confirm session-manager is stable and tested
- [ ] Define HTTP client module structure in central-hub

**During implementation:**
- [ ] Add `SESSION_MANAGER_BASE_URL` env var
- [ ] Create HTTP client utility (axios/fetch)
- [ ] Implement `/send` integration only
- [ ] Add error handling and logging
- [ ] Test with session-manager running locally

**After implementation:**
- [ ] Validate error scenarios (timeout, 409, 500)
- [ ] Update central-hub README with new env var
- [ ] Document in migration guide

---

## 10. Next Steps

1. Review this document with team
2. Implement minimal HTTP client in central-hub
3. Test `/send` integration with real WhatsApp session
4. Validate error handling under failure conditions
5. Update architecture guide with integration status

---

**This document defines intent, not implementation.**  
Code must follow these boundaries strictly.
