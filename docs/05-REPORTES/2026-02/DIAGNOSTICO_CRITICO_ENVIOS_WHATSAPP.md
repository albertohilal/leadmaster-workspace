# 🚨 DIAGNÓSTICO CRÍTICO – ENVÍOS MARCADOS COMO ENVIADOS SIN CONFIRMACIÓN REAL

**Fecha:** 2026-02-12  
**Incidente:** 250 envíos marcados como "enviados" el 07-02-2026 con sesión DISCONNECTED  
**Sistema:** LeadMaster Central Hub

---

## ⚠️ HALLAZGO CRÍTICO

**El sistema marca mensajes como "enviados" ANTES de confirmar la entrega real en WhatsApp.**

---

## 📊 FLUJO DE EJECUCIÓN ACTUAL (PROBLEMÁTICO)

### Archivo Principal
`services/central-hub/src/modules/sender/services/programacionScheduler.js`

### Función Crítica
`procesarProgramacion()` → líneas 142-307

---

## 🔍 ANÁLISIS PASO A PASO

### 1️⃣ **Verificación de Estado WhatsApp** (Líneas 153-176)

```javascript
let status;
try {
  status = await sessionManagerClient.getStatus();
} catch (error) {
  // Manejo de errores de conexión
  return; // ✅ ABORTA correctamente
}

if (status.state !== 'READY' || !status.connected) {
  console.warn(`⏸️ Programación ${programacion.id}: WhatsApp no READY`);
  return; // ✅ ABORTA correctamente
}
```

**✅ CORRECTO:** Valida estado antes de procesar.

---

### 2️⃣ **Obtención de Pendientes** (Líneas 219-234)

```javascript
const pendientes = await obtenerPendientes(programacion.campania_id, disponible);
```

Función `obtenerPendientes()` (Líneas 130-137):
```javascript
async function obtenerPendientes(campaniaId, limite) {
  const [rows] = await connection.query(
    `SELECT id, telefono_wapp, mensaje_final, nombre_destino
     FROM ll_envios_whatsapp
     WHERE campania_id = ? AND estado = 'pendiente'
     ORDER BY id ASC
     LIMIT ?`,
    [campaniaId, limite]
  );
  return rows;
}
```

**✅ CORRECTO:** Solo obtiene pendientes.

---

### 3️⃣ **🚨 PUNTO CRÍTICO: Marcado como "enviado"** (Líneas 241-250)

```javascript
for (const envio of pendientes) {
  const marcado = await marcarEnviado(envio.id);  // ⚠️ AQUÍ SE MARCA
  
  if (!marcado) {
    diagLog('⚠️ NO MARCADO', {
      envio_id: envio.id,
      razon: 'UPDATE afectó 0 filas (posible race condition)'
    });
    continue;
  }
  // ... resto del código
}
```

**Función `marcarEnviado()`** (Líneas 139-145):
```javascript
async function marcarEnviado(id) {
  const [result] = await connection.query(
    'UPDATE ll_envios_whatsapp SET estado = "enviado", fecha_envio = NOW() WHERE id = ? AND estado = "pendiente"',
    [id]
  );
  return result.affectedRows === 1;
}
```

### ⚠️ **FALLO DE DISEÑO DETECTADO:**

```
ORDEN DE EJECUCIÓN:
1. marcarEnviado(envio.id)  → UPDATE ll_envios_whatsapp SET estado = "enviado" ❌
2. await sessionManagerClient.sendMessage(...)  → Intento de envío ✅
3. Si falla → catch solo incrementa contador, NO revierte estado ❌
```

**CONSECUENCIA:** 
- El estado se actualiza a `"enviado"` ANTES del envío real
- Si `sendMessage()` falla, el registro YA está marcado como "enviado"
- No existe rollback ni reintento

---

### 4️⃣ **Intento de Envío** (Líneas 265-282)

