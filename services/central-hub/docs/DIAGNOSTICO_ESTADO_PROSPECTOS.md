# DIAGNÓSTICO ARQUITECTÓNICO – ESTADO DE PROSPECTOS

**Fecha**: 11 de febrero de 2026  
**Componente afectado**: Selección de Prospectos (Sender Module)  
**Severidad**: 🔴 ALTA - Violación de regla de negocio fundamental  

---

## 📋 RESUMEN EJECUTIVO

El sistema muestra estados de envío (pendiente, enviado, disponible) de prospectos **incluso cuando NO hay campaña seleccionada**. Esto viola la regla de negocio fundamental:

> **"El estado de envío pertenece a la relación Prospecto ↔ Campaña, NO al prospecto aislado"**

---

## 🔍 HALLAZGOS

### 1️⃣ PROBLEMA EN BACKEND - Query SQL Principal

**📂 Archivo**: [src/modules/sender/controllers/prospectosController.js](../src/modules/sender/controllers/prospectosController.js#L26-L48)  
**📍 Líneas**: 26-48  

#### Query SQL problemática:

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
  -- ... más campos
FROM llxbx_societe s
INNER JOIN ll_lugares_clientes lc ON lc.societe_id = s.rowid AND lc.cliente_id = ?
LEFT JOIN ll_societe_extended se ON se.societe_id = s.rowid
LEFT JOIN ll_rubros r ON se.rubro_id = r.id
LEFT JOIN ll_envios_whatsapp env ON env.lugar_id = s.rowid${campania_id ? ' AND env.campania_id = ?' : ''}
WHERE s.entity = 1
GROUP BY s.rowid, s.nom, s.phone_mobile, s.email, s.address, s.town, r.nombre, r.area, s.client, s.fournisseur
```

#### 🚨 PROBLEMAS IDENTIFICADOS:

**a) JOIN Condicional Incorrecto** (Línea 47):
```javascript
LEFT JOIN ll_envios_whatsapp env ON env.lugar_id = s.rowid${campania_id ? ' AND env.campania_id = ?' : ''}
```

- **Cuando `campania_id` existe**: JOIN filtra correctamente por campaña específica ✅
- **Cuando `campania_id` es `undefined/null`**: JOIN trae TODOS los envíos de TODAS las campañas ❌

**b) Cálculo de Estado Siempre Activo** (Líneas 33-36):
```sql
CASE 
  WHEN MAX(env.id) IS NOT NULL THEN MAX(env.estado)
  ELSE 'disponible'
END as estado
```

- Siempre calcula un estado, incluso cuando no hay campaña seleccionada
- `MAX(env.estado)` retorna el estado del **último envío de cualquier campaña**
- No hay lógica que devuelva `NULL` cuando `campania_id` no existe

**c) Orden de Parámetros** (Línea 50):
```javascript
const params = campania_id ? [campania_id, clienteId] : [clienteId];
```
⚠️ **ORDEN INCORRECTO**: Debe ser `[clienteId, campania_id]` ya que el primer `?` en la query corresponde a `cliente_id` en el INNER JOIN.

---

### 2️⃣ PROBLEMA EN BACKEND - Endpoint de Estados

**📂 Archivo**: [src/modules/sender/controllers/prospectosController.js](../src/modules/sender/controllers/prospectosController.js#L193-L200)  
**📍 Líneas**: 193-200  

#### Query de estados:

```javascript
async obtenerEstados(req, res) {
  try {
    const [rows] = await db.execute(`
      SELECT DISTINCT ll_envios_whatsapp.estado as nombre
      FROM ll_envios_whatsapp
      WHERE ll_envios_whatsapp.estado IS NOT NULL 
        AND ll_envios_whatsapp.estado != ''
      ORDER BY ll_envios_whatsapp.estado ASC
    `);
    // ...
  }
}
```

#### 🚨 PROBLEMA:
- Obtiene TODOS los estados de TODAS las campañas sin filtrar
- No recibe ni valida `campania_id`
- El frontend muestra estados que podrían no existir en la campaña seleccionada

---

### 3️⃣ PROBLEMA EN FRONTEND - Service No Envía `campania_id`

**📂 Archivo**: [frontend/src/services/prospectos.js](../frontend/src/services/prospectos.js#L5-L16)  
**📍 Líneas**: 5-16  

#### Código actual:

```javascript
async filtrarProspectos(filtros = {}) {
  try {
    const queryParams = new URLSearchParams();
    
    if (filtros.area) queryParams.append('area', filtros.area);
    if (filtros.rubro) queryParams.append('rubro', filtros.rubro);
    if (filtros.direccion) queryParams.append('direccion', filtros.direccion);
    if (filtros.estado) queryParams.append('estado', filtros.estado);
    if (filtros.tipo_cliente) queryParams.append('tipoCliente', filtros.tipo_cliente);
    if (filtros.limite) queryParams.append('limite', filtros.limite);
    // ❌ NO SE ENVÍA campania_id
    
    const url = `/sender/prospectos/filtrar${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await apiService.get(url);
    return response.data;
  }
}
```

#### 🚨 PROBLEMA:
- **El componente SelectorProspectosPage.jsx SÍ pasa `campania_id`** en el objeto filtros (línea 88)
- **El servicio NO lo incluye** en los queryParams enviados al backend
- Aunque el backend recibiera `campania_id`, el filtro nunca llega

---

### 4️⃣ PROBLEMA EN FRONTEND - Carga de Prospectos Sin Campaña

**📂 Archivo**: [frontend/src/components/destinatarios/SelectorProspectosPage.jsx](../frontend/src/components/destinatarios/SelectorProspectosPage.jsx#L43-L46)  
**📍 Líneas**: 43-46  

#### Código actual:

```javascript
// Cargar prospectos cuando cambien los filtros O la campaña seleccionada
useEffect(() => {
  if (campaniaSeleccionada) {
    cargarProspectos();
  }
}, [campaniaSeleccionada, filtros, busqueda, paginaActual]);
```

#### ✅ CORRECTO:
- Solo carga prospectos cuando hay una campaña seleccionada
- Sin embargo, el servicio no envía el `campania_id` al backend

---

## 🧠 ANÁLISIS DE FLUJO ACTUAL

### Escenario 1: CON campaña seleccionada

```
Frontend (SelectorProspectosPage)
  ↓ campaniaSeleccionada = 5
  ↓ filtros = { campania_id: 5, estado: 'pendiente', ... }
  ↓
Frontend (prospectosService.filtrarProspectos)
  ↓ ❌ NO incluye campania_id en queryParams
  ↓ GET /sender/prospectos/filtrar?estado=pendiente
  ↓
Backend (prospectosController.filtrarProspectos)
  ↓ campania_id = undefined (no llega)
  ↓ JOIN sin filtro: LEFT JOIN env ON env.lugar_id = s.rowid
  ↓ Trae TODOS los envíos de TODAS las campañas
  ↓ MAX(env.estado) → último estado global
  ↓
Response
  ↓ prospectos con estados de múltiples campañas mezclados
```

### Escenario 2: SIN campaña seleccionada

```
Frontend (SelectorProspectosPage)
  ↓ campaniaSeleccionada = ''
  ↓ useEffect no ejecuta cargarProspectos() ✅
  ↓ No se hace petición al backend
```

---

## 📊 MATRIZ DE PROBLEMAS

| # | Capa | Archivo | Línea | Problema | Impacto |
|---|------|---------|-------|----------|---------|
| 1 | Backend | prospectosController.js | 47 | JOIN sin filtro cuando campania_id es null | Estados mezclados de todas las campañas |
| 2 | Backend | prospectosController.js | 33-36 | Siempre calcula estado (no retorna NULL) | No hay distinción "sin campaña" vs "disponible" |
| 3 | Backend | prospectosController.js | 50 | Orden de params incorrecto | Bug latente (cliente_id y campania_id invertidos) |
| 4 | Backend | prospectosController.js | 193-200 | Estados sin filtrar por campaña | Filtros muestran estados irrelevantes |
| 5 | Frontend | prospectos.js | 5-16 | No envía campania_id al backend | Campaña nunca llega al backend |

---

## ✅ COMPORTAMIENTO ESPERADO

### Reglas de Negocio:

1. **CON campaña seleccionada**:
   - Mostrar prospectos con su estado **en esa campaña específica**
   - Estados posibles: `disponible`, `pendiente`, `enviado`, `fallido`
   - El filtro de estados debe mostrar solo estados de esa campaña

2. **SIN campaña seleccionada**:
   - NO mostrar ningún prospecto ✅ (actualmente implementado)
   - NO cargar estados (el dropdown debe estar deshabilitado)
   - Mensaje: "Selecciona una campaña para ver prospectos"

---

## 🛠️ PROPUESTA DE CORRECCIÓN

### CORRECCIÓN 1: Backend - Query SQL Principal
**Archivo**: `src/modules/sender/controllers/prospectosController.js`

```javascript
// ❌ ACTUAL (LÍNEA 26-50)
CASE 
  WHEN MAX(env.id) IS NOT NULL THEN MAX(env.estado)
  ELSE 'disponible'
END as estado,
// ...
LEFT JOIN ll_envios_whatsapp env ON env.lugar_id = s.rowid${campania_id ? ' AND env.campania_id = ?' : ''}
// ...
const params = campania_id ? [campania_id, clienteId] : [clienteId];

// ✅ PROPUESTA DE CORRECCIÓN
CASE 
  WHEN ? IS NULL THEN NULL  -- Si no hay campaña, estado = NULL
  WHEN MAX(env.id) IS NOT NULL THEN MAX(env.estado)
  ELSE 'disponible'
END as estado,
// ...
LEFT JOIN ll_envios_whatsapp env ON env.lugar_id = s.rowid
  ${campania_id ? 'AND env.campania_id = ?' : 'AND 1=0'}  -- Forzar vacío si no hay campaña
// ...
const params = [clienteId];
if (campania_id) {
  params.push(campania_id);  // Para el CASE
  params.push(campania_id);  // Para el JOIN
}
```

**Cambios clave**:
- Agregar validación explícita `? IS NULL` en el CASE para retornar estado NULL
- Cambiar JOIN a `AND 1=0` cuando no hay campaña (garantiza 0 resultados del JOIN)
- Corregir orden de parámetros

---

### CORRECCIÓN 2: Backend - Endpoint de Estados
**Archivo**: `src/modules/sender/controllers/prospectosController.js`

```javascript
// ❌ ACTUAL (LÍNEA 193-200)
async obtenerEstados(req, res) {
  try {
    const [rows] = await db.execute(`
      SELECT DISTINCT ll_envios_whatsapp.estado as nombre
      FROM ll_envios_whatsapp
      WHERE ll_envios_whatsapp.estado IS NOT NULL 
        AND ll_envios_whatsapp.estado != ''
      ORDER BY ll_envios_whatsapp.estado ASC
    `);

// ✅ PROPUESTA DE CORRECCIÓN
async obtenerEstados(req, res) {
  try {
    const { campania_id } = req.query;
    
    let sql = `
      SELECT DISTINCT ll_envios_whatsapp.estado as nombre
      FROM ll_envios_whatsapp
      WHERE ll_envios_whatsapp.estado IS NOT NULL 
        AND ll_envios_whatsapp.estado != ''
    `;
    
    const params = [];
    
    // Solo filtrar si hay campaña específica
    if (campania_id) {
      sql += ` AND ll_envios_whatsapp.campania_id = ?`;
      params.push(campania_id);
    }
    
    sql += ` ORDER BY ll_envios_whatsapp.estado ASC`;
    
    const [rows] = await db.execute(sql, params);
```

---

### CORRECCIÓN 3: Frontend - Service debe enviar campania_id
**Archivo**: `frontend/src/services/prospectos.js`

```javascript
// ❌ ACTUAL (LÍNEA 5-16)
async filtrarProspectos(filtros = {}) {
  try {
    const queryParams = new URLSearchParams();
    
    if (filtros.area) queryParams.append('area', filtros.area);
    if (filtros.rubro) queryParams.append('rubro', filtros.rubro);
    if (filtros.direccion) queryParams.append('direccion', filtros.direccion);
    if (filtros.estado) queryParams.append('estado', filtros.estado);
    if (filtros.tipo_cliente) queryParams.append('tipoCliente', filtros.tipo_cliente);
    if (filtros.limite) queryParams.append('limite', filtros.limite);

// ✅ PROPUESTA DE CORRECCIÓN
async filtrarProspectos(filtros = {}) {
  try {
    const queryParams = new URLSearchParams();
    
    // ✅ CRÍTICO: Incluir campania_id si está presente
    if (filtros.campania_id) queryParams.append('campania_id', filtros.campania_id);
    
    if (filtros.area) queryParams.append('area', filtros.area);
    if (filtros.rubro) queryParams.append('rubro', filtros.rubro);
    if (filtros.direccion) queryParams.append('direccion', filtros.direccion);
    if (filtros.estado) queryParams.append('estado', filtros.estado);
    if (filtros.tipo_cliente) queryParams.append('tipoCliente', filtros.tipo_cliente);
    if (filtros.limite) queryParams.append('limite', filtros.limite);
```

---

### CORRECCIÓN 4: Frontend - Llamada a obtenerEstados con campania_id
**Archivo**: `frontend/src/services/prospectos.js`

```javascript
// ❌ ACTUAL (LÍNEA 44-52)
async obtenerEstados() {
  try {
    const response = await apiService.get('/sender/prospectos/estados');
    return response.data;
  } catch (error) {
    console.error('Error al obtener estados:', error);
    throw error;
  }
}

// ✅ PROPUESTA DE CORRECCIÓN
async obtenerEstados(campaniaId = null) {
  try {
    const params = campaniaId ? { campania_id: campaniaId } : {};
    const response = await apiService.get('/sender/prospectos/estados', { params });
    return response.data;
  } catch (error) {
    console.error('Error al obtener estados:', error);
    throw error;
  }
}
```

---

### CORRECCIÓN 5: Frontend - Actualizar carga de estados en componente
**Archivo**: `frontend/src/components/destinatarios/SelectorProspectosPage.jsx`

```javascript
// ❌ ACTUAL (LÍNEA 48-52)
const [campanasData, areasData, rubrosData, estadosData] = await Promise.all([
  campanasService.obtenerCampanas(),
  prospectosService.obtenerAreas(),
  prospectosService.obtenerRubros(),
  prospectosService.obtenerEstados()  // Sin campania_id
]);

// ✅ PROPUESTA DE CORRECCIÓN
const [campanasData, areasData, rubrosData] = await Promise.all([
  campanasService.obtenerCampanas(),
  prospectosService.obtenerAreas(),
  prospectosService.obtenerRubros()
  // Estados se cargan después de seleccionar campaña
]);

// Agregar nuevo useEffect para cargar estados cuando cambie la campaña
useEffect(() => {
  if (campaniaSeleccionada) {
    cargarEstadosCampania();
  } else {
    setEstados([]);  // Limpiar estados si no hay campaña
  }
}, [campaniaSeleccionada]);

const cargarEstadosCampania = async () => {
  try {
    const estadosData = await prospectosService.obtenerEstados(campaniaSeleccionada);
    const estadosArray = Array.isArray(estadosData?.estados) ? estadosData.estados : [];
    setEstados(estadosArray);
  } catch (error) {
    console.error('Error al cargar estados:', error);
    setEstados([]);
  }
};
```

---

## 🧪 CASOS DE PRUEBA RECOMENDADOS

### Test 1: Sin campaña seleccionada
```javascript
// GIVEN
campaniaSeleccionada = null

// WHEN
Usuario accede a "Seleccionar Prospectos"

// THEN
- No se muestra listado de prospectos
- Filtro de "Estado" está deshabilitado o vacío
- Mensaje: "Selecciona una campaña"
```

### Test 2: Con campaña seleccionada
```javascript
// GIVEN
campaniaSeleccionada = 5
Campaña 5 tiene:
  - Prospecto A: estado "enviado"
  - Prospecto B: estado "pendiente"
  - Prospecto C: sin envío (disponible)

// WHEN
Usuario filtra por estado = "enviado"

// THEN
- Solo muestra Prospecto A
- Estado correcto: "enviado"
- No muestra estados de otras campañas
```

### Test 3: Cambio de campaña
```javascript
// GIVEN
campaniaSeleccionada = 5
Prospectos cargados con estados de campaña 5

// WHEN
Usuario cambia a campaniaSeleccionada = 8

// THEN
- Prospectos se recargan
- Estados corresponden a campaña 8
- Filtro de estados se actualiza con estados de campaña 8
```

---

## 📝 CONCLUSIÓN

El problema es una **violación arquitectónica en tres capas**:

1. **Backend**: Query SQL retorna estados globales sin validar `campania_id`
2. **Backend**: Endpoint de estados no filtra por campaña
3. **Frontend**: Service no envía `campania_id` al backend

La corrección requiere:
- ✅ Modificar query SQL para retornar NULL cuando no hay campaña
- ✅ Filtrar estados por campaña en endpoint dedicado
- ✅ Asegurar que `campania_id` se envíe desde frontend
- ✅ Cargar estados dinámicamente según campaña seleccionada

**Complejidad estimada**: MEDIA (2-3 horas)  
**Riesgo de regresión**: BAJO (cambios aislados y testeables)  

---

## 📌 PRÓXIMOS PASOS

1. ✅ Revisar y aprobar diagnóstico
2. Implementar correcciones en orden:
   - a) Frontend (prospectos.js) - más simple y seguro
   - b) Backend (query SQL) - más complejo
   - c) Frontend (componente) - actualizar carga de estados
3. Escribir tests de integración
4. Probar en entorno de desarrollo
5. Desplegar a producción con monitoreo

---

**Diagnóstico realizado por**: GitHub Copilot  
**Herramientas utilizadas**: Análisis estático de código, grep_search, file_search, read_file
