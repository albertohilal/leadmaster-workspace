# REPORTE — Integración end-to-end Email Central Hub / Mailer

## Fecha

2026-03-15

## Objetivo

Documentar el cierre técnico de la fase Email end-to-end en modo prueba dentro de `leadmaster-workspace`, dejando asentado qué componentes quedaron implementados, cuál es el flujo operativo actual, qué validaciones se realizaron y cuáles son las limitaciones que todavía condicionan la explotación real del canal.

## Alcance de la fase

Esta fase deja operativo el canal Email de punta a punta en modo prueba dentro del ecosistema actual de LeadMaster, con separación clara entre:

- el servicio standalone `leadmaster-mailer`, responsable del envío real, resolución SMTP por cliente y auditoría de envíos
- el gateway expuesto por `central-hub`, responsable de autenticar al usuario, resolver `cliente_id` desde JWT y delegar el envío al mailer vía HTTP
- la UI inicial de `central-hub`, responsable de seleccionar prospectos, identificar disponibilidad de email y preparar el envío manual de Email sobre una selección común de prospectos

Quedan dentro del alcance de esta fase:

- integración HTTP `central-hub` → `leadmaster-mailer`
- endpoint autenticado `POST /mailer/send` en `central-hub`
- resolución de `cliente_id` desde el usuario autenticado
- lookup de configuración SMTP por cliente desde `iunaorg_dyd.ll_clientes_email_config`
- persistencia/auditoría de envíos del mailer
- UI inicial para selección común de prospectos y preparación de envío Email
- validación con envío real en entorno operativo de prueba

No quedan dentro del alcance de esta fase:

- dashboard comercial de campañas Email
- enriquecimiento automático masivo de emails
- operación masiva autónoma basada en bases de prospectos ya enriquecidas
- scoring, warmup, automatizaciones o secuencias comerciales avanzadas

## Componentes implementados

### 1. Servicio standalone `leadmaster-mailer`

Componente responsable del envío real de correos.

Capacidades implementadas en esta fase:

- endpoint standalone `POST /send`
- endpoint de salud `GET /health`
- resolución de SMTP por `cliente_id`
- lectura de configuración desde `iunaorg_dyd.ll_clientes_email_config`
- fallback controlado según configuración disponible
- auditoría/persistencia de envíos en la base correspondiente

Rol técnico:

- no autentica usuarios finales del hub
- no resuelve por sí mismo el contexto funcional de la UI de prospectos
- ejecuta el envío como servicio especializado de infraestructura de correo

### 2. Gateway Email de `central-hub`

Componente responsable de exponer una frontera segura y coherente para el resto de la aplicación.

Capacidades implementadas en esta fase:

- endpoint `POST /mailer/send`
- autenticación obligatoria por JWT
- resolución de `cliente_id` desde el usuario autenticado
- delegación HTTP hacia `leadmaster-mailer`
- encapsulamiento del contrato interno entre hub y mailer

Rol técnico:

- `central-hub` actúa como frontera autenticada del sistema
- evita que el cliente frontend tenga que invocar directamente al servicio standalone
- garantiza que el contexto tenant se derive del usuario autenticado y no de datos manipulables enviados desde la UI

### 3. UI inicial en `central-hub`

Se implementó una primera interfaz operativa para Email sobre la pantalla real de selección de prospectos.

Capacidades implementadas:

- selección común de prospectos
- conservación del flujo base de filtros, tabla, checkboxes y conteos
- visualización de disponibilidad por canal, incluyendo email
- acción específica de preparación de envío Email sobre la selección actual
- modal/formulario inicial con asunto, cuerpo y resumen de destinatarios válidos/inválidos
- envío manual desde frontend usando la selección actual de prospectos

Rol técnico:

- permite preparar y ejecutar el envío desde la operación diaria
- no constituye todavía un dashboard comercial ni una herramienta de automatización masiva

## Flujo end-to-end implementado

El flujo operativo actual queda definido así:

1. el usuario autenticado entra en `central-hub`
2. filtra y selecciona prospectos desde la UI común de destinatarios
3. la UI identifica cuáles prospectos tienen email disponible y cuáles no
4. el usuario abre la preparación de envío Email
5. la UI arma el payload de envío para destinatarios válidos
6. la UI invoca el gateway autenticado `POST /mailer/send` en `central-hub`
7. `central-hub` valida JWT y resuelve `cliente_id` desde el usuario autenticado
8. `central-hub` delega el request al servicio standalone `leadmaster-mailer`
9. `leadmaster-mailer` resuelve la configuración SMTP del cliente en `iunaorg_dyd.ll_clientes_email_config`
10. `leadmaster-mailer` ejecuta el envío real
11. `leadmaster-mailer` registra auditoría/persistencia del envío
12. el resultado vuelve a `central-hub` y luego a la UI

Separación de responsabilidades:

- `leadmaster-mailer` es el motor de envío
- `central-hub` es el gateway autenticado y contexto funcional
- la UI es la capa de operación manual inicial

## Validaciones realizadas

