# Documentation Index

**LeadMaster Workspace — Central Documentation Hub**

**Last Updated:** 2026-03-06  
**Version:** 2.3  
**Official Rules:** [DOCUMENTATION_RULES.md](DOCUMENTATION_RULES.md)

---

## 00-INDEX — Documentation Rules

📋 [DOCUMENTATION_RULES.md](DOCUMENTATION_RULES.md) — Official documentation standard

---

## 01-CONSTITUCIONAL — Strategic Framework

_Documents that define project identity, business model, and decision history_

**Core:**
- [README.md](../../README.md)
- [PROJECT_REALITY.md](../01-CONSTITUCIONAL/PROJECT_REALITY.md)
- [BUSINESS_ENGINE.md](../01-CONSTITUCIONAL/BUSINESS_ENGINE.md)
- [SYSTEM_BOUNDARIES.md](../01-CONSTITUCIONAL/SYSTEM_BOUNDARIES.md)
- [DECISION_LOG.md](../01-CONSTITUCIONAL/DECISION_LOG.md)
- [PR_INSTRUCTIONS.md](../01-CONSTITUCIONAL/PR_INSTRUCTIONS.md)

**ADRs:**
- [ADR-001 — Canal Email de Prospección Operado por LeadMaster](../01-CONSTITUCIONAL/ADR-001-CANAL-EMAIL-PROSPECCION-OPERADO-POR-LEADMASTER.md)

**Versioned (Official Authority):**
- [PROJECT_STATUS.md v3.0](../01-CONSTITUCIONAL/PROJECT_STATUS.md) — Strategic and operational state
- [ARCHITECTURE_STATE_2026_02.md](../01-CONSTITUCIONAL/ARCHITECTURE_STATE_2026_02.md) — WhatsApp contract (as-is + planned freeze)

---

## 02-ARQUITECTURA — System Design

_Architectural patterns, technical decisions, and structural blueprints_

_(Empty - to be populated)_

---

## 03-INFRAESTRUCTURA — Deployment & Operations

_SSL, servers, PM2, Nginx, and operational guides_

- [SSL-Cloudflare-Setup.md](../03-INFRAESTRUCTURA/SSL-Cloudflare-Setup.md)
- [Checklist-Post-SSL.md](../03-INFRAESTRUCTURA/Checklist-Post-SSL.md)

---

## 04-INTEGRACION — Module Connections

_Integration guides between services and external systems_

- [Integration-CentralHub-SessionManager.md](../04-INTEGRACION/Integration-CentralHub-SessionManager.md)
- [INFORME-FINAL-INTEGRACION-SESSION-MANAGER.md](../04-INTEGRACION/INFORME-FINAL-INTEGRACION-SESSION-MANAGER.md)
- [ARQUITECTURA-CANAL-EMAIL.md](../04-INTEGRACION/ARQUITECTURA-CANAL-EMAIL.md) — Arquitectura funcional del canal email

---

## 05-REPORTES — Dated Reports

_Diagnostic reports, implementation reports, and technical analyses_

**Structure:** `05-REPORTES/YYYY-MM/REPORT_NAME_YYYY-MM-DD.md`

**Exceptions:** `05-REPORTES/UX/` — UX workstream reports (non-dated, iterative)
**Exceptions:** `05-REPORTES/OPS/` — OPS workstream reports (non-dated, iterative)

- [2026-02/](../05-REPORTES/2026-02/) — February 2026 reports
- [OPS/OPS-POST-ENVIO-01-CLASIFICACION-DEPURADORA.md](../05-REPORTES/OPS/OPS-POST-ENVIO-01-CLASIFICACION-DEPURADORA.md) — OPS-POST-ENVIO-01 — Clasificación Post-Envío (Depuradora)
- [UX/UX-01-PROSPECTOS-CERO-SCROLL-HORIZONTAL-STICKY-FILTROS.md](../05-REPORTES/UX/UX-01-PROSPECTOS-CERO-SCROLL-HORIZONTAL-STICKY-FILTROS.md) — UX-01 — Prospectos: Cero Scroll Horizontal + Sticky Filters + Layout Operador
- [OPS/REQUISITOS-MINIMOS-CANAL-EMAIL.md](../05-REPORTES/OPS/REQUISITOS-MINIMOS-CANAL-EMAIL.md) — Requisitos mínimos para activar el canal email

---

## 06-FASES — Project Phases

_Phase documentation, milestones, and roadmaps_

- [PHASE-2-COMPLETED.md](../06-FASES/PHASE-2-COMPLETED.md)
- [PHASE-3-PROSPECT-QUALITY.md](../06-FASES/PHASE-3-PROSPECT-QUALITY.md)
- [PHASE-4-WHATSAPP-SESSION-LIFECYCLE-AUTOMATION.md](../06-FASES/PHASE-4-WHATSAPP-SESSION-LIFECYCLE-AUTOMATION.md)
- [PHASE-4B-EMAIL-PROSPECTING-PLAN.md](../06-FASES/PHASE-4B-EMAIL-PROSPECTING-PLAN.md) — Email Prospecting Channel (documentación fundacional)
- [PHASE-5-COMMERCIAL-INTELLIGENCE.md](../06-FASES/PHASE-5-COMMERCIAL-INTELLIGENCE.md)
- [AI-LISTENER-EVOLUTION-PLAN.md](../06-FASES/AI-LISTENER-EVOLUTION-PLAN.md) — Experimental (non-numbered)

---

## 07-CONTRATOS — API Specifications

_HTTP contracts, interface definitions, and formal agreements_

- [Contratos-HTTP-LeadMaster-Workspace.md](../07-CONTRATOS/Contratos-HTTP-LeadMaster-Workspace.md)
- [Contratos-HTTP-Mailer.md](../07-CONTRATOS/Contratos-HTTP-Mailer.md) — Contrato HTTP/JSON `central-hub` ↔ `mailer`

---

## 99-ARCHIVO — Obsolete Versions

_Superseded documentation and historical references_

- [PROJECT_STATUS_TECHNICAL_v2.md](../99-ARCHIVO/PROJECT_STATUS_TECHNICAL_v2.md)

---

**Note:** This index follows the official structure defined in [DOCUMENTATION_RULES.md](DOCUMENTATION_RULES.md).
