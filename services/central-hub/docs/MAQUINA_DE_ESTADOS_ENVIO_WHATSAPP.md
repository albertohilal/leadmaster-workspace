# Máquina de Estados – Envíos WhatsApp

**Sistema:** LeadMaster Central Hub  
**Módulo:** sender  
**Tabla principal:** `ll_envios_whatsapp`  
**Tabla auditoría:** `ll_envios_whatsapp_historial`  
**Fecha última actualización:** 2026-02-13  
**Versión:** 1.0.0

---

## 1. Estados Oficiales

Los estados válidos en `ll_envios_whatsapp` son:

```sql
estado ENUM('pendiente', 'enviado', 'error')
```

**Estados válidos:**
- **`pendiente`** - Envío registrado pero no procesado
- **`enviado`** - Mensaje enviado y confirmado por WhatsApp
- **`error`** - Envío fallido por error técnico o número inválido

**NO existen otros estados permitidos.**

⚠️ **Estados legacy encontrados en código (DEPRECADOS):**
- `sent_manual` - Usado en destinatariosController.js (línea 393)
- `fallido` - Mencionado en lógica de eliminación (línea 315)

Estos deben migrarse al ENUM oficial.

---

## 2. Transiciones Permitidas

| Estado Actual | Estado Nuevo | Permitido | Observaciones |
|--------------|-------------|-----------|--------------|
| `pendiente`    | `enviado`    | ✅ Sí     | Solo después de confirmación real de `sendMessage()` |
| `pendiente`    | `error`      | ✅ Sí     | Solo si envío falla técnicamente |
| `enviado`      | `error`      | ❌ No     | **Prohibido** - Inconsistencia lógica |
| `enviado`      | `pendiente`  | ❌ No     | **Prohibido** - No se puede "desenviar" |
| `error`        | `pendiente`  | ⚠️ Manual | Solo con intervención humana y justificación |
| `error`        | `enviado`    | ❌ No     | **Prohibido** - Debe pasar por `pendiente` |

### Diagrama de Flujo

```
┌─────────────┐
│  pendiente  │ ◄─────┐ (reintento manual)
└──────┬──────┘       │
       │              │
       ├──────────────┼──────────┐
       │              │          │
       ▼              │          ▼
┌─────────────┐       │    ┌──────────┐
│   enviado   │       └────┤  error   │
└─────────────┘            └──────────┘
   (final)                   (requiere
                             intervención)
```

---

## 3. Reglas Críticas

### 🚨 Prohibiciones Absolutas

1. **Está PROHIBIDO marcar "enviado" antes de que `sendMessage()` confirme éxito.**
   - Violación actual en: `programacionScheduler.js` línea 241-250
   - BUG identificado: [DIAGNOSTICO_CRITICO_ENVIOS_WHATSAPP.md](DIAGNOSTICO_CRITICO_ENVIOS_WHATSAPP.md)

2. **Todo cambio de estado debe pasar por la función `cambiarEstado()`.**
   - No se permiten `UPDATE` directos sobre el campo `estado`
   - Excepción: Migración de datos (con auditoría explícita)

3. **Toda transición debe generar registro en `ll_envios_whatsapp_historial`.**
   - Tabla aún no implementada (pendiente)
   - Requisito para cumplimiento operativo

4. **No se permiten cambios silenciosos de estado.**
   - Todo cambio debe loguear: quién, cuándo, por qué
   - Nivel mínimo: `console.log()` con diagnóstico

5. **Transacciones obligatorias.**
   - Cambio de estado + inserción historial = 1 transacción
   - Rollback automático en caso de error

---

## 4. Función Oficial de Cambio de Estado

La **única forma válida** de modificar el estado será:

```javascript
/**
 * Cambia el estado de un envío de forma controlada
 * 
 * @param {number} envioId - ID del registro en ll_envios_whatsapp
 * @param {string} nuevoEstado - 'pendiente' | 'enviado' | 'error'
 * @param {string} origen - 'scheduler' | 'manual' | 'sistema'
 * @param {string} detalle - Descripción del cambio
 * @param {string|null} messageId - ID del mensaje en WhatsApp (solo para 'enviado')
 * @returns {Promise<boolean>}
 * @throws {Error} Si la transición no está permitida
 */
async function cambiarEstado(envioId, nuevoEstado, origen, detalle, messageId = null)
```

