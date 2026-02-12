# 🗄️ CORRECCIÓN: TABLAS REALES DEL SISTEMA

**Fecha:** 2026-02-11  
**Módulo:** Selector de Prospectos - LeadMaster Central Hub  
**Base de datos:** iunaorg_dyd

---

## ⚠️ CORRECCIONES IMPORTANTES

### ❌ Tablas que NO EXISTEN (documentadas incorrectamente):

1. **`ll_clientes`** - NO EXISTE
2. **`ll_campanias`** - NO EXISTE

### ✅ Tablas REALES del sistema:

1. **`ll_campanias_whatsapp`** (NO `ll_campanias`)
2. **`ll_usuarios`** (contiene `cliente_id` como campo numérico, sin tabla maestra)

---

## 📊 TABLAS REALES CONFIRMADAS POR BASE DE DATOS

### **Del dump SQL 2026-02-08:**

```sql
-- Tablas LeadMaster (prefijo ll_):
CREATE TABLE `ll_bot_respuestas`
CREATE TABLE `ll_busquedas`
CREATE TABLE `ll_busquedas_realizadas`
CREATE TABLE `ll_campanias_whatsapp`          ← ✅ CORRECTA (campañas)
CREATE TABLE `ll_cliente_google_tokens`
CREATE TABLE `ll_envios_whatsapp`            ← ✅ Historial de envíos
CREATE TABLE `ll_fuentes`
CREATE TABLE `ll_lugares`
CREATE TABLE `ll_lugares_clientes`           ← ✅ Vinculación prospecto-cliente
CREATE TABLE `ll_rubros`                      ← ✅ Catálogo de rubros
CREATE TABLE `ll_societe_extended`           ← ✅ Datos extendidos
CREATE TABLE `ll_usuarios`                    ← ✅ Autenticación
```

---

## 🔍 ESTRUCTURA CORREGIDA DE TABLAS CLAVE

### 1. **ll_campanias_whatsapp** (Tabla REAL de campañas)

```sql
CREATE TABLE `ll_campanias_whatsapp` (
  `id` int(11) NOT NULL,
  `nombre` varchar(255) NOT NULL,
  `mensaje` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `fecha_creacion` datetime DEFAULT current_timestamp(),
  `estado` enum('pendiente','en_progreso','finalizado') DEFAULT 'pendiente',
  `cliente_id` int(11) DEFAULT NULL    ← Vincula campaña con cliente
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
```

**Datos de ejemplo:**
```sql
INSERT INTO `ll_campanias_whatsapp` VALUES
(1, 'Primer Prueba', 'Hola {{nombre}}...', '2025-06-22 15:09:57', 'pendiente', 52),
(4, '1-Campaña de Prueba', 'Hola! Soy Haby...', '2025-11-28 15:44:54', 'pendiente', 51),
(46, 'Leads primer mensaje', 'Hola!...', '2025-12-23 16:32:55', 'pendiente', 51);
```

**Uso en el sistema:**
- Endpoint: `/api/sender/campanias` (NO `/api/sender/campanas`)
- Controlador: `campaignsController.js`
- Frontend: Dropdown "Campaña de destino"

---

### 2. **ll_usuarios** (Autenticación con cliente_id)

```sql
CREATE TABLE `ll_usuarios` (
  `id` int(11) NOT NULL,
  `cliente_id` int(11) DEFAULT NULL,    ← ID numérico del cliente (sin FK)
  `usuario` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `tipo` enum('cliente','admin') DEFAULT 'cliente',
  `activo` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
```

**Datos de ejemplo:**
```sql
INSERT INTO `ll_usuarios` VALUES
(1, 1, 'b3toh', '$2b$10$...', 'admin', 1),
(2, 51, 'Haby', '$2b$10$...', 'cliente', 1);
```

**JWT decodificado (usuario actual):**
```json
{
  "id": 2,           ← ll_usuarios.id
  "cliente_id": 51,  ← ll_usuarios.cliente_id (NO tiene tabla ll_clientes)
  "usuario": "Haby",
  "tipo": "cliente"
}
```

