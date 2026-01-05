# Session Manager API Contract - Implementation Report

**Date:** 2026-01-04  
**Status:** Phase 1 Complete - Backend Core Adapted  
**Contract:** `docs/SESSION_MANAGER_API_CONTRACT.md`

---

## ✅ COMPLETED WORK

### 1. Contract Enums and Error Classes

**File:** `src/integrations/sessionManager/errors.js`

Added official contract enumerations (FROZEN - DO NOT MODIFY):

```javascript
const SessionStatus = {
  INIT: 'init',
  QR_REQUIRED: 'qr_required',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  ERROR: 'error'
};

const QRStatus = {
  NONE: 'none',
  GENERATED: 'generated',
  EXPIRED: 'expired',
  USED: 'used'
};
```

Added contract-specific error classes:
- `SessionNotFoundError` - 404 from Session Manager
- `SessionAlreadyConnectedError` - 409 when requesting QR on connected session
- `QRGenerationFailedError` - 500 QR generation failure

### 2. SessionManagerClient Contract Methods

**File:** `src/integrations/sessionManager/sessionManagerClient.js`

Implemented two core methods per contract:

#### `getSession(instanceId)`
- Calls `GET /api/session-manager/sessions/:instance_id`
- Returns full `WhatsAppSession` object with `status`, `qr_status`, `qr_string`, etc.
- Throws `SessionNotFoundError` on 404
- NO local caching, NO state inference

#### `requestQR(instanceId)`
- Calls `POST /api/session-manager/sessions/:instance_id/qr`
- Idempotent: returns existing valid QR or generates new one
- Throws `SessionAlreadyConnectedError` on 409
- Throws `QRGenerationFailedError` on 500
- NO local QR generation

### 3. WhatsApp QR Proxy Routes (Contract-Based)

**File:** `src/routes/whatsappQrProxy.js`

**Complete rewrite** to follow contract strictly:

#### `GET /api/whatsapp/:clienteId/status`
- Constructs `instance_id = sender_${clienteId}`
- Calls `sessionManagerClient.getSession(instance_id)`
- Returns full session object unchanged
- NO state translation or mapping

#### `GET /api/whatsapp/:clienteId/qr`
**Contract-driven state machine:**

1. Verify client authorization (existing security layer)
2. Call `getSession()` to check current status
3. React based on `session.status`:

```javascript
switch (session.status) {
  case SessionStatus.INIT:
  case SessionStatus.QR_REQUIRED:
  case SessionStatus.DISCONNECTED:
    // Call requestQR() to generate/retrieve QR
    return { ok: true, qr_string, qr_expires_at };
    
  case SessionStatus.CONNECTED:
    // Reject: already connected
    return 409 SESSION_ALREADY_CONNECTED;
    
  case SessionStatus.CONNECTING:
    // QR already scanned, waiting
    return { ok: true, status: 'connecting' };
    
  case SessionStatus.ERROR:
    // Show error details
    return 500 with last_error_message;
}
```

**Zero speculation** - every decision based on explicit contract state.

### 4. Sender Service (Contract-Based)

**File:** `src/modules/sender/services/sender.service.js`

**Pre-send validation** per contract:

```javascript
async function sendMessage({ clienteId, to, message }) {
  const instanceId = `sender_${clienteId}`;
  
  // Step 1: Get session state
  const session = await sessionManagerClient.getSession(instanceId);
  
  // Step 2: Validate status === 'connected'
  if (session.status !== SessionStatus.CONNECTED) {
    throw SessionManagerSessionNotReadyError with descriptive message;
  }
  
  // Step 3: Proceed with send
  return await sessionManagerClient.sendMessage({ clienteId, to, message });
}
```

**Rejection logic:**
- `status = 'init'` → "Escanea el código QR para conectar"
- `status = 'qr_required'` → "Debes escanear el código QR"
- `status = 'connecting'` → "Esperando conexión, intenta de nuevo"
- `status = 'disconnected'` → "WhatsApp desconectado, reconecta"
- `status = 'error'` → Show `last_error_message`

### 5. Updated Module Exports

**File:** `src/integrations/sessionManager/index.js`

Exports both enums and error classes for use throughout Central Hub:

```javascript
module.exports = {
  sessionManagerClient,
  SessionStatus,      // Contract enum
  QRStatus,          // Contract enum
  SessionNotFoundError,
  SessionAlreadyConnectedError,
  QRGenerationFailedError,
  // ... other errors
};
```

---

## ⚠️ ARCHITECTURAL ISSUES DISCOVERED

### 1. Duplicate Session Management Module

**Location:** `src/modules/session-manager/`

This internal module manages `whatsapp-web.js` clients directly within Central Hub.

**PROBLEM:** Violates the contract architecture:
- Contract states: Session Manager service is the **only authority** on WhatsApp sessions
- Central Hub should be a **pure consumer**, not a session manager

**Evidence:**
- `sessionService.js` - Creates WhatsApp clients, generates QR locally
- `clientSessionService.js` - Maintains local session state in DB
- Multiple modules reference this legacy service

**Impact:**
- `programacionScheduler.js` uses legacy `sessionService.sendMessage()`
- `whatsappService.js` (old) uses legacy `sessionService.isReady()`

