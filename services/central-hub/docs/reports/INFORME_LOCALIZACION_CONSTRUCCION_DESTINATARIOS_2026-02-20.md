# 📍 INFORME: Localización de Construcción de Lista de Destinatarios para Campañas WhatsApp

**Fecha:** 2026-02-20  
**Módulo:** sender  
**Objetivo:** Localizar punto exacto donde se construye la lista base de prospectos para envío  
**Estado:** ✅ ANALIZADO

---

## 🎯 PUNTO DE INSERCIÓN EN BASE DE DATOS

### **Archivo:** `src/modules/sender/controllers/destinatariosController.js`

### **Función:** `agregarDestinatarios()`
### **Líneas:** 96-268

### **Endpoint:** `POST /api/sender/destinatarios/campania/:campaniaId/agregar`

---

## 📊 CONSULTA SQL DE INSERCIÓN

**Ubicación:** `src/modules/sender/controllers/destinatariosController.js` líneas 213-220

```javascript
const [result] = await db.execute(`
  INSERT INTO ll_envios_whatsapp 
  (campania_id, telefono_wapp, nombre_destino, mensaje_final, estado, lugar_id)
  VALUES (?, ?, ?, ?, 'pendiente', ?)
`, [
  campaniaId, 
  telefonoLimpio, 
  dest.nombre_destino || null, 
  mensajeFinal, 
  dest.lugar_id || null
]);
```

**Campos insertados:**
- `campania_id`: ID de la campaña
- `telefono_wapp`: Número de teléfono normalizado
- `nombre_destino`: Nombre del prospecto
- `mensaje_final`: Mensaje de la campaña
- `estado`: Siempre `'pendiente'`
- `lugar_id`: ID de sucursal (rowid de llxbx_societe)

---

## ✅ DEDUPLICACIÓN IMPLEMENTADA

**Ubicación:** `src/modules/sender/controllers/destinatariosController.js` líneas 205-211

```javascript
// Verificar si ya existe
const [existente] = await db.execute(
  'SELECT id FROM ll_envios_whatsapp WHERE campania_id = ? AND telefono_wapp = ?',
  [campaniaId, telefonoLimpio]
);

if (existente.length > 0) {
  console.log(`⚠️  Duplicado: ${telefonoLimpio}`);
  duplicados.push({
    telefono: telefonoLimpio,
    nombre: dest.nombre_destino || null,
    razon: 'Ya existe en la campaña'
  });
}
```

**✅ CONFIRMACIÓN:**
- **Deduplicación activa:** Verifica por `telefono_wapp` dentro de misma campaña
- **Alcance:** Solo por campaña específica (`campania_id + telefono_wapp`)
- **NO deduplica entre campañas diferentes**
- **NO deduplica por `lugar_id` (sucursal)**

---

## 🔍 ORIGEN DE DATOS

### **Consulta Base de Prospectos**

**Archivo:** `src/modules/sender/controllers/prospectosController.js`  
**Función:** `filtrarProspectos()`  
**Endpoint:** `GET /api/sender/prospectos/filtrar`  
**Líneas:** 28-49

```sql
SELECT
  s.rowid AS prospecto_id,              -- ← ID de sucursal (NO único por teléfono)
  s.nom AS nombre,
  env.estado AS estado_campania,
  s.phone_mobile AS telefono_wapp,      -- ← TELÉFONO (puede repetirse en varias sucursales)
  s.address AS direccion,
  env.id AS envio_id,
  env.fecha_envio
FROM ll_campanias_whatsapp c
JOIN ll_lugares_clientes lc
  ON lc.cliente_id = c.cliente_id
JOIN llxbx_societe s                    -- ← TABLA BASE (UN REGISTRO POR SUCURSAL)
  ON s.rowid = lc.societe_id
LEFT JOIN ll_envios_whatsapp env
  ON env.campania_id = c.id
 AND env.lugar_id = s.rowid            -- ← JOIN POR lugar_id (sucursal)
WHERE c.id = ?
  AND s.entity = 1
ORDER BY s.nom ASC
```

