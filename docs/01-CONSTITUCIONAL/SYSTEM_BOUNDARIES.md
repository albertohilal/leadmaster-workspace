# SYSTEM BOUNDARIES

**Status:** Active (Constitutional)  
**Purpose:** Definir qué está dentro y fuera del alcance del sistema, y fijar límites de responsabilidad entre servicios  
**Last Updated:** 2026-02-27  
**Related:** [PROJECT_STATUS.md](./PROJECT_STATUS.md)

---

## 1. In Scope (Dentro del sistema)

Incluye:

- API y frontend de LeadMaster (`central-hub`) para operación diaria.
- **Recepción** de mensajes WhatsApp (inbound) mediante servicios internos (WhatsApp Web listener).
- Autenticación/Autorización (JWT) y aplicación de reglas de negocio (scoring, validaciones, auditoría).
- Persistencia de datos del dominio (leads, campañas, mensajes, auditoría) en la base del workspace.
- Observabilidad operativa básica: logs, healthchecks, métricas mínimas.

### Servicios principales (responsabilidad)

- **central-hub**: capa de producto (auth, API, frontend, orquestación). Dueño del contexto de usuario/cliente y del dominio.
- **session-manager**: capa WhatsApp Web (estado de sesión, QR, conexión y captura de inbound). **No conoce el dominio de negocio.**
- **listener**: procesamiento de mensajes entrantes (normalización, persistencia, disparadores controlados). *(Puede existir como módulo dentro de central-hub o como servicio separado; la responsabilidad es la misma).*
- **sender**: reglas de envío del dominio (scoring/contactabilidad, DRY-RUN, auditoría) **sin canal de entrega automático por WhatsApp Web**.

---

## 2. Out of Scope (Fuera del sistema)

No incluye:

- **Envío automático vía WhatsApp Web (whatsapp-web.js)**: explícitamente fuera de alcance por riesgo operativo (baneo/bloqueos).
- Garantías de entrega o SLA de WhatsApp (depende del proveedor).
- Automatización de envío manual por web.whatsapp.com (la operación manual no se automatiza).
- Meta WhatsApp Cloud API como implementación “ya disponible”: puede integrarse en fases futuras, pero no se asume como parte del estado actual.
- Modelos de IA externos como parte del contrato núcleo (pueden existir integraciones, pero no son parte del núcleo contractual).
- Proveedores de infraestructura (Contabo, Cloudflare) como “componentes internos”: son dependencias externas.
- Sistemas de colas/streaming y orquestación avanzada (si se incorporan, deben ser explicitados en fase y contrato).

---

## 3. Identidades y ownership (Regla constitucional)

### 3.1 Identidad de negocio: `cliente_id`

- **`cliente_id`** identifica el *tenant* / cliente del producto.
- Vive en el dominio de **central-hub** (y servicios de negocio).
- Se usa para autorización, queries, auditoría y trazabilidad del dominio.

### 3.2 Identidad WhatsApp (AS-IS): sesión ADMIN única (listener-only)

**Estado actual del sistema:**

- `session-manager` es **single-admin**: administra **una** sesión WhatsApp para todo el sistema.
- No existe `instance_id` en la API real de `session-manager` hoy.
- La sesión se usa **solo** para:
  - conexión (QR)
  - estado operativo
  - captura de mensajes entrantes (inbound)

Notas:

- En `central-hub` existen rutas/middlewares que usan `cliente_id` (path) y/o `X-Cliente-Id` (header) para contexto/seguridad del producto.
- Cualquier mapeo o normalización de estados ocurre en capas del producto (central-hub), no en WhatsApp layer.

### 3.3 Identidad WhatsApp (PLANNED): `instance_id` por instancia

**Objetivo futuro (no implementado end-to-end):**

- WhatsApp layer direccionada por `instance_id` (string opaco y estable).
- `instance_id` no debe transportar `cliente_id`.
- Si existe relación entre `cliente_id` y `instance_id`, el mapeo pertenece al dominio de **central-hub**.

---

## 4. Integraciones externas

- **WhatsApp Web** (sistema externo): autenticación mediante QR, conectividad y políticas externas.
- **WhatsApp Web UI (manual)**: https://web.whatsapp.com/ (operación humana para outbound manual).
- **Meta WhatsApp Cloud API (futuro)**: canal oficial para outbound automatizado cuando esté disponible.
- **Nginx** (infra): reverse proxy, TLS termination, routing.
- **Cloudflare** (infra): DNS/SSL mode, caching/control según configuración.
- **Base de datos** (infra interna): almacenamiento del dominio (no accesible directamente por servicios no autorizados).

---

## 5. Límites de responsabilidad por servicio

### 5.1 central-hub

Debe:

- Autenticar y autorizar.
- Resolver/validar pertenencia del contexto (`cliente_id`) al usuario autenticado.
- Procesar inbound (vía listener) y persistirlo.
- Aplicar reglas de negocio (calidad, scoring, clasificaciones, auditoría).
- Orquestar integraciones (ej. futuro con Meta API), sin violar contratos.

No debe:

- Importar librerías de WhatsApp ni administrar su lifecycle (eso pertenece a `session-manager`).
- Persistir “estado de sesión WhatsApp” como fuente de verdad (solo cache/telemetría si aplica).
- Implementar envío automático vía WhatsApp Web.

### 5.2 session-manager

Debe:

- Gestionar sesión WhatsApp **ADMIN única** (conexión + QR + LocalAuth/persistencia si aplica).
- Exponer **solo** operaciones de sesión y lectura (listener-only):
  - estado: `/status`
  - qr: `/qr` (o equivalente)
  - salud: `/health`
  - (opcional mantenimiento) `/connect`, `/disconnect`

No debe:

- Exponer endpoints de envío outbound (ej. **NO** `/send`).
- Conocer `cliente_id` o reglas del dominio de negocio.
- Tomar decisiones de “cuándo enviar” o “a quién enviar”.
- Implementar campañas, rate-limit o colas.

### 5.3 listener

Debe:

- Recibir eventos/mensajes entrantes desde la capa WhatsApp (directo o vía `central-hub`).
- Normalizar, persistir y disparar reglas de negocio de forma controlada.

No debe:

- Depender de `cliente_id` proveniente de la capa WhatsApp (se resuelve en central-hub).

### 5.4 sender

Debe:

- Contener reglas del dominio para decidir si un lead “puede” recibir outbound (scoring/contactabilidad/auditoría).
- Preparar payloads y registrar auditoría del intento/decisión.

No debe:

- Usar WhatsApp Web automatizado como canal de entrega.
- Asumir disponibilidad de Meta API hasta que sea integrada y validada.

---

## 6. Contratos congelados (WhatsApp layer)

### 6.1 AS-IS (implementado hoy)

`session-manager` expone el estado como string uppercase vía `GET /status`:

- `INIT`
- `QR_REQUIRED`
- `AUTHENTICATED`
- `READY`
- `DISCONNECTED`
- `ERROR`

`GET /qr` retorna:

- `{ "status": "NO_QR" }`, o
- `{ "status": "QR_AVAILABLE", "qr": "data:image/png;base64,..." }`

### 6.2 PLANNED (contrato congelado)

El contrato “con enums congelados en minúscula + `instance_id`” está definido como objetivo en [ARCHITECTURE_STATE_2026_02.md](./ARCHITECTURE_STATE_2026_02.md), pero **no coincide** con el código actual.

Regla: mientras no haya migración formal, el contrato vigente es el AS-IS.