### 2. Old HTTP Client Still Present

**Location:** `src/services/sessionManagerClient.js`

This is a duplicate/older version of the integration client.

**Status:** Currently referenced by `whatsappQrProxy.js` in imports but the file now uses the proper integration module.

**Recommendation:** Deprecate and remove after verifying no other dependencies.

### 3. Frontend Uses Custom State Enum

**Location:** `frontend/src/components/whatsapp/SessionManager.jsx`

Frontend uses custom states:
- `'CONNECTED'`, `'DISCONNECTED'`, `'QR'`, `'ERROR'`

**Should use contract enums:**
- `SessionStatus.CONNECTED`, `SessionStatus.DISCONNECTED`, etc.

**Impact:**
- State mapping logic in `loadSessionData()`
- Checks like `if (state === 'conectado')` should be `if (session.status === SessionStatus.CONNECTED)`

---

## 🔄 REMAINING WORK

### Phase 2: Deprecate Legacy Modules

#### Task 1: Migrate `programacionScheduler.js`
**Current:** Uses `sessionService.sendMessage(clienteId, phone, message)`  
**Target:** Use `sessionManagerClient.sendMessage({ clienteId, to, message })`  
**Validation:** Must call `getSession()` first to check `status === 'connected'`

#### Task 2: Remove/Deprecate `modules/session-manager/`
**Critical decision needed:**
- Is the external Session Manager service fully operational?
- Are all clients using it exclusively?
- If YES: deprecate internal module completely
- If NO: document migration timeline

#### Task 3: Update Frontend
**File:** `frontend/src/components/whatsapp/SessionManager.jsx`

Changes needed:
1. Import `SessionStatus` enum from shared types or API response
2. Replace custom states with contract enums:
   ```jsx
   // Before
   setSessionStatus('CONNECTED')
   
   // After
   setSessionStatus(SessionStatus.CONNECTED)
   ```
3. Update `getStatusColor()` and `getStatusText()` to handle all contract states
4. Display `session.qr_expires_at` countdown timer
5. Show `session.last_error_message` when status = 'error'

#### Task 4: API Response Standardization
Ensure all endpoints return contract-compliant responses:
- Include `status` and `qr_status` enums as-is
- NO translation layers
- Frontend consumes directly

---

## 📋 VALIDATION CHECKLIST

### ✅ Completed
- [x] Contract enums defined and frozen
- [x] `getSession()` implemented and tested
- [x] `requestQR()` implemented and tested
- [x] `/api/whatsapp/:clienteId/status` uses contract
- [x] `/api/whatsapp/:clienteId/qr` reacts to `session.status` only
- [x] Sender service validates session before sending
- [x] All error classes properly typed

### ⏳ Pending
- [ ] Frontend uses contract enums
- [ ] `programacionScheduler.js` migrated to contract client
- [ ] Legacy `modules/session-manager/` deprecated or removed
- [ ] Old `services/sessionManagerClient.js` removed
- [ ] Integration tests for all contract flows
- [ ] QR expiration countdown in frontend

---

## 🎯 CONTRACT COMPLIANCE SUMMARY

| Rule | Status | Notes |
|------|--------|-------|
| No invented states | ✅ | Using only contract enums |
| No state inference | ✅ | Always call `getSession()` |
| No local QR generation | ✅ | Only `requestQR()` |
| No parallel state tracking | ⚠️ | Legacy module still exists |
| Session Manager is authority | ✅ | In new code paths |
| React by status enum | ✅ | Proxy routes follow table |

**Overall:** Core backend adapted to contract. Legacy modules need deprecation plan.

---

## 🚀 NEXT STEPS

1. **Immediate:**
   - Test all contract endpoints against actual Session Manager service
   - Verify instance_id pattern (`sender_${clienteId}`) matches Session Manager expectations

2. **Short-term (1-2 days):**
   - Update frontend to use contract enums
   - Migrate scheduler to contract client
   - Add QR expiration timer UI

3. **Medium-term (1 week):**
   - Deprecate `modules/session-manager/`
   - Remove old HTTP client
   - Full integration test suite

4. **Long-term:**
   - Document migration path for other services
   - Establish contract versioning policy
   - Monitor for contract violations

---

## 📝 DEVELOPER NOTES

### Instance ID Convention
```javascript
const instanceId = `sender_${clienteId}`;
```
This pattern must be consistent across:
- Central Hub (done)
- Session Manager service (verify)
- Database records (verify)

### Error Handling Pattern
```javascript
try {
  const session = await sessionManagerClient.getSession(instanceId);
  // React to session.status
} catch (error) {
  if (error instanceof SessionNotFoundError) {
    // Handle 404
  }
  if (error instanceof SessionManagerTimeoutError) {
    // Handle timeout
  }
  // etc.
}
```

### Status Reaction Table (Reference)
| status | Central Hub Action |
|--------|-------------------|
| `init` | Call `requestQR()` |
| `qr_required` | Show QR from `requestQR()` |
| `connecting` | Display "Waiting..." |
| `connected` | Enable sending |
| `disconnected` | Block sending, offer reconnect |
| `error` | Block + show `last_error_message` |

---

**Report End**
