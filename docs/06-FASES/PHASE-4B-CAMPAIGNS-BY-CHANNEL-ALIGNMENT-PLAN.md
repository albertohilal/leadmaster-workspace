# Phase 4B — Campaigns by Channel Alignment Plan

**Status:** IN PROGRESS  
**Date:** 2026-03-19  
**Owner:** Alberto Hilal  
**Workspace:** LeadMaster  
**Depends on:** Arquitectura Canal Email / Phase 4B Email Prospecting Channel / Contratos HTTP Email / Reporte de integración end-to-end 2026-03-15 / Reporte de realineamiento campañas por canal 2026-03-19

## Destino

docs/06-FASES/PHASE-4B-CAMPAIGNS-BY-CHANNEL-ALIGNMENT-PLAN.md

## Objetivo del plan

Alinear la operación y la UI actuales con una decisión ya tomada de arquitectura y negocio: en LeadMaster una campaña define su canal, y el flujo de envío debe responder a ese tipo de campaña.

Este plan no propone rediseñar todo el sistema ni reemplazar la base común de selección de prospectos. Su objetivo es corregir una desalineación funcional concreta para que la capa operativa respete de forma explícita el modelo documental acordado.

## Problema actual

El problema actual no está en el transporte ni en la integración técnica de los canales. Esa parte ya quedó validada para Email en modo prueba y ya existe flujo operativo para WhatsApp.

La desalineación está en cómo puede interpretarse la operación actual:

- la UI usa una selección común de prospectos
- eso es correcto como base operativa compartida
- pero la preparación manual de Email con asunto y cuerpo definidos en cada envío puede transmitir un modelo incorrecto
- ese modelo incorrecto es leer la campaña como neutra respecto del canal y resolver el contenido recién al final de la operación

Si esa lectura se consolida, la UI terminaría habilitando una operación que contradice la decisión documental ya asumida.

## Principio rector

El principio rector de esta subfase es el siguiente:

- la campaña seleccionada define el canal operativo
- el canal define particularidades de contenido y de ejecución
- la selección de prospectos puede ser común
- la ejecución del envío no puede ser neutra si la campaña no lo es

Toda decisión de implementación dentro de esta subfase debe evaluarse contra ese principio.

## Modelo objetivo

El modelo objetivo a consolidar es:

- una campaña puede ser de WhatsApp o de Email
- cada campaña conserva la lógica documental y operativa propia de su canal
- la pantalla de selección de prospectos puede seguir siendo compartida como base de filtrado y selección
- la acción posterior a la selección debe depender del tipo de campaña
- el contenido del envío debe corresponder al contenido de la campaña del canal respectivo
- la UI no debe inducir a operaciones ambiguas o contradictorias con el canal de la campaña

En este modelo, la campaña no es un contenedor neutro de destinatarios. Es una unidad operativa asociada a un canal determinado.

## Diferencias entre campaña WhatsApp y campaña Email

La subfase debe dejar visibles las diferencias reales entre ambos tipos de campaña.

### Campaña WhatsApp

- usa el flujo operativo ya asociado al canal WhatsApp
- depende de disponibilidad real de WhatsApp en el prospecto
- usa el contenido o mensaje propio de la campaña WhatsApp
- mantiene la lógica de operación ya existente para ese canal

### Campaña Email

- usa el flujo operativo propio del canal Email
- depende de disponibilidad real de Email válido en el prospecto
- debe apoyarse en asunto y cuerpo de campaña del canal Email
- no debe consolidarse como flujo final una preparación completamente libre del contenido en cada envío

### Regla común

- ambos tipos de campaña pueden compartir la base inicial de prospectos
- no deben compartir una capa final de envío que borre las particularidades del canal

## Qué debe seguir siendo compartido

Para evitar sobrediseño o duplicación innecesaria, lo siguiente debe seguir siendo compartido mientras no contradiga el principio rector:

- pantalla base de selección de prospectos
- filtros operativos sobre la base común
- tabla de visualización de prospectos
- checkboxes, conteos y selección común
- indicadores de disponibilidad por canal
- lógica de exploración y segmentación inicial

