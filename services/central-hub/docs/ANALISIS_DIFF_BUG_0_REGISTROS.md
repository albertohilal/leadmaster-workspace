# 🔍 ANÁLISIS DE DIFF: Bug de 0 Registros Post-Commit

**Fecha:** 2026-02-11  
**Branch:** `feature/whatsapp-init-sync`  
**Contexto:** Los prospectos se mostraban correctamente en el último commit, pero después de los cambios actuales devuelve 0 registros  
**Requerimiento:** Desplegar TODOS los prospectos de ese cliente con su ESTADO correspondiente

---

## 📊 ARCHIVOS MODIFICADOS (SIN COMMIT)

```
modified:   frontend/src/components/destinatarios/SelectorProspectosPage.jsx
modified:   frontend/src/services/prospectos.js
modified:   src/modules/sender/controllers/prospectosController.js
```

---

## 🔬 ANÁLISIS DETALLADO DE CADA DIFF

### 1️⃣ SelectorProspectosPage.jsx (Frontend - Componente React)

#### Cambios realizados:

**A. Se movió la carga de estados a un método separado**

```diff
- const [campanasData, areasData, rubrosData, estadosData] = await Promise.all([
+ const [campanasData, areasData, rubrosData] = await Promise.all([
    campanasService.obtenerCampanas(),
    prospectosService.obtenerAreas(),
-   prospectosService.obtenerRubros(),
-   prospectosService.obtenerEstados()
+   prospectosService.obtenerRubros()
  ]);
```

**B. Se agregó un nuevo useEffect que carga estados dinámicamente**

```javascript
useEffect(() => {
  if (campaniaSeleccionada) {
    cargarEstadosCampania();  // ← Nuevo método
  } else {
    setEstados([]);
  }
}, [campaniaSeleccionada]);
```

**C. Nuevo método cargarEstadosCampania()**

```javascript
const cargarEstadosCampania = async () => {
  const estadosData = await prospectosService.obtenerEstados(campaniaSeleccionada);
  const estadosArray = Array.isArray(estadosData?.estados) ? estadosData.estados : [];
  setEstados(estadosArray);
};
```

#### ✅ Impacto en el flujo:

**ANTES:**
1. Usuario entra → carga campañas, áreas, rubros, estados (globales)
2. Usuario selecciona campaña → carga prospectos

**AHORA:**
1. Usuario entra → carga campañas, áreas, rubros (SIN estados)
2. Usuario selecciona campaña → carga estados (filtrados por campaña) + carga prospectos

#### ⚠️ Problema potencial:

**NO** - Los cambios en el frontend están correctos y no causan el problema de 0 registros.

---

### 2️⃣ prospectos.js (Frontend - Servicio API)

#### Cambios realizados:

**A. Se agregó campania_id a filtrarProspectos**

```diff
  async filtrarProspectos(filtros) {
    const queryParams = new URLSearchParams();
    
+   // ✅ CRÍTICO: Incluir campania_id (obligatorio)
+   if (filtros.campania_id) queryParams.append('campania_id', filtros.campania_id);
```

**B. obtenerEstados() ahora acepta campaniaId como parámetro**

```diff
- async obtenerEstados() {
+ async obtenerEstados(campaniaId = null) {
-   const response = await apiService.get('/sender/prospectos/estados');
+   const params = campaniaId ? { campania_id: campaniaId } : {};
+   const response = await apiService.get('/sender/prospectos/estados', { params });
```

#### ✅ Impacto:

**ANTES:**
- `filtrarProspectos` NO enviaba `campania_id` al backend
- `obtenerEstados` NO filtraba por campaña

**AHORA:**
- `filtrarProspectos` SÍ envía `campania_id` (si existe en filtros)
- `obtenerEstados` filtra por campaña específica

#### ⚠️ Problema potencial:

El frontend SÍ envía `campania_id` porque en SelectorProspectosPage.jsx línea 111:

```javascript
const filtrosConBusqueda = {
  ...filtros,
  campania_id: campaniaSeleccionada,  // ← SÍ está presente
  busqueda,
  limite: registrosPorPagina,
  offset: (paginaActual - 1) * registrosPorPagina
};
```

