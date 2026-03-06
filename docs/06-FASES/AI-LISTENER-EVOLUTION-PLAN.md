# Experimental Track — AI Listener Evolution Plan (Non-Numbered)

## Status: 🧪 ACTIVE (Experimental)

**Location:** `docs/06-FASES/AI-LISTENER-EVOLUTION-PLAN.md`  
**Date:** 2026-02-24  
**Phase numbering policy:** This document is intentionally **non-numbered**. It does not redefine Phase 1–5.

---

## Objective

Explore a minimal, controlled approach to classify inbound WhatsApp responses (e.g., “wrong person / recycled number”) without contaminating deterministic workflow.

---

## Scope

In scope:
- A closed-category classification taxonomy for inbound text
- Manual-first operational validation (low volume, high review)
- Clear guardrails: classification only, no autonomous actions

Out of scope:
- Any generative system that executes actions
- Any system that modifies core state machines based on probabilistic output
- Introducing new global phase numbering (no “Phase 6”)

---

## Deliverables

1) **Classification taxonomy (v1)**
- Closed labels that are operationally actionable (without automation).

2) **Operational validation protocol**
- How classifications are reviewed, corrected, and measured.

3) **Risk controls**
- Explicit rules preventing the classifier from mutating deterministic states.

---

## Proposed Taxonomy (v1)

Input: inbound message text  
Output: one label from the following closed set:

- `INTERES`
- `NO_INTERES`
- `RECICLADO`
- `CONSULTA_GENERAL`
- `AGRESIVO`
- `INDETERMINADO`

---

## Dependencies

- ✅ Phase 2 — Infrastructure + Auth + SPA + Proxy (Closed)
- 🚧 Phase 3 — Prospect Quality (Active): classification must not bypass quality gates
- 📋 Phase 4 — WhatsApp Session Lifecycle Automation (Planned): improves visibility/operations but is not a prerequisite for classification experiments

---

## Governance Notes

- Architectural principle: deterministic workflow remains the source of truth; AI output is advisory/classification-only.
- Service-level implementation details must live under `services/<service>/docs/`.