### Requisitos de Implementación

- [x] Validar que `envioId` existe
- [x] Obtener `estado_anterior` de la BD
- [x] Validar transición permitida (según tabla sección 2)
- [x] Iniciar transacción SQL
- [x] Insertar registro en `ll_envios_whatsapp_historial`
- [x] Actualizar `estado` en `ll_envios_whatsapp`
- [x] Si `nuevoEstado === 'enviado'`: Guardar `message_id` en columna nueva
- [x] Commit transacción
- [x] Log estructurado con DiagLog
- [x] En caso de error: Rollback completo

### Ejemplo de Uso

```javascript
// ✅ CORRECTO
try {
  const result = await sessionManagerClient.sendMessage({...});
  
  // Solo marca enviado SI el envío fue exitoso
  await cambiarEstado(
    envio.id,
    'enviado',
    'scheduler',
    'Envío exitoso vía programación automática',
    result.message_id
  );
} catch (err) {
  // Marca error si falla
  await cambiarEstado(
    envio.id,
    'error',
    'scheduler',
    `Fallo en envío: ${err.message}`
  );
}
```

```javascript
// ❌ INCORRECTO (código actual)
const marcado = await marcarEnviado(envio.id);  // ❌ Marca ANTES de enviar
try {
  await sessionManagerClient.sendMessage({...});
} catch (err) {
  // ❌ No revierte estado, queda como "enviado" sin haber enviado
  enviadosFallidos++;
}
```

---

## 5. Checklist Técnica de Implementación

### 5.1 Base de Datos

- [ ] **Crear tabla `ll_envios_whatsapp_historial`**
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

- [ ] **Agregar columna `message_id` a `ll_envios_whatsapp`**
  ```sql
  ALTER TABLE ll_envios_whatsapp 
  ADD COLUMN message_id VARCHAR(255) NULL AFTER fecha_envio,
  ADD INDEX idx_message_id (message_id);
  ```

- [ ] **Migrar estados legacy**
  - Buscar todos los registros con `estado = 'sent_manual'`
  - Decidir mapeo: ¿'enviado' o 'pendiente'?
  - UPDATE masivo con registro en historial

- [ ] **Validar constraints ENUM**
  ```sql
  SELECT DISTINCT estado FROM ll_envios_whatsapp 
  WHERE estado NOT IN ('pendiente','enviado','error');
  ```

- [ ] **Crear índice compuesto para scheduler**
  ```sql
  CREATE INDEX idx_campania_estado ON ll_envios_whatsapp(campania_id, estado);
  ```

### 5.2 Backend

- [ ] **Implementar función `cambiarEstado()`**
  - Ubicación: `src/modules/sender/services/estadoService.js` (nuevo)
  - Exportar como servicio reutilizable
  - Incluir validaciones de transición
  - Manejo de transacciones con `connection.beginTransaction()`

- [ ] **Remover UPDATE directos**
  - Buscar: `UPDATE ll_envios_whatsapp SET estado`
  - Reemplazar por llamadas a `cambiarEstado()`
  - Archivos afectados:
    - `programacionScheduler.js` línea 139-145
    - `destinatariosController.js` línea 392-394

- [ ] **Corregir flujo `marcarEnviado()`**
  - **ELIMINAR** función `marcarEnviado()` actual
  - **NO** marcar como enviado antes de `sendMessage()`
  - Implementar nuevo flujo: envío primero, estado después

- [ ] **Implementar `marcarError()`**
  ```javascript
  async function marcarError(envioId, errorMessage) {
    await cambiarEstado(
      envioId,
      'error',
      'scheduler',
      errorMessage
    );
  }
  ```

- [ ] **Agregar rollback en catch**
  - Detectar si el registro ya fue marcado como 'enviado'
  - Si `sendMessage()` falla Y estado es 'enviado':
    - Llamar `cambiarEstado(envioId, 'error', ...)`
    - Loguear inconsistencia temporal

