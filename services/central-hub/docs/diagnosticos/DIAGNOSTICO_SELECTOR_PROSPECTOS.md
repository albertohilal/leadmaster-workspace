# 🔍 DIAGNÓSTICO: Selector de Prospectos
**Fecha:** 2026-02-12  
**Ruta afectada:** `/prospectos`

---

## ❌ PROBLEMAS REPORTADOS

1. **No carga los registros de prospectos**
2. **Siguen apareciendo filtros obsoletos** (Área, Rubro, Estado, Tipo de cliente, Dirección contiene)

---

## 🔎 ANÁLISIS TÉCNICO

### 1. COMPONENTES DUPLICADOS DETECTADOS

Existen **DOS versiones** de `SelectorProspectosPage.jsx`:

#### ✅ **Componente ACTIVO** (el que debería estar en uso)
- **Ubicación:** `/root/leadmaster-workspace/services/central-hub/frontend/src/components/destinatarios/SelectorProspectosPage.jsx`
- **Importado en App.jsx:** SÍ (línea 15)
- **Características:**
  - ✅ Versión simplificada SIN filtros de Área, Rubro, Tipo cliente, Dirección
  - ✅ Solo selector de campaña + tabla simple
  - ✅ Usa `prospectosService.filtrarProspectos()` correctamente
  - ✅ Accede a `response?.data` correctamente
  - ✅ Usa campos correctos: `prospecto_id`, `estado_campania`, `telefono_wapp`

#### ⚠️ **Componente OBSOLETO** (archivo viejo, NO en uso)
- **Ubicación:** `/root/leadmaster-workspace/services/central-hub/frontend/src/components/leads/SelectorProspectosPage.jsx`
- **Importado en App.jsx:** NO
- **Características:**
  - ❌ Archivo legacy sin actualizar
  - ❌ Usa API antigua: `leadsAPI.getProspectos()`
  - ⚠️ Debe ser eliminado para evitar confusión

---

### 2. BACKEND - prospectosController.js

#### ✅ **Endpoint principal corregido:** `/api/sender/prospectos/filtrar`

**Query SQL CORRECTA:**
```sql
SELECT
  s.rowid AS prospecto_id,
  s.nom AS nombre,
  COALESCE(env.estado, 'sin_envio') AS estado_campania,
  s.phone_mobile AS telefono_wapp,
  s.address AS direccion,
  env.id AS envio_id,
  env.fecha_envio
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
ORDER BY s.nom ASC
```

**Respuesta del backend:**
```json
{
  "success": true,
  "data": [ /* array de prospectos */ ],
  "total": 123
}
```

#### ✅ **Correcciones aplicadas previamente:**
1. **Línea 145:** `ORDER BY estado ASC` → `ORDER BY env.estado ASC` (ambigüedad de columna)
2. **Líneas 127-135:** Agregado JOIN con `ll_campanias_whatsapp` para `obtenerEstados()`
3. **Líneas 180-186:** Eliminado `AND cliente_id = ?` de `obtenerEstadisticas()`

---

### 3. FLUJO DE DATOS ACTUAL

```
Frontend (destinatarios/SelectorProspectosPage.jsx)
  ↓
prospectosService.filtrarProspectos({ campania_id: X })
  ↓
GET /api/sender/prospectos/filtrar?campania_id=X
  ↓
prospectosController.filtrarProspectos()
  ↓
response.data [ { prospecto_id, nombre, estado_campania, telefono_wapp, direccion } ]
  ↓
setProspectos(response.data)
```

---

## 🔍 HIPÓTESIS SOBRE EL PROBLEMA ACTUAL

### **Problema 1: No carga registros**

**Posibles causas:**

1. **Caché del navegador:**
   - El navegador está sirviendo versión antigua del JavaScript
   - Solución: Hard refresh (Ctrl+Shift+R) o limpiar caché

2. **No hay campaña seleccionada:**
   - El componente solo carga prospectos DESPUÉS de seleccionar campaña
   - Si no hay campañas o no se selecciona, no consulta backend
   
3. **Error silencioso en frontend:**
   - Revisar Console del navegador (F12)
   - Buscar errores de red o JavaScript

4. **Backend no recibe request:**
   - No hay logs de `🔍 [prospectos] Query con campania_id:` en últimos minutos
   - Significa que el endpoint NO está siendo llamado

### **Problema 2: Siguen apareciendo filtros de Área/Rubro**

**Causa identificada:** 
- El usuario está viendo **JS compilado en caché** del navegador
- El componente activo (destinatarios/) NO tiene esos filtros
- El componente obsoleto (leads/) SÍ tiene filtros pero NO está en uso