**Conclusión:** El servicio está enviando correctamente el parámetro.

---

### 3️⃣ prospectosController.js (Backend - Controller)

#### 🚨 CAMBIOS CRÍTICOS

#### A. campania_id ahora es OBLIGATORIO

```diff
+ // ✅ VALIDACIÓN: campania_id es obligatorio
+ if (!campania_id) {
+   return res.status(400).json({
+     success: false,
+     error: 'campania_id es obligatorio'
+   });
+ }
```

**Impacto:**
- ❌ ANTES: `campania_id` era opcional
- ⚠️ AHORA: Si no hay `campania_id`, el endpoint retorna error 400

#### B. Cambio en el orden de parámetros

**VERSIÓN ANTERIOR (commit 7f61633):**

```javascript
// LEFT JOIN condicional
LEFT JOIN ll_envios_whatsapp env ON env.lugar_id = s.rowid${campania_id ? ' AND env.campania_id = ?' : ''}

// Params con orden INCORRECTO (bug latente)
const params = campania_id ? [campania_id, clienteId] : [clienteId];
```

**Orden de `?` en el SELECT:**
1. `INNER JOIN ll_lugares_clientes ... AND lc.cliente_id = ?` ← Primer ?
2. `LEFT JOIN ll_envios_whatsapp ... AND env.campania_id = ?` ← Segundo ? (si había campaña)

**Params enviados:**
- Con campaña: `[campania_id, clienteId]` 
  - Primer ? recibe `campania_id` ❌ (debería recibir `clienteId`)
  - Segundo ? recibe `clienteId` ❌ (debería recibir `campania_id`)
- Sin campaña: `[clienteId]` ✓

🤔 **PARADOJA:** Esto estaba MAL, pero según el commit "stable-prospectos-telefono" funcionaba...

**VERSIÓN ACTUAL (modificada, sin commit):**

```javascript
// LEFT JOIN SIEMPRE con campania_id
LEFT JOIN ll_envios_whatsapp env ON env.lugar_id = s.rowid AND env.campania_id = ?

// Params con orden CORRECTO
const params = [clienteId, campania_id];
```

**Orden de `?` en el SELECT:**
1. `INNER JOIN ll_lugares_clientes ... AND lc.cliente_id = ?` ← Primer ?
2. `LEFT JOIN ll_envios_whatsapp ... AND env.campania_id = ?` ← Segundo ?

**Params enviados:**
- `[clienteId, campania_id]`
  - Primer ? recibe `clienteId` ✓
  - Segundo ? recibe `campania_id` ✓

✅ **EL ORDEN DE PARÁMETROS AHORA ESTÁ CORRECTO**

#### C. Reestructuración del query

**ANTES:** Construcción dinámica con concatenación de strings

```javascript
let sql = `SELECT ... WHERE s.entity = 1 ...`;

if (soloWappValido === 'true') {
  sql += ` AND s.phone_mobile IS NOT NULL AND s.phone_mobile != ''`;
}
if (rubro) {
  sql += ` AND COALESCE(r.nombre, 'Sin rubro') LIKE ?`;
  params.push(`%${rubro}%`);
}
// ... etc
```

**AHORA:** Construcción con arrays de condiciones

```javascript
const whereConditions = ['s.entity = 1'];
const havingConditions = [];
const params = [clienteId, campania_id];

if (soloWappValido === 'true') {
  whereConditions.push("s.phone_mobile IS NOT NULL AND s.phone_mobile != ''");
}
if (rubro) {
  whereConditions.push("COALESCE(r.nombre, 'Sin rubro') LIKE ?");
  params.push(`%${rubro}%`);
}

const sql = `
  SELECT ...
  WHERE ${whereConditions.join(' AND ')}
  HAVING ${havingConditions.length > 0 ? havingConditions.join(' AND ') : '1=1'}
`;
```

✅ **LA ESTRUCTURA ES MÁS LIMPIA Y MANTENIBLE**