Durante esta fase quedaron validadas las siguientes condiciones técnicas:

- existencia operativa del servicio standalone `leadmaster-mailer`
- disponibilidad del endpoint de envío del mailer
- integración HTTP desde `central-hub` hacia el mailer
- exposición del gateway `POST /mailer/send` en `central-hub`
- exigencia de autenticación JWT en la frontera del hub
- resolución de `cliente_id` desde el usuario autenticado
- lookup SMTP por cliente desde `iunaorg_dyd.ll_clientes_email_config`
- flujo de envío real exitoso en modo prueba
- persistencia/auditoría del envío resultante
- disponibilidad inicial de UI para selección común y preparación de Email

Resultado de validación:

- el problema técnico de transporte y envío quedó resuelto para modo prueba
- la cadena completa UI → `central-hub` → `leadmaster-mailer` → SMTP quedó funcional

## Evidencia resumida de validación

Durante la fase quedaron comprobados, en entorno operativo de prueba, los siguientes puntos:

- envío exitoso llamando directamente al servicio standalone `leadmaster-mailer`
- envío exitoso llamando al gateway `POST /mailer/send` de `central-hub`
- configuración SMTP multicliente validada con clientes de prueba
- integración real `central-hub` ↔ `leadmaster-mailer` operativa en `main`
- build de frontend y reinicio del backend realizados sin errores de arranque
- render de la UI con selección común de prospectos, disponibilidad por canal y acción Email

## Estado actual de datos

El estado actual de datos condiciona fuertemente el uso real del canal.

Situación observada:

- la base operativa principal relevada para esta fase no presenta cobertura útil de emails para explotación masiva del canal
- en la verificación realizada sobre la base operativa principal, la cobertura de emails resultó nula o no utilizable para operación masiva
- el canal Email ya puede enviar cuando el dato existe y es válido
- el cuello de botella principal ya no es el envío sino la disponibilidad del dato email

Conclusión operativa sobre datos:

- la infraestructura de envío está funcional
- la limitación dominante pasa por adquisición, normalización, validación y enriquecimiento de emails de prospectos
- sin resolver esa capa de datos, el canal no puede escalar comercialmente aunque el backend de envío esté listo

## Limitaciones conocidas

Las limitaciones conocidas al cierre de esta fase son las siguientes:

- la cobertura de emails en la base de prospectos no es masiva ni operativamente suficiente
- no existe todavía enriquecimiento automático masivo de emails
- la UI implementada es una primera capa operativa, no un cockpit comercial completo
- no hay aún gestión avanzada de campañas, métricas de negocio o automatizaciones de nurturing
- no hay pipeline cerrado de higiene de datos de email a escala
- la operación actual depende de disponer previamente del email en el prospecto

Limitación principal al cierre:

- el cuello de botella actual es la adquisición/enriquecimiento de emails, no el envío

## Qué queda fuera de esta fase

Queda explícitamente fuera de esta fase:

- dashboard comercial de Email
- gestión masiva de campañas con reporting comercial completo
- enriquecimiento automático masivo de emails
- scraping, matching externo o procesos batch de descubrimiento de emails
- automatizaciones avanzadas de campañas
- optimización comercial de performance del canal

También queda fuera:

- redefinir el modelo comercial del canal
- instrumentar una operación intensiva basada en datasets todavía no enriquecidos

## Próxima fase recomendada

La siguiente fase recomendada debe enfocarse en datos y operación, no en transporte.

Prioridades sugeridas:

1. diseñar e implementar estrategia de adquisición/enriquecimiento de emails
2. definir pipeline de validación, normalización e higiene de direcciones
3. aumentar cobertura real de emails sobre la base de prospectos operables
4. formalizar el contrato documental del gateway `POST /mailer/send` de `central-hub`
5. evolucionar la UI desde preparación manual a operación controlada de campañas
6. recién después, evaluar dashboard comercial y métricas de explotación

Lectura técnica de prioridad:

- el backend de envío ya no es el cuello crítico
- seguir invirtiendo primero en features comerciales sin resolver la disponibilidad de emails tendría bajo rendimiento práctico

## Conclusión

La fase Email end-to-end en modo prueba queda técnicamente cerrada.

Queda demostrado que:

- existe servicio standalone `leadmaster-mailer`
- `central-hub` integra mailer vía HTTP
- `central-hub` expone `POST /mailer/send`
- el endpoint requiere JWT
- `cliente_id` se resuelve desde el usuario autenticado
- `leadmaster-mailer` resuelve SMTP por cliente desde `iunaorg_dyd.ll_clientes_email_config`
- el flujo fue validado con envío real
- existe una UI inicial para selección común de prospectos y preparación de envío Email

Por lo tanto, el canal Email quedó funcional end-to-end en modo prueba.

La restricción principal que permanece abierta no es de transporte ni de integración técnica, sino de datos: la base actual todavía no cuenta con enriquecimiento/cobertura de emails suficiente para una explotación masiva. La próxima etapa correcta debe concentrarse en resolver esa disponibilidad de datos antes de escalar el canal hacia una operación comercial completa.
