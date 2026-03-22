# DIAGNOSTICO - Impacto sobre flujo WhatsApp al intervenir ll_campanias_whatsapp

## Fecha

2026-03-21

## Destino

services/central-hub/docs/diagnosticos/DIAGNOSTICO_IMPACTO_WHATSAPP_LL_CAMPANIAS_2026-03-21.md

## Base documental obligatoria

Este diagnostico se realizó tomando como base:

- services/central-hub/docs/planificacion/REVISION_ARQUITECTONICA_CAMPANAS_INDEPENDIENTES_2026-03-21.md
- services/central-hub/docs/planificacion/PLAN-INTERVENCION-CAMPANAS-POR-CANAL-2026-03-20.md
- services/central-hub/docs/diagnosticos/DIAGNOSTICO_MODULO_CAMPANAS_CONTRATO_REAL_2026-03-20.md
- services/central-hub/docs/planificacion/PROPUESTA_TECNICA_PRIMER_CORTE_CAMPANAS_2026-03-20.md

## Fuente adicional considerada

Se consideró además el dump:

- /root/leadmaster-workspace/AUXILIAR/BD-Estructura/2026-03-21-bd-2.sql

Ese dump aporta evidencia relevante de estructura real de base hoy no reflejada completamente en `services/central-hub/schema.sql`.

## Alcance

El relevamiento se limita a estos archivos operativos del dominio WhatsApp:

- services/central-hub/schema.sql
- services/central-hub/src/modules/sender/controllers/campaignsController.js
- services/central-hub/src/modules/sender/controllers/destinatariosController.js
- services/central-hub/src/modules/sender/controllers/enviosController.js
- services/central-hub/src/modules/sender/services/estadoService.js
- services/central-hub/src/modules/sender/services/programacionScheduler.js

## Resumen ejecutivo

El flujo operativo actual de WhatsApp depende de un conjunto corto pero crítico de campos de `ll_campanias_whatsapp`.

Los campos realmente sensibles para no romper WhatsApp hoy son:

- `id`
- `cliente_id`
- `nombre`
- `mensaje`
- `estado`

Además, el dump real de base muestra la existencia de:

- `modo_envio`

pero en los archivos operativos relevados no se verificó uso directo de `modo_envio`.

La consecuencia técnica es clara:

- hay margen para cambios aditivos sobre campos no usados por el flujo operativo directo
- no hay margen seguro para alterar semántica, nombre, tipo o comportamiento de los campos base que hoy alimentan el dominio WhatsApp
- por protección del flujo actual, conviene intervenir primero `campaignsController.js` antes que `schema.sql`

## 1. Estructura verificable de ll_campanias_whatsapp

### 1.1 Schema visible del repo

En `services/central-hub/schema.sql`, `ll_campanias_whatsapp` expone:

- `id`
- `nombre`
- `mensaje`
- `fecha_creacion`
- `estado`
- `cliente_id`

### 1.2 Estructura real observada en dump auxiliar

En `/root/leadmaster-workspace/AUXILIAR/BD-Estructura/2026-03-21-bd-2.sql`, `ll_campanias_whatsapp` expone además:

- `modo_envio` enum('manual','meta') not null default 'manual'

### 1.3 Implicancia inmediata

Hay una divergencia verificable entre:

- el schema visible del repo
- la estructura real relevada en el dump auxiliar

Eso vuelve especialmente importante no tomar `schema.sql` como única fuente de verdad para el primer movimiento técnico si el objetivo principal es proteger WhatsApp actual.

## 2. Campos de ll_campanias_whatsapp usados realmente por el flujo operativo de WhatsApp

## 2.1 Campo `id`

Uso verificado:

- clave primaria de campaña
- usada como ancla de todos los joins por `campania_id`
- usada en validaciones de pertenencia y existencia
- usada por scheduler para resolver la campaña asociada a una programación

Archivos donde impacta directamente:

- `campaignsController.js`
- `destinatariosController.js`
- `enviosController.js`
- `programacionScheduler.js`
- `schema.sql` por FKs desde `ll_programaciones` y `ll_envios_whatsapp`

Nivel de criticidad:

- crítico

## 2.2 Campo `cliente_id`

Uso verificado:

- control multi-tenant de campañas
- validación de permisos sobre campañas
- validación de pertenencia de envíos a cliente vía join con campaña

Archivos donde impacta directamente:

- `campaignsController.js`
- `destinatariosController.js`
- `enviosController.js`

Nivel de criticidad:

- crítico

## 2.3 Campo `nombre`

Uso verificado:

- listado y detalle de campañas
- auditoría y mensajes operativos
- nombre de campaña expuesto en flujos manuales y automáticos

Archivos donde impacta directamente:

- `campaignsController.js`
- `destinatariosController.js` lo lee junto con `mensaje` al agregar destinatarios
- `enviosController.js` lo usa como `campania_nombre` en `prepareManual`, `confirmManual`, `markManualError` y `reintentar`
- `programacionScheduler.js` consulta `nombre` al cargar campaña de una programación

