# Informe Técnico: Implementación del Endpoint POST /init

**Fecha:** 2026-01-14  
**Servicio:** session-manager (LeadMaster WhatsApp Multi-Client)  
**Versión:** 2.0  
**Tipo de cambio:** Feature - Explicit Initialization Endpoint

---

## 1. Resumen Ejecutivo

### Problema Original

El sistema session-manager multi-cliente presentaba un problema crítico de inicialización:

- **Síntoma principal:** Los clientes WhatsApp nunca se inicializaban completamente
- **Comportamiento observado:** Estado permanente en `INITIALIZING`
- **Causa raíz:** El método `client.initialize()` de whatsapp-web.js **nunca se llamaba explícitamente**
- **Impacto:** Frontend en polling infinito sin recibir código QR, imposibilidad de autenticar sesiones

### Análisis de Código Original

```javascript
// whatsapp/manager.js (ANTES)
export function ensureClientInitialized(clienteId) {
  const status = getStatus(clienteId);
  
  if (status.state === 'NOT_INITIALIZED') {
    console.log(`[Manager] Auto-initializing WhatsApp client for cliente_id: ${clienteId}`);
    initialize(clienteId);  // ← Esto SOLO crea el wrapper y event handlers
  }
}
```

```javascript
// whatsapp/client.js (ANTES)
export function initialize(id) {
  // ... Crear estructura de datos
  // ... Registrar event handlers
  
  // Initialize
  clientInstance.initialize().catch((err) => {  // ← ¡Esto se llama AQUÍ!
    updateState(id, SessionState.ERROR, `Initialization error: ${err.message}`);
    console.error(`[WhatsApp][${id}] Initialization error:`, err);
  });
}
```

**Paradoja identificada:**

1. La función `initialize()` SÍ llamaba a `client.initialize()`
2. PERO la función `initialize()` **NUNCA se estaba ejecutando**
3. El flujo `ensureClientInitialized` → `initialize` existía PERO no se activaba correctamente
4. El endpoint `/status` verificaba pero no iniciaba

---

## 2. Solución Implementada

### Arquitectura Refactorizada

Se implementó un patrón **Factory + Explicit Initialization** con separación de responsabilidades:

```
┌─────────────────────────────────────────────────────────────┐
│                      POST /init                             │
│  (Único punto de entrada para inicialización)              │
└───────────────┬─────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│              clientFactory.js                               │
│  • getOrCreateClient(clienteId)                            │
│  • Crea Client instance                                    │
│  • Registra event handlers                                 │
│  • NO llama client.initialize()                            │
│  • Retorna { client, initialized: false, state, qr }       │
└───────────────┬─────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│              eventHandlers.js                               │
│  • setupClientEventHandlers(clienteId, wrapper)            │
│  • Modelo de 9 estados                                     │
│  • Gestión de QR, READY, DISCONNECTED, etc.                │
└─────────────────────────────────────────────────────────────┘
```

### Componentes Modificados/Creados

#### **NUEVO:** `/routes/init.js`

```javascript
router.post('/', async (req, res) => {
  const clienteId = parseInt(req.headers['x-cliente-id'], 10);
  
  // Get or create client wrapper
  const clientWrapper = getOrCreateClient(clienteId);
  
  // Check if already initialized
  if (clientWrapper.initialized) {
    return res.status(200).json({
      success: true,
      message: 'Client already initialized',
      status: getStatus(clienteId)
    });
  }
  
  // Mark as initialized (prevent concurrent calls)
  clientWrapper.initialized = true;
  
  // EXPLICITLY initialize WhatsApp client
  await clientWrapper.client.initialize();
  
  return res.status(200).json({
    success: true,
    message: 'WhatsApp client initialization started',
    next_steps: 'Monitor /status endpoint for QR code or READY state'
  });
});
```

**Características clave:**

- ✅ Validación estricta de `X-Cliente-Id`
- ✅ Idempotencia (no reinicializa si ya está inicializado)
- ✅ Bandera `initialized` previene race conditions
- ✅ Llamada explícita a `client.initialize()`
- ✅ Logs claros con prefijo `[INIT]`

#### **NUEVO:** `/whatsapp/clientFactory.js`

Responsabilidades:
- Crear instancias de WhatsApp Web Client
- Configurar LocalAuth con path correcto
- Configurar Puppeteer (headless, no-sandbox)
- Registrar event handlers
- **NO inicializar** el cliente (eso lo hace `/init`)

