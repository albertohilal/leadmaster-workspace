# Análisis de Archivos Frontend - Violaciones del Contrato

## INFORMACIÓN CRÍTICA DEL BACKEND

### Endpoints Reales (whatsappQrProxy.js)

```
Base Path: /api/whatsapp/:clienteId

GET /api/whatsapp/:clienteId/status
  → Retorna: { ok, session: { status, qr_status, qr_code?, error? } }
  → Estados posibles: 'init', 'qr_required', 'connecting', 'connected', 'disconnected', 'error'

GET /api/whatsapp/:clienteId/qr
  → Retorna: { ok, qr_string, qr_expires_at, status }
  → Errores: 403 (no autorizado), 404 (sesión no existe), 409 (ya conectado), 500 (error)
```

### Campos de Respuesta REALES

**Objeto Session (del backend)**:
```javascript
{
  status: 'connected' | 'qr_required' | 'connecting' | 'disconnected' | 'error' | 'init',
  qr_status: 'none' | 'generated' | 'expired' | 'used',
  qr_code: string | null,          // ❌ FRONTEND USA "qr_string" - INCORRECTO
  phone_number?: string,
  last_error_code?: string,
  last_error_message?: string
}
```

**Respuesta QR (del backend)**:
```javascript
{
  ok: true,
  qr_string: string,               // ✅ Campo correcto para imagen QR
  qr_expires_at: string,
  status: string
}
```

---

## ARCHIVOS QUE DEBEN MODIFICARSE

### 1. `frontend/src/constants/sessionStatus.js` (CREAR NUEVO)

**Razón**: NO EXISTE - Debe crearse para definir enums del contrato

**Problema**: Frontend no tiene una única fuente de verdad para estados

**Acción**:
- Crear enums oficiales: `SessionStatus`, `QRStatus`
- Exportar funciones PURAS de UI: `getStatusColor()`, `getStatusText()`, `getQRStatusText()`
- NO incluir lógica de negocio

---

### 2. `frontend/src/services/api.js` (MODIFICAR)

**Líneas problemáticas**:
```javascript
// Línea 38-41: ENDPOINTS LEGACY QUE NO EXISTEN
getStatus: () => api.get('/session-manager/status'),     // ❌ NO EXISTE
getState: () => api.get('/session-manager/state'),       // ❌ NO EXISTE
getQR: () => api.get('/session-manager/qr'),             // ❌ NO EXISTE
connect: () => api.post('/session-manager/login'),       // ❌ NO EXISTE
disconnect: () => api.post('/session-manager/logout'),   // ❌ NO EXISTE
```

**Endpoints REALES que deben usarse**:
```javascript
// ✅ CORRECTO - Alineado con whatsappQrProxy.js
getSession: (clienteId) => api.get(`/api/whatsapp/${clienteId}/status`),
requestQR: (clienteId) => api.post(`/api/whatsapp/${clienteId}/qr`)
```

**Violaciones**:
1. Llama a endpoints que NO están definidos en el backend
2. No recibe `clienteId` como parámetro (multi-tenant)
3. Usa nombres inventados (`getStatus`, `getState`, `getQR`)

**Acción**:
- Eliminar TODOS los métodos legacy
- Implementar `getSession(clienteId)` y `requestQR(clienteId)` ÚNICAMENTE
- Verificar si `disconnect()` existe en el backend antes de mantenerlo

---

### 3. `frontend/src/components/whatsapp/SessionManager.jsx` (REESCRIBIR)

**Violaciones CRÍTICAS**:

#### A. Estados Inventados (línea 11)
```javascript
const [sessionStatus, setSessionStatus] = useState('DISCONNECTED');
```
❌ INVENTA: `CONNECTED`, `DISCONNECTED`, `QR`, `ERROR`, `CHECKING`
✅ DEBE USAR: `session.status` directamente del backend

#### B. Mapeo de Estados (líneas 40-51)
```javascript
// MAPEO INVENTADO - PROHIBIDO
if (state === 'conectado') {
  setSessionStatus('CONNECTED');
} else if (state === 'conectando' || state === 'qr') {
  setSessionStatus('QR');
} else {
  setSessionStatus('DISCONNECTED');
}
```
❌ Traduce estados del backend a estados inventados
✅ DEBE USAR: `session.status` tal cual viene

