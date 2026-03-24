# Relevamiento del envío técnico real de Email y configuración SMTP

Status: DRAFT
Last Reviewed: 2026-03-24

## Objetivo

Determinar cómo se resuelve hoy el envío técnico real de emails en `central-hub`, identificando qué módulo envía efectivamente, cómo se arma el remitente, de dónde sale la configuración SMTP y si esa configuración se comporta como global o por cliente.

## Fuentes revisadas

Dentro de `central-hub`:

- [src/modules/mailer/routes/mailer.routes.js](../../src/modules/mailer/routes/mailer.routes.js)
- [src/modules/mailer/controllers/mailer.controller.js](../../src/modules/mailer/controllers/mailer.controller.js)
- [src/modules/mailer/services/mailer.service.js](../../src/modules/mailer/services/mailer.service.js)
- [src/modules/mailer/validators/sendMailer.validator.js](../../src/modules/mailer/validators/sendMailer.validator.js)
- [src/integrations/mailer/mailerClient.js](../../src/integrations/mailer/mailerClient.js)

Servicio mailer separado del workspace, revisado por referencia técnica relevante al envío real:

- [services/mailer/src/routes/mailerRoutes.js](../../../mailer/src/routes/mailerRoutes.js)
- [services/mailer/src/controllers/mailerController.js](../../../mailer/src/controllers/mailerController.js)
- [services/mailer/src/services/mailerService.js](../../../mailer/src/services/mailerService.js)
- [services/mailer/src/services/smtpTransportFactory.js](../../../mailer/src/services/smtpTransportFactory.js)
- [services/mailer/src/services/providers/smtpProvider.js](../../../mailer/src/services/providers/smtpProvider.js)
- [services/mailer/src/repositories/clientEmailConfigRepository.js](../../../mailer/src/repositories/clientEmailConfigRepository.js)
- [services/mailer/src/validators/sendValidator.js](../../../mailer/src/validators/sendValidator.js)

## Módulo real de envío

### En central-hub

**Verificado por código:** el módulo [src/modules/mailer/services/mailer.service.js](../../src/modules/mailer/services/mailer.service.js) **no envía SMTP directamente**. Solo arma un payload mínimo:

- `cliente_id`
- `to`
- `subject`
- `text`

Luego delega a `mailerClient.sendEmail(payload)`.

**Verificado por código:** [src/integrations/mailer/mailerClient.js](../../src/integrations/mailer/mailerClient.js) hace un `POST /send` contra `MAILER_BASE_URL` por HTTP.

### En el servicio mailer separado

**Verificado por código:** el envío real termina en [services/mailer/src/services/providers/smtpProvider.js](../../../mailer/src/services/providers/smtpProvider.js), donde se ejecuta `transporter.sendMail(mailOptions)`.

## Dependencia SMTP real

**Verificado por código:** el envío técnico usa SMTP tradicional.

Evidencia:

- [services/mailer/src/services/smtpTransportFactory.js](../../../mailer/src/services/smtpTransportFactory.js) importa `nodemailer`
- crea un transporter con `nodemailer.createTransport({ host, port, secure, auth })`
- [services/mailer/src/services/providers/smtpProvider.js](../../../mailer/src/services/providers/smtpProvider.js) llama `transporter.sendMail(...)`

### Dependencia usada

**Verificado por código:** usa `nodemailer`.

No apareció otra librería equivalente para envío SMTP en las piezas relevadas.

## Cómo se arma el remitente

**Verificado por código:** el remitente técnico se arma en [services/mailer/src/services/smtpTransportFactory.js](../../../mailer/src/services/smtpTransportFactory.js) mediante `formatFrom({ from_email, from_name })`.

Comportamiento:

- si falta `from_email`, falla con `from_email is not configured`
- si hay `from_name`, arma: `"Nombre" <email@dominio>`
- si no hay `from_name`, usa solo `email@dominio`
- `replyTo` se toma de `reply_to_email` si existe

**Verificado por código:** en el provider SMTP, `mailOptions` incluye:

- `from`
- `to`
- `subject`
- `text`
- `html`
- `replyTo` si existe

