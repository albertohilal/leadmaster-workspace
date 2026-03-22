# PROPUESTA TECNICA - Primer corte controlado para campanas WhatsApp

## Fecha

2026-03-20

## Destino

services/central-hub/docs/planificacion/PROPUESTA_TECNICA_PRIMER_CORTE_CAMPANAS_2026-03-20.md

## Alcance

Este documento ejecuta la Fase 4 del plan de intervencion y queda alineado con:

- `services/central-hub/docs/planificacion/REVISION_ARQUITECTONICA_CAMPANAS_INDEPENDIENTES_2026-03-21.md`

Traduce el contrato minimo ya definido a una propuesta tecnica concreta y ordenada, sin modificar codigo todavia y sin entrar aun en implementacion final.

Documentos base usados en esta fase:

- services/central-hub/docs/diagnosticos/DIAGNOSTICO_MODULO_CAMPANAS_CONTRATO_REAL_2026-03-20.md
- services/central-hub/docs/planificacion/CONTRATO_MINIMO_CAMPANAS_PRIMER_CORTE_2026-03-20.md

## Resumen ejecutivo

El primer corte debe intervenir solo el dominio de definicion de campañas WhatsApp y dejar congelado el dominio operativo de envios por canal.

La propuesta tecnica de menor riesgo para este repo es:

- consolidar primero el contrato de campañas WhatsApp en persistencia, controlador, rutas y servicios frontend
- no genericizar `ll_campanias_whatsapp`
- diferir cualquier trabajo sobre campañas Email como dominio separado
- no tocar todavia `ll_envios_email`, `ll_envios_whatsapp`, `ll_envios_manual` ni `ll_envios_whatsapp_historial`
- usar una estrategia conservadora de normalizacion de estados legacy
- mantener `mensaje` como contenido propio de la campaña WhatsApp en este primer corte

La razon es simple: el repositorio actual ya esta acoplado a persistencias operativas por canal y a un modelo de campaña legacy WhatsApp-first. El menor riesgo esta en sanear el dominio existente, no en converger persistencias.

## 1. Distincion entre dominio de campana y dominio de delivery

## 1.1 Dominio de definicion de campaña

Pertenece al dominio `campaigns` de esta intervencion todo lo que define una campaña WhatsApp como entidad de negocio antes de ejecutarla:

- identidad de campaña
- nombre y descripcion
- estado de aprobacion o disponibilidad operativa
- programación básica
- contenido base de WhatsApp
- pertenencia a cliente
- timestamps de creación y actualización

En el primer corte, este dominio debe resolverse solo en:

- `schema.sql`
- `campaignsController.js`
- `campaigns.js`
- `api.js`
- `CampaignsManager.jsx`
- `routes/campaigns.js`

## 1.2 Dominio operativo de envios por canal

Pertenece al dominio `delivery` todo lo que ejecuta, audita o transporta envíos concretos:

- registros por destinatario
- estados de envío por canal
- auditoría técnica de envíos
- integración con WhatsApp Session Manager
- transporte SMTP
- reintentos, locks y scheduler
- trazabilidad de entrega real

En el estado actual, este dominio aparece separado al menos en:

- `ll_envios_whatsapp`
- `ll_envios_whatsapp_historial`
- `ll_envios_email`
- `ll_envios_manual` como referencia provista por contexto de trabajo, no verificada directamente dentro de los archivos foco de esta fase

## 1.3 Regla tecnica del primer corte

Regla de trabajo para este corte:

- no mezclar el saneamiento contractual de campañas WhatsApp con un rediseño de `delivery`
- no mezclar campañas WhatsApp con campañas Email en una persistencia comun
- solo dejar preparada la compatibilidad futura entre dominios separados y sus lecturas consolidadas

Consecuencia técnica:

- el contrato de campaña debe poder referenciar o proyectarse sobre flujos de delivery futuros
- pero no debe exigir tocar aun tablas, máquinas de estado ni servicios operativos de entrega

