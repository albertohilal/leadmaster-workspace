# DIAGNÓSTICO TÉCNICO — AUTOMATIZACIÓN EMAIL Y WHATSAPP EN CENTRAL-HUB

- **Fecha:** 2026-03-26
- **Plano principal:** **AS-IS IMPLEMENTADO**
- **Servicio auditado:** `services/central-hub`
- **Objetivo:** diagnosticar el flujo real de campañas Email y WhatsApp, determinar por qué una campaña Email preparada puede observarse en `PENDING`, identificar el alcance real de `AUTO_CAMPAIGNS_ENABLED` y proponer un diseño operable para desacoplar automatización WhatsApp/Email sin romper el scheduler Email existente.
- **Nivel de certeza general:** **alto** para wiring, flags, rutas y comportamiento actual implementado; **medio-alto** para causa raíz del episodio observado, porque el estado puntual `PENDING` sin procesamiento ya no estaba presente al momento de la auditoría y debió reconstruirse con evidencia de código + PM2 + base de datos.

---

## 0. Criterio de verdad y fuentes revisadas

### Fuente de verdad aplicada

Siguiendo la política del repositorio, el diagnóstico prioriza:

1. código ejecutable real;
2. bootstrap y wiring efectivo del proceso;
3. variables de entorno realmente cargadas;
4. estado operativo observado en PM2/logs/base de datos;
5. documentación sólo como apoyo contextual.

### Archivos revisados pedidos explícitamente

- `services/central-hub/src/index.js`
- `services/central-hub/src/config/environment.js`
- `services/central-hub/.env`
- `services/central-hub/.env.example`
- `services/central-hub/.env.test`
- `services/central-hub/ecosystem.config.js`
- `services/central-hub/src/modules/sender/services/programacionScheduler.js`
- `services/central-hub/src/modules/email/services/emailCampaigns.scheduler.js`
- `services/central-hub/src/modules/email/services/emailCampaignPrepare.service.js`
- `services/central-hub/src/modules/email/services/email.service.js`
- `services/central-hub/src/modules/email/controllers/emailCampaigns.controller.js`
- `services/central-hub/src/modules/email/routes/emailCampaigns.routes.js`
- `services/central-hub/frontend/src/components/destinatarios/GestionDestinatariosPage.jsx`
- `services/central-hub/frontend/src/services/email.js`
- `services/central-hub/frontend/src/components/destinatarios/EmailCampaignFormModal.jsx`

### Archivos adicionales revisados y por qué fue necesario

1. `services/central-hub/src/modules/email/services/emailCampaignRecipients.service.js`
   - necesario para validar si el modelo actual permite agregar recipients progresivamente a una campaña que ya inició.

2. `services/central-hub/src/modules/email/services/emailCampaignStats.service.js`
   - necesario para verificar cómo una campaña pasa a `en_progreso` o `finalizado` y qué condiciones cierran el ciclo.

3. `services/central-hub/src/integrations/mailer/mailerClient.js`
   - necesario para determinar si existía gating adicional, dependencia de variables de entorno o fallas posibles en la integración de envío real.

4. entorno operativo PM2 (`pm2 status`, `pm2 describe`, `pm2 env`) y logs reales del proceso
   - necesario para contrastar código vs runtime efectivo y confirmar el valor final de flags en producción.

5. estado real en MySQL de `ll_envios_email` y `ll_campanias_email`
   - necesario para reconstruir el ciclo real `prepare -> pending -> sent/finalizado` y no concluir sólo por teoría.

---

## 1. Diagnóstico

## 1.1 Qué pasa hoy realmente

### WhatsApp — **AS-IS IMPLEMENTADO**

- El scheduler de WhatsApp se inicia desde el mismo proceso principal de `central-hub`.
- El bootstrap llama `programacionScheduler.start()` en `src/index.js`.
- Ese scheduler sí está gobernado por el flag `AUTO_CAMPAIGNS_ENABLED`.
- Si el flag está en `false`, el scheduler sigue vivo pero aborta el `tick()` y no procesa campañas.
- Además, la lógica de WhatsApp depende del estado de sesión en `session-manager` antes de cada ejecución.

### Email — **AS-IS IMPLEMENTADO**

- El scheduler de Email también se inicia desde el mismo proceso principal de `central-hub`.
- El bootstrap llama `emailCampaignsScheduler.start()` en `src/index.js`.
- El scheduler Email **no consume** `AUTO_CAMPAIGNS_ENABLED`.
- Su única guardia explícita en código es `NODE_ENV === 'test'`.
- En producción, si el proceso está online, el scheduler Email hace `tick()` en loop cada `EMAIL_CAMPAIGNS_INTERVAL_MS` o cada 5 segundos por defecto.

### Flujo frontend Email — **AS-IS IMPLEMENTADO**

