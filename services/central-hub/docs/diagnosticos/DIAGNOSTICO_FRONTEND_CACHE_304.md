# DIAGNÓSTICO FRONTEND: UI Muestra Error Cuando Backend está READY

**Fecha**: 2026-01-13  
**Sistema**: Frontend React + Axios + Backend Node.js/Express  
**Severidad**: 🟡 MEDIA (Frontend no sincroniza con estado real del backend)

---

## 🎯 PROMPT ORIGINAL (Enviado a Copilot)

> **Contexto:**
> Tenemos un frontend web que consulta periódicamente un endpoint `/status` para reflejar el estado de una sesión de WhatsApp.
>
> **Síntoma:**
>
> * El backend devuelve correctamente `state: "READY"` y `connected: true`.
> * Al consultar el endpoint manualmente con `curl`, el estado es correcto.
> * En el frontend, la UI sigue mostrando "Error en la sesión".
> * En DevTools → Network, las solicitudes a `/status` responden con **HTTP 304 (Not Modified)** de forma repetida.
> * El frontend no actualiza el estado visual aunque el backend ya esté listo.
>
> **Pedido:**
> Analizá el código del frontend que realiza la llamada a `/status` y determiná:
>
> 1. Si la respuesta del endpoint puede estar siendo cacheada por el navegador o por la lógica del fetch/axios.
> 2. Si hay algún manejo incorrecto de estado (flags de error que no se limpian).
> 3. Si el uso de `fetch`, `axios`, headers HTTP o configuración de polling puede explicar que el frontend no reciba el JSON actualizado.
> 4. Qué evidencias del código confirman o descartan un problema de caché o revalidación (ETag / 304).
>
> **Objetivo:**
> Emitir un diagnóstico técnico claro (sin proponer todavía la solución final) sobre por qué el frontend permanece en estado de error cuando el backend está operativo.

---

## 🔍 ANÁLISIS TÉCNICO REALIZADO

### 1. Configuración de Axios (api.js)

**Archivo**: `frontend/src/services/api.js`

```javascript
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 10000
});

// Interceptor de respuesta
api.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error);
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Endpoint consultado
export const sessionAPI = {
  getSession: (clienteId) =>
    api.get(`/api/whatsapp/${clienteId}/status`),
  // ...
};
```

**Hallazgos**:
- ✅ **NO hay configuración de cache explícita** en axios
- ✅ Timeout de 10 segundos configurado
- ✅ Interceptor de errores simple (no maneja 304)
- ❌ **NO se envían headers anti-cache** (Cache-Control, Pragma)
- ❌ **NO se agrega timestamp/query param** para invalidar cache del navegador

---

### 2. Componente que Consume el Endpoint (SessionManager.jsx)

**Archivo**: `frontend/src/components/whatsapp/SessionManager.jsx`

```javascript
const SessionManager = () => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    loadSession();
    const interval = setInterval(loadSession, 5000); // Polling cada 5 segundos
    return () => clearInterval(interval);
  }, [clienteId]);

  const loadSession = async () => {
    if (!clienteId) {
      setError('No hay cliente_id configurado');
      return;
    }

    try {
      const response = await sessionAPI.getSession(clienteId);
      const normalizedState = response?.data?.state?.toLowerCase();

      let mappedStatus = SessionStatus.ERROR;

      switch (normalizedState) {
        case SessionStatus.CONNECTED:
          mappedStatus = SessionStatus.CONNECTED;
          break;
        case SessionStatus.QR_REQUIRED:
          mappedStatus = SessionStatus.QR_REQUIRED;
          break;
        case SessionStatus.CONNECTING:
        case SessionStatus.INIT:
        case 'initializing':
        case 'reconnecting':
          mappedStatus = SessionStatus.CONNECTING;
          break;
        case SessionStatus.DISCONNECTED:
          mappedStatus = SessionStatus.DISCONNECTED;
          break;
        default:
          mappedStatus = SessionStatus.ERROR;
      }

      setSession({
        status: mappedStatus,
        connected: Boolean(response.data.connected),
        needs_qr: Boolean(response.data.needs_qr),
        qr_status: response.data.needs_qr ? QRStatus.REQUIRED : null,
        phone_number: response.data.phone_number || null
      });

      setError(null); // ✅ LIMPIA el error en caso de éxito
      
    } catch (err) {
      console.error('[Session] Error cargando sesión:', err);
      setError(err.response?.data?.message || 'Error al cargar sesión');
    }
  };
  
  // ...
};
```

