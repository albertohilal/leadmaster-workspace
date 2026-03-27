# Solución bridge entre campaña Email y configuración SMTP por cliente

Status: DRAFT
Last Reviewed: 2026-03-24

## Objetivo

Registrar el ajuste aplicado en backend para cerrar el hueco detectado entre:

- `campaign.email_from` exigido por `prepare`
- y la configuración SMTP activa por cliente ya existente en `ll_clientes_email_config`

El objetivo funcional es mantener el contrato mínimo de create sin exponer remitente en esa etapa, pero hacer efectivo en backend el criterio operativo de que el remitente se resuelve desde la configuración del cliente al preparar la campaña.

## Archivos ajustados

Backend:

- [src/modules/email/services/emailCampaignPrepare.service.js](../../src/modules/email/services/emailCampaignPrepare.service.js)
- [src/modules/email/services/emailCampaigns.service.js](../../src/modules/email/services/emailCampaigns.service.js)

Tests:

- [src/modules/email/tests/emailCampaignPrepare.service.test.js](../../src/modules/email/tests/emailCampaignPrepare.service.test.js)
- [src/modules/email/tests/emailCampaignPrepare.integration.test.js](../../src/modules/email/tests/emailCampaignPrepare.integration.test.js)

Archivos revisados sin ajuste en este paso:

- [src/modules/email/services/emailCampaigns.scheduler.js](../../src/modules/email/services/emailCampaigns.scheduler.js)
- [services/mailer/src/repositories/clientEmailConfigRepository.js](../../../mailer/src/repositories/clientEmailConfigRepository.js)
- [services/mailer/src/services/mailerService.js](../../../mailer/src/services/mailerService.js)

## Problema anterior verificado

Antes del ajuste, el estado verificado era este:

- **verificado por código:** create mínimo acepta `nombre`, `subject`, `text`
- **verificado por código:** create prohíbe `email_from`, `name_from`, `reply_to_email`
- **verificado por código:** create deja esos campos en `null` en `ll_campanias_email`
- **verificado por código:** recipients carga destinatarios reales y no necesita remitente
- **verificado por código:** `prepare` exigía `campaign.email_from` y fallaba con `CAMPAIGN_EMAIL_FROM_REQUIRED` si seguía vacío
- **verificado por código:** el `mailer` ya tenía resolución SMTP por cliente desde `ll_clientes_email_config`
- **verificado por código:** no existía bridge automático entre la config SMTP por cliente y los campos `email_from`, `name_from`, `reply_to_email` de la campaña

En consecuencia, create y recipients podían funcionar, pero el flujo quedaba bloqueado al pasar a `prepare` si la campaña no traía remitente explícito cargado por otra superficie.

## Solución implementada

Se implementó un bridge mínimo dentro de `prepare`, sin tocar create mínimo ni duplicar lógica SMTP dentro de `central-hub`.

### Comportamiento nuevo

Al ejecutar `prepare`:

1. se carga la campaña como antes
2. se valida que su estado sea preparable
3. si la campaña ya tiene `email_from`, se conserva el comportamiento existente
4. si la campaña no tiene `email_from`, backend intenta resolver la configuración Email activa del cliente en `ll_clientes_email_config`
5. si existe config activa con `from_email` utilizable, backend persiste en la campaña:
   - `email_from <- from_email`
   - `name_from <- from_name`
   - `reply_to_email <- reply_to_email`
6. recién después continúa con la validación sendable y con el flujo normal de `prepare`
7. si no existe config activa o si la config activa no trae `from_email`, `prepare` falla con error claro orientado a configuración faltante o incompleta

### Implementación aplicada

**verificado por código:** se agregó en `emailCampaigns.service.js` una lectura acotada de config activa por cliente sobre `ll_clientes_email_config`.

**verificado por código:** se agregó en `emailCampaigns.service.js` una operación de persistencia para actualizar en `ll_campanias_email` los campos:

- `email_from`
- `name_from`
- `reply_to_email`

**verificado por código:** `emailCampaignPrepare.service.js` ahora intenta resolver remitente desde config activa del cliente antes de `ensureSendableCampaign()` cuando `campaign.email_from` está vacío.

**verificado por código:** no se agregó soporte Gmail-specific ni lógica SMTP duplicada dentro de `central-hub`.

## Comportamiento resultante

### Caso A
Campaña con `email_from` ya presente.

**Resultado:** `prepare` sigue funcionando como antes. No se pisa el remitente existente.

### Caso B
Campaña sin `email_from` y cliente con config activa utilizable.

**Resultado:** `prepare` completa y persiste en campaña:

- `email_from`
- `name_from`
- `reply_to_email`

Luego continúa con la validación sendable normal y puede pasar a estado preparable.

### Caso C
Campaña sin `email_from` y cliente sin config activa utilizable.

**Resultado:** `prepare` falla con error claro.

Errores introducidos en este ajuste:

- `CLIENT_EMAIL_CONFIG_NOT_FOUND` cuando la campaña no tiene `email_from` y el cliente no tiene configuración Email activa
- `CLIENT_EMAIL_CONFIG_INCOMPLETE` cuando existe configuración activa, pero no tiene `from_email` utilizable

### Efecto funcional del ajuste

Después del cambio:

- el contrato mínimo de create sigue intacto
- recipients sigue sin depender del remitente
- `prepare` ahora puede volver verdadero el mensaje de que el remitente se resuelve por configuración del cliente en backend
- el scheduler sigue usando datos persistidos en campaña
- el `mailer` sigue siendo el responsable del envío SMTP real

## Fuera de alcance

Quedó fuera de alcance en este paso:

- frontend create
- frontend recipients
- listado de campañas
- `'/mailer/send'`
- create mínimo y su contrato `nombre/subject/text`
- campañas WhatsApp
- schema o migraciones
- Gmail / OAuth / proveedores nuevos
- validación de cuenta SMTP real del cliente de prueba

## Pendientes inmediatos

1. cargar o verificar una configuración activa utilizable en `ll_clientes_email_config` para el cliente de prueba
2. validar operativamente el caso real de `prepare` sobre una campaña creada sin remitente explícito
3. validar el siguiente tramo `prepare + scheduler + send técnico` con una cuenta SMTP tradicional real del cliente
4. confirmar en runtime que la configuración efectiva coincide con lo observado en repo y en base
