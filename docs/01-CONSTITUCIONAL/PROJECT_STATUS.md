# LeadMaster — Official Project Status

**Version:** 3.0  
**Last Updated:** 2026-03-10  
**Environment:** Production (Contabo VPS)  
**Strategic Model:** Service-first (Prospect Generation)  
**Classification:** Constitutional Document  

---

# 1. Strategic Position

LeadMaster is currently a **prospect generation service**, not a SaaS automation platform.

The core value proposition is:

> Deliver technically validated, contactable prospects with real purchase intent.

Automation is secondary.  
Deliverability and quality are primary.

---

# 2. Production Environment Status

## Infrastructure

- VPS: Contabo (Ubuntu)
- Reverse Proxy: Nginx
- SSL: Cloudflare Origin Certificate (Full Strict)
- Protocol: HTTP/2
- Process Manager: PM2
- Internal Port: 3012

## Operational Status

- Production domain active
- JWT authentication stable
- Reverse proxy validated
- End-to-end flow operational
- No critical errors detected

Production is considered **stable**.

---

# 3. Phase Structure (Normalized)

## Phase 1 — Foundation
Architecture and modular structure  
Status: ✅ Closed

## Phase 2 — Infrastructure + Auth + SPA + Proxy
Production deployment and validation  
Status: ✅ Closed

## Phase 3 — Prospect Quality (Current Priority)
Implementation of contactability scoring and validation gates  
Status: 🚧 Active

Objective:
- Block low-quality sends
- Protect deliverability
- Improve response rates

Core Components:
- score_contactabilidad
- validado_tecnicamente flag
- Sender middleware blocking
- Manual validation interface

This phase directly affects revenue quality.

---

## Phase 4 — WhatsApp Session Lifecycle Automation
Operational efficiency improvements  
Status: Planned

Scope:
- Session persistence
- QR lifecycle management
- State machine
- WebSocket status updates

This phase improves internal efficiency but does not change core value.

---

## Phase 4B — Email Prospecting Channel (Foundational Documentation)
Formal definition of the email prospecting channel (operation model, architecture, requirements, and mailer HTTP contract).  
Status: ✅ Approved (documentation package)

Documents:
- `docs/01-CONSTITUCIONAL/ADR-001-CANAL-EMAIL-PROSPECCION-OPERADO-POR-LEADMASTER.md`
- `docs/06-FASES/PHASE-4B-EMAIL-PROSPECTING-PLAN.md`
- `docs/04-INTEGRACION/ARQUITECTURA-CANAL-EMAIL.md`
- `docs/05-REPORTES/OPS/REQUISITOS-MINIMOS-CANAL-EMAIL.md`
- `docs/07-CONTRATOS/Contratos-HTTP-Mailer.md`

---

## Phase 5 — Commercial Intelligence (Advanced)
Data-driven optimization and predictive modeling  
Status: Deferred

Activation Trigger:
- 10+ validated campaigns
- Conversion baseline established
- Sufficient scoring data

This phase optimizes a validated model.  
It does not precede validation.

---

# 4. Service Modules (Current State)

Active:

- auth
- sender
- listener
- session-manager
- sync-contacts

Architecture: Modular Monolith

---

# 5. Strategic Roadmap Alignment

Short Term:
Focus on deliverability and scoring accuracy.

Medium Term:
Reduce manual session handling when operational burden increases.

Long Term:
Optimize with real data, not assumptions.

---

# 6. Risk Model

Primary Risk:
Low-quality outreach damaging deliverability.

Mitigation:
Phase 3 scoring enforcement.

Secondary Risk:
Over-engineering before product-market fit.

Mitigation:
Strict phase gating.

---

# 7. Architectural Principle

LeadMaster evolves in this order:

1. Service validation
2. Quality enforcement
3. Operational efficiency
4. Data optimization
5. Platform consideration

Never the reverse.

---

# 8. Non-Goals (Current Stage)

- Multi-tenant SaaS
- Full automation
- AI-driven predictive scoring
- Complex orchestration systems

Those belong to post-validation phases.

---

# 9. Current Priority

Phase 3 execution.

Deliverability before automation.
Quality before speed.
Validation before scaling.

## Immediate Execution Focus

Within the current project framework, the immediate execution priority is to complete Email as an operational end-to-end MVP capability.

This does not replace the current phase structure. It defines the immediate execution focus within that framework and avoids opening a broader product scope before consolidating an already active line of work.

There is also a subsequent product objective already defined in agenda: a client dashboard for visualization only. That dashboard is not the current priority and must not divert execution focus from completing Email.

In a later stage, its role is limited to visibility over business and delivery information such as available balance, price per delivered lead, searches performed, conversations initiated, delivered leads, and the complete interaction associated with each delivered lead. The client does not operate the machine and does not trigger sends from that dashboard.

---

# Constitutional Note

This document defines the current strategic and operational state of the system.

Any new feature must align with:

- Service-first model
- Deliverability protection
- Phase gating logic
- Risk control discipline

Deviation requires explicit decision entry in DECISION_LOG.md.

---

# 10. 2026-02 Constitutional Milestone — WhatsApp Contract Freeze

Milestone:

- Definido el **target contractual** de la capa WhatsApp (`instance_id` + enums congelados).

Estado de implementación (AS-IS):

- `session-manager` opera como **single-admin** (no hay `instance_id`).
- `POST /send` requiere `cliente_id` (metadata) en el body.
- Estados actuales son legacy/uppercase (`INIT`, `QR_REQUIRED`, `AUTHENTICATED`, `READY`, `DISCONNECTED`, `ERROR`).
- En central-hub existen capas que normalizan/mapean estados y que no están alineadas entre sí.

Documentos normativos:

- [SYSTEM_BOUNDARIES.md](./SYSTEM_BOUNDARIES.md)
- [ARCHITECTURE_STATE_2026_02.md](./ARCHITECTURE_STATE_2026_02.md)
