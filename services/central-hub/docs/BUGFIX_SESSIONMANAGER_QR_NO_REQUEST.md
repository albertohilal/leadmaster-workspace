# Bugfix: SessionManager.jsx No Genera Request de QR

**Fecha:** 2026-01-08  
**Tipo:** Critical Bug - Frontend Guard Clause Issue  
**Estado:** ⏳ EN ANÁLISIS  
**Impacto:** High - Usuario no puede generar código QR

---

## 📋 Resumen Ejecutivo

### Problema Reportado
Al hacer clic en "Generar QR / Reintentar" en SessionManager.jsx:
- ❌ NO se genera ninguna request XHR
- ❌ Network → XHR está vacío
- ❌ Backend NO está siendo llamado
- ❌ Mensaje "No estás autorizado para generar QR" aparece localmente

### Causa Hipotética (Reportada por Usuario)
- SessionManager.jsx interpreta el estado QR_REQUIRED como UNAUTHORIZED
- Existe una guard clause que retorna antes de ejecutar axios/fetch
- El botón queda bloqueado y nunca se llama al endpoint /qr

---

## 🔍 Análisis del Código Actual

### Función handleRequestQR()

**Archivo:** `frontend/src/components/whatsapp/SessionManager.jsx`  
**Líneas:** 89-127

```javascript
const handleRequestQR = async () => {
  if (!clienteId) {
    setError('No hay cliente_id configurado');
    return;
  }

  try {
    setLoading(true);
    setError(null);
    
    const response = await sessionAPI.requestQR(clienteId);
    
    // Backend retorna qr_string (no qr_code)
    setQrString(response.data.qr_string);
    setShowQRModal(true);
    
    // Actualizar sesión después de solicitar QR
    await loadSession();
    
  } catch (err) {
    console.error('Error al solicitar QR:', err);
    
    // Manejar errores específicos del contrato
    if (err.response?.status === 409) {
      setError('La sesión ya está conectada');
    } else if (err.response?.status === 403) {
      setError('No estás autorizado para generar QR');
    } else if (err.response?.status === 404) {
      setError('Sesión no encontrada. Debe inicializarse primero.');
    } else if (err.response?.status === 500) {
      setError('Error al generar código QR');
    } else {
      setError(err.response?.data?.message || 'Error desconocido');
    }
    
    setShowQRModal(false);
  } finally {
    setLoading(false);
  }
};
```

### Hallazgos del Análisis

**✅ NO hay guard clause bloqueante:**
- La única validación es `if (!clienteId)` que muestra "No hay cliente_id configurado"
- El mensaje reportado es "No estás autorizado para generar QR" (línea 117)
- Este mensaje SOLO aparece en el catch cuando `err.response?.status === 403`

**⚠️ Discrepancia con el reporte:**
El usuario indica que:
- "Backend NO está siendo llamado"
- "El mensaje es generado LOCALMENTE"

Pero el código muestra que:
- El mensaje viene del bloque `catch` → implica que SÍ se hizo la llamada
- Error 403 viene del backend, NO es generado localmente
- No existe guard clause que prevenga la llamada al API

---

## 🔧 Verificación del Backend

### Endpoint QR

**Archivo:** `src/routes/whatsappQrController.js`  
**Líneas:** 173-180

```javascript
// FASE 2: Verificar autorización ANTES de cualquier operación
const authorized = await qrAuthorizationService.isAuthorized(clienteIdNum);

if (!authorized) {
  return res.status(403).json({
    ok: false,
    error: 'QR_NOT_AUTHORIZED',
    message: 'QR no autorizado para este cliente'
  });
}
```

**Validación de Autorización:**

**Archivo:** `src/modules/whatsappQrAuthorization/services/qrAuthorizationService.js`

```javascript
async isAuthorized(clienteId) {
  try {
    const record = await qrAuthorizationRepository.findByClienteId(clienteId);
    
    if (!record) {
      return false; // Sin registro = no autorizado
    }
    
    if (!record.enabled) {
      return false; // enabled = 0 = no autorizado
    }
    
    if (record.revoked_at) {
      return false; // Revocado = no autorizado
    }
    
    return true;
  } catch (error) {
    console.error('Error checking authorization:', error);
    return false;
  }
}
```

**Tabla de Base de Datos:**
```sql
CREATE TABLE ll_whatsapp_qr_sessions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  cliente_id INT NOT NULL,
  enabled TINYINT(1) DEFAULT 1,
  authorized_by INT,
  authorized_at DATETIME,
  revoked_at DATETIME,
  revoked_reason VARCHAR(255),
  FOREIGN KEY (cliente_id) REFERENCES ll_clientes(id)
);
```

---

## 🎯 Diagnóstico: Dos Escenarios Posibles

