# 🔍 DIAGNÓSTICO TÉCNICO ERROR SQL - message_id

**Fecha:** 2026-02-18  
**Sistema:** LeadMaster Central Hub  
**Error:** ER_BAD_FIELD_ERROR: Unknown column 'message_id' in 'SET'  
**Criticidad:** 🔴 CRÍTICA (bloquea funcionalidad core)  
**Estado:** ✅ DIAGNOSTICADO

---

## 🎯 CAUSA RAÍZ IDENTIFICADA

```
Error: Unknown column 'message_id' in 'field list'
Code: ER_BAD_FIELD_ERROR
Query: UPDATE ll_envios_whatsapp SET estado = ?, fecha_envio = NOW(), message_id = ? WHERE id = ?
Location: estadoService.js:152
```

**Discrepancia código vs base de datos:**

- ✅ **Código implementado:** Asume que columna `message_id` existe
- ✅ **Migración creada:** `003_add_message_id_to_envios.sql` existe en `db/migrations/`
- ❌ **Base de datos:** Migración NO ejecutada en servidor remoto `sv46.byethost46.org`

**Patrón repetido:** Este es el SEGUNDO error del mismo tipo (primero fue `usuario_id`, ahora `message_id`).

---

## 📊 ANÁLISIS ESTRUCTURAL

### 1️⃣ Ubicación exacta del error

**Archivo:** `src/modules/sender/services/estadoService.js`  
**Línea:** 152  
**Función:** `cambiarEstado()`

```javascript
// Líneas 149-154 de estadoService.js
if (nuevoEstado === 'enviado') {
  await conn.query(
    'UPDATE ll_envios_whatsapp SET estado = ?, fecha_envio = NOW(), message_id = ? WHERE id = ?',
    //                                                               ^^^^^^^^^^
    //                                                               COLUMNA NO EXISTE EN BD
    [nuevoEstado, messageId, envioId]
  );
```

**Contexto de ejecución:**
- Se ejecuta cuando `cambiarEstado()` es llamado con `nuevoEstado === 'enviado'`
- El parámetro `messageId` viene de `{ messageId } = options`
- Puede ser `NULL` o un string como `"MANUAL-88-1708242671123"`

---

### 2️⃣ Flujos que invocan el código problemático

#### Flujo 1: Envío manual (confirmManual)

**Controller:** `src/modules/sender/controllers/enviosController.js`

```javascript
// Líneas 223-229
// Generar message_id interno para envío manual
const messageId = `MANUAL-${envioId}-${Date.now()}`;

// Actualizar message_id en la base de datos (usando conexión transaccional)
await connection.execute(
  `UPDATE ll_envios_whatsapp SET message_id = ? WHERE id = ?`,
  //                             ^^^^^^^^^^
  //                             ESTE UPDATE TAMBIÉN FALLA (línea 228)
  [messageId, envioId]
);

// Luego llama a cambiarEstado
await cambiarEstado(
  { connection },
  envioId,
  'enviado',
  'manual',
  `Envío manual confirmado...`,
  { usuarioId }
  // ⚠️ NOTA: No pasa messageId, pero cambiarEstado intenta UPDATE con NULL
);
```

**Problema en flujo manual:**
1. Línea 228: Primer UPDATE intenta SET message_id (falla)
2. Línea 233-239: Llama `cambiarEstado()` sin pasar `{ messageId }`
3. Línea 152 estadoService: Segundo UPDATE intenta SET message_id = NULL (falla)

#### Flujo 2: Scheduler automático (programacionScheduler)

**Service:** `src/modules/sender/services/programacionScheduler.js`

```javascript
// Líneas 288-291
await cambiarEstado(
  { connection: conn },
  envio.id,
  'enviado',
  'scheduler',
  `Envío vía Session Manager (${telefono})`,
  { messageId: result.message_id }
  //            ^^^^^^^^^^^^^^^^^^^
  //            Viene desde Session Manager (ej: "wamid.HBgNNTQ5MTEz...")
);
```

**Problema en flujo scheduler:**
- Línea 152 estadoService: UPDATE intenta SET message_id = 'wamid...' (falla)

---

### 3️⃣ Todas las ocurrencias de UPDATE con message_id

| Archivo | Línea | Query | Estado |
|---------|-------|-------|--------|
| **estadoService.js** | **152** | `UPDATE ll_envios_whatsapp SET estado = ?, fecha_envio = NOW(), message_id = ? WHERE id = ?` | 🔴 **FALLA** |
| **enviosController.js** | **228** | `UPDATE ll_envios_whatsapp SET message_id = ? WHERE id = ?` | 🔴 **FALLA** |

