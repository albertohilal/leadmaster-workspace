# Análisis de conflictos PR #34 — `feature/campaigns-by-channel-alignment`

**Tipo:** Reporte técnico de diagnóstico previo a merge  
**Estado:** NO VERIFICADO HASTA RESOLUCIÓN MANUAL  
**Fecha:** 2026-03-26  
**Rama analizada:** `feature/campaigns-by-channel-alignment`  
**Base de comparación:** `origin/main`  
**Merge-base verificado:** `801e6b9cbc93bf2207688868a69a279efb27ef72`

## Plano documental

- **AS-IS IMPLEMENTADO:** este informe describe el estado real verificado en la rama feature y en `origin/main` sólo a nivel de archivos, contratos y diffs observables.
- **NO VERIFICADO:** el resultado final del merge todavía no existe y no debe asumirse como funcional hasta resolver conflictos y validar.
- **TARGET / PLANNED:** la estrategia sugerida de resolución es una recomendación operativa, no un estado implementado.

## Objetivo

Diagnosticar de forma conservadora los conflictos del PR para definir:

1. tipo de conflicto por archivo
2. estrategia probable de resolución
3. orden recomendado de trabajo
4. archivos de alto riesgo
5. estrategia de ramas más segura
6. prompt acotado para resolver sólo el primer grupo

## Criterio de verdad usado

1. diff directo entre `origin/main` y `feature/campaigns-by-channel-alignment`
2. diff de cada lado respecto del merge-base
3. lectura de las versiones actuales de los archivos más sensibles en ambas ramas
4. consistencia con el flujo Email hoy validado en esta rama:
   - campaña Email persistida
   - recipients persistidos en `ll_envios_email`
   - `prepare` sobre campaña persistida
   - selector compartido con semántica por canal

## 1. Resumen ejecutivo

El PR no presenta un conflicto "mecánico" simple sino una **divergencia semántica en varias capas al mismo tiempo**:

- navegación y rutas frontend
- contrato de creación de campaña Email
- servicio backend de `prepare`
- selector compartido de destinatarios
- tests que fijan semántica distinta
- documentación de fase reescrita en ambos lados

Hallazgo principal:

- la rama feature contiene el flujo Email hoy más cercano al comportamiento validado end-to-end
- `main` también avanzó sobre varios de los mismos archivos, pero en varios casos conserva una semántica anterior o distinta
- por eso **no es seguro** resolver en bloque con `accept ours` o `accept theirs`

Conclusión operativa:

- conviene resolver por grupos de archivos
- hay un grupo inicial de bajo acoplamiento que puede resolverse primero
- hay un grupo contractual/backend que debe resolverse junto
- el archivo más peligroso para dejar al final es [services/central-hub/frontend/src/components/destinatarios/GestionDestinatariosPage.jsx](services/central-hub/frontend/src/components/destinatarios/GestionDestinatariosPage.jsx), porque concentra cambios funcionales, semánticos y de estabilidad UI

## 2. Clasificación de conflictos por archivo