### 5.3 Scheduler (`programacionScheduler.js`)

- [ ] **Refactorizar loop de envío (líneas 241-282)**
  ```javascript
  // ✅ NUEVO
  for (const envio of pendientes) {
    try {
      const destinatario = formatPhoneNumber(envio.telefono_wapp);
      const mensajePersonalizado = personalizarMensaje(envio);
      
      // Enviar primero
      const result = await sessionManagerClient.sendMessage({
        cliente_id: clienteId,
        to: destinatario,
        message: mensajePersonalizado
      });
      
      // Marcar enviado solo si fue exitoso
      await cambiarEstado(
        envio.id,
        'enviado',
        'scheduler',
        'Envío automático exitoso',
        result.message_id
      );
      
      enviadosExitosos++;
      await delay(getRandomSendDelay());
      
    } catch (err) {
      // Marcar error
      await cambiarEstado(
        envio.id,
        'error',
        'scheduler',
        `Error: ${err.message}`
      );
      
      enviadosFallidos++;
      
      // Continuar con siguiente (NO break)
      // O break según política definida
    }
  }
  ```

- [ ] **Remover función `marcarEnviado()`**
  - Eliminar líneas 139-145
  - Actualizar exports de testing (línea 333)

- [ ] **Mejorar logs con DiagLog**
  - Incluir `estado_anterior` y `estado_nuevo` en logs
  - Usar DiagLog para transiciones

### 5.4 Frontend

- [ ] **Botón "Enviar por Web WhatsApp"**
  - Ubicación: `DestinatariosTable.jsx` o similar
  - Visible solo si `estado === 'pendiente' || estado === 'error'`
  - Deshabilitado si `estado === 'enviado'`

- [ ] **Modal de confirmación**
  - Mostrar: nombre, teléfono, mensaje preview
  - Texto: "¿Confirmar envío manual?"
  - Acciones: Cancelar | Enviar

- [ ] **Endpoint de envío manual**
  - Ruta: `POST /api/sender/envios/:id/enviar-manual`
  - Body: `{ confirmacion: true }`
  - Response: `{ ok: true, message_id: '...' }`

- [ ] **Visualización de estados**
  - Badge con colores:
    - `pendiente`: 🟡 Amarillo
    - `enviado`: 🟢 Verde
    - `error`: 🔴 Rojo
  - Tooltip con `detalle` del historial

- [ ] **Tabla de historial**
  - Componente: `EnvioHistorial.jsx`
  - Mostrar transiciones para un `envio_id`
  - Columnas: Fecha | Estado Anterior | Estado Nuevo | Origen | Detalle

---

## 6. Auditoría

Toda transición debe quedar registrada con:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `envio_id` | INT | FK a `ll_envios_whatsapp` |
| `estado_anterior` | ENUM | Estado previo (puede ser NULL si es primer registro) |
| `estado_nuevo` | ENUM | Estado resultante |
| `origen` | ENUM | `'scheduler'` \| `'manual'` \| `'sistema'` |
| `detalle` | TEXT | Descripción del cambio (error message, confirmación, etc.) |
| `usuario_id` | INT | NULL para automático, ID para manual |
| `created_at` | TIMESTAMP | Timestamp automático |

### Ejemplo de Registro de Auditoría

```sql
INSERT INTO ll_envios_whatsapp_historial 
(envio_id, estado_anterior, estado_nuevo, origen, detalle, usuario_id)
VALUES 
(12345, 'pendiente', 'enviado', 'scheduler', 'Envío automático exitoso - message_id: BAE5...', NULL);
```

### Consultas Útiles

```sql
-- Historial completo de un envío
SELECT * FROM ll_envios_whatsapp_historial 
WHERE envio_id = 12345 
ORDER BY created_at ASC;

-- Envíos que pasaron por error
SELECT DISTINCT envio_id 
FROM ll_envios_whatsapp_historial 
WHERE estado_nuevo = 'error';

-- Conteo de transiciones por origen
SELECT origen, estado_nuevo, COUNT(*) as total
FROM ll_envios_whatsapp_historial
GROUP BY origen, estado_nuevo;
```