En `/email/campaigns/:campaignId/prospects`:

1. el botón **“Preparar envío Email”** ya no usa el composer manual;
2. el frontend llama `emailService.prepareCampaign(campaignId)`;
3. eso dispara `POST /api/email/campaigns/:id/prepare`;
4. el modal manual `EmailCampaignFormModal` quedó marcado como flujo manual aislado y fuera del flujo principal de campañas persistidas.

### Flujo backend Email — **AS-IS IMPLEMENTADO**

`POST /api/email/campaigns/:id/prepare`:

1. valida `cliente_id`;
2. valida `campaign_id`;
3. valida payload opcional `fecha_programada`;
4. busca la campaña propia del cliente;
5. valida que la campaña sea preparable (`borrador`, `pendiente`, `pausada`, `error`);
6. resuelve `email_from` desde la campaña o desde `ll_clientes_email_config`;
7. vuelve a setear en `ll_envios_email` asunto/body/provider y deja `PENDING` todo lo no enviado;
8. agenda **sólo el primer pending** con `scheduled_for`;
9. pone la campaña en `estado = 'pendiente'`;
10. deja que el scheduler Email encadene el resto.

### Evidencia operativa observada — **AS-IS IMPLEMENTADO**

Al momento de la auditoría:

- el proceso PM2 `leadmaster-central-hub` estaba `online`;
- `AUTO_CAMPAIGNS_ENABLED=false` estaba efectivamente cargado en PM2;
- los logs de error mostraban el abort periódico del scheduler WhatsApp por ese flag;
- no apareció ningún gating equivalente para Email;
- en MySQL existía evidencia de una campaña Email ya preparada y efectivamente procesada:
  - `ll_envios_email.id = 27`
  - `campania_email_id = 3`
  - `status = 'SENT'`
  - `scheduled_for = 2026-03-26 11:20:54`
  - `processing_started_at = 2026-03-26 11:20:56`
  - `sent_at = 2026-03-26 11:21:00`
  - `attempt_count = 1`
- la campaña `id = 3` estaba en `estado = 'finalizado'` con `updated_at = 2026-03-26 11:21:01`.

### Hallazgo clave

La hipótesis “`AUTO_CAMPAIGNS_ENABLED=false` impide el envío Email” **no está alineada con el código actual** y **no quedó confirmada por el runtime actual**.

El código muestra que:

- `AUTO_CAMPAIGNS_ENABLED` gobierna WhatsApp;
- Email no usa ese flag;
- Email sí pudo procesar una campaña preparada en el runtime auditado.

### 1.2 Evidencia final E2E validada

Al cierre de la validación end-to-end quedó confirmado que el caso auditado no se limitó a un `prepare` exitoso, sino que completó el ciclo real de envío y entrega.

#### Evidencia funcional validada

1. la campaña Email se preparó correctamente desde `/email/campaigns/3/prospects`;
2. la preparación usó la campaña persistida, no el composer manual;
3. el frontend disparó el flujo correcto `POST /api/email/campaigns/:id/prepare`.

#### Evidencia en base de datos validada

Para `ll_envios_email.id = 27` y `campania_email_id = 3` se verificó:

- `status = 'SENT'`;
- `processing_started_at` informado;
- `sent_at` informado;
- `attempt_count = 1`.

#### Evidencia de entrega real validada

También se validó recepción real en Gmail:

- asunto recibido: `Prueba E2E Cliente 52`;
- remitente recibido: `Desarrollo y Diseño <info@desarrolloydisenio.com.ar>`;
- contenido recibido coherente con la campaña persistida.

#### Conclusión de la validación E2E

El flujo persistido de campañas Email quedó validado end-to-end en este caso:

- `prepare` correcto;
- scheduler Email operativo;
- envío técnico operativo;
- entrega real en inbox;
- sender del cliente operativo para esta campaña.

---

## 2. Mapa de flags y entorno

## 2.1 Fuente real del flag `AUTO_CAMPAIGNS_ENABLED`

### Definición en archivos

Se encontró definido en:

- `services/central-hub/.env`
- `services/central-hub/.env.example`
- `services/central-hub/.env.test`
- `services/central-hub/ecosystem.config.js`
- `services/central-hub/jest.env.js`

### Parseo real

En `src/config/environment.js`:

- `const AUTO_CAMPAIGNS_ENABLED = process.env.AUTO_CAMPAIGNS_ENABLED === 'true';`

Esto implica:

- sólo el string exacto `'true'` habilita el flag;
- cualquier otro valor (`'false'`, vacío, undefined, typo) resulta en `false`.

## 2.2 Módulos que consumen el flag

### Consumo directo confirmado en código

**Sólo se encontró consumo en WhatsApp**:

- `src/modules/sender/services/programacionScheduler.js`

No se encontró consumo de `AUTO_CAMPAIGNS_ENABLED` en:

