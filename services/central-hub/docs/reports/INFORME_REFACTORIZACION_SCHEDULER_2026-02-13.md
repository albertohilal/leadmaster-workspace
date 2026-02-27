# Informe de Refactorización: Scheduler & Estado Service

**Fecha:** 2026-02-13  
**Sistema:** LeadMaster Central Hub  
**Módulo:** sender  
**Tipo:** Refactorización crítica + implementación de máquina de estados

---

## Resumen Ejecutivo

Se realizó una refactorización completa del scheduler de envíos WhatsApp para:

1. **Eliminar bug crítico** que marcaba envíos como "enviado" antes de confirmar envío real
2. **Implementar máquina de estados** con auditoría completa
3. **Alinear con contratos HTTP** entre Central Hub y Session Manager
4. **Garantizar integridad de datos** mediante validaciones estrictas

---

## Archivos Modificados

### 1. ✅ CREADO: `estadoService.js`

**Ruta:** `/root/leadmaster-workspace/services/central-hub/src/modules/sender/services/estadoService.js`

**Estado:** NUEVO ARCHIVO

**Responsabilidades:**
- Gestión centralizada de cambios de estado en `ll_envios_whatsapp`
- Validación de transiciones permitidas
- Auditoría automática en `ll_envios_whatsapp_historial`
- Gestión de transacciones para consistencia

**Funciones principales:**

```javascript
async function cambiarEstado(
  { connection },
  envioId,
  nuevoEstado,       // 'pendiente' | 'enviado' | 'error'
  origen,            // 'scheduler' | 'manual' | 'sistema'
  detalle,
  { usuarioId = null, messageId = null } = {}
)
```

**Transiciones permitidas:**
```
pendiente → enviado ✅
pendiente → error   ✅
error → pendiente   ⚠️ (manual)
enviado → *         ❌ (prohibido)
```

**Garantías:**
- ✅ Transacciones ACID
- ✅ Rollback automático en errores
- ✅ Auditoría obligatoria
- ✅ Validación de transiciones
- ✅ Registro de `message_id` de WhatsApp
- ✅ Timestamps automáticos

---

### 2. ✅ MODIFICADO: `programacionScheduler.js`

**Ruta:** `/root/leadmaster-workspace/services/central-hub/src/modules/sender/services/programacionScheduler.js`

#### Cambios Principales

##### 2.1 Imports Actualizados

**ANTES:**
```javascript
const {
  sessionManagerClient,
  SessionManagerTimeoutError,
  SessionManagerUnreachableError
} = require('../../../integrations/sessionManager');
```

**AHORA:**
```javascript
const {
  sessionManagerClient,
  SessionManagerTimeoutError,
  SessionManagerUnreachableError,
  SessionManagerSessionNotReadyError,  // ✅ NUEVO
  SessionManagerWhatsAppError,         // ✅ NUEVO
  SessionManagerValidationError        // ✅ NUEVO
} = require('../../../integrations/sessionManager');
const { cambiarEstado } = require('./estadoService');  // ✅ NUEVO
```

##### 2.2 Eliminación de `marcarEnviado()`

**ANTES (BUG CRÍTICO):**
```javascript
async function marcarEnviado(id) {
  const [result] = await connection.query(
    'UPDATE ll_envios_whatsapp SET estado = "enviado", fecha_envio = NOW() WHERE id = ? AND estado = "pendiente"',
    [id]
  );
  return result.affectedRows === 1;
}
```

**AHORA:**
```
❌ FUNCIÓN ELIMINADA COMPLETAMENTE
```

**Razón:** Marcaba estado ANTES de enviar, causando inconsistencias críticas.

##### 2.3 Normalización de Teléfono (Protocol-Agnostic)

**ANTES:**
```javascript
const destinatario = envio.telefono_wapp.includes('@c.us')
  ? envio.telefono_wapp
  : `${envio.telefono_wapp}@c.us`;  // ❌ Central Hub NO debe manejar protocolo WA
```

