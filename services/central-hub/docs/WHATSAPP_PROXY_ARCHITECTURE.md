# WhatsApp Proxy Architecture

## Overview

The Central Hub exposes WhatsApp session management capabilities through a **robust, single-responsibility proxy layer** that communicates with an external Session Manager microservice.

**Core Principle:** All communication with the Session Manager flows through a single, well-tested HTTP client (`sessionManagerClient.js`). No route handler makes direct HTTP calls.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client / Frontend                        │
│                    (Browser, Mobile, Scripts)                    │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                │ HTTP
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│                       Central Hub (Port 3012)                    │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │         src/routes/whatsappQrProxy.js                    │   │
│  │  • GET /api/whatsapp/:clienteId/status                   │   │
│  │  • GET /api/whatsapp/:clienteId/qr                       │   │
│  │                                                           │   │
│  │  Responsibilities:                                        │   │
│  │  - Validate clienteId                                     │   │
│  │  - Delegate to sessionManagerClient                       │   │
│  │  - Map errors to HTTP status codes                        │   │
│  │  - Act as transparent proxy                               │   │
│  └────────────────────────┬─────────────────────────────────┘   │
│                           │                                       │
│                           │ function call                         │
│                           │                                       │
│  ┌────────────────────────▼────────────────────────────────┐   │
│  │      src/services/sessionManagerClient.js               │   │
│  │                                                           │   │
│  │  Public API:                                              │   │
│  │  • getHealth(clienteId)    → GET /health                 │   │
│  │  • getStatus(clienteId)    → GET /status                 │   │
│  │  • getQR(clienteId)        → GET /qr                     │   │
│  │  • sendMessage(...)        → POST /send                  │   │
│  │                                                           │   │
│  │  Responsibilities:                                        │   │
│  │  - Add X-Cliente-Id header                               │   │
│  │  - Handle timeouts (5s connect, 30s read)                │   │
│  │  - Propagate errors with statusCode                      │   │
│  │  - Use native http/https modules (no axios)              │   │
│  └────────────────────────┬────────────────────────────────┘   │
│                           │                                       │
└───────────────────────────┼───────────────────────────────────┬─┘
                            │                                   │
                            │ HTTP                              │
                            │ X-Cliente-Id: 51                  │
                            │                                   │
┌───────────────────────────▼───────────────────────────────────┐
│              Session Manager Microservice (Port 3001)          │
│                                                                 │
│  Endpoints:                                                     │
│  • GET /health    - Service health check                       │
│  • GET /status    - WhatsApp connection status                 │
│  • GET /qr        - WhatsApp QR code (base64 or string)        │
│  • POST /send     - Send WhatsApp message                      │
│                                                                 │
│  Responsibilities:                                              │
│  - Manage whatsapp-web.js clients                              │
│  - Handle QR generation                                         │
│  - Maintain WebSocket connections to WhatsApp                  │
│  - Execute message sending                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Responsibilities

### 1. `sessionManagerClient.js` (Service Layer)
**Single Source of Truth for Session Manager Communication**

#### What it DOES:
- ✅ Forward HTTP requests to Session Manager
- ✅ Add `X-Cliente-Id` header to all requests
- ✅ Handle connection timeouts (5 seconds)
- ✅ Handle read timeouts (30 seconds)
- ✅ Propagate errors transparently with `statusCode` and `response`
- ✅ Parse JSON responses
- ✅ Map network errors to meaningful error messages

#### What it DOES NOT do:
- ❌ Retry failed requests
- ❌ Queue messages
- ❌ Manage WhatsApp state
- ❌ Add business logic
- ❌ Transform data structures

#### Public Methods:
```javascript
getHealth(clienteId)       // GET /health
getStatus(clienteId)       // GET /status
getQR(clienteId)          // GET /qr
sendMessage(clienteId, to, message)  // POST /send
```

#### Error Handling:
All methods throw errors with these properties:
```javascript
{
  message: string,           // Error description
  statusCode?: number,       // HTTP status from Session Manager
  code?: string,            // Error code from Session Manager
  response?: object         // Full response body from Session Manager
}
```

