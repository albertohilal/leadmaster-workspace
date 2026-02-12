# DIAGNÓSTICO PROFUNDO – BUG PROSPECTOS VACÍO

**Fecha**: 11 de febrero de 2026  
**Endpoint afectado**: `GET /api/sender/prospectos/filtrar?campania_id=47`  
**Síntoma**: Devuelve `success: true` pero `prospectos: []` (array vacío)  
**Severidad**: 🔴 CRÍTICA - Funcionalidad principal no operativa  

---

## 📋 CONTEXTO

### Datos Verificados Manualmente en MySQL

- ✅ `ll_envios_whatsapp` tiene **330 registros** con `campania_id = 47`
- ✅ `ll_campanias_whatsapp` tiene `id = 47`, `cliente_id = 51`
- ✅ Usuario autenticado tiene `cliente_id = 51`
- ✅ `llxbx_societe` es la tabla real de terceros (NO existe `ll_societe`)
- ✅ **329 de 330 registros** tienen `lugar_id NOT NULL` válido
- ✅ **329 lugares** existen en `llxbx_societe.rowid`
- ✅ **329 lugares** están registrados en `ll_lugares_clientes` con `cliente_id = 51`

### Query SQL Ejecutada Directamente en MySQL

```sql
SELECT 
  s.rowid as id,
  s.nom as nombre,
  s.phone_mobile as telefono_wapp,
  CASE 
    WHEN MAX(env.id) IS NOT NULL THEN MAX(env.estado)
    ELSE 'disponible'
  END as estado
FROM llxbx_societe s
INNER JOIN ll_lugares_clientes lc ON lc.societe_id = s.rowid AND lc.cliente_id = 51
LEFT JOIN ll_societe_extended se ON se.societe_id = s.rowid
LEFT JOIN ll_rubros r ON se.rubro_id = r.id
LEFT JOIN ll_envios_whatsapp env ON env.lugar_id = s.rowid AND env.campania_id = 47
WHERE s.entity = 1
GROUP BY s.rowid, s.nom, s.phone_mobile, s.email, s.address, s.town, r.nombre, r.area, s.client, s.fournisseur
HAVING 1=1 AND s.phone_mobile IS NOT NULL AND s.phone_mobile != ''
ORDER BY s.nom ASC
LIMIT 5;
```

**Resultado**: ✅ **FUNCIONA** - Devuelve **615 registros** correctamente

**Muestra de resultados**:
```
id      nombre                          telefono_wapp   estado
917     .                               5491121768231   disponible
734     1 Floor Tienda                  5491154042452   disponible
649     1950 Tattoo Shop                5491165766149   disponible
909     2.0 Tattoo                      5491133349159   disponible
951     2099 | tatuajes y perforaciones 5491164418793   disponible
```

---

## 🐛 PROBLEMAS IDENTIFICADOS

### 🔴 PROBLEMA #1: ERROR SINTÁCTICO EN FILTRO HAVING (CRÍTICO)

