# REPORTE — Auditoría documental Mailer / Email — 2026-03-15

**Destino (path):** `docs/05-REPORTES/2026-03/REPORTE-AUDITORIA-DOCUMENTAL-MAILER-EMAIL-2026-03-15.md`

---

## 1. Objetivo

Auditar la documentación existente del repositorio `leadmaster-workspace` para verificar:

1. si ya existe documentación previa sobre Mailer / Email
2. si hay contratos HTTP, reportes, planes de fase, arquitectura o README que contradigan la implementación actual
3. qué archivos deben actualizarse para dejar esta fase coherente

---

## 2. Criterio de verdad usado para esta auditoría

Se toma como verdad actual:

- existe un servicio standalone `leadmaster-mailer`
- `central-hub` ya integra mailer vía HTTP
- `central-hub` expone `POST /mailer/send`
- el endpoint requiere JWT
- `cliente_id` se resuelve desde el usuario autenticado, no desde el body del request al hub
- `leadmaster-mailer` resuelve SMTP por cliente desde `iunaorg_dyd.ll_clientes_email_config`
- el flujo fue validado con envío real
- esta fase no incluye dashboard comercial
- esta fase sí deja Email operativo end-to-end en modo prueba

---

## 3. Archivos relevados

- [README.md](/root/leadmaster-workspace/README.md)
  estado: incompleto
  observación breve: enlaza el paquete documental fundacional del canal email, pero no refleja que `central-hub` ya expone el gateway autenticado `POST /mailer/send` ni que existe integración operativa en modo prueba.

- [PROJECT-STATUS.md](/root/leadmaster-workspace/PROJECT-STATUS.md)
  estado: incompleto
  observación breve: documenta la validación del servicio standalone `leadmaster-mailer`, pero no actualiza el estado de integración real entre `central-hub` y `mailer`.

- [services/central-hub/README.md](/root/leadmaster-workspace/services/central-hub/README.md)
  estado: contradicción
  observación breve: no menciona los módulos `email` y `mailer`, omite `POST /mailer/send` y describe partes del servicio con narrativa vieja respecto del estado actual.

- [services/mailer/README.md](/root/leadmaster-workspace/services/mailer/README.md)
  estado: alineado
  observación breve: coincide con el estado real del servicio standalone `leadmaster-mailer`: endpoints `GET /health` y `POST /send`, multi-tenant por `cliente_id`, auditoría y lookup SMTP por `ll_clientes_email_config`.

- [docs/01-CONSTITUCIONAL/ADR-001-CANAL-EMAIL-PROSPECCION-OPERADO-POR-LEADMASTER.md](/root/leadmaster-workspace/docs/01-CONSTITUCIONAL/ADR-001-CANAL-EMAIL-PROSPECCION-OPERADO-POR-LEADMASTER.md)
  estado: alineado
  observación breve: sigue siendo válido como documento constitucional. No entra en detalles técnicos que contradigan la implementación actual.

- [docs/01-CONSTITUCIONAL/PROJECT_STATUS.md](/root/leadmaster-workspace/docs/01-CONSTITUCIONAL/PROJECT_STATUS.md)
  estado: incompleto
  observación breve: deja Phase 4B en estado documental aprobado, pero no refleja el avance a integración operativa real en modo prueba.

- [docs/04-INTEGRACION/ARQUITECTURA-CANAL-EMAIL.md](/root/leadmaster-workspace/docs/04-INTEGRACION/ARQUITECTURA-CANAL-EMAIL.md)
  estado: incompleto
  observación breve: la arquitectura conceptual sigue siendo válida, pero no documenta el estado actual concreto del hub: JWT obligatorio, `cliente_id` resuelto desde auth, gateway `POST /mailer/send` y flujo operativo actual.

- [docs/05-REPORTES/OPS/REQUISITOS-MINIMOS-CANAL-EMAIL.md](/root/leadmaster-workspace/docs/05-REPORTES/OPS/REQUISITOS-MINIMOS-CANAL-EMAIL.md)
  estado: alineado
  observación breve: documento operativo/comercial. No contradice la implementación actual del módulo Mailer / Email.

- [docs/06-FASES/PHASE-4B-EMAIL-PROSPECTING-PLAN.md](/root/leadmaster-workspace/docs/06-FASES/PHASE-4B-EMAIL-PROSPECTING-PLAN.md)
  estado: incompleto
  observación breve: describe la fase como fundacional/documental y no distingue el contrato del standalone mailer del gateway autenticado actual de `central-hub`.

- [docs/07-CONTRATOS/Contratos-HTTP-Mailer.md](/root/leadmaster-workspace/docs/07-CONTRATOS/Contratos-HTTP-Mailer.md)
  estado: contradicción
  observación breve: sí existe contrato formal del mailer standalone, pero está incompleto/truncado pese a figurar como `APPROVED`. Además, no documenta el gateway autenticado de `central-hub`.

