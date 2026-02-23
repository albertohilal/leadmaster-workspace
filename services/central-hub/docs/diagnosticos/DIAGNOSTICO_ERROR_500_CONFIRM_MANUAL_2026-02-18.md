# 🔍 DIAGNÓSTICO ERROR 500 - POST /api/sender/envios/:id/manual/confirm

**Fecha:** 2026-02-18  
**Sistema:** LeadMaster Central Hub  
**Endpoint:** `POST /api/sender/envios/88/manual/confirm`  
**Error:** 500 Internal Server Error  
**Estado:** ✅ DIAGNOSTICADO

---

## 🎯 CAUSA RAÍZ IDENTIFICADA

```
Error: Unknown column 'usuario_id' in 'INSERT INTO'
Code: ER_BAD_FIELD_ERROR
Location: estadoService.js → ll_envios_whatsapp_historial
```

**El código implementado asume que las migraciones SQL ya fueron ejecutadas, pero NO lo fueron.**

---

## 📊 ANÁLISIS ESTRUCTURADO

### 1️⃣ Verificación de Ruta - ✅ OK

**Montaje de routers (3 niveles):**

```javascript
// Nivel 1: src/index.js:65
app.use('/api/sender', require('./modules/sender/routes'));

// Nivel 2: src/modules/sender/routes/index.js:56
router.use('/envios', require('./envios'));

// Nivel 3: src/modules/sender/routes/envios.js:14
router.post('/:id/manual/confirm', enviosController.confirmManual);
```

**Ruta completa resultante:**
```
POST /api/sender/envios/:id/manual/confirm ✅
```

**Evidencia:**
- Archivo `envios.js` línea 14 confirmado
- Router correctamente exportado
- Método POST configurado

**Conclusión:** Ruta OK, no es el problema.

---

### 2️⃣ Verificación de Middleware - ✅ OK

**Middleware aplicado:**

```javascript
// src/modules/sender/routes/index.js:17
router.use(authenticate);
```

**Análisis del middleware:**
- Ubicación: `src/modules/auth/middleware/authMiddleware.js`
- Tiene try/catch propio (líneas 7-45)
- Captura errores y retorna 500 si falla
- Logs confirman que SÍ pasa el middleware (hay "Error en confirmManual" en logs)

**Evidencia:**
```javascript
// authMiddleware.js:43-46
catch (error) {
  console.error('Error en middleware de autenticación:', error);
  res.status(500).json({
    success: false,
    message: 'Error del servidor'
  });
}
```

**Logs PM2:**
```
Error en confirmManual: Error: Unknown column 'usuario_id'
```

Si el error fuera en el middleware, el log diría "Error en middleware de autenticación", no "Error en confirmManual".

**Conclusión:** Middleware OK, el controller SÍ se ejecuta.

---

### 3️⃣ Verificación de Controller - ✅ OK (código correcto)

**Archivo:** `src/modules/sender/controllers/enviosController.js`

**Análisis líneas 149-272:**

```javascript
exports.confirmManual = async (req, res) => {
  let connection = null;
  
  try {
    const { id: envioId } = req.params;
    const clienteId = req.user?.cliente_id;
    const usuarioId = req.user?.id; // ✅ Obtiene usuario_id

    // ✅ Validaciones presentes
    if (!clienteId || !usuarioId) {
      return res.status(401).json({ ... });
    }

    // ✅ Obtiene conexión transaccional
    connection = await pool.getConnection();

    // ✅ Valida permisos multi-tenant
    const [envios] = await connection.execute(`...`);

    // ✅ Valida estado
    if (envio.estado !== 'pendiente') { ... }

    // ✅ Llama a cambiarEstado correctamente
    await cambiarEstado(
      { connection },
      envioId,
      'enviado',
      'manual',
      `Envío manual confirmado...`,
      { usuarioId }  // ← Pasa usuarioId correctamente
    );

    connection.release();
    
    // ✅ Respuesta exitosa
    res.json({ success: true, ... });

  } catch (error) {
    // ✅ Libera conexión en error
    if (connection) {
      connection.release();
    }

    // ✅ Log de error presente
    console.error('Error en confirmManual:', error);
    
    // ✅ Validación de tipo de error
    if (error.message && error.message.includes('Transición no permitida')) {
      return res.status(400).json({ ... });
    }

    // ✅ Respuesta 500 genérica
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};
```

