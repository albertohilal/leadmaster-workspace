# REVISION ARQUITECTONICA - Campanas independientes por canal

## Fecha

2026-03-21

## Destino

services/central-hub/docs/planificacion/REVISION_ARQUITECTONICA_CAMPANAS_INDEPENDIENTES_2026-03-21.md

## Motivo de la revision

Durante la documentacion de la intervencion sobre el modulo de campanas se formularon hipotesis de convergencia fuerte entre WhatsApp y Email alrededor de un contrato comun de campana con discriminador de canal.

La definicion arquitectonica vigente deja ese enfoque sin efecto para esta linea de trabajo.

La razon principal es proteger la modularidad original del sistema y resguardar el dominio que hoy ya funciona correctamente en WhatsApp.

## Definicion vigente

La definicion vigente para este frente es la siguiente:

- campañas WhatsApp y campañas Email son dominios independientes
- cada canal debe tener sus propias campañas
- cada canal debe tener su propia logica
- cada canal debe tener su propia persistencia
- la convergencia entre canales debe resolverse en lectura, reporting, vistas o endpoints de consulta
- la convergencia no debe resolverse mezclando persistencia operativa
- no debe convertirse `ll_campanias_whatsapp` en una tabla generica multicanal

## Fundamento arquitectonico

El workspace fue definido desde el principio como modular y orientado a servicios independientes.

En ese marco:

- el dominio WhatsApp ya tiene persistencia, flujo operativo y trazabilidad propios
- Email debe seguir la misma logica de especializacion, no absorberse dentro de la persistencia de WhatsApp
- cualquier vision consolidada por cliente, historial o actividad multicanal debe construirse por consultas, reporting, vistas o endpoints de lectura

## Impacto sobre la hipotesis anterior

Queda revisada la hipotesis anterior que proponia una campaña comun con `channel = whatsapp | email` dentro del mismo dominio persistente.

Esa hipotesis ya no debe guiar esta intervencion por los siguientes motivos:

- empuja a genericizar `ll_campanias_whatsapp`
- mezcla definicion de campaña con convergencia multicanal demasiado temprano
- aumenta el riesgo sobre el flujo actual de WhatsApp
- contradice la especializacion ya visible en tablas y logica operativa por canal

## Criterio para proteger WhatsApp actual

El criterio vigente para esta intervencion es conservador:

- preservar `ll_campanias_whatsapp` como persistencia especializada del dominio WhatsApp
- preservar el flujo operativo actual de WhatsApp mientras se sanea su contrato
- evitar cambios que mezclen delivery multicanal con saneamiento de campañas WhatsApp
- diferir el dominio Email a una persistencia y contrato propios cuando se lo intervenga como dominio separado

## Consecuencias para el primer corte

El primer corte queda redefinido de esta manera:

- debe centrarse solo en el saneamiento del dominio de campañas WhatsApp
- debe corregir contrato, persistencia visible, estados y consistencia del CRUD actual de WhatsApp
- no debe introducir una campaña comun multicanal
- no debe introducir `channel` como eje de persistencia comun en `ll_campanias_whatsapp`
- Email queda fuera de este primer corte como dominio separado

## Documentos ajustados o parcialmente superados

Quedan alcanzados por esta revision los siguientes documentos:

- services/central-hub/docs/planificacion/PLAN-INTERVENCION-CAMPANAS-POR-CANAL-2026-03-20.md
- services/central-hub/docs/diagnosticos/DIAGNOSTICO_MODULO_CAMPANAS_CONTRATO_REAL_2026-03-20.md
- services/central-hub/docs/planificacion/CONTRATO_MINIMO_CAMPANAS_PRIMER_CORTE_2026-03-20.md
- services/central-hub/docs/planificacion/PROPUESTA_TECNICA_PRIMER_CORTE_CAMPANAS_2026-03-20.md

Criterio de ajuste:

- los hallazgos diagnosticos validos se conservan
- las hipotesis y estrategias que asumian convergencia fuerte entre WhatsApp y Email deben revisarse

## Decision explicita

Queda explicitamente decidido lo siguiente:

- no convertir `ll_campanias_whatsapp` en tabla generica multicanal
- no mezclar persistencia operativa de WhatsApp y Email
- no usar el primer corte para introducir una capa de campañas comun por canal
- mantener la convergencia multicanal, si se necesitara, en lectura y reporting

## Efecto documental inmediato

Desde esta revision en adelante:

- `campanas por canal` debe leerse como `dominios de campanas separados por canal`
- `primer corte` debe leerse como `saneamiento del dominio campañas WhatsApp`
- cualquier propuesta de Email debe tratarse como una linea posterior y separada

## Conclusion

La arquitectura vigente prioriza independencia de dominios por canal y proteccion de lo que ya funciona en WhatsApp.

Por lo tanto, la intervencion actual no debe buscar una tabla comun ni una campaña generica multicanal.

Debe concentrarse en estabilizar el dominio de campañas WhatsApp y dejar la convergencia entre canales para capas de lectura o para futuros dominios especializados.
