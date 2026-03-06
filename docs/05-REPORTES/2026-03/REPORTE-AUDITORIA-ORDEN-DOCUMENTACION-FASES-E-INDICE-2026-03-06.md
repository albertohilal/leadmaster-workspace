# REPORTE: Auditoría de orden documental (Fases e Índice)

**Fecha:** 2026-03-06  
**Alcance:** Documentación del workspace (`/docs`) + clasificación de alcance vs documentación local de servicio (`/services/central-hub/docs`)  
**Acción ejecutada:** Auditoría documental (SIN aplicar cambios)

---

## 1. Executive Summary

Se detectaron inconsistencias estructurales y de gobernanza en la capa de **Fases** (`docs/06-FASES/`) y en el **Índice global** (`docs/00-INDEX/INDEX.md`):

- La numeración y semántica de fases en `docs/06-FASES/` **no está alineada** con la definición “Phase Structure (Normalized)” del documento constitucional `docs/01-CONSTITUCIONAL/PROJECT_STATUS.md`.
- Existe **colisión de “Phase 4”**: dos documentos se titulan Phase 4, pero el constitucional define Phase 4 con otro alcance y además define Phase 5 “Commercial Intelligence”.
- El índice global (`docs/00-INDEX/INDEX.md`) **omite** un documento existente dentro de `docs/06-FASES/`.
- Las reglas oficiales (`docs/00-INDEX/DOCUMENTATION_RULES.md`) definen explícitamente separación de alcance: `/docs` (workspace) vs `services/<service>/docs` (service). La estructura local de Central Hub (índice, reports y diagnósticos) está presente y es consistente con ese principio.

---

## 2. Scope & Method

**Se auditó exclusivamente (lectura/inspección):**
- `docs/06-FASES/` (listado + lectura de archivos)
- `docs/00-INDEX/INDEX.md`
- `docs/00-INDEX/DOCUMENTATION_RULES.md`
- `docs/01-CONSTITUCIONAL/PROJECT_STATUS.md`
- `services/central-hub/docs/` (solo clasificación de alcance y estructura; no reordenamiento)

**Restricción cumplida:** no se movió, renombró ni editó ningún archivo. Este reporte solo propone reorganización.

---

## 3. Evidence (extractos con líneas)

### 3.1 Estructura de fases en el constitucional (fuente de verdad)

En `docs/01-CONSTITUCIONAL/PROJECT_STATUS.md`:
- “Phase 3 — Prospect Quality” (prioridad actual) y su alcance: líneas 57–72.
- “Phase 4 — WhatsApp Session Lifecycle Automation” y su alcance: líneas 76–86.
- “Phase 5 — Commercial Intelligence (Advanced)”: líneas 90–100.

Fuente:
- `docs/01-CONSTITUCIONAL/PROJECT_STATUS.md` líneas 47–100.

### 3.2 Colisión Phase 4 + cierre de Phase 3 dentro de `docs/06-FASES/`

En `docs/06-FASES/PHASE-3-PLAN.md`:
- Título: “Phase 4 - WhatsApp Session Lifecycle”: línea 1.
- Aclara que el nombre del archivo se mantiene por compatibilidad: línea 2 y líneas 18–19.
- Declara “Phase 3 (Consolidation) = CLOSED”: línea 6.

Fuente:
- `docs/06-FASES/PHASE-3-PLAN.md` líneas 1–26.

En `docs/06-FASES/PHASE-4-COMMERCIAL-INTELLIGENCE.md`:
- Título: “Phase 4 - Commercial Intelligence & Prospect Scoring”: línea 1.
- Dependencias: “Depends On … Phase 3 (Planned)”: línea 8.

Fuente:
- `docs/06-FASES/PHASE-4-COMMERCIAL-INTELLIGENCE.md` líneas 1–9.

### 3.3 Omisión en el índice global

En `docs/00-INDEX/INDEX.md`:
- La sección “06-FASES” lista 3 archivos (Phase 2, Phase 3 plan, Phase 4 commercial) y no lista el plan del AI Listener.

