# REPORTE — Auditoría de alineación documentación vs código — 2026-03-22

**Destino (path):** `docs/05-REPORTES/2026-03/REPORTE-AUDITORIA-ALINEACION-DOCUMENTACION-VS-CODIGO-2026-03-22.md`

---

## 1. Objetivo

Verificar si la documentación principal de `leadmaster-workspace` refleja el estado real del código y de la arquitectura operativa observada en:

- `services/central-hub`
- `services/session-manager`
- `services/mailer`
- `services/central-hub/frontend`
- `docs/`

La auditoría busca detectar:

1. fases mal clasificadas
2. afirmaciones marcadas como completadas sin respaldo suficiente en código
3. contradicciones entre contratos, integración y rutas reales
4. documentos que describen arquitectura objetivo como si fuera arquitectura ya implementada
5. pendientes reales no reflejados o riesgos documentales relevantes

---

## 2. Criterio de verdad usado

Para esta auditoría se toma como verdad actual, por encima de la narrativa documental, lo siguiente:

- código ejecutable presente en el repositorio
- puntos de montaje reales en `services/central-hub/src/index.js`
- contratos efectivamente implementados en rutas/controllers/services
- dependencias declaradas en los `package.json`
- presencia de artefactos y módulos que evidencian responsabilidades aún no extraídas

La documentación se clasifica contra esa verdad en cuatro estados:

- **Alineado**: coincide materialmente con el código actual
- **Parcialmente alineado**: mezcla verdad actual con simplificaciones, huecos o lenguaje ambiguo
- **Desalineado**: contradice el código actual o presenta target-state como hecho
- **No verificable**: la afirmación no pudo confirmarse sólo con el repositorio inspeccionado

---

## 3. Alcance auditado

### Documentos revisados

- `PROJECT-STATUS.md`
- `docs/01-CONSTITUCIONAL/PROJECT_STATUS.md`
- `docs/02-ARQUITECTURA/Guía De Arquitectura Y Migración – Lead Master Workspace`
- `docs/04-INTEGRACION/Integration-CentralHub-SessionManager.md`
- `docs/06-FASES/PHASE-2-COMPLETED.md`
- `docs/06-FASES/PHASE-3-PROSPECT-QUALITY.md`
- `docs/07-CONTRATOS/Contratos-HTTP-LeadMaster-Workspace.md`

### Nota de alcance pedida vs realidad del repo

No existe un archivo con nombre exacto `docs/06-FASES/PHASE-3-PLAN.md`.

El documento canónico equivalente encontrado en el repositorio es:

- `docs/06-FASES/PHASE-3-PROSPECT-QUALITY.md`

### Código revisado como evidencia

- `services/central-hub/package.json`
- `services/central-hub/src/index.js`
- `services/central-hub/src/modules/auth/routes/authRoutes.js`
- `services/central-hub/src/modules/listener/routes/listenerRoutes.js`
- `services/central-hub/src/modules/session-manager/routes/*`
- `services/central-hub/src/modules/session-manager/services/*`
- `services/central-hub/src/integrations/sessionManager/sessionManagerClient.js`
- `services/central-hub/src/integrations/mailer/mailerClient.js`
- `services/central-hub/src/routes/whatsappQrProxy.js`
- `services/central-hub/src/routes/whatsappSessionProxyV2.js`
- `services/central-hub/src/routes/qrCodeProxy.js`
- `services/central-hub/frontend/src/*` relevante a auth y WhatsApp
- `services/session-manager/index.js`
- `services/session-manager/app.js`
- `services/session-manager/routes/api.js`
- `services/session-manager/whatsapp/wwebjs-session.js`
- `services/mailer/package.json`
- `services/mailer/src/app.js`
- `services/mailer/src/routes/healthRoutes.js`
- `services/mailer/src/routes/mailerRoutes.js`

---

## 4. Resumen ejecutivo

Conclusión general:

