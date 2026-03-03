# CONSOLIDACIÓN WHATSAPP — PHASE 3 (Listener + Persistence + Dedicated Number)

**DESTINATION PATH (MANDATORY):** `docs/05-REPORTES/2026-03/CONSOLIDACION_WHATSAPP_PHASE_3_2026-03-01.md`

**Fecha:** 2026-03-01  
**Tipo:** Reporte de auditoría y consolidación documental  
**Alcance:** LeadMaster Workspace (workspace-level docs)  
**Estado:** ✅ VERIFIED — Phase 3 CLOSED (pendientes operativos cerrados: número dedicado + QR canon)  

---

## 1) Objetivo

Consolidar el estado documental post-implementación de WhatsApp Phase 3 y detectar:

A) Documentos que deben actualizarse  
B) Documentos que deben crearse  
C) Documentos que ya están correctos  
D) Riesgos de inconsistencia documental

**Regla de trabajo:** Este reporte NO modifica otros documentos; lista cambios requeridos y su prioridad.

---

## 2) Definición de “Phase 3” usada en este reporte

Este reporte usa “Phase 3” como:

- Listener interno en Central Hub (event ingestion)
- Persistencia MySQL de mensajes WhatsApp con idempotencia
- Bridge desde Session Manager hacia Central Hub
- (Declarado por requerimiento) Migración a número dedicado

**Nota:** En documentación constitucional existe una definición de Phase 3 distinta (Prospect Quality). Esto se marca como inconsistencia a resolver.

---

## 3) Baseline de “realidad implementada” (source of truth técnico)

Baseline utilizado para evaluar “desactualizado vs correcto”:

- Existen endpoints internos tipo listener para eventos WhatsApp (IN y opcional OUT).
- Existe persistencia MySQL en tabla unificada `ll_whatsapp_messages` con deduplicación por hash (`message_hash`) (UNIQUE si aplica, o a nivel aplicación).
- Session Manager actúa como productor de eventos (captura de mensajes/acks) y postea al Central Hub.
- Existe guard opcional para endpoints internos mediante header `X-Internal-Token` (además de `Authorization` según el caso).

**Pendientes operativos:** ✅ CERRADOS (Dedicated Number = Sí; QR canon definido).

---

## 3.1) Verificación end-to-end (Listener → Persistencia)

Evidencia verificada de funcionamiento end-to-end (Phase 3):

- Persistencia en MySQL:
  - DB: `iunaorg_dyd`
  - Tabla: `ll_whatsapp_messages`
  - Registros verificados:
    - `id=36` → `direction=IN`, `cliente_id=51`, `ts_wa=2026-03-01 12:48:27`
    - `id=37` → `direction=OUT`, `cliente_id=51`, `ts_wa=2026-03-01 12:49:10`

Nota operativa:

- Los endpoints listener requieren `Authorization: Bearer <jwt>`; si falta token, responden `401` con `"Token no proporcionado"`.

---

## 3.2) Cierre de pendientes operativos (Dedicated Number + QR canon)

- Dedicated Number: ✅ Confirmado (producción usa número dedicado)
- QR canon:
  - UI canónica: https://desarrolloydisenioweb.com.ar/whatsapp
  - API canónica: session-manager GET /qr (JSON)
  - Fallback: session-manager /qr.html (debug/contingencia)

---

## 4) Hallazgos principales (resumen ejecutivo)

- Riesgo si no se mergean/commitean los cambios P0: el contrato HTTP oficial del workspace puede seguir marcando endpoints del listener como “PLANNED” o incompletos.
- Riesgo si no se mergean/commitean los cambios P0: la guía de integración CentralHub↔SessionManager puede contener reglas pre-bridge (por ejemplo, prohibición de escuchar IN en session-manager) y sobreponderar `POST /send`.
- Riesgo si no se mergean/commitean los cambios P0: la auditoría DB de WhatsApp puede describir un estado pre-tabla unificada y no reflejar el schema final implementado.
- Riesgo si no se mergean/commitean los cambios P0: reportes de febrero 2026 pueden mantener detalles ya superados (p.ej. composición del hash de idempotencia y/o stack Venom vs whatsapp-web.js).
- Riesgo si no se actualiza INDEX: hoy existen ADRs en `02-ARQUITECTURA`, pero el índice puede seguir indicando erróneamente que está “vacío”.

---

## 5) A) Documentos que deben actualizarse

> Formato: Documento | Propósito | Problema | Qué actualizar | Prioridad

### 5.1 Contratos (alto impacto)

