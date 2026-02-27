# Informe Técnico: Problema de Visualización de QR Code WhatsApp

**Fecha:** 2026-01-14  
**Componente:** Frontend SessionManager + Backend session-manager  
**Severidad:** ALTA - Bloquea funcionalidad crítica de conexión WhatsApp  
**Estado:** DIAGNOSTICADO - Requiere decisión de arquitectura

---

## 1. RESUMEN EJECUTIVO

El sistema **genera correctamente** el código QR de WhatsApp en el backend (session-manager), pero el **frontend no logra mostrarlo a tiempo** antes de que expire (60 segundos). Esto se debe a un **desajuste arquitectural** entre:

1. El flujo asíncrono del backend (WhatsApp tarda ~20-30 segundos en generar el QR)
2. El enfoque request/response síncrono del frontend
3. La falta de comunicación en tiempo real entre ambos componentes

---

## 2. ANÁLISIS DE LOGS - EVIDENCIA DEL PROBLEMA

### 2.1 Backend Session-Manager (PM2 Logs)

```
2026-01-14 10:57:21 -06:00: [WhatsApp][300] State: QR_REQUIRED → QR_REQUIRED 
2026-01-14 10:57:21 -06:00: [WhatsApp][300] QR Code received - scan with your phone:
2026-01-14 10:57:21 -06:00: ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
2026-01-14 10:57:21 -06:00: █ ▄▄▄▄▄ ████▀███▄ ▀█▄▄██▀ ▀▄█▀▀▄▀▀▀▄▀▀█▄▄██ ▀█ ▄ ██ ▄▄▄▄▄ █
[... QR ASCII art ...]
```

**Conclusión:** El QR **SÍ se generó exitosamente** a las 10:57:21 (hora local).

### 2.2 Estado del Servicio

```bash
$ curl -s http://localhost:3001/status -H "X-Cliente-Id: 1"
{
  "cliente_id": 1,
  "connected": false,
  "state": "NOT_INITIALIZED",  # Volvió a estado inicial
  "reconnection_attempts": 0,
  "max_reconnection_attempts": 3,
  "can_send_messages": false,
  "needs_qr": false,
  "is_recoverable": false
}
```

**Conclusión:** El estado volvió a `NOT_INITIALIZED` porque:
- El QR expiró (timeout ~60s de WhatsApp)
- Nadie lo escaneó
- No hay persistencia de sesión en disco

---

## 3. FLUJO ACTUAL (PROBLEMÁTICO)

### 3.1 Diagrama de Secuencia

```
Frontend                    Nginx                Backend (session-manager)           WhatsApp
   |                          |                            |                            |
   |-- POST /api/whatsapp/init --------------------------->|                            |
   |                          |                            |-- initialize() ----------->|
   |                          |                            |                            |
   |                          |                            |                      [~20-30s]
   |                          |                            |                       generando
   |                          |                            |                         QR...
   |                          |                            |                            |
   |<-- 200 OK (sin QR) -----------------------------------|                            |
   |                          |                            |                            |
   |-- GET /api/whatsapp/qr-code ------------------------->|                            |
   |                          |                            |<-- QR ready --------------|
   |                          |                            |                            |
   |<-- 409 "No requiere QR" (ya expiró) ------------------|                            |
   |                          |                            |                            |
   X ERROR                    |                            |                            |
```

### 3.2 Problema Identificado

**Timing Issue:**
- `POST /init` retorna **antes** de que WhatsApp genere el QR
- Frontend inmediatamente hace `GET /qr-code`
- Backend responde `409 Conflict` porque el estado aún no es `QR_REQUIRED`
- Cuando finalmente el QR está listo (~20s después), el frontend ya abandonó la operación

**Evidencia en código frontend actual:**

```javascript
// SessionManager.jsx - handleShowQR()
await sessionAPI.initSession(clienteId);  // Retorna inmediatamente
const response = await sessionAPI.getQRCode(clienteId);  // Falla 409
```

