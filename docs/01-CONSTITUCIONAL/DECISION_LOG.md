# DECISION LOG

**Status:** Draft  
**Purpose:** Registro consolidado de decisiones arquitectónicas y técnicas clave (ADR)  
**Last Updated:** 2026-02-21

---

## TBD

Este documento debe consolidar:
- Decisiones arquitectónicas (ADRs)
- Decisiones técnicas críticas
- Contexto y justificación
- Alternativas consideradas

_Contenido pendiente de elaboración._

_Nota: Este documento debe consolidar las decisiones existentes en:_
- `services/central-hub/docs/decisiones/`
- `services/central-hub/docs/decisions/`

---

## 2026-03

- **2026-03-05 — Categorización de Cartera Origen (cartera_origen)**  
  Motivo: `llx_societe.client` indica tipo comercial (cliente/prospecto/proveedor) y no el origen de cartera.  
  Decisión: definir `cartera_origen` como atributo inmutable (set al alta/import) para segmentación.  
  Doc: [DATA_CATEGORIZACION_CARTERA.md](../04-INTEGRACION/DATA_CATEGORIZACION_CARTERA.md)