**Características:**
- ❌ NO agrupa por `phone_mobile`
- ✅ Devuelve 1 fila por sucursal (`rowid`)
- ✅ Puede devolver múltiples filas con el mismo teléfono
- ✅ LEFT JOIN con `ll_envios_whatsapp` por `lugar_id`

---

### **Frontend - Construcción del Array de Destinatarios**

**Archivo:** `frontend/src/components/leads/AgregarProspectosACampaniaPage.jsx`  
**Líneas:** 172-180

```jsx
const destinatarios = selectedProspectos.map(prospecto => ({
  nombre: prospecto.nombre,
  telefono: prospecto.telefono_wapp,    // ← Viene desde llxbx_societe.phone_mobile
  lugar_id: prospecto.prospecto_id      // ← Viene desde llxbx_societe.rowid
}));

const response = await destinatariosService.agregarDestinatarios(selectedCampaign, destinatarios);
```

**Frontend envía:**
- Array de destinatarios sin deduplicar
- Si usuario seleccionó 3 sucursales con mismo teléfono → envía 3 registros
- Backend rechaza duplicados después del primero

---

## 🚨 PROBLEMA IDENTIFICADO

### **Arquitectura Actual:**

```
llxbx_societe (1 registro por sucursal)
    ↓
  rowid: 123 (sucursal A) → phone_mobile: +5491112345678
  rowid: 456 (sucursal B) → phone_mobile: +5491112345678
  rowid: 789 (sucursal C) → phone_mobile: +5491112345678
    ↓
Frontend carga 3 filas en grilla "Seleccionar Prospectos"
    ↓
Usuario marca las 3 casillas (cree que son 3 empresas diferentes)
    ↓
Frontend envía array con 3 elementos:
  [
    { telefono: "+5491112345678", lugar_id: 123 },
    { telefono: "+5491112345678", lugar_id: 456 },
    { telefono: "+5491112345678", lugar_id: 789 }
  ]
    ↓
Backend procesa SECUENCIALMENTE:
    ↓
  1. Verifica duplicado → NO existe → INSERT lugar_id=123 ✅
  2. Verifica duplicado → YA EXISTE → Rechaza ⚠️
  3. Verifica duplicado → YA EXISTE → Rechaza ⚠️
    ↓
Resultado: 
  - 1 envío creado con lugar_id=123
  - 2 registros reportados como "duplicados"
  - WhatsApp solo se enviará UNA VEZ al teléfono
```

### **Tabla Comparativa:**

| Aspecto | Estado Actual | Problema |
|---------|---------------|----------|
| **Deduplicación por teléfono** | ✅ Implementada | Solo dentro de misma campaña |
| **Tabla origen** | `llxbx_societe` (1 por sucursal) | Usuario puede seleccionar múltiples sucursales del mismo número |
| **JOIN por** | `lugar_id` (sucursal) | No agrupa por teléfono en la query base |
| **Frontend muestra** | Todas las sucursales por separado | Usuario no ve que es el mismo teléfono |
| **lugar_id guardado** | Primera sucursal que pasó la validación | Puede no ser la sucursal principal |
| **Envíos duplicados** | ❌ NO ocurren | Backend previene duplicados |
| **UX confusa** | ⚠️ SÍ | Usuario selecciona 3, pero solo se agrega 1 |

---

## 📋 FLUJO COMPLETO DE DATOS

### **1. Carga de Prospectos (Frontend)**

```
GET /api/sender/prospectos/filtrar?campania_id=X
    ↓
prospectosController.filtrarProspectos() (líneas 28-49)
    ↓
SELECT desde llxbx_societe 
  JOIN ll_lugares_clientes
  LEFT JOIN ll_envios_whatsapp
    ↓
Devuelve JSON con TODAS las sucursales:
{
  "success": true,
  "data": [
    { "prospecto_id": 123, "nombre": "Empresa X", "telefono_wapp": "+5491112345678", "estado_campania": null },
    { "prospecto_id": 456, "nombre": "Empresa X", "telefono_wapp": "+5491112345678", "estado_campania": null },
    { "prospecto_id": 789, "nombre": "Empresa X", "telefono_wapp": "+5491112345678", "estado_campania": null }
  ]
}
```