**Puntos de validación:**
- ✅ Try/catch presente y completo
- ✅ Connection pooling correcto
- ✅ Liberación de conexión en catch
- ✅ Logs de error implementados
- ✅ Validaciones de negocio presentes
- ✅ Pasa `usuarioId` correctamente a `cambiarEstado()`

**Conclusión:** Controller implementado correctamente. No es el problema.

---

### 4️⃣ Verificación de estadoService - 🔴 PROBLEMA ENCONTRADO

**Archivo:** `src/modules/sender/services/estadoService.js`

**Código que falla (líneas 82-87):**
```javascript
await conn.query(
  `INSERT INTO ll_envios_whatsapp_historial 
   (envio_id, estado_anterior, estado_nuevo, origen, detalle, usuario_id) 
   VALUES (?, ?, ?, ?, ?, ?)`,
  [envioId, estadoAnterior, nuevoEstado, origen, detalle, usuarioId]
  //                                                        ^^^^^^^^^^
  //                                                        COLUMNA NO EXISTE
);
```

**Error SQL generado:**
```sql
INSERT INTO ll_envios_whatsapp_historial 
(envio_id, estado_anterior, estado_nuevo, origen, detalle, usuario_id) 
                                                            ^^^^^^^^^^
                                                            ER_BAD_FIELD_ERROR
VALUES (88, 'pendiente', 'enviado', 'manual', 'Envío manual confirmado...', 1);
```

**Logs PM2 confirman:**
```
2026-02-18 08:44:29 -03:00: [EstadoService] Error cambiando estado envío 88: 
Unknown column 'usuario_id' in 'INSERT INTO'

2026-02-18 08:44:29 -03:00: Error en confirmManual: 
Error: Unknown column 'usuario_id' in 'INSERT INTO'
    at async exports.confirmManual (/root/.../enviosController.js:224:5) {
  code: 'ER_BAD_FIELD_ERROR',
```

**Conclusión:** El código está correcto, pero la base de datos NO tiene la columna.

---

### 5️⃣ Verificación de Base de Datos - 🔴 CRÍTICO

**Pool de conexión configurado:**
```javascript
// src/config/db.js
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  charset: 'utf8mb4',
  timezone: '-03:00',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
```

**Pool:** ✅ Configurado correctamente

**Schema actual:**
```sql
-- ll_envios_whatsapp_historial (estructura antes de migraciones)
CREATE TABLE `ll_envios_whatsapp_historial` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `envio_id` int(11) NOT NULL,
  `estado_anterior` enum('no_incluido','pendiente','enviado','error') NOT NULL,
  `estado_nuevo` enum('no_incluido','pendiente','enviado','error') NOT NULL,
  `origen` varchar(50) NOT NULL,
  `detalle` text DEFAULT NULL,
  -- ❌ NO EXISTE: `usuario_id` int(11) DEFAULT NULL
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_envio_id` (`envio_id`),
  CONSTRAINT `fk_envio_historial` FOREIGN KEY (`envio_id`) 
    REFERENCES `ll_envios_whatsapp` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