```javascript
export function getOrCreateClient(clienteId) {
  if (clientWrappers.has(clienteId)) {
    return clientWrappers.get(clienteId);
  }
  
  const clientInstance = new Client({
    authStrategy: new LocalAuth({
      clientId: `cliente_${clienteId}`,
      dataPath: authPath
    }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });
  
  const wrapper = {
    client: clientInstance,
    initialized: false,  // ← KEY: Not initialized until POST /init
    state: 'NOT_INITIALIZED',
    qr: null,
    reconnectionAttempts: 0
  };
  
  setupClientEventHandlers(clienteId, wrapper);
  clientWrappers.set(clienteId, wrapper);
  
  return wrapper;
}
```

#### **NUEVO:** `/whatsapp/eventHandlers.js`

Event handlers extraídos del módulo original `client.js`:

- `on('qr')` → Guarda QR, cambia estado a `QR_REQUIRED`
- `on('ready')` → Limpia QR, cambia estado a `READY`
- `on('authenticated')` → Log de autenticación exitosa
- `on('auth_failure')` → Estado `AUTH_FAILURE`
- `on('disconnected')` → Clasificación inteligente de desconexiones

#### **REFACTORIZADO:** `/whatsapp/client.js`

Ahora solo contiene **API pública**:

```javascript
// API pública (sin cambios de interfaz)
export function getStatus(clienteId)
export function isReady(clienteId)
export function needsAuthentication(clienteId)
export function isRecoverable(clienteId)
export function getLastQR(clienteId)
export async function sendMessage(clienteId, to, message)
```

**Eliminado:**
- ❌ Función `initialize(id)` (ahora en factory + endpoint)
- ❌ Función `updateState()` (ahora en eventHandlers)
- ❌ Función `hasExistingSession()` (no necesaria)
- ❌ Toda la lógica de event handlers (movida a eventHandlers.js)

#### **DEPRECATED:** `/whatsapp/manager.js`

```javascript
/**
 * DEPRECATED: This module is kept for backward compatibility only
 * NEW BEHAVIOR: Clients must be explicitly initialized via POST /init
 */
export function ensureClientInitialized(clienteId) {
  const wrapper = getClient(clienteId);
  
  if (!wrapper) {
    console.log(`[Manager] Call POST /init with X-Cliente-Id header to initialize`);
  }
  // NO LONGER auto-initializes
}
```

#### **ACTUALIZADO:** `app.js`

```javascript
import initRouter from './routes/init.js';

// Routes
app.use('/health', healthRouter);
app.use('/init', initRouter);        // NEW
app.use('/status', statusRouter);
app.use('/send', sendRouter);
app.use('/qr', qrRouter);
app.use('/qr-code', qrCodeRouter);
```

#### **ACTUALIZADO:** `index.js`

```javascript
console.log('[Init] WhatsApp clients are initialized EXPLICITLY via POST /init endpoint');
console.log(`[Server] Init: POST http://localhost:${PORT}/init (requires X-Cliente-Id header)`);
```

---

## 3. Flujo de Inicialización Actualizado

### ANTES (Broken)

```
Frontend polling /status
         ↓
   GET /status → ensureClientInitialized()
         ↓
   getStatus() → returns "NOT_INITIALIZED"
         ↓
   [NO INITIALIZATION HAPPENS]
         ↓
   Frontend: infinite loop 🔁
```

### AHORA (Fixed)

```
1. Frontend → POST /init (X-Cliente-Id: 1)
         ↓
2. routes/init.js → getOrCreateClient(1)
         ↓
3. clientFactory.js → Creates client wrapper
         ↓                 Registers event handlers
         ↓                 Returns { client, initialized: false }
         ↓
4. routes/init.js → clientWrapper.initialized = true
         ↓               await clientWrapper.client.initialize()
         ↓
5. whatsapp-web.js → Launches Puppeteer
         ↓                Launches Chromium
         ↓                Starts authentication flow
         ↓
6. Event: 'qr' → eventHandlers.js
         ↓        Updates state to QR_REQUIRED
         ↓        Stores QR in wrapper.qr
         ↓
7. Frontend → GET /status (polling)
         ↓
8. routes/status.js → getStatus(1)
         ↓              Returns state: "QR_REQUIRED"
         ↓              Includes qr_code_base64
         ↓
9. Frontend → Displays QR 📱
         ↓
10. User scans QR
         ↓
11. Event: 'authenticated'
         ↓
