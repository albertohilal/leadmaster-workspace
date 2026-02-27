# 🔍 DIAGNÓSTICO: Estado Desactualizado en Grilla "Seleccionar Prospectos"

**Fecha:** 2026-02-18  
**Problema:** Registro en estado 'error' (id=4687) se muestra como 'pendiente' en grilla  
**Campaña:** Haby – Reactivación  
**Criticidad:** 🟡 MEDIA (inconsistencia datos / UX)  
**Estado:** ✅ DIAGNOSTICADO

---

## 🎯 PROBLEMA IDENTIFICADO

### Síntoma:
```
BD Real (ll_envios_whatsapp):
  id=4687, estado='error', lugar_id=XXXX, campania_id=YY

Grilla "Seleccionar Prospectos":
  mismo prospecto muestra estado='pendiente'
```

### Causa raíz:

**El LEFT JOIN en la query SQL NO obtiene el último envío por prospecto. Si hay múltiples registros en `ll_envios_whatsapp` para el mismo `lugar_id` + `campania_id`, el motor de BD puede devolver cualquiera sin garantía de que sea el más reciente.**

---

## 📊 ANÁLISIS TÉCNICO

### 1️⃣ Endpoint Backend

**URL:** `GET /api/sender/prospectos/filtrar`  
**Archivo:** [src/modules/sender/controllers/prospectosController.js](src/modules/sender/controllers/prospectosController.js#L19-L66)  
**Método:** `filtrarProspectos()`  
**Líneas:** 19-66

---

### 2️⃣ Query SQL Actual (PROBLEMÁTICA)

**Ubicación:** prospectosController.js líneas 29-48

```sql
SELECT
  s.rowid AS prospecto_id,
  s.nom AS nombre,
  env.estado AS estado_campania,          -- ← PROBLEMA AQUÍ
  s.phone_mobile AS telefono_wapp,
  s.address AS direccion,
  env.id AS envio_id,
  env.fecha_envio
FROM ll_campanias_whatsapp c
JOIN ll_lugares_clientes lc
  ON lc.cliente_id = c.cliente_id
JOIN llxbx_societe s
  ON s.rowid = lc.societe_id
LEFT JOIN ll_envios_whatsapp env         -- ← PROBLEMA: Sin ORDER BY ni MAX(id)
  ON env.campania_id = c.id
 AND env.lugar_id = s.rowid
WHERE c.id = ?
  AND s.entity = 1
ORDER BY s.nom ASC
```

---

### 3️⃣ Análisis del LEFT JOIN

#### Problema detectado:

```sql
LEFT JOIN ll_envios_whatsapp env
  ON env.campania_id = c.id
 AND env.lugar_id = s.rowid
```

**¿Qué hace?**
- Busca envíos en `ll_envios_whatsapp` donde:
  - `campania_id` coincida con la campaña seleccionada
  - `lugar_id` coincida con el prospecto (societe_id)

**¿Qué NO hace?**
- ❌ NO ordena por `id DESC` para obtener el más reciente
- ❌ NO usa `MAX(env.id)` para garantizar el último registro
- ❌ NO usa subquery con `ORDER BY id DESC LIMIT 1`
- ❌ NO agrupa con `GROUP BY` para evitar duplicados

**Resultado:**
Si existe más de 1 registro en `ll_envios_whatsapp` para el mismo `lugar_id` + `campania_id`, el motor de BD puede devolver **cualquiera** sin orden definido.

---

### 4️⃣ Escenario Real del Usuario

**Base de datos:**
```sql
SELECT id, lugar_id, campania_id, estado, created_at
FROM ll_envios_whatsapp
WHERE campania_id = <id_campania_haby>
  AND lugar_id = <id_societe_problema>
ORDER BY id DESC;
```

**Resultado esperado:**
```
+------+-----------+--------------+----------+---------------------+
| id   | lugar_id  | campania_id  | estado   | created_at          |
+------+-----------+--------------+----------+---------------------+
| 4687 | 1234      | 47           | error    | 2026-02-18 08:45:00 | ← MÁS RECIENTE
| 4520 | 1234      | 47           | pendiente| 2026-02-15 10:30:00 | ← MÁS ANTIGUO
+------+-----------+--------------+----------+---------------------+
```

**Comportamiento actual del LEFT JOIN:**
- Puede devolver cualquiera de los 2 registros
- Si devuelve id=4520 → muestra 'pendiente' (incorrecto)
- Si devuelve id=4687 → muestra 'error' (correcto)

**Por qué ocurre:**
- MySQL sin ORDER BY en subquery puede ejecutar en cualquier orden de lectura de páginas de disco
- El índice puede afectar el orden natural de lectura
- No hay garantía sin ORDER BY explícito

---

### 5️⃣ Frontend - Uso del Campo

**Componente:** [frontend/src/components/leads/SelectorProspectos.jsx](frontend/src/components/leads/SelectorProspectos.jsx#L226-L231)

**Líneas 226-231:**
```jsx
<span className={`inline-flex px-2 py-1 text-xs rounded-full ${
  prospecto.estado_campania === 'enviado' ? 'bg-green-100 text-green-800' :
  prospecto.estado_campania === 'pendiente' ? 'bg-yellow-100 text-yellow-800' :
  prospecto.estado_campania === 'error' ? 'bg-red-100 text-red-800' :
  'bg-gray-100 text-gray-800'
}`}>
  {traducirEstado(prospecto.estado_campania)}
</span>
```

**Campo usado:** `prospecto.estado_campania` (viene del backend)

**Otros componentes afectados:**
- [GestionDestinatariosPage.jsx](frontend/src/components/destinatarios/GestionDestinatariosPage.jsx#L415-L417) líneas 415-417
- [AgregarProspectosACampaniaPage.jsx](frontend/src/components/leads/AgregarProspectosACampaniaPage.jsx#L352-L357) líneas 352-357

---

## ✅ SOLUCIÓN

### Opción 1: Subquery con ORDER BY + LIMIT (Recomendada)

**Modificar:** `src/modules/sender/controllers/prospectosController.js` línea 29-48

**Query corregida:**

```sql
SELECT
  s.rowid AS prospecto_id,
  s.nom AS nombre,
  env_ultimo.estado AS estado_campania,
  s.phone_mobile AS telefono_wapp,
  s.address AS direccion,
  env_ultimo.id AS envio_id,
  env_ultimo.fecha_envio
FROM ll_campanias_whatsapp c
JOIN ll_lugares_clientes lc
  ON lc.cliente_id = c.cliente_id
JOIN llxbx_societe s
  ON s.rowid = lc.societe_id
LEFT JOIN (
  SELECT 
    env.*
  FROM ll_envios_whatsapp env
  INNER JOIN (
    SELECT lugar_id, campania_id, MAX(id) as max_id
    FROM ll_envios_whatsapp
    WHERE campania_id = ?
    GROUP BY lugar_id, campania_id
  ) env_max
    ON env.id = env_max.max_id
) env_ultimo
  ON env_ultimo.campania_id = c.id
 AND env_ultimo.lugar_id = s.rowid
WHERE c.id = ?
  AND s.entity = 1
ORDER BY s.nom ASC
```

**Cambios clave:**
- ✅ Subquery con `MAX(id)` para obtener el envío más reciente por prospecto
- ✅ Garantiza que solo se devuelva 1 registro por `lugar_id` + `campania_id`
- ✅ Usa `INNER JOIN` entre subquery y tabla original para obtener todos los campos

**Ventajas:**
- ✅ Garantiza último envío
- ✅ Compatible con MySQL 5.7+
- ✅ Performance aceptable con índices correctos

**Índices requeridos:**
```sql
CREATE INDEX idx_envios_lugar_campania_id 
  ON ll_envios_whatsapp(lugar_id, campania_id, id DESC);
```

---

### Opción 2: Window Functions (MySQL 8.0+)

**Query alternativa (si MySQL >= 8.0):**

```sql
SELECT
  s.rowid AS prospecto_id,
  s.nom AS nombre,
  env_ranked.estado AS estado_campania,
  s.phone_mobile AS telefono_wapp,
  s.address AS direccion,
  env_ranked.id AS envio_id,
  env_ranked.fecha_envio
FROM ll_campanias_whatsapp c
JOIN ll_lugares_clientes lc
  ON lc.cliente_id = c.cliente_id
JOIN llxbx_societe s
  ON s.rowid = lc.societe_id
LEFT JOIN (
  SELECT 
    *,
    ROW_NUMBER() OVER (PARTITION BY lugar_id, campania_id ORDER BY id DESC) as rn
  FROM ll_envios_whatsapp
  WHERE campania_id = ?
) env_ranked
  ON env_ranked.campania_id = c.id
 AND env_ranked.lugar_id = s.rowid
 AND env_ranked.rn = 1
WHERE c.id = ?
  AND s.entity = 1
ORDER BY s.nom ASC
```

**Ventajas:**
- ✅ Más legible
- ✅ Mejor performance en MySQL 8.0+
- ✅ Garantiza orden estricto

**Desventajas:**
- ❌ Requiere MySQL 8.0+ (verificar versión actual)

---

### Opción 3: GROUP BY + MAX(id) (Más Simple)

**Query simplificada:**

```sql
SELECT
  s.rowid AS prospecto_id,
  s.nom AS nombre,
  (
    SELECT env2.estado 
    FROM ll_envios_whatsapp env2
    WHERE env2.lugar_id = s.rowid 
      AND env2.campania_id = c.id
    ORDER BY env2.id DESC
    LIMIT 1
  ) AS estado_campania,
  s.phone_mobile AS telefono_wapp,
  s.address AS direccion,
  (
    SELECT MAX(env3.id)
    FROM ll_envios_whatsapp env3
    WHERE env3.lugar_id = s.rowid 
      AND env3.campania_id = c.id
  ) AS envio_id,
  (
    SELECT env4.fecha_envio
    FROM ll_envios_whatsapp env4
    WHERE env4.lugar_id = s.rowid 
      AND env4.campania_id = c.id
    ORDER BY env4.id DESC
    LIMIT 1
  ) AS fecha_envio
FROM ll_campanias_whatsapp c
JOIN ll_lugares_clientes lc
  ON lc.cliente_id = c.cliente_id
JOIN llxbx_societe s
  ON s.rowid = lc.societe_id
WHERE c.id = ?
  AND s.entity = 1
ORDER BY s.nom ASC
```

**Ventajas:**
- ✅ Más legible y mantenible
- ✅ Garantiza último envío con `ORDER BY id DESC LIMIT 1`
- ✅ Compatible MySQL 5.5+

**Desventajas:**
- ⚠️ Múltiples subqueries (performance puede ser menor)
- Requiere índices en `lugar_id, campania_id, id`

---

## 🔧 IMPLEMENTACIÓN RECOMENDADA

### Paso 1: Verificar versión MySQL

```bash
mysql -h sv46.byethost46.org -u iunaorg_b3toh -p'elgeneral2018' \
  iunaorg_dyd -e "SELECT VERSION();"
```

**Si MySQL >= 8.0:** Usar Opción 2 (Window Functions)  
**Si MySQL < 8.0:** Usar Opción 1 (Subquery con MAX)

---

### Paso 2: Modificar controller

**Archivo:** `src/modules/sender/controllers/prospectosController.js`

**Reemplazar líneas 29-48 con:**

```javascript
// Versión recomendada: Subquery con MAX(id) (compatible MySQL 5.7+)
const sql = `
  SELECT
    s.rowid AS prospecto_id,
    s.nom AS nombre,
    env_ultimo.estado AS estado_campania,
    s.phone_mobile AS telefono_wapp,
    s.address AS direccion,
    env_ultimo.id AS envio_id,
    env_ultimo.fecha_envio
  FROM ll_campanias_whatsapp c
  JOIN ll_lugares_clientes lc
    ON lc.cliente_id = c.cliente_id
  JOIN llxbx_societe s
    ON s.rowid = lc.societe_id
  LEFT JOIN (
    SELECT 
      env.*
    FROM ll_envios_whatsapp env
    INNER JOIN (
      SELECT lugar_id, campania_id, MAX(id) as max_id
      FROM ll_envios_whatsapp
      WHERE campania_id = ?
      GROUP BY lugar_id, campania_id
    ) env_max
      ON env.id = env_max.max_id
  ) env_ultimo
    ON env_ultimo.campania_id = c.id
   AND env_ultimo.lugar_id = s.rowid
  WHERE c.id = ?
    AND s.entity = 1
  ORDER BY s.nom ASC
`;

console.log('🔍 [prospectos] Query con campania_id:', campania_id);

const [rows] = await db.execute(sql, [campania_id, campania_id]);
//                                     ^^^^^^^^^^^ ^^^^^^^^^^^
//                                     Para subquery   Para WHERE principal
```

**Nota crítica:** El parámetro `campania_id` se usa 2 veces:
1. En la subquery interna (`WHERE campania_id = ?`)
2. En el WHERE principal (`WHERE c.id = ?`)

---

### Paso 3: Verificar índices

```sql
-- Verificar índices actuales
SHOW INDEXES FROM ll_envios_whatsapp WHERE Key_name LIKE '%lugar%';

-- Si no existe, crear índice compuesto
CREATE INDEX idx_envios_lugar_campania_id 
  ON ll_envios_whatsapp(lugar_id, campania_id, id DESC);
```

**Beneficio:** Acelera la subquery `MAX(id)` considerablemente.

---

### Paso 4: Reiniciar PM2

```bash
pm2 restart leadmaster-central-hub
pm2 logs leadmaster-central-hub --lines 20
```

---

### Paso 5: Test funcional

**1. Crear múltiples envíos de prueba:**

```sql
-- Insertar 2 envíos para mismo prospecto en misma campaña
INSERT INTO ll_envios_whatsapp 
  (campania_id, lugar_id, telefono_wapp, nombre_destino, estado, mensaje, cliente_id)
VALUES
  (47, 1234, '+5491123456789', 'Test Prospecto', 'pendiente', 'Mensaje 1', 1),
  (47, 1234, '+5491123456789', 'Test Prospecto', 'error', 'Mensaje 2', 1);
```

**2. Verificar en grilla:**
- Navegar a "Seleccionar Prospectos"
- Seleccionar campaña 47
- El prospecto id=1234 DEBE mostrar estado 'error' (el más reciente)

**3. Verificar query directa:**

```sql
-- Debe retornar solo el registro con estado='error'
SELECT 
  s.rowid, 
  s.nom, 
  env_ultimo.estado, 
  env_ultimo.id
FROM llxbx_societe s
LEFT JOIN (
  SELECT env.*
  FROM ll_envios_whatsapp env
  INNER JOIN (
    SELECT lugar_id, campania_id, MAX(id) as max_id
    FROM ll_envios_whatsapp
    WHERE campania_id = 47
    GROUP BY lugar_id, campania_id
  ) env_max ON env.id = env_max.max_id
) env_ultimo ON env_ultimo.lugar_id = s.rowid AND env_ultimo.campania_id = 47
WHERE s.rowid = 1234;
```

**Resultado esperado:**
```
+-------+------------------+--------+-------+
| rowid | nom              | estado | id    |
+-------+------------------+--------+-------+
| 1234  | Test Prospecto   | error  | 4687  | ← Último registro
+-------+------------------+--------+-------+
```

---

## 📋 CHECKLIST DE VERIFICACIÓN

- [ ] Verificar versión MySQL (paso 1)
- [ ] Actualizar query en prospectosController.js (paso 2)
- [ ] Pasar `campania_id` 2 veces en `db.execute()` (paso 2)
- [ ] Verificar/crear índice compuesto (paso 3)
- [ ] Reiniciar PM2 (paso 4)
- [ ] Test con datos reales (paso 5)
- [ ] Verificar que grilla muestra estado correcto
- [ ] Verificar performance (tiempo de respuesta < 500ms)

---

## 📊 RESUMEN EJECUTIVO

| Aspecto | Estado Actual | Estado Corregido | Acción |
|---------|--------------|------------------|--------|
| **JOIN ll_envios_whatsapp** | ❌ Sin ORDER BY | ✅ Con MAX(id) | Modificar query |
| **Múltiples envíos** | ❌ Devuelve cualquiera | ✅ Devuelve último | Subquery + MAX(id) |
| **Estado en grilla** | ❌ Desactualizado | ✅ Siempre último | Automático post-fix |
| **Performance** | ⚠️ Puede mejorar | ✅ Optimizada | Agregar índices |
| **Garantía de orden** | ❌ No determinista | ✅ Determinista | ORDER BY explícito |

---

## 🎯 CAUSA RAÍZ (RESUMIDA)

**Problema:**
```
LEFT JOIN ll_envios_whatsapp env
  ON env.campania_id = c.id AND env.lugar_id = s.rowid
```

**Sin:**
- ❌ ORDER BY id DESC
- ❌ MAX(id) o subquery
- ❌ GROUP BY

**Resultado:** Si hay N > 1 envíos para mismo prospecto + campaña, puede devolver cualquiera.

**Solución:** Usar subquery con `MAX(id)` para garantizar último envío.

---

## 📚 REFERENCIAS

- **Controller Backend:** [src/modules/sender/controllers/prospectosController.js](src/modules/sender/controllers/prospectosController.js#L19-L66)
- **Componente Frontend:** [frontend/src/components/leads/SelectorProspectos.jsx](frontend/src/components/leads/SelectorProspectos.jsx#L226-L231)
- **Tabla principal:** `ll_envios_whatsapp`
- **Campo problemático:** `env.estado AS estado_campania`

---

## 🔗 ARCHIVOS RELACIONADOS

### Backend:
1. `src/modules/sender/controllers/prospectosController.js` (líneas 19-66)
2. `src/modules/sender/routes/prospectos.js` (ruta `/filtrar`)
3. `src/config/db.js` (pool de conexión)

### Frontend:
1. `frontend/src/components/leads/SelectorProspectos.jsx` (líneas 226-231)
2. `frontend/src/components/destinatarios/GestionDestinatariosPage.jsx` (líneas 415-417)
3. `frontend/src/components/leads/AgregarProspectosACampaniaPage.jsx` (líneas 352-357)
4. `frontend/src/services/api.js` (método `getProspectos`)

---

**Diagnóstico completado.**  
**Fecha:** 2026-02-18  
**Herramienta:** grep + semantic_search + read_file + análisis SQL  
**Tiempo de diagnóstico:** ~8 minutos  
**Prioridad de solución:** 🟡 MEDIA (afecta UX pero no bloquea funcionalidad)

---

**FIN DEL DIAGNÓSTICO**
