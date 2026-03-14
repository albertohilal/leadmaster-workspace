# REPORTE — Estado real de integración Mailer ↔ Central Hub — 2026-03-14

**Destino (path):** `docs/05-REPORTES/2026-03/REPORTE-ESTADO-INTEGRACION-MAILER-CENTRAL-HUB-2026-03-14.md`

---

## 1. Objetivo del relevamiento

Determinar el **estado real** (código + documentación + evidencia en repo) para avanzar con la integración de `leadmaster-mailer` con `central-hub`, bajo el modelo:

- `central-hub` orquesta y dispara solicitudes al mailer.
- La solicitud incluye `cliente_id`.
- `leadmaster-mailer` resuelve la cuenta SMTP del cliente y envía con identidad por cliente.
- La base de datos **ya fue modificada** (según reportes), pero puede haber cambios aún no reflejados de forma completa en artefactos versionados.

Criterio rector: **priorizar el estado real del código** por encima de documentación declarativa.

---

## 2. Resumen ejecutivo

- El servicio mailer real existe en `services/mailer` y su nombre efectivo es **`leadmaster-mailer`** (ver `services/mailer/package.json`).
- Mailer hoy expone **dos endpoints**: `GET /health` y `POST /send` (ver `services/mailer/src/routes/healthRoutes.js` y `services/mailer/src/routes/mailerRoutes.js`).
- Mailer **ya implementa multi-tenant por `cliente_id`**: el envío busca configuración SMTP activa en MySQL por `cliente_id` (`ll_clientes_email_config`, `is_active=1`) y audita envíos en `ll_envios_email` con flujo `PENDING → SENT/FAILED` (ver `services/mailer/src/services/mailerService.js`, `services/mailer/src/repositories/*.js`).
- En `central-hub` **no se encontró integración real implementada** con el mailer (no hay cliente HTTP “MailerClient”, no hay env vars del tipo `MAILER_BASE_URL`, no hay rutas/módulos de email). `central-hub` sí tiene un patrón de integración ya usado con `session-manager` (ver `services/central-hub/src/integrations/sessionManager/sessionManagerClient.js`).
- Base de datos: **no se encontró en el repo** un DDL/migración/versionado SQL para crear/alterar `ll_envios_email` y `ll_clientes_email_config`. Esto confirma el riesgo indicado: “DB modificada” pero **no completamente reflejada** en artefactos versionados.
- Documentación: existe paquete de docs aprobado para el canal email (Phase 4B) y reportes de implementación del mailer (2026-03-11). Sin embargo, el documento de contrato HTTP del mailer aparece **truncado** en el repo (ver `docs/07-CONTRATOS/Contratos-HTTP-Mailer.md`).

Estado central (respuesta a la pregunta principal):
- **Mailer multi-tenant por `cliente_id`: IMPLEMENTADO y validado (operativo)**.
- **Integración `central-hub` ↔ `leadmaster-mailer`: NO IMPLEMENTADA en código** (solo conceptual/documental).
- **DB para soporte SMTP por cliente: EXISTE (inferida por código + reportes), pero NO VERSIONADA en el repo** (DDL/migraciones no verificables aquí).

---

## 3. Estado real del código

### 3.1 Mailer

**Ubicación del servicio real**
- Servicio: `services/mailer`
- Nombre NPM: `leadmaster-mailer` (`services/mailer/package.json`)

**Entry point / server**
- `services/mailer/src/server.js` (lee `MAILER_PORT`, default 3005)
- `services/mailer/src/app.js` (registra rutas y error handler)

**Endpoints expuestos hoy**
- `GET /health` → `services/mailer/src/routes/healthRoutes.js`
- `POST /send` → `services/mailer/src/routes/mailerRoutes.js` → `services/mailer/src/controllers/mailerController.js` → `services/mailer/src/services/mailerService.js`

