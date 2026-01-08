# Refactor: WhatsApp QR Read-Only Flow

**Fecha:** 2026-01-08  
**Tipo:** Architectural Refactor - HTTP Contract Compliance  
**Estado:** 🚧 ANÁLISIS COMPLETADO - PENDIENTE IMPLEMENTACIÓN  
**Impacto:** Critical - Security & Architecture Alignment

---

## 📋 Resumen Ejecutivo

### Problema Actual
El frontend **intenta generar códigos QR** llamando a `GET /api/whatsapp/:clienteId/qr`, lo cual:
1. **Viola el contrato oficial** de LeadMaster
2. **Causa errores 403** porque el backend valida autorizaciones que no existen
3. **Mezcla responsabilidades:** El QR debe ser generado SOLO por el backend (session-manager + whatsapp-web.js)

### Arquitectura Correcta
**Backend:** Genera QR automáticamente cuando la sesión entra en estado `QR_REQUIRED`  
**Frontend:** SOLO lee el QR ya generado a través de un endpoint read-only

---

## 🔍 Análisis del Sistema Actual

### Arquitectura Existente

```
┌─────────────────────────────────────────────────────────────┐
│                         FRONTEND                            │
│  SessionManager.jsx                                         │
│  ┌──────────────────────────────────────────────────┐      │
│  │ handleRequestQR() → sessionAPI.requestQR()       │      │
│  │ Intenta "generar" QR desde UI                    │      │
│  └──────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      CENTRAL HUB                            │
│  whatsappQrController.js                                    │
│  ┌──────────────────────────────────────────────────┐      │
│  │ GET /api/whatsapp/:clienteId/qr                  │      │
│  │ ✗ Valida autorización (ll_whatsapp_qr_sessions) │      │
│  │ ✗ Retorna 403 si no está autorizado             │      │
│  └──────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   SESSION MANAGER                           │
│  sessionController.js                                       │
│  ┌──────────────────────────────────────────────────┐      │
│  │ GET /qr                                          │      │
│  │ Retorna QR ya generado por whatsapp-web.js      │      │
│  └──────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Flujo Actual (INCORRECTO)

```
1. Usuario hace clic en "Generar QR"
   ↓
2. Frontend: sessionAPI.requestQR(clienteId)
   ↓
3. Central Hub: GET /api/whatsapp/:clienteId/qr
   ↓
4. qrAuthorizationService.isAuthorized(clienteId)
   ↓
5a. ✗ NO autorizado → 403 Forbidden
5b. ✓ Autorizado → Proxy a session-manager
   ↓
6. Session Manager: GET /qr (con X-Cliente-Id header)
   ↓
7. Retorna QR si existe
```

**Problemas:**
- ❌ Frontend "solicita generación" (concepto erróneo)
- ❌ Central Hub valida autorizaciones que NO deberían existir
- ❌ Mezcla de responsabilidades: generación vs visualización
- ❌ Errores 403 innecesarios

---

## 🎯 Arquitectura Objetivo (Contrato Oficial)

### Contrato HTTP LeadMaster

**Endpoint:** `GET /qr-code`  
**Headers:** `X-Cliente-Id: <clienteId>`  
**Condición:** Solo válido cuando `session.state === "QR_REQUIRED"`

**Response exitosa (200):**
```json
{
  "qr": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
}
```

**Response fallida (409):**
```json
{
  "error": "QR_NOT_REQUIRED",
  "message": "La sesión no requiere QR en este momento"
}
```

**Response fallida (403):**
```json
{
  "error": "UNAUTHORIZED",
  "message": "Cliente no autorizado"
}
```

### Flujo Correcto

```
┌─────────────────────────────────────────────────────────────┐
│                         FRONTEND                            │
│  ┌──────────────────────────────────────────────────┐      │
│  │ 1. Polling: GET /api/whatsapp/:clienteId/status  │      │
│  │    Response: { state: "QR_REQUIRED", ... }       │      │
│  │                                                  │      │
│  │ 2. Usuario hace clic en "Mostrar QR"            │      │
│  │                                                  │      │
│  │ 3. handleShowQR() → sessionAPI.getQRCode()      │      │
│  │    GET /qr-code                                 │      │
│  │    Header: X-Cliente-Id: 51                     │      │
│  │                                                  │      │
│  │ 4. Muestra QR en modal (read-only)              │      │
│  └──────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   SESSION MANAGER                           │
│  ┌──────────────────────────────────────────────────┐      │
│  │ GET /qr-code (con X-Cliente-Id)                  │      │
│  │                                                  │      │
│  │ Valida:                                          │      │
│  │ - ¿Sesión en estado QR_REQUIRED?                │      │
│  │ - ¿QR generado por whatsapp-web.js?             │      │
│  │                                                  │      │
│  │ Si OK → Retorna QR base64                        │      │
│  │ Si NO → 409 (QR no requerido)                   │      │
│  └──────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   WHATSAPP-WEB.JS                           │
│  ┌──────────────────────────────────────────────────┐      │
│  │ Genera QR automáticamente al inicializar         │      │
│  │ Estado: INIT → QR_REQUIRED                       │      │
│  │ QR almacenado en memoria del cliente             │      │
│  └──────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Principios Arquitectónicos

