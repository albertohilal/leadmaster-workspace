# CONTRATO MINIMO - Creacion de campana Email en central-hub

## Fecha

2026-03-21

## Destino

services/central-hub/docs/planificacion/CONTRATO_MINIMO_CREACION_CAMPANA_EMAIL_2026-03-21.md

## Objetivo

Definir el contrato minimo que `central-hub` debe considerar para la **creacion de una campana Email** como frente tecnico nuevo y separado del dominio actual de campanas WhatsApp.

Este documento busca fijar una base pequena, verificable y no ambigua para la siguiente etapa de trabajo, sin implementar codigo y sin presentar como resueltos aspectos que hoy todavia no lo estan.

En particular, este documento busca:

- establecer que debe entender el sistema por `creacion de campana Email`
- proponer los campos minimos del formulario
- separar este contrato del dominio actual de campanas WhatsApp
- dejar explicitamente documentado que partes del flujo actual de Email pueden reutilizarse y cuales no
- acotar el backend minimo sugerido sin inventar tablas, rutas implementadas ni integraciones ya cerradas

## Alcance

Este contrato cubre unicamente la definicion minima de la operacion `crear campana Email` dentro de `central-hub`.

Incluye:

- definicion semantica de la operacion
- campos minimos de formulario
- shape minimo de payload sugerido
- reglas de separacion respecto del dominio WhatsApp
- relacion con el flujo actual basado en `/mailer/send`
- impactos minimos esperables en frontend y backend

No incluye:

- programaciones
- seleccion o persistencia de destinatarios
- ejecucion de envios
- metricas operativas de entrega
- scheduler
- modelado final de persistencia
- decision final de rutas HTTP implementadas
- integracion ya cerrada al modulo actual de campanas WhatsApp

## Contexto actual

El relevamiento tecnico previo confirma el siguiente estado:

- el flujo actual de campanas en `services/central-hub` es WhatsApp-first
- la persistencia visible actual gira en torno a `ll_campanias_whatsapp`
- no existe hoy `channel`, `campaign_type`, `tipo_campania` o equivalente dentro del dominio real de campanas
- el flujo actual de Email verificado vive por fuera del dominio de campanas y esta compuesto, al menos, por:
  - `frontend/src/components/destinatarios/EmailCampaignFormModal.jsx`
  - `frontend/src/services/email.js`
  - `src/modules/mailer/validators/sendMailer.validator.js`
- ese flujo actual representa **envio Email puntual** y no una campana Email persistida ni gestionada como entidad propia

Consecuencia directa:

- hoy `central-hub` no dispone todavia de un contrato consolidado para `crear campana Email`
- por lo tanto, el siguiente paso correcto no es heredar el dominio WhatsApp ni reutilizar `/mailer/send` como si ya fuera un contrato de campana

## Definicion del problema

La ADR-002 establece que la separacion por canal debe expresarse tambien en formularios y flujos de creacion, comenzando por Email.

Sin un contrato minimo explicito para Email, el sistema queda expuesto a uno o varios errores de diseno:

- reinterpretar `campana Email` como una variante menor de la campana WhatsApp actual
- reutilizar `ll_campanias_whatsapp` o sus campos como si fueran una base comun multicanal
- tratar `/mailer/send` como si fuera ya una operacion de creacion de campana
- mezclar en una misma etapa definicion de campana, seleccion de destinatarios y envio efectivo
- introducir UI de Email sobre supuestos backend todavia no definidos

El problema real a resolver no es enviar un Email individual, sino acordar que informacion minima debe existir para que `central-hub` pueda reconocer una **campana Email** como una entidad de trabajo separada y coherente con su canal.

## Principios de diseno

El contrato minimo de campana Email debe regirse por los siguientes principios:

1. **Separacion por canal**

   - una campana Email no debe derivarse del dominio de campanas WhatsApp
   - el contrato no debe apoyarse en `ll_campanias_whatsapp` ni en sus reglas operativas

2. **Contrato antes que persistencia**

   - primero debe quedar claro que datos definen la campana Email
   - la persistencia especifica es una decision posterior y no debe darse por resuelta en este documento

3. **Creacion no equivale a envio**

   - crear una campana Email significa definir su identidad y su contenido base
   - no significa seleccionar destinatarios ni disparar `/mailer/send`

4. **Minimo shape verificable**

   - el contrato debe ser lo bastante pequeno como para poder validarse rapido
   - no debe arrastrar campos operativos que hoy pertenecen a WhatsApp

5. **Reutilizacion acotada y explicita**

   - solo deben reutilizarse del flujo actual de Email los conceptos ya confirmados por codigo
   - no debe inferirse desde ese flujo una campana persistida que hoy no existe

