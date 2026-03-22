# REPORTE DE CIERRE - Primer corte de saneamiento de campanas WhatsApp

## Fecha

2026-03-21

## Destino

services/central-hub/docs/reports/REPORTE_CIERRE_PRIMER_CORTE_CAMPANAS_WHATSAPP_2026-03-21.md

## Base documental

Este cierre toma como base los siguientes documentos del servicio:

- services/central-hub/docs/planificacion/REVISION_ARQUITECTONICA_CAMPANAS_INDEPENDIENTES_2026-03-21.md
- services/central-hub/docs/planificacion/PLAN-INTERVENCION-CAMPANAS-POR-CANAL-2026-03-20.md
- services/central-hub/docs/diagnosticos/DIAGNOSTICO_MODULO_CAMPANAS_CONTRATO_REAL_2026-03-20.md
- services/central-hub/docs/diagnosticos/DIAGNOSTICO_IMPACTO_WHATSAPP_LL_CAMPANIAS_2026-03-21.md
- services/central-hub/docs/planificacion/PROPUESTA_TECNICA_PRIMER_CORTE_CAMPANAS_2026-03-20.md

## A. Objetivo del corte

Cerrar un primer saneamiento conservador del dominio campanas WhatsApp en `services/central-hub`, priorizando:

- coherencia entre backend y frontend
- normalizacion minima del contrato CRUD actual
- proteccion del flujo operativo ya existente de WhatsApp
- reduccion de falsas superficies contractuales en frontend

Este corte no tuvo por objetivo redisenar el dominio, introducir persistencia nueva ni converger campañas entre canales.

## B. Definicion arquitectonica vigente

La definicion vigente para esta linea de trabajo se mantiene sin cambios:

- WhatsApp y Email son dominios independientes
- cada canal debe tener su propia logica y su propia persistencia
- `ll_campanias_whatsapp` no debe genericizarse
- la convergencia entre canales debe resolverse por lectura, reporting o vistas, no por mezcla de persistencia operativa

Consecuencia para este corte:

- el trabajo se concentró unicamente en el dominio campanas WhatsApp
- Email quedo explicitamente fuera
- no se abrio una campaña comun multicanal

## C. Archivos intervenidos

Archivos efectivamente intervenidos en este primer corte:

- services/central-hub/src/modules/sender/controllers/campaignsController.js
- services/central-hub/frontend/src/components/campaigns/CampaignsManager.jsx
- services/central-hub/frontend/src/services/api.js

Archivo revisado y mantenido sin cambios como deuda controlada:

- services/central-hub/frontend/src/services/campanas.js

## D. Resultado por flujo

### 1. create

Estado final del flujo:

- la UI crea campañas desde `CampaignsManager.jsx` usando `senderAPI.createCampaign`
- el backend recibe `POST /sender/campaigns`
- `campaignsController.js` valida `nombre` y `mensaje`
- la campaña nueva se persiste en estado `pendiente`
- la UI recarga el listado y consume ese estado sin desalineacion principal

Resultado:

- flujo saneado y consistente para el primer corte

### 2. approve

Estado final del flujo:

- la UI aprueba desde `CampaignsManager.jsx` usando `campanasService.aprobarCampana`
- `campanas.js` apunta a `POST /sender/campaigns/:id/approve`
- el backend acepta `pendiente` y `pendiente_aprobacion` como compatibilidad legacy
- la aprobacion persiste `estado = en_progreso`
- la UI ya refleja `en_progreso` como estado principal operativo
- el scheduler sigue siendo compatible porque espera campañas en `en_progreso`

Resultado:

- flujo saneado y compatible con el comportamiento operativo actual de WhatsApp

### 3. update

Estado final del flujo:

- la UI edita usando `senderAPI.updateCampaign`
- `CampaignsManager.jsx` ya no invita a editar campañas en estados incompatibles, especialmente `en_progreso`
- el backend vuelve a validar editabilidad y bloquea campañas en estados operativos incompatibles o con mensajes ya enviados
- la actualizacion persiste el estado nuevamente como `pendiente`
- la UI consume correctamente el shape devuelto por backend para este flujo

Resultado:

- flujo saneado con doble proteccion: frontend y backend

### 4. list/detail

Estado final del flujo:

- `list` y `detail` siguen devolviendo el shape minimo de campañas WhatsApp
- el backend mantiene compatibilidad de frontend con campos sinteticos (`descripcion`, `programada`, `fecha_envio`)
- `detail` ya permite que un admin vea cualquier campaña por `id`
- la UI consume los datos devueltos sin exigir un redisenio del componente

Resultado:

- flujo razonablemente coherente para el primer corte

## E. Razones para no tocar schema.sql en este corte

Se decidió no intervenir `services/central-hub/schema.sql` por las siguientes razones:

- el objetivo principal del corte era sanear contrato operativo y coherencia de flujo, no abrir persistencia nueva
- el diagnostico de impacto concluyó que el primer archivo mas seguro para intervenir era `campaignsController.js`, no `schema.sql`
- el flujo operativo de WhatsApp depende criticamente de campos ya existentes y del estado `en_progreso`
- tocar schema en este punto hubiese abierto un frente de migracion y compatibilidad de base innecesario para validar la coherencia conseguida
- existe divergencia entre el `schema.sql` visible y la estructura real observada en dump auxiliar, por lo que modificar schema sin un corte especifico de persistencia hubiese aumentado el riesgo

Decision de cierre:

- este primer corte se cierra sin tocar `schema.sql`

## F. Deudas controladas que quedan abiertas

### 1. Campos sinteticos de compatibilidad

Siguen abiertos como deuda controlada:

- `descripcion`
- `programada`
- `fecha_envio`

Estos campos siguen presentes para compatibilidad frontend, pero no quedaron consolidados todavia como contrato persistente del dominio.

### 2. Duplicacion entre senderAPI y campanasService

Sigue abierta una deuda acotada en frontend:

- CRUD de campañas se consume por `senderAPI`
- aprobacion se consume por `campanasService`

Esta duplicacion no rompe el primer corte, pero deja dos superficies de servicio para el mismo dominio y debera resolverse en un corte posterior.

### 3. Metricas no consolidadas

La pantalla sigue mostrando metricas y campos operativos que no fueron consolidados en este primer corte, por ejemplo:

- `total_destinatarios`
- `enviados`
- `fallidos`
- `pendientes`

Para este corte se toleran como compatibilidad o valores por defecto, sin abrir aun trabajo sobre delivery.

## G. Que quedo explicitamente fuera

Quedaron fuera de este corte, de manera deliberada:

- delivery de WhatsApp
- logica operativa del scheduler
- dominio Email
- cualquier genericizacion de campañas
- cualquier transformacion de `ll_campanias_whatsapp` en persistencia comun multicanal
- cambios de schema y migraciones de persistencia

## H. Conclusion final

Conclusion del cierre documental:

- PRIMER CORTE COHERENTE

Esto significa, para este servicio y este alcance:

- el backend de campañas WhatsApp quedo saneado y en KEEP
- la UI principal de campañas quedo alineada y en KEEP
- `senderAPI` quedo limpiado y en KEEP
- `campanas.js` queda tolerado sin cambios como deuda controlada
- la validacion estatica final de conjunto no encontro una razon fuerte para abrir `schema.sql` en este corte

## Recomendacion de cierre

Se recomienda cerrar aqui el primer corte de saneamiento de campañas WhatsApp y diferir para fases posteriores:

- consolidacion persistente de campos hoy sinteticos
- decision de unificacion entre `senderAPI` y `campanasService`
- trabajo especifico sobre schema, solo cuando se abra un corte dedicado de persistencia