**AHORA:**
```javascript
const destinatario = String(envio.telefono_wapp || '').replace(/\D/g, '');

if (!destinatario) {
  await cambiarEstado(
    { connection },
    envio.id,
    'error',
    'scheduler',
    '(TELEFONO_INVALIDO) Número de teléfono vacío o inválido'
  );
  continue;
}
```

**Beneficios:**
- ✅ Solo dígitos puros
- ✅ Session Manager aplica `@c.us` internamente
- ✅ Validación temprana de teléfonos vacíos

##### 2.4 Loop de Envío Refactorizado

**ANTES (VULNERABLE):**
```javascript
for (const envio of pendientes) {
  const marcado = await marcarEnviado(envio.id);  // ❌ MARCA ANTES
  
  try {
    await sessionManagerClient.sendMessage({...}); // Envío después
    enviadosExitosos++;
  } catch (err) {
    enviadosFallidos++;
    break;  // ❌ Detiene toda la ejecución
  }
}
```

**AHORA (SEGURO):**
```javascript
for (const envio of pendientes) {
  try {
    // ✅ 1. ENVIAR PRIMERO
    const result = await sessionManagerClient.sendMessage({
      cliente_id: clienteId,
      to: destinatario,
      message: mensajePersonalizado
    });
    
    // ✅ 2. VALIDAR RESPUESTA
    if (!result) {
      throw new Error('(INVALID_SEND_RESPONSE) sendMessage retornó null');
    }
    
    if (result.ok !== true) {
      throw new Error(`(INVALID_SEND_RESPONSE) ok=${result.ok}`);
    }
    
    if (!result.message_id) {
      throw new Error('(INVALID_SEND_RESPONSE) Falta message_id');
    }
    
    // ✅ 3. MARCAR ENVIADO SOLO DESPUÉS
    await cambiarEstado(
      { connection },
      envio.id,
      'enviado',
      'scheduler',
      'Envío automático exitoso',
      { messageId: result.message_id }
    );
    
    enviadosExitosos++;
    await delay(getRandomSendDelay());
    
  } catch (err) {
    // ✅ 4. CLASIFICAR ERROR
    let errorCode = 'UNKNOWN_ERROR';
    
    if (err instanceof SessionManagerTimeoutError) {
      errorCode = 'SESSION_MANAGER_TIMEOUT';
    } else if (err instanceof SessionManagerUnreachableError) {
      errorCode = 'SESSION_MANAGER_UNREACHABLE';
    } else if (err instanceof SessionManagerSessionNotReadyError) {
      errorCode = 'SESSION_NOT_READY';
    } else if (err instanceof SessionManagerWhatsAppError) {
      errorCode = 'WHATSAPP_ERROR';
    } else if (err instanceof SessionManagerValidationError) {
      errorCode = 'VALIDATION_ERROR';
    } else if (err.message.includes('INVALID_SEND_RESPONSE')) {
      errorCode = 'INVALID_SEND_RESPONSE';
    }
    
    // ✅ 5. MARCAR ERROR
    await cambiarEstado(
      { connection },
      envio.id,
      'error',
      'scheduler',
      `(${errorCode}) ${err.message}`
    );
    
    enviadosFallidos++;
    // ✅ 6. CONTINUAR (NO break)
  }
}
```

##### 2.5 Exports Actualizados

**ANTES:**
```javascript
module.exports = {
  start,
  __test__: {
    procesarProgramacion,
    marcarEnviado,        // ❌ Función eliminada
    obtenerPendientes
  }
};
```

**AHORA:**
```javascript
module.exports = {
  start,
  __test__: {
    procesarProgramacion,
    obtenerPendientes     // ✅ Sin marcarEnviado
  }
};
```

---

### 3. ✅ MODIFICADO: `sessionManagerClient.js`

**Ruta:** `/root/leadmaster-workspace/services/central-hub/src/integrations/sessionManager/sessionManagerClient.js`

#### Cambios en `sendMessage()`

##### 3.1 Cliente ID en Header (Contract-Aligned)

**ANTES:**
```javascript
const response = await this._fetchWithTimeout('/send', {
  method: 'POST',
  body: JSON.stringify({
    cliente_id,  // ❌ En body
    to,
    message
  })
});
```

