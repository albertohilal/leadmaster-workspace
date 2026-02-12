# 🚀 Optimización de Performance - Selector de Prospectos

**Fecha:** 11 de febrero de 2026  
**Módulo:** Sender - Prospectos Controller  
**Tipo:** Arquitectura SaaS Multitenant - Performance Optimization  
**Objetivo:** Reducir tiempo de query de 800-1500ms a <150ms

---

## 📊 QUERY ACTUAL (Post-Fix LEFT JOIN)

```sql
SELECT 
  s.rowid as id,
  s.nom as nombre,
  s.phone_mobile as telefono_wapp,
  s.email as email,
  s.address as direccion,
  s.town as ciudad,
  COALESCE(r.nombre, 'Sin rubro') as rubro,
  r.area as area_rubro,
  MIN(lc.cliente_id) as cliente_id,
  CASE 
    WHEN MAX(env.id) IS NOT NULL THEN MAX(env.estado)
    ELSE 'disponible'
  END as estado,
  MAX(env.fecha_envio) as fecha_envio,
  CASE 
    WHEN s.phone_mobile IS NOT NULL AND s.phone_mobile != '' THEN 1 
    ELSE 0 
  END as wapp_valido,
  s.client as es_cliente,
  s.fournisseur as es_proveedor
FROM llxbx_societe s
LEFT JOIN ll_lugares_clientes lc 
  ON lc.societe_id = s.rowid AND lc.cliente_id = ?
LEFT JOIN ll_societe_extended se 
  ON se.societe_id = s.rowid
LEFT JOIN ll_rubros r 
  ON se.rubro_id = r.id
LEFT JOIN ll_envios_whatsapp env 
  ON env.lugar_id = s.rowid AND env.campania_id = ?
WHERE s.entity = 1
  AND s.phone_mobile IS NOT NULL 
  AND s.phone_mobile != ''
  -- Filtros opcionales dinámicos:
  -- AND COALESCE(r.nombre, 'Sin rubro') LIKE '%rubro%'
  -- AND s.address LIKE '%direccion%'
  -- AND r.area LIKE '%area%'
  -- AND s.client = 1 (tipo cliente)
GROUP BY 
  s.rowid, s.nom, s.phone_mobile, s.email, s.address, s.town, 
  r.nombre, r.area, s.client, s.fournisseur
HAVING 1=1
  -- Filtros de estado:
  -- MAX(env.id) IS NULL (sin_envio)
  -- MAX(env.estado) = 'enviado'
  -- MAX(env.estado) = 'pendiente'
ORDER BY s.nom ASC
LIMIT 1000;
```

**Parámetros:**
- `?` = `cliente_id` (ej: 51) - Multitenancy
- `?` = `campania_id` - Filtro campañas

**Volumen de datos:**
- `llxbx_societe`: ~10,000 registros
- `ll_envios_whatsapp`: ~50,000+ registros (crecimiento continuo)
- `ll_lugares_clientes`: 0-1000 registros por cliente

---

## ⚠️ PROBLEMAS DE PERFORMANCE IDENTIFICADOS

### 1. **Full Table Scan en llxbx_societe (10,000+ rows)**

**Problema:**
```sql
WHERE s.phone_mobile IS NOT NULL AND s.phone_mobile != ''
ORDER BY s.nom ASC
```

- No existe índice sobre `phone_mobile`
- `ORDER BY nom` sin índice causa **filesort**
- MySQL escanea todas las filas de la tabla

**Evidencia EXPLAIN esperada sin índices:**
```
type: ALL
rows: 10247
Extra: Using where; Using temporary; Using filesort
```

---

### 2. **GROUP BY con 10 columnas = Temporary Table + Filesort**

**Problema:**
```sql
GROUP BY 
  s.rowid, s.nom, s.phone_mobile, s.email, s.address, s.town, 
  r.nombre, r.area, s.client, s.fournisseur
```

- MySQL crea **tabla temporal en disco** para agrupar
- Después aplica **filesort** para ORDER BY
- Operación O(n log n) sobre 8,000+ registros

**Impacto:**
- Temporary table: 5-10 MB en disco
- Filesort: 200-500ms adicionales
- No puede usar índices eficientemente

---

### 3. **Dos llamadas MAX() sobre ll_envios_whatsapp sin covering index**

**Problema:**
```sql
MAX(env.id)      -- Primera lectura completa
MAX(env.estado)  -- Segunda lectura completa
MAX(env.fecha_envio)  -- Tercera lectura
```

- **Sin índice covering**, MySQL debe:
  1. Hacer JOIN con cada fila de societe
  2. Leer TODAS las columnas de ll_envios_whatsapp
  3. Calcular MAX() escaneando cada partición
  4. Repetir 3 veces (id, estado, fecha_envio)