1) `docs/07-CONTRATOS/Contratos-HTTP-LeadMaster-Workspace.md`
- Propósito: Contrato HTTP oficial (inter-servicios).
- Problema: Estado “PLANNED”/incompleto para listener (y/o faltan requerimientos multi-tenant y seguridad interna).
- Qué actualizar:
  - Marcar `POST /api/listener/incoming-message` como IMPLEMENTED (si aplica) y su payload mínimo.
  - Agregar `cliente_id` como obligatorio y reglas de validación.
  - Definir headers de autenticación interna (p.ej. `X-Internal-Token`) y comportamiento en 401/403.
  - Documentar idempotencia: hash y UNIQUE (sin exponer secretos).
  - Si existe `POST /api/listener/outgoing-message`, formalizarlo del mismo modo.
- Prioridad: **P0**

### 5.2 Integración (alto impacto)

2) `docs/04-INTEGRACION/Integration-CentralHub-SessionManager.md`
- Propósito: Guía de integración y responsabilidades.
- Problema: Reglas pre-bridge (ej. “session-manager MUST NOT listen incoming messages”) y/o canon centrado en `POST /send`.
- Qué actualizar:
  - Flujo real: captura de eventos en session-manager → bridge → listener → persistencia.
  - Separación conceptual:
    - Envío (sender / `POST /send`) ≠ auditoría/persistencia de eventos.
  - Errores esperables del bridge (timeouts, 401/403 por token interno).
- Prioridad: **P0**

3) `docs/04-INTEGRACION/INFORME-FINAL-INTEGRACION-SESSION-MANAGER.md`
- Propósito: “cierre” de integración.
- Problema: Puede estar basado en un estado anterior a Phase 3 consolidada.
- Qué actualizar:
  - Alinear conclusiones finales al contrato vigente: endpoints reales, seguridad interna, y responsabilidades.
- Prioridad: **P1**

### 5.3 Constitucional (alineación estratégica)

4) `docs/01-CONSTITUCIONAL/PROJECT_STATUS.md`
- Propósito: Estado estratégico/operativo por fases.
- Problema: Inconsistencia de nomenclatura de fases vs lo que el equipo llama “Phase 3 WhatsApp”.
- Qué actualizar:
  - Definir si “Phase 3” es Prospect Quality o WhatsApp consolidation (o renombrar formalmente).
  - Estado real: listener+persistence+bridge implementados.
- Prioridad: **P1**

5) `docs/01-CONSTITUCIONAL/PROJECT_REALITY.md`
- Propósito: realidad operativa (verdad incómoda).
- Problema: Declara número personal (no dedicado), lo cual choca con “Dedicated Number Migration” si ya ocurrió.
- Qué actualizar:
  - Confirmar estado del número de producción y actualizar el texto.
- Prioridad: **P1** (depende de confirmación)

6) `docs/01-CONSTITUCIONAL/ARCHITECTURE_STATE_2026_02.md`
- Propósito: freeze “as-is + planned” de arquitectura.
- Problema: Puede contradecir ADR “listener-only” y/o no consolidar el pipeline de persistencia.
- Qué actualizar:
  - Ajustar “as-is” a endpoints y flujos reales.
  - Evitar contradicciones con ADR (ver sección 7).
- Prioridad: **P1**

### 5.4 Base de datos (alto impacto)

7) `docs/DB-AUDIT-WHATSAPP-MESSAGES.md`
- Propósito: auditoría + propuesta de modelo de datos.
- Problema: Está redactado como “a decidir”, pero Phase 3 ya implementó tabla unificada.
- Qué actualizar:
  - Marcar decisión implementada (tabla `ll_whatsapp_messages` existente).
  - Documentar schema final y diferencias vs propuesta.
  - Formalizar la idempotencia (qué compone el hash y por qué).
- Prioridad: **P0**

### 5.5 Reportes de implementación (correcciones puntuales)

8) `docs/05-REPORTES/2026-02/IMPLEMENTACION-LISTENER-PERSISTENCIA-WHATSAPP-2026-02-28.md`
- Propósito: evidencia de implementación.
- Problema: Describe un “pendiente” que ya fue aplicado (p.ej. composición del hash para IN).
- Qué actualizar:
  - Agregar un addendum “Estado final post-fix” y fecha.
- Prioridad: **P2**

9) `docs/05-REPORTES/2026-02/ARQUITECTURA_REVERSE_PROXY_SESSION_MANAGER_2026-02-25.md`
- Propósito: documento de infraestructura “estado actual”.
- Problema: Mezcla stack Venom y reglas de QR/endpoints que pueden no aplicar post-migración.
- Qué actualizar:
  - Si el stack actual es whatsapp-web.js, actualizar secciones de runtime, endpoints y flujo QR.
  - Si el documento es histórico, mover a `99-ARCHIVO/` o marcarlo explícitamente como “superseded”.
