# Reporte de estado post-merge — Email Grupo 2

**Tipo:** Reporte ejecutivo-técnico de estado  
**Plano:** AS-IS IMPLEMENTADO  
**Fecha:** 2026-03-27  
**Branch activa:** `feat/email-campaigns-group-2`  
**Branch mergeada:** `merge/pr34-conflict-resolution` (PR #35, squash merge)  
**Commit base actual:** `f9662bc` (`merge: resolve PR#34 conflicts and integrate email campaigns persistence`)  
**Autor:** Alberto Hilal  
**Workspace:** LeadMaster

## 1. Estado actual

El repositorio quedó limpio y estable tras el merge exitoso del PR #35 en `main`.

Estado verificado al cierre de esta instancia:

- los conflictos que bloqueaban la integración del PR #34 fueron resueltos y consolidados en el PR #35
- los checks del PR pasaron en GitHub
- la validación local ejecutada sobre el módulo confirmó 13 suites y 64 tests aprobados, sin fallos
- no quedan archivos unmerged ni conflict markers en el árbol de trabajo
- la rama `feat/email-campaigns-group-2` fue recreada limpia a partir de `origin/main`
- el árbol de trabajo quedó limpio (`git status` sin cambios pendientes)

Este punto marca el cierre técnico del tramo de integración previo y deja lista la base para continuar con el siguiente bloque de trabajo.

## 2. Qué quedó consolidado con el merge del PR #35

El PR #35 consolidó la resolución de conflictos semánticos y técnicos entre `feature/campaigns-by-channel-alignment` y `origin/main`, integrando cambios en documentación, frontend, backend y tests.

### 2.1 Bloque ya consolidado antes del merge final

Este bloque ya venía resuelto en el PR funcional original y quedó preservado en la integración final:

- `docs/06-FASES/PHASE-4B-CAMPAIGNS-BY-CHANNEL-ALIGNMENT-PLAN.md`
- `services/central-hub/frontend/src/App.jsx`
- `services/central-hub/frontend/src/components/layout/Sidebar.jsx`
- `services/central-hub/frontend/src/services/email.js`
- `services/central-hub/src/modules/email/routes/emailCampaigns.routes.js`

Este conjunto corresponde al wiring principal: rutas, navegación, entrada al módulo y servicios frontend básicos.

### 2.2 Bloque principal consolidado en PR #35

Este fue el bloque central resuelto durante la integración final:

- `services/central-hub/frontend/src/components/email/EmailCampaignCreatePage.jsx`
- `services/central-hub/src/modules/email/validators/createEmailCampaign.validator.js`
- `services/central-hub/src/modules/email/services/emailCampaigns.service.js`
- `services/central-hub/src/modules/email/controllers/emailCampaigns.controller.js`
- `services/central-hub/src/modules/email/services/emailCampaignPrepare.service.js`
- `services/central-hub/src/modules/email/tests/emailCampaignPrepare.integration.test.js`
- `services/central-hub/src/modules/email/tests/emailCampaignPrepare.service.test.js`
- `services/central-hub/frontend/src/components/destinatarios/GestionDestinatariosPage.jsx`

### 2.3 Ajustes de tests alineados post-merge

Además del bloque principal, el PR #35 incluyó ajustes complementarios de tests para alinear el contrato vigente:

- `services/central-hub/src/modules/email/tests/emailCampaigns.controller.test.js`
- `services/central-hub/src/modules/email/tests/emailCampaigns.integration.test.js`

Estos tests usaban el contrato anterior (`asunto`, `body`, `email_from`, etc.) y fueron alineados al contrato mínimo vigente (`subject`, `text`).

### 2.4 Criterio de resolución aplicado

En los archivos con conflicto semántico se preservó la semántica funcional de la rama feature, con los siguientes criterios:

- contrato de create mínimo: `nombre`, `subject`, `text`
- exclusión explícita de campos legacy como `asunto`, `body`, `channel`, `fecha_programada`, `email_from`, `observaciones`, entre otros
- resolución de sender (`email_from`, `name_from`, `reply_to_email`) en prepare-time desde `ll_clientes_email_config`
- uso de `GestionDestinatariosPage` como selector compartido parametrizable por canal
- preservación del flujo WhatsApp sin regresión funcional
- alineamiento de tests de prepare y create al contrato vigente

## 3. Qué parte del objetivo de persistencia Email ya quedó cerrada

La persistencia Email como funcionalidad operativa quedó cerrada con el siguiente alcance verificado.

### 3.1 Backend — Superficie implementada

| Componente | Archivo / zona | Estado |
|---|---|---|
| Create campaña Email | `emailCampaigns.controller.js` / `emailCampaigns.service.js` | Implementado. Contrato mínimo `nombre/subject/text`, persiste en `ll_campanias_email` con estado `borrador` |
| List campañas Email | `emailCampaigns.controller.js` / `emailCampaigns.service.js` | Implementado. `GET /api/email/campaigns` filtra por `cliente_id` y devuelve `subject` mapeado desde `asunto` |
| Add recipients | `emailCampaignRecipients.service.js` | Implementado. Persiste destinatarios por campaña en `ll_envios_email` |
| Prepare campaña | `emailCampaignPrepare.service.js` | Implementado. Resuelve sender desde `ll_clientes_email_config` cuando falta en la campaña y agenda el primer destinatario |
| Scheduler secuencial | `emailCampaigns.scheduler.js` | Implementado. Procesamiento uno a uno con delays entre destinatarios |
| Stats de campaña | `emailCampaignStats.service.js` | Implementado. Sincronización desde `ll_envios_email` |
| Validator de create | `createEmailCampaign.validator.js` | Implementado. Acepta solo `nombre`, `subject`, `text` y bloquea campos legacy o de sender |

### 3.2 Frontend — Superficie implementada

| Componente | Archivo | Estado |
|---|---|---|
| Create page | `EmailCampaignCreatePage.jsx` | Implementado. Formulario mínimo `nombre/subject/text`, navegación al listado tras éxito |
| Manager / índice | `EmailCampaignsManager.jsx` | Implementado. Listado de campañas Email con acceso al flujo de destinatarios |
| Prospects por campaña | `EmailCampaignProspectsPage.jsx` | Implementado. Wrapper sobre selector compartido con contexto Email |
| Selector compartido | `GestionDestinatariosPage.jsx` | Implementado. Parametrizable por canal, con selector de campaña Email, add recipients y prepare campaign |
| Servicio frontend | `email.js` | Implementado. Métodos `createCampaign`, `listCampaigns`, `addCampaignRecipients`, `prepareCampaign`, `sendSelectionFanout` |

### 3.3 Rutas montadas

| Ruta | Método | Descripción |
|---|---|---|
| `/api/email/campaigns` | GET | Listar campañas Email del cliente |
| `/api/email/campaigns` | POST | Crear campaña Email con contrato mínimo |
| `/api/email/campaigns/:id/recipients` | POST | Agregar destinatarios a campaña |
| `/api/email/campaigns/:id/prepare` | POST | Preparar campaña para envío |

### 3.4 Validación técnica realizada

- checks del PR en GitHub: aprobados
- validación local del módulo: 13 suites y 64 tests pasando
- tests alineados al contrato mínimo `subject` / `text`
- tests de prepare verificados en nivel unitario e integración

Con este alcance, la persistencia operativa de campañas Email queda cerrada para el tramo implementado hasta aquí.

## 4. Relación con el plan `PHASE-4B-CAMPAIGNS-BY-CHANNEL-ALIGNMENT-PLAN.md`

El documento `PHASE-4B-CAMPAIGNS-BY-CHANNEL-ALIGNMENT-PLAN.md` define un realineamiento por etapas entre campaña, canal y operación. El estado post-merge respecto de ese plan puede resumirse así:

| Etapa | Descripción | Estado |
|---|---|---|
| Etapa 1 | Cierre documental del criterio | **Cerrada.** La campaña define el canal y eso quedó documentado |
| Etapa 2 | Explicitación del tipo de campaña en la operación | **Mayormente cerrada.** La UI ya diferencia el contexto Email y condiciona acciones por canal |
| Etapa 3 | Alineamiento del flujo WhatsApp | **Preservado.** No se detectaron regresiones en el flujo propio de WhatsApp |
| Etapa 4 | Alineamiento del flujo Email | **Cerrada en backend y operación persistida.** Create, recipients, prepare, scheduler y stats ya responden al modelo de campaña Email |
| Etapa 5 | Endurecimiento de consistencia operativa | **Parcial.** Queda revisión fina de semántica de UI, affordances, mensajes y estados visibles |

Este diagnóstico es consistente con el estado declarado por el propio plan como `PARTIALLY COMPLETED`: la persistencia operativa ya existe, pero el endurecimiento semántico completo de la UI todavía no puede darse por cerrado.

## 5. Qué queda cerrado del Grupo 1 funcional

**Grupo 1 queda cerrado.**

En términos funcionales, este cierre implica:

- la base de persistencia Email ya quedó integrada en `main`
- la resolución de conflictos quedó consolidada en un único PR integrador (#35)
- el contrato mínimo de create ya quedó fijado y protegido por validator y tests
- la operación persistida por campaña y destinatario ya está conectada de punta a punta
- el repositorio quedó limpio y el trabajo continúa desde `feat/email-campaigns-group-2`

Este informe toma ese punto como cierre del primer corte funcional y como base para el siguiente bloque de trabajo.

## 6. Riesgos o puntos todavía abiertos

### 6.1 Riesgos verificados o plausibles

1. **Endurecimiento semántico de UI todavía incompleto.**  
   La pantalla compartida ya discrimina por canal, pero no se verificó exhaustivamente que todos los textos, labels, ayudas visuales y affordances reflejen de forma inequívoca el modelo de campaña por canal en todos los estados posibles.

2. **Convivencia del flujo Email manual transitorio.**  
   El componente `EmailCampaignFormModal` sigue existiendo y se renderiza cuando `useEmailCampaignSelector` es `false`. Esto deja abierta la necesidad de decidir si el envío manual libre sigue siendo un camino permitido, transitorio o residual.

3. **Cobertura y enriquecimiento de emails útiles.**  
   El flujo depende de que los prospectos tengan email válido. En esta instancia no se evaluó la calidad real de la base de datos respecto de cobertura, vigencia o usabilidad comercial de esos emails.

4. **Validación operativa real del scheduler encadenado.**  
   El scheduler secuencial está implementado y testado a nivel automatizado, pero en este informe no se documenta una validación operativa real de punta a punta con múltiples destinatarios en serie.

### 6.2 Puntos que conviene dejar explícitos

5. **Mapeo `subject` / `text` hacia `asunto` / `body` en DB.**  
   El contrato HTTP público usa `subject` y `text`, mientras que la persistencia en `ll_campanias_email` sigue usando columnas `asunto` y `body`. El mapeo está implementado, pero conviene dejarlo documentado como convención estable para evitar lecturas ambiguas.

6. **Artefactos o residuos de UI históricos.**  
   En esta revisión no se detectó uso activo de `emailCampaignsMock.js` en las rutas principales, pero igualmente conviene revisar si corresponde eliminarlo como cleanup documental o técnico.

## 7. Alcance recomendado para Grupo 2

Con base en el estado actual, el alcance recomendado para `feat/email-campaigns-group-2` es el siguiente.

### Prioridad alta

- completar el endurecimiento semántico de la UI compartida
- revisar textos, labels, mensajes de confirmación y affordances para que no quede ambigüedad entre campaña por canal y envío libre
- decidir explícitamente el destino del flujo manual basado en `EmailCampaignFormModal`
- si ese flujo sigue existiendo, marcarlo como transitorio de manera visible; si no corresponde, retirarlo

### Prioridad media

- ejecutar validación operativa real del scheduler con múltiples destinatarios
- revisar la visibilidad de estados y métricas de campaña Email en la operación diaria
- dejar documentación explícita del mapeo `subject/text` ↔ `asunto/body`

### Prioridad baja

- limpieza de residuos históricos de UI o mocks no utilizados
- mejoras de UX secundarias sobre listado y navegación
- reporting comercial y capacidades más avanzadas, fuera del alcance directo del cierre de Phase 4B

## 8. Próximos pasos técnicos sugeridos

1. recorrer en browser todas las pantallas del módulo Email
2. verificar si existe alguna ruta activa hacia un flujo Email libre sin campaña persistida
3. decidir si ese flujo se elimina o se deja como transición controlada
4. ejecutar una prueba real del scheduler con varios destinatarios
5. documentar explícitamente la convención `subject/text` → `asunto/body`
6. revisar si la Etapa 5 de Phase 4B puede cerrarse total o parcialmente tras este grupo
7. actualizar el estado documental general del proyecto una vez cerrado el siguiente bloque

## 9. Conclusión

El merge del PR #35 dejó consolidada la persistencia operativa de campañas Email en LeadMaster.

Quedaron integrados:

- el contrato mínimo de create (`nombre`, `subject`, `text`)
- la persistencia de campañas en `ll_campanias_email`
- la persistencia por destinatario en `ll_envios_email`
- la resolución de sender en prepare-time
- la preparación de campaña para envío
- el scheduler secuencial
- la parametrización del selector compartido por canal
- la validación automatizada alineada al contrato vigente

El Grupo 1 funcional queda cerrado.

El repositorio está limpio, la integración ya fue absorbida por `main`, y el trabajo continúa desde `feat/email-campaigns-group-2` con base en el commit `f9662bc`.

Lo que resta para completar plenamente el espíritu de `PHASE-4B-CAMPAIGNS-BY-CHANNEL-ALIGNMENT-PLAN.md` no es rehacer la persistencia, sino endurecer la consistencia semántica y operativa de la UI y validar en uso real el tramo secuencial del envío.

---

## Documentos de referencia

- `docs/06-FASES/PHASE-4B-CAMPAIGNS-BY-CHANNEL-ALIGNMENT-PLAN.md`
- `docs/05-REPORTES/2026-03/REPORTE-REALINEAMIENTO-CAMPANAS-POR-CANAL-2026-03-19.md`
- `docs/05-REPORTES/2026-03/REPORTE-INTEGRACION-END-TO-END-EMAIL-CENTRAL-HUB-MAILER-2026-03-15.md`
- `docs/05-REPORTES/ANALISIS_CONFLICTOS_PR34_CAMPAIGNS_BY_CHANNEL_ALIGNMENT_2026-03-26.md`