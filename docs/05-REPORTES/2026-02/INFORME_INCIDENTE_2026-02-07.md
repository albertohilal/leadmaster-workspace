# INFORME DE INCIDENTE – ENVÍOS PHANTOM DEL 2026-02-07

**Fecha del incidente:** 2026-02-07  
**Fecha del análisis:** 2026-02-12  
**Estado:** CONFIRMADO  

---

## 📊 RESUMEN EJECUTIVO

Se confirma que **250 registros** de la tabla `ll_envios_whatsapp` fueron marcados incorrectamente como `estado = 'enviado'` sin que los mensajes fueran realmente entregados a través de WhatsApp.

### Datos clave:
- **Total registros afectados:** 250
- **IDs afectados:** 4570 a 4819 (secuenciales)
- **Campaña afectada:** ID 47 "Haby – Reactivación" (estado: `en_progreso`)
- **Inicio incidente:** 2026-02-07 08:00:49
- **Fin incidente:** 2026-02-07 12:11:49
- **Duración:** 251 minutos (4 horas 11 minutos)
- **Patrón:** Exactamente 1 registro por minuto

---

## 🔍 ESTRUCTURA DE LA TABLA CONFIRMADA

```sql
DESCRIBE ll_envios_whatsapp;
```

| Campo          | Tipo                                | Null | Key | Default   | Extra          |
|----------------|-------------------------------------|------|-----|-----------|----------------|
| id             | int(11)                             | NO   | PRI | NULL      | auto_increment |
| campania_id    | int(11)                             | NO   | MUL | NULL      |                |
| telefono_wapp  | varchar(255)                        | YES  |     | NULL      |                |
| nombre_destino | varchar(255)                        | YES  |     | NULL      |                |
| mensaje_final  | text                                | YES  |     | NULL      |                |
| **estado**     | **enum('pendiente','enviado','error')** | YES  |     | pendiente |                |
| **fecha_envio**| **datetime**                        | YES  |     | NULL      |                |
| lugar_id       | int(11)                             | YES  | MUL | NULL      |                |

### ⚠️ COLUMNAS AUSENTES (según diseño esperado):
- **message_id** – No existe (no se puede rastrear ACK de WhatsApp)
- **updated_at** – No existe (no hay timestamp de última actualización)

---

## 📈 ANÁLISIS DE DATOS

### 1. Estado general del sistema

```sql
SELECT estado, COUNT(*) AS total
FROM ll_envios_whatsapp
GROUP BY estado;
```

| Estado    | Total |
|-----------|-------|
| pendiente | 349   |
| **enviado** | **472** |
| error     | 29    |
| **TOTAL** | **850** |

De los 472 registros marcados como "enviado", **250 (53%) son del incidente**.

---

### 2. Distribución del incidente por hora

```sql
SELECT 
    HOUR(fecha_envio) AS hora,
    COUNT(*) AS cantidad,
    MIN(fecha_envio) AS primer_registro,
    MAX(fecha_envio) AS ultimo_registro
FROM ll_envios_whatsapp
WHERE estado = 'enviado'
  AND fecha_envio BETWEEN '2026-02-07 08:00:00' AND '2026-02-07 12:15:00'
GROUP BY HOUR(fecha_envio);
```

| Hora | Cantidad | Primer registro      | Último registro      |
|------|----------|----------------------|----------------------|
| 08   | 59       | 2026-02-07 08:00:49  | 2026-02-07 08:59:49  |
| 09   | 60       | 2026-02-07 09:00:49  | 2026-02-07 09:59:49  |
| 10   | 59       | 2026-02-07 10:00:50  | 2026-02-07 10:59:50  |
| 11   | 60       | 2026-02-07 11:00:50  | 2026-02-07 11:59:50  |
| 12   | 12       | 2026-02-07 12:00:49  | 2026-02-07 12:11:49  |

**Total:** 59 + 60 + 59 + 60 + 12 = **250 registros**

---

### 3. Patrón minuto a minuto (primeros 20 registros)

```sql
SELECT 
    DATE_FORMAT(fecha_envio, '%Y-%m-%d %H:%i') AS minuto,
    COUNT(*) AS cantidad,
    id
FROM ll_envios_whatsapp
WHERE estado = 'enviado'
  AND fecha_envio BETWEEN '2026-02-07 08:00:00' AND '2026-02-07 08:20:00'
GROUP BY DATE_FORMAT(fecha_envio, '%Y-%m-%d %H:%i'), id
ORDER BY minuto;
```

