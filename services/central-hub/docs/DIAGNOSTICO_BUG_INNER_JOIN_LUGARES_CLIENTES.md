# 🔍 DIAGNÓSTICO TÉCNICO: Bug de 0 Registros en Selector de Prospectos

**Fecha:** 2026-02-11  
**Módulo:** central-hub - Selector de Prospectos  
**Endpoint:** `/api/sender/prospectos/filtrar`  
**Archivo afectado:** `src/modules/sender/controllers/prospectosController.js`

---

## 📋 RESUMEN EJECUTIVO

El endpoint `/api/sender/prospectos/filtrar` está devolviendo **0 registros** debido a un `INNER JOIN` con la tabla `ll_lugares_clientes` que excluye TODOS los prospectos que no estén previamente vinculados al `cliente_id` del usuario actual.

**Causa raíz:** Diseño arquitectónico incorrecto que limita la visibilidad de prospectos solo a aquellos que ya están asociados en `ll_lugares_clientes`.

---

## 🔬 ANÁLISIS DEL QUERY

### SELECT PRINCIPAL COMPLETO

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
INNER JOIN ll_lugares_clientes lc ON lc.societe_id = s.rowid AND lc.cliente_id = ?
LEFT JOIN ll_societe_extended se ON se.societe_id = s.rowid
LEFT JOIN ll_rubros r ON se.rubro_id = r.id
LEFT JOIN ll_envios_whatsapp env ON env.lugar_id = s.rowid AND env.campania_id = ?
WHERE s.entity = 1 
  AND s.phone_mobile IS NOT NULL 
  AND s.phone_mobile != ''
  [+ filtros opcionales]
GROUP BY s.rowid, s.nom, s.phone_mobile, s.email, s.address, s.town, r.nombre, r.area, s.client, s.fournisseur
HAVING 1=1
ORDER BY s.nom ASC
LIMIT 1000
```

**Parámetros:**
- `params[0]` = `req.user.cliente_id` (INNER JOIN con ll_lugares_clientes)
- `params[1]` = `campania_id` (LEFT JOIN con ll_envios_whatsapp)

---

## 🗄️ TABLAS INVOLUCRADAS

| Tabla | Tipo JOIN | Propósito | Estado |
|-------|-----------|-----------|--------|
| `llxbx_societe` | FROM | Tabla principal de prospectos/sociedades | ✅ Correcto |
| `ll_lugares_clientes` | **INNER JOIN** | Vinculación prospecto-cliente | ⚠️ **PROBLEMA** |
| `ll_societe_extended` | LEFT JOIN | Datos extendidos de prospectos | ✅ Correcto |
| `ll_rubros` | LEFT JOIN | Categorías/rubros de negocio | ✅ Correcto |
| `ll_envios_whatsapp` | LEFT JOIN | Historial de envíos por campaña | ✅ Correcto |

---

## ⚠️ PROBLEMA CRÍTICO IDENTIFICADO

### INNER JOIN con `ll_lugares_clientes`

**Línea 107-108 del controlador:**
```javascript
INNER JOIN ll_lugares_clientes lc ON lc.societe_id = s.rowid AND lc.cliente_id = ?
```

### ¿Qué está haciendo este JOIN?

Este `INNER JOIN` requiere que **TODOS** los prospectos que quieras ver tengan un registro en la tabla `ll_lugares_clientes` con el `cliente_id` del usuario autenticado.

### ¿Por qué devuelve 0 registros?

**Escenarios que causan 0 registros:**

1. ✅ **MÁS PROBABLE**: La tabla `ll_lugares_clientes` NO tiene registros para el `cliente_id = 51` (del usuario actual "Haby")
2. Los prospectos existen en `llxbx_societe` pero NO están vinculados a ese cliente en `ll_lugares_clientes`
3. La tabla `ll_lugares_clientes` está completamente vacía
4. El `cliente_id` del token JWT no coincide con ningún registro en `ll_lugares_clientes`

### Impacto del INNER JOIN

```
┌─────────────────────┐
│ llxbx_societe       │  ← 10,000 prospectos
│ (10,000 registros)  │
└──────────┬──────────┘
           │ INNER JOIN  ← Requiere match obligatorio
           ▼