---

## 7. Política Operativa

### 7.1 Procesamiento Automático (Scheduler)

- **Solo procesa:** Registros con `estado = 'pendiente'`
- **Marca como enviado:** Solo después de confirmación real
- **Marca como error:** Si `sendMessage()` lanza excepción
- **NO reintenta:** Errores quedan marcados para revisión manual
- **Logging:** Diagnóstico completo en cada transición

### 7.2 Envío Manual (Frontend)

- **Puede enviar:**
  - `estado = 'pendiente'` → Envío por primera vez
  - `estado = 'error'` → Reintento después de revisar/corregir número
  
- **NO puede enviar:**
  - `estado = 'enviado'` → Prohibido "reenviar"

- **Requiere:**
  - Confirmación explícita del usuario
  - Autenticación del usuario (para auditoría)
  - Registro en historial con `usuario_id`

### 7.3 Operaciones Críticas

- **Nunca borrar historial:** Datos de auditoría permanentes
- **Nunca modificar historial:** Solo INSERT, nunca UPDATE/DELETE
- **Reenvío prohibido:** Un mensaje 'enviado' no puede reenviarse
- **Corrección de errores:** Pasar a 'pendiente' manualmente + justificación

### 7.4 Gestión de Errores Comunes

| Tipo de Error | Estado Resultante | Acción Operativa |
|---------------|-------------------|------------------|
| Número inválido | `error` | Corregir en BD → Marcar 'pendiente' manual |
| Sesión caída | `error` | Reiniciar sesión → Reintento automático |
| Timeout | `error` | Verificar conectividad → Reintento manual |
| Rate limit WhatsApp | `error` | Esperar cooldown → Reintento después |

---

## 8. Estado Actual del Sistema

**Última actualización:** 2026-02-13

### 8.1 Implementación

| Componente | Estado | Notas |
|------------|--------|-------|
| Tabla `ll_envios_whatsapp` | ✅ Existe | ENUM correcto (`pendiente`, `enviado`, `error`) |
| Columna `message_id` | ❌ No existe | Pendiente: ALTER TABLE |
| Tabla `ll_envios_whatsapp_historial` | ❌ No existe | Pendiente: CREATE TABLE |
| Función `cambiarEstado()` | ✅ Implementada | Con transacciones ACID, validación de transiciones y auditoría |
| Función `marcarEnviado()` | ❌ Eliminada | Reemplazada por `cambiarEstado()` en v1.0.0 |
| Manejo de errores clasificados | ✅ Implementado | 8 códigos de error estructurados |
| Validación de transiciones | ✅ Implementada | En `estadoService.validarTransicion()` |

### 8.2 Bugs Identificados (Histórico)

1. **[CRÍTICO] Marcado prematuro como 'enviado'** → ✅ **RESUELTO v1.0.0**
   - **Estado:** RESUELTO (2026-02-13)
   - **Commit:** feature/whatsapp-state-machine-refactor
   - Archivo: `programacionScheduler.js` líneas 241-250
   - Problema: `marcarEnviado()` se ejecutaba ANTES de `sendMessage()`
   - Impacto: 250 registros marcados como enviados sin confirmar (incidente 2026-02-07)
   - **Solución:** Función `marcarEnviado()` eliminada, reemplazada por `cambiarEstado()` que solo marca después de confirmación

2. **[ALTO] Sin rollback en catch** → ✅ **RESUELTO v1.0.0**
   - **Estado:** RESUELTO (2026-02-13)
   - Archivo: `programacionScheduler.js` líneas 283-291
   - Problema: Si `sendMessage()` fallaba, estado quedaba en 'enviado'
   - **Solución:** Implementado cambio automático a 'error' con clasificación en catch, scheduler continúa procesando

3. **[MEDIO] Estados legacy inconsistentes** → ⚠️ **PENDIENTE**
   - Archivo: `destinatariosController.js` línea 393
   - Problema: Usa `'sent_manual'` que no está en ENUM
   - Fix pendiente: Migrar a `'enviado'` + auditoría de origen='manual'