**Contrato real del payload (validación efectiva en código)**
- Validador: `services/mailer/src/validators/sendValidator.js`
- Requeridos:
  - `cliente_id` (entero positivo)
  - `to` (email)
  - `subject` (string no vacío)
  - `text` o `html` (al menos uno)
- Aceptados pero hoy no usados explícitamente por el flujo (se normalizan y pasan): `campaign_id`, `contact_id`, `from_email`, `from_name`, `reply_to`, `metadata`.

**Variables de entorno usadas por el mailer**
- Servicio:
  - `MAILER_PORT` (ver `services/mailer/src/server.js`)
- Fallback SMTP global (opcional):
  - `SMTP_FALLBACK_ENABLED` + `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME` (ver `services/mailer/.env.example`, `services/mailer/src/services/smtpTransportFactory.js`, `services/mailer/src/services/mailerService.js`)
- Base de datos (obligatorio):
  - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` (ver `services/mailer/src/config/db.js`)

**Resolución SMTP por cliente (multi-tenant)**
- Lookup: `services/mailer/src/repositories/clientEmailConfigRepository.js` (tabla `ll_clientes_email_config`, filtro `cliente_id=? AND is_active=1`)
- Construcción del transporter:
  - DB por cliente: `services/mailer/src/services/smtpTransportFactory.js#createClientTransport`
  - fallback por env (si `SMTP_FALLBACK_ENABLED=true`): `createFallbackTransportFromEnv`

**Auditoría de envíos (DB)**
- Insert previo: `services/mailer/src/repositories/emailLogRepository.js#createPending` → tabla `ll_envios_email` (status `PENDING`)
- Update en éxito: `markSent` (status `SENT`, `message_id`, `sent_at`)
- Update en error: `markFailed` (status `FAILED`, `error_message`)

**Errores tipificados (forma real)**
- Handler: `services/mailer/src/middleware/errorHandler.js`
- Respuesta estándar: `{ "error": true, "code": "...", "message": "..." }` (+ `details` opcional)

Conclusión Mailer (código):
- **Listo a nivel “servicio mailer multi-tenant”** (resuelve SMTP por `cliente_id` desde DB y audita).
- **No está “listo a nivel integración end-to-end”** porque no se encontró el consumidor real desde `central-hub`.

---

### 3.2 Central Hub

**Entry point y rutas actuales**
- Entry: `services/central-hub/src/index.js`
- Rutas principales:
  - `GET /health` (root)
  - `GET /api/health` (`services/central-hub/src/routes/health.routes.js`)
  - Módulos activos: auth, sender, listener, session-manager, sync-contacts (ver mounts en `services/central-hub/src/index.js`).

**Patrón existente de integración HTTP con otro servicio**
- `SessionManagerClient` (fetch + abort controller, header `X-Cliente-Id`, valida `SESSION_MANAGER_BASE_URL`):
  - `services/central-hub/src/integrations/sessionManager/sessionManagerClient.js`

**Duplicación relevante (observación de estado real)**
- Existe otro cliente simple a Session Manager basado en axios:
  - `services/central-hub/src/services/sessionManagerClient.js`
- Esto sugiere que el `central-hub` todavía no consolidó un único “patrón” de cliente HTTP interno.

**Evidencia de multi-tenant en Central Hub (en el dominio WhatsApp)**
- `services/central-hub/src/modules/sender/controllers/sender.controller.js` toma `cliente_id` desde `req.user?.cliente_id`.
- `services/central-hub/src/integrations/sessionManager/sessionManagerClient.js#sendMessage` manda `cliente_id` por header `X-Cliente-Id` y en body.

**Integración con mailer**
- No se encontró en `services/central-hub/src/`:
  - cliente HTTP hacia `leadmaster-mailer`
  - env var tipo `MAILER_BASE_URL` / `MAILER_URL`
  - rutas tipo `/api/email/*` o `/api/mailer/*`
  - módulos o controllers dedicados a envío de email