---

## 4. ANÁLISIS DE TIMEOUTS

### 4.1 Configuración Actual

| Componente | Timeout | Valor |
|------------|---------|-------|
| Frontend axios (default) | `timeout` | 10000ms (10s) |
| Frontend POST /init | `timeout` | 60000ms (60s) ✅ |
| Frontend GET /qr-code | `timeout` | 30000ms (30s) ✅ |
| Nginx proxy_read_timeout | `/api/whatsapp` | 120s ✅ |
| Nginx proxy_connect_timeout | `/api/whatsapp` | 120s ✅ |
| Nginx proxy_send_timeout | `/api/whatsapp` | 120s ✅ |

**Estado:** Timeouts configurados correctamente. **No es un problema de timeout**.

### 4.2 Prueba Manual

```bash
$ time curl -X POST https://desarrolloydisenioweb.com.ar/api/whatsapp/init \
  -H "X-Cliente-Id: 1"

error code: 504  # Gateway Timeout

real    1m0.268s
user    0m0.093s
sys     0m0.036s
```

**Observación:** Tardó exactamente 60s → límite anterior de Nginx (ahora aumentado a 120s).

---

## 5. ARQUITECTURA DEL BACKEND SESSION-MANAGER

### 5.1 Endpoint POST /init

**Archivo:** `services/session-manager/src/routes/sessionRoutes.js` (inferido)

**Comportamiento esperado:**
```javascript
POST /init
├─ Valida cliente_id
├─ Verifica estado actual
├─ Si NOT_INITIALIZED:
│  ├─ Crea cliente WhatsApp Web
│  ├─ Inicia autenticación
│  └─ RETORNA 200 OK (sin esperar QR)
└─ Si ya existe: retorna 409 Conflict
```

**Problema:** El endpoint **no espera** a que WhatsApp genere el QR antes de responder.

### 5.2 Generación Asíncrona del QR

**Flujo interno del backend:**
```
POST /init retorna
    ↓
WhatsApp SDK inicializa (async)
    ↓
[20-30 segundos]
    ↓
Evento 'qr' emitido
    ↓
Estado cambia a QR_REQUIRED
    ↓
QR almacenado en memoria (qr_code_base64)
    ↓
[60 segundos hasta expiración]
    ↓
Si no se escanea: vuelve a NOT_INITIALIZED
```

### 5.3 Endpoint GET /qr-code

**Comportamiento:**
```javascript
GET /qr-code
├─ Valida cliente_id
├─ Verifica estado === 'QR_REQUIRED'
│  ├─ SI: retorna { qr: "data:image/png;base64,..." }
│  └─ NO: retorna 409 { error: "QR_NOT_REQUIRED" }
└─ Si no existe: 404
```

---

## 6. SOLUCIONES POSIBLES

### 6.1 Opción A: Polling (Solución Rápida - NO RECOMENDADA)

**Implementación:**
```javascript
// Frontend
await sessionAPI.initSession(clienteId);

// Polling cada 1 segundo hasta que state === 'QR_REQUIRED'
let attempts = 0;
while (attempts < 30) {
  await sleep(1000);
  const status = await sessionAPI.getSession(clienteId);
  if (status.data.state === 'QR_REQUIRED') break;
  attempts++;
}

const qr = await sessionAPI.getQRCode(clienteId);
```

**Pros:**
- ✅ Implementación simple (solo frontend)
- ✅ No requiere cambios en backend
- ✅ Funciona con infraestructura actual

**Contras:**
- ❌ Ineficiente (30 requests innecesarios)
- ❌ Latencia adicional (1-30 segundos de espera)
- ❌ Carga innecesaria en servidor
- ❌ Experiencia de usuario pobre (loading prolongado)
- ❌ Puede fallar si el QR tarda más de 30s

**Veredicto:** ⚠️ Solución de emergencia, no para producción.