- [docs/05-REPORTES/2026-03/REPORTE-MAILER-PERSISTENCIA-ENVIOS-EMAIL-2026-03-11.md](/root/leadmaster-workspace/docs/05-REPORTES/2026-03/REPORTE-MAILER-PERSISTENCIA-ENVIOS-EMAIL-2026-03-11.md)
  estado: alineado
  observación breve: describe correctamente la auditoría en `ll_envios_email` y el comportamiento del servicio standalone.

- [docs/05-REPORTES/2026-03/REPORTE-MAILER-SMTP-MULTITENANT-POR-CLIENTE-2026-03-11.md](/root/leadmaster-workspace/docs/05-REPORTES/2026-03/REPORTE-MAILER-SMTP-MULTITENANT-POR-CLIENTE-2026-03-11.md)
  estado: alineado
  observación breve: coincide con la implementación actual del standalone mailer: lookup en `ll_clientes_email_config`, fallback opcional y auditoría.

- [docs/05-REPORTES/2026-03/REPORTE-VALIDACION-SMTP-MAILER-2026-03-11.md](/root/leadmaster-workspace/docs/05-REPORTES/2026-03/REPORTE-VALIDACION-SMTP-MAILER-2026-03-11.md)
  estado: alineado
  observación breve: valida correctamente el servicio `leadmaster-mailer` como standalone. No cubre la integración posterior de `central-hub`, pero no la contradice.

- [docs/05-REPORTES/2026-03/REPORTE-ESTADO-INTEGRACION-MAILER-CENTRAL-HUB-2026-03-14.md](/root/leadmaster-workspace/docs/05-REPORTES/2026-03/REPORTE-ESTADO-INTEGRACION-MAILER-CENTRAL-HUB-2026-03-14.md)
  estado: contradicción
  observación breve: hoy quedó desactualizado en puntos centrales. Afirma que no existe integración real en `central-hub` y que la integración hub↔mailer no está implementada, lo que ya no coincide con el código actual.

---

## 4. Contradicciones concretas detectadas

### 4.1 Reporte de estado de integración desactualizado

Archivo:
- [docs/05-REPORTES/2026-03/REPORTE-ESTADO-INTEGRACION-MAILER-CENTRAL-HUB-2026-03-14.md](/root/leadmaster-workspace/docs/05-REPORTES/2026-03/REPORTE-ESTADO-INTEGRACION-MAILER-CENTRAL-HUB-2026-03-14.md)

Contradicciones:
- afirma que en `central-hub` no se encontró integración real implementada con mailer
- afirma que no hay cliente HTTP hacia `leadmaster-mailer`
- afirma que no hay rutas o módulos de email/mailer en `central-hub`
- concluye que la integración `central-hub` ↔ `leadmaster-mailer` está “NO IMPLEMENTADA”

Estado real hoy:
- existe integración HTTP en `services/central-hub/src/integrations/mailer/`
- existe módulo `mailer` en `services/central-hub/src/modules/mailer/`
- existe endpoint autenticado `POST /mailer/send`
- `cliente_id` se resuelve desde JWT en el hub

### 4.2 Contrato HTTP del mailer aprobado pero incompleto

Archivo:
- [docs/07-CONTRATOS/Contratos-HTTP-Mailer.md](/root/leadmaster-workspace/docs/07-CONTRATOS/Contratos-HTTP-Mailer.md)

Contradicción:
- el documento figura como `APPROVED`, pero en el repo está truncado y no deja consumible el contrato completo

Impacto:
- no sirve como punto de verdad único para integración
- no deja claro request/response completos del standalone `mailer`
- no cubre el gateway autenticado de `central-hub`

### 4.3 README de Central Hub desalineado con módulos actuales

Archivo:
- [services/central-hub/README.md](/root/leadmaster-workspace/services/central-hub/README.md)

Contradicciones:
- no enumera módulos `email` y `mailer`
- no menciona `POST /mailer/send`
- conserva descripción estructural vieja para frontend y documentación interna

---

## 5. Hallazgos de incompletitud relevantes

### 5.1 Estado operativo global insuficiente

Archivos:
- [README.md](/root/leadmaster-workspace/README.md)
- [PROJECT-STATUS.md](/root/leadmaster-workspace/PROJECT-STATUS.md)
- [docs/01-CONSTITUCIONAL/PROJECT_STATUS.md](/root/leadmaster-workspace/docs/01-CONSTITUCIONAL/PROJECT_STATUS.md)

Observación:
- reflejan fase fundacional o validación standalone del mailer, pero no el estado actual de Email operativo end-to-end en modo prueba desde `central-hub`