### Escenario 1: Backend SÍ es llamado (más probable)

**Evidencia:**
- El mensaje "No estás autorizado para generar QR" viene del catch (403)
- No existe guard clause que prevenga la llamada
- El código llama a `sessionAPI.requestQR(clienteId)`

**Causa Real:**
- Backend retorna 403 porque `qrAuthorizationService.isAuthorized()` retorna `false`
- Registro en BD no existe, tiene `enabled = 0`, o tiene `revoked_at` poblado

**Solución:**
```sql
-- Verificar autorización del cliente
SELECT * FROM ll_whatsapp_qr_sessions WHERE cliente_id = ?;

-- Si no existe, crear registro:
INSERT INTO ll_whatsapp_qr_sessions (cliente_id, enabled, authorized_at)
VALUES (?, 1, NOW());

-- Si existe con enabled = 0, activar:
UPDATE ll_whatsapp_qr_sessions 
SET enabled = 1, revoked_at = NULL 
WHERE cliente_id = ?;
```

### Escenario 2: clienteId es null/undefined (menos probable)

**Evidencia:**
- Si `!clienteId` es true, muestra "No hay cliente_id configurado"
- Pero el usuario reporta un mensaje diferente

**Causa Posible:**
- localStorage.getItem('cliente_id') retorna null
- Usuario no ha iniciado sesión correctamente

**Solución:**
```javascript
// Verificar en console del navegador:
console.log('cliente_id:', localStorage.getItem('cliente_id'));
```

---

## 💡 Solución Implementada (Preventiva)

### 1. Añadir Console Logs para Debugging

**Archivo:** `frontend/src/components/whatsapp/SessionManager.jsx`

```javascript
const handleRequestQR = async () => {
  // LOG: Estado actual antes de validar
  const currentState = session?.status;
  console.log('[QR] Solicitando QR - Estado actual:', currentState);
  console.log('[QR] Cliente ID:', clienteId);
  
  if (!clienteId) {
    console.error('[QR] BLOQUEADO: No hay cliente_id configurado');
    setError('No hay cliente_id configurado');
    return;
  }

  try {
    setLoading(true);
    setError(null);
    
    console.log('[QR] Llamando API: /api/whatsapp/' + clienteId + '/qr');
    const response = await sessionAPI.requestQR(clienteId);
    
    console.log('[QR] Response recibida:', response.status);
    
    // Backend retorna qr_string (no qr_code)
    setQrString(response.data.qr_string);
    setShowQRModal(true);
    
    // Actualizar sesión después de solicitar QR
    await loadSession();
    
  } catch (err) {
    console.error('[QR] Error al solicitar QR:', err);
    console.error('[QR] Response status:', err.response?.status);
    console.error('[QR] Response data:', err.response?.data);
    
    // Manejar errores específicos del contrato
    if (err.response?.status === 409) {
      setError('La sesión ya está conectada');
    } else if (err.response?.status === 403) {
      console.error('[QR] BLOQUEADO POR BACKEND: 403 Forbidden');
      setError('No estás autorizado para generar QR');
    } else if (err.response?.status === 404) {
      setError('Sesión no encontrada. Debe inicializarse primero.');
    } else if (err.response?.status === 500) {
      setError('Error al generar código QR');
    } else {
      setError(err.response?.data?.message || 'Error desconocido');
    }
    
    setShowQRModal(false);
  } finally {
    setLoading(false);
  }
};
```

### 2. Verificar Estado en loadSession()

```javascript
const loadSession = async () => {
  if (!clienteId) {
    console.error('[Session] No hay cliente_id configurado');
    setError('No hay cliente_id configurado');
    return;
  }

  try {
    console.log('[Session] Cargando estado para cliente:', clienteId);
    const response = await sessionAPI.getSession(clienteId);
    
    console.log('[Session] Estado recibido del backend:', response.data.state);
    
    // Backend retorna FLAT response: { state, connected, needs_qr }
    const whatsappState = response?.data?.state;
    
    // ... resto del código
  }
}
```

---

## 🧪 Plan de Validación

### Paso 1: Verificar Console Logs

Abrir DevTools → Console y hacer clic en "Generar QR":

**Esperado (si backend SÍ es llamado):**
```
[QR] Solicitando QR - Estado actual: qr_required
[QR] Cliente ID: 123
[QR] Llamando API: /api/whatsapp/123/qr
[QR] Error al solicitar QR: AxiosError {...}
[QR] Response status: 403
[QR] Response data: { ok: false, error: 'QR_NOT_AUTHORIZED', message: '...' }
[QR] BLOQUEADO POR BACKEND: 403 Forbidden
```

**Esperado (si clienteId es null):**
```
[QR] Solicitando QR - Estado actual: qr_required
[QR] Cliente ID: null
[QR] BLOQUEADO: No hay cliente_id configurado
```

