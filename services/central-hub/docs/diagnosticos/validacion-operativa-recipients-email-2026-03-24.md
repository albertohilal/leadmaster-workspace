# Validación operativa de recipients para campañas Email

Status: DRAFT
Last Reviewed: 2026-03-24

## Objetivo

Validar de forma operativa y documentada el flujo de alta de recipients para campañas Email en la rama actual, delimitando qué quedó comprobado por código, qué pudo validarse contra la instancia en ejecución y qué no pudo cerrarse por bloqueo de datos o de superficie disponible.

## Alcance

Este informe cubre:

- carga de campañas Email reales desde `GET /api/email/campaigns`
- existencia y consumo del endpoint `POST /api/email/campaigns/:id/recipients`
- bifurcación frontend entre flujo Email y flujo heredado WhatsApp
- alta real de recipients Email sobre `ll_envios_email`
- comprobación de que este paso no ejecuta prepare ni envío efectivo

Este informe no cubre:

- cambios de código
- prepare
- `'/mailer/send'`
- scheduler
- campañas WhatsApp fuera de su rol como fuente transicional de prospectos/base
- validación visual completa en navegador autenticado

## Fuentes revisadas

Documentación:

- [docs/00-INDEX/DOCUMENTATION_RULES.md](../../../../docs/00-INDEX/DOCUMENTATION_RULES.md)
- [docs/diagnosticos/ajuste-recipients-reales-campana-email-2026-03-24.md](ajuste-recipients-reales-campana-email-2026-03-24.md)
- [docs/diagnosticos/ajuste-listado-real-campanas-email-2026-03-24.md](ajuste-listado-real-campanas-email-2026-03-24.md)
- [docs/diagnosticos/validacion-manual-e2e-create-list-email-2026-03-24.md](validacion-manual-e2e-create-list-email-2026-03-24.md)

Frontend:

- [frontend/src/services/email.js](../../frontend/src/services/email.js)
- [frontend/src/components/email/EmailCampaignProspectsPage.jsx](../../frontend/src/components/email/EmailCampaignProspectsPage.jsx)
- [frontend/src/components/destinatarios/GestionDestinatariosPage.jsx](../../frontend/src/components/destinatarios/GestionDestinatariosPage.jsx)
- [frontend/src/services/prospectos.js](../../frontend/src/services/prospectos.js)
- [frontend/src/services/campanas.js](../../frontend/src/services/campanas.js)
- [frontend/src/services/destinatarios.js](../../frontend/src/services/destinatarios.js)

Backend:

- [src/modules/email/routes/emailCampaigns.routes.js](../../src/modules/email/routes/emailCampaigns.routes.js)
- [src/modules/email/controllers/emailCampaigns.controller.js](../../src/modules/email/controllers/emailCampaigns.controller.js)
- [src/modules/email/services/emailCampaignRecipients.service.js](../../src/modules/email/services/emailCampaignRecipients.service.js)
- [src/modules/email/validators/emailCampaignRecipients.validator.js](../../src/modules/email/validators/emailCampaignRecipients.validator.js)
- [src/modules/sender/controllers/prospectosController.js](../../src/modules/sender/controllers/prospectosController.js)

## Estado previo verificado por código

**Verificado por código:**

- existe `addCampaignRecipients()` en [frontend/src/services/email.js](../../frontend/src/services/email.js)
- existe `POST /api/email/campaigns/:id/recipients` en [src/modules/email/routes/emailCampaigns.routes.js](../../src/modules/email/routes/emailCampaigns.routes.js)
- [frontend/src/components/destinatarios/GestionDestinatariosPage.jsx](../../frontend/src/components/destinatarios/GestionDestinatariosPage.jsx) bifurca el flujo Email vs WhatsApp
- el branch Email de `agregarACampania()` arma `recipients` con:
  - `to_email`
  - `nombre_destino`
  - `lugar_id`
- el flujo Email excluye prospectos sin email válido antes del request mediante `.filter(hasEmailDisponible)`
- el branch Email usa `emailService.addCampaignRecipients(...)`
- el branch no Email mantiene `destinatariosService.agregarDestinatarios(...)`
- `prepare` existe como endpoint separado y no es invocado desde el alta de recipients
- el alta de recipients Email no usa `'/mailer/send'`

## Caso de prueba ejecutado

**Validado operativamente con trazabilidad parcial:** se ejecutaron requests HTTP directos contra `http://localhost:3012` y consultas puntuales a base de datos para verificar el comportamiento real de la rama.

### Hallazgo previo de contexto operativo

Antes de ejecutar el alta de recipients se verificó lo siguiente:

