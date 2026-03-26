# INFORME TÉCNICO — CAMBIO FUNCIONAL EMAIL SIN CAMPAÑA BASE

- **Fecha:** 2026-03-25
- **Plano:** **AS-IS IMPLEMENTADO** para el estado posterior al cambio y **AS-IS PREVIO** para el diagnóstico comparativo
- **Servicio auditado y modificado:** `services/central-hub`
- **Objetivo funcional:** que la pantalla de selección de destinatarios de Campañas Email liste automáticamente el universo de prospectos del cliente autenticado, sin depender de una “Campaña base de prospectos”.

---

## 1. Resumen ejecutivo

Se localizó que la pantalla de Email no tenía implementación propia de grilla ni de fetch de prospectos: reutilizaba el mismo componente compartido que WhatsApp, pero en modo Email mantenía una dependencia artificial de `campaniaSeleccionada`.

La causa real del problema era doble:

1. en frontend, la carga de prospectos se ejecutaba sólo si había una campaña base seleccionada;
2. en backend, el endpoint existente de prospectos exigía `campania_id` como parámetro obligatorio.

Se aplicó un refactor acotado y reutilizable:

- se eliminó de la UI Email el selector **“Campaña base de prospectos”**;
- se hizo que Email cargue el universo del cliente autenticado al entrar;
- se extendió el endpoint existente `/api/sender/prospectos/filtrar` para soportar un modo sin `campania_id`;
- se corrigió la selección canónica de filas en ese modo Email para no perder emails válidos por un `MAX(rowid)` ciego;
- se corrigió además la semántica del **Estado** visual en la grilla Email para que dependa de `ll_envios_email` de la campaña seleccionada;
- se corrigió el flujo de **“Preparar envío Email”** para que, en el contexto de Campañas Email, use la campaña persistida y no un composer manual ad hoc;
- se mantuvieron sin romperse los flujos de:
  - filtros locales;
  - selección múltiple;
  - `Agregar a Campaña`;
  - `Preparar envío Email`.

---

## 2. Diagnóstico

### 2.1 Frontend involucrado

#### Pantalla Email

- Ruta real: `/email/campaigns/prospects`
- Ruta real con contexto de campaña: `/email/campaigns/:campaignId/prospects`
- Archivo: `services/central-hub/frontend/src/App.jsx`
- Componente: `services/central-hub/frontend/src/components/email/EmailCampaignProspectsPage.jsx`

`EmailCampaignProspectsPage` no renderiza una grilla propia: delega la operación al componente compartido `GestionDestinatariosPage` con props de modo Email:

- `hideHeader`
- `defaultCanalDisponibleFiltro="email"`
- `hideWhatsappActions`
- `useEmailCampaignSelector`
- `emailCampaigns`

#### Pantalla equivalente de WhatsApp

- Ruta real: `/prospectos`
- Archivo: `services/central-hub/frontend/src/App.jsx`
- Componente: `services/central-hub/frontend/src/components/destinatarios/GestionDestinatariosPage.jsx`

Conclusión: **Email y WhatsApp comparten la misma pantalla operativa real**, con comportamiento condicionado por props.

### 2.2 Servicio de fetch de prospectos

- Frontend: `services/central-hub/frontend/src/services/prospectos.js`
- Endpoint real: `GET /api/sender/prospectos/filtrar`
- Router backend: `services/central-hub/src/modules/sender/routes/prospectos.js`
- Controller backend: `services/central-hub/src/modules/sender/controllers/prospectosController.js`

### 2.3 Resolución del cliente autenticado

#### En frontend

El contexto real de autenticación está en:

- `services/central-hub/frontend/src/contexts/AuthContext.jsx`

Al verificar token en `/auth/verify`, el frontend guarda `response.data.user`, incluyendo `cliente_id` si existe.

#### En backend

El JWT se valida en:

- `services/central-hub/src/modules/auth/middleware/authMiddleware.js`

Ese middleware inyecta `req.user`, y tanto Sender como Email consumen `req.user.cliente_id` para resolver el tenant real.

### 2.4 Endpoints reales involucrados

#### Prospectos / selección

- `GET /api/sender/prospectos/filtrar`

En el ajuste final de Email, este endpoint acepta además `email_campaign_id` opcional cuando se usa el universo Email sin `campania_id`.

#### Campañas Email

- `GET /api/email/campaigns`
- `POST /api/email/campaigns/:id/recipients`
- `POST /api/email/campaigns/:id/prepare`

#### Campañas WhatsApp / destinatarios

- `POST /api/sender/destinatarios/campania/:campaniaId/agregar`