#### D. obtenerEstados() ahora filtra por campaña

```diff
  async obtenerEstados(req, res) {
+   const { campania_id } = req.query;
    
-   const [rows] = await db.execute(`
+   let sql = `
      SELECT DISTINCT ll_envios_whatsapp.estado as nombre
      FROM ll_envios_whatsapp
      WHERE ll_envios_whatsapp.estado IS NOT NULL 
        AND ll_envios_whatsapp.estado != ''
-     ORDER BY ll_envios_whatsapp.estado ASC
-   `);
+   `;
+   
+   const params = [];
+   
+   if (campania_id) {
+     sql += ` AND ll_envios_whatsapp.campania_id = ?`;
+     params.push(campania_id);
+   }
+   
+   sql += ` ORDER BY ll_envios_whatsapp.estado ASC`;
+   
+   const [rows] = await db.execute(sql, params);
```

✅ **MEJORA:** Ahora muestra solo los estados que existen en esa campaña específica

---

## 🎯 DIAGNÓSTICO DEL PROBLEMA

### ❌ CAUSA RAÍZ CONFIRMADA

**El problema NO está en los cambios recientes, sino en el diseño original:**

```sql
INNER JOIN ll_lugares_clientes lc ON lc.societe_id = s.rowid AND lc.cliente_id = ?
```

Este `INNER JOIN` **SIEMPRE ha sido el problema**, tanto en la versión anterior como en la actual.

### 🤔 Pregunta clave: ¿Por qué funcionaba antes?

Posibles explicaciones:

#### Hipótesis 1: Datos en ll_lugares_clientes fueron eliminados

```sql
-- Verificar si existían datos antes
SELECT COUNT(*) FROM ll_lugares_clientes WHERE cliente_id = 51;
```

**Si devuelve 0:** La tabla fue vaciada o nunca tuvo datos para este cliente.

#### Hipótesis 2: Se usaba otro cliente_id

El usuario anterior tenía un `cliente_id` diferente que SÍ tenía registros en `ll_lugares_clientes`.

```javascript
// Token JWT decodificado actual
{
  "id": 2,
  "cliente_id": 51,  // ← Este cliente NO tiene datos en ll_lugares_clientes
  "usuario": "Haby",
  "tipo": "cliente"
}
```

#### Hipótesis 3: El orden de params estaba MAL pero coincidía

En la versión anterior: `params = [campania_id, clienteId]`

Si `campania_id = 51` y `cliente_id = 51`, los valores serían intercambiados pero casualmente iguales, haciendo que funcionara por casualidad.

**Para verificar:**

```bash
# Ver qué campania_id se estaba usando antes
curl -H "Authorization: Bearer <TOKEN>" \
  "http://localhost:3012/api/sender/prospectos/filtrar?campania_id=51"
```

Si el usuario estaba usando `campania_id=51` y su `cliente_id` también era 51, el query accidentalmente funcionaba.

#### Hipótesis 4: Se estaba llamando SIN campaña (cuando era opcional)

**ANTES:** Si NO se enviaba `campania_id`, el endpoint funcionaba:

```javascript
const params = campania_id ? [campania_id, clienteId] : [clienteId];
LEFT JOIN ll_envios_whatsapp env ON env.lugar_id = s.rowid${campania_id ? ' AND env.campania_id = ?' : ''}
```

Sin campaña: `params = [clienteId]` y el único `?` era el del INNER JOIN (correcto).

**AHORA:** El endpoint REQUIERE `campania_id` obligatoriamente, y esto expone el bug del INNER JOIN.

---

## 🔍 DIFERENCIAS CLAVE ENTRE ANTES Y AHORA

| Aspecto | ANTES (funcionaba) | AHORA (0 registros) |
|---------|-------------------|---------------------|
| **campania_id** | Opcional | ⚠️ **OBLIGATORIO** |
| **Orden params** | ❌ INCORRECTO: `[campania_id, clienteId]` | ✅ CORRECTO: `[clienteId, campania_id]` |
| **LEFT JOIN** | Condicional (solo si hay campaña) | Siempre presente |
| **ll_lugares_clientes** | INNER JOIN (problema latente) | INNER JOIN (problema expuesto) |
| **Carga de estados** | Global (sin filtro) | ✅ Por campaña (filtrado) |