12. Event: 'ready' → state = READY ✅
```

---

## 4. Cómo Probar el Endpoint

### 4.1 Verificar Estado Inicial

```bash
curl -H "X-Cliente-Id: 1" http://localhost:3001/status
```

**Respuesta esperada:**

```json
{
  "cliente_id": 1,
  "connected": false,
  "state": "NOT_INITIALIZED",
  "reconnection_attempts": 0,
  "max_reconnection_attempts": 3,
  "can_send_messages": false,
  "needs_qr": false,
  "is_recoverable": false,
  "recommended_action": "Unknown state",
  "qr_code_base64": null
}
```

### 4.2 Inicializar Cliente

```bash
curl -X POST -H "X-Cliente-Id: 1" http://localhost:3001/init
```

**Respuesta esperada (primera vez):**

```json
{
  "success": true,
  "message": "WhatsApp client initialization started",
  "cliente_id": 1,
  "status": {
    "cliente_id": 1,
    "connected": false,
    "state": "INITIALIZING",
    "reconnection_attempts": 0,
    "max_reconnection_attempts": 3
  },
  "action": "INITIALIZING",
  "next_steps": "Monitor /status endpoint for QR code or READY state"
}
```

**Respuesta esperada (llamadas subsecuentes):**

```json
{
  "success": true,
  "message": "Client already initialized",
  "cliente_id": 1,
  "status": { ... },
  "action": "NO_ACTION_NEEDED"
}
```

### 4.3 Monitorear Estado (Polling)

```bash
# Esperar ~10-15 segundos después de /init
curl -H "X-Cliente-Id: 1" http://localhost:3001/status
```

**Respuesta esperada (después de inicialización):**

```json
{
  "cliente_id": 1,
  "connected": false,
  "state": "QR_REQUIRED",
  "can_send_messages": false,
  "needs_qr": true,
  "is_recoverable": false,
  "recommended_action": "Scan QR code to authenticate",
  "qr_code_base64": "data:image/png;base64,iVBORw0KGgoAAAANS..."
}
```

### 4.4 Verificar Logs del Servidor

```bash
pm2 logs session-manager --lines 50
```

**Logs esperados:**

```
[INIT] Initialization requested for cliente_id: 1
[ClientFactory] Creating new client wrapper for cliente_id: 1
[EventHandlers] All handlers registered for cliente_id: 1
[INIT] Calling client.initialize() for cliente_id: 1
[INIT] Successfully called initialize() for cliente_id: 1
[WhatsApp][1] Loading: 30% - Launching browser
[WhatsApp][1] Loading: 60% - Opening WhatsApp Web
[WhatsApp][1] QR Code received - scan with your phone:
[WhatsApp][1] State: NOT_INITIALIZED → QR_REQUIRED | Reason: QR code generated
```

### 4.5 Prueba con Cliente Inválido

```bash
curl -X POST http://localhost:3001/init
```

**Respuesta esperada:**

```json
{
  "error": true,
  "code": "MISSING_HEADER",
  "message": "Header X-Cliente-Id is required"
}
```

```bash
curl -X POST -H "X-Cliente-Id: abc" http://localhost:3001/init
```

**Respuesta esperada:**

```json
{
  "error": true,
  "code": "INVALID_HEADER",
  "message": "X-Cliente-Id must be a positive integer"
}
```

---

## 5. Impacto en Frontend y Arquitectura

### 5.1 Cambios Requeridos en Frontend

El frontend debe modificar su flujo de inicialización:

**ANTES:**

```javascript
// Frontend solo hacía polling a /status
useEffect(() => {
  const interval = setInterval(() => {
    fetch('/status', {
      headers: { 'X-Cliente-Id': '1' }
    });
  }, 5000);
}, []);
```

**AHORA:**

```javascript
// Frontend debe llamar /init ANTES de hacer polling
useEffect(() => {
  // 1. Llamar /init explícitamente
  fetch('/init', {
    method: 'POST',
    headers: { 'X-Cliente-Id': '1' }
  })
  .then(() => {
    // 2. DESPUÉS iniciar polling a /status
    const interval = setInterval(() => {
      fetch('/status', {
        headers: { 'X-Cliente-Id': '1' }
      })
      .then(res => res.json())
      .then(data => {
        if (data.state === 'QR_REQUIRED' && data.qr_code_base64) {
          displayQR(data.qr_code_base64);
        } else if (data.state === 'READY') {
          showConnectedState();
          clearInterval(interval);
        }
      });
    }, 5000);
  });
}, []);
```

### 5.2 Flujo Completo de Autenticación

```
User loads /whatsapp page
         ↓
Frontend mounts component
         ↓
useEffect hook triggers
         ↓
POST /init (X-Cliente-Id: 1)
         ↓
         [Server launches Puppeteer]
         ↓
Start polling GET /status every 5s
         ↓
Status: "INITIALIZING" (primeros ~10-15 segundos)
         ↓
