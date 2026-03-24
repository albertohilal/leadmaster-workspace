# Ajuste listado real de campañas Email

Status: DRAFT
Last Reviewed: 2026-03-24

## Objetivo

Registrar el ajuste aplicado para reemplazar el listado mock de `/email/campaigns` por un listado real desde backend, manteniendo el dominio Email separado y sin tocar create, recipients, prepare ni `'/mailer/send'`.

## Archivos ajustados

Backend:

- [src/modules/email/routes/emailCampaigns.routes.js](../../src/modules/email/routes/emailCampaigns.routes.js)
- [src/modules/email/controllers/emailCampaigns.controller.js](../../src/modules/email/controllers/emailCampaigns.controller.js)
- [src/modules/email/services/emailCampaigns.service.js](../../src/modules/email/services/emailCampaigns.service.js)

Frontend:

- [frontend/src/services/email.js](../../frontend/src/services/email.js)
- [frontend/src/components/email/EmailCampaignsManager.jsx](../../frontend/src/components/email/EmailCampaignsManager.jsx)

Archivo revisado sin consumo activo en la pantalla principal:

- [frontend/src/components/email/emailCampaignsMock.js](../../frontend/src/components/email/emailCampaignsMock.js)

## Estado anterior verificado

Antes del ajuste:

- [frontend/src/components/email/EmailCampaignsManager.jsx](../../frontend/src/components/email/EmailCampaignsManager.jsx) renderizaba `EMAIL_CAMPAIGNS_MOCK` como fuente principal.
- La pantalla podía mostrar campañas no persistidas, como quedó diagnosticado con `Campaña Bienvenida Marzo`.
- No existía un `GET /api/email/campaigns` en el módulo revisado.
- [frontend/src/services/email.js](../../frontend/src/services/email.js) no exponía `listCampaigns()`.

## Ajuste implementado

El ajuste aplicado deja verificado que:

- se agregó `GET /api/email/campaigns` en el módulo Email
- el listado backend queda scoped por `cliente_id` autenticado
- el backend devuelve una colección real desde `ll_campanias_email`
- el backend adapta `asunto` a `subject` en la respuesta pública
- el frontend agregó `emailService.listCampaigns()`
- [frontend/src/components/email/EmailCampaignsManager.jsx](../../frontend/src/components/email/EmailCampaignsManager.jsx) ya no depende del mock como fuente principal
- la pantalla ahora maneja loading, empty state real y error state con reintento

## Contrato resultante del listado

Endpoint expuesto:

- `GET /api/email/campaigns`

Shape resultante por ítem:

```json
{
  "id": 101,
  "nombre": "Campaña Email Marzo",
  "subject": "Novedades de marzo",
  "estado": "borrador"
}
```

Criterios verificados:

- `id`, `nombre`, `subject`, `estado` sí quedan soportados
- `subject` se resuelve desde la columna interna `asunto`
- `updatedAt` no quedó soportado en este paso
- cuando `updatedAt` no existe, el frontend muestra `—` de forma conservadora

## Fuera de alcance

Quedaron fuera de alcance en este paso:

- create Email
- recipients
- prepare
- `'/mailer/send'`
- scheduler
- schema o migraciones
- campañas WhatsApp
- paginación, filtros o búsquedas

## Pendientes inmediatos

1. Confirmar si hace falta conservar o retirar el archivo mock una vez estabilizado el listado real.
2. Revisar si la pantalla necesita detalle o navegación adicional sobre campañas ya listadas.
3. Mantener separado un siguiente paso para enriquecimiento del listado solo si aparece evidencia real de campos adicionales como fechas de actualización.