#### Flujo corregido de “Preparar envío Email”

En el contexto de Campañas Email, el flujo corregido ya no abre un composer manual. Ahora usa el endpoint real:

- `POST /api/email/campaigns/:id/prepare`

Ese endpoint:

- toma asunto/body persistidos de `ll_campanias_email`;
- opera sobre los recipients persistidos en `ll_envios_email`;
- deja la campaña en estado `pendiente`;
- agenda el primer envío para que el scheduler real continúe la cadena técnica.

El composer manual vía `/mailer/send` queda fuera de este flujo principal de campañas persistidas.

### 2.5 Causa exacta de la dependencia de “Campaña base de prospectos”

La dependencia existía porque en `GestionDestinatariosPage`:

1. la carga de prospectos se disparaba únicamente cuando `campaniaSeleccionada` tenía valor;
2. el fetch se hacía con `prospectosService.filtrarProspectos({ campania_id: campaniaSeleccionada })`;
3. la UI obligaba a elegir una “Campaña base de prospectos” para poder poblar la tabla;
4. el backend rechazaba la llamada sin `campania_id` válido.

Por eso, en Email la tabla quedaba vacía hasta elegir una campaña base, aunque el cliente tuviera prospectos válidos disponibles.

### 2.6 Diferencia real entre Email y WhatsApp antes del cambio

No había diferencia de componente base. La diferencia era de configuración:

- **WhatsApp** usaba `GestionDestinatariosPage` como pantalla principal de selección, con foco en una campaña operativa.
- **Email** reutilizaba ese mismo componente, pero mantenía un selector extra de “Campaña base de prospectos” y el mismo contrato de fetch acoplado a `campania_id`.

En síntesis:

- WhatsApp ya tenía la grilla, filtros y selección funcionando;
- Email reutilizaba esa superficie, pero su modo estaba mal acoplado a una campaña base.

---

## 3. Plan de cambio aplicado

Se aplicó el siguiente plan mínimo:

1. mantener `GestionDestinatariosPage` como pieza compartida;
2. remover únicamente la dependencia funcional de campaña base en modo Email;
3. reutilizar el endpoint existente de prospectos, ampliándolo en lugar de crear uno nuevo;
4. preservar los flujos correctos ya conectados y retirar del contexto de Campañas Email el composer manual engañoso.

No se inventaron:

- rutas nuevas de frontend;
- componentes nuevos;
- endpoints nuevos.

---

## 4. Cambios aplicados

### 4.1 Frontend — `GestionDestinatariosPage.jsx`

Archivo modificado:

- `services/central-hub/frontend/src/components/destinatarios/GestionDestinatariosPage.jsx`

#### Cambios realizados

1. **Carga inicial Email sin campaña base**
	- si `useEmailCampaignSelector` es `true`, la pantalla ahora ejecuta `cargarProspectos()` al entrar;
	- en modo WhatsApp se mantiene la carga dependiente de `campaniaSeleccionada`.


2. **Fetch de prospectos desacoplado**
   - en modo Email la llamada ya no depende de `campania_id`;
   - cuando no hay campaña Email seleccionada, el endpoint devuelve el universo Email del cliente;
   - cuando hay campaña Email seleccionada, la UI envía `email_campaign_id` para enriquecer el estado real contra `ll_envios_email`;
   - en modo WhatsApp se sigue llamando con `campania_id`.

3. **Eliminación de UI obsoleta**
	- se eliminó el dropdown **“Campaña base de prospectos”**;
	- se dejó sólo la selección de la campaña Email destino.

4. **Texto contextual actualizado**
	- se reemplazó la referencia a “base origen” por mensajes que indican que la grilla usa el universo del cliente autenticado.

5. **Corrección del flujo de preparación/envío de campaña**
	- en el contexto `useEmailCampaignSelector`, el botón **“Preparar envío Email”** ya no abre `EmailCampaignFormModal`;
	- ahora llama al endpoint real `POST /api/email/campaigns/:id/prepare`;
	- el flujo usa asunto/cuerpo/remitente/recipients persistidos de la campaña seleccionada;
	- el modal manual queda reservado para contextos manuales aislados y no para el flujo principal de Campañas Email.

#### Lo que se mantuvo intacto

- filtros por:
  - búsqueda
  - estado
  - tipo societe
  - cartera origen
  - canal disponible
- selección múltiple
- `Agregar a Campaña`
- `Preparar envío Email` como acción visible de la pantalla

#### Lo que cambió deliberadamente

