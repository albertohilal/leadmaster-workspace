# 🗄️ TABLAS DEL FORMULARIO "SELECCIONAR PROSPECTOS"

**Formulario:** Selector de Prospectos  
**Endpoint:** `/api/sender/prospectos/filtrar`  
**Fecha:** 2026-02-11

---

## 📊 TABLAS PRINCIPALES

### 1. **llxbx_societe** (Tabla FROM - Dolibarr)

**Alias:** `s`  
**Tipo:** Tabla principal  
**Origen:** Dolibarr ERP  
**Propósito:** Contiene toda la información de empresas/prospectos/clientes

#### Columnas utilizadas:
| Columna | Alias en SELECT | Descripción | Tipo |
|---------|----------------|-------------|------|
| `rowid` | `id` | ID único del prospecto | INT (PK) |
| `nom` | `nombre` | Nombre de la empresa | VARCHAR |
| `phone_mobile` | `telefono_wapp` | Teléfono/WhatsApp | VARCHAR |
| `email` | `email` | Email de contacto | VARCHAR |
| `address` | `direccion` | Dirección física | VARCHAR |
| `town` | `ciudad` | Ciudad | VARCHAR |
| `client` | `es_cliente` | Si es cliente (1) o no (0) | TINYINT |
| `fournisseur` | `es_proveedor` | Si es proveedor (1) o no (0) | TINYINT |
| `entity` | - | Entidad (multi-empresa) | INT |

#### Filtros aplicados:
- ✅ `entity = 1` (solo entidades activas)
- ✅ `phone_mobile IS NOT NULL AND phone_mobile != ''` (solo con WhatsApp válido)
- ✅ `nom LIKE '%busqueda%'` (búsqueda por nombre)
- ✅ `address LIKE '%direccion%'` (filtro por dirección)
- ✅ `client = 1` (filtro por tipo de cliente)

---

### 2. **ll_lugares_clientes** (INNER JOIN) ⚠️

**Alias:** `lc`  
**Tipo:** Tabla de vinculación cliente-prospecto  
**Origen:** LeadMaster custom  
**Propósito:** Relacionar qué prospectos puede ver cada cliente

#### Columnas utilizadas:
| Columna | Uso | Descripción |
|---------|-----|-------------|
| `societe_id` | JOIN | FK a llxbx_societe.rowid |
| `cliente_id` | JOIN + SELECT | FK a ll_clientes.id |

#### JOIN:
```sql
INNER JOIN ll_lugares_clientes lc 
  ON lc.societe_id = s.rowid 
  AND lc.cliente_id = ? (parámetro del usuario autenticado)
```

#### ⚠️ PROBLEMA ACTUAL:
- Este INNER JOIN **requiere** que el prospecto esté vinculado al cliente
- Si la tabla está vacía para el cliente → 0 resultados
- Debería ser **LEFT JOIN** para mostrar todos los prospectos

---

### 3. **ll_societe_extended** (LEFT JOIN)

**Alias:** `se`  
**Tipo:** Tabla de extensión  
**Origen:** LeadMaster custom  
**Propósito:** Datos adicionales de prospectos no incluidos en Dolibarr

#### Columnas utilizadas:
| Columna | Uso | Descripción |
|---------|-----|-------------|
| `societe_id` | JOIN | FK a llxbx_societe.rowid |
| `rubro_id` | JOIN (indirecto) | FK a ll_rubros.id |

#### JOIN:
```sql
LEFT JOIN ll_societe_extended se 
  ON se.societe_id = s.rowid
```

#### ✅ Estado: Correcto (LEFT JOIN permite prospectos sin datos extendidos)

---

### 4. **ll_rubros** (LEFT JOIN)

**Alias:** `r`  
**Tipo:** Catálogo de rubros/categorías  
**Origen:** LeadMaster custom  
**Propósito:** Clasificación de empresas por rubro de negocio

#### Columnas utilizadas:
| Columna | Alias en SELECT | Descripción |
|---------|----------------|-------------|
| `id` | - | ID del rubro | 
| `nombre` | `rubro` | Nombre del rubro (ej: "Restaurante") |
| `area` | `area_rubro` | Área del rubro (ej: "Gastronomía") |
| `keyword_google` | - | Palabras clave para búsquedas |