### Paso 2: Verificar Network Tab

**DevTools → Network → XHR**

**Si aparece request:**
- URL: `/api/whatsapp/123/qr`
- Method: GET
- Status: 403 Forbidden
- Response: `{ ok: false, error: 'QR_NOT_AUTHORIZED' }`

**Si NO aparece request:**
- Indica que hay guard clause o error de JavaScript que previene la llamada
- Revisar Console para errores de sintaxis

### Paso 3: Verificar Base de Datos

```sql
-- Verificar registro de autorización
SELECT * FROM ll_whatsapp_qr_sessions 
WHERE cliente_id = (SELECT cliente_id FROM ll_usuarios WHERE usuario = 'TU_USUARIO');
```

**Casos:**
- No existe registro → crear con enabled = 1
- Existe con enabled = 0 → actualizar a enabled = 1
- Existe con revoked_at → poner revoked_at = NULL

---

## 🚀 Deployment

### Build y Deploy

```bash
cd /root/leadmaster-workspace/services/central-hub/frontend
npm run build
sudo cp -r dist/* /var/www/desarrolloydisenioweb/
```

### Verificación Post-Deploy

1. **Limpiar caché del navegador:**
   - Ctrl + Shift + Delete
   - Marcar "Cached images and files"
   - Clear data

2. **Hard refresh:**
   - Ctrl + Shift + R (Linux/Windows)
   - Cmd + Shift + R (Mac)

3. **Abrir DevTools ANTES de hacer clic:**
   - F12 → Console tab
   - F12 → Network tab → XHR filter

4. **Hacer clic en "Generar QR"**

5. **Revisar logs en tiempo real**

---

## 📊 Análisis de Estados

### Estados que DEBEN permitir generar QR

```javascript
// Estos estados deben llamar al backend sin restricciones:
const STATES_ALLOW_QR = [
  'QR_REQUIRED',    // Requiere QR explícitamente
  'DISCONNECTED',   // Desconectado, puede reconectar
  'ERROR'           // Error, puede reintentar
];
```

### Estados que NO deben generar QR

```javascript
// Estos estados deben bloquear la acción:
const STATES_BLOCK_QR = [
  'CONNECTED',      // Ya conectado
  'CONNECTING',     // En proceso de conexión
  'INITIALIZING'    // Inicializando
];
```

**Implementación Actual:**
El código NO valida estados antes de llamar al backend. La validación ocurre en el backend (línea 173-180 de whatsappQrController.js).

---

## 🔒 Sistema de Autorización

### Flujo Completo

```
1. Usuario hace clic en "Generar QR"
   ↓
2. Frontend llama: GET /api/whatsapp/:clienteId/qr
   ↓
3. NGINX strip /api → /whatsapp/:clienteId/qr
   ↓
4. Central Hub proxy → Session Manager
   ↓
5. Session Manager valida:
   a) Existe cliente_id en BD?
   b) Registro en ll_whatsapp_qr_sessions?
   c) enabled = 1?
   d) revoked_at IS NULL?
   ↓
6a. SI autorizado → Genera QR → 200 OK
6b. NO autorizado → 403 Forbidden
```

### Tabla de Decisión

| Condición | enabled | revoked_at | Resultado |
|-----------|---------|------------|-----------|
| Sin registro | - | - | 403 ❌ |
| enabled = 0 | 0 | NULL | 403 ❌ |
| enabled = 1, revocado | 1 | 2026-01-05 | 403 ❌ |
| enabled = 1, activo | 1 | NULL | 200 ✅ |

---

## 📝 Recomendaciones

### Inmediatas

1. **Verificar localStorage:**
   ```javascript
   console.log('cliente_id:', localStorage.getItem('cliente_id'));
   ```

2. **Verificar autorización en BD:**
   ```sql
   SELECT * FROM ll_whatsapp_qr_sessions WHERE cliente_id = ?;
   ```

3. **Revisar console logs con código actualizado:**
   - Desplegar versión con logs
   - Reproducir el bug
   - Capturar output completo

### Mediano Plazo

1. **Mensajes de error más descriptivos:**
   ```javascript
   if (err.response?.status === 403) {
     const errorCode = err.response?.data?.error;
     if (errorCode === 'QR_NOT_AUTHORIZED') {
       setError('Tu cuenta no está autorizada para usar WhatsApp. Contacta al administrador.');
     } else {
       setError('No estás autorizado para generar QR');
     }
   }
   ```

2. **Endpoint de diagnóstico:**
   ```javascript
   GET /api/whatsapp/:clienteId/authorization
   → { authorized: true/false, reason: 'NO_RECORD' | 'DISABLED' | 'REVOKED' }
   ```