- en el flujo principal de Campañas Email, `Preparar envío Email` dejó de ser un envío manual ad hoc;
- `EmailCampaignFormModal` deja de ser el flujo principal de `/email/campaigns/:campaignId/prospects`, aunque el componente manual aislado puede seguir existiendo para otros contextos.

### 4.2 Frontend — `prospectos.js`

Archivo modificado:

- `services/central-hub/frontend/src/services/prospectos.js`

#### Cambio realizado

Se dejó explícito que `campania_id` es opcional, porque en Email ahora el endpoint puede devolver el universo del cliente autenticado sin necesidad de campaña base.

### 4.3 Frontend — `email.js`

Archivo modificado:

- `services/central-hub/frontend/src/services/email.js`

#### Cambio realizado

Se agregó soporte para invocar el endpoint real de preparación de campañas persistidas:

- `prepareCampaign(campaignId, payload = {})`

Esto evita reutilizar `/mailer/send` para el flujo principal de Campañas Email.

### 4.4 Backend — `prospectosController.js`

Archivo modificado:

- `services/central-hub/src/modules/sender/controllers/prospectosController.js`

#### Cambio realizado

Se extendió el endpoint existente `GET /api/sender/prospectos/filtrar` para soportar dos modos:

##### Modo 1 — con `campania_id`

Se conserva el comportamiento previo:

- se resuelve la campaña WhatsApp;
- se limita al cliente autenticado;
- se exponen estados y envíos vinculados a esa campaña.

##### Modo 2 — sin `campania_id`

Nuevo comportamiento aplicado para Email:

- se toma el universo desde `ll_lugares_clientes` + `llxbx_societe`;
- se filtra por el cliente autenticado sin hardcode;
- se incluyen los prospectos del cliente que tengan al menos:
	- `phone_mobile` no vacío, o
	- `email` válido;
- se excluyen los registros sin teléfono y sin email válido;
- la deduplicación es híbrida:
	- si hay `phone_mobile`, la clave lógica del grupo es el teléfono;
	- si no hay teléfono, la clave lógica del grupo es `LOWER(TRIM(email))`;
- la selección canónica ya no usa sólo `MAX(rowid)` a secas;
- dentro de cada grupo deduplicado se priorizan primero las filas con email válido;
- si un grupo tiene al menos una fila con email válido, la fila visible sale de una fila con email válido;
- recién después de esa prioridad se elige una fila canónica consistente dentro del subconjunto priorizado;
- esto evita perder emails válidos cuando un `rowid` mayor corresponde a una fila peor para Email;
- el estado en este modo es neutral:
	- `estado_campania = 'sin_envio'`
	- `envio_id = null`
	- `fecha_envio = null`
- no se hereda estado ni clasificación desde WhatsApp.

##### Modo 3 — Email sin `campania_id` y con `email_campaign_id`

Cuando la UI selecciona una campaña Email concreta, el mismo endpoint devuelve el universo Email enriquecido con estado real del recipient en `ll_envios_email` para esa campaña.

Campos agregados:

- `email_envio_id`
- `email_recipient_status`
- `email_selected_at`
- `email_sent_at`
- `email_error_message`

La resolución se hace contra la identidad real usada por el módulo Email:

- `campania_email_id`
- `to_email`

usando el email normalizado del prospecto canónico.

#### Motivo del ajuste adicional

El ajuste anterior seguía siendo insuficiente para Email porque un criterio canónico puramente basado en `MAX(rowid)` podía elegir, dentro del mismo grupo lógico, una fila con peor calidad para el canal.

Ejemplo de bug corregido:

- fila A: mismo teléfono, email válido, `rowid` menor
- fila B: mismo teléfono, sin email útil, `rowid` mayor

Con `MAX(rowid)` simple podía quedar visible la fila B y perderse el email válido de la fila A.

La corrección aplicada asegura que, si dentro del grupo existe una fila con email válido, la fila devuelta para Email tenga email válido.

#### Corrección adicional de semántica del estado visual

Después de corregir el universo Email, se detectó otro bug funcional: el badge **Estado** seguía mostrando `No incluido` aunque el recipient ya existiera en `ll_envios_email` con estado real `PENDING`.

La causa era que la UI seguía leyendo `estado_campania = 'sin_envio'` del universo neutral, en lugar de resolver el estado real de la campaña Email seleccionada.

La corrección final aplicada fue:

- con campaña Email seleccionada:
	- la grilla usa `email_recipient_status` resuelto desde `ll_envios_email`;
	- `No incluido` significa ausencia real de recipient en esa campaña;
- sin campaña Email seleccionada:
	- la grilla no muestra `No incluido` como si fuera un estado real de campaña;
	- muestra un estado neutral: `Seleccionar campaña`.