**Costo real:**
- Si un prospecto tiene 10 envíos, lee 10 filas × todas las columnas
- Multiplica por 8,000 prospectos = **80,000+ row lookups**

---

### 4. **LEFT JOINs en cadena sin índices optimizados**

**Problema:**
```sql
4 LEFT JOINs = 4 Nested Loop Joins
```

Sin índices:
- `ll_lugares_clientes`: Full scan por cada fila de societe
- `ll_societe_extended`: Full scan por cada fila de societe
- `ll_rubros`: Full scan por cada fila de societe_extended
- `ll_envios_whatsapp`: Full scan por cada fila de societe

**Costo:** O(n²) - O(n⁴) en el peor caso

---

## ✅ ESTRATEGIA DE OPTIMIZACIÓN

### Principio SaaS Multitenant:

> **"Toda query debe particionar por `cliente_id` PRIMERO, luego filtrar por condiciones específicas."**

### Objetivos:
1. ✅ Eliminar full table scans
2. ✅ Eliminar filesort
3. ✅ Reducir temporary tables a memoria (no disco)
4. ✅ Implementar covering indexes
5. ✅ Optimizar GROUP BY + MAX()

---

## 🔧 ÍNDICES COMPUESTOS REQUERIDOS

### **1️⃣ llxbx_societe - Tabla Principal (Dolibarr)**

```sql
CREATE INDEX idx_societe_phone_entity_nom 
ON llxbx_societe(phone_mobile, entity, nom, rowid);
```

#### Orden de columnas explicado:

| Posición | Columna | Propósito | Justificación |
|----------|---------|-----------|---------------|
| 1 | `phone_mobile` | **Filtro WHERE** | Elimina ~50% registros con NULL/vacío |
| 2 | `entity` | **Filtro WHERE** | Particiona por entidad Dolibarr |
| 3 | `nom` | **ORDER BY** | **COVERING** - Evita filesort |
| 4 | `rowid` | **JOIN key** | **COVERING** - Evita lookup a tabla |

#### Plan de ejecución esperado:
```
type: range
possible_keys: idx_societe_phone_entity_nom
key: idx_societe_phone_entity_nom
key_len: 183 (phone_mobile) + 4 (entity)
ref: NULL
rows: ~8000 (de 10,000 total)
Extra: Using where; Using index
```

#### Beneficios:
- ✅ Elimina full table scan
- ✅ Elimina filesort (ORDER BY cubierto)
- ✅ Index-only scan (no lee tabla base)
- ✅ Reduce rows examinadas de 10,000 a ~8,000

---

### **2️⃣ ll_lugares_clientes - Vinculación Multitenant**

```sql
CREATE INDEX idx_lugares_cliente_societe 
ON ll_lugares_clientes(cliente_id, societe_id);
```

#### Orden de columnas explicado:

| Posición | Columna | Propósito | Justificación |
|----------|---------|-----------|---------------|
| 1 | `cliente_id` | **Partición tenant** | WHERE lc.cliente_id = 51 |
| 2 | `societe_id` | **JOIN FK** | JOIN con llxbx_societe.rowid |

#### Plan de ejecución esperado:
```
type: ref
key: idx_lugares_cliente_societe
ref: const (cliente_id=51), s.rowid
rows: 0-1 (por cada societe)
Extra: Using index
```

#### Beneficios:
- ✅ Acceso O(log n) vs O(n) sin índice
- ✅ Covering index (no lee tabla)
- ✅ Perfecto para LEFT JOIN (rápido incluso si vacío)

#### Estrategia Multitenant:
```
Un índice (cliente_id, FK) permite:
1. Filtrar por tenant instantáneamente
2. Buscar vinculación específica sin full scan
3. Aislar datos por cliente (seguridad + performance)
```

---

### **3️⃣ ll_societe_extended - Datos Extendidos**

```sql
CREATE INDEX idx_societe_ext_societe_rubro 
ON ll_societe_extended(societe_id, rubro_id);
```

#### Orden de columnas explicado:

| Posición | Columna | Propósito | Justificación |
|----------|---------|-----------|---------------|
| 1 | `societe_id` | **JOIN FK** | LEFT JOIN con llxbx_societe.rowid |
| 2 | `rubro_id` | **Siguiente JOIN** | **COVERING** para JOIN con ll_rubros |

#### Plan de ejecución esperado:
```
type: ref
key: idx_societe_ext_societe_rubro
ref: s.rowid
rows: 0-1
Extra: Using index
```

#### Beneficios:
- ✅ Index-only scan (no lee tabla)
- ✅ Soporta siguiente JOIN sin lookup adicional
- ✅ Perfecto para LEFT JOIN con card. 1:1

---

### **4️⃣ ll_rubros - Categorías/Rubros**