**Hallazgos**:
- ✅ **SÍ limpia el estado de error** con `setError(null)` en caso de éxito
- ✅ Mapeo de estados implementado correctamente
- ✅ Polling cada 5 segundos (frecuencia razonable)
- ⚠️ **Problema potencial**: Si axios recibe HTTP 304, puede no disparar el bloque `try` con datos actualizados

---

### 3. Backend: Headers de Response

**Prueba realizada**:
```bash
$ curl -I http://localhost:3012/api/whatsapp/51/status
HTTP/1.1 404 Not Found
X-Powered-By: Express
Access-Control-Allow-Origin: *
Content-Security-Policy: default-src 'none'
X-Content-Type-Options: nosniff
Content-Type: text/html; charset=utf-8
Content-Length: 162
Date: Tue, 13 Jan 2026 20:12:43 GMT
Connection: keep-alive
Keep-Alive: timeout=5
```

**Hallazgos CRÍTICOS**:
- ❌ **HTTP 404 Not Found** - El endpoint NO está respondiendo
- ❌ **Content-Type: text/html** (debería ser `application/json`)
- ❌ **NO hay headers Cache-Control** en respuestas válidas
- ❌ **NO hay ETag** configurado explícitamente

**Verificación adicional**:
```bash
$ grep -r "Cache-Control\|ETag\|Last-Modified" services/central-hub/src/
# Solo encontrado en:
# - sessionController.js (QR endpoint - NO en /status)
```

**Código del controller QR** (para referencia):
```javascript
res.setHeader('Content-Type', 'image/png');
res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
```

**Conclusión**: El endpoint `/status` **NO configura headers anti-cache**.

---

### 4. Comportamiento de HTTP 304 (Not Modified)

**Flujo típico con caché de navegador**:

```
1. Primera llamada:
   Frontend → GET /api/whatsapp/51/status
   Backend  → 200 OK + JSON + ETag: "abc123"
   Browser  → Cachea respuesta con ETag

2. Segunda llamada (polling):
   Browser  → GET /api/whatsapp/51/status
             + If-None-Match: "abc123"
   Backend  → Compara ETag
   Backend  → 304 Not Modified (sin body)
   Browser  → Usa respuesta cacheada (PUEDE SER VIEJA)

3. Frontend:
   axios recibe 304
   axios retorna response.data del cache
   loadSession() procesa datos VIEJOS
   UI no se actualiza
```

**¿Axios maneja 304 automáticamente?**

**Respuesta**: Depende del navegador y configuración.

- Si el **navegador** envía `If-None-Match` o `If-Modified-Since`, y el servidor responde 304, axios recibe la respuesta cacheada SIN saber que es vieja.
- Axios **NO controla el cache del navegador** por defecto.

---

## 🧪 EVIDENCIAS DEL PROBLEMA

### Evidencia 1: Endpoint NO está funcionando

```bash
$ curl http://localhost:3012/api/whatsapp/51/status
HTTP/1.1 404 Not Found
```

**Diagnóstico**: El endpoint `/api/whatsapp/:clienteId/status` devuelve 404. Esto explica por qué el frontend muestra error.

### Evidencia 2: Backend NO configura headers anti-cache

```bash
# Búsqueda en código backend:
$ grep -r "Cache-Control" services/central-hub/src/modules/whatsappQrAuthorization/

# Resultado: NO hay configuración de Cache-Control en getWhatsappSessionStatus()
```

**Código del controller** (whatsappQrController.js):
```javascript
async function getWhatsappSessionStatus(req, res) {
  // ...
  res.json(mappedResponse); // ❌ NO configura headers
}
```

### Evidencia 3: Axios NO envía headers anti-cache

```javascript
// frontend/src/services/api.js
export const sessionAPI = {
  getSession: (clienteId) =>
    api.get(`/api/whatsapp/${clienteId}/status`),
  // ❌ NO agrega headers como:
  // headers: { 'Cache-Control': 'no-cache' }
};
```