1. **Generación de QR:** Responsabilidad EXCLUSIVA del backend (whatsapp-web.js)
2. **Frontend:** Solo observa estados y **lee** QR ya generado
3. **Sin autorización manual:** El QR existe si la sesión lo requiere
4. **Read-only:** Frontend NO puede forzar generación

---

## 🔧 Cambios Requeridos

### 1. Frontend: SessionManager.jsx

**Antes:**
```jsx
const handleRequestQR = async () => {
  try {
    const response = await sessionAPI.requestQR(clienteId);
    setQrString(response.data.qr_string);
    setShowQRModal(true);
  } catch (err) {
    if (err.response?.status === 403) {
      setError('No estás autorizado para generar QR');
    }
  }
};

// JSX
<Button onClick={handleRequestQR}>Generar QR</Button>
```

**Después:**
```jsx
const handleShowQR = async () => {
  if (!clienteId) {
    setError('No hay cliente_id configurado');
    return;
  }

  try {
    setLoading(true);
    setError(null);

    // SOLO leer QR ya generado por backend
    const response = await sessionAPI.getQRCode(clienteId);
    
    setQrString(response.data.qr);
    setShowQRModal(true);
    
  } catch (err) {
    console.error('[QR] Error obteniendo QR:', err);
    
    if (err.response?.status === 409) {
      setError('La sesión no requiere QR en este momento');
    } else if (err.response?.status === 403) {
      setError('No tienes permiso para ver el QR');
    } else if (err.response?.status === 404) {
      setError('QR no disponible todavía. Intenta de nuevo en unos segundos.');
    } else {
      setError('Error al obtener código QR');
    }
    
  } finally {
    setLoading(false);
  }
};

// JSX
<Button onClick={handleShowQR} disabled={loading}>
  Mostrar QR
</Button>
```

**Cambios clave:**
- ✅ `handleRequestQR` → `handleShowQR` (semántica correcta)
- ✅ `sessionAPI.requestQR()` → `sessionAPI.getQRCode()` (read-only)
- ✅ "Generar QR" → "Mostrar QR" (UI más clara)
- ✅ Manejo de 409: "no requiere QR" (no es error fatal)

### 2. Frontend: services/api.js

**Antes:**
```javascript
export const sessionAPI = {
  getSession: (clienteId) => api.get(`/api/whatsapp/${clienteId}/status`),
  
  // ❌ INCORRECTO: "Solicita generación"
  requestQR: (clienteId) => api.get(`/api/whatsapp/${clienteId}/qr`),
};
```

**Después:**
```javascript
export const sessionAPI = {
  /**
   * Obtiene el estado actual de la sesión WhatsApp
   * GET /api/whatsapp/:clienteId/status
   */
  getSession: (clienteId) => api.get(`/api/whatsapp/${clienteId}/status`),
  
  /**
   * Obtiene el código QR ya generado (read-only)
   * GET /qr-code
   * Header: X-Cliente-Id
   * Solo válido cuando state === "QR_REQUIRED"
   */
  getQRCode: (clienteId) => api.get('/qr-code', {
    headers: {
      'X-Cliente-Id': String(clienteId)
    }
  }),
};
```

**Cambios clave:**
- ✅ Endpoint: `/qr-code` (contrato oficial)
- ✅ Header: `X-Cliente-Id` (en vez de path param)
- ✅ Semántica: `getQRCode` (no `requestQR`)

### 3. Backend: Nueva Ruta en Central Hub