Special error messages:
- `SESSION_MANAGER_TIMEOUT: Connection timeout`
- `SESSION_MANAGER_TIMEOUT: Read timeout exceeded`
- `SESSION_MANAGER_UNREACHABLE: Connection refused`
- `SESSION_MANAGER_ERROR: <network error>`

---

### 2. `whatsappQrProxy.js` (Route Layer)
**Public API for WhatsApp QR and Status**

#### What it DOES:
- ✅ Define public routes (`/api/whatsapp/*`)
- ✅ Validate `clienteId` parameter (must be positive integer)
- ✅ Delegate all Session Manager communication to `sessionManagerClient`
- ✅ Map errors to appropriate HTTP status codes
- ✅ Log errors for debugging
- ✅ Act as transparent proxy

#### What it DOES NOT do:
- ❌ Make direct HTTP calls (no axios, no fetch, no http.request)
- ❌ Transform response data
- ❌ Add business logic
- ❌ Cache responses
- ❌ Store QR codes

#### Routes:

**`GET /api/whatsapp/:clienteId/status`**
- **Purpose:** Get WhatsApp connection status for a client
- **Validation:** clienteId must be positive integer
- **Success:** 200 + Session Manager response (unchanged)
- **Errors:**
  - 400: Invalid clienteId
  - 502: Session Manager unavailable
  - 504: Timeout

**`GET /api/whatsapp/:clienteId/qr`**
- **Purpose:** Get WhatsApp QR code for authentication
- **Validation:** clienteId must be positive integer
- **Success:** 200 + Session Manager response (unchanged)
- **Errors:**
  - 400: Invalid clienteId
  - 404: QR not available yet (propagated from Session Manager)
  - 409: Already connected (propagated from Session Manager)
  - 502: Session Manager unavailable
  - 504: Timeout

---

### 3. `index.js` (Application Layer)
**Route Registration and Middleware Setup**

#### Route Order (Critical):
```javascript
1. Health check          → GET /health
2. WhatsApp proxy        → /api/whatsapp/*     (whatsappQrProxy)
3. Auth routes           → /auth/*
4. Session Manager       → /session-manager/*  (internal, authenticated)
5. Sender                → /sender/*
6. Sync Contacts         → /sync-contacts/*
7. Static frontend       → /* (dist/)
```

**Why this order matters:**
- API routes **must** be registered before `express.static`
- WhatsApp proxy is public (no auth middleware)
- Other modules may require authentication

---

## Public Endpoints Exposed by Central Hub

### Core Service
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/health` | Health check | No |

### WhatsApp Proxy (NEW)
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/whatsapp/:clienteId/status` | WhatsApp connection status | No |
| `GET` | `/api/whatsapp/:clienteId/qr` | WhatsApp QR code | No |

### Authentication
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/auth/login` | User login | No |
| `POST` | `/auth/register` | User registration | No |

### Session Manager (Internal)
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/session-manager/status` | Internal session status | Yes (JWT) |
| `POST` | `/session-manager/login` | Initiate WhatsApp connection | Yes (JWT) |
| `POST` | `/session-manager/logout` | Disconnect WhatsApp | Yes (JWT) |
| `GET` | `/session-manager/state` | Session state | Yes (JWT) |
| `GET` | `/session-manager/qr` | QR code (internal) | Yes (JWT) |

### Message Sending
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/sender/send` | Send single message | Yes (JWT) |
| `POST` | `/sender/send-bulk` | Send bulk messages | Yes (JWT) |

### Contact Sync
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/sync-contacts/sync` | Sync WhatsApp contacts | Yes (JWT) |

---

## Sequence Diagram: Client → Central Hub → Session Manager

### Scenario 1: Get WhatsApp Status

