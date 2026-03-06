# Phase 5 — Commercial Intelligence (Advanced)

## Status: ⏸️ DEFERRED

**Authority:** `docs/01-CONSTITUCIONAL/PROJECT_STATUS.md` (Phase Structure — Normalized)  
**Scope level:** Workspace-level (`docs/`) — global strategy and cross-module optimization targets  

---

## Objective

Optimize a validated outreach model using real campaign data.

This phase explicitly **does not precede validation**. It is activated only after enough real campaigns exist to make optimization meaningful.

---

## Activation Trigger

Phase 5 can be activated when:
- 10+ validated campaigns completed
- Conversion baseline established
- Sufficient scoring/contactability data exists

---

## Scope

In scope:
- Data-driven optimization loops (based on real outcomes)
- Advanced prioritization beyond minimum gates
- Commercial intelligence insights (segmentation, hypothesis testing, calibration)
- Predictive modeling exploration (only once the baseline is stable)

Out of scope:
- Phase 3 enforcement gates (Prospect Quality) — must be stable first
- Phase 4 WhatsApp session lifecycle automation — can proceed independently, but Phase 5 does not replace it

---

## Deliverables

Expected deliverables when Phase 5 is executed:

1) **Baseline metrics and definitions**
- Canonical definition of conversion / response / incident rates.

2) **Optimization strategy**
- What gets optimized, which signals matter, and how changes are validated.

3) **Commercial intelligence outputs**
- Practical operator-facing outputs (e.g., prioritization lists, recommendations) grounded in measured outcomes.

4) **Governance**
- Clear guardrails that prevent over-automation and prevent optimizing on bad data.

---

## Dependencies

- ✅ Phase 2 — Infrastructure + Auth + SPA + Proxy (Closed)
- 🚧 Phase 3 — Prospect Quality (Active) must be implemented and enforced
- 📋 Phase 4 — WhatsApp Session Lifecycle Automation (Planned) improves operational efficiency but does not replace quality enforcement

---

## Notes

- The detailed scoring/enforcement design belongs to Phase 3 by constitutional definition.
- A legacy draft with mixed scoring + CI content is preserved for reference:
  - `docs/06-FASES/PHASE-5-COMMERCIAL-INTELLIGENCE-LEGACY-DRAFT.md`