**Archivo:** `src/routes/qrCodeProxy.js` (NUEVO)

```javascript
const express = require('express');
const router = express.Router();
const sessionManagerClient = require('../services/sessionManagerClient');

/**
 * GET /qr-code
 * Proxy read-only al QR generado por session-manager
 * 
 * Header requerido: X-Cliente-Id
 * 
 * Respuestas:
 * - 200: QR disponible
 * - 400: Header X-Cliente-Id faltante o inválido
 * - 409: Sesión no requiere QR
 * - 502: Session Manager no disponible
 */
router.get('/', async (req, res) => {
  const clienteId = req.headers['x-cliente-id'];
  
  if (!clienteId) {
    return res.status(400).json({
      ok: false,
      error: 'MISSING_HEADER',
      message: 'Header X-Cliente-Id es requerido'
    });
  }
  
  const clienteIdNum = parseInt(clienteId, 10);
  if (isNaN(clienteIdNum) || clienteIdNum <= 0) {
    return res.status(400).json({
      ok: false,
      error: 'INVALID_CLIENT_ID',
      message: 'X-Cliente-Id debe ser un número positivo'
    });
  }
  
  try {
    // Proxy directo al session-manager (sin validación de autorización)
    const qrData = await sessionManagerClient.getQRCode(clienteIdNum);
    
    res.json({
      qr: qrData.qr
    });
    
  } catch (error) {
    console.error(
      `[qr-code-proxy] Error obteniendo QR para cliente ${clienteId}:`,
      error.message
    );
    
    // Error 409: Sesión no requiere QR
    if (error.statusCode === 409) {
      return res.status(409).json({
        ok: false,
        error: 'QR_NOT_REQUIRED',
        message: 'La sesión no requiere QR en este momento'
      });
    }
    
    // Error 404: QR no generado todavía
    if (error.statusCode === 404) {
      return res.status(404).json({
        ok: false,
        error: 'QR_NOT_AVAILABLE',
        message: 'QR no disponible. Intenta de nuevo en unos segundos.'
      });
    }
    
    // Errores de conexión
    if (error.message.includes('UNREACHABLE') || error.message.includes('ECONNREFUSED')) {
      return res.status(502).json({
        ok: false,
        error: 'SESSION_MANAGER_UNAVAILABLE',
        message: 'Session Manager no está disponible'
      });
    }
    
    // Otros errores
    res.status(500).json({
      ok: false,
      error: 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

module.exports = router;
```

**Montar en index.js:**
```javascript
const qrCodeProxy = require('./routes/qrCodeProxy');

// ...

app.use('/qr-code', qrCodeProxy);
```

### 4. Backend: sessionManagerClient.js

**Añadir método:**
```javascript
/**
 * GET /qr-code
 * Obtiene el código QR ya generado (read-only)
 * @param {number} clienteId - Cliente ID
 * @returns {Promise<Object>} { qr: "data:image/png;base64,..." }
 */
async function getQRCode(clienteId) {
  return makeRequest('GET', '/qr-code', clienteId);
}

module.exports = {
  health,
  getSession,
  requestQR,
  getQRCode,  // ← NUEVO
  // ...
};
```

### 5. Backend: Session Manager (si no existe)

**Archivo:** `services/session-manager/routes/qr.js`

```javascript
import express from 'express';
import { getQRCode } from '../whatsapp/client.js';

const router = express.Router();

/**
 * GET /qr-code
 * Retorna el QR ya generado si está disponible
 * Header requerido: X-Cliente-Id
 */
router.get('/', async (req, res) => {
  const clienteId = req.headers['x-cliente-id'];
  
  if (!clienteId) {
    return res.status(400).json({
      error: 'MISSING_HEADER',
      message: 'Header X-Cliente-Id es requerido'
    });
  }
  
  try {
    const status = getStatus();
    
    // Solo retornar QR si el estado lo requiere
    if (status.state !== 'QR_REQUIRED') {
      return res.status(409).json({
        error: 'QR_NOT_REQUIRED',
        message: 'La sesión no requiere QR en este momento',
        current_state: status.state
      });
    }
    
    const qrString = getLastQR();
    
    if (!qrString) {
      return res.status(404).json({
        error: 'QR_NOT_AVAILABLE',
        message: 'QR no generado todavía'
      });
    }
    
    // Convertir a data URL si no lo está
    let qrDataUrl = qrString;
    if (!qrString.startsWith('data:image/png;base64,')) {
      const QRCode = await import('qrcode');
      qrDataUrl = await QRCode.toDataURL(qrString);
    }
    
    res.json({
      qr: qrDataUrl
    });
    
  } catch (error) {
    console.error('[qr-code] Error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

export default router;
```

