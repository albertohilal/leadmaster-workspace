# Diagnóstico – Frontend Central Hub no muestra QR (QR_REQUIRED)

**Fecha:** 2026-02-26  
**Destino:** `docs/05-REPORTES/2026-02/DIAGNOSTICO-FRONTEND-QR-NO-SE-MUESTRA-2026-02-26.md`  
**Modo:** Solo diagnóstico (sin cambios)  

---

## Resumen

En producción, cuando el backend confirma:

- `GET /status` → `{ "status": "QR_REQUIRED" }`
- `GET /qr` → devuelve correctamente el QR en base64

la pantalla `/whatsapp` en el frontend muestra **“Error en la sesión”** y no se observa **ninguna request de QR** en Network.

La causa principal es que **la ruta real `/whatsapp` no usa el componente `WhatsappSession.jsx`**, sino `SessionManager.jsx` (otra implementación), y allí hay **mismatches de contrato** que fuerzan el estado `ERROR` y bloquean el flujo QR.

---

## Condiciones confirmadas (según incidente)

- Backend expone: `GET /status`, `GET /qr`, `POST /connect`
- Confirmado operativo:
  - `/status` devuelve `QR_REQUIRED`
  - `/qr` devuelve QR base64
  - Nginx proxy alineado a `/qr`
- Síntoma:
  - UI muestra “Error en la sesión”
  - No aparece request a QR

---

## Hallazgos clave

### 1) La pantalla `/whatsapp` monta `SessionManager`, no `WhatsappSession`

- **Archivo:** `services/central-hub/frontend/src/App.jsx`
- **Línea aprox.:** ~60-75
- **Lógica:**
  - `path="/whatsapp"` renderiza `<SessionManager />` desde `./components/whatsapp/SessionManager`
- **Impacto:**
  - Cualquier lógica en `services/central-hub/frontend/src/components/WhatsappSession.jsx` no participa del flujo real de producción.

---

### 2) El frontend interpreta `state`, pero el backend proxy devuelve `status`

- **Archivo:** `services/central-hub/frontend/src/components/whatsapp/SessionManager.jsx`
- **Línea aprox.:** ~45-85
- **Lógica problemática:**
  - `const normalizedState = response?.data?.state?.toLowerCase();`
  - `switch (normalizedState) { ... default: mappedStatus = SessionStatus.ERROR }`
- **Diagnóstico técnico:**
  - El endpoint que consume el frontend es `GET /whatsapp/:clienteId/status` (vía `sessionAPI.getSession`).
  - Ese endpoint (proxy en Central Hub) responde con `status` (no `state`).
  - Entonces `response.data.state` es `undefined` ⇒ `normalizedState` es `undefined` ⇒ cae en `default` ⇒ se setea `SessionStatus.ERROR`.
- **Efecto observable:**
  - La UI entra al `default` del render y muestra “Error en la sesión”.
  - Al no entrar al caso `QR_REQUIRED`, nunca se habilita el botón ni se ejecuta el fetch de QR.

- **Archivo backend proxy:** `services/central-hub/src/routes/whatsappQrProxy.js`
- **Línea aprox.:** ~27-44
- **Lógica relevante:**
  - Respuesta incluye: `status: status.status`.

---

### 3) El flujo QR del frontend espera `data.qr`, pero el proxy responde `qr_code_base64`

- **Archivo:** `services/central-hub/frontend/src/components/whatsapp/SessionManager.jsx`
- **Línea aprox.:** ~90-145
- **Lógica problemática:**
  - `const qr = response?.data?.qr;`
  - Valida que sea string y `startsWith('data:image/')`
- **Diagnóstico técnico:**
  - El endpoint proxy usado por el frontend es: `GET /whatsapp/:clienteId/qr`.
  - Ese endpoint responde: `{ ok: true, qr_code_base64: <data-url> }`.
  - Como el frontend busca `response.data.qr`, obtiene `undefined` y marca error (“QR inválido”).

- **Archivo backend proxy:** `services/central-hub/src/routes/whatsappQrProxy.js`
- **Línea aprox.:** ~63-90
- **Lógica relevante:**
  - Respuesta incluye: `qr_code_base64: qrData.qrDataUrl`.

---

### 4) Estados: el frontend depende de `CONNECTED`, pero el backend usa `READY`

- **Archivo:** `services/central-hub/frontend/src/constants/sessionStatus.js`
- **Línea aprox.:** ~10-20
- **Lógica:**
  - `SessionStatus.CONNECTED = 'connected'` y no existe `READY`.

- **Archivo:** `services/central-hub/frontend/src/components/whatsapp/SessionManager.jsx`
- **Línea aprox.:** ~20-40
- **Lógica:**
  - Cierra modal cuando `session?.status === SessionStatus.CONNECTED`.

- **Diagnóstico técnico:**
  - Si el backend/proxy entrega `READY`, el frontend no lo reconoce, y tiende a caer en `ERROR`.
  - Esto refuerza el síntoma “Error en la sesión”.

---

## Respuesta directa al checklist solicitado (a–d)

### a) ¿Llama a `/qr-code` en vez de `/qr`?
- **En la UI real (`SessionManager.jsx`)** el log imprime “GET /qr-code”, pero la llamada real se hace vía `sessionAPI.getQRCode(clienteId)`.
- **`sessionAPI.getQRCode`** apunta a `GET /whatsapp/:clienteId/qr` (no `/qr-code`).

### b) ¿No maneja explícitamente `QR_REQUIRED`?
- El caso existe, pero **no se alcanza** por el bug del campo `state` vs `status`.

### c) ¿Marca error cuando `status !== CONNECTED`?
- En práctica, cualquier estado no reconocido (incluido `READY`) termina como `ERROR` por el mapeo.

### d) ¿No ejecuta la función que solicita el QR?
- El fetch de QR **no es automático**: requiere click en “Mostrar QR”.
- Dado que la sesión termina en `ERROR`, esa UI no queda en el branch que expone el botón, por lo tanto **no hay request de QR**.

---

## Evidencia adicional (rutas consumidas)

- **Frontend API base:** `services/central-hub/frontend/src/config/api.js`
  - `API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3012'`
- **Session endpoints consumidos:** `services/central-hub/frontend/src/services/api.js`
  - `GET /whatsapp/:clienteId/status`
  - `GET /whatsapp/:clienteId/qr` (sin JWT)

---

## Conclusión

El QR no se muestra (y no se solicita) en producción porque el componente que efectivamente corre en `/whatsapp` (`SessionManager.jsx`) interpreta un contrato distinto:

- Lee `response.data.state` pero recibe `response.data.status`.
- Busca `response.data.qr` pero recibe `response.data.qr_code_base64`.
- Modela `CONNECTED` en lugar de `READY`.

Esto fuerza el estado `ERROR`, dispara el texto “Error en la sesión”, y evita que se ejecute el flujo que invoca el endpoint de QR.