- Prioridad: **P1**

10) `docs/00-INDEX/INDEX.md`
- Propósito: navegación oficial de docs.
- Problema: Afirma que `02-ARQUITECTURA` está vacío.
- Qué actualizar:
  - Enlazar `docs/02-ARQUITECTURA/ADR/ADR-2026-02-WHATSAPP-WEB-LISTENER-ONLY.md`.
- Prioridad: **P2**

---

## 6) B) Documentos que deben crearse

1) `docs/02-ARQUITECTURA/WHATSAPP-EVENT-PIPELINE.md` (nuevo documento canónico)
- Propósito: “cómo funciona” en 1 lugar (no un reporte), evitando contradicciones.
- Contenido mínimo:
  - Flujo de eventos IN/OUT
  - Contrato mínimo de payload
  - Seguridad interna (`X-Internal-Token` y/o `Authorization` según aplique)
  - Idempotencia (hash + UNIQUE)
  - Observabilidad: logs/errores esperados

2) `docs/03-INFRAESTRUCTURA/RUNBOOK-WHATSAPP-DEDICATED-NUMBER.md`
- Propósito: runbook operativo para migración/rotación del número.
- Contenido mínimo:
  - Pasos de migración (QR/login, backups, rollback)
  - Checklist de validación
  - Riesgos (bloqueos/ban, pérdida de sesión, dependencia humana)

3) (Opcional pero recomendado) `docs/06-FASES/PHASE-3-WHATSAPP-CONSOLIDATION.md`
- Propósito: si se decide que “Phase 3” oficial es WhatsApp consolidation, crear un doc de fase con scope y cierre.

---

## 7) C) Documentos que ya están correctos (o mayormente correctos)

- `docs/00-INDEX/DOCUMENTATION_RULES.md`
  - Es normativa y sigue aplicando.

- `docs/02-ARQUITECTURA/ADR/ADR-2026-02-WHATSAPP-WEB-LISTENER-ONLY.md`
  - En principio alinea con la dirección “listener-only” (validar que describa también persistencia de OUT sin implicar envío).

---

## 8) D) Riesgos de inconsistencia documental

1) **Riesgo de integración incorrecta**
- Si el contrato marca listener como “PLANNED”, integraciones nuevas pueden apuntar a endpoints equivocados o re-crear funcionalidad.

2) **Riesgo de operación/incident-response erróneo**
- Documentos “estado actual” con Venom vs whatsapp-web.js generan troubleshooting incorrecto.

3) **Riesgo de doble fuente de verdad**
- `POST /send` como “canon” vs “listener-only” como “canon” deriva en estados inconsistentes (entregado/enviado) y reportes inválidos.

4) **Riesgo de roadmap corrupto**
- Phase 3 significa cosas distintas según documento; esto rompe priorización y accountability.

5) **Riesgo comercial/operativo**
- “número personal” vs “número dedicado” afecta expectativas de escalabilidad y dependencia de operador.

---

## 9) Acciones recomendadas (orden sugerido)

1) **Commit + merge** de los cambios P0 ya realizados:
  - `docs/07-CONTRATOS/Contratos-HTTP-LeadMaster-Workspace.md`
  - `docs/04-INTEGRACION/Integration-CentralHub-SessionManager.md`
  - `docs/DB-AUDIT-WHATSAPP-MESSAGES.md`

2) Actualizar/regularizar documentos P1:
  - `docs/04-INTEGRACION/INFORME-FINAL-INTEGRACION-SESSION-MANAGER.md`
  - `docs/01-CONSTITUCIONAL/PROJECT_STATUS.md` (naming de Phase 3)
  - `docs/01-CONSTITUCIONAL/PROJECT_REALITY.md` (número dedicado ya confirmado)
  - `docs/01-CONSTITUCIONAL/ARCHITECTURE_STATE_2026_02.md`

3) Crear documentos canónicos:
  - `docs/02-ARQUITECTURA/WHATSAPP-EVENT-PIPELINE.md`
  - `docs/03-INFRAESTRUCTURA/RUNBOOK-WHATSAPP-DEDICATED-NUMBER.md`

---

## 10) Estado final

Phase 3 WhatsApp Consolidation: ✅ CLOSED

- End-to-end persistence verified (ids 36/37)
- Dedicated number confirmed
- QR canon defined (UI + API + fallback)

Nota: Queda pendiente únicamente el commit/merge de los documentos P0 si aún no se aplicó en main.

---

**Fin del reporte**