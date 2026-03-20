# REPORTE — Realineamiento de campañas por canal

## Fecha

2026-03-19

## Destino

docs/05-REPORTES/2026-03/REPORTE-REALINEAMIENTO-CAMPANAS-POR-CANAL-2026-03-19.md

## Objetivo

Dejar asentado el realineamiento documental y operativo necesario sobre el modelo de campañas por canal dentro de LeadMaster Workspace, a partir de una desalineación detectada entre la selección común de prospectos y la forma actual de preparar envíos Email.

Este reporte no redefine la arquitectura general del sistema ni reemplaza los contratos ya documentados. Su propósito es reforzar una decisión de negocio y arquitectura ya acordada, para que la UI y el flujo operativo no transmitan una interpretación equivocada del modelo.

## Contexto

Al 2026-03-15 el canal Email quedó documentado como operativo end-to-end en modo prueba, con los siguientes elementos ya asentados:

- selección común de prospectos en la UI de central-hub
- visualización de disponibilidad por canal
- gateway autenticado de central-hub para el canal Email
- servicio standalone de envío Email
- validación técnica del flujo completo de envío
- operación inicial de Email en modo prueba

Ese estado documental fue correcto para cerrar la subfase de integración y transporte del canal Email. Sin embargo, el cierre técnico de esa subfase no implica que el modelo funcional definitivo de campañas haya quedado completamente expresado en la UI actual.

La desalineación detectada no está en el transporte ni en los contratos HTTP ya cerrados. Está en la lectura funcional que puede inducir la operación actual si no se explicita mejor la relación entre campaña, canal y contenido.

## Estado actual

El estado actual puede resumirse así:

- existe una base común de prospectos que puede filtrarse y seleccionarse desde una pantalla compartida
- la UI ya muestra disponibilidad por WhatsApp y por Email
- la operación de WhatsApp reutiliza el flujo y contenido propios de la campaña correspondiente
- la operación de Email quedó habilitada en modo prueba con preparación manual del envío
- esa preparación manual incluye asunto y cuerpo definidos al momento de ejecutar el envío

Este estado actual fue útil para validar la integración técnica del canal Email y demostrar capacidad operativa end-to-end. No debe interpretarse automáticamente como modelo final de campaña.

## Desalineación detectada

La desalineación detectada es concreta:

- la selección común de prospectos sí es consistente con el modelo general del sistema
- la composición libre de asunto y cuerpo en cada envío Email no representa correctamente el modelo objetivo de campañas

La causa de la desalineación es conceptual:

- compartir una pantalla de selección de prospectos no significa que la campaña sea neutra respecto del canal
- permitir una preparación manual libre para Email puede inducir a leer la campaña como un contenedor indiferenciado de destinatarios sobre el cual luego se decide el contenido en el momento del envío
- esa lectura contradice la decisión ya acordada de que la campaña define el canal y, por lo tanto, también condiciona el contenido y el flujo operativo

La desalineación, entonces, no está en usar una selección común. Está en permitir que la operación de Email parezca desacoplada de una campaña tipificada por canal.

## Decisión reforzada

Se deja explícitamente reforzada la siguiente decisión de arquitectura y negocio:

- una campaña no es neutra respecto del canal
- una campaña puede ser de WhatsApp o de Email
- cada tipo de campaña tiene particularidades propias de contenido y de operación
- la base de prospectos puede ser común
- el flujo de envío no puede ser común si contradice el tipo de campaña seleccionada

Consecuencia directa de esta decisión:

- una campaña de WhatsApp debe usar el contenido y flujo propios del canal WhatsApp
- una campaña de Email debe usar el contenido y flujo propios del canal Email
- la UI de selección de prospectos puede seguir siendo compartida como capa de base operativa
- la acción concreta de envío debe depender del tipo de campaña seleccionada

## Campaña y canal

La relación correcta entre campaña y canal queda definida así:

- la campaña seleccionada es la que fija el canal operativo
- el canal no se elige libremente al final del proceso como una preferencia de último momento
- el contenido no se define de manera neutra o indiferenciada respecto del canal
- la operación de envío debe respetar la semántica de la campaña elegida

Esto implica que WhatsApp y Email no son variantes superficiales de una misma acción final. Son campañas de naturaleza distinta, aunque puedan compartir una misma base de prospectos como punto de partida.

## Particularidades por canal

Se deja asentado que cada canal tiene sus propias particularidades.

### WhatsApp

- requiere el flujo documental y operativo ya asociado al envío por WhatsApp
- depende de la disponibilidad de WhatsApp del prospecto
- usa el contenido o mensaje de campaña correspondiente a ese canal
- conserva su secuencia operativa específica dentro de central-hub

### Email