**Evidencia:**
```jsx
// frontend/src/components/destinatarios/SelectorProspectosPage.jsx
// NO TIENE filtros de Área, Rubro, Tipo cliente, Dirección
// Solo tiene: selector de campaña + tabla simple
```

---

## 📊 LOGS DEL BACKEND (últimos 50 minutos)

**Actividad detectada:**
- ✅ Scheduler de programaciones funcionando
- ❌ NO hay logs de consultas a `/prospectos/filtrar`
- ❌ NO hay logs de `🔍 [prospectos] Query con campania_id:`

**Conclusión:** El endpoint NO está siendo invocado desde el frontend.

---

## ✅ VALIDACIONES REALIZADAS

| Componente | Estado | Observaciones |
|------------|--------|---------------|
| **prospectosController.js** | ✅ CORRECTO | Query SQL válida, sin errores de columnas |
| **destinatarios/SelectorProspectosPage.jsx** | ✅ CORRECTO | Componente simplificado activo en App.jsx |
| **prospectosService.js** | ✅ CORRECTO | Llama correctamente `/sender/prospectos/filtrar` |
| **Backend logs** | ⚠️ SIN ACTIVIDAD | No hay requests recientes al endpoint |
| **Build frontend** | ⚠️ NO EXISTE | No hay carpeta build/ (modo desarrollo) |

---

## 🔧 SOLUCIONES RECOMENDADAS

### **Para el usuario (navegador):**

```bash
# 1. Hard refresh en el navegador
Ctrl + Shift + R (Chrome/Firefox en Linux)
Ctrl + F5 (alternativa)

# 2. Limpiar caché del navegador
- Abrir DevTools (F12)
- Click derecho en botón Reload
- Seleccionar "Empty Cache and Hard Reload"

# 3. Probar en ventana incógnito
- Ctrl + Shift + N (Chrome)
- Ctrl + Shift + P (Firefox)
```

### **Para el desarrollador (servidor):**

```bash
# 1. Verificar que el servidor de desarrollo esté corriendo
cd /root/leadmaster-workspace/services/central-hub/frontend
npm run dev  # o el comando que corresponda

# 2. Si está usando build de producción, reconstruir
npm run build

# 3. Verificar que Nginx esté sirviendo archivos correctos
nginx -t
systemctl reload nginx
```

### **Eliminación del archivo obsoleto:**

```bash
# OPCIONAL: Eliminar componente obsoleto para evitar confusión
rm /root/leadmaster-workspace/services/central-hub/frontend/src/components/leads/SelectorProspectosPage.jsx
```

---

## 🧪 PRUEBAS DE VALIDACIÓN

### **1. Verificar que el endpoint backend funciona:**

```bash
# Test desde consola del servidor
curl -X GET "http://localhost:3001/api/sender/prospectos/filtrar?campania_id=4" \
  -H "Authorization: Bearer TOKEN_AQUI"
```

**Respuesta esperada:**
```json
{
  "success": true,
  "data": [
    {
      "prospecto_id": 123,
      "nombre": "Empresa XYZ",
      "estado_campania": "sin_envio",
      "telefono_wapp": "+541112345678",
      "direccion": "Calle 123",
      "envio_id": null,
      "fecha_envio": null
    }
  ],
  "total": 1
}
```

### **2. Verificar en navegador (DevTools):**

1. Abrir `/prospectos`
2. Abrir DevTools (F12) → Tab Network
3. Seleccionar una campaña
4. Buscar request a `filtrar?campania_id=X`
5. Verificar:
   - Status: 200 OK
   - Response tiene `data` con array de prospectos

---

## 📝 RESUMEN EJECUTIVO

| Aspecto | Estado | Acción Requerida |
|---------|--------|------------------|
| Backend | ✅ FUNCIONANDO | Ninguna |
| Componente activo | ✅ CORRECTO | Ninguna |
| Componente obsoleto | ⚠️ EXISTE | Eliminar archivo legacy |
| Caché navegador | ❌ PROBLEMA | Hard refresh (Ctrl+Shift+R) |
| Logs backend | ⚠️ SIN REQUESTS | Verificar que frontend llame al endpoint |

---

## 🎯 PRÓXIMOS PASOS

1. **INMEDIATO:** Usuario debe hacer hard refresh en navegador (Ctrl+Shift+R)
2. **VERIFICAR:** Abrir DevTools y ver si aparece request a `/prospectos/filtrar`
3. **SI NO FUNCIONA:** Revisar Console del navegador en busca de errores JavaScript
4. **LIMPIEZA:** Eliminar archivo obsoleto `leads/SelectorProspectosPage.jsx`

---

**Archivo generado:** `/root/leadmaster-workspace/services/central-hub/DIAGNOSTICO_SELECTOR_PROSPECTOS.md`