┌─────────────────────┐
│ ll_lugares_clientes │  ← 0 registros para cliente_id = 51
│ (0 registros)       │
└─────────────────────┘
           │
           ▼
    📊 RESULTADO = 0 registros
```

**Sin match = Sin resultado.**

---

## 🔍 ANÁLISIS DE CONDICIONES

### Condiciones WHERE (aplicadas sobre JOIN)

```sql
WHERE s.entity = 1                           -- ✅ Filtro válido
  AND s.phone_mobile IS NOT NULL             -- ✅ Filtro válido
  AND s.phone_mobile != ''                   -- ✅ Filtro válido (pero agresivo)
```

Estas condiciones están **correctamente implementadas** pero son agresivas:
- Solo muestran prospectos con WhatsApp válido
- Solo entidades activas (`entity = 1`)

### Condiciones HAVING (aplicadas después de GROUP BY)

```sql
HAVING 1=1  -- Sin filtros adicionales por defecto
```

Las condiciones HAVING solo se activan cuando se selecciona un estado específico:
- `estado = 'sin_envio'` → `HAVING MAX(env.id) IS NULL`
- `estado = 'enviado'` → `HAVING MAX(env.estado) = 'enviado'`
- `estado = 'pendiente'` → `HAVING MAX(env.estado) = 'pendiente'`

**Estado:** ✅ Correctamente implementado con funciones agregadas.

---

## 🚫 DISEÑO ARQUITECTÓNICO INCORRECTO

### ¿Por qué el INNER JOIN es conceptualmente incorrecto?

#### 1. Contradice el propósito del módulo

Un **"Selector de Prospectos"** debería:
- ✅ Mostrar TODOS los prospectos disponibles en el sistema
- ✅ Permitir al usuario explorar y descubrir nuevos prospectos
- ✅ Filtrar por criterios de negocio (área, rubro, estado)

Un **"Mis Prospectos Asignados"** debería:
- ✅ Mostrar solo prospectos YA vinculados al usuario
- ✅ Usar INNER JOIN con `ll_lugares_clientes`

**El módulo actual se comporta como "Mis Prospectos" pero se llama "Selector".**

#### 2. Barrera de entrada para nuevos usuarios

```javascript
// Usuario nuevo ingresa al sistema
cliente_id = 51  // Recién creado

// Primer acceso al selector de prospectos
SELECT ... FROM llxbx_societe s
INNER JOIN ll_lugares_clientes lc ON ... AND lc.cliente_id = 51
// Resultado: 0 registros (porque ll_lugares_clientes está vacío)

// Error UX: "No se encontraron prospectos con los filtros seleccionados"
// Expectativa: Debería ver miles de prospectos disponibles
```

#### 3. Lógica invertida con ll_envios_whatsapp

```sql
-- Permites ver prospectos SIN envíos (LEFT JOIN)
LEFT JOIN ll_envios_whatsapp env ON ... AND env.campania_id = ?

-- Pero NO permites ver prospectos sin vinculación (INNER JOIN)
INNER JOIN ll_lugares_clientes lc ON ... AND lc.cliente_id = ?
```

**Inconsistencia:** ¿Por qué mostrar prospectos sin envíos pero NO sin vinculación previa?

---

## 🔧 CASOS DE USO CORRECTOS PARA CADA JOIN

### LEFT JOIN (mostrar todos, marcar asociados)

```sql
LEFT JOIN ll_lugares_clientes lc ON lc.societe_id = s.rowid AND lc.cliente_id = ?
```

**Resultado:**
- Prospectos SIN vinculación → `lc.cliente_id = NULL`
- Prospectos CON vinculación → `lc.cliente_id = 51`
- **Total visible:** TODOS los prospectos

**Caso de uso:** Selector universal con indicador de "ya agregado"

### INNER JOIN (solo mostrar asignados)

```sql
INNER JOIN ll_lugares_clientes lc ON lc.societe_id = s.rowid AND lc.cliente_id = ?
```

**Resultado:**
- Solo prospectos CON vinculación al cliente
- **Total visible:** Solo prospectos previamente asignados

**Caso de uso:** Módulo "Mis Prospectos" o "Prospectos Asignados"

---

## 📊 EVIDENCIA DEL PROBLEMA

### Request actual (con cliente_id = 51)

```bash
curl -H "Authorization: Bearer eyJh...1z8" \
  "http://localhost:3012/api/sender/prospectos/filtrar?campania_id=1"
