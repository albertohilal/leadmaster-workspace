# Diagnóstico de remitente y SMTP para cliente de prueba Email

Status: DRAFT
Last Reviewed: 2026-03-24

## Objetivo

Consolidar la evidencia ya reunida sobre el canal Email en `central-hub` y `mailer` para responder dos preguntas concretas:

1. qué necesita exactamente hoy el cliente de prueba para que una campaña Email pase de creada a preparable y luego a enviable
2. qué opción conviene como remitente real para este cliente de prueba dentro de la arquitectura actual del repositorio:
   - Gmail
   - cuenta propia en servidor / dominio

Este documento no propone implementación, no cambia código y no redefine contratos. Solo consolida diagnóstico y cierra con una recomendación técnica concreta.

## Alcance

Incluye:

- create de campañas Email
- carga de recipients
- prepare
- envío técnico vía `mailer`
- resolución de `email_from`
- dependencias SMTP por cliente
- comparación técnica entre Gmail y cuenta propia en servidor / dominio para este caso

No incluye:

- cambios de código
- cambios de configuración
- nuevas consultas a base de datos fuera de la evidencia ya relevada
- refactor del flujo Email
- validación productiva en runtime desplegado

## Fuentes revisadas

Documentación base usada como insumo principal:

- [services/central-hub/docs/diagnosticos/relevamiento-flujo-real-campanas-email-remitente-2026-03-24.md](relevamiento-flujo-real-campanas-email-remitente-2026-03-24.md)
- [services/central-hub/docs/diagnosticos/relevamiento-envio-tecnico-email-mailer-2026-03-24.md](relevamiento-envio-tecnico-email-mailer-2026-03-24.md)
- [services/central-hub/docs/diagnosticos/relevamiento-remitente-cliente-prueba-sendable-2026-03-24.md](relevamiento-remitente-cliente-prueba-sendable-2026-03-24.md)

Documentación complementaria:

- [docs/00-INDEX/DOCUMENTATION_RULES.md](../../../../docs/00-INDEX/DOCUMENTATION_RULES.md)
- [services/central-hub/docs/planificacion/contrato-minimo-creacion-campana-email-2026-03-24.md](../planificacion/contrato-minimo-creacion-campana-email-2026-03-24.md)
- [services/central-hub/docs/diagnosticos/ajuste-backend-create-email-contrato-canonico-2026-03-24.md](ajuste-backend-create-email-contrato-canonico-2026-03-24.md)
- [services/central-hub/docs/diagnosticos/ajuste-listado-real-campanas-email-2026-03-24.md](ajuste-listado-real-campanas-email-2026-03-24.md)
- [services/central-hub/docs/diagnosticos/ajuste-recipients-reales-campana-email-2026-03-24.md](ajuste-recipients-reales-campana-email-2026-03-24.md)
- [services/central-hub/docs/diagnosticos/validacion-manual-e2e-create-list-email-2026-03-24.md](validacion-manual-e2e-create-list-email-2026-03-24.md)
- [services/central-hub/docs/diagnosticos/validacion-operativa-recipients-email-2026-03-24.md](validacion-operativa-recipients-email-2026-03-24.md)

Evidencia de código ya contrastada en los relevamientos previos:

- [src/modules/email/validators/createEmailCampaign.validator.js](../../src/modules/email/validators/createEmailCampaign.validator.js)
- [src/modules/email/services/emailCampaigns.service.js](../../src/modules/email/services/emailCampaigns.service.js)
- [src/modules/email/services/emailCampaignPrepare.service.js](../../src/modules/email/services/emailCampaignPrepare.service.js)
- [src/modules/email/services/emailCampaigns.scheduler.js](../../src/modules/email/services/emailCampaigns.scheduler.js)
- [src/integrations/mailer/mailerClient.js](../../src/integrations/mailer/mailerClient.js)
- [services/mailer/src/repositories/clientEmailConfigRepository.js](../../../mailer/src/repositories/clientEmailConfigRepository.js)
- [services/mailer/src/services/mailerService.js](../../../mailer/src/services/mailerService.js)
- [services/mailer/src/services/smtpTransportFactory.js](../../../mailer/src/services/smtpTransportFactory.js)
- [services/mailer/src/validators/sendValidator.js](../../../mailer/src/validators/sendValidator.js)

## Estado actual verificado en código

### Create

**Verificado por código:** `POST /api/email/campaigns` opera con contrato mínimo `nombre`, `subject`, `text`.