```sql
CREATE INDEX idx_rubros_covering 
ON ll_rubros(id, nombre, area);
```

#### Orden de columnas explicado:

| Posición | Columna | Propósito | Justificación |
|----------|---------|-----------|---------------|
| 1 | `id` | **JOIN PK** | eq_ref con se.rubro_id |
| 2 | `nombre` | **SELECT column** | Evita lookup (SELECT r.nombre) |
| 3 | `area` | **SELECT + WHERE** | Evita lookup + filtra si aplica |

#### Plan de ejecución esperado:
```
type: eq_ref
key: idx_rubros_covering
ref: se.rubro_id
rows: 1
Extra: Using index
```

#### Beneficios:
- ✅ eq_ref = búsqueda directa O(1)
- ✅ Covering index completo
- ✅ Soporta filtros opcionales por área sin penalización

---

### **5️⃣ ll_envios_whatsapp - Historial (CRÍTICO PARA PERFORMANCE)** ⚡

```sql
CREATE INDEX idx_envios_lugar_campania_covering 
ON ll_envios_whatsapp(lugar_id, campania_id, estado, fecha_envio, id);
```

#### Orden de columnas explicado:

| Posición | Columna | Propósito | Justificación |
|----------|---------|-----------|---------------|
| 1 | `lugar_id` | **JOIN FK** | LEFT JOIN con llxbx_societe.rowid |
| 2 | `campania_id` | **WHERE filter** | AND env.campania_id = ? |
| 3 | `estado` | **MAX() agregado** | **COVERING** para MAX(estado) |
| 4 | `fecha_envio` | **MAX() agregado** | **COVERING** para MAX(fecha_envio) |
| 5 | `id` | **MAX() agregado** | **COVERING** para MAX(id) |

#### ⚡ Este es un COVERING INDEX PERFECTO:

**Sin este índice:**
```
Para cada prospecto:
  1. Busca todos los envíos (full scan)
  2. Lee TODAS las columnas de la tabla
  3. Calcula MAX(id), MAX(estado), MAX(fecha_envio)
  4. Repite para 8,000 prospectos
  
Costo: 8,000 × 50 envíos promedio = 400,000 row accesses
```

**Con este índice:**
```
Para cada prospecto:
  1. Index seek directo a (lugar_id, campania_id)
  2. Lee SOLO las columnas del índice (no accede a la tabla)
  3. MAX() se resuelve escaneando solo el índice
  4. Operación en memoria, no disco
  
Costo: 8,000 × 5 index entries = 40,000 index reads (10x más rápido)
```

#### Plan de ejecución esperado:
```
type: ref
key: idx_envios_lugar_campania_covering
ref: s.rowid, const (campania_id)
rows: 0-50 (por prospecto)
Extra: Using index
```

#### Beneficios:
- ✅ **ZERO table accesses** (covering completo)
- ✅ MAX() sin ordenamiento (solo index scan)
- ✅ Reduce I/O en 90%+
- ✅ Soporta HAVING con estados sin penalización

---

## 📈 PLAN DE EJECUCIÓN ESPERADO (OPTIMIZADO)

### EXPLAIN Output Esperado:

```
+----+-------------+-------+--------+----------------------------------+-------+----------+-------------------+
| id | select_type | table | type   | key                              | ref   | rows     | Extra             |
+----+-------------+-------+--------+----------------------------------+-------+----------+-------------------+
|  1 | SIMPLE      | s     | range  | idx_societe_phone_entity_nom     | NULL  | 8247     | Using where;      |
|    |             |       |        |                                  |       |          | Using index       |
+----+-------------+-------+--------+----------------------------------+-------+----------+-------------------+
|  1 | SIMPLE      | lc    | ref    | idx_lugares_cliente_societe      | const | 0-1      | Using index       |
|    |             |       |        |                                  | s.row |          |                   |
+----+-------------+-------+--------+----------------------------------+-------+----------+-------------------+
|  1 | SIMPLE      | se    | ref    | idx_societe_ext_societe_rubro    | s.row | 0-1      | Using index       |
+----+-------------+-------+--------+----------------------------------+-------+----------+-------------------+
|  1 | SIMPLE      | r     | eq_ref | idx_rubros_covering              | se.ru | 1        | Using index       |
|    |             |       |        |                                  | bro_i |          |                   |
+----+-------------+-------+--------+----------------------------------+-------+----------+-------------------+
|  1 | SIMPLE      | env   | ref    | idx_envios_lugar_campania_cover  | s.row | 0-50     | Using index       |
|    |             |       |        |                                  | const |          |                   |
+----+-------------+-------+--------+----------------------------------+-------+----------+-------------------+
```

### Análisis del Plan:

| Tabla | Rows Examined | Index Used | Access Type | Covering |
|-------|---------------|------------|-------------|----------|
| llxbx_societe | ~8,000 | ✅ idx_societe_phone_entity_nom | range | ✅ Yes |
| ll_lugares_clientes | 0-8,000 | ✅ idx_lugares_cliente_societe | ref | ✅ Yes |
| ll_societe_extended | 0-8,000 | ✅ idx_societe_ext_societe_rubro | ref | ✅ Yes |
| ll_rubros | 0-8,000 | ✅ idx_rubros_covering | eq_ref | ✅ Yes |
| ll_envios_whatsapp | 0-400,000 | ✅ idx_envios_lugar_campania_cover | ref | ✅ Yes |

### Resultado Final:
- **Temporary table:** YES (GROUP BY inevitable) pero en **MEMORY** no disco
- **Filesort:** NO (ORDER BY cubierto por índice)
- **Table accesses:** 0 (100% index-only scan)
- **Total rows examined:** ~8,000-24,000 (vs 400,000+ sin índices)

---

## 🎯 OPTIMIZACIÓN AVANZADA (OPCIONAL)

### Problema: GROUP BY con 10 columnas sigue creando temporary table

**Solución: Subquery para aislar agregaciones**

```sql
SELECT 
  s.rowid as id,
  s.nom as nombre,
  s.phone_mobile as telefono_wapp,
  s.email as email,
  s.address as direccion,
  s.town as ciudad,
  s.client as es_cliente,
  s.fournisseur as es_proveedor,
  COALESCE(r.nombre, 'Sin rubro') as rubro,
  r.area as area_rubro,
  lc.cliente_id,
  COALESCE(agg.estado, 'disponible') as estado,
  agg.fecha_envio,
  agg.total_envios
FROM llxbx_societe s
LEFT JOIN ll_lugares_clientes lc 
  ON lc.societe_id = s.rowid AND lc.cliente_id = ?
LEFT JOIN ll_societe_extended se 
  ON se.societe_id = s.rowid
LEFT JOIN ll_rubros r 
  ON se.rubro_id = r.id
LEFT JOIN (
  -- Subquery pre-agregada con índice covering perfecto
  SELECT 
    lugar_id,
    MAX(estado) as estado,
    MAX(fecha_envio) as fecha_envio,
    COUNT(*) as total_envios,
    MAX(id) as ultimo_envio_id
  FROM ll_envios_whatsapp
  WHERE campania_id = ?
  GROUP BY lugar_id
) agg ON agg.lugar_id = s.rowid
WHERE s.entity = 1
  AND s.phone_mobile IS NOT NULL 
  AND s.phone_mobile != ''
  -- Filtros opcionales
HAVING 1=1
  -- Filtros de estado usando subquery
ORDER BY s.nom ASC
LIMIT 1000;
```

### Ventajas de la Subquery:

1. **Subquery `agg` ejecuta separadamente:**
   - GROUP BY sobre 1 sola columna (lugar_id)
   - Usa índice covering completo
   - Temporary table pequeña (solo lugares con envíos)
   - Resultado cacheable

2. **Query principal:**
   - NO hace GROUP BY (eliminado)
   - Simple LEFT JOIN con resultado pre-agregado
   - ORDER BY cubierto por índice principal
   - Filesort eliminado completamente

3. **Performance:**
   - Subquery: 50-100ms (índice covering)
   - Query principal: 50-100ms (sin GROUP BY)
   - **Total: 100-200ms vs 800-1500ms original**

### Trade-off:
- ❌ Query más complejo (dos niveles)
- ✅ Elimina GROUP BY de 10 columnas
- ✅ Reduce temporary table a memoria
- ✅ Mejor para análisis de EXPLAIN
- ✅ Más fácil optimizar por separado

---

## 🚀 SCRIPT DE IMPLEMENTACIÓN

### Script SQL Completo (Ejecutar en orden):

