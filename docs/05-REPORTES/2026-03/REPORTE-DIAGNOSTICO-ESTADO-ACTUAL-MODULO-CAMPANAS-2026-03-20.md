# REPORTE — Diagnóstico técnico del estado actual del módulo de campañas

## Fecha

2026-03-20

## Destino

docs/05-REPORTES/2026-03/REPORTE-DIAGNOSTICO-ESTADO-ACTUAL-MODULO-CAMPANAS-2026-03-20.md

## Alcance

Este reporte releva el estado actual del módulo de campañas en el repositorio `leadmaster-workspace`, tomando como referencia principal la implementación real hoy activa en `services/central-hub`.

El objetivo es responder, con base en archivos concretos, cómo está resuelta hoy la creación de campañas, cómo se conecta con el flujo actual de WhatsApp, qué piezas de Email ya existen y qué brecha separa el estado actual del objetivo de campañas tipificadas por canal.

El reporte se basa en código fuente, rutas, controladores, servicios, schema y componentes actualmente presentes en el repositorio. Cuando aparece una inconsistencia entre código, schema y documentación interna, se marca explícitamente.

## A. Resumen ejecutivo breve

El módulo actual de campañas está implementado como un módulo esencialmente orientado a WhatsApp, tanto en frontend como en backend y persistencia.

El punto de entrada de frontend es una única pantalla monolítica, `CampaignsManager.jsx`, que contiene embebido el modal de `Nueva Campaña`. No existe hoy un formulario desacoplado por canal ni una abstracción reusable para `WhatsApp` y `Email`.

La API real de campañas cuelga de `POST /api/sender/campaigns`, `GET /api/sender/campaigns`, `GET /api/sender/campaigns/:id`, `PUT /api/sender/campaigns/:id`, `DELETE /api/sender/campaigns/:id` y `POST /api/sender/campaigns/:id/approve`. Todo el backend de campañas persiste sobre `ll_campanias_whatsapp` y el resto del flujo operativo se acopla a `ll_envios_whatsapp`, `ll_programaciones` y a los controladores legacy de destinatarios, prospectos y envíos.

No se encontró soporte explícito a `channel`, `canal`, `campaign_type` o equivalente en la persistencia real relevada para campañas. Tampoco se encontró una tabla paralela para campañas Email.

Sí existe infraestructura funcional de Email, pero está separada del módulo de campañas actual. En concreto, ya existen:

- UI inicial para preparación manual de Email sobre selección común de prospectos
- servicio frontend `email.js`
- gateway en `central-hub`
- mailer standalone
- auditoría técnica `ll_envios_email`
- configuración SMTP por cliente en `ll_clientes_email_config`

Sin embargo, esas piezas no están conectadas al modelo actual de campañas. El flujo Email hoy opera como fan-out manual por destinatario, no como una campaña Email persistida dentro del módulo de campañas.

Además del acoplamiento duro a WhatsApp, el estado actual presenta inconsistencias técnicas concretas:

- el controlador de campañas usa `ll_campanias_whatsapp`
- el schema base visible en el repo no expone columnas `descripcion`, `programada`, `fecha_envio` ni `fecha_actualizacion` para campañas
- el método `update` usa variables no desestructuradas del `req.body`, lo que deja una falla potencial de runtime
- el flujo de aprobación y estados tiene desalineaciones entre frontend y backend
- el frontend declara endpoints que no tienen contraparte real implementada en backend
- parte de la UI de campañas sigue dependiendo de mocks o simulaciones locales

La conclusión técnica es directa: hoy no existe un módulo de campañas neutro respecto del canal. Existe un módulo de campañas WhatsApp con infraestructura Email adyacente pero todavía no integrada al dominio `campaigns`.

## B. Archivos frontend involucrados

### 1. Pantalla principal de campañas

Archivo principal:

- `services/central-hub/frontend/src/components/campaigns/CampaignsManager.jsx`

Ruta de navegación:

- `services/central-hub/frontend/src/App.jsx`
- la pantalla está montada en `/campaigns`

Componente principal:

- `CampaignsManager`

Componentes hijos relevantes utilizados por esa pantalla:

- `ProgramacionesForm`
- `ProgramacionesList`
- `GestorDestinatarios`
- `Card`
- `Button`
- `LoadingSpinner`
- `Modal`

Servicios frontend consumidos:

- `senderAPI` desde `services/central-hub/frontend/src/services/api.js`
- `campanasService` desde `services/central-hub/frontend/src/services/campanas.js`
- `destinatariosService` desde `services/central-hub/frontend/src/services/destinatarios.js`
- `useAuth` desde `services/central-hub/frontend/src/contexts/AuthContext`

Hooks usados en `CampaignsManager`:

- `useState`
- `useEffect`
- `useAuth`

### 2. Estado local del modal y de la pantalla

`CampaignsManager.jsx` concentra toda la UI de campañas y maneja el estado local directamente dentro del mismo componente.

Estados locales relevantes:

- `loading`
- `campaigns`
- `showCreateModal`
- `showEditModal`
- `showStatsModal`
- `showSendModal`
- `showDetailsModal`
- `showRecipientsModal`
- `selectedCampaign`
- `editingCampaign`
- `destinatarios`
- `estadisticasDestinatarios`
- `loadingDestinatarios`
- `formData`

Estructura actual de `formData`:

- `nombre`
- `descripcion`
- `mensaje`
- `programada`
- `fecha_envio`

No existe en el estado local ningún campo como:

- `channel`
- `canal`
- `tipo_campania`
- `subject`
- `body`
- `template_email`

