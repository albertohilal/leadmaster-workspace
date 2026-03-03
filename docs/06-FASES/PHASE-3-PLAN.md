# Phase 4 - WhatsApp Session Lifecycle
(File name kept as PHASE-3-PLAN.md for historical compatibility)

## STATUS / CONTEXT

Phase 3 (Consolidation) = CLOSED (listener + persistence + bridge + dedicated number + QR canon).

Reporte canónico de cierre:
- [docs/05-REPORTES/2026-03/CONSOLIDACION_WHATSAPP_PHASE_3_2026-03-01.md](../05-REPORTES/2026-03/CONSOLIDACION_WHATSAPP_PHASE_3_2026-03-01.md)

QR canon:
- UI: https://desarrolloydisenioweb.com.ar/whatsapp
- API: session-manager `GET /qr`
- fallback: session-manager `/qr.html`

Dedicated Number: CONFIRMED (YES)

> Nota (compatibilidad documental): el nombre del archivo se mantiene como `PHASE-3-PLAN.md` por compatibilidad histórica. En la estructura estratégica oficial (ver `PROJECT_STATUS.md`), WhatsApp Session Lifecycle corresponde a Phase 4.

## Status: 🟡 PARTIALLY IMPLEMENTED (Backend foundations)

**Planned Start Date:** TBD  
**Estimated Duration:** 2-3 days  
**Branch:** feature/whatsapp-session-lifecycle  
**Depends On:** ✅ Phase 2 (Completed)

---

## Executive Summary

Esta fase implementa el ciclo de vida de la sesión WhatsApp para **conexión y escucha (listener-only)**, permitiendo a los usuarios conectar, mantener y gestionar su sesión desde el frontend. Incluye generación de QR, persistencia y actualizaciones en tiempo real.

**Objetivo principal:** Usuario puede conectar WhatsApp y mantener sesión activa de forma confiable para **inbound**.

---

## Prerequisites

### ✅ Completed (Phase 2)
- [x] Nginx + SSL/TLS operativo
- [x] Backend Node.js (PM2) estable
- [x] Auth JWT funcional
- [x] Frontend SPA desplegado
- [x] Proxy inverso configurado
- [x] Módulos base activados

### 🔧 Required Before Starting (Phase 4)
- [x] Session Manager standalone service funcionando localmente
- [x] whatsapp-web.js dependencia instalada
- [x] LocalAuth configurado y probado
- [x] Cliente HTTP a session-manager existe (con gaps de contrato)
- [ ] WebSocket library elegida (socket.io o ws)
- [x] QR code library elegida (qrcode)

---

## Architecture Overview

### Current State (AS-IS)
```

Frontend (React) → Nginx → Central Hub (Express)
├── auth ✅
├── WhatsApp proxies (varios contratos)
├── session-manager integration client (con gaps)
├── sender (reglas / auditoría)
└── listener (procesa inbound)

```

### Target State (PLANNED)
```

Frontend (React + WebSocket)
↓
Nginx (Proxy + WS upgrade)
↓
Central Hub (Express + Socket.io)
├── auth ✅
├── session-manager (HTTP client)
│     ↓ HTTP
│   Session Manager Standalone
│     └── whatsapp-web.js + LocalAuth
├── sender (Meta API future)
└── listener (inbound)

```

---

## Data Flow: Connection (AS-IS single-admin)

> Importante: el **código actual** usa un `session-manager` **single-admin** con endpoints `/connect`, `/qr`, `/status`.
> Las rutas multi-instancia con `:instance_id` que aparecen más abajo representan el **target** (PLANNED), no el comportamiento real hoy.