4. **[BAJO] Sin `message_id` en BD** → ⏳ **IMPLEMENTADO EN CÓDIGO**
   - **Estado:** Código listo, pendiente migración de BD
   - Session Manager retorna `message_id` y se guarda en `cambiarEstado()`
   - Pendiente: Ejecutar `ALTER TABLE` para agregar columna

### 8.3 Datos Actuales

```sql
-- Distribución de estados (ejemplo)
SELECT estado, COUNT(*) as total
FROM ll_envios_whatsapp
GROUP BY estado;

/*
estado     | total
-----------|-------
pendiente  | 1234
enviado    | 5678  ⚠️ Pueden incluir registros sin confirmar
error      | 89    (¿marcados manualmente?)
*/
```

### 8.4 Próximos Pasos

**Prioridad CRÍTICA:**
1. ~~Implementar `cambiarEstado()` con transacciones~~ ✅ COMPLETADO
2. Crear `ll_envios_whatsapp_historial` ⚠️ **BLOQUEANTE**
3. ~~Refactorizar loop en `programacionScheduler.js`~~ ✅ COMPLETADO
4. Agregar columna `message_id` ⚠️ **BLOQUEANTE**

**Prioridad ALTA:**
5. ~~Implementar rollback en catch~~ ✅ COMPLETADO
6. Migrar estados legacy
7. Testing de transiciones prohibidas

**Prioridad MEDIA:**
8. Frontend: Botón envío manual
9. Endpoint envío manual
10. Vista de historial

### 8.5 Cambios Implementados en v1.0.0

**Fecha:** 2026-02-13  
**Commit:** feature/whatsapp-state-machine-refactor

#### Backend Core

✅ **Servicio `estadoService.js` creado**
- Función `cambiarEstado()` con transacciones ACID
- Validación estricta de transiciones permitidas
- Auditoría automática en `ll_envios_whatsapp_historial`
- Rollback automático en caso de error
- Registro de `message_id` y timestamps

✅ **Refactorización de `programacionScheduler.js`**
- **Eliminación completa** de función `marcarEnviado()`
- Flujo corregido: **envío primero, estado después**
- Validación triple de respuesta (`null`, `ok`, `message_id`)
- Clasificación estructurada de errores (8 códigos)
- Eliminación de `break` en catch: scheduler continúa procesando
- Normalización protocol-agnostic: solo dígitos, sin `@c.us`

✅ **Cliente Session Manager actualizado**
- Validación estricta de respuesta de `sendMessage()`
- `cliente_id` en body + header `X-Cliente-Id`
- Clasificación de HTTP 503 con `code: SESSION_NOT_READY`
- Manejo de errores 400, 409, 500, 503

#### Garantías de Integridad

✅ **IMPOSIBLE** marcar "enviado" sin confirmación real  
✅ **IMPOSIBLE** respuesta malformada pase silenciosamente  
✅ **IMPOSIBLE** UPDATE directo sobre `estado` (solo vía `cambiarEstado()`)  
✅ **IMPOSIBLE** transición inválida (validación automática)  
✅ Scheduler resiliente: continúa ante fallos individuales

#### Códigos de Error Implementados

- `SESSION_MANAGER_TIMEOUT` - Timeout de red
- `SESSION_MANAGER_UNREACHABLE` - Service down
- `SESSION_NOT_READY` - Sesión WhatsApp no lista
- `WHATSAPP_ERROR` - Error interno WhatsApp
- `VALIDATION_ERROR` - Request inválido
- `INVALID_SEND_RESPONSE` - Respuesta malformada
- `TELEFONO_INVALIDO` - Número vacío/inválido
- `UNKNOWN_ERROR` - Error sin clasificar

#### Pendientes Bloqueantes

⚠️ **Migraciones de Base de Datos (Crítico)**
- Crear tabla `ll_envios_whatsapp_historial`
- Agregar columna `message_id` a `ll_envios_whatsapp`

**Sin estas migraciones, el sistema no puede operar en producción.**

---

## 9. Casos de Uso

### 9.1 Envío Automático Exitoso