Conclusión Central Hub (código):
- **Preparado conceptualmente** (tiene `cliente_id` en el contexto auth y patrón de integración HTTP con servicios).
- **No conectado** al mailer en la base de código actual.

---

### 3.3 Base de datos

**Qué se puede afirmar con evidencia del repo**
- El mailer ejecuta SQL contra:
  - `ll_clientes_email_config` (campos usados: `smtp_host`, `smtp_port`, `smtp_secure`, `smtp_user`, `smtp_pass`, `from_email`, `from_name`, `reply_to_email`, `is_active`) — inferido por `services/mailer/src/repositories/clientEmailConfigRepository.js`.
  - `ll_envios_email` (campos usados/esperados: `cliente_id`, `to_email`, `subject`, `body`, `provider`, `status`, `message_id`, `sent_at`, `error_message`) — inferido por `services/mailer/src/repositories/emailLogRepository.js`.

**Qué NO se encontró (gap de versionado)**
- No se encontró en el repo DDL/migración/script SQL versionado que:
  - cree `ll_envios_email`
  - cree `ll_clientes_email_config`
  - altere tablas existentes para soportar SMTP por cliente

Búsqueda realizada:
- `grep` focalizado sobre `*.sql` en el repo no devolvió referencias a esas tablas.

Estado DB (auditoría):
- **DB modificada**: “probable” (por reportes y por código que asume tablas existentes).
- **DB versionada en repo**: **no verificado / no encontrada** para estas tablas.

---

### 3.4 Multi-tenant / cliente_id / SMTP por cliente

Modelo objetivo evaluado:
- `central-hub` envía solicitud al mailer
- solicitud incluye `cliente_id`
- mailer resuelve SMTP por `cliente_id`
- cada cliente tiene su propia identidad

Estado real hoy:
- `leadmaster-mailer`:
  - Resolución SMTP por `cliente_id`: **IMPLEMENTADO** (DB-first + fallback opcional por env)
  - Auditoría por `cliente_id`: **IMPLEMENTADO**
- `central-hub`:
  - Capacidad de obtener `cliente_id` del usuario: **IMPLEMENTADO** (en sender WhatsApp)
  - Cliente HTTP “MailerClient”: **NO IMPLEMENTADO**
  - Ruta/controlador de negocio que invoque mailer: **NO IMPLEMENTADO**

Clasificación final (multi-tenant mailer end-to-end): **PREPARADO PERO NO CONECTADO** (mailer listo, hub no integrado).

---

## 4. Estado de la documentación

**Documentación que sí está alineada con el código del mailer**
- Reportes del 2026-03-11 describen exactamente el comportamiento implementado:
  - `docs/05-REPORTES/2026-03/REPORTE-MAILER-PERSISTENCIA-ENVIOS-EMAIL-2026-03-11.md`
  - `docs/05-REPORTES/2026-03/REPORTE-MAILER-SMTP-MULTITENANT-POR-CLIENTE-2026-03-11.md`
  - `docs/05-REPORTES/2026-03/REPORTE-VALIDACION-SMTP-MAILER-2026-03-11.md`
- `services/mailer/README.md` coincide con el código actual (endpoints, env, DB-first, fallback).
- `PROJECT-STATUS.md` (workspace root) refleja validación operativa del mailer (2026-03-11).

**Documentación conceptual alineada, pero todavía no reflejada en código de `central-hub`**
- Arquitectura del canal email:
  - `docs/04-INTEGRACION/ARQUITECTURA-CANAL-EMAIL.md`
- Plan de fase:
  - `docs/06-FASES/PHASE-4B-EMAIL-PROSPECTING-PLAN.md`

**Problema documental detectado (crítico para retomar integración)**
- `docs/07-CONTRATOS/Contratos-HTTP-Mailer.md` aparece **incompleto/truncado** en el repo.
  - Evidencia: el archivo termina en el bloque de request de `GET /health` sin describir respuesta, ni `POST /send`, ni ejemplos.

---

## 5. Desalineaciones detectadas entre código, DB y docs