### **2. Selección de Usuario (Frontend)**

```
Usuario marca 3 casillas en grilla
    ↓
selectedProspectos = [
  { prospecto_id: 123, nombre: "Empresa X", telefono_wapp: "+5491112345678" },
  { prospecto_id: 456, nombre: "Empresa X", telefono_wapp: "+5491112345678" },
  { prospecto_id: 789, nombre: "Empresa X", telefono_wapp: "+5491112345678" }
]
```

### **3. Envío al Backend (Frontend)**

```jsx
// AgregarProspectosACampaniaPage.jsx líneas 172-180
const destinatarios = selectedProspectos.map(prospecto => ({
  nombre: prospecto.nombre,
  telefono: prospecto.telefono_wapp,
  lugar_id: prospecto.prospecto_id
}));

await destinatariosService.agregarDestinatarios(selectedCampaign, destinatarios);
```

```
POST /api/sender/destinatarios/campania/4/agregar
Body:
{
  "destinatarios": [
    { "nombre": "Empresa X", "telefono": "+5491112345678", "lugar_id": 123 },
    { "nombre": "Empresa X", "telefono": "+5491112345678", "lugar_id": 456 },
    { "nombre": "Empresa X", "telefono": "+5491112345678", "lugar_id": 789 }
  ]
}
```

### **4. Procesamiento Backend**

```javascript
// destinatariosController.agregarDestinatarios() líneas 198-238
for (let i = 0; i < destinatarios.length; i++) {
  const dest = destinatarios[i];
  const telefonoLimpio = dest.telefono_wapp.trim();
  
  // Verificar duplicado
  const [existente] = await db.execute(
    'SELECT id FROM ll_envios_whatsapp WHERE campania_id = ? AND telefono_wapp = ?',
    [campaniaId, telefonoLimpio]
  );

  if (existente.length > 0) {
    // DUPLICADO → No insertar
    duplicados.push({ telefono: telefonoLimpio, razon: 'Ya existe en la campaña' });
  } else {
    // INSERTAR NUEVO
    const [result] = await db.execute(`
      INSERT INTO ll_envios_whatsapp 
      (campania_id, telefono_wapp, nombre_destino, mensaje_final, estado, lugar_id)
      VALUES (?, ?, ?, ?, 'pendiente', ?)
    `, [campaniaId, telefonoLimpio, dest.nombre_destino, mensajeFinal, dest.lugar_id]);
    
    agregados.push({ id: result.insertId, telefono: telefonoLimpio });
  }
}
```

### **5. Resultado**

```json
{
  "success": true,
  "message": "Se procesaron 3 destinatarios",
  "data": {
    "agregados": 1,
    "duplicados": 2,
    "errores": 0,
    "detalles": {
      "agregados": [
        { "id": 5001, "telefono": "+5491112345678", "nombre": "Empresa X" }
      ],
      "duplicados": [
        { "telefono": "+5491112345678", "razon": "Ya existe en la campaña" },
        { "telefono": "+5491112345678", "razon": "Ya existe en la campaña" }
      ]
    }
  }
}
```

---

## 🔧 SOLUCIONES PROPUESTAS

### **Opción 1: Deduplicar en Frontend (Recomendado)**

**Ventajas:**
- ✅ Cambio mínimo
- ✅ Usuario ve solo números únicos
- ✅ No afecta otros endpoints
- ✅ Mejor UX

**Desventajas:**
- ⚠️ Pierde información de múltiples sucursales

**Archivo:** `frontend/src/components/leads/AgregarProspectosACampaniaPage.jsx`  
**Líneas:** 172-180

**Cambio propuesto:**

```jsx
const agregarSeleccionadosACampania = async () => {
  if (selectedProspectos.length === 0) {
    alert('Selecciona al menos un prospecto');
    return;
  }

  if (!selectedCampaign) {
    alert('Selecciona una campaña');
    return;
  }

  setAgregandoDestinatarios(true);
  try {
    // ✅ DEDUPLICAR POR TELÉFONO ANTES DE ENVIAR
    const telefonosUnicos = new Map();
    selectedProspectos.forEach(prospecto => {
      if (!telefonosUnicos.has(prospecto.telefono_wapp)) {
        telefonosUnicos.set(prospecto.telefono_wapp, prospecto);
      }
    });

    const destinatarios = Array.from(telefonosUnicos.values()).map(prospecto => ({
      nombre: prospecto.nombre,
      telefono: prospecto.telefono_wapp,
      lugar_id: prospecto.prospecto_id
    }));

    console.log(`📊 Prospectos seleccionados: ${selectedProspectos.length}`);
    console.log(`📊 Números únicos: ${destinatarios.length}`);

    const response = await destinatariosService.agregarDestinatarios(selectedCampaign, destinatarios);
    
    if (response.success) {
      alert(`✅ ${response.data.agregados} destinatarios agregados exitosamente a la campaña`);
      setSelectedProspectos([]);
      navigate('/dashboard');
    } else {
      alert('Error al agregar destinatarios: ' + response.message);
    }
  } catch (error) {
    console.error('Error agregando destinatarios:', error);
    alert('Error al agregar destinatarios');
  } finally {
    setAgregandoDestinatarios(false);
  }
};
```

---

### **Opción 2: Agrupar en Query Base (Backend)**

**Ventajas:**
- ✅ Solución en origen
- ✅ Frontend siempre recibe datos correctos
- ✅ Afecta todos los consumidores del endpoint

**Desventajas:**
- ⚠️ Cambio más complejo
- ⚠️ Puede afectar otros componentes
- ⚠️ Pierde detalle de sucursales

**Archivo:** `src/modules/sender/controllers/prospectosController.js`  
**Líneas:** 28-49

**Cambio propuesto:**

```javascript
const sql = `
  SELECT
    MIN(s.rowid) AS prospecto_id,       -- ← Primer rowid encontrado
    MAX(s.nom) AS nombre,               -- ← Primer nombre encontrado
    env.estado AS estado_campania,
    s.phone_mobile AS telefono_wapp,
    MIN(s.address) AS direccion,        -- ← Primer dirección encontrada
    env.id AS envio_id,
    env.fecha_envio,
    COUNT(DISTINCT s.rowid) AS total_sucursales  -- ← Cantidad de sucursales
  FROM ll_campanias_whatsapp c
  JOIN ll_lugares_clientes lc
    ON lc.cliente_id = c.cliente_id
  JOIN llxbx_societe s
    ON s.rowid = lc.societe_id
  LEFT JOIN ll_envios_whatsapp env
    ON env.campania_id = c.id
   AND env.lugar_id = s.rowid
  WHERE c.id = ?
    AND s.entity = 1
    AND s.phone_mobile IS NOT NULL
  GROUP BY s.phone_mobile, env.estado, env.id, env.fecha_envio  -- ← AGRUPAR POR TELÉFONO
  ORDER BY nombre ASC
`;
```

**Consideraciones:**
- `MIN(s.rowid)`: Usa la primera sucursal encontrada
- `MAX(s.nom)`: Puede no coincidir con la sucursal de `MIN(rowid)`
- `COUNT(DISTINCT s.rowid)`: Muestra cuántas sucursales tienen ese teléfono
- Puede romper lógica que asume 1 fila = 1 sucursal

---

### **Opción 3: Mostrar Indicador Visual en Frontend**

**Ventajas:**
- ✅ Usuario ve que son el mismo número
- ✅ No modifica lógica existente
- ✅ Transparencia total

**Desventajas:**
- ⚠️ Usuario sigue pudiendo seleccionar múltiples
- ⚠️ Solo informativo, no previene duplicados

**Archivo:** `frontend/src/components/leads/AgregarProspectosACampaniaPage.jsx`

**Cambio propuesto:**

```jsx
// Agregar columna "Sucursales" que muestre cuántas veces se repite el teléfono
<td className="px-6 py-4">
  {prospectos.filter(p => p.telefono_wapp === prospecto.telefono_wapp).length > 1 && (
    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
      ⚠️ {prospectos.filter(p => p.telefono_wapp === prospecto.telefono_wapp).length} sucursales
    </span>
  )}
</td>
```

---

## 📊 COMPARACIÓN DE SOLUCIONES

| Solución | Complejidad | Impacto | UX | Recomendación |
|----------|-------------|---------|-----|---------------|
| **Opción 1: Deduplicar en Frontend** | 🟢 Baja | 🟢 Bajo | 🟢 Mejor | ⭐⭐⭐⭐⭐ |
| **Opción 2: Agrupar en Query** | 🟡 Media | 🔴 Alto | 🟢 Mejor | ⭐⭐⭐ |
| **Opción 3: Indicador Visual** | 🟢 Baja | 🟢 Bajo | 🟡 Regular | ⭐⭐ |

---

## ✅ CONFIRMACIONES FINALES

| Pregunta | Respuesta |
|----------|-----------|
| **¿Dónde se crea la lista inicial?** | `prospectosController.filtrarProspectos()` líneas 28-49 |
| **¿Se deduplica actualmente?** | ✅ SÍ, por `telefono_wapp` en `destinatariosController.agregarDestinatarios()` líneas 205-211 |
| **¿Por qué puede haber duplicados?** | Frontend envía múltiples sucursales con mismo teléfono |
| **¿Se agrupa por teléfono en SELECT?** | ❌ NO, devuelve 1 fila por sucursal (rowid) |
| **¿Dónde está el INSERT?** | `destinatariosController.agregarDestinatarios()` líneas 213-220 |
| **¿Qué JOIN usa?** | `lugar_id` (sucursal/rowid), NO por teléfono |
| **¿Existe problema real de duplicados?** | ❌ NO, backend previene duplicados correctamente |
| **¿Hay problema de UX?** | ✅ SÍ, usuario selecciona 3 pero solo se agrega 1 |

---

## 📁 ARCHIVOS CLAVE

1. ✅ **Backend - Query base de prospectos:**  
   `src/modules/sender/controllers/prospectosController.js` (líneas 28-49)
   - Función: `filtrarProspectos()`
   - Endpoint: `GET /api/sender/prospectos/filtrar`

2. ✅ **Backend - INSERT de envíos:**  
   `src/modules/sender/controllers/destinatariosController.js` (líneas 213-220)
   - Función: `agregarDestinatarios()`
   - Endpoint: `POST /api/sender/destinatarios/campania/:id/agregar`

3. ✅ **Backend - Deduplicación:**  
   `src/modules/sender/controllers/destinatariosController.js` (líneas 205-211)
   - Query: `SELECT id WHERE campania_id=? AND telefono_wapp=?`

4. ✅ **Frontend - Construcción array de destinatarios:**  
   `frontend/src/components/leads/AgregarProspectosACampaniaPage.jsx` (líneas 172-180)
   - Función: `agregarSeleccionadosACampania()`

5. ✅ **Frontend - Servicio API:**  
   `frontend/src/services/destinatarios.js`
   - Método: `agregarDestinatarios(campaniaId, destinatarios)`

---

## 🎯 RECOMENDACIÓN FINAL

**Implementar Opción 1: Deduplicar en Frontend**

**Razón:**
- Cambio mínimo y seguro
- Mejor experiencia de usuario
- No afecta otros componentes
- Previene confusión del usuario

**Archivo a modificar:**
`frontend/src/components/leads/AgregarProspectosACampaniaPage.jsx` líneas 172-180

**Cambio:**
Agregar `Map` para deduplicar por `telefono_wapp` antes de enviar al backend.

**Impacto:**
- Usuario verá mensaje coherente: "3 seleccionados → 1 único número → 1 agregado"
- Backend seguirá validando duplicados (defensa en profundidad)
- No se rompe lógica existente

---

**Documento generado:** 2026-02-20  
**Autor:** Análisis Técnico - GitHub Copilot  
**Estado:** ✅ COMPLETO - LISTO PARA IMPLEMENTACIÓN