**Montar en app.js:**
```javascript
import qrRouter from './routes/qr.js';

app.use('/qr-code', qrRouter);
```

---

## 🔒 Eliminación de Lógica de Autorización

### Archivos a Modificar

**1. Central Hub - whatsappQrController.js**

**Antes:**
```javascript
async function getWhatsappQr(req, res) {
  const { clienteId } = req.params;
  
  // ❌ ELIMINAR: Validación de autorización
  const authorized = await qrAuthorizationService.isAuthorized(clienteIdNum);
  
  if (!authorized) {
    return res.status(403).json({
      ok: false,
      error: 'QR_NOT_AUTHORIZED',
      message: 'QR no autorizado para este cliente'
    });
  }
  
  // ...
}
```

**Después:**
```javascript
// ❌ DEPRECAR ESTE ENDPOINT COMPLETO
// Reemplazado por GET /qr-code (qrCodeProxy.js)
```

**2. Marcar como deprecated:**

Añadir comentario en `whatsappQrProxy.js`:
```javascript
/**
 * @deprecated Este endpoint será eliminado en la próxima versión
 * Use GET /qr-code en su lugar
 * 
 * GET /:clienteId/qr
 * Solicita generación de QR según el contrato oficial
 */
router.get('/:clienteId/qr', getWhatsappQr);
```

---

## 📊 Comparativa: Antes vs Después

### Flujo de Usuario

**ANTES:**
```
1. Usuario hace clic en "Generar QR"
2. Frontend: sessionAPI.requestQR(51)
3. Backend valida autorización en BD
4. ❌ 403 Forbidden (no autorizado)
5. Frontend muestra error: "No estás autorizado para generar QR"
```

**DESPUÉS:**
```
1. Usuario hace clic en "Mostrar QR"
2. Frontend: sessionAPI.getQRCode(51)
3. Backend verifica si estado === QR_REQUIRED
4. ✅ 200 OK con QR en base64
5. Frontend muestra QR en modal
```

### Tabla de Comparación

| Aspecto | ANTES (Incorrecto) | DESPUÉS (Correcto) |
|---------|-------------------|-------------------|
| **Endpoint** | `/api/whatsapp/:clienteId/qr` | `/qr-code` |
| **Método** | GET | GET |
| **Parámetros** | Path param `:clienteId` | Header `X-Cliente-Id` |
| **Semántica** | "Solicitar/Generar" QR | "Obtener/Leer" QR |
| **Autorización** | Valida tabla `ll_whatsapp_qr_sessions` | Sin autorización manual |
| **Responsabilidad** | Frontend "genera" | Backend genera, frontend lee |
| **Estado requerido** | Cualquiera | `QR_REQUIRED` únicamente |
| **Error 403** | Por falta de autorización | Por permisos de usuario |
| **Error 409** | Sesión ya conectada | Sesión no requiere QR |
| **Botón UI** | "Generar QR" | "Mostrar QR" |

---

## 🧪 Plan de Testing

### Test Manual

**Escenario 1: QR disponible**
```
1. Usuario inicia sesión
2. Backend entra en estado QR_REQUIRED
3. Usuario hace clic en "Mostrar QR"
4. ✅ Esperado: QR aparece en modal
```

**Escenario 2: QR no requerido**
```
1. Usuario ya tiene sesión CONNECTED
2. Usuario hace clic en "Mostrar QR"
3. ✅ Esperado: Mensaje "La sesión no requiere QR"
```

**Escenario 3: QR no generado todavía**
```
1. Backend acabó de entrar en QR_REQUIRED
2. whatsapp-web.js aún no generó el QR
3. Usuario hace clic en "Mostrar QR"
4. ✅ Esperado: 404 con mensaje "Intenta de nuevo en unos segundos"
```

### Test Unitario (Frontend)

