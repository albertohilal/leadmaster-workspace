# Contrato mínimo - Creación de campaña Email en central-hub

Status: DRAFT
Last Reviewed: 2026-03-24

## Objetivo

Definir el contrato mínimo de creación de campaña Email en `central-hub` como una operación propia del canal Email, separada del dominio actual de campañas WhatsApp y separada también del envío efectivo.

Este documento fija un recorte mínimo y verificable. No cierra por sí mismo la implementación final ni reemplaza decisiones constitucionales del workspace.

## Alcance

Este documento cubre únicamente la operación de crear una campaña Email.

Incluye:

- el significado operativo de `crear campaña Email`
- los campos mínimos que debe sostener el contrato
- la separación respecto de destinatarios, programación y envío
- la relación mínima con el flujo técnico actual de `mailer`
- el impacto inmediato esperado en frontend y backend

No incluye:

- selección de destinatarios
- carga masiva o fanout
- programación de envíos
- ejecución del envío
- scheduler
- métricas operativas
- estados de entrega
- definición final de persistencia como decisión cerrada
- convergencia multicanal

## Fuentes verificadas

### Decisiones documentales del workspace

- [docs/01-CONSTITUCIONAL/ADR-002-FORMULARIOS-CAMPANAS-POR-CANAL-INICIO-EMAIL.md](../../../../docs/01-CONSTITUCIONAL/ADR-002-FORMULARIOS-CAMPANAS-POR-CANAL-INICIO-EMAIL.md)
  - **Verificado:** fija que las campañas deben separarse por canal y que el primer frente visible debe empezar por Email.
  - **Verificado:** descarta una campaña común multicanal como punto de partida.
- [docs/00-INDEX/DOCUMENTATION_RULES.md](../../../../docs/00-INDEX/DOCUMENTATION_RULES.md)
  - **Verificado:** exige usar carpetas existentes, nombres con guiones y metadata mínima para documentos de plan/estado.

### Evidencia de código en central-hub

- [src/index.js](../../src/index.js)
  - **AS-IS IMPLEMENTADO:** monta `'/api/email'` y `'/mailer'` como superficies distintas.
- [src/modules/email/routes/index.js](../../src/modules/email/routes/index.js)
- [src/modules/email/routes/email.routes.js](../../src/modules/email/routes/email.routes.js)
- [src/modules/email/routes/emailCampaigns.routes.js](../../src/modules/email/routes/emailCampaigns.routes.js)
  - **AS-IS IMPLEMENTADO:** existe `POST /api/email/campaigns` y, por separado, existen `POST /api/email/campaigns/:id/recipients` y `POST /api/email/campaigns/:id/prepare`.
- [src/modules/email/controllers/emailCampaigns.controller.js](../../src/modules/email/controllers/emailCampaigns.controller.js)
  - **AS-IS IMPLEMENTADO:** la creación, la carga de destinatarios y la preparación son operaciones separadas en controller.
- [src/modules/email/services/emailCampaigns.service.js](../../src/modules/email/services/emailCampaigns.service.js)
  - **AS-IS IMPLEMENTADO:** la creación actual inserta en `ll_campanias_email` y devuelve `id`, `cliente_id`, `nombre`, `asunto` y `estado`.
- [src/modules/email/validators/createEmailCampaign.validator.js](../../src/modules/email/validators/createEmailCampaign.validator.js)
  - **AS-IS IMPLEMENTADO:** el create actual acepta `nombre`, `asunto`, `body` y opcionales adicionales.
  - **AS-IS IMPLEMENTADO:** rechaza `subject`, `text`, `to`, `destinatarios`, métricas y campos operativos.
- [src/modules/mailer/validators/sendMailer.validator.js](../../src/modules/mailer/validators/sendMailer.validator.js)
  - **AS-IS IMPLEMENTADO:** `POST /mailer/send` valida `to`, `subject` y `text`.
  - **AS-IS IMPLEMENTADO:** describe despacho técnico, no entidad campaña.
