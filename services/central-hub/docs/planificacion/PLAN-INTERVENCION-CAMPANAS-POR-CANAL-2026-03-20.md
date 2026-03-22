# PLAN DE TRABAJO - Saneamiento de campanas WhatsApp con resguardo de independencia por canal

## Fecha

2026-03-20

## Destino

services/central-hub/docs/planificacion/PLAN-INTERVENCION-CAMPANAS-POR-CANAL-2026-03-20.md

## Objetivo

Definir una guia de trabajo previa a cualquier cambio de codigo para intervenir el modulo de campanas de `services/central-hub` con el menor riesgo posible, priorizando relevamiento, validacion documental y consolidacion del contrato minimo del dominio campanas WhatsApp.

Este plan queda alineado con la revision arquitectonica asentada en:

- `services/central-hub/docs/planificacion/REVISION_ARQUITECTONICA_CAMPANAS_INDEPENDIENTES_2026-03-21.md`

## Alcance

Este plan cubre exclusivamente la intervencion tecnica prevista sobre el servicio `central-hub` en los puntos donde hoy se concentra el contrato de campanas WhatsApp:

- controlador de campanas
- rutas del modulo sender para campanas
- schema visible del servicio
- formulario y pantalla principal de campanas en frontend
- servicios frontend que definen el contrato HTTP actual de campanas

Quedan fuera de este plan, hasta nueva validacion, los cambios profundos sobre scheduler, ejecucion operativa de WhatsApp, mailer standalone y cualquier intento de convergencia fuerte entre campañas WhatsApp y Email en una persistencia comun.

## Regla operativa obligatoria

No modificar codigo antes de completar:

1. verificacion documental vigente
2. relevamiento tecnico sin cambios
3. definicion del contrato objetivo minimo
4. propuesta tecnica validable antes de codificar

## Fases de trabajo

### 1. Verificacion documental

Objetivo:

- confirmar reglas de documentacion aplicables
- verificar si existe `AGENTS.md`
- determinar la ubicacion correcta de los entregables de esta intervencion
- registrar conflictos o ambiguedades entre normas y precedentes documentales

Salida esperada:

- criterio de ubicacion documental confirmado
- plan inicial guardado antes de tocar codigo

### 2. Relevamiento tecnico sin cambios

Objetivo:

- relevar frontend, backend, rutas, schema y contratos reales del modulo de campanas WhatsApp
- confirmar el estado actual de `campaignsController.js`, `campaigns.js`, `schema.sql`, `CampaignsManager.jsx`, `api.js` y `campanas.js`
- identificar divergencias entre UI, backend, schema y documentacion existente

Salida esperada:

- mapa tecnico verificable del estado actual
- lista acotada de inconsistencias a resolver primero

### 3. Contrato objetivo minimo

Objetivo:

- definir el shape minimo y consistente de campana WhatsApp que backend y frontend deben soportar en el primer corte
- separar claramente el saneamiento del dominio WhatsApp de cualquier futura campana Email como dominio independiente
- dejar explicitamente fuera la hipotesis de genericizar `ll_campanias_whatsapp`

Salida esperada:

- contrato minimo propuesto para `create`, `update`, `list` y `detail` del dominio campañas WhatsApp
- criterios de compatibilidad hacia campañas WhatsApp existentes

### 4. Propuesta tecnica antes de codificar

Objetivo:

- traducir el contrato objetivo de campañas WhatsApp a cambios concretos por archivo
- ordenar la implementacion por riesgo y dependencias
- validar que el primer corte no derive en una campaña comun multicanal

Salida esperada:

- propuesta tecnica revisable antes de editar codigo
- secuencia de implementacion controlada

### 5. Implementacion controlada

Objetivo:

- ejecutar cambios minimos y ordenados empezando por backend y persistencia del dominio WhatsApp
- mantener estable el comportamiento actual de WhatsApp en el primer corte
- dejar Email fuera del primer corte como dominio separado

Salida esperada:

- cambios minimos implementados
- validacion basica de consistencia entre backend, frontend y schema

### 6. Cierre documental

Objetivo:

- registrar lo implementado, lo postergado y los riesgos residuales
- dejar trazabilidad clara para la siguiente intervencion

Salida esperada:

- reporte de cierre o actualizacion documental del estado alcanzado

## Checklist de control previo para Copilot

- [ ] Confirmar si existe `AGENTS.md` en la raiz o subdirectorios relevantes
- [ ] Verificar reglas vigentes en `docs/00-INDEX/DOCUMENTATION_RULES.md`
- [ ] Confirmar si el entregable corresponde a documentacion de workspace o de servicio
- [ ] No editar archivos de codigo antes de cerrar relevamiento y contrato minimo
- [ ] Verificar inconsistencias actuales entre `schema.sql` y `campaignsController.js`
- [ ] Verificar inconsistencias actuales entre rutas declaradas en frontend y backend real
- [ ] Confirmar el shape minimo de campaña WhatsApp antes de tocar `CampaignsManager.jsx`
- [ ] Registrar cualquier conflicto documental detectado antes de codificar
- [ ] Verificar que no se proponga genericizar `ll_campanias_whatsapp`

## Archivos foco

- `services/central-hub/src/modules/sender/controllers/campaignsController.js`
- `services/central-hub/src/modules/sender/routes/campaigns.js`
- `services/central-hub/schema.sql`
- `services/central-hub/frontend/src/components/campaigns/CampaignsManager.jsx`
- `services/central-hub/frontend/src/services/api.js`
- `services/central-hub/frontend/src/services/campanas.js`

## Conflictos y criterio aplicado

Conflicto observado:

- la documentacion de workspace en `docs/00-INDEX/DOCUMENTATION_RULES.md` define que `docs/` es para documentos con impacto multi-servicio
- la intervencion prevista en este plan se concentra exclusivamente en `services/central-hub`
- existen antecedentes de documentos de campanas en `docs/06-FASES`, pero esos documentos responden a alineamiento funcional y de negocio a nivel workspace, no a un plan tecnico de ejecucion local del servicio
- durante esta intervencion surgio una hipotesis de convergencia fuerte entre WhatsApp y Email que luego quedo revisada por definicion arquitectonica posterior

Criterio aplicado:

- este plan se guarda como documentacion de servicio, dentro de `services/central-hub/docs/planificacion/`, para respetar la regla de alcance y evitar duplicacion con la documentacion global del workspace
- desde la revision arquitectonica del 2026-03-21, el primer corte debe leerse como saneamiento del dominio campañas WhatsApp y no como convergencia persistente entre canales