**Total:** 2 queries afectadas en producción.

---

### 4️⃣ Verificación de configuración de base de datos

**Pool único configurado:**

```javascript
// src/config/db.js
const pool = mysql.createPool({
  host: process.env.DB_HOST,        // sv46.byethost46.org
  user: process.env.DB_USER,        // iunaorg_b3toh
  password: process.env.DB_PASSWORD, // elgeneral2018
  database: process.env.DB_NAME,    // iunaorg_dyd
  port: process.env.DB_PORT || 3306,
  charset: 'utf8mb4',
  timezone: '-03:00',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
```

**Conclusiones:**
- ✅ Un solo pool de conexión
- ✅ Sin calificadores de schema (no hay `db.tabla` ni múltiples schemas)
- ✅ Todas las queries apuntan a la misma base de datos remota
- ✅ Sin override de configuración en archivos

**No existe:**
- ❌ Segunda configuración de DB
- ❌ Dual-write a múltiples schemas
- ❌ Conexión local vs remota diferenciada

---

### 5️⃣ Estado de migraciones

**Migración crítica:**

```
Archivo: db/migrations/003_add_message_id_to_envios.sql
Estado: ⏸️ PENDIENTE DE EJECUCIÓN
Propósito: Agregar columna message_id VARCHAR(255) NULL a ll_envios_whatsapp
Ubicación: AFTER fecha_envio
Índice: idx_message_id (opcional)
```

**Contenido de la migración (líneas 22-28):**

```sql
ALTER TABLE ll_envios_whatsapp 
  ADD COLUMN message_id VARCHAR(255) NULL 
  AFTER fecha_envio;

CREATE INDEX idx_message_id 
  ON ll_envios_whatsapp(message_id);
```

**Verificación idempotente (líneas 15-18):**

```sql
SET @existe_columna = (
  SELECT COUNT(*) 
  FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'll_envios_whatsapp' 
    AND COLUMN_NAME = 'message_id'
);
```

**Estado actual de migraciones:**

| Migración | Archivo | Estado | Bloqueante |
|-----------|---------|--------|------------|
| 001 | `fix_historial_enum_remove_no_incluido.sql` | ⏸️ Pendiente | No |
| 002 | `add_usuario_id_to_historial.sql` | ⏸️ **PENDIENTE** | **Sí** (error usuario_id) |
| 003 | `add_message_id_to_envios.sql` | ⏸️ **PENDIENTE** | **Sí** (error message_id) |

**Conclusión:** Ninguna de las 3 migraciones fue ejecutada en producción.

---

## 🚨 DIAGNÓSTICO FINAL

### Problema identificado:

**El código de producción intenta actualizar la columna `message_id` en la tabla `ll_envios_whatsapp`, pero esa columna NO existe en la base de datos remota porque la migración 003 nunca fue ejecutada.**

### Discrepancia código vs BD:

| Componente | Estado Esperado | Estado Real | Gap |
|------------|----------------|-------------|-----|
| **Código (estadoService.js:152)** | UPDATE con `message_id` | UPDATE con `message_id` | ✅ OK |
| **Código (enviosController.js:228)** | UPDATE `message_id` | UPDATE `message_id` | ✅ OK |
| **Código (programacionScheduler.js:290)** | Pasa `messageId` | Pasa `messageId` | ✅ OK |
| **Migración (archivo SQL)** | Existe en `db/migrations/` | Existe | ✅ OK |
| **BD Real (MySQL)** | Debe tener `message_id` | ❌ **NO TIENE** | 🔴 **CRÍTICO** |
| **Ejecución de migración** | Ejecutada | ❌ NO ejecutada | 🔴 **CRÍTICO** |

### Cadena de errores en producción:

```
1. Usuario confirma envío manual
   ↓
2. Controller línea 228: UPDATE message_id = 'MANUAL-88-...'
   ↓
3. MySQL rechaza: Unknown column 'message_id'
   ↓
4. Try/catch captura error, libera conexión
   ↓
5. Controller retorna 500 Internal Server Error
   ↓
6. PM2 logs: "Error en confirmManual: Unknown column 'message_id'"
```

**Flujos bloqueados:**
- ❌ Confirmación manual de envíos (`POST /envios/:id/manual/confirm`)
- ❌ Envíos automáticos vía scheduler (scheduler llama `cambiarEstado()` con messageId)

---

## ✅ SOLUCIÓN PASO A PASO