| Archivo | Tipo de conflicto | Lectura conservadora | Estrategia sugerida | Riesgo |
|---|---|---|---|---|
| [docs/06-FASES/PHASE-4B-CAMPAIGNS-BY-CHANNEL-ALIGNMENT-PLAN.md](docs/06-FASES/PHASE-4B-CAMPAIGNS-BY-CHANNEL-ALIGNMENT-PLAN.md) | Documentación reescrita en ambos lados | ambos lados agregaron una versión extensa del plan; la rama feature además marca avance parcial e implementación observada | **Merge manual de ambos**. Tomar la base narrativa común y preservar de feature el estado `PARTIALLY COMPLETED`, `Last Reviewed` y la sección de implementación real | Medio |
| [services/central-hub/frontend/src/App.jsx](services/central-hub/frontend/src/App.jsx) | Wiring de rutas | feature agrega índice de campañas Email y rutas de prospects; `main` ya tenía create page | **Merge manual con base feature**. Mantener todas las rutas Email y revisar que no se pierda ninguna ruta protegida de `main` | Medio-bajo |
| [services/central-hub/frontend/src/components/layout/Sidebar.jsx](services/central-hub/frontend/src/components/layout/Sidebar.jsx) | Navegación/semántica UI | feature reemplaza acceso directo a create por índice de campañas Email y elimina el acceso aislado a selección neutral | **Merge manual con preferencia feature**. Preservar mejoras visuales de `main` si existieran, pero sostener la semántica por canal | Medio |
| [services/central-hub/frontend/src/services/email.js](services/central-hub/frontend/src/services/email.js) | Cliente API frontend | feature extiende el servicio con `listCampaigns()`, `addCampaignRecipients()` y `prepareCampaign()` y simplifica create | **Preferir feature e integrar aditivo**. No volver a introducir `channel` en create sin revisar el contrato backend final | Medio-bajo |
| [services/central-hub/src/modules/email/routes/emailCampaigns.routes.js](services/central-hub/src/modules/email/routes/emailCampaigns.routes.js) | Wiring backend de rutas | feature agrega `GET /api/email/campaigns`; el resto convive | **Merge manual aditivo**. Mantener `GET /`, `POST /`, `POST /:id/recipients` y `POST /:id/prepare` | Bajo |
| [services/central-hub/frontend/src/components/email/EmailCampaignCreatePage.jsx](services/central-hub/frontend/src/components/email/EmailCampaignCreatePage.jsx) | UI + contrato de create | `main` todavía transmite una lectura más preparatoria; feature ya lo alinea con borrador persistido y navegación al listado | **Resolver junto con validator + service + controller**. Base semántica: feature | Medio-alto |
| [services/central-hub/src/modules/email/controllers/emailCampaigns.controller.js](services/central-hub/src/modules/email/controllers/emailCampaigns.controller.js) | Controlador HTTP con endpoints compartidos | feature agrega `list()` y export correspondiente; create/addRecipients/prepare comparten superficie con cambios adyacentes de `main` | **Resolver junto con service + validator + prepare**. No aislarlo | Alto |
| [services/central-hub/src/modules/email/services/emailCampaigns.service.js](services/central-hub/src/modules/email/services/emailCampaigns.service.js) | Servicio de dominio + contrato DB | hay cambio semántico fuerte: feature migra create a `subject/text`, agrega listado y resolución de sender desde config activa | **Merge manual con preferencia feature en contrato canónico**. Validar cuidadosamente nombres `asunto/body` vs `subject/text` | Alto |
| [services/central-hub/src/modules/email/validators/createEmailCampaign.validator.js](services/central-hub/src/modules/email/validators/createEmailCampaign.validator.js) | Conflicto de contrato de entrada | `main` acepta payload más rico estilo `asunto/body/...`; feature endurece contrato mínimo `nombre/subject/text` y bloquea campos legacy | **Archivo crítico**. Resolver en conjunto con create page, controller y service. Base recomendada: feature | Muy alto |
| [services/central-hub/src/modules/email/services/emailCampaignPrepare.service.js](services/central-hub/src/modules/email/services/emailCampaignPrepare.service.js) | Lógica de negocio crítica | feature resuelve `email_from` desde config activa del cliente cuando la campaña no lo trae; `main` falla si falta `email_from` | **Archivo crítico**. Preferir semántica feature y revisar manualmente cualquier cambio paralelo de `main` | Muy alto |
| [services/central-hub/src/modules/email/tests/emailCampaignPrepare.integration.test.js](services/central-hub/src/modules/email/tests/emailCampaignPrepare.integration.test.js) | Test de integración dependiente de contrato final | los asserts divergen según la semántica elegida para `prepare` | **Resolver después del servicio**. Reescribir sobre la semántica final, no mezclar ciegamente | Alto |
| [services/central-hub/src/modules/email/tests/emailCampaignPrepare.service.test.js](services/central-hub/src/modules/email/tests/emailCampaignPrepare.service.test.js) | Test unitario dependiente de contrato final | feature ya prueba resolución de sender desde config del cliente; `main` fijaba error por falta de `email_from` | **Resolver después del servicio**. Base recomendada: feature | Alto |
| [services/central-hub/frontend/src/components/destinatarios/GestionDestinatariosPage.jsx](services/central-hub/frontend/src/components/destinatarios/GestionDestinatariosPage.jsx) | Selector compartido transversal | concentra cambios de carga de universo Email, filtros por campaña Email, status desde `ll_envios_email`, prepare persistido y fix de estabilidad UI | **Dejar para el final**. Merge manual muy fino, validando comportamiento real después | Muy alto |

## 3. Orden recomendado de resolución

### Grupo 1 — Bajo acoplamiento / wiring / base de navegación

1. [docs/06-FASES/PHASE-4B-CAMPAIGNS-BY-CHANNEL-ALIGNMENT-PLAN.md](docs/06-FASES/PHASE-4B-CAMPAIGNS-BY-CHANNEL-ALIGNMENT-PLAN.md)
2. [services/central-hub/frontend/src/App.jsx](services/central-hub/frontend/src/App.jsx)
3. [services/central-hub/frontend/src/components/layout/Sidebar.jsx](services/central-hub/frontend/src/components/layout/Sidebar.jsx)
4. [services/central-hub/frontend/src/services/email.js](services/central-hub/frontend/src/services/email.js)
5. [services/central-hub/src/modules/email/routes/emailCampaigns.routes.js](services/central-hub/src/modules/email/routes/emailCampaigns.routes.js)

