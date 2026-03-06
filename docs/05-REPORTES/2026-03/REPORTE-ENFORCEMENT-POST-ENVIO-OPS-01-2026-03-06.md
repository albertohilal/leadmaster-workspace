# REPORTE — Enforcement operacional de ll_post_envio_clasificaciones (OPS-POST-ENVÍO-01) — 2026-03-06

## Resumen ejecutivo

En el estado actual del repo, `ll_post_envio_clasificaciones` funciona como **bitácora histórica** (auditable) y **NO se observa “enforcement” operativo** que aplique automáticamente `accion_siguiente=NO_CONTACTAR` o `accion_siguiente=INVALIDAR_TELEFONO` para:

- excluir prospectos del selector,
- impedir creación de envíos,
- impedir envío automático/manual,
- bloquear respuestas del listener,
- mantener una blacklist/opt-out persistente.

Lo único “enforced” que existe hoy es **validación de enums** y **regla sensible**: si `post_envio_estado=ATENDIO_MENOR_DE_EDAD` entonces `accion_siguiente` debe ser `NO_CONTACTAR` (en el endpoint de clasificación), pero eso **no se traduce en bloqueo de envíos**.

---

## A) Objetivo y alcance

**Objetivo:** Determinar si `ll_post_envio_clasificaciones` tiene efecto real (enforcement) sobre el flujo operativo:

1) Selector de prospectos
2) Generación/creación de envíos
3) Envío automático (scheduler) y manual
4) Exclusión futura / blacklist / opt-out
5) Sender/listener

**Alcance auditado:** backend Central Hub (módulo sender + scheduler) y estructura DB relevante.

---

## B) DB: naturaleza y semántica de la tabla

La migración define explícitamente que la tabla es una **tabla satélite/bitácora** y que su propósito es registrar eventos **sin modificar** `ll_envios_whatsapp`.

