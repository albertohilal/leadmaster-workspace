# Contratos HTTP entre Servicios

## LeadMaster Workspace (Multi‑cliente)

---

## 1. Objetivo

Este documento define los **contratos HTTP formales** entre los servicios del workspace LeadMaster.

Su propósito es:

* Establecer interfaces estables entre servicios desacoplados
* Evitar dependencias implícitas
* Permitir desarrollo paralelo
* Facilitar versionado, testing y rollback

> **Regla base**: ningún servicio accede directamente a la base de datos o librerías internas de otro servicio.

---

## 2. Principios generales

1. Todos los contratos son **HTTP/JSON**
2. Todo request debe incluir una **identidad de contrato** (según el servicio)
3. Los servicios pueden ser **stateful por identidad**, pero **stateless entre requests**
4. Los errores deben ser explícitos y tipificados
5. No se asume orden de ejecución implícito

---

## 3. Identidad multicliente

El workspace es multi-tenant, pero **no todas las integraciones comparten la misma identidad**.

### 3.1 Identidad de negocio: `cliente_id`

- Identifica tenant/cliente del producto.
- Se usa en servicios de dominio (central-hub, sender, massive-sender, etc.).

Ejemplo:

```json
{
  "cliente_id": 51
}
```

### 3.2 Identidad WhatsApp (IMPLEMENTADO HOY): sesión ADMIN única

**Estado actual del código:** `session-manager` opera como **single-admin** (una sola sesión WhatsApp para todo el sistema). No existe `instance_id` en la API real hoy.

Implicancias:

- Las rutas no son multi-instancia.
- El parámetro `cliente_id` existe en `POST /send` y es **requerido** por validación, pero es **metadata** (no selecciona sesión).

Ejemplo (send):

```json
{
  "cliente_id": 51,
  "to": "5491123456789",
  "message": "Hola"
}
```

### 3.3 Identidad WhatsApp (PLANNED): `instance_id`

**Objetivo futuro (no implementado en el código actual):** modelar WhatsApp por `instance_id` (string opaco) y eliminar dependencia de `cliente_id` en la capa WhatsApp.

---

## 4. Servicio: session-manager

Responsable de:

* Mantener sesión WhatsApp **ADMIN única** (single-admin)
* Exponer estado operativo y QR
* Enviar mensajes
* Permitir operaciones de mantenimiento controladas (connect/disconnect)

---

### 4.1 GET /health

**Descripción**
Healthcheck del servicio.

**Request**

```http
GET /health
```

**Response 200**

```json
{
  "status": "ok",
  "service": "session-manager",
  "timestamp": "2026-02-27T12:00:00.000Z"
}
```

---

### 4.2 GET /status

**Descripción**
Devuelve el estado de la sesión ADMIN.

**Request**

```http
GET /status
```

**Response 200**

```json
{
  "status": "READY"
}
```

**Estados posibles (`status`) (implementados)**

* `INIT`
* `QR_REQUIRED`
* `AUTHENTICATED`
* `READY`
* `DISCONNECTED`
* `ERROR`

---

### 4.3 GET /qr

**Descripción**
Devuelve el QR actual (si existe) para autenticar la sesión ADMIN.

**Request**

```http
GET /qr
```

**Response 200**

```json
{ "status": "NO_QR" }
```

**Response 200 (QR disponible)**

```json
{
  "status": "QR_AVAILABLE",
  "qr": "data:image/png;base64,iVBORw0KGgo..."
}
```

Notas:

- `qr` suele venir como PNG DataURL (`data:image/png;base64,...`).
- En casos no esperados, puede venir con `qrType: "raw_string"`.

---

### 4.4 POST /send

**Descripción**
Envía un mensaje WhatsApp.

**Request**

```json
{
  "cliente_id": 51,
  "to": "5491123456789",
  "message": "Hola, este es un mensaje de prueba"
}
```

**Response 200**