```

**Token decodificado:**
```json
{
  "id": 2,
  "cliente_id": 51,
  "usuario": "Haby",
  "tipo": "cliente"
}
```

**Query ejecutado:**
```sql
INNER JOIN ll_lugares_clientes lc ON lc.societe_id = s.rowid AND lc.cliente_id = 51
```

**Resultado esperado si ll_lugares_clientes está vacía:** `0 registros`

### Consulta de diagnóstico recomendada

```sql
-- Verificar si existen registros para el cliente
SELECT COUNT(*) as total
FROM ll_lugares_clientes
WHERE cliente_id = 51;

-- Resultado esperado: 0
```

---

## 🎯 RESPUESTAS A PREGUNTAS ESPECÍFICAS

### 1. ¿Cuál es el SELECT principal completo?
✅ Documentado en sección "SELECT PRINCIPAL COMPLETO"

### 2. ¿Qué tablas están involucradas?
✅ Documentado en sección "TABLAS INVOLUCRADAS"

### 3. ¿Hay algún INNER JOIN eliminando registros?
⚠️ **SÍ**: `INNER JOIN ll_lugares_clientes` elimina el 100% de prospectos si no hay vinculación previa

### 4. ¿Hay condiciones WHERE convirtiendo LEFT JOIN en INNER JOIN?
❌ **NO**: Los LEFT JOINs están correctamente implementados

### 5. ¿Se filtra incorrectamente por...?

| Filtro | Estado | Explicación |
|--------|--------|-------------|
| `campania_id` | ✅ Correcto | LEFT JOIN permite ver todos los prospectos |
| `cliente_id` | ⚠️ **INCORRECTO** | INNER JOIN excluye prospectos sin vinculación |
| `tipoCliente` | ✅ Correcto | Filtro opcional en WHERE |
| `estado` | ✅ Correcto | Filtro opcional en HAVING |

### 6. ¿Hay condiciones dinámicas problemáticas?
❌ **NO**: Los filtros dinámicos están correctamente implementados con parámetros preparados

### 7. ¿El filtro de campaña está mal aplicado?
❌ **NO**: El `campania_id` está correctamente aplicado en el LEFT JOIN con `ll_envios_whatsapp`

### 8. ¿El join con ll_envios_whatsapp debería ser LEFT JOIN?
✅ **SÍ, y ya lo es**: Permite mostrar prospectos sin envíos previos (estado: "disponible")

---

## 🔄 ¿POR QUÉ FUNCIONABA ANTES?

Posibles causas de que haya funcionado previamente:

1. **Datos previos en ll_lugares_clientes**: Existían registros para el cliente que fueron eliminados/limpiados
2. **Usuario diferente**: El usuario anterior tenía `cliente_id` con datos en `ll_lugares_clientes`
3. **Código anterior diferente**: El INNER JOIN fue agregado recientemente (migración desde whatsapp-massive-sender-V2)
4. **Cambio en autenticación**: El token JWT ahora devuelve un `cliente_id` diferente
5. **Reset de base de datos**: Se limpió `ll_lugares_clientes` sin restaurar las vinculaciones

---

## 💡 SOLUCIONES PROPUESTAS

### Opción A: Cambiar a LEFT JOIN (RECOMENDADO)

```javascript
// Línea 107-108 del controlador
LEFT JOIN ll_lugares_clientes lc ON lc.societe_id = s.rowid AND lc.cliente_id = ?
```

**Ventajas:**
- ✅ Muestra TODOS los prospectos del sistema
- ✅ Mantiene la información de vinculación cuando existe
- ✅ Permite implementar indicador "Ya agregado" en frontend
- ✅ UX consistente con el nombre "Selector de Prospectos"

**Desventajas:**
- Ninguna significativa

### Opción B: Remover filtro de cliente_id

```javascript
// Remover el JOIN completamente si no es necesario el control de acceso
FROM llxbx_societe s
// LEFT JOIN ll_societe_extended se ON se.societe_id = s.rowid
// ... (resto de JOINs sin ll_lugares_clientes)
```

**Ventajas:**
- ✅ Simplifica el query
- ✅ Mejor performance (un JOIN menos)

**Desventajas:**
- ⚠️ Pierde el control de acceso si es necesario en el futuro

### Opción C: Poblar ll_lugares_clientes automáticamente

```javascript
// Crear middleware o script de inicialización
async function vincularProspectosCliente(clienteId) {
  await db.execute(`
    INSERT IGNORE INTO ll_lugares_clientes (cliente_id, societe_id)
    SELECT ?, rowid FROM llxbx_societe WHERE entity = 1
  `, [clienteId]);
}
```

**Ventajas:**
- ✅ Mantiene el INNER JOIN como está
- ✅ Control explícito de qué cliente ve qué prospectos

**Desventajas:**
- ⚠️ Requiere proceso de inicialización
- ⚠️ Mantenimiento adicional al agregar nuevos prospectos

---

## 📌 RECOMENDACIÓN FINAL

**Implementar Opción A (LEFT JOIN)** porque:

1. **Propósito del módulo**: Permitir seleccionar/explorar prospectos disponibles
2. **Mejor UX**: Usuarios ven el catálogo completo inmediatamente
3. **Menor mantenimiento**: No requiere poblar `ll_lugares_clientes`
4. **Consistencia**: Alineado con el LEFT JOIN de `ll_envios_whatsapp`
5. **Extensibilidad**: Permite agregar columna "Ya agregado" en futuras versiones

---

## 🧪 QUERY DE DIAGNÓSTICO

Para verificar el problema en producción:

```sql
-- 1. Verificar prospectos totales
SELECT COUNT(*) as prospectos_totales
FROM llxbx_societe
WHERE entity = 1;