- **validado operativamente:** el cliente `99991` tenía campaña Email real disponible (`id = 1`), pero no tenía campañas base `sender` asociables.
- **validado operativamente:** el cliente `51` tenía campañas base `sender` disponibles, incluyendo `id = 47` (`Haby – Reactivación`), pero no tenía campañas Email previas.
- **validado operativamente:** la campaña base `47` devolvió `606` prospectos bajo `GET /api/sender/prospectos/filtrar?campania_id=47` con `cliente_id = 51`.
- **validado operativamente:** esos `606` prospectos quedaron todos sin email válido en la muestra disponible.
- **validado operativamente:** una consulta de DB sobre `ll_lugares_clientes + llxbx_societe` mostró `valid_emails = 0` para los clientes `51` y `52`, que son los únicos con campañas base `sender` en la base actual.

### Fixture mínimo usado para destrabar la prueba

Dado que no existía un cliente con ambas superficies ya pobladas al mismo tiempo:

- campaña Email real disponible
- campaña base `sender` con prospectos

se creó **solo como fixture operativo de validación** una campaña Email para `cliente_id = 51` usando el endpoint ya existente de create, sin tocar código.

Campaña creada para la prueba:

- `id = 2`
- `cliente_id = 51`
- `nombre = Validación recipients Email 2026-03-24`
- `estado = borrador`

### Ejecución realizada

Secuencia realmente ejecutada:

1. consulta de campañas Email para `cliente_id = 51`
2. consulta de campañas base `sender` para `cliente_id = 51`
3. consulta de prospectos de campaña base `47`
4. clasificación operativa de la muestra de prospectos por email válido / no válido
5. creación de la campaña Email fixture `id = 2`
6. `POST /api/email/campaigns/2/recipients` con payload válido y `lugar_id = 734`
7. repetición del mismo `POST` para observar el caso `already_pending`
8. consulta de DB sobre `ll_envios_email` y `ll_campanias_email` para confirmar estado pendiente y ausencia de inicio de envío

### Límite de la ejecución

**No validado operativamente:** no pudo ejecutarse un caso real de selección mixta desde datos existentes con:

- al menos un prospecto con email válido
- al menos un prospecto sin email válido

porque la base operativa revisada no expone prospectos con email válido dentro de las campañas `sender` disponibles.

## Resultado del alta de recipients

### Alta real sobre endpoint Email

**Validado operativamente a nivel endpoint y persistencia:** el alta efectiva ejecutada en esta pasada se realizó directamente contra `POST /api/email/campaigns/2/recipients`.

Alcance exacto de esta comprobación:

- se usó un fixture operativo mínimo de campaña Email (`id = 2`)
- se validó el contrato efectivo aceptado por el endpoint
- se validó la persistencia real resultante en `ll_envios_email`
- se validó el estado resultante de campaña y recipient

Límite de esta comprobación:

- **no validado end-to-end desde frontend:** esta ejecución no cerró una interacción completa de selección + alta desde la UI autenticada
- **no validado visualmente en navegador:** no hubo verificación visual completa del flujo en navegador autenticado

Payload válido ejecutado:

```json
{
  "recipients": [
    {
      "to_email": "validacion.recipients.20260324@example.com",
      "nombre_destino": "1 Floor Tienda",
      "lugar_id": 734
    }
  ]
}
```

Primera ejecución:

- **validado operativamente:** `inserted = 1`
- **validado operativamente:** `requeued = 0`
- **validado operativamente:** `already_pending = 0`
- **validado operativamente:** `skipped_sent = 0`

Segunda ejecución del mismo payload:

- **validado operativamente:** `inserted = 0`
- **validado operativamente:** `requeued = 0`
- **validado operativamente:** `already_pending = 1`
- **validado operativamente:** `skipped_sent = 0`

Persistencia observada en DB para el envío creado (`id = 26`):

- **validado operativamente:** `status = 'PENDING'`
- **validado operativamente:** `scheduled_for = NULL`
- **validado operativamente:** `sent_at = NULL`
- **validado operativamente:** `message_id = NULL`
- **validado operativamente:** `attempt_count = 0`

Estado observado en la campaña Email `id = 2`:

- **validado operativamente:** `estado = 'borrador'`
- **validado operativamente:** `fecha_inicio_envio = NULL`
- **validado operativamente:** `total_destinatarios = 1`
- **validado operativamente:** `total_enviados = 0`
- **validado operativamente:** `total_fallidos = 0`

### Exclusión de prospectos sin email válido