- `src/modules/email/services/emailCampaigns.scheduler.js`
- `src/modules/email/services/emailCampaignPrepare.service.js`
- `src/modules/email/services/email.service.js`
- controladores/rutas Email

### Conclusión de alcance

- **AS-IS IMPLEMENTADO:** el flag actual gobierna **sólo** el scheduler WhatsApp.
- **Desalineación semántica:** el nombre `AUTO_CAMPAIGNS_ENABLED` sugiere un switch global de campañas, pero el consumo real es exclusivo de WhatsApp.

## 2.3 Otras variables relevantes al flujo Email

### Email scheduler

Se leen directamente desde `process.env` en `emailCampaigns.scheduler.js`:

- `EMAIL_CAMPAIGNS_INTERVAL_MS` (default 5000)
- `EMAIL_CAMPAIGN_DELAY_MIN_SECONDS` (default 30)
- `EMAIL_CAMPAIGN_DELAY_MAX_SECONDS` (default 90)
- `EMAIL_CAMPAIGN_LOCK_STALE_SECONDS` (default 300)

### Integración Mailer

Se leen directamente en `integrations/mailer/mailerClient.js`:

- `MAILER_BASE_URL`
- `MAILER_TIMEOUT_MS`

### WhatsApp / seguridad operativa

Además del flag de campañas:

- `DRY_RUN` existe en `.env` y en PM2, pero en el material auditado no aparece como guard del scheduler Email.
- `SESSION_MANAGER_BASE_URL` sólo afecta el flujo WhatsApp/session manager.

## 2.4 Precedencia real `.env` / PM2 / defaults

### Wiring observado

1. `src/index.js` hace `require('./config/environment')` al arrancar.
2. `environment.js` llama `dotenv.config()` si no es Jest.
3. El proceso PM2 ya llega con variables `env` precargadas desde `ecosystem.config.js`.
4. `dotenv.config()` no fue llamado con opción `override`.

### Conclusión operativa

En el runtime PM2 auditado, la precedencia efectiva es:

1. **PM2 `env`**
2. `.env` como fallback cuando la variable no viene ya en el proceso
3. defaults hardcodeados en código

### Evidencia real de runtime

`pm2 env 5` mostró:

- `AUTO_CAMPAIGNS_ENABLED=false`
- `DRY_RUN=true`
- `NODE_ENV=production`
- `MAILER_BASE_URL` no aparecía explícito en el dump mostrado, pero el envío Email real sí funcionó para la campaña `id=3`, lo que indica que la integración mailer estaba operativa en ese momento por config efectiva del proceso o del entorno.

> Nota de certeza: alta para `AUTO_CAMPAIGNS_ENABLED=false` en PM2; media para el detalle exacto de por qué `MAILER_BASE_URL` no figuró en el recorte visible de `pm2 env 5`, dado que el envío real sí se ejecutó exitosamente.

---

## 3. Flujo real de ejecución

## 3.1 Trazado completo — Email

### Paso 1 — acción UI

En `GestionDestinatariosPage.jsx`, dentro del contexto `useEmailCampaignSelector`:

- el botón **“Preparar envío Email”** llama `prepararEnvioEmailCampania()`;
- ese método ejecuta `emailService.prepareCampaign(emailCampaignSeleccionada)`.

### Paso 2 — servicio frontend

En `frontend/src/services/email.js`:

- `prepareCampaign(campaignId, payload = {})`
- hace `POST /email/campaigns/:id/prepare`

### Paso 3 — ruta backend

En `src/modules/email/routes/emailCampaigns.routes.js`:

- `POST /:id/prepare`

### Paso 4 — controller backend

En `src/modules/email/controllers/emailCampaigns.controller.js`:

- `prepare(req, res)`
- valida auth, `campaign_id`, body
- delega en `emailCampaignPrepareService.prepareCampaign(...)`

### Paso 5 — servicio de prepare

En `src/modules/email/services/emailCampaignPrepare.service.js`:

- obtiene la campaña del cliente
- valida que sea preparable
- resuelve sender
- valida asunto/body/email_from
- verifica que existan rows en `ll_envios_email`
- actualiza rows del campaign:
  - `subject`
  - `body`
  - `provider = 'smtp'`
  - `status = 'PENDING'` para lo no `SENT`
  - limpia locks / retries / errores previos
- luego busca un pending y le pone `scheduled_for`
- actualiza `ll_campanias_email.estado = 'pendiente'`
- sincroniza stats

### Paso 6 — scheduler Email

En `src/modules/email/services/emailCampaigns.scheduler.js`:

- `start()` corre siempre salvo `NODE_ENV=test`
- `tick()` se ejecuta cada 5 segundos por defecto
- `listActiveCampaigns()` toma campañas:
  - `estado IN ('pendiente', 'en_progreso')`
  - `fecha_programada IS NULL OR <= NOW()`