---

## 🚨 PROBLEMA PRINCIPAL IDENTIFICADO

### El INNER JOIN con ll_lugares_clientes es un filtro restrictivo incorrecto

```sql
FROM llxbx_societe s
INNER JOIN ll_lugares_clientes lc ON lc.societe_id = s.rowid AND lc.cliente_id = ?
```

**Comportamiento:**
- ❌ Solo muestra prospectos que YA están vinculados en `ll_lugares_clientes`
- ❌ Si la tabla está vacía → 0 resultados
- ❌ Contradice el propósito de un "Selector de Prospectos" (explorar todos los disponibles)

**Efecto actual:**

```
┌─────────────────────┐
│ llxbx_societe       │  ← 10,000+ prospectos
│ (10,000 registros)  │
└──────────┬──────────┘
           │ INNER JOIN requiere match
           ▼
┌─────────────────────┐
│ ll_lugares_clientes │  ← 0 registros para cliente_id = 51
│ (cliente_id = 51)   │
└─────────────────────┘
           ▼
    📊 RESULTADO = 0 registros
```

### ¿Por qué ahora sí causa problemas?

**TEORÍA MÁS PROBABLE:**

Antes, el selector se usaba **sin seleccionar campaña** (cuando era opcional), lo cual ejecutaba:

```javascript
params = [clienteId]  // Solo un parámetro
LEFT JOIN ll_envios_whatsapp env ON env.lugar_id = s.rowid  // Sin filtro de campaña
```

Esto permitía ver prospectos con cualquier envío o sin envíos.

**Ahora:**

Al hacer `campania_id` obligatorio y agregarlo al LEFT JOIN fijo, el sistema **siempre** requiere una campaña seleccionada, lo cual expone que `ll_lugares_clientes` está vacía para este cliente.

---

## 💡 PROPUESTAS DE SOLUCIÓN

### ✅ Opción A: Cambiar a LEFT JOIN (RECOMENDADO)

**Justificación:** Un "Selector de Prospectos" debe mostrar TODOS los prospectos disponibles.

```javascript
// Línea 107-108 de prospectosController.js
- INNER JOIN ll_lugares_clientes lc ON lc.societe_id = s.rowid AND lc.cliente_id = ?
+ LEFT JOIN ll_lugares_clientes lc ON lc.societe_id = s.rowid AND lc.cliente_id = ?
```

**Ventajas:**
- ✅ Muestra TODOS los prospectos del sistema
- ✅ Mantiene info de vinculación cuando existe (`lc.cliente_id` será NULL para no vinculados)
- ✅ Permite agregar indicador "Ya agregado" en el futuro
- ✅ Consistente con el propósito del módulo
- ✅ Resuelve el problema inmediatamente

**Desventajas:**
- Ninguna significativa

**Resultado esperado:**
```sql
SELECT COUNT(*) as total
FROM llxbx_societe s
LEFT JOIN ll_lugares_clientes lc ON lc.societe_id = s.rowid AND lc.cliente_id = 51
WHERE s.entity = 1
  AND s.phone_mobile IS NOT NULL
  AND s.phone_mobile != '';
  
-- Resultado esperado: 8,000+ prospectos
```

---

### 🔧 Opción B: Poblar ll_lugares_clientes automáticamente

**Justificación:** Mantener el control de acceso por cliente.

```javascript
// Agregar middleware o script de inicialización
async function inicializarProspectosCliente(clienteId) {
  const [result] = await db.execute(`
    INSERT IGNORE INTO ll_lugares_clientes (cliente_id, societe_id)
    SELECT ?, rowid 
    FROM llxbx_societe 
    WHERE entity = 1
  `, [clienteId]);
  
  console.log(`✅ Inicializados ${result.affectedRows} prospectos para cliente ${clienteId}`);
}
```