1) **Contrato HTTP del mailer truncado**
- Docs declaran “APPROVED”, pero el archivo está incompleto.
- Impacto: dificulta retomar integración desde `central-hub` con un contrato “único” y estable.
- Evidencia: `docs/07-CONTRATOS/Contratos-HTTP-Mailer.md`.

2) **Mailer implementado (multi-tenant + DB) pero DB no versionada**
- Código asume `ll_clientes_email_config` y `ll_envios_email` existentes.
- No hay migración/DDL versionado para reconstruir entornos de forma determinística.
- Evidencia: `services/mailer/src/repositories/*.js` vs ausencia de SQL.

3) **Docs asumen integración hub→mailer; código del hub no la implementa**
- `docs/04-INTEGRACION/ARQUITECTURA-CANAL-EMAIL.md` y Phase 4B declaran que `central-hub` invoca al mailer.
- `services/central-hub/src/` no tiene cliente/ruta/capa de integración para mailer.

4) **Modelo de “cliente_id por header” existe en session-manager; mailer usa “cliente_id en body”**
- Session Manager se consume con `X-Cliente-Id` (ver `services/central-hub/src/integrations/sessionManager/sessionManagerClient.js`).
- Mailer valida `cliente_id` en JSON body (ver `services/mailer/src/validators/sendValidator.js`).
- No es un bug, pero es una diferencia a documentar/estandarizar en la integración.

---

## 6. Riesgos o bloqueos

- **Riesgo de no reproducibilidad**: sin DDL/migración versionada de `ll_envios_email` y `ll_clientes_email_config`, cualquier entorno nuevo (dev/ci/staging) depende de conocimiento tácito o scripts externos.
- **Riesgo operativo por credenciales**: `smtp_pass` se lee de DB en texto plano (por diseño actual). No se encontró evidencia de cifrado/secret manager.
- **Riesgo de seguridad de superficie**: el mailer no implementa auth entre servicios (contrato lo deja fuera de alcance). Si el puerto se expone fuera de localhost/VPC, puede ser vulnerable a abuso.
- **Riesgo de drift de documentación**: el contrato truncado puede generar implementaciones inconsistentes.
- **Bloqueo práctico**: falta un punto de entrada en `central-hub` para probar integración end-to-end (no hay endpoint “send email” en hub).

---

## 7. Qué falta para la etapa actual

### backend `central-hub`
- Implementar una capa de integración hacia mailer (cliente HTTP) y su configuración por env (ej. `MAILER_BASE_URL`).
- Implementar endpoint interno (módulo) para disparar email por caso/lead/campaña (mínimo “send individual”).
- Mapear contexto auth → `cliente_id` y construir el payload para `POST /send`.
- Decidir si `central-hub` usará header `X-Cliente-Id` para consistencia interna (y si mailer lo ignorará o lo validará) — hoy mailer solo valida body.

### backend `mailer`
- No se detectaron faltantes para el MVP multi-tenant SMTP por cliente.
- Posible faltante para integración segura: autenticación/allowlist/origen interno (no implementado; fuera de alcance del contrato actual, pero relevante como riesgo).

### base de datos
- Versionar DDL/migración para:
  - `ll_envios_email`
  - `ll_clientes_email_config`
- Definir/confirmar constraints mínimos (PK, índices por `cliente_id`, `is_active`, auditoría y timestamps).
- Definir cómo se cargan/rotan credenciales SMTP por cliente (seed/admin UI/proceso manual), y dejarlo rastreable.

### configuración `.env`
- En `central-hub`:
  - agregar env var para URL del mailer (hoy no existe).
- En `mailer`:
  - confirmar estrategia fallback (`SMTP_FALLBACK_ENABLED`) por entorno (prod/dev) y documentar política.

### contratos HTTP
- Completar y corregir `docs/07-CONTRATOS/Contratos-HTTP-Mailer.md` (hoy truncado) con:
  - request/response `GET /health`
  - request/response `POST /send`
  - errores tipificados reales
  - ejemplos con `cliente_id` válido y sin config