## De dónde toma host / port / user / password / secure

### Ruta principal: configuración por cliente

**Verificado por código:** [services/mailer/src/repositories/clientEmailConfigRepository.js](../../../mailer/src/repositories/clientEmailConfigRepository.js) busca una configuración activa en la tabla `ll_clientes_email_config` por `cliente_id`.

Campos cargados desde DB:

- `smtp_host`
- `smtp_port`
- `smtp_secure`
- `smtp_user`
- `smtp_pass`
- `from_email`
- `from_name`
- `reply_to_email`

**Verificado por código:** [services/mailer/src/services/mailerService.js](../../../mailer/src/services/mailerService.js) intenta primero `findActiveByClienteId(payload.cliente_id)` y, si existe, construye el transporter con esa configuración.

### Ruta secundaria: fallback global por entorno

**Verificado por código:** si no existe config por cliente, el mailer puede usar fallback global **solo si** `SMTP_FALLBACK_ENABLED` evalúa a true.

Variables de entorno leídas en fallback:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM_EMAIL`
- `SMTP_FROM_NAME`

**Verificado por código:** en el fallback no aparece `reply_to` desde env en las piezas revisadas; devuelve `replyTo: undefined`.

## Configuración: global o por cliente

### Estado actual

**Verificado por código:** la resolución actual parece **principalmente por cliente**, con fallback global opcional.

Clasificación:

- **por cliente:** sí, vía `ll_clientes_email_config`
- **global:** sí, pero solo como fallback por env si `SMTP_FALLBACK_ENABLED` está activo
- **parcialmente resuelta:** sí, porque `central-hub` no resuelve SMTP localmente; delega al servicio `mailer`

## Evidencia sobre Gmail

**Verificado por código:** no apareció lógica específica de Gmail, OAuth de Gmail ni transport especial de Gmail en las piezas revisadas.

**Inferido:** una cuenta Gmail podría funcionar **solo si** se carga como un SMTP compatible en host/port/user/pass, pero eso no está implementado como soporte específico de Gmail.

## Evidencia sobre SMTP tradicional de dominio propio

**Verificado por código:** sí hay evidencia real de soporte para SMTP tradicional.

Fundamento:

- el transporter se construye con `host`, `port`, `secure`, `auth`
- los campos persistidos por cliente son `smtp_host`, `smtp_port`, `smtp_secure`, `smtp_user`, `smtp_pass`
- el provider habla en términos de `SMTP authentication failed` y `SMTP provider error`

Esto está más alineado con cuentas SMTP tradicionales de dominio propio que con integración específica de Gmail.

## Datos mínimos técnicos que necesita hoy el mailer para enviar

### Por cliente

**Verificado por código:** para resolver un envío por cliente, el mailer necesita como mínimo:

- `smtp_host`
- `smtp_port`
- `from_email`

Y opcionalmente:

- `smtp_secure`
- `smtp_user`
- `smtp_pass`
- `from_name`
- `reply_to_email`

### Fallback global

**Verificado por código:** para fallback global necesita como mínimo:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_FROM_EMAIL`

Y opcionalmente:

- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM_NAME`

## Dictamen corto

- **módulo real de envío:** el envío SMTP real no ocurre dentro de `central-hub/src/modules/mailer`, sino en el servicio separado [services/mailer/src/services/providers/smtpProvider.js](../../../mailer/src/services/providers/smtpProvider.js)
- **dependencias SMTP reales:** `nodemailer`, `host`, `port`, `secure`, `auth`, `from`, `replyTo`
- **cómo se arma el remitente:** desde `from_email` + `from_name`, con `reply_to_email` opcional
- **origen de configuración:** primero configuración activa por cliente en `ll_clientes_email_config`; si falta, fallback global por env condicionado por `SMTP_FALLBACK_ENABLED`
- **alineación técnica:** el mailer está más alineado con SMTP tradicional que con soporte específico de Gmail

## No verificado

- no quedó verificado en esta pasada si el fallback global está activado en runtime
- no quedó verificado si hay clientes con configuración activa real en `ll_clientes_email_config`
- no quedó verificado un caso productivo real con Gmail