Mantener estos elementos compartidos es consistente con el modelo del sistema y no exige dividir artificialmente la experiencia desde el primer paso.

## Qué debe separarse por canal

Lo siguiente debe quedar explícitamente separado por canal:

- la acción de envío habilitada una vez seleccionada la campaña
- la lógica operativa posterior a la selección de prospectos
- el contenido utilizado para el envío
- la semántica del flujo de campaña
- la lectura funcional de la UI respecto de qué se está enviando y por qué canal

En particular, debe separarse la parte que hoy puede inducir a una operación Email excesivamente libre respecto de la campaña.

## Plan de implementación por etapas

### Etapa 1 — Cierre documental del criterio

Objetivo de la etapa:

- dejar explícita la decisión ya tomada para evitar nuevas interpretaciones ambiguas

Acciones de esta etapa:

- reforzar documentalmente que la campaña define el canal
- dejar asentado que la selección común no implica neutralidad de campaña
- documentar que la composición libre de Email por envío solo puede considerarse transitoria
- fijar el principio de que el flujo correcto depende del tipo de campaña seleccionada

Resultado esperado:

- criterio operativo unificado para futuras decisiones de UI y flujo

### Etapa 2 — Explicitación del tipo de campaña en la operación

Objetivo de la etapa:

- hacer visible en la capa operativa que la campaña seleccionada no es neutra respecto del canal

Acciones de esta etapa:

- reflejar de manera clara el tipo de campaña en la pantalla de selección de prospectos
- condicionar las acciones disponibles según el canal de la campaña seleccionada
- evitar affordances o textos de UI que sugieran que cualquier campaña puede operar indistintamente por ambos canales
- mantener la base común de selección sin volver ambigua la operación final

Resultado esperado:

- la UI deja de transmitir un modelo neutral y pasa a respetar el contexto de campaña elegido

### Etapa 3 — Alineamiento del flujo WhatsApp

Objetivo de la etapa:

- consolidar que el flujo WhatsApp siga vinculado a la campaña y a su contenido específico

Acciones de esta etapa:

- preservar el uso del flujo propio del canal WhatsApp
- evitar que la selección común derive en un flujo paralelo o genérico que desdibuje la campaña WhatsApp
- sostener la operación sobre disponibilidad real de WhatsApp del prospecto

Resultado esperado:

- continuidad del canal WhatsApp dentro del modelo correcto de campañas por canal

### Etapa 4 — Alineamiento del flujo Email

Objetivo de la etapa:

- evolucionar la operación Email desde un esquema de prueba técnica hacia uno coherente con campaña por canal

Acciones de esta etapa:

- dejar de tratar la redacción manual completa por envío como diseño final
- orientar el flujo Email a usar contenido de campaña del canal Email
- mantener cualquier mecanismo manual libre solo como transición controlada, si todavía resultara necesario para pruebas técnicas
- asegurar que la acción Email en la UI responda a una campaña Email y no a una operación desligada de campaña

Resultado esperado:

- el canal Email pasa de un uso transitorio de prueba a una operación alineada con campaña y canal

### Etapa 5 — Endurecimiento de consistencia operativa

Objetivo de la etapa:

- verificar que la pantalla común siga siendo útil sin contradecir el modelo acordado

Acciones de esta etapa:

- revisar que selección, conteos e indicadores sigan siendo coherentes bajo campañas por canal
- validar que la UI no ofrezca acciones incompatibles con la campaña seleccionada
- ajustar textos operativos para que la semántica sea inequívoca
- confirmar que el operador entiende que la campaña ya determina el canal y el tipo de contenido esperable

Resultado esperado:

- operación cotidiana consistente con la decisión documental y sin ambigüedad funcional

## Impacto esperado sobre el modelo de campaña

El impacto esperado sobre el modelo de campaña es de alineación, no de reinvención.

Efectos esperados:

- consolidar que la campaña debe leerse como entidad tipificada por canal
- evitar interpretaciones operativas donde la campaña se reduce a un agrupador neutro de destinatarios
- reforzar que el contenido y el flujo son parte de la identidad funcional de la campaña

Este impacto es principalmente de claridad documental y operativa.