- por campaña toma un lock MySQL `GET_LOCK`
- intenta `claimDueRow()` sobre rows:
  - `status = 'PENDING'`
  - `scheduled_for IS NOT NULL`
  - `scheduled_for <= NOW()`
  - lock libre o stale
- si no encuentra due row, intenta `scheduleNextPendingRow(campaign.id, 0)`
- al claimear:
  - setea `locked_by`
  - `locked_at = NOW()`
  - `processing_started_at = NOW()` si estaba null
  - `attempt_count += 1`
  - `last_attempt_at = NOW()`

### Paso 7 — envío real

`processCampaign()` llama:

- `emailService.sendEmail(...)`
- ese servicio usa `mailerClient.sendEmail(payload)`
- el cliente HTTP pega a `MAILER_BASE_URL + '/send'`

### Paso 8 — post-envío

Si sale bien:

- libera lock de la row
- sincroniza stats
- agenda el siguiente pending con delay aleatorio
- si ya no quedan pendientes, finaliza la campaña

Si falla:

- clasifica error
- requeue o marca `FAILED`
- reprograma siguiente pending si corresponde
- sincroniza stats
- finaliza si ya no quedan pendientes

### Paso 9 — cierre de campaña

`emailCampaignStats.service.finalizeCampaignIfCompleted()`:

- si `total_pendientes > 0`, no finaliza;
- si `total_pendientes = 0`, pone:
  - `estado = 'finalizado'` si hubo enviados
  - `estado = 'error'` si no hubo enviados

## 3.2 Trazado completo — WhatsApp

### Bootstrap

- `src/index.js` llama `programacionScheduler.start()`

### Guardias

En `programacionScheduler.js`:

- `start()` avisa si `AUTO_CAMPAIGNS_ENABLED=false`
- `tick()` aborta inmediatamente si `!env.autoCampaignsEnabled`

### Ejecución

Si el flag está habilitado:

- toma programaciones aprobadas en ventana válida
- verifica sesión `READY` en session-manager
- exige campaña WhatsApp en `en_progreso`
- toma envíos `pendiente`
- envía por session manager
- actualiza estado vía `cambiarEstado(...)`

### Conclusión de desacople actual

- **Wiring de proceso:** ambos schedulers arrancan en el mismo proceso Node.
- **Gobierno por flag:** sólo WhatsApp tiene corte maestro por `AUTO_CAMPAIGNS_ENABLED`.
- **Dependencias operativas:** WhatsApp depende de `session-manager`; Email depende de `mailer`.

---

## 4. Causa raíz probable

## 4.1 Qué no muestra la evidencia actual

No se encontró evidencia de que:

- `AUTO_CAMPAIGNS_ENABLED=false` bloquee Email;
- el scheduler Email comparta el mismo guard que WhatsApp;
- exista un filtro de estado/fecha/lock permanentemente incorrecto en el caso auditado;
- exista un problema de timezone en el caso observado.

## 4.2 Qué muestra la evidencia actual

### Evidencia fuerte

La misma campaña que se observó preparada terminó procesándose correctamente:

- row `27` pasó a `SENT`
- `processing_started_at` y `attempt_count` se completaron
- campaña `3` pasó a `finalizado`

### Reconstrucción más probable del episodio observado

La observación:

- `status = PENDING`
- `processing_started_at = NULL`
- `attempt_count = 0`

es exactamente compatible con la ventana temporal **entre**:

1. el `prepareCampaign()` que agenda el primer envío, y
2. el siguiente `tick()` del scheduler Email.

Con el runtime actual:

- `scheduled_for` quedó en `2026-03-26 11:20:54`
- `processing_started_at` recién apareció en `2026-03-26 11:20:56`
- el envío terminó en `2026-03-26 11:21:00`

Eso indica que la row estuvo en `PENDING` con `attempt_count = 0` por unos segundos antes de ser reclamada. En otras palabras:

- **la evidencia actual no respalda un “bloqueo indefinido”** para el caso auditado;
- **sí respalda una observación transitoria antes del próximo tick del scheduler Email**.

## 4.3 Cuándo sí puede quedar realmente indefinida en `PENDING`

### Caso A — scheduler Email no corre

Podría pasar si:

- el proceso `central-hub` no está online;
- el proceso arranca por una entrada distinta que no llama `emailCampaignsScheduler.start()`;
- el worker Email se extrae en el futuro y nadie lo levanta.

### Caso B — la row queda `PENDING` pero sin `scheduled_for`

Eso no significa que el scheduler esté fallando. Significa más bien:

- recipients cargados pero campaña no preparada;
- o recipients reencolados sin rearmado del primer `scheduled_for`.

La evidencia real actual incluye un ejemplo de este patrón:

- `ll_envios_email.id = 26`
- `status = PENDING`
- `scheduled_for = NULL`
- campaña `2` sigue `borrador`

Eso **no es** falla del scheduler. Es una campaña no preparada.

### Caso C — campaña fuera del filtro del scheduler

Si la campaña no está en:

- `estado IN ('pendiente', 'en_progreso')`
- y/o `fecha_programada <= NOW()`

el scheduler no la ve.

### Caso D — locks anómalos

Si hubiera `locked_at` fresco y otro proceso hubiera tomado la row, la row podría esperar hasta el stale timeout.

Pero si la evidencia es:

- `attempt_count = 0`
- `processing_started_at = NULL`
- `locked_at = NULL`

entonces **claimDueRow() nunca llegó a ejecutar**, por lo que no es un problema de lock ya adquirido.

## 4.4 Causa raíz más probable para la sospecha original

### Conclusión

La causa raíz más probable del episodio reportado es:

- **interpretación operacional ambigua del estado `PENDING` durante la ventana entre prepare y tick**, amplificada por el antecedente de `AUTO_CAMPAIGNS_ENABLED=false` en WhatsApp.

### Justificación técnica

- el flag global hoy tiene nombre ambiguo;
- los logs operativos visibles muestran constantemente el bloqueo de WhatsApp;
- ambos schedulers viven en el mismo proceso;
- Email no loguea ticks normales con la misma verbosidad;
- por eso es fácil inferir erróneamente que Email también quedó cortado, aunque el código no lo haga.

La evidencia E2E final refuerza esta lectura:

- el caso auditado efectivamente avanzó de `PENDING` a `SENT`;
- hubo `processing_started_at`, `sent_at` y `attempt_count = 1`;
- hubo entrega real en inbox;
- por lo tanto, en este caso **no quedó confirmado un bloqueo real persistente del scheduler Email**.

### Matiz importante

Esto **no elimina** la necesidad de desacoplar la operación. Al contrario:

- el incidente puntual no prueba que Email esté bloqueado por `AUTO_CAMPAIGNS_ENABLED`;
- pero sí prueba que el naming actual del flag y el proceso compartido generan confusión operacional;
- y por eso sigue siendo recomendable desacoplar WhatsApp y Email a nivel de gobierno operativo y observabilidad.

---

## 5. Riesgos del diseño actual

## 5.1 Acoplamiento operacional entre WhatsApp y Email

### Riesgo 1 — mismo proceso PM2

Aunque los schedulers no compartan hoy el mismo flag de ejecución efectiva:

- comparten proceso Node;
- comparten reinicios;
- comparten logs;
- comparten bootstrap.

Si cae `central-hub`, caen ambos schedulers.

### Riesgo 2 — naming engañoso del flag

`AUTO_CAMPAIGNS_ENABLED` suena a corte maestro de campañas en general, pero en código sólo gobierna WhatsApp.

Eso genera:

- confusión operacional;
- falsas asociaciones causales;
- riesgo de activar/desactivar cosas creyendo que afectan ambos canales.

### Riesgo 3 — observabilidad asimétrica

WhatsApp deja trazas operativas visibles cada minuto.
Email casi no deja logs de tick normales.

Resultado:

- WhatsApp parece “controlado”;
- Email parece “silencioso” o “congelado” aunque esté funcionando.

## 5.2 Riesgo funcional de negocio en Email

El requisito de negocio declarado fue:

- una campaña Email puede enviarse en varias tandas;
- en distintos momentos;
- con destinatarios agregados progresivamente.

### Lo que el diseño actual sí permite

- preparar una campaña con recipients ya cargados;
- encadenar el envío técnico vía scheduler;
- re-preparar campañas en estados `borrador`, `pendiente`, `pausada`, `error`.

### Lo que el diseño actual no permite bien

No soporta bien el caso:

- campaña ya iniciada o finalizada
- luego agregar nuevos recipients
- luego re-disparar sólo los pendientes nuevos

porque `emailCampaignRecipients.service.js` bloquea agregado si:

- `fecha_inicio_envio` existe, o
- `total_enviados > 0`

Eso contradice el requerimiento de tandas progresivas.

### Conclusión

El problema estructural actual **no es** que falte completamente un botón manual.

El problema estructural es:

1. existe `prepare`, pero su semántica está pensada como “armado inicial” del pipeline;
2. el servicio de recipients bloquea campañas ya iniciadas;
3. la campaña puede quedar `finalizado` y eso corta la operativa incremental;
4. no hay una acción explícita para “reanudar pendientes nuevos” como concepto de negocio.

---

## 6. Diseño recomendado

## 6.1 Flags separados — **TARGET / PLANNED recomendado**

Se recomienda pasar de:

- `AUTO_CAMPAIGNS_ENABLED`

hacia:

- `AUTO_WHATSAPP_CAMPAIGNS_ENABLED`
- `AUTO_EMAIL_CAMPAIGNS_ENABLED`

### Motivo

Porque hoy hay dos automatizaciones distintas:

- WhatsApp programado por ventanas/cupos/sesión READY
- Email encolado por `prepare + scheduler + mailer`

y comparten nombre de gobierno sólo en lo semántico, no en el código.

### Compatibilidad hacia atrás recomendada

Durante transición:

- si existe `AUTO_WHATSAPP_CAMPAIGNS_ENABLED`, usarlo para WhatsApp;
- si existe `AUTO_EMAIL_CAMPAIGNS_ENABLED`, usarlo para Email;
- si no existen, caer como fallback a `AUTO_CAMPAIGNS_ENABLED` para mantener compatibilidad.

## 6.2 PM2 separado — **recomendado**

### Recomendación

Separar al menos en dos procesos PM2:

1. `leadmaster-central-hub-api`
2. `leadmaster-email-scheduler`

Opcionalmente:

3. `leadmaster-whatsapp-scheduler`

### Ventajas

- restart independiente;
- logs independientes;
- flags independientes;
- menor ambigüedad operacional;
- posibilidad de pausar WhatsApp sin tocar Email;
- posibilidad de pausar Email sin tocar API ni WhatsApp.

### Evaluación práctica

- **Fase mínima aceptable:** mantener un solo proceso pero con flags separados.
- **Fase operativa recomendable:** separar al menos Email scheduler del API principal.

## 6.3 Acción manual explícita para Email — **recomendada**

### Requisito de negocio

Una campaña Email necesita poder:

- sumar recipients en distintos momentos;
- reactivar pendientes sin depender de una programación global;
- coexistir con el scheduler, no reemplazarlo.

### Evaluación del endpoint actual `POST /api/email/campaigns/:id/prepare`

#### Lo que sí resuelve hoy

- armado de campaña persistida;
- rearmado de subject/body/provider;
- requeue de pendientes no enviados;
- agenda del primer envío;
- arranque de la cadena automática.

#### Lo que no resuelve completamente

- no sirve bien para campañas ya cerradas como `finalizado` si después se quieren agregar nuevos recipients;
- no resuelve por sí mismo la restricción de `addRecipients()` que prohíbe campañas iniciadas;
- mezcla semántica de “prepare inicial” con “reactivar nueva tanda” sin un contrato explícito de negocio.

### Recomendación concreta

Mantener `POST /api/email/campaigns/:id/prepare`, pero redefinir la operación de negocio en dos capas:

1. **Prepare/armado de campaña**
   - asegura subject/body/remitente/estado listo.

2. **Resume/trigger de pendientes**
   - acción explícita para que una campaña con recipients `PENDING` vuelva a poner un `scheduled_for = NOW()` y retome la cola.

### Opción recomendada de contrato

Agregar un endpoint nuevo del tipo:

- `POST /api/email/campaigns/:id/resume-pending`

Responsabilidad:

- no redacta contenido;
- no vuelve a inventar composer manual;
- no hace envío sincrónico en request;
- sólo re-activa la cola persistida para que el scheduler continúe.

### Por qué no reemplazar el scheduler

Porque el scheduler ya resuelve correctamente:

- locking
- retries
- chaining
- delays
- finalización
- integración con stats

El botón manual debe **despertar** o **reanudar** la cola, no duplicar la lógica de envío.

## 6.4 Soporte real a tandas progresivas — **recomendado**

Para cumplir el requisito de negocio, hace falta además:

1. permitir agregar recipients a campañas ya iniciadas/finalizadas, al menos bajo reglas controladas;
2. evitar duplicar `SENT`;
3. permitir que los nuevos recipients entren como `PENDING`;
4. tener una acción manual que reactive sólo los pendientes nuevos.

### Diseño recomendado

- permitir `addRecipients()` también en campañas `finalizado`, `pendiente`, `pausada`, `error`;
- si se insertan o requeuean nuevos recipients en campaña `finalizado`, pasar la campaña a un estado reanudable (`pendiente` o `pausada`, según decisión de producto);
- usar `resume-pending` para disparar la siguiente tanda;
- dejar que el scheduler haga el resto.

---

## 7. Cambios concretos sugeridos

## 7.1 Bootstrap / entorno

### Archivos

- `services/central-hub/src/config/environment.js`
- `services/central-hub/.env`
- `services/central-hub/.env.example`
- `services/central-hub/.env.test`
- `services/central-hub/ecosystem.config.js`

### Cambios

- agregar parser explícito para:
  - `AUTO_WHATSAPP_CAMPAIGNS_ENABLED`
  - `AUTO_EMAIL_CAMPAIGNS_ENABLED`
- mantener fallback a `AUTO_CAMPAIGNS_ENABLED`
- exportar ambos flags ya normalizados

