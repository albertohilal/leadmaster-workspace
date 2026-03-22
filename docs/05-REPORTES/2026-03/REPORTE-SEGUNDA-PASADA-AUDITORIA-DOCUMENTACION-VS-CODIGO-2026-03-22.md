# AUDITORÍA DE SEGUNDA PASADA — ALINEACIÓN DOCUMENTACIÓN VS CÓDIGO

## 1. Objetivo de esta segunda pasada

Esta segunda pasada tiene un objetivo distinto al informe anterior: no sólo detectar desalineaciones, sino convertir ese diagnóstico en una clasificación documental precisa y en un plan de remediación utilizable por el equipo.

Se auditó nuevamente:

- el conjunto documental pedido por alcance
- el propio informe previo
- código real en `services/central-hub`, `services/session-manager`, `services/mailer` y frontend relevante
- pruebas y documentación local adicional dentro de `services/central-hub/docs` y `services/central-hub/tests` cuando aportaban evidencia o contraprueba

Regla aplicada en esta segunda pasada:

- no se equipara automáticamente “deuda técnica” con “desalineación documental”
- no se equipara “fase macro correcta” con “implementación completa de todos sus entregables”
- no se equipara “target-state bien pensado” con “estado operativo vigente”

Fuentes de evidencia usadas con mayor peso:

- `services/central-hub/src/index.js`
- `services/central-hub/package.json`
- `services/central-hub/src/modules/**`
- `services/central-hub/src/integrations/**`
- `services/session-manager/routes/api.js`
- `services/session-manager/whatsapp/wwebjs-session.js`
- `services/mailer/src/app.js`
- `services/mailer/src/routes/*`
- `services/central-hub/tests/*` relevantes
- `docs/01-CONSTITUCIONAL/SYSTEM_BOUNDARIES.md`
- `docs/01-CONSTITUCIONAL/ARCHITECTURE_STATE_2026_02.md`

Conclusión metodológica central de esta segunda pasada:

- el informe previo acertó en la dirección general del problema, pero mezcló algunos hallazgos de certeza alta con otros que requerían más matiz probatorio

---

## 2. Validación del informe previo

### Conclusiones sólidas

1. La guía de arquitectura y migración no describe el estado implementado actual.

   Evidencia sólida:

   - `docs/02-ARQUITECTURA/Guía De Arquitectura Y Migración – Lead Master Workspace` define como estructura oficial `services/leadmaster-central-hub/`, `services/listener/` y `services/massive-sender/`
   - el árbol real del repo usa `services/central-hub/`
   - no existen `services/listener/` ni `services/massive-sender/` como servicios top-level en el workspace actual
   - `services/central-hub/src/modules/listener/*` y `services/central-hub/src/modules/sender/*` siguen viviendo dentro de `central-hub`

   Validación: **sólida**.

2. El repo actual no corresponde a una arquitectura plenamente desacoplada como la blueprint de migración.

   Evidencia sólida:

   - `services/central-hub/package.json` declara dependencia directa `whatsapp-web.js`
   - `services/central-hub/src/modules/session-manager/services/sessionService.js` instancia `Client` y `LocalAuth`
   - `services/central-hub/src/tokens/session-client_51/...` contiene artefactos locales de sesión
   - simultáneamente existe un cliente HTTP hacia `session-manager` en `services/central-hub/src/integrations/sessionManager/sessionManagerClient.js`

   Validación: **sólida**.

3. El contrato as-is de `session-manager` es single-admin y no multi-instancia.

   Evidencia sólida:

   - `services/session-manager/routes/api.js` expone `GET /health`, `GET /status`, `GET /qr`, `POST /connect`, `POST /disconnect`
   - `services/session-manager/whatsapp/wwebjs-session.js` usa `SESSION_NAME = 'admin'`
   - no existen rutas reales con `instance_id`
   - `docs/07-CONTRATOS/Contratos-HTTP-LeadMaster-Workspace.md` y `docs/01-CONSTITUCIONAL/SYSTEM_BOUNDARIES.md` describen explícitamente ese AS-IS

   Validación: **sólida**.