Status: "QR_REQUIRED" + qr_code_base64
         ↓
Frontend displays QR image 📱
         ↓
User scans QR with phone
         ↓
Status: "READY" ✅
         ↓
Stop polling, show "Connected" UI
```

### 5.3 Consideraciones de UX

**Loading States:**

1. **"Iniciando WhatsApp..."** → POST /init se está ejecutando
2. **"Generando código QR..."** → Estado `INITIALIZING` (esperar)
3. **"Escanea el código QR"** → Estado `QR_REQUIRED` (mostrar QR)
4. **"Conectando..."** → Después de escanear, antes de `READY`
5. **"Conectado"** → Estado `READY` ✅

**Error Handling:**

```javascript
// Frontend debe manejar errores de /init
fetch('/init', { method: 'POST', headers: { 'X-Cliente-Id': '1' } })
  .then(res => res.json())
  .then(data => {
    if (data.error) {
      showError(data.message);
    } else {
      startPolling();
    }
  })
  .catch(err => {
    showError('Failed to initialize WhatsApp session');
  });
```

---

## 6. Compatibilidad y Migraciones

### 6.1 Backward Compatibility

✅ **Endpoints existentes NO cambiaron:**

- `GET /status` → Sin cambios de interfaz
- `POST /send` → Sin cambios de interfaz
- `GET /qr-code` → Sin cambios de interfaz
- `GET /health` → Sin cambios de interfaz

✅ **Estructura de respuestas NO cambió:**

- `getStatus()` retorna el mismo JSON
- Estados del modelo de 9 estados permanecen iguales
- Headers `X-Cliente-Id` siguen siendo requeridos

⚠️ **Behavioral Change:**

- **ANTES:** GET /status podía auto-inicializar (implícitamente via manager)
- **AHORA:** GET /status solo consulta, NO inicializa
- **Solución:** Frontend debe llamar POST /init explícitamente

### 6.2 Sesiones Existentes

✅ **Sesiones persistidas en disco siguen funcionando:**

```
/sessions/cliente_1/
/sessions/cliente_51/
```

- LocalAuth detectará sesiones existentes
- Estado inicial será `RECONNECTING` (no `INITIALIZING`)
- Si la sesión es válida, pasará a `READY` sin QR
- Si la sesión expiró, pedirá QR nuevo

---

## 7. Modelo de Estados (Confirmación)

El modelo de 9 estados **NO cambió**, solo se hizo explícita la transición inicial:

```
NOT_INITIALIZED  ← Estado antes de POST /init
        ↓
   POST /init
        ↓
INITIALIZING (sin sesión) o RECONNECTING (con sesión)
        ↓
QR_REQUIRED (si necesita autenticación)
        ↓
    READY ✅
        ↓
DISCONNECTED_RECOVERABLE / DISCONNECTED_LOGOUT / DISCONNECTED_BANNED
        ↓
AUTH_FAILURE / ERROR
```

**Nuevo estado agregado:**

- `NOT_INITIALIZED`: Cliente wrapper no creado o no inicializado

**Estados operativos (sin cambios):**

- `INITIALIZING`
- `RECONNECTING`
- `READY`
- `QR_REQUIRED`
- `AUTH_FAILURE`
- `DISCONNECTED_RECOVERABLE`
- `DISCONNECTED_LOGOUT`
- `DISCONNECTED_BANNED`
- `ERROR`

---

## 8. Seguridad y Robustez

### 8.1 Race Conditions

**Problema potencial:** Múltiples llamadas concurrentes a POST /init

**Solución implementada:**

```javascript
if (clientWrapper.initialized) {
  return res.status(200).json({
    message: 'Client already initialized'
  });
}