#### JOIN:
```sql
LEFT JOIN ll_rubros r 
  ON se.rubro_id = r.id
```

#### Filtros aplicados:
- ✅ `COALESCE(r.nombre, 'Sin rubro') LIKE '%rubro%'` (filtro por rubro)
- ✅ `r.area LIKE '%area%'` (filtro por área)

#### ✅ Estado: Correcto (LEFT JOIN permite prospectos sin rubro asignado)

---

### 5. **ll_envios_whatsapp** (LEFT JOIN)

**Alias:** `env`  
**Tipo:** Historial de envíos de WhatsApp  
**Origen:** LeadMaster custom  
**Propósito:** Registrar envíos de mensajes y su estado

#### Columnas utilizadas:
| Columna | Uso | Descripción |
|---------|-----|-------------|
| `id` | Agregación (MAX) | ID del envío |
| `lugar_id` | JOIN | FK a llxbx_societe.rowid |
| `campania_id` | JOIN (filtro) | FK a ll_campanias.id |
| `estado` | SELECT (MAX) | Estado del envío |
| `fecha_envio` | SELECT (MAX) | Fecha del último envío |

#### JOIN:
```sql
LEFT JOIN ll_envios_whatsapp env 
  ON env.lugar_id = s.rowid 
  AND env.campania_id = ? (parámetro de campaña seleccionada)
```

#### Estado calculado:
```sql
CASE 
  WHEN MAX(env.id) IS NOT NULL THEN MAX(env.estado)
  ELSE 'disponible'
END as estado
```

**Posibles estados:**
- `disponible` - Prospecto sin envíos en esta campaña
- `enviado` - Mensaje enviado exitosamente
- `pendiente` - Mensaje en cola de envío
- `error` - Error en el envío

#### Filtros aplicados en HAVING:
- ✅ `MAX(env.id) IS NULL` (filtro: sin envíos)
- ✅ `MAX(env.estado) = 'enviado'` (filtro: enviados)
- ✅ `MAX(env.estado) = 'pendiente'` (filtro: pendientes)

#### ✅ Estado: Correcto (LEFT JOIN permite prospectos sin envíos previos)

---

## 🔗 RELACIONES ENTRE TABLAS

### Diagrama ASCII (simple)

```
┌─────────────────────┐
│  llxbx_societe (s)  │ ← Tabla principal (Dolibarr)
│  Prospectos/Clientes│
└──────────┬──────────┘
           │
           │ INNER JOIN ⚠️ (PROBLEMA)
           │ lc.societe_id = s.rowid
           │ AND lc.cliente_id = ?
           ▼
┌─────────────────────┐
│ ll_lugares_clientes │
│  (lc)               │
│  Vinculación cliente│
└─────────────────────┘
           │
           │ LEFT JOIN ✓
           │ se.societe_id = s.rowid
           ▼
┌─────────────────────┐
│ ll_societe_extended │
│  (se)               │
│  Datos adicionales  │
└──────────┬──────────┘
           │
           │ LEFT JOIN ✓
           │ r.id = se.rubro_id
           ▼
┌─────────────────────┐
│    ll_rubros (r)    │
│  Categorización     │
└─────────────────────┘

┌─────────────────────┐
│  llxbx_societe (s)  │
└──────────┬──────────┘
           │
           │ LEFT JOIN ✓
           │ env.lugar_id = s.rowid
           │ AND env.campania_id = ?
           ▼
┌─────────────────────┐
│ ll_envios_whatsapp  │
│  (env)              │
│  Historial envíos   │
└─────────────────────┘
```

### Diagrama ER Completo