Fuente:
- `docs/00-INDEX/INDEX.md` líneas 76–83.

### 3.4 Existencia y estado del documento experimental

En `docs/06-FASES/AI-LISTENER-EVOLUTION-PLAN.md`:
- El documento contiene un preámbulo conversacional (“Perfecto… Podés reemplazar…”): líneas 1–10.
- Declara ubicación, estado y fecha: líneas 13–17.

Fuente:
- `docs/06-FASES/AI-LISTENER-EVOLUTION-PLAN.md` líneas 1–17.

### 3.5 Reglas oficiales: separación Workspace vs Service

En `docs/00-INDEX/DOCUMENTATION_RULES.md`:
- Nivel Workspace (`docs/`) y regla: “Only documentation that impacts more than one service belongs here.”: líneas 202–224.
- Prohibición explícita de incluir “Service-specific bug reports / Local diagnostics…” en `docs/`: líneas 225–230.
- Nivel Service (`services/<service>/docs/`) y regla: líneas 233–252.
- Principio: “workspace defines the system; service defines implementation; never duplicate; reference instead”: líneas 271–276.

Fuente:
- `docs/00-INDEX/DOCUMENTATION_RULES.md` líneas 202–276.

---

## 4. Issues Identified (desvíos)

### 4.1 Desalineación de numeración de fases (06-FASES vs PROJECT_STATUS)

- El constitucional define Phase 3 como **Prospect Quality / scoring gates** y Phase 4 como **WhatsApp Session Lifecycle Automation**.
- En `docs/06-FASES/`, el archivo `PHASE-3-PLAN.md` se titula “Phase 4 - WhatsApp Session Lifecycle” (aunque conserva el nombre por compatibilidad).
- En `docs/06-FASES/`, `PHASE-4-COMMERCIAL-INTELLIGENCE.md` se titula “Phase 4 - Commercial Intelligence & Prospect Scoring”, pero el constitucional ubica “Commercial Intelligence” como **Phase 5**, y el scoring/contactability como **Phase 3**.

Evidencia:
- `docs/01-CONSTITUCIONAL/PROJECT_STATUS.md` líneas 57–100.
- `docs/06-FASES/PHASE-3-PLAN.md` líneas 1–19.
- `docs/06-FASES/PHASE-4-COMMERCIAL-INTELLIGENCE.md` líneas 1–9.

### 4.2 Dependencia contradictoria (Phase 3 “CLOSED” vs “Planned”)

- `PHASE-3-PLAN.md` declara Phase 3 “CLOSED”.
- `PHASE-4-COMMERCIAL-INTELLIGENCE.md` depende de “Phase 3 (Planned)”.

Evidencia:
- `docs/06-FASES/PHASE-3-PLAN.md` línea 6.
- `docs/06-FASES/PHASE-4-COMMERCIAL-INTELLIGENCE.md` línea 8.

### 4.3 Índice global incompleto

- `docs/06-FASES/` contiene 4 archivos (incluyendo `AI-LISTENER-EVOLUTION-PLAN.md`).
- `docs/00-INDEX/INDEX.md` lista solo 3 para “06-FASES”, omitiendo AI Listener.

Evidencia:
- Listado real `docs/06-FASES/`: `AI-LISTENER-EVOLUTION-PLAN.md`, `PHASE-2-COMPLETED.md`, `PHASE-3-PLAN.md`, `PHASE-4-COMMERCIAL-INTELLIGENCE.md`.
- `docs/00-INDEX/INDEX.md` líneas 76–83.

### 4.4 Riesgo de “documento de fase” con forma de borrador conversacional

- `AI-LISTENER-EVOLUTION-PLAN.md` incluye texto de instrucción (“Podés reemplazar el documento actual por esto”), lo cual sugiere estado de **borrador** o **artefacto de generación** más que documento normativo consolidado.