Justificación:

- son archivos mayormente de wiring o semántica visible
- permiten estabilizar navegación y superficie HTTP antes de tocar reglas de negocio
- reducen ruido antes de entrar a contratos y servicios críticos

### Grupo 2 — Contrato de create de campaña Email

6. [services/central-hub/frontend/src/components/email/EmailCampaignCreatePage.jsx](services/central-hub/frontend/src/components/email/EmailCampaignCreatePage.jsx)
7. [services/central-hub/src/modules/email/validators/createEmailCampaign.validator.js](services/central-hub/src/modules/email/validators/createEmailCampaign.validator.js)
8. [services/central-hub/src/modules/email/services/emailCampaigns.service.js](services/central-hub/src/modules/email/services/emailCampaigns.service.js)
9. [services/central-hub/src/modules/email/controllers/emailCampaigns.controller.js](services/central-hub/src/modules/email/controllers/emailCampaigns.controller.js)

Justificación:

- estos cuatro archivos forman un único contrato funcional
- resolver sólo uno de ellos rompe la coherencia del flujo `create`
- aquí debe decidirse definitivamente si el create canónico es mínimo `subject/text` o si vuelve parte del contrato más rico de `main`

### Grupo 3 — Semántica de `prepare` y cobertura asociada

10. [services/central-hub/src/modules/email/services/emailCampaignPrepare.service.js](services/central-hub/src/modules/email/services/emailCampaignPrepare.service.js)
11. [services/central-hub/src/modules/email/tests/emailCampaignPrepare.service.test.js](services/central-hub/src/modules/email/tests/emailCampaignPrepare.service.test.js)
12. [services/central-hub/src/modules/email/tests/emailCampaignPrepare.integration.test.js](services/central-hub/src/modules/email/tests/emailCampaignPrepare.integration.test.js)

Justificación:

- `prepare` es el centro del envío Email persistido
- la semántica elegida impacta errores, fallback de sender, estado de campaña y cola operativa
- los tests sólo deben tocarse después de fijar el servicio final

### Grupo 4 — Selector compartido de máxima complejidad

13. [services/central-hub/frontend/src/components/destinatarios/GestionDestinatariosPage.jsx](services/central-hub/frontend/src/components/destinatarios/GestionDestinatariosPage.jsx)

Justificación:

- depende del wiring frontend y del contrato backend final
- mezcla UX, filtros, acciones por canal, estados operativos y fixes de estabilidad
- resolverlo antes aumenta la probabilidad de reabrir conflictos conceptuales luego

## 4. Archivos de alto riesgo

### Riesgo muy alto

- [services/central-hub/frontend/src/components/destinatarios/GestionDestinatariosPage.jsx](services/central-hub/frontend/src/components/destinatarios/GestionDestinatariosPage.jsx)
- [services/central-hub/src/modules/email/validators/createEmailCampaign.validator.js](services/central-hub/src/modules/email/validators/createEmailCampaign.validator.js)
- [services/central-hub/src/modules/email/services/emailCampaignPrepare.service.js](services/central-hub/src/modules/email/services/emailCampaignPrepare.service.js)

Motivo:

- fijan semántica, no sólo sintaxis
- están directamente conectados con el flujo Email validado en esta rama
- una resolución equivocada puede dejar una app que compila pero ya no responde al flujo operativo real

### Riesgo alto

- [services/central-hub/src/modules/email/services/emailCampaigns.service.js](services/central-hub/src/modules/email/services/emailCampaigns.service.js)
- [services/central-hub/src/modules/email/controllers/emailCampaigns.controller.js](services/central-hub/src/modules/email/controllers/emailCampaigns.controller.js)
- [services/central-hub/src/modules/email/tests/emailCampaignPrepare.service.test.js](services/central-hub/src/modules/email/tests/emailCampaignPrepare.service.test.js)
- [services/central-hub/src/modules/email/tests/emailCampaignPrepare.integration.test.js](services/central-hub/src/modules/email/tests/emailCampaignPrepare.integration.test.js)
- [services/central-hub/frontend/src/components/email/EmailCampaignCreatePage.jsx](services/central-hub/frontend/src/components/email/EmailCampaignCreatePage.jsx)

## 5. Recomendación de estrategia de ramas

### Estrategia sugerida

