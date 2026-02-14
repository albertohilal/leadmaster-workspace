# Refactorización: Modelo de Sesión Única ADMIN

**Fecha:** 20 de enero de 2026  
**Autor:** GitHub Copilot  
**Objetivo:** Convertir session-manager a modelo de sesión única compartida

---

## 🎯 Cambios Implementados

### Arquitectura Anterior (Multi-Cliente)
```javascript
// ❌ Múltiples sesiones por cliente_id
const clientes = {
  "51": <VenomClient>,
  "52": <VenomClient>,
  "admin": <VenomClient>
}

// ❌ cliente_id creaba sesiones de WhatsApp
POST /connect { cliente_id: 51 }  → tokens/session-51/
```

### Arquitectura Nueva (Sesión Única)
```javascript
// ✅ UNA sola sesión admin
let adminClient = <VenomClient> | null;

// ✅ cliente_id es solo metadata (logging/billing)
POST /send { 
  cliente_id: 51,  // metadata
  to: "549...",
  message: "..."
}  → usa adminClient
```

---

## 📝 Archivos Modificados

### 1. `whatsapp/venom-session.js`

**Cambios principales:**
- ❌ Eliminado: `const clientes = {}`
- ❌ Eliminado: `const qrCodes = {}`
- ✅ Nuevo: `let adminClient = null`
- ✅ Nuevo: `let qrData = null`

**Funciones refactorizadas:**

```javascript
// ANTES
async function connect(clienteId) {
  const sessionName = `session-${clienteId}`;
  const client = await venom.create({ session: sessionName });
  clientes[clienteId] = client;
}

// DESPUÉS
async function connect() {
  if (adminClient) return adminClient;
  const client = await venom.create({ session: 'admin' });
  adminClient = client;
}
```

```javascript
// ANTES
async function sendMessage(clienteId, to, text) {
  const client = clientes[clienteId];
  if (!client) throw new Error('SESSION_NOT_READY');
  return client.sendText(destinatario, text);
}

// DESPUÉS
async function sendMessage(clienteId, to, text) {
  if (!adminClient) throw new Error('SESSION_NOT_READY');
  console.log(`Enviando via ADMIN: cliente_id=${clienteId} (metadata)`);
  return adminClient.sendText(destinatario, text);
}
```

```javascript
// ANTES
function isConnected(clienteId) {
  return !!clientes[clienteId];
}

// DESPUÉS
function isConnected() {
  return !!adminClient;
}
```

```javascript
// ANTES
function getState(clienteId) {
  if (clientes[clienteId]) {
    return { connected: true, state: 'READY', cliente_id };
  }
  // ...
}

// DESPUÉS
function getState() {
  if (adminClient) {
    return { connected: true, state: 'READY', session: 'admin' };
  }
  // ...
}
```

**Funciones eliminadas:**
- ❌ `getClient(clienteId)`
- ❌ `listSessions()`

---

### 2. `routes/api.js`

**Endpoint `/status`:**
```javascript
// ANTES
router.get('/status', (req, res) => {
  const { cliente_id } = req.query;
  if (!cliente_id) return res.status(400).json({ error: 'cliente_id is required' });
  const state = session.getState(cliente_id);
  res.json(state);
});

// DESPUÉS
router.get('/status', (req, res) => {
  const state = session.getState();
  res.json(state); // { connected: bool, state: 'READY'|'DISCONNECTED', session: 'admin' }
});
```

**Endpoint `/connect`:**
```javascript
// ANTES
router.post('/connect', async (req, res) => {
  const { cliente_id } = req.body;
  if (!cliente_id) return res.status(400).json({ error: 'required' });
  await session.connect(cliente_id);
  res.json({ success: true, cliente_id });
});

// DESPUÉS
router.post('/connect', async (req, res) => {
  await session.connect(); // sin parámetros
  res.json({ success: true, session: 'admin' });
});
```

**Endpoint `/send`:**
```javascript
// ANTES
if (!session.isConnected(cliente_id)) {
  return res.status(503).json({ code: 'SESSION_NOT_READY' });
}

// DESPUÉS
if (!session.isConnected()) { // sin parámetro
  return res.status(503).json({ 
    code: 'SESSION_NOT_READY',
    message: 'Admin WhatsApp session not ready'
  });
}
```

**Endpoints eliminados:**
- ❌ `GET /sessions`

---

### 3. `index.js`

```javascript
// ANTES
console.log('  SESSION MANAGER - Venom Bot');
console.log(`[Server] Status: http://localhost:${PORT}/status?cliente_id=51`);

