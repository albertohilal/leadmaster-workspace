# Diagnóstico de alineación - campañas Email vs documento

Status: DRAFT
Last Reviewed: 2026-03-24

## Objetivo

Verificar si el código actual de campañas Email en `central-hub` está alineado con el documento [docs/planificacion/contrato-minimo-creacion-campana-email-2026-03-24.md](../planificacion/contrato-minimo-creacion-campana-email-2026-03-24.md) y explicar por qué en la UI aparece la campaña “Campaña Bienvenida Marzo” aunque el operador no pudo encontrarla en base de datos.

## Alcance

Este diagnóstico cubre:

- la pantalla `/email/campaigns`
- el flujo frontend de create Email
- el flujo backend de create Email
- la relación con `'/mailer/send'`
- el contraste entre implementación actual y contrato documental

No cubre:

- ejecución real de consultas SQL
- verificación directa sobre una base de datos en runtime
- comportamiento no visible en los archivos revisados

## Fuentes revisadas

### Evidencia documental

- [docs/00-INDEX/DOCUMENTATION_RULES.md](../../../../docs/00-INDEX/DOCUMENTATION_RULES.md)
- [docs/01-CONSTITUCIONAL/ADR-002-FORMULARIOS-CAMPANAS-POR-CANAL-INICIO-EMAIL.md](../../../../docs/01-CONSTITUCIONAL/ADR-002-FORMULARIOS-CAMPANAS-POR-CANAL-INICIO-EMAIL.md)
- [docs/planificacion/contrato-minimo-creacion-campana-email-2026-03-24.md](../planificacion/contrato-minimo-creacion-campana-email-2026-03-24.md)

### Evidencia de código en frontend

- [frontend/src/components/email/EmailCampaignsManager.jsx](../../frontend/src/components/email/EmailCampaignsManager.jsx)
- [frontend/src/components/email/emailCampaignsMock.js](../../frontend/src/components/email/emailCampaignsMock.js)
- [frontend/src/components/email/EmailCampaignCreatePage.jsx](../../frontend/src/components/email/EmailCampaignCreatePage.jsx)
- [frontend/src/services/email.js](../../frontend/src/services/email.js)

### Evidencia de código en backend

- [src/modules/email/routes/emailCampaigns.routes.js](../../src/modules/email/routes/emailCampaigns.routes.js)
- [src/modules/email/controllers/emailCampaigns.controller.js](../../src/modules/email/controllers/emailCampaigns.controller.js)
- [src/modules/email/services/emailCampaigns.service.js](../../src/modules/email/services/emailCampaigns.service.js)
- [src/modules/email/validators/createEmailCampaign.validator.js](../../src/modules/email/validators/createEmailCampaign.validator.js)
- [src/modules/mailer/validators/sendMailer.validator.js](../../src/modules/mailer/validators/sendMailer.validator.js)

## Evidencia manual aportada por operador

**Evidencia manual / no verificada por código:**

- En la UI de `/email/campaigns` aparece la campaña `Campaña Bienvenida Marzo`.
- El operador la buscó en base de datos y no la encontró.

Esta observación se incorpora como evidencia operativa. No constituye evidencia de código ni prueba directa sobre persistencia real.

## Hallazgos verificados en frontend

1. **La pantalla `/email/campaigns` usa datos mock locales.**
   - [frontend/src/components/email/EmailCampaignsManager.jsx](../../frontend/src/components/email/EmailCampaignsManager.jsx) importa `EMAIL_CAMPAIGNS_MOCK` desde [frontend/src/components/email/emailCampaignsMock.js](../../frontend/src/components/email/emailCampaignsMock.js).
   - La grilla renderiza `EMAIL_CAMPAIGNS_MOCK.map(...)`.
   - La propia UI declara que es una “Vista mock preparada para reemplazar luego por `emailService.listCampaigns()`”.

2. **`emailCampaignsMock.js` contiene la campaña `Campaña Bienvenida Marzo`.**
   - [frontend/src/components/email/emailCampaignsMock.js](../../frontend/src/components/email/emailCampaignsMock.js) define un registro con:
     - `nombre: 'Campaña Bienvenida Marzo'`
     - `subject: 'Te damos la bienvenida a LeadMaster'`