### 3. Estructura real del formulario `Nueva Campaña`

El modal `Nueva Campaña` no está extraído a un componente independiente. Está embebido dentro de `CampaignsManager.jsx`.

Campos hoy visibles:

- `Nombre de la campaña *`
- `Descripción`
- `Mensaje *`
- `Programar envío` (checkbox)
- `Fecha y hora de envío` si `programada === true`

Notas de UI relevantes:

- el modal muestra un campo `Mensaje`, no una abstracción de contenido por canal
- el copy de la pantalla para clientes dice `Administra tus envíos masivos de WhatsApp`
- el modal de creación incluye la nota `Los mensajes se enviarán solo a los leads con IA habilitada`

Ese texto y esa estructura confirman que la UI actual fue diseñada desde una semántica de WhatsApp.

### 4. Validaciones actuales en frontend

En el modal de creación de campaña, la validación real en frontend es mínima.

Observaciones verificadas:

- los inputs usan `required` a nivel HTML para `nombre` y `mensaje`
- `handleSaveCampaign` no ejecuta validación explícita previa al submit
- `handleSaveCampaign` simplemente envía `formData` a `senderAPI.createCampaign(formData)`
- `handleEditCampaign` sí bloquea edición según estado y cantidad de enviados, pero no resuelve validación estructural por canal

Validación real específica de programación:

- el formulario `ProgramacionesForm.jsx` sí valida localmente `campania_id`, `fecha_inicio`, `dias_semana`, `hora_inicio`, `hora_fin` y `cupo_diario`

### 5. Submit handlers y llamadas HTTP actuales

Handlers principales:

- `loadCampaigns()` → `senderAPI.getCampaigns()`
- `handleSaveCampaign()` → `senderAPI.createCampaign(formData)`
- `handleSaveEditCampaign()` → `senderAPI.updateCampaign(editingCampaign.id, formData)`
- `handleApproveCampaign()` → `campanasService.aprobarCampana(campaign.id)`
- `handleViewRecipients()` → `destinatariosService.getDestinatariosCampania(campaign.id)`

Llamadas HTTP declaradas en `senderAPI` para campañas:

- `GET /sender/campaigns`
- `GET /sender/campaigns/:id`
- `POST /sender/campaigns`
- `PUT /sender/campaigns/:id`
- `DELETE /sender/campaigns/:id`
- `GET /sender/campaigns/:id/stats`
- `POST /sender/campaigns/:id/send`
- `POST /sender/campaigns/:id/pause`
- `POST /sender/campaigns/:id/resume`

Estado real de uso en la UI:

- creación: conectada a backend real
- edición: conectada a backend real
- listado: conectado a backend real
- aprobación: conectada a backend real
- envío de campaña: no usa backend real; la función `confirmSendCampaign` simula el cambio en memoria
- estadísticas: el modal usa datos ya cargados en `campaigns`; no hay fetch real de métricas detalladas

### 6. Reutilización o hardcodeo del formulario

El formulario actual no muestra una abstracción reusable por canal.

Conclusión de frontend:

- el formulario está centralizado en `CampaignsManager.jsx`
- no existe un `CampaignForm` reusable
- no existe discriminación por `channel`
- no existe split entre contenido WhatsApp y contenido Email
- la estructura actual está semánticamente hardcodeada para WhatsApp

## C. Archivos backend involucrados

### 1. Punto de montaje de rutas

Archivo:

- `services/central-hub/src/index.js`

Montajes relevantes:

- `app.use('/api/sender', require('./modules/sender/routes'))`
- `app.use('/api/email', require('./modules/email/routes'))`
- `app.use('/mailer', require('./modules/mailer/routes'))`

Esto implica que el módulo de campañas vive bajo `/api/sender`, mientras el soporte Email reutilizable vive por fuera del módulo de campañas, bajo `/api/email` y `/mailer`.

### 2. Rutas del módulo de campañas

Archivos:

- `services/central-hub/src/modules/sender/routes/index.js`
- `services/central-hub/src/modules/sender/routes/campaigns.js`

Rutas efectivamente implementadas en `campaigns.js`:

- `GET /api/sender/campaigns`
- `POST /api/sender/campaigns`
- `POST /api/sender/campaigns/:id/approve`
- `GET /api/sender/campaigns/:id`
- `PUT /api/sender/campaigns/:id`
- `DELETE /api/sender/campaigns/:id`

No aparecen implementadas en ese router las rutas declaradas por el frontend para:

- `GET /api/sender/campaigns/:id/stats`
- `POST /api/sender/campaigns/:id/send`
- `POST /api/sender/campaigns/:id/pause`
- `POST /api/sender/campaigns/:id/resume`

Esto es una inconsistencia concreta entre frontend y backend.

### 3. Controlador principal de campañas

Archivo:

- `services/central-hub/src/modules/sender/controllers/campaignsController.js`

Observación estructural importante:

- no existe una capa de servicio, repositorio o modelo separada para campañas
- el controlador ejecuta SQL directo con `db.execute(...)`
- el propio archivo se documenta como `Controlador de Campañas WhatsApp`

### 4. Endpoints relevantes y estado actual

#### `GET /api/sender/campaigns`

Archivo:

- `campaignsController.js`

Consulta real:

- selecciona desde `ll_campanias_whatsapp`
- para admin lista todas
- para cliente filtra por `cliente_id`

Campos seleccionados:

- `id`
- `nombre`
- `mensaje`
- `fecha_creacion`
- `estado`
- `cliente_id`