// DESPUÉS
console.log('  SESSION MANAGER - Single Admin Session');
console.log(`[Server] Status: http://localhost:${PORT}/status`);
```

---

## 🔄 Flujo de Uso

### 1. Iniciar Sesión Admin (una sola vez)
```bash
curl -X POST http://localhost:3001/connect \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Connected",
  "state": "READY",
  "session": "admin"
}
```

### 2. Verificar Estado
```bash
curl http://localhost:3001/status
```

**Respuesta (conectado):**
```json
{
  "connected": true,
  "state": "READY",
  "session": "admin"
}
```

**Respuesta (desconectado):**
```json
{
  "connected": false,
  "state": "DISCONNECTED",
  "session": "admin"
}
```

### 3. Enviar Mensaje (cualquier cliente_id)
```bash
curl -X POST http://localhost:3001/send \
  -H "Content-Type: application/json" \
  -d '{
    "cliente_id": 51,
    "to": "5491158254201",
    "message": "Mensaje desde admin session"
  }'
```

**Logs:**
```
[VenomSession] Enviando via ADMIN: cliente_id=51 (metadata), to=5491158254201@c.us
✅ [VenomSession] Mensaje enviado exitosamente a 5491158254201@c.us
```

**Notar:**
- `cliente_id=51` es solo metadata
- NO se crea `tokens/session-51/`
- Se usa `adminClient` único

---

## 📂 Estructura de Tokens

### Antes
```
tokens/
├── session-51/
│   ├── Default/
│   └── SingletonLock
├── session-52/
│   ├── Default/
│   └── SingletonLock
└── admin/
    ├── Default/
    └── SingletonLock
```

### Después
```
tokens/
└── admin/          ← ÚNICA sesión
    ├── Default/
    └── SingletonLock
```

---

## ✅ Ventajas del Nuevo Modelo

1. **Simplicidad:** Una sola sesión de WhatsApp para todo el sistema
2. **Estabilidad:** No hay múltiples conexiones concurrentes
3. **Mantenibilidad:** Menos código, menos bugs
4. **Escalabilidad:** Todos los clientes usan la misma conexión estable
5. **Claridad:** `cliente_id` es metadata, no crea sesiones

---

## 🔍 Validación

### Sesión Única
```bash
# Iniciar admin
curl -X POST http://localhost:3001/connect -H "Content-Type: application/json" -d '{}'

# Verificar tokens
ls tokens/
# Resultado: admin (solo uno)

# Enviar desde cliente 51
curl -X POST http://localhost:3001/send -H "Content-Type: application/json" -d '{
  "cliente_id": 51,
  "to": "549...",
  "message": "Test cliente 51"
}'

# Enviar desde cliente 52
curl -X POST http://localhost:3001/send -H "Content-Type: application/json" -d '{
  "cliente_id": 52,
  "to": "549...",
  "message": "Test cliente 52"
}'

# Verificar tokens nuevamente
ls tokens/
# Resultado: admin (TODAVÍA solo uno)
```

### Logs Esperados
```
[VenomSession] Iniciando conexión ADMIN
[VenomSession] Estado ADMIN: initBrowser
[VenomSession] Estado ADMIN: openBrowser
[VenomSession] QR generado para sesión ADMIN (intento 1)
✅ [VenomSession] Sesión ADMIN conectada y READY
[VenomSession] Enviando via ADMIN: cliente_id=51 (metadata), to=549...
✅ [VenomSession] Mensaje enviado exitosamente
[VenomSession] Enviando via ADMIN: cliente_id=52 (metadata), to=549...
✅ [VenomSession] Mensaje enviado exitosamente
```

---

## 🚨 Importante

### cliente_id es SOLO metadata
- ✅ Se usa para logging
- ✅ Se usa para billing
- ✅ Se incluye en respuestas
- ❌ NO crea sesiones de WhatsApp
- ❌ NO genera tokens/
- ❌ NO valida conexión por cliente

### Una Sola Sesión WhatsApp
- Solo existe `adminClient`
- Solo existe `tokens/admin/`
- Todos los mensajes pasan por la misma conexión
- QR se genera UNA vez

---

## 🎯 Resultado

**Sistema simplificado con:**
- 1 sesión de WhatsApp (admin)
- N clientes usando esa sesión
- `cliente_id` como metadata transparente
- Lógica predecible y mantenible

**Status:** ✅ Implementado y funcionando  
**Riesgo:** Bajo (backup disponible en session-manager-backup-*)