## 1.4 Por que no tocar todavia tablas operativas de envios

No conviene tocar ahora `ll_envios_email`, `ll_envios_whatsapp`, `ll_envios_manual` ni `ll_envios_whatsapp_historial` por estas razones:

- pertenecen al dominio operativo, no al problema contractual minimo de campañas WhatsApp
- ya cargan reglas de negocio y trazabilidad de canal específicas
- cualquier cambio ahi multiplica el riesgo de regresion sobre WhatsApp y sobre el mailer
- el primer corte todavia no necesita rediseñar la ejecucion de envios para estabilizar `list`, `detail`, `create` y `update` de campañas WhatsApp

## 2. Mapa de cambios por archivo

## 2.1 services/central-hub/schema.sql

### Que problema resuelve

- hoy el schema visible no soporta el contrato minimo definido para campaña
- el backend y frontend asumen columnas y estados no formalizados

### Que cambios minimos habria que hacer

- regularizar `ll_campanias_whatsapp` para que soporte el shape minimo del dominio campañas WhatsApp
- incorporar las columnas comunes del contrato que hoy no estan visibles de forma consistente
- conservar la especializacion de la tabla y su relacion actual con el mundo WhatsApp legacy
- evitar cualquier columna o estructura que convierta esta tabla en una campaña comun multicanal

### Que no deberia tocarse todavia

- tablas `ll_envios_whatsapp`, `ll_envios_whatsapp_historial`, `ll_envios_email`, `ll_envios_manual`
- FKs operativas de delivery
- tablas de scheduler o locks de ejecucion

### Riesgo

- alto

### Justificacion del riesgo

- es la base del contrato compartido por backend y frontend
- cualquier error aqui afecta CRUD y compatibilidad con campañas existentes

## 2.2 services/central-hub/src/modules/sender/controllers/campaignsController.js

### Que problema resuelve

- hoy el controlador mezcla contrato, compatibilidad ad hoc y supuestos no respaldados por schema
- ademas concentra inconsistencias graves entre request, persistencia y response

### Que cambios minimos habria que hacer

- alinear `list`, `detail`, `create` y `update` con un unico shape contractual de campañas WhatsApp
- eliminar responses artificiales que inventan campos sin criterio unificado
- regularizar lectura y escritura de `descripcion`, `programada`, `fecha_envio` y `fecha_actualizacion`
- mantener `mensaje` como contenido propio del dominio campañas WhatsApp
- hacer que `approve` responda y persista segun un criterio consistente con el primer corte

### Que no deberia tocarse todavia

- logica real de envio de campaña
- generacion de destinatarios
- integracion con scheduler
- machine states de delivery
- cualquier logica de campañas Email

### Riesgo

- alto

### Justificacion del riesgo

- es el punto central de convergencia entre persistencia, API y UI
- cualquier cambio incorrecto amplifica el desorden actual

## 2.3 services/central-hub/src/modules/sender/routes/campaigns.js

### Que problema resuelve

- hoy las rutas reales y la capa frontend no reflejan exactamente el mismo contrato operativo

### Que cambios minimos habria que hacer

- mantener el set minimo de rutas para el primer corte
- formalizar que el foco del primer corte es `list`, `detail`, `create`, `update`, `delete`, `approve`
- evitar que el contrato quede implicitamente abierto a operaciones no consolidadas

### Que no deberia tocarse todavia

- nuevas rutas operativas de envío real
- stats detalladas
- pause/resume/send como flujo completo
- rutas de campañas Email dentro de este mismo modulo

### Riesgo

- bajo

### Justificacion del riesgo

- es una superficie pequena y dependiente del controlador
- el principal trabajo aqui es de delimitacion contractual

## 2.4 services/central-hub/frontend/src/services/api.js

### Que problema resuelve

- hoy la capa HTTP declara endpoints de campañas que el backend real no implementa en este modulo

### Que cambios minimos habria que hacer