```
┌────────┐         ┌─────────────┐         ┌──────────────────┐         ┌─────────────────┐
│ Client │         │ Central Hub │         │ sessionManager   │         │ Session Manager │
│        │         │             │         │     Client       │         │  (Port 3001)    │
└───┬────┘         └──────┬──────┘         └────────┬─────────┘         └────────┬────────┘
    │                     │                         │                            │
    │ GET /api/whatsapp/51/status                  │                            │
    ├────────────────────►│                         │                            │
    │                     │                         │                            │
    │                     │ Validate clienteId      │                            │
    │                     │ (must be positive int)  │                            │
    │                     │                         │                            │
    │                     │ getStatus(51)           │                            │
    │                     ├────────────────────────►│                            │
    │                     │                         │                            │
    │                     │                         │ GET /status                │
    │                     │                         │ X-Cliente-Id: 51           │
    │                     │                         ├───────────────────────────►│
    │                     │                         │                            │
    │                     │                         │                            │ Check client
    │                     │                         │                            │ 51 status
    │                     │                         │                            │
    │                     │                         │ 200 OK                     │
    │                     │                         │ { status: "ready", ... }   │
    │                     │                         │◄───────────────────────────┤
    │                     │                         │                            │
    │                     │ Return parsed JSON      │                            │
    │                     │◄────────────────────────┤                            │
    │                     │                         │                            │
    │ 200 OK              │                         │                            │
    │ { status: "ready", ... }                     │                            │
    │◄────────────────────┤                         │                            │
    │                     │                         │                            │
```

### Scenario 2: Get QR Code (Success)

```
┌────────┐         ┌─────────────┐         ┌──────────────────┐         ┌─────────────────┐
│ Client │         │ Central Hub │         │ sessionManager   │         │ Session Manager │
│        │         │             │         │     Client       │         │  (Port 3001)    │
└───┬────┘         └──────┬──────┘         └────────┬─────────┘         └────────┬────────┘
    │                     │                         │                            │
    │ GET /api/whatsapp/51/qr                      │                            │
    ├────────────────────►│                         │                            │
    │                     │                         │                            │
    │                     │ Validate clienteId      │                            │
    │                     │                         │                            │
    │                     │ getQR(51)               │                            │
    │                     ├────────────────────────►│                            │
    │                     │                         │                            │
    │                     │                         │ GET /qr                    │
    │                     │                         │ X-Cliente-Id: 51           │
    │                     │                         ├───────────────────────────►│
    │                     │                         │                            │
    │                     │                         │                            │ Generate QR
    │                     │                         │                            │
    │                     │                         │ 200 OK                     │
    │                     │                         │ { qr: "base64...", ... }   │
    │                     │                         │◄───────────────────────────┤
    │                     │                         │                            │
    │                     │ Return parsed JSON      │                            │
    │                     │◄────────────────────────┤                            │
    │                     │                         │                            │
    │ 200 OK              │                         │                            │
    │ { qr: "base64...", ... }                     │                            │
    │◄────────────────────┤                         │                            │
    │                     │                         │                            │
```

### Scenario 3: Get QR Code (Already Connected)

```
┌────────┐         ┌─────────────┐         ┌──────────────────┐         ┌─────────────────┐
│ Client │         │ Central Hub │         │ sessionManager   │         │ Session Manager │
│        │         │             │         │     Client       │         │  (Port 3001)    │
└───┬────┘         └──────┬──────┘         └────────┬─────────┘         └────────┬────────┘
    │                     │                         │                            │
    │ GET /api/whatsapp/51/qr                      │                            │
    ├────────────────────►│                         │                            │
    │                     │                         │                            │
    │                     │ getQR(51)               │                            │
    │                     ├────────────────────────►│                            │
    │                     │                         │                            │
    │                     │                         │ GET /qr                    │
    │                     │                         │ X-Cliente-Id: 51           │
    │                     │                         ├───────────────────────────►│
    │                     │                         │                            │
    │                     │                         │                            │ Client 51
    │                     │                         │                            │ is READY
    │                     │                         │                            │
    │                     │                         │ 409 Conflict               │
    │                     │                         │ { error: "ALREADY_CONNECTED" }
    │                     │                         │◄───────────────────────────┤
    │                     │                         │                            │
    │                     │ Throw error with        │                            │
    │                     │ statusCode=409          │                            │
    │                     │◄────────────────────────┤                            │
    │                     │                         │                            │
    │ 409 Conflict        │ Map error.statusCode    │                            │
    │ { error: "ALREADY_CONNECTED" }                │                            │
    │◄────────────────────┤                         │                            │
    │                     │                         │                            │
```