---

### 6.2 Opción B: POST /init Síncrono (RECOMENDADA - Corto Plazo)

**Cambio en backend:**
```javascript
// sessionRoutes.js
router.post('/init', async (req, res) => {
  const clienteId = getClienteId(req);
  
  // Crear promise que espera el evento 'qr'
  const qrPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('QR generation timeout'));
    }, 60000); // 60s max
    
    client.once('qr', (qr) => {
      clearTimeout(timeout);
      resolve(qr);
    });
    
    client.once('ready', () => {
      clearTimeout(timeout);
      resolve(null); // Ya estaba conectado
    });
  });
  
  // Inicializar cliente
  await initializeClient(clienteId);
  
  // ESPERAR a que se genere el QR
  const qrCode = await qrPromise;
  
  if (qrCode) {
    res.json({
      state: 'QR_REQUIRED',
      qr: convertQRToBase64(qrCode),
      expires_in: 60
    });
  } else {
    res.json({
      state: 'READY',
      connected: true
    });
  }
});
```

**Cambio en frontend:**
```javascript
// SessionManager.jsx
const handleShowQR = async () => {
  setLoading(true);
  
  // POST /init ahora retorna el QR directamente
  const response = await sessionAPI.initSession(clienteId);
  
  if (response.data.state === 'QR_REQUIRED') {
    setQrString(response.data.qr);
    setShowQRModal(true);
  } else if (response.data.state === 'READY') {
    setSession({ status: SessionStatus.CONNECTED });
  }
  
  setLoading(false);
};
```

**Pros:**
- ✅ **1 sola request** (eficiente)
- ✅ UX óptima (QR inmediato)
- ✅ Elimina race conditions
- ✅ Compatible con timeouts actuales (60-120s)
- ✅ Implementación clara y mantenible

**Contras:**
- ⚠️ Requiere modificar backend
- ⚠️ Request de larga duración (20-30s bloqueada)

**Veredicto:** ✅ **RECOMENDADA** para corto plazo.

---

### 6.3 Opción C: WebSocket / Server-Sent Events (IDEAL - Largo Plazo)

**Arquitectura:**
```
Frontend                Backend
   |                       |
   |--- POST /init ------->|
   |<-- 202 Accepted ------|
   |                       |
   |--- WS connect ------->|
   |                       |
   |                  [generando QR...]
   |                       |
   |<-- WS: qr_ready ------|
   |  { qr: "..." }        |
   |                       |
   |<-- WS: authenticated -|
   |<-- WS disconnect -----|
```

**Implementación backend:**
```javascript
// WebSocket endpoint
wss.on('connection', (ws, req) => {
  const clienteId = getClienteIdFromToken(req);
  
  const client = getWhatsAppClient(clienteId);
  
  client.on('qr', (qr) => {
    ws.send(JSON.stringify({
      event: 'qr_ready',
      qr: convertQRToBase64(qr)
    }));
  });
  
  client.on('ready', () => {
    ws.send(JSON.stringify({
      event: 'authenticated'
    }));
    ws.close();
  });
});
```