---

### 3. **ll_lugares_clientes** (Vinculación prospecto-cliente)

```sql
CREATE TABLE `ll_lugares_clientes` (
  `id` int(11) NOT NULL,
  `cliente_id` int(11) NOT NULL,      ← Referencia a ll_usuarios.cliente_id
  `societe_id` int(11) NOT NULL,      ← FK a llxbx_societe.rowid (Dolibarr)
  `ref_ext` varchar(64) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
```

**Función:**
- Registra qué prospectos (societe_id) están asociados a qué cliente (cliente_id)
- **PROBLEMA ACTUAL:** Tabla vacía para cliente_id = 51 → INNER JOIN devuelve 0 registros

---

## 🗺️ DIAGRAMA DE RELACIONES CORREGIDO

```
┌─────────────────────┐
│   ll_usuarios       │
│   (Autenticación)   │
│  id, cliente_id     │
└──────────┬──────────┘
           │
           │ cliente_id (campo numérico, sin FK real)
           │
           ├─────────────────────┐
           │                     │
           ▼                     ▼
┌─────────────────────┐  ┌─────────────────────┐
│ ll_campanias_       │  │ ll_lugares_         │
│ whatsapp            │  │ clientes            │
│ (Campañas)          │  │ (Vinculación)       │
│ cliente_id          │  │ cliente_id,         │
│                     │  │ societe_id          │
└─────────┬───────────┘  └──────────┬──────────┘
          │                         │
          │                         │
          │                         ▼
          │              ┌─────────────────────┐
          │              │  llxbx_societe      │
          │              │  (Dolibarr)         │
          │              │  Prospectos         │
          │              └──────────┬──────────┘
          │                         │
          │                         │
          └─────────────┬───────────┘
                       │
                       ▼
            ┌─────────────────────┐
            │ ll_envios_whatsapp  │
            │ (Historial)         │
            │ campania_id,        │
            │ lugar_id            │
            └─────────────────────┘
```

---

## 🔧 QUERY REAL DEL SELECTOR DE PROSPECTOS (CORREGIDO)

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

-- ⚠️ PROBLEMA: INNER JOIN elimina prospectos sin vinculación
INNER JOIN ll_lugares_clientes lc 
  ON lc.societe_id = s.rowid 
  AND lc.cliente_id = ? (parámetro: 51 del JWT)

LEFT JOIN ll_societe_extended se 
  ON se.societe_id = s.rowid

LEFT JOIN ll_rubros r 
  ON se.rubro_id = r.id

-- ✅ Filtra envíos de la campaña seleccionada
LEFT JOIN ll_envios_whatsapp env 
  ON env.lugar_id = s.rowid 
  AND env.campania_id = ? (parámetro: campania_id del frontend)

WHERE s.entity = 1
  AND s.phone_mobile IS NOT NULL 
  AND s.phone_mobile != ''

GROUP BY s.rowid, s.nom, s.phone_mobile, s.email, s.address, s.town, 
         r.nombre, r.area, s.client, s.fournisseur

HAVING 1=1

