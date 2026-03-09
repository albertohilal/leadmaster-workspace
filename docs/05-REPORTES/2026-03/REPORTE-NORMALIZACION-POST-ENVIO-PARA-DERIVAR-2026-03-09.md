# REPORTE — Normalización semántica Post-Envío: `INTERESADO_PARA_DERIVAR_A_HABY` → `PARA_DERIVAR` — 2026-03-09

**Fecha:** 2026-03-09  
**Destino (path):** `docs/05-REPORTES/2026-03/REPORTE-NORMALIZACION-POST-ENVIO-PARA-DERIVAR-2026-03-09.md`

---

## 1) Objetivo

Desacoplar un valor de negocio específico de cliente (`INTERESADO_PARA_DERIVAR_A_HABY`) y reemplazarlo por un valor genérico canónico (`PARA_DERIVAR`), manteniendo el flujo actual de clasificación post-envío.

Restricciones explícitas respetadas:
- No tocar SQL ni migraciones.
- No cambiar nombres de columnas.
- No tocar `ll_envios_whatsapp`.
- No cambiar la lógica funcional; solo el nombre del valor.

---

## 2) Alcance y estrategia

### Alcance (código)
- Backend: validación/normalización del payload `post_envio_estado` en el endpoint de clasificación post-envío.
- Frontend: selector/label visible del estado post-envío.

### Estrategia de compatibilidad (sin tocar SQL/migrations)
La tabla `ll_post_envio_clasificaciones.post_envio_estado` fue creada como `ENUM` incluyendo el valor legacy `INTERESADO_PARA_DERIVAR_A_HABY`.

Como está prohibido modificar migraciones/SQL, se implementó una normalización a nivel aplicación:
- **API/UI (canónico):** usa `PARA_DERIVAR`.
- **DB (compat):** se persiste el valor legacy `INTERESADO_PARA_DERIVAR_A_HABY` cuando el cliente envía `PARA_DERIVAR`.
- **Lectura (compat):** si la DB devuelve el valor legacy, el backend lo normaliza a `PARA_DERIVAR` antes de responder.

Esto mantiene compatibilidad sin cambios de schema.

---

## 3) Cambios implementados

### 3.1 Backend
**Archivo:** `services/central-hub/src/modules/sender/controllers/enviosController.js`

- Se definió `PARA_DERIVAR` como valor canónico en el set de validación.
- Se agregó mapeo de compatibilidad:
  - `normalizePostEnvioEstado`: legacy → canónico.
  - `denormalizePostEnvioEstadoForDb`: canónico → legacy.
- Se aplicó el mapeo en:
  - Validación del body (`POST_ENVIO_ESTADOS.has(...)`).
  - Persistencia (`INSERT` a `ll_post_envio_clasificaciones`).
  - Respuesta (`data`) y `historial` (si `?historial=true`).

Resultado: el endpoint acepta tanto `PARA_DERIVAR` como el valor legacy (por compat), pero responde el canónico.

### 3.2 Frontend (UI)
**Archivo:** `services/central-hub/frontend/src/components/destinatarios/GestionDestinatariosPage.jsx`

- Se reemplazó la opción del selector:
  - value: `INTERESADO_PARA_DERIVAR_A_HABY` → `PARA_DERIVAR`
  - label: “Interesado para derivar a Haby” → “Para derivar”

---

## 4) Etiqueta visible en UI

Sí: existía la etiqueta “Interesado para derivar a Haby” y fue cambiada a “Para derivar”.

---

## 5) Tests / validaciones

- Se ejecutó `npm test` en `services/central-hub` y los tests pasaron.
- No se detectaron tests dedicados a este enum; el cambio se soporta por validación a nivel controller.

---

## 6) Notas operativas

- El build generado `services/central-hub/frontend/dist/**` puede seguir conteniendo el string legacy hasta que se regenere el bundle (no se modifica a mano).
- Documentación/migrations pueden seguir mencionando el valor legacy; este reporte cubre el cambio en **código** según el alcance solicitado.