```javascript
describe('SessionManager - QR Flow', () => {
  it('should call getQRCode with correct clienteId', async () => {
    const mockGetQRCode = jest.fn().mockResolvedValue({
      data: { qr: 'data:image/png;base64,abc123' }
    });
    
    sessionAPI.getQRCode = mockGetQRCode;
    
    // Simular clic en "Mostrar QR"
    await handleShowQR();
    
    expect(mockGetQRCode).toHaveBeenCalledWith('51');
  });
  
  it('should show error message on 409', async () => {
    sessionAPI.getQRCode = jest.fn().mockRejectedValue({
      response: { status: 409 }
    });
    
    await handleShowQR();
    
    expect(error).toBe('La sesión no requiere QR en este momento');
  });
});
```

### Test de Integración

```bash
# Test 1: QR disponible
curl -X GET http://localhost:3012/qr-code \
  -H "X-Cliente-Id: 51" \
  -H "Authorization: Bearer <token>"

# Esperado: 200 OK
# { "qr": "data:image/png;base64,..." }

# Test 2: Sin header
curl -X GET http://localhost:3012/qr-code

# Esperado: 400 Bad Request
# { "error": "MISSING_HEADER", ... }

# Test 3: Sesión no requiere QR
curl -X GET http://localhost:3012/qr-code \
  -H "X-Cliente-Id: 51"

# Esperado: 409 Conflict
# { "error": "QR_NOT_REQUIRED", ... }
```

---

## 🚀 Plan de Deployment

### Fase 1: Backend (Session Manager)

1. **Crear endpoint `/qr-code`:**
   ```bash
   cd services/session-manager
   # Crear routes/qr.js
   # Montar en app.js
   ```

2. **Test local:**
   ```bash
   curl http://localhost:3001/qr-code -H "X-Cliente-Id: 51"
   ```

3. **Deploy:**
   ```bash
   pm2 restart session-manager
   pm2 logs session-manager
   ```

### Fase 2: Backend (Central Hub)

1. **Crear proxy `/qr-code`:**
   ```bash
   cd services/central-hub
   # Crear src/routes/qrCodeProxy.js
   # Actualizar src/services/sessionManagerClient.js
   # Montar en src/index.js
   ```

2. **Test local:**
   ```bash
   curl http://localhost:3012/qr-code \
     -H "X-Cliente-Id: 51" \
     -H "Authorization: Bearer <token>"
   ```

3. **Deploy:**
   ```bash
   pm2 restart central-hub
   pm2 logs central-hub
   ```

### Fase 3: Frontend

1. **Actualizar componentes:**
   ```bash
   cd frontend
   # Modificar src/services/api.js
   # Modificar src/components/whatsapp/SessionManager.jsx
   ```

2. **Build:**
   ```bash
   npm run build
   ```

3. **Deploy:**
   ```bash
   sudo cp -r dist/* /var/www/desarrolloydisenioweb/
   ```

4. **Verificar:**
   - Limpiar caché del navegador
   - Hard refresh (Ctrl + Shift + R)
   - Test manual de flujo QR

### Fase 4: Deprecación Gradual

1. **Marcar endpoint viejo como deprecated:**
   - Añadir log de warning en `whatsappQrController.js`
   - Documentar en CHANGELOG

2. **Monitorear uso:**
   - Verificar que no hay llamadas al endpoint viejo
   - Revisar logs de NGINX/PM2

3. **Eliminar (después de 1 mes):**
   - Eliminar `GET /api/whatsapp/:clienteId/qr`
   - Eliminar validaciones de autorización
   - Eliminar tabla `ll_whatsapp_qr_sessions` (opcional)

---

## 📚 Documentación de Contratos

### Contrato Oficial: GET /qr-code

```yaml
openapi: 3.0.0
paths:
  /qr-code:
    get:
      summary: Obtiene el código QR de WhatsApp (read-only)
      description: |
        Retorna el código QR ya generado por el backend.
        Solo disponible cuando la sesión está en estado QR_REQUIRED.
      
      parameters:
        - name: X-Cliente-Id
          in: header
          required: true
          schema:
            type: integer
          description: ID del cliente
      
      responses:
        '200':
          description: QR disponible
          content:
            application/json:
              schema:
                type: object
                properties:
                  qr:
                    type: string
                    format: data-url
                    example: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg..."
        
        '400':
          description: Header X-Cliente-Id faltante o inválido
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        
        '404':
          description: QR no generado todavía
          content:
            application/json:
              schema:
                type: object
                properties:
                  error:
                    type: string
                    example: "QR_NOT_AVAILABLE"
                  message:
                    type: string
                    example: "QR no disponible. Intenta de nuevo en unos segundos."
        
        '409':
          description: Sesión no requiere QR
          content:
            application/json:
              schema:
                type: object
                properties:
                  error:
                    type: string
                    example: "QR_NOT_REQUIRED"
                  message:
                    type: string
                    example: "La sesión no requiere QR en este momento"
                  current_state:
                    type: string
                    example: "CONNECTED"
        
        '502':
          description: Session Manager no disponible
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

components:
  schemas:
    Error:
      type: object
      properties:
        ok:
          type: boolean
          example: false
        error:
          type: string
        message:
          type: string
```

