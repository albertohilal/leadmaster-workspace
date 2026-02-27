# Phase 4 - WhatsApp Session Lifecycle

> Nota: el nombre del archivo se mantiene por compatibilidad documental. En la estructura estratégica oficial (ver `PROJECT_STATUS.md`), WhatsApp lifecycle corresponde a Phase 4.

## Status: 📋 PLANNED (Not Started)

**Planned Start Date:** TBD  
**Estimated Duration:** 2-3 days  
**Branch:** feature/whatsapp-session-lifecycle  
**Depends On:** ✅ Phase 2 (Completed)

---

## Executive Summary

Esta fase implementará el ciclo de vida completo de la sesión WhatsApp, permitiendo a los usuarios conectar, mantener y gestionar su sesión WhatsApp desde el frontend. Incluye generación de QR, persistencia y actualizaciones en tiempo real.

**Objetivo principal:** Usuario puede conectar WhatsApp y mantener sesión activa de forma confiable.

---

## Prerequisites

### ✅ Completed (Phase 2)
- [x] Nginx + SSL/TLS operativo
- [x] Backend Node.js (PM2) estable
- [x] Auth JWT funcional
- [x] Frontend SPA desplegado
- [x] Proxy inverso configurado
- [x] Módulos base activados

### 🔧 Required Before Starting
- [ ] Session Manager standalone service funcionando localmente
- [ ] whatsapp-web.js dependencia instalada
- [ ] LocalAuth configurado y probado
- [ ] Cliente HTTP a session-manager implementado
- [ ] WebSocket library elegida (socket.io o ws)
- [ ] QR code library elegida (qrcode o similar)

---

## Architecture Overview

### Current State (Phase 2)
```
Frontend (React) → Nginx → Central Hub (Express)
                              ├── auth ✅
                              ├── session-manager (routes only)
                              ├── sender
                              └── listener
```

### Target State (Phase 4)
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
    ├── sender
    └── listener
```

### Data Flow: Connection

```
1. User clicks "Conectar WhatsApp"
  Frontend → POST /session-manager/sessions/:instance_id/qr
   
2. Central Hub → Session Manager (HTTP)
  POST http://localhost:3001/api/session-manager/sessions/:instance_id/qr
   
3. Session Manager inicia whatsapp-web.js
  Estado: connecting
   
4. whatsapp-web.js emite evento 'qr'
   Session Manager almacena QR
  Estado: qr_required (qr_status=generated)
   
5. Central Hub obtiene QR del snapshot
  POST http://localhost:3001/api/session-manager/sessions/:instance_id/qr
   
6. Central Hub envía QR a Frontend vía WebSocket
   socket.emit('qr', { qr: base64 })
   
7. User escanea QR con WhatsApp mobile
  Session Manager transiciona a connecting

8. whatsapp-web.js emite evento 'ready'
  Session Manager confirma conexión
  Estado: connected
   
9. Central Hub notifica a Frontend
  socket.emit('status', { status: 'connected' })
   
10. Frontend muestra "Conectado"
    UI actualizada, QR desaparece