## 7.2 Scheduler WhatsApp

### Archivo

- `services/central-hub/src/modules/sender/services/programacionScheduler.js`

### Cambio

- reemplazar `env.autoCampaignsEnabled` por `env.autoWhatsappCampaignsEnabled`
- actualizar logs para que digan explícitamente “WhatsApp”

## 7.3 Scheduler Email

### Archivo

- `services/central-hub/src/modules/email/services/emailCampaigns.scheduler.js`

### Cambios

- agregar guard opcional por `AUTO_EMAIL_CAMPAIGNS_ENABLED`
- loggear al menos:
  - inicio de scheduler
  - cantidad de campañas activas por tick
  - cuando una campaña queda sin `due row`
  - cuando se agenda `next pending`
- esto reduce el vacío observacional actual

## 7.4 Recipient lifecycle Email

### Archivo

- `services/central-hub/src/modules/email/services/emailCampaignRecipients.service.js`

### Cambios

- revisar/eliminar la restricción `CAMPAIGN_ALREADY_STARTED`
- permitir tandas progresivas sin reabrir manualmente otra campaña paralela
- preservar protección contra duplicados `SENT`

## 7.5 Prepare / resume Email

### Archivos

- `services/central-hub/src/modules/email/routes/emailCampaigns.routes.js`
- `services/central-hub/src/modules/email/controllers/emailCampaigns.controller.js`
- `services/central-hub/src/modules/email/services/emailCampaignPrepare.service.js`
- posiblemente un nuevo servicio, por claridad semántica:
  - `emailCampaignResume.service.js`

### Cambios

- mantener `prepare` como armado general de campaña
- agregar endpoint nuevo `resume-pending` o equivalente
- responsabilidad del endpoint nuevo:
  - verificar campaña propia
  - verificar si hay `PENDING`
  - si no hay row con `scheduled_for`, poner `scheduled_for = NOW()` en la siguiente pending
  - si campaña está `finalizado` pero hay nuevos pending, devolverla a `pendiente`

## 7.6 PM2

### Archivo

- `services/central-hub/ecosystem.config.js`

### Cambio recomendado

Pasar de una app única a múltiples apps, al menos:

- API
- Email scheduler
- WhatsApp scheduler

si no se implementa de inmediato, dejar al menos variables separadas y logs diferenciados.

---

## 8. Plan de implementación

## Fase 1 — saneamiento operacional mínimo

1. introducir flags separados en `environment.js`;
2. migrar WhatsApp a `AUTO_WHATSAPP_CAMPAIGNS_ENABLED`;
3. agregar guard explícito a Email con `AUTO_EMAIL_CAMPAIGNS_ENABLED`;
4. mantener fallback al flag viejo para compatibilidad;
5. mejorar logs de ambos schedulers.

## Fase 2 — desacople operativo

1. separar proceso API de proceso Email scheduler en PM2;
2. opcionalmente separar también WhatsApp scheduler;
3. validar restart independiente y logs independientes.

## Fase 3 — soporte de negocio para tandas Email

1. ajustar `addRecipients()` para campañas iniciadas/finalizadas bajo reglas seguras;
2. agregar endpoint `resume-pending`;
3. si entran nuevos recipients a campaña finalizada, volverla a `pendiente` cuando corresponda;
4. exponer botón explícito en UI tipo:
   - `Procesar pendientes ahora`
   - o `Reanudar envíos`

## Fase 4 — frontend Email

1. mantener `Preparar envío Email` para armado inicial si negocio lo decide;
2. agregar acción separada para reanudar pendientes;
3. mostrar claramente:
   - campaña `borrador`
   - campaña `pendiente`
   - campaña `en_progreso`
   - campaña `finalizado`
   - pendientes sin scheduler activo

---

## 9. Plan de validación

## 9.1 Casos de prueba técnicos

### Caso A — WhatsApp deshabilitado, Email habilitado

- `AUTO_WHATSAPP_CAMPAIGNS_ENABLED=false`
- `AUTO_EMAIL_CAMPAIGNS_ENABLED=true`

Verificar:

- WhatsApp no procesa programaciones;
- Email sí procesa campañas preparadas.

### Caso B — Email deshabilitado, WhatsApp habilitado

- inverso del anterior

Verificar:

- Email no procesa `PENDING`
- WhatsApp sí procesa programaciones.

### Caso C — campaña Email preparada

1. crear campaña con asunto/body válidos;
2. agregar recipients;
3. ejecutar `prepare`;
4. verificar en DB:
   - campaña `estado='pendiente'`
   - una row `PENDING` con `scheduled_for` no null
5. verificar en logs:
   - tick Email detecta campaña
6. verificar en DB:
   - `processing_started_at` se completa
   - `attempt_count` sube a 1
   - `status` termina en `SENT` o `FAILED`

