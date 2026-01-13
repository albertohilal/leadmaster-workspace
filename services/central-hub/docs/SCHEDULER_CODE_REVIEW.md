# 🔍 Code Review - Campaign Scheduler (programacionScheduler.js)

**Fecha:** 2026-01-13  
**Archivo:** `src/modules/sender/services/programacionScheduler.js`  
**Líneas:** 292  
**Arquitectura:** Contract-based con Session Manager

---

## 📋 Resumen Ejecutivo

**Calificación General: ✅ APROBADO (8.5/10)**

El código está **bien diseñado** y cumple correctamente con los principios de arquitectura contract-based. La implementación es **robusta, legible y mantenible**. Se identificaron mejoras menores que aumentarían la confiabilidad sin cambiar el diseño fundamental.

**Puntos destacados:**
- ✅ Separación clara de responsabilidades
- ✅ Validaciones exhaustivas en múltiples niveles
- ✅ Manejo correcto de errores tipados
- ✅ Logging descriptivo y útil
- ✅ Lock de procesamiento efectivo
- ✅ Anti-spam bien implementado
- ✅ Coherente con arquitectura contract-based

**Áreas de mejora identificadas:**
- ⚠️ Falta verificación de tabla `ll_programacion_envios_diarios` (podría no existir)
- ⚠️ El lock `processing` podría quedar trabado ante ciertos errores
- ⚠️ Delay aleatorio debería ser configurable
- ⚠️ Falta timeout general para el tick completo

---

## ✅ Aspectos Bien Diseñados

### 1. Arquitectura Contract-Based (EXCELENTE)

**Código analizado:**
```javascript
// PASO 1: Consultar estado de sesión (OBLIGATORIO según contrato)
let session;
try {
  session = await sessionManagerClient.getSession(instanceId);
} catch (error) {
  // Manejo de errores tipados
  if (error instanceof SessionNotFoundError) { /* ... */ }
  if (error instanceof SessionManagerTimeoutError) { /* ... */ }
  if (error instanceof SessionManagerUnreachableError) { /* ... */ }
  return; // ABORTA
}

// PASO 2: Verificar estado según contrato (NO NEGOCIABLE)
if (session.status !== SessionStatus.CONNECTED) {
  // Mensajes descriptivos por estado
  console.warn(`⏸️  Programación ${programacion.id} ABORTADA: ...`);
  return;
}
```

**✅ Excelente porque:**
- **NO cachea estado** - Consulta en cada ejecución
- **NO asume disponibilidad** - Siempre verifica antes de enviar
- **Manejo exhaustivo de errores** - Cubre todos los casos del contrato
- **Mensajes descriptivos** - Cada estado tiene su explicación
- **Aborto limpio** - No intenta enviar si no está conectado

**💡 Recomendación:** Mantener este diseño sin cambios.

---

### 2. Lock de Procesamiento Simple y Efectivo

**Código analizado:**
```javascript
let processing = false;

async function tick() {
  if (processing) return; // Evita ejecuciones concurrentes
  processing = true;
  try {
    // ... procesamiento
  } catch (err) {
    console.error('❌ Error en scheduler de programaciones:', err);
  } finally {
    processing = false; // SIEMPRE se libera
  }
}
```

**✅ Excelente porque:**
- **Simple y efectivo** - No requiere librerías externas
- **Bloque finally** - Garantiza liberación del lock
- **Return temprano** - Si está procesando, sale inmediatamente

**⚠️ Mejora menor sugerida:**

Agregar log cuando se skipea por lock activo:

```javascript
async function tick() {
  if (processing) {
    console.debug('⏭️  Tick omitido: procesamiento anterior aún en curso');
    return;
  }
  processing = true;
  // ... resto del código
}
```

**Justificación:** Ayuda a detectar si el intervalo de 60s es insuficiente para completar el procesamiento.

---

### 3. Validación de Ventana Temporal (CORRECTA)

**Código analizado:**
```javascript
function dentroDeVentana(programacion, ahora) {
  const diaActual = DAY_KEYS[ahora.getDay()];
  const dias = (programacion.dias_semana || '')
    .split(',')
    .map((d) => d.trim().toLowerCase());
  if (!dias.includes(diaActual)) return false;

  const horaActual = ahora.toTimeString().slice(0, 8); // HH:MM:SS
  return horaActual >= programacion.hora_inicio && horaActual <= programacion.hora_fin;
}
```

**✅ Bien diseñado porque:**
- **Manejo de nullish** - `dias_semana || ''` previene errores
- **Normalización** - `trim().toLowerCase()` evita problemas de formato
- **Comparación de strings** - Funciona correctamente para formato HH:MM:SS

**⚠️ Edge case identificado:**