3. **No existe una función real `listCampaigns()` en el servicio frontend revisado.**
   - [frontend/src/services/email.js](../../frontend/src/services/email.js) exporta `normalizeEmail`, `isValidEmail`, `createCampaign`, `send` y `sendSelectionFanout`.
   - En ese archivo no existe `listCampaigns()`.

4. **El frontend de create sí intenta usar un create real, pero con contrato desalineado.**
   - [frontend/src/components/email/EmailCampaignCreatePage.jsx](../../frontend/src/components/email/EmailCampaignCreatePage.jsx) llama a `emailService.createCampaign(...)`.
   - El payload enviado es:
     - `channel`
     - `nombre`
     - `subject`
     - `text`
   - [frontend/src/services/email.js](../../frontend/src/services/email.js) reenvía ese mismo shape a `POST /email/campaigns`.
   - [src/modules/email/validators/createEmailCampaign.validator.js](../../src/modules/email/validators/createEmailCampaign.validator.js) rechaza explícitamente `channel`, `subject` y `text`.

5. **La UI de create presenta una triple desalineación: copy, contrato y expectativa funcional.**
   - [frontend/src/components/email/EmailCampaignCreatePage.jsx](../../frontend/src/components/email/EmailCampaignCreatePage.jsx) afirma que la creación “todavía no persiste”.
   - Esa afirmación contradice el servicio backend revisado, que sí ejecuta `INSERT` cuando recibe un payload válido.
   - El mismo flujo de UI intenta operar contra `POST /email/campaigns` como si el contrato efectivo fuera `nombre`, `subject`, `text`, cuando el contrato implementado en backend es `nombre`, `asunto`, `body`.
   - Interpretación diagnóstica: un operador puede entender que el flujo es solo preparatorio y que no persiste, cuando el backend real sí implementa una creación persistida, aunque el flujo actual no esté alineado end-to-end por incompatibilidad de payload.

## Hallazgos verificados en backend

1. **Existe un create Email real en backend.**
   - [src/modules/email/routes/emailCampaigns.routes.js](../../src/modules/email/routes/emailCampaigns.routes.js) expone `POST /api/email/campaigns`.
   - [src/modules/email/controllers/emailCampaigns.controller.js](../../src/modules/email/controllers/emailCampaigns.controller.js) valida y delega en servicio.

2. **No hay evidencia, en los archivos revisados, de un endpoint real de listado de campañas Email.**
   - En [src/modules/email/routes/emailCampaigns.routes.js](../../src/modules/email/routes/emailCampaigns.routes.js) solo aparecen:
     - `POST /`
     - `POST /:id/recipients`
     - `POST /:id/prepare`
   - No aparece `GET /api/email/campaigns` en ese archivo.

3. **El create backend actual persiste en base de datos cuando el payload es válido.**
   - [src/modules/email/services/emailCampaigns.service.js](../../src/modules/email/services/emailCampaigns.service.js) ejecuta `INSERT INTO ll_campanias_email (...)` en `createEmailCampaign(...)`.
   - El servicio devuelve `id`, `cliente_id`, `nombre`, `asunto` y `estado`.

4. **El contrato backend real no coincide con `subject/text`.**
   - [src/modules/email/validators/createEmailCampaign.validator.js](../../src/modules/email/validators/createEmailCampaign.validator.js) acepta `nombre`, `asunto`, `body` y opcionales adicionales.
   - El mismo validador rechaza explícitamente:
     - `channel`
     - `subject`
     - `text`

5. **El backend separa create, recipients y prepare.**
   - [src/modules/email/routes/emailCampaigns.routes.js](../../src/modules/email/routes/emailCampaigns.routes.js) y [src/modules/email/controllers/emailCampaigns.controller.js](../../src/modules/email/controllers/emailCampaigns.controller.js) mantienen operaciones separadas para:
     - create
     - addRecipients
     - prepare

6. **`/mailer/send` está modelado como despacho técnico, no como create-campaign.**
   - [src/modules/mailer/validators/sendMailer.validator.js](../../src/modules/mailer/validators/sendMailer.validator.js) valida `to`, `subject` y `text`.
   - Ese contrato corresponde a envío técnico por destinatario, no a creación de campaña.

## Contraste contra el documento contractual

### Lo que el documento sostiene como contrato mínimo objetivo

