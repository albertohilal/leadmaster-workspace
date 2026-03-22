# AGENTS.md

## Propósito

Este repositorio contiene el workspace de **Lead Master**, con una arquitectura en transición desde un núcleo concentrado en `central-hub` hacia una separación más clara de responsabilidades en servicios auxiliares, principalmente:

- `services/central-hub`
- `services/session-manager`
- `services/mailer`

El objetivo de este archivo es dar reglas operativas para que contributors, reviewers y asistentes de IA trabajen con un criterio uniforme sobre:

- estado real del sistema
- documentación vigente
- arquitectura implementada vs arquitectura objetivo
- validación de fases
- propuestas de cambio y reportes técnicos
- consistencia editorial y de idioma

---

## Alcance de este archivo

Estas reglas aplican a:

- cambios de documentación
- auditorías técnicas
- propuestas de refactor
- análisis de fases
- revisión de contratos HTTP
- tareas realizadas por asistentes de IA, Copilot, ChatGPT, Claude o similares
- contribuciones humanas que modifiquen arquitectura, integración, estado del proyecto o contratos

---

## Principio rector: fuente de verdad

### Regla general

Para describir el **estado implementado actual**, la fuente principal de verdad es:

1. **código ejecutable presente en el repositorio**
2. **rutas montadas realmente**
3. **módulos, dependencias y artefactos activos**
4. **contratos efectivamente implementados**
5. **tests, cuando existan**
6. **documentación**, sólo después de contrastarla con el código

### Regla de precedencia

Cuando exista contradicción entre documentación y código:

- el **código** prevalece para describir el estado actual implementado
- la **documentación** puede seguir siendo válida como:
  - histórica
  - transicional
  - blueprint / target-state
- nunca asumir que un documento describe estado actual sólo por estar en `docs/`

### Excepción

Si un documento declara explícitamente una decisión arquitectónica canónica futura, esa decisión **no debe describirse como implementada** sin evidencia concreta en código.

---

## Mapa de servicios del repositorio

### Servicio principal actual

#### `services/central-hub`
Responsabilidad actual:
- gateway principal
- auth
- integración con frontend
- integración con `session-manager`
- integración con `mailer`
- coexistencia de capas legacy/transicionales relacionadas con WhatsApp

### Servicios auxiliares

#### `services/session-manager`
Responsabilidad:
- manejo de sesión WhatsApp fuera del núcleo principal
- hoy debe asumirse **single-admin / AS-IS** salvo que el código muestre claramente otra cosa

#### `services/mailer`
Responsabilidad:
- envío de correo como servicio separado
- integración con `central-hub`

### Regla importante

No asumir desacople total sólo porque existan carpetas separadas en `services/`.  
La separación de carpetas **no prueba por sí sola** separación completa de responsabilidades.

---

## Fuentes de verdad por tema

### Estado del proyecto y fases
Prioridad:
1. código real implementado
2. `PROJECT-STATUS.md`
3. `docs/01-CONSTITUCIONAL/PROJECT_STATUS.md`
4. documentos de fase
5. reportes de auditoría

### Arquitectura
Prioridad:
1. estructura real de `services/`
2. mounts, routes, integrations y dependencias activas
3. `docs/02-ARQUITECTURA/*`
4. reportes técnicos

### Contratos HTTP
Prioridad:
1. rutas reales montadas
2. controllers / handlers / services
3. validaciones reales de auth, headers, params y body
4. `docs/07-CONTRATOS/*`
5. `docs/04-INTEGRACION/*`

### Integración entre servicios
Prioridad:
1. clientes HTTP o integraciones reales en código
2. variables de entorno y wiring real
3. documentación de integración
4. arquitectura target

### Estado histórico de fases
Prioridad:
1. documento de fase correspondiente
2. evidencia de código aún presente
3. reportes de auditoría

---

## Convenciones documentales obligatorias

Todo documento técnico nuevo o corregido debe indicar explícitamente en qué plano habla.

Usar, cuando corresponda, estas etiquetas:

- **AS-IS IMPLEMENTADO**
- **TRANSICIONAL / LEGACY SOPORTADO**
- **TARGET / PLANNED**
- **HISTÓRICO**
- **NO VERIFICADO**

### Definiciones

#### AS-IS IMPLEMENTADO
Describe comportamiento, estructura, rutas o responsabilidades verificables hoy en el código.

#### TRANSICIONAL / LEGACY SOPORTADO
Describe piezas que siguen existiendo y funcionando, aunque no sean la forma objetivo final.

#### TARGET / PLANNED
Describe diseño deseado, arquitectura futura o siguiente etapa, no necesariamente implementada.

#### HISTÓRICO
Describe cómo quedó una fase o decisión en su momento. Puede ser válido como registro aunque ya no describa la operación actual.

#### NO VERIFICADO
Describe algo pendiente de confirmación. No debe presentarse como hecho.

---

## Reglas para distinguir AS-IS vs TRANSICIONAL vs TARGET