- [frontend/src/components/destinatarios/EmailCampaignFormModal.jsx](../../frontend/src/components/destinatarios/EmailCampaignFormModal.jsx)
  - **AS-IS IMPLEMENTADO:** el modal actual prepara envío inmediato sobre una selección de prospectos y exige destinatarios válidos.
- [frontend/src/services/email.js](../../frontend/src/services/email.js)
  - **AS-IS IMPLEMENTADO:** el servicio actual usa `'/mailer/send'` para envío por destinatario.
  - **Verificado:** existe una función `createCampaign()` con payload `nombre`, `subject` y `text`, pero no hay evidencia de consumo verificado de esa función fuera del propio archivo.
  - **Verificado:** ese payload no coincide con el validador backend actual, que exige `asunto` y usa `body` en lugar de `text`.

### Antecedentes documentales del servicio

- [docs/planificacion/CONTRATO_MINIMO_CREACION_CAMPANA_EMAIL_2026-03-21.md](CONTRATO_MINIMO_CREACION_CAMPANA_EMAIL_2026-03-21.md)
  - **HISTÓRICO / antecedente:** contiene un primer recorte útil del problema.
  - **No canónico para naming actual:** usa underscores y mayúsculas en el nombre de archivo.
  - **Uso en este documento:** antecedente de planificación, no plantilla literal.

## Contexto actual verificado

1. **AS-IS IMPLEMENTADO:** `central-hub` ya expone una ruta de creación bajo `POST /api/email/campaigns`.
2. **AS-IS IMPLEMENTADO:** ese create Email está efectivamente implementado en backend y persiste en `ll_campanias_email`.
3. **AS-IS IMPLEMENTADO:** el contrato backend hoy verificado para create usa `nombre`, `asunto` y `body`, con opcionales adicionales; no usa como contrato canónico actual `nombre`, `subject` y `text`.
4. **AS-IS IMPLEMENTADO:** la operación actual inicializa `estado = 'borrador'` y setea contadores en cero.
5. **AS-IS IMPLEMENTADO:** destinatarios y preparación están separados de create en endpoints y servicios distintos.
6. **AS-IS IMPLEMENTADO:** el flujo visible de frontend hoy asociado a Email está centrado en despacho por destinatario usando `'/mailer/send'`.
7. **PENDIENTE DE ALINEACIÓN:** frontend, backend y mailer no comparten hoy un contrato mínimo único para creación de campaña Email.
8. **PENDIENTE DE ALINEACIÓN:** la existencia de persistencia actual no equivale a tener cerrado el contrato mínimo objetivo defendido por este documento.

## Problema a resolver

Hoy coexisten dos hechos distintos:

- existe una implementación backend de creación de campaña Email con un contrato propio
- existe un flujo frontend de Email orientado al despacho técnico, no a la creación de una campaña como entidad mínima

El problema no es abrir una capacidad genérica de Email. El problema es fijar un contrato mínimo, corto y verificable para `crear campaña Email` sin mezclar esa operación con:

- destinatarios
- programación
- preparación
- envío técnico por `mailer`
- estados y métricas heredadas de WhatsApp

## Principios del contrato

1. **Separación por canal**

   La creación de campaña Email debe definirse dentro del canal Email. No debe modelarse como una variante automática del dominio actual de campañas WhatsApp.

2. **Crear no equivale a enviar**

   La creación define identidad y contenido base. No ejecuta despacho.

3. **Crear no equivale a seleccionar destinatarios**

   La campaña puede existir como definición mínima antes de cualquier vinculación con receptores.

4. **Crear no equivale a programar**

   La programación es una operación posterior y separada.

5. **Contrato mínimo antes que superficie amplia**

   El primer contrato debe sostener solo lo necesario para identificar la campaña y su contenido base.

6. **Reutilización acotada del mailer**

   El flujo de `mailer` puede reutilizarse como mecanismo técnico de despacho, no como definición de campaña.

## Qué debe entender el sistema por “crear campaña Email”

Para este documento, `crear campaña Email` significa:

- registrar o aceptar una definición mínima propia del canal Email
- capturar la identidad funcional de la campaña mediante `nombre`
- capturar el contenido base del canal mediante `subject` y `text`
- dejar explícitamente fuera del create los destinatarios, la programación y el envío

En consecuencia:

- crear campaña Email no equivale a enviar
- crear campaña Email no equivale a seleccionar destinatarios
- crear campaña Email no equivale a programar
- `'/mailer/send'` no debe tratarse como create-campaign

## Campos mínimos del contrato

### Campos obligatorios

**CONTRATO MÍNIMO OBJETIVO:** el recorte contractual que este documento sostiene es:

- `nombre`
- `subject`
- `text`

Criterio mínimo:

- `nombre`: identifica la campaña dentro del servicio
- `subject`: define el asunto base del canal Email
- `text`: define el cuerpo base textual del Email

### Campos diferidos

Los siguientes campos quedan fuera del contrato mínimo y solo pueden incorporarse con validación específica posterior:

- `html`
- `email_from`
- `name_from`
- `reply_to_email`
- `observaciones`
- cualquier metadata adicional

**Verificado:** algunos de estos campos existen hoy en el create backend actual.

**Decisión de este documento:** su existencia actual no los convierte en parte del contrato mínimo.

### Campos que no deben heredarse de WhatsApp

No deben heredarse automáticamente al contrato mínimo de Email campos o supuestos como:

- `programada`
- `fecha_envio`
- `total_destinatarios`
- `enviados`
- `fallidos`
- `pendientes`
- `session_id`
- métricas operativas
- estados copiados de WhatsApp

Tampoco deben heredarse sin validación campos de control o persistencia como:

- `estado`
- `fecha_inicio_envio`
- `fecha_fin_envio`
- `cliente_id` en el body
- cualquier referencia a Session Manager

## Relación con el flujo actual de mailer

### Qué puede reutilizarse

Del flujo actual de `mailer` puede reutilizarse únicamente:

- el vocabulario de contenido `subject` y `text`
- la validación de no vacío para `subject` y `text`
- la separación conceptual entre contenido Email y otros canales
- el despacho técnico posterior cuando exista una campaña ya creada y preparada

### Qué no puede reutilizarse como contrato de campaña

No puede reutilizarse como contrato de creación de campaña:

- `to`
- la semántica de envío inmediato
- el fanout por destinatario del frontend actual
- el requisito de contar con destinatarios válidos para poder crear
- la respuesta operativa de `'/mailer/send'`

`'/mailer/send'` debe tratarse como una operación de despacho técnico. No describe por sí mismo la creación de una campaña Email.

## Contrato backend mínimo sugerido

### Request mínimo

**CONTRATO MÍNIMO OBJETIVO:** el request mínimo sugerido para el target contractual es:

```json
{
  "nombre": "Campaña Email Marzo",
  "subject": "Novedades de marzo",
  "text": "Contenido base del email"
}
```

**Importante:** este shape es un objetivo contractual del documento. No describe el estado backend actualmente alineado.

**AS-IS IMPLEMENTADO:** el create backend actual usa `asunto` y `body`.

**PENDIENTE DE ALINEACIÓN:** hoy existe desalineación real respecto de este shape entre frontend, backend y el flujo técnico de mailer.

### Reglas mínimas de validación

**CONTRATO MÍNIMO OBJETIVO:** reglas mínimas a sostener para este target contractual:

- `nombre` obligatorio y no vacío
- `subject` obligatorio y no vacío
- `text` obligatorio y no vacío
- `cliente_id` derivado del contexto autenticado, no del body
- rechazo de `to` en create
- rechazo de payload de destinatarios en create
- rechazo de datos de programación en create
- rechazo de métricas, contadores y estados operativos en create

### Restricciones explícitas

El contrato mínimo objetivo de create no debe:

- disparar `'/mailer/send'` como efecto colateral necesario
- exigir destinatarios para ser válido
- exigir programación para ser válido
- copiar estados del dominio WhatsApp como base conceptual automática
- mezclar creación con `POST /api/email/campaigns/:id/recipients`
- mezclar creación con `POST /api/email/campaigns/:id/prepare`