### Scenario 4: Session Manager Unavailable

```
┌────────┐         ┌─────────────┐         ┌──────────────────┐         ┌─────────────────┐
│ Client │         │ Central Hub │         │ sessionManager   │         │ Session Manager │
│        │         │             │         │     Client       │         │  (Port 3001)    │
└───┬────┘         └──────┬──────┘         └────────┬─────────┘         └────────┬────────┘
    │                     │                         │                            │
    │ GET /api/whatsapp/51/status                  │                            │
    ├────────────────────►│                         │                            │
    │                     │                         │                            │
    │                     │ getStatus(51)           │                            │
    │                     ├────────────────────────►│                            │
    │                     │                         │                            │
    │                     │                         │ GET /status                │
    │                     │                         │ X-Cliente-Id: 51           │
    │                     │                         ├──────────────────────────X │
    │                     │                         │                         
    │                     │                         │ ECONNREFUSED            
    │                     │                         │                         
    │                     │ Throw error:            │                         
    │                     │ "SESSION_MANAGER_UNREACHABLE"                    
    │                     │◄────────────────────────┤                         
    │                     │                         │                         
    │ 502 Bad Gateway     │ Catch error             │                         
    │ { error: "SESSION_MANAGER_UNAVAILABLE" }      │                         
    │◄────────────────────┤                         │                         
    │                     │                         │                         
```

---

## Architectural Validation

### ✅ Rules Compliance Check

| Rule | Status | Evidence |
|------|--------|----------|
| All communication with Session Manager goes through `sessionManagerClient` | ✅ PASS | `whatsappQrProxy.js` only imports and calls `sessionManagerClient` |
| No direct axios/http calls in route handlers | ✅ PASS | `grep -r "axios" src/routes/` returns only comments |
| No duplicated WhatsApp routes | ✅ PASS | Single registration in `index.js`: `app.use('/api/whatsapp', whatsappQrProxy)` |
| Client adds `X-Cliente-Id` header | ✅ PASS | `makeRequest()` adds header in line 75 |
| Errors propagate with `statusCode` | ✅ PASS | Lines 108-114 in `sessionManagerClient.js` |
| Timeout handling | ✅ PASS | Connection: 5s (line 46), Read: 30s (line 47) |
| No state management in client | ✅ PASS | `sessionManagerClient.js` is stateless |
| Routes validate input | ✅ PASS | `clienteId` validation in lines 37-44, 100-107 of `whatsappQrProxy.js` |

### 🎯 Design Principles

1. **Single Responsibility**
   - `sessionManagerClient.js`: HTTP communication only
   - `whatsappQrProxy.js`: Routing and validation only
   - Clear separation of concerns

2. **Dependency Inversion**
   - Routes depend on client abstraction
   - Not on concrete HTTP library (axios)
   - Easy to swap HTTP implementation

3. **Error Propagation**
   - Session Manager errors pass through unchanged
   - Network errors mapped to gateway errors (502, 504)
   - Consistent error structure

4. **Transparency**
   - Proxy doesn't transform data
   - Doesn't cache responses
   - Doesn't add business logic

5. **Testability**
   - Client can be mocked easily
   - Routes test validation logic only
   - Clear boundaries for unit testing

---

## Configuration

### Environment Variables

```bash
# Required
SESSION_MANAGER_BASE_URL=http://localhost:3001

# Optional
PORT=3012  # Central Hub port (default: 3012)
```

### Timeouts

Defined in `sessionManagerClient.js`:
```javascript
CONNECT_TIMEOUT = 5000   // 5 seconds
READ_TIMEOUT    = 30000  // 30 seconds
```

---

## Usage Examples

### From Frontend (JavaScript)