```json
{
  "success": true,
  "message": "Message sent",
  "data": {
    "success": true,
    "cliente_id": 51,
    "to": "5491123456789",
    "timestamp": "2026-02-27T12:00:00.000Z",
    "method": "WWEBJS"
  }
}
```

**Errores comunes**

* `400` → validación (`INVALID_CLIENTE_ID`, `INVALID_TO`, `INVALID_MESSAGE`)
* `503` → sesión no lista (`SESSION_NOT_READY`)
* `500` → error interno (`SEND_FAILED`)

---

### 4.5 POST /connect

**Descripción**
Inicia la conexión del cliente WhatsApp (single-admin). El proceso es asíncrono: el endpoint responde 200 aunque WhatsApp todavía esté conectando.

**Request**

```http
POST /connect
```

**Response 200**

```json
{
  "success": true,
  "message": "Connected",
  "session": "admin",
  "state": "INIT",
  "alreadyConnected": false
}
```

---

### 4.6 POST /disconnect

**Descripción**
Desconecta la sesión WhatsApp de forma controlada.

**Uso**
Solo para mantenimiento o recuperación.

**Request**

```http
POST /disconnect
```

**Response 200**

```json
{
  "success": true,
  "message": "Disconnected"
}
```

---

---

### 4.7 Contrato `instance_id` (PLANNED)

El contrato por `instance_id` (rutas tipo `/api/session-manager/sessions/{instance_id}` y enums en minúscula) está documentado como **objetivo** en documentos de arquitectura, pero **no coincide** con el código actual.

---

## 5. Servicio: listener

Responsable de:

* Procesar mensajes entrantes
* Persistir mensajes
* Llamar a IA o marcar pausas

### 5.1 POST /incoming-message (PLANNED)

**Descripción**
Endpoint interno planificado (no implementado/consumido por el `session-manager` actual).

**Request**

```json
{
  "from": "5491199988877",
  "message": "Hola, necesito info",
  "timestamp": "2026-01-01T12:30:00Z"
}
```

**Response 200**

```json
{
  "ok": true
}
```

---

## 6. Servicio: massive-sender

Responsable de:

* Ejecutar campañas
* Controlar rate‑limit
* Reintentos y pausas

### 6.1 POST /enqueue

**Descripción**
Agrega un mensaje a la cola de envíos de un cliente.

**Request**

```json
{
  "cliente_id": 51,
  "campaign_id": 12,
  "to": "5491133344455",
  "message": "Promo válida hasta hoy"
}
```

**Response 200**

```json
{
  "queued": true
}
```

---

## 7. Servicio: leadmaster-central-hub (API)

Responsable de:

* Autenticación
* Contexto de cliente
* Orquestación

### 7.1 Middleware de contexto de cliente

Todo request autenticado debe resolver:

```js
req.cliente_id
```

Ese valor:

* se valida contra `ll_usuarios`
* se propaga a servicios de negocio

Para operaciones WhatsApp **en el código actual**, central-hub opera con `cliente_id` y consume un `session-manager` single-admin.

Nota: La resolución de `instance_id` (opaco) aparece en documentación/planificación, pero **no está implementada end-to-end**.

---

## 8. Errores estándar

Formato común:

```json
{
  "error": true,
  "code": "SESSION_NOT_READY",
  "message": "WhatsApp session not ready"
}
```

Códigos sugeridos:

* `INVALID_CLIENT`
* `SESSION_NOT_READY`
* `RATE_LIMIT`
* `UNAUTHORIZED`

---

## 9. Versionado de contratos

* Versión inicial: `v1`
* Cambios incompatibles → nuevo endpoint o versión
* Nunca romper contratos existentes sin migración

---

## 10. Próximo paso

Con estos contratos definidos:

1. Implementar `session-manager` multicliente
2. Implementar listener desacoplado
3. Agregar cola real (BullMQ / Redis)

---

**Este documento es vinculante.**
El código y el contrato deben mantenerse coherentes. Cuando haya divergencias, deben quedar explícitas y planificadas.