3. **UI que muestra estado de autorización:**
   ```jsx
   {!authorized && (
     <Alert variant="warning">
       Tu cuenta no está autorizada para usar WhatsApp.
       <Button onClick={requestAuthorization}>Solicitar Autorización</Button>
     </Alert>
   )}
   ```

### Largo Plazo

1. **Self-service authorization:**
   - Formulario para solicitar acceso
   - Notificación a admin
   - Aprobación/rechazo con razón

2. **Audit log:**
   - Registrar todos los intentos de generar QR
   - Timestamp, cliente_id, resultado (success/denied)

3. **Rate limiting:**
   - Máximo 5 intentos por hora
   - Prevenir abuso de endpoint

---

## 🐛 Troubleshooting Checklist

### Frontend

- [ ] localStorage tiene cliente_id válido
- [ ] Console muestra logs de [QR] al hacer clic
- [ ] Network tab muestra request XHR a /api/whatsapp/*/qr
- [ ] Request incluye header Authorization: Bearer <token>
- [ ] No hay errores de JavaScript en console

### Backend

- [ ] PM2 logs no muestran errores en session-manager
- [ ] PM2 logs no muestran errores en central-hub
- [ ] Endpoint /api/whatsapp/:clienteId/status retorna 200
- [ ] Endpoint /api/whatsapp/:clienteId/qr retorna 403 (no 500)

### Base de Datos

- [ ] Tabla ll_whatsapp_qr_sessions existe
- [ ] Registro para cliente_id existe
- [ ] Campo enabled = 1
- [ ] Campo revoked_at IS NULL

### NGINX

- [ ] Config strip /api prefix correctamente
- [ ] Proxy_pass a 127.0.0.1:3012
- [ ] No hay 502 Bad Gateway

---

## 📚 Referencias

### Archivos Involucrados

**Frontend:**
- `frontend/src/components/whatsapp/SessionManager.jsx` - Componente principal
- `frontend/src/services/api.js` - sessionAPI.requestQR()
- `frontend/src/constants/sessionStatus.js` - Constantes de estados

**Backend:**
- `src/routes/whatsappQrController.js` - Endpoint GET /qr
- `src/modules/whatsappQrAuthorization/services/qrAuthorizationService.js` - Lógica de autorización
- `src/modules/whatsappQrAuthorization/repositories/qrAuthorizationRepository.js` - Acceso a BD

**Infraestructura:**
- `/etc/nginx/sites-available/desarrolloydisenioweb.com` - Config NGINX
- `ecosystem.config.js` - Config PM2

### Documentos Relacionados

- `CHECKLIST_QR_AUTHORIZATION.md` - Checklist de autorización QR
- `BUGFIX_FRONTEND_WHATSAPP_API.md` - Fix previo de respuestas API
- `FRONTEND_CONTRACT_MIGRATION.md` - Migración de contratos

---

## ✅ Checklist de Validación

### Pre-Deploy
- [x] Código modificado con console.logs
- [ ] Build exitoso sin warnings
- [ ] Cambios commiteados

### Post-Deploy
- [ ] Frontend desplegado a producción
- [ ] Caché del navegador limpiado
- [ ] DevTools abierto (Console + Network)
- [ ] Clic en "Generar QR" realizado
- [ ] Console logs capturados
- [ ] Network XHR verificado

### Verificación de Causa
- [ ] Console muestra logs [QR]
- [ ] Network muestra request XHR (SÍ/NO)
- [ ] Si hay request: status code identificado
- [ ] Si NO hay request: error de JS identificado
- [ ] BD verificada para cliente_id

### Resolución
- [ ] Causa raíz identificada
- [ ] Fix aplicado (frontend o BD)
- [ ] Test manual exitoso
- [ ] QR se genera y muestra correctamente

---

## 🎯 Conclusión

El análisis del código muestra que **NO existe guard clause en el frontend** que prevenga la llamada al backend. El mensaje "No estás autorizado para generar QR" proviene del bloque catch cuando el backend retorna 403 Forbidden.

**Hipótesis más probable:**
El backend SÍ está siendo llamado pero retorna 403 porque el registro en `ll_whatsapp_qr_sessions` no existe, tiene `enabled = 0`, o tiene `revoked_at` poblado.

**Próximos pasos:**
1. Desplegar versión con console.logs
2. Reproducir el bug con DevTools abierto
3. Verificar si aparece request XHR
4. Si aparece con 403 → verificar BD
5. Si NO aparece → verificar localStorage.cliente_id

---

**Desarrollador:** GitHub Copilot (Claude Sonnet 4.5)  
**Fecha de Análisis:** 2026-01-08  
**Estado:** Esperando validación con logs en producción

---

**Fin del Informe**
