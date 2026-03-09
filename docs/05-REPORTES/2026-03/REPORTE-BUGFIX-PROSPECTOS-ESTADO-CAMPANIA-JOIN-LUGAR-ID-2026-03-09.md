# REPORTE — Bugfix Prospectos: estado de campaña por `lugar_id` (no por teléfono) — 2026-03-09

**Fecha:** 2026-03-09  
**Destino (path):** `docs/05-REPORTES/2026-03/REPORTE-BUGFIX-PROSPECTOS-ESTADO-CAMPANIA-JOIN-LUGAR-ID-2026-03-09.md`

---

## 1) Resumen ejecutivo

Se corrigió el endpoint interno `GET /api/sender/prospectos/filtrar` para que el **estado de campaña** (tabla `ll_envios_whatsapp`) se vincule **prioritariamente por `lugar_id`** contra el prospecto canónico (`llxbx_societe.rowid`), evitando inconsistencias cuando el teléfono histórico del envío (`telefono_wapp`) no coincide con el `phone_mobile` actual.

Impacto esperado: si existe un envío de esa campaña para el mismo `lugar_id`, el listado debe reflejar el estado correcto (por ejemplo, `enviado`) aunque `telefono_wapp` y `phone_mobile` no coincidan.

---

## 2) Problema confirmado

El endpoint de prospectos resolvía el estado de campaña mediante un `LEFT JOIN` a `ll_envios_whatsapp` usando:

- `env.campania_id = c.id`
- `env.telefono_wapp = s.phone_mobile`

Esto produce falsos “sin estado” cuando `s.phone_mobile` cambia (normalización, cambio de número, actualización manual, etc.) pero el envío histórico pertenece al mismo prospecto por `lugar_id`.

### Caso concreto validado

- `llxbx_societe.rowid = 866`
- `llxbx_societe.phone_mobile = 1151220521`
- `ll_envios_whatsapp.lugar_id = 866`
- `ll_envios_whatsapp.telefono_wapp = 5491164677185`

Resultado observado antes del fix: el estado existía en DB pero no aparecía en UI por el join por teléfono.

---

## 3) Causa raíz

El modelo de vínculo entre envío y prospecto no es estable por teléfono:

- `telefono_wapp` representa el dato histórico del envío (puede incluir prefijos/normalización distinta o un teléfono previo).
- `phone_mobile` representa el estado actual del prospecto canónico.

El identificador estable para correlacionar el envío con el prospecto es `lugar_id` (referencia al mismo `rowid` del prospecto/societe usado por el selector).

---

## 4) Cambio implementado (solo JOIN)

**Archivo:** `services/central-hub/src/modules/sender/controllers/prospectosController.js`

Se reemplazó el `LEFT JOIN` a `ll_envios_whatsapp` para vincular por:

- `env.campania_id = c.id`
- `env.lugar_id = s.rowid`

Además se agregó un comentario corto en el SQL explicando por qué se usa `lugar_id` en vez de `telefono_wapp`.

---

## 5) Criterio de aceptación

- Si existe envío en la campaña para el mismo `lugar_id`, debe reflejarse el estado correcto aunque `telefono_wapp` y `phone_mobile` no coincidan.
- El caso “Federico Leon Tattoo” debe volver a mostrar `enviado`.
- No se rompe el resto del listado (multi-tenant, dedupe canónico y filtros se mantienen).

---

## 6) Validación recomendada (manual)

1) Ejecutar `GET /api/sender/prospectos/filtrar?campania_id=<ID>` autenticado como el cliente correspondiente.
2) Verificar que para `llxbx_societe.rowid=866` (o el prospecto afectado) se devuelve `estado_campania='enviado'` si existe un registro en `ll_envios_whatsapp` con `campania_id` y `lugar_id` coincidentes.
3) Verificar que filtros existentes (ej. `cartera_origen`) continúan aplicando igual.

---

## 7) Notas / riesgos

- Este cambio asume que para una misma combinación `(campania_id, lugar_id)` existe a lo sumo un envío relevante (o que el modelo de datos asegura unicidad/consistencia). Si existieran múltiples envíos por el mismo `lugar_id` en la misma campaña, el `LEFT JOIN` podría multiplicar filas.
- No se alteró dedupe canónico por `phone_mobile` ni el resto de la query; el cambio es puntual al vínculo de estado de campaña.