- **verificado por código:** el frontend excluye prospectos sin email válido antes del request.
- **no validado operativamente end-to-end:** no se pudo cerrar un caso real mixto con selección de prospectos válidos e inválidos desde la base disponible.
- **validado operativamente:** la campaña base `47` expuso `606` prospectos y `0` emails válidos, por lo que el caso mixto quedó bloqueado por datos.

### Feedback al operador

- **verificado por código:** el frontend compone un `alert()` con `inserted`, `requeued`, `already_pending` y `omitidosSinEmail`.
- **validado operativamente:** el backend devolvió correctamente `inserted` y luego `already_pending`.
- **no validado end-to-end desde frontend:** el valor visible de `omitidosSinEmail` no pudo comprobarse en UI ni en una interacción completa del branch Email porque no hubo un caso mixto seleccionable desde datos existentes.

### Separación respecto de prepare y envío

- **validado operativamente:** el alta dejó registros en `ll_envios_email` con estado `PENDING`, sin `sent_at` y sin `message_id`.
- **validado operativamente:** la campaña quedó con `fecha_inicio_envio = NULL` y `total_enviados = 0`.
- **verificado por código:** el flujo probado no invoca `prepare`.
- **verificado por código:** el flujo probado no invoca `'/mailer/send'`.

## Validación contra flujo heredado

**Verificado por código:**

- el branch Email de [frontend/src/components/destinatarios/GestionDestinatariosPage.jsx](../../frontend/src/components/destinatarios/GestionDestinatariosPage.jsx) usa `emailService.addCampaignRecipients(...)`
- ese servicio apunta a `'/email/campaigns/:id/recipients'`
- el branch Email ya no usa `destinatariosService.agregarDestinatarios(...)`
- por lo tanto, el flujo Email ya no usa `'/sender/destinatarios/...'` para el alta de recipients

**Dependencia residual verificada por código:**

- la selección de campaña base sigue viniendo de [frontend/src/services/campanas.js](../../frontend/src/services/campanas.js) sobre `'/sender/campaigns'`
- la carga de prospectos sigue viniendo de [frontend/src/services/prospectos.js](../../frontend/src/services/prospectos.js) sobre `'/sender/prospectos/filtrar'`
- el backend de [src/modules/sender/controllers/prospectosController.js](../../src/modules/sender/controllers/prospectosController.js) sigue resolviendo esa base desde `ll_campanias_whatsapp` y `ll_envios_whatsapp`

Conclusión de esta sección:

- **sí**: el alta de recipients Email ya no depende de `destinatariosService.agregarDestinatarios(...)`
- **sí**: todavía quedan dependencias residuales del dominio `sender` en la etapa de selección de base y prospectos

## Dictamen

`VALIDADO PARCIALMENTE`

Fundamento:

- **validado operativamente:** el alta real de recipients Email usa `POST /api/email/campaigns/:id/recipients`
- **validado operativamente:** el endpoint insertó un recipient nuevo y luego devolvió `already_pending` en la repetición del mismo payload
- **validado operativamente a nivel endpoint y persistencia:** el paso dejó recipients en estado `PENDING`, sin envío efectivo y sin inicio de prepare/envío
- **verificado por código:** el flujo Email ya no usa `destinatariosService.agregarDestinatarios(...)`
- **no validado operativamente:** la exclusión de prospectos sin email válido dentro de un caso mixto seleccionable no pudo cerrarse por falta de datos compatibles en la base actual
- **no validado visualmente en navegador:** el feedback final al operador no se comprobó en navegador autenticado

En consecuencia, quedó validado operativamente el alta real de recipients Email a nivel endpoint, contrato y persistencia, pero no quedó validado end-to-end el tramo completo de selección desde frontend.

## Bloqueos o desalineaciones residuales

1. **Bloqueo principal de datos:** no existe hoy un cliente que tenga simultáneamente campañas Email ya disponibles y campañas base `sender` con prospectos usables para el caso pedido.
2. **Bloqueo principal del caso mixto:** los clientes con campañas base `sender` revisados (`51` y `52`) no exponen prospectos con email válido en la base actual; por eso no pudo cerrarse operativamente la mezcla “válido + inválido” desde selección real.
3. **Bloqueo de superficie de validación:** no se ejecutó validación visual completa en navegador autenticado, por lo que no quedó cerrado end-to-end el tramo completo de selección desde frontend.
4. **Residual transicional:** la etapa de selección sigue dependiendo del dominio `sender`, aunque el endpoint real de recipients Email y su persistencia sí quedaron validados operativamente.
5. **Cobertura no cerrada:** `requeued` no fue ejercitado operativamente en esta pasada.

## Próximo paso recomendado

corregir un bloqueo detectado