- la documentación **no está uniformemente alineada** con el estado real del código
- los documentos de **contratos e integración** entre `central-hub`, `session-manager` y `mailer` están en general **mejor alineados** con la implementación actual
- el documento de **arquitectura y migración** está **fuertemente desalineado** si se lo lee como estado presente
- `PHASE-2-COMPLETED.md` está **parcialmente alineado**: describe correctamente una fase cerrada de infraestructura y SPA, pero documenta rutas y validaciones con paths que ya no son los paths reales expuestos por `central-hub`
- el estado constitucional de fases (`Phase 3` activa, `Phase 4` planificada) está **alineado en lo macro**, pero coexiste con restos técnicos legacy dentro de `central-hub` que impiden afirmar una separación arquitectónica completamente consolidada

Hallazgo estructural principal:

- el repositorio actual opera como **modular monolith + servicios auxiliares**, no como la arquitectura objetivo plenamente desacoplada descripta en la guía de migración

---

## 5. Matriz de alineación por documento

| Documento | Estado | Hallazgo principal |
|---|---|---|
| `PROJECT-STATUS.md` | Alineado | El foco en Email/Mailer coincide con código real y con el estado operativo resumido documentado. |
| `docs/01-CONSTITUCIONAL/PROJECT_STATUS.md` | Parcialmente alineado | La estructura de fases es razonable, pero convive con código legacy de WhatsApp dentro de `central-hub` que relativiza la pureza de la separación actual. |
| `docs/02-ARQUITECTURA/Guía De Arquitectura Y Migración – Lead Master Workspace` | Desalineado | Describe como estructura oficial y estado de migración una topología de servicios que no coincide con el árbol real del repo ni con el grado real de desacople. |
| `docs/04-INTEGRACION/Integration-CentralHub-SessionManager.md` | Parcialmente alineado | Acierta en el modelo as-is single-admin y en los endpoints principales, pero sobre-declara requisitos de JWT en listener que el código no impone realmente. |
| `docs/06-FASES/PHASE-2-COMPLETED.md` | Parcialmente alineado | La fase de infra/auth/proxy/frontend parece realmente cerrada, pero varios paths documentados (`/auth`, `/session-manager`) no coinciden con los mounts reales (`/api/auth`, `/api/session-manager`). |
| `docs/06-FASES/PHASE-3-PROSPECT-QUALITY.md` | Parcialmente alineado | La clasificación de fase activa está bien, pero no se observó en esta auditoría evidencia suficiente para confirmar implementados todos los entregables declarados como expectativa. |
| `docs/07-CONTRATOS/Contratos-HTTP-LeadMaster-Workspace.md` | Parcialmente alineado | Refleja bien el contrato actual single-admin y diferencia objetivo futuro vs as-is, pero mezcla algunas exigencias y responsabilidades que no están cerradas igual en código. |

---

## 6. Hallazgos críticos

### 6.1 La guía de arquitectura documenta una estructura oficial que no coincide con el repositorio real

Documento auditado:

- `docs/02-ARQUITECTURA/Guía De Arquitectura Y Migración – Lead Master Workspace`

Afirmaciones documentadas:

- la estructura oficial del workspace incluye `services/leadmaster-central-hub/`, `services/listener/` y `services/massive-sender/`
- `leadmaster-central-hub` figura como servicio ya integrado dentro de `services/`
- la estrategia describe una migración hacia `session-manager` multicliente con una instancia por cliente como siguiente paso operativo

Evidencia real en código:

- el path real es `services/central-hub/`, no `services/leadmaster-central-hub/`
- no existen carpetas top-level `services/listener/` ni `services/massive-sender/`
- `central-hub` todavía contiene internamente módulos `listener` y `sender`
- `central-hub` todavía declara dependencia directa `whatsapp-web.js`
- `central-hub` todavía contiene un módulo local `src/modules/session-manager/services/sessionService.js` con `Client` y `LocalAuth`
- existen artefactos locales de sesión en `services/central-hub/src/tokens/session-client_51/...`