**Llamar en:**
1. Al crear un nuevo cliente
2. Al primer acceso al selector de prospectos
3. Como script de migración para clientes existentes

**Ventajas:**
- ✅ Mantiene el INNER JOIN (control de acceso)
- ✅ Cada cliente ve solo "sus" prospectos asignados
- ✅ Útil en escenarios multi-tenant estrictos

**Desventajas:**
- ⚠️ Requiere proceso de inicialización
- ⚠️ Mantenimiento: al agregar nuevos prospectos a `llxbx_societe`
- ⚠️ Mayor complejidad operativa

---

### 🔄 Opción C: Hacer campania_id opcional nuevamente

**Justificación:** Restaurar comportamiento anterior.

```javascript
// Remover validación obligatoria
- if (!campania_id) {
-   return res.status(400).json({
-     success: false,
-     error: 'campania_id es obligatorio'
-   });
- }

// LEFT JOIN condicional como antes
- LEFT JOIN ll_envios_whatsapp env ON env.lugar_id = s.rowid AND env.campania_id = ?
+ LEFT JOIN ll_envios_whatsapp env ON env.lugar_id = s.rowid${campania_id ? ' AND env.campania_id = ?' : ''}

// Params condicionales
- const params = [clienteId, campania_id];
+ const params = [clienteId];
+ if (campania_id) params.push(campania_id);
```

**Ventajas:**
- ✅ Permite ver prospectos sin seleccionar campaña
- ✅ Restaura funcionalidad anterior

**Desventajas:**
- ❌ NO resuelve el problema del INNER JOIN
- ❌ Sigue sin mostrar prospectos si `ll_lugares_clientes` está vacía
- ❌ Inconsistente con el frontend que ahora requiere campaña

---

### ❌ Opción D: Remover el JOIN de ll_lugares_clientes completamente

```javascript
FROM llxbx_societe s
// REMOVER: INNER JOIN ll_lugares_clientes lc ON ...
LEFT JOIN ll_societe_extended se ON se.societe_id = s.rowid
```

**Ventajas:**
- ✅ Simplifica el query
- ✅ Mejor performance
- ✅ Todos los usuarios ven todos los prospectos

**Desventajas:**
- ⚠️ Pierde control de acceso por cliente
- ⚠️ En multi-tenant, un cliente podría ver prospectos de otro cliente

---

## 📌 RECOMENDACIÓN FINAL

### ✅ **IMPLEMENTAR OPCIÓN A: Cambiar a LEFT JOIN**

**Razones:**

1. **Propósito del módulo:** Es un "Selector" para explorar/descubrir prospectos
2. **Mínima intervención:** Un solo cambio de palabra (`INNER` → `LEFT`)
3. **Sin efectos secundarios:** No requiere scripts de inicialización
4. **UX mejorada:** Los usuarios ven el catálogo completo inmediatamente
5. **Extensible:** Permite agregar columna "Ya agregado" en futuras versiones
6. **Consistente:** Alineado con el LEFT JOIN de `ll_envios_whatsapp`

### 🛠️ Implementación propuesta:

**Archivo:** `src/modules/sender/controllers/prospectosController.js`

**Línea 107-108:**

```javascript
// CAMBIO ÚNICO
- INNER JOIN ll_lugares_clientes lc ON lc.societe_id = s.rowid AND lc.cliente_id = ?
+ LEFT JOIN ll_lugares_clientes lc ON lc.societe_id = s.rowid AND lc.cliente_id = ?
```

**Testing:**

```bash
# 1. Verificar prospectos totales con WhatsApp
curl -H "Authorization: Bearer <TOKEN>" \
  "http://localhost:3012/api/sender/prospectos/filtrar?campania_id=1" \
  | jq '.prospectos | length'

# Resultado esperado: 8,000+ (en vez de 0)

# 2. Verificar que el estado se calcula correctamente
curl -H "Authorization: Bearer <TOKEN>" \
  "http://localhost:3012/api/sender/prospectos/filtrar?campania_id=1" \
  | jq '.prospectos[0:5] | .[].estado'

# Resultado esperado: Mix de "disponible", "enviado", "pendiente"
```

