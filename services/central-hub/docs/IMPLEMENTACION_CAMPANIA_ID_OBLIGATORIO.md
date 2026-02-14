# IMPLEMENTACIÓN – campania_id OBLIGATORIO

**Fecha**: 11 de febrero de 2026  
**Basado en**: DIAGNOSTICO_ESTADO_PROSPECTOS.md  
**Estado**: ✅ IMPLEMENTADO  

---

## 📋 RESUMEN

Se implementó la regla de negocio fundamental:

> **"El estado pertenece a la relación Prospecto ↔ Campaña. No se deben devolver prospectos si no hay campania_id."**

---

## ✅ CAMBIOS IMPLEMENTADOS

### 1️⃣ BACKEND - Validación Obligatoria

**Archivo**: [src/modules/sender/controllers/prospectosController.js](../src/modules/sender/controllers/prospectosController.js#L17-L22)

```javascript
// ✅ VALIDACIÓN: campania_id es obligatorio
if (!campania_id) {
  return res.status(400).json({
    success: false,
    error: 'campania_id es obligatorio'
  });
}
```

**Comportamiento**:
- Si `campania_id` no existe → retorna HTTP 400
- Mensaje de error claro para el frontend
- Previene consultas sin contexto de campaña

---

### 2️⃣ BACKEND - JOIN Simplificado

**Archivo**: [src/modules/sender/controllers/prospectosController.js](../src/modules/sender/controllers/prospectosController.js#L55)

**ANTES**:
```javascript
LEFT JOIN ll_envios_whatsapp env ON env.lugar_id = s.rowid${campania_id ? ' AND env.campania_id = ?' : ''}
```

**DESPUÉS**:
```javascript
LEFT JOIN ll_envios_whatsapp env ON env.lugar_id = s.rowid AND env.campania_id = ?
```

**Mejoras**:
- ✅ Eliminada lógica condicional dinámica
- ✅ JOIN siempre filtra por `campania_id`
- ✅ Código más limpio y mantenible
- ✅ Sin hacks como `AND 1=0`

---

### 3️⃣ BACKEND - Orden de Parámetros Corregido

**Archivo**: [src/modules/sender/controllers/prospectosController.js](../src/modules/sender/controllers/prospectosController.js#L62)

**ANTES**:
```javascript
const params = campania_id ? [campania_id, clienteId] : [clienteId];
```

**DESPUÉS**:
```javascript
// ✅ Parámetros en orden correcto: clienteId (INNER JOIN), campania_id (LEFT JOIN)
const params = [clienteId, campania_id];
```

**Query con parámetros**:
```sql
INNER JOIN ll_lugares_clientes lc ON lc.societe_id = s.rowid AND lc.cliente_id = ?  -- params[0] = clienteId
LEFT JOIN ll_envios_whatsapp env ON env.lugar_id = s.rowid AND env.campania_id = ?   -- params[1] = campania_id
```

---

### 4️⃣ BACKEND - Filtrado de Estados por Campaña

**Archivo**: [src/modules/sender/controllers/prospectosController.js](../src/modules/sender/controllers/prospectosController.js#L195-L217)

**ANTES**:
```javascript
async obtenerEstados(req, res) {
  const [rows] = await db.execute(`
    SELECT DISTINCT ll_envios_whatsapp.estado as nombre
    FROM ll_envios_whatsapp
    WHERE ll_envios_whatsapp.estado IS NOT NULL 
      AND ll_envios_whatsapp.estado != ''
    ORDER BY ll_envios_whatsapp.estado ASC
  `);
```

**DESPUÉS**:
```javascript
async obtenerEstados(req, res) {
  const { campania_id } = req.query;
  
  let sql = `
    SELECT DISTINCT ll_envios_whatsapp.estado as nombre
    FROM ll_envios_whatsapp
    WHERE ll_envios_whatsapp.estado IS NOT NULL 
      AND ll_envios_whatsapp.estado != ''
  `;
  
  const params = [];
  
  // ✅ Filtrar por campaña específica si se proporciona
  if (campania_id) {
    sql += ` AND ll_envios_whatsapp.campania_id = ?`;
    params.push(campania_id);
  }
  
  sql += ` ORDER BY ll_envios_whatsapp.estado ASC`;
  
  const [rows] = await db.execute(sql, params);
```

**Mejora**:
- Estados filtrados por campaña específica
- Evita mostrar estados irrelevantes de otras campañas

---

### 5️⃣ FRONTEND - Service Envía campania_id

**Archivo**: [frontend/src/services/prospectos.js](../frontend/src/services/prospectos.js#L7)

**ANTES**:
```javascript
async filtrarProspectos(filtros = {}) {
  const queryParams = new URLSearchParams();
  
  if (filtros.area) queryParams.append('area', filtros.area);
  if (filtros.rubro) queryParams.append('rubro', filtros.rubro);
  // ... ❌ NO incluía campania_id
```

**DESPUÉS**:
```javascript
async filtrarProspectos(filtros = {}) {
  const queryParams = new URLSearchParams();
  
  // ✅ CRÍTICO: Incluir campania_id (obligatorio)
  if (filtros.campania_id) queryParams.append('campania_id', filtros.campania_id);
  
  if (filtros.area) queryParams.append('area', filtros.area);
  if (filtros.rubro) queryParams.append('rubro', filtros.rubro);
```

---

### 6️⃣ FRONTEND - obtenerEstados con campaniaId

**Archivo**: [frontend/src/services/prospectos.js](../frontend/src/services/prospectos.js#L44-L52)

**ANTES**:
```javascript
async obtenerEstados() {
  const response = await apiService.get('/sender/prospectos/estados');
  return response.data;
}
```

**DESPUÉS**:
```javascript
async obtenerEstados(campaniaId = null) {
  const params = campaniaId ? { campania_id: campaniaId } : {};
  const response = await apiService.get('/sender/prospectos/estados', { params });
  return response.data;
}
```

---

### 7️⃣ FRONTEND - Carga Dinámica de Estados

**Archivo**: [frontend/src/components/destinatarios/SelectorProspectosPage.jsx](../frontend/src/components/destinatarios/SelectorProspectosPage.jsx#L48-L110)

**CAMBIOS**:

**a) Eliminado de cargarDatosIniciales**:
```javascript
// ANTES: Cargaba estados sin campaña
const [campanasData, areasData, rubrosData, estadosData] = await Promise.all([...]);

// DESPUÉS: No carga estados inicialmente
const [campanasData, areasData, rubrosData] = await Promise.all([
  campanasService.obtenerCampanas(),
  prospectosService.obtenerAreas(),
  prospectosService.obtenerRubros()
  // ✅ Estados se cargan después de seleccionar campaña
]);
```

**b) Nuevo useEffect para cargar estados**:
```javascript
// ✅ Cargar estados dinámicamente cuando cambie la campaña
useEffect(() => {
  if (campaniaSeleccionada) {
    cargarEstadosCampania();
  } else {
    setEstados([]);  // Limpiar estados si no hay campaña
  }
}, [campaniaSeleccionada]);
```

**c) Nueva función cargarEstadosCampania**:
```javascript
const cargarEstadosCampania = async () => {
  try {
    const estadosData = await prospectosService.obtenerEstados(campaniaSeleccionada);
    const estadosArray = Array.isArray(estadosData?.estados) ? estadosData.estados : [];
    console.log('📊 Estados de campaña cargados:', estadosArray);
    setEstados(estadosArray);
  } catch (error) {
    console.error('❌ Error al cargar estados de campaña:', error);
    setEstados([]);
  }
};
```

---

## 🔄 FLUJO CORREGIDO

### Escenario 1: Usuario selecciona campaña

```
1. Usuario selecciona Campaña ID: 5
   ↓
2. useEffect detecta cambio en campaniaSeleccionada
   ↓
3. Ejecuta cargarEstadosCampania(5)
   ↓
4. GET /sender/prospectos/estados?campania_id=5
   ↓
5. Backend retorna estados SOLO de campaña 5
   ↓
6. Dropdown de estados se actualiza
   ↓
7. Ejecuta cargarProspectos()
   ↓
8. GET /sender/prospectos/filtrar?campania_id=5&...
   ↓
9. Backend valida campania_id presente ✅
   ↓
10. JOIN filtra por campania_id = 5
   ↓
11. Retorna prospectos con estados correctos
```

### Escenario 2: Usuario NO selecciona campaña

```
1. campaniaSeleccionada = ''
   ↓
2. useEffect limpia estados: setEstados([])
   ↓
3. NO ejecuta cargarProspectos() (guard if)
   ↓
4. Tabla de prospectos vacía
   ↓
5. Dropdown de estados vacío
```

### Escenario 3: Usuario intenta filtrar sin campaña (edge case)

```
1. Petición: GET /sender/prospectos/filtrar?estado=enviado
   ↓
2. Backend detecta: !campania_id
   ↓
3. Retorna HTTP 400:
   {
     "success": false,
     "error": "campania_id es obligatorio"
   }
   ↓
4. Frontend muestra error
```

---

## 🧪 PRUEBAS RECOMENDADAS

### Test 1: Sin campaña seleccionada
```bash
# Request
GET /sender/prospectos/filtrar?estado=pendiente

# Expected Response
HTTP 400 Bad Request
{
  "success": false,
  "error": "campania_id es obligatorio"
}
```

### Test 2: Con campaña seleccionada
```bash
# Request
GET /sender/prospectos/filtrar?campania_id=5&estado=pendiente

# Expected Response
HTTP 200 OK
{
  "success": true,
  "prospectos": [
    {
      "id": 123,
      "nombre": "Prospecto A",
      "estado": "pendiente",  # Estado de campaña 5
      ...
    }
  ],
  "total": 1
}
```

### Test 3: Estados filtrados por campaña
```bash
# Request
GET /sender/prospectos/estados?campania_id=5

# Expected Response
HTTP 200 OK
{
  "success": true,
  "estados": [
    { "id": "sin_envio", "nombre": "sin_envio" },
    { "id": "pendiente", "nombre": "pendiente" },
    { "id": "enviado", "nombre": "enviado" }
  ]
}
```

### Test 4: Cambio de campaña
```javascript
// Setup
campaniaSeleccionada = 5
prospectos cargados con estados de campaña 5

// Action
setCampaniaSeleccionada(8)

// Assertions
1. cargarEstadosCampania(8) se ejecuta
2. Estados se actualizan con estados de campaña 8
3. cargarProspectos() se ejecuta con campania_id=8
4. Prospectos muestran estados de campaña 8
```

---

## 📊 IMPACTO

### Archivos Modificados
| Archivo | Líneas Modificadas | Tipo de Cambio |
|---------|-------------------|----------------|
| prospectosController.js | 17-22, 55, 62, 97-103, 195-217 | Backend |
| prospectos.js | 7, 44-52 | Frontend Service |
| SelectorProspectosPage.jsx | 48-110 | Frontend Component |

### Líneas de código
- **Agregadas**: ~45 líneas
- **Modificadas**: ~20 líneas
- **Eliminadas**: ~10 líneas
- **Neto**: +35 líneas

### Complejidad ciclomática
- **Reducida**: Eliminación de lógica condicional dinámica
- **Claridad**: Flujo más lineal y predecible

---

## ✅ CHECKLIST DE VERIFICACIÓN

- [x] Backend valida `campania_id` obligatorio
- [x] Backend retorna 400 si no hay `campania_id`
- [x] JOIN simplificado sin lógica condicional
- [x] Orden de parámetros corregido
- [x] Estados filtrados por campaña
- [x] Frontend envía `campania_id` en queryParams
- [x] Frontend carga estados dinámicamente según campaña
- [x] Frontend limpia estados cuando no hay campaña
- [ ] Tests unitarios actualizado (pendiente)
- [ ] Tests de integración agregados (pendiente)
- [ ] Documentación de API actualizada (pendiente)

---

## 🚀 PRÓXIMOS PASOS

1. **Testing**:
   - Escribir tests unitarios para validación de `campania_id`
   - Tests de integración para flujo completo
   - Tests E2E con Playwright

2. **Monitoreo**:
   - Verificar logs de errores 400 (campania_id faltante)
   - Monitorear performance de queries
   - Verificar que no hay mezcla de estados

3. **Documentación**:
   - Actualizar docs de API
   - Agregar ejemplos de uso
   - Documentar códigos de error

---

**Implementado por**: GitHub Copilot  
**Revisado por**: [Pendiente]  
**Aprobado por**: [Pendiente]