- requiere su propio flujo documental y operativo
- depende de la disponibilidad de Email válido del prospecto
- debe usar asunto y cuerpo de campaña del canal Email
- no debe consolidarse como modelo final una operatoria basada en redactar manualmente el contenido completo en cada ejecución

## Selección común no implica neutralidad de campaña

La selección común de prospectos sigue siendo válida y útil por razones operativas:

- concentra filtros, tabla, checkboxes y conteos en una base compartida
- permite visualizar disponibilidad por canal sobre un mismo conjunto de prospectos
- evita duplicar sin necesidad la capa de exploración y selección inicial

Pero esa capa común no altera la naturaleza de la campaña.

Por lo tanto:

- la UI común de prospectos no convierte a la campaña en un objeto agnóstico de canal
- la UI común no habilita por sí misma a mezclar libremente contenido y operación entre WhatsApp y Email
- la separación por canal debe expresarse en la acción posterior a la selección, no necesariamente en la base de selección

## Estado transitorio y modelo objetivo

Corresponde diferenciar con claridad dos planos.

### Estado transitorio o MVP técnico

Puede considerarse aceptable, solo como mecanismo transitorio de prueba técnica:

- haber habilitado una preparación manual de Email para validar el canal end-to-end
- haber usado asunto y cuerpo definidos al momento del envío como forma de prueba funcional
- haber reutilizado la selección común como punto de entrada para operar el canal Email en modo prueba

Ese esquema fue adecuado para comprobar transporte, integración, autenticación, resolución tenant y capacidad real de envío.

### Modelo objetivo

No corresponde consolidar como modelo objetivo del sistema:

- que el operador redacte el asunto y el cuerpo desde cero cada vez que quiere enviar Email
- que el canal de la campaña quede implícito o librado a una acción final ambigua
- que la UI sugiera que una misma campaña puede operar indistintamente como WhatsApp o como Email sin tipificación previa

El modelo objetivo correcto es:

- campaña definida por canal
- contenido de campaña coherente con ese canal
- flujo de operación dependiente del tipo de campaña
- selección de prospectos potencialmente común, pero ejecución no neutra

## Impacto sobre la UI y la operación

Desde esta decisión reforzada, la UI de selección de prospectos debe leerse y evolucionar de la siguiente manera:

- la pantalla puede seguir funcionando como base común de selección
- la campaña seleccionada debe condicionar qué acción de envío corresponde
- la operación disponible no debe inducir a una contradicción con el tipo de campaña
- el flujo Email debe alinearse progresivamente con el modelo de contenido de campaña, dejando la composición completamente libre como mecanismo transitorio y no como diseño final

## Compatibilidad con la documentación vigente

Este realineamiento es compatible con la documentación vigente porque:

- no contradice que el canal Email esté operativo end-to-end en modo prueba
- no contradice los contratos HTTP vigentes del gateway ni del mailer
- no contradice que la UI actual tenga una primera capa operativa para Email
- no contradice que la selección de prospectos sea común
- sí precisa que esa operación inicial de Email debe leerse como transitoria cuando depende de contenido libre por ejecución

La lectura correcta de la documentación vigente pasa a ser la siguiente:

- el transporte Email está resuelto
- la UI inicial existe
- la selección común es válida
- la decisión final de arquitectura y negocio sigue siendo que la campaña define el canal y su operación

## Decisión operativa explícita

Queda establecida la siguiente decisión operativa:

1. LeadMaster debe tratar a cada campaña como una campaña tipificada por canal.
2. WhatsApp y Email deben considerarse campañas distintas en términos de contenido y flujo operativo.
3. La selección de prospectos puede mantenerse como base común de trabajo.
4. La operación de envío debe depender del tipo de campaña seleccionada.
5. El modelo de redactar asunto y cuerpo manualmente en cada envío Email no debe consolidarse como diseño final del sistema.
6. Ese modelo manual solo puede sostenerse, si hiciera falta, como mecanismo transitorio de prueba técnica o MVP controlado.
7. La evolución de la UI debe orientarse a reflejar de manera explícita el tipo de campaña y a evitar operaciones que contradigan este modelo.

## Conclusión

La desalineación detectada no invalida el trabajo ya realizado sobre el canal Email. El cierre técnico end-to-end sigue siendo válido y queda firme.

Lo que corresponde ajustar es la lectura funcional del modelo:

- la base común de prospectos se mantiene
- la neutralidad de campaña no se admite
- el contenido libre por envío Email no representa el estado objetivo
- la campaña seleccionada debe definir el canal, el contenido esperable y el flujo correcto de operación

Con este reporte queda reforzada documentalmente la decisión ya tomada y queda preparado el terreno para un plan de implementación específico de realineamiento entre UI, campaña y canal.