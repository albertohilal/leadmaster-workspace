# Relevamiento del flujo real de campañas Email y dependencia de remitente

Status: DRAFT
Last Reviewed: 2026-03-24

## Objetivo

Mapear el flujo real de campañas Email en `central-hub` en las etapas de create, recipients, prepare y envío técnico, identificando con evidencia de código el punto exacto donde aparece la dependencia de `email_from`.

## Fuentes revisadas

- [src/modules/email/services/emailCampaigns.service.js](../../src/modules/email/services/emailCampaigns.service.js)
- [src/modules/email/services/emailCampaignRecipients.service.js](../../src/modules/email/services/emailCampaignRecipients.service.js)
- [src/modules/email/services/emailCampaignPrepare.service.js](../../src/modules/email/services/emailCampaignPrepare.service.js)
- [src/modules/email/services/emailCampaigns.scheduler.js](../../src/modules/email/services/emailCampaigns.scheduler.js)
- [src/modules/email/controllers/emailCampaigns.controller.js](../../src/modules/email/controllers/emailCampaigns.controller.js)
- [src/modules/email/routes/emailCampaigns.routes.js](../../src/modules/email/routes/emailCampaigns.routes.js)
- [src/modules/email/validators/createEmailCampaign.validator.js](../../src/modules/email/validators/createEmailCampaign.validator.js)
- [src/modules/email/validators/emailCampaignRecipients.validator.js](../../src/modules/email/validators/emailCampaignRecipients.validator.js)
- [src/modules/email/validators/emailCampaignPrepare.validator.js](../../src/modules/email/validators/emailCampaignPrepare.validator.js)

## Create

### AS-IS IMPLEMENTADO

`POST /api/email/campaigns` valida y persiste un contrato mínimo.

**Verificado por código:**

- el controller usa `validateCreateEmailCampaignBody()` y luego `createEmailCampaign()`
- el payload permitido es solo:
  - `nombre`
  - `subject`
  - `text`
- el create persiste en `ll_campanias_email`:
  - `cliente_id`
  - `nombre`
  - `asunto` ← desde `subject`
  - `body` ← desde `text`
  - `estado = 'borrador'`
  - `fecha_programada = null`
  - `email_from = null`
  - `name_from = null`
  - `reply_to_email = null`
  - `total_destinatarios = 0`
  - `total_enviados = 0`
  - `total_fallidos = 0`
  - `observaciones = null`

### email_from en create

**Verificado por código:** `create` prohíbe explícitamente `email_from` en el validador.

## Recipients

### AS-IS IMPLEMENTADO

`POST /api/email/campaigns/:id/recipients` agrega o reencola destinatarios en `ll_envios_email`.

**Verificado por código:**

- el validador exige por recipient:
  - `to_email` válido
  - `nombre_destino` opcional o null
  - `lugar_id` entero positivo o null
- el service no exige `email_from`
- el service inserta o actualiza `ll_envios_email` con:
  - `to_email`
  - `nombre_destino`
  - `lugar_id`
  - `subject = campaign.asunto`
  - `body = campaign.body`
  - `provider = 'smtp'`
  - `status = 'PENDING'`
  - `selected_at = NOW()`
  - `scheduled_for = NULL`

### email_from en recipients

**Verificado por código:** `recipients` no necesita `email_from`.

## Prepare

### AS-IS IMPLEMENTADO

`POST /api/email/campaigns/:id/prepare` es la etapa que convierte la campaña en preparable para envío.

**Verificado por código:**

- el validador de prepare solo admite `fecha_programada`
- `prepareCampaign()` exige que la campaña exista y que su estado sea uno de:
  - `borrador`
  - `pendiente`
  - `pausada`
  - `error`
- luego ejecuta `ensureSendableCampaign()`
- además exige que exista al menos un recipient en `ll_envios_email`

### Chequeo exacto que bloquea prepare

**Verificado por código:** el bloqueo por remitente ocurre en `ensureSendableCampaign()`.

Chequeos exigidos:

- `campaign.asunto` no vacío
- `campaign.body` no vacío
- `campaign.email_from` no vacío

Error exacto por remitente faltante:

- código: `CAMPAIGN_EMAIL_FROM_REQUIRED`
- mensaje: `La campaña debe tener email_from para enviar`

### Qué cambia al preparar

**Verificado por código:**

En `ll_envios_email`:

- reescribe `subject` y `body` desde la campaña
- fija `provider = 'smtp'`
- mantiene `status = 'PENDING'` para no enviados
- limpia `message_id`, `error_message`, locks y contadores de intento en no enviados
- asigna `scheduled_for` solo al primer recipient pendiente

En `ll_campanias_email`:

- `estado = 'pendiente'`
- `fecha_programada = scheduledFor`
- `fecha_fin_envio = NULL`
- `fecha_inicio_envio = NULL` si aún no hubo enviados
- `updated_at = NOW()`

## Envío técnico

### AS-IS IMPLEMENTADO

El tramo de envío técnico real lo toma el scheduler.

**Verificado por código:**

- el scheduler procesa campañas con estado `pendiente` o `en_progreso`
- solo toma rows de `ll_envios_email` en `PENDING` con `scheduled_for <= NOW()`
- `emailService.sendEmail()` usa:
  - `from_email: campaign.email_from || undefined`
  - `from_name: campaign.name_from || undefined`
  - `reply_to: campaign.reply_to_email || undefined`

## Punto exacto donde aparece email_from

### AS-IS IMPLEMENTADO

**Verificado por código:** la dependencia real de `email_from` aparece por primera vez en `prepare`, no en `create` ni en `recipients`.

Puntos exactos:

1. chequeo obligatorio en `ensureSendableCampaign()` dentro de [src/modules/email/services/emailCampaignPrepare.service.js](../../src/modules/email/services/emailCampaignPrepare.service.js)
2. uso efectivo en [src/modules/email/services/emailCampaigns.scheduler.js](../../src/modules/email/services/emailCampaigns.scheduler.js) al llamar `emailService.sendEmail()`

## Dónde empieza realmente el tramo sendable

### AS-IS IMPLEMENTADO

**Verificado por código:** el tramo realmente “sendable” empieza en `prepare`.

Fundamento:

- `create` deja `email_from = null`
- `recipients` no exige `email_from`
- `prepare` exige `email_from`, asunto, body y recipients cargados
- después de `prepare`, el scheduler ya puede tomar la campaña para envío técnico

## Hueco real detectado

### AS-IS IMPLEMENTADO

**Verificado por código:** existe un hueco funcional entre `create` y `prepare`:

- `create` prohíbe `email_from`
- `recipients` no lo pide
- `prepare` sí lo exige

Esto deja verificado que el flujo mínimo actual permite:

1. crear campaña
2. cargar recipients

pero no permite pasar a `prepare` si ninguna otra superficie completa `email_from` antes.

### NO VERIFICADO

No quedó verificado en este relevamiento si existe otra pantalla, endpoint o proceso fuera de estas piezas que complete `email_from` antes de `prepare`.