4. Parte de la documentación de integración/contratos diferencia correctamente AS-IS y target.

   Evidencia sólida:

   - `docs/07-CONTRATOS/Contratos-HTTP-LeadMaster-Workspace.md` distingue single-admin actual vs `instance_id` planned
   - `docs/01-CONSTITUCIONAL/SYSTEM_BOUNDARIES.md` congela el contrato AS-IS y separa planned
   - `docs/01-CONSTITUCIONAL/ARCHITECTURE_STATE_2026_02.md` intenta separar “Reality Snapshot — IMPLEMENTED” de “Target Invariants — PLANNED TARGET`

   Validación: **sólida**, con una reserva de calidad editorial sobre `ARCHITECTURE_STATE_2026_02.md` explicada más abajo.

5. `PHASE-2-COMPLETED.md` no es confiable como referencia literal de paths HTTP actuales.

   Evidencia sólida:

   - `docs/06-FASES/PHASE-2-COMPLETED.md` usa `/auth/login` y `/session-manager/status`
   - `services/central-hub/src/index.js` monta `/api/auth` y `/api/session-manager`
   - documentación operativa local más reciente como `services/central-hub/docs/BUGFIX_WHATSAPP_FRONTEND_API_ROUTING.md` ya usa `/api/auth/login`

   Validación: **sólida**.

6. El estado de Email/Mailer resumido en `PROJECT-STATUS.md` está respaldado por código.

   Evidencia sólida:

   - `services/mailer/src/app.js` monta `healthRoutes` y `mailerRoutes`
   - `services/mailer/src/routes/healthRoutes.js` expone `GET /health`
   - `services/mailer/src/routes/mailerRoutes.js` expone `POST /send`
   - `services/central-hub/src/modules/mailer/routes/index.js` requiere autenticación
   - `services/central-hub/src/modules/mailer/routes/mailer.routes.js` expone `POST /mailer/send`
   - `services/central-hub/src/modules/mailer/controllers/mailer.controller.js` resuelve `cliente_id` desde JWT

   Validación: **sólida**.

### Conclusiones plausibles pero incompletas

1. “La documentación de contratos e integración está mejor alineada que la de arquitectura.”

   Esto sigue siendo plausible y en general correcto, pero requiere matiz:

   - es cierto frente a la guía de migración
   - no significa que contratos e integración sean completamente canónicos o exhaustivos
   - algunos documentos contractuales conviven con blueprints paralelos dentro de `services/central-hub/docs/SESSION_MANAGER_API_CONTRACT.md` y `services/central-hub/docs/CONTRACT_IMPLEMENTATION_REPORT.md` que ya no representan el AS-IS vigente

   Veredicto: **plausible, pero debe acotarse**.

2. “Phase 3 está bien clasificada, pero falta evidencia técnica.”

   Esto sigue siendo correcto, pero ahora tiene mejor fundamento:

   - `docs/06-FASES/PHASE-3-PROSPECT-QUALITY.md` y `docs/01-CONSTITUCIONAL/PROJECT_STATUS.md` ubican correctamente la fase a nivel macro
   - `docs/01-CONSTITUCIONAL/SYSTEM_BOUNDARIES.md` asigna al sender responsabilidades de scoring/contactabilidad/auditoría
   - en `services/central-hub/src/**` no apareció evidencia directa de `score_contactabilidad` ni `validado_tecnicamente`
   - en docs históricas o drafts sí aparecen, por ejemplo `docs/99-ARCHIVO/PROJECT_STATUS_TECHNICAL_v2.md` y `docs/06-FASES/PHASE-5-COMMERCIAL-INTELLIGENCE-LEGACY-DRAFT.md`

   Veredicto: **plausible, pero requiere inspección adicional** si se quiere concluir grado de implementación real de la fase.

3. “Existe una superficie de transición en WhatsApp.”

   Plausible y respaldada, pero conviene formularla de manera más precisa:

   - hay coexistencia entre rutas legacy, rutas internas autenticadas, proxy V2 y contratos target-state documentados
   - no todas esas superficies tienen el mismo rango ni el mismo estado de vigencia

   Veredicto: **plausible y útil, pero necesita clasificación explícita por superficie**.

### Conclusiones que deben corregirse o acotarse

1. La afirmación del informe previo sobre ausencia de tests automatizados específicos debe corregirse.

   Corrección:

   - sí existen tests relevantes en `services/central-hub/tests/`
   - se encontraron al menos `session-manager.api.spec.ts`, `listener.api.spec.ts`, `listener.guardrails.spec.ts`, `sender.api.spec.ts`, `campaign-send.integration.test.js`

   Acotación necesaria:

   - la existencia de estos tests no los vuelve automáticamente evidencia canónica del contrato actual
   - varios apuntan a paths legacy o transicionales, por ejemplo `services/central-hub/tests/session-manager.api.spec.ts` usa `/auth/login` y `/session-manager/*` sin prefijo `/api`

   Reformulación correcta:

   - **sí hay tests específicos**, pero su valor probatorio es **parcial** porque parte del set parece anclado a rutas o supuestos previos

2. La conclusión “`docs/07-CONTRATOS/Contratos-HTTP-LeadMaster-Workspace.md` está parcialmente alineado” debe acotarse más finamente.

   Ajuste:

   - para el AS-IS de `session-manager`, el documento está mejor alineado de lo que sugería el informe previo
   - donde pierde precisión no es tanto en la descripción del contrato single-admin, sino en algunas reglas de seguridad/responsabilidad que no coinciden de forma exacta con la implementación real del listener bridge

   Reformulación correcta:

   - **alineado en el núcleo del contrato AS-IS de `session-manager`; parcialmente alineado en integración y controles periféricos**

3. La conclusión sobre obligatoriedad de JWT en listener bridge debe reformularse con más precisión.

   El informe previo dijo, en sustancia, que la documentación sobredeclara JWT.

   Acotación necesaria:

   - esto es cierto para la implementación efectiva de `incoming-message` y `outgoing-message` en `services/central-hub/src/modules/listener/routes/listenerRoutes.js`
   - pero hay otra pieza de evidencia: `services/session-manager/whatsapp/wwebjs-session.js` sí implementa login JWT hacia `POST /api/auth/login` y luego envía bearer token al listener
   - por lo tanto, el sistema parece diseñado para usar JWT, pero el enforcement real del lado receptor queda relajado por compatibilidad

   Reformulación correcta:

   - **el diseño operativo usa JWT, pero el enforcement del receptor no es obligatorio de forma dura en todos los casos**

4. La clasificación de `docs/01-CONSTITUCIONAL/PROJECT_STATUS.md` como “parcialmente alineado” debe sostenerse, pero no por la razón implícita de que la estrategia esté mal.

   Acotación:

   - la macrofase está bien
   - lo incompleto es el reflejo de la deuda legacy y de la transición real de WhatsApp
   - no corresponde leer ese documento como arquitectura operativa detallada

   Reformulación correcta:

   - **canónico para estrategia/fases; insuficiente como fuente operativa del AS-IS técnico detallado**

5. La calidad del propio informe previo debe corregirse en un punto metodológico.

   Observación:

   - el informe anterior fue útil como diagnóstico rápido
   - pero usó una taxonomía única de “alineado/parcial/desalineado” para documentos de naturalezas muy distintas, sin separar siempre rol documental de exactitud factual

   Reformulación correcta:

   - en esta segunda pasada se distingue explícitamente entre:
     - canónico vigente
     - histórico válido
     - target-state / blueprint
     - desactualizado crítico

---

## 3. Clasificación documental

### `PROJECT-STATUS.md`

- Tipo: **Canónico vigente**
- Utilidad real: resume correctamente el estado operativo actual del canal Email/Mailer a nivel workspace
- Riesgo de uso incorrecto: medio; puede sobre-interpretarse como status global del workspace cuando su foco real es Email/Mailer
- Acción recomendada: conservar como canónico operativo temático y explicitar en el encabezado que es un status operativo parcial centrado en Email/Mailer

### `docs/01-CONSTITUCIONAL/PROJECT_STATUS.md`

- Tipo: **Canónico vigente**
- Utilidad real: define estrategia, fases macro y postura constitucional del proyecto
- Riesgo de uso incorrecto: medio; no debe usarse como fuente detallada de contratos, rutas ni superficie HTTP real
- Acción recomendada: conservar como canon estratégico y agregar referencia explícita a la deuda legacy/transicional de WhatsApp y a la fuente técnica AS-IS recomendada

### `docs/02-ARQUITECTURA/Guía De Arquitectura Y Migración – Lead Master Workspace`

- Tipo: **Target-state**
- Utilidad real: blueprint de migración y visión de desacople, útil para dirección técnica futura
- Riesgo de uso incorrecto: alto; hoy es peligroso si se toma como descripción literal del estado del repo
- Acción recomendada: re-etiquetarlo explícitamente como blueprint/target-state, separar lo histórico de lo planificado y eliminar cualquier redacción que lo haga parecer estructura oficial vigente

### `docs/04-INTEGRACION/Integration-CentralHub-SessionManager.md`

- Tipo: **Canónico vigente**
- Utilidad real: es el mejor documento global para describir la integración AS-IS `central-hub` ↔ `session-manager`
- Riesgo de uso incorrecto: medio; hoy sobrepresenta algunas exigencias de seguridad o responsabilidades como si estuvieran plenamente endurecidas en código
- Acción recomendada: corregir seguridad real del listener bridge, distinguir claramente “enforced hoy” vs “requerido por política objetivo”

### `docs/06-FASES/PHASE-2-COMPLETED.md`

- Tipo: **Histórico válido**
- Utilidad real: registra cierre histórico de la fase de infra/auth/proxy/frontend
- Riesgo de uso incorrecto: alto; si se usa como guía operativa actual puede inducir pruebas y configuración sobre paths viejos
- Acción recomendada: conservar como histórico, agregar nota visible de “no usar como fuente de paths HTTP vigentes” o corregir anexando una nota de actualización

### `docs/06-FASES/PHASE-3-PROSPECT-QUALITY.md`

- Tipo: **Canónico vigente**
- Utilidad real: define el alcance y los entregables esperados de la fase actual a nivel documental
- Riesgo de uso incorrecto: medio; no debe leerse como evidencia de implementación completa
- Acción recomendada: mantenerlo como documento de fase y vincularlo a un reporte técnico verificable de implementación real

### `docs/07-CONTRATOS/Contratos-HTTP-LeadMaster-Workspace.md`

- Tipo: **Canónico vigente**
- Utilidad real: mejor documento global para el contrato HTTP AS-IS entre servicios, especialmente para `session-manager`
- Riesgo de uso incorrecto: medio; convive con blueprints y contratos internos de servicio que pueden contradecirlo o mezclar target-state
- Acción recomendada: consolidarlo como contrato canónico AS-IS y referenciar explícitamente qué documentos quedan como target-state o legacy

### `docs/05-REPORTES/2026-03/REPORTE-AUDITORIA-ALINEACION-DOCUMENTACION-VS-CODIGO-2026-03-22.md`

- Tipo: **Histórico válido**
- Utilidad real: diagnóstico inicial útil para descubrir el problema y orientar la segunda pasada
- Riesgo de uso incorrecto: medio; no debe tomarse como versión final del diagnóstico porque sobre-generaliza algunos puntos, especialmente el tema de tests y la taxonomía documental
- Acción recomendada: conservar como informe base y considerarlo supersedido analíticamente por esta segunda pasada

### Documentos complementarios relevantes encontrados fuera del alcance principal

#### `docs/01-CONSTITUCIONAL/SYSTEM_BOUNDARIES.md`

- Tipo: **Canónico vigente**
- Utilidad real: uno de los mejores documentos para separar responsabilidades AS-IS, especialmente en WhatsApp layer
- Riesgo de uso incorrecto: bajo a medio; debe usarse junto con contratos, no como reemplazo de ellos
- Acción recomendada: elevarlo explícitamente como fuente de verdad complementaria al estado actual

#### `docs/01-CONSTITUCIONAL/ARCHITECTURE_STATE_2026_02.md`

- Tipo: **Otro**
- Utilidad real: mezcla snapshot AS-IS con target-state congelado; útil como borrador conceptual, no como contrato operativo puro
- Riesgo de uso incorrecto: alto; contiene texto de generación asistida, referencias editoriales y recomendaciones de “qué hacer después” impropias de un documento constitucional final
- Acción recomendada: no usarlo como fuente operativa hasta depurarlo o reemplazarlo por un documento contractual limpio

#### `services/central-hub/docs/BUGFIX_WHATSAPP_FRONTEND_API_ROUTING.md`

- Tipo: **Histórico válido**
- Utilidad real: evidencia operativa local de que `/api/auth/login` y routing con `/api` ya eran la convención vigente
- Riesgo de uso incorrecto: medio; es un bugfix/report, no un contrato ni documento canónico del workspace
- Acción recomendada: usarlo como evidencia secundaria, no como fuente primaria

#### `services/central-hub/docs/ENDPOINTS_SESSION_MANAGER.md`

- Tipo: **Desactualizado crítico**
- Utilidad real: muy baja; describe el módulo interno `/session-manager/*` de `central-hub`
- Riesgo de uso incorrecto: alto; puede confundirse con el contrato real del servicio `session-manager`
- Acción recomendada: marcar como histórico local o retirar de circulación operativa

#### `services/central-hub/docs/SESSION_MANAGER_API_CONTRACT.md`

- Tipo: **Target-state**
- Utilidad real: blueprint contractual interno basado en `instance_id`, enums congelados y `/api/session-manager/sessions/:instance_id`
- Riesgo de uso incorrecto: crítico; contradice el AS-IS implementado en el servicio `session-manager`
- Acción recomendada: reubicarlo explícitamente como target-state o archivarlo como blueprint

#### `services/central-hub/docs/CONTRACT_IMPLEMENTATION_REPORT.md`

- Tipo: **Histórico válido**
- Utilidad real: documenta un intento o fase de adopción de contrato target-state dentro de `central-hub`
- Riesgo de uso incorrecto: alto; puede interpretarse como implementación vigente cerrada cuando el AS-IS actual demuestra otra cosa
- Acción recomendada: mantenerlo como histórico de intervención y vincularlo a su contexto temporal

---

## 4. Matriz reforzada de evidencia

### Hallazgo 1

- Hallazgo: la guía de arquitectura y migración describe target-state, no estado implementado actual
- Evidencia documental: `docs/02-ARQUITECTURA/Guía De Arquitectura Y Migración – Lead Master Workspace` define `services/leadmaster-central-hub/`, `services/listener/`, `services/massive-sender/`
- Evidencia en código: el repo real usa `services/central-hub/`; `listener` y `sender` siguen dentro de `services/central-hub/src/modules/*`; no existen servicios top-level `listener` ni `massive-sender`
- Nivel de certeza: **Alto**
- Estado: **Desalineado**
- Acción sugerida: re-etiquetar como blueprint/target-state y corregir nomenclatura/estado de migración

### Hallazgo 2

- Hallazgo: `central-hub` aún conserva responsabilidad técnica local sobre WhatsApp además de integrar `session-manager` por HTTP
- Evidencia documental: el informe previo lo señaló; `docs/01-CONSTITUCIONAL/PROJECT_STATUS.md` reconoce estado WhatsApp legacy; `docs/01-CONSTITUCIONAL/SYSTEM_BOUNDARIES.md` establece que `central-hub` no debería administrar lifecycle
- Evidencia en código: `services/central-hub/package.json` depende de `whatsapp-web.js`; `services/central-hub/src/modules/session-manager/services/sessionService.js` usa `Client` y `LocalAuth`; existen tokens en `services/central-hub/src/tokens/...`; también existe cliente HTTP en `services/central-hub/src/integrations/sessionManager/sessionManagerClient.js`
- Nivel de certeza: **Alto**
- Estado: **Desalineado**
- Acción sugerida: documentar explícitamente AS-IS transicional y no presentar el desacople como completado

### Hallazgo 3

- Hallazgo: el contrato AS-IS de `session-manager` como single-admin está correctamente respaldado
- Evidencia documental: `docs/07-CONTRATOS/Contratos-HTTP-LeadMaster-Workspace.md`, `docs/01-CONSTITUCIONAL/SYSTEM_BOUNDARIES.md`, `docs/04-INTEGRACION/Integration-CentralHub-SessionManager.md`
- Evidencia en código: `services/session-manager/routes/api.js`, `services/session-manager/whatsapp/wwebjs-session.js`
- Nivel de certeza: **Alto**
- Estado: **Alineado**
- Acción sugerida: consolidar esos documentos como fuente canónica AS-IS y desplazar blueprints competidores a estado target-state

### Hallazgo 4

- Hallazgo: `PHASE-2-COMPLETED.md` es históricamente válido pero no operativo para paths actuales
- Evidencia documental: usa `/auth/login` y `/session-manager/status` sin `/api`
- Evidencia en código: `services/central-hub/src/index.js` monta `/api/auth` y `/api/session-manager`; `services/central-hub/docs/BUGFIX_WHATSAPP_FRONTEND_API_ROUTING.md` ya opera con `/api/auth/login`
- Nivel de certeza: **Alto**
- Estado: **Parcialmente alineado**
- Acción sugerida: conservar como histórico con advertencia visible o corregir paths con nota de actualización

### Hallazgo 5

- Hallazgo: el listener bridge fue diseñado para usar JWT, pero el enforcement del receptor no es duro hoy
- Evidencia documental: `docs/04-INTEGRACION/Integration-CentralHub-SessionManager.md` y `docs/07-CONTRATOS/Contratos-HTTP-LeadMaster-Workspace.md` describen `Authorization: Bearer <jwt>` como obligatorio
- Evidencia en código: `services/session-manager/whatsapp/wwebjs-session.js` efectivamente hace login a `POST /api/auth/login` y usa Bearer token; pero `services/central-hub/src/modules/listener/routes/listenerRoutes.js` deja `incoming-message` y `outgoing-message` antes de `authenticate`, con guard condicional `INTERNAL_LISTENER_TOKEN`
- Nivel de certeza: **Alto**
- Estado: **Parcialmente alineado**
- Acción sugerida: corregir documentación para distinguir diseño previsto, comportamiento observado y enforcement efectivo

### Hallazgo 6

- Hallazgo: el informe previo sobre-generalizó la ausencia de pruebas específicas
- Evidencia documental: el informe anterior afirmó que no se encontraron tests automatizados específicos para estos contratos
- Evidencia en código: existen `services/central-hub/tests/session-manager.api.spec.ts`, `listener.api.spec.ts`, `listener.guardrails.spec.ts`, `sender.api.spec.ts`, `campaign-send.integration.test.js`
- Nivel de certeza: **Alto**
- Estado: **Desalineado** respecto del informe previo
- Acción sugerida: corregir la conclusión: hay pruebas, pero su valor probatorio es parcial y algunas parecen apuntar a paths legacy o transicionales

### Hallazgo 7

- Hallazgo: `PHASE-3-PROSPECT-QUALITY.md` es correcto como documento de fase, pero no demuestra implementación completa de scoring y gates
- Evidencia documental: el documento define entregables como `score_contactabilidad`, `validado_tecnicamente`, enforcement en sender, workflow manual y audit trail
- Evidencia en código: no apareció evidencia directa de esos términos en `services/central-hub/src/**`, `services/session-manager/**` ni `services/mailer/**`; sí aparecen en documentos históricos o drafts fuera del núcleo actual
- Nivel de certeza: **Medio**
- Estado: **No verificable** para implementación completa; **Alineado** como definición de fase
- Acción sugerida: mantener el documento de fase y crear o referenciar un reporte técnico de implementación verificable

### Hallazgo 8

- Hallazgo: existen documentos internos de servicio que contradicen o compiten con el contrato global vigente
- Evidencia documental: `services/central-hub/docs/SESSION_MANAGER_API_CONTRACT.md`, `services/central-hub/docs/CONTRACT_IMPLEMENTATION_REPORT.md`, `services/central-hub/docs/ENDPOINTS_SESSION_MANAGER.md`
- Evidencia en código: el servicio real `services/session-manager/routes/api.js` no implementa `/api/session-manager/sessions/:instance_id`; el frontend y tests todavía muestran convivencias legacy y transicionales
- Nivel de certeza: **Alto**
- Estado: **Desalineado** si se usan como referencia operativa actual
- Acción sugerida: clasificarlos explícitamente como target-state, históricos o desactualizados críticos

### Hallazgo 9

- Hallazgo: el documento constitucional `SYSTEM_BOUNDARIES.md` está más alineado al AS-IS que la guía de migración
- Evidencia documental: `docs/01-CONSTITUCIONAL/SYSTEM_BOUNDARIES.md` acepta que `listener` puede existir como módulo dentro de `central-hub` o servicio separado; congela AS-IS single-admin y delimita responsabilidades
- Evidencia en código: la topología actual coincide más con ese documento que con la guía de migración, porque `listener` sigue como módulo y `session-manager` sigue single-admin
- Nivel de certeza: **Alto**
- Estado: **Alineado**
- Acción sugerida: elevarlo como fuente de verdad operativa-constitucional complementaria

### Hallazgo 10

- Hallazgo: `ARCHITECTURE_STATE_2026_02.md` no debe tratarse hoy como documento constitucional operativo final
- Evidencia documental: contiene secciones editoriales impropias de documento final, recomendaciones de “qué podés hacer después”, referencias residuales y fuerte mezcla entre AS-IS y target-state
- Evidencia en código: parte del target-state que describe no coincide con el servicio real `session-manager`
- Nivel de certeza: **Alto**
- Estado: **Parcialmente alineado** en snapshot AS-IS, **Desalineado** si se usa como contrato vigente integral
- Acción sugerida: depurarlo o retirarlo de la cadena de referencia operativa

---

## 5. Plan de remediación documental

### Documentos a corregir

1. `docs/04-INTEGRACION/Integration-CentralHub-SessionManager.md`

   Corregir:

   - enforcement real del listener bridge
   - distinción entre “usa JWT” y “requiere JWT de forma dura”
   - mención explícita de superficies legacy/transicionales todavía presentes en `central-hub`

2. `docs/07-CONTRATOS/Contratos-HTTP-LeadMaster-Workspace.md`

   Corregir:

   - status del contrato AS-IS como fuente canónica primaria
   - referencia clara a qué documentos quedan fuera del AS-IS por ser target-state
   - nota operativa sobre coexistencia de capas legacy/transicionales en `central-hub`

3. `docs/01-CONSTITUCIONAL/PROJECT_STATUS.md`

   Corregir:

   - nota corta sobre deuda legacy/transicional en WhatsApp
   - enlace explícito a la fuente técnica AS-IS recomendada

### Documentos a reescribir

1. `docs/02-ARQUITECTURA/Guía De Arquitectura Y Migración – Lead Master Workspace`

   Reescribir como:

   - documento de blueprint y roadmap
   - no como estructura oficial vigente
   - separando: estado actual, capa transicional y target-state

2. `services/central-hub/docs/ENDPOINTS_SESSION_MANAGER.md`

   Reescribir o desactivar como referencia operativa, porque hoy induce confusión entre módulo interno del hub y servicio real `session-manager`

### Documentos a conservar como históricos

1. `docs/06-FASES/PHASE-2-COMPLETED.md`
2. `docs/05-REPORTES/2026-03/REPORTE-AUDITORIA-ALINEACION-DOCUMENTACION-VS-CODIGO-2026-03-22.md`
3. `services/central-hub/docs/CONTRACT_IMPLEMENTATION_REPORT.md`
4. `services/central-hub/docs/BUGFIX_WHATSAPP_FRONTEND_API_ROUTING.md`

Condición:

- todos deberían marcar su rol histórico o contextual para evitar que se usen como canon actual

### Documento(s) que deberían convertirse en fuente canónica

Fuente canónica recomendada para estado actual de integración WhatsApp:

1. `docs/07-CONTRATOS/Contratos-HTTP-LeadMaster-Workspace.md`
2. `docs/04-INTEGRACION/Integration-CentralHub-SessionManager.md`
3. `docs/01-CONSTITUCIONAL/SYSTEM_BOUNDARIES.md`

Distribución recomendada de responsabilidades documentales:

- estrategia y fases: `docs/01-CONSTITUCIONAL/PROJECT_STATUS.md`
- límites del sistema y ownership: `docs/01-CONSTITUCIONAL/SYSTEM_BOUNDARIES.md`
- contrato HTTP AS-IS: `docs/07-CONTRATOS/Contratos-HTTP-LeadMaster-Workspace.md`
- integración operativa entre servicios: `docs/04-INTEGRACION/Integration-CentralHub-SessionManager.md`
- blueprint futuro: `docs/02-ARQUITECTURA/Guía De Arquitectura Y Migración – Lead Master Workspace`

### Orden exacto de trabajo recomendado

1. Corregir `docs/07-CONTRATOS/Contratos-HTTP-LeadMaster-Workspace.md`

   Razón: primero hay que fijar el contrato AS-IS como fuente de verdad inequívoca.

2. Corregir `docs/04-INTEGRACION/Integration-CentralHub-SessionManager.md`

   Razón: una vez fijado el contrato AS-IS, la integración debe alinearse con él y con el enforcement real.

3. Actualizar `docs/01-CONSTITUCIONAL/PROJECT_STATUS.md`

   Razón: dejar consistente la capa constitucional con la realidad transicional del sistema.

4. Reescribir `docs/02-ARQUITECTURA/Guía De Arquitectura Y Migración – Lead Master Workspace`

   Razón: reubicarla como blueprint para que deje de competir con el AS-IS.

5. Marcar `docs/06-FASES/PHASE-2-COMPLETED.md` como histórico válido con advertencia visible

   Razón: evita usos operativos incorrectos sin reescribir la historia de la fase.

6. Desactivar o reclasificar documentos internos conflictivos de `services/central-hub/docs/` relacionados a Session Manager

   Razón: son una fuente actual de deriva documental dentro del propio servicio.

7. Crear un `AGENTS.md` raíz

   Razón: fijar reglas compartidas para distinguir AS-IS, transicional y target-state en futuras intervenciones documentales y de asistencia por IA.

---

## 6. Recomendación sobre AGENTS.md

- ¿Sí o no?: **Sí**

### Justificación

El repo ya tiene complejidad suficiente para justificar `AGENTS.md` en raíz.

Razones concretas:

- conviven múltiples planos documentales: constitucional, arquitectura, contratos, fases, diagnósticos, bugfix reports, reportes operativos y docs internas de servicio
- existe transición arquitectónica incompleta entre un modular monolith y servicios desacoplados
- hay contratos AS-IS y blueprints target-state coexistiendo con el mismo dominio funcional
- asistentes de IA y contributors pueden leer documentos equivocados y reforzar drift documental si no tienen una regla clara de jerarquía

### Beneficios concretos

1. define fuentes de verdad por tipo de decisión
2. evita que reportes históricos o blueprints se usen como contrato vigente
3. reduce riesgo de que IA o contributors “actualicen” docs correctos usando como evidencia un documento viejo
4. fuerza a distinguir AS-IS, TRANSICIONAL y TARGET en cada cambio documental
5. mejora consistencia entre documentación de workspace y documentación local de servicio

### Riesgos que mitigaría

1. mezclar estado implementado con estado deseado
2. usar rutas legacy o tests viejos como si fueran contrato canónico
3. duplicar contratos conflictivos entre `docs/` y `services/central-hub/docs/`
4. cerrar fases documentalmente sin evidencia verificable suficiente
5. seguir produciendo reportes útiles pero no gobernados por una taxonomía común

---

## 7. Borrador propuesto de AGENTS.md

```markdown
# AGENTS.md

## Propósito del repositorio

Lead Master Workspace es un repositorio de producto y operación que combina:

- un núcleo actual tipo modular monolith en `services/central-hub`
- servicios auxiliares/separados como `services/session-manager` y `services/mailer`
- documentación constitucional, contractual, de fases, de integración, diagnósticos y reportes

El repositorio está en transición arquitectónica. Por lo tanto, no se debe asumir que todo documento describe el mismo plano temporal del sistema.

---

## Fuentes de verdad

Usar esta jerarquía cuando haya conflicto entre documentos:

1. Código ejecutable actual
   - `services/central-hub/src/**`
   - `services/session-manager/**`
   - `services/mailer/**`
   - `package.json` relevantes

2. Contratos y límites del sistema vigentes
   - `docs/07-CONTRATOS/Contratos-HTTP-LeadMaster-Workspace.md`
   - `docs/01-CONSTITUCIONAL/SYSTEM_BOUNDARIES.md`
   - `docs/04-INTEGRACION/Integration-CentralHub-SessionManager.md`

3. Estrategia y fases
   - `docs/01-CONSTITUCIONAL/PROJECT_STATUS.md`
   - `docs/06-FASES/*.md`

4. Reportes y diagnósticos
   - `docs/05-REPORTES/**`
   - `services/central-hub/docs/**`

5. Blueprint / target-state
   - `docs/02-ARQUITECTURA/**`
   - cualquier documento marcado explícitamente como planned, target, draft o migration

Si un reporte o blueprint contradice al código actual, prevalece el código actual.

---

## Convenciones documentales

Todo documento técnico nuevo o actualizado debe declarar explícitamente cuál de estos estados describe:

- `AS-IS IMPLEMENTADO`
- `TRANSICIONAL / LEGACY SOPORTADO`
- `TARGET / PLANNED`
- `NO VERIFICABLE CON EVIDENCIA ACTUAL`

Cuando un documento mezcle más de un plano, debe separar secciones por etiqueta.

No usar una narrativa única que mezcle en el mismo bloque estado actual y arquitectura objetivo.

---

## Reglas para distinguir AS-IS / TRANSICIONAL / TARGET

### AS-IS IMPLEMENTADO

Se usa sólo cuando existe evidencia concreta en al menos una de estas formas:

- ruta montada en código
- controller o service activo
- dependencia real usada por el flujo
- prueba automatizada vigente y coherente con la superficie actual
- artefacto persistente o estructura real del repo que lo respalde

### TRANSICIONAL / LEGACY SOPORTADO

Se usa cuando:

- el flujo sigue existiendo en código o frontend
- convive con una alternativa nueva
- no debe presentarse como contrato ideal ni como única interfaz canónica

### TARGET / PLANNED

Se usa cuando:

- el diseño existe en arquitectura/contrato objetivo
- pero no aparece implementado end-to-end en el código actual

### NO VERIFICABLE CON EVIDENCIA ACTUAL

Se usa cuando:

- hay intención documental o estratégica
- pero la implementación no puede confirmarse con suficiente evidencia en el repo actual

---

## Reglas para asistentes de IA y contributors

Antes de afirmar el estado de una fase, contrato o integración:

1. verificar código actual
2. verificar mounts reales en el entrypoint del servicio
3. verificar si el documento es canónico, histórico o blueprint
4. verificar si existe documentación más reciente que lo desplace

No asumir que:

- un documento en `docs/02-ARQUITECTURA/` describe el AS-IS
- un reporte en `docs/05-REPORTES/` es fuente canónica
- una prueba vieja representa el contrato vigente
- una ruta legacy soportada es la interfaz recomendada

Si hay conflicto entre documentos, explicitarlo en la respuesta o en el cambio propuesto.

---

## Cómo validar si una fase está implementada

No marcar una fase como implementada sólo porque:

- exista el documento de fase
- exista una ADR
- exista un reporte exploratorio

Para considerar una fase implementada o subfase cerrada, debe haber evidencia mínima de:

1. código activo
2. superficie funcional verificable
3. contrato o comportamiento observable
4. evidencia de validación técnica o pruebas consistentes

Si sólo existe la definición de objetivos, clasificar la fase como:

- estratégica o documentalmente vigente
- pero no necesariamente implementada

---

## Qué no asumir

- No asumir pureza arquitectónica por diseño documental.
- No asumir desacople completo si persisten dependencias, módulos o artefactos locales.
- No asumir que JWT está forzado sólo porque el diseño lo diga.
- No asumir que un contrato target-state reemplaza al contrato AS-IS si ambos conviven.
- No asumir que `central-hub` y `session-manager` tienen una única superficie WhatsApp estable si hay rutas legacy/transicionales coexistentes.

---

## Checklist antes de modificar documentación

1. ¿El documento es canónico, histórico, blueprint o reporte?
2. ¿Estoy describiendo AS-IS, transicional o target-state?
3. ¿La afirmación está respaldada por código actual?
4. ¿Existe otro documento más apropiado para ser fuente de verdad?
5. ¿Estoy corrigiendo una contradicción real o imponiendo una arquitectura deseada?
6. ¿Necesito marcar explícitamente que el documento ya no es referencia operativa?
7. ¿La actualización reduce deriva documental o la aumenta?

Si alguna respuesta no es clara, no actualizar el documento como si fuera verdad cerrada sin dejar la ambigüedad explícita.
```

---

## 8. Conclusión final

### Diagnóstico final

El problema documental del repositorio no es que “todo esté mal”. El problema real es de jerarquía, taxonomía y tiempo arquitectónico.

Estado final de la segunda pasada:

- el diagnóstico previo fue útil y mayormente correcto en su dirección general
- varias de sus conclusiones quedan confirmadas con certeza alta
- otras debían acotarse, sobre todo respecto de pruebas y del valor relativo de los documentos contractuales
- el repositorio necesita separar con rigor qué es AS-IS, qué es transicional y qué es target-state

Diagnóstico sintetizado:

- **la principal fuente de deriva sigue siendo la competencia entre documentación canónica AS-IS y blueprints/artefactos de transición que hoy pueden leerse como si describieran el estado vigente**

### Próximo paso recomendado

Corregir primero el contrato HTTP canónico AS-IS y luego la integración, antes de tocar blueprints o fases históricas.

Orden inmediato recomendado:

1. `docs/07-CONTRATOS/Contratos-HTTP-LeadMaster-Workspace.md`
2. `docs/04-INTEGRACION/Integration-CentralHub-SessionManager.md`
3. `docs/01-CONSTITUCIONAL/PROJECT_STATUS.md`

### Documento que debería corregirse primero

- `docs/07-CONTRATOS/Contratos-HTTP-LeadMaster-Workspace.md`

Razón:

- es la mejor base para fijar el AS-IS actual y ordenar el resto del stack documental

### Documento canónico recomendado para el estado actual

Como fuente canónica recomendada para el estado actual de integración técnica, no alcanza un solo archivo; el canon debería quedar distribuido así:

- contrato AS-IS: `docs/07-CONTRATOS/Contratos-HTTP-LeadMaster-Workspace.md`
- límites y ownership: `docs/01-CONSTITUCIONAL/SYSTEM_BOUNDARIES.md`
- integración operativa: `docs/04-INTEGRACION/Integration-CentralHub-SessionManager.md`

Si el equipo requiere una única puerta de entrada para asistentes y contributors, entonces sí conviene crear de inmediato:

- `/root/leadmaster-workspace/AGENTS.md`

con el borrador propuesto en esta auditoría.