- alinear la capa `senderAPI` con el alcance real del primer corte de campañas WhatsApp
- dejar clara la frontera entre endpoints contractuales minimos y endpoints operativos no consolidados
- mantener las rutas CRUD basicas y de aprobacion sincronizadas con backend

### Que no deberia tocarse todavia

- cualquier intento de resolver aquí la operacion multicanal
- endpoints de delivery por canal
- integracion con transporte Email o con Session Manager
- abstracciones multicanal para campañas en esta capa

### Riesgo

- bajo

### Justificacion del riesgo

- es una capa de acceso delgada
- el riesgo mayor es de incoherencia contractual, no de complejidad tecnica

## 2.5 services/central-hub/frontend/src/services/campanas.js

### Que problema resuelve

- hoy el frontend mezcla dos capas de acceso a campañas y eso dispersa el contrato real

### Que cambios minimos habria que hacer

- unificar conceptualmente el contrato de campañas WhatsApp consumido por UI
- decidir una sola superficie de acceso coherente para operaciones del primer corte
- adaptar request y response al shape minimo definido para WhatsApp

### Que no deberia tocarse todavia

- integraciones con servicios de Email
- acoplamientos con modales externos o flujos operativos de destinatarios
- contratos de campañas multicanal en esta capa

### Riesgo

- bajo a medio

### Justificacion del riesgo

- el cambio es acotado, pero puede afectar varios puntos de la UI si el contrato sigue duplicado

## 2.6 services/central-hub/frontend/src/components/campaigns/CampaignsManager.jsx

### Que problema resuelve

- hoy la pantalla depende de campos, estados y acciones que no reflejan un contrato consolidado

### Que cambios minimos habria que hacer

- adaptar el consumo del shape minimo de campañas WhatsApp
- dejar de depender de estados y campos artificiales o inconsistentes
- mantener la semantica explicita de WhatsApp en esta pantalla
- quitar supuestos contractuales que hoy no esten respaldados por backend real

### Que no deberia tocarse todavia

- refactor grande del componente
- rediseño completo del formulario
- logica real de envio multicanal
- integracion profunda con `EmailCampaignFormModal`
- metricas avanzadas o stats no consolidadas
- cualquier intento de transformar esta pantalla en una consola comun de campañas WhatsApp y Email

### Riesgo

- medio alto

### Justificacion del riesgo

- es un componente monolitico con múltiples responsabilidades
- tocarlo antes de consolidar backend y servicios aumenta mucho la superficie de error

## 3. Orden exacto de implementacion

## 3.1 Secuencia recomendada

Orden exacto propuesto:

1. `services/central-hub/schema.sql`
2. `services/central-hub/src/modules/sender/controllers/campaignsController.js`
3. `services/central-hub/src/modules/sender/routes/campaigns.js`
4. `services/central-hub/frontend/src/services/api.js`
5. `services/central-hub/frontend/src/services/campanas.js`
6. `services/central-hub/frontend/src/components/campaigns/CampaignsManager.jsx`

## 3.2 Dependencias entre archivos

### Paso 1 -> schema.sql

Debe ir primero porque:

- define el soporte visible del contrato minimo
- evita seguir implementando responses y updates sobre columnas no formalizadas

### Paso 2 -> campaignsController.js

Depende de `schema.sql` porque:

- necesita escribir y leer el contrato comun ya definido
- debe dejar de inventar campos sin respaldo persistente

### Paso 3 -> routes/campaigns.js

Depende del controlador porque:

- debe exponer solamente la superficie contractual consolidada
- no conviene fijar rutas definitivas antes de estabilizar el comportamiento real del controlador

### Paso 4 y 5 -> api.js y campanas.js

Dependen del backend porque:

- deben reflejar el contrato real ya estabilizado
- no conviene ajustar frontend sobre un backend todavía ambiguo

### Paso 6 -> CampaignsManager.jsx

Debe tocarse recien al final de este primer corte tecnico porque:

- es el punto de mayor superficie visual y operativa
- necesita consumir un contrato ya definido, no acompañar su definición en paralelo

## 3.3 Punto en el que recien conviene tocar frontend

Recién conviene tocar frontend cuando se cumplan estas tres condiciones:

- el schema ya respalda el contrato comun minimo
- el controlador ya devuelve `list`, `detail`, `create` y `update` con shape consistente
- la capa de servicios frontend ya refleja exactamente ese contrato

Hasta ese punto, tocar `CampaignsManager.jsx` agrega riesgo sin ganar estabilidad.

## 4. Evaluacion del impacto de estados

## 4.1 Opcion A - Adoptar internamente `draft / approved / completed`

Ventajas:

- simplifica mucho la semantica futura
- elimina ambiguedad entre estados legacy
- alinea mejor el contrato minimo definido en Fase 3

Desventajas:

- exige migrar o normalizar ampliamente backend, schema y frontend en un solo paso
- aumenta la superficie de cambio sobre código ya frágil
- obliga a revisar más decisiones colaterales antes de tocar UI

## 4.2 Opcion B - Normalizacion conservadora sobre estados legacy

Definicion:

- mantener persistencia y compatibilidad cercana al modelo actual en el primer corte
- normalizar semanticamente los estados expuestos por API y consumidos por frontend
- postergar la sustitucion plena de estados legacy para una fase posterior

Ventajas:

- menor riesgo sobre datos existentes
- menor superficie de cambio
- evita mezclar en un mismo paso saneamiento contractual con migracion fuerte de estados
- conserva la compatibilidad natural con campañas históricas de WhatsApp

Desventajas:

- deja deuda semantica interna transitoria
- exige documentar con claridad el mapeo de compatibilidad

## 4.3 Recomendacion fundada

Para este primer corte conviene la opcion B: normalizacion mas conservadora sobre estados legacy.

### Motivo principal

Es la opcion de menor riesgo para este repositorio porque:

- el sistema actual ya usa multiples estados contradictorios
- el schema visible no soporta de forma limpia una migracion conceptual completa
- el frontend esta muy acoplado a interpretaciones legacy de estado

### Conclusion operativa

En el primer corte conviene:

- unificar semantica expuesta por API de campañas WhatsApp
- reducir contradicciones funcionales
- documentar un mapeo estable
- dejar cualquier migracion completa de estados para una fase posterior y separada

## 5. Decision sobre persistencia de contenido

## 5.1 Opcion A - Mantener contenido WhatsApp especializado

Ejemplo conceptual:

- `mensaje`
- `descripcion`
- `programada`
- `fecha_envio`
- `subject`
- `body`

Ventajas:

- menor friccion con el modelo actual WhatsApp-first
- mas facil de mapear desde el schema y el controlador actuales
- mas simple de consultar y depurar en SQL directo
- protege la especializacion de `ll_campanias_whatsapp`

Desventajas:

- no resuelve por si sola futuros dominios de campañas Email
- exige que Email se modele aparte cuando llegue su turno

## 5.2 Opcion B - Estructura comun multicanal en esta persistencia

Ejemplo conceptual:

- `channel`
- `mensaje`
- `subject`
- `body`
	o una columna JSON unificada

Ventajas:

- se parece mas al contrato logico definido en Fase 3
- abstrae mejor diferencias de canal a futuro

Desventajas:

- contradice la definicion arquitectonica vigente
- empuja a genericizar `ll_campanias_whatsapp`
- agrega una nueva decision estructural de persistencia en un momento donde todavia no esta saneado lo basico
- aumenta complejidad de consultas, compatibilidad y debug

## 5.3 Recomendacion tecnica de menor riesgo

Para este repo, en el primer corte conviene mantener `mensaje` como contenido propio de campañas WhatsApp y no introducir persistencia multicanal en `ll_campanias_whatsapp`.

Recomendacion concreta:

- persistencia fisica conservadora especializada en WhatsApp
- saneamiento de columnas ya asumidas por el contrato WhatsApp
- Email fuera de esta tabla y de este corte

Razon:

- protege el flujo actual de WhatsApp
- evita convertir una tabla especializada en una persistencia comun
- mantiene el problema acotado al dominio que realmente se esta interviniendo

## 6. Alcance tecnico cerrado del primer corte

## 6.1 Que si se implementaria en el primer corte

- consolidacion de columnas y campos minimos de campañas WhatsApp
- alineacion de `list`, `detail`, `create` y `update` al contrato minimo
- normalizacion conservadora de estados expuestos
- alineacion de servicios frontend con el backend consolidado
- adaptacion minima de `CampaignsManager.jsx` para consumir el contrato ya estabilizado

## 6.2 Que se posterga si o si

- rediseño operativo de delivery
- campañas Email como dominio persistente y funcional
- cambios en scheduler
- cambios en estados de `ll_envios_whatsapp`
- cambios en auditoría `ll_envios_whatsapp_historial`
- cambios en `ll_envios_email`
- cambios en `ll_envios_manual`
- pausa, resume, send y stats avanzadas como flujo consolidado
- rediseño amplio de UI

## 6.3 Condiciones previas antes de pasar a UI

Antes de tocar `CampaignsManager.jsx` deben cumplirse todas estas condiciones:

- el schema soporta el contrato minimo de campañas WhatsApp
- el controlador devuelve shape consistente en `list`, `detail`, `create` y `update`
- la aprobacion ya no contradice al alta ni a la edición
- la capa de servicios frontend refleja exactamente el contrato real
- el alcance excluido del primer corte permanece efectivamente congelado

## 7. Distincion explicita entre `campaigns` y `delivery`

## 7.1 Que pertenece a `campaigns`

Pertenece a `campaigns` en este primer corte:

- definir una campaña WhatsApp
- almacenar su contenido base `mensaje`
- determinar su estado contractual
- asociarla a cliente y a programacion basica
- exponer CRUD coherente para esa entidad

## 7.2 Que pertenece a `delivery`

Pertenece a `delivery`:

- generar envíos concretos por destinatario
- mover estados de envío reales
- auditar resultado técnico de entrega
- integrarse con Session Manager o SMTP
- registrar `message_id`, `fecha_envio` real, locks y reintentos

## 7.3 Por que el primer corte debe mantener esa frontera

Porque mezclar ambos dominios ahora tendría estos costos:

- amplía innecesariamente el alcance
- mezcla saneamiento contractual con rediseño operativo
- incrementa la probabilidad de romper flujos ya activos de WhatsApp
- obliga a tocar servicios y tablas que hoy ya contienen semantica propia de canal

## 8. Lista operativa para implementacion inmediata posterior

Si esta propuesta tecnica queda aprobada, los archivos para implementación inmediata del primer corte son:

- `services/central-hub/schema.sql`
- `services/central-hub/src/modules/sender/controllers/campaignsController.js`
- `services/central-hub/src/modules/sender/routes/campaigns.js`
- `services/central-hub/frontend/src/services/api.js`
- `services/central-hub/frontend/src/services/campanas.js`
- `services/central-hub/frontend/src/components/campaigns/CampaignsManager.jsx`

## Conclusion

La estrategia tecnica de menor riesgo para este primer corte es intervenir primero el contrato de campañas WhatsApp y no el sistema de envios.

Eso implica:

- persistencia de campaña WhatsApp estabilizada
- controlador coherente
- rutas acotadas
- servicios frontend alineados
- UI tocada recien al final y de forma minima

La recomendacion central de esta fase es conservadora y deliberada:

- sanear el dominio campañas WhatsApp sin genericizarlo
- mantener `mensaje` como contenido propio de esta persistencia
- mantener totalmente separadas, por ahora, las tablas y logicas de `delivery`
- dejar Email fuera de este primer corte como dominio independiente