Campos agregados artificialmente para compatibilidad frontend:

- `descripcion: ''`
- `programada: false`
- `fecha_envio: null`

Validaciones actuales:

- autenticación previa por middleware del módulo sender
- restricción por `cliente_id` salvo admin

Soporte explícito de `channel`:

- no existe

#### `GET /api/sender/campaigns/:id`

Consulta real:

- `SELECT id, nombre, mensaje, fecha_creacion, estado, cliente_id FROM ll_campanias_whatsapp WHERE id = ? AND cliente_id = ?`

Campos agregados artificialmente:

- `descripcion: ''`
- `programada: false`
- `fecha_envio: null`

Soporte explícito de `channel`:

- no existe

#### `POST /api/sender/campaigns`

Payload que el controlador espera leer:

- `nombre`
- `descripcion`
- `mensaje`
- `programada`
- `fecha_envio`

Validaciones actuales:

- `nombre` obligatorio
- `mensaje` obligatorio
- si `programada` es truthy, exige `fecha_envio` parseable

Persistencia real efectivamente ejecutada:

- `INSERT INTO ll_campanias_whatsapp (nombre, mensaje, cliente_id, estado, fecha_creacion)`

Campos efectivamente persistidos por el `INSERT`:

- `nombre`
- `mensaje`
- `cliente_id`
- `estado = 'pendiente_aprobacion'`
- `fecha_creacion = NOW()`

Campos no persistidos pese a venir en el payload:

- `descripcion`
- `programada`
- `fecha_envio`

Soporte explícito de `channel`:

- no existe

#### `PUT /api/sender/campaigns/:id`

Payload que el controlador parece querer usar:

- `nombre`
- `descripcion`
- `mensaje`
- `programada`
- `fecha_envio`

Problema real verificado en código:

- el controlador solo desestructura `const { nombre, mensaje } = req.body;`
- luego usa `programada`, `fecha_envio` y `descripcion` sin declararlas

Esto deja una inconsistencia funcional fuerte:

- si la ejecución alcanza esas líneas, el código puede fallar por `ReferenceError`

Además, el `UPDATE` asume columnas no verificadas en el schema base:

- `descripcion`
- `programada`
- `fecha_envio`
- `fecha_actualizacion`

Validaciones actuales:

- `nombre` obligatorio
- `mensaje` obligatorio
- la campaña debe existir y pertenecer al cliente salvo admin
- no se puede editar si ya tiene envíos `enviado`
- no se puede editar si el estado está en `activa`, `completada`, `pausada`
- si `programada` es truthy, exige `fecha_envio` válido

Estado forzado tras edición:

- `pendiente_aprobacion`

Soporte explícito de `channel`:

- no existe

#### `DELETE /api/sender/campaigns/:id`

Validación actual:

- bloquea eliminación si existen registros en `ll_envios_whatsapp` para esa campaña

Dependencia directa:

- `ll_envios_whatsapp`

Esto confirma que la campaña está modelada como padre directo de envíos WhatsApp.

#### `POST /api/sender/campaigns/:id/approve`

Validaciones actuales:

- requiere usuario admin
- la campaña debe existir
- exige que `estado === 'pendiente'`

Persistencia real:

- actualiza `estado` a `en_progreso`

Inconsistencias verificadas:

- `create` devuelve campañas con estado `pendiente_aprobacion`
- `approve` solo acepta `pendiente`
- el response de `approve` informa `estadoNuevo: 'aprobada'`, pero la base se actualiza a `en_progreso`

Esto deja una desalineación concreta entre:

- estado retornado por creación
- estado esperado por aprobación
- estado persistido al aprobar
- estado interpretado por el frontend

### 5. Programaciones

Archivos:

- `services/central-hub/src/modules/sender/routes/programaciones.js`
- `services/central-hub/src/modules/sender/controllers/programacionesController.js`
- `services/central-hub/frontend/src/components/campaigns/ProgramacionesForm.jsx`
- `services/central-hub/frontend/src/components/campaigns/ProgramacionesList.jsx`

Rutas efectivamente implementadas:

- `GET /api/sender/programaciones`
- `POST /api/sender/programaciones`

Rutas declaradas por frontend pero no verificadas en backend:

- `PUT /api/sender/programaciones/:id`
- `DELETE /api/sender/programaciones/:id`

Payload esperado para crear programación:

- `campania_id`
- `dias_semana`
- `hora_inicio`
- `hora_fin`
- `cupo_diario`
- `fecha_inicio`
- `fecha_fin`
- `comentario`

Validaciones actuales:

- `cliente_id` resoluble desde sesión/JWT o enviado por body según rol
- `campania_id`, `hora_inicio`, `hora_fin`, `fecha_inicio` obligatorios
- `dias_semana` debe contener al menos un día válido
- la campaña debe pertenecer al cliente

Persistencia real:

- inserta en `ll_programaciones`
- valida pertenencia de `campania_id` contra `ll_campanias_whatsapp`

Soporte explícito de `channel`:

- no existe

## D. Persistencia / tablas / migraciones

### 1. Tabla principal de campañas

Archivo relevado:

- `services/central-hub/schema.sql`

Definición visible en repo para `ll_campanias_whatsapp`:

- `id`
- `nombre`
- `mensaje`
- `fecha_creacion`
- `estado` con enum `('pendiente','en_progreso','finalizado')`
- `cliente_id`

No aparecen en ese schema base las siguientes columnas, aunque el código las usa o las devuelve:

- `descripcion`
- `programada`
- `fecha_envio`
- `fecha_actualizacion`