```sql
-- ============================================
-- OPTIMIZACIÓN PERFORMANCE SELECTOR PROSPECTOS
-- Fecha: 2026-02-11
-- Base de datos: iunaorg_dyd
-- ============================================

USE iunaorg_dyd;

-- Verificar índices existentes ANTES
SELECT 
  TABLE_NAME,
  INDEX_NAME,
  GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) as columns
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = 'iunaorg_dyd'
  AND TABLE_NAME IN (
    'llxbx_societe', 
    'll_envios_whatsapp', 
    'll_lugares_clientes', 
    'll_societe_extended', 
    'll_rubros'
  )
GROUP BY TABLE_NAME, INDEX_NAME
ORDER BY TABLE_NAME, INDEX_NAME;

-- ============================================
-- PASO 1: Índice principal societe (MÁS USADO)
-- ============================================
CREATE INDEX idx_societe_phone_entity_nom 
ON llxbx_societe(phone_mobile, entity, nom, rowid);

-- Verificación
SHOW INDEX FROM llxbx_societe WHERE Key_name = 'idx_societe_phone_entity_nom';

-- ============================================
-- PASO 2: Índice envíos (COVERING - CRÍTICO)
-- ============================================
CREATE INDEX idx_envios_lugar_campania_covering 
ON ll_envios_whatsapp(lugar_id, campania_id, estado, fecha_envio, id);

-- Verificación
SHOW INDEX FROM ll_envios_whatsapp WHERE Key_name = 'idx_envios_lugar_campania_covering';

-- ============================================
-- PASO 3: Índice multitenant lugares
-- ============================================
CREATE INDEX idx_lugares_cliente_societe 
ON ll_lugares_clientes(cliente_id, societe_id);

-- Verificación
SHOW INDEX FROM ll_lugares_clientes WHERE Key_name = 'idx_lugares_cliente_societe';

-- ============================================
-- PASO 4: Índice extendido societe
-- ============================================
CREATE INDEX idx_societe_ext_societe_rubro 
ON ll_societe_extended(societe_id, rubro_id);

-- Verificación
SHOW INDEX FROM ll_societe_extended WHERE Key_name = 'idx_societe_ext_societe_rubro';

-- ============================================
-- PASO 5: Índice rubros covering
-- ============================================
CREATE INDEX idx_rubros_covering 
ON ll_rubros(id, nombre, area);

-- Verificación
SHOW INDEX FROM ll_rubros WHERE Key_name = 'idx_rubros_covering';

-- ============================================
-- VERIFICACIÓN: Tamaño de índices creados
-- ============================================
SELECT 
  TABLE_NAME,
  INDEX_NAME,
  ROUND(stat_value * @@innodb_page_size / 1024 / 1024, 2) AS size_mb
FROM mysql.innodb_index_stats
WHERE database_name = 'iunaorg_dyd'
  AND TABLE_NAME IN (
    'llxbx_societe', 
    'll_envios_whatsapp', 
    'll_lugares_clientes', 
    'll_societe_extended', 
    'll_rubros'
  )
  AND stat_name = 'size'
ORDER BY size_mb DESC;

-- ============================================
-- ANÁLISIS: Cardinality de índices
-- ============================================
SELECT 
  TABLE_NAME,
  INDEX_NAME,
  COLUMN_NAME,
  SEQ_IN_INDEX,
  CARDINALITY,
  ROUND(CARDINALITY / (SELECT TABLE_ROWS FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_SCHEMA = 'iunaorg_dyd' AND TABLE_NAME = s.TABLE_NAME) * 100, 2) as selectivity_pct
FROM INFORMATION_SCHEMA.STATISTICS s
WHERE TABLE_SCHEMA = 'iunaorg_dyd'
  AND INDEX_NAME IN (
    'idx_societe_phone_entity_nom',
    'idx_envios_lugar_campania_covering',
    'idx_lugares_cliente_societe',
    'idx_societe_ext_societe_rubro',
    'idx_rubros_covering'
  )
ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;

-- ============================================
-- TEST: Query optimizado con EXPLAIN
-- ============================================
EXPLAIN
SELECT 
  s.rowid as id,
  s.nom as nombre,
  s.phone_mobile as telefono_wapp,
  COALESCE(r.nombre, 'Sin rubro') as rubro,
  r.area as area_rubro,
  MIN(lc.cliente_id) as cliente_id,
  CASE 
    WHEN MAX(env.id) IS NOT NULL THEN MAX(env.estado)
    ELSE 'disponible'
  END as estado,
  MAX(env.fecha_envio) as fecha_envio
FROM llxbx_societe s
LEFT JOIN ll_lugares_clientes lc 
  ON lc.societe_id = s.rowid AND lc.cliente_id = 51
LEFT JOIN ll_societe_extended se 
  ON se.societe_id = s.rowid
LEFT JOIN ll_rubros r 
  ON se.rubro_id = r.id
LEFT JOIN ll_envios_whatsapp env 
  ON env.lugar_id = s.rowid AND env.campania_id = 1
WHERE s.entity = 1
  AND s.phone_mobile IS NOT NULL 
  AND s.phone_mobile != ''
GROUP BY s.rowid, s.nom, s.phone_mobile, r.nombre, r.area
ORDER BY s.nom ASC
LIMIT 1000;

-- Verificar que NO aparezca:
-- ❌ "Using temporary; Using filesort"
-- ❌ "type: ALL" (full scan)
-- ✅ Debe aparecer: "Using index" en todas las tablas

-- ============================================
-- BENCHMARK: Comparación antes/después
-- ============================================
SET profiling = 1;

-- Ejecutar query sin LIMIT para medir performance real
SELECT 
  s.rowid as id,
  s.nom as nombre,
  s.phone_mobile as telefono_wapp,
  COALESCE(r.nombre, 'Sin rubro') as rubro,
  MIN(lc.cliente_id) as cliente_id,
  CASE 
    WHEN MAX(env.id) IS NOT NULL THEN MAX(env.estado)
    ELSE 'disponible'
  END as estado
FROM llxbx_societe s
LEFT JOIN ll_lugares_clientes lc 
  ON lc.societe_id = s.rowid AND lc.cliente_id = 51
LEFT JOIN ll_societe_extended se 
  ON se.societe_id = s.rowid
LEFT JOIN ll_rubros r 
  ON se.rubro_id = r.id
LEFT JOIN ll_envios_whatsapp env 
  ON env.lugar_id = s.rowid AND env.campania_id = 1
WHERE s.entity = 1
  AND s.phone_mobile IS NOT NULL 
  AND s.phone_mobile != ''
GROUP BY s.rowid, s.nom, s.phone_mobile, r.nombre
ORDER BY s.nom ASC
LIMIT 1000;

SHOW PROFILE FOR QUERY 1;

SET profiling = 0;

-- ============================================
-- MANTENIMIENTO: Reconstruir índices si necesario
-- ============================================
-- Solo ejecutar si la data es muy antigua o fragmentada

-- OPTIMIZE TABLE llxbx_societe;
-- OPTIMIZE TABLE ll_envios_whatsapp;
-- OPTIMIZE TABLE ll_lugares_clientes;
-- OPTIMIZE TABLE ll_societe_extended;
-- OPTIMIZE TABLE ll_rubros;

-- Analizar tablas para actualizar estadísticas
ANALYZE TABLE llxbx_societe;
ANALYZE TABLE ll_envios_whatsapp;
ANALYZE TABLE ll_lugares_clientes;
ANALYZE TABLE ll_societe_extended;
ANALYZE TABLE ll_rubros;

-- ============================================
-- ROLLBACK (Si necesitas eliminar índices)
-- ============================================
-- DROP INDEX idx_societe_phone_entity_nom ON llxbx_societe;
-- DROP INDEX idx_envios_lugar_campania_covering ON ll_envios_whatsapp;
-- DROP INDEX idx_lugares_cliente_societe ON ll_lugares_clientes;
-- DROP INDEX idx_societe_ext_societe_rubro ON ll_societe_extended;
-- DROP INDEX idx_rubros_covering ON ll_rubros;
```

