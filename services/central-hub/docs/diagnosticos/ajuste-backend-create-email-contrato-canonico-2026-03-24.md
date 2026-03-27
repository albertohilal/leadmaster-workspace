# Ajuste backend create Email al contrato canónico

Status: DRAFT
Last Reviewed: 2026-03-24

## Objetivo

Registrar el ajuste aplicado en backend sobre `POST /api/email/campaigns` para alinearlo con el contrato canónico definido en [docs/planificacion/contrato-minimo-creacion-campana-email-2026-03-24.md](../planificacion/contrato-minimo-creacion-campana-email-2026-03-24.md), sin alterar recipients, prepare, `'/mailer/send'`, schema ni migraciones.

## Archivos ajustados

- [src/modules/email/validators/createEmailCampaign.validator.js](../../src/modules/email/validators/createEmailCampaign.validator.js)
- [src/modules/email/services/emailCampaigns.service.js](../../src/modules/email/services/emailCampaigns.service.js)

Archivos revisados sin cambio:

- [src/modules/email/controllers/emailCampaigns.controller.js](../../src/modules/email/controllers/emailCampaigns.controller.js)
- [src/modules/email/routes/emailCampaigns.routes.js](../../src/modules/email/routes/emailCampaigns.routes.js)

## Estado anterior verificado

Antes del ajuste, el backend de create Email:

- aceptaba `nombre`, `asunto`, `body`
- rechazaba `subject` y `text`
- persistía sobre `ll_campanias_email`
- mantenía create separado de recipients y prepare

El diagnóstico previo en [docs/diagnosticos/diagnostico-alineacion-campanas-email-vs-documento-2026-03-24.md](diagnostico-alineacion-campanas-email-vs-documento-2026-03-24.md) dejó verificado que existía desalineación entre:

- el documento contractual, que sostiene `nombre`, `subject`, `text`
- el backend implementado, que aceptaba `nombre`, `asunto`, `body`
- el frontend create, que intentaba enviar `channel`, `nombre`, `subject`, `text`

## Ajuste implementado

El ajuste aplicado en backend deja estos cambios verificados:

- el validador de create ahora acepta `nombre`, `subject`, `text`
- `channel` se rechaza explícitamente
- `asunto` y `body` se rechazan como input canónico del endpoint
- el servicio de create adapta internamente:
  - `subject` → `asunto`
  - `text` → `body`
- la persistencia sigue realizándose sobre `ll_campanias_email`
- no se tocaron rutas ni controller, salvo revisión de consistencia

El ajuste es estrictamente backend. No cambia la separación existente entre create, recipients y prepare.

## Contrato resultante

El contrato público resultante de `POST /api/email/campaigns` es:

```json
{
  "nombre": "Campaña Email Marzo",
  "subject": "Novedades de marzo",
  "text": "Contenido base del email"
}
```

Criterio resultante:

- `nombre` es obligatorio
- `subject` es obligatorio
- `text` es obligatorio
- `channel` no forma parte del contrato y se rechaza explícitamente
- `asunto` y `body` no forman parte del contrato público del endpoint

La base actual no fue modificada en este paso. `asunto` y `body` siguen existiendo solo como adaptación interna de persistencia.

## Fuera de alcance

Quedaron fuera de alcance en este paso:

- frontend create
- listado real de campañas
- mocks de listado
- recipients
- prepare
- `'/mailer/send'`
- schema o migraciones

## Pendientes inmediatos

1. Alinear el frontend create para que deje de enviar `channel`.
2. Corregir el copy de la UI que hoy sugiere que create no persiste.
3. Recién después de esa alineación, resolver el listado real de campañas.