### 2. Tabla de programaciones

Tabla:

- `ll_programaciones`

Vinculación:

- `campania_id` FK a `ll_campanias_whatsapp.id`

Campos relevantes:

- `dias_semana`
- `hora_inicio`
- `hora_fin`
- `cupo_diario`
- `fecha_inicio`
- `fecha_fin`
- `estado`
- `comentario_cliente`
- `comentario_admin`
- `sesion_cliente`

La programación también está modelada para campañas WhatsApp, porque depende de la misma tabla base.

### 3. Tabla de envíos de campaña

Tabla:

- `ll_envios_whatsapp`

Campos principales:

- `campania_id`
- `telefono_wapp`
- `nombre_destino`
- `mensaje_final`
- `estado`
- `fecha_envio`
- `message_id`
- `lugar_id`

Este diseño confirma que la campaña actual está directamente acoplada a un envío con:

- teléfono WhatsApp
- mensaje final de WhatsApp
- estado de envío WhatsApp

### 4. Historial de estados

Tabla:

- `ll_envios_whatsapp_historial`

Se usa para trazabilidad de cambios de estado en envíos WhatsApp.

### 5. Migraciones relevadas

Migración relevante observada:

- `services/central-hub/migrations/002_create_ll_envios_manual.sql`

Esta migración pertenece al flujo manual de Web WhatsApp y no agrega soporte por canal a campañas.

### 6. Soporte explícito a canal en persistencia

Resultado del relevamiento repo-side verificable:

- no se encontró una columna `channel`, `canal`, `campaign_type`, `tipo_campania` o equivalente en la tabla principal de campañas visible en el repo
- no se encontró una tabla paralela tipo `ll_campanias_email`
- no se encontró una migración SQL en el árbol relevado que formalice campañas por canal

### 7. Inconsistencia schema vs código

Hay una inconsistencia técnica concreta entre:

- el `schema.sql` visible en el repo
- el `campaignsController.js`
- cierta documentación interna de campañas

El código de creación y edición ya asume una campaña más rica que la tabla mínima visible en `schema.sql`, pero no apareció en el relevamiento una migración repo-side que cierre esa diferencia.

Por lo tanto, el estado verificable del repositorio es:

- persistencia formal actual visible: WhatsApp-only y mínima
- código backend: asume columnas adicionales no verificadas en ese schema base

## E. Flujo actual de creación de campaña

El flujo actual de creación de campaña puede describirse así:

1. El usuario navega a `/campaigns`.
2. `CampaignsManager` carga campañas con `GET /api/sender/campaigns`.
3. El usuario abre `+ Nueva Campaña`.
4. El modal embebido recolecta `nombre`, `descripcion`, `mensaje`, `programada`, `fecha_envio`.
5. `handleSaveCampaign()` envía `formData` a `senderAPI.createCampaign(formData)`.
6. El backend `campaignsController.create` valida `nombre` y `mensaje`, y valida fecha si `programada`.
7. El backend inserta solo `nombre`, `mensaje`, `cliente_id`, `estado`, `fecha_creacion` en `ll_campanias_whatsapp`.
8. El frontend cierra el modal y vuelve a cargar la lista.

Observaciones técnicas del flujo actual:

- `descripcion`, `programada` y `fecha_envio` forman parte del formulario, pero no del `INSERT` real verificado
- el flujo no contempla `channel`
- el contenido de campaña es un único campo `mensaje`
- la campaña creada queda pensada para alimentar `ll_envios_whatsapp`

## F. Acoplamientos duros a WhatsApp

El relevamiento arroja múltiples acoplamientos explícitos a WhatsApp.

### 1. Nombres de tabla y modelo

- `ll_campanias_whatsapp`
- `ll_envios_whatsapp`
- `ll_envios_whatsapp_historial`

### 2. Nombres de controladores y comentarios

- `campaignsController.js` se presenta como `Controlador de Campañas WhatsApp`
- `estadoService.js` se presenta como `Servicio de gestión de estados de envíos WhatsApp`
- `programacionScheduler.js` verifica disponibilidad del Session Manager y estado de WhatsApp antes de procesar pendientes

### 3. Payload y campos de contenido

- el formulario de campaña usa `mensaje`
- los destinatarios insertan `telefono_wapp`
- `destinatariosController` genera `mensaje_final` desde `campania.mensaje`
- `enviosController.prepareManual` renderiza `mensaje_final` y abre Web WhatsApp

### 4. Notas y copy de UI

En `CampaignsManager.jsx`:

- `Administra tus envíos masivos de WhatsApp`
- `Los mensajes se enviarán solo a los leads con IA habilitada`

En la grilla de destinatarios y prospectos:

- la acción operativa visible es `Web WhatsApp`
- el flujo manual abre `https://web.whatsapp.com/send?...`

### 5. Lógica de envío

Archivos relevantes:

- `services/central-hub/src/modules/sender/controllers/destinatariosController.js`
- `services/central-hub/src/modules/sender/controllers/enviosController.js`
- `services/central-hub/src/modules/sender/services/estadoService.js`
- `services/central-hub/src/modules/sender/services/programacionScheduler.js`

Supuestos hardcodeados:

- cada campaña genera registros en `ll_envios_whatsapp`
- el envío se resuelve sobre `telefono_wapp`
- el scheduler consulta estado de sesión WhatsApp antes de operar
- la máquina de estados aplicada es la de envíos WhatsApp

### 6. Filtros de destinatarios y prospectos

Archivos:

- `services/central-hub/src/modules/sender/controllers/prospectosController.js`
- `services/central-hub/frontend/src/components/destinatarios/GestionDestinatariosPage.jsx`

Acoplamientos verificados:

- la selección base de prospectos se ancla a una campaña existente en `ll_campanias_whatsapp`
- el estado por campaña se obtiene por `LEFT JOIN ll_envios_whatsapp`
- la agregación de destinatarios inserta en `ll_envios_whatsapp`
- la preparación manual de envío opera sobre `mensaje_final` y `telefono_wapp`

Conclusión de esta sección:

- hoy no hay un acoplamiento incidental a WhatsApp
- hay un acoplamiento estructural de dominio, persistencia, UI y operación

## G. Capacidades ya existentes para Email

### 1. Frontend Email ya existente

Archivos:

- `services/central-hub/frontend/src/components/destinatarios/EmailCampaignFormModal.jsx`
- `services/central-hub/frontend/src/services/email.js`
- `services/central-hub/frontend/src/components/destinatarios/GestionDestinatariosPage.jsx`

Capacidades verificadas:

- modal específico para preparar envío Email sobre selección común de prospectos
- validación de destinatarios con email válido
- ingreso manual de `subject` y `text`
- fan-out por destinatario válido
- uso de `/mailer/send` por cada destinatario

Limitación actual:

- no crea ni usa una campaña Email persistida en el módulo de campañas
- no usa contenido predefinido de campaña
- no vincula el envío al dominio `campaigns`

### 2. Backend Email ya existente en `central-hub`

Archivos:

- `services/central-hub/src/modules/email/controllers/email.controller.js`
- `services/central-hub/src/modules/email/services/email.service.js`
- `services/central-hub/src/modules/email/validators/sendEmail.validator.js`
- `services/central-hub/src/modules/email/routes/index.js`
- `services/central-hub/src/index.js`

Rutas existentes:

- `POST /api/email/send`
- `POST /mailer/send`

Observación relevante:

- el frontend de Email hoy usa `/mailer/send`
- `/api/email/send` existe como ruta adicional del módulo email, pero no es la utilizada por `emailService` del frontend relevado

Payload aceptado por la validación del hub:

- `to`
- `subject`
- `text` o `html`
- opcionales: `campaign_id`, `contact_id`, `from_email`, `from_name`, `reply_to`, `metadata`

Dato clave para campañas:

- el validador acepta `campaign_id` como opcional
- el frontend actual de Email no lo envía
- por lo tanto, hoy no hay integración efectiva entre Email y el modelo de campañas del sender

### 3. Mailer standalone

Archivos:

- `services/mailer/src/routes/mailerRoutes.js`
- `services/mailer/src/controllers/mailerController.js`
- `services/mailer/src/validators/sendValidator.js`
- `services/mailer/src/services/mailerService.js`
- `services/mailer/src/repositories/emailLogRepository.js`
- `services/mailer/src/repositories/clientEmailConfigRepository.js`

Capacidades verificadas:

- `POST /send`
- validación de `cliente_id`, `to`, `subject`, `text|html`
- resolución SMTP por `cliente_id`
- lookup en `ll_clientes_email_config`
- auditoría en `ll_envios_email`

### 4. Qué ya es reutilizable para campañas Email

Piezas reutilizables existentes:

- transporte Email
- validación del payload Email
- resolución multi-tenant SMTP
- auditoría técnica de emails
- modal UI para preparación manual de Email
- helpers de validación de email en frontend

### 5. Qué no está conectado todavía al módulo de campañas

No se verificó en el código actual:

- campaña Email persistida en una tabla de campañas del sender
- selector de canal en creación de campaña
- contenido de campaña Email guardado desde el módulo de campañas
- vinculación automática entre campaña y envío Email
- listado o edición de campañas Email dentro de `CampaignsManager`

## H. Riesgos de implementación

### 1. Riesgo de romper edición actual

El endpoint `PUT /api/sender/campaigns/:id` ya está técnicamente inestable porque mezcla:

- variables no desestructuradas
- columnas no verificadas en `schema.sql`
- estados inconsistentes

Eso lo convierte en un punto delicado antes de sumar soporte por canal.

### 2. Riesgo de asumir un schema que el repo no garantiza

El código asume columnas que no aparecen en el schema base visible del servicio. Si se implementa soporte por canal sin primero consolidar el contrato real de persistencia, se corre el riesgo de trabajar sobre un modelo de base implícito o incompleto.

### 3. Riesgo de extender un componente frontend demasiado acoplado

`CampaignsManager.jsx` concentra:

- listado
- métricas
- creación
- edición
- detalle
- confirmación de envío
- destinatarios
- programación

Agregar soporte por canal directamente sobre esa estructura sin extracción previa eleva el riesgo de regresiones.

### 4. Riesgo de inconsistencia de estados

La lógica de estados actual ya está desalineada entre:

- backend
- frontend
- tests
- documentación interna histórica

Si se incorpora `Email` sin normalizar primero esa matriz, el problema de estados se amplifica.

### 5. Riesgo de duplicar modelos paralelos

Como ya existe infraestructura Email fuera del módulo de campañas, una implementación apresurada podría terminar creando:

- un flujo de campañas WhatsApp en `sender`
- un flujo Email paralelo fuera de `sender`

Eso dejaría dos modelos de operación conviviendo sin integración de dominio.

## I. Orden recomendado de intervención

El siguiente orden surge del estado real relevado, no de una propuesta de arquitectura nueva.