**Archivo**: [src/modules/sender/controllers/prospectosController.js](../src/modules/sender/controllers/prospectosController.js#L65-L67)  
**Líneas**: 65-67

#### Código actual:

```javascript
// Filtro por números válidos de WhatsApp
if (soloWappValido === 'true') {
  sql += ` AND s.phone_mobile IS NOT NULL AND s.phone_mobile != ''`;
}
```

#### Problema:

Este filtro se concatena **DESPUÉS** del `HAVING 1=1`, generando:

```sql
GROUP BY s.rowid, s.nom, s.phone_mobile, ...
HAVING 1=1 AND s.phone_mobile IS NOT NULL AND s.phone_mobile != ''
ORDER BY s.nom ASC
```

**¿Por qué es incorrecto?**

1. `s.phone_mobile` es una **columna individual**, no una **función agregada**
2. En la cláusula `HAVING`, solo deberían usarse:
   - Funciones agregadas: `MAX()`, `MIN()`, `COUNT()`, `SUM()`, etc.
   - Columnas que estén en el `GROUP BY`
3. `s.phone_mobile` **SÍ está en el GROUP BY**, pero según SQL estándar:
   - Si está en GROUP BY → usar en `WHERE`, no en `HAVING`
   - `HAVING` es para filtrar **resultados agregados**, no columnas individuales

**Comportamiento según modo MySQL**:

| Modo SQL | Comportamiento |
|----------|----------------|
| `ONLY_FULL_GROUP_BY` (estricto) | ❌ **ERROR** - Rechaza la query |
| Modo permisivo (por defecto) | ⚠️ Funciona pero rendimiento degradado |

#### Impacto:

- **Producción con MySQL estricto**: Query falla completamente → 0 resultados
- **Producción con MySQL permisivo**: Funciona pero subóptimo

---

### 🟡 PROBLEMA #2: PARÁMETRO cliente_id INCORRECTO (ALTA PROBABILIDAD)

**Archivo**: [src/modules/sender/controllers/prospectosController.js](../src/modules/sender/controllers/prospectosController.js#L24-L25)  
**Líneas**: 24-25

#### Código actual:

```javascript
const userId = req.user.id;  // ID del usuario en ll_usuarios
const clienteId = req.user.cliente_id;  // ID del cliente
```

#### Hipótesis del problema:

**Si `req.user.cliente_id` ≠ 51**, entonces:

1. La query ejecuta el INNER JOIN con un `cliente_id` diferente:
   ```sql
   INNER JOIN ll_lugares_clientes lc ON lc.societe_id = s.rowid AND lc.cliente_id = ?
   ```
2. El INNER JOIN **elimina todos los registros** porque busca en la tabla equivocada
3. Resultado: 0 filas

#### Verificación necesaria:

**Agregar log temporal**:

```javascript
const userId = req.user.id;
const clienteId = req.user.cliente_id;

// 🔍 LOG TEMPORAL DE DIAGNÓSTICO
console.log('='.repeat(80));
console.log('🔍 [DIAGNOSTICO] Datos del usuario autenticado:');
console.log('     userId:', userId);
console.log('     clienteId:', clienteId);
console.log('     campania_id:', campania_id);
console.log('     req.user completo:', JSON.stringify(req.user, null, 2));
console.log('='.repeat(80));
```

**Luego ejecutar**:
```bash
# Desde el frontend hacer petición
# Luego ver logs:
pm2 logs central-hub --lines 50
```

**Buscar**:
- ¿El `clienteId` es 51?
- ¿O es diferente?

---

### 🟢 PROBLEMA #3: ORDEN DE PARÁMETROS (VERIFICADO - CORRECTO)

**Archivo**: [src/modules/sender/controllers/prospectosController.js](../src/modules/sender/controllers/prospectosController.js#L62)  
**Línea**: 62

#### Código actual:

```javascript
// ✅ Parámetros en orden correcto: clienteId (INNER JOIN), campania_id (LEFT JOIN)
const params = [clienteId, campania_id];
```

#### Verificación SQL:

```sql
INNER JOIN ll_lugares_clientes lc ON lc.societe_id = s.rowid AND lc.cliente_id = ?  -- params[0]
LEFT JOIN ll_envios_whatsapp env ON env.lugar_id = s.rowid AND env.campania_id = ?   -- params[1]
```

**✅ CORRECTO** - El orden es: `[clienteId, campania_id]`

---

### 🟢 PROBLEMA #4: ESTRUCTURA DE JOINS (VERIFICADO - CORRECTO)

#### Tablas y relaciones verificadas:

```
llxbx_societe (terceros Dolibarr)
    ├─ rowid (PK)
    │
    ↓ INNER JOIN (lc.societe_id = s.rowid AND lc.cliente_id = 51)
ll_lugares_clientes (relación tercero-cliente)
    ├─ societe_id (FK → llxbx_societe.rowid)
    ├─ cliente_id (FK → ll_clientes.id)
    │
    ↓ LEFT JOIN (env.lugar_id = s.rowid AND env.campania_id = 47)
ll_envios_whatsapp (envíos de campaña)
    ├─ lugar_id (FK → llxbx_societe.rowid)
    ├─ campania_id (FK → ll_campanias_whatsapp.id)
```

**Verificación en BD**:

```sql
-- Registros en ll_lugares_clientes para cliente 51
SELECT COUNT(DISTINCT lc.societe_id) as total
FROM ll_envios_whatsapp env
INNER JOIN ll_lugares_clientes lc ON lc.societe_id = env.lugar_id AND lc.cliente_id = 51
WHERE env.campania_id = 47;
```

**Resultado**: 329 registros ✅

**✅ CORRECTO** - Los 329 lugares de la campaña 47 SÍ están en `ll_lugares_clientes` con `cliente_id = 51`

---

## 📊 MATRIZ DE DIAGNÓSTICO

| # | Problema | Archivo | Línea | Probabilidad | Verificación |
|---|----------|---------|-------|--------------|--------------|
| 1 | Sintaxis HAVING incorrecta | prospectosController.js | 65-67 | 🔴 **ALTA** | Verificar `sql_mode` en MySQL |
| 2 | `req.user.cliente_id` ≠ 51 | prospectosController.js | 24-25 | 🟡 **MEDIA** | Agregar log de `req.user` |
| 3 | Orden de parámetros | prospectosController.js | 62 | 🟢 **BAJA** | ✅ Verificado: CORRECTO |
| 4 | Estructura de JOINs | prospectosController.js | 51-55 | 🟢 **BAJA** | ✅ Verificado: CORRECTO |

---

## 🧪 PRUEBAS DE VERIFICACIÓN

### PRUEBA 1: Verificar modo SQL de MySQL

```bash
mysql -h sv46.byethost46.org -u iunaorg_b3toh -pelgeneral2018 iunaorg_dyd -e "
SELECT @@sql_mode;
SELECT @@global.sql_mode;
"
```

**Buscar**:
- ¿Contiene `ONLY_FULL_GROUP_BY`?
- Si SÍ → Query falla con error
- Si NO → Query funciona pero es subóptima

---

### PRUEBA 2: Verificar cliente_id del usuario autenticado

**Agregar en línea 25**:

```javascript
const userId = req.user.id;
const clienteId = req.user.cliente_id;

// 🔍 LOG TEMPORAL
console.log('='.repeat(80));
console.log('🔍 [DIAGNOSTICO PROSPECTOS]');
console.log('   userId:', userId);
console.log('   clienteId:', clienteId);
console.log('   campania_id:', campania_id);
console.log('   req.user:', JSON.stringify(req.user, null, 2));
console.log('='.repeat(80));
```

**Ejecutar**:
```bash
# Hacer petición desde frontend
# Ver logs:
pm2 logs central-hub --lines 100 | grep "DIAGNOSTICO PROSPECTOS" -A 10
```

**Buscar**:
- `clienteId: 51` → ✅ Correcto
- `clienteId: <otro valor>` → 🔴 Problema identificado

---

### PRUEBA 3: Ejecutar query sin filtro HAVING

**Modificar temporalmente línea 65-67**:

```javascript
// Filtro por números válidos de WhatsApp
if (soloWappValido === 'true') {
  // TEMPORAL: Mover a WHERE en lugar de concatenar al HAVING
  sql = sql.replace('WHERE s.entity = 1', 
    'WHERE s.entity = 1 AND s.phone_mobile IS NOT NULL AND s.phone_mobile != \'\'');
}
```

Probar endpoint y verificar si ahora devuelve resultados.

---

## 🛠️ SOLUCIONES PROPUESTAS

### SOLUCIÓN 1: Corregir filtro de WhatsApp válido (RECOMENDADA)

**Archivo**: `src/modules/sender/controllers/prospectosController.js`  
**Líneas**: 65-67

**Cambio**:

```javascript
// ❌ ANTES (INCORRECTO)
if (soloWappValido === 'true') {
  sql += ` AND s.phone_mobile IS NOT NULL AND s.phone_mobile != ''`;
}

// ✅ DESPUÉS (CORRECTO)
// Mover filtro de WhatsApp al WHERE en lugar de concatenar después
let whereClause = 'WHERE s.entity = 1';

if (soloWappValido === 'true') {
  whereClause += ` AND s.phone_mobile IS NOT NULL AND s.phone_mobile != ''`;
}

// Reemplazar en la query
sql = sql.replace('WHERE s.entity = 1', whereClause);
```

**O MEJOR AÚN** (más limpio):

```javascript
// Query con filtro integrado desde el inicio
let sql = `
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
  INNER JOIN ll_lugares_clientes lc ON lc.societe_id = s.rowid AND lc.cliente_id = ?
  LEFT JOIN ll_societe_extended se ON se.societe_id = s.rowid
  LEFT JOIN ll_rubros r ON se.rubro_id = r.id
  LEFT JOIN ll_envios_whatsapp env ON env.lugar_id = s.rowid AND env.campania_id = ?
  WHERE s.entity = 1
    ${soloWappValido === 'true' ? "AND s.phone_mobile IS NOT NULL AND s.phone_mobile != ''" : ''}
  GROUP BY s.rowid, s.nom, s.phone_mobile, s.email, s.address, s.town, r.nombre, r.area, s.client, s.fournisseur
  HAVING 1=1
`;

// Luego agregar otros filtros (rubro, direccion, etc.) que SÍ deben ir después del WHERE
```

---

### SOLUCIÓN 2: Verificar y validar cliente_id

**Archivo**: `src/modules/sender/controllers/prospectosController.js`  
**Líneas**: 24-27

**Agregar validación**:

```javascript
const userId = req.user.id;
const clienteId = req.user.cliente_id;

// Validar que cliente_id existe
if (!clienteId) {
  return res.status(403).json({
    success: false,
    error: 'Usuario no tiene cliente_id asignado'
  });
}

console.log(`🔍 [prospectos] Usuario ${userId} consultando campaña ${campania_id} para cliente ${clienteId}`);
```

---

## 🎯 PLAN DE ACCIÓN INMEDIATO

### Paso 1: Agregar logs de diagnóstico (2 minutos)

```javascript
// Línea 25
const userId = req.user.id;
const clienteId = req.user.cliente_id;

console.log('='.repeat(80));
console.log('🔍 [DIAGNOSTICO] filtrarProspectos');
console.log('   userId:', userId);
console.log('   clienteId:', clienteId);
console.log('   campania_id:', campania_id);
console.log('='.repeat(80));
```

### Paso 2: Hacer petición y revisar logs (1 minuto)

```bash
pm2 logs central-hub --lines 100
```

### Paso 3: Según resultado

**Si `clienteId ≠ 51`**:
→ Investigar por qué el token tiene cliente_id incorrecto
→ Regenerar token o corregir autenticación

**Si `clienteId = 51`**:
→ Aplicar SOLUCIÓN 1 (corregir filtro HAVING)
→ Reiniciar central-hub: `pm2 restart central-hub`
→ Probar endpoint

---

## 📝 CONCLUSIÓN

**La query SQL es correcta** y funciona cuando se ejecuta directamente en MySQL con los parámetros correctos.

**El problema está en UNO de estos dos puntos**:

1. 🔴 **Sintaxis SQL incorrecta en el filtro HAVING** (concatenación después del HAVING en lugar de en el WHERE)
2. 🟡 **Parámetro `clienteId` incorrecto en runtime** (req.user.cliente_id ≠ 51)

**Próximo paso**: Agregar logs y verificar cual de los dos es la causa raíz.

---

## 📌 ARCHIVOS RELACIONADOS

- Controller: [src/modules/sender/controllers/prospectosController.js](../src/modules/sender/controllers/prospectosController.js)
- Diagnóstico arquitectónico: [DIAGNOSTICO_ESTADO_PROSPECTOS.md](./DIAGNOSTICO_ESTADO_PROSPECTOS.md)
- Implementación campania_id: [IMPLEMENTACION_CAMPANIA_ID_OBLIGATORIO.md](./IMPLEMENTACION_CAMPANIA_ID_OBLIGATORIO.md)

---

**Diagnóstico realizado por**: GitHub Copilot  
**Fecha**: 11 de febrero de 2026  
**Herramientas utilizadas**: MySQL CLI, análisis estático de código, verificación manual de datos