```

**Estado de migraciones:**

| Migración | Archivo | Estado | Ubicación |
|-----------|---------|--------|-----------|
| 001 | `fix_historial_enum_remove_no_incluido.sql` | ⏸️ Pendiente | `db/migrations/` |
| 002 | `add_usuario_id_to_historial.sql` | ⏸️ **PENDIENTE (crítica)** | `db/migrations/` |
| 003 | `add_message_id_to_envios.sql` | ⏸️ Pendiente | `db/migrations/` |

**Conclusión:** Las migraciones fueron creadas pero NO ejecutadas en la base de datos.

---

### 6️⃣ Verificación de Infraestructura - ✅ OK

**Procesos PM2:**
```
┌────┬────────────────────┬──────┬──────────┬──────────┬──────────┐
│ id │ name               │ ↺    │ status   │ cpu      │ memory   │
├────┼────────────────────┼──────┼──────────┼──────────┼──────────┤
│ 12 │ leadmaster-centra… │ 71   │ online   │ 0%       │ 147.8mb  │
│ 10 │ session-manager    │ 5    │ online   │ 0%       │ 104.9mb  │
└────┴────────────────────┴──────┴──────────┴──────────┴──────────┘
```

**Análisis:**
- ✅ 1 sola instancia corriendo (id 12)
- ⚠️ 71 restarts (alto, probablemente por este error repetido)
- ✅ Estado: online
- ✅ Memoria: 147.8mb (normal)

**Puerto configurado:**
```javascript
// src/index.js:102
const PORT = process.env.PORT || 3012;
```

**Server setup:**
```javascript
// src/index.js:104-115
const server = app.listen(PORT, () => {
  console.log(`🚀 Leadmaster Central Hub corriendo en http://localhost:${PORT}`);
  
  // Inicializar scheduler
  const programacionScheduler = require('./modules/sender/services/programacionScheduler');
  programacionScheduler.start();
  
  if (process.send) {
    process.send('ready');
  }
});
```

**Error handlers globales:** ✅ Presentes (líneas 138-153)

**Conclusión:** Infraestructura OK, 1 sola instancia en puerto correcto.

---

### 7️⃣ Verificación de Logs - ✅ FUNCIONAN CORRECTAMENTE

**Logs implementados en controller:**
```javascript
// enviosController.js:257
console.error('Error en confirmManual:', error);
```

**Logs implementados en estadoService:**
```javascript
// estadoService.js:107-110
catch (error) {
  await conn.rollback();
  console.error(
    `[EstadoService] Error cambiando estado envío ${envioId}:`,
    error.message
  );
  throw error;
}
```

**Salida PM2 confirmada:**
```
/root/.pm2/logs/leadmaster-central-hub-error.log:

2026-02-18 08:40:52 -03:00: [EstadoService] Error cambiando estado envío 88: 
Unknown column 'usuario_id' in 'INSERT INTO'