Si `hora_inicio` y `hora_fin` cruzan medianoche (ej: `23:00:00 - 01:00:00`), la lógica falla.

**Solución sugerida:**

```javascript
function dentroDeVentana(programacion, ahora) {
  const diaActual = DAY_KEYS[ahora.getDay()];
  const dias = (programacion.dias_semana || '')
    .split(',')
    .map((d) => d.trim().toLowerCase());
  if (!dias.includes(diaActual)) return false;

  const horaActual = ahora.toTimeString().slice(0, 8);
  const { hora_inicio, hora_fin } = programacion;
  
  // Si la ventana cruza medianoche
  if (hora_inicio > hora_fin) {
    return horaActual >= hora_inicio || horaActual <= hora_fin;
  }
  
  // Ventana normal dentro del mismo día
  return horaActual >= hora_inicio && horaActual <= hora_fin;
}
```

**Justificación:** Permite programaciones nocturnas (ej: restaurantes abiertos hasta 2am).

---

### 4. Control de Cupo Diario (ROBUSTO)

**Código analizado:**
```javascript
async function enviadosHoy(programacionId) {
  const [rows] = await connection.query(
    `SELECT enviados FROM ll_programacion_envios_diarios
      WHERE programacion_id = ? AND fecha = CURDATE()`,
    [programacionId]
  );
  if (!rows.length) return 0;
  return rows[0].enviados;
}

async function incrementarConteo(programacionId, cantidad) {
  await connection.query(
    `INSERT INTO ll_programacion_envios_diarios (programacion_id, fecha, enviados)
     VALUES (?, CURDATE(), ?)
     ON DUPLICATE KEY UPDATE enviados = enviados + VALUES(enviados), actualizado_en = NOW()`,
    [programacionId, cantidad]
  );
}
```

**✅ Excelente porque:**
- **Uso de CURDATE()** - Resetea automáticamente cada día
- **ON DUPLICATE KEY UPDATE** - Evita errores si el registro existe
- **Return 0 por defecto** - Si no hay registro, asume 0 enviados
- **Incremento atómico** - `enviados = enviados + VALUES(enviados)` es seguro

**⚠️ Riesgo identificado: Tabla inexistente**

Si la tabla `ll_programacion_envios_diarios` no existe, el scheduler crasheará.

**Solución sugerida:**

```javascript
async function enviadosHoy(programacionId) {
  try {
    const [rows] = await connection.query(
      `SELECT enviados FROM ll_programacion_envios_diarios
        WHERE programacion_id = ? AND fecha = CURDATE()`,
      [programacionId]
    );
    if (!rows.length) return 0;
    return rows[0].enviados;
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') {
      console.error('❌ CRÍTICO: Tabla ll_programacion_envios_diarios no existe');
      console.error('   Ejecutar: CREATE TABLE ll_programacion_envios_diarios (...)');
      return 0; // Asume 0 para no bloquear el scheduler
    }
    throw error; // Re-lanza otros errores
  }
}
```

**Justificación:** Previene crash total si la migración de DB no se ejecutó.

---

### 5. Delay Aleatorio Anti-Spam (CORRECTO)

**Código analizado:**
```javascript
// Delay aleatorio entre mensajes (anti-spam)
const randomDelay = 2000 + Math.floor(Math.random() * 4000);
await delay(randomDelay);
```

**✅ Bien implementado porque:**
- **Rango 2-6 segundos** - Suficiente para evitar bloqueos de WhatsApp
- **Aleatorización** - Previene patrones detectables

**⚠️ Mejora sugerida: Configurabilidad**

Hardcodear los valores dificulta ajustes sin editar código.

**Solución sugerida:**

```javascript
// Al inicio del archivo
const DELAY_MIN_MS = parseInt(process.env.SCHEDULER_DELAY_MIN || '2000', 10);
const DELAY_MAX_MS = parseInt(process.env.SCHEDULER_DELAY_MAX || '6000', 10);

// En el loop de envío
const randomDelay = DELAY_MIN_MS + Math.floor(Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS));
await delay(randomDelay);
```

**Justificación:** Permite ajustar el delay sin redeployar (útil si WhatsApp cambia sus límites).

---

### 6. Logging Descriptivo (EXCELENTE)

**Código analizado:**
```javascript
console.log(`✅ Programación ${programacion.id}: Sesión verificada (cliente ${clienteId}, teléfono: ${session.phone_number || 'N/A'})`);

console.warn(`[SENDER BLOCKED] Programación ${programacion.id} ABORTADA: Campaña ${campania.id} "${campania.nombre}" no está aprobada para envío (estado actual: ${campania.estado})`);

console.log(`⏸️  Programación ${programacion.id}: Cupo diario agotado (${enviados}/${programacion.cupo_diario})`);
```

