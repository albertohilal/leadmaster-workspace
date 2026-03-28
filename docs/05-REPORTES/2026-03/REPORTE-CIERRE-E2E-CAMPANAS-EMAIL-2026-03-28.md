# Reporte — Cierre E2E Campañas Email

**Tipo:** Reporte de cierre técnico-operativo  
**Plano:** AS-IS IMPLEMENTADO  
**Fecha:** 2026-03-28  
**Autor:** Alberto Hilal  
**Workspace:** LeadMaster  
**Nivel de certeza:** Alto — evidencia directa en DB, consistencia con implementación vigente y recepción real

---

## 1. Objetivo

Documentar el cierre técnico-operativo de la validación end-to-end de campañas Email como flujo persistido dentro de LeadMaster, a partir de la ejecución real realizada el 2026-03-28.

Este reporte cubre:

- la evidencia operativa directa de la validación E2E del 2026-03-28
- la cadena técnica completa ejecutada de punta a punta
- la evaluación de las condiciones de cierre definidas por Phase 4B — Campaigns by Channel Alignment, considerando evidencia acumulada y la validación de esta fecha
- un hallazgo preliminar de desalineación de timezone entre distintas referencias horarias de la cadena operativa (Node.js, MySQL remoto y percepción local del operador)
- los follow-ups residuales que quedan abiertos sin bloquear el cierre funcional

---

## 2. Evidencia operativa

### 2.1 Campaña validada

| Campo | Valor |
|---|---|
| Tabla | `ll_campanias_email` |
| ID campaña | 4 |
| Nombre | E2E Persistencia Email 2026-03-28 |
| Estado final | `finalizado` |
| `fecha_inicio_envio` | 2026-03-28 09:14:20 |
| `fecha_fin_envio` | 2026-03-28 09:15:12 |
| `total_destinatarios` | 2 |
| `total_enviados` | 2 |
| `total_fallidos` | 0 |

### 2.2 Envíos individuales

| Campo | Envío id=28 | Envío id=29 |
|---|---|---|
| Tabla | `ll_envios_email` | `ll_envios_email` |
| Status | `SENT` | `SENT` |
| `scheduled_for` | 2026-03-28 09:14:16 | 2026-03-28 09:15:07 |
| `processing_started_at` | 2026-03-28 09:14:20 | 2026-03-28 09:15:09 |
| `attempt_count` | 1 | 1 |
| `message_id` | presente | presente |

### 2.3 Recepción real

- se confirmó recepción real en bandejas controladas visualizadas vía Gmail
- la recepción fue confirmada visualmente por el operador

---

## 3. Cadena técnica validada

La cadena completa validada de punta a punta es:

```
create campaña → addRecipients → prepare → scheduler secuencial → mailer (SMTP) → SENT → finalize campaña
```

Detalle por eslabón:

| Eslabón | Componente | Archivo | Verificado |
|---|---|---|---|
| Create campaña | `emailCampaigns.controller.js` / `emailCampaigns.service.js` | `services/central-hub/src/modules/email/` | Sí — campaña id=4 persistida en `ll_campanias_email` |
| Add recipients | `emailCampaignRecipients.service.js` | `services/central-hub/src/modules/email/services/` | Sí — 2 filas insertadas en `ll_envios_email` |
| Prepare | `emailCampaignPrepare.service.js` | `services/central-hub/src/modules/email/services/` | Sí — sender resuelto desde `ll_clientes_email_config`, primer destinatario agendado |
| Scheduler secuencial | `emailCampaigns.scheduler.js` | `services/central-hub/src/modules/email/services/` | Sí — procesamiento uno a uno con delay observable (~49s entre envíos) |
| Mailer SMTP | `leadmaster-mailer` standalone | `services/mailer/` | Sí — `message_id` presente en ambos rows, integración vía `envio_email_id` |
| Finalización automática | `emailCampaignStats.service.js` → `finalizeCampaignIfCompleted` | `services/central-hub/src/modules/email/services/` | Sí — campaña en estado `finalizado` con stats correctos |

---

## 4. Evaluación de condiciones de cierre Phase 4B

El documento `docs/06-FASES/PHASE-4B-CAMPAIGNS-BY-CHANNEL-ALIGNMENT-PLAN.md` define 7 condiciones de cierre. La evaluación siguiente considera tanto la evidencia acumulada en reportes previos como la validación E2E del 2026-03-28.