```

1. Usuario: Click "Conectar WhatsApp"
   Frontend → Central Hub (endpoint/plano a definir)

2. Central Hub → Session Manager (HTTP)
   POST [http://localhost:3001/connect](http://localhost:3001/connect)

3. Session Manager inicia whatsapp-web.js
   Estado: INIT

4. whatsapp-web.js emite evento 'qr'
   Session Manager almacena QR
   Estado: QR_REQUIRED

5. Central Hub obtiene QR
   GET [http://localhost:3001/qr](http://localhost:3001/qr)

6. (PLANNED) Central Hub envía QR a Frontend vía WebSocket
   socket.emit('qr-code', { qr: base64 })

7. Usuario escanea QR con WhatsApp mobile
   Session Manager transiciona a AUTHENTICATED

8. whatsapp-web.js emite evento 'ready'
   Session Manager confirma conexión
   Estado: READY

9. (PLANNED) Central Hub notifica a Frontend
   socket.emit('session-status', { status: 'connected' })

10. Frontend muestra "Conectado"

````

---

## Technical Specifications

### A) AS-IS: Session Manager endpoints (implementados hoy)

**Listener-only (ciclo de vida):**
- `GET  http://localhost:3001/health`
- `GET  http://localhost:3001/status`
- `GET  http://localhost:3001/qr`
- `POST http://localhost:3001/connect`
- `POST http://localhost:3001/disconnect`

> **Nota constitucional:** Outbound automático por WhatsApp Web está fuera de alcance.  
> Si existiera un endpoint legacy de envío en el código, debe ser deshabilitado/eliminado y no forma parte de esta fase.

---

### B) PLANNED: Central Hub endpoints (target multi-instancia)

> Estos endpoints pertenecen al **target** con `instance_id`. No están implementados end-to-end.

#### 1. POST /session-manager/sessions/:instance_id/qr (PLANNED)

Solicita QR/snapshot para una instancia.

```http
POST /session-manager/sessions/acme-01/qr
````

```json
{
  "instance_id": "acme-01",
  "status": "qr_required",
  "qr_status": "generated",
  "qr_string": "2@...",
  "updated_at": "2026-02-27T12:00:00Z"
}
```

#### 2. GET /session-manager/sessions/:instance_id (PLANNED)

```http
GET /session-manager/sessions/acme-01
```

```json
{
  "instance_id": "acme-01",
  "status": "connected",
  "qr_status": "used",
  "qr_string": null,
  "updated_at": "2026-02-27T12:00:00Z"
}
```

#### 3. POST /session-manager/sessions/:instance_id/disconnect (PLANNED)

```http
POST /session-manager/sessions/acme-01/disconnect
```

```json
{ "ok": true }
```

---

### Enums (claros y separados)

**AS-IS (session-manager):**
`INIT | QR_REQUIRED | AUTHENTICATED | READY | DISCONNECTED | ERROR`

**PLANNED (target contract freeze):**
`init | qr_required | connecting | connected | disconnected | error` + `QRStatus`

---

## WebSocket Events (PLANNED)

> WebSocket es parte del target. Hoy puede usarse polling/refresh manual.

### Client → Server

`authenticate`

```js
socket.emit('authenticate', { token: '<JWT>' });
```

`subscribe-session` (PLANNED multi-instancia)

```js
socket.emit('subscribe-session', { instance_id: 'acme-01' });
```

`request-qr` (PLANNED multi-instancia)

```js
socket.emit('request-qr', { instance_id: 'acme-01' });
```

### Server → Client

`authenticated` (canal WS)

```js
socket.emit('authenticated', { success: true });
```

`session-status`

```js
socket.emit('session-status', {
  status: 'connected',
  connectedAt: '2026-01-02T23:50:00Z',
  phoneNumber: '+5491123456789'
});
```

`qr-code`

```js
socket.emit('qr-code', {
  qr: 'data:image/png;base64,...',
  expiresAt: '2026-01-03T00:05:00Z'
});
```

`qr-expired`

```js
socket.emit('qr-expired', { message: 'QR expirado, genere uno nuevo' });
```

`connection-error`

```js
socket.emit('connection-error', {
  error: 'TIMEOUT',
  message: 'Tiempo de espera agotado'
});
```

---

## Session Manager Standalone (PLANNED multi-instancia)

> Esta sección describe el target multi-instancia. Hoy AS-IS es single-admin.

### Endpoints target

* `GET  /api/session-manager/sessions/{instance_id}`
* `POST /api/session-manager/sessions/{instance_id}/qr`
* `POST /api/session-manager/sessions/{instance_id}/disconnect`

### whatsapp-web.js Events (conceptual)

```js
client.on('qr', (qr) => {
  // status=qr_required, qr_status=generated
});

