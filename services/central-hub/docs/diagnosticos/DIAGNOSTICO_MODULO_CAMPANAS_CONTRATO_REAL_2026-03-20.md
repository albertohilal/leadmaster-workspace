# DIAGNOSTICO - Modulo de campanas: contrato real actual

## Fecha

2026-03-20

## Destino

services/central-hub/docs/diagnosticos/DIAGNOSTICO_MODULO_CAMPANAS_CONTRATO_REAL_2026-03-20.md

## Alcance

Este documento ejecuta la Fase 2 del plan de intervencion definido para campanas por canal.

El relevamiento se limita a los siguientes archivos foco, sin modificar codigo ni proponer implementacion:

- services/central-hub/src/modules/sender/controllers/campaignsController.js
- services/central-hub/src/modules/sender/routes/campaigns.js
- services/central-hub/schema.sql
- services/central-hub/frontend/src/components/campaigns/CampaignsManager.jsx
- services/central-hub/frontend/src/services/api.js
- services/central-hub/frontend/src/services/campanas.js

## Alineamiento arquitectonico posterior

Los hallazgos facticos de este diagnostico se mantienen vigentes.

Sin embargo, la lectura estrategica de este documento debe quedar alineada con:

- `services/central-hub/docs/planificacion/REVISION_ARQUITECTONICA_CAMPANAS_INDEPENDIENTES_2026-03-21.md`

Desde esa revision:

- este diagnostico debe leerse como diagnostico del dominio campañas WhatsApp hoy implementado
- la especializacion de `ll_campanias_whatsapp` se considera un hecho a preservar, no una base a genericizar
- cualquier hipotesis de campaña comun multicanal con persistencia compartida queda superada para esta intervencion

## Resumen ejecutivo

El contrato real actual de campana no surge de un unico punto consistente, sino de la combinacion de:

- un controlador backend orientado explicitamente a campanas WhatsApp
- un schema visible que define una tabla minima `ll_campanias_whatsapp`
- una UI que asume campos y estados adicionales
- servicios frontend que declaran endpoints no implementados en el router real

La desalineacion mas fuerte aparece en cuatro planos simultaneos:

1. el backend `create` y `update` leen un request mas rico que el que la persistencia visible soporta
2. el backend responde con campos y estados que no quedan verificados en la tabla visible
3. `approve` exige un estado distinto del que `create` devuelve
4. el frontend opera con una matriz de estados mas amplia que la que el schema visible formaliza

Este diagnostico conserva valor precisamente porque muestra que el dominio hoy activo ya es especializado en WhatsApp y que la tabla `ll_campanias_whatsapp` no debe interpretarse como una campaña comun multicanal.


## 1. Resumen por archivo

### 1.1 services/central-hub/src/modules/sender/controllers/campaignsController.js

#### Responsabilidad actual

Controlador principal del CRUD de campanas bajo el modulo `sender`.

El propio archivo se presenta como `Controlador de Campañas WhatsApp` y ejecuta SQL directo contra `ll_campanias_whatsapp` y `ll_envios_whatsapp`.

#### Funciones principales

- `exports.list`
- `exports.detail`
- `exports.update`
- `exports.remove`
- `exports.create`
- `exports.approve`

#### Dependencias relevantes

- `../../../config/db`
- tabla `ll_campanias_whatsapp`
- tabla `ll_envios_whatsapp`
- `req.user.cliente_id`
- `req.user.tipo`
- `req.user.usuario`

#### Acoplamientos visibles con WhatsApp

- comentario inicial del archivo: `Controlador de Campañas WhatsApp`
- `list`, `detail`, `create`, `update`, `approve` y `remove` operan sobre `ll_campanias_whatsapp`
- `update` y `remove` consultan o bloquean segun `ll_envios_whatsapp`
- la restriccion de edicion depende de mensajes ya enviados en `ll_envios_whatsapp`

#### Inconsistencias detectadas

- `update` desestructura solo `nombre` y `mensaje`, pero luego usa `descripcion`, `programada` y `fecha_envio` sin declararlas
- `update` asume columnas `descripcion`, `programada`, `fecha_envio` y `fecha_actualizacion` no verificadas en el `schema.sql` visible
- `create` inserta `estado = 'pendiente_aprobacion'`, aunque el schema visible de `ll_campanias_whatsapp` no incluye ese valor en el enum
- `approve` exige `estado === 'pendiente'`, por lo que queda desalineado con `create`
- `approve` actualiza base a `en_progreso`, pero responde `estadoNuevo: 'aprobada'`
- `list` y `detail` devuelven artificialmente `descripcion`, `programada` y `fecha_envio` por compatibilidad de frontend, aunque no surgen del `SELECT`

