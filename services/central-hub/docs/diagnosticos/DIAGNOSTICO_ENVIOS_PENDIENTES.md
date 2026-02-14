# DIAGNÓSTICO: Mensajes WhatsApp Quedan en Estado `pendiente`

**Fecha**: 2026-01-13  
**Analista**: GitHub Copilot (Claude Sonnet 4.5)  
**Proyecto**: LeadMaster - Central Hub  
**Severidad**: 🔴 CRÍTICA - Sistema bloqueado para envíos programados

---

## 🎯 RESUMEN EJECUTIVO

**Problema**: Los registros se insertan correctamente en `ll_envios_whatsapp` con estado `pendiente`, pero nunca se envían por WhatsApp.

**Causa raíz identificada**: **INCOMPATIBILIDAD DE ARQUITECTURA ENTRE SERVICIOS**

- El `programacionScheduler` busca sesiones con instanceId `sender_{clienteId}` 
- El `session-manager` solo acepta conexión directa vía header `X-Cliente-Id`
- **NO existe ninguna ruta REST para consultar sesiones por instanceId**
- El session-manager NO tiene rutas bajo `/api/session-manager/*`

**Resultado**: El scheduler aborta todas las ejecuciones con error `SessionNotFoundError` porque la API que intenta consumir **no existe**.

---

## 🔍 ANÁLISIS TÉCNICO DETALLADO

### 1. Flujo Actual (REAL)

```
┌─────────────────────────────────────────────────────────────────┐
│ CENTRAL HUB (Puerto 3012)                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────┐            │
│  │ programacionScheduler.js                        │            │
│  │ - Se ejecuta cada 60 segundos                   │            │
│  │ - Lee ll_programaciones (estado='aprobada')     │            │
│  │ - Lee ll_envios_whatsapp (estado='pendiente')   │            │
│  └───────────────────┬─────────────────────────────┘            │
│                      │                                           │
│                      ▼                                           │
│  ┌─────────────────────────────────────────────────┐            │
│  │ sessionManagerClient.getSession(instanceId)     │            │
│  │ instanceId = "sender_51"                        │            │
│  │                                                  │            │
│  │ REQUEST:                                         │            │
│  │ GET http://localhost:3001/api/session-manager/  │  ❌ FALLA  │
│  │     sessions/sender_51                          │            │
│  └───────────────────┬─────────────────────────────┘            │
│                      │                                           │
│                      ▼                                           │
│            ⛔ Error ECONNREFUSED                                 │
│            (puerto 3001 NO existe)                              │
│                                                                  │
│  RESULTADO: Programación ABORTADA                               │
│  LOG: "⏸️ Programación X ABORTADA: Sesión no existe             │
│       para cliente 51. Debe inicializarse primero."             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ SESSION MANAGER (Puerto 3011 - NO 3001)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Rutas REALES disponibles:                                      │
│  - GET  /health            ✅ Funciona                          │
│  - GET  /status            ✅ Con header X-Cliente-Id           │
│  - GET  /qr                ✅ Con header X-Cliente-Id           │
│  - GET  /qr-code           ✅ Con header X-Cliente-Id           │
│  - POST /send              ✅ Con header X-Cliente-Id           │
│                                                                  │
│  Rutas que NO EXISTEN:                                          │
│  - GET /api/session-manager/sessions/{instanceId}  ❌           │
│  - POST /api/session-manager/sessions/{instanceId}/qr ❌        │
│                                                                  │
│  ARQUITECTURA REAL:                                             │
│  - Multi-client singleton (Map<clienteId, session>)            │
│  - Header-based routing (X-Cliente-Id)                          │
│  - SIN rutas RESTful por instanceId                             │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Variables de Configuración Críticas

```bash
# Central Hub (.env)
SESSION_MANAGER_BASE_URL=http://localhost:3001  ❌ PUERTO INCORRECTO

# Session Manager (real)
PORT=3011  ✅ Puerto real donde corre
```

**Problema adicional**: Mismatch de puertos:
- Central Hub apunta a: `http://localhost:3001`
- Session Manager corre en: `http://localhost:3011`

### 3. Código Relevante

#### A. Scheduler intenta obtener sesión (PASO QUE FALLA)