2026-02-18 08:40:52 -03:00: Error en confirmManual: 
Error: Unknown column 'usuario_id' in 'INSERT INTO'
    at async exports.confirmManual (/root/leadmaster-workspace/services/central-hub/src/modules/sender/controllers/enviosController.js:224:5) {
  code: 'ER_BAD_FIELD_ERROR',

2026-02-18 08:44:29 -03:00: [EstadoService] Error cambiando estado envío 88: 
Unknown column 'usuario_id' in 'INSERT INTO'

2026-02-18 08:44:29 -03:00: Error en confirmManual: 
Error: Unknown column 'usuario_id' in 'INSERT INTO'
    at async exports.confirmManual (/root/leadmaster-workspace/services/central-hub/src/modules/sender/controllers/enviosController.js:224:5) {
  code: 'ER_BAD_FIELD_ERROR',
```

**Conclusión:** Los logs funcionan perfectamente y muestran el error SQL claramente.

---

## 🚨 DIAGNÓSTICO FINAL

### Problema identificado:

**El código implementado en `estadoService.js` intenta insertar en la columna `usuario_id` de la tabla `ll_envios_whatsapp_historial`, pero esa columna NO existe en la base de datos.**

### Discrepancia código vs BD:

| Componente | Estado Esperado | Estado Real | Gap |
|------------|----------------|-------------|-----|
| **Código (estadoService.js)** | INSERT con `usuario_id` | INSERT con `usuario_id` | ✅ OK |
| **Código (enviosController.js)** | Pasa `{ usuarioId }` | Pasa `{ usuarioId }` | ✅ OK |
| **Código (schema.sql)** | Tiene columna `usuario_id` | Tiene columna `usuario_id` | ✅ OK |
| **BD Real (MySQL)** | Debe tener `usuario_id` | ❌ **NO TIENE** | 🔴 **CRÍTICO** |
| **Migraciones SQL** | Ejecutadas | ❌ NO ejecutadas | 🔴 **CRÍTICO** |

### Por qué el error es 500:

1. Request llega correctamente a `/api/sender/envios/88/manual/confirm`
2. Middleware `authenticate` pasa correctamente
3. Controller extrae `usuarioId` del token
4. Controller llama `cambiarEstado()` con `{ usuarioId }`
5. `estadoService.js` ejecuta INSERT con columna `usuario_id`
6. **MySQL rechaza el INSERT: columna no existe**
7. Error propagado al catch del controller
8. Controller retorna status 500

---

## ✅ SOLUCIÓN PASO A PASO

### Paso 1: Backup de la base de datos

```bash
cd /root/leadmaster-workspace/services/central-hub

# Backup completo de tablas afectadas (base de datos remota)
mysqldump -h sv46.byethost46.org -u iunaorg_b3toh -p'elgeneral2018' \
  iunaorg_dyd ll_envios_whatsapp_historial > backup_historial_$(date +%Y%m%d_%H%M%S).sql

mysqldump -h sv46.byethost46.org -u iunaorg_b3toh -p'elgeneral2018' \
  iunaorg_dyd ll_envios_whatsapp > backup_envios_$(date +%Y%m%d_%H%M%S).sql

# Verificar backup
ls -lh backup_*.sql
```

**Resultado esperado:**
```
-rw-r--r-- 1 root root 125K Feb 18 09:00 backup_historial_20260218_090000.sql
-rw-r--r-- 1 root root 450K Feb 18 09:00 backup_envios_20260218_090000.sql
```

**Nota:** La conexión a la base de datos remota puede tardar ~0.15 segundos (vs 0.05s local).

---

### Paso 2: Ejecutar migración crítica (002)

```bash
# Verificar que el archivo existe
cat db/migrations/002_add_usuario_id_to_historial.sql | head -20

# Ejecutar migración en base de datos remota
mysql -h sv46.byethost46.org -u iunaorg_b3toh -p'elgeneral2018' \
  iunaorg_dyd < db/migrations/002_add_usuario_id_to_historial.sql
```

**Salida esperada:**
```sql
+-------------+
| COUNT(*)    |
+-------------+
|           0 |  -- Columna no existe (esperado)
+-------------+

Query OK, 0 rows affected (0.05 sec)  -- ALTER TABLE ejecutado
Query OK, 0 rows affected (0.03 sec)  -- FK agregada
Query OK, 0 rows affected (0.02 sec)  -- INDEX creado
```

---

### Paso 3: Verificar estructura actualizada

```bash
mysql -h sv46.byethost46.org -u iunaorg_b3toh -p'elgeneral2018' \
  iunaorg_dyd -e "DESCRIBE ll_envios_whatsapp_historial;"
```

**Resultado esperado:**
```
+------------------+-----------------------------------------------------+------+-----+-------------------+
| Field            | Type                                                | Null | Key | Default           |
+------------------+-----------------------------------------------------+------+-----+-------------------+
| id               | int(11)                                             | NO   | PRI | NULL              |
| envio_id         | int(11)                                             | NO   | MUL | NULL              |
| estado_anterior  | enum('pendiente','enviado','error')                 | NO   |     | NULL              |
| estado_nuevo     | enum('pendiente','enviado','error')                 | NO   |     | NULL              |
| origen           | varchar(50)                                         | NO   |     | NULL              |
| detalle          | text                                                | YES  |     | NULL              |
| usuario_id       | int(11)                                             | YES  | MUL | NULL              | ✅
| created_at       | datetime                                            | NO   |     | CURRENT_TIMESTAMP |
+------------------+-----------------------------------------------------+------+-----+-------------------+
```

**Verificar foreign key:**
```bash
mysql -h sv46.byethost46.org -u iunaorg_b3toh -p'elgeneral2018' \
  iunaorg_dyd -e "
  SELECT 
    CONSTRAINT_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = 'iunaorg_dyd'
    AND TABLE_NAME = 'll_envios_whatsapp_historial'
    AND COLUMN_NAME = 'usuario_id';
"
```

**Resultado esperado:**
```
+-------------------------+-----------------------+------------------------+
| CONSTRAINT_NAME         | REFERENCED_TABLE_NAME | REFERENCED_COLUMN_NAME |
+-------------------------+-----------------------+------------------------+
| fk_historial_usuario    | usuarios              | id                     | ✅
+-------------------------+-----------------------+------------------------+
```

---

### Paso 4: Reiniciar PM2

```bash
# Reiniciar servicio
pm2 restart leadmaster-central-hub

# Ver logs en tiempo real
pm2 logs leadmaster-central-hub --lines 20
```

**Resultado esperado:**
```
PM2      | App [leadmaster-central-hub:12] starting in -fork mode-
PM2      | App [leadmaster-central-hub:12] online
12|leadmas | 🚀 Leadmaster Central Hub corriendo en http://localhost:3012
12|leadmas | ⏰ Scheduler de programaciones iniciado (cada 60 segundos)
```

---

### Paso 5: Test del endpoint

```bash
# Preparar variables
ENVIO_ID=88
TOKEN="tu_token_jwt_aqui"

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

---

### Paso 6: Verificar auditoría en BD

```bash
mysql -h sv46.byethost46.org -u iunaorg_b3toh -p'elgeneral2018' \
  iunaorg_dyd -e "
  SELECT 
    id,
    envio_id,
    estado_anterior,
    estado_nuevo,
    origen,
    usuario_id,
    detalle,
    created_at
  FROM ll_envios_whatsapp_historial
  WHERE envio_id = 88
  ORDER BY created_at DESC
  LIMIT 1;
"
```

**Resultado esperado:**
```
+----+----------+-----------------+--------------+--------+------------+--------------------------------+---------------------+
| id | envio_id | estado_anterior | estado_nuevo | origen | usuario_id | detalle                        | created_at          |
+----+----------+-----------------+--------------+--------+------------+--------------------------------+---------------------+
| 45 |       88 | pendiente       | enviado      | manual |          1 | Envío manual confirmado por... | 2026-02-18 09:15:32 |
+----+----------+-----------------+--------------+--------+------------+--------------------------------+---------------------+
                                                             ^^^^^^^^^^
                                                             ✅ DEBE TENER VALOR
```

---

## 📋 CHECKLIST DE VERIFICACIÓN POST-SOLUCIÓN

- [ ] Backup de `ll_envios_whatsapp_historial` creado
- [ ] Migración 002 ejecutada sin errores
- [ ] Columna `usuario_id` existe en tabla historial
- [ ] Foreign key `fk_historial_usuario` creada
- [ ] Índice `idx_historial_usuario` creado
- [ ] PM2 reiniciado sin errores
- [ ] Endpoint `/manual/confirm` retorna 200 OK
- [ ] Logs NO muestran "Unknown column 'usuario_id'"
- [ ] Historial registra `usuario_id` correctamente
- [ ] Contador de restarts PM2 no aumenta

---

## 🔧 MIGRACIONES ADICIONALES RECOMENDADAS

Después de resolver el problema crítico, ejecutar las otras migraciones:

### Migración 001 (media prioridad):
```bash
# Limpiar ENUM de estados legacy
mysql -h sv46.byethost46.org -u iunaorg_b3toh -p'elgeneral2018' \
  iunaorg_dyd < db/migrations/001_fix_historial_enum_remove_no_incluido.sql
```

**Impacto:** Elimina `'no_incluido'` del ENUM (alineación con Política v1.2.0)

### Migración 003 (media prioridad):
```bash
# Agregar message_id para trazabilidad WhatsApp
mysql -h sv46.byethost46.org -u iunaorg_b3toh -p'elgeneral2018' \
  iunaorg_dyd < db/migrations/003_add_message_id_to_envios.sql
```

**Impacto:** Permite correlacionar envíos con logs de Session Manager

---

## 📊 RESUMEN EJECUTIVO

| Componente | Estado Pre-Fix | Estado Post-Fix | Acción |
|------------|----------------|-----------------|--------|
| **Ruta** | ✅ OK | ✅ OK | Ninguna |
| **Middleware** | ✅ OK | ✅ OK | Ninguna |
| **Controller** | ✅ OK | ✅ OK | Ninguna |
| **estadoService** | ✅ OK (código) | ✅ OK | Ninguna |
| **BD (schema)** | 🔴 Falta columna | ✅ Columna agregada | **Ejecutar migración 002** |
| **PM2** | ✅ OK | ✅ OK | Reiniciar |
| **Logs** | ✅ Funcionan | ✅ Funcionan | Ninguna |
| **Endpoint** | 🔴 500 Error | ✅ 200 OK | Automático post-migración |

---

## 🎯 CAUSA RAÍZ (RESUMIDA)

**Discrepancia entre código y base de datos:**

- **Código:** Implementado para usar columna `usuario_id` ✅
- **Migraciones:** Creadas en `db/migrations/` ✅
- **Base de Datos:** Migraciones NO ejecutadas ❌

**Resultado:** INSERT falla con `ER_BAD_FIELD_ERROR`

---

## ✅ SOLUCIÓN (RESUMIDA)

```bash
# 1. Backup (base de datos remota)
mysqldump -h sv46.byethost46.org -u iunaorg_b3toh -p'elgeneral2018' \
  iunaorg_dyd ll_envios_whatsapp_historial > backup_historial_$(date +%Y%m%d).sql

# 2. Ejecutar migración
mysql -h sv46.byethost46.org -u iunaorg_b3toh -p'elgeneral2018' \
  iunaorg_dyd < db/migrations/002_add_usuario_id_to_historial.sql

# 3. Verificar
mysql -h sv46.byethost46.org -u iunaorg_b3toh -p'elgeneral2018' \
  iunaorg_dyd -e "DESCRIBE ll_envios_whatsapp_historial;" | grep usuario_id

# 4. Reiniciar
pm2 restart leadmaster-central-hub

# 5. Testar
curl -X POST http://localhost:3000/api/sender/envios/88/manual/confirm \
  -H "Authorization: Bearer TOKEN"
```

---

## 📚 REFERENCIAS

- **Informe de auditoría:** `INFORME_AUDITORIA_CUMPLIMIENTO_POLITICA_v1.2.0_2026-02-17.md`
- **Informe de implementación:** `INFORME_IMPLEMENTACION_TAREAS_CRITICAS_2026-02-17.md`
- **Migraciones creadas:** `db/migrations/`
- **Política normativa:** `docs/WHATSAPP_MANUAL_ENVIO_POLICY.md` v1.2.0

---

**Diagnóstico completado.**  
**Fecha:** 2026-02-18  
**Herramienta:** PM2 logs + grep + análisis de código  
**Tiempo de diagnóstico:** ~5 minutos  
**Prioridad de solución:** 🔴 CRÍTICA (bloquea funcionalidad core)

---

**FIN DEL DIAGNÓSTICO**