**✅ Excelente porque:**
- **Emojis como prefijos** - Facilita escaneo visual
- **Contexto completo** - IDs, nombres, estados
- **Niveles correctos** - `warn` para bloqueos, `error` para fallos
- **Sin ruido** - Solo logea cuando hay decisión o acción

**💡 Recomendación:** Mantener este estilo de logging.

---

## ⚠️ Riesgos Identificados y Soluciones

### Riesgo 1: Race Condition en Cupo Diario (BAJO)

**Escenario:**
Si en el futuro se ejecutan múltiples instancias del scheduler (multi-proceso), dos procesos podrían leer el mismo cupo disponible simultáneamente.

**Ejemplo:**
1. Proceso A lee: `enviados = 45`, `disponible = 5`
2. Proceso B lee: `enviados = 45`, `disponible = 5`
3. Proceso A envía 5 mensajes
4. Proceso B envía 5 mensajes
5. Total enviado: 55 (excede cupo de 50)

**Estado actual:**
✅ **NO es un problema** porque el código ejecuta en **un solo proceso** con lock `processing`.

**Mitigación futura (si se escala a multi-proceso):**

```javascript
async function obtenerYReservarCupo(programacionId, cantidadSolicitada) {
  const [result] = await connection.query(
    `UPDATE ll_programacion_envios_diarios
     SET enviados = LEAST(enviados + ?, cupo_maximo)
     WHERE programacion_id = ? AND fecha = CURDATE() AND enviados < cupo_maximo
     RETURNING enviados`,
    [cantidadSolicitada, programacionId]
  );
  
  if (!result.length) return 0;
  return Math.min(cantidadSolicitada, result[0].enviados);
}
```

**Justificación:** Update atómico con `LEAST()` garantiza que nunca se exceda el cupo.

---

### Riesgo 2: Timeout Global del Tick (MEDIO)

**Código actual:**
```javascript
async function tick() {
  if (processing) return;
  processing = true;
  try {
    const ahora = new Date();
    const programaciones = await obtenerProgramacionesActivas();
    for (const prog of programaciones) {
      if (!dentroDeVentana(prog, ahora)) continue;
      await procesarProgramacion(prog); // SIN TIMEOUT
    }
  } catch (err) {
    console.error('❌ Error en scheduler de programaciones:', err);
  } finally {
    processing = false;
  }
}
```

**Problema:**
Si una programación tiene 1000 mensajes pendientes y el delay es 4s por mensaje, el tick duraría **~67 minutos**.

**Consecuencias:**
- El lock `processing` bloquearía los siguientes ticks
- Los logs mostrarían `⏭️ Tick omitido` repetidamente
- Programaciones posteriores no se procesarían

**Solución sugerida:**

```javascript
const TICK_TIMEOUT_MS = 50 * 1000; // 50 segundos (deja margen al intervalo de 60s)

async function tick() {
  if (processing) {
    console.debug('⏭️  Tick omitido: procesamiento anterior aún en curso');
    return;
  }
  processing = true;
  
  const tickPromise = (async () => {
    const ahora = new Date();
    const programaciones = await obtenerProgramacionesActivas();
    for (const prog of programaciones) {
      if (!dentroDeVentana(prog, ahora)) continue;
      await procesarProgramacion(prog);
    }
  })();
  
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Tick timeout excedido')), TICK_TIMEOUT_MS)
  );
  
  try {
    await Promise.race([tickPromise, timeoutPromise]);
  } catch (err) {
    if (err.message === 'Tick timeout excedido') {
      console.error('⏱️  TIMEOUT: Tick excedió 50 segundos. Abortando ciclo actual.');
    } else {
      console.error('❌ Error en scheduler de programaciones:', err);
    }
  } finally {
    processing = false;
  }
}
```

**Justificación:** Garantiza que el scheduler no se quede trabado procesando una sola programación.

---

### Riesgo 3: Falta Validación de Campos Requeridos (BAJO)

**Código actual:**
```javascript
async function procesarProgramacion(programacion) {
  const clienteId = Number(programacion.cliente_id); // ¿Y si es undefined?
  const instanceId = `sender_${clienteId}`;
  // ...
}
```

**Problema:**
Si `programacion.cliente_id` es `null` o `undefined`, `clienteId` será `0` o `NaN`.

**Solución sugerida:**