**Archivo**: `src/modules/sender/services/programacionScheduler.js:104-130`

```javascript
async function procesarProgramacion(programacion) {
  const clienteId = Number(programacion.cliente_id);
  const instanceId = `sender_${clienteId}`;  // ← "sender_51"

  // PASO 1: Consultar estado de sesión (OBLIGATORIO según contrato)
  let session;
  try {
    session = await sessionManagerClient.getSession(instanceId); // ← FALLA AQUÍ
  } catch (error) {
    if (error instanceof SessionNotFoundError) {
      console.warn(
        `⏸️  Programación ${programacion.id} ABORTADA: ` +
        `Sesión no existe para cliente ${clienteId}. Debe inicializarse primero.`
      );
      return;  // ← Aborta y NUNCA envía mensajes
    }
    // ... más manejo de errores
  }
  
  // Este código NUNCA se ejecuta porque getSession() siempre falla
  // ...
}
```

#### B. Cliente intenta llamar endpoint inexistente

**Archivo**: `src/integrations/sessionManager/sessionManagerClient.js:256-280`

```javascript
async getSession(instanceId) {
  try {
    // ❌ Esta ruta NO EXISTE en session-manager
    const response = await this._fetchWithTimeout(
      `/api/session-manager/sessions/${instanceId}`,  // ← RUTA INEXISTENTE
      { method: 'GET' }
    );

    if (response.ok) {
      const session = await response.json();
      return session;
    }
    
    // Como la ruta no existe, cae en ECONNREFUSED
    // por mismatch de puerto (3001 vs 3011)
  } catch (error) {
    // Se lanza SessionNotFoundError
    throw new SessionNotFoundError(
      `Sesión ${instanceId} no encontrada en Session Manager`
    );
  }
}
```

#### C. Session Manager - Rutas REALES

**Archivo**: `services/session-manager/app.js:20-24`

```javascript
// Rutas que SÍ existen
app.use('/health', healthRouter);
app.use('/status', statusRouter);    // GET /status + header X-Cliente-Id
app.use('/send', sendRouter);        // POST /send + header X-Cliente-Id
app.use('/qr', qrRouter);            // GET /qr + header X-Cliente-Id
app.use('/qr-code', qrCodeRouter);   // GET /qr-code + header X-Cliente-Id

// NO hay rutas bajo /api/session-manager/*
```

### 4. Estado Real del Sistema

```bash
# Servicio session-manager ESTÁ funcionando
$ curl http://localhost:3011/status -H "X-Cliente-Id: 51"
{
  "ok": true,
  "cliente_id": 51,
  "state": "READY",
  "connected": true,
  "can_send_messages": true
}
```

**Confirmado**: La sesión de WhatsApp del cliente 51 está en estado `READY` y puede enviar mensajes.

**Problema**: El scheduler NO PUEDE verificar este estado porque usa una API incompatible.

### 5. Logs Actuales (Evidence)

```
[PM2] leadmaster-central-hub - Error Log (últimos 50 minutos)
─────────────────────────────────────────────────────────────
12:48:32 [SessionManager] ❌ Sesión no encontrada: sender_51
12:48:32 ⏸️  Programación 40 ABORTADA: Sesión no existe para cliente 51
12:49:32 [SessionManager] ❌ Sesión no encontrada: sender_51
12:49:32 ⏸️  Programación 1 ABORTADA: Sesión no existe para cliente 51
12:49:32 [SessionManager] ❌ Sesión no encontrada: sender_51
12:49:32 ⏸️  Programación 39 ABORTADA: Sesión no existe para cliente 51
...
(Se repite cada 60 segundos para 3 programaciones activas)
```

**Interpretación**: El scheduler está EJECUTÁNDOSE correctamente, pero falla en validación de sesión y aborta ANTES de enviar cualquier mensaje.

---

## 🔧 DIAGNÓSTICO DE COMPONENTES

### ✅ Componentes que FUNCIONAN correctamente

1. **Scheduler** (`programacionScheduler.js`)
   - Se inicia automáticamente al arrancar central-hub
   - Ejecuta tick cada 60 segundos
   - Lee programaciones de DB correctamente
   - Valida ventanas de tiempo
   - Valida cupos diarios