| # | Condición | Estado | Evidencia |
|---|---|---|---|
| 1 | La documentación deja asentado que la campaña define el canal | Se considera cumplida según evidencia acumulada | ADR-001, Phase 4B docs, hardening semántico 2026-03-27 |
| 2 | La UI no induce lectura neutral de campaña | Cumplida con observaciones | Botones diferenciados, banner de modo manual (`REPORTE-HARDENING-SEMANTICO-UI-EMAIL-2026-03-27.md`). Quedan affordances residuales de pulido (G-1, G-2) que no inducen lectura neutral pero tampoco están completamente cerradas |
| 3 | Las acciones dependen del tipo de campaña seleccionada | Se considera cumplida según evidencia acumulada | `useEmailCampaignSelector` condiciona el flujo completo. Los affordances residuales no habilitan acciones incompatibles con el flujo canónico |
| 4 | El flujo WhatsApp sigue con lógica propia | No invalidada por la validación E2E actual | Sin regresión detectada en PR #35 ni posterior. No se realizó verificación exhaustiva del flujo WhatsApp en esta instancia |
| 5 | El flujo Email orientado a campaña, no composición libre | Cumplida | Create → recipients → prepare → scheduler es el flujo canónico operativo validado el 2026-03-28 |
| 6 | Mecanismo manual libre tratado como transitorio | Cumplida | Modal explícitamente etiquetado "Envío manual Email (sin campaña)" desde hardening 2026-03-27 |
| 7 | Operación diaria alineada con modelo documental | Cumplida | E2E validado con campaña persistida id=4, 2 envíos SENT, finalización automática |

**Conclusión:** las 7 condiciones de cierre se consideran satisfechas. Las condiciones 2 y 3 presentan observaciones de pulido (affordances G-1, G-2) que no representan bloqueo funcional pero quedan registradas como deuda de refinamiento operativo.

---

## 5. Hallazgo: desalineación de timezone

### Descripción

El envío id=28 registró `processing_started_at = 2026-03-28 09:14:20` en DB, pero el correo llegó al destinatario a las 10:14 hora local percibida.

La diferencia observada es de aproximadamente 1 hora.

### Diagnóstico preliminar

La evidencia y la revisión preliminar sugieren los siguientes factores que podrían contribuir a la desalineación:

- `toMySqlDateTime()` en `emailCampaignPrepare.service.js` usa `date.getHours()`, que retorna la hora local del proceso Node.js
- durante la validación operativa se trabajó con una referencia horaria compatible con `America/Argentina/Buenos_Aires` (UTC-3) en el entorno del proceso Node.js
- el scheduler usa `NOW()` de MySQL para campos como `processing_started_at`, `locked_at` y `last_attempt_at`, cuyo valor depende de la configuración de timezone del servidor MySQL remoto (`sv46.byethost46.org`, iFastNet)
- no se observó configuración explícita de `TZ` en `ecosystem.config.js` ni parámetro de timezone en la conexión a DB

La hipótesis más razonable es que el proceso Node.js y el MySQL remoto operan con referencias de timezone distintas, lo cual produce el desplazamiento observado en los timestamps persistidos. No se verificó de forma concluyente la configuración de timezone del MySQL remoto ni si existen otros factores intermedios (headers SMTP, cliente de correo del destinatario) que contribuyan a la diferencia percibida.

### Impacto operativo

- **no afectó la correctitud del envío**: 2/2 SENT con recepción real confirmada
- **no afectó la secuencia del scheduler**: el delay entre envíos fue coherente (~49s)
- **puede afectar la percepción de hora del operador** si compara timestamps de DB contra hora local o contra hora de recepción en el cliente de correo

### Clasificación

**Fuera del alcance de esta fase.**

La corrección requiere definir una política de timezone explícita para toda la cadena (Node.js, conexión MySQL, persistencia), lo cual excede el alcance del cierre funcional de campañas E2E.

Este hallazgo no bloquea el cierre funcional de la etapa.

### Recomendaciones para follow-up

- verificar la configuración de timezone efectiva del MySQL remoto
- definir política única de timezone para la capa de datos y backend (preferiblemente UTC)
- evaluar agregar parámetro `timezone` en la conexión MySQL del pool de `central-hub`
- limitar la conversión a hora local a la capa de presentación (frontend)
- documentar la convención resultante como parte de la infraestructura operativa

---

## 6. Follow-ups no bloqueantes