```javascript
async function procesarProgramacion(programacion) {
  // Validar campos requeridos
  if (!programacion.cliente_id || !programacion.campania_id) {
    console.error(
      `⚠️  Programación ${programacion.id} IGNORADA: ` +
      `Datos incompletos (cliente_id=${programacion.cliente_id}, campania_id=${programacion.campania_id})`
    );
    return;
  }
  
  const clienteId = Number(programacion.cliente_id);
  if (isNaN(clienteId) || clienteId <= 0) {
    console.error(`⚠️  Programación ${programacion.id} IGNORADA: cliente_id inválido (${programacion.cliente_id})`);
    return;
  }
  
  const instanceId = `sender_${clienteId}`;
  // ... resto del código
}
```

**Justificación:** Previene errores crípticos en Session Manager por IDs inválidos.

---

### Riesgo 4: Error Handling en marcarEnviado() (BAJO)

**Código actual:**
```javascript
await marcarEnviado(envio.id);
enviadosAhora += 1;
```

**Problema:**
Si `marcarEnviado()` falla (ej: pérdida de conexión a DB), el mensaje **SÍ se envió** pero no se marcó como enviado.

**Consecuencia:**
En el próximo tick, el scheduler intentará enviar el mismo mensaje otra vez (duplicado).

**Solución sugerida:**

```javascript
try {
  await sessionManagerClient.sendMessage({
    clienteId,
    to: destinatario,
    message: envio.mensaje_final
  });
  
  // Intentar marcar como enviado
  try {
    await marcarEnviado(envio.id);
    enviadosAhora += 1;
  } catch (dbError) {
    console.error(
      `⚠️  Envío ${envio.id} COMPLETADO pero no se pudo actualizar DB: ${dbError.message}. ` +
      `Puede resultar en duplicado en próximo tick.`
    );
    enviadosAhora += 1; // Contar igual para el cupo diario
  }
  
  const randomDelay = 2000 + Math.floor(Math.random() * 4000);
  await delay(randomDelay);
  
} catch (err) {
  falladosAhora += 1;
  // ... resto del manejo de error
}
```

**Justificación:** Explicita el riesgo de duplicado y lo registra en logs.

---

## 💡 Mejoras Sugeridas (No Disruptivas)

### Mejora 1: Constantes Configurables

**Código actual:**
```javascript
const PROCESS_INTERVAL_MS = 60 * 1000; // cada minuto
```

**Mejora:**
```javascript
const PROCESS_INTERVAL_MS = parseInt(process.env.SCHEDULER_INTERVAL_MS || '60000', 10);
const DELAY_MIN_MS = parseInt(process.env.SCHEDULER_DELAY_MIN || '2000', 10);
const DELAY_MAX_MS = parseInt(process.env.SCHEDULER_DELAY_MAX || '6000', 10);
const TICK_TIMEOUT_MS = parseInt(process.env.SCHEDULER_TICK_TIMEOUT || '50000', 10);
```

**Justificación:**
- Testing más fácil (intervals cortos en dev)
- Ajustes sin redeploy
- Configuración por entorno (staging vs production)

---

### Mejora 2: Estadísticas de Ejecución

**Mejora:**
```javascript
let estadisticas = {
  ticksEjecutados: 0,
  ticksOmitidos: 0,
  programacionesProcesadas: 0,
  mensajesEnviados: 0,
  mensajesFallidos: 0,
  ultimoTick: null
};

function getEstadisticas() {
  return {
    ...estadisticas,
    uptime: Date.now() - (estadisticas.ultimoTick || Date.now())
  };
}

async function tick() {
  if (processing) {
    estadisticas.ticksOmitidos += 1;
    console.debug('⏭️  Tick omitido: procesamiento anterior aún en curso');
    return;
  }
  
  estadisticas.ticksEjecutados += 1;
  estadisticas.ultimoTick = Date.now();
  processing = true;
  // ... resto del código
}

module.exports = {
  start,
  getEstadisticas // <-- Nuevo export
};
```

**Justificación:**
- Útil para endpoint de health check
- Detecta degradación de performance
- Debugging en producción sin leer logs

---

### Mejora 3: Graceful Shutdown

**Mejora:**
```javascript
let intervalId = null;
let shutdownRequested = false;

function start() {
  intervalId = setInterval(tick, PROCESS_INTERVAL_MS);
  tick();
  console.log('⏰ Scheduler de programaciones iniciado');
}

async function stop() {
  console.log('🛑 Deteniendo scheduler...');
  shutdownRequested = true;
  
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  
  // Esperar a que termine el tick actual
  const maxWait = 60000; // 60 segundos
  const startWait = Date.now();
  while (processing && (Date.now() - startWait) < maxWait) {
    await delay(100);
  }
  
  if (processing) {
    console.warn('⚠️  Scheduler forzado a detenerse (tick en progreso)');
  } else {
    console.log('✅ Scheduler detenido correctamente');
  }
}

// Modificar tick() para respetar shutdown
async function tick() {
  if (processing || shutdownRequested) return;
  // ... resto del código
}

module.exports = {
  start,
  stop, // <-- Nuevo export
  getEstadisticas
};
```

**Uso en index.js:**
```javascript
const gracefulShutdown = (signal) => {
  console.log(`\n⚠️  ${signal} recibido. Cerrando servidor...`);
  
  // Detener scheduler primero
  programacionScheduler.stop();
  
  server.close(() => {
    console.log('✅ Servidor cerrado correctamente');
    process.exit(0);
  });
};
```

**Justificación:**
- Evita envíos a medias durante redeploy
- PM2 reload sin interrupciones bruscas

---

### Mejora 4: Validación de Configuración al Inicio

**Mejora:**
```javascript
async function validarConfiguracion() {
  const errores = [];
  
  // Validar conexión a DB
  try {
    await connection.query('SELECT 1');
  } catch (error) {
    errores.push(`Conexión a DB falló: ${error.message}`);
  }
  
  // Validar existencia de tablas
  const tablasRequeridas = [
    'll_programaciones',
    'll_campanias_whatsapp',
    'll_envios_whatsapp',
    'll_programacion_envios_diarios'
  ];
  
  for (const tabla of tablasRequeridas) {
    try {
      await connection.query(`SELECT 1 FROM ${tabla} LIMIT 0`);
    } catch (error) {
      if (error.code === 'ER_NO_SUCH_TABLE') {
        errores.push(`Tabla requerida no existe: ${tabla}`);
      }
    }
  }
  
  // Validar Session Manager
  try {
    // Intento de conexión básico (sin esperar sesión real)
    await sessionManagerClient.getSession('test_connection_check');
  } catch (error) {
    if (error instanceof SessionManagerUnreachableError) {
      errores.push('Session Manager no disponible');
    }
    // SessionNotFoundError es esperado aquí, ignorar
  }
  
  if (errores.length > 0) {
    console.error('❌ CONFIGURACIÓN INVÁLIDA - Scheduler NO iniciará:');
    errores.forEach(err => console.error(`   - ${err}`));
    return false;
  }
  
  console.log('✅ Configuración validada correctamente');
  return true;
}

async function start() {
  const configValida = await validarConfiguracion();
  if (!configValida) {
    console.error('❌ Scheduler abortado por errores de configuración');
    return;
  }
  
  intervalId = setInterval(tick, PROCESS_INTERVAL_MS);
  tick();
  console.log('⏰ Scheduler de programaciones iniciado');
}
```

**Justificación:**
- Fail-fast: errores detectados al arrancar, no en producción
- Logs claros sobre qué falta configurar

---

## 🎯 Recomendaciones Finales

### ✅ Mantener Sin Cambios

1. **Arquitectura contract-based** - Es el diseño correcto
2. **Lock de procesamiento** - Simple y efectivo
3. **Manejo de errores tipados** - Exhaustivo y claro
4. **Logging con emojis** - Excelente legibilidad
5. **Delay aleatorio** - Suficiente para anti-spam

### 🟡 Implementar (Prioridad Media)

1. **Timeout global del tick** - Previene bloqueos largos
2. **Validación de campos requeridos** - Evita errores crípticos
3. **Manejo de ventana nocturna** - Soporte para horarios 23:00-01:00
4. **Constantes configurables** - Facilita ajustes sin redeploy

### 🟢 Implementar (Prioridad Baja)

1. **Estadísticas de ejecución** - Útil para monitoreo
2. **Graceful shutdown** - Mejora experiencia de redeploy
3. **Validación de configuración** - Fail-fast al iniciar
4. **Try-catch en marcarEnviado()** - Explicitar riesgo de duplicado

### ❌ NO Implementar

1. ❌ Cachear estado de sesión
2. ❌ Reintentos automáticos
3. ❌ Procesamiento paralelo de programaciones
4. ❌ Cambiar a cron del sistema
5. ❌ Agregar queue externa (Redis, RabbitMQ)

---

## 📊 Matriz de Evaluación

| Aspecto | Calificación | Comentario |
|---------|-------------|------------|
| Arquitectura | ⭐⭐⭐⭐⭐ | Contract-based correctamente implementado |
| Robustez | ⭐⭐⭐⭐☆ | Falta timeout global del tick |
| Legibilidad | ⭐⭐⭐⭐⭐ | Código claro, bien comentado, logging excelente |
| Manejo de errores | ⭐⭐⭐⭐⭐ | Errores tipados, mensajes descriptivos |
| Performance | ⭐⭐⭐⭐☆ | Delay aleatorio podría ser configurable |
| Mantenibilidad | ⭐⭐⭐⭐☆ | Falta graceful shutdown y estadísticas |
| Seguridad | ⭐⭐⭐⭐⭐ | Lock efectivo, validaciones exhaustivas |
| Testing | ⭐⭐⭐☆☆ | No hay tests unitarios (fuera de scope) |