---

## ⏱️ MEJORA DE PERFORMANCE ESPERADA

### Tabla Comparativa:

| Métrica | Sin Índices | Con Índices | Mejora |
|---------|------------|-------------|---------|
| **Query time** | 800-1500ms | 50-150ms | **90%** ↓ |
| **Rows examined** | ~450,000 | ~8,500 | **95%** ↓ |
| **Temporary tables** | Disk (10MB) | Memory (1MB) | **10x** mejor |
| **Filesort** | Yes (500ms) | No | **Eliminado** |
| **Table accesses** | ~450,000 | 0 (covering) | **100%** covering |
| **Index scans** | Full table | Index-only | **100%** optimizado |
| **I/O operations** | ~5,000 | ~500 | **90%** ↓ |
| **CPU usage** | Alto (sorting) | Bajo | **70%** ↓ |

### Gráfico de Performance:

```
Sin índices:
[████████████████████████████████████████] 1500ms
 ↑ Full scan + Filesort + Temp disk

Con índices:
[████] 150ms
 ↑ Index-only + In-memory + No filesort

Mejora: 10x más rápido
```

### Escalabilidad Futura:

| Volumen | Sin Índices | Con Índices | Diferencia |
|---------|------------|-------------|------------|
| 10,000 prospectos | 1.5s | 150ms | 10x |
| 50,000 prospectos | 7.5s | 300ms | 25x |
| 100,000 prospectos | 15s | 500ms | 30x |
| 500,000 prospectos | 75s | 2s | **37x** |

---

## 🔍 VERIFICACIÓN POST-IMPLEMENTACIÓN

### Checklist de Validación:

#### 1. ✅ Verificar creación de índices
```sql
SHOW INDEX FROM llxbx_societe;
SHOW INDEX FROM ll_envios_whatsapp;
SHOW INDEX FROM ll_lugares_clientes;
SHOW INDEX FROM ll_societe_extended;
SHOW INDEX FROM ll_rubros;
```

**Verificar:**
- Todos los índices aparecen con `Key_name` correcto
- `Cardinality` > 0 (índice poblado)
- `Index_type` = BTREE

---

#### 2. ✅ Analizar plan de ejecución
```sql
EXPLAIN SELECT ... [query completo];
```