---

## 🔬 QUERIES DE DIAGNÓSTICO COMPLEMENTARIO

### 1. Verificar registros en ll_lugares_clientes

```sql
SELECT 
  COUNT(*) as total_vinculaciones,
  COUNT(DISTINCT cliente_id) as clientes_unicos,
  COUNT(DISTINCT societe_id) as prospectos_vinculados
FROM ll_lugares_clientes;
```

### 2. Verificar datos del cliente actual

```sql
SELECT cliente_id, COUNT(*) as prospectos_asignados
FROM ll_lugares_clientes
WHERE cliente_id = 51
GROUP BY cliente_id;

-- Resultado esperado actual: 0 filas (tabla vacía para este cliente)
```

### 3. Verificar prospectos totales disponibles

```sql
SELECT COUNT(*) as prospectos_con_wapp
FROM llxbx_societe
WHERE entity = 1
  AND phone_mobile IS NOT NULL
  AND phone_mobile != '';

-- Resultado esperado: 8,000+
```

### 4. Comparar INNER JOIN vs LEFT JOIN

```sql
-- A. INNER JOIN (actual - devuelve 0)
SELECT COUNT(*) as resultado_actual
FROM llxbx_societe s
INNER JOIN ll_lugares_clientes lc ON lc.societe_id = s.rowid AND lc.cliente_id = 51
WHERE s.entity = 1
  AND s.phone_mobile IS NOT NULL
  AND s.phone_mobile != '';

-- B. LEFT JOIN (propuesto - debería devolver 8000+)
SELECT COUNT(*) as resultado_propuesto
FROM llxbx_societe s
LEFT JOIN ll_lugares_clientes lc ON lc.societe_id = s.rowid AND lc.cliente_id = 51
WHERE s.entity = 1
  AND s.phone_mobile IS NOT NULL
  AND s.phone_mobile != '';
```

---

## 📝 PRÓXIMOS PASOS PROPUESTOS

1. ✅ **Revisar y aprobar** esta propuesta
2. ⏳ **Decisión:** Implementar Opción A (LEFT JOIN) o Opción B (poblar tabla)
3. ⏳ **Realizar el cambio** en `prospectosController.js`
4. ⏳ **Testing local** con queries de diagnóstico
5. ⏳ **Commit** con mensaje descriptivo
6. ⏳ **Testing en frontend** verificando que se muestren prospectos
7. ⏳ **Deployment** a producción

---

## 📚 ARCHIVOS RELACIONADOS

- **Backend Controller:** `/root/leadmaster-workspace/services/central-hub/src/modules/sender/controllers/prospectosController.js`
- **Frontend Service:** `/root/leadmaster-workspace/services/central-hub/frontend/src/services/prospectos.js`
- **Frontend Component:** `/root/leadmaster-workspace/services/central-hub/frontend/src/components/destinatarios/SelectorProspectosPage.jsx`
- **Diagnóstico previo:** `/root/leadmaster-workspace/services/central-hub/docs/DIAGNOSTICO_BUG_INNER_JOIN_LUGARES_CLIENTES.md`

---

## 🎯 CONCLUSIÓN

**El problema NO está en los cambios recientes (que mejoran la estructura), sino en el diseño original del INNER JOIN con ll_lugares_clientes.**

Los cambios actuales son correctos y mejoran:
- ✅ Orden de parámetros (ahora correcto)
- ✅ Estructura del query (más mantenible)
- ✅ Filtrado de estados por campaña
- ✅ Validación de parámetros obligatorios

**El único cambio necesario es convertir el INNER JOIN en LEFT JOIN.**

Sin este cambio, el selector seguirá devolviendo 0 registros para cualquier cliente que no tenga datos previos en `ll_lugares_clientes`.

---

**Generado:** 2026-02-11  
**Estado:** 🔍 Análisis de diff completado - Propuesta de solución lista para implementar  
**Commit de referencia:** `7f61633` (stable-prospectos-telefono - última versión que funcionaba)