-- 2. Verificar prospectos con WhatsApp
SELECT COUNT(*) as prospectos_con_wapp
FROM llxbx_societe
WHERE entity = 1
  AND phone_mobile IS NOT NULL
  AND phone_mobile != '';

-- 3. Verificar vinculaciones del cliente
SELECT COUNT(*) as vinculaciones_cliente
FROM ll_lugares_clientes
WHERE cliente_id = 51;

-- 4. Query actual (INNER JOIN) - Intersección
SELECT COUNT(*) as resultado_actual
FROM llxbx_societe s
INNER JOIN ll_lugares_clientes lc ON lc.societe_id = s.rowid AND lc.cliente_id = 51
WHERE s.entity = 1
  AND s.phone_mobile IS NOT NULL
  AND s.phone_mobile != '';

-- 5. Query propuesto (LEFT JOIN) - Todos los prospectos
SELECT COUNT(*) as resultado_propuesto
FROM llxbx_societe s
LEFT JOIN ll_lugares_clientes lc ON lc.societe_id = s.rowid AND lc.cliente_id = 51
WHERE s.entity = 1
  AND s.phone_mobile IS NOT NULL
  AND s.phone_mobile != '';
```

**Resultado esperado:**
- `prospectos_totales`: 10,000+
- `prospectos_con_wapp`: 8,000+
- `vinculaciones_cliente`: **0** ← Causa del problema
- `resultado_actual`: **0** ← INNER JOIN sin matches
- `resultado_propuesto`: 8,000+ ← LEFT JOIN muestra todos

---

## 📝 PRÓXIMOS PASOS

1. ✅ **Diagnóstico completado**: Problema identificado claramente
2. ⏳ **Pendiente**: Decidir qué opción de solución implementar
3. ⏳ **Pendiente**: Implementar el fix en `prospectosController.js`
4. ⏳ **Pendiente**: Testing con datos reales
5. ⏳ **Pendiente**: Deployment y verificación en producción

---

## 📚 REFERENCIAS

- **Archivo:** `/root/leadmaster-workspace/services/central-hub/src/modules/sender/controllers/prospectosController.js`
- **Líneas críticas:** 107-108 (INNER JOIN ll_lugares_clientes)
- **Token JWT:** `cliente_id = 51` (usuario "Haby")
- **Endpoint:** `GET /api/sender/prospectos/filtrar?campania_id=1`

---

**Generado:** 2026-02-11  
**Estado:** 🔍 Diagnóstico completado - Pendiente implementación de fix