| Minuto           | Cantidad | ID   | Campaña |
|------------------|----------|------|---------|
| 2026-02-07 08:00 | 1        | 4570 | 47      |
| 2026-02-07 08:01 | 1        | 4571 | 47      |
| 2026-02-07 08:02 | 1        | 4572 | 47      |
| 2026-02-07 08:03 | 1        | 4573 | 47      |
| ...              | ...      | ...  | ...     |
| 2026-02-07 08:19 | 1        | 4589 | 47      |

**Observación crítica:**
- Exactamente **1 registro por minuto**
- IDs **secuenciales** (4570, 4571, 4572...)
- Todos de la **misma campaña 47**
- Marca temporal siempre en el segundo **:49 o :50**

Este patrón confirma que el **scheduler estaba ejecutándose** (cada 60 segundos) y procesando la cola de mensajes pendientes.

---

### 4. Campaña afectada

```sql
SELECT 
    c.id,
    c.nombre,
    c.estado,
    COUNT(e.id) AS registros_phantom
FROM ll_envios_whatsapp e
JOIN ll_campanias_whatsapp c ON e.campania_id = c.id
WHERE e.estado = 'enviado'
  AND e.fecha_envio BETWEEN '2026-02-07 08:00:00' AND '2026-02-07 12:15:00'
GROUP BY c.id, c.nombre, c.estado;
```

| ID | Nombre                | Estado      | Registros Phantom |
|----|-----------------------|-------------|-------------------|
| 47 | Haby – Reactivación   | en_progreso | 250               |

---

## 🐛 CAUSA RAÍZ CONFIRMADA

### Archivo: `services/central-hub/src/modules/sender/services/programacionScheduler.js`

#### Secuencia de ejecución defectuosa:

```javascript
// Línea 244 – SE MARCA COMO ENVIADO ANTES DEL ENVÍO
const marcado = await marcarEnviado(envio.id);

if (!marcado) {
    logger.warn(`No se pudo marcar como enviado: ${envio.id}`);
    continue; // Siguiente envío
}

// Línea 250-266 – Preparación del mensaje
const mensaje = {
    session: 'admin',
    number: numero,
    message: envio.mensaje_final || campaniaActual?.mensaje || 'Mensaje por defecto'
};

// Línea 267 – INTENTO DE ENVÍO (puede fallar)
const result = await sessionManagerClient.sendMessage(mensaje);

// Línea 278-286 – SI FALLA, NO HAY ROLLBACK
} catch (error) {
    contadorEnvios.errores++;
    logger.error(`Error al enviar mensaje ${envio.id}: ${error.message}`);
    // NO REVIERTE estado='enviado' a 'pendiente'
}
```

#### Función `marcarEnviado()` – Línea 139:

```javascript
UPDATE ll_envios_whatsapp 
SET estado = "enviado", fecha_envio = NOW() 
WHERE id = ? AND estado = "pendiente"
```

### ⚠️ PROBLEMA CRÍTICO:

1. **UPDATE ejecutado de forma optimista** (línea 244)
2. **Envío real intentado después** (línea 267)
3. **Si falla el envío:** catch block NO revierte el estado (línea 282)
4. **Resultado:** El registro queda marcado `estado='enviado'` permanentemente, aunque el mensaje nunca se envió

---

## 📋 VALIDACIONES ADICIONALES

### 1. ¿Hay registros "enviado" sin fecha_envio?

```sql
SELECT COUNT(*) 
FROM ll_envios_whatsapp 
WHERE estado = 'enviado' AND fecha_envio IS NULL;
```

**Resultado:** 0 registros

✅ Todos los registros marcados como "enviado" tienen `fecha_envio` (el UPDATE es atómico).

---

### 2. ¿Hubo UPDATE masivo (batch)?

```sql
SELECT 
    DATE_FORMAT(fecha_envio, '%Y-%m-%d %H:%i:%s') AS segundo,
    COUNT(*) AS cantidad
FROM ll_envios_whatsapp
WHERE estado = 'enviado'
GROUP BY segundo
HAVING COUNT(*) > 5
ORDER BY cantidad DESC;
```