| # | Tema | Severidad | Origen |
|---|---|---|---|
| 1 | Desalineación de timezone VPS vs MySQL remoto | Baja | Este reporte, sección 5 |
| 2 | Affordance G-1: botón "Agregar a Campaña" genérico en modo Email | Media | `ANALISIS-AFFORDANCES-UI-EMAIL-ETAPA5-2026-03-27.md` |
| 3 | Affordance G-2: "Clasificar post-envío" con opciones WhatsApp visible en modo Email | Media | `ANALISIS-AFFORDANCES-UI-EMAIL-ETAPA5-2026-03-27.md` |
| 4 | Cobertura y enriquecimiento de emails útiles en la base de prospectos | Estratégica | `PHASE-4B-EMAIL-PROSPECTING-PLAN.md` |
| 5 | Pulido editorial de affordances secundarias (M-2, M-4, P-3) | Baja | `ANALISIS-AFFORDANCES-UI-EMAIL-ETAPA5-2026-03-27.md` |

### Nota sobre affordances residuales de UI

Los ítems 2, 3 y 5 corresponden a deuda de pulido semántico y operativo de la interfaz. Ninguno de ellos afecta el flujo canónico validado: campaña → recipients → prepare → scheduler → mailer → finalización. El operador puede completar una campaña Email de punta a punta sin que estas affordances residuales interfieran con la operación ni induzcan una acción incorrecta sobre el canal.

Su resolución mejorará la claridad de la UI para un operador nuevo o para el uso prolongado del sistema, pero no condiciona el cierre funcional de esta etapa.

Ninguno de estos follow-ups invalida el cierre de la validación E2E ni la satisfacción de las condiciones de cierre de Phase 4B.

---

## 7. Documentos auditados

| Documento | Estado de alineación post-cierre |
|---|---|
| `docs/01-CONSTITUCIONAL/PROJECT_STATUS.md` | Pendiente de actualización — debe reflejar E2E validado |
| `docs/06-FASES/PHASE-4B-CAMPAIGNS-BY-CHANNEL-ALIGNMENT-PLAN.md` | Pendiente de actualización — debe pasar a COMPLETED |
| `docs/06-FASES/PHASE-4B-EMAIL-PROSPECTING-PLAN.md` | Pendiente de actualización — subfase técnica cerrada, fase general sigue parcial por datos |
| `docs/04-INTEGRACION/ARQUITECTURA-CANAL-EMAIL.md` | Pendiente de actualización — debe reflejar validación operativa real |
| `docs/07-CONTRATOS/Contratos-HTTP-Mailer.md` | Alineado — no requiere cambios |

---

## 8. Conclusión

La cadena completa de campañas Email — desde la creación de campaña hasta la finalización automática con envío real recibido en Gmail — quedó validada end-to-end el 2026-03-28 con evidencia directa en base de datos y recepción real confirmada.

Las 7 condiciones de cierre definidas por el plan Phase 4B — Campaigns by Channel Alignment se consideran satisfechas. Dos de ellas presentan observaciones de pulido semántico de UI que no representan bloqueo funcional.

El hallazgo de desalineación de timezone queda documentado como follow-up técnico de infraestructura, con diagnóstico preliminar y recomendaciones, fuera del alcance de esta fase.

Los pendientes restantes corresponden a refinamiento de affordances de UI y a escalamiento comercial del canal (cobertura y enriquecimiento de datos email), no a la operación técnica E2E validada.

---

**Documentos de referencia:**

- `docs/06-FASES/PHASE-4B-CAMPAIGNS-BY-CHANNEL-ALIGNMENT-PLAN.md`
- `docs/06-FASES/PHASE-4B-EMAIL-PROSPECTING-PLAN.md`
- `docs/04-INTEGRACION/ARQUITECTURA-CANAL-EMAIL.md`
- `docs/05-REPORTES/2026-03/REPORTE-ESTADO-POST-MERGE-EMAIL-GRUPO-2-2026-03-27.md`
- `docs/05-REPORTES/2026-03/REPORTE-HARDENING-SEMANTICO-UI-EMAIL-2026-03-27.md`
- `docs/05-REPORTES/2026-03/ANALISIS-AFFORDANCES-UI-EMAIL-ETAPA5-2026-03-27.md`
- `docs/05-REPORTES/2026-03/REPORTE-INTEGRACION-END-TO-END-EMAIL-CENTRAL-HUB-MAILER-2026-03-15.md`