### Caso D — campaña con recipients agregados después de una primera tanda

1. campaña ya con `total_enviados > 0`
2. agregar recipients nuevos
3. ejecutar `resume-pending`
4. verificar que:
   - no se duplican `SENT`
   - los nuevos recipients pasan a la cola
   - el scheduler los procesa

## 9.2 Qué verificar en base de datos

### `ll_envios_email`

- `status`
- `scheduled_for`
- `processing_started_at`
- `last_attempt_at`
- `attempt_count`
- `locked_at`
- `locked_by`
- `sent_at`
- `error_message`

### `ll_campanias_email`

- `estado`
- `fecha_programada`
- `fecha_inicio_envio`
- `fecha_fin_envio`
- `total_destinatarios`
- `total_enviados`
- `total_fallidos`

## 9.3 Qué verificar en logs

### PM2 / central-hub

- start de schedulers
- warnings de flags
- ticks de WhatsApp
- ticks o actividad de Email
- errores de mailer

### Mailer

- recepción del `/send`
- errores SMTP / provider

## 9.4 Qué verificar en UI

- que `Preparar envío Email` no abra composer manual en campañas persistidas;
- que el estado visible de recipients siga resolviéndose por campaña;
- que exista una acción explícita y honesta para reanudar pendientes cuando se implemente;
- que el flujo de selección de destinatarios Email sin campaña base siga intacto.

## 9.5 Evidencia E2E final ya validada

Además del plan de validación propuesto, este diagnóstico quedó contrastado con una validación real ya completada:

1. se preparó la campaña Email `3` desde `/email/campaigns/3/prospects`;
2. el flujo usó la campaña persistida y no el composer manual;
3. `ll_envios_email.id = 27` terminó en `SENT`;
4. la row tuvo `processing_started_at`, `sent_at` y `attempt_count = 1`;
5. el correo llegó efectivamente a Gmail;
6. el asunto recibido fue `Prueba E2E Cliente 52`;
7. el remitente recibido fue `Desarrollo y Diseño <info@desarrolloydisenio.com.ar>`;
8. el contenido recibido fue coherente con la campaña persistida.

Esta evidencia fortalece la conclusión de que el flujo persistido de Email sí quedó validado end-to-end, sin invalidar los riesgos estructurales detectados en la arquitectura actual.

---

## 10. Conclusión ejecutiva

### Estado actual real

- **WhatsApp** y **Email** arrancan hoy en el mismo proceso `central-hub`.
- **WhatsApp** sí está cortado por `AUTO_CAMPAIGNS_ENABLED`.
- **Email** no usa ese flag en el código actual.
- El caso auditado no mostró un bloqueo real persistente del scheduler Email: la campaña preparada terminó procesándose, enviándose y entregándose correctamente.

### Validación E2E del flujo Email persistido

El flujo de campañas Email persistidas quedó validado end-to-end en el caso auditado:

- `prepare` correcto desde la pantalla de campaña;
- scheduler Email correcto;
- send técnico correcto;
- entrega real correcta en inbox;
- sender del cliente funcionando correctamente para esa campaña.

### Causa raíz probable del episodio observado

La evidencia actual apunta más a:

- una observación transitoria del estado `PENDING` antes del siguiente tick del scheduler Email,

que a:

- un bloqueo real causado por `AUTO_CAMPAIGNS_ENABLED`.

Por lo tanto, el incidente puntual auditado **no prueba** que Email esté bloqueado por `AUTO_CAMPAIGNS_ENABLED`.

### Problema estructural verdadero

El problema estructural más importante no es el scheduler Email en sí, sino que el diseño actual **no soporta bien tandas progresivas** de una misma campaña Email porque:

- `addRecipients()` bloquea campañas ya iniciadas;
- no existe una acción explícita y semánticamente clara para reanudar pendientes nuevos;
- el naming del flag global induce diagnósticos erróneos.

Aunque el mail sí llegó correctamente en la validación E2E final, estos problemas estructurales siguen siendo reales y siguen justificando cambios de arquitectura operable.

### Recomendación principal

1. separar flags de WhatsApp y Email;
2. separar procesos PM2 al menos para Email scheduler vs API;
3. mantener el scheduler Email;
4. agregar una acción explícita de reanudación de pendientes para Email;
5. adaptar `addRecipients()` para soportar el requisito de negocio de tandas progresivas.

Estado documental del hallazgo:

- **AS-IS IMPLEMENTADO:** schedulers distintos, mismo proceso, flag global sólo consumido por WhatsApp, Email preparado vía endpoint real y procesado por scheduler.
- **DESALINEADO / RIESGO OPERATIVO:** naming del flag y proceso único generan ambigüedad operacional.
- **TARGET / PLANNED recomendado:** flags separados, procesos separados y una acción explícita de reanudación de pendientes (`resume-pending`) para Email.