```

---

## Technical Specifications

### Backend Endpoints

#### 1. POST /session-manager/sessions/:instance_id/qr

Este endpoint (en central-hub) solicita a session-manager el QR/snapshot para una instancia.

**Request:**

```http
POST /session-manager/sessions/acme-01/qr
```

**Response (200 OK):**

```json
{
  "instance_id": "acme-01",
  "status": "qr_required",
  "qr_status": "generated",
  "qr_string": "2@...",
  "updated_at": "2026-02-27T12:00:00Z"
}
```

#### 2. GET /session-manager/sessions/:instance_id

**Request:**

```http
GET /session-manager/sessions/acme-01
```

**Response (200 OK):**

```json
{
  "instance_id": "acme-01",
  "status": "connected",
  "qr_status": "used",
  "qr_string": null,
  "updated_at": "2026-02-27T12:00:00Z"
}
```

#### 3. POST /session-manager/sessions/:instance_id/disconnect

```http
POST /session-manager/sessions/acme-01/disconnect
```

**Response (200 OK):**

```json
{
  "ok": true
}
```

#### Frozen enums (constitutional)

- `SessionStatus`: `init`, `qr_required`, `connecting`, `connected`, `disconnected`, `error`
- `QRStatus`: `none`, `generated`, `expired`, `used`

No se permiten estados legacy (`READY`, `AUTHENTICATED`, `QR_GENERATED`).

### WebSocket Events

#### Client → Server

**`authenticate`**
```javascript
socket.emit('authenticate', { token: '<JWT>' });
```

**`subscribe-session`**
```javascript
socket.emit('subscribe-session', { instance_id: 'acme-01' });
```

**`request-qr`**
```javascript
socket.emit('request-qr', { instance_id: 'acme-01' });
```

#### Server → Client

**`authenticated`**
> Evento de autenticación del canal WebSocket (JWT). No representa un estado de WhatsApp.
```javascript
socket.emit('authenticated', { success: true });
```

**`session-status`**
```javascript
socket.emit('session-status', {
  status: 'connected',
  connectedAt: '2026-01-02T23:50:00Z',
  phoneNumber: '+5491123456789'
});
```

**`qr-code`**
```javascript
socket.emit('qr-code', {
  qr: 'data:image/png;base64,...',
  expiresAt: '2026-01-03T00:05:00Z'
});
```

**`qr-expired`**
```javascript
socket.emit('qr-expired', {
  message: 'QR expirado, genere uno nuevo'
});
```

**`connection-error`**
```javascript
socket.emit('connection-error', {
  error: 'TIMEOUT',
  message: 'Tiempo de espera agotado'
});
```

### Session Manager Standalone

#### Endpoints a implementar

Session-manager (standalone) expone:

- `GET /health`
- `GET /api/session-manager/sessions/{instance_id}`
- `POST /api/session-manager/sessions/{instance_id}/qr`
- `POST /api/session-manager/sessions/{instance_id}/disconnect`

#### whatsapp-web.js Events

```javascript
client.on('qr', (qr) => {
  // Almacenar QR en memoria
  // Convertir a base64 si es necesario
  // Actualizar a status=qr_required y qr_status=generated
});

client.on('ready', () => {
  // Actualizar estado a connected
  // Almacenar info de usuario
});

client.on('disconnected', (reason) => {
  // Actualizar estado a DISCONNECTED
  // Loguear razón
});