Nivel de criticidad:

- alto

## 2.4 Campo `mensaje`

Uso verificado:

- contenido base de campaña usado para generar `mensaje_final` de cada envío WhatsApp
- validación obligatoria en create y update de campañas
- lectura al agregar destinatarios

Archivos donde impacta directamente:

- `campaignsController.js`
- `destinatariosController.js`

Detalle operativo:

- `destinatariosController.agregarDestinatarios` lee `SELECT id, nombre, mensaje FROM ll_campanias_whatsapp`
- toma `campania.mensaje`
- construye `mensajeFinal`
- inserta ese valor en `ll_envios_whatsapp.mensaje_final`

Implicancia:

- cualquier cambio de nombre, semántica, nulabilidad o ubicación de `mensaje` impacta directamente la generación de envíos WhatsApp

Nivel de criticidad:

- crítico

## 2.5 Campo `estado`

Uso verificado:

- listado y detalle de campañas
- control de editabilidad de campañas
- control de aprobación de campañas
- habilitación del scheduler para procesar campañas

Archivos donde impacta directamente:

- `campaignsController.js`
- `programacionScheduler.js`

Detalle operativo:

- `campaignsController.update` bloquea edición según `campaign.estado`
- `campaignsController.approve` valida `campania.estado`
- `programacionScheduler.js` consulta `SELECT id, nombre, estado FROM ll_campanias_whatsapp WHERE id = ?`
- el scheduler aborta si el estado de la campaña no es `en_progreso`

Implicancia:

- cambiar el significado operativo del estado sin normalización controlada puede cortar campañas automáticas ya aprobadas

Nivel de criticidad:

- crítico

## 2.6 Campo `modo_envio`

Uso verificado:

- no se verificó uso directo en los archivos operativos relevados

Fuente verificable:

- aparece en el dump auxiliar de estructura real
- no aparece en `services/central-hub/schema.sql`
- no apareció referenciado en código relevado bajo `services/central-hub/src/**`

Implicancia:

- no puede asumirse como campo seguro de eliminar o reinterpretar, porque existe en base real
- tampoco puede afirmarse que sea crítico para el flujo operativo relevado, porque no se observó consumo directo en estos archivos

Nivel de criticidad:

- indeterminado en código relevado
- sensible por existir en base real

## 3. Dependencias directas pedidas

## 3.1 Dependencias sobre `mensaje`

Dependencias directas verificadas:

- `campaignsController.create` exige `mensaje`
- `campaignsController.update` exige `mensaje`
- `campaignsController.list` y `detail` lo devuelven
- `destinatariosController.agregarDestinatarios` usa `campania.mensaje` para poblar `ll_envios_whatsapp.mensaje_final`

Conclusión:

- `mensaje` es el campo más directamente acoplado al flujo operativo de WhatsApp

## 3.2 Dependencias sobre `estado`

Dependencias directas verificadas:

- `campaignsController.list` y `detail` devuelven `estado`
- `campaignsController.update` usa `estado` para bloquear edición
- `campaignsController.approve` usa `estado` para validar aprobación
- `programacionScheduler.js` usa `campania.estado` para decidir si procesa o aborta la campaña

Conclusión:

- `estado` impacta tanto el CRUD como la ejecución automática de WhatsApp

## 3.3 Dependencias sobre `modo_envio`

Dependencias directas verificadas:

- ninguna dentro de los archivos operativos relevados

Conclusión:

- `modo_envio` no aparece como dependencia directa del flujo WhatsApp observado en esta evaluación
- aun así, por existir en estructura real, no conviene tocarlo en el primer corte sin un relevamiento más amplio

## 3.4 Dependencias sobre `campania_id`

`campania_id` no es columna de `ll_campanias_whatsapp`, pero sí la dependencia relacional más crítica del flujo operativo.

Dependencias directas verificadas:

- `ll_envios_whatsapp.campania_id` referencia `ll_campanias_whatsapp.id`
- `ll_programaciones.campania_id` referencia `ll_campanias_whatsapp.id`
- `destinatariosController` usa joins de `ll_envios_whatsapp` con `ll_campanias_whatsapp`
- `enviosController` valida pertenencia del envío al cliente haciendo `INNER JOIN ll_campanias_whatsapp camp ON env.campania_id = camp.id`
- `programacionScheduler.js` consulta pendientes por `campania_id`

Conclusión:

- cualquier cambio que afecte la identidad o semántica de la campaña repercute en envíos y programaciones existentes

## 4. Consultas, joins, validaciones o transiciones que podrían verse afectadas

## 4.1 Consultas afectadas por cambios en `mensaje`

Consultas críticas:

- `SELECT id, nombre, mensaje FROM ll_campanias_whatsapp WHERE id = ? AND cliente_id = ?`
- `SELECT id, nombre, mensaje, fecha_creacion, estado, cliente_id FROM ll_campanias_whatsapp ...`

Impacto:

- romperían generación de `mensaje_final`
- romperían create/update/list/detail

