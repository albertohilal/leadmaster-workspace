# Validación manual E2E - create + list de campañas Email

Status: DRAFT
Last Reviewed: 2026-03-24

## Objetivo

Verificar el flujo mínimo de campañas Email en la rama actual para el caso `create + list`, distinguiendo qué quedó validado manualmente sobre la instancia en ejecución, qué quedó verificado por código y qué no pudo verificarse directamente en navegador.

## Alcance

Este informe cubre:

- create de campaña Email con contrato canónico `nombre`, `subject`, `text`
- listado real de campañas Email en `GET /api/email/campaigns`
- consumo del listado real desde `EmailCampaignsManager.jsx`
- verificación del rol residual de `emailCampaignsMock.js`

Este informe no cubre:

- recipients
- prepare
- `'/mailer/send'`
- scheduler
- schema o migraciones
- validación visual completa en navegador autenticado

## Fuentes revisadas

Documentación:

- [docs/00-INDEX/DOCUMENTATION_RULES.md](../../../../docs/00-INDEX/DOCUMENTATION_RULES.md)
- [docs/planificacion/contrato-minimo-creacion-campana-email-2026-03-24.md](../planificacion/contrato-minimo-creacion-campana-email-2026-03-24.md)
- [docs/diagnosticos/diagnostico-alineacion-campanas-email-vs-documento-2026-03-24.md](diagnostico-alineacion-campanas-email-vs-documento-2026-03-24.md)
- [docs/diagnosticos/ajuste-backend-create-email-contrato-canonico-2026-03-24.md](ajuste-backend-create-email-contrato-canonico-2026-03-24.md)
- [docs/diagnosticos/ajuste-listado-real-campanas-email-2026-03-24.md](ajuste-listado-real-campanas-email-2026-03-24.md)

Frontend:

- [frontend/src/components/email/EmailCampaignCreatePage.jsx](../../frontend/src/components/email/EmailCampaignCreatePage.jsx)
- [frontend/src/components/email/EmailCampaignsManager.jsx](../../frontend/src/components/email/EmailCampaignsManager.jsx)
- [frontend/src/services/email.js](../../frontend/src/services/email.js)
- [frontend/src/components/email/emailCampaignsMock.js](../../frontend/src/components/email/emailCampaignsMock.js)

Backend:

- [src/modules/email/routes/emailCampaigns.routes.js](../../src/modules/email/routes/emailCampaigns.routes.js)
- [src/modules/email/controllers/emailCampaigns.controller.js](../../src/modules/email/controllers/emailCampaigns.controller.js)
- [src/modules/email/services/emailCampaigns.service.js](../../src/modules/email/services/emailCampaigns.service.js)
- [src/modules/email/validators/createEmailCampaign.validator.js](../../src/modules/email/validators/createEmailCampaign.validator.js)

## Estado previo verificado por código

**Verificado por código:**

- el create Email usa contrato canónico `nombre`, `subject`, `text`
- el frontend de create ya no envía `channel`
- existe listado real en `GET /api/email/campaigns`
- el listado backend queda scoped por `cliente_id` autenticado
- `EmailCampaignsManager.jsx` ya no depende de `EMAIL_CAMPAIGNS_MOCK` como fuente principal
- `emailCampaignsMock.js` quedó sin consumo activo en la pantalla principal
- la columna `Actualizado` usa fallback `—` cuando la respuesta no trae `updatedAt`

## Caso de prueba ejecutado

**Validación operativa con trazabilidad parcial:** se ejecutaron requests HTTP directos desde terminal contra la instancia local en ejecución de `central-hub` en `http://localhost:3012`, después de reiniciar el proceso para asegurar que la versión activa reflejara los cambios de la rama.

Alcance exacto de esa comprobación:

- create vía `POST /api/email/campaigns`
- list vía `GET /api/email/campaigns`
- mismo contexto autenticado para ambas requests

Límite de evidencia:

- no se dejó una traza separada del cliente HTTP más allá de la ejecución operativa en terminal
- no se realizó validación visual en navegador autenticado

Valores usados en la prueba:

- `nombre`: `Campaña E2E Email 2026-03-24`
- `subject`: `Prueba E2E create + list`
- `text`: `Contenido de validación E2E`