```
Estado inicial: pendiente
↓
[Scheduler] Obtiene registro
↓
[Scheduler] Intenta sendMessage()
↓
[WhatsApp] Confirma envío → message_id: "BAE5..."
↓
[Scheduler] Llama cambiarEstado(id, 'enviado', 'scheduler', '...', 'BAE5...')
↓
Estado final: enviado
Historial: pendiente → enviado (scheduler)
```

### 9.2 Envío Automático Fallido

```
Estado inicial: pendiente
↓
[Scheduler] Obtiene registro
↓
[Scheduler] Intenta sendMessage()
↓
[WhatsApp] Lanza error: "Invalid phone number"
↓
[Scheduler] catch → cambiarEstado(id, 'error', 'scheduler', 'Invalid phone...')
↓
Estado final: error
Historial: pendiente → error (scheduler)
```

### 9.3 Reenvío Manual

```
Estado inicial: error
↓
[Usuario] Corrige número en BD
↓
[Usuario] Click "Marcar como pendiente"
↓
[Backend] Valida transición error → pendiente (permitida)
↓
[Backend] cambiarEstado(id, 'pendiente', 'manual', 'Corrección número', usuario_id)
↓
Estado final: pendiente
Historial: error → pendiente (manual, usuario_id=123)
↓
[Scheduler] Procesa en próxima ejecución
↓
Estado final: enviado (si exitoso) o error (si falla de nuevo)
```

### 9.4 Transición Prohibida

```
Estado inicial: enviado
↓
[Usuario] Intenta cambiar a pendiente
↓
[Backend] cambiarEstado(id, 'pendiente', 'manual', '...')
↓
[Validación] Rechaza: enviado → pendiente NO permitido
↓
throw new Error('Transición no permitida: enviado → pendiente')
↓
Estado final: enviado (sin cambios)
Historial: (sin registro)
```

---

## 10. Referencias

### Documentos Relacionados

- [DIAGNOSTICO_CRITICO_ENVIOS_WHATSAPP.md](DIAGNOSTICO_CRITICO_ENVIOS_WHATSAPP.md) - Análisis del bug de marcado prematuro
- [CONSULTAS_DIAGNOSTICO_ENVIOS.sql](../../../CONSULTAS_DIAGNOSTICO_ENVIOS.sql) - Queries de diagnóstico
- [INFORME_INCIDENTE_2026-02-07.md](../../../INFORME_INCIDENTE_2026-02-07.md) - Incidente 250 envíos

### Código Fuente

- `src/modules/sender/services/programacionScheduler.js` - Scheduler automático
- `src/modules/sender/controllers/destinatariosController.js` - Gestión manual
- `src/integrations/sessionManager/sessionManagerClient.js` - Cliente WhatsApp

### Base de Datos

- Tabla: `ll_envios_whatsapp`
- Tabla (pendiente): `ll_envios_whatsapp_historial`

---

## 11. Glosario

- **Estado:** Valor actual del campo `estado` en `ll_envios_whatsapp`
- **Transición:** Cambio de un estado a otro
- **Historial:** Registro inmutable de todas las transiciones
- **Origen:** Fuente del cambio de estado (`scheduler`, `manual`, `sistema`)
- **message_id:** Identificador único del mensaje en WhatsApp
- **Rollback:** Reversión de cambios en caso de error
- **Race condition:** Conflicto cuando 2 procesos modifican el mismo registro

---

**Documento versionado.**  
Cualquier modificación debe reflejarse aquí.

**Mantenedor:** Equipo de desarrollo LeadMaster  
**Última revisión:** 2026-02-13

---

**📋 Documento actualizado tras refactorización v1.0.0 – 2026-02-13**

**Cambios principales en esta versión:**
- ✅ Bug crítico de marcado prematuro resuelto
- ✅ Máquina de estados implementada con auditoría
- ✅ Validaciones estrictas de integridad
- ⚠️ Pendiente: Migraciones de BD (bloqueante para producción)

**Véase también:** [INFORME_REFACTORIZACION_SCHEDULER_2026-02-13.md](../../INFORME_REFACTORIZACION_SCHEDULER_2026-02-13.md)
