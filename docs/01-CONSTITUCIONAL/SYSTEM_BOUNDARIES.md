# SYSTEM BOUNDARIES

**Status:** Active (Constitutional)  
**Purpose:** Definir qué está dentro y fuera del alcance del sistema, y fijar límites de responsabilidad entre servicios  
**Last Updated:** 2026-02-27  
**Related:** [PROJECT_STATUS.md](./PROJECT_STATUS.md)

---

## 1. In Scope (Dentro del sistema)

Incluye:

- API y frontend de LeadMaster (central-hub) para operación diaria.
- Envío y recepción de mensajes WhatsApp **vía servicios internos**.
- Autenticación/Autorización (JWT) y aplicación de reglas de negocio (sender, scoring, validaciones).
- Persistencia de datos del dominio (leads, campañas, mensajes, auditoría) en la base del workspace.
- Observabilidad operativa básica: logs, healthchecks, métricas mínimas.

### Servicios principales (responsabilidad)

- **central-hub**: capa de producto (auth, API, frontend, orquestación). Es dueño del contexto de usuario/cliente.
- **session-manager**: capa WhatsApp (estado de sesión, QR, envío). No conoce el dominio de negocio.
- **listener**: procesamiento de mensajes entrantes (normalización, persistencia, disparadores controlados).
- **sender**: reglas de envío (bloqueos por scoring/contactabilidad, DRY-RUN, auditoría).

## 2. Out of Scope (Fuera del sistema)

No incluye:

- Garantías de entrega o SLA de WhatsApp (depende de WhatsApp).
- Modelos de IA externos como parte del contrato de plataforma (pueden existir integraciones, pero no son parte del núcleo contractual).
- Proveedores de infraestructura (Contabo, Cloudflare) como “componentes internos”: son dependencias externas.
- Sistemas de colas/streaming y orquestación avanzada (si se incorporan, deben ser explicitados en fase y contrato).

## 3. Identidades y ownership (Regla constitucional)

### 3.1 Identidad de negocio: cliente_id

- **`cliente_id`** identifica el *tenant* / cliente del producto.
- Vive en el dominio de **central-hub** (y servicios de negocio).
- Se usa para autorización, queries, auditoría y trazabilidad del dominio.

### 3.2 Identidad WhatsApp: instance_id (única identidad en la capa WhatsApp)

- **`instance_id`** es la **única** identidad aceptada por la *capa WhatsApp*.
- Es un identificador **opaco y estable** (string) de una instancia WhatsApp gestionada por el sistema.
- `instance_id` **no es** `cliente_id` y **no debe** transportarlo.

#### Prohibiciones

- `cliente_id` **no** viaja a session-manager (ni header, ni query, ni body).
- No existe header `X-Cliente-Id` en el contrato WhatsApp.
- No se permite “traducción/mapeo de estados” entre servicios: los enums del contrato son consumidos **as-is**.

#### Permiso de mapeo (solo en dominio central-hub)

- Si existe relación entre `cliente_id` y `instance_id`, ese mapeo pertenece al dominio de **central-hub**.
- Ningún servicio WhatsApp (session-manager, listener, etc.) debe requerir `cliente_id` para operar.

## 4. Integraciones externas

- **WhatsApp Web** (sistema externo): autenticación mediante QR, conectividad y políticas de rate-limit externas.
- **Nginx** (infra): reverse proxy, TLS termination, routing.
- **Cloudflare** (infra): DNS/SSL mode, caching/control según configuración.
- **Base de datos** (infra interna): almacenamiento del dominio (no accesible directamente por servicios no autorizados).

## 5. Límites de responsabilidad por servicio

### 5.1 central-hub

Debe:

- Autenticar y autorizar.
- Resolver/validar la pertenencia de `instance_id` al contexto autenticado.
- Aplicar reglas de negocio (calidad, scoring, bloqueos de envío).

No debe:

- Importar librerías de WhatsApp ni administrar su lifecycle.
- Persistir “estado de sesión WhatsApp” como fuente de verdad.

### 5.2 session-manager

Debe:

- Gestionar sesiones WhatsApp **por `instance_id`**.
- Exponer estado/QR/envío via HTTP siguiendo enums congelados.

No debe:

- Conocer `cliente_id` o reglas del dominio de negocio.
- Tomar decisiones de “cuándo enviar” o “a quién enviar”.

### 5.3 listener

Debe:

- Recibir mensajes entrantes y persistirlos.
- Enrutar a reglas de negocio de forma controlada.

No debe:

- Depender de `cliente_id` proveniente de la capa WhatsApp.

## 6. Contratos congelados (WhatsApp layer)

La capa WhatsApp expone enums congelados (ver [ARCHITECTURE_STATE_2026_02.md](./ARCHITECTURE_STATE_2026_02.md)):

- `SessionStatus`: `init`, `qr_required`, `connecting`, `connected`, `disconnected`, `error`
- `QRStatus`: `none`, `generated`, `expired`, `used`

Ningún servicio puede introducir nuevos estados o mapearlos a valores “locales”.
