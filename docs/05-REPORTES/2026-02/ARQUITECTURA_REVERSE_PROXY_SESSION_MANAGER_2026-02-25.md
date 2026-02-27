# Arquitectura de Reverse Proxy: Session Manager

**Fecha:** 2026-02-25  
**Tipo:** Documentación de infraestructura  
**Alcance:** Nginx → Central Hub → Session Manager  
**Estado:** Documentación de estado actual

---

## 1. Resumen Ejecutivo

El **Session Manager (puerto 3001)** NO está expuesto directamente a Internet. Todo el tráfico externo pasa por:

1. **Nginx** (puerto 443) con SSL de Cloudflare
2. **Central Hub** (puerto 3012) como API Gateway
3. **Session Manager** (puerto 3001) como servicio interno solo accesible desde localhost

**Principio arquitectónico:**
> Session Manager es un microservicio interno sin exposición directa. Central Hub actúa como único punto de entrada y proxy autorizado.

---

## 2. Capas de la Arquitectura

### 2.1 Flujo Completo

```
┌─────────────────────────────────────────────────────────────────┐
│ Internet (Cliente HTTPS)                                        │
└────────────────────────────┬────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ Cloudflare CDN + WAF                                            │
│ - SSL Termination                                               │
│ - DDoS Protection                                               │
│ - Edge Caching                                                  │
└────────────────────────────┬────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ Nginx :443 (desarrolloydisenioweb.com.ar)                      │
│ - Cloudflare Origin Certificate                                 │
│ - Reverse Proxy a Central Hub                                   │
│ - Serve static files (SPA)                                      │
│                                                                 │
│ Rutas API:                                                      │
│   /auth              → 127.0.0.1:3012                          │
│   /api/*             → 127.0.0.1:3012                          │
│   /session-manager/* → 127.0.0.1:3012                          │
│   /sender/*          → 127.0.0.1:3012                          │
│   /listener/*        → 127.0.0.1:3012                          │
│   /health            → 127.0.0.1:3012                          │
└────────────────────────────┬────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ Central Hub :3012 (Express.js)                                  │
│ - API Gateway                                                   │
│ - JWT Authentication                                            │
│ - Business Logic                                                │
│ - Database Access (PostgreSQL/MySQL)                            │
│ - HTTP Client to Session Manager                                │
│                                                                 │
│ Session Manager Client:                                         │
│   → http://localhost:3001                                       │
└────────────────────────────┬────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ Session Manager :3001 (Express.js + Venom-bot)                 │
│ - WhatsApp Session Management                                   │
│ - Single Admin Session (stateful)                               │
│ - Puppeteer + Chrome headless                                   │
│ - NO database access                                            │
│ - NO authentication (trusts Central Hub)                        │
│                                                                 │
│ Endpoints:                                                      │
│   GET  /health                                                  │
│   GET  /status       (X-Cliente-Id header)                      │
│   POST /send         (X-Cliente-Id header)                      │
│   GET  /qr           (X-Cliente-Id header)                      │
│   GET  /qr-code      (X-Cliente-Id header)                      │
└────────────────────────────┬────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ WhatsApp Web API                                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Nginx - Primera Capa (Puerto 443)

### 3.1 Archivo de Configuración

**Ubicación:** `/root/leadmaster-workspace/infra/nginx/sites-available/desarrolloydisenioweb.com.ar.conf`

**Dominio:** `desarrolloydisenioweb.com.ar`

### 3.2 Configuración SSL

```nginx
server {
    listen 443 ssl http2;
    server_name desarrolloydisenioweb.com.ar;
    
    # Cloudflare Origin Certificate
    ssl_certificate /etc/nginx/ssl/cloudflare/desarrolloydisenioweb.com.ar.crt;
    ssl_certificate_key /etc/nginx/ssl/cloudflare/desarrolloydisenioweb.com.ar.key;
    
    include snippets/ssl-cloudflare.conf;
```

**Características:**
- ✅ HTTPS con certificado de Cloudflare Origin
- ✅ HTTP/2 enabled
- ✅ Full (strict) SSL mode en Cloudflare
- ✅ Redirect automático HTTP → HTTPS

### 3.3 Rutas Proxeadas a Central Hub

Todas las rutas API apuntan a **Central Hub (127.0.0.1:3012)**:

```nginx
# API general
location /api {
    proxy_pass http://127.0.0.1:3012;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# Session Manager (via Central Hub)
location /session-manager {
    proxy_pass http://127.0.0.1:3012;
    # ... same headers
}

# Autenticación
location /auth {
    proxy_pass http://127.0.0.1:3012;
}

# Sender
location /sender {
    proxy_pass http://127.0.0.1:3012;
}

# Listener
location /listener {
    proxy_pass http://127.0.0.1:3012;
}

# Sync Contacts
location /sync-contacts {
    proxy_pass http://127.0.0.1:3012;
}

# Health check
location /health {
    proxy_pass http://127.0.0.1:3012;
}
```

### 3.4 SPA Routing

```nginx
# Archivos estáticos del frontend
location / {
    root /var/www/desarrolloydisenioweb;
    try_files $uri $uri/ /index.html;
}
```

**Comportamiento:**
- Intenta servir archivo estático
- Si no existe, sirve `index.html` (React Router)

---

## 4. Central Hub - Segunda Capa (Puerto 3012)

### 4.1 Rol como API Gateway

Central Hub actúa como:
- ✅ **Gateway unificado** para todos los servicios
- ✅ **Proxy autorizado** hacia Session Manager
- ✅ **Validador de autenticación** (JWT)
- ✅ **Capa de business logic**

### 4.2 Rutas que Proxean a Session Manager

#### A) WhatsApp QR Proxy (`/api/whatsapp/*`)

**Archivo:** `services/central-hub/src/routes/whatsappQrProxy.js`

```javascript
GET  /api/whatsapp/:clienteId/status
     → sessionManagerClient.getStatus()
     
GET  /api/whatsapp/:clienteId/qr-code
     → sessionManagerClient.getQRCode(clienteId)
     
POST /api/whatsapp/:clienteId/send
     → sessionManagerClient.sendMessage(clienteId, to, message)
```

**Características:**
- Valida `clienteId` como entero positivo
- Mapea errores del Session Manager
- Log de todas las operaciones
- Transparente (no modifica respuestas)

#### B) Admin WhatsApp (`/api/admin/whatsapp/*`)

**Archivo:** `services/central-hub/src/routes/adminWhatsapp.routes.js`

```javascript
GET  /api/admin/whatsapp/status
     → sessionManagerClient.getStatus()
     
POST /api/admin/whatsapp/connect
     → sessionManagerClient.connect()
     
POST /api/admin/whatsapp/disconnect
     → sessionManagerClient.disconnect()
```

**Autenticación:** JWT requerido (admin solo)

#### C) QR Code Proxy Read-Only (`/qr-code`)

**Archivo:** `services/central-hub/src/routes/qrCodeProxy.js`

```javascript
GET  /qr-code
     Header: X-Cliente-Id (required)
     → sessionManagerClient.getQRCode(clienteId)
```

**Características:**
- NO valida autorización (read-only)
- NO consulta base de datos
- SOLO reenvía request
- Mapea errores 400, 404, 409, 502

#### D) Session Manager Internal (`/api/session-manager/*`)

**Archivo:** `services/central-hub/src/modules/session-manager/routes/`

```javascript
GET  /api/session-manager/status
POST /api/session-manager/login
POST /api/session-manager/logout
GET  /api/session-manager/state
GET  /api/session-manager/qr
```

**Uso:** Interno del Hub, requiere JWT

### 4.3 Session Manager HTTP Client

**Archivo:** `services/central-hub/src/integrations/sessionManager/sessionManagerClient.js`

**Base URL:** `http://localhost:3001`

**Métodos disponibles:**

```javascript
// Status global
async getStatus()
  → GET /status

// Obtener QR code
async getQRCode(clienteId)
  → GET /qr-code
  → Header: X-Cliente-Id: {clienteId}

// Enviar mensaje
async sendMessage(clienteId, to, text)
  → POST /send
  → Header: X-Cliente-Id: {clienteId}
  → Body: { to, message }

// Conectar sesión
async connect()
  → POST /connect

// Desconectar sesión
async disconnect()
  → POST /disconnect
```

**Error Handling:**

```javascript
SessionManagerTimeoutError        // Timeout de conexión
SessionManagerUnreachableError    // Connection refused
SessionManagerSessionNotReadyError // Session no lista
SessionManagerValidationError     // Error de validación
```

**Timeouts configurados:**
- Connection timeout: 5 segundos
- Read timeout: 30 segundos

---

## 5. Session Manager - Tercera Capa (Puerto 3001)

### 5.1 Características de Seguridad

**Aislamiento:**
- ❌ NO expuesto a Internet
- ✅ Solo accesible desde `localhost`
- ✅ NO valida autenticación (confía en Central Hub)
- ✅ Usa headers `X-Cliente-Id` como metadata

**Stateful:**
- ✅ Single Admin Session (una sesión WhatsApp global)
- ✅ NO cluster mode (PM2 fork mode, 1 instancia)
- ✅ NO watch (para evitar pérdida de sesión)
- ✅ Persiste tokens en `.wwebjs_auth/`

### 5.2 Endpoints Disponibles

```javascript
// Health check (sin headers)
GET /health
Response: { status: "ok", service: "session-manager", timestamp: "..." }

// Estado global (incluye QR automáticamente cuando aplica)
GET /status
Response cuando READY: 
{
  connected: true,
  state: "READY",
  session: "admin"
}

Response cuando QR_REQUIRED:
{
  connected: false,
  state: "QR_REQUIRED",
  session: "admin",
  qr: {
    base64: "iVBORw0KGgoAAAANSUhEUgAA...",
    url: "2@...",
    attempts: 1,
    timestamp: 1708876543210
  }
}

// Conectar sesión ADMIN
POST /connect
Response: { success: true, message: "Connected", session: "admin", state: "..." }

// Desconectar sesión ADMIN
POST /disconnect
Response: { success: true, message: "Disconnected" }

// Enviar mensaje (requiere cliente_id en body)
POST /send
Body: { cliente_id: 51, to: "5491123456789", message: "texto" }
Response: { success: true, message: "Message sent", data: {...} }
```

**Nota importante sobre endpoints QR:**
- ❌ NO existe endpoint dedicado `/qr` o `/qr-code` en la implementación actual
- ✅ El QR se retorna automáticamente dentro de `/status` cuando `state === 'QR_REQUIRED'`
- 📁 Los archivos `routes/qr.js` y `routes/qrCode.js` son legacy (no se usan)

### 5.3 Implementación de Bootstrap

**Archivo:** `services/session-manager/index.js`

**Auto-inicialización:**

```javascript
const server = app.listen(PORT, async () => {
  console.log(`[Server] Listening on port ${PORT}`);
  
  // Initialize WhatsApp session after HTTP server is ready
  console.log('[Bootstrap] Initializing ADMIN WhatsApp session...');
  try {
    await venomSession.connect();
    console.log('[Bootstrap] ✅ WhatsApp session initialized successfully');
  } catch (error) {
    console.error('[Bootstrap] ⚠️  Failed to initialize WhatsApp session:', error.message);
    console.error('[Bootstrap] Server will continue running without WhatsApp connection');
  }
});
```

**Comportamiento:**
1. Servidor HTTP arranca inmediatamente (no bloqueante)
2. Inicia conexión WhatsApp en background
3. Si Venom falla, servidor sigue corriendo
4. WhatsApp se reconecta automáticamente en próximo request

### 5.4 Gestión de QR Code (Implementación Actual)

**Archivo:** `services/session-manager/whatsapp/venom-session.js`

#### 5.4.1 Captura del QR

El QR se captura automáticamente durante la conexión mediante el callback `catchQR` de Venom:

```javascript
const client = await venom.create({
  session: 'admin',
  headless: !isLocalLogin,
  
  // Capturar QR durante la conexión
  catchQR: (base64Qr, asciiQR, attempts, urlCode) => {
    console.log(`[VenomSession] QR generado para sesión ADMIN (intento ${attempts})`);
    adminState = 'QR_REQUIRED';
    qrData = {
      base64: base64Qr,      // QR en formato base64 PNG
      url: urlCode,           // URL del QR (formato 2@...)
      attempts,               // Número de intento
      timestamp: Date.now()   // Timestamp de generación
    };
  }
});
```

#### 5.4.2 Exposición del QR

El QR se expone a través del método `getState()`:

```javascript
function getState() {
  const response = {
    connected: adminState === 'READY',
    state: adminState,
    session: 'admin'
  };
  
  // Incluir QR si está disponible
  if (qrData && adminState === 'QR_REQUIRED') {
    response.qr = qrData;
  }
  
  return response;
}
```

**Estados del sistema:**

| Estado | Descripción | QR incluido | connected |
|--------|-------------|-------------|-----------|
| `DISCONNECTED` | Sin conexión | ❌ No | `false` |
| `CONNECTING` | Iniciando conexión | ❌ No | `false` |
| `QR_REQUIRED` | Esperando escaneo de QR | ✅ Sí | `false` |
| `READY` | Conectado y operativo | ❌ No | `true` |

#### 5.4.3 Flujo de Autenticación

```
┌──────────────────────────────────────────────────────────────┐
│ 1. Admin inicia conexión                                     │
│    POST /connect                                             │
└────────────────────────────┬─────────────────────────────────┘
                             ↓
┌──────────────────────────────────────────────────────────────┐
│ 2. Venom inicia Chrome                                       │
│    Estado: CONNECTING                                        │
└────────────────────────────┬─────────────────────────────────┘
                             ↓
┌──────────────────────────────────────────────────────────────┐
│ 3. WhatsApp Web carga                                        │
│    Estado: CONNECTING                                        │
└────────────────────────────┬─────────────────────────────────┘
                             ↓
┌──────────────────────────────────────────────────────────────┐
│ 4. Venom detecta que necesita QR                             │
│    Callback catchQR() invocado                               │
│    Estado: QR_REQUIRED                                       │
│    qrData: { base64, url, attempts, timestamp }              │
└────────────────────────────┬─────────────────────────────────┘
                             ↓
┌──────────────────────────────────────────────────────────────┐
│ 5. Frontend hace polling de /status                          │
│    Cada 2 segundos                                           │
│    Recibe: { state: "QR_REQUIRED", qr: {...} }              │
└────────────────────────────┬─────────────────────────────────┘
                             ↓
┌──────────────────────────────────────────────────────────────┐
│ 6. Frontend muestra QR al usuario                            │
│    Renderiza qr.base64 como imagen                           │
└────────────────────────────┬─────────────────────────────────┘
                             ↓
┌──────────────────────────────────────────────────────────────┐
│ 7. Admin escanea QR con móvil WhatsApp                       │
│    WhatsApp valida el QR                                     │
└────────────────────────────┬─────────────────────────────────┘
                             ↓
┌──────────────────────────────────────────────────────────────┐
│ 8. Venom detecta autenticación exitosa                       │
│    Estado: CONNECTING → READY                                │
│    qrData: null (se limpia)                                  │
│    Tokens persisten en: .wwebjs_auth/admin/                 │
└────────────────────────────┬─────────────────────────────────┘
                             ↓
┌──────────────────────────────────────────────────────────────┐
│ 9. Sistema listo para enviar mensajes                        │
│    GET /status → { state: "READY", connected: true }        │
└──────────────────────────────────────────────────────────────┘
```

#### 5.4.4 Endpoints para Obtener QR

**Endpoint recomendado (implementación actual):**

```bash
# Via Central Hub (con autenticación)
GET https://desarrolloydisenioweb.com.ar/api/admin/whatsapp/status
Authorization: Bearer <JWT>

Response:
{
  "connected": false,
  "state": "QR_REQUIRED",
  "session": "admin",
  "qr": {
    "base64": "iVBORw0KGgoAAAANSUhEUgAA...",
    "url": "2@JDhq7kQuoTyP2rS...",
    "attempts": 1,
    "timestamp": 1708876543210
  }
}
```

**Endpoint directo (localhost only):**

```bash
# Acceso directo al Session Manager (solo desde servidor)
curl http://localhost:3001/status

Response (mismo formato que arriba)
```

#### 5.4.5 Archivos Legacy (NO en Uso)

Los siguientes archivos existen pero **NO se utilizan** en la implementación actual:

```bash
services/session-manager/routes/qr.js       # ES modules, no montado en app.js
services/session-manager/routes/qrCode.js   # ES modules, no montado en app.js
```

**Razón:** Estos archivos pertenecen a una implementación anterior con `whatsapp-web.js` que fue reemplazada por **Venom-bot**. La nueva implementación usa CommonJS (`require`) mientras estos archivos usan ES modules (`import/export`).

**Confirmación:**

```javascript
// Archivo: services/session-manager/app.js (implementación actual)
const express = require('express');
const cors = require('cors');
const apiRoutes = require('./routes/api');  // ✅ Solo este se usa

const app = express();
app.use(cors());
app.use(express.json());
app.use('/', apiRoutes);  // ✅ Monta /health, /status, /connect, /disconnect, /send

module.exports = app;

// ❌ NO se montan routes/qr.js ni routes/qrCode.js
```

**Recomendación:** Eliminar archivos legacy para evitar confusión:
- `routes/qr.js`
- `routes/qrCode.js`
- `routes/status.js` (si usa ES modules)
- `routes/init.js` (si existe y no se usa)

#### 5.4.6 Formato del QR

**Estructura del objeto QR:**

```typescript
interface QRData {
  base64: string;      // Imagen QR en formato base64 PNG (data:image/png;base64,...)
  url: string;         // Código QR en formato texto (2@...)
  attempts: number;    // Número de intento (1-3 típicamente)
  timestamp: number;   // Timestamp Unix en milisegundos
}
```

**Ejemplo real:**

```json
{
  "base64": "iVBORw0KGgoAAAANSUhEUgAAARgAAAEYCAYAAACHjumMAAAAAXNSR0IArs4c6QAA...",
  "url": "2@JDhq7kQuoTyP2rS4vCj8qMexXH9p6ZjKLm3nRwT==,xN2vY5pQ1mZ8kL4jR...",
  "attempts": 1,
  "timestamp": 1708876543210
}
```

**Uso en frontend:**

```javascript
// En React
<img src={status.qr.base64} alt="WhatsApp QR Code" />

// O renderizar directamente
<QRCode value={status.qr.url} size={300} />
```

#### 5.4.7 Expiración del QR

**Comportamiento:**
- WhatsApp expira el QR después de **~60 segundos**
- Venom genera un **nuevo QR automáticamente** (attempts incrementa)
- El frontend debe hacer **polling continuo** de `/status` para obtener QRs actualizados

**Polling recomendado:**

```javascript
// Frontend: polling cada 2 segundos
const checkStatus = async () => {
  const response = await fetch('/api/admin/whatsapp/status', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  
  if (data.state === 'QR_REQUIRED' && data.qr) {
    setQRCode(data.qr.base64);
  } else if (data.state === 'READY') {
    setConnected(true);
  }
};

// Ejecutar cada 2 segundos mientras no esté conectado
const interval = setInterval(checkStatus, 2000);
```

**Importante:**
- ✅ Continuar polling hasta que `state === 'READY'`
- ✅ Mostrar `attempts` al usuario (indica reintento)
- ✅ Mostrar timestamp para debugging
- ❌ NO cachear el QR (siempre consultar /status)

---

## 6. Seguridad y Aislamiento

### 6.1 Puertos Expuestos

| Servicio | Puerto | Acceso | Protocolo |
|----------|--------|--------|-----------|
| Nginx | 443 | Internet | HTTPS |
| Nginx | 80 | Internet | HTTP (redirect a 443) |
| Central Hub | 3012 | Localhost only | HTTP |
| Session Manager | 3001 | Localhost only | HTTP |
| Database | 3306/5432 | Localhost only | MySQL/PostgreSQL |

### 6.2 Firewall Rules (Necesarias)

```bash
# Permitir HTTPS
ufw allow 443/tcp

# Permitir HTTP (para redirect)
ufw allow 80/tcp

# Bloquear acceso directo a servicios internos
ufw deny 3001/tcp  # Session Manager
ufw deny 3012/tcp  # Central Hub
```

### 6.3 Cloudflare Configuration

**SSL/TLS Mode:** Full (strict)

```
Client → Cloudflare: HTTPS (Cloudflare Edge Certificate)
Cloudflare → Nginx: HTTPS (Cloudflare Origin Certificate)
Nginx → Central Hub: HTTP (localhost)
Central Hub → Session Manager: HTTP (localhost)
```

**Beneficios:**
- ✅ DDoS protection
- ✅ WAF (Web Application Firewall)
- ✅ Edge caching para static assets
- ✅ SSL termination en Cloudflare + Nginx

---

## 7. Casos de Uso y Flujos

### 7.1 Frontend Obtiene Estado de WhatsApp

```
┌──────────┐
│ Frontend │ GET https://desarrolloydisenioweb.com.ar/api/whatsapp/51/status
│ (React)  │ Header: Authorization: Bearer <JWT>
└─────┬────┘
      │
      ↓ HTTPS
┌─────────┐
│ Nginx   │ Verifica SSL, proxy_pass a 127.0.0.1:3012
│ :443    │
└─────┬───┘
      │
      ↓ HTTP (localhost)
┌───────────────┐
│ Central Hub   │ Valida JWT, extrae clienteId=51
│ :3012         │ Llama sessionManagerClient.getStatus()
└───────┬───────┘
        │
        ↓ HTTP (localhost)
┌─────────────────┐
│ Session Manager │ Consulta estado de Venom
│ :3001           │ Retorna { state: "READY", connected: true, ... }
└─────────────────┘
```

**Total hops:** 3 (Nginx → Central Hub → Session Manager)

### 7.2 Envío de Mensaje WhatsApp

```
Frontend → Nginx → Central Hub → Session Manager → Venom → WhatsApp Web API
  (JWT)     (SSL)   (clienteId)    (X-Cliente-Id)   (Puppeteer)
```

**Validaciones:**
1. **Nginx:** SSL válido, headers correctos
2. **Central Hub:** JWT válido, usuario autorizado
3. **Session Manager:** Sesión READY, número válido

### 7.3 Primera Autenticación (QR Code)

#### Flujo Completo (Implementación Actual)

```
1. Admin inicia conexión:
   POST https://desarrolloydisenioweb.com.ar/api/admin/whatsapp/connect
   Authorization: Bearer <JWT>
   
   Response:
   {
     "success": true,
     "message": "Connected",
     "session": "admin",
     "state": "CONNECTING",
     "alreadyConnected": false
   }

2. Session Manager inicia Chrome+Venom:
   - Estado cambia a CONNECTING
   - Chrome headless se abre
   - Navega a web.whatsapp.com
   - Venom detecta que necesita autenticación

3. Venom genera QR:
   - Callback catchQR() invocado automáticamente
   - Estado cambia a QR_REQUIRED
   - qrData poblado con base64, url, attempts, timestamp
   - QR expira en ~60 segundos

4. Frontend hace polling de status:
   GET https://desarrolloydisenioweb.com.ar/api/admin/whatsapp/status
   Authorization: Bearer <JWT>
   
   Cada 2 segundos hasta que state === "READY"
   
   Response con QR:
   {
     "connected": false,
     "state": "QR_REQUIRED",
     "session": "admin",
     "qr": {
       "base64": "iVBORw0KGgoAAAANSUhEUgAA...",
       "url": "2@...",
       "attempts": 1,
       "timestamp": 1708876543210
     }
   }

5. Frontend renderiza QR:
   <img src={status.qr.base64} alt="WhatsApp QR" />
   
   Usuario ve el código QR en pantalla

6. Admin escanea QR con móvil:
   - Abre WhatsApp en celular
   - Va a "Dispositivos vinculados"
   - Escanea el QR
   - WhatsApp valida la conexión

7. WhatsApp autentica:
   - Venom detecta autenticación exitosa
   - Estado cambia a READY
   - qrData se limpia (null)
   - Tokens se guardan en disco

8. Tokens persisten en:
   /root/leadmaster-workspace/services/session-manager/.wwebjs_auth/admin/
   
   Archivos persistidos:
   - session.json
   - cookies.json
   - Default/IndexedDB/
   - Default/Local Storage/

9. Próximos arranques:
   - Session Manager arranca con tokens existentes
   - NO requiere QR (pasa directo a READY)
   - Estado: CONNECTING → READY en ~5-10 segundos

10. Frontend detecta READY:
    GET /api/admin/whatsapp/status
    
    Response:
    {
      "connected": true,
      "state": "READY",
      "session": "admin"
    }
    
    Frontend muestra: "✅ WhatsApp conectado"
```

#### Errores Comunes y Solución

| Error | Causa | Solución |
|-------|-------|----------|
| QR no aparece | Chrome no inició | Verificar logs de PM2: `pm2 logs session-manager` |
| QR expira muy rápido | Red lenta | Escanear en <30 segundos |
| Estado stuck en CONNECTING | Firewall bloqueando WhatsApp | Verificar conectividad a web.whatsapp.com |
| "Session not ready" | Tokens corruptos | Eliminar `.wwebjs_auth/admin/` y reconectar |
| QR attempts > 3 | WhatsApp bloqueó temporalmente | Esperar 5 minutos antes de reintentar |

#### Logs Esperados (Arranque Exitoso)

```bash
# PM2 logs durante autenticación QR
[Server] Listening on port 3001
[Bootstrap] Initializing ADMIN WhatsApp session...
[VenomSession] Modo de login: server (headless: true)
[VenomSession] Iniciando conexión ADMIN
[VenomSession] Estado ADMIN: initBrowser
[VenomSession] Estado ADMIN: openBrowser
[VenomSession] Estado ADMIN: initWhatsapp
[VenomSession] QR generado para sesión ADMIN (intento 1)
[VenomSession] Cambio de estado: waitForLogin → QR_REQUIRED
# ... Usuario escanea QR ...
[VenomSession] Estado ADMIN: qrReadSuccess
[VenomSession] Cambio de estado: qrReadSuccess → CONNECTING
[VenomSession] Estado ADMIN: chatsAvailable
[VenomSession] Cambio de estado: chatsAvailable → READY
[VenomSession] ✅ Sesión ADMIN conectada y READY
[VenomSession] Esperando 5s para sincronización de WhatsApp...
[Bootstrap] ✅ WhatsApp session initialized successfully
```

#### Comando de Test Manual

```bash
# 1. Obtener JWT
TOKEN=$(curl -s -X POST https://desarrolloydisenioweb.com.ar/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"xxx"}' \
  | jq -r '.token')

# 2. Iniciar conexión
curl -X POST https://desarrolloydisenioweb.com.ar/api/admin/whatsapp/connect \
  -H "Authorization: Bearer $TOKEN"

# 3. Obtener QR (hacer polling)
watch -n 2 "curl -s https://desarrolloydisenioweb.com.ar/api/admin/whatsapp/status \
  -H 'Authorization: Bearer $TOKEN' | jq ."

# Salida esperada cuando QR disponible:
# {
#   "connected": false,
#   "state": "QR_REQUIRED",
#   "session": "admin",
#   "qr": {
#     "base64": "iVBORw0KGgoAAAANSUhEUgAA...",
#     "url": "2@...",
#     "attempts": 1,
#     "timestamp": 1708876543210
#   }
# }
```

---

## 8. Ventajas de Esta Arquitectura

### 8.1 Seguridad

✅ **Defense in Depth:**
- Capa 1: Cloudflare WAF + DDoS protection
- Capa 2: Nginx reverse proxy + SSL
- Capa 3: Central Hub JWT authentication
- Capa 4: Session Manager isolated (localhost only)

✅ **Separation of Concerns:**
- Session Manager NO conoce usuarios, JWT, o autorizaciones
- Central Hub NO conoce implementación de WhatsApp
- Frontend NO conoce Session Manager (opaco)

### 8.2 Escalabilidad

✅ **Horizontal scaling:**
- Central Hub puede escalar horizontalmente (load balancer)
- Session Manager permanece single-instance (stateful)
- Nginx puede tener múltiples workers

✅ **Caching:**
- Static assets servidos por Nginx
- API responses pueden cachearse en Central Hub
- Cloudflare CDN para distribución global

### 8.3 Mantenibilidad

✅ **Decoupling:**
- Cambiar implementación de WhatsApp NO afecta Central Hub
- Cambiar Central Hub NO afecta Session Manager
- Agregar nuevos endpoints es simple (agregar route + client method)

✅ **Debugging:**
- Logs separados por capa
- Request tracing con `X-Request-ID`
- Health checks independientes

---

## 9. Limitaciones y Trade-offs

### 9.1 Latencia

**Overhead de red:**
- Frontend → Nginx: ~5-20ms (según ubicación)
- Nginx → Central Hub: <1ms (localhost)
- Central Hub → Session Manager: <1ms (localhost)

**Total:** ~10-25ms adicionales vs. acceso directo

**Justificación:** La seguridad y arquitectura limpia valen el overhead.

### 9.2 Single Point of Failure

**Si Nginx cae:**
- ❌ TODO el sistema inaccesible

**Mitigación:**
- PM2 mantiene Nginx running (si se usa PM2)
- Monitoreo con health checks
- Auto-restart configurado

**Si Central Hub cae:**
- ❌ API inaccesible
- ✅ Session Manager sigue corriendo (sesión WhatsApp persiste)

**Mitigación:**
- PM2 auto-restart
- Múltiples instancias de Central Hub (con load balancer)

**Si Session Manager cae:**
- ❌ WhatsApp temporalmente inaccesible
- ✅ Reinicia automáticamente (PM2)
- ✅ Tokens persisten en disco

### 9.3 Session Manager NO puede escalar horizontalmente

**Razón:** WhatsApp sessions son stateful (Venom mantiene Chrome con cookies)

**Alternativas NO viables:**
- ❌ Cluster mode (cada worker crearía sesión nueva)
- ❌ Load balancer (sesiones en instancias diferentes)
- ❌ Redis session storage (Puppeteer no serializable)

**Solución actual:** Single-instance con auto-recovery (correcto para este caso)

---

## 10. Comandos de Diagnóstico

### 10.1 Verificar Nginx

```bash
# Status
systemctl status nginx

# Test config
nginx -t

# Ver logs
tail -f /var/log/nginx/desarrolloydisenioweb.access.log
tail -f /var/log/nginx/desarrolloydisenioweb.error.log

# Reload sin downtime
nginx -s reload
```

### 10.2 Verificar Central Hub

```bash
# Via PM2
pm2 show central-hub
pm2 logs central-hub --lines 100

# Test directo (localhost)
curl http://localhost:3012/api/health

# Test via Nginx (producción)
curl https://desarrolloydisenioweb.com.ar/api/health
```

### 10.3 Verificar Session Manager

```bash
# Via PM2
pm2 show session-manager
pm2 logs session-manager --lines 100

# Test directo (localhost only)
curl http://localhost:3001/health

# Test via Central Hub
curl -H "Authorization: Bearer <JWT>" \
     https://desarrolloydisenioweb.com.ar/api/admin/whatsapp/status
```

### 10.4 Verificar Conectividad

```bash
# Desde servidor, test cada capa
curl -I http://localhost:3001/health          # Session Manager
curl -I http://localhost:3012/api/health      # Central Hub
curl -I http://localhost/api/health           # Nginx
curl -I https://desarrolloydisenioweb.com.ar/api/health  # Producción

# Verificar puertos en escucha
netstat -tulpn | grep -E ':(443|3001|3012)'
```

### 10.5 Verificar Firewall

```bash
# Ver reglas activas
ufw status verbose

# Verificar que 3001 NO esté expuesto
nmap -p 3001 <IP_PUBLICA>  # Debe mostrar "filtered" o "closed"
```

---

## 11. Procedimientos de Mantenimiento

### 11.1 Actualizar Certificado SSL

```bash
# Reemplazar certificado de Cloudflare
sudo cp nuevo-cert.crt /etc/nginx/ssl/cloudflare/desarrolloydisenioweb.com.ar.crt
sudo cp nuevo-cert.key /etc/nginx/ssl/cloudflare/desarrolloydisenioweb.com.ar.key

# Verificar config
sudo nginx -t

# Reload sin downtime
sudo nginx -s reload
```

### 11.2 Actualizar Configuración de Nginx

```bash
# Editar config
sudo nano /etc/nginx/sites-available/desarrolloydisenioweb.com.ar.conf

# Test syntax
sudo nginx -t

# Aplicar cambios
sudo nginx -s reload
```

### 11.3 Cambiar Puerto de Session Manager

**Si se necesita cambiar de 3001 a otro puerto:**

1. **Session Manager:**
   ```bash
   # Editar .env
   PORT=3005
   
   # Reiniciar
   pm2 restart session-manager
   ```

2. **Central Hub:**
   ```javascript
   // Editar src/integrations/sessionManager/sessionManagerClient.js
   const SESSION_MANAGER_URL = 'http://localhost:3005';
   
   // Reiniciar
   pm2 restart central-hub
   ```

3. **NO tocar Nginx** (ya apunta a Central Hub, no a Session Manager)

---

## 12. Troubleshooting: Problemas Comunes con QR

### 12.1 QR No Se Genera

**Síntoma:** El estado permanece en `CONNECTING` pero nunca cambia a `QR_REQUIRED`.

**Diagnóstico:**

```bash
# Ver logs en tiempo real
pm2 logs session-manager --lines 100

# Buscar errores de Chrome
pm2 logs session-manager | grep -i "chrome\|puppeteer\|error"
```

**Causas posibles:**

| Causa | Indicador en logs | Solución |
|-------|-------------------|----------|
| Chrome no instalado | `executablePath not found` | `apt install google-chrome-stable` |
| Chrome crashea | `ERR_LAUNCHER_NOT_INSTALLED` | Instalar dependencias: `apt install libgbm-dev libasound2` |
| Permisos incorrectos | `EACCES` | `chmod -R 755 /root/leadmaster-workspace/services/session-manager` |
| Puerto 3001 ocupado | `EADDRINUSE` | `lsof -ti:3001 \| xargs kill -9` |
| WhatsApp bloqueado | `ERR_NETWORK_CHANGED` | Cambiar IP o esperar 24h |

**Solución rápida:**

```bash
# 1. Detener proceso
pm2 stop session-manager

# 2. Limpiar tokens viejos (si es primera vez)
rm -rf /root/leadmaster-workspace/services/session-manager/.wwebjs_auth/

# 3. Verificar Chrome
google-chrome-stable --version

# 4. Reiniciar
pm2 start session-manager
pm2 logs session-manager --lines 50
```

### 12.2 QR Expira Demasiado Rápido

**Síntoma:** `attempts` incrementa rápidamente (>3) sin tiempo para escanear.

**Causa:** WhatsApp detecta automatización o red lenta.

**Solución:**

```bash
# Verificar latencia a WhatsApp
ping web.whatsapp.com

# Verificar que no haya múltiples instancias
pm2 list | grep session-manager  # Debe haber SOLO 1

# Reiniciar con delay
pm2 stop session-manager
sleep 10
pm2 start session-manager
```

**Configuración alternativa (si persiste):**

Editar `services/session-manager/whatsapp/venom-session.js`:

```javascript
// Agregar delay entre reintentos
catchQR: (base64Qr, asciiQR, attempts, urlCode) => {
  console.log(`[VenomSession] QR generado (intento ${attempts})`);
  
  // Si attempts > 2, parar y requerir restart manual
  if (attempts > 2) {
    console.error('[VenomSession] Demasiados intentos. Reiniciar manualmente.');
    process.exit(1);  // PM2 auto-restart
  }
  
  adminState = 'QR_REQUIRED';
  qrData = { base64: base64Qr, url: urlCode, attempts, timestamp: Date.now() };
}
```

### 12.3 Estado Stuck Después de Escanear QR

**Síntoma:** QR escaneado exitosamente en móvil, pero estado no cambia a `READY`.

**Diagnóstico:**

```bash
# Ver estado actual
curl http://localhost:3001/status | jq .

# Ver logs de Venom
pm2 logs session-manager | grep "VenomSession\|statusFind"
```

**Causas:**

| Estado Stuck | Logs | Solución |
|--------------|------|----------|
| `QR_REQUIRED` | No hay logs de `qrReadSuccess` | QR no escaneado correctamente, reintentar |
| `CONNECTING` | `chatsAvailable` no aparece | WhatsApp sincronizando, esperar 30s más |
| `CONNECTING` | `desconnectedMobile` | Móvil perdió conexión, reconectar WiFi |

**Solución:**

```bash
# 1. Esperar 30 segundos (sincronización normal)
sleep 30
curl http://localhost:3001/status | jq .state

# 2. Si sigue stuck, restart
pm2 restart session-manager

# 3. Verificar tokens se crearon
ls -la /root/leadmaster-workspace/services/session-manager/.wwebjs_auth/admin/
# Debe existir: session.json, cookies.json, Default/
```

### 12.4 "Session Not Ready" al Enviar Mensaje

**Síntoma:** Estado muestra `READY` pero `/send` retorna error.

**Diagnóstico:**

```bash
# Verificar estado real
curl http://localhost:3001/status

# Debe mostrar:
# { "connected": true, "state": "READY", "session": "admin" }
```

**Si connected === false:**

```bash
# Ver último error en logs
pm2 logs session-manager --err --lines 50

# Buscar desconexión
grep "desconnectedMobile\|DISCONNECTED" ~/.pm2/logs/session-manager-out.log
```

**Solución:**

```bash
# Reconectar
curl -X POST http://localhost:3001/connect

# Esperar a READY
watch -n 2 "curl -s http://localhost:3001/status | jq .state"
```

### 12.5 Tokens Corruptos (Loop Infinito de QR)

**Síntoma:** Después de escanear QR, vuelve a pedir QR en próximo arranque.

**Causa:** Tokens de `.wwebjs_auth/admin/` corruptos o incompletos.

**Solución definitiva:**

```bash
# 1. Detener servicio
pm2 stop session-manager

# 2. BACKUP tokens actuales (por si acaso)
mv /root/leadmaster-workspace/services/session-manager/.wwebjs_auth \
   /root/leadmaster-workspace/services/session-manager/.wwebjs_auth.backup-$(date +%Y%m%d)

# 3. Limpiar completamente
rm -rf /root/leadmaster-workspace/services/session-manager/.wwebjs_auth/

# 4. Reiniciar y autenticar desde cero
pm2 start session-manager
pm2 logs session-manager

# 5. Escanear QR nuevamente
# ... frontend polling, escanear, etc ...

# 6. Verificar tokens nuevos
ls -lah /root/leadmaster-workspace/services/session-manager/.wwebjs_auth/admin/

# Debe mostrar:
# session.json (varios KB)
# cookies.json (varios KB)
# Default/ (directorio con IndexedDB y Local Storage)
```

### 12.6 Central Hub No Recibe QR

**Síntoma:** Session Manager muestra `QR_REQUIRED` pero Central Hub retorna error.

**Diagnóstico:**

```bash
# 1. Test directo a Session Manager
curl http://localhost:3001/status

# 2. Test via Central Hub
curl http://localhost:3012/api/admin/whatsapp/status \
  -H "Authorization: Bearer $JWT_TOKEN"

# Si (1) funciona pero (2) falla: problema en Central Hub
```

**Causas posibles:**

| Error | Causa | Solución |
|-------|-------|----------|
| `Connection refused` | Session Manager no corriendo | `pm2 start session-manager` |
| `Timeout` | Firewall/iptables bloqueando | Verificar: `iptables -L \| grep 3001` |
| `502 Bad Gateway` | Central Hub no puede alcanzar SM | Verificar URL en sessionManagerClient.js |

**Verificar URL del cliente:**

```bash
# services/central-hub/src/integrations/sessionManager/sessionManagerClient.js
grep SESSION_MANAGER_URL services/central-hub/src/integrations/sessionManager/sessionManagerClient.js

# Debe mostrar:
# const SESSION_MANAGER_URL = 'http://localhost:3001';
```

### 12.7 QR No Se Muestra en Frontend

**Síntoma:** API retorna QR pero frontend no lo renderiza.

**Diagnóstico (desde navegador):**

```javascript
// Abrir DevTools Console
fetch('/api/admin/whatsapp/status', {
  headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
})
  .then(r => r.json())
  .then(console.log);

// Debe mostrar objeto con qr.base64
```

**Causas:**

1. **JWT expirado:** Re-login
2. **CORS error:** Verificar headers en Network tab
3. **QR base64 malformado:** Debe empezar con `iVBORw0KGgoAAAA...`

**Código correcto para renderizar:**

```jsx
// React
{status.state === 'QR_REQUIRED' && status.qr && (
  <img 
    src={status.qr.base64} 
    alt="WhatsApp QR Code"
    style={{ width: 300, height: 300 }}
  />
)}

// O usando librería qrcode.react
{status.state === 'QR_REQUIRED' && status.qr && (
  <QRCode value={status.qr.url} size={300} />
)}
```

### 12.8 Múltiples Sesiones / Conflicto de Estados

**Síntoma:** Estado cambia eráticamente entre `READY` y `DISCONNECTED`.

**Causa:** Múltiples instancias de Session Manager corriendo.

**Diagnóstico:**

```bash
# Verificar cuántas instancias hay
pm2 list | grep session-manager

# Debe mostrar SOLO 1 instancia:
# │ session-manager │ 0    │ fork │ 12345  │ online │ 0       │ 2h   │

# Verificar procesos Node.js en puerto 3001
lsof -i:3001

# Debe mostrar SOLO 1 proceso
```

**Solución:**

```bash
# Detener TODAS las instancias
pm2 delete all

# Verificar que no queden procesos
lsof -i:3001  # No debe mostrar nada

# Si persiste, kill manual
lsof -ti:3001 | xargs kill -9

# Iniciar solo 1 instancia
cd /root/leadmaster-workspace/services/session-manager
pm2 start ecosystem.config.js

# Verificar
pm2 list
pm2 show session-manager  # restarts debe ser 0, instances debe ser 1
```

---

## 13. Referencias

**Archivos de configuración:**
- [Nginx config](../../infra/nginx/sites-available/desarrolloydisenioweb.com.ar.conf)
- [Session Manager index.js](../../services/session-manager/index.js)
- [Session Manager app.js](../../services/session-manager/app.js)
- [Session Manager routes/api.js](../../services/session-manager/routes/api.js)
- [Venom Session Manager](../../services/session-manager/whatsapp/venom-session.js)
- [Central Hub routes](../../services/central-hub/src/routes/)
- [Session Manager Client](../../services/central-hub/src/integrations/sessionManager/sessionManagerClient.js)
- [WhatsApp QR Proxy](../../services/central-hub/src/routes/whatsappQrProxy.js)
- [Admin WhatsApp Routes](../../services/central-hub/src/routes/adminWhatsapp.routes.js)

**Archivos PM2:**
- [Session Manager ecosystem.config.js](../../services/session-manager/ecosystem.config.js)
- [Central Hub ecosystem.config.js](../../services/central-hub/ecosystem.config.js)

**Documentación relacionada:**
- [WHATSAPP_PROXY_ARCHITECTURE.md](../../services/central-hub/docs/WHATSAPP_PROXY_ARCHITECTURE.md)
- [Integration-CentralHub-SessionManager.md](../04-INTEGRACION/Integration-CentralHub-SessionManager.md)
- [SESSION_MANAGER_API_CONTRACT.md](../../services/central-hub/docs/SESSION_MANAGER_API_CONTRACT.md)
- [PM2-SESSION-MANAGER-CANON-2026-02-25.md](PM2-SESSION-MANAGER-CANON-2026-02-25.md)
- [CONTRACT_IMPLEMENTATION_REPORT.md](../../services/central-hub/docs/CONTRACT_IMPLEMENTATION_REPORT.md)

**Documentación externa:**
- [Venom-bot Documentation](https://github.com/orkestral/venom)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/)
- [Nginx Reverse Proxy Guide](https://docs.nginx.com/nginx/admin-guide/web-server/reverse-proxy/)
- [Cloudflare SSL Documentation](https://developers.cloudflare.com/ssl/)

---

**FIN DEL REPORTE**

**Autor:** GitHub Copilot (Claude Sonnet 4.5)  
**Fecha:** 2026-02-25  
**Versión:** 2.0  
**Estado:** Documentación completa de arquitectura + gestión QR  
**Cambios v2.0:**
- ✅ Agregada sección 5.4: Gestión de QR Code (Implementación Actual)
- ✅ Actualizada sección 5.2: Endpoints con respuestas reales
- ✅ Expandida sección 7.3: Primera Autenticación (flujo completo)
- ✅ Agregada sección 12: Troubleshooting de QR (8 problemas comunes)
- ✅ Corregidas referencias a endpoints legacy (routes/qr.js no se usa)
- ✅ Agregado diagrama de flujo de autenticación
- ✅ Documentado formato de QR data structure
- ✅ Agregados comandos de testing manual

