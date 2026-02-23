# Documentation Rules

**Version:** 1.0  
**Status:** Official Norm  
**Last Updated:** 2026-02-21

---

## Official Structure

```
00-INDEX           → Indices and documentation rules
01-CONSTITUCIONAL  → Strategic framework and principles
02-ARQUITECTURA    → Structural design and technical decisions
03-INFRAESTRUCTURA → Servers, SSL, deployment
04-INTEGRACION     → Module connections and integrations
05-REPORTES        → Dated reports (YYYY-MM)
06-FASES           → Project evolution by phases
07-CONTRATOS       → Interfaces and formal agreements
99-ARCHIVO         → Obsolete versions
```

---

## Mandatory Rule

Every generated document must:

1. **Explicitly indicate the destination path**
2. **Be saved directly in the corresponding folder**
3. **Include date if it is a report** (YYYY-MM-DD format)
4. **Not create new folders without approval**

---

## Report Naming Convention

```
docs/05-REPORTES/YYYY-MM/REPORT_NAME_YYYY-MM-DD.md
```

**Example:**
```
docs/05-REPORTES/2026-02/DIAGNOSTICO_SCORING_2026-02-21.md
```

---

## Phase Documentation Convention

```
docs/06-FASES/PHASE-N-NAME.md
```

**Example:**
```
docs/06-FASES/PHASE-3-PROSPECT-QUALITY.md
docs/06-FASES/PHASE-4-SESSION-AUTOMATION.md
```

---

## Constitutional Documents

Location: `docs/01-CONSTITUCIONAL/`

Reserved for:
- PROJECT_STATUS.md (versioned)
- Strategic principles
- Business model definitions
- Decision logs with strategic impact

---

## Architecture Documents

Location: `docs/02-ARQUITECTURA/`

Reserved for:
- System design documents
- Architectural decision records (ADR)
- Module relationships
- Data flow diagrams

---

## Infrastructure Documents

Location: `docs/03-INFRAESTRUCTURA/`

Reserved for:
- Deployment guides
- SSL/TLS configuration
- Server setup
- PM2 process management
- Nginx configuration

---

## Integration Documents

Location: `docs/04-INTEGRACION/`

Reserved for:
- Service integration guides
- External API integrations
- Module communication protocols
- Session Manager integration

---

## Contract Documents

Location: `docs/07-CONTRATOS/`

Reserved for:
- API specifications
- HTTP contracts
- Interface definitions
- SLA agreements (if applicable)

---

## Archive Policy

Location: `docs/99-ARCHIVO/`

Documents are archived when:
- Superseded by newer versions
- No longer applicable to current architecture
- Historical reference only

**Archive naming:**
```
ORIGINAL_NAME_vX.Y.md
```

**Example:**
```
PROJECT_STATUS_TECHNICAL_v2.md
```

---

## Enforcement

This document defines the **official documentation standard** for LeadMaster Workspace.

Any deviation requires:
1. Explicit justification
2. Entry in DECISION_LOG.md
3. Approval from project lead

Non-compliant documentation may be reorganized or archived without notice.

---
---

## Copilot / AI Compliance Rule

When generating documentation using AI tools (Copilot, ChatGPT, etc.):

- The target folder must be explicitly specified in the prompt.
- The file name must follow the official naming convention.
- The AI must not propose alternative folder structures.

All AI-generated documents are subject to architectural review.

**Authority:** Alberto Hilal  
**Effective Date:** 2026-02-21

---

## Documentation Scope Levels

### 1. Workspace-Level Documentation

Location:
```
docs/
```

This directory contains documentation that applies to the entire workspace.

Includes:
- Constitutional framework
- Global architecture
- Infrastructure documentation
- Cross-service integration
- HTTP contracts between services
- Global phase planning
- Governance and decision logs

Rule:
Only documentation that impacts more than one service belongs here.

This directory must NOT contain:
- Service-specific bug reports
- Local diagnostics
- Internal implementation notes
- Temporary operational reports

---

### 2. Service-Level Documentation

Location:
```
services/<service-name>/docs/
```

Each service maintains its own internal documentation.

Includes:
- Diagnostics and debugging reports
- Local implementation notes
- Service-specific architectural details
- Internal refactors
- Module-level guides
- Operational procedures specific to the service

Rule:
If the document affects only one service, it belongs in that service's docs directory.

---

### 3. Anti-Pattern Rule

Markdown files (.md) must NOT be created in service root directories.

Example of incorrect placement:
```
services/central-hub/DIAGNOSTICO_X.md
```

Correct placement:
```
services/central-hub/docs/diagnosticos/DIAGNOSTICO_X.md
```

---

### 4. Governance Principle

The workspace documentation defines the system.
Service documentation defines implementation.

They must never duplicate each other.
They must reference each other instead.
