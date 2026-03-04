# OPS-POST-ENVIO-01 — Clasificación Post-Envío (Depuradora)

**Release:** R-OPS-01 — “Depuración Post-Envío + UX Operador Prospectos”  
**Fecha:** 2026-03-04  
**Workstream:** OPS (DB/API/UI mínima)

## Objetivo
Agregar una instancia **formal y auditable** de clasificación *post-envío* para depurar la información que surge del contacto por WhatsApp.

Esta etapa determina, entre otros, si el contacto fue válido, si el número no existe, si atendió un tercero o un menor de edad, etc.

## Decisión de diseño (obligatoria)
- **NO** se agregan columnas nuevas a `ll_envios_whatsapp`.
- Se implementa una tabla satélite (bitácora/eventos): `ll_post_envio_clasificaciones`.
- `ll_envios_whatsapp` se mantiene como **hecho operativo de envío**.

## ENUMs (exactos)
### 1) `post_envio_estado`
- `CONTACTO_VALIDO_SIN_INTERES`
- `INTERESADO_PARA_DERIVAR_A_HABY`
- `PENDIENTE_SIN_RESPUESTA`
- `NUMERO_INEXISTENTE`
- `NUMERO_CAMBIO_DUEÑO`
- `TERCERO_NO_RESPONSABLE`
- `ATENDIO_MENOR_DE_EDAD`
- `NO_ENTREGADO_ERROR_ENVIO`

### 2) `accion_siguiente`
- `DERIVAR_HABY`
- `FOLLOWUP_1`
- `CERRAR`
- `INVALIDAR_TELEFONO`
- `REINTENTO_TECNICO`
- `NO_CONTACTAR`

## DDL / Migration (idempotente)
- Migration SQL: `services/central-hub/migrations/003_create_ll_post_envio_clasificaciones.sql`
- Crea tabla `ll_post_envio_clasificaciones` con:
  - `id` (PK)
  - `envio_id` (FK o índice)
  - `cliente_id` (redundante intencional para auditoría multi-tenant)
  - `post_envio_estado` (ENUM)
  - `accion_siguiente` (ENUM)
  - `detalle` (VARCHAR(255) opcional)
  - `clasificado_por` (VARCHAR(64) opcional: `"{tipo}:{id}"`)
  - `created_at` (timestamp)
- Índices:
  - `idx_post_envio_envio_id (envio_id)`
  - `idx_post_envio_cliente_created (cliente_id, created_at)`
  - `idx_post_envio_estado (post_envio_estado)`
- FK (opcional): se intenta agregar `fk_post_envio_envio` **solo** si `ll_envios_whatsapp` existe y es compatible (InnoDB + `id` int).

## API (Backend)
### Endpoint
- **POST** `/api/sender/envios/:envio_id/post-envio-clasificar`

### Body
```json
{
  "post_envio_estado": "CONTACTO_VALIDO_SIN_INTERES",
  "accion_siguiente": "CERRAR",
  "detalle": "No respondió / no le interesa"
}
```

### Reglas
- Valida que `envio_id` exista y pertenezca al `cliente_id` autenticado (multi-tenant).
- Inserta un registro en `ll_post_envio_clasificaciones` (**histórico; no sobreescribe**).
- Regla sensible:
  - `ATENDIO_MENOR_DE_EDAD` ⇒ `accion_siguiente` debe ser `NO_CONTACTAR` (validación backend).
- Respuesta:
  - Retorna el último registro creado.
  - Si se envía `?historial=true`, retorna además el historial completo del envío (desc).

### Archivos tocados (Backend)
- `services/central-hub/src/modules/sender/routes/envios.js`
- `services/central-hub/src/modules/sender/controllers/enviosController.js`
- `services/central-hub/migrations/003_create_ll_post_envio_clasificaciones.sql`

## UI mínima (Operador)
- Pantalla: `/prospectos`
- Acción por fila (cuando existe `envio_id`): **“Clasificar post-envío”**
- Modal mínimo con:
  - Selector `post_envio_estado`
  - Selector `accion_siguiente`
  - Campo `detalle`

### Casos sensibles
- `ATENDIO_MENOR_DE_EDAD` ⇒ fuerza/deshabilita `accion_siguiente = NO_CONTACTAR`.
- `NUMERO_INEXISTENTE` / `NUMERO_CAMBIO_DUEÑO` ⇒ sugiere `INVALIDAR_TELEFONO`.

### Archivos tocados (Frontend)
- `services/central-hub/frontend/src/services/envios.js`
- `services/central-hub/frontend/src/components/destinatarios/GestionDestinatariosPage.jsx`

## Criterios de aceptación
- Existe tabla `ll_post_envio_clasificaciones` con enums exactos.
- Se puede registrar una clasificación por envío vía API.
- UI permite clasificar y queda auditado en DB.
- No se agregaron columnas nuevas a `ll_envios_whatsapp`.