Conclusión:

- este documento **no describe el estado real implementado**; describe una mezcla de arquitectura objetivo, estrategia de migración y nomenclatura vieja

Impacto:

- alto riesgo de que un lector asuma desacople completo cuando el código muestra coexistencia entre integración HTTP nueva y responsabilidades legacy aún presentes en `central-hub`

---

### 6.2 `central-hub` expone rutas reales bajo `/api/*`, pero parte de la documentación de fase sigue usando paths sin prefijo `/api`

Documento auditado:

- `docs/06-FASES/PHASE-2-COMPLETED.md`

Afirmaciones documentadas:

- proxy y validaciones descritas sobre `/auth`, `/session-manager`, `/health`
- ejemplos de login usando `http://localhost:3012/auth/login`
- flujo de request usando `https://dominio/auth/login` y `https://dominio/session-manager/status`

Evidencia real en código:

- `services/central-hub/src/index.js` monta `app.use('/api/auth', ...)`
- `services/central-hub/src/index.js` monta `app.use('/api/session-manager', ...)`
- `services/central-hub/src/index.js` monta `app.use('/api/listener', ...)`, `app.use('/api/sender', ...)`, `app.use('/api/email', ...)`
- sólo algunas rutas conservan compatibilidad fuera de `/api`, por ejemplo `/health`, `/mailer`, `/qr-code`

Conclusión:

- el documento preserva correctamente el sentido de la fase cerrada, pero **no refleja la superficie HTTP actual exacta**

Impacto:

- provoca errores operativos si se usa el documento como guía literal de testing manual o de configuración de reverse proxy

---

### 6.3 La integración `central-hub` ↔ `session-manager` está bien documentada como single-admin as-is, pero el listener no exige en código el nivel de auth que la documentación presenta como obligatorio

Documentos auditados:

- `docs/04-INTEGRACION/Integration-CentralHub-SessionManager.md`
- `docs/07-CONTRATOS/Contratos-HTTP-LeadMaster-Workspace.md`

Afirmación documental:

- `POST /api/listener/incoming-message` y `POST /api/listener/outgoing-message` requieren `Authorization: Bearer <jwt>` de forma obligatoria

Evidencia real en código:

- en `services/central-hub/src/modules/listener/routes/listenerRoutes.js` ambos endpoints se montan **antes** de `router.use(authenticate)`
- el comentario del propio código dice: `Sin JWT para no romper integración`
- la única protección efectiva de esos endpoints es `X-Internal-Token` **si** existe `INTERNAL_LISTENER_TOKEN`
- si `INTERNAL_LISTENER_TOKEN` no está configurado, la ruta queda accesible sin JWT y sin ese guard adicional

Conclusión:

- la documentación está **más estricta que el código real**

Impacto:

- riesgo de falsa sensación de seguridad contractual
- riesgo de que operaciones y auditorías externas asuman un control de autenticación que hoy no es forzoso en runtime

---

### 6.4 El repositorio convive con dos modelos de WhatsApp en `central-hub`, pero la documentación no siempre explicita esa coexistencia

Evidencia real en código:

- `services/central-hub/src/routes/whatsappQrProxy.js` mantiene proxy legacy `GET /api/whatsapp/:clienteId/status` y `GET /api/whatsapp/:clienteId/qr`
- `services/central-hub/src/routes/whatsappSessionProxyV2.js` expone un contrato limpio temporal bajo `/api/whatsapp-v2`
- `services/central-hub/src/routes/adminWhatsapp.routes.js` expone administración single-admin bajo `/api/admin/whatsapp/*`
- `services/central-hub/src/modules/session-manager/routes/session.js` conserva otra capa autenticada interna bajo `/api/session-manager/*`
- el frontend contiene `SessionManager.jsx` y `WhatsappSessionV2.jsx`, evidenciando coexistencia de interfaces y no una única frontera estable consolidada

Conclusión:

- existe una **superficie de transición** y no una única API de WhatsApp totalmente estabilizada y simplificada

Impacto:

- la documentación debería explicitar cuál interfaz es legacy, cuál es transitional y cuál debe considerarse canónica hoy

---

## 7. Hallazgos relevantes no críticos

### 7.1 `PROJECT-STATUS.md` está razonablemente alineado con el estado de Email/Mailer

Evidencia a favor:

- `services/mailer/src/app.js` monta `GET /health` y `POST /send`
- `services/central-hub/src/modules/mailer/routes/index.js` aplica `authenticate`
- `services/central-hub/src/modules/mailer/routes/mailer.routes.js` expone `POST /mailer/send`
- `services/central-hub/src/modules/mailer/services/mailer.service.js` resuelve `cliente_id` desde JWT, no desde el body

Conclusión:

- el status operativo resumido del canal Email y del standalone Mailer está **alineado** con la implementación inspeccionada

---

### 7.2 La clasificación macro de fases del documento constitucional es útil, pero debe convivir con una nota más explícita sobre deuda legacy

Documento auditado:

- `docs/01-CONSTITUCIONAL/PROJECT_STATUS.md`

Evidencia a favor:

- `Phase 3` activa y `Phase 4` planificada resultan coherentes como marco estratégico
- el propio documento ya reconoce que el estado actual de WhatsApp sigue siendo single-admin y legacy/uppercase

Reserva:

- el código muestra que no sólo persiste un contrato legacy, sino también **código de sesión local y tokens** dentro de `central-hub`

Conclusión:

- el documento es **parcialmente alineado**: correcto como brújula estratégica, incompleto como reflejo exacto de la consolidación técnica real

---

### 7.3 `PHASE-3-PROSPECT-QUALITY.md` ordena bien la fase, pero no puede darse por “respaldado en código” sólo por existir el documento

Documento auditado:

- `docs/06-FASES/PHASE-3-PROSPECT-QUALITY.md`

Observación:

- el documento define entregables claros para scoring, enforcement, workflow manual y trazabilidad
- durante esta auditoría no se reunió evidencia suficiente para afirmar que todos esos entregables estén completos de punta a punta en código

Conclusión:

- no se detecta contradicción frontal con el repo, pero sí una **brecha de verificabilidad**

Acción recomendada:

- acompañar el doc de fase con un reporte técnico de implementación o un checklist verificable por módulo

---

## 8. Matriz de afirmaciones vs evidencia

| Afirmación documental | Evidencia en código | Estado |
|---|---|---|
| `session-manager` actual es single-admin | `services/session-manager/routes/api.js` y `services/session-manager/whatsapp/wwebjs-session.js` usan sesión `admin` única | Alineado |
| `instance_id` es planned y no implementado hoy | No se observan rutas multi-instancia reales en `services/session-manager` | Alineado |
| `central-hub` consume `session-manager` por HTTP | Existe `services/central-hub/src/integrations/sessionManager/sessionManagerClient.js` | Alineado |
| `listener` requiere JWT obligatorio para bridge interno | `services/central-hub/src/modules/listener/routes/listenerRoutes.js` deja `incoming-message` y `outgoing-message` fuera de `authenticate` | Desalineado |
| Phase 2 cerró auth + SPA + proxy + despliegue | Repo contiene frontend React/Vite real, auth JWT y mounts productivos | Parcialmente alineado |
| Paths operativos de auth/session-manager son `/auth/*` y `/session-manager/*` | Mounts actuales son `/api/auth/*` y `/api/session-manager/*` | Desalineado |
| Arquitectura oficial ya está separada en `leadmaster-central-hub`, `listener`, `massive-sender` | El repo real mantiene `sender` y `listener` dentro de `services/central-hub` | Desalineado |
| `central-hub` ya no maneja WhatsApp directamente | Sigue habiendo módulo local `sessionService.js` con `whatsapp-web.js`, `LocalAuth` y tokens locales | Desalineado |
| Mailer standalone y gateway autenticado están implementados | `services/mailer/src/*` y `services/central-hub/src/modules/mailer/*` lo respaldan | Alineado |