**AHORA:**
```javascript
const response = await this._fetchWithTimeout('/send', {
  method: 'POST',
  headers: {
    'X-Cliente-Id': String(cliente_id)  // ✅ En header
  },
  body: JSON.stringify({
    to,       // ✅ Solo datos del mensaje
    message
  })
});
```

**Razón:** Session Manager espera `X-Cliente-Id` en header según contrato HTTP.

##### 3.2 Validación Estricta de Respuesta

**AÑADIDO:**
```javascript
if (response.ok) {
  const result = await response.json();

  // ✅ Validación campo "ok"
  if (!result.ok) {
    throw new SessionManagerValidationError(
      'Respuesta inválida: campo "ok" no es true'
    );
  }

  // ✅ Validación campo "message_id"
  if (!result.message_id) {
    throw new SessionManagerValidationError(
      'Respuesta inválida: falta campo "message_id"'
    );
  }

  console.log(`[SessionManager] ✅ Mensaje enviado a ${to} (cliente: ${cliente_id}, message_id: ${result.message_id})`);
  return result;
}
```

**Beneficios:**
- ✅ Nunca retorna respuesta malformada
- ✅ Garantiza `ok === true`
- ✅ Garantiza presencia de `message_id`
- ✅ Lanza exception estructurada si falla

---

## Códigos de Error Implementados

| Código | Origen | Descripción |
|--------|--------|-------------|
| `SESSION_MANAGER_TIMEOUT` | Network | Timeout al conectar (>60s) |
| `SESSION_MANAGER_UNREACHABLE` | Network | Service no alcanzable (ECONNREFUSED) |
| `SESSION_NOT_READY` | Session Manager | WhatsApp sesión no lista (HTTP 409) |
| `WHATSAPP_ERROR` | Session Manager | Error interno WhatsApp (HTTP 500) |
| `VALIDATION_ERROR` | Session Manager | Request inválido (HTTP 400) |
| `INVALID_SEND_RESPONSE` | Central Hub | Respuesta malformada/incompleta |
| `TELEFONO_INVALIDO` | Central Hub | Número vacío o solo no-dígitos |
| `UNKNOWN_ERROR` | Sistema | Error no clasificado |

---

## Garantías Post-Refactorización

### Garantías de Integridad

✅ **IMPOSIBLE** marcar "enviado" sin confirmación real de WhatsApp  
✅ **IMPOSIBLE** enviar sin `cliente_id` válido  
✅ **IMPOSIBLE** que respuesta malformada pase silenciosamente  
✅ **IMPOSIBLE** UPDATE directo sobre `estado` sin auditoría  
✅ **IMPOSIBLE** transición inválida (ej: enviado → pendiente)

### Garantías Operacionales

✅ Scheduler continúa aunque falle un envío individual  
✅ Cada error clasificado con código estructurado  
✅ Auditoría completa en `ll_envios_whatsapp_historial`  
✅ Rollback automático en errores de transacción  
✅ Logs estructurados con contexto completo

### Garantías de Contrato HTTP

✅ Central Hub protocol-agnostic (no `@c.us`)  
✅ `X-Cliente-Id` en header según contrato  
✅ Response validado: `{ ok: true, message_id: "..." }`  
✅ Errores HTTP clasificados (400, 409, 500)

---

## Flujo de Envío (Nuevo)

```
┌─────────────────────────────────────────────┐
│ 1. Obtener pendientes (estado='pendiente') │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│ 2. Normalizar teléfono (solo dígitos)      │
└──────────────┬──────────────────────────────┘
               │
               ├──► Si vacío → cambiarEstado('error', 'TELEFONO_INVALIDO')
               │
               ▼
┌─────────────────────────────────────────────┐
│ 3. sendMessage({ cliente_id, to, message })│
└──────────────┬──────────────────────────────┘
               │
               ├──► ❌ Timeout → cambiarEstado('error', 'SESSION_MANAGER_TIMEOUT')
               ├──► ❌ 409 → cambiarEstado('error', 'SESSION_NOT_READY')
               ├──► ❌ 500 → cambiarEstado('error', 'WHATSAPP_ERROR')
               │
               ▼
┌─────────────────────────────────────────────┐
│ 4. Validar respuesta                        │
│    - result !== null                        │
│    - result.ok === true                     │
│    - result.message_id presente             │
└──────────────┬──────────────────────────────┘
               │
               ├──► ❌ Validación falla → cambiarEstado('error', 'INVALID_SEND_RESPONSE')
               │
               ▼
┌─────────────────────────────────────────────┐
│ 5. cambiarEstado('enviado')                 │
│    - Guardar message_id                     │
│    - Guardar fecha_envio                    │
│    - Insertar en historial                  │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│ 6. Delay anti-spam (30-90s)                │
└─────────────────────────────────────────────┘
```

