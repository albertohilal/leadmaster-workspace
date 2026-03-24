# Ajuste recipients reales por campaña Email

Status: DRAFT
Last Reviewed: 2026-03-24

## Objetivo

Registrar el ajuste aplicado para que el flujo de “Agregar a Campaña” en contexto Email use el endpoint real `POST /api/email/campaigns/:id/recipients`, evitando que la asociación de destinatarios Email dependa del alta heredada sobre `'/sender/destinatarios/...'`.

## Archivos ajustados

Frontend:

- [frontend/src/services/email.js](../../frontend/src/services/email.js)
- [frontend/src/components/email/EmailCampaignProspectsPage.jsx](../../frontend/src/components/email/EmailCampaignProspectsPage.jsx)
- [frontend/src/components/destinatarios/GestionDestinatariosPage.jsx](../../frontend/src/components/destinatarios/GestionDestinatariosPage.jsx)

Backend revisado sin cambios en este paso:

- [src/modules/email/routes/emailCampaigns.routes.js](../../src/modules/email/routes/emailCampaigns.routes.js)
- [src/modules/email/controllers/emailCampaigns.controller.js](../../src/modules/email/controllers/emailCampaigns.controller.js)
- [src/modules/email/services/emailCampaignRecipients.service.js](../../src/modules/email/services/emailCampaignRecipients.service.js)
- [src/modules/email/validators/emailCampaignRecipients.validator.js](../../src/modules/email/validators/emailCampaignRecipients.validator.js)

## Estado anterior verificado

Antes del ajuste:

- [frontend/src/components/email/EmailCampaignProspectsPage.jsx](../../frontend/src/components/email/EmailCampaignProspectsPage.jsx) seguía inyectando `EMAIL_CAMPAIGNS_MOCK` como contexto de campañas Email.
- [frontend/src/components/destinatarios/GestionDestinatariosPage.jsx](../../frontend/src/components/destinatarios/GestionDestinatariosPage.jsx) resolvía el flujo Email a partir de `operational_campaign_id` del mock.
- El botón “Agregar a Campaña” usaba `destinatariosService.agregarDestinatarios(...)`, que apunta al dominio heredado `'/sender/destinatarios/...'`.
- El backend del módulo Email ya exponía `POST /api/email/campaigns/:id/recipients`, con validación de `to_email`, `nombre_destino` y `lugar_id`, más persistencia sobre `ll_envios_email`.

## Ajuste implementado

### AS-IS IMPLEMENTADO

El ajuste deja implementado que:

- [frontend/src/components/email/EmailCampaignProspectsPage.jsx](../../frontend/src/components/email/EmailCampaignProspectsPage.jsx) carga campañas Email reales mediante `emailService.listCampaigns()`.
- [frontend/src/services/email.js](../../frontend/src/services/email.js) ahora expone `addCampaignRecipients(campaignId, recipients)` sobre `'/email/campaigns/:id/recipients'`.
- [frontend/src/components/destinatarios/GestionDestinatariosPage.jsx](../../frontend/src/components/destinatarios/GestionDestinatariosPage.jsx) bifurca el comportamiento de “Agregar a Campaña”:
  - en contexto Email usa el endpoint real del módulo Email
  - fuera de ese contexto mantiene el flujo heredado de destinatarios WhatsApp
- El payload enviado en contexto Email se normaliza al contrato backend real:
  - `to_email`
  - `nombre_destino`
  - `lugar_id`
- Los prospectos seleccionados sin email válido no se envían al backend Email y se informan como omitidos en el feedback final.

### TRANSICIONAL / LEGACY SOPORTADO

Sigue vigente, por evidencia de código, que la selección de prospectos continúa tomando como base una campaña operativa del dominio `sender`:

- [frontend/src/services/prospectos.js](../../frontend/src/services/prospectos.js) sigue filtrando por `campania_id` sobre `'/sender/prospectos/filtrar'`.
- [frontend/src/services/campanas.js](../../frontend/src/services/campanas.js) sigue proveyendo la campaña base desde `'/sender/campaigns'`.
- En consecuencia, el ajuste desacopla **la alta de recipients Email**, pero no reemplaza todavía **la fuente operativa desde donde se listan prospectos**.

## Contrato operativo resultante

Endpoint consumido por el frontend en contexto Email:

- `POST /api/email/campaigns/:id/recipients`

Shape resultante por destinatario:

```json
{
  "to_email": "contacto@empresa.com",
  "nombre_destino": "Empresa Demo",
  "lugar_id": 123
}
```

Criterios efectivos:

- `to_email` debe ser email válido
- `nombre_destino` puede ser string o null
- `lugar_id` puede ser entero positivo o null
- el frontend excluye prospectos sin email válido antes del request
- la respuesta útil queda centrada en `summary` y `stats` del módulo Email

## Impacto funcional

Con este ajuste, el flujo mínimo queda separado así:

1. se elige una campaña Email real
2. se elige una campaña base para listar prospectos
3. se seleccionan prospectos
4. “Agregar a Campaña” da de alta o reencola destinatarios reales en la campaña Email

Esto reemplaza, para el alta de recipients Email, la dependencia previa del flujo heredado de WhatsApp.

## Fuera de alcance

Quedaron fuera de alcance en este paso:

- cambiar el backend de recipients Email
- reemplazar `'/sender/prospectos/filtrar'` por una fuente propia del módulo Email
- detalle o listado de recipients ya cargados en cada campaña Email
- prepare, scheduler o envío efectivo de emails
- campañas WhatsApp

## Pendientes inmediatos

1. Validar operativamente el alta de recipients Email contra una campaña real y revisar el resumen devuelto por backend.
2. Evaluar si el módulo Email necesita una fuente propia de prospectos para dejar de depender también del dominio `sender` en la etapa de selección.
3. Revisar si conviene retirar el mock residual [frontend/src/components/email/emailCampaignsMock.js](../../frontend/src/components/email/emailCampaignsMock.js) una vez confirmado que no queda consumo activo.