El documento [docs/planificacion/contrato-minimo-creacion-campana-email-2026-03-24.md](../planificacion/contrato-minimo-creacion-campana-email-2026-03-24.md) sostiene como **contrato mínimo objetivo**:

- `nombre`
- `subject`
- `text`

También sostiene que:

- create no equivale a enviar
- create no equivale a seleccionar destinatarios
- create no equivale a programar
- `'/mailer/send'` debe tratarse como despacho técnico

Interpretación diagnóstica:

- el documento no describe el contrato hoy implementado de punta a punta
- el documento define un **target contractual** para la alineación posterior

### Lo que el backend implementa realmente hoy

**AS-IS IMPLEMENTADO:** el backend de create usa:

- `nombre`
- `asunto`
- `body`

Además:

- rechaza `subject`
- rechaza `text`
- rechaza `channel`
- persiste en `ll_campanias_email` si la validación pasa

Interpretación diagnóstica:

- el backend actual describe un **contrato implementado distinto** del target contractual del documento

### Lo que el frontend intenta enviar hoy

**AS-IS IMPLEMENTADO en frontend:** el create actual intenta enviar:

- `channel`
- `nombre`
- `subject`
- `text`

Resultado del contraste:

- frontend create **no coincide** con backend create
- backend create **no coincide** con el contrato mínimo objetivo del documento
- el frontend actual intenta usar el **target contractual** del documento, no el contrato backend hoy implementado
- por eso no existe hoy alineación end-to-end del flujo create

## Validación puntual de la campaña “Campaña Bienvenida Marzo”

**Conclusión puntual:** la campaña “Campaña Bienvenida Marzo” aparece en UI por un mock local y no por un listado real desde backend.

Evidencia:

- [frontend/src/components/email/EmailCampaignsManager.jsx](../../frontend/src/components/email/EmailCampaignsManager.jsx) renderiza `EMAIL_CAMPAIGNS_MOCK`.
- [frontend/src/components/email/emailCampaignsMock.js](../../frontend/src/components/email/emailCampaignsMock.js) contiene explícitamente `Campaña Bienvenida Marzo`.
- No se verificó, en los archivos revisados, un endpoint real de listado ni una función `listCampaigns()` consumida por la pantalla.

Implicancia:

- esa campaña **no tiene por qué existir en base de datos** para aparecer en la UI actual
- el hallazgo manual del operador es **consistente con el código actual**
- con la evidencia revisada, la explicación más directa es que el operador vio un registro mock y por eso no encontró correlato obligatorio en DB

## Matriz de alineación

### Listado de campañas

**Estado:** `NO ALINEADO`

- La UI muestra campañas desde mock local.
- No hay evidencia de listado real desde backend en los archivos revisados.
- No existe `listCampaigns()` en [frontend/src/services/email.js](../../frontend/src/services/email.js).
- La campaña observada por operador proviene del mock.

### Create frontend

**Estado:** `NO ALINEADO`

- [frontend/src/components/email/EmailCampaignCreatePage.jsx](../../frontend/src/components/email/EmailCampaignCreatePage.jsx) envía `channel`, `nombre`, `subject`, `text`.
- [frontend/src/services/email.js](../../frontend/src/services/email.js) reenvía ese shape sin adaptación.
- Ese payload no coincide con el validador backend actual, que acepta `nombre`, `asunto`, `body` y rechaza `channel`, `subject`, `text`.
- La UI contiene copy incorrecto respecto de la persistencia real, porque afirma o sugiere que la creación actual no persiste, mientras el backend sí hace `INSERT` si recibe un payload válido.
- La UI transmite además una expectativa funcional engañosa: puede hacer creer que el flujo create es solo preparatorio, cuando en backend existe una creación persistida, aunque el flujo frontend actual no logre alinearse con ese contrato.

### Create backend

**Estado:** `PARCIALMENTE ALINEADO`

- Está implementado como operación real y separada de recipients/prepare.
- Persiste en `ll_campanias_email`.
- No está alineado con el contrato mínimo objetivo `subject/text`.
- Sí está alineado con la separación conceptual respecto de envío y destinatarios.

### Contrato documental

**Estado:** `PARCIALMENTE ALINEADO`