client.on('auth_failure', (msg) => {
  // Actualizar estado a ERROR
  // Loguear error
});
```

### Frontend Components

#### WhatsAppConnection.jsx

**Props:**
```javascript
{
  instance_id: string,
  onConnected: () => void,
  onDisconnected: () => void,
  onError: (error) => void
}
```

**State:**
```javascript
{
  status: 'init' | 'qr_required' | 'connecting' | 'connected' | 'disconnected' | 'error',
  qrCode: string | null,
  phoneNumber: string | null,
  error: string | null
}
```

**Methods:**
```javascript
handleConnect()    // Inicia conexión
handleDisconnect() // Cierra sesión
refreshQR()        // Regenera QR expirado
```

#### QRCodeDisplay.jsx

**Props:**
```javascript
{
  qrCode: string,
  expiresAt: string,
  onExpired: () => void
}
```

**Features:**
- Display QR as image
- Countdown timer to expiration
- Auto-refresh on expiration
- Loading spinner durante generación

#### SessionStatusIndicator.jsx

**Props:**
```javascript
{
  status: string,
  phoneNumber: string | null
}
```

**Visual States:**
- 🔴 disconnected - Rojo, "Desconectado"
- 🟡 connecting - Amarillo, "Conectando..."
- 🟡 qr_required (generated) - Amarillo, "Esperando escaneo"
- 🟢 connected - Verde, "Conectado (+549...)"

---

## Implementation Checklist

### Phase 3.1: Session Manager Standalone (Backend)

**Day 1 - Morning:**
- [ ] Setup session-manager service structure
- [ ] Install dependencies (whatsapp-web.js, express, qrcode)
- [ ] Implement basic Express server
- [ ] Add health check endpoint
- [ ] Configure LocalAuth strategy

**Day 1 - Afternoon:**
- [ ] Implement whatsapp-web.js client wrapper
- [ ] Add event listeners (qr, ready, disconnected)
- [ ] Implement POST /sessions/:instance_id/qr endpoint
- [ ] Implement GET /sessions/:instance_id endpoint
- [ ] Test QR generation locally

### Phase 3.2: Central Hub Integration (Backend)

**Day 2 - Morning:**
- [ ] Create sessionManagerClient (HTTP client)
- [ ] Implement retry logic with exponential backoff
- [ ] Add timeout handling
- [ ] Create session-manager controller
- [ ] Implement connect/disconnect routes
- [ ] Add middleware for instance_id authorization

**Day 2 - Afternoon:**
- [ ] Install socket.io server
- [ ] Configure WebSocket with authentication
- [ ] Implement session subscription logic
- [ ] Add QR push via WebSocket
- [ ] Add status push via WebSocket
- [ ] Test WebSocket connection

### Phase 3.3: Frontend Implementation

**Day 3 - Morning:**
- [ ] Install socket.io-client
- [ ] Create WebSocket service/hook
- [ ] Implement WhatsAppConnection component
- [ ] Implement QRCodeDisplay component
- [ ] Implement SessionStatusIndicator component
- [ ] Add connect/disconnect buttons

**Day 3 - Afternoon:**
- [ ] Integrate components in WhatsApp view
- [ ] Add error handling UI
- [ ] Add loading states
- [ ] Implement auto-reconnect logic
- [ ] Test full flow end-to-end
- [ ] Polish UI/UX

### Phase 3.4: Testing & Validation

**Day 3 - Evening:**
- [ ] Test conexión exitosa con QR
- [ ] Test QR expiration y regeneración
- [ ] Test desconexión manual
- [ ] Test desconexión por error
- [ ] Test reconexión automática
- [ ] Test persistencia post-restart PM2
- [ ] Test multi-tenant (múltiples clientes)
- [ ] Load testing (múltiples conexiones)

### Phase 3.5: Documentation & Deployment

**Day 4 - Morning:**
- [ ] Update API documentation
- [ ] Create troubleshooting guide
- [ ] Document WebSocket events
- [ ] Update README files
- [ ] Create deployment checklist
- [ ] Write rollback procedure

**Day 4 - Afternoon:**
- [ ] Deploy to production
- [ ] Smoke test in production
- [ ] Monitor logs for 1 hour
- [ ] Validate with real users
- [ ] Create PHASE-3-COMPLETED.md
- [ ] Close GitHub issues/tasks

---

## Testing Strategy

### Unit Tests

**Backend:**
- [ ] sessionManagerClient.connect()
- [ ] sessionManagerClient.getStatus()
- [ ] sessionManagerClient.getQR()
- [ ] sessionManagerClient error handling
- [ ] WebSocket authentication
- [ ] WebSocket room subscription

**Frontend:**
- [ ] WhatsAppConnection component states
- [ ] QRCodeDisplay rendering
- [ ] SessionStatusIndicator colors
- [ ] WebSocket hook connection/disconnection

### Integration Tests

- [ ] Central Hub → Session Manager HTTP flow
- [ ] QR generation end-to-end
- [ ] WebSocket push notifications
- [ ] Session persistence after restart
- [ ] Multi-tenant isolation

### E2E Tests (Playwright)

```javascript
test('Usuario puede conectar WhatsApp', async ({ page }) => {
  await page.goto('https://desarrolloydisenioweb.com.ar');
  await page.fill('[name=username]', 'b3toh');
  await page.fill('[name=password]', 'elgeneral2018');
  await page.click('button[type=submit]');
  
  await page.click('text=WhatsApp');
  await page.click('button:has-text("Conectar")');
  
  await expect(page.locator('[data-testid=qr-code]')).toBeVisible();
  // Manual: escanear QR
  // await expect(page.locator('text=Conectado')).toBeVisible({ timeout: 30000 });
});
```

---

## Risk Assessment

### High Risk

🔴 **WhatsApp Rate Limiting**
- **Mitigation:** Limitar intentos de conexión (1 por minuto)
- **Fallback:** Mostrar mensaje de espera al usuario

🔴 **Session Corruption**
- **Mitigation:** Backup automático de session data
- **Fallback:** Eliminar sesión corrupta y regenerar

### Medium Risk

🟡 **QR Expiration Timing**
- **Mitigation:** Auto-refresh 10 segundos antes de expirar
- **Fallback:** Botón manual "Regenerar QR"

🟡 **WebSocket Disconnection**
- **Mitigation:** Auto-reconnect con exponential backoff
- **Fallback:** Polling como fallback si WS falla

🟡 **Session Manager Downtime**
- **Mitigation:** Health checks cada 30 segundos
- **Fallback:** Mostrar banner "Servicio temporalmente no disponible"

### Low Risk

🟢 **Multi-tenant Isolation**
- **Mitigation:** Autorizar `instance_id` contra el contexto autenticado
- **Fallback:** Error 403 si la instancia no corresponde

🟢 **Memoria/Performance**
- **Mitigation:** Un cliente WhatsApp por process
- **Fallback:** Restart automático si memoria > 500MB

---

## Success Metrics

### Performance
- [ ] QR generation < 5 segundos
- [ ] QR scan detection < 2 segundos
- [ ] WebSocket latency < 100ms
- [ ] Session restore < 3 segundos

### Reliability
- [ ] Uptime > 99% durante 24 horas
- [ ] Auto-reconnect success rate > 95%
- [ ] Zero data loss en session persistence
- [ ] Zero unauthorized access (multi-tenant)

### User Experience
- [ ] Usuario conecta en < 30 segundos
- [ ] Zero manual refreshes necesarios
- [ ] Error messages claros y accionables
- [ ] UI responsive sin bloqueos

---

## Rollback Plan

### If Phase 3 Fails

**Step 1: Disable New Features**
```bash
# Revertir a Phase 2
git checkout feature/central-hub-session-manager
pm2 restart leadmaster-hub
```

**Step 2: Revert Frontend**
```bash
cd services/central-hub/frontend
git checkout <phase-2-commit>
npm run build
sudo cp -r dist/* /var/www/desarrolloydisenioweb/
```

**Step 3: Revert Nginx (if WebSocket enabled)**
```bash
sudo cp /etc/nginx/sites-available/desarrolloydisenioweb.com.ar.conf.backup \
    /etc/nginx/sites-available/desarrolloydisenioweb.com.ar.conf
sudo nginx -t && sudo systemctl reload nginx
```

**Step 4: Validate**
```bash
curl https://desarrolloydisenioweb.com.ar/
# Debe cargar sin errores
```

**Rollback Time:** ~5 minutos  
**Data Loss:** None (Phase 2 stable)

---

## Dependencies

### NPM Packages (Backend)

```json
{
  "whatsapp-web.js": "^1.23.0",
  "qrcode-terminal": "^0.12.0",
  "qrcode": "^1.5.3",
  "socket.io": "^4.6.0",
  "axios": "^1.6.0"
}
```

### NPM Packages (Frontend)

```json
{
  "socket.io-client": "^4.6.0",
  "qrcode.react": "^3.1.0"
}
```

### System Requirements

- Node.js >= 18.x
- Chrome/Chromium (para whatsapp-web.js)
- Memoria: +500MB por cliente WhatsApp
- Disco: +50MB por sesión persistida

---

## Out of Scope

### NOT Included in Phase 3

❌ Envío de mensajes (Phase 4)  
❌ Recepción de mensajes (Phase 4)  
❌ Listener automático (Phase 4)  
❌ Campañas masivas (Phase 4)  
❌ Sincronización de contactos (Phase 4)  
❌ Analytics y métricas (Phase 5)  
❌ Notificaciones push (Phase 5)  
❌ Multi-device support (Phase 6)  

---

## Sign-Off Criteria

Phase 3 se considera completa cuando:

✅ Usuario puede conectar WhatsApp desde UI  
✅ QR se genera y muestra correctamente  
✅ Escaneo detectado automáticamente  
✅ Estado "Conectado" persiste tras reload  
✅ Estado persiste tras restart PM2  
✅ Multi-tenant funciona (múltiples clientes)  
✅ Desconexión manual funciona  
✅ Auto-reconnect funciona  
✅ Logs sin errores críticos  
✅ Documentación completa  

**Approval Required:** Alberto Hilal (Product Owner)

---

**Document Version:** 1.0  
**Created:** 2026-01-02  
**Author:** GitHub Copilot  
**Status:** 📋 DRAFT - Pending Approval

---

## Appendix A: Example Session Flow

### Happy Path

```
T+0s   Usuario: Click "Conectar WhatsApp"
T+1s   Backend: POST /session-manager/sessions/:instance_id/qr → 200 OK
T+2s   Session Manager: Inicia whatsapp-web.js
T+3s   whatsapp-web.js: Emite evento 'qr'
T+4s   Backend: QR incluido en snapshot (qr_status=generated)
T+4s   Frontend: WebSocket recibe QR, muestra en pantalla
T+10s  Usuario: Escanea QR con móvil
T+12s  whatsapp-web.js: Emite evento 'ready'
T+13s  Backend: WebSocket notifica status=connected
T+13s  Frontend: Muestra "Conectado ✓"
```

### Error Path: QR Expired

```
T+0s   Usuario: Click "Conectar WhatsApp"
T+4s   Frontend: Muestra QR
T+60s  QR: Expirado (sin escaneo)
T+60s  Frontend: Muestra "QR expirado"
T+61s  Usuario: Click "Regenerar QR"
T+65s  Frontend: Nuevo QR mostrado
T+75s  Usuario: Escanea nuevo QR
T+77s  Frontend: "Conectado ✓"
```

---

## Appendix B: Troubleshooting Guide

### Issue: QR no se genera

**Síntomas:** Frontend muestra "Conectando..." indefinidamente

**Diagnóstico:**
```bash
# Verificar Session Manager está corriendo
curl http://localhost:3001/health
# Debe responder 200

# Verificar logs
pm2 logs session-manager
# Buscar errores de whatsapp-web.js
```

**Solución:**
```bash
# Restart Session Manager
pm2 restart session-manager

# Si persiste, limpiar sesión
rm -rf services/session-manager/sessions/cliente_*
pm2 restart session-manager
```

### Issue: QR escaneado pero no conecta

**Síntomas:** Estado queda en "Autenticando..."

**Diagnóstico:**
```bash
# Verificar logs de whatsapp-web.js
pm2 logs session-manager | grep -i ready

# Verificar permisos de sesión
ls -la services/session-manager/sessions/
```

**Solución:**
```bash
# Esperar hasta 30 segundos (sincronización WhatsApp)
# Si no conecta, regenerar sesión:
rm -rf services/session-manager/sessions/instance_<ID>
# Reintentar conexión
```

### Issue: WebSocket desconectado

**Síntomas:** Frontend no recibe actualizaciones

**Diagnóstico:**
```bash
# Verificar WebSocket en Chrome DevTools
# Network → WS → debe mostrar conexión activa

# Verificar firewall
sudo ufw status | grep 3012
```

**Solución:**
```bash
# Frontend: Auto-reconnect debería funcionar
# Si no, refresh manual del navegador

# Backend:
pm2 restart leadmaster-hub
```

---

*End of Phase 3 Planning Document*