2. **Session Manager** (`session-manager` servicio)
   - Corre en PM2 (puerto 3011)
   - WhatsApp Web conectado (cliente 51 en estado READY)
   - Responde a GET /status con X-Cliente-Id
   - **PUEDE enviar mensajes** (endpoint POST /send funciona)

3. **Base de Datos**
   - Tabla `ll_programaciones`: 3 programaciones activas (estado='aprobada')
   - Tabla `ll_envios_whatsapp`: registros insertados correctamente
   - Estado inicial: `pendiente`

### ❌ Componentes ROTOS / Incompatibles

1. **sessionManagerClient.getSession()**
   - Intenta llamar endpoint que NO existe
   - Puerto configurado incorrectamente (3001 vs 3011)
   - Arquitectura REST incompatible con session-manager

2. **Contrato de Integración**
   - Central Hub espera API RESTful con instanceId en URL
   - Session Manager solo acepta headers X-Cliente-Id
   - NO hay puente entre ambas arquitecturas

---

## 💡 SOLUCIÓN PROPUESTA

### Opción 1: ADAPTADOR (Recomendada - Mínimo Impacto)

**Cambio requerido**: Crear wrapper en `sessionManagerClient` que traduzca entre arquitecturas.

**Ventajas**:
- No modifica session-manager (servicio estable)
- No modifica programacionScheduler (lógica de negocio intacta)
- Solo cambios en capa de integración

**Archivos a modificar**: 1 archivo

```javascript
// src/integrations/sessionManager/sessionManagerClient.js

async getSession(instanceId) {
  // Extraer clienteId del instanceId
  // "sender_51" → 51
  const match = instanceId.match(/sender_(\d+)/);
  if (!match) {
    throw new SessionManagerValidationError(
      `instanceId inválido. Formato esperado: sender_{clienteId}, recibido: ${instanceId}`
    );
  }
  
  const clienteId = parseInt(match[1], 10);
  
  // Llamar al endpoint REAL de session-manager
  try {
    const response = await this._fetchWithTimeout('/status', {
      method: 'GET',
      headers: {
        'X-Cliente-Id': String(clienteId)
      }
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new SessionNotFoundError(
          `Sesión no encontrada para cliente ${clienteId}`
        );
      }
      throw new Error(`HTTP ${response.status}`);
    }
    
    const status = await response.json();
    
    // Traducir respuesta de /status a formato esperado por scheduler
    return {
      instance_id: instanceId,
      cliente_id: clienteId,
      status: status.state === 'READY' ? 'connected' : 'disconnected',
      phone_number: null, // session-manager no expone este dato actualmente
      qr_status: status.needs_qr ? 'pending' : 'none',
      last_error_message: null
    };
    
  } catch (error) {
    throw new SessionManagerUnreachableError(
      `No se pudo obtener estado de sesión: ${error.message}`
    );
  }
}

async sendMessage({ clienteId, to, message }) {
  // Ya funciona correctamente con header X-Cliente-Id
  try {
    const response = await this._fetchWithTimeout('/send', {
      method: 'POST',
      headers: {
        'X-Cliente-Id': String(clienteId)
      },
      body: JSON.stringify({ to, message })
    });
    
    if (!response.ok) {
      // ... manejo de errores existente
    }
    
    return await response.json();
  } catch (error) {
    throw error;
  }
}
```

**Configuración adicional requerida**:

```bash
# .env en central-hub
SESSION_MANAGER_BASE_URL=http://localhost:3011  # ← Corregir puerto
```

### Opción 2: REFACTOR COMPLETO (No recomendado - Alto riesgo)

Migrar session-manager a arquitectura RESTful con rutas `/api/session-manager/sessions/{instanceId}`.

**Desventajas**:
- Requiere modificar 5+ archivos en session-manager
- Rompe proxy público de WhatsApp (whatsappQrProxy.js)
- Requiere testing extensivo
- Mayor tiempo de implementación

---

## 🚀 PASOS DE IMPLEMENTACIÓN (Opción 1)

### Cambio Mínimo Viable (10 minutos)