1. Confirmar y consolidar el modelo real de persistencia de campañas.
2. Corregir la inconsistencia backend actual de `update` y la matriz de estados de campañas.
3. Delimitar el contrato real de `CampaignsManager` y extraer el formulario de campaña a un componente reutilizable.
4. Introducir la tipificación de campaña por canal en el punto de creación y edición.
5. Recién después conectar el canal Email existente al dominio de campañas.
6. En paralelo, eliminar o marcar explícitamente los endpoints declarados en frontend que hoy no tienen backend real.

La prioridad técnica no es agregar UI primero, sino evitar que la ampliación de dominio se apoye sobre una base inconsistente.

## J. Lista priorizada de archivos a revisar/modificar

### Prioridad 1

- `services/central-hub/src/modules/sender/controllers/campaignsController.js`
- `services/central-hub/schema.sql`

Razón:

- definen el contrato backend y la persistencia efectiva del módulo
- hoy ya presentan inconsistencias verificadas

### Prioridad 2

- `services/central-hub/frontend/src/components/campaigns/CampaignsManager.jsx`
- `services/central-hub/frontend/src/services/api.js`
- `services/central-hub/frontend/src/services/campanas.js`

Razón:

- concentran el formulario actual, el estado local y la declaración de endpoints
- hoy no separan creación/edición por canal

### Prioridad 3

- `services/central-hub/src/modules/sender/routes/campaigns.js`
- `services/central-hub/src/modules/sender/routes/index.js`
- `services/central-hub/src/modules/sender/controllers/programacionesController.js`
- `services/central-hub/src/modules/sender/routes/programaciones.js`

Razón:

- determinan el contrato de campañas y de programación actualmente vigente

### Prioridad 4

- `services/central-hub/src/modules/sender/controllers/destinatariosController.js`
- `services/central-hub/src/modules/sender/controllers/prospectosController.js`
- `services/central-hub/src/modules/sender/controllers/enviosController.js`
- `services/central-hub/src/modules/sender/services/estadoService.js`
- `services/central-hub/src/modules/sender/services/programacionScheduler.js`

Razón:

- concentran el acoplamiento operativo a WhatsApp y la ejecución real de campaña

### Prioridad 5

- `services/central-hub/frontend/src/components/destinatarios/GestionDestinatariosPage.jsx`
- `services/central-hub/frontend/src/components/destinatarios/EmailCampaignFormModal.jsx`
- `services/central-hub/frontend/src/services/email.js`
- `services/central-hub/src/modules/email/controllers/email.controller.js`
- `services/central-hub/src/modules/email/services/email.service.js`
- `services/central-hub/src/modules/email/validators/sendEmail.validator.js`
- `services/mailer/src/services/mailerService.js`
- `services/mailer/src/repositories/emailLogRepository.js`
- `services/mailer/src/repositories/clientEmailConfigRepository.js`

Razón:

- son las piezas ya existentes para Email que podrían integrarse más adelante al dominio de campañas

## K. Mapa de impacto mínimo para implementar campañas por canal

Esta sección propone el mapa de impacto mínimo para incorporar soporte de campañas por canal (`WhatsApp` + `Email`) reutilizando al máximo el formulario actual de campañas y evitando un rediseño amplio del módulo.

El criterio usado para definir este mapa es el siguiente:

- conservar `CampaignsManager.jsx` como pantalla principal inicial
- evitar introducir una nueva familia de pantallas para Email en esta primera intervención
- mantener la tabla actual de campañas como ancla inicial del módulo, en lugar de abrir de entrada un modelo paralelo
- tocar primero el contrato mínimo de campaña, listado, creación y edición
- postergar cambios profundos en destinatarios, scheduler y envío masivo hasta que exista tipificación de canal en la campaña

### 1. Lista mínima de archivos a modificar

Lista mínima propuesta:

- `services/central-hub/schema.sql`
- `services/central-hub/src/modules/sender/controllers/campaignsController.js`
- `services/central-hub/src/modules/sender/routes/campaigns.js`
- `services/central-hub/frontend/src/components/campaigns/CampaignsManager.jsx`
- `services/central-hub/frontend/src/services/api.js`
- `services/central-hub/frontend/src/services/campanas.js`

Lista mínima recomendada si se quiere dejar el soporte Email mínimamente conectado al dominio campaña desde el primer corte:

- `services/central-hub/src/modules/email/validators/sendEmail.validator.js`
- `services/central-hub/frontend/src/components/destinatarios/EmailCampaignFormModal.jsx`
- `services/central-hub/frontend/src/services/email.js`

Archivos que conviene no tocar en el primer paso si el objetivo es minimizar riesgo:

- `services/central-hub/src/modules/sender/controllers/destinatariosController.js`
- `services/central-hub/src/modules/sender/controllers/enviosController.js`
- `services/central-hub/src/modules/sender/services/programacionScheduler.js`
- `services/central-hub/src/modules/sender/services/estadoService.js`
- `services/mailer/src/services/mailerService.js`

La razón es simple: esos archivos son los que más acoplan campaña con ejecución real de WhatsApp, y no hace falta abrirlos para el primer corte si primero se resuelve la tipificación de campaña y el contrato del formulario.

### 2. Qué se cambia en cada archivo

#### `services/central-hub/schema.sql`

Cambio mínimo propuesto:

- agregar a la tabla de campañas un campo común de tipificación de canal, por ejemplo `channel` o `canal`
- agregar los campos mínimos necesarios para que la campaña Email tenga contenido propio sin destruir el modelo actual de WhatsApp
- regularizar, si corresponde, las columnas que el código ya asume hoy y el schema base no muestra, como `descripcion`, `programada`, `fecha_envio` y `fecha_actualizacion`