**Verificado por código:** create prohíbe `email_from`, `name_from` y `reply_to_email` en el payload mínimo.

**Verificado por código:** el alta persiste la campaña con:

- `estado = 'borrador'`
- `email_from = null`
- `name_from = null`
- `reply_to_email = null`

**Conclusión de create:** la campaña puede crearse, pero no sale del create con remitente utilizable para `prepare`.

### Recipients

**Verificado por código:** `POST /api/email/campaigns/:id/recipients` carga destinatarios reales en `ll_envios_email`.

**Verificado por código:** este paso valida `to_email`, `nombre_destino` y `lugar_id`.

**Verificado por código:** recipients no exige `email_from`.

**Conclusión de recipients:** la campaña puede recibir destinatarios reales sin tener todavía remitente resuelto.

### Prepare

**Verificado por código:** `POST /api/email/campaigns/:id/prepare` es la etapa que convierte la campaña en preparable para envío.

**Verificado por código:** `prepare` exige simultáneamente:

- asunto no vacío
- body no vacío
- `campaign.email_from` no vacío
- existencia de recipients cargados

**Verificado por código:** si falta remitente, falla con `CAMPAIGN_EMAIL_FROM_REQUIRED`.

**Conclusión de prepare:** el bloqueo funcional real aparece en esta etapa, no en create ni en recipients.

### Envío técnico

**Verificado por código:** el scheduler envía usando datos de la campaña:

- `from_email: campaign.email_from || undefined`
- `from_name: campaign.name_from || undefined`
- `reply_to: campaign.reply_to_email || undefined`

**Verificado por código:** `central-hub` no envía SMTP directo; delega por HTTP al servicio `mailer` usando `MAILER_BASE_URL`.

**Verificado por código:** el `mailer` resuelve el `from` técnico desde:

- `ll_clientes_email_config`, o
- fallback global `SMTP_*` si `SMTP_FALLBACK_ENABLED=true`

**Verificado por código:** no aparece puente automático verificado entre la config SMTP por cliente y `campaign.email_from`.

**Conclusión del envío técnico:** el repo ya tiene envío SMTP tradicional por cliente, pero ese tramo no resuelve por sí solo el requisito previo de `campaign.email_from` exigido por `prepare`.

## Estado actual verificado en base de datos / evidencia operativa

**Verificado por evidencia operativa / base de datos:** create funciona. Se validó operativamente el alta de una campaña Email real y su aparición posterior en el listado real.

**Verificado por evidencia operativa / base de datos:** recipients funciona. Se validó el alta real sobre `POST /api/email/campaigns/:id/recipients`, con persistencia en `ll_envios_email` y estado `PENDING`, sin envío efectivo.

**Verificado por evidencia operativa / base de datos:** prepare exige remitente. La investigación previa dejó alineado que la campaña no pasa a sendable si `campaign.email_from` sigue faltante.

**Verificado por evidencia operativa:** la UI relevada comunica que el remitente se resuelve por configuración del cliente. Esa señal operativa existe, pero no reemplaza el chequeo real de `campaign.email_from` exigido por `prepare`.

**Verificado por evidencia operativa / base de datos:** en la base observada, `societe` / `llxbx_societe` no apareció como fuente clara de remitente para este caso. La evidencia reunida no mostró ese dominio como resolución efectiva del `from` del flujo Email.

**No verificado:** no quedó comprobado todavía, para el cliente de prueba puntual, si existe una fila activa y útil en `ll_clientes_email_config` con SMTP completo y `from_email` utilizable.

**Inferido:** la situación operativa actual está partida en dos niveles:

- create y recipients ya son usables
- el paso a preparable/enviable sigue bloqueado por la combinación `campaign.email_from` + configuración SMTP resoluble

## Cómo se resuelve hoy el remitente (`email_from`)

**Conclusión categórica:** hoy la resolución del remitente está **parcialmente resuelta**.

Motivo:

- **Verificado por código:** `prepare` exige `campaign.email_from` como dato de campaña.
- **Verificado por código:** el `mailer` arma el `from` técnico desde config SMTP por cliente o fallback global.
- **Verificado por código:** no se verificó un bridge automático entre ambos niveles.

Esto deja una partición real:

1. el dominio campaña necesita `campaign.email_from` para pasar a preparable
2. el dominio mailer necesita SMTP resoluble y `from_email` técnico para enviar realmente

Por lo tanto:

- no está correcto afirmar que el remitente está completamente resuelto hoy
- tampoco está correcto afirmar que no existe ninguna base técnica
- el estado correcto es **parcialmente resuelto**, con un hueco funcional explícito entre campaña y mailer

## Qué exige hoy el flujo para preparar y enviar

Cadena mínima real de dependencias:

1. **campaña creada**
   - **Verificado por código y evidencia operativa:** create funciona y deja `estado = 'borrador'`
2. **recipients cargados**
   - **Verificado por código y evidencia operativa:** recipients reales quedan en `ll_envios_email`
3. **`campaign.email_from` no nulo**
   - **Verificado por código:** requisito obligatorio de `prepare`
4. **config SMTP resoluble por cliente o fallback**
   - **Verificado por código:** `mailer` requiere config activa en `ll_clientes_email_config` o fallback `SMTP_*`
5. **scheduler / mailer disponible**
   - **Verificado por código:** el envío técnico depende de scheduler en `central-hub` y del servicio HTTP `mailer`
6. **condiciones mínimas para envío técnico**
   - **Verificado por código:** asunto, body, destinatario válido, transporte SMTP construido y `from_email` técnico utilizable

**Conclusión operativa:** para pasar de creada a preparable no alcanza con tener recipients. Para pasar de preparable a enviable tampoco alcanza con tener `campaign.email_from`. Se necesitan las dos capas: campaña preparada y SMTP resoluble.

## Dependencias técnicas del mailer

### Verificado por código

El `mailer` parece necesitar hoy, por cliente, estos campos:

- `smtp_host`
- `smtp_port`
- `smtp_secure`
- `smtp_user`
- `smtp_pass`
- `from_email`
- `from_name`
- `reply_to_email`

**Matiz verificado por código:** los mínimos duros del factory para construir transporte y remitente son al menos:

- `smtp_host`
- `smtp_port`
- `from_email`

El resto puede ser opcional según el caso, pero forma parte del modelo de configuración activa por cliente relevado en `ll_clientes_email_config`.