Secuencia ejecutada:

1. reinicio del proceso `leadmaster-central-hub`
2. `POST /api/email/campaigns` con payload canónico
3. `GET /api/email/campaigns` con el mismo contexto autenticado

**No verificado visualmente en navegador:** no se ejecutó una interacción completa sobre la UI autenticada de `/email/campaigns/new` y `/email/campaigns` con verificación visual directa en esta pasada.

## Resultado del create

**Validado operativamente:** el create respondió correctamente en la comprobación HTTP ejecutada contra la instancia local después del reinicio del servicio.

Respuesta obtenida en esa validación operativa:

```json
{
  "success": true,
  "data": {
    "id": 1,
    "cliente_id": 99991,
    "nombre": "Campaña E2E Email 2026-03-24",
    "subject": "Prueba E2E create + list",
    "text": "Contenido de validación E2E",
    "estado": "borrador"
  }
}
```

Conclusiones del create:

- **validado operativamente:** el endpoint acepta `nombre / subject / text`
- **verificado por código:** el frontend de create ya no envía `channel`
- **validado operativamente:** el estado devuelto para la campaña creada fue `borrador`

## Resultado del listado

**Validado operativamente:** el listado devolvió la campaña recién creada en `GET /api/email/campaigns` dentro de la misma comprobación HTTP.

Respuesta obtenida en esa validación operativa:

```json
{
  "success": true,
  "data": {
    "campaigns": [
      {
        "id": 1,
        "nombre": "Campaña E2E Email 2026-03-24",
        "subject": "Prueba E2E create + list",
        "estado": "borrador"
      }
    ]
  }
}
```

Conclusiones del listado:

- **validado operativamente:** la campaña creada apareció en el listado real
- **validado operativamente:** el estado listado fue `borrador`
- **verificado por código:** si la respuesta no incluye `updatedAt`, la UI muestra `—`
- **no verificado visualmente en navegador:** no se observó directamente la grilla renderizada en una sesión autenticada con inspección visual

## Validación contra mock

**Verificado por código:**

- `EmailCampaignsManager.jsx` importa `emailService` y consume `listCampaigns()`
- `EmailCampaignsManager.jsx` ya no importa `EMAIL_CAMPAIGNS_MOCK`
- `EMAIL_CAMPAIGNS_MOCK` quedó sin consumo activo; sólo permanece su definición en [frontend/src/components/email/emailCampaignsMock.js](../../frontend/src/components/email/emailCampaignsMock.js)

Conclusión sobre mock:

- `Campaña Bienvenida Marzo` ya no puede aparecer en la pantalla principal por consumo hardcodeado del manager actual
- con el código vigente, la pantalla principal depende del backend real y no del mock local
- el archivo mock quedó residual y puede evaluarse su retiro en un paso posterior

## Dictamen

`VALIDADO PARCIALMENTE`

Fundamento:

- **validado operativamente:** el flujo real `create + list` funciona a nivel API contra la instancia en ejecución y la campaña creada reaparece en el listado real
- **verificado por código:** el manager frontend ya no depende del mock y consume el listado backend
- **no verificado visualmente:** no se ejecutó una interacción completa en navegador autenticado para observar directamente la campaña creada dentro de la tabla renderizada

## Bloqueos o desalineaciones residuales

1. **Bloqueo ya resuelto durante la validación:** antes del reinicio del proceso, la instancia en ejecución seguía respondiendo con comportamiento viejo (`subject` rechazado y `GET /api/email/campaigns` inexistente). Después del reinicio, la validación fue exitosa.
2. **Residual no bloqueante:** el archivo [frontend/src/components/email/emailCampaignsMock.js](../../frontend/src/components/email/emailCampaignsMock.js) sigue existiendo, pero sin consumo activo en la pantalla principal.
3. **Límite de evidencia manual:** falta una comprobación visual autenticada en navegador para cerrar la validación estrictamente UI/E2E.
4. **Trazabilidad manual incompleta:** la validación operativa quedó sustentada por requests HTTP directos sobre la instancia local, pero no por una evidencia visual o un registro separado de cliente interactivo.

## Próximo paso recomendado

limpiar mock residual si ya no cumple función documental ni de soporte