### 1.2 services/central-hub/src/modules/sender/routes/campaigns.js

#### Responsabilidad actual

Router del modulo de campanas expuesto bajo `/api/sender/campaigns`.

#### Funciones principales

Mapea rutas hacia el controlador:

- `GET /` -> `list`
- `POST /` -> `create`
- `POST /:id/approve` -> `approve`
- `GET /:id` -> `detail`
- `PUT /:id` -> `update`
- `DELETE /:id` -> `remove`

#### Dependencias relevantes

- `express`
- `../controllers/campaignsController`

#### Acoplamientos visibles con WhatsApp

No declara nomenclatura WhatsApp en el nombre de las rutas, pero queda acoplado indirectamente porque todo el controlador subyacente opera contra `ll_campanias_whatsapp`.

#### Inconsistencias detectadas

- el router real no implementa:
  - `GET /:id/stats`
  - `POST /:id/send`
  - `POST /:id/pause`
  - `POST /:id/resume`
- esos endpoints si aparecen declarados en frontend

### 1.3 services/central-hub/schema.sql

#### Responsabilidad actual

Define el schema visible usado para bootstrap y FKs basicas del servicio.

#### Definiciones principales relevantes a campanas

- `ll_campanias_whatsapp`
- `ll_programaciones`
- `ll_programacion_envios_diarios`
- `ll_envios_whatsapp`
- `ll_envios_whatsapp_historial`

#### Dependencias relevantes

- FK de `ll_programaciones.campania_id` -> `ll_campanias_whatsapp.id`
- FK de `ll_envios_whatsapp.campania_id` -> `ll_campanias_whatsapp.id`
- FK de `ll_envios_whatsapp_historial.envio_id` -> `ll_envios_whatsapp.id`

#### Acoplamientos visibles con WhatsApp

- tabla principal: `ll_campanias_whatsapp`
- tabla operativa: `ll_envios_whatsapp`
- historial: `ll_envios_whatsapp_historial`
- la programacion tambien cuelga de `ll_campanias_whatsapp`

#### Inconsistencias detectadas

- `ll_campanias_whatsapp` visible solo declara:
  - `id`
  - `nombre`
  - `mensaje`
  - `fecha_creacion`
  - `estado`
  - `cliente_id`
- el enum visible de `estado` solo admite:
  - `pendiente`
  - `en_progreso`
  - `finalizado`
- no aparecen columnas que el codigo usa o responde:
  - `descripcion`
  - `programada`
  - `fecha_envio`
  - `fecha_actualizacion`
- tampoco aparece soporte explicito a `channel`, `canal` o equivalente

### 1.4 services/central-hub/frontend/src/components/campaigns/CampaignsManager.jsx

#### Responsabilidad actual

Pantalla principal de gestion de campanas en frontend.

Concentra listado, creacion, edicion, detalles, estadisticas, confirmacion de envio, destinatarios y programaciones dentro del mismo componente.

#### Componentes y funciones principales

Estados locales principales:

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

Handlers principales:

- `loadCampaigns`
- `handleCreateCampaign`
- `handleEditCampaign`
- `handleSaveCampaign`
- `handleSaveEditCampaign`
- `handleViewStats`
- `handleViewDetails`
- `handleApproveCampaign`
- `handleViewRecipients`
- `handleSendCampaign`
- `confirmSendCampaign`
- `getStatusColor`
- `getStatusText`
- `calculateSuccessRate`

#### Dependencias relevantes

- `senderAPI`
- `destinatariosService`
- `campanasService`
- `useAuth`
- `ProgramacionesForm`
- `ProgramacionesList`
- `GestorDestinatarios`
- `Card`
- `Button`
- `LoadingSpinner`
- `Modal`

#### Acoplamientos visibles con WhatsApp

- texto para cliente: `Administra tus envíos masivos de WhatsApp`
- nota del modal de creacion: `Los mensajes se enviarán solo a los leads con IA habilitada`
- el formulario usa un unico campo `mensaje`
- no existe selector de canal
- no existe separacion de contenido por canal
- la integracion de destinatarios sigue colgando del dominio actual de campanas asociado a WhatsApp

#### Inconsistencias detectadas