### Evidencia 4: Frontend limpia error correctamente

```javascript
// SessionManager.jsx - línea 78
setError(null); // ✅ SÍ limpia el flag de error
```

**Conclusión**: El manejo de estado en el frontend es correcto. El problema NO es un flag de error persistente.

---

## 📊 TABLA DE DIAGNÓSTICO

| Aspecto | Estado | Evidencia | Impacto en 304 |
|---------|--------|-----------|----------------|
| **Backend 404** | ❌ CRÍTICO | `curl` retorna 404 | Frontend siempre falla |
| **Backend Cache-Control** | ❌ NO configurado | Código no lo setea | Browser puede cachear |
| **Axios headers anti-cache** | ❌ NO enviados | No hay `Cache-Control: no-cache` | Browser puede cachear |
| **Frontend limpia error** | ✅ Correcto | `setError(null)` presente | Sin impacto |
| **Mapeo de estados** | ✅ Correcto | Switch exhaustivo | Sin impacto |
| **Polling interval** | ✅ 5 segundos | Frecuencia razonable | Sin impacto |

---

## 🎯 DIAGNÓSTICO FINAL

### Problema Principal: ENDPOINT NO FUNCIONA (404)

**Causa raíz inmediata**: El endpoint `/api/whatsapp/:clienteId/status` devuelve HTTP 404.

**Impacto**:
- Frontend recibe error en TODAS las llamadas
- UI permanece en estado de error independientemente del cache

**Solución prioritaria**: Corregir el routing del endpoint (problema ya resuelto en cambios anteriores).

---

### Problema Secundario: POSIBLE CACHE DE NAVEGADOR (si endpoint funcionara)

**Escenario hipotético** (si el endpoint respondiera 200 OK):

1. **Navegador puede cachear** respuestas JSON si no hay headers anti-cache
2. **HTTP 304 puede ocurrir** si el servidor implementa ETag (actualmente NO lo hace)
3. **Axios NO agrega cache busting** (no usa timestamps en query params)

**Flujo problemático potencial**:
```
T=0s:  Backend READY → Frontend GET /status → 200 OK (state: READY) ✅
T=5s:  Backend READY → Browser envía If-None-Match → 304 → Axios usa cache ✅
T=10s: Backend ERROR → Browser envía If-None-Match → 304 → Axios usa cache VIEJA ❌
```

**Resultado**: UI muestra READY cuando el estado real es ERROR.

**O al revés**:
```
T=0s:  Backend ERROR → Frontend GET /status → 200 OK (state: ERROR) ❌
T=5s:  Backend READY → Browser envía If-None-Match → 304 → Axios usa cache VIEJA ❌
```

**Resultado**: UI muestra ERROR cuando el estado real es READY ← **ESTE ES EL SÍNTOMA REPORTADO**

---

## 🔧 FACTORES QUE CONFIRMAN PROBLEMA DE CACHE

### ✅ Factores que APOYAN hipótesis de cache:

1. **Síntoma específico**: Network muestra 304 (Not Modified)
2. **Backend NO envía Cache-Control: no-cache**
3. **Frontend NO envía headers anti-cache**
4. **Axios usa config default** (respeta cache del navegador)
5. **Polling repetido** (misma URL, condiciones ideales para cache)

### ❌ Factores que DESCARTAN hipótesis de cache:

1. **Endpoint devuelve 404** (cache no aplica si no hay respuesta válida)
2. **Backend NO implementa ETag** (304 no debería ocurrir sin ETag)
3. **Express NO cachea por defecto** (a menos que se configure middleware)

---

## 📝 RESPUESTAS A LAS PREGUNTAS PLANTEADAS

### 1. ¿La respuesta puede estar siendo cacheada?

**Respuesta**: **Potencialmente SÍ** (si el endpoint funcionara).

**Razones**:
- Backend NO envía `Cache-Control: no-cache`
- Frontend NO envía headers anti-cache
- Navegador puede aplicar cache heurístico en respuestas sin directivas explícitas

**PERO**: Actualmente el endpoint devuelve 404, por lo que el cache no es el problema principal.

---

### 2. ¿Hay manejo incorrecto de estado (flags de error)?

**Respuesta**: **NO**.