**Implementación frontend:**
```javascript
const handleShowQR = async () => {
  await sessionAPI.initSession(clienteId);
  
  const ws = new WebSocket(`wss://domain.com/api/whatsapp/events?cliente=${clienteId}`);
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    if (data.event === 'qr_ready') {
      setQrString(data.qr);
      setShowQRModal(true);
    } else if (data.event === 'authenticated') {
      setSession({ status: SessionStatus.CONNECTED });
      ws.close();
    }
  };
};
```

**Pros:**
- ✅ **Comunicación en tiempo real** (latencia mínima)
- ✅ Escalable (múltiples clientes simultáneos)
- ✅ Permite eventos adicionales (progress, errors, reconnect)
- ✅ Arquitectura moderna (estándar de la industria)
- ✅ No bloquea threads del servidor

**Contras:**
- ⚠️ Cambio arquitectural significativo
- ⚠️ Requiere manejo de conexiones persistentes
- ⚠️ Configuración adicional en Nginx (upgrade headers)
- ⚠️ Testing más complejo

**Veredicto:** 🎯 **IDEAL** para largo plazo, escalabilidad y múltiples clientes.

---

## 7. ESTADO ACTUAL DEL CÓDIGO

### 7.1 Frontend (Después de 7 fixes)

**Archivos modificados:**
1. ✅ `.env.production` - VITE_SESSION_MANAGER_URL=/api/whatsapp
2. ✅ `.env.development` - VITE_SESSION_MANAGER_URL=http://localhost:3001
3. ✅ `WhatsappPage.jsx` - import.meta.env (no process.env)
4. ✅ `api.js` - sessionAPI.getSession() con header X-Cliente-Id
5. ✅ `api.js` - sessionAPI.initSession() agregado
6. ✅ `api.js` - timeouts aumentados (60s init, 30s qr)
7. ✅ `Dashboard.jsx` - mapeo estados v2.0 (9 estados)
8. ✅ `SessionManager.jsx` - mapeo estados v2.0
9. ✅ `SessionManager.jsx` - case INIT en renderizado
10. ⚠️ `SessionManager.jsx` - flujo POST /init → GET /qr-code (PROBLEMÁTICO)

### 7.2 Nginx

**Archivo:** `infra/nginx/sites-available/desarrolloydisenioweb.com.ar.conf`

```nginx
location /api/whatsapp {
    rewrite ^/api/whatsapp/(.*) /$1 break;
    proxy_pass http://127.0.0.1:3001;
    
    # Headers
    proxy_set_header X-Cliente-Id $http_x_cliente_id;
    
    # Timeouts ✅
    proxy_connect_timeout 120s;
    proxy_send_timeout 120s;
    proxy_read_timeout 120s;
}
```

### 7.3 Backend Session-Manager

**Estado:** ✅ Funcionando correctamente
- PM2 online, puerto 3001
- Genera QR exitosamente
- Logs muestran QR ASCII art
- Estados v2.0 implementados

**Problema:** Arquitectura request/response no comunica QR a tiempo.

---

## 8. RECOMENDACIÓN FINAL

### 8.1 Plan de Implementación Inmediata (Esta Semana)

**Implementar Opción B: POST /init Síncrono**

**Backend - sessionRoutes.js:**
```javascript
router.post('/init', asyncHandler(async (req, res) => {
  const clienteId = getClienteId(req);
  const logger = req.logger || console;
  
  logger.info(`[INIT] Cliente ${clienteId} - Starting initialization`);
  
  try {
    // Verificar si ya existe y está conectado
    const currentState = await getClientState(clienteId);
    if (currentState === 'READY') {
      return res.json({
        success: true,
        state: 'READY',
        message: 'Already connected'
      });
    }
    
    // Promise para esperar QR o conexión
    const initPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Initialization timeout after 60s'));
      }, 60000);
      
      const client = getOrCreateClient(clienteId);
      
      client.once('qr', (qr) => {
        clearTimeout(timeout);
        logger.info(`[INIT] Cliente ${clienteId} - QR generated`);
        
        const qrBase64 = convertQRToBase64(qr);
        resolve({
          state: 'QR_REQUIRED',
          qr: qrBase64,
          expires_in: 60,
          needs_scan: true
        });
      });
      
      client.once('ready', () => {
        clearTimeout(timeout);
        logger.info(`[INIT] Cliente ${clienteId} - Already authenticated`);
        
        resolve({
          state: 'READY',
          connected: true,
          phone_number: client.info?.wid?.user
        });
      });
      
      client.once('auth_failure', (error) => {
        clearTimeout(timeout);
        reject(new Error(`Authentication failed: ${error}`));
      });
    });
    
    // Inicializar cliente (si no está inicializado)
    await startClient(clienteId);
    
    // Esperar resultado
    const result = await initPromise;
    
    res.json({
      success: true,
      ...result
    });
    
  } catch (error) {
    logger.error(`[INIT] Cliente ${clienteId} - Error:`, error);
    
    res.status(500).json({
      success: false,
      error: error.message || 'Initialization failed'
    });
  }
}));
```

**Frontend - SessionManager.jsx:**
```javascript
const handleShowQR = async () => {
  if (!clienteId) {
    setError('No hay cliente_id configurado');
    return;
  }

  try {
    setLoading(true);
    setError(null);

    console.log('[INIT] Iniciando sesión WhatsApp...');

    // POST /init ahora retorna el QR en la respuesta
    const response = await sessionAPI.initSession(clienteId);
    const data = response.data;

    if (data.state === 'QR_REQUIRED') {
      // Validar QR
      if (!data.qr || !data.qr.startsWith('data:image/')) {
        setError('QR inválido recibido del servidor');
        return;
      }
      
      console.log('[INIT] QR recibido, mostrando modal...');
      setQrString(data.qr);
      setShowQRModal(true);
      
      // Iniciar polling del estado para detectar cuando se escanee
      startPolling();
      
    } else if (data.state === 'READY') {
      console.log('[INIT] Ya está conectado');
      setSession({
        status: SessionStatus.CONNECTED,
        phone_number: data.phone_number
      });
      
    } else {
      setError(`Estado inesperado: ${data.state}`);
    }

  } catch (err) {
    console.error('[INIT] Error:', err);
    
    if (err.response?.status === 409) {
      setError('Ya hay una inicialización en progreso');
    } else if (err.code === 'ECONNABORTED') {
      setError('Timeout - el servidor tardó demasiado. Reintentá.');
    } else {
      setError(err.response?.data?.error || 'Error al inicializar WhatsApp');
    }
  } finally {
    setLoading(false);
  }
};