#### C. Campo hasQR inventado (línea 46)
```javascript
if (stateRes.data.hasQR) {  // ❌ NO EXISTE EN EL CONTRATO
```
✅ DEBE USAR: `session.qr_status === QRStatus.GENERATED`

#### D. Endpoint legacy (línea 34)
```javascript
const stateRes = await sessionAPI.getState().catch(() => ({ data: {} }));
```
❌ Llama a `/session-manager/state` que NO EXISTE
✅ DEBE LLAMAR: `sessionAPI.getSession(clienteId)`

#### E. Confusión entre qr_string y qr_code
```javascript
// Backend retorna en /qr: qr_string (imagen base64)
// Backend retorna en /status: qr_code (puede ser null)
```
Frontend debe usar `qr_string` de la respuesta de `requestQR()`

**Acción**:
- Eliminar estado local `sessionStatus`
- Almacenar objeto `session` completo del backend
- Usar `switch (session.status)` con enums oficiales
- Usar `session.qr_status` en vez de `hasQR`
- Llamar a `getSession(clienteId)` en vez de `getState()`
- Usar `qr_string` de la respuesta de `requestQR()`

---

### 4. `frontend/src/components/dashboard/Dashboard.jsx` (MODIFICAR)

**Violaciones**:

#### A. Estado inventado (línea 10)
```javascript
whatsappStatus: 'CHECKING'  // ❌ NO EXISTE EN EL CONTRATO
```
✅ DEBE USAR: `null` mientras carga, luego `session.status` del backend

#### B. Endpoint legacy (línea 26)
```javascript
sessionAPI.getStatus().catch(() => ({ data: { status: 'ERROR' } }))
```
❌ Llama a `/session-manager/status` que NO EXISTE
✅ DEBE LLAMAR: `sessionAPI.getSession(clienteId)`

#### C. Mapeo en getStatusColor/getStatusText
```javascript
switch (status) {
  case 'CONNECTED':      // ❌ Usa estado inventado
  case 'DISCONNECTED':   // ❌ Usa estado inventado
```
✅ DEBE IMPORTAR: `getStatusColor(status)` y `getStatusText(status)` de `constants/sessionStatus.js`

**Acción**:
- Cambiar `whatsappStatus: 'CHECKING'` → `whatsappStatus: null`
- Llamar a `sessionAPI.getSession(clienteId)`
- Guardar `session.status` directamente
- Importar funciones UI desde `constants/sessionStatus.js`

---

### 5. `frontend/src/components/layout/Header.jsx` (MODIFICAR)

**Violaciones**:

#### A. Estado inventado (línea 6)
```javascript
const [connectionStatus, setConnectionStatus] = useState('CHECKING');
```
❌ INVENTA: `CHECKING`
✅ DEBE USAR: `null` mientras carga

#### B. Endpoint legacy (línea 18)
```javascript
const response = await sessionAPI.getStatus();
```
❌ Llama a `/session-manager/status` que NO EXISTE
✅ DEBE LLAMAR: `sessionAPI.getSession(clienteId)`

#### C. Mapeo en getStatusColor/getStatusText (líneas 27-50)
```javascript
switch (connectionStatus) {
  case 'CONNECTED':    // ❌ Usa estado inventado
```
✅ DEBE IMPORTAR: Funciones desde `constants/sessionStatus.js`

**Acción**:
- Cambiar `useState('CHECKING')` → `useState(null)`
- Llamar a `sessionAPI.getSession(clienteId)`
- Usar `response.data.session.status` directamente
- Importar funciones UI desde `constants/sessionStatus.js`

---

## RESUMEN DE VIOLACIONES POR TIPO

### 🔴 Estados Inventados
- `CONNECTED`, `DISCONNECTED`, `QR`, `ERROR`, `CHECKING`
- **Archivos**: SessionManager.jsx, Dashboard.jsx, Header.jsx
- **Solución**: Usar `session.status` del backend directamente