## Impacto esperado sobre la pantalla de selección de prospectos

La pantalla de selección de prospectos debe seguir funcionando como base común, pero con mayor claridad semántica.

Efectos esperados:

- conservar filtros, segmentación y selección común
- mostrar con mayor claridad el contexto de campaña activa
- condicionar las acciones disponibles al canal de esa campaña
- reducir el riesgo de que la UI sugiera una operatoria neutral o intercambiable entre canales

## Impacto esperado sobre el flujo WhatsApp

El impacto esperado sobre WhatsApp es de preservación y refuerzo del modelo correcto.

Efectos esperados:

- mantener su flujo específico
- mantener la dependencia de disponibilidad real del canal
- mantener el uso de contenido propio de campaña WhatsApp
- evitar regresiones hacia un flujo genérico que desdibuje el canal

## Impacto esperado sobre el flujo Email

El impacto esperado sobre Email es el más relevante de esta subfase.

Efectos esperados:

- conservar lo ya validado en integración y transporte
- dejar de presentar la composición manual por envío como modelo final del sistema
- orientar la operación hacia una campaña Email con contenido propio del canal
- mantener, si hiciera falta, una convivencia transitoria y explícitamente limitada para pruebas técnicas

Importante:

- esta subfase no cuestiona que el canal Email esté operativo end-to-end en modo prueba
- sí corrige la interpretación funcional de cómo debe verse el flujo maduro del canal

## Impacto esperado sobre el contenido de campaña

El contenido de campaña debe quedar alineado con el canal definido por la campaña.

Efectos esperados:

- campaña WhatsApp asociada a mensaje de campaña WhatsApp
- campaña Email asociada a asunto y cuerpo de campaña Email
- eliminación progresiva de la idea de contenido completamente libre en cada ejecución como modelo final
- mejor coherencia entre entidad campaña, canal y acción operativa

## Estado transitorio permitido

Durante la implementación puede existir un estado transitorio controlado.

Ese estado transitorio puede admitir:

- mecanismos manuales de prueba técnica
- convivencia temporal de una preparación inicial de Email mientras se completa el realineamiento
- validaciones operativas sobre la UI común antes de endurecer completamente la separación por canal

Pero ese estado transitorio debe quedar leído siempre como transición y no como criterio de diseño definitivo.

## Fuera de alcance

Queda fuera del alcance de esta subfase:

- rediseñar por completo la arquitectura general del sistema
- reemplazar la base común de selección de prospectos por experiencias separadas desde el primer paso
- redefinir los contratos HTTP vigentes del gateway o del mailer
- inventar nuevas capacidades no documentadas de backend
- introducir un dashboard comercial integral de campañas
- resolver en esta misma subfase todos los problemas de cobertura y enriquecimiento de emails
- expandir el trabajo hacia automatizaciones masivas, nurturing avanzado o reporting comercial completo

La finalidad de esta subfase es alinear la operación con una decisión ya tomada, no abrir un rediseño total.

## Criterio de cierre de esta subfase

La subfase podrá considerarse cerrada cuando se cumplan estas condiciones:

- la documentación vigente deje inequívocamente asentado que la campaña define el canal
- la UI de selección de prospectos no induzca una lectura neutral de campaña
- las acciones de operación disponibles dependan del tipo de campaña seleccionada
- el flujo WhatsApp siga operando con su lógica propia de campaña
- el flujo Email quede orientado al modelo de campaña Email y no a composición libre como diseño final
- cualquier mecanismo manual de prueba que permanezca quede explícitamente tratado como transitorio
- la operación diaria quede alineada con el modelo documental ya acordado

## Conclusión

La decisión de tratar las campañas por canal ya existe y no requiere ser inventada de nuevo. Lo que falta es terminar de alinear la UI y la operación con esa decisión.

La base común de prospectos puede mantenerse.

Lo que debe ajustarse es la capa que sigue a esa selección:

- la campaña seleccionada debe definir el canal
- el flujo debe responder a ese canal
- el contenido debe corresponder a la campaña de ese canal
- la composición libre de Email por envío no debe consolidarse como modelo final del sistema

Este plan propone exactamente ese realineamiento y nada más.