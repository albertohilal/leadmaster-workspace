# UX-01 — Prospectos: Cero Scroll Horizontal + Sticky Filters + Layout Operador

**Release:** R-OPS-01 — “Depuración Post-Envío + UX Operador Prospectos”  
**Fecha:** 2026-03-04  
**Workstream:** UX (Interfaz)

## Objetivo
Optimizar la pantalla `/prospectos` para que el operador trabaje rápido **sin scroll horizontal** y con **filtros siempre visibles** durante el scroll vertical.

## Requisitos implementados
### 1) Cero scroll horizontal (BUG CERO)
- Se eliminó el layout con panel lateral fijo.
- Se evitó `overflow-x` en el contenedor principal.
- La tabla se ajusta al ancho disponible usando `table-fixed` + wrapping/clamp en textos largos.

### 2) Filtros siempre visibles (Sticky)
- Se implementó una barra sticky **dentro del contenedor que scrollea** (no el body):
  - Campaña
  - Estado (existente)
  - **Tipo Societe** (nuevo)
  - Búsqueda rápida (nombre/teléfono/dirección)

### 3) Dirección siempre visible
- La columna Dirección no se oculta por responsive.
- Render:
  - Clamp visual a **2 líneas** para evitar romper layout.
  - Tooltip nativo vía `title` con el texto completo.

### 4) Reducir “vacíos”
- El panel izquierdo se convirtió en barra superior (recupera ancho para la tabla).
- Se integró el checkbox de selección dentro de la columna **Empresa** (se elimina columna angosta vacía).

### 5) Filas más altas (moderado)
- Se incrementó el padding vertical de filas (rango moderado) para soportar Dirección en 2 líneas.

## Implementación
### Backend (soporte Tipo Societe)
- El endpoint de prospectos ahora expone `tipo_societe` (derivado) para filtrar en UI.
- Archivo: `services/central-hub/src/modules/sender/controllers/prospectosController.js`

### Frontend
- Componente principal: `services/central-hub/frontend/src/components/destinatarios/GestionDestinatariosPage.jsx`
- Cambios clave:
  - Layout: de `flex` con panel lateral a `flex-col` con contenedor scrollable.
  - Sticky filters dentro del contenedor con `overflow-y-auto`.
  - Tabla `table-fixed` y Dirección con clamp 2 líneas.

## Criterios de aceptación
- `/prospectos` sin scroll horizontal en escritorio.
- Filtros sticky visibles durante scroll vertical.
- Dirección visible (2 líneas) y accesible completa.
- El panel izquierdo deja de desperdiciar ancho.

## Archivos tocados
- `services/central-hub/src/modules/sender/controllers/prospectosController.js`
- `services/central-hub/frontend/src/components/destinatarios/GestionDestinatariosPage.jsx`
- (si aplica) cualquier archivo de estilos o utilidades tocado durante la implementación.

## Validación rápida
- Desktop: no existe scroll horizontal en `/prospectos`.
- Scroll vertical: filtros permanecen visibles (sticky) dentro del contenedor.
- Dirección visible (2 líneas) y tooltip con texto completo.

## Riesgos / rollback
- Cambio de layout: si afecta operación, revertir el commit de UX-01 para volver al layout previo.