- El documento es consistente con la tesis arquitectónica de la ADR: separación por canal y separación respecto de `mailer`.
- El documento no describe el contrato backend real actual; describe un target contractual.
- Esa condición está explicitada en el propio documento.
- Por lo tanto, el documento es correcto como objetivo, pero no refleja un sistema ya alineado end-to-end.

### Uso de mailer

**Estado:** `ALINEADO`

- [src/modules/mailer/validators/sendMailer.validator.js](../../src/modules/mailer/validators/sendMailer.validator.js) modela despacho técnico con `to`, `subject`, `text`.
- [frontend/src/services/email.js](../../frontend/src/services/email.js) usa `send(...)` y `sendSelectionFanout(...)` para despacho por destinatario.
- No hay evidencia de que `'/mailer/send'` sea usado como create-campaign.

## Dictamen

El sistema está **PARCIALMENTE ALINEADO** con el documento, con desalineación fuerte en listado y create frontend.

Desglose del dictamen:

- **Listado de campañas:** `NO ALINEADO`
- **Create frontend:** `NO ALINEADO`
- **Create backend:** `PARCIALMENTE ALINEADO`
- **Contrato documental:** `PARCIALMENTE ALINEADO`
- **Separación respecto de `/mailer/send`:** `ALINEADO`

Fundamentos:

1. La pantalla `/email/campaigns` no lista campañas reales; muestra mock local.
2. El create backend existe y persiste, pero no acepta el contrato `subject/text`.
3. El create frontend intenta enviar un payload que el backend actual rechaza.
4. El documento contractual está redactado como target mínimo, no como reflejo del contrato hoy implementado.
5. La separación conceptual entre create y `'/mailer/send'` sí está respetada en el código revisado.

La desalineación fuerte del flujo create no es solo técnica. También es semántica y operativa desde la perspectiva del operador:

- el contrato que envía el frontend no coincide con el contrato implementado
- el copy de la UI no coincide con la persistencia real del backend
- la expectativa funcional que transmite la pantalla no coincide con el estado real del flujo

## Riesgos de interpretación incorrecta

1. Interpretar la grilla de `/email/campaigns` como si estuviera conectada a base real.
2. Suponer que una campaña visible en la UI debe existir necesariamente en DB.
3. Creer que el create frontend actual ya está integrado solo porque existe un endpoint backend.
4. Leer el documento contractual como si describiera el contrato hoy aceptado por backend.
5. Tomar el mensaje de la UI “todavía no persiste” como verdad del sistema actual, cuando el servicio backend sí hace `INSERT` en condiciones válidas.
6. Suponer que el flujo create es solo preparatorio y no persistido, cuando esa conclusión no coincide con el código backend revisado.

## Acciones recomendadas en orden de prioridad

1. Conectar el listado real o etiquetar la vista de `/email/campaigns` como mock transitorio de forma imposible de confundir.
2. Cerrar el contrato canónico de create entre `subject/text` y `asunto/body`.
3. Alinear el frontend create con el contrato backend real o con el contrato canónico que se defina.
4. Alinear los mensajes de la UI de create con la persistencia real del servicio backend.
5. Agregar endpoint y consumo de listado si el objetivo es que la grilla refleje campañas persistidas.

## Conclusión

La campaña “Campaña Bienvenida Marzo” aparece en la UI por un mock local. Con la evidencia revisada, no hay base para exigir que exista en DB. La observación manual del operador es consistente con el código actual.

En paralelo, el backend de create Email sí existe y sí persiste en `ll_campanias_email`, pero el frontend actual no está alineado con ese contrato, porque envía `channel`, `subject` y `text`, mientras el backend exige `nombre`, `asunto` y `body`.

La UI de create además transmite una expectativa funcional incorrecta: presenta el flujo como preparatorio y no persistido, aunque el backend implementa una creación persistida cuando recibe un payload válido.

Por lo tanto, la desalineación del flujo create es triple:

- **contractual**, porque frontend y backend no comparten el mismo payload
- **semántica**, porque el copy de la UI no coincide con la persistencia real del backend
- **operativa**, porque el operador puede formarse una expectativa equivocada sobre qué hace realmente el flujo

El documento contractual vigente debe leerse como **target contractual todavía no alineado**, no como descripción del sistema implementado de punta a punta.