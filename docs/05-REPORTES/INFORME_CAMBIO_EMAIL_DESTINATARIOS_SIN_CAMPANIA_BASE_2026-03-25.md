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

#### Campañas Email

- `GET /api/email/campaigns`
- `POST /api/email/campaigns/:id/recipients`

#### Campañas WhatsApp / destinatarios

- `POST /api/sender/destinatarios/campania/:campaniaId/agregar`

#### Flujo actual de “Preparar envío Email”

El flujo conectado en esta pantalla **no prepara una campaña backend**. Abre un modal y ejecuta envíos por destinatario usando:

- `POST /mailer/send`

desde:

- `services/central-hub/frontend/src/components/destinatarios/EmailCampaignFormModal.jsx`
- `services/central-hub/frontend/src/services/email.js`

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
4. preservar todos los flujos actuales ya conectados.

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
	- en modo Email ahora se llama `prospectosService.filtrarProspectos({})`;
	- en modo WhatsApp se sigue llamando con `campania_id`.

3. **Eliminación de UI obsoleta**
	- se eliminó el dropdown **“Campaña base de prospectos”**;
	- se dejó sólo la selección de la campaña Email destino.

4. **Texto contextual actualizado**
	- se reemplazó la referencia a “base origen” por mensajes que indican que la grilla usa el universo del cliente autenticado.

#### Lo que se mantuvo intacto

- filtros por:
  - búsqueda
  - estado
  - tipo societe
  - cartera origen
  - canal disponible
- selección múltiple
- `Agregar a Campaña`
- `Preparar envío Email`
- modal de envío Email

### 4.2 Frontend — `prospectos.js`

Archivo modificado:

- `services/central-hub/frontend/src/services/prospectos.js`

#### Cambio realizado

Se dejó explícito que `campania_id` es opcional, porque en Email ahora el endpoint puede devolver el universo del cliente autenticado sin necesidad de campaña base.

### 4.3 Backend — `prospectosController.js`

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

#### Motivo del ajuste adicional

El ajuste anterior seguía siendo insuficiente para Email porque un criterio canónico puramente basado en `MAX(rowid)` podía elegir, dentro del mismo grupo lógico, una fila con peor calidad para el canal.

Ejemplo de bug corregido:

- fila A: mismo teléfono, email válido, `rowid` menor
- fila B: mismo teléfono, sin email útil, `rowid` mayor

Con `MAX(rowid)` simple podía quedar visible la fila B y perderse el email válido de la fila A.

La corrección aplicada asegura que, si dentro del grupo existe una fila con email válido, la fila devuelta para Email tenga email válido.

#### Motivo por el que no se creó un endpoint nuevo

No hizo falta crear uno nuevo porque:

- ya existía una fuente real de datos conectada;
- el cambio era una ampliación de contrato, no un caso nuevo aislado;
- así se evitó duplicar lógica de selección de prospectos por cliente.

---

## 5. Flujo funcional resultante

### 5.1 Flujo Email posterior al cambio

1. el usuario entra a `/email/campaigns/prospects` o `/email/campaigns/:campaignId/prospects`;
2. `EmailCampaignProspectsPage` carga campañas Email reales del cliente autenticado;
3. `GestionDestinatariosPage` en modo Email carga automáticamente el universo del cliente autenticado para Email;
4. la tabla ya aparece poblada sin campaña base;
5. el universo incluye también contactos solo-email;
6. si un grupo deduplicado tiene al menos una fila con email válido, la fila visible conserva ese email válido;
7. el estado mostrado en este modo es neutral;
8. los filtros operan sobre ese universo del cliente;
9. el usuario selecciona prospectos;
10. elige la campaña Email destino;
11. `Agregar a Campaña` llama `POST /api/email/campaigns/:id/recipients`;
12. `Preparar envío Email` sigue abriendo el modal existente y usando `/mailer/send` por destinatario válido.

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

### 7. “Preparar envío Email” sigue funcionando

**Cumplido.** No se alteró el flujo del modal ni el fanout existente a `/mailer/send`.

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

3. `services/central-hub/src/modules/sender/controllers/prospectosController.js`
	- soporte para universo del cliente autenticado sin `campania_id`
	- deduplicación híbrida por teléfono o email normalizado
	- priorización de filas con email válido dentro de cada grupo
	- estado neutral sin herencia desde WhatsApp

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
	- al no depender de una campaña WhatsApp, el `estado` mostrado en este modo es neutral (`sin_envio`).
	- esto evita mezclar semántica de WhatsApp con selector Email, pero conviene validar si negocio necesita un estado específico de Email a futuro.

2. **Volumen de datos**
	- la carga inicial de Email ahora puede devolver más filas que antes porque incluye contactos solo-email.
	- conviene validar performance con clientes de cartera grande.

3. **Criterio SQL de email válido**
	- la selección canónica depende de detectar correctamente email válido dentro del grupo.
	- conviene validar con casos borde de emails históricos o formatos poco frecuentes.

4. **Flujo de envío Email actual**
	- sigue siendo el flujo real ya conectado: modal + fanout a `/mailer/send`.
	- no se migró a `POST /api/email/campaigns/:id/prepare` porque no es el flujo operativo que esta pantalla estaba usando hoy.
	- este cambio resuelve el selector/recipients Email, no un pipeline técnico nuevo de prepare/send backend.

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
10. presionar **Preparar envío Email**, completar asunto y cuerpo, y verificar que el flujo continúa funcionando;
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
- devuelve estado neutral en el modo sin `campania_id`;
- conserva los filtros actuales;
- conserva la selección múltiple;
- conserva el agregado a campaña;
- conserva el flujo de preparación/envío Email hoy conectado.

Estado del resultado: **alineado con el objetivo funcional solicitado para el selector Email**.