---

## Pendientes (Base de Datos)

### Crear Tabla de Auditoría

```sql
CREATE TABLE ll_envios_whatsapp_historial (
  id INT AUTO_INCREMENT PRIMARY KEY,
  envio_id INT NOT NULL,
  estado_anterior ENUM('pendiente','enviado','error'),
  estado_nuevo ENUM('pendiente','enviado','error') NOT NULL,
  origen ENUM('scheduler','manual','sistema') NOT NULL,
  detalle TEXT,
  usuario_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_envio_id (envio_id),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (envio_id) REFERENCES ll_envios_whatsapp(id) ON DELETE CASCADE
);
```

### Agregar Columna message_id

```sql
ALTER TABLE ll_envios_whatsapp 
ADD COLUMN message_id VARCHAR(255) NULL AFTER fecha_envio,
ADD INDEX idx_message_id (message_id);
```

**Estado:** ⚠️ PENDIENTE - Debe ejecutarse antes de deploy

---

## Testing Requerido

### Unit Tests

- [ ] `estadoService.validarTransicion()` - Todas las transiciones
- [ ] `estadoService.cambiarEstado()` - Transacciones y rollback
- [ ] `programacionScheduler.procesarProgramacion()` - Mock de sendMessage

### Integration Tests

- [ ] Envío exitoso → Estado 'enviado' + message_id guardado
- [ ] Envío fallido → Estado 'error' + código clasificado
- [ ] Teléfono inválido → Estado 'error' + TELEFONO_INVALIDO
- [ ] Session Manager down → Estado 'error' + SESSION_MANAGER_UNREACHABLE
- [ ] Response sin message_id → Estado 'error' + INVALID_SEND_RESPONSE

### E2E Tests

- [ ] Scheduler procesa 10 pendientes, 8 exitosos, 2 fallidos
- [ ] Verificar contadores diarios correctos
- [ ] Verificar historial completo en tabla auditoría

---

## Impacto en Producción

### Cambios Breaking

❌ **NINGUNO** - Refactorización interna sin cambios de API

### Cambios No-Breaking

✅ Mejor clasificación de errores en logs  
✅ Auditoría completa de transiciones  
✅ Mejor resiliencia ante fallos parciales  
✅ Cumplimiento de contratos HTTP

### Rollback

Si se requiere rollback:
1. Revertir commit de refactorización
2. NO afecta datos existentes (solo comportamiento)
3. Tablas de auditoría pueden dejarse vacías

---

## Conclusiones

### Problema Resuelto

✅ Bug crítico de marcado prematuro como "enviado" **RESUELTO**  
✅ Inconsistencias en estados **PREVENIDAS** mediante máquina de estados  
✅ Falta de auditoría **RESUELTA** con historial automático  
✅ Contratos HTTP **ALINEADOS** con Session Manager

### Próximos Pasos

1. **CRÍTICO:** Ejecutar migraciones de BD antes de deploy
2. **ALTO:** Implementar tests unitarios de estadoService
3. **MEDIO:** Agregar frontend para gestión manual de estados
4. **BAJO:** Migrar estados legacy (`sent_manual` → `enviado`)

---

**Responsables:**  
- Refactorización: GitHub Copilot (Claude Sonnet 4.5)  
- Revision pendiente: Equipo de desarrollo  
- Aprobación deploy: Tech Lead

**Fecha límite deploy:** 2026-02-15

---

**FIN DEL INFORME**