Si se documenta una respuesta de referencia, debe aclararse como **shape objetivo de referencia** y no como evidencia del estado implementado, salvo prueba específica adicional.

## Impacto en frontend

El frontend mínimo alineado con este contrato debe:

- presentar un formulario propio de creación de campaña Email
- pedir solo `nombre`, `subject` y `text` en el primer paso
- no exigir destinatarios para poder crear
- no inducir que guardar una campaña equivale a enviar
- separar visual y funcionalmente create de cualquier flujo de despacho

**Verificado:** el modal actual [frontend/src/components/destinatarios/EmailCampaignFormModal.jsx](../../frontend/src/components/destinatarios/EmailCampaignFormModal.jsx) no cumple ese rol; está orientado a envío sobre selección actual.

## Impacto en backend

El backend mínimo alineado con este contrato debe:

- sostener una operación dedicada de create dentro del canal Email
- validar un payload mínimo separado de destinatarios y programación
- mantener create, recipients y prepare como operaciones distintas
- separar create del contrato técnico de `mailer`

**Verificado:** hoy ya existe separación operativa entre create, recipients y prepare.

**PENDIENTE DE ALINEACIÓN:** la decisión principal todavía abierta en backend es una de estas dos:

- alinear el contrato canónico de create a `nombre`, `subject`, `text`
- o documentar formalmente una adaptación canónica entre `subject`/`text` y `asunto`/`body`

Mientras no exista evidencia adicional, ninguna de las dos debe presentarse como resuelta.

## Riesgos de mala interpretación

Los riesgos principales son:

1. tratar `'/mailer/send'` como si fuera create-campaign
2. asumir que el flujo actual de envío por selección ya resuelve campañas Email
3. heredar estados, contadores o scheduling del dominio WhatsApp sin validación específica
4. considerar que la persistencia actual ya cierra el contrato mínimo solo porque existe una tabla y un insert
5. mezclar una operación mínima de create con requisitos de destinatarios o preparación
6. dar por alineados frontend y backend cuando hoy usan nombres de campos distintos

## Decisiones pendientes

Quedan pendientes de cierre técnico y documental:

- nombre canónico final de los campos de contenido en la API de create: `subject`/`text` o adaptación explícita contra `asunto`/`body`
- shape de respuesta canónico del create mínimo
- alcance futuro de campos opcionales de remitente
- criterio documental para considerar cerrada la persistencia como parte estable del contrato
- forma de transición entre la implementación actual y el contrato mínimo objetivo

## Estado de implementación

### Realizado

- existe una superficie backend para create en `POST /api/email/campaigns`
- existe validación backend específica para creación de campaña Email
- existe persistencia actual en `ll_campanias_email`
- existen operaciones separadas para destinatarios y preparación
- existe un flujo técnico de despacho por `'/mailer/send'`

### Pendiente

- alinear frontend y backend sobre un contrato mínimo único
- sostener en la API mínima los campos `nombre`, `subject` y `text`
- disponer un formulario frontend de create separado del flujo actual de envío
- documentar una respuesta mínima estable solo cuando exista evidencia cerrada

### Criterio de cierre documental

Este documento podrá considerarse documentalmente cerrado cuando exista evidencia verificable de que:

- frontend y backend comparten el mismo contrato mínimo de create
- el create de campaña Email acepta únicamente la identidad y el contenido base del primer corte
- create sigue separado de destinatarios, programación y envío
- `'/mailer/send'` permanece documentado como despacho técnico y no como create-campaign

## Conclusión

La creación de campaña Email en `central-hub` debe entenderse como una operación mínima, propia del canal Email y separada del envío.

Como cierre documental de este recorte, el contrato mínimo objetivo que este documento sostiene es:

- `nombre`
- `subject`
- `text`

Eso no describe el contrato backend hoy alineado. Describe el target contractual mínimo que debe usarse como base para la siguiente alineación o validación.

Todo lo demás queda explícitamente fuera de este primer recorte, salvo evidencia adicional y validación posterior.