Evidencia:
- `docs/06-FASES/AI-LISTENER-EVOLUTION-PLAN.md` líneas 1–10.

---

## 5. Phase Docs Consistency Review (docs/06-FASES)

### 5.1 `PHASE-2-COMPLETED.md`
- Está consistentemente titulada “Phase 2” y declara estado COMPLETED & VALIDATED.
- No se detectó conflicto directo con `PROJECT_STATUS.md` (que también marca Phase 2 como Closed).

Evidencia:
- `docs/06-FASES/PHASE-2-COMPLETED.md` líneas 1–7.
- `docs/01-CONSTITUCIONAL/PROJECT_STATUS.md` líneas 53–55.

### 5.2 `PHASE-3-PLAN.md`
- Contenido y título refieren a Phase 4 (Session Lifecycle), mientras que el nombre de archivo mantiene Phase 3 por compatibilidad.
- Declara Phase 3 como CLOSED.

Evidencia:
- `docs/06-FASES/PHASE-3-PLAN.md` líneas 1–6 y 18–19.

### 5.3 `PHASE-4-COMMERCIAL-INTELLIGENCE.md`
- Se titula Phase 4 e incluye “Prospect Scoring” como parte del alcance.
- Según `PROJECT_STATUS.md`, el scoring/contactability es Phase 3 y “Commercial Intelligence” es Phase 5.

Evidencia:
- `docs/06-FASES/PHASE-4-COMMERCIAL-INTELLIGENCE.md` líneas 1–8.
- `docs/01-CONSTITUCIONAL/PROJECT_STATUS.md` líneas 57–72 y 90–100.

### 5.4 `AI-LISTENER-EVOLUTION-PLAN.md`
- Se presenta como “Activo – Fase Experimental”, pero su forma actual parece un borrador conversacional.
- Existe dentro de `06-FASES/` (por reglas, esto es permitido), pero el índice global no lo incorpora.

Evidencia:
- `docs/06-FASES/AI-LISTENER-EVOLUTION-PLAN.md` líneas 1–17.
- `docs/00-INDEX/DOCUMENTATION_RULES.md` línea 45 (ejemplo explícito de ubicación correcta bajo `06-FASES`).

---

## 6. Global Index Consistency Review (docs/00-INDEX/INDEX.md)

Hallazgos:
- La sección “06-FASES” está desactualizada respecto del contenido real de `docs/06-FASES/`.

Evidencia:
- `docs/00-INDEX/INDEX.md` líneas 76–83.

Riesgo operativo:
- Navegación oficial incompleta → decisiones/planificación basadas en un set parcial.

---

## 7. Scope Level Separation (Workspace `/docs` vs Central Hub `services/central-hub/docs`)

### 7.1 Regla oficial (fuente)

- `docs/` es “Workspace-Level Documentation” y debe contener solo documentación que afecte a más de un servicio.
- `services/<service>/docs/` debe contener diagnósticos, reportes e implementación específica del servicio.
- No debe duplicarse contenido; se debe referenciar entre niveles.

Evidencia:
- `docs/00-INDEX/DOCUMENTATION_RULES.md` líneas 202–276.

### 7.2 Estado observado en Central Hub (estructura local)

- Existe índice local y documentación técnica/operativa en `services/central-hub/docs/INDEX.md`.
- Existe estructura local para reportes y diagnósticos (por ejemplo `services/central-hub/docs/reports/` y `services/central-hub/docs/diagnosticos/`).

Evidencia:
- `services/central-hub/docs/INDEX.md` líneas 1–33 y 118–134.
- Listados observados:
  - `services/central-hub/docs/reports/` (múltiples `INFORME_*`/`IMPLEMENTACION_*`/`AUDITORIA_*`).
  - `services/central-hub/docs/diagnosticos/` (múltiples `DIAGNOSTICO_*`).

Evaluación:
- La capa de documentación local de Central Hub está alineada con la regla de “service defines implementation”.
- El problema principal no es “falta de docs locales”, sino **inconsistencia de fase/índice global**.

