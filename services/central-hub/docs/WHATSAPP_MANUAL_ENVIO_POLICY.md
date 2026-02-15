# Política de Envío WhatsApp – API y Web Manual

**Sistema:** LeadMaster Central Hub  
**Módulo:** sender  
**Tabla principal:** `ll_envios_whatsapp`  
**Tabla auditoría:** `ll_envios_whatsapp_historial`  
**Fecha:** 2026-02-15  
**Versión:** 1.2.0  
**Documento:** Política Operativa Obligatoria

---

## 📋 ÍNDICE

1. [Principios Fundamentales](#1-principios-fundamentales)
2. [Estados Oficiales y Transiciones](#2-estados-oficiales-y-transiciones)
3. [Envío Automático vía API](#3-envío-automático-vía-api)
4. [Envío Manual vía Web WhatsApp](#4-envío-manual-vía-web-whatsapp)
5. [Prohibiciones Explícitas](#5-prohibiciones-explícitas)
6. [Arquitectura de Perfiles Chrome](#6-arquitectura-de-perfiles-chrome)
7. [Auditoría y Trazabilidad](#7-auditoría-y-trazabilidad)
8. [Checklist Operativa](#8-checklist-operativa)
9. [Casos de Uso](#9-casos-de-uso)
10. [Glosario](#10-glosario)

---

## 1. PRINCIPIOS FUNDAMENTALES

### 1.1 Regla de Unicidad

**Un registro = Un único intento de envío**

```
Cada registro en ll_envios_whatsapp representa:
- UN número de teléfono
- UN mensaje
- UNA oportunidad de envío
- UN estado final ('enviado' o 'error')
```

### 1.2 Inmutabilidad de Envíos

**Una vez enviado, es FINAL.**

```
estado = 'enviado'
    ↓
REGISTRO CERRADO
    ↓
NO PUEDE modificarse
NO PUEDE reenviarse
NO PUEDE reciclarse
```

### 1.3 Dos Vías de Envío

Existen **exactamente dos formas válidas** de envío:

| Vía | Método | Origen | Confirmación |
|-----|--------|--------|--------------|
| **API** | Session Manager HTTP call | `scheduler` | `message_id` automático |
| **Web Manual** | https://web.whatsapp.com | `manual` | Confirmación humana explícita |

**Ambas vías comparten:**
- La misma máquina de estados
- El mismo servicio `cambiarEstado()`
- La misma tabla de auditoría
- Las mismas reglas de transición

### 1.4 No Reenviados

**Política estricta:**

```
Si necesitas enviar al mismo número otra vez:

Caso 1: Registro con estado 'enviado'
    ❌ NO modificar registro existente
    ❌ NO cambiar estado
    ✅ CREAR nuevo registro en ll_envios_whatsapp

Caso 2: Registro con estado 'error'
    ❌ NO crear nuevo registro
    ✅ USAR reintento controlado (error → pendiente manual)
    ✅ Requiere justificación obligatoria
    ✅ Requiere usuario_id

Caso 3: Registro con estado 'pendiente'
    ⚠️  Ya está disponible para procesamiento
    ❌ NO crear duplicado

Razones:
    - Auditoría completa por intento fallido
    - Trazabilidad de correcciones
    - Evitar race conditions
    - Cumplimiento normativo
    - No duplicar envíos dentro de campaña
```

**Resumen operativo:**
- `'enviado'` → Solo nuevo registro
- `'error'` → Solo reintento manual (error → pendiente)
- `'pendiente'` → Ya disponible, no duplicar

### 1.5 Auditoría Obligatoria

**Todo cambio de estado debe:**
1. Ejecutarse en transacción SQL
2. Insertar registro en `ll_envios_whatsapp_historial`
3. Especificar origen (`scheduler`, `manual`, `sistema`)
4. Incluir detalle descriptivo
5. Registrar `usuario_id` si es manual

---

## 2. ESTADOS OFICIALES Y TRANSICIONES

### 2.1 Estados Válidos

```sql
estado ENUM('pendiente', 'enviado', 'error')
```

| Estado | Descripción | Final |
|--------|-------------|-------|
| `pendiente` | Registrado, esperando envío | No |
| `enviado` | Mensaje confirmado enviado | **Sí (absoluto)** |
| `error` | Fallo técnico o número inválido | Condicional* |

*Estado `error` puede volver a `pendiente` solo mediante intervención manual con justificación.

### 2.2 Diagrama de Transiciones

```
            ┌─────────────────┐
            │   PENDIENTE     │ ◄────────┐
            └────────┬────────┘          │
                     │                   │
         ┌───────────┴───────────┐       │
         │                       │       │
         ▼                       ▼       │
    ┌─────────┐            ┌─────────┐  │
    │ ENVIADO │            │  ERROR  │──┘
    └─────────┘            └─────────┘
   (FINAL ABSOLUTO)      (reintento manual
                         con justificación)
```

### 2.3 Tabla de Transiciones Permitidas

| De | A | API | Manual | Observaciones |
|----|---|-----|--------|---------------|
| `pendiente` | `enviado` | ✅ | ✅ | Solo después de confirmación real |
| `pendiente` | `error` | ✅ | ❌ | Solo si envío API falla técnicamente |
| `error` | `pendiente` | ❌ | ⚠️ | **Reintento controlado**: Requiere usuario_id + justificación obligatoria |
| `enviado` | * | ❌ | ❌ | **PROHIBIDO** - Estado final absoluto, sin excepciones |
| `error` | `enviado` | ❌ | ❌ | **PROHIBIDO** - Debe pasar primero por `pendiente` |

**Leyenda:**
- ✅ Permitido automáticamente
- ⚠️ Permitido solo con aprobación manual explícita
- ❌ Prohibido siempre sin excepciones

### 2.4 Validación de Transiciones

**Código:** `src/modules/sender/services/estadoService.js`

```javascript
const transicionesPermitidas = {
  pendiente: ['enviado', 'error'],
  enviado: [],  // Estado final absoluto - sin salidas
  error: ['pendiente']  // Solo manualmente con justificación
};

function validarTransicion(estadoAnterior, estadoNuevo, origen) {
  if (!estadoAnterior) return true;
  
  const permitidos = transicionesPermitidas[estadoAnterior];
  if (!permitidos || !permitidos.includes(estadoNuevo)) {
    throw new Error(
      `Transición no permitida: ${estadoAnterior} → ${estadoNuevo}`
    );
  }
  
  // Validación adicional: error → pendiente solo manual
  if (estadoAnterior === 'error' && estadoNuevo === 'pendiente') {
    if (origen !== 'manual') {
      throw new Error(
        `Transición ${estadoAnterior} → ${estadoNuevo} requiere origen 'manual', recibido '${origen}'`
      );
    }
  }
  
  return true;
}
```

### 2.5 Política de Reintento Controlado

**Transición: error → pendiente**

Esta transición NO es un "reenviado". Es una **corrección de intento fallido** bajo supervisión humana.

#### Condiciones Obligatorias

```
Para ejecutar error → pendiente:

✅ DEBE ser origen = 'manual'
✅ DEBE incluir usuario_id del operador
✅ DEBE incluir justificación en campo 'detalle'
✅ DEBE pasar por cambiarEstado()
✅ DEBE generar registro en ll_envios_whatsapp_historial

❌ NO puede ser origen = 'scheduler'
❌ NO puede ser origen = 'sistema'
❌ NO puede omitir justificación
❌ NO puede ser UPDATE directo
```

#### Ejemplo de Uso Válido

```javascript
// Usuario revisa error y decide reintentar
await cambiarEstado(
  { connection },
  envioId,
  'pendiente',
  'manual',
  'Corrección manual: número validado, error de tipeo corregido',
  { usuarioId: 7, messageId: null }
);
```

#### Justificaciones Válidas

- "Número corregido: faltaba dígito"
- "Error transitorio de red, sesión restaurada"
- "Validación manual: número correcto, reintentar"
- "Corrección de formato: agregado código país"

#### Justificaciones NO Válidas

- ❌ "Reintentar" (sin explicación)
- ❌ "Error" (genérico)
- ❌ "Probar de nuevo" (sin análisis)
- ❌ "" (vacío)

#### Diferencia Clave: Reintento vs Reenviado

| Concepto | Error → Pendiente | Enviado → * |
|----------|-------------------|-------------|
| **Propósito** | Corregir intento fallido | Duplicar mensaje exitoso |
| **Estado origen** | `error` | `enviado` |
| **Permitido** | ✅ Sí (manual) | ❌ No (nunca) |
| **Razón** | Mensaje nunca llegó | Mensaje ya entregado |
| **Auditoría** | Justificación obligatoria | N/A (bloqueado) |

**Resumen:**
- `error → pendiente` = "Este mensaje NUNCA se envió, corregir y reintentar"
- `enviado → *` = "Este mensaje SÍ se envió, NO duplicar"

**Validaciones obligatorias:**
```javascript
// En cambiarEstado()
if (estadoAnterior === 'error' && estadoNuevo === 'pendiente') {
  if (origen !== 'manual') {
    throw new Error('Reintento requiere origen manual');
  }
  if (!detalle || detalle.length < 10) {
    throw new Error('Justificación obligatoria (mínimo 10 caracteres)');
  }
  if (!usuarioId) {
    throw new Error('usuario_id obligatorio para reintento manual');
  }
}
```

---

## 3. ENVÍO AUTOMÁTICO VÍA API

### 3.1 Descripción

Envío programado ejecutado por `programacionScheduler.js` usando Session Manager API.

**Características:**
- Procesamiento batch automático
- Sin intervención humana
- Confirmación vía `message_id`
- Ejecución continua

### 3.2 Flujo Correcto

```
1. Scheduler busca registros
   ↓
   SELECT * FROM ll_envios_whatsapp
   WHERE estado = 'pendiente'
   AND campania_id = ?
   
2. Para cada registro:
   ↓
   const result = await sessionManagerClient.sendMessage({
     clienteId,
     to: envio.telefono,
     message: envio.mensaje
   });
   
3. Si sendMessage() retorna message_id:
   ↓
   await cambiarEstado(
     { connection },
     envio.id,
     'enviado',
     'scheduler',
     'Envío automático exitoso',
     { messageId: result.message_id }
   );
   
4. Si sendMessage() lanza error:
   ↓
   await cambiarEstado(
     { connection },
     envio.id,
     'error',
     'scheduler',
     `Error: ${error.message}`,
     { messageId: null }
   );
```

### 3.3 Validaciones Pre-Envío

Antes de enviar, el scheduler debe:

```javascript
// 1. Verificar estado de sesión WhatsApp
const session = await sessionManagerClient.getSession(instanceId);

if (session.status !== SessionStatus.CONNECTED) {
  console.log('[Scheduler] Sesión no conectada, saltando envíos');
  return;
}

// 2. Validar número de teléfono
if (!envio.telefono || envio.telefono.length < 10) {
  await cambiarEstado(
    { connection },
    envio.id,
    'error',
    'sistema',
    'Número de teléfono inválido'
  );
  continue;
}

// 3. Validar mensaje no vacío
if (!envio.mensaje || envio.mensaje.trim() === '') {
  await cambiarEstado(
    { connection },
    envio.id,
    'error',
    'sistema',
    'Mensaje vacío'
  );
  continue;
}
```

### 3.4 Prohibición Crítica

**❌ NUNCA marcar como 'enviado' ANTES de confirmar envío real**

```javascript
// ❌ INCORRECTO (código legacy)
await connection.query(
  "UPDATE ll_envios_whatsapp SET estado = 'enviado' WHERE id = ?",
  [envio.id]
);
await sessionManagerClient.sendMessage({...}); // Puede fallar

// ✅ CORRECTO
const result = await sessionManagerClient.sendMessage({...});
// Solo si llegamos aquí, el envío fue exitoso
await cambiarEstado(
  { connection },
  envio.id,
  'enviado',
  'scheduler',
  'Envío confirmado',
  { messageId: result.message_id }
);
```

### 3.5 Manejo de Errores API

```javascript
try {
  const result = await sessionManagerClient.sendMessage({
    clienteId: envio.cliente_id,
    to: envio.telefono,
    message: envio.mensaje
  });
  
  // Validar respuesta
  if (!result || !result.ok || !result.message_id) {
    throw new Error('Respuesta inválida de Session Manager');
  }
  
  await cambiarEstado(
    { connection },
    envio.id,
    'enviado',
    'scheduler',
    `Envío exitoso - messageId: ${result.message_id}`,
    { messageId: result.message_id }
  );
  
} catch (error) {
  // Clasificar tipo de error
  const detalle = error instanceof SessionNotFoundError
    ? 'ERROR_SESSION_NOT_FOUND: Sesión no existe'
    : error instanceof SessionManagerTimeoutError
    ? 'ERROR_TIMEOUT: Session Manager no responde'
    : error.message || 'Error desconocido';
  
  await cambiarEstado(
    { connection },
    envio.id,
    'error',
    'scheduler',
    detalle
  );
  
  console.error(`[Scheduler] Error envío ${envio.id}:`, error);
}
```

---

## 4. ENVÍO MANUAL VÍA WEB WHATSAPP

### 4.1 Descripción

Envío realizado por un usuario humano directamente en el navegador.

**Características:**
- Usuario abre https://web.whatsapp.com
- Usuario escribe y envía mensaje manualmente
- Usuario confirma envío en sistema
- Sistema registra transición a 'enviado'

### 4.2 Reglas de Operación

**1. Autorización previa**
```
Solo usuarios con rol 'admin' o 'operador' pueden:
- Ver botón "Enviar por Web WhatsApp"
- Ejecutar endpoint POST /api/envios/:id/enviar-manual
```

**2. Estados permitidos para envío manual**
```javascript
// Usuario puede enviar manualmente si:
if (envio.estado === 'pendiente') {
  // ✅ Permitir envío directo
}

if (envio.estado === 'error') {
  // ⚠️ Permitir pero requiere cambio a pendiente primero
  // Ver sección 2.5: Política de Reintento Controlado
}

if (envio.estado === 'enviado') {
  // ❌ Rechazar con mensaje:
  // "Este envío ya fue procesado. No se permiten reenviados."
}
```

**3. Confirmación explícita**
```
El usuario debe:
1. Ver modal con advertencia
2. Clickear "Abrir WhatsApp Web"
3. Enviar mensaje realmente
4. Volver al sistema
5. Clickear "Confirmar envío"

Si el usuario cierra el navegador sin confirmar:
    → estado permanece 'pendiente'
```

### 4.3 Flujo Frontend

```javascript
// Componente: DestinatariosTable.jsx

function handleEnvioManual(envioId) {
  // 1. Validar estado
  const envio = envios.find(e => e.id === envioId);
  
  if (envio.estado === 'enviado') {
    alert('Este envío ya fue procesado. No se permiten reenviados.');
    return;
  }
  
  // 2. Abrir modal de confirmación
  setModalEnvioManual({
    visible: true,
    envioId,
    telefono: envio.telefono,
    mensaje: envio.mensaje
  });
}

function handleAbrirWhatsApp() {
  const { telefono, mensaje } = modalEnvioManual;
  
  // 3. Abrir WhatsApp Web en nueva pestaña
  const encodedMsg = encodeURIComponent(mensaje);
  const url = `https://web.whatsapp.com/send?phone=${telefono}&text=${encodedMsg}`;
  
  window.open(url, '_blank');
  
  // 4. Mostrar botón "Confirmar envío"
  setMostrarConfirmacion(true);
}

async function handleConfirmarEnvio() {
  const { envioId } = modalEnvioManual;
  
  try {
    // 5. Llamar endpoint backend
    await axios.post(`/api/envios/${envioId}/enviar-manual`, {
      confirmado: true
    });
    
    // 6. Actualizar UI
    toast.success('Envío registrado exitosamente');
    recargarEnvios();
    setModalEnvioManual({ visible: false });
    
  } catch (error) {
    toast.error(error.response?.data?.error || 'Error al confirmar envío');
  }
}
```

### 4.4 Flujo Backend

**Endpoint:** `POST /api/envios/:id/enviar-manual`

```javascript
// Archivo: src/routes/envios.js

router.post('/:id/enviar-manual', 
  authMiddleware,
  async (req, res) => {
    const { id } = req.params;
    const { confirmado } = req.body;
    const usuarioId = req.user.id;
    
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // 1. Obtener envío
      const [envios] = await connection.query(
        'SELECT * FROM ll_envios_whatsapp WHERE id = ?',
        [id]
      );
      
      if (!envios.length) {
        return res.status(404).json({ error: 'Envío no encontrado' });
      }
      
      const envio = envios[0];
      
      // 2. Validar estado
      if (envio.estado === 'enviado') {
        return res.status(400).json({
          error: 'Este envío ya fue procesado. No se permiten reenviados.'
        });
      }
      
      if (envio.estado !== 'pendiente') {
        return res.status(400).json({
          error: `Solo se pueden enviar registros con estado 'pendiente'. Estado actual: ${envio.estado}`
        });
      }
      
      // 3. Validar confirmación explícita
      if (!confirmado) {
        return res.status(400).json({
          error: 'Debe confirmar que el mensaje fue enviado'
        });
      }
      
      // 4. Cambiar estado
      await cambiarEstado(
        { connection },
        id,
        'enviado',
        'manual',
        'Envío manual confirmado vía Web WhatsApp',
        { usuarioId, messageId: null }
      );
      
      await connection.commit();
      
      res.json({
        ok: true,
        message: 'Envío registrado exitosamente',
        envio: {
          id,
          estado: 'enviado',
          fecha_envio: new Date()
        }
      });
      
    } catch (error) {
      await connection.rollback();
      console.error('[EnvioManual] Error:', error);
      res.status(500).json({
        error: error.message || 'Error al procesar envío manual'
      });
    } finally {
      connection.release();
    }
  }
);
```

### 4.5 Modal de Confirmación (React)

```jsx
function EnvioManualModal({ visible, envio, onClose, onConfirm }) {
  const [paso, setPaso] = useState(1); // 1=instrucciones, 2=confirmacion
  
  const handleAbrirWhatsApp = () => {
    const url = `https://web.whatsapp.com/send?phone=${envio.telefono}&text=${encodeURIComponent(envio.mensaje)}`;
    window.open(url, '_blank');
    setPaso(2);
  };
  
  return (
    <Modal visible={visible} onClose={onClose}>
      {paso === 1 && (
        <>
          <h2>Envío Manual por Web WhatsApp</h2>
          <p><strong>Teléfono:</strong> {envio.telefono}</p>
          <p><strong>Mensaje:</strong></p>
          <pre>{envio.mensaje}</pre>
          
          <div className="alert alert-warning">
            ⚠️ <strong>Importante:</strong>
            <ul>
              <li>Se abrirá WhatsApp Web en una nueva pestaña</li>
              <li>Debes usar el perfil Chrome correcto</li>
              <li>Envía el mensaje manualmente</li>
              <li>Vuelve aquí y confirma el envío</li>
            </ul>
          </div>
          
          <button onClick={handleAbrirWhatsApp}>
            Abrir WhatsApp Web
          </button>
          <button onClick={onClose}>Cancelar</button>
        </>
      )}
      
      {paso === 2 && (
        <>
          <h2>Confirmar Envío</h2>
          <p>¿Enviaste el mensaje correctamente en WhatsApp Web?</p>
          
          <div className="alert alert-info">
            ℹ️ Solo confirma si el mensaje se envió exitosamente.
            Si hubo algún error, cancela y el registro quedará pendiente.
          </div>
          
          <button onClick={onConfirm} className="btn-success">
            ✅ Sí, confirmar envío
          </button>
          <button onClick={onClose} className="btn-secondary">
            ❌ Cancelar (no se envió)
          </button>
        </>
      )}
    </Modal>
  );
}
```

### 4.6 Política Operativa Obligatoria de Perfil Chrome

**Regla fundamental de operación:**

```
TODO envío manual DEBE realizarse desde el perfil Chrome designado
para el cliente/número específico.
```

#### Requisitos Obligatorios Pre-Envío

**Antes de confirmar cualquier envío manual, el operador DEBE verificar:**

```
✅ OBLIGATORIO:
  1. Perfil Chrome correcto abierto y activo
  2. Sesión web.whatsapp.com conectada al número correcto
  3. Verificación visual del número de teléfono en WhatsApp Web
  4. Verificación del nombre de perfil Chrome en barra superior
  5. No hay otras sesiones WhatsApp abiertas en otras ventanas

❌ PROHIBIDO:
  1. Enviar desde perfil Chrome genérico o personal
  2. Alternar entre perfiles durante el envío
  3. Confirmar envío sin verificación previa de perfil
  4. Usar perfil con múltiples sesiones WhatsApp
```

#### Checklist de Verificación Operativa

**El operador debe completar mentalmente antes de cada envío:**

- [ ] **Paso 1:** ¿Estoy en el perfil Chrome correcto?
      - Verificar nombre del perfil en esquina superior derecha
      - Debe coincidir con: `Profile_WhatsApp_[Cliente]`

- [ ] **Paso 2:** ¿La sesión WhatsApp Web corresponde al cliente?
      - Verificar número en configuración de WhatsApp Web
      - Debe coincidir con número de la campaña

- [ ] **Paso 3:** ¿El mensaje es el correcto?
      - Verificar contenido antes de enviar
      - Verificar destinatario correcto

- [ ] **Paso 4:** ¿El mensaje se envió exitosamente?
      - Verificar doble check (✓✓) en WhatsApp Web
      - Esperar confirmación visual de entrega

- [ ] **Paso 5:** ¿Confirmé en el sistema?
      - Solo después de verificar envío real
      - Nunca confirmar si no se envió

#### Consecuencias de Incumplimiento

**El uso incorrecto del perfil Chrome:**

| Acción Incorrecta | Consecuencia |
|-------------------|-------------|
| Enviar desde perfil incorrecto | Invalidación de auditoría operativa |
| Confirmar sin enviar | Datos falsos en sistema |
| Mezclar sesiones | Error de envío, mensaje al destinatario incorrecto |
| No verificar perfil | Potencial envío duplicado o a número equivocado |

**Todas estas acciones constituyen violación operativa grave.**

#### Responsabilidad del Operador

```
El operador es responsable de:

1. Verificar perfil Chrome correcto ANTES de cada envío
2. Mantener sesión WhatsApp Web conectada al número correcto
3. Confirmar envío SOLO después de verificación visual
4. Reportar inmediatamente cualquier error de perfil
5. NO confirmar envíos no realizados

El sistema NO puede forzar el uso del perfil correcto.
Esta es responsabilidad operativa humana.
```

#### Procedimiento en Caso de Error de Perfil

**Si el operador detecta que usó el perfil incorrecto:**

1. **NO confirmar el envío en el sistema**
2. Cerrar modal de confirmación
3. Reportar incidente al supervisor
4. Verificar si el mensaje se envió desde número incorrecto
5. Cerrar todas las ventanas WhatsApp Web
6. Abrir perfil Chrome correcto
7. Verificar sesión correcta
8. Reintentar envío desde perfil correcto
9. Documentar incidente en sistema de tickets

**Registro del incidente:**
```sql
INSERT INTO ll_incidencias_operativas 
(tipo, descripcion, operador_id, fecha)
VALUES 
('PERFIL_INCORRECTO', 
 'Envío realizado desde perfil incorrecto: [detalles]', 
 usuario_id, 
 NOW());
```

---

## 5. PROHIBICIONES EXPLÍCITAS

### 5.1 Lista de Prohibiciones

| # | Prohibición | Razón | Consecuencia |
|---|-------------|-------|--------------|
| 1 | Reenviar registros con `estado = 'enviado'` | Duplicación de mensajes | Violación de política |
| 2 | Modificar registros en `ll_envios_whatsapp_historial` | Auditoría inmutable | Pérdida de trazabilidad |
| 3 | `UPDATE` directo al campo `estado` | Bypass de validaciones | Inconsistencia de datos |
| 4 | Marcar 'enviado' antes de confirmación real | Falsos positivos | Datos incorrectos |
| 5 | Usar múltiples cuentas en mismo perfil Chrome | Mezcla de sesiones | Error de envío |
| 6 | Automatizar envío manual con scripts | Viola política de confirmación humana | Auditoría inválida |
| 7 | Cambiar estado sin registrar en historial | Pérdida de auditoría | Incumplimiento normativo |
| 8 | Enviar manualmente sin confirmar en sistema | Estado inconsistente | Datos desactualizados |
| 9 | Transición `enviado` → `pendiente` | Lógicamente imposible | Violación de máquina de estados |
| 10 | Borrar registros de historial | Destrucción de evidencia | Violación legal |
| 11 | Enviar manualmente desde perfil Chrome incorrecto | Invalidación de auditoría | Violación operativa grave |
| 12 | Confirmar envío sin haberlo realizado | Fraude de datos | Violación operativa grave |
| 13 | Crear nuevo registro si estado = 'error' | Duplicación innecesaria | Violación de política de reintento |
| 14 | Justificación genérica en reintento | Auditoría inválida | Incumplimiento de trazabilidad |

### 5.2 Validaciones Implementadas

**Backend:**

```javascript
// Validación 1: Prohibir UPDATE directo
// Solo permitir cambios vía cambiarEstado()

// Validación 2: Rechazar reenviados
if (envio.estado === 'enviado') {
  throw new Error('No se permiten reenviados. Cree un nuevo registro.');
}

// Validación 3: Validar transiciones
function validarTransicion(estadoAnterior, estadoNuevo) {
  const permitidos = transicionesPermitidas[estadoAnterior];
  if (!permitidos || !permitidos.includes(estadoNuevo)) {
    throw new Error(`Transición no permitida: ${estadoAnterior} → ${estadoNuevo}`);
  }
}

// Validación 4: Prohibir modificación de historial
// Tabla ll_envios_whatsapp_historial:
// - NO UPDATE permitido
// - NO DELETE permitido
// - Solo INSERT

// Validación 5: Validar justificación en reintento
if (estadoAnterior === 'error' && estadoNuevo === 'pendiente') {
  if (!detalle || detalle.length < 10) {
    throw new Error('Justificación insuficiente para reintento');
  }
  const justificacionesInvalidas = ['reintentar', 'error', 'probar', ''];
  if (justificacionesInvalidas.some(inv => detalle.toLowerCase().includes(inv) && detalle.length < 20)) {
    throw new Error('Justificación demasiado genérica');
  }
}
```

**Frontend:**

```javascript
// Validación visual: Deshabilitar botón si estado = 'enviado'
<button
  disabled={envio.estado === 'enviado'}
  onClick={() => handleEnvioManual(envio.id)}
>
  {envio.estado === 'enviado' 
    ? '✅ Ya enviado' 
    : 'Enviar por WhatsApp Web'}
</button>

// Validación de perfil Chrome antes de confirmar
function validarPerfilChromeActivo() {
  const perfilEsperado = `Profile_WhatsApp_${clienteId}`;
  
  // Nota: Esta validación es de responsabilidad del operador
  // El sistema solo puede mostrar advertencia
  const confirmacion = window.confirm(
    `⚠️ VERIFICACIÓN OBLIGATORIA:\n\n` +
    `Antes de confirmar, asegúrate de que:\n` +
    `1. Estás en el perfil Chrome: ${perfilEsperado}\n` +
    `2. La sesión WhatsApp Web es la correcta\n` +
    `3. El mensaje se envió exitosamente\n\n` +
    `¿Confirmas que usaste el perfil correcto?`
  );
  
  return confirmacion;
}
```

---

## 6. ARQUITECTURA DE PERFILES CHROME

### 6.1 Principio de Aislamiento

**Regla fundamental:**
```
1 número WhatsApp = 1 perfil Chrome = 1 sesión web.whatsapp.com
```

**Prohibido:**
- Usar múltiples cuentas WhatsApp en mismo perfil
- Alternar entre sesiones en mismo navegador
- Mezclar cuentas personales con empresariales

### 6.2 Configuración Requerida

**Perfil Chrome dedicado:**

```
Email asociado: desarrolloydisenio@gmail.com
Carpeta perfil: ~/.config/google-chrome/Profile_WhatsApp_Sender
Extensiones: Ninguna (evitar interferencias)
Sesión: Mantener abierta 24/7
```

**Verificación:**

```bash
# Abrir Chrome con perfil específico
google-chrome --profile-directory="Profile_WhatsApp_Sender" \
              --user-data-dir=~/.config/google-chrome \
              https://web.whatsapp.com
```

### 6.3 Procedimiento de Inicialización

**Para cada número WhatsApp:**

1. Crear perfil Chrome nuevo
   ```bash
   google-chrome --profile-directory="Profile_WhatsApp_[Cliente]"
   ```

2. Abrir https://web.whatsapp.com

3. Escanear QR con teléfono correspondiente

4. Verificar sesión conectada

5. Documentar en:
   ```
   docs/PERFILES_CHROME_WHATSAPP.md
   
   | Cliente ID | Número | Perfil Chrome | Email |
   |------------|--------|---------------|-------|
   | 123 | +54911... | Profile_WhatsApp_123 | cliente123@... |
   ```

6. Mantener pestaña abierta permanentemente

### 6.4 Política de Mantenimiento

**Revisión semanal:**
- [ ] Verificar sesiones activas
- [ ] Re-scanear QR si desconectado
- [ ] Limpiar cache si necesario
- [ ] Verificar que no haya múltiples sesiones

**En caso de desconexión:**
```
1. Cerrar todas las pestañas WhatsApp Web
2. Abrir perfil Chrome correcto
3. Ir a https://web.whatsapp.com
4. Escanear QR nuevamente
5. Confirmar conexión
6. Documentar incidente
```

---

## 7. AUDITORÍA Y TRAZABILIDAD

### 7.1 Tabla de Historial

**DDL:**

```sql
CREATE TABLE ll_envios_whatsapp_historial (
  id INT PRIMARY KEY AUTO_INCREMENT,
  envio_id INT NOT NULL,
  estado_anterior ENUM('pendiente', 'enviado', 'error') NULL,
  estado_nuevo ENUM('pendiente', 'enviado', 'error') NOT NULL,
  origen ENUM('scheduler', 'manual', 'sistema') NOT NULL,
  detalle TEXT NOT NULL,
  usuario_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (envio_id) REFERENCES ll_envios_whatsapp(id) ON DELETE CASCADE,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  
  INDEX idx_envio_id (envio_id),
  INDEX idx_created_at (created_at),
  INDEX idx_origen (origen)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 7.2 Campos Obligatorios

| Campo | Tipo | Obligatorio | Descripción |
|-------|------|-------------|-------------|
| `envio_id` | INT | ✅ | FK a ll_envios_whatsapp |
| `estado_anterior` | ENUM | ⚠️ | NULL solo en primer registro |
| `estado_nuevo` | ENUM | ✅ | Estado resultante |
| `origen` | ENUM | ✅ | scheduler \| manual \| sistema |
| `detalle` | TEXT | ✅ | Descripción del cambio |
| `usuario_id` | INT | ⚠️ | NULL si automático, ID si manual |
| `created_at` | TIMESTAMP | ✅ | Auto-generado |

### 7.3 Consultas de Auditoría

**Historial completo de un envío:**

```sql
SELECT 
  h.id,
  h.estado_anterior,
  h.estado_nuevo,
  h.origen,
  h.detalle,
  u.nombre as usuario,
  h.created_at
FROM ll_envios_whatsapp_historial h
LEFT JOIN usuarios u ON h.usuario_id = u.id
WHERE h.envio_id = ?
ORDER BY h.created_at ASC;
```

**Envíos manuales del día:**

```sql
SELECT 
  e.id,
  e.telefono,
  e.estado,
  h.detalle,
  u.nombre as operador,
  h.created_at
FROM ll_envios_whatsapp e
JOIN ll_envios_whatsapp_historial h ON e.id = h.envio_id
LEFT JOIN usuarios u ON h.usuario_id = u.id
WHERE h.origen = 'manual'
  AND DATE(h.created_at) = CURDATE()
ORDER BY h.created_at DESC;
```

**Transiciones anormales:**

```sql
-- Detectar si alguien intentó reenviar
SELECT 
  h.envio_id,
  h.estado_anterior,
  h.estado_nuevo,
  h.created_at
FROM ll_envios_whatsapp_historial h
WHERE h.estado_anterior = 'enviado'
  AND h.estado_nuevo != 'enviado'
ORDER BY h.created_at DESC;
```

**Estadísticas por origen:**

```sql
SELECT 
  h.origen,
  h.estado_nuevo,
  COUNT(*) as total
FROM ll_envios_whatsapp_historial h
WHERE DATE(h.created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
GROUP BY h.origen, h.estado_nuevo
ORDER BY h.origen, total DESC;
```

### 7.4 Retención de Datos

**Política de conservación:**

```
Tabla ll_envios_whatsapp:
    - Retención: 1 año
    - Archivado: Mover a ll_envios_whatsapp_archivo
    - Eliminación: Nunca (solo archivado)

Tabla ll_envios_whatsapp_historial:
    - Retención: Permanente
    - Archivado: Nunca
    - Eliminación: Prohibido
    - Backup: Diario
```

---

## 8. CHECKLIST OPERATIVA

### 8.1 Base de Datos

#### Estructura

- [ ] **Crear tabla `ll_envios_whatsapp_historial`**
  ```sql
  -- Ver DDL en sección 7.1
  ```

- [ ] **Agregar columna `message_id`**
  ```sql
  ALTER TABLE ll_envios_whatsapp
  ADD COLUMN message_id VARCHAR(255) NULL AFTER fecha_envio,
  ADD INDEX idx_message_id (message_id);
  ```

- [ ] **Validar ENUM de estados**
  ```sql
  SELECT DISTINCT estado 
  FROM ll_envios_whatsapp 
  WHERE estado NOT IN ('pendiente', 'enviado', 'error');
  
  -- Si retorna filas: migrar estados legacy
  ```

- [ ] **Crear índices de rendimiento**
  ```sql
  CREATE INDEX idx_campania_estado 
  ON ll_envios_whatsapp(campania_id, estado);
  
  CREATE INDEX idx_fecha_estado 
  ON ll_envios_whatsapp(fecha_creacion, estado);
  ```

- [ ] **Verificar foreign keys**
  ```sql
  SELECT 
    CONSTRAINT_NAME,
    TABLE_NAME,
    REFERENCED_TABLE_NAME
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_NAME = 'll_envios_whatsapp_historial';
  ```

#### Migración de Datos Legacy

- [ ] **Identificar registros con estados no válidos**
  ```sql
  SELECT estado, COUNT(*) as total
  FROM ll_envios_whatsapp
  WHERE estado NOT IN ('pendiente', 'enviado', 'error')
  GROUP BY estado;
  ```

- [ ] **Mapear estados legacy a nuevos**
  ```sql
  -- Ejemplo: sent_manual → enviado
  UPDATE ll_envios_whatsapp
  SET estado = 'enviado'
  WHERE estado = 'sent_manual';
  
  -- Registrar en historial
  INSERT INTO ll_envios_whatsapp_historial
  (envio_id, estado_anterior, estado_nuevo, origen, detalle)
  SELECT 
    id,
    'sent_manual',
    'enviado',
    'sistema',
    'Migración de estado legacy'
  FROM ll_envios_whatsapp
  WHERE estado = 'enviado' 
    AND fecha_modificacion = NOW();
  ```

- [ ] **Backup antes de migración**
  ```bash
  mysqldump -u user -p leadmaster ll_envios_whatsapp > backup_antes_migracion.sql
  ```

---

### 8.2 Backend

#### Servicio de Estados

- [ ] **Verificar `estadoService.js` implementado**
  - Ubicación: `src/modules/sender/services/estadoService.js`
  - Función `cambiarEstado()` completa
  - Validación de transiciones
  - Transacciones SQL
  - Manejo de rollback

- [ ] **Eliminar UPDATE directos al campo `estado`**
  ```bash
  # Buscar violaciones
  grep -r "UPDATE ll_envios_whatsapp SET estado" src/
  
  # Reemplazar por:
  await cambiarEstado({ connection }, envioId, nuevoEstado, origen, detalle);
  ```

- [ ] **Refactorizar `programacionScheduler.js`**
  - Eliminar función `marcarEnviado()` legacy
  - Usar `cambiarEstado()` después de `sendMessage()`
  - Validar respuesta antes de marcar enviado
  - Clasificar errores correctamente

#### Endpoint de Envío Manual

- [ ] **Crear ruta `POST /api/envios/:id/enviar-manual`**
  - Validar autenticación
  - Validar estado previo (solo `pendiente` o `error`)
  - Requerir confirmación explícita
  - Usar `cambiarEstado()` con origen `'manual'`
  - Registrar `usuario_id`

- [ ] **Implementar middleware de autorización**
  ```javascript
  function requireEnvioManualPermission(req, res, next) {
    if (!['admin', 'operador'].includes(req.user.rol)) {
      return res.status(403).json({
        error: 'No tienes permisos para enviar manualmente'
      });
    }
    next();
  }
  ```

- [ ] **Validar que no se permitan reenviados**
  ```javascript
  if (envio.estado === 'enviado') {
    return res.status(400).json({
      error: 'Este envío ya fue procesado. No se permiten reenviados.'
    });
  }
  ```

#### Endpoint de Reintento Manual

- [ ] **Crear ruta `POST /api/envios/:id/reintentar`**
  - Validar estado = 'error'
  - Requerir justificación en body
  - Cambiar estado a 'pendiente' con origen 'manual'
  - Registrar usuario_id
  
  ```javascript
  router.post('/:id/reintentar', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { justificacion } = req.body;
    const usuarioId = req.user.id;
    
    if (!justificacion || justificacion.trim().length < 10) {
      return res.status(400).json({
        error: 'Justificación obligatoria (mínimo 10 caracteres)'
      });
    }
    
    // Validar estado = error
    // Llamar cambiarEstado()
    // Ver caso de uso 9.5
  });
  ```

#### Testing

- [ ] **Tests de `estadoService.js`**
  - Transiciones válidas
  - Transiciones prohibidas
  - Validación origen en error → pendiente
  - Rollback en caso de error
  - Inserción en historial

- [ ] **Tests de endpoint manual**
  - Rechazo de reenviados
  - Confirmación requerida
  - Auditoría correcta

- [ ] **Tests de endpoint reintentar**
  - Requiere estado = error
  - Rechaza si estado = enviado
  - Requiere justificación
  - Registra usuario_id

- [ ] **Tests de integración scheduler**
  - Flujo completo pendiente → enviado
  - Manejo de errores
  - Estado correcto después de fallo
  - NO puede ejecutar error → pendiente

---

### 8.3 Frontend

#### Componente de Tabla de Destinatarios

- [ ] **Agregar botón "Enviar por WhatsApp Web"**
  ```jsx
  <button
    disabled={envio.estado === 'enviado'}
    onClick={() => handleEnvioManual(envio.id)}
    className={envio.estado === 'enviado' ? 'btn-disabled' : 'btn-primary'}
  >
    {envio.estado === 'enviado' 
      ? '✅ Ya enviado' 
      : '📱 Enviar por WhatsApp Web'}
  </button>
  ```

- [ ] **Agregar botón "Reintentar" para estado error**
  ```jsx
  {envio.estado === 'error' && (
    <button 
      onClick={() => handleReintentarEnvio(envio.id)}
      className="btn-warning"
    >
      🔄 Reintentar (requiere justificación)
    </button>
  )}
  ```

- [ ] **Mostrar botón envío solo para pendiente**
  ```jsx
  {envio.estado === 'pendiente' && (
    <button onClick={() => handleEnvioManual(envio.id)}>
      Enviar Manualmente
    </button>
  )}
  ```

- [ ] **Colorear filas por estado**
  ```jsx
  function getRowClass(estado) {
    switch(estado) {
      case 'pendiente': return 'row-warning'; // amarillo
      case 'enviado': return 'row-success';   // verde
      case 'error': return 'row-danger';      // rojo
      default: return '';
    }
  }
  ```

#### Modal de Envío Manual

- [ ] **Crear componente `EnvioManualModal.jsx`**
  - Paso 1: Mostrar instrucciones
  - Botón "Abrir WhatsApp Web"
  - Paso 2: Confirmación explícita
  - Botón "Confirmar envío"
  - Botón "Cancelar"

- [ ] **Implementar apertura de WhatsApp Web**
  ```jsx
  const url = `https://web.whatsapp.com/send?phone=${telefono}&text=${encodeURIComponent(mensaje)}`;
  window.open(url, '_blank');
  ```

- [ ] **Llamada al endpoint de confirmación**
  ```jsx
  await axios.post(`/api/envios/${envioId}/enviar-manual`, {
    confirmado: true
  });
  ```

#### Modal de Reintento (para estado error)

- [ ] **Crear componente `ReintentoModal.jsx`**
  ```jsx
  function ReintentoModal({ envio, onConfirm, onClose }) {
    const [justificacion, setJustificacion] = useState('');
    
    const handleSubmit = async () => {
      if (justificacion.length < 10) {
        toast.error('Justificación debe tener al menos 10 caracteres');
        return;
      }
      
      await axios.post(`/api/envios/${envio.id}/reintentar`, {
        justificacion
      });
      
      toast.success('Envío marcado como pendiente para reintento');
      onConfirm();
    };
    
    return (
      <Modal>
        <h2>Reintentar Envío Fallido</h2>
        <p><strong>Motivo del error:</strong> {envio.detalle_error}</p>
        
        <label>Justificación del reintento (obligatorio):</label>
        <textarea
          value={justificacion}
          onChange={(e) => setJustificacion(e.target.value)}
          placeholder="Ej: Número corregido, faltaba código de área"
          minLength={10}
          required
        />
        
        <button onClick={handleSubmit}>Confirmar Reintento</button>
        <button onClick={onClose}>Cancelar</button>
      </Modal>
    );
  }
  ```

#### Alertas y Validaciones

- [ ] **Alert si intenta reenviar**
  ```jsx
  if (envio.estado === 'enviado') {
    toast.error('Este envío ya fue procesado. No se permiten reenviados.');
    return;
  }
  ```

- [ ] **Alert si falta justificación en reintento**
  ```jsx
  if (envio.estado === 'error' && !justificacion) {
    toast.error('Debe justificar el reintento de un envío fallido');
    return;
  }
  ```

- [ ] **Confirmación antes de abrir WhatsApp**
  ```jsx
  if (!window.confirm('¿Enviarás este mensaje manualmente en WhatsApp Web?')) {
    return;
  }
  ```

- [ ] **Toast de éxito después de confirmar**
  ```jsx
  toast.success('Envío registrado exitosamente');
  ```

#### Historial de Envío

- [ ] **Crear componente `EnvioHistorial.jsx`**
  - Mostrar todas las transiciones
  - Indicar origen (scheduler/manual/sistema)
  - Mostrar usuario si es manual
  - Timestamp de cada cambio

- [ ] **Endpoint `GET /api/envios/:id/historial`**
  ```javascript
  router.get('/:id/historial', async (req, res) => {
    const [historial] = await pool.query(`
      SELECT 
        h.*,
        u.nombre as usuario_nombre
      FROM ll_envios_whatsapp_historial h
      LEFT JOIN usuarios u ON h.usuario_id = u.id
      WHERE h.envio_id = ?
      ORDER BY h.created_at ASC
    `, [req.params.id]);
    
    res.json(historial);
  });
  ```

---

### 8.4 Operativa Humana

#### Capacitación de Operadores

- [ ] **Documentar procedimiento de envío manual**
  - Crear `docs/PROCEDIMIENTO_ENVIO_MANUAL.md`
  - Incluir screenshots
  - Casos de error comunes
  - Qué hacer si falla

- [ ] **Entrenar a operadores**
  - Cómo usar perfil Chrome correcto
  - Cómo verificar que el mensaje se envió
  - Cuándo confirmar y cuándo cancelar
  - Política de no reenviados

- [ ] **Crear checklist diaria**
  ```markdown
  ## Checklist Diaria – Operador WhatsApp
  
  - [ ] Verificar sesión WhatsApp Web conectada
  - [ ] Confirmar perfil Chrome correcto
  - [ ] Revisar envíos pendientes del día
  - [ ] No reenviar registros con estado 'enviado'
  - [ ] Documentar incidencias
  ```

#### Perfiles Chrome

- [ ] **Documentar perfiles existentes**
  - Crear `docs/PERFILES_CHROME_WHATSAPP.md`
  - Listar cliente_id → perfil → número
  - Instrucciones de creación
  - Instrucciones de recuperación

- [ ] **Crear perfil para cada cliente**
  ```bash
  google-chrome --profile-directory="Profile_WhatsApp_${CLIENTE_ID}"
  ```

- [ ] **Mantener tabla de control**
  ```markdown
  | Cliente ID | Número | Perfil Chrome | Última Verificación | Estado |
  |------------|--------|---------------|---------------------|--------|
  | 1 | +549... | Profile_WhatsApp_1 | 2026-02-15 | ✅ Activo |
  ```

#### Mantenimiento Semanal

- [ ] **Verificar sesiones activas**
  - Abrir cada perfil Chrome
  - Confirmar conexión en web.whatsapp.com
  - Re-scanear QR si es necesario

- [ ] **Revisar auditoría**
  ```sql
  -- Envíos manuales de la semana
  SELECT * FROM ll_envios_whatsapp_historial
  WHERE origen = 'manual'
    AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
  ORDER BY created_at DESC;
  ```

- [ ] **Backup de perfiles Chrome**
  ```bash
  tar -czf chrome_profiles_backup_$(date +%Y%m%d).tar.gz \
    ~/.config/google-chrome/Profile_WhatsApp_*
  ```

#### Política de Incidencias

- [ ] **Registrar problemas en sistema de tickets**
  - Sesión desconectada
  - Número bloqueado
  - Error de envío
  - Perfil corrupto

- [ ] **Documentar resoluciones**
  - Qué falló
  - Qué se hizo
  - Estado final
  - Prevención futura

---

## 9. CASOS DE USO

### 9.1 Caso: Envío Automático Exitoso

**Escenario:** Scheduler procesa envío programado.

```
Estado inicial: pendiente

1. Scheduler selecciona registro
   ↓
   SELECT * FROM ll_envios_whatsapp 
   WHERE estado = 'pendiente' AND campania_id = 5

2. Valida sesión WhatsApp
   ↓
   session = await getSession('sender_1')
   session.status === 'connected' ✅

3. Envía mensaje
   ↓
   result = await sendMessage({
     clienteId: 1,
     to: '+5491134567890',
     message: 'Hola...'
   })
   result.message_id = 'BAE5D3F4...' ✅

4. Registra transición
   ↓
   await cambiarEstado(
     { connection },
     envio.id,
     'enviado',
     'scheduler',
     'Envío automático exitoso',
     { messageId: 'BAE5D3F4...' }
   )

Estado final: enviado
Historial: pendiente → enviado (scheduler)
Auditoría: ✅ Completa
```

---

### 9.2 Caso: Envío Automático Fallido

**Escenario:** API rechaza número inválido.

```
Estado inicial: pendiente

1. Scheduler intenta envío
   ↓
   result = await sendMessage({
     to: '+54911INVALIDO'
   })

2. Session Manager retorna error
   ↓
   throw new Error('Invalid phone number format')

3. Catch captura error
   ↓
   catch (error) {
     await cambiarEstado(
       { connection },
       envio.id,
       'error',
       'scheduler',
       `ERROR_INVALID_PHONE: ${error.message}`
     );
   }

Estado final: error
Historial: pendiente → error (scheduler)
Auditoría: ✅ Completa
```

---

### 9.3 Caso: Envío Manual Exitoso

**Escenario:** Usuario envía mensaje vía Web WhatsApp.

```
Estado inicial: pendiente

1. Usuario clickea "Enviar por WhatsApp Web"
   ↓
   Frontend valida: estado === 'pendiente' ✅

2. Se abre web.whatsapp.com
   ↓
   URL: https://web.whatsapp.com/send?phone=...&text=...
   Usuario escribe y envía ✅

3. Usuario vuelve al sistema y confirma
   ↓
   POST /api/envios/123/enviar-manual
   { confirmado: true }

4. Backend registra transición
   ↓
   await cambiarEstado(
     { connection },
     123,
     'enviado',
     'manual',
     'Envío manual confirmado vía Web WhatsApp',
     { usuarioId: 7, messageId: null }
   )

Estado final: enviado
Historial: pendiente → enviado (manual)
Auditoría: ✅ Completa (con usuario_id)
```

---

### 9.4 Caso: Intento de Reenvío (Rechazado)

**Escenario:** Usuario intenta reenviar mensaje ya enviado.

```
Estado inicial: enviado

1. Usuario clickea botón
   ↓
   Frontend verifica: envio.estado === 'enviado' ❌

2. Sistema muestra alerta
   ↓
   alert('Este envío ya fue procesado. No se permiten reenviados.')

3. Botón permanece deshabilitado
   ↓
   <button disabled>✅ Ya enviado</button>

Estado final: enviado (sin cambios)
Historial: (sin nuevos registros)
Auditoría: ✅ Intento bloqueado
```

---

### 9.5 Caso: Reintento Controlado (Error Corregido)

**Escenario:** Operador corrige número erróneo y autoriza reintento.

```
Estado inicial: error

1. Operador revisa historial
   ↓
   SELECT * FROM ll_envios_whatsapp_historial 
   WHERE envio_id = 456
   
   Detalle: "ERROR_INVALID_PHONE: número incompleto (+54911234 en lugar de +5491112345678)"

2. Operador corrige número en registro
   ↓
   UPDATE ll_envios_whatsapp
   SET telefono = '+5491112345678'
   WHERE id = 456

3. Operador solicita reintento con justificación
   ↓
   POST /api/envios/456/reintentar
   {
     justificacion: 'Número corregido: faltaban 4 dígitos al final, validado con cliente'
   }

4. Backend valida transición
   ↓
   validarTransicion('error', 'pendiente', 'manual') ✅
   (permitido solo con origen manual)

5. Backend registra cambio
   ↓
   await cambiarEstado(
     { connection },
     456,
     'pendiente',
     'manual',
     'Número corregido: faltaban 4 dígitos al final, validado con cliente',
     { usuarioId: 7 }
   )

6. Scheduler reprocesa en próximo ciclo
   ↓
   const result = await sendMessage({...});
   await cambiarEstado(..., 'enviado', 'scheduler', ...)

Estado final: enviado (después de reintento exitoso)
Historial: 
  - pendiente → error (scheduler, timestamp T1)
  - error → pendiente (manual, timestamp T2, usuario_id=7)
  - pendiente → enviado (scheduler, timestamp T3)
Auditoría: ✅ Completa con justificación y trazabilidad
```

**Nota importante:** 
- Este NO es un reenviado. Es un reintento de un mensaje que nunca fue entregado.
- Este flujo NO genera duplicación de registros dentro de la campaña.
- El mismo registro pasa de 'error' → 'pendiente' → 'enviado'.
- La auditoría completa queda registrada en `ll_envios_whatsapp_historial`.

---

### 9.6 Caso: Sesión WhatsApp Desconectada

**Escenario:** Scheduler detecta sesión no disponible.

```
Estado inicial: pendiente

1. Scheduler inicia proceso
   ↓
   session = await getSession('sender_1')
   session.status === 'disconnected' ❌

2. Scheduler registra evento
   ↓
   console.log('[Scheduler] Sesión desconectada, saltando envíos')

3. NO procesa envíos
   ↓
   return; // Sale del loop

4. Alerta a operador
   ↓
   (Sistema de notificaciones)
   "Sesión WhatsApp cliente_1 desconectada"

5. Operador reconecta
   ↓
   - Abre web.whatsapp.com en perfil correcto
   - Escanea QR
   - Verifica conexión

6. Scheduler retoma en próximo ciclo
   ↓
   (Envíos quedan en 'pendiente' hasta reconexión)

Estado final: pendiente (esperando reconexión)
Historial: (sin cambios)
Auditoría: ✅ Evento de desconexión loggeado
```

---

## 10. GLOSARIO

| Término | Definición |
|---------|------------|
| **Estado** | Valor actual del campo `estado` en `ll_envios_whatsapp` |
| **Transición** | Cambio de un estado a otro |
| **Historial** | Registro inmutable en `ll_envios_whatsapp_historial` |
| **Origen** | Fuente del cambio: `scheduler`, `manual`, `sistema` |
| **message_id** | Identificador único del mensaje en WhatsApp (retornado por API) |
| **Reenvío** | ❌ Acto prohibido de enviar nuevamente un registro ya enviado |
| **Envío Manual** | Envío realizado por humano vía https://web.whatsapp.com |
| **Envío Automático** | Envío realizado por scheduler vía Session Manager API |
| **Perfil Chrome** | Carpeta de perfil aislado para mantener sesión WhatsApp |
| **Confirmación explícita** | Acción humana de confirmar que mensaje fue enviado |
| **Estado final absoluto** | Estado sin transiciones salientes bajo ninguna circunstancia (`enviado`) |
| **Reintento controlado** | Transición error → pendiente con justificación manual obligatoria (no genérica) |
| **Perfil Chrome designado** | Perfil Chrome específico configurado para un cliente/número WhatsApp |
| **Violación operativa grave** | Acción que invalida auditoría o genera datos falsos |
| **Rollback** | Reversión de transacción SQL en caso de error |
| **Auditoría** | Registro completo de todas las transiciones |
| **Inmutabilidad** | Característica de registros que no pueden modificarse |
| **Race condition** | Conflicto cuando 2 procesos modifican el mismo registro |
| **Transacción ACID** | Operación SQL atómica con BEGIN/COMMIT/ROLLBACK |
| **Validación de transición** | Verificación de que cambio de estado es permitido |

---

## 📝 NOTAS FINALES

### Mantenimiento del Documento

Este documento es **normativo y obligatorio**.

Cualquier modificación debe:
1. Actualizarse aquí primero
2. Comunicarse al equipo
3. Reflejarse en código
4. Incluirse en capacitación

### Versionado

| Versión | Fecha | Cambios |
|---------|-------|---------|
| 1.0.0 | 2026-02-15 | Documento inicial |
| 1.1.0 | 2026-02-15 | Agregada política de reintento controlado (error → pendiente manual) |
| 1.2.0 | 2026-02-15 | Clarificación política de reintento (no duplica registros). Incorporación política operativa obligatoria de perfil Chrome. Refuerzo de prohibiciones operativas graves. |

### Referencias

- [MAQUINA_DE_ESTADOS_ENVIO_WHATSAPP.md](MAQUINA_DE_ESTADOS_ENVIO_WHATSAPP.md) - Implementación técnica
- [CONTRACT_IMPLEMENTATION_REPORT.md](CONTRACT_IMPLEMENTATION_REPORT.md) - Integración Session Manager
- `src/modules/sender/services/estadoService.js` - Código fuente

---

**Documento aprobado y vigente.**  
**Cumplimiento obligatorio.**

---