client.on('ready', () => {
  // status=connected
});

client.on('disconnected', (reason) => {
  // status=disconnected
});

client.on('auth_failure', (msg) => {
  // status=error
});
```

---

## Frontend Components (PLANNED)

### WhatsAppConnection.jsx

Props:

```js
{
  instance_id: string,
  onConnected: () => void,
  onDisconnected: () => void,
  onError: (error) => void
}
```

State:

```js
{
  status: 'init' | 'qr_required' | 'connecting' | 'connected' | 'disconnected' | 'error',
  qrCode: string | null,
  phoneNumber: string | null,
  error: string | null
}
```

---

## Implementation Checklist (Phase 4)

### 4.1 Backend: session-manager lifecycle hardening (AS-IS)

* [ ] Confirmar que el flujo `connect → qr → status` es estable.
* [ ] Persistencia LocalAuth: validar restore post-restart.
* [ ] Manejo de desconexión: `DISCONNECTED` + reconexión controlada.
* [ ] Eliminar/deshabilitar cualquier endpoint outbound legacy (si existe).

### 4.2 Backend: central-hub integration (AS-IS)

* [ ] Unificar proxies/contratos para `status/qr/connect/disconnect`.
* [ ] Validación de errores: timeout / unreachable / not-ready.
* [ ] Logging consistente y trazable.

### 4.3 Real-time (PLANNED)

* [ ] Elegir WS lib: socket.io vs ws.
* [ ] WS auth (JWT).
* [ ] Push de QR/status al frontend.

### 4.4 Frontend (PLANNED)

* [ ] Componente conexión WhatsApp.
* [ ] Visualización QR.
* [ ] Indicador de estado.
* [ ] Manejo de errores y reconexión.

---

## Out of Scope (Phase 4)

* ❌ Envío automático por WhatsApp Web (whatsapp-web.js) — prohibido por riesgo operativo (baneo).
* ❌ Campañas masivas / colas / rate-limit outbound (fase futura de sender).
* ❌ Integración Meta WhatsApp Cloud API (fase futura; depende de disponibilidad).
* ❌ Multi-tenant real (`instance_id`) end-to-end (target, no implementado hoy).

---

## Sign-Off Criteria

Esta fase se considera completa cuando (AS-IS + PLANNED incremental):

**AS-IS (obligatorio):**

* [ ] Usuario puede iniciar conexión desde UI (o endpoint) y obtener QR.
* [ ] QR se genera y se muestra correctamente.
* [ ] Escaneo detectado y estado llega a READY.
* [ ] Estado persiste tras reload y restart de PM2 (cuando WhatsApp lo permite).
* [ ] Logs sin errores críticos durante operación sostenida.

**PLANNED (si se implementa en esta fase):**

* [ ] WebSocket push de QR/status.
* [ ] Contrato target con `instance_id` (solo si se decide avanzar).

**Approval Required:** Alberto Hilal (Product Owner)

---

```

Si querés mantener el foco, el siguiente ajuste (único) sería: **eliminar la mención de `/send` del documento de contratos** y del “Integration Plan”, porque hoy siguen afirmando que es crítico :contentReference[oaicite:0]{index=0} :contentReference[oaicite:1]{index=1}.
::contentReference[oaicite:2]{index=2}
```