```mermaid
erDiagram
    llxbx_societe ||--o{ ll_lugares_clientes : "societe_id"
    llxbx_societe ||--o| ll_societe_extended : "societe_id"
    ll_societe_extended }o--|| ll_rubros : "rubro_id"
    llxbx_societe ||--o{ ll_envios_whatsapp : "lugar_id"
    ll_campanias_whatsapp ||--o{ ll_envios_whatsapp : "campania_id"
    ll_usuarios ||--o{ ll_campanias_whatsapp : "cliente_id"
    ll_usuarios ||--o{ ll_lugares_clientes : "cliente_id"

    llxbx_societe {
        int rowid PK "ID prospecto"
        varchar nom "Nombre empresa"
        varchar phone_mobile "WhatsApp"
        varchar email "Email"
        varchar address "Dirección"
        varchar town "Ciudad"
        tinyint client "Es cliente"
        tinyint fournisseur "Es proveedor"
        int entity "Entidad"
    }

    ll_lugares_clientes {
        int id PK
        int cliente_id FK "INNER_JOIN"
        int societe_id FK
        varchar ref_ext
    }

    ll_societe_extended {
        int id PK
        int societe_id FK
        int rubro_id FK
    }

    ll_rubros {
        int id PK
        varchar nombre "Rubro"
        varchar area "Área"
        varchar keyword_google
    }

    ll_envios_whatsapp {
        int id PK
        int lugar_id FK
        int campania_id FK
        enum estado "Estado envío"
        datetime fecha_envio
        varchar telefono_wapp
        varchar nombre_destino
    }

    ll_campanias_whatsapp {
        int id PK
        varchar nombre "Nombre campaña"
        text mensaje
        datetime fecha_creacion
        enum estado
        int cliente_id FK
    }

    ll_usuarios {
        int id PK
        int cliente_id "NO_FK"
        varchar usuario
        varchar password_hash
        enum tipo
        tinyint activo
    }
```

### Flujo del Query

```mermaid
graph TB
    subgraph "QUERY PRINCIPAL /api/sender/prospectos/filtrar"
        A[llxbx_societe<br/>FROM<br/>Prospectos Dolibarr<br/>10,000+ registros]
        
        A -->|"INNER JOIN ⚠️<br/>societe_id = rowid<br/>AND cliente_id = 51"| B[ll_lugares_clientes<br/>Vinculación<br/>⚠️ 0 REGISTROS]
        
        A -->|"LEFT JOIN ✓<br/>societe_id = rowid"| C[ll_societe_extended<br/>Datos extendidos]
        
        C -->|"LEFT JOIN ✓<br/>rubro_id = id"| D[ll_rubros<br/>Categorías]
        
        A -->|"LEFT JOIN ✓<br/>lugar_id = rowid<br/>AND campania_id = ?"| E[ll_envios_whatsapp<br/>Historial envíos]
    end
    
    subgraph "DATOS DE ENTRADA"
        F[JWT Token<br/>ll_usuarios<br/>cliente_id: 51<br/>usuario: Haby]
        G[Frontend<br/>campania_id seleccionada]
    end
    
    subgraph "RESULTADO"
        H[0 REGISTROS ❌<br/>INNER JOIN elimina todo]
        I[Solución: LEFT JOIN ✅<br/>8,000+ registros esperados]
    end
    
    F -->|"cliente_id = 51"| B
    G -->|"campania_id"| E
    
    B -->|"Si vacía"| H
    B -.->|"Cambiar a LEFT JOIN"| I
    
    style B fill:#ff6b6b,stroke:#c92a2a,color:#fff
    style H fill:#ff6b6b,stroke:#c92a2a,color:#fff
    style I fill:#51cf66,stroke:#2f9e44,color:#fff
    style A fill:#4dabf7,stroke:#1864ab,color:#fff
    style C fill:#868e96,stroke:#495057,color:#fff
    style D fill:#868e96,stroke:#495057,color:#fff
    style E fill:#868e96,stroke:#495057,color:#fff
```

### Comparación INNER JOIN vs LEFT JOIN