### seguridad / credenciales
- Definir política de almacenamiento de `smtp_pass`:
  - texto plano vs cifrado
  - rotación
  - logs (asegurar no loguear secretos)
- Definir protección del endpoint mailer:
  - red interna / firewall / nginx
  - auth service-to-service si aplica

### documentación
- Actualizar el estado de “integración hub↔mailer” como **pendiente** en un punto de verdad (ej. `PROJECT-STATUS.md` o un reporte de integración).
- Añadir evidencia de DB versionada (una vez creada) y cómo bootstrappear entornos.

---

## 8. Próximos pasos recomendados

1) **Cerrar el contrato documental truncado** (`docs/07-CONTRATOS/Contratos-HTTP-Mailer.md`) para que sea consumible.
2) **Versionar DB**: agregar el DDL/migración de `ll_envios_email` y `ll_clientes_email_config` (mínimo reproducible).
3) **Agregar integración en `central-hub`** siguiendo el patrón de `SessionManagerClient`:
   - `MAILER_BASE_URL`
   - cliente HTTP `MailerClient`
   - endpoint mínimo en hub para disparar `POST /send` con `cliente_id` desde `req.user`.
4) **Prueba end-to-end** en ambiente controlado:
   - levantar mailer y hub
   - ejecutar llamada desde hub
   - verificar envío y auditoría en DB.
5) **Endurecer seguridad** (según threat model real): restringir exposición del mailer y definir manejo de secretos.

---

## 9. Evidencias relevantes (paths, archivos, funciones, endpoints, tablas, etc.)

### Endpoints mailer (estado real)
- `GET /health` → `services/mailer/src/routes/healthRoutes.js`
- `POST /send` → `services/mailer/src/routes/mailerRoutes.js`

### Flujo multi-tenant por DB (mailer)
- `mailerService.sendEmail(payload)` → `services/mailer/src/services/mailerService.js`
- `clientEmailConfigRepository.findActiveByClienteId(cliente_id)` → `services/mailer/src/repositories/clientEmailConfigRepository.js`
- `emailLogRepository.createPending/markSent/markFailed` → `services/mailer/src/repositories/emailLogRepository.js`

### Env del mailer
- `services/mailer/.env.example`
- DB pool: `services/mailer/src/config/db.js`

### Central Hub (rutas e integración existente)
- Montaje de módulos: `services/central-hub/src/index.js`
- Integración Session Manager (patrón a replicar): `services/central-hub/src/integrations/sessionManager/sessionManagerClient.js`

### Evidencia de no-integración hub→mailer
- No existe cliente `MailerClient` ni env var `MAILER_*` en:
  - `services/central-hub/src/`
  - `services/central-hub/.env*.example`

### Documentación vinculada
- Estado operativo mailer: `PROJECT-STATUS.md`
- Validación SMTP: `docs/05-REPORTES/2026-03/REPORTE-VALIDACION-SMTP-MAILER-2026-03-11.md`
- Implementación audit+DB: `docs/05-REPORTES/2026-03/REPORTE-MAILER-PERSISTENCIA-ENVIOS-EMAIL-2026-03-11.md`
- Implementación SMTP multi-tenant: `docs/05-REPORTES/2026-03/REPORTE-MAILER-SMTP-MULTITENANT-POR-CLIENTE-2026-03-11.md`
- Arquitectura canal email: `docs/04-INTEGRACION/ARQUITECTURA-CANAL-EMAIL.md`
- Fase 4B: `docs/06-FASES/PHASE-4B-EMAIL-PROSPECTING-PLAN.md`
- Contrato HTTP (truncado): `docs/07-CONTRATOS/Contratos-HTTP-Mailer.md`

### Tablas (inferidas por código; DDL no encontrado en repo)
- `ll_clientes_email_config`
- `ll_envios_email`