---

## 8. Proposed Target State (sin aplicar)

Objetivo: alinear `docs/06-FASES/` y `docs/00-INDEX/INDEX.md` con la fuente constitucional `docs/01-CONSTITUCIONAL/PROJECT_STATUS.md`, manteniendo integridad estructural y la separación workspace vs service.

### 8.1 Normalización de fases (propuesta)

Basado en `PROJECT_STATUS.md`:
- Phase 3 = Prospect Quality (scoring/contactability gates)
- Phase 4 = WhatsApp Session Lifecycle Automation
- Phase 5 = Commercial Intelligence (Advanced)

Acciones propuestas (no ejecutadas):
1) Introducir un documento de Phase 3 real en `docs/06-FASES/` (ej.: `PHASE-3-PROSPECT-QUALITY.md`) con alcance alineado a `PROJECT_STATUS.md`.
2) Renombrar/realinear el documento “Session Lifecycle” hoy contenido en `PHASE-3-PLAN.md` para que sea Phase 4 (título + nombre de archivo). Mantener una nota de compatibilidad si fuera necesario por historial.
3) Mover/renombrar el documento “Commercial Intelligence” a Phase 5 (título + nombre de archivo) y ajustar dependencias para que no contradigan el estado real de Phase 3.

### 8.2 Índice global

Acciones propuestas (no ejecutadas):
- Actualizar `docs/00-INDEX/INDEX.md` sección “06-FASES” para que:
  - Liste los 4 documentos existentes (incluyendo AI Listener) o archive/etiquete el experimental según decisión.
  - Refleje el set final de fases post-normalización (Phase 2/3/4/5) consistente con `PROJECT_STATUS.md`.

### 8.3 AI Listener (fase experimental)

Acciones propuestas (no ejecutadas):
- Decidir si `AI-LISTENER-EVOLUTION-PLAN.md` es:
  - (A) un phase doc válido (entonces debe estar indexado en `docs/00-INDEX/INDEX.md` y escrito en estilo normativo), o
  - (B) un borrador/artefacto (entonces debería archivarse o reescribirse a formato fase).

---

## 9. Recommended Next Steps (operativas, sin cambios automáticos)

Orden recomendado (minimiza riesgo):
1) Confirmar que `docs/01-CONSTITUCIONAL/PROJECT_STATUS.md` es la fuente de verdad vigente para numeración de fases.
2) Definir mapping final (Phase 3/4/5) y nombres de archivo canónicos (kebab/PHASE-N-...).
3) Actualizar primero el contenido de `docs/06-FASES/` (fase docs) y recién después el índice global.
4) Revisar dependencias internas en fase docs (por ejemplo “Phase 3 planned” vs “closed”).
5) Revisar el estado del documento experimental AI Listener (indexar vs archivar vs reescribir).

---

## 10. Appendix: Evidence Snippets (copiados)

### 10.1 Listado observado de `docs/06-FASES/`

```
AI-LISTENER-EVOLUTION-PLAN.md
PHASE-2-COMPLETED.md
PHASE-3-PLAN.md
PHASE-4-COMMERCIAL-INTELLIGENCE.md
```

### 10.2 Índice global — sección 06-FASES (extracto)

Fuente: `docs/00-INDEX/INDEX.md` líneas 76–83.

### 10.3 Phase doc con título Phase 4 pero filename Phase 3 (extracto)

Fuente: `docs/06-FASES/PHASE-3-PLAN.md` líneas 1–2 y 18–19.

### 10.4 Definición oficial de fases (extracto)

Fuente: `docs/01-CONSTITUCIONAL/PROJECT_STATUS.md` líneas 57–100.

---

**Reporte generado:** 2026-03-06  
**Ubicación:** `docs/05-REPORTES/2026-03/REPORTE-AUDITORIA-ORDEN-DOCUMENTACION-FASES-E-INDICE-2026-03-06.md`  
**Cambios aplicados al repo:** Ninguno