---

## 9. Pendientes reales que la documentación debería reflejar mejor

1. Coexistencia de arquitectura actual vs arquitectura objetivo.
   Hoy la documentación mezcla ambos planos en distintos documentos y eso dificulta saber qué es plan, qué es transición y qué es estado operativo real.

2. Normalización de contratos WhatsApp.
   Existen al menos cuatro superficies relacionadas con WhatsApp en `central-hub`: legacy proxy, V2 proxy, admin proxy y módulo `session-manager` interno.

3. Estado real del desacople.
   Aunque existe integración HTTP con `session-manager`, `central-hub` conserva dependencias, código y artefactos de sesión locales que muestran que el desacople no está totalmente consolidado.

4. Seguridad real del bridge de listener.
   La documentación lo presenta como JWT-obligatorio, pero la implementación deja una apertura condicional basada en `INTERNAL_LISTENER_TOKEN`.

5. Evidencia automatizada de contratos.
   No se encontraron tests automatizados específicos en `services/session-manager`, `services/mailer` ni en los módulos de `central-hub` relacionados con estos contratos, lo que vuelve más frágil declarar “verified” o “aligned” sin aclaración adicional.

---

## 10. Documentos que conviene corregir primero

Orden recomendado:

1. `docs/02-ARQUITECTURA/Guía De Arquitectura Y Migración – Lead Master Workspace`
   
   Motivo: hoy es la mayor fuente de confusión entre arquitectura objetivo y arquitectura realmente implementada.

2. `docs/06-FASES/PHASE-2-COMPLETED.md`
   
   Motivo: debe conservar el cierre histórico de la fase, pero corregir los paths operativos documentados para no inducir testing incorrecto.

3. `docs/04-INTEGRACION/Integration-CentralHub-SessionManager.md`
   
   Motivo: debe declarar con precisión la seguridad real del bridge listener y distinguir exigencia deseada vs enforcement actual.

4. `docs/07-CONTRATOS/Contratos-HTTP-LeadMaster-Workspace.md`
   
   Motivo: conviene separar más explícitamente contrato vigente, capa transitional y target contractual futuro.

5. `docs/01-CONSTITUCIONAL/PROJECT_STATUS.md`
   
   Motivo: mantener la estrategia actual pero sumar una nota corta sobre deuda legacy de desacople WhatsApp aún abierta.

---

## 11. Recomendación documental concreta

Para evitar seguir mezclando target-state con realidad operativa, conviene imponer tres etiquetas documentales fijas en todos los docs técnicos de arquitectura e integración:

- **AS-IS IMPLEMENTADO**
- **TRANSICIONAL / LEGACY SOPORTADO**
- **TARGET / PLANNED**

La mayor parte de la desalineación observada no proviene de una documentación “falsa” en sentido estricto, sino de documentos que siguen siendo útiles pero ya no indican con suficiente claridad **en qué tiempo arquitectónico están hablando**.

---

## 12. Conclusión final

El estado documental del proyecto es mixto.

Lo más alineado hoy:

- estado operativo resumido de Email/Mailer
- contrato as-is de `session-manager` como single-admin
- existencia de integración HTTP real entre `central-hub` y `session-manager`

Lo más desalineado hoy:

- guía de arquitectura y migración
- paths exactos documentados en Phase 2
- nivel de seguridad realmente exigido en los endpoints bridge del listener
- grado de desacople realmente alcanzado entre `central-hub` y la capa WhatsApp

Diagnóstico corto:

- **la documentación estratégica va en la dirección correcta, pero la documentación arquitectónica/operativa todavía sobre-representa el estado objetivo y sub-representa la coexistencia legacy real del código**

Este reporte no modifica documentos existentes. Su función es dejar trazable qué piezas están alineadas, cuáles requieren corrección y por qué.