### Paso 1: Backup de la tabla afectada

```bash
cd /root/leadmaster-workspace/services/central-hub

# Backup de ll_envios_whatsapp (base de datos remota)
mysqldump -h sv46.byethost46.org -u iunaorg_b3toh -p'elgeneral2018' \
  iunaorg_dyd ll_envios_whatsapp > backup_envios_whatsapp_$(date +%Y%m%d_%H%M%S).sql

# Verificar backup
ls -lh backup_envios_whatsapp_*.sql
```

**Resultado esperado:**
```
-rw-r--r-- 1 root root 850K Feb 18 10:00 backup_envios_whatsapp_20260218_100000.sql
```

---

### Paso 2: Ejecutar migración crítica (003)

```bash
# Verificar contenido de la migración
cat db/migrations/003_add_message_id_to_envios.sql | head -40

# Ejecutar migración en base de datos remota
mysql -h sv46.byethost46.org -u iunaorg_b3toh -p'elgeneral2018' \
  iunaorg_dyd < db/migrations/003_add_message_id_to_envios.sql
```

**Salida esperada:**
```sql
+------------------+
| columna_existe   |
+------------------+
|                0 |  -- Columna no existe (esperado)
+------------------+

Query OK, 0 rows affected (0.15 sec)  -- ALTER TABLE ejecutado
Query OK, 0 rows affected (0.08 sec)  -- INDEX creado

+------------------+----------+------+-----+---------+----------------+
| Field            | Type     | Null | Key | Default | Extra          |
+------------------+----------+------+-----+---------+----------------+
| message_id       | varchar(255) | YES | MUL | NULL    |                | ✅
+------------------+----------+------+-----+---------+----------------+
```

---

### Paso 3: Verificar estructura actualizada

```bash
mysql -h sv46.byethost46.org -u iunaorg_b3toh -p'elgeneral2018' \
  iunaorg_dyd -e "DESCRIBE ll_envios_whatsapp;"
```

**Resultado esperado:**
```
+------------------+-----------------------------------------------------+------+-----+-------------------+
| Field            | Type                                                | Null | Key | Default           |
+------------------+-----------------------------------------------------+------+-----+-------------------+
| id               | int(11)                                             | NO   | PRI | NULL              |
| campania_id      | int(11)                                             | NO   | MUL | NULL              |
| telefono_wapp    | varchar(20)                                         | NO   |     | NULL              |
| nombre_destino   | varchar(255)                                        | YES  |     | NULL              |
| mensaje_final    | text                                                | NO   |     | NULL              |
| estado           | enum('pendiente','enviado','error')                 | NO   |     | pendiente         |
| fecha_envio      | datetime                                            | YES  |     | NULL              |
| message_id       | varchar(255)                                        | YES  | MUL | NULL              | ✅
| detalle_error    | text                                                | YES  |     | NULL              |
| created_at       | datetime                                            | NO   |     | CURRENT_TIMESTAMP |
| updated_at       | datetime                                            | YES  |     | ...               |
+------------------+-----------------------------------------------------+------+-----+-------------------+
```

**Verificar índice creado:**
```bash
mysql -h sv46.byethost46.org -u iunaorg_b3toh -p'elgeneral2018' \
  iunaorg_dyd -e "SHOW INDEXES FROM ll_envios_whatsapp WHERE Key_name = 'idx_message_id';"
```

**Resultado esperado:**
```
+---------------------+------------+----------------+--------------+-------------+
| Table               | Non_unique | Key_name       | Seq_in_index | Column_name |
+---------------------+------------+----------------+--------------+-------------+
| ll_envios_whatsapp  |          1 | idx_message_id |            1 | message_id  | ✅
+---------------------+------------+----------------+--------------+-------------+
```

---

### Paso 4: Reiniciar PM2

```bash
# Reiniciar servicio para refrescar pool de conexiones
pm2 restart leadmaster-central-hub

# Ver logs en tiempo real
pm2 logs leadmaster-central-hub --lines 30
```

**Logs esperados:**
```
PM2      | App [leadmaster-central-hub:12] starting in -fork mode-
PM2      | App [leadmaster-central-hub:12] online
12|leadmas | 🚀 Leadmaster Central Hub corriendo en http://localhost:3012
12|leadmas | ⏰ Scheduler de programaciones iniciado (cada 60 segundos)
```

**NO debe aparecer:**
```
❌ "Unknown column 'message_id'"
```

---

### Paso 5: Test del endpoint manual