Objetivo del cambio:

- alinear schema y código actual
- introducir el discriminador de canal en el nivel de persistencia
- evitar crear desde el inicio una tabla paralela solo para Email si el objetivo inmediato es impacto mínimo

#### `services/central-hub/src/modules/sender/controllers/campaignsController.js`

Cambio mínimo propuesto:

- corregir primero la inconsistencia actual de `update` para que no use variables no desestructuradas
- hacer que `list`, `detail`, `create` y `update` lean y escriban el campo de canal
- mantener compatibilidad con campañas existentes asumiendo `WhatsApp` por defecto donde no haya dato explícito
- conservar el flujo actual de campañas WhatsApp sin alterar su semántica de envío en este primer corte
- permitir que una campaña Email persista asunto y cuerpo propios del canal

Objetivo del cambio:

- convertir al controlador actual en un controlador de campañas tipificadas por canal, sin abrir todavía una nueva arquitectura backend

#### `services/central-hub/src/modules/sender/routes/campaigns.js`

Cambio mínimo propuesto:

- no necesariamente requiere nuevas rutas en el primer paso
- sí conviene revisar si el contrato de `create` y `update` necesita aceptar payload enriquecido por canal
- si se decidiera exponer una validación o preview específica, hacerlo después del primer corte, no antes

Objetivo del cambio:

- mantener el mismo set de endpoints para minimizar impacto sobre frontend

#### `services/central-hub/frontend/src/components/campaigns/CampaignsManager.jsx`

Cambio mínimo propuesto:

- reutilizar el formulario actual en lugar de reemplazarlo
- agregar un selector de canal al `formData`
- hacer render condicional de los campos de contenido según canal
- mantener los campos actuales para WhatsApp casi sin cambios
- para Email, mostrar campos equivalentes al contenido de ese canal, por ejemplo asunto y cuerpo
- ajustar copy de pantalla y del modal para dejar de presentar el módulo como exclusivamente WhatsApp
- no tocar todavía la mecánica de envío real desde este componente, salvo para bloquear o diferenciar acciones incompatibles con el canal

Objetivo del cambio:

- aprovechar la UI existente como base común
- introducir la tipificación de campaña donde hoy ya se crea y edita la campaña
- minimizar superficie de cambio visual y de comportamiento

#### `services/central-hub/frontend/src/services/api.js`

Cambio mínimo propuesto:

- probablemente no requiera cambios de rutas si se conserva el mismo contrato HTTP de campañas
- sí conviene revisar y eventualmente documentar qué endpoints declarados no están implementados aún

Objetivo del cambio:

- evitar que el frontend siga aparentando capacidades que el backend no soporta

#### `services/central-hub/frontend/src/services/campanas.js`

Cambio mínimo propuesto:

- mantener los mismos métodos
- adaptar shape de payload y lectura de respuesta para incluir `channel` y contenido por canal

Objetivo del cambio:

- encapsular el nuevo contrato mínimo sin dispersar cambios en toda la UI

#### `services/central-hub/src/modules/email/validators/sendEmail.validator.js`

Cambio mínimo propuesto:

- no es imprescindible en el primer corte si Email sigue enviándose como mecanismo técnico separado
- sí conviene revisar este archivo si se quiere empezar a propagar el `campaign_id` de una campaña Email real hacia el gateway

Objetivo del cambio:

- preparar la integración futura entre campaña Email persistida y envío Email real

#### `services/central-hub/frontend/src/components/destinatarios/EmailCampaignFormModal.jsx`

Cambio mínimo propuesto:

- evitar que siga siendo estrictamente un formulario de composición libre desvinculado del dominio campaña
- en un segundo paso corto, permitir que, si existe campaña Email seleccionada, tome asunto y cuerpo desde la campaña en lugar de pedirlos siempre manualmente

Objetivo del cambio:

- aprovechar el modal existente como puente transitorio, en vez de abrir una nueva UI específica desde cero

#### `services/central-hub/frontend/src/services/email.js`

Cambio mínimo propuesto:

- mantener el transporte actual
- cuando exista campaña Email persistida, adjuntar `campaign_id` al payload si se decide empezar a trazar la relación campaña-envío

Objetivo del cambio:

- reutilizar infraestructura ya operativa sin reescribir el flujo de transporte

### 3. Qué cambios son de modelo común y cuáles específicos de Email

#### Cambios de modelo común

Corresponden al dominio `campaña` independientemente del canal.

Cambios comunes mínimos:

- tipificación de campaña por canal
- normalización del contrato `create/update/list/detail`
- corrección de inconsistencias actuales entre schema y controlador
- reutilización del mismo formulario con render condicional según canal
- revisión de estados para que no dependan de un supuesto exclusivamente WhatsApp en la capa de definición de campaña

Archivos principalmente afectados por cambios comunes:

- `schema.sql`
- `campaignsController.js`
- `CampaignsManager.jsx`
- `campanas.js`

#### Cambios específicos de Email

Corresponden a aquello que no puede modelarse como campaña común porque depende del contenido o transporte del canal Email.

Cambios específicos mínimos de Email:

- definir en la campaña Email los campos de contenido propios del canal
- hacer que la UI muestre esos campos solo cuando `channel = Email`
- permitir que el transporte Email conozca, cuando corresponda, el `campaign_id`
- desacoplar gradualmente el modal Email de la composición completamente libre

Archivos principalmente afectados por cambios específicos de Email:

- `CampaignsManager.jsx`
- `sendEmail.validator.js`
- `EmailCampaignFormModal.jsx`
- `email.js`

#### Cambios que deben permanecer específicos de WhatsApp

Para minimizar impacto, en el primer corte deberían seguir intactos:

- construcción de destinatarios en `ll_envios_whatsapp`
- scheduler de campañas WhatsApp
- machine states de envíos WhatsApp
- flujo de `Web WhatsApp`

Esto reduce el alcance inicial y evita mezclar, en el mismo paso, definición de campaña con ejecución de canal.

### 4. Qué riesgo tiene cada cambio

#### Cambio en `schema.sql`

Riesgo:

- alto

Motivo:

- cualquier cambio en persistencia impacta CRUD, tests y compatibilidad con campañas existentes
- además hoy ya hay divergencia entre código y schema base visible

Mitigación:

- introducir cambios aditivos y compatibilidad por defecto para campañas existentes
- no eliminar ni renombrar de entrada columnas ni tablas actuales

#### Cambio en `campaignsController.js`

Riesgo:

- alto

Motivo:

- es el centro del contrato real del módulo
- ya contiene inconsistencias de variables y estados
- cualquier ampliación sin corregir primero esos puntos puede empeorar el comportamiento existente

Mitigación:

- separar el trabajo en dos pasos: primero saneamiento actual, luego soporte por canal

#### Cambio en `CampaignsManager.jsx`

Riesgo:

- medio-alto

Motivo:

- es un componente muy cargado y con múltiples modales y acciones
- tocar el formulario dentro del mismo archivo puede generar regresiones de UI

Mitigación:

- conservar estructura actual
- limitar el primer cambio a agregar selector de canal y render condicional de campos
- no reescribir todavía la pantalla completa

#### Cambio en `campanas.js` y `api.js`

Riesgo:

- bajo

Motivo:

- son capas delgadas de acceso HTTP
- el riesgo principal es más de desalineación de contrato que de complejidad interna

Mitigación:

- mantener mismas rutas y adaptar únicamente el shape del payload

#### Cambio en `EmailCampaignFormModal.jsx`

Riesgo:

- medio

Motivo:

- es una UI operativa ya usable para pruebas técnicas
- si se fuerza demasiado rápido a dejar de componer manualmente, puede romper la operatoria transitoria existente

Mitigación:

- hacer primero una integración optativa o condicional con campañas Email
- no eliminar de entrada la operatoria manual si todavía se usa como fallback técnico

#### Cambio en `email.js` y validadores Email

Riesgo:

- bajo-medio

Motivo:

- el transporte Email ya funciona
- el riesgo está en no romper compatibilidad con el fan-out actual

Mitigación:

- mantener `to`, `subject`, `text|html` como contrato principal
- agregar `campaign_id` solo como enriquecimiento compatible

### 5. Cuál sería el primer paso seguro para empezar

El primer paso seguro no es agregar campos de Email en la UI todavía.

El primer paso seguro es:

- sanear el contrato actual de campañas en backend y persistencia mínima antes de extender el formulario

Concretamente, el primer paso recomendado es este:

1. revisar y corregir `services/central-hub/src/modules/sender/controllers/campaignsController.js`
2. definir el shape mínimo común de campaña que el backend sí va a soportar de forma consistente
3. alinear ese shape con `services/central-hub/schema.sql`
4. recién después propagar ese contrato al formulario de `CampaignsManager.jsx`

Si hay que reducirlo a una sola acción inicial, la más segura es:

- corregir `campaignsController.update` y formalizar el contrato real de campaña antes de tocar la UI

La razón es técnica:

- hoy el backend ya es inconsistente sin necesidad de introducir canales
- si primero se corrige esa base, el soporte por canal puede incorporarse como una extensión del contrato y no como una mutación sobre una base defectuosa

### 6. Secuencia mínima recomendada

Secuencia mínima de intervención con el menor impacto posible:

1. sanear `campaignsController.js`
2. alinear `schema.sql` con el contrato mínimo real de campaña
3. agregar `channel` al modelo de campaña
4. adaptar `CampaignsManager.jsx` para reutilizar el formulario actual con selector de canal
5. agregar campos de contenido específicos de Email solo en el formulario cuando `channel = Email`
6. dejar intacto el flujo real de ejecución WhatsApp en este primer corte
7. conectar en un segundo corte corto el `campaign_id` al flujo Email existente

## Conclusión

El estado actual del repositorio muestra un módulo de campañas funcionalmente orientado a WhatsApp, con soporte Email disponible como infraestructura separada pero todavía no integrada al módulo de campañas.

El formulario de `Nueva Campaña` actual no es un formulario por canal. Es un formulario único, embebido y semánticamente diseñado para campañas de WhatsApp.

La persistencia visible sigue anclada a `ll_campanias_whatsapp`, sin soporte explícito a `channel`. A su vez, el backend ya presenta inconsistencias reales entre código, schema y frontend, por lo que la base actual requiere consolidación antes de extender el dominio.

En términos prácticos, hoy el repositorio ya ofrece piezas suficientes para construir campañas Email, pero no dentro del módulo de campañas tal como está implementado. Lo que existe hoy es:

- módulo de campañas WhatsApp
- flujo operativo WhatsApp con destinatarios, scheduler y envíos
- infraestructura Email reutilizable separada

La brecha principal no es de transporte Email, sino de integración de dominio entre `campaigns` y `email`, sobre una base que actualmente sigue acoplada a WhatsApp.