```mermaid
graph TD
    subgraph Problema["⚠️ PROBLEMA ACTUAL - INNER JOIN"]
        S1[llxbx_societe<br/>10,000 prospectos<br/>rowid: 1,2,3...10000]
        L1[ll_lugares_clientes<br/>0 registros<br/>para cliente_id=51]
        R1[RESULTADO<br/>0 REGISTROS ❌]
        
        S1 -->|"INNER JOIN<br/>requiere match obligatorio"| L1
        L1 -->|"Sin match =<br/>Sin resultado"| R1
    end
    
    subgraph Solucion["✅ SOLUCIÓN - LEFT JOIN"]
        S2[llxbx_societe<br/>10,000 prospectos<br/>rowid: 1,2,3...10000]
        L2[ll_lugares_clientes<br/>0 registros<br/>para cliente_id=51]
        R2[RESULTADO<br/>10,000 REGISTROS ✅<br/>con cliente_id = NULL]
        
        S2 -->|"LEFT JOIN<br/>mantiene todos los registros"| L2
        L2 -->|"Sin match =<br/>NULL en columnas de JOIN"| R2
    end
    
    subgraph Ejemplo["📊 EJEMPLO VISUAL"]
        direction TB
        E1["Prospecto 1: 'Restaurant XYZ'<br/>rowid = 123<br/>phone_mobile = '+54911111111'"]
        E2["ll_lugares_clientes<br/>NO tiene registro<br/>para societe_id=123<br/>AND cliente_id=51"]
        
        E3A["INNER JOIN:<br/>Prospecto ELIMINADO ❌"]
        E3B["LEFT JOIN:<br/>Prospecto INCLUIDO ✅<br/>cliente_id = NULL<br/>estado = 'disponible'"]
        
        E1 --> E2
        E2 -->|INNER| E3A
        E2 -->|LEFT| E3B
    end
    
    style R1 fill:#ff6b6b,stroke:#c92a2a,color:#fff
    style L1 fill:#ff6b6b,stroke:#c92a2a,color:#fff
    style R2 fill:#51cf66,stroke:#2f9e44,color:#fff
    style L2 fill:#51cf66,stroke:#2f9e44,color:#fff
    style E3A fill:#ff6b6b,stroke:#c92a2a,color:#fff
    style E3B fill:#51cf66,stroke:#2f9e44,color:#fff
```

---

## 📋 TABLAS AUXILIARES (No en el query principal)

Estas tablas se consultan en endpoints separados para poblar los filtros:

### 6. **ll_campanias_whatsapp** ✅ NOMBRE CORRECTO

**Endpoint:** `/api/sender/campanias`  
**Propósito:** Lista de campañas disponibles  
**Uso en formulario:** Dropdown "Campaña de destino"

#### Estructura:
```sql
CREATE TABLE `ll_campanias_whatsapp` (
  `id` int(11) NOT NULL,
  `nombre` varchar(255) NOT NULL,
  `mensaje` text NOT NULL,
  `fecha_creacion` datetime DEFAULT current_timestamp(),
  `estado` enum('pendiente','en_progreso','finalizado'),
  `cliente_id` int(11) DEFAULT NULL
);
```

#### Columnas mostradas:
- `id` - ID de la campaña
- `nombre` - Nombre de la campaña
- `cliente_id` - Cliente propietario de la campaña

---

### 7. **ll_usuarios**

**Uso:** Autenticación JWT  
**Propósito:** Datos del usuario autenticado

#### Estructura:
```sql
CREATE TABLE `ll_usuarios` (
  `id` int(11) NOT NULL,
  `cliente_id` int(11) DEFAULT NULL,
  `usuario` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `tipo` enum('cliente','admin'),
  `activo` tinyint(1) DEFAULT 1
);
```

#### Datos extraídos del token JWT:
- `id` - ID del usuario (ll_usuarios.id)
- `cliente_id` - ID numérico del cliente ⚠️ NO tiene tabla ll_clientes
- `usuario` - Nombre de usuario
- `tipo` - Tipo de usuario (cliente/admin)

**Ejemplo:**
```json
{
  "id": 2,
  "cliente_id": 51,
  "usuario": "Haby",
  "tipo": "cliente"
}
```

---

## 🎯 FLUJO DE DATOS