**Verificar que NO aparezca:**
- ❌ `type: ALL` (full table scan)
- ❌ `Extra: Using temporary; Using filesort`
- ❌ `rows: 10000+` en primera tabla

**Verificar que SÍ aparezca:**
- ✅ `type: range` o `ref` o `eq_ref`
- ✅ `Extra: Using index` (covering)
- ✅ `key: idx_*` (usa nuestros índices)

---

#### 3. ✅ Medir performance real
```sql
SET profiling = 1;
[ejecutar query];
SHOW PROFILE FOR QUERY 1;
```

**Métricas objetivo:**
- Duration: < 200ms
- Sending data: < 100ms
- Sorting result: 0ms (eliminado)

---

#### 4. ✅ Test de carga
```bash
# Apache Bench o herramienta similar
ab -n 100 -c 10 "http://tu-dominio/api/sender/prospectos/filtrar?campania_id=1"
```

**Verificar:**
- Requests per second: > 20
- 95th percentile: < 300ms
- Failed requests: 0

---

#### 5. ✅ Monitoreo MySQL
```sql
SHOW STATUS LIKE 'Handler%';
SHOW STATUS LIKE 'Created_tmp%';
SHOW STATUS LIKE 'Sort_%';
```

**Antes vs Después:**
- `Handler_read_rnd_next`: Reducido 90%+
- `Created_tmp_disk_tables`: Reducido a 0
- `Sort_merge_passes`: Reducido a 0

---

## 📊 MONITOREO CONTINUO

### Queries de Monitoreo:

#### 1. Uso de índices (daily)
```sql
SELECT 
  TABLE_NAME,
  INDEX_NAME,
  ROUND(stat_value * @@innodb_page_size / 1024 / 1024, 2) AS size_mb,
  CARDINALITY
FROM mysql.innodb_index_stats ist
JOIN INFORMATION_SCHEMA.STATISTICS s 
  ON ist.table_name = s.TABLE_NAME 
  AND ist.index_name = s.INDEX_NAME
  AND ist.column_name = s.COLUMN_NAME
WHERE ist.database_name = 'iunaorg_dyd'
  AND ist.table_name IN (
    'llxbx_societe', 
    'll_envios_whatsapp', 
    'll_lugares_clientes'
  )
  AND ist.stat_name = 'size'
ORDER BY size_mb DESC;
```

#### 2. Slow queries (monitoring)
```sql
SELECT 
  query_time,
  lock_time,
  rows_examined,
  rows_sent,
  sql_text
FROM mysql.slow_log
WHERE sql_text LIKE '%ll_envios_whatsapp%'
  OR sql_text LIKE '%llxbx_societe%'
ORDER BY query_time DESC
LIMIT 10;
```

#### 3. Table statistics
```sql
SELECT 
  TABLE_NAME,
  TABLE_ROWS,
  ROUND(DATA_LENGTH / 1024 / 1024, 2) AS data_mb,
  ROUND(INDEX_LENGTH / 1024 / 1024, 2) AS index_mb,
  ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 2) AS total_mb,
  ROUND(INDEX_LENGTH / DATA_LENGTH * 100, 2) AS index_ratio_pct
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = 'iunaorg_dyd'
  AND TABLE_NAME IN (
    'llxbx_societe', 
    'll_envios_whatsapp', 
    'll_lugares_clientes', 
    'll_societe_extended', 
    'll_rubros'
  )
ORDER BY total_mb DESC;
```

---

## 📌 REGLAS DE ORO - ARQUITECTURA MULTITENANT

### 1. **Índice Multitenant Pattern**
```sql
índice_multitenant = (tenant_id, business_key, covering_columns)
```

**Aplicado:**
```sql
ll_lugares_clientes(cliente_id, societe_id)
                    ↑           ↑
                 tenant_id   business_key
```

---

### 2. **Covering Index Pattern**
```sql
índice_covering = (join_key, filter_columns, select_columns, aggregate_columns)
```

**Aplicado:**
```sql
ll_envios_whatsapp(lugar_id, campania_id, estado, fecha_envio, id)
                   ↑         ↑            ↑                      ↑
                join_key   filter      aggregate           aggregate
```

---

### 3. **Left-Most Prefix Rule**
```
Índice: (A, B, C, D)

✅ Usa índice:
  - WHERE A = ?
  - WHERE A = ? AND B = ?
  - WHERE A = ? AND B = ? AND C = ?
  - WHERE A = ? AND B = ? AND C = ? AND D = ?

❌ NO usa índice:
  - WHERE B = ?
  - WHERE C = ?
  - WHERE B = ? AND C = ?
```

**Aplicado:**
```sql
-- ✅ CORRECTO
idx_envios_lugar_campania_covering(lugar_id, campania_id, ...)
JOIN usando: lugar_id + campania_id

-- ❌ INCORRECTO (no respetar left-most)
idx_envios_WRONG(campania_id, lugar_id, ...)
JOIN usando: lugar_id (segunda columna) = no usa índice
```