### 🔴 Endpoints Legacy (NO EXISTEN)
- `/session-manager/status`
- `/session-manager/state`
- `/session-manager/qr`
- `/session-manager/login`
- `/session-manager/logout`
- **Archivos**: api.js, SessionManager.jsx, Dashboard.jsx, Header.jsx
- **Solución**: Usar `/api/whatsapp/:clienteId/status` y `/api/whatsapp/:clienteId/qr`

### 🔴 Campos Inventados
- `hasQR` (no existe, debe usar `qr_status`)
- `state` (no existe, debe usar `status`)
- **Archivos**: SessionManager.jsx
- **Solución**: Usar `session.qr_status === 'generated'`

### 🔴 Mapeos de Estado
- Traducir 'conectado' → 'CONNECTED'
- Traducir 'desconectado' → 'DISCONNECTED'
- **Archivos**: SessionManager.jsx
- **Solución**: NO mapear, usar estados del backend verbatim

### 🔴 Funciones UI Duplicadas
- `getStatusColor()` y `getStatusText()` repetidas en 3 archivos
- **Archivos**: SessionManager.jsx, Dashboard.jsx, Header.jsx
- **Solución**: Centralizar en `constants/sessionStatus.js`

---

## CAMPOS CORRECTOS DEL BACKEND

### Response de GET /api/whatsapp/:clienteId/status
```javascript
{
  ok: true,
  session: {
    status: 'connected',           // ✅ Usar directamente
    qr_status: 'none',             // ✅ Usar directamente
    qr_code: null,                 // ✅ (puede estar presente en /status)
    phone_number: '+54...',
    last_error_code: null,
    last_error_message: null
  }
}
```

### Response de POST /api/whatsapp/:clienteId/qr
```javascript
{
  ok: true,
  qr_string: 'data:image/png;base64,...',  // ✅ Imagen QR en base64
  qr_expires_at: '2026-01-04T...',
  status: 'qr_required'
}
```

---

## ORDEN DE IMPLEMENTACIÓN

1. ✅ **Crear** `constants/sessionStatus.js` (enums oficiales)
2. ✅ **Refactorizar** `services/api.js` (eliminar legacy, agregar getSession/requestQR)
3. ✅ **Reescribir** `components/whatsapp/SessionManager.jsx` (react a session.status)
4. ✅ **Actualizar** `components/dashboard/Dashboard.jsx` (eliminar CHECKING)
5. ✅ **Actualizar** `components/layout/Header.jsx` (eliminar CHECKING)
6. ✅ **Verificar** con grep que no queden estados inventados
7. ✅ **Testing** manual del flujo completo

---

## STOP CONDITIONS (CONFLICTOS)

### ❌ Disconnect Endpoint
El backend NO expone un endpoint de desconexión en `whatsappQrProxy.js`.

**Opciones**:
1. Eliminar botón "Desconectar" del frontend
2. Verificar si existe endpoint en otro router
3. Solicitar implementación de endpoint de desconexión

### ❌ Connect/Login Endpoint
El backend NO expone un endpoint para "iniciar conexión".
La conexión se inicia automáticamente cuando se solicita el QR.

**Solución**: Eliminar `handleConnect()`, hacer que el botón llame directamente a `requestQR()`

### ❌ Session Info (name, phone, uptime)
El backend solo retorna `phone_number`, no retorna `name` ni `uptime`.

**Solución**: Mostrar solo los campos que el backend provee

---

## CONCLUSIÓN

**Total de archivos a modificar**: 5
- 1 nuevo: `constants/sessionStatus.js`
- 4 existentes: `api.js`, `SessionManager.jsx`, `Dashboard.jsx`, `Header.jsx`

**Violaciones críticas**:
- ❌ 5 endpoints legacy que NO existen
- ❌ 5 estados inventados en 3 componentes
- ❌ 2 campos inventados (`hasQR`, `state`)
- ❌ 1 confusión de nombres (`qr_code` vs `qr_string`)
- ❌ 3 implementaciones duplicadas de funciones UI

**Después de la migración**:
- ✅ Frontend consume EXACTAMENTE lo que backend provee
- ✅ CERO estados inventados
- ✅ CERO mapeos de estado
- ✅ CERO endpoints legacy
- ✅ Single source of truth para enums y funciones UI