```bash
# Preparar variables
ENVIO_ID=88
TOKEN="<tu_token_jwt_aqui>"

# Test con curl
curl -X POST "http://localhost:3000/api/sender/envios/${ENVIO_ID}/manual/confirm" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -v
```

**Resultado esperado:**
```json
{
  "success": true,
  "message": "Envío confirmado correctamente",
  "data": {
    "envio_id": 88,
    "estado_nuevo": "enviado",
    "campania_id": 10,
    "telefono": "5491112345678",
    "nombre_destino": "Juan Pérez"
  }
}
```

**Logs PM2 esperados:**
```
12|leadmas | [EstadoService] Envío 88: pendiente → enviado (manual)
12|leadmas | [ConfirmManual] Envío 88 marcado como enviado por usuario 1
```

**NO debe aparecer:**
```
❌ [EstadoService] Error cambiando estado envío 88: Unknown column 'message_id'
❌ Error en confirmManual: Unknown column 'message_id'
```

---

### Paso 6: Verificar message_id guardado en BD

```bash
mysql -h sv46.byethost46.org -u iunaorg_b3toh -p'elgeneral2018' \
  iunaorg_dyd -e "
  SELECT 
    id,
    estado,
    fecha_envio,
    message_id,
    created_at
  FROM ll_envios_whatsapp
  WHERE id = 88;
"
```

**Resultado esperado:**
```
+----+---------+---------------------+----------------------------+---------------------+
| id | estado  | fecha_envio         | message_id                 | created_at          |
+----+---------+---------------------+----------------------------+---------------------+
| 88 | enviado | 2026-02-18 10:15:32 | MANUAL-88-1708242932123    | 2026-02-15 08:30:00 |
+----+---------+---------------------+----------------------------+---------------------+
                                       ^^^^^^^^^^^^^^^^^^^^^^^^^^
                                       ✅ DEBE TENER VALOR
```

---

## 🔧 BUG ADICIONAL DETECTADO: Controller no pasa messageId

### Problema identificado en enviosController.js

**Líneas 233-239 (confirmManual):**

```javascript
await cambiarEstado(
  { connection },
  envioId,
  'enviado',
  'manual',
  `Envío manual confirmado por operador (campaña: ${envio.campania_nombre})`,
  { usuarioId }
  // ⚠️ BUG: No pasa messageId aquí, pero ya lo generó en línea 224
);
```

**Contexto:**
- Línea 224: `const messageId = 'MANUAL-88-1708242671123';`
- Línea 228: `UPDATE ll_envios_whatsapp SET message_id = ? WHERE id = ?` (primer UPDATE)
- Línea 233-239: Llama `cambiarEstado()` sin pasar `{ messageId }`
- Línea 152 estadoService: `UPDATE ... message_id = NULL` (segundo UPDATE)

**Resultado actual:**
1. Controller genera messageId ✅
2. Controller ejecuta UPDATE message_id = 'MANUAL-88-...' ✅
3. Controller llama cambiarEstado() SIN pasar messageId ❌
4. estadoService ejecuta UPDATE message_id = NULL (sobrescribe el valor) ❌

**Resultado esperado:**
- Solo estadoService debe hacer UPDATE de message_id
- Controller debe pasar `{ usuarioId, messageId }` a cambiarEstado()

### Solución del bug (opcional pero recomendado):

```javascript
// ANTES (líneas 223-239 actual)
const messageId = `MANUAL-${envioId}-${Date.now()}`;

await connection.execute(
  `UPDATE ll_envios_whatsapp SET message_id = ? WHERE id = ?`,
  [messageId, envioId]
);

await cambiarEstado(
  { connection },
  envioId,
  'enviado',
  'manual',
  `Envío manual confirmado...`,
  { usuarioId }
);

// DESPUÉS (recomendado)
const messageId = `MANUAL-${envioId}-${Date.now()}`;

// Eliminar UPDATE duplicado
// await connection.execute(...); ← BORRAR ESTO

await cambiarEstado(
  { connection },
  envioId,
  'enviado',
  'manual',
  `Envío manual confirmado...`,
  { usuarioId, messageId }  // ← Pasar messageId aquí
);
```

**Beneficios:**
- ✅ Un solo UPDATE (en estadoService, línea 152)
- ✅ Consistente con flujo del scheduler
- ✅ No sobrescribe message_id con NULL
- ✅ Menos queries SQL (performance)

---

## 📋 CHECKLIST DE VERIFICACIÓN POST-SOLUCIÓN