- `loadCampaigns` mapea campos adicionales que la API de listado no garantiza desde persistencia real: `descripcion`, `programada`, `fecha_envio`, `total_destinatarios`, `enviados`, `fallidos`, `pendientes`
- `handleApproveCampaign` usa `campanasService.aprobarCampana`, pero luego fuerza localmente `estado: 'en_progreso'` mientras el mensaje visible al usuario habla de aprobacion
- `confirmSendCampaign` no llama a backend real; simula el envio en memoria y cambia el estado a `activa`
- el boton `Aprobar Campaña` solo aparece si `campaign.estado === 'pendiente'`
- el boton `Enviar Campaña` aparece si `campaign.estado === 'programada' || campaign.estado === 'pendiente_aprobacion'`
- la UI usa estados que no surgen del schema visible ni de la misma forma en backend: `activa`, `completada`, `programada`, `aprobada`, `pendiente_aprobacion`, `rechazada`, `pausada`, `enviando`
- el texto mostrado para `pendiente` es `Pendiente Aprobación`, lo que oculta la diferencia entre `pendiente` y `pendiente_aprobacion`
- hay debug temporal embebido en la pantalla y botones de debug/test visibles en el componente
- `handleViewStats` declara uso de mock
- `handleViewRecipients` cae a datos mock cuando falla la carga real

### 1.5 services/central-hub/frontend/src/services/api.js

#### Responsabilidad actual

Define la instancia Axios base y exporta los clientes HTTP por dominio, entre ellos `senderAPI`.

#### Funciones principales relevantes a campanas

En `senderAPI`:

- `getCampaigns`
- `getCampaign`
- `createCampaign`
- `updateCampaign`
- `deleteCampaign`
- `getCampaignStats`
- `sendCampaign`
- `pauseCampaign`
- `resumeCampaign`

Tambien define programaciones:

- `listProgramaciones`
- `createProgramacion`
- `updateProgramacion`
- `deleteProgramacion`

#### Dependencias relevantes

- `axios`
- `API_BASE_URL`
- token JWT desde `localStorage`

#### Acoplamientos visibles con WhatsApp

No nombra WhatsApp en los metodos de campanas, pero todos los endpoints de campanas cuelgan de `/sender/campaigns`, que hoy desemboca en un backend WhatsApp-only.

#### Inconsistencias detectadas

- declara endpoints de campana sin contraparte real verificada en el router:
  - `getCampaignStats`
  - `sendCampaign`
  - `pauseCampaign`
  - `resumeCampaign`
- declara endpoints de programaciones `updateProgramacion` y `deleteProgramacion` sin verificacion en el router de programaciones dentro del relevamiento actual
- la capa HTTP aparenta capacidades operativas que el router real de campanas no ofrece hoy

### 1.6 services/central-hub/frontend/src/services/campanas.js

#### Responsabilidad actual

Wrapper de acceso HTTP para operaciones de campanas consumido por la UI.

#### Funciones principales

- `obtenerCampanas`
- `obtenerCampana`
- `crearCampana`
- `actualizarCampana`
- `eliminarCampana`
- `aprobarCampana`

#### Dependencias relevantes

- `apiService` desde `./api`

#### Acoplamientos visibles con WhatsApp

No muestra nomenclatura WhatsApp en sus nombres de metodos, pero apunta al mismo dominio `/sender/campaigns` respaldado por `ll_campanias_whatsapp`.

#### Inconsistencias detectadas

- duplica parcialmente lo ya expuesto por `senderAPI`
- convive con dos capas de acceso para campanas en frontend:
  - `senderAPI` para crear, editar, listar
  - `campanasService` para aprobar
- la UI mezcla ambas capas, lo que dispersa el contrato real

## 2. Contrato real actual de campana

## 2.1 Shape real de list

### Endpoint real

`GET /api/sender/campaigns`

### Fuente verificable

`campaignsController.list`

### SELECT real

Selecciona desde `ll_campanias_whatsapp`:

- `id`
- `nombre`
- `mensaje`
- `fecha_creacion`
- `estado`
- `cliente_id`

### Response real devuelto por backend

Array de objetos con:

- `id`
- `nombre`
- `mensaje`
- `fecha_creacion`
- `estado`
- `cliente_id`
- `descripcion: ''`
- `programada: false`
- `fecha_envio: null`

### Diferencias entre persistencia y response

- `descripcion` no sale del SELECT; se agrega artificialmente
- `programada` no sale del SELECT; se agrega artificialmente
- `fecha_envio` no sale del SELECT; se agrega artificialmente
- no aparecen metricas de envio en el query real

### Diferencias entre response backend y uso frontend

`CampaignsManager` ademas asume o normaliza:

- `total_destinatarios`
- `enviados`
- `fallidos`
- `pendientes`

Esos campos no forman parte del `list` real verificado en el controlador.

## 2.2 Shape real de detail

### Endpoint real

`GET /api/sender/campaigns/:id`