```javascript
// Get WhatsApp status for client 51
const response = await fetch('http://localhost:3012/api/whatsapp/51/status');
const status = await response.json();

if (status.state === 'ready') {
  console.log('WhatsApp is connected');
}

// Get QR code for authentication
const qrResponse = await fetch('http://localhost:3012/api/whatsapp/51/qr');

if (qrResponse.status === 200) {
  const { qr } = await qrResponse.json();
  // Display QR code to user
} else if (qrResponse.status === 409) {
  console.log('Already connected, no QR needed');
}
```

### From cURL

```bash
# Check status
curl http://localhost:3012/api/whatsapp/51/status

# Get QR code
curl http://localhost:3012/api/whatsapp/51/qr

# Health check
curl http://localhost:3012/health
```

---

## Error Codes Reference

### HTTP Status Codes

| Code | Meaning | When it happens |
|------|---------|-----------------|
| 200 | OK | Successful request |
| 400 | Bad Request | Invalid clienteId parameter |
| 404 | Not Found | QR not available yet |
| 409 | Conflict | WhatsApp already connected (no QR) |
| 502 | Bad Gateway | Session Manager unreachable or error |
| 504 | Gateway Timeout | Session Manager didn't respond in time |

### Error Code Strings

| Code | Source | Description |
|------|--------|-------------|
| `INVALID_CLIENT_ID` | Central Hub | clienteId is not a positive integer |
| `GATEWAY_TIMEOUT` | Central Hub | Session Manager timeout |
| `SESSION_MANAGER_UNAVAILABLE` | Central Hub | Cannot reach Session Manager |
| `SESSION_MANAGER_ERROR` | Central Hub | Generic Session Manager error |
| `ALREADY_CONNECTED` | Session Manager | WhatsApp is already connected |
| `QR_NOT_AVAILABLE` | Session Manager | QR code not ready yet |

---

## Maintenance Notes

### Adding New Session Manager Endpoints

To expose a new Session Manager endpoint:

1. **Add method to `sessionManagerClient.js`:**
   ```javascript
   async function newMethod(clienteId, params) {
     return makeRequest('POST', '/new-endpoint', clienteId, params);
   }
   
   module.exports = {
     // ... existing exports
     newMethod
   };
   ```

2. **Add route to `whatsappQrProxy.js`:**
   ```javascript
   router.post('/:clienteId/new-action', async (req, res) => {
     const clienteIdNum = parseInt(req.params.clienteId, 10);
     
     try {
       const result = await sessionManagerClient.newMethod(clienteIdNum, req.body);
       res.json(result);
     } catch (error) {
       // Standard error handling
     }
   });
   ```

3. **Do NOT:**
   - Call Session Manager directly from the route
   - Add business logic to the route handler
   - Transform response data

### Testing Strategy

1. **Unit Tests for `sessionManagerClient.js`:**
   - Mock http/https modules
   - Test timeout handling
   - Test error propagation
   - Test header injection

2. **Integration Tests for `whatsappQrProxy.js`:**
   - Mock `sessionManagerClient`
   - Test input validation
   - Test error mapping
   - Test response passthrough

3. **E2E Tests:**
   - Start real Session Manager
   - Test full request flow
   - Verify QR generation
   - Test error scenarios

---

## Migration Notes

This architecture replaces previous implementations where:
- Routes called Session Manager directly using axios
- Multiple files had duplicated HTTP logic
- Error handling was inconsistent
- WhatsApp routes were scattered across modules

**Benefits of new architecture:**
- Single point of maintenance
- Consistent error handling
- Easier to test
- Clear separation of concerns
- No vendor lock-in (no axios dependency in routes)

---

## Summary

This WhatsApp proxy implementation follows **clean architecture principles**:

✅ **Single Source of Truth**: All Session Manager communication flows through `sessionManagerClient.js`  
✅ **Separation of Concerns**: Routes handle HTTP, client handles Session Manager protocol  
✅ **Error Propagation**: Errors pass through transparently with proper status codes  
✅ **No Duplication**: One proxy, one client, one registration  
✅ **Testable**: Clear boundaries, mockable dependencies  
✅ **Maintainable**: New endpoints require minimal code

The system is production-ready and prepared for frontend integration.