**Evidencia (DDL + comentarios de diseño):**
- Tabla y reglas: [services/central-hub/migrations/003_create_ll_post_envio_clasificaciones.sql](services/central-hub/migrations/003_create_ll_post_envio_clasificaciones.sql#L1-L18)
- Enums `post_envio_estado` y `accion_siguiente` (incluye `INVALIDAR_TELEFONO` y `NO_CONTACTAR`): [services/central-hub/migrations/003_create_ll_post_envio_clasificaciones.sql](services/central-hub/migrations/003_create_ll_post_envio_clasificaciones.sql#L29-L58)

---

## C) Backend: endpoint de clasificación (qué hace y qué NO hace)

### C.1 Implementación real

El endpoint `POST /api/sender/envios/:id/post-envio-clasificar`:

- valida pertenencia multi-tenant del envío,
- valida enums,
- aplica regla sensible “menor de edad => NO_CONTACTAR”,
- **inserta un registro** en `ll_post_envio_clasificaciones`,
- opcionalmente devuelve historial.

**Evidencia (enums en backend):**
- Sets con valores (incluye `INVALIDAR_TELEFONO` y `NO_CONTACTAR`): [services/central-hub/src/modules/sender/controllers/enviosController.js](services/central-hub/src/modules/sender/controllers/enviosController.js#L5-L24)

**Evidencia (endpoint inserta/lee, no muta otros objetos):**
- Comentario de reglas “Historial: inserta un registro (no sobreescribe)”: [services/central-hub/src/modules/sender/controllers/enviosController.js](services/central-hub/src/modules/sender/controllers/enviosController.js#L398-L411)
- Validación regla sensible: [services/central-hub/src/modules/sender/controllers/enviosController.js](services/central-hub/src/modules/sender/controllers/enviosController.js#L437-L442)
- INSERT a `ll_post_envio_clasificaciones`: [services/central-hub/src/modules/sender/controllers/enviosController.js](services/central-hub/src/modules/sender/controllers/enviosController.js#L472-L480)
- SELECT posterior y SELECT historial: [services/central-hub/src/modules/sender/controllers/enviosController.js](services/central-hub/src/modules/sender/controllers/enviosController.js#L484-L507)

### C.2 Qué NO existe (en este punto)

En este controlador no hay:

- UPDATE a `ll_envios_whatsapp` para marcar bloqueos,
- UPDATE a `ll_societe_extended` u otra tabla para invalidación/opt-out,
- lógica de “blacklist” por teléfono.

---

## D) Selector de prospectos: ¿se excluye por post-envío?

El selector de prospectos (endpoint `GET /api/sender/prospectos/filtrar`) construye su base desde `ll_lugares_clientes` + `llxbx_societe` (canónico por `phone_mobile`) y solo usa `ll_envios_whatsapp` para obtener `estado_campania`/`envio_id`.

No hay JOIN/WHERE contra `ll_post_envio_clasificaciones`, ni filtro por `accion_siguiente`.

**Evidencia (SQL del selector):**
- Inicio del SQL y campos: [services/central-hub/src/modules/sender/controllers/prospectosController.js](services/central-hub/src/modules/sender/controllers/prospectosController.js#L70-L126)
- JOIN a `ll_envios_whatsapp` (estado por campaña): [services/central-hub/src/modules/sender/controllers/prospectosController.js](services/central-hub/src/modules/sender/controllers/prospectosController.js#L121-L125)

---

## E) Generación de envíos + envío automático: ¿se bloquea por post-envío?

### E.1 Creación de envíos (agregar destinatarios)

La creación de envíos se hace insertando en `ll_envios_whatsapp` con `estado='pendiente'`, confiando en el índice UNIQUE `(campania_id, telefono_wapp)`.

No hay consulta a `ll_post_envio_clasificaciones` en esta etapa.

**Evidencia (INSERT a `ll_envios_whatsapp`):**
- Inserción directa, sin checks post-envío: [services/central-hub/src/modules/sender/controllers/destinatariosController.js](services/central-hub/src/modules/sender/controllers/destinatariosController.js#L189-L210)

### E.2 Envío automático (scheduler de programaciones)

El scheduler obtiene pendientes desde `ll_envios_whatsapp` (por campaña) con `estado='pendiente'` y luego llama a `sessionManagerClient.sendMessage`. No hay consulta a `ll_post_envio_clasificaciones` en:

- la query de pendientes,
- el bucle de envío,
- la transición de estados.

**Evidencia (obtención de pendientes):**
- Query: [services/central-hub/src/modules/sender/services/programacionScheduler.js](services/central-hub/src/modules/sender/services/programacionScheduler.js#L125-L135)

**Evidencia (envío real y cambio de estado a enviado/error):**
- Llamada a `sendMessage` + `cambiarEstado('enviado')`: [services/central-hub/src/modules/sender/services/programacionScheduler.js](services/central-hub/src/modules/sender/services/programacionScheduler.js#L232-L292)

### E.3 Envío manual

En el controlador de envíos manuales (mismo archivo `enviosController.js`), el flujo valida estado `pendiente`, normaliza teléfono y cambia estado a `enviado`.

En el rango auditado de `enviosController.js` no aparece consulta a `ll_post_envio_clasificaciones` fuera del endpoint `clasificarPostEnvio`.

---

## F) Blacklist / exclusión futura / sender & listener

### F.1 Blacklist/opt-out persistente

En el código auditado, no se encontró:

- tabla dedicada tipo `ll_blacklist_telefonos`, `opt_out`, `do_not_contact`,
- uso de `accion_siguiente=NO_CONTACTAR` para cortar el envío,
- uso de `accion_siguiente=INVALIDAR_TELEFONO` para invalidar `llxbx_societe.phone_mobile` o marcar un flag en `ll_societe_extended`.

**Evidencia positiva de ausencia de enforcement en el sender automático:**
- El scheduler decide enviar solo por `ll_envios_whatsapp.estado='pendiente'` (no por clasificación): [services/central-hub/src/modules/sender/services/programacionScheduler.js](services/central-hub/src/modules/sender/services/programacionScheduler.js#L125-L135)

### F.2 Sender/listener

- Sender (scheduler) no consulta clasificaciones antes de enviar: ver sección E.2.
- Listener (IA/respuestas) implementa control propio por teléfono en `ll_ia_control`, pero no hay lectura de `ll_post_envio_clasificaciones` en el flujo auditado.

---

## Conclusión

`ll_post_envio_clasificaciones` y sus enums (`NO_CONTACTAR`, `INVALIDAR_TELEFONO`) **tienen efecto operativo solo como registro y validación de consistencia** del endpoint de clasificación; **no se observa un mecanismo que los convierta en reglas de exclusión/bloqueo** en selector/generación/envío.

## Brecha exacta (si se quiere enforcement real)

Para que `NO_CONTACTAR` e `INVALIDAR_TELEFONO` “peguen” en el flujo, haría falta introducir al menos uno de estos mecanismos (no implementados hoy):

1) **Un estado/flag persistente por teléfono** (ej: tabla `do_not_contact_phones` o flag en `ll_societe_extended`) +
2) **Consumo de ese flag** en:
   - selector de prospectos (`filtrarProspectos`) para excluir,
   - creación de envíos (`agregarDestinatarios`) para rechazar/omitir,
   - scheduler (`obtenerPendientes`) para no seleccionar pendings bloqueados.

(Se puede materializar desde `ll_post_envio_clasificaciones` tomando el último evento por `(cliente_id, telefono/envio)` o por “teléfono del envío” via join con `ll_envios_whatsapp`.)