### Fuente verificable

`campaignsController.detail`

### SELECT real

Selecciona desde `ll_campanias_whatsapp`:

- `id`
- `nombre`
- `mensaje`
- `fecha_creacion`
- `estado`
- `cliente_id`

Con filtro:

- `id = ?`
- `cliente_id = ?`

### Response real devuelto por backend

Objeto con:

- `id`
- `nombre`
- `mensaje`
- `fecha_creacion`
- `estado`
- `cliente_id`
- `descripcion: ''`
- `programada: false`
- `fecha_envio: null`

### Diferencias entre persistencia y response

- `descripcion`, `programada` y `fecha_envio` no surgen del SELECT real
- se agregan solo para compatibilidad frontend

## 2.3 Shape real de create

### Endpoint real

`POST /api/sender/campaigns`

### Request que el backend intenta soportar

Lee desde `req.body`:

- `nombre`
- `descripcion`
- `mensaje`
- `programada`
- `fecha_envio`

### Validaciones verificadas

- `nombre` obligatorio
- `mensaje` obligatorio
- si `programada` es truthy, `fecha_envio` debe ser parseable

### Persistencia real ejecutada

`INSERT INTO ll_campanias_whatsapp (nombre, mensaje, cliente_id, estado, fecha_creacion)`

Valores persistidos:

- `nombre.trim()`
- `mensaje.trim()`
- `cliente_id`
- `estado = 'pendiente_aprobacion'`
- `fecha_creacion = NOW()`

### Campos leidos en request pero no persistidos en el INSERT real

- `descripcion`
- `programada`
- `fecha_envio`

### Response real devuelto por backend

Objeto wrapper:

- `success: true`
- `message: 'Campaña creada exitosamente'`
- `data`:
  - `id`
  - `nombre`
  - `descripcion`
  - `mensaje`
  - `programada`
  - `fecha_envio`
  - `cliente_id`
  - `estado: 'pendiente_aprobacion'`

### Diferencias entre request, persistencia y response

- el request admite mas campos de los que el INSERT persiste
- la response devuelve `descripcion`, `programada` y `fecha_envio` aunque no quedan verificados en el INSERT visible
- la response devuelve `estado = 'pendiente_aprobacion'`, valor que no coincide con el enum visible del schema

## 2.4 Shape real de update

### Endpoint real

`PUT /api/sender/campaigns/:id`

### Request que el codigo parece querer soportar

Por estructura del metodo y del `UPDATE`, intenta manejar:

- `nombre`
- `descripcion`
- `mensaje`
- `programada`
- `fecha_envio`

### Request realmente desestructurado

Solo desestructura:

- `nombre`
- `mensaje`

### Validaciones verificadas antes del punto critico

- `nombre` obligatorio
- `mensaje` obligatorio
- la campana debe existir
- debe pertenecer al cliente salvo admin
- no puede editarse si tiene enviados en `ll_envios_whatsapp`
- no puede editarse si su estado esta en:
  - `activa`
  - `completada`
  - `pausada`

### Punto critico verificable

El metodo usa luego:

- `programada`
- `fecha_envio`
- `descripcion`

sin haberlas desestructurado de `req.body`.

Eso vuelve el `update` funcionalmente inestable.

### Persistencia que el codigo intenta ejecutar

`UPDATE ll_campanias_whatsapp SET`

- `nombre = ?`
- `descripcion = ?`
- `mensaje = ?`
- `programada = ?`
- `fecha_envio = ?`
- `estado = 'pendiente_aprobacion'`
- `fecha_actualizacion = NOW()`

### Response que intenta devolver si el update prospera

Objeto wrapper:

- `success: true`
- `message`
- `data: updatedRows[0]`
- `warnings[]`

### Diferencias entre request, persistencia y response

- el request realmente procesado no coincide con el request que el metodo intenta usar despues
- la persistencia intenta tocar columnas no verificadas en el schema visible
- la response pretende devolver la fila completa actualizada sin que el contrato de columnas este consolidado
- el estado objetivo del `update` es `pendiente_aprobacion`, valor que tampoco coincide con el enum visible del schema

## 3. Matriz real de estados

## 3.1 Estados usados en create

En `campaignsController.create`:

- al persistir: `pendiente_aprobacion`
- al responder: `pendiente_aprobacion`

## 3.2 Estados usados en approve

En `campaignsController.approve`:

- estado requerido para aprobar: `pendiente`
- estado escrito en base: `en_progreso`
- estado reportado en response: `aprobada`
- estadoAnterior informado en response: `pendiente`

## 3.3 Estados usados en update

En `campaignsController.update`:

- estados no editables: `activa`, `completada`, `pausada`
- comentario del metodo: estados editables `pendiente`, `pendiente_aprobacion`, `programada`
- estado forzado tras edicion: `pendiente_aprobacion`

## 3.4 Estados usados en frontend

En `CampaignsManager.jsx` aparecen o se interpretan estos estados:

- `activa`
- `completada`
- `finalizado`
- `programada`
- `pendiente`
- `en_progreso`
- `aprobada`
- `pendiente_aprobacion`
- `pausada`
- `rechazada`
- `enviando`

Usos verificables relevantes:

- tarjeta resumen `Activas` cuenta `estado === 'activa'`
- tarjeta resumen `Completadas` cuenta `estado === 'completada'`
- boton editar se oculta si `estado === 'completada' || estado === 'enviando'`
- boton aprobar solo aparece si `estado === 'pendiente'`
- boton enviar solo aparece si `estado === 'programada' || estado === 'pendiente_aprobacion'`
- `confirmSendCampaign` cambia localmente el estado a `activa`
- `getStatusText('pendiente')` devuelve `Pendiente Aprobación`
- `getStatusText('en_progreso')` devuelve `Aprobada`
- `getStatusText('pendiente_aprobacion')` tambien devuelve `Pendiente Aprobación`

## 3.5 Desalineaciones exactas

Desalineacion 1:

- `create` produce `pendiente_aprobacion`
- `approve` solo acepta `pendiente`

Desalineacion 2:

- `approve` escribe `en_progreso` en base
- `approve` responde `estadoNuevo: 'aprobada'`
- frontend presenta `en_progreso` como `Aprobada`

Desalineacion 3:

- el schema visible solo formaliza `pendiente`, `en_progreso`, `finalizado`
- backend y frontend usan ademas `pendiente_aprobacion`, `programada`, `activa`, `completada`, `pausada`, `rechazada`, `enviando`

Desalineacion 4:

- frontend solo muestra el boton de aprobacion si la campana esta en `pendiente`
- el backend de creacion devuelve `pendiente_aprobacion`
- por lo tanto, una campana recien creada no cae naturalmente en la condicion de aprobacion del frontend

Desalineacion 5:

- frontend muestra `Pendiente Aprobación` tanto para `pendiente` como para `pendiente_aprobacion`
- eso borra semanticamente la diferencia entre ambos estados

## 4. Persistencia real visible

## 4.1 Definicion verificable de ll_campanias_whatsapp

Definicion visible en `schema.sql`:

- `id` int auto_increment
- `nombre` varchar(255) not null
- `mensaje` text not null
- `fecha_creacion` datetime default current_timestamp()
- `estado` enum('pendiente','en_progreso','finalizado') default 'pendiente'
- `cliente_id` int(11) default null

## 4.2 Columnas existentes verificables

Columnas visibles confirmadas:

- `id`
- `nombre`
- `mensaje`
- `fecha_creacion`
- `estado`
- `cliente_id`

## 4.3 Columnas asumidas por el codigo pero no verificadas en schema.sql

En backend y frontend se asumen o usan:

- `descripcion`
- `programada`
- `fecha_envio`
- `fecha_actualizacion`

En frontend tambien se usan o esperan, aunque no surgen del contrato real de listado:

- `fecha_modificacion`
- `cliente_nombre`
- `total_destinatarios`
- `enviados`
- `fallidos`
- `pendientes`
- `activa`

## 4.4 Riesgos derivados del estado actual visible

Riesgo 1:

- el codigo backend intenta escribir estados y columnas no garantizados por el schema visible

Riesgo 2:

- el contrato HTTP expone campos que no quedan respaldados de forma verificable en persistencia visible

Riesgo 3:

- la UI puede representar estados y metricas que el backend real no entrega como parte del listado basico

Riesgo 4:

- la base visible formaliza una tabla de campanas estrictamente asociada a WhatsApp, por nombre de tabla, FKs y relacion con `ll_envios_whatsapp`

## Conclusiones verificables de la Fase 2

1. El contrato real actual de campana no es neutro ni uniforme; esta repartido entre backend, schema y frontend con divergencias visibles.
2. El backend de campanas esta acoplado estructuralmente a WhatsApp por tabla, flujo de envios y comentarios del propio controlador.
3. `create`, `update`, `approve` y el frontend no comparten una misma matriz estable de estados.
4. La persistencia visible de `ll_campanias_whatsapp` es mas pobre que el contrato que el frontend y el backend intentan usar.
5. El router real de campanas expone menos endpoints que los declarados por la capa HTTP de frontend.
