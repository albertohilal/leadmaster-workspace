# Phase 3 — Prospect Quality (Contactability Scoring + Validation Gates)

## Status: 🚧 ACTIVE (Current Priority)

**Authority:** `docs/01-CONSTITUCIONAL/PROJECT_STATUS.md` (Phase Structure — Normalized)  
**Scope level:** Workspace-level (`docs/`) — applies to sender policy and global quality governance  

---

## Objective

Protect deliverability and improve response rates by enforcing **prospect quality gates** before any outbound action.

---

## Scope

This phase defines and implements the **minimum quality enforcement layer** required before scaling outreach.

In scope:
- Contactability scoring (`score_contactabilidad`)
- Technical validation flags (e.g., `validado_tecnicamente`)
- Sender-side enforcement (“block low-quality sends”)
- Manual validation workflow (operator UI/ops)
- Auditability of scoring decisions (traceable, timestamped)

Out of scope:
- WhatsApp session lifecycle automation (belongs to Phase 4)
- Advanced commercial optimization / predictive modeling (belongs to Phase 5)

---

## Deliverables

Minimum expected deliverables for Phase 3 completion:

1) **Data model (workspace-consistent)**
- A persistent place to store scoring/validation data associated to prospects.

2) **Scoring calculation rules (v1)**
- Explicit definition of how `score_contactabilidad` is calculated.

3) **Enforcement gates in sender path**
- A deterministic rule set that blocks outbound actions when quality criteria are not met.

4) **Operator workflow**
- A way for an operator to review/override/validate prospects (manual validation interface).

5) **Audit trail**
- Ability to explain why a prospect was allowed/blocked.

---

## Dependencies

- ✅ Phase 2 — Infrastructure + Auth + SPA + Proxy (Closed)
- ✅ Core modules (sender/listener/auth) operational baseline

---

## Implementation Notes

This document defines the *phase intent and canonical boundaries*.

Implementation specifics (service-level details, queries, controller-level design, internal refactors, diagnostics) must live in the corresponding service documentation (e.g., `services/central-hub/docs/`).

---

## Historical Notes

- Phase numbering and conceptual boundaries are governed by `docs/01-CONSTITUCIONAL/PROJECT_STATUS.md`.
- Any legacy phase documents that mixed scoring, session lifecycle, and commercial intelligence must be normalized so each phase doc matches the constitutional definition.