---

### 4. **Index Selectivity**
```
Selectivity = Cardinality / Total_Rows

Alta selectividad (>50%):  Índice muy efectivo
Baja selectividad (<10%):  Índice poco útil
```

**Verificar:**
```sql
SELECT 
  INDEX_NAME,
  COLUMN_NAME,
  CARDINALITY,
  ROUND(CARDINALITY / (SELECT TABLE_ROWS FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_NAME = 'llxbx_societe') * 100, 2) as selectivity_pct
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_NAME = 'llxbx_societe'
  AND INDEX_NAME = 'idx_societe_phone_entity_nom';
```

---

## 🎓 LECCIONES APRENDIDAS

### ✅ DO (Buenas Prácticas):

1. **Covering indexes para JOINs pesados**
   - Incluir todas las columnas necesarias en SELECT
   - Evitar lookups a la tabla base

2. **Particionar por tenant_id primero**
   - Toda query multitenant debe filtrar por cliente_id
   - Mejora seguridad + performance

3. **ORDER BY debe estar cubierto**
   - Incluir columnas de ORDER BY en índice
   - Elimina filesort costoso

4. **GROUP BY + MAX() = covering index**
   - Columnas agregadas deben estar en índice
   - Evita scans completos

5. **LEFT JOIN con índices optimizados**
   - FK debe ser primera columna del índice
   - Permite index-only scan incluso si no hay match

---

### ❌ DON'T (Anti-Patrones):

1. **GROUP BY con muchas columnas**
   - Crea temporary tables grandes
   - Considera subqueries para aislar agregaciones

2. **INNER JOIN con tablas potencialmente vacías**
   - Usa LEFT JOIN para selectores
   - INNER JOIN solo para relaciones obligatorias

3. **Índices sin covering**
   - Índice solo sobre FK = lookup adicional
   - Incluye columnas de SELECT si es posible

4. **WHERE + ORDER BY sin índice coordinado**
   - WHERE sobre columna A, ORDER BY sobre B sin índice = filesort
   - Crea índice compuesto (A, B)

5. **Ignorar left-most prefix rule**
   - Índice (campania_id, lugar_id) no sirve si JOIN usa solo lugar_id
   - Orden de columnas es CRÍTICO

---

## 📚 DOCUMENTACIÓN RELACIONADA

### Referencias Internas:
- [BUG_0_REGISTROS_PROSPECTOS_INDICE.md](./BUG_0_REGISTROS_PROSPECTOS_INDICE.md) - Índice principal del bug
- [DIAGNOSTICO_BUG_INNER_JOIN_LUGARES_CLIENTES.md](./DIAGNOSTICO_BUG_INNER_JOIN_LUGARES_CLIENTES.md) - Diagnóstico original
- [TABLAS_SELECTOR_PROSPECTOS.md](./TABLAS_SELECTOR_PROSPECTOS.md) - Arquitectura de base de datos

### Referencias Externas:
- [MySQL 8.0: Index Optimization](https://dev.mysql.com/doc/refman/8.0/en/optimization-indexes.html)
- [MySQL 8.0: Covering Indexes](https://dev.mysql.com/doc/refman/8.0/en/glossary.html#glos_covering_index)
- [MySQL 8.0: GROUP BY Optimization](https://dev.mysql.com/doc/refman/8.0/en/group-by-optimization.html)

---

## 🚀 SIGUIENTES PASOS

### Fase 1: Implementación Inmediata ✅
- [ ] Ejecutar script de creación de índices en dev
- [ ] Verificar EXPLAIN de query optimizado
- [ ] Medir performance antes/después
- [ ] Validar que frontend funciona correctamente

### Fase 2: Testing y Validación ⏳
- [ ] Load testing con 100+ requests concurrentes
- [ ] Verificar memory usage de MySQL
- [ ] Monitorear slow query log
- [ ] Benchmark en producción (horario bajo)

### Fase 3: Producción 🚀
- [ ] Backup de base de datos
- [ ] Ejecutar índices en horario de baja carga
- [ ] Monitoreo continuo 24h post-deployment
- [ ] Documentar métricas reales vs esperadas

### Fase 4: Optimización Continua 🔄
- [ ] Implementar subquery opcional (si es necesario)
- [ ] Considerar table partitioning para ll_envios_whatsapp
- [ ] Evaluar caching de resultados en Redis
- [ ] Plan de mantenimiento mensual (ANALYZE, OPTIMIZE)

---

**Última actualización:** 2026-02-11  
**Autor:** Arquitecto de Performance  
**Review:** Pendiente  
**Status:** 📝 Documentado - ⏳ Pendiente implementación