### AS-IS
Marcar como AS-IS sólo si hay evidencia concreta, por ejemplo:
- ruta montada en el entrypoint
- módulo importado y usado
- dependencia activa
- servicio invocado realmente
- frontend consumiendo ese contrato
- test o script operativo

### TRANSICIONAL
Marcar como transicional si:
- existe y sigue siendo usado o soportado
- convive con una versión nueva
- está en proceso de reemplazo
- el código muestra coexistencia de superficies o contratos

### TARGET
Marcar como target si:
- el documento habla en futuro
- depende de extracción pendiente
- requiere cambios aún no visibles en código
- describe separación arquitectónica todavía no consolidada

### Regla de oro
No convertir TARGET en AS-IS sólo porque:
- haya una carpeta creada
- exista un documento de diseño
- haya un nombre previsto
- exista una intención de migración

---

## Cómo validar si una fase está implementada

Una fase no debe considerarse “implementada” sólo por existir un documento que la marque como completa.

### Para considerar una fase como implementada, verificar:

1. **superficie funcional real**
- rutas
- endpoints
- jobs
- módulos
- servicios
- UI asociada, si aplica

2. **wiring operativo**
- imports activos
- mounts reales
- integración entre módulos
- variables/config necesarias

3. **contrato efectivo**
- auth real
- payloads reales
- nombres de campos
- códigos de error
- estados expuestos

4. **evidencia de uso o cierre técnico**
- tests
- scripts
- reportes técnicos
- notas de despliegue
- ausencia de TODOs o placeholders críticos

### Clasificación sugerida al auditar fases

- **Implementada**
- **Implementada parcialmente**
- **Estratégicamente correcta pero técnicamente incompleta**
- **Documentada como completa sin respaldo suficiente**
- **No verificable con evidencia actual**

---

## Qué no asumir nunca

No asumir automáticamente que:

- un documento en `docs/` está actualizado
- una fase “completed” sigue describiendo la operación actual
- un servicio separado implica desacople real completo
- un endpoint documentado coincide con el endpoint montado
- un requisito de seguridad documentado está realmente enforced
- una dependencia legacy dejó de usarse sólo porque existe una integración nueva
- un contrato está consolidado sólo porque aparece en más de un documento
- una arquitectura objetivo ya es la arquitectura efectiva

---

## Política de idioma documental

La documentación del repositorio debe mantener consistencia de idioma a nivel de archivo y de sección.

### Regla general
- No mezclar español e inglés dentro de una misma sección, subtítulo o bloque nuevo, salvo por nombres propios, términos técnicos ampliamente establecidos o identificadores de código.

### Regla de edición
- Antes de modificar un documento, identificar su idioma predominante.
- Todo texto nuevo debe redactarse en el idioma predominante del archivo, salvo instrucción explícita en contrario.
- No insertar subtítulos en inglés dentro de documentos mayormente en español.
- No insertar subtítulos en español dentro de documentos mayormente en inglés.

### Regla para documentos mezclados
- Si un documento ya está mezclado sin criterio claro, no seguir propagando esa mezcla.
- En esos casos, los cambios nuevos deben:
  1. respetar el idioma predominante del bloque o sección intervenida
  2. dejar el documento listo para una futura normalización de idioma

### Regla para nuevos documentos
- Por defecto, la documentación constitucional, operativa, de estado y de producto debe redactarse en español.
- Los documentos técnicos orientados a tooling externo, librerías o integración internacional pueden redactarse en inglés si eso mejora su uso real, pero deben mantener consistencia interna completa.

### Regla para asistentes de IA
- No elegir idioma por inercia.
- No imitar automáticamente el idioma del último párrafo si el documento tiene otro idioma predominante.
- Si hay duda sobre el idioma correcto, priorizar:
  1. idioma predominante del archivo
  2. tipo de documento
  3. consistencia con documentos canónicos relacionados

---

## Reglas para asistentes de IA

### Antes de proponer conclusiones

Todo asistente debe:

1. leer primero la documentación relevante
2. contrastarla con código real
3. distinguir:
   - estado actual
   - transición
   - target
   - histórico
4. explicitar incertidumbre cuando falte evidencia

### Reglas de conducta

- no inventar estado
- no completar huecos con suposiciones
- no usar lenguaje categórico sin respaldo
- no tratar blueprint como implementación
- no tratar documento histórico como guía operativa sin advertencia
- no asumir que auth, seguridad o validaciones documentadas coinciden con runtime
- no propagar mezclas de idioma sin criterio

### Cuando haya contradicción

El asistente debe responder en este orden:

1. qué afirma el documento
2. qué muestra el código
3. si están alineados o no
4. qué acción documental recomienda
5. qué nivel de certeza tiene

### Lenguaje recomendado

Usar expresiones como:
- “Alineado”
- “Parcialmente alineado”
- “Desalineado”
- “No verificable con evidencia actual”
- “Requiere inspección adicional”