#### Motivo por el que no se creó un endpoint nuevo

No hizo falta crear uno nuevo porque:

- ya existía una fuente real de datos conectada;
- el cambio era una ampliación de contrato, no un caso nuevo aislado;
- así se evitó duplicar lógica de selección de prospectos por cliente.

### 4.5 Backend real de preparación/envío Email ya existente

Durante la revisión se verificó que el backend real para campañas persistidas ya existía y estaba operativo:

- ruta: `POST /api/email/campaigns/:id/prepare`
- controller: `emailCampaigns.controller.prepare`
- servicio: `emailCampaignPrepare.service.prepareCampaign`
- ejecución técnica posterior: `emailCampaigns.scheduler`

El scheduler arranca desde `src/index.js` y procesa campañas en estado `pendiente` o `en_progreso`.

Por lo tanto, la corrección requerida no consistía en inventar un endpoint nuevo, sino en conectar correctamente el frontend al backend ya implementado.

---

## 5. Flujo funcional resultante

### 5.1 Flujo Email posterior al cambio

1. el usuario entra a `/email/campaigns/prospects` o `/email/campaigns/:campaignId/prospects`;
2. `EmailCampaignProspectsPage` carga campañas Email reales del cliente autenticado;
3. `GestionDestinatariosPage` en modo Email carga automáticamente el universo del cliente autenticado para Email;
4. la tabla ya aparece poblada sin campaña base;
5. el universo incluye también contactos solo-email;
6. si un grupo deduplicado tiene al menos una fila con email válido, la fila visible conserva ese email válido;
7. sin campaña Email seleccionada, el estado mostrado es neutral (`Seleccionar campaña`);
8. con campaña Email seleccionada, el estado visible se resuelve contra `ll_envios_email` de esa campaña;
9. `No incluido` sólo significa ausencia real del recipient en esa campaña;
10. los filtros operan sobre ese universo del cliente;
11. el usuario selecciona prospectos;
12. elige la campaña Email destino;
13. `Agregar a Campaña` llama `POST /api/email/campaigns/:id/recipients`;
14. al recargar la grilla, el estado ya refleja el recipient real en `ll_envios_email`;
15. `Preparar envío Email` ya no pide reescribir asunto/cuerpo manualmente;
16. el botón invoca `POST /api/email/campaigns/:id/prepare` para la campaña seleccionada;
17. la campaña queda preparada en backend y el scheduler real puede continuar el envío técnico.

### 5.2 Flujo WhatsApp posterior al cambio

No cambió:

1. el usuario entra a `/prospectos`;
2. selecciona campaña WhatsApp;
3. la pantalla carga prospectos para esa campaña;
4. mantiene acciones de agregar destinatarios y preparar envío WhatsApp.

---

## 6. Criterios de aceptación vs resultado

### 1. Al abrir la pantalla de destinatarios Email, la tabla carga prospectos sin seleccionar campaña base

**Cumplido.**

### 2. El dropdown/filtro “Campaña base de prospectos” ya no aparece

**Cumplido.**

### 3. El listado corresponde al cliente actual

**Cumplido.** Se resuelve desde `req.user.cliente_id` en backend.

### 4. Los filtros siguen funcionando

**Cumplido.** Los filtros continúan siendo locales sobre la colección cargada.

### 5. Se pueden seleccionar prospectos

**Cumplido.** La lógica de selección múltiple no se modificó.

### 6. “Agregar a Campaña” funciona

**Cumplido.** No se alteró el flujo de agregado a campaña Email.

### 7. “Preparar envío Email” usa la campaña persistida

**Cumplido.** En el contexto de Campañas Email, el botón ya no abre un modal para redactar un correo nuevo. Usa la campaña persistida y el endpoint real `POST /api/email/campaigns/:id/prepare`.

### 8. El comportamiento queda alineado con la pantalla de selección de prospectos de WhatsApp

**Cumplido en el objetivo puntual del selector Email:** ahora lista prospectos al ingresar y deja de depender de una campaña base. No se afirma equivalencia total con el modo WhatsApp, porque WhatsApp sigue dependiendo de `campaniaSeleccionada`.

---

## 7. Archivos modificados

1. `services/central-hub/frontend/src/components/destinatarios/GestionDestinatariosPage.jsx`
	- carga inicial en modo Email
	- eliminación de UI “Campaña base de prospectos”
	- fetch desacoplado de `campania_id`

2. `services/central-hub/frontend/src/services/prospectos.js`
	- `campania_id` documentado como opcional
	- soporte de `email_campaign_id` opcional