6. **No mezclar etapas**

   - formulario de creacion
   - backend de creacion
   - destinatarios
   - programacion
   - envio

   deben tratarse como capas separadas

## Que debe entender el sistema por "creacion de campana Email"

Para este frente, `crear campana Email` debe significar lo siguiente:

- registrar una definicion basica de campana asociada semanticamente al canal Email
- capturar el contenido base que identificara el envio de ese canal
- dejar esa definicion separada de la operacion concreta de despacho por destinatario
- no depender del dominio actual de campanas WhatsApp para existir conceptualmente

Dicho de otra forma:

- una campana Email es una definicion de contenido y contexto de canal
- no es un envio puntual
- no es una programacion
- no es una seleccion de prospectos
- no es una adaptacion cosmetica de la campana WhatsApp

## Campos minimos propuestos para campana Email

### Campos minimos del formulario

Los campos minimos visibles al operador propuestos para el primer contrato son:

- `nombre`
- `subject`
- `text`

### Criterio de cada campo

- `nombre`
  - obligatorio
  - identifica la campana dentro de `central-hub`
  - no representa asunto de envio ni nombre tecnico de template

- `subject`
  - obligatorio
  - representa el asunto base del Email
  - se alinea con el vocabulario ya verificado en el flujo actual `/mailer/send`

- `text`
  - obligatorio en el minimo implementable
  - representa el cuerpo base textual del Email
  - permite apoyarse en una validacion ya confirmada en el ecosistema actual de Email

### Campos opcionales diferidos

Estos campos pueden evaluarse mas adelante, pero no forman parte del minimo obligatorio:

- `html`
- `descripcion`
- `reply_to`
- `from_name`
- `from_email`
- `metadata`

La razon de diferirlos es evitar que el primer contrato nazca sobredimensionado por arrastre del flujo tecnico de envio o por necesidades todavia no validadas para campanas.

### Campos derivados del sistema y no del formulario

Si el backend implementa la operacion de creacion, estos datos deben resolverse del lado servidor y no desde el formulario:

- `cliente_id` derivado del contexto autenticado
- `canal = email` como semantica del dominio, no como decision manual del operador dentro de un formulario generico
- identificador interno de la campana, si la operacion llegara a persistirse
- trazabilidad basica de creacion, si la operacion llegara a persistirse

## Campos que no deben heredarse del dominio WhatsApp

Los siguientes campos o supuestos no deben arrastrarse automaticamente al contrato minimo de campana Email:

- `mensaje` como nombre canonico del contenido
- `programada`
- `fecha_envio`
- `campania_id` de `ll_campanias_whatsapp`
- `total_destinatarios`
- `enviados`
- `fallidos`
- `pendientes`
- `session_id`
- cualquier dato operativo del Session Manager
- cualquier referencia a `ll_envios_whatsapp`
- cualquier dependencia estructural de `ll_programaciones`

Tampoco deben heredarse como hecho consumado los estados hoy visibles en WhatsApp:

- `pendiente`
- `en_progreso`
- `finalizado`

El modelo de estados de una futura campana Email debe decidirse en su propio frente y no por copia del flujo WhatsApp.

## Relacion con el flujo actual `/mailer/send`

El flujo actual basado en `/mailer/send` debe leerse como **insumo tecnico parcial**, no como contrato de campana.

### Lo que si puede reutilizarse

- el vocabulario de contenido Email ya confirmado en codigo: `subject`, `text` y eventualmente `html`
- el criterio de validacion basico de contenido no vacio
- la idea de que el canal Email trabaja con un payload propio y no con campos de WhatsApp

### Lo que no puede reutilizarse como contrato de campana

- `to` como campo de creacion de campana
- la semantica de envio inmediato por destinatario
- el fanout sobre seleccion actual de prospectos
- la idea de que crear campana y enviar son la misma operacion
- el uso directo del contrato de `sendMailer.validator.js` como si ya describiera una entidad campana

### Regla de separacion

`/mailer/send` sigue representando una operacion de despacho tecnico.

La creacion de campana Email debe definirse como una operacion previa, distinta y separada del envio efectivo.

## Contrato backend minimo sugerido

### Naturaleza del contrato

El backend minimo sugerido para este frente debe ser un contrato dedicado de **creacion de campana Email** en `central-hub`, separado de:

- `/sender/campaigns` del dominio actual WhatsApp
- `/mailer/send` del flujo tecnico de despacho

La ruta final queda pendiente de decision. Este documento no la da por implementada.

### Request minimo sugerido

```json
{
  "nombre": "Campana Email Marzo",
  "subject": "Novedades de marzo",
  "text": "Contenido base del email"
}
```

### Reglas minimas de validacion sugeridas