**Verificado por código:** el fallback técnico alternativo usa variables `SMTP_*`, principalmente:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM_EMAIL`
- `SMTP_FROM_NAME`

### No verificado en runtime

No quedó verificado en runtime efectivo de este cliente de prueba:

- si la fila activa en `ll_clientes_email_config` existe
- si esa fila está completa y vigente
- si el `mailer` en ejecución está leyendo exactamente esa configuración
- si `SMTP_FALLBACK_ENABLED` está habilitado o deshabilitado en el runtime real más allá del repo
- si la cuenta SMTP elegida acepta autenticación y envío real para este cliente

## Análisis comparativo para cliente de prueba

### Opción A - Gmail

**Verificado por código:** el repo es compatible solo con SMTP estándar. No apareció soporte específico para Gmail mediante OAuth, SDK de Google ni flujo de autorización dedicado.

**Verificado por código:** el `mailer` construye un transporte SMTP clásico con `host`, `port`, `secure` y `auth`.

**Inferido:** si se eligiera Gmail, la integración encajaría solo como SMTP tradicional, no como integración nativa de Gmail.

**Inferido:** para una cuenta Gmail, la fricción operativa más probable sería:

- necesidad de parametrizar host/port/secure como SMTP de Gmail
- necesidad probable de `app password` si la cuenta tuviera 2FA o políticas modernas de acceso
- mayor dependencia de políticas externas de Google no reflejadas en el repo

**Inferido:** como prueba end-to-end, Gmail podría servir solo como SMTP transitorio si se carga manualmente la config por cliente y si la cuenta permite SMTP clásico. Pero encaja peor con este repo que una cuenta SMTP propia porque:

- el repo no tiene soporte Gmail-specific
- el modelo de datos está pensado para `host/port/user/pass/from_email`
- el hueco principal ya detectado no es de proveedor, sino de puente entre campaña y remitente

**Conclusión de opción A:** técnicamente posible solo por SMTP estándar, pero con mayor fricción operativa y peor alineación conceptual con la arquitectura actual.

### Opción B - cuenta propia en servidor / dominio

**Verificado por código:** esta opción coincide directamente con el modelo SMTP tradicional implementado en el repo.

**Verificado por código:** el `mailer` ya trabaja exactamente con:

- `smtp_host`
- `smtp_port`
- `smtp_secure`
- `smtp_user`
- `smtp_pass`
- `from_email`
- `from_name`
- `reply_to_email`

**Inferido:** una cuenta propia de servidor / dominio encaja mejor con el modelo de configuración por cliente porque permite cargar sin adaptación especial el set de datos que el `mailer` ya espera.

**Inferido:** para una prueba seria o una puesta en marcha mínimamente creíble, esta opción arrastra requisitos operativos externos que el repo no resuelve por sí solo:

- DNS correcto
- reputación del origen
- SPF
- DKIM
- DMARC

**Inferido:** esos requisitos no contradicen la arquitectura actual. Al contrario, son coherentes con el hecho de que el repo espera SMTP clásico configurable por cliente.

**Conclusión de opción B:** encaja mejor con la estructura real del `mailer`, con el modelo de configuración por cliente y con el tipo de remitente que este repo parece esperar.

## Riesgos y restricciones

1. **Riesgo verificado por evidencia negativa:** creer que `societe.email` o `llxbx_societe.email` resuelven el problema cuando no hay evidencia de que ese dominio alimente el remitente real del flujo Email.
2. **Riesgo verificado por código:** que exista SMTP por cliente, pero la campaña siga sin `email_from` y falle igual en `prepare`.
3. **Riesgo inferido:** usar Gmail suponiendo soporte específico más allá de SMTP tradicional, cuando el repo no mostró OAuth ni integración dedicada.
4. **Riesgo validado en repo / no verificado en runtime:** asumir que el fallback global está habilitado solo porque existe configuración `SMTP_*` en archivos del repo.
5. **Riesgo verificado por código:** confundir “create funciona” con “Email funciona end-to-end”. Hoy create y recipients están separados del tramo sendable.
6. **Restricción verificada por código:** no hay bridge automático verificado entre config SMTP por cliente y `campaign.email_from`.
7. **Restricción no verificada:** no está confirmado todavía el estado real de `ll_clientes_email_config` para el cliente de prueba puntual.

## Conclusión técnica

Lo que falta hoy para este cliente de prueba es una combinación mínima de dos capas:

1. **dato funcional de campaña**
   - `campaign.email_from` debe existir para que `prepare` no falle
2. **configuración SMTP resoluble**
   - debe existir una configuración activa y utilizable por `cliente_id` en `ll_clientes_email_config`, o fallback global realmente habilitado y funcional

El hueco real está entre:

- la campaña, que exige `email_from` propio para pasar a preparable
- y el `mailer`, que ya sabe construir un `from` técnico desde SMTP por cliente o fallback

**Diagnóstico principal:** el problema actual es una **mezcla** de:

- **código / superficie funcional**, porque create no deja resuelto el dato que prepare exige
- **datos / configuración**, porque el envío real necesita SMTP activo por cliente o fallback

No aparece, con la evidencia disponible, como un problema principalmente de:

- `societe.email`
- infraestructura de integración entre `central-hub` y `mailer`
- soporte faltante de librería SMTP

## Recomendación concreta

**Para este cliente de prueba conviene cuenta propia del servidor/dominio.**

Justificación técnica cerrada:

- **Verificado por código:** el repo está diseñado sobre SMTP tradicional configurable por `host/port/user/pass/from_email`, no sobre integración específica de Gmail.
- **Verificado por código:** la ruta principal del `mailer` es `ll_clientes_email_config`, no un proveedor especial.
- **Inferido:** una cuenta propia de dominio reduce fricción conceptual y operativa dentro de este repo porque coincide con el shape exacto que ya existe en la configuración por cliente.
- **Inferido:** Gmail solo entraría como SMTP genérico y agregaría fricción externa sin resolver el hueco principal entre `campaign.email_from` y la configuración SMTP del cliente.

La recomendación no afirma que esa cuenta propia ya esté configurada ni que el envío vaya a funcionar hoy sin más. Afirma que, para este repositorio y para este cliente de prueba, esa es la opción técnicamente más alineada.

## Pasos mínimos para dejar Email operativo end-to-end

1. verificar o crear una config activa utilizable en `ll_clientes_email_config` para el cliente de prueba
2. definir una cuenta remitente real de dominio / servidor compatible con SMTP tradicional
3. completar `campaign.email_from` en la campaña o resolver explícitamente el punto operativo donde hoy queda faltante
4. validar que `prepare` pase con asunto, body, recipients y remitente completos
5. validar que el `mailer` construya transporte SMTP y acepte envío técnico para ese `cliente_id`
6. validar el flujo completo end-to-end desde campaña creada hasta envío técnico ejecutado