**Evidencia**:
```javascript
setError(null); // ✅ Se limpia en caso de éxito
```

El código del frontend limpia correctamente el flag de error cuando recibe una respuesta exitosa.

---

### 3. ¿El uso de axios/headers HTTP puede explicar que no reciba JSON actualizado?

**Respuesta**: **SÍ, PARCIALMENTE** (escenario hipotético).

**Explicación**:

Si el backend respondiera 200 OK con datos que cambian (ej: READY → ERROR), y el navegador cacheara la respuesta, axios podría recibir:
- HTTP 304 Not Modified
- Datos del cache (viejos)
- Frontend actualiza UI con datos desactualizados

**Soluciones típicas**:
1. Backend envía `Cache-Control: no-cache, no-store`
2. Frontend agrega timestamp: `/status?t=${Date.now()}`
3. Frontend envía headers: `{ 'Cache-Control': 'no-cache' }`

---

### 4. ¿Qué evidencias confirman o descartan problema de caché/ETag/304?

**Evidencias que CONFIRMAN posibilidad de cache**:
- ✅ DevTools muestra 304 (según reporte del usuario)
- ✅ Backend NO configura `Cache-Control`
- ✅ Frontend NO envía headers anti-cache
- ✅ Axios respeta cache del navegador por defecto

**Evidencias que DESCARTAN cache como causa actual**:
- ❌ Endpoint devuelve 404 (no hay respuesta válida para cachear)
- ❌ Backend NO implementa ETag (304 no debería ocurrir)
- ❌ Express NO cachea automáticamente

---

## 🚀 RECOMENDACIONES TÉCNICAS

### Solución Inmediata (Ya implementada)

1. **Corregir routing del endpoint**:
   - Cambiar `/whatsapp/:clienteId/status` → `/:clienteId/status` en router
   - Montar en `/whatsapp` en index.js
   - Resultado: `/api/whatsapp/:clienteId/status` funcional

### Prevención de Cache (Implementar después)

#### Backend: Agregar headers anti-cache

```javascript
// whatsappQrController.js
async function getWhatsappSessionStatus(req, res) {
  // ... lógica existente ...
  
  // ✅ AGREGAR ANTES de res.json()
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  
  res.json(mappedResponse);
}
```

#### Frontend: Opción 1 - Headers anti-cache

```javascript
// api.js
export const sessionAPI = {
  getSession: (clienteId) =>
    api.get(`/api/whatsapp/${clienteId}/status`, {
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    }),
};
```

#### Frontend: Opción 2 - Cache busting con timestamp

```javascript
// api.js
export const sessionAPI = {
  getSession: (clienteId) =>
    api.get(`/api/whatsapp/${clienteId}/status?t=${Date.now()}`),
};
```

#### Frontend: Opción 3 - Configuración global de axios

```javascript
// api.js
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache', // ✅ Agregar
    'Pragma': 'no-cache'          // ✅ Agregar
  },
  timeout: 10000
});
```

---

## 📌 CONCLUSIONES

### Causa Raíz del Problema Reportado

**Primaria**: Endpoint `/api/whatsapp/:clienteId/status` devuelve 404 (ya corregido).

**Secundaria** (potencial): Falta de headers anti-cache puede causar stale data si el endpoint funciona.

### ¿El problema es cache o manejo de estado?

**Respuesta**: **Ni uno ni otro en este caso específico**.

El problema real es que el endpoint NO está funcionando (404). El cache HTTP no aplica a respuestas de error.

**PERO**: Si el reporte del usuario menciona HTTP 304, puede haber un middleware de cache en NGINX o proxy reverso que no está visible en el código de la aplicación.

### Próximos Pasos

1. ✅ **Verificar que el endpoint responde correctamente** después del fix de routing
2. ⚠️ **Monitorear DevTools** para confirmar si 304 sigue ocurriendo
3. 🔧 **Implementar headers anti-cache** en backend (prevención)
4. 🔧 **Opcional**: Agregar timestamp en frontend (cache busting)

---

**Documento generado**: 2026-01-13 14:15:00 UTC-6  
**Estado del endpoint**: 404 (corregido en commit anterior, pendiente restart)  
**Prioridad**: Verificar funcionamiento antes de implementar prevención de cache