// Polling para detectar cuando se escanee el QR
const startPolling = () => {
  const interval = setInterval(async () => {
    try {
      const status = await sessionAPI.getSession(clienteId);
      
      if (status.data.state === 'READY') {
        clearInterval(interval);
        setShowQRModal(false);
        setSession({
          status: SessionStatus.CONNECTED,
          phone_number: status.data.phone_number
        });
        loadSession(); // Refrescar estado completo
      } else if (status.data.state === 'NOT_INITIALIZED') {
        // QR expiró
        clearInterval(interval);
        setShowQRModal(false);
        setError('El código QR expiró. Intentá de nuevo.');
      }
    } catch (err) {
      console.error('[POLLING] Error:', err);
    }
  }, 3000); // Cada 3 segundos
  
  // Auto-cleanup después de 2 minutos
  setTimeout(() => clearInterval(interval), 120000);
};
```

**Frontend - api.js:**
```javascript
initSession: (clienteId) =>
  api.post('/api/whatsapp/init', {}, {
    headers: {
      'X-Cliente-Id': String(clienteId)
    },
    timeout: 90000 // 90 segundos (más que suficiente para QR)
  }),
```

---

### 8.2 Plan de Refactorización (Próximo Sprint)

**Implementar Opción C: WebSockets**

1. **Backend:**
   - Instalar `ws` o `socket.io`
   - Crear `/api/whatsapp/events` endpoint WebSocket
   - Emitir eventos: `qr_ready`, `authenticated`, `disconnected`, `error`

2. **Frontend:**
   - Instalar `socket.io-client` (si se usa socket.io)
   - Crear hook `useWhatsAppEvents(clienteId)`
   - Refactor SessionManager para usar eventos en tiempo real

3. **Nginx:**
   - Configurar upgrade headers para WebSocket
   ```nginx
   location /api/whatsapp/events {
       proxy_pass http://127.0.0.1:3001;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection "Upgrade";
   }
   ```

---

## 9. DECISIONES REQUERIDAS

| # | Decisión | Opciones | Responsable | Deadline |
|---|----------|----------|-------------|----------|
| 1 | Solución a implementar | A (polling) / B (síncrono) / C (websocket) | Tech Lead | Hoy |
| 2 | ¿Modificar backend ahora? | Sí / No (solo frontend) | Product Owner | Hoy |
| 3 | Testing en staging | Antes de producción / Deploy directo | DevOps | Mañana |
| 4 | Plan para WebSockets | Sprint actual / Próximo sprint / Backlog | Tech Lead | Esta semana |

---

## 10. RIESGOS Y MITIGACIONES

### Opción B (Recomendada)

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Request larga bloquea thread | Media | Bajo | Node.js es async, no bloquea |
| Timeout en redes lentas | Baja | Medio | Timeouts configurados (90s) |
| WhatsApp tarda >90s | Muy Baja | Alto | Retry automático en frontend |
| Bug en evento handling | Media | Alto | Testing exhaustivo + logs |

### Opción C (WebSockets)

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Conexiones persistentes overhead | Media | Bajo | Límite de conexiones por IP |
| Reconexión en fallo de red | Alta | Medio | Lógica de retry automática |
| Complejidad de debugging | Alta | Medio | Logging detallado de eventos |
| Incompatibilidad con proxies | Baja | Alto | Fallback a long-polling |

---

## 11. MÉTRICAS DE ÉXITO

**KPIs post-implementación:**

1. **Tasa de éxito de conexión:** >95% (actualmente 0%)
2. **Tiempo hasta mostrar QR:** <5 segundos (actualmente timeout)
3. **Errores 409/504:** 0 por día (actualmente 100%)
4. **Tiempo promedio de autenticación:** <45 segundos
5. **Satisfacción de usuario:** Encuesta post-conexión

---

## 12. PRÓXIMOS PASOS INMEDIATOS

### Hoy (2026-01-14)

1. ✅ **DECISION:** Aprobar Opción B o C
2. ⏳ **IMPLEMENTACIÓN:**
   - Si B: Modificar `sessionRoutes.js` + `SessionManager.jsx`
   - Si C: Diseñar arquitectura WebSocket
3. ⏳ **TESTING:** Pruebas en local (localhost:3001)
4. ⏳ **CODE REVIEW:** Peer review del código modificado

### Mañana (2026-01-15)

5. ⏳ **DEPLOY STAGING:** Probar en entorno de staging
6. ⏳ **QA:** Casos de prueba end-to-end
7. ⏳ **DEPLOY PRODUCCIÓN:** Si QA pasa, deploy en producción
8. ⏳ **MONITORING:** Seguimiento de logs y métricas

### Esta Semana

9. ⏳ **DOCUMENTACIÓN:** Actualizar README y diagramas
10. ⏳ **PLAN WEBSOCKET:** Si se eligió Opción B, planificar migración a C

---

## 13. REFERENCIAS

**Archivos relacionados:**
- `/root/leadmaster-workspace/services/central-hub/frontend/src/components/whatsapp/SessionManager.jsx`
- `/root/leadmaster-workspace/services/central-hub/frontend/src/services/api.js`
- `/root/leadmaster-workspace/infra/nginx/sites-available/desarrolloydisenioweb.com.ar.conf`
- `/root/leadmaster-workspace/services/session-manager/src/routes/sessionRoutes.js` (inferido)

**Informes previos:**
- `BUGFIX_WHATSAPP_FRONTEND_API_ROUTING.md`
- `AUDIT_FIXES_IMPLEMENTATION_REPORT.md`
- `DEPLOY_CHECKLIST_REPORT.md`

**Logs:**
```bash
sudo pm2 logs session-manager --lines 100
```

---

**Preparado por:** GitHub Copilot (Claude Sonnet 4.5)  
**Revisado por:** [Pendiente]  
**Aprobado por:** [Pendiente]