ORDER BY s.nom ASC
LIMIT 1000;
```

**Parámetros:**
1. `params[0]` = 51 (cliente_id de Haby, desde JWT `req.user.cliente_id`)
2. `params[1]` = ID de campaña seleccionada (desde `ll_campanias_whatsapp`)

---

## 📋 RESUMEN DE CORRECCIONES

| Documentado INCORRECTAMENTE | Tabla REAL | Ubicación |
|-----------------------------|-----------|-----------|
| `ll_campanias` | `ll_campanias_whatsapp` | Base de datos |
| `ll_clientes` | NO EXISTE (solo campo `cliente_id` en otras tablas) | - |
| Endpoint `/api/sender/campanas` | Verificar si es `/api/sender/campanias` | Backend |

---

## 🎯 IMPACTO EN EL DIAGNÓSTICO

### ✅ El diagnóstico sigue siendo VÁLIDO

El problema del INNER JOIN con `ll_lugares_clientes` **sigue siendo la causa raíz** del bug de 0 registros.

**Lo que NO cambia:**
- El INNER JOIN con `ll_lugares_clientes` elimina todos los prospectos
- La tabla `ll_lugares_clientes` está vacía para `cliente_id = 51`
- La solución propuesta (cambiar a LEFT JOIN) sigue siendo correcta

**Lo que SÍ cambia:**
- La tabla de campañas se llama `ll_campanias_whatsapp` (NO `ll_campanias`)
- NO existe tabla `ll_clientes` - el `cliente_id` es solo un campo numérico
- Las campañas se obtienen de `ll_campanias_whatsapp`

---

## 🔬 QUERIES DE DIAGNÓSTICO ACTUALIZADOS

### 1. Verificar campañas del cliente actual

```sql
SELECT id, nombre, estado, cliente_id
FROM ll_campanias_whatsapp
WHERE cliente_id = 51;

-- Resultado esperado: Campañas del usuario Haby
```

### 2. Verificar vinculación en ll_lugares_clientes

```sql
SELECT COUNT(*) as total
FROM ll_lugares_clientes
WHERE cliente_id = 51;

-- Resultado actual: 0 (causa del bug)
```

### 3. Verificar datos del usuario autenticado

```sql
SELECT id, cliente_id, usuario, tipo, activo
FROM ll_usuarios
WHERE id = 2;

-- Resultado:
-- id=2, cliente_id=51, usuario='Haby', tipo='cliente', activo=1
```

### 4. Verificar prospectos totales disponibles

```sql
SELECT COUNT(*) as total
FROM llxbx_societe
WHERE entity = 1
  AND phone_mobile IS NOT NULL
  AND phone_mobile != '';

-- Resultado esperado: 8,000+ prospectos
```

### 5. Simular LEFT JOIN (solución propuesta)

```sql
SELECT COUNT(*) as total
FROM llxbx_societe s
LEFT JOIN ll_lugares_clientes lc 
  ON lc.societe_id = s.rowid 
  AND lc.cliente_id = 51
WHERE s.entity = 1
  AND s.phone_mobile IS NOT NULL
  AND s.phone_mobile != '';

-- Resultado esperado: 8,000+ (en vez de 0 con INNER JOIN)
```

---

## 🛠️ SOLUCIÓN SIGUE SIENDO LA MISMA

**Cambiar línea 107-108 en `prospectosController.js`:**

```javascript
// ANTES (INCORRECTO):
INNER JOIN ll_lugares_clientes lc ON lc.societe_id = s.rowid AND lc.cliente_id = ?

// DESPUÉS (CORRECTO):
LEFT JOIN ll_lugares_clientes lc ON lc.societe_id = s.rowid AND lc.cliente_id = ?
```

---

## 📚 ARCHIVOS A REVISAR

1. **Backend:**
   - `src/modules/sender/controllers/prospectosController.js` (cambiar INNER→LEFT)
   - `src/modules/sender/controllers/campaignsController.js` (usa `ll_campanias_whatsapp`)

2. **Frontend:**
   - `frontend/src/services/campanias.js` (verificar endpoint)
   - `frontend/src/components/destinatarios/SelectorProspectosPage.jsx`

---

## ✅ CONCLUSIÓN

**Las correcciones de nomenclatura NO afectan el diagnóstico:**

- ✅ El INNER JOIN con `ll_lugares_clientes` sigue siendo el problema
- ✅ La solución (cambiar a LEFT JOIN) sigue siendo correcta
- ✅ El análisis técnico del query es válido

**Solo se actualizan los nombres correctos de tablas:**
- `ll_campanias` → `ll_campanias_whatsapp`
- `ll_clientes` → NO EXISTE (es solo un campo `cliente_id`)

---

**Generado:** 2026-02-11  
**Estado:** 🔍 Correcciones aplicadas - Diagnóstico sigue siendo válido  
**Base de datos verificada:** `iunaorg_dyd` (dump 2026-02-08)