Evitar:
- “todo está bien”
- “está implementado” sin pruebas
- “la arquitectura actual es X” si coexisten varias capas

---

## Reglas para contributors humanos

### Si vas a modificar documentación

Antes de editar un documento:
1. verificá si describe AS-IS, TRANSICIONAL, TARGET o HISTÓRICO
2. revisá mounts, rutas y contratos reales
3. confirmá si existe otro documento más canónico sobre el mismo tema
4. no borres valor histórico sin preservarlo explícitamente
5. no corrijas un documento histórico como si fuera operativo actual, salvo que agregues contexto
6. respetá el idioma predominante del archivo

### Si vas a modificar contratos o integración
Debés revisar como mínimo:
- entrypoint del servicio
- rutas reales
- middlewares de auth
- cliente consumidor
- frontend consumidor, si existe
- documentación contractual e integración relacionada

### Si vas a modificar arquitectura
Debés aclarar si el cambio:
- actualiza el estado real
- reduce deuda legacy
- agrega una capa transicional
- o implementa parte del target-state

---

## Política para documentos históricos

Un documento histórico válido:
- no tiene que describir la operación actual
- sí debe quedar claramente marcado como histórico
- no debe usarse como guía operativa sin nota de contexto

### Regla
Si un documento histórico contiene ejemplos operativos que ya no coinciden con el runtime:
- conservarlo si aporta trazabilidad
- agregar advertencia visible
- enlazar al documento canónico vigente

---

## Checklist antes de modificar documentación

Antes de editar cualquier documento técnico, verificar:

- [ ] Qué documento es canónico para este tema
- [ ] Si el contenido describe AS-IS, TRANSICIONAL, TARGET o HISTÓRICO
- [ ] Cuál es el idioma predominante del archivo
- [ ] Qué rutas reales están montadas hoy
- [ ] Qué auth/headers/validaciones están realmente enforced
- [ ] Qué servicios o integraciones siguen coexistiendo
- [ ] Si el frontend sigue consumiendo una versión legacy o transicional
- [ ] Si el cambio contradice otro documento vigente
- [ ] Si hace falta corregir también contratos o integración
- [ ] Si hace falta agregar advertencia histórica
- [ ] Si la afirmación tiene evidencia suficiente

---

## Formato recomendado para auditorías técnicas

Toda auditoría documental o de alineación debería incluir:

1. objetivo
2. documentos auditados
3. código revisado
4. criterio de verdad
5. hallazgos principales
6. matriz de evidencia
7. clasificación documental
8. plan de remediación
9. nivel de certeza
10. próximos pasos

### Campos sugeridos por hallazgo

- ID
- severidad
- tipo
- afirmación documental
- evidencia en código
- estado
- nivel de certeza
- recomendación

---

## Señales de alerta documental

Considerar una alerta si ocurre cualquiera de estas:

- documento usa nombres de carpetas que ya no existen
- documento describe paths diferentes a los montados
- documento presenta seguridad más estricta que la real
- documento habla de separación completa pero el código muestra convivencia
- documento mezcla fase histórica con operación actual sin aclararlo
- documento no distingue entre AS-IS y TARGET
- documento declara “completed” sin evidencia verificable
- documento mezcla idiomas sin criterio editorial

---

## Archivo recomendado de estado actual

Este repositorio debería mantener, además de la documentación histórica, un documento breve y canónico de estado actual implementado.

Ese documento debería responder:
- qué está implementado hoy
- qué sigue siendo legacy soportado
- qué está en transición
- qué sigue siendo target

Hasta que exista ese documento, nadie debe asumir que la guía de arquitectura o los docs de fase describen por sí solos el estado operativo vigente.

---

## Criterio de prudencia

Ante duda:
- describir menos, pero con evidencia
- marcar incertidumbre
- proponer verificación adicional
- evitar sobreafirmar desacople, seguridad o completitud

---

## Foco actual del proyecto

Mientras no se documente una nueva decisión explícita de prioridad, el foco actual de ejecución del proyecto es:

- **completar Email** como funcionalidad MVP operativa de punta a punta

Existe además un objetivo posterior ya definido en agenda:

- **dashboard cliente** orientado a visualización de saldo disponible, precio por lead entregado, búsquedas realizadas, conversaciones iniciadas, leads entregados e interacción asociada a cada lead entregado

### Regla de prioridad

- El dashboard cliente **no forma parte del foco inmediato actual**
- No debe desviar ejecución, documentación ni decisiones de desarrollo que hoy deban cerrar Email
- No debe describirse como implementado ni como prioridad inmediata salvo decisión explícita posterior

---

## Mantenimiento de este archivo

Este `AGENTS.md` debe actualizarse cuando ocurra cualquiera de estas situaciones:

- cambio de arquitectura relevante
- extracción real de un servicio
- consolidación o retiro de una capa legacy
- cambio canónico en contratos HTTP
- reordenamiento de documentación
- adopción formal de nuevos documentos fuente de verdad
- cambio explícito en el foco prioritario del proyecto