- `nombre` obligatorio y no vacio
- `subject` obligatorio y no vacio
- `text` obligatorio y no vacio en el minimo implementable
- `cliente_id` no debe ser fuente de verdad del frontend si existe contexto autenticado
- no debe aceptarse `to` como parte de la creacion de campana
- no debe aceptarse payload de destinatarios en esta operacion
- no debe aceptarse informacion de programacion en esta operacion
- no debe aceptarse informacion de envio o metricas en esta operacion

### Response minima sugerida

Si la operacion queda persistida en una etapa posterior, la respuesta minima deberia devolver la representacion canonica de la campana Email creada, limitada al mismo contrato corto:

```json
{
  "id": 101,
  "nombre": "Campana Email Marzo",
  "subject": "Novedades de marzo",
  "text": "Contenido base del email"
}
```

Regla importante:

- esta respuesta es una **referencia de shape objetivo**, no una afirmacion de que hoy exista ya esa persistencia o ese endpoint

### Restricciones explicitas del backend minimo

El backend minimo sugerido no debe:

- reutilizar `campaignsController.js` como base directa sin una frontera separada por canal
- escribir en `ll_campanias_whatsapp`
- exigir destinatarios para considerar valida la creacion
- disparar `/mailer/send` como efecto colateral obligatorio de `create`
- acoplar la creacion al scheduler o a la logica de programaciones

## Impacto en frontend

El frontend minimo derivado de este contrato deberia asumir:

- un formulario propio de campana Email
- tres campos visibles obligatorios: `nombre`, `subject`, `text`
- una separacion explicita respecto del formulario actual de campanas WhatsApp
- ausencia de campos de programacion, destinatarios y metricas en el primer paso de creacion

Tambien implica estas reglas de implementacion futura:

- `CampaignsManager.jsx` no debe reutilizarse como si ya fuera un formulario neutral multicanal
- `EmailCampaignFormModal.jsx` puede servir como referencia de vocabulario y experiencia de redaccion, pero no como contrato funcional definitivo de creacion de campana
- el frontend no debe inducir que guardar una campana Email equivale a enviar correos

## Impacto en backend

El backend minimo derivado de este contrato deberia asumir:

- un punto de entrada dedicado para creacion de campana Email
- validacion propia del payload de creacion
- separacion explicita respecto del dominio campañas WhatsApp
- ausencia de dependencia obligatoria con destinatarios, envios y programaciones en la operacion de `create`

Tambien fija estos limites:

- no presentar Email como ya integrado al dominio actual de campañas
- no inventar persistencia compartida con WhatsApp
- no resolver por copia de estados ni por copia de tablas del dominio actual

## Riesgos

Los principales riesgos de este frente son:

- que la UI vuelva a mezclar Email y WhatsApp bajo un formulario aparentemente comun
- que se intente reutilizar `ll_campanias_whatsapp` por conveniencia tecnica de corto plazo
- que `/mailer/send` se use como atajo para evitar definir la frontera de creacion
- que se agreguen campos operativos demasiado temprano y el contrato nazca sobredimensionado
- que se definan estados, persistencia o rutas finales sin una validacion documental y tecnica separada

## Decisiones pendientes

Quedan pendientes, fuera del alcance de este documento, las siguientes decisiones:

- ruta HTTP definitiva del endpoint de creacion de campana Email en `central-hub`
- persistencia concreta del dominio Email
- modelo de estados especifico de la campana Email
- soporte de `html` en el minimo inicial o en una etapa posterior
- forma de list y detail para campanas Email
- momento y mecanismo de vinculacion futura entre campana Email y seleccion de destinatarios
- estrategia de envio posterior una vez creada la campana

## Criterio de minimo implementable

Se considerara alcanzado el minimo implementable de este contrato cuando exista una implementacion que cumpla simultaneamente estas condiciones:

- `central-hub` acepta una operacion dedicada de creacion de campana Email
- el payload minimo requerido es solo `nombre`, `subject` y `text`
- la operacion esta separada del dominio actual de campanas WhatsApp
- la operacion no exige destinatarios, programacion ni envio efectivo
- el frontend presenta un formulario especifico de Email y no una adaptacion cosmetica del flujo WhatsApp
- el contrato no depende de `ll_campanias_whatsapp` ni presenta `/mailer/send` como si fuera la misma cosa que `create campaign`

## Conclusion

El contrato minimo de creacion de campana Email en `central-hub` debe comenzar como una definicion corta y separada por canal.

Su base minima propuesta es:

- `nombre`
- `subject`
- `text`

Todo lo demas queda conscientemente fuera del primer corte de implementacion de este frente.

Ese recorte es intencional: protege la ADR-002, evita mezclar Email con el dominio actual de campanas WhatsApp y deja trazado un punto de partida concreto para la siguiente etapa tecnica.