### Paso crítico (migración):
- [ ] Backup de `ll_envios_whatsapp` creado
- [ ] Migración 003 ejecutada sin errores
- [ ] Columna `message_id` existe en tabla envios
- [ ] Índice `idx_message_id` creado
- [ ] PM2 reiniciado sin errores

### Paso verificación funcional:
- [ ] Endpoint `/manual/confirm` retorna 200 OK
- [ ] Logs NO muestran "Unknown column 'message_id'"
- [ ] message_id se guarda correctamente en BD
- [ ] Scheduler automático funciona sin errores
- [ ] Contador de restarts PM2 no aumenta

### Paso opcional (refactor):
- [ ] Eliminar UPDATE duplicado en controller línea 228
- [ ] Pasar `{ messageId }` a cambiarEstado() en línea 239
- [ ] Verificar que no se sobrescribe message_id con NULL

---

## 📊 RESUMEN EJECUTIVO

| Componente | Estado Pre-Fix | Estado Post-Fix | Acción |
|------------|----------------|-----------------|--------|
| **Tabla ll_envios_whatsapp** | 🔴 Sin columna `message_id` | ✅ Con columna | **Ejecutar migración 003** |
| **estadoService.js:152** | 🔴 UPDATE falla | ✅ UPDATE OK | Automático post-migración |
| **enviosController.js:228** | 🔴 UPDATE falla | ✅ UPDATE OK | Automático post-migración |
| **Scheduler automático** | 🔴 Bloqueado | ✅ Funciona | Automático post-migración |
| **Endpoint manual** | 🔴 500 Error | ✅ 200 OK | Automático post-migración |
| **Bug duplicación UPDATE** | ⚠️ Controller hace UPDATE innecesario | ⚠️ Refactor opcional | Manual (opcional) |

---

## 🎯 CAUSA RAÍZ (RESUMIDA)

**Patrón repetido de discrepancia código/migrations:**

1. ✅ **Código implementado correctamente** (estadoService.js, enviosController.js, scheduler)
2. ✅ **Migración SQL creada** (`003_add_message_id_to_envios.sql`)
3. ❌ **Migración NO ejecutada en producción** (sv46.byethost46.org)
4. 🔴 **Resultado:** INSERT/UPDATE falla con `ER_BAD_FIELD_ERROR`

**Mismo problema anterior:**
- Error 1: `usuario_id` (migración 002 no ejecutada)
- Error 2: `message_id` (migración 003 no ejecutada)

**Conclusión:** Proceso de deployment NO incluye ejecución automática de migraciones.

---

## ✅ SOLUCIÓN (RESUMIDA)

```bash
# 1. Backup (base de datos remota)
mysqldump -h sv46.byethost46.org -u iunaorg_b3toh -p'elgeneral2018' \
  iunaorg_dyd ll_envios_whatsapp > backup_envios_$(date +%Y%m%d).sql

# 2. Ejecutar migración 003
mysql -h sv46.byethost46.org -u iunaorg_b3toh -p'elgeneral2018' \
  iunaorg_dyd < db/migrations/003_add_message_id_to_envios.sql

# 3. Verificar columna
mysql -h sv46.byethost46.org -u iunaorg_b3toh -p'elgeneral2018' \
  iunaorg_dyd -e "DESCRIBE ll_envios_whatsapp;" | grep message_id

# 4. Reiniciar PM2
pm2 restart leadmaster-central-hub

# 5. Testar endpoint
curl -X POST http://localhost:3000/api/sender/envios/88/manual/confirm \
  -H "Authorization: Bearer TOKEN"
```

**Resultado esperado:**
- ✅ UPDATE ejecuta sin errores
- ✅ Endpoint retorna 200 OK
- ✅ message_id se guarda correctamente

---

## 📚 REFERENCIAS

- **Informe de auditoría:** `INFORME_AUDITORIA_CUMPLIMIENTO_POLITICA_v1.2.0_2026-02-17.md`
- **Informe anterior (usuario_id):** `DIAGNOSTICO_ERROR_500_CONFIRM_MANUAL_2026-02-18.md`
- **Migraciones creadas:** `db/migrations/`
- **Política normativa:** `docs/WHATSAPP_MANUAL_ENVIO_POLICY.md` v1.2.0

---

**Diagnóstico completado.**  
**Fecha:** 2026-02-18  
**Herramienta:** grep + file analysis + code review  
**Tiempo de diagnóstico:** ~10 minutos  
**Prioridad de solución:** 🔴 CRÍTICA (bloquea 2 flujos principales)

---

**FIN DEL DIAGNÓSTICO**