1. **Corregir puerto en configuración**
   ```bash
   cd /root/leadmaster-workspace/services/central-hub
   sed -i 's/SESSION_MANAGER_BASE_URL=http:\/\/localhost:3001/SESSION_MANAGER_BASE_URL=http:\/\/localhost:3011/' .env
   ```

2. **Modificar `sessionManagerClient.getSession()`**
   - Cambiar endpoint de `/api/session-manager/sessions/{instanceId}` a `/status`
   - Agregar header `X-Cliente-Id: {extractedClienteId}`
   - Mapear respuesta de `/status` a formato esperado

3. **Verificar `sessionManagerClient.sendMessage()`**
   - Ya usa `/send` con header correcto
   - Solo verificar que use puerto correcto

4. **Reiniciar servicio**
   ```bash
   pm2 restart leadmaster-central-hub
   ```

5. **Verificar logs en tiempo real**
   ```bash
   pm2 logs leadmaster-central-hub --lines 20
   ```

### Validación de Éxito

**Comportamiento esperado después del fix**:

```
✅ Programación 1: Sesión verificada (cliente 51, estado: READY)
🕒 Programación 1: Enviando 5 mensajes
[SessionManager] ✅ Mensaje enviado a 5491134567890@c.us
📊 Programación 1: Completado (5 enviados, 0 fallidos)
```

**Queries para validar**:

```sql
-- Verificar que estado cambió a 'enviado'
SELECT id, estado, fecha_envio 
FROM ll_envios_whatsapp 
WHERE estado = 'enviado' 
ORDER BY fecha_envio DESC 
LIMIT 10;

-- Contar pendientes restantes
SELECT COUNT(*) as pendientes 
FROM ll_envios_whatsapp 
WHERE estado = 'pendiente';
```

---

## 📊 DIAGRAMA: Flujo Esperado vs Flujo Real

### Flujo Esperado (POST-FIX)

```
Scheduler → getSession() → /status (header)
         ↓
      READY?
         ↓ YES
    Read Pending
         ↓
    sendMessage() → /send (header)
         ↓
   UPDATE enviado
```

### Flujo Real (ANTES DEL FIX)

```
Scheduler → getSession() → /api/.../sessions/... (inexistente)
         ↓
    ECONNREFUSED
         ↓
    ABORT
         ↓
 Registros quedan en 'pendiente' ∞
```

---

## ⚠️ PREGUNTAS PENDIENTES

### 1. ¿Por qué se configuró puerto 3001 si usa 3011?

**Respuesta probable**: Copy-paste de documentación desactualizada o cambio de puerto no sincronizado en .env.

**Acción**: Auditar toda referencia a 3001 en el proyecto.

### 2. ¿Quién inserta los registros en `ll_envios_whatsapp`?

**Respuesta**: Probablemente un módulo de creación de campañas o import masivo. NO es el scheduler (solo los CONSUME).

**Acción**: Documentar flujo completo desde creación de campaña hasta envío.

### 3. ¿Existen otros módulos afectados por esta incompatibilidad?

**Posibles afectados**:
- Listener (respuestas automáticas) ← VERIFICAR
- Sync Contacts ← VERIFICAR

**Acción**: Grep de `sessionManagerClient.getSession` en todo el proyecto.

---

## 📝 CONCLUSIÓN

**Raíz del problema**: Mismatch arquitectural entre dos servicios desarrollados en paralelo sin contrato API unificado.

**Severidad real**: CRÍTICA - Sistema completamente bloqueado para envíos programados.

**Tiempo de resolución estimado**: 
- Fix mínimo: 10 minutos
- Testing: 5 minutos
- Despliegue: 2 minutos
- **Total**: < 20 minutos

**Causa raíz organizacional**: 
- Falta de contrato API formal entre servicios
- .env no validado en CI/CD
- No hay test de integración entre central-hub y session-manager

**Recomendaciones futuras**:
1. Crear contrato OpenAPI/Swagger para session-manager
2. Agregar health checks que validen conectividad entre servicios
3. Test de integración que valide flujo completo de envío
4. Documentar arquitectura multi-servicio

---

**Documento generado**: 2026-01-13 13:05:00 UTC-6  
**Siguiente acción**: Implementar Opción 1 (Adaptador)