---

## ✅ Checklist de Implementación

### Backend (Session Manager)
- [ ] Crear `routes/qr.js` con endpoint `/qr-code`
- [ ] Montar ruta en `app.js`
- [ ] Implementar validación de estado `QR_REQUIRED`
- [ ] Test local con curl
- [ ] Deploy a producción
- [ ] Verificar logs sin errores

### Backend (Central Hub)
- [ ] Crear `src/routes/qrCodeProxy.js`
- [ ] Añadir método `getQRCode()` en `sessionManagerClient.js`
- [ ] Montar ruta en `src/index.js`
- [ ] Test local con curl
- [ ] Deploy a producción
- [ ] Verificar logs sin errores

### Frontend
- [ ] Actualizar `src/services/api.js`:
  - [ ] Eliminar `requestQR()`
  - [ ] Añadir `getQRCode()` con header `X-Cliente-Id`
- [ ] Actualizar `src/components/whatsapp/SessionManager.jsx`:
  - [ ] Renombrar `handleRequestQR` → `handleShowQR`
  - [ ] Cambiar llamada a `getQRCode()`
  - [ ] Actualizar manejo de errores (409, 404)
  - [ ] Cambiar texto "Generar QR" → "Mostrar QR"
- [ ] Build y deploy
- [ ] Test manual en producción
- [ ] Verificar console sin errores 403

### Deprecación
- [ ] Marcar endpoint viejo como deprecated
- [ ] Añadir log de warning
- [ ] Documentar en CHANGELOG
- [ ] Programar eliminación (1 mes)

### Documentación
- [ ] Actualizar contratos HTTP en `/docs`
- [ ] Actualizar README con nuevo flujo
- [ ] Crear guía de migración para otros componentes

---

## 🎯 Resultado Esperado

### Antes del Refactor
```
1. Usuario hace clic en "Generar QR"
2. ❌ Error 403: "No estás autorizado para generar QR"
3. ❌ No aparece QR
4. ❌ Usuario frustrado
```

### Después del Refactor
```
1. Usuario hace clic en "Mostrar QR"
2. ✅ Request a GET /qr-code
3. ✅ Backend valida estado QR_REQUIRED
4. ✅ Retorna QR en base64
5. ✅ Modal muestra QR
6. ✅ Usuario puede escanear
```

### Beneficios

**Arquitectura:**
- ✅ Cumple contrato oficial de LeadMaster
- ✅ Separación clara de responsabilidades
- ✅ Backend controla ciclo de vida del QR
- ✅ Frontend solo observa y visualiza

**Seguridad:**
- ✅ Sin validaciones de autorización innecesarias
- ✅ QR solo accesible en estado correcto
- ✅ Header `X-Cliente-Id` para identificación

**UX:**
- ✅ Mensajes de error más claros
- ✅ Botón "Mostrar QR" (semántica correcta)
- ✅ Sin errores 403 inesperados
- ✅ Flujo más intuitivo

**Mantenibilidad:**
- ✅ Código más simple y claro
- ✅ Menos lógica de negocio en frontend
- ✅ Más fácil de testear
- ✅ Más fácil de extender

---

## 📞 Contacto y Soporte

**Desarrollador:** GitHub Copilot (Claude Sonnet 4.5)  
**Fecha de Análisis:** 2026-01-08  
**Estado:** Análisis completado - Listo para implementación

**Próximos pasos:**
1. Revisar y aprobar este análisis
2. Implementar cambios en orden: Session Manager → Central Hub → Frontend
3. Test en cada fase
4. Deploy gradual con monitoreo

---

**Fin del Informe**