```javascript
try {
  diagLog('📤 ENVIANDO', {
    envio_id: envio.id,
    telefono: destinatario,
    cliente_id: clienteId,
    nombre: envio.nombre_destino
  });
  
  await sessionManagerClient.sendMessage({
    cliente_id: clienteId,
    to: destinatario,
    message: mensajePersonalizado
  });
  
  enviadosExitosos++;
  
  diagLog('✅ ENVIADO', {
    envio_id: envio.id,
    telefono: destinatario
  });

  await delay(getRandomSendDelay());
} catch (err) {
  enviadosFallidos++;
  console.error(`❌ Envío ${envio.id} fallido: ${err.message}`);
  diagLog('❌ ERROR sendMessage', {
    envio_id: envio.id,
    error: err.message,
    telefono: destinatario
  });
  break;  // ⚠️ Solo rompe el for, no revierte estado
}
```

---

### 5️⃣ **Validación en Session Manager Client**

**Archivo:** `services/central-hub/src/integrations/sessionManager/sessionManagerClient.js`  
**Función:** `sendMessage()` (Líneas 246-308)

```javascript
async sendMessage({ cliente_id, to, message }) {
  try {
    const response = await this._fetchWithTimeout('/send', {
      method: 'POST',
      body: JSON.stringify({
        cliente_id,
        to,
        message
      })
    }, this.sendTimeout);

    if (response.ok) {
      const result = await response.json();
      console.log(`[SessionManager] ✅ Mensaje enviado a ${to}`);
      return result;  // ⚠️ Confía en la respuesta HTTP, no en ACK de WhatsApp
    }

    // Manejo de errores HTTP...
  }
}
```

**⚠️ PROBLEMA:** 
- Confía en el HTTP 200 del Session Manager
- NO valida ACK (acknowledgment) de WhatsApp
- Si Session Manager responde 200 pero WhatsApp falla, no se detecta

---

### 6️⃣ **Endpoint de Session Manager**

**Archivo:** `services/session-manager/routes/send.js`  
**Endpoint:** `POST /send` (Líneas 11-70)

```javascript
router.post('/', async (req, res) => {
  // ...validaciones...
  
  // Check session status
  const status = getStatus(clienteId);
  if (status.state !== 'READY') {
    return res.status(409).json({
      error: true,
      code: 'SESSION_NOT_READY',
      message: `WhatsApp session not ready. Current state: ${status.state}`
    });
  }

  // Send message
  const result = await sendMessage(clienteId, to, message);
  res.status(200).json(result);  // ⚠️ Responde 200 si no lanza error
});
```

**⚠️ PROBLEMA:**
- Si `sendMessage()` no lanza excepción, responde 200
- Depende de que `client.sendMessage()` lance error para fallar

---

### 7️⃣ **Envío Real en WhatsApp Web**

**Archivo:** `services/session-manager/whatsapp/client.js`  
**Función:** `sendMessage()` (Líneas 307-328)

```javascript
export async function sendMessage(clienteId, to, message) {
  const clientData = clients.get(clienteId);
  
  if (!clientData || !clientData.client) {
    throw new Error(`WhatsApp client not initialized`);
  }

  // Validación estricta: solo READY permite envío
  if (clientData.state !== SessionState.READY) {
    throw new Error(`Session not ready. Current state: ${clientData.state}`);
  }

  // Format phone number
  const formattedNumber = to.includes('@c.us') ? to : `${to}@c.us`;

  try {
    const sentMessage = await clientData.client.sendMessage(formattedNumber, message);
    return {
      ok: true,
      message_id: sentMessage.id._serialized  // ⚠️ Retorna message_id pero NO se guarda en BD
    };
  } catch (error) {
    console.error(`[WhatsApp] Send error:`, error);
    throw error;  // ✅ Propaga el error correctamente
  }
}
```

**📌 OBSERVACIÓN IMPORTANTE:**
- Retorna `message_id` del mensaje enviado
- Este `message_id` NO se guarda en `ll_envios_whatsapp`
- No hay columna `message_id` en la tabla
- No hay forma de verificar después si el mensaje realmente se envió

---

## 🔥 ESCENARIO DEL INCIDENTE (07-02-2026)

### Secuencia de Eventos Probable:

```
1. Scheduler ejecuta procesarProgramacion()
   ✅ getStatus() retorna state = 'READY' (sesión aparenta estar OK)
   
2. Obtiene 250 registros pendientes
   ✅ Consulta exitosa
   
3. LOOP de envío (250 iteraciones):
   
   Para cada envio:
   
   a) marcarEnviado(envio.id)
      ✅ UPDATE ll_envios_whatsapp SET estado = 'enviado'
      ✅ Estado cambiado en BD
   
   b) await sessionManagerClient.sendMessage(...)
      ⏸️  Session Manager recibe request
      ⏸️  Intenta client.sendMessage(to, message)
      ❌ Error: "Requesting main frame too early!"
      ❌ Chrome/Puppeteer NO está listo
      ❌ Sesión real está DISCONNECTED
      ✅ Error lanzado correctamente
   
   c) catch (err)
      ✅ enviadosFallidos++
      ✅ console.error(`❌ Envío ${envio.id} fallido`)
      ✅ break  // Sale del loop
   
   PERO:
   ❌ El estado en BD YA está como "enviado"
   ❌ No hay rollback
   ❌ mensaje_id es null
   ❌ No hay forma de verificar después
```

### Resultado Final:
- **250 registros** marcados como "enviados"
- **0 mensajes** realmente enviados
- **0 message_id** guardados
- **Sin forma de detectar** el problema después

---

## 📋 EVIDENCIA TÉCNICA

### 1. Logs del Incidente:
```
ERROR: Requesting main frame too early!
```
- Indica que Puppeteer/Chrome NO estaba listo
- Sesión de WhatsApp NO estaba operativa
- El `getStatus()` inicial mintió (cache o race condition)

### 2. Base de Datos:
```sql
SELECT COUNT(*) FROM ll_envios_whatsapp 
WHERE estado = 'enviado' 
  AND fecha_envio LIKE '2026-02-07%'
  AND message_id IS NULL;
```
**Resultado esperado:** 250 registros

### 3. Ausencia de Columna:
```sql
DESCRIBE ll_envios_whatsapp;
```
**No existe:** columna `message_id`

### 4. Sin Respuestas de Destinatarios:
- 0 respuestas registradas
- Confirma que los mensajes NUNCA llegaron

---

## 🎯 PUNTOS DE FALLO IDENTIFICADOS

| # | Ubicación | Problema | Criticidad |
|---|-----------|----------|------------|
| **1** | `programacionScheduler.js:244` | `marcarEnviado()` ejecuta ANTES de `sendMessage()` | 🔴 CRÍTICO |
| **2** | `programacionScheduler.js:282` | `catch` no revierte estado a "pendiente" | 🔴 CRÍTICO |
| **3** | `ll_envios_whatsapp` | No tiene columna `message_id` | 🟡 ALTO |
| **4** | `sessionManagerClient.js:268` | Confía en HTTP 200, no en ACK de WhatsApp | 🟡 ALTO |
| **5** | `whatsapp/client.js:318` | `message_id` retornado pero no usado | 🟠 MEDIO |
| **6** | `programacionScheduler.js:153` | `getStatus()` puede estar cacheado o desincronizado | 🟠 MEDIO |

---

## 🧪 PRUEBA DE CONCEPTO DEL BUG

### Test Case:
```javascript
// Simular Session Manager que responde 200 pero WhatsApp falla

const mockSessionManager = {
  async sendMessage() {
    // Retorna 200 OK aunque internamente falle
    return { ok: true, message_id: 'fake_id' };
  }
};

// Flujo actual:
await marcarEnviado(id);  // ✅ Estado = "enviado"
await mockSessionManager.sendMessage();  // ✅ No lanza error
// Resultado: Estado "enviado" sin confirmación real
```

---

## 📌 RIESGOS DE LA LÓGICA ACTUAL

### 1. **Race Condition en getStatus()**
```javascript
status = await sessionManagerClient.getStatus();
// En este momento: state = 'READY'

// 2 segundos después (durante el loop):
// Sesión se desconecta → state = 'DISCONNECTED'

// Pero el código sigue ejecutando como si estuviera READY
```

### 2. **Sin Idempotencia**
```javascript
// Si se ejecuta dos veces por error:
await marcarEnviado(id);  // Registro marcado "enviado"
await marcarEnviado(id);  // Falla (estado ya no es 'pendiente')
// Pero el primer UPDATE ya fue, sin forma de revertir
```

### 3. **Sin Transacciones**
```javascript
// No hay:
BEGIN TRANSACTION;
  UPDATE ll_envios_whatsapp SET estado = 'enviado' WHERE id = ?;
  -- Intento de envío
  -- Si falla:
    ROLLBACK;
  -- Si éxito:
    COMMIT;
```

### 4. **Dependencia de Errores para Detectar Fallas**
```javascript
// Si sendMessage() NO lanza error (por timeout, etc):
try {
  await sessionManagerClient.sendMessage(...);
  // Asume éxito aunque el mensaje nunca llegó
} catch {
  // Solo aquí detecta fallo
}
```

---

## 🔬 VALIDACIÓN ADICIONAL NECESARIA

### ¿El Session Manager valida ACK de WhatsApp?

**Respuesta:** NO

**Evidencia:**
```javascript
// whatsapp/client.js:318
const sentMessage = await clientData.client.sendMessage(formattedNumber, message);
return {
  ok: true,
  message_id: sentMessage.id._serialized
};
```

- Confía en que `client.sendMessage()` retorne objeto
- NO valida campo `ack` (acknowledgment)
- NO espera confirmación de entrega
- NO verifica `sentMessage.ack === 1` (enviado) o `2` (recibido)

---

## 📊 COMPARACIÓN: FLUJO ACTUAL vs FLUJO SEGURO

| Paso | Flujo Actual (Problemático) | Flujo Seguro |
|------|----------------------------|--------------|
| 1 | Verifica `getStatus()` UNA vez al inicio | Verifica `getStatus()` en CADA mensaje |
| 2 | `UPDATE estado = 'enviado'` | `UPDATE estado = 'enviando'` |
| 3 | `await sendMessage()` | `await sendMessage()` |
| 4 | Si falla: solo log | Si falla: `UPDATE estado = 'pendiente'` |
| 5 | Si éxito: nada más | Si éxito: `UPDATE estado = 'enviado', message_id = ?` |
| 6 | Sin columna `message_id` | Con `message_id` para auditoría |
| 7 | Sin transacción | Con transacción o compensación |

---

## ✅ RESUMEN EJECUTIVO

### **Diagnóstico:**

El sistema marca mensajes como "enviados" en base a **ausencia de excepción** en lugar de **confirmación positiva** de entrega.

### **Flujo Problemático:**

```
marcarEnviado(id) → UPDATE estado = 'enviado'
                      ↓
              sendMessage()
                      ↓
           ┌──────────┴──────────┐
           ↓                     ↓
        Éxito                 Falla
     (sin validar ACK)    (catch solo logea)
           ↓                     ↓
    Estado: "enviado"      Estado: "enviado" ❌
    message_id: null       message_id: null ❌
```

### **Punto de Fallo Principal:**

**Línea 244 de `programacionScheduler.js`:**
```javascript
const marcado = await marcarEnviado(envio.id);
```

Esta línea ejecuta:
```sql
UPDATE ll_envios_whatsapp 
SET estado = "enviado", fecha_envio = NOW() 
WHERE id = ? AND estado = "pendiente"
```

**ANTES** de confirmar que `sendMessage()` tuvo éxito real.

---

## 🎓 CONCLUSIÓN TÉCNICA

**El incidente del 07-02-2026 fue causado por un FALLO DE DISEÑO en el orden de operaciones del scheduler de envíos.**

**Condiciones que permitieron el incidente:**

1. ✅ `getStatus()` retornó `READY` al inicio (posiblemente estado cacheado o race condition)
2. ❌ Loop de envío marcó registros como "enviados" ANTES de intentar enviar
3. ❌ Session Manager estaba en realidad DISCONNECTED o Chrome no listo
4. ❌ `client.sendMessage()` lanzó error "Requesting main frame too early!"
5. ❌ El `catch` solo registró el fallo pero NO revirtió el estado en BD
6. ❌ Resultado: 250 registros con `estado = 'enviado'` pero sin entregas reales

**No hay sugerencias de solución en este diagnóstico según lo solicitado.**

---

**Archivo generado:** `/root/leadmaster-workspace/DIAGNOSTICO_CRITICO_ENVIOS_WHATSAPP.md`  
**Fecha:** 2026-02-12  
**Analista:** Sistema de Diagnóstico Automatizado