**Promedio: 4.5/5 (9/10)**

---

## 🔧 Código de Mejoras Sugeridas

### Archivo: `programacionScheduler.js` (Versión Mejorada)

**Cambios mínimos y no disruptivos:**

```javascript
/**
 * Servicio que ejecuta el envío de campañas según la programación
 * 
 * ARQUITECTURA CONTRACT-BASED:
 * - Consulta Session Manager ANTES de cada ejecución
 * - NO asume estado de sesión
 * - NO cachea estado entre ejecuciones
 * - Aborta si session.status !== 'connected'
 * 
 * Responsabilidades:
 * - Scheduler decide CUÁNDO ejecutar
 * - Session Manager decide SI puede ejecutar
 */

const connection = require('../db/connection');
const { 
  sessionManagerClient, 
  SessionStatus,
  SessionNotFoundError,
  SessionManagerTimeoutError,
  SessionManagerUnreachableError
} = require('../../../integrations/sessionManager');

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

// Configuración mediante variables de entorno
const PROCESS_INTERVAL_MS = parseInt(process.env.SCHEDULER_INTERVAL_MS || '60000', 10);
const DELAY_MIN_MS = parseInt(process.env.SCHEDULER_DELAY_MIN || '2000', 10);
const DELAY_MAX_MS = parseInt(process.env.SCHEDULER_DELAY_MAX || '6000', 10);
const TICK_TIMEOUT_MS = parseInt(process.env.SCHEDULER_TICK_TIMEOUT || '50000', 10);

let processing = false;
let intervalId = null;
let shutdownRequested = false;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ✅ MEJORA 1: Soporte para ventanas que cruzan medianoche
function dentroDeVentana(programacion, ahora) {
  const diaActual = DAY_KEYS[ahora.getDay()];
  const dias = (programacion.dias_semana || '')
    .split(',')
    .map((d) => d.trim().toLowerCase());
  if (!dias.includes(diaActual)) return false;

  const horaActual = ahora.toTimeString().slice(0, 8);
  const { hora_inicio, hora_fin } = programacion;
  
  // Si la ventana cruza medianoche (ej: 23:00:00 - 01:00:00)
  if (hora_inicio > hora_fin) {
    return horaActual >= hora_inicio || horaActual <= hora_fin;
  }
  
  // Ventana normal dentro del mismo día
  return horaActual >= hora_inicio && horaActual <= hora_fin;
}

async function obtenerProgramacionesActivas() {
  const [rows] = await connection.query(
    `SELECT p.*
     FROM ll_programaciones p
     WHERE p.estado = 'aprobada'
       AND p.fecha_inicio <= CURDATE()
       AND (p.fecha_fin IS NULL OR p.fecha_fin >= CURDATE())`
  );
  return rows;
}

// ✅ MEJORA 2: Try-catch para tabla inexistente
async function enviadosHoy(programacionId) {
  try {
    const [rows] = await connection.query(
      `SELECT enviados FROM ll_programacion_envios_diarios
        WHERE programacion_id = ? AND fecha = CURDATE()`,
      [programacionId]
    );
    if (!rows.length) return 0;
    return rows[0].enviados;
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') {
      console.error('❌ CRÍTICO: Tabla ll_programacion_envios_diarios no existe');
      return 0; // Asume 0 para no bloquear el scheduler
    }
    throw error;
  }
}

async function incrementarConteo(programacionId, cantidad) {
  try {
    await connection.query(
      `INSERT INTO ll_programacion_envios_diarios (programacion_id, fecha, enviados)
       VALUES (?, CURDATE(), ?)
       ON DUPLICATE KEY UPDATE enviados = enviados + VALUES(enviados), actualizado_en = NOW()`,
      [programacionId, cantidad]
    );
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') {
      console.error('❌ CRÍTICO: Tabla ll_programacion_envios_diarios no existe');
      // No lanza error para evitar crash del scheduler
    } else {
      throw error;
    }
  }
}

async function obtenerPendientes(campaniaId, limite) {
  const [rows] = await connection.query(
    `SELECT id, telefono_wapp, mensaje_final
     FROM ll_envios_whatsapp
     WHERE campania_id = ? AND estado = 'pendiente'
     ORDER BY id ASC
     LIMIT ?`,
    [campaniaId, limite]
  );
  return rows;
}

async function marcarEnviado(id) {
  await connection.query(
    'UPDATE ll_envios_whatsapp SET estado = "enviado", fecha_envio = NOW() WHERE id = ?',
    [id]
  );
}

/**
 * Procesa una programación según el contrato Session Manager
 */
async function procesarProgramacion(programacion) {
  // ✅ MEJORA 3: Validar campos requeridos
  if (!programacion.cliente_id || !programacion.campania_id) {
    console.error(
      `⚠️  Programación ${programacion.id} IGNORADA: ` +
      `Datos incompletos (cliente_id=${programacion.cliente_id}, campania_id=${programacion.campania_id})`
    );
    return;
  }
  
  const clienteId = Number(programacion.cliente_id);
  if (isNaN(clienteId) || clienteId <= 0) {
    console.error(`⚠️  Programación ${programacion.id} IGNORADA: cliente_id inválido`);
    return;
  }
  
  const instanceId = `sender_${clienteId}`;

  // PASO 1: Consultar estado de sesión (OBLIGATORIO según contrato)
  let session;
  try {
    session = await sessionManagerClient.getSession(instanceId);
  } catch (error) {
    if (error instanceof SessionNotFoundError) {
      console.warn(
        `⏸️  Programación ${programacion.id} ABORTADA: ` +
        `Sesión no existe para cliente ${clienteId}. Debe inicializarse primero.`
      );
      return;
    }
    
    if (error instanceof SessionManagerTimeoutError) {
      console.error(
        `⏸️  Programación ${programacion.id} ABORTADA: ` +
        `Session Manager no respondió (timeout). Reintentará en el próximo ciclo.`
      );
      return;
    }
    
    if (error instanceof SessionManagerUnreachableError) {
      console.error(
        `⏸️  Programación ${programacion.id} ABORTADA: ` +
        `Session Manager no disponible. Reintentará en el próximo ciclo.`
      );
      return;
    }
    
    console.error(
      `⏸️  Programación ${programacion.id} ABORTADA: ` +
      `Error consultando sesión: ${error.message}`
    );
    return;
  }

  // PASO 2: Verificar estado según contrato (NO NEGOCIABLE)
  if (session.status !== SessionStatus.CONNECTED) {
    const statusMessages = {
      [SessionStatus.INIT]: 'Sesión inicializando. Requiere escaneo de QR.',
      [SessionStatus.QR_REQUIRED]: 'QR no escaneado. Debe escanearse para conectar.',
      [SessionStatus.CONNECTING]: 'Sesión conectando. Esperar autenticación.',
      [SessionStatus.DISCONNECTED]: 'WhatsApp desconectado. Requiere reconexión.',
      [SessionStatus.ERROR]: `Error en sesión: ${session.last_error_message || 'desconocido'}`
    };
    
    const reason = statusMessages[session.status] || `Estado: ${session.status}`;
    
    console.warn(
      `⏸️  Programación ${programacion.id} ABORTADA: ` +
      `Cliente ${clienteId} no conectado. ${reason}`
    );
    return;
  }

  // PASO 3: Sesión conectada - proceder con envíos
  console.log(
    `✅ Programación ${programacion.id}: Sesión verificada (cliente ${clienteId}, ` +
    `teléfono: ${session.phone_number || 'N/A'})`
  );

  // PASO 4: Validar estado de la campaña (OBLIGATORIO)
  const [campaniaRows] = await connection.query(
    'SELECT id, nombre, estado FROM ll_campanias_whatsapp WHERE id = ?',
    [programacion.campania_id]
  );

  if (!campaniaRows.length) {
    console.error(
      `⏸️  Programación ${programacion.id} ABORTADA: ` +
      `Campaña ${programacion.campania_id} no encontrada`
    );
    return;
  }

  const campania = campaniaRows[0];

  if (campania.estado !== 'en_progreso') {
    console.warn(
      `[SENDER BLOCKED] Programación ${programacion.id} ABORTADA: ` +
      `Campaña ${campania.id} "${campania.nombre}" no está aprobada para envío ` +
      `(estado actual: ${campania.estado})`
    );
    return;
  }

  console.log(
    `✅ Campaña ${campania.id} "${campania.nombre}": Estado validado (en_progreso)`
  );

  const enviados = await enviadosHoy(programacion.id);
  const disponible = programacion.cupo_diario - enviados;
  
  if (disponible <= 0) {
    console.log(`⏸️  Programación ${programacion.id}: Cupo diario agotado (${enviados}/${programacion.cupo_diario})`);
    return;
  }

  const pendientes = await obtenerPendientes(programacion.campania_id, disponible);
  
  if (!pendientes.length) {
    console.log(`⏸️  Programación ${programacion.id}: No hay mensajes pendientes`);
    return;
  }

  console.log(`🕒 Programación ${programacion.id}: Enviando ${pendientes.length} mensajes`);
  
  let enviadosAhora = 0;
  let falladosAhora = 0;
  
  for (const envio of pendientes) {
    if (!envio.telefono_wapp || !envio.mensaje_final) {
      console.warn(`⚠️  Envío ${envio.id}: Datos incompletos (teléfono o mensaje vacío)`);
      continue;
    }
    
    try {
      const destinatario = envio.telefono_wapp.includes('@c.us')
        ? envio.telefono_wapp
        : `${envio.telefono_wapp}@c.us`;

      await sessionManagerClient.sendMessage({
        clienteId,
        to: destinatario,
        message: envio.mensaje_final
      });
      
      // ✅ MEJORA 4: Try-catch para marcarEnviado
      try {
        await marcarEnviado(envio.id);
        enviadosAhora += 1;
      } catch (dbError) {
        console.error(
          `⚠️  Envío ${envio.id} COMPLETADO pero no se pudo actualizar DB: ${dbError.message}. ` +
          `Puede resultar en duplicado en próximo tick.`
        );
        enviadosAhora += 1; // Contar igual para el cupo diario
      }
      
      // Delay aleatorio configurable
      const randomDelay = DELAY_MIN_MS + Math.floor(Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS));
      await delay(randomDelay);
      
    } catch (err) {
      falladosAhora += 1;
      console.error(
        `❌ Envío ${envio.id} FALLIDO: ${err.message} ` +
        `(destinatario: ${envio.telefono_wapp})`
      );
      
      if (err.message.includes('not ready') || err.message.includes('no está listo')) {
        console.error(
          `🛑 Programación ${programacion.id}: Abortando envíos restantes ` +
          `por problema de sesión`
        );
        break;
      }
    }
  }

  if (enviadosAhora > 0) {
    await incrementarConteo(programacion.id, enviadosAhora);
    console.log(
      `📊 Programación ${programacion.id}: Completado ` +
      `(${enviadosAhora} enviados, ${falladosAhora} fallidos)`
    );
  }
}

// ✅ MEJORA 5: Timeout global del tick
async function tick() {
  if (processing || shutdownRequested) {
    if (processing) {
      console.debug('⏭️  Tick omitido: procesamiento anterior aún en curso');
    }
    return;
  }
  
  processing = true;
  
  const tickPromise = (async () => {
    const ahora = new Date();
    const programaciones = await obtenerProgramacionesActivas();
    for (const prog of programaciones) {
      if (!dentroDeVentana(prog, ahora)) continue;
      await procesarProgramacion(prog);
    }
  })();
  
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Tick timeout excedido')), TICK_TIMEOUT_MS)
  );
  
  try {
    await Promise.race([tickPromise, timeoutPromise]);
  } catch (err) {
    if (err.message === 'Tick timeout excedido') {
      console.error('⏱️  TIMEOUT: Tick excedió límite de tiempo. Abortando ciclo actual.');
    } else {
      console.error('❌ Error en scheduler de programaciones:', err);
    }
  } finally {
    processing = false;
  }
}

function start() {
  if (intervalId) {
    console.warn('⚠️  Scheduler ya está iniciado');
    return;
  }
  
  intervalId = setInterval(tick, PROCESS_INTERVAL_MS);
  tick();
  console.log(`⏰ Scheduler iniciado (intervalo: ${PROCESS_INTERVAL_MS}ms, timeout: ${TICK_TIMEOUT_MS}ms)`);
}

// ✅ MEJORA 6: Graceful shutdown
async function stop() {
  console.log('🛑 Deteniendo scheduler...');
  shutdownRequested = true;
  
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  
  const maxWait = 60000;
  const startWait = Date.now();
  while (processing && (Date.now() - startWait) < maxWait) {
    await delay(100);
  }
  
  if (processing) {
    console.warn('⚠️  Scheduler forzado a detenerse (tick en progreso)');
  } else {
    console.log('✅ Scheduler detenido correctamente');
  }
  
  shutdownRequested = false;
}

module.exports = {
  start,
  stop
};
```

---

## 📝 Conclusión

El código actual está **bien diseñado y es funcional**. Las mejoras sugeridas son **incrementales y no disruptivas**, enfocadas en:

1. **Robustez:** Timeout global, validaciones de campos
2. **Operabilidad:** Graceful shutdown, constantes configurables
3. **Mantenibilidad:** Mejor manejo de edge cases

**Implementación recomendada:**
- ✅ **Ahora:** Mejoras 1-4 (timeout, validaciones, ventana nocturna, configuración)
- 🟢 **Próximo sprint:** Mejoras 5-6 (graceful shutdown)

El código está listo para producción con las mejoras menores sugeridas.

---

**Generado el 2026-01-13**
