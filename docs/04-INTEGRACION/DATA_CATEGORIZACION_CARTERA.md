# Data Decision: Categorización de “Cartera Origen”

**Fecha:** 2026-03-05  
**Ámbito:** LeadMaster Workspace / Central Hub / Selector “Seleccionar Prospectos”  
**Fuente CRM:** Dolibarr (tabla `llx_societe` / réplica local `llxbx_societe`)  

---

## Problema

En Dolibarr, el campo `llx_societe.client` (0/1/2/3) **no representa el origen de la cartera**.

- `client` modela el **tipo/estado comercial** (cliente vs prospecto vs proveedor), útil para segmentar por “Tipo Societe”.
- El negocio necesita segmentar por **de dónde viene el contacto** (cartera propia vs captado por LeadMaster, etc.) para:
  - aplicar **mensajes diferentes** por segmento,
  - medir performance por origen,
  - sostener reglas de negocio de importación/captación.

Por lo tanto, **no se puede inferir “origen” desde `client`** sin introducir ambigüedad y errores.

---

## Decisión

Se define un atributo de negocio **inmutable** `cartera_origen` para cada empresa/prospecto (societe), almacenado en la tabla extendida:

- Tabla: `ll_societe_extended`
- FK: `ll_societe_extended.societe_id` → `llxbx_societe.rowid` (Dolibarr)
- Campo: `ll_societe_extended.cartera_origen` (ENUM lógico / valores controlados)

### Valores controlados (4)

- `CARTERA_PROPIA`
- `CAPTADO_LEADMASTER`
- `IMPORT_MANUAL`
- `REFERIDO`

### Regla de inmutabilidad

`cartera_origen` se **setea una vez** al crear/importar el registro (o al vincularlo por primera vez) y **no se edita** posteriormente.

Motivo: es un **atributo histórico** del origen del contacto (no un estado).

---

## Mapeo sugerido desde “origen” técnico

El sistema puede tener múltiples fuentes técnicas de creación/captación. Este mapeo es el punto de partida (extensible):

- `google_places` / captación automatizada → `CAPTADO_LEADMASTER`
- carga interna “cartera” (ej. operador / fuente local) → `CARTERA_PROPIA`
- import CSV / import por archivo → `IMPORT_MANUAL`
- alta por recomendación / referido explícito → `REFERIDO`

Si una fuente técnica no está tipificada, se debe definir el mapping antes de habilitarla en producción (evitar valores “misc”).

---

## Impacto en UI / Producto

En la pantalla **“Seleccionar Prospectos”** se agrega el filtro **“Cartera Origen”** junto al filtro existente **“Tipo Societe”**.

- Opciones: `Todos` + los 4 valores controlados.
- Objetivo: permitir segmentación previa a la selección de destinatarios para campañas.

Esto habilita (en etapas siguientes) definir **mensajes diferenciados** y reportes por `cartera_origen`.

---

## Impacto en Backend (Central Hub)

El endpoint que lista prospectos para la UI debe:

- incluir `cartera_origen` en el DTO (via `LEFT JOIN ll_societe_extended`),
- soportar filtro por query param:
  - `cartera_origen=ALL` o ausente → sin filtro
  - `cartera_origen={CARTERA_PROPIA|CAPTADO_LEADMASTER|IMPORT_MANUAL|REFERIDO}` → filtra

### Requisito de robustez

Si la tabla `ll_societe_extended` o la columna `cartera_origen` **no existen** (entorno desfasado), el endpoint:

- **no debe caerse**,
- debe responder `cartera_origen = null` y **no aplicar filtro**.

---

## Notas operativas

- Este documento define el contrato semántico; no reemplaza migraciones.
- Cuando se implemente/migre la columna, asegurar valores válidos y consistencia (sin strings libres).