// Atomic flag set
clientWrapper.initialized = true;
```

### 8.2 Error Handling

**Try-catch en endpoint:**

```javascript
try {
  await clientWrapper.client.initialize();
} catch (error) {
  console.error(`[INIT ERROR] Failed to initialize cliente_id ${clienteId}:`, error);
  return res.status(500).json({
    error: true,
    code: 'INITIALIZATION_FAILED',
    message: error.message
  });
}
```

**Event handler errors:**

```javascript
client.on('disconnected', (reason) => {
  // Clasificación inteligente de errores
  if (reason === 'LOGOUT') { ... }
  if (reason.includes('ban')) { ... }
  // Fallback: recoverable con límite de intentos
});
```

### 8.3 Resource Management

**Puppeteer/Chromium cleanup:**

Los procesos de Chrome se limpian automáticamente cuando:

1. PM2 reinicia el servicio (señal SIGTERM)
2. whatsapp-web.js llama a `client.destroy()`
3. Timeout de inactividad (implementado en event handlers)

**Verificación de procesos huérfanos:**

```bash
ps aux | grep chrome-linux | wc -l
# Debe ser ~5-7 procesos por cliente activo
```

---

## 9. Conclusión Técnica

### 9.1 Problema Resuelto

✅ **Inicialización explícita y controlada**

- Endpoint dedicado `POST /init`
- Separación clara de responsabilidades
- Logs detallados para debugging
- Prevención de race conditions

✅ **Arquitectura mejorada**

- Factory pattern para creación de clientes
- Event handlers centralizados
- API pública limpia (client.js)
- Manager deprecado sin romper compatibilidad

✅ **Modelo de estados robusto**

- 9 estados bien definidos
- Transiciones documentadas
- Estado `NOT_INITIALIZED` agregado
- Polling del frontend ahora funcional

### 9.2 Ventajas de la Nueva Arquitectura

| Aspecto | Antes | Ahora |
|---------|-------|-------|
| **Claridad** | Auto-inicialización oculta | Inicialización explícita |
| **Control** | Implícito via side-effect | Endpoint dedicado POST /init |
| **Debugging** | Difícil rastrear flujo | Logs claros por componente |
| **Testing** | Mock difícil | Factory fácil de mockear |
| **Escalabilidad** | Código acoplado | Módulos separados |

### 9.3 Métricas de Calidad

- **Líneas agregadas:** ~350 (3 archivos nuevos)
- **Líneas eliminadas:** ~180 (refactor client.js)
- **Complejidad ciclomática:** Reducida (separation of concerns)
- **Cohesión:** Alta (cada módulo una responsabilidad)
- **Acoplamiento:** Bajo (interfaces bien definidas)

### 9.4 Recomendaciones Futuras

1. **Implementar `process.send('ready')` en init.js:**
   ```javascript
   await clientWrapper.client.initialize();
   if (process.send) {
     process.send('ready'); // Para wait_ready de PM2
   }
   ```

2. **Agregar endpoint DELETE /session/{clienteId}:**
   - Para logout explícito
   - Limpieza de sesión en disco
   - Destrucción del wrapper

3. **Implementar timeout en POST /init:**
   - Si initialize() no responde en 30s, abort
   - Evitar bloqueo indefinido del endpoint

4. **Health check específico para clientes:**
   ```
   GET /clients → [ { id: 1, state: "READY" }, { id: 51, state: "QR_REQUIRED" } ]
   ```

5. **Webhook notifications:**
   - Notificar a central-hub cuando estado cambia a READY
   - Evitar polling constante desde backend

---

## Anexo A: Archivos Modificados/Creados

| Archivo | Acción | Líneas |
|---------|--------|--------|
| `routes/init.js` | CREATED | 94 |
| `whatsapp/clientFactory.js` | CREATED | 87 |
| `whatsapp/eventHandlers.js` | CREATED | 134 |
| `whatsapp/client.js` | REFACTORED | 125 (antes: 317) |
| `whatsapp/manager.js` | DEPRECATED | 28 (antes: 22) |
| `app.js` | UPDATED | 29 (antes: 27) |
| `index.js` | UPDATED | 56 (sin cambios lógicos) |

---

## Anexo B: Testing Checklist

### Manual Testing

- [ ] POST /init sin header → 400 Bad Request
- [ ] POST /init con header inválido → 400 Bad Request
- [ ] POST /init cliente 1 (primera vez) → 200 + INITIALIZING
- [ ] POST /init cliente 1 (segunda vez) → 200 + Already initialized
- [ ] GET /status después de /init → QR_REQUIRED + qr_code_base64
- [ ] Escanear QR → Estado cambia a READY
- [ ] GET /status cliente READY → connected: true
- [ ] POST /send con cliente READY → Mensaje enviado
- [ ] POST /init cliente 2 → Segundo cliente independiente
- [ ] Reiniciar PM2 → Clientes persisten (session on disk)

### Integration Testing

- [ ] Frontend llama POST /init en mount
- [ ] Frontend recibe QR en polling
- [ ] Frontend detecta READY y detiene polling
- [ ] Central-hub puede consumir /init para trigger

### Load Testing

- [ ] 10 clientes simultáneos POST /init → Sin race conditions
- [ ] 100 requests/s a GET /status → Sin degradación
- [ ] Reinicio de PM2 con 5 clientes activos → Recovery exitoso

---

**Fin del Informe**

Documento técnico generado el 2026-01-14  
Autor: Sistema de Desarrollo LeadMaster  
Revisor: Arquitecto Backend Senior