### 5.2 Arquitectura y fase aún expresadas como “conceptual / fundacional”

Archivos:
- [docs/04-INTEGRACION/ARQUITECTURA-CANAL-EMAIL.md](/root/leadmaster-workspace/docs/04-INTEGRACION/ARQUITECTURA-CANAL-EMAIL.md)
- [docs/06-FASES/PHASE-4B-EMAIL-PROSPECTING-PLAN.md](/root/leadmaster-workspace/docs/06-FASES/PHASE-4B-EMAIL-PROSPECTING-PLAN.md)

Observación:
- siguen válidos como dirección, pero quedaron incompletos frente a la implementación actual del gateway autenticado del hub y el flujo de prueba operativo

---

## 6. Qué documentos hay que actualizar sí o sí

Lista priorizada:

1. [docs/05-REPORTES/2026-03/REPORTE-ESTADO-INTEGRACION-MAILER-CENTRAL-HUB-2026-03-14.md](/root/leadmaster-workspace/docs/05-REPORTES/2026-03/REPORTE-ESTADO-INTEGRACION-MAILER-CENTRAL-HUB-2026-03-14.md)
   motivo: hoy contradice de forma directa la implementación real.

2. [docs/07-CONTRATOS/Contratos-HTTP-Mailer.md](/root/leadmaster-workspace/docs/07-CONTRATOS/Contratos-HTTP-Mailer.md)
   motivo: es el contrato formal existente y está truncado/incompleto.

3. [docs/04-INTEGRACION/ARQUITECTURA-CANAL-EMAIL.md](/root/leadmaster-workspace/docs/04-INTEGRACION/ARQUITECTURA-CANAL-EMAIL.md)
   motivo: debe reflejar que el hub ya integra mailer y exponer el estado real de la frontera hub↔mailer.

4. [docs/06-FASES/PHASE-4B-EMAIL-PROSPECTING-PLAN.md](/root/leadmaster-workspace/docs/06-FASES/PHASE-4B-EMAIL-PROSPECTING-PLAN.md)
   motivo: debe dejar de describir la etapa solo como documental/fundacional.

5. [PROJECT-STATUS.md](/root/leadmaster-workspace/PROJECT-STATUS.md)
   motivo: es punto de verdad operativo y debe reflejar el estado real del canal Email.

6. [README.md](/root/leadmaster-workspace/README.md)
   motivo: puerta de entrada del repo; hoy no refleja la integración ya operativa en modo prueba.

7. [services/central-hub/README.md](/root/leadmaster-workspace/services/central-hub/README.md)
   motivo: quedó viejo respecto de la estructura modular y endpoints actuales.

---

## 7. Contrato formal del mailer

Conclusión explícita:

- sí existe contrato formal del mailer standalone: [docs/07-CONTRATOS/Contratos-HTTP-Mailer.md](/root/leadmaster-workspace/docs/07-CONTRATOS/Contratos-HTTP-Mailer.md)
- ese contrato hoy está incompleto/truncado
- no se encontró contrato formal específico del gateway autenticado de `central-hub` para `POST /mailer/send`

---

## 8. Propuesta documental para esta fase

### Documento principal de fase

Nombre propuesto:
- `docs/05-REPORTES/2026-03/REPORTE-INTEGRACION-END-TO-END-EMAIL-CENTRAL-HUB-MAILER-2026-03-15.md`

Razón:
- sigue la convención real del repo para reportes fechados
- permite dejar evidencia del estado operativo real ya validado
- sirve como puente entre reportes standalone del mailer y actualización de arquitectura/contratos

### Documento contractual complementario recomendado

Nombre propuesto:
- `docs/07-CONTRATOS/Contratos-HTTP-Central-Hub-Mailer-Gateway.md`

Razón:
- hoy existen dos fronteras distintas:
  - contrato del standalone `leadmaster-mailer`: `POST /send`
  - contrato expuesto por `central-hub`: `POST /mailer/send` con JWT y `cliente_id` resuelto desde auth
- mezclar ambos contratos en un solo documento introduce ambigüedad

---

## 9. Conclusión

El repositorio ya tenía documentación relevante y abundante sobre Mailer / Email.

Estado general observado:

- el standalone `leadmaster-mailer` está bien documentado en reportes técnicos y README
- la arquitectura y la fase del canal email existen y siguen siendo útiles
- la mayor desalineación actual está en la documentación del estado de integración con `central-hub`
- el contrato HTTP del mailer existe, pero hoy no puede considerarse punto de verdad suficiente porque está truncado

La fase documental siguiente debe concentrarse en:

1. corregir contradicciones sobre el estado real de integración
2. cerrar el contrato formal del standalone `mailer`
3. documentar explícitamente el gateway autenticado `POST /mailer/send` de `central-hub`