**Resultado:** Solo 1 registro mostró 10 registros en el mismo segundo (2026-01-20 10:00:00)

✅ No hubo UPDATE masivo batch. El patrón del incidente es consistente con ejecuciones individuales del scheduler cada minuto.

---

## 🎯 CONCLUSIONES

### Confirmaciones:
1. ✅ **250 registros** marcados falsamente como "enviado"
2. ✅ **Patrón consistente:** 1 registro/minuto durante 251 minutos
3. ✅ **Campaña única afectada:** ID 47 "Haby – Reactivación"
4. ✅ **IDs secuenciales:** 4570 a 4819
5. ✅ **Causa raíz:** UPDATE optimista antes de confirmación de envío

### Evidencia técnica:
- El scheduler `programacionScheduler.js` estuvo ejecutándose correctamente
- Cada minuto procesaba 1 registro de la campaña 47
- La sesión de WhatsApp estaba **DISCONNECTED** (error: "Requesting main frame too early!")
- `sendMessage()` lanzó excepciones, pero el UPDATE ya había modificado el estado
- No existe mecanismo de rollback en el catch block

### Impacto:
- **250 destinatarios** de la campaña "Haby – Reactivación" NO recibieron mensajes
- La base de datos muestra incorrectamente que fueron enviados
- No hay forma de rastrear estos registros sin análisis manual (no existe columna `message_id`)
- La campaña quedó en estado `en_progreso` con estadísticas incorrectas

---

## 📝 RECOMENDACIONES (NO IMPLEMENTADAS – SOLO DIAGNÓSTICO)

### Arquitectura correcta sugerida:

1. **Estado intermedio:**
   ```sql
   ALTER TABLE ll_envios_whatsapp 
   MODIFY estado ENUM('pendiente', 'enviando', 'enviado', 'error');
   ```

2. **Columna para ACK:**
   ```sql
   ALTER TABLE ll_envios_whatsapp 
   ADD COLUMN message_id VARCHAR(255) NULL AFTER estado;
   ```

3. **Secuencia correcta:**
   ```javascript
   // 1. Marcar como "enviando"
   await marcarEnviando(envio.id);
   
   // 2. Intentar envío
   const result = await sendMessage(...);
   
   // 3a. Si éxito: marcar "enviado" + guardar message_id
   await marcarEnviado(envio.id, result.message_id);
   
   // 3b. Si fallo: marcar "error" (o revertir a "pendiente")
   await marcarError(envio.id, error.message);
   ```

4. **Transacción con rollback:**
   ```javascript
   const connection = await db.getConnection();
   try {
       await connection.beginTransaction();
       await marcarEnviando(envio.id);
       const result = await sendMessage(...);
       await marcarEnviado(envio.id, result.message_id);
       await connection.commit();
   } catch (error) {
       await connection.rollback();
       logger.error(`Rollback ejecutado para envio ${envio.id}`);
   }
   ```

---

## 🔧 CONSULTAS SQL INCLUIDAS

Se generó el archivo `CONSULTAS_DIAGNOSTICO_ENVIOS.sql` con las siguientes consultas:

- **A)** Todos los registros con estado = 'enviado'
- **B)** Distribución por fecha_envio agrupado por minuto
- **C)** Verificación de consistencia (registros con/sin fecha_envio)
- **D)** Registros totales por campaña (incluyendo estado)
- **E)** Detección de UPDATE masivo (misma marca temporal)
- **Consultas especiales:** Análisis del incidente 2026-02-07

---

## 📚 ARCHIVOS RELACIONADOS

1. `DIAGNOSTICO_CRITICO_ENVIOS_WHATSAPP.md` – Análisis técnico completo del flujo
2. `CONSULTAS_DIAGNOSTICO_ENVIOS.sql` – Consultas de diagnóstico ejecutables
3. `programacionScheduler.js` – Código fuente del scheduler (líneas 139, 244, 267, 282)
4. `sessionManagerClient.js` – Cliente HTTP para Session Manager
5. `whatsapp/client.js` (session-manager) – Implementación de WhatsApp Web.js

---

**Fin del informe**  
*Este documento refleja el estado real de la base de datos al 2026-02-12*