3. `services/central-hub/frontend/src/services/email.js`
	- agregado `prepareCampaign(campaignId, payload = {})`

4. `services/central-hub/frontend/src/components/destinatarios/EmailCampaignFormModal.jsx`
	- marcado explícitamente como flujo manual aislado
	- fuera del flujo principal de Campañas Email persistidas

5. `services/central-hub/src/modules/sender/controllers/prospectosController.js`
	- soporte para universo del cliente autenticado sin `campania_id`
	- deduplicación híbrida por teléfono o email normalizado
	- priorización de filas con email válido dentro de cada grupo
	- estado neutral sin herencia desde WhatsApp
	- enriquecimiento opcional con estado real Email desde `ll_envios_email`

---

## 8. Validaciones realizadas

### Validación estática

- chequeo de errores de los archivos modificados: **sin errores**
- compilación de frontend: **OK**
- chequeo de sintaxis del controlador backend: **OK**

### Evidencia de validación ejecutada

- `npm run build` en `services/central-hub/frontend` → exitoso
- `node --check services/central-hub/src/modules/sender/controllers/prospectosController.js` → exitoso

---

## 9. Riesgos o puntos a validar manualmente


1. **Semántica del estado en modo Email**
   - sin campaña Email seleccionada, la grilla muestra un estado neutral (`Seleccionar campaña`);
   - con campaña Email seleccionada, el badge se resuelve contra `ll_envios_email` de esa campaña;
   - `No incluido` sólo significa ausencia real del recipient en la campaña seleccionada.

2. **Volumen de datos**
	- la carga inicial de Email ahora puede devolver más filas que antes porque incluye contactos solo-email.
	- conviene validar performance con clientes de cartera grande.

3. **Criterio SQL de email válido**
	- la selección canónica depende de detectar correctamente email válido dentro del grupo.
	- conviene validar con casos borde de emails históricos o formatos poco frecuentes.

4. **Semántica del estado Email**
	- el badge de estado ahora depende de `ll_envios_email` sólo cuando hay campaña Email seleccionada.
	- conviene validar manualmente los estados reales usados por el scheduler (`PENDING`, `SENT`, `FAILED` y cualquier otro futuro).

5. **Preparación vs envío efectivo**
	- el botón de la pantalla ahora prepara correctamente la campaña persistida en backend;
	- el envío efectivo posterior depende del scheduler de campañas Email ya implementado y de la configuración real de mailer/smtp del entorno.
	- conviene validar manualmente el ciclo completo: `borrador` → `pendiente` → `en_progreso` / `enviado` / `error`, según el comportamiento operativo del entorno.

---

## 10. Paso a paso para probarlo

1. iniciar sesión con un usuario cliente real;
2. entrar en **Campañas Email**;
3. ir a **Seleccionar destinatarios**;
4. verificar que la tabla carga prospectos apenas abre;
5. verificar que **no existe** el selector “Campaña base de prospectos”;
6. probar filtros:
	- búsqueda
	- estado
	- tipo societe
	- cartera origen
	- canal disponible
7. seleccionar uno o varios prospectos;
8. elegir una campaña Email en el selector de campaña;
9. presionar **Agregar a Campaña** y verificar respuesta correcta;
10. presionar **Preparar envío Email** y verificar que:
	- no se abre modal para escribir un asunto/cuerpo nuevo;
	- la UI confirma la preparación de la campaña persistida;
	- el backend deja la campaña en `pendiente` y agenda al menos el primer recipient;
11. repetir la prueba con una campaña Email concreta desde `/email/campaigns/:campaignId/prospects`.

---

## 11. Conclusión final

El cambio quedó implementado de forma acotada, reutilizando el código real existente y sin inventar rutas, componentes ni endpoints.

La pantalla de destinatarios Email ahora:

- lista automáticamente los prospectos del cliente autenticado;
- incluye contactos con email válido aunque no tengan teléfono;
- ya no depende de una campaña base de prospectos;
- deduplica por teléfono si existe, o por email normalizado si no hay teléfono;
- prioriza filas con email válido al elegir la fila visible del grupo;
- sin campaña seleccionada, muestra estado neutral;
- con campaña seleccionada, resuelve el estado contra `ll_envios_email` de esa campaña;
- `No incluido` sólo significa ausencia real de recipient en la campaña Email seleccionada;
- conserva los filtros actuales;
- conserva la selección múltiple;
- conserva el agregado a campaña;
- usa el flujo real de campaña persistida para preparar el envío Email;
- deja fuera de este contexto el composer manual ad hoc vía `/mailer/send`.

Estado del resultado: **alineado con el objetivo funcional solicitado para el selector Email**.