1. conservar la rama backup ya creada antes del análisis
2. crear una rama de integración temporal dedicada sólo a resolver este PR
3. hacer el merge de `origin/main` sobre esa rama temporal
4. resolver por grupos en el orden anterior
5. hacer un commit por grupo resuelto
6. validar después de Grupo 2 y Grupo 3 antes de tocar el Grupo 4
7. sólo cuando la rama temporal quede estable, trasladar la resolución a la rama final del PR

### Por qué no conviene resolver directo sobre la rama principal del feature

- el conflicto no es local ni lineal
- hay cambios con semántica ya validada que sería fácil perder por accidente
- un commit único de conflicto resuelto dificultaría auditar qué grupo introdujo una regresión

### Recomendación concreta

- usar la rama temporal como laboratorio de resolución
- mantener commits pequeños y temáticos
- no mezclar la resolución del selector compartido con la del contrato backend de Email

## 6. Prompt sugerido para resolver sólo el primer grupo

> Resolver únicamente el **Grupo 1** de conflictos del PR `feature/campaigns-by-channel-alignment` contra `main`, sin tocar todavía archivos de contrato backend, tests ni el selector compartido.  
> Archivos permitidos en este paso:  
> - [docs/06-FASES/PHASE-4B-CAMPAIGNS-BY-CHANNEL-ALIGNMENT-PLAN.md](docs/06-FASES/PHASE-4B-CAMPAIGNS-BY-CHANNEL-ALIGNMENT-PLAN.md)  
> - [services/central-hub/frontend/src/App.jsx](services/central-hub/frontend/src/App.jsx)  
> - [services/central-hub/frontend/src/components/layout/Sidebar.jsx](services/central-hub/frontend/src/components/layout/Sidebar.jsx)  
> - [services/central-hub/frontend/src/services/email.js](services/central-hub/frontend/src/services/email.js)  
> - [services/central-hub/src/modules/email/routes/emailCampaigns.routes.js](services/central-hub/src/modules/email/routes/emailCampaigns.routes.js)  
> Objetivo del paso: dejar estable el wiring documental, de navegación y de rutas Email, preservando la semántica por canal de la rama feature y sumando cualquier cambio aditivo no contradictorio de `main`.  
> Restricciones:  
> - no tocar [services/central-hub/frontend/src/components/destinatarios/GestionDestinatariosPage.jsx](services/central-hub/frontend/src/components/destinatarios/GestionDestinatariosPage.jsx)  
> - no tocar [services/central-hub/src/modules/email/validators/createEmailCampaign.validator.js](services/central-hub/src/modules/email/validators/createEmailCampaign.validator.js)  
> - no tocar [services/central-hub/src/modules/email/services/emailCampaigns.service.js](services/central-hub/src/modules/email/services/emailCampaigns.service.js)  
> - no tocar [services/central-hub/src/modules/email/services/emailCampaignPrepare.service.js](services/central-hub/src/modules/email/services/emailCampaignPrepare.service.js)  
> - no tocar tests en este paso  
> Criterio de resolución:  
> - en [services/central-hub/frontend/src/App.jsx](services/central-hub/frontend/src/App.jsx), conservar las rutas Email del feature  
> - en [services/central-hub/frontend/src/components/layout/Sidebar.jsx](services/central-hub/frontend/src/components/layout/Sidebar.jsx), conservar la entrada a listado de campañas Email y no volver a una navegación neutral centrada en create aislado  
> - en [services/central-hub/frontend/src/services/email.js](services/central-hub/frontend/src/services/email.js), conservar los métodos `listCampaigns()`, `addCampaignRecipients()` y `prepareCampaign()`  
> - en [services/central-hub/src/modules/email/routes/emailCampaigns.routes.js](services/central-hub/src/modules/email/routes/emailCampaigns.routes.js), dejar montado también `GET /api/email/campaigns`  
> - en el documento de fase, fusionar contenido de ambos lados sin perder el estado parcial e implementación real documentados en la rama feature  
> Resultado esperado: conflictos del Grupo 1 resueltos y listos para revisión, sin adelantar decisiones del Grupo 2 en adelante.

## Cierre

Diagnóstico final:

- **Alineado con una resolución conservadora por grupos**
- **Desaconsejado** resolver todos los archivos en una sola pasada
- **Alta probabilidad de regresión funcional** si se mezcla el contrato Email de create/prepare con el selector compartido antes de fijar la semántica final

Nivel de certeza del diagnóstico: **alto** para clasificación de riesgo y orden de trabajo; **medio-alto** para la estrategia fina por archivo, porque la validación definitiva depende de la resolución manual y de las pruebas posteriores.
