# REPORTE — OPS-POST-ENVIO-01 (Clasificación Post-Envío “Depuradora”) — Estado de Implementación — 2026-03-06

**Fecha:** 2026-03-06  
**Destino (path):** `docs/05-REPORTES/2026-03/REPORTE-OPS-POST-ENVIO-01-STATUS-IMPLEMENTACION-2026-03-06.md`

## Fuente auditada
- Documento de referencia: `docs/05-REPORTES/OPS/OPS-POST-ENVIO-01-CLASIFICACION-DEPURADORA.md`

## Resumen ejecutivo
El sistema **OPS-POST-ENVIO-01** está **implementado end-to-end** como:
- **DB:** tabla satélite histórica `ll_post_envio_clasificaciones` (enums exactos + índices + FK opcional).
- **API:** endpoint `POST /api/sender/envios/:id/post-envio-clasificar` que valida multi-tenant, valida enums y aplica la regla sensible “menor de edad ⇒ NO_CONTACTAR”.
- **UI:** botón + modal en grilla de prospectos para registrar la clasificación.

Limitación principal: hoy funciona como **bitácora auditable**, pero **no se observa enforcement operativo** (no bloquea ni excluye automáticamente envíos/prospectos futuros por `NO_CONTACTAR` o `INVALIDAR_TELEFONO`).

## Evidencia de implementación (en repo)

### A) DB (migrations)
- Migration: `services/central-hub/migrations/003_create_ll_post_envio_clasificaciones.sql`
  - Crea `ll_post_envio_clasificaciones` con:
    - `post_envio_estado` (ENUM exacto)
    - `accion_siguiente` (ENUM exacto)
    - `detalle` (VARCHAR(255))
    - `clasificado_por` (VARCHAR(64))
    - `created_at` (DATETIME default NOW)
  - Índices:
    - `idx_post_envio_envio_id (envio_id)`
    - `idx_post_envio_cliente_created (cliente_id, created_at)`
    - `idx_post_envio_estado (post_envio_estado)`
  - FK opcional `fk_post_envio_envio` (solo si `ll_envios_whatsapp` es InnoDB compatible)

### B) API (backend)
- Ruta (router): `services/central-hub/src/modules/sender/routes/envios.js`
  - Registra: `POST /:id/post-envio-clasificar`
- Montaje (app): `services/central-hub/src/index.js`
  - Sender montado en `/api/sender`
  - Resultado final del endpoint: `POST /api/sender/envios/:id/post-envio-clasificar`
- Controller: `services/central-hub/src/modules/sender/controllers/enviosController.js`
  - Validaciones:
    - `req.user.cliente_id` requerido (auth)
    - `post_envio_estado` y `accion_siguiente` deben pertenecer a sets (enums)
    - Regla sensible: `ATENDIO_MENOR_DE_EDAD` ⇒ `accion_siguiente` debe ser `NO_CONTACTAR`
    - `detalle` recortado a 255
  - Multi-tenant:
    - valida que el `envio_id` pertenece al `cliente_id` (join con `ll_campanias_whatsapp`)
  - Persistencia:
    - `INSERT INTO ll_post_envio_clasificaciones (...)`
    - `SELECT` de la fila creada
    - Soporta `?historial=true` devolviendo historial por `envio_id` y `cliente_id`

### C) UI (frontend)
- Componente: `services/central-hub/frontend/src/components/destinatarios/GestionDestinatariosPage.jsx`
  - Botón “Clasificar post-envío” cuando existe `envio_id`
  - Modal con:
    - selector `post_envio_estado`
    - selector `accion_siguiente` (deshabilitado si `ATENDIO_MENOR_DE_EDAD`)
    - input `detalle` (max 255)
  - UX sensible:
    - `ATENDIO_MENOR_DE_EDAD` fuerza `accion_siguiente=NO_CONTACTAR`
    - `NUMERO_INEXISTENTE` / `NUMERO_CAMBIO_DUEÑO` sugiere `INVALIDAR_TELEFONO`
- Servicio API: `services/central-hub/frontend/src/services/envios.js`
  - Método `clasificarPostEnvio(envioId, payload, { historial })`
  - Llama a `POST /sender/envios/:id/post-envio-clasificar` (con `?historial=true` opcional)

## Checklist (funciona vs falta)

### ✅ Funcionando (implementado)
- ✅ Migration DB para `ll_post_envio_clasificaciones` existe e incluye enums/índices/FK opcional.
- ✅ Endpoint `POST /api/sender/envios/:id/post-envio-clasificar` implementado y cableado.
- ✅ Validación multi-tenant (envío pertenece a cliente) implementada.
- ✅ Validación de enums implementada.
- ✅ Regla sensible “menor ⇒ NO_CONTACTAR” implementada en backend.
- ✅ Inserción histórica (no sobreescribe) implementada.
- ✅ Soporte `?historial=true` implementado (devuelve historial por envío).
- ✅ UI mínima implementada (botón + modal + validaciones de UX).

### ⚠️ Parcial / depende de despliegue
- ⚠️ Aplicación efectiva de la migration en entornos (dev/staging/prod): este reporte valida **repo**, no el estado real de la DB en cada entorno.

### ❌ Falta desarrollar (brecha operacional)
Estas brechas NO contradicen el spec (que define “bitácora”), pero sí explican por qué `NO_CONTACTAR` / `INVALIDAR_TELEFONO` **no impactan el flujo** hoy:

- ❌ No hay mecanismo persistente tipo “blacklist/opt-out por teléfono” consumido por el flujo de envío.
- ❌ Selector de prospectos (`/api/sender/prospectos/filtrar`) no excluye prospectos según última clasificación post-envío.
- ❌ Creación de envíos (agregar destinatarios) no omite/bloquea según `NO_CONTACTAR`/`INVALIDAR_TELEFONO`.
- ❌ Scheduler de envíos automáticos no filtra pendientes según clasificaciones post-envío.
- ❌ No existe una materialización canónica de “último estado post-envío por teléfono” (por envío o por teléfono), para usar como regla de exclusión.

## Recomendación de próximos pasos (si se busca enforcement real)
1) Definir una fuente canónica de “estado post-envío vigente” (por teléfono y cliente), por ejemplo:
   - vista/consulta “último evento” por envío o por teléfono (join con `ll_envios_whatsapp`), o
   - tabla materializada (si performance/operativa lo exige).
2) Consumir ese estado en 3 puntos:
   - selector de prospectos,
   - creación de envíos,
   - scheduler/obtención de pendientes.

## Reportes relacionados (ya existentes)
- Auditoría implementación post-envío vs post-respuesta: `docs/05-REPORTES/2026-03/REPORTE-CLASIFICACION-POST-ENVIO-Y-PERSISTENCIA-INBOUND-2026-03-06.md`
- Auditoría de enforcement operacional (brechas): `docs/05-REPORTES/2026-03/REPORTE-ENFORCEMENT-POST-ENVIO-OPS-01-2026-03-06.md`