```
1. Usuario selecciona campaña
   ↓
2. Frontend llama: GET /api/sender/prospectos/filtrar?campania_id=XX
   ↓
3. Backend extrae: req.user.cliente_id (del JWT)
   ↓
4. Query ejecuta JOINs:
   
   llxbx_societe (todos los prospectos)
        ↓
   INNER JOIN ll_lugares_clientes ← FILTRA por cliente_id ⚠️
        ↓
   LEFT JOIN ll_societe_extended
        ↓
   LEFT JOIN ll_rubros
        ↓
   LEFT JOIN ll_envios_whatsapp ← FILTRA por campania_id
        ↓
5. Aplica filtros WHERE (área, rubro, dirección, tipo_cliente)
   ↓
6. Agrupa por prospecto con GROUP BY
   ↓
7. Aplica filtros HAVING (estado: sin_envio, enviado, pendiente)
   ↓
8. Devuelve JSON con array de prospectos
```

---

## 📊 RESUMEN DE TABLAS

| # | Tabla | Tipo JOIN | Origen | Propósito | Estado |
|---|-------|-----------|--------|-----------|--------|
| 1 | `llxbx_societe` | FROM | Dolibarr | Prospectos principales | ✅ Correcto |
| 2 | `ll_lugares_clientes` | **INNER JOIN** | LeadMaster | Vinculación cliente-prospecto | ⚠️ **PROBLEMA** |
| 3 | `ll_societe_extended` | LEFT JOIN | LeadMaster | Datos extendidos | ✅ Correcto |
| 4 | `ll_rubros` | LEFT JOIN | LeadMaster | Categorías/rubros | ✅ Correcto |
| 5 | `ll_envios_whatsapp` | LEFT JOIN | LeadMaster | Historial de envíos | ✅ Correcto |
| 6 | `ll_campanias_whatsapp` | (separado) | LeadMaster | Lista de campañas | ✅ Correcto |
| 7 | `ll_usuarios` | (JWT) | LeadMaster | Autenticación | ✅ Correcto |

⚠️ **NOTA:** La tabla `ll_clientes` NO EXISTE - el campo `cliente_id` es solo un ID numérico sin tabla maestra.

---

## 🔧 CAMPOS MOSTRADOS EN EL FORMULARIO

### Tabla de prospectos (columnas visibles):

| Columna UI | Campo DB | Tabla origen |
|------------|----------|--------------|
| **Empresa** | `s.nom` | llxbx_societe |
| (Rubro) | `r.nombre` | ll_rubros |
| (Área) | `r.area` | ll_rubros |
| **Estado** | `MAX(env.estado)` o 'disponible' | ll_envios_whatsapp |
| **Teléfono/WhatsApp** | `s.phone_mobile` | llxbx_societe |
| **Dirección** | `s.address` | llxbx_societe |
| (Ciudad) | `s.town` | llxbx_societe |

### Filtros disponibles:

| Filtro UI | Campo DB | Tabla origen |
|-----------|----------|--------------|
| Campaña de destino | Parámetro `campania_id` | ll_campanias |
| Buscar | `s.nom LIKE` | llxbx_societe |
| Área | `r.area` | ll_rubros |
| Rubro | `r.nombre` | ll_rubros |
| Estado | `MAX(env.estado)` | ll_envios_whatsapp |
| Tipo de cliente | `s.client`, `s.fournisseur` | llxbx_societe |
| Dirección contiene | `s.address LIKE` | llxbx_societe |

---

## 🚨 PROBLEMA IDENTIFICADO

**Tabla problemática:** `ll_lugares_clientes` con **INNER JOIN**

**Impacto:**
```sql
INNER JOIN ll_lugares_clientes lc 
  ON lc.societe_id = s.rowid 
  AND lc.cliente_id = 51
```

Si esta tabla NO tiene registros para `cliente_id = 51`:
- ❌ El INNER JOIN elimina TODOS los prospectos
- ❌ El resultado es 0 registros
- ❌ El usuario ve "No se encontraron prospectos"

**Solución:** Cambiar a `LEFT JOIN`

---

**Generado:** 2026-02-11  
**Estado:** Documentación completa del modelo de datos del formulario