## 4.2 Consultas y validaciones afectadas por cambios en `estado`

Consultas críticas:

- `SELECT id, nombre, estado FROM ll_campanias_whatsapp WHERE id = ?`
- query de `campaignsController.update` que trae `c.estado`

Validaciones críticas:

- validación de campañas editables
- validación de campañas aprobables
- habilitación de scheduler solo cuando `campania.estado === 'en_progreso'`

Impacto:

- cambios bruscos de nomenclatura o semántica podrían bloquear campañas programadas o aprobar campañas de forma inconsistente

## 4.3 Joins afectados por cambios estructurales en identidad o pertenencia

Joins críticos:

- `ll_envios_whatsapp env LEFT JOIN ll_campanias_whatsapp camp ON env.campania_id = camp.id`
- `ll_envios_whatsapp env INNER JOIN ll_campanias_whatsapp camp ON env.campania_id = camp.id`
- FK `ll_programaciones.campania_id -> ll_campanias_whatsapp.id`
- FK `ll_envios_whatsapp.campania_id -> ll_campanias_whatsapp.id`

Impacto:

- cualquier modificación de PK, FKs o semántica de identidad de campaña es de alto riesgo para WhatsApp actual

## 4.4 Transiciones afectadas indirectamente

Aunque `estadoService.js` no toca `ll_campanias_whatsapp`, sí depende de que el universo de envíos siga siendo coherente con su campaña padre.

Impacto indirecto:

- si se altera el criterio de qué campaña está habilitada o editable sin respetar el flujo actual, pueden aparecer envíos pendientes o programaciones desalineadas respecto de la campaña de origen

## 5. Cambios aditivos seguros vs cambios riesgosos

## 5.1 Cambios aditivos seguros

Se consideran relativamente seguros, siempre que sean aditivos y no alteren comportamiento actual:

- agregar columnas nuevas nullable o con default no disruptivo que no sean usadas por el flujo operativo actual
- agregar `descripcion` si no cambia consultas existentes
- agregar `fecha_actualizacion` si se maneja con default compatible
- agregar `programada` y `fecha_envio` si no se altera el comportamiento actual del scheduler ni de los controladores operativos
- actualizar documentación o schema visible para reflejar mejor campos ya existentes, siempre que no se modifique el flujo real

## 5.2 Cambios riesgosos para WhatsApp actual

Se consideran riesgosos y no recomendables en este primer movimiento:

- renombrar `mensaje`
- mover el contenido de campaña fuera de `mensaje` sin compatibilidad fuerte
- cambiar la semántica operativa de `estado` sin mapear el caso `en_progreso` usado por scheduler
- eliminar o reinterpretar `modo_envio` sin relevamiento más amplio
- cambiar `id` o su relación con `campania_id`
- cambiar `cliente_id` o el criterio multi-tenant de pertenencia
- tocar FKs entre `ll_campanias_whatsapp`, `ll_envios_whatsapp` y `ll_programaciones`
- introducir una abstracción que convierta `ll_campanias_whatsapp` en campaña genérica multicanal

## 6. Recomendación de primer archivo a intervenir

## 6.1 Recomendación

El primer archivo a intervenir no debería ser `services/central-hub/schema.sql`.

La recomendación es empezar por:

- `services/central-hub/src/modules/sender/controllers/campaignsController.js`

## 6.2 Fundamento

Razones principales:

- el flujo operativo actual de WhatsApp depende de `mensaje`, `estado`, `id` y `cliente_id` más por comportamiento de controlador y validaciones que por el `schema.sql` visible del repo
- el dump auxiliar demuestra que la base real ya diverge del `schema.sql` visible
- intervenir `schema.sql` primero no protege por sí mismo el flujo en ejecución
- intervenir primero `campaignsController.js` permite sanear contradicciones del CRUD sin tocar todavía relaciones críticas del dominio operativo
- el controlador hoy ya contiene el mayor foco de inconsistencia visible: estados contradictorios, columnas asumidas sin respaldo y contrato HTTP artificial

## 6.3 Condición para tocar schema después

Después de estabilizar el controlador respecto del dominio WhatsApp realmente usado, recién conviene ajustar:

- `services/central-hub/schema.sql`

Objetivo de ese segundo paso:

- reflejar el contrato mínimo ya saneado sin poner en riesgo el flujo operativo actual

## 7. Conclusión

El flujo WhatsApp actual está acoplado de forma directa a un núcleo pequeño de campos de campaña:

- `id`
- `cliente_id`
- `nombre`
- `mensaje`
- `estado`

También depende críticamente de la relación:

- `campania_id` en `ll_envios_whatsapp`
- `campania_id` en `ll_programaciones`

La señal más importante de este relevamiento es que `modo_envio` existe en la base real pero no aparece como dependencia directa del flujo operativo relevado, mientras que `mensaje` y `estado` sí tienen impacto directo e inmediato.

Por protección del dominio WhatsApp, el primer movimiento técnico más seguro es sanear `campaignsController.js` y no empezar por `schema.sql`.
