# CHECKLIST DE ESTABILIZACIÓN POST-INCIDENTE
## Análisis del flujo de envío de mensajes WhatsApp

**Fecha:** 2026-02-12  
**Contexto:** Revisión técnica tras incidente de 250 envíos phantom del 2026-02-07  
**Estado:** ANÁLISIS COMPLETADO – SIN MODIFICACIONES AL CÓDIGO  

---

## 🔍 1. VERIFICACIÓN: programacionScheduler.js

### ✅ Localización de `marcarEnviado()`

**Archivo:** `services/central-hub/src/modules/sender/services/programacionScheduler.js`

#### Definición de la función:
```javascript
// Línea 137-142
async function marcarEnviado(id) {
  const [result] = await connection.query(
    'UPDATE ll_envios_whatsapp SET estado = "enviado", fecha_envio = NOW() WHERE id = ? AND estado = "pendiente"',
    [id]
  );
  return result.affectedRows === 1;
}
```

**Características:**
- ✅ Tiene filtro `WHERE id = ?` (no es masivo)
- ✅ Tiene condición `AND estado = "pendiente"` (optimistic locking)
- ✅ Retorna `true` solo si afectó 1 fila
- ⚠️ **NO tiene validación de sesión WhatsApp**
- ⚠️ **NO es transaccional**

---

### ⚠️ PROBLEMA CRÍTICO: Orden de ejecución

**Línea 241:** Se ejecuta `marcarEnviado()` **ANTES** del envío real

```javascript
// LÍNEA 241 - SE MARCA COMO ENVIADO PRIMERO
const marcado = await marcarEnviado(envio.id);

if (!marcado) {
  diagLog('⚠️ NO MARCADO', {
    envio_id: envio.id,
    razon: 'UPDATE afectó 0 filas (posible race condition)'
  });
  continue;
}

// Líneas 249-257: Preparación del mensaje
const destinatario = envio.telefono_wapp.includes('@c.us')
  ? envio.telefono_wapp
  : `${envio.telefono_wapp}@c.us`;

const mensajePersonalizado = envio.mensaje_final
  .replace(/\{nombre\}/gi, envio.nombre_destino || '')
  .replace(/\{nombre_destino\}/gi, envio.nombre_destino || '')
  .trim();

// LÍNEA 267 - INTENTO DE ENVÍO (PUEDE FALLAR)
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
  // LÍNEA 282 - CATCH BLOCK SIN ROLLBACK
  enviadosFallidos++;
  console.error(`❌ Envío ${envio.id} fallido: ${err.message}`);
  diagLog('❌ ERROR sendMessage', {
    envio_id: envio.id,
    error: err.message,
    telefono: destinatario
  });
  break; // Sale del loop pero NO revierte el estado
}
```

### ❌ CONSECUENCIAS DEL DISEÑO ACTUAL:

1. **Estado persistente sin confirmación:**
   - `marcarEnviado()` ejecuta UPDATE en línea 241
   - Si `sendMessage()` falla (línea 267), el catch NO revierte
   - El registro queda permanentemente con `estado='enviado'`

2. **No hay mecanismo de rollback:**
   - Catch block en línea 282 solo incrementa contador
   - No existe función `marcarError()` o `revertirAPendiente()`
   - No hay transacción SQL que abarque ambos pasos

3. **Break sale del loop:**
   - `break` en línea 291 detiene procesamiento de la campaña
   - Registros posteriores NO se procesan
   - No continúa con siguiente programación

---

### ✅ FILTROS DE CONSULTA

**Función `obtenerPendientes()` - Línea 125-134:**

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

**Validación:**
- ✅ Solo selecciona registros con `estado = 'pendiente'`
- ✅ Filtrado por `campania_id` específico
- ✅ Orden determinístico (`ORDER BY id ASC`)
- ✅ Límite por cupo diario (`LIMIT ?`)
- ✅ No hay posibilidad de procesar registros ya enviados

---

### 🔒 LÓGICA DE ESTADOS

**No existe lógica que marque como enviado sin pasar por sendMessage():**

Búsqueda en todo el proyecto:
```bash
grep -r "SET estado = 'enviado'" services/central-hub/src/**/*.js
```

**Resultados:**
1. `programacionScheduler.js:139` - Función `marcarEnviado()` (analizada arriba)
2. `destinatariosController.js:392` - Marca manual como `'sent_manual'` (diferente estado)

**Conclusión:**
- ✅ Solo existe UN punto de actualización a `estado='enviado'`
- ✅ Está en `marcarEnviado()` llamada desde `procesarProgramacion()`
- ✅ No hay batch updates sin filtro `WHERE id = ?`
- ❌ Pero se ejecuta ANTES de la confirmación de envío

---

## 🌐 2. VERIFICACIÓN: sessionManagerClient.js

**Archivo:** `services/central-hub/src/integrations/sessionManager/sessionManagerClient.js`

### ✅ Retorno en caso de éxito

**Línea 284-305:**

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
      console.log(`[SessionManager] ✅ Mensaje enviado a ${to} (cliente: ${cliente_id})`);
      return result; // <-- RETORNA OBJETO JSON
    }
    
    // ... manejo de errores ...
  }
}
```

**Session Manager endpoint `/send` retorna:**

```javascript
// services/session-manager/whatsapp/client.js - Línea 318-323
const sentMessage = await clientData.client.sendMessage(formattedNumber, message);
return {
  ok: true,
  message_id: sentMessage.id._serialized
};
```

**Respuesta esperada en éxito:**
```json
{
  "ok": true,
  "message_id": "true_5491123456789@c.us_3EB0ABCDEF123456"
}
```

⚠️ **PROBLEMA:** `programacionScheduler.js` NO captura `message_id` ni lo almacena en BD.

---

### ⚠️ Tipo de error en caso de desconexión

**Session Manager valida estado ANTES de enviar:**

```javascript
// routes/send.js - Línea 50-55
const status = getStatus(clienteId);
if (status.state !== 'READY') {
  return res.status(409).json({
    error: true,
    code: 'SESSION_NOT_READY',
    message: `WhatsApp session not ready. Current state: ${status.state}`
  });
}
```

**Tipos de error que lanza `sessionManagerClient`:**

1. **`SessionManagerSessionNotReadyError` (409):**
   - Estado de sesión != 'READY'
   - Ejemplo: `DISCONNECTED`, `AWAITING_QR`, `CONNECTING`

2. **`SessionManagerWhatsAppError` (500):**
   - Error interno de WhatsApp Web.js
   - Ejemplo: "Requesting main frame too early!"

3. **`SessionManagerTimeoutError`:**
   - Timeout después de 60 segundos (configurado en línea 32)

4. **`SessionManagerUnreachableError`:**
   - No se puede conectar con Session Manager
   - ECONNREFUSED, ENOTFOUND

**En caso de fallo del envío:**
```javascript
// sessionManagerClient.js - Línea 331-339
} catch (error) {
  if (error instanceof SessionManagerValidationError ||
      error instanceof SessionManagerSessionNotReadyError ||
      error instanceof SessionManagerWhatsAppError ||
      error instanceof SessionManagerTimeoutError ||
      error instanceof SessionManagerUnreachableError) {
    throw error; // <-- SE PROPAGA AL SCHEDULER
  }
  // ...
}
```

---

### ⏱️ Timeout configurado

**Línea 32:**
```javascript
this.sendTimeout = 60000; // 60s - Session Manager tarda 20-40s por mensaje
```

**Contexto:**
- Timeout de 60 segundos para cada llamada a `/send`
- Si Session Manager no responde en 60s → lanza `SessionManagerTimeoutError`
- ⚠️ Durante esos 60s, el registro ya está marcado como `enviado` en BD

---

## 🚨 3. RIESGOS ACTIVOS DETECTADOS

### 🔴 CRÍTICO: Actualización optimista sin rollback

**Impacto:** ALTO  
**Probabilidad:** ALTA (ya ocurrió el 2026-02-07)

**Descripción:**
- `marcarEnviado()` ejecuta UPDATE antes de envío
- Si `sendMessage()` falla por cualquier razón, no hay compensación
- Registro queda permanentemente como `enviado` sin confirmación

**Escenarios de fallo:**
1. ✅ **Sesión DISCONNECTED** → Lanza `SessionManagerSessionNotReadyError` → NO rollback
2. ✅ **Error de WhatsApp Web.js** → Lanza `SessionManagerWhatsAppError` → NO rollback
3. ✅ **Timeout 60s** → Lanza `SessionManagerTimeoutError` → NO rollback
4. ✅ **Session Manager caído** → Lanza `SessionManagerUnreachableError` → NO rollback

---

### 🔴 CRÍTICO: No hay columna message_id

**Impacto:** MEDIO  
**Probabilidad:** PERMANENTE

**Descripción:**
- Session Manager retorna `message_id` en respuesta
- `programacionScheduler.js` NO captura este valor
- No se almacena en tabla `ll_envios_whatsapp`
- Imposible rastrear ACK de WhatsApp
- Imposible correlacionar webhook de entrega

**Consecuencias:**
- No se puede verificar si mensaje fue realmente entregado
- No se puede detectar mensajes en tránsito (enviado pero no confirmado)
- Imposible implementar reintentos seguros

---

### 🟡 ALTO: Break sale del loop sin procesar resto

**Impacto:** MEDIO  
**Probabilidad:** ALTA

**Descripción:**
- En línea 291: `break;` detiene procesamiento al primer error
- Registros posteriores en la campaña NO se procesan
- Puede dejar cupo diario sin usar

**Ejemplo:**
- Cupo diario: 50 mensajes
- Envío #10 falla → `break`
- Mensajes 11-50 NO se procesan hasta siguiente tick (1 minuto después)

---

### 🟡 MEDIO: Validación de sesión al inicio, no por mensaje

**Impacto:** MEDIO  
**Probabilidad:** BAJA

**Descripción:**
- `procesarProgramacion()` valida sesión UNA vez (línea 158-165)
- Si sesión se desconecta durante el loop, no hay revalidación
- Con cupo diario alto (ej: 100 mensajes), puede tardar 100-150 minutos
- Sesión podría caer durante el procesamiento

**Mitigación actual:**
- Session Manager valida por mensaje
- Lanza `SessionManagerSessionNotReadyError` si estado != 'READY'
- Pero el UPDATE ya se ejecutó

---

### 🟢 BAJO: Delay anti-spam no configurable por campaña

**Impacto:** BAJO  
**Probabilidad:** N/A

**Descripción:**
- Delay fijo 30-90 segundos entre mensajes
- No se puede ajustar por tipo de campaña
- Campañas VIP no pueden tener menor delay
- Campañas sensibles no pueden tener mayor delay

---

## 📊 4. ESTADO ACTUAL DEL FLUJO

### Secuencia completa (ACTUAL):

```
1. tick() cada 60 segundos
   ↓
2. obtenerProgramacionesActivas()
   ↓
3. dentroDeVentana() - validar horario
   ↓
4. acquireProgramacionLock() - lock de programación
   ↓
5. procesarProgramacion()
   ├─ 5.1. sessionManagerClient.getStatus() - validar sesión UNA vez
   ├─ 5.2. enviadosHoy() - verificar cupo
   ├─ 5.3. obtenerPendientes() - SELECT con estado='pendiente'
   ├─ 5.4. LOOP por cada pendiente:
   │   ├─ 5.4.1. marcarEnviado(id) ⚠️ UPDATE estado='enviado'
   │   ├─ 5.4.2. Validar si UPDATE afectó 1 fila
   │   ├─ 5.4.3. Formatear destinatario
   │   ├─ 5.4.4. Personalizar mensaje
   │   ├─ 5.4.5. TRY:
   │   │   ├─ sessionManagerClient.sendMessage() ⚠️ PUEDE FALLAR
   │   │   ├─ enviadosExitosos++
   │   │   └─ delay(30-90s)
   │   └─ 5.4.6. CATCH: ⚠️ NO HAY ROLLBACK
   │       ├─ enviadosFallidos++
   │       ├─ console.error()
   │       └─ break ⚠️ SALE DEL LOOP
   └─ 5.5. incrementarConteo() - si enviadosExitosos > 0
   ↓
6. releaseProgramacionLock()
```

### ⚠️ Puntos de fallo sin recuperación:

| Línea | Acción | Consecuencia en caso de fallo |
|-------|--------|-------------------------------|
| 241   | `marcarEnviado()` | Estado actualizado permanentemente |
| 267   | `sendMessage()` | Si falla, estado NO se revierte |
| 282   | catch block | Solo log + contador, NO rollback |
| 291   | `break` | Detiene procesamiento de la campaña |

---

## ✅ 5. CAMBIOS MÍNIMOS RECOMENDADOS

### 🎯 Opción 1: ROLLBACK EN CATCH (Mínima invasión)

**Complejidad:** BAJA  
**Impacto:** MEDIO  
**Tiempo estimado:** 1-2 horas  

**Cambios:**

1. **Crear función `marcarError()`:**
   ```javascript
   async function marcarError(id, errorMessage) {
     const [result] = await connection.query(
       'UPDATE ll_envios_whatsapp SET estado = "error", fecha_envio = NULL WHERE id = ?',
       [id]
     );
     return result.affectedRows === 1;
   }
   ```

2. **Modificar catch block (línea 282):**
   ```javascript
   } catch (err) {
     enviadosFallidos++;
     console.error(`❌ Envío ${envio.id} fallido: ${err.message}`);
     
     // NUEVO: Revertir estado
     await marcarError(envio.id, err.message);
     
     diagLog('❌ ERROR sendMessage', {
       envio_id: envio.id,
       error: err.message,
       telefono: destinatario
     });
     break;
   }
   ```

**Ventajas:**
- Mínima modificación al código existente
- Detecta registros fallidos con `estado='error'`
- Permite reintentos manuales

**Desventajas:**
- No captura `message_id`
- No diferencia entre error de sesión y error de envío
- No es transaccional (ventana de inconsistencia)

---

### 🎯 Opción 2: ESTADO INTERMEDIO + TRANSACCIÓN (Recomendada)

**Complejidad:** MEDIA  
**Impacto:** ALTO  
**Tiempo estimado:** 4-6 horas  

**Cambios:**

1. **Modificar enum de estado en BD:**
   ```sql
   ALTER TABLE ll_envios_whatsapp 
   MODIFY estado ENUM('pendiente', 'enviando', 'enviado', 'error');
   ```

2. **Agregar columna `message_id`:**
   ```sql
   ALTER TABLE ll_envios_whatsapp 
   ADD COLUMN message_id VARCHAR(255) NULL AFTER estado,
   ADD INDEX idx_message_id (message_id);
   ```

3. **Refactorizar funciones:**
   ```javascript
   async function marcarEnviando(id) {
     const [result] = await connection.query(
       'UPDATE ll_envios_whatsapp SET estado = "enviando" WHERE id = ? AND estado = "pendiente"',
       [id]
     );
     return result.affectedRows === 1;
   }

   async function marcarEnviado(id, messageId) {
     const [result] = await connection.query(
       'UPDATE ll_envios_whatsapp SET estado = "enviado", message_id = ?, fecha_envio = NOW() WHERE id = ? AND estado = "enviando"',
       [messageId, id]
     );
     return result.affectedRows === 1;
   }

   async function revertirAPendiente(id) {
     const [result] = await connection.query(
       'UPDATE ll_envios_whatsapp SET estado = "pendiente" WHERE id = ? AND estado = "enviando"',
       [id]
     );
     return result.affectedRows === 1;
   }
   ```

4. **Modificar loop con transacción:**
   ```javascript
   for (const envio of pendientes) {
     // 1. Marcar como "enviando"
     const marcado = await marcarEnviando(envio.id);
     if (!marcado) continue;

     try {
       // 2. Intentar envío
       const result = await sessionManagerClient.sendMessage({
         cliente_id: clienteId,
         to: destinatario,
         message: mensajePersonalizado
       });

       // 3a. Si éxito: marcar "enviado" con message_id
       await marcarEnviado(envio.id, result.message_id);
       enviadosExitosos++;
       
       await delay(getRandomSendDelay());

     } catch (err) {
       // 3b. Si fallo: revertir a "pendiente" para reintento
       await revertirAPendiente(envio.id);
       enviadosFallidos++;
       
       console.error(`❌ Envío ${envio.id} fallido: ${err.message}`);
       break;
     }
   }
   ```

**Ventajas:**
- ✅ Estado intermedio `enviando` clarifica intención
- ✅ Captura `message_id` para trazabilidad
- ✅ Rollback automático en caso de fallo
- ✅ Permite reintento seguro (estado vuelve a `pendiente`)
- ✅ Detecta mensajes "colgados" (estado `enviando` > 5 minutos)

**Desventajas:**
- Requiere migración de BD
- Mayor complejidad en el código
- Necesita actualizar frontend para mostrar `enviando`

---

### 🎯 Opción 3: TRANSACCIÓN SQL COMPLETA (Más robusta)

**Complejidad:** ALTA  
**Impacto:** ALTO  
**Tiempo estimado:** 6-8 horas  

**Incluye todo de Opción 2 + transacciones SQL:**

```javascript
const conn = await connection.getConnection();

try {
  await conn.beginTransaction();

  // 1. Marcar como enviando
  await conn.query(
    'UPDATE ll_envios_whatsapp SET estado = "enviando" WHERE id = ? AND estado = "pendiente"',
    [envio.id]
  );

  // 2. Intentar envío
  const result = await sessionManagerClient.sendMessage({...});

  // 3. Confirmar como enviado
  await conn.query(
    'UPDATE ll_envios_whatsapp SET estado = "enviado", message_id = ?, fecha_envio = NOW() WHERE id = ?',
    [result.message_id, envio.id]
  );

  await conn.commit();
  enviadosExitosos++;

} catch (err) {
  await conn.rollback();
  enviadosFallidos++;
  console.error(`❌ Envío ${envio.id} fallido: ${err.message}`);
  break;
} finally {
  conn.release();
}
```

**Ventajas:**
- ✅ Transacción ACID completa
- ✅ Rollback automático garantizado
- ✅ Cero ventana de inconsistencia

**Desventajas:**
- Mayor complejidad
- Requiere pool de conexiones dedicado
- Bloquea fila durante envío (puede tardar 60s)

---

## 📝 6. PLAN DE ACCIÓN RECOMENDADO

### Fase 1: MITIGACIÓN INMEDIATA (HOY)

1. **Documentar registros afectados del incidente:**
   - ✅ Ya completado: IDs 4570-4819
   - ✅ Generado: `INFORME_INCIDENTE_2026-02-07.md`

2. **Habilitar diagnóstico operativo:**
   ```bash
   # En PM2 ecosystem.config.js
   env: {
     DIAG_SENDER: '1'  // Activa logs detallados
   }
   ```

3. **Verificar estado de sesión WhatsApp:**
   ```bash
   curl http://localhost:3002/status
   # Confirmar: "state": "READY"
   ```

4. **Reducir cupo diario temporalmente:**
   ```sql
   UPDATE ll_programaciones 
   SET cupo_diario = 10 
   WHERE estado = 'aprobada';
   ```
   - Limita daño potencial si vuelve a fallar
   - Permite monitoreo más cercano

---

### Fase 2: IMPLEMENTACIÓN DE FIX (1-2 DÍAS)

**Opción elegida:** Opción 1 (Rollback en catch) para estabilización rápida

1. **Implementar `marcarError()`:**
   - Crear función en `programacionScheduler.js`
   - Testear con casos de fallo simulado

2. **Modificar catch block:**
   - Agregar llamada a `marcarError()`
   - Validar que revierte estado correctamente

3. **Testing:**
   - Simular desconexión de Session Manager
   - Verificar que registros quedan con `estado='error'`
   - Confirmar que NO quedan con `estado='enviado'`

4. **Deploy:**
   ```bash
   pm2 restart central-hub
   pm2 logs central-hub --lines 100
   ```

5. **Monitoreo post-deploy (24 horas):**
   ```sql
   -- Ver distribución de estados en tiempo real
   SELECT estado, COUNT(*) 
   FROM ll_envios_whatsapp 
   GROUP BY estado;
   ```

---

### Fase 3: MEJORA ESTRUCTURAL (1-2 SEMANAS)

**Opción elegida:** Opción 2 (Estado intermedio + message_id)

1. **Migración de BD:**
   - Crear script de migración SQL
   - Backup completo de tabla `ll_envios_whatsapp`
   - Ejecutar ALTER TABLE en horario de baja carga

2. **Refactorización de código:**
   - Implementar nuevas funciones
   - Actualizar tests de integración
   - Documentar cambios en arquitectura

3. **Actualización de frontend:**
   - Agregar badge para estado `enviando`
   - Mostrar `message_id` en detalles
   - Implementar filtro por `message_id`

4. **Testing exhaustivo:**
   - Tests unitarios para nuevas funciones
   - Tests de integración con Session Manager
   - Tests de regresión en frontend

5. **Deploy escalonado:**
   - Ambiente de staging primero
   - Monitoreo 48 horas
   - Deploy a producción

---

## 📊 7. MÉTRICAS DE MONITOREO

### KPIs a vigilar post-fix:

```sql
-- 1. Registros "colgados" en estado enviando > 5 minutos
SELECT COUNT(*) as colgados
FROM ll_envios_whatsapp
WHERE estado = 'enviando'
  AND fecha_envio < DATE_SUB(NOW(), INTERVAL 5 MINUTE);

-- 2. Tasa de error por campaña
SELECT 
  campania_id,
  COUNT(*) as total,
  SUM(CASE WHEN estado = 'error' THEN 1 ELSE 0 END) as errores,
  ROUND(SUM(CASE WHEN estado = 'error' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as tasa_error_pct
FROM ll_envios_whatsapp
GROUP BY campania_id
HAVING tasa_error_pct > 5; -- Alertar si > 5%

-- 3. Envíos sin message_id (indica fallo de captura)
SELECT COUNT(*)
FROM ll_envios_whatsapp
WHERE estado = 'enviado'
  AND message_id IS NULL;
```

---

## ✅ 8. CHECKLIST PRE-REACTIVACIÓN

**Antes de activar campañas con cupo diario alto:**

- [ ] Fix de Fase 1 implementado y testeado
- [ ] Session Manager con estado `READY` confirmado
- [ ] Logs de PM2 sin errores en últimas 24 horas
- [ ] Query de monitoreo ejecutándose cada hora
- [ ] Cupo diario reducido a 10 inicialmente
- [ ] Persona de guardia asignada para monitoreo
- [ ] Plan de rollback documentado
- [ ] Backup de BD actualizado

**Durante prueba piloto (primeras 48 horas):**

- [ ] Monitoreo cada 2 horas de estado de sesión
- [ ] Verificar logs de DIAG_SENDER
- [ ] Ejecutar queries de KPIs cada 4 horas
- [ ] Validar al menos 5 mensajes manualmente (teléfono de prueba)
- [ ] Confirmar que registros con error NO quedan como enviado
- [ ] Si tasa de error > 10%: pausar y diagnosticar

**Criterios de éxito para incrementar cupo:**

- [ ] 0 registros phantom en 48 horas
- [ ] Tasa de error < 5%
- [ ] 0 mensajes colgados en estado `enviando`
- [ ] Logs sin `SessionManagerSessionNotReadyError`

---

## 📞 9. CONTACTOS Y ESCALAMIENTO

**En caso de incidente recurrente:**

1. Pausar campañas automáticas:
   ```bash
   export AUTO_CAMPAIGNS_ENABLED=false
   pm2 restart central-hub
   ```

2. Capturar log inmediato:
   ```bash
   pm2 logs central-hub --lines 500 > incident-$(date +%Y%m%d-%H%M%S).log
   ```

3. Ejecutar diagnóstico SQL:
   ```bash
   mysql -h ... < CONSULTAS_DIAGNOSTICO_ENVIOS.sql > diagnostico.txt
   ```

4. Notificar con datos:
   - Cantidad de registros afectados
   - IDs del rango afectado
   - Estado de sesión WhatsApp
   - Extracto de logs

---

**Fin del checklist**  
*Este documento debe revisarse después de cada incidente y actualizarse con lecciones aprendidas.*
