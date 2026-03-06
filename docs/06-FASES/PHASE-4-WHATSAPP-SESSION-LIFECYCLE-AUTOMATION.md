# Phase 4 — WhatsApp Session Lifecycle Automation

## Status: 📋 PLANNED

**Authority:** `docs/01-CONSTITUCIONAL/PROJECT_STATUS.md` (Phase Structure — Normalized)

---

## Objective

Automatizar y estabilizar el ciclo de vida de la sesión WhatsApp para reducir carga operativa y aumentar confiabilidad del canal inbound:

- QR lifecycle (generación, expiración, refresh)
- Session persistence (recovery post-restart cuando aplique)
- Session state normalization (transiciones claras y auditables)
- Status visibility (monitoreo visible para operador)
- Connect / disconnect / recovery flow (operativa segura)

---

## Scope

In scope:
- Gestión del QR como recurso operativo (lifecycle completo)
- Persistencia y recuperación de sesión
- Normalización de estados de sesión y sus transiciones
- Visibilidad de estado (no importa el mecanismo; puede ser polling o real-time)
- Flujo operativo de conexión / desconexión / recuperación

Out of scope:
- Prospect Quality scoring/enforcement (Phase 3)
- Commercial Intelligence optimization (Phase 5)
- Especificaciones técnicas locales (endpoints, contratos HTTP, eventos WebSocket, componentes frontend, snippets de código)

---

## Deliverables

1) **Session lifecycle definido a nivel fase**
- Estados y transiciones documentados a nivel conceptual (sin contrato API).

2) **Operativa de conexión confiable**
- Proceso estándar para obtener QR, conectar, desconectar y recuperar sesión.

3) **Visibilidad de estado**
- Un mecanismo de observabilidad operacional (dashboard/indicador) para saber si la sesión está utilizable.

4) **Hardening operativo**
- Manejo de escenarios de error frecuentes (desconexión, QR expirado, reinicios) con comportamiento determinístico.

---

## Dependencies

- ✅ Phase 2 — Infrastructure + Auth + SPA + Proxy (Closed)
- 🚧 Phase 3 — Prospect Quality (Active): esta fase no debe introducir bypass a gates de calidad

---

## Implementation Notes

- Este documento es **workspace-level**: define intención, límites y entregables.
- Detalles de implementación (endpoints, contratos, WebSocket, UI concreta, checklists técnicos) deben vivir en documentación local del servicio correspondiente bajo `services/<service>/docs/`.

---

## Historical Notes

- Este documento fue renombrado desde `PHASE-3-PLAN.md` para alinearse con la numeración constitucional.
- Versiones anteriores contenían una especificación técnica extensa; ese nivel de detalle no corresponde a `docs/06-FASES/`.

---

## Optional References

- Reporte histórico de consolidación (contexto):
  - [CONSOLIDACION_WHATSAPP_PHASE_3_2026-03-01.md](../05-REPORTES/2026-03/CONSOLIDACION_WHATSAPP_PHASE_3_2026-03-01.md)
