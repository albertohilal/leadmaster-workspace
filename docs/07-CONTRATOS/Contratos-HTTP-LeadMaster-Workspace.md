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

### 3.2 Identidad WhatsApp: `instance_id` (única identidad de la capa WhatsApp)

- Identificador opaco y estable de una instancia WhatsApp.
- **Session-manager y servicios WhatsApp-layer no aceptan `cliente_id`.**

Ejemplo:

```json
{
  "instance_id": "acme-01"
}
```

---

## 4. Servicio: session-manager

Responsable de:

* Mantener sesión WhatsApp por `instance_id`
* Exponer estado operativo
* Enviar mensajes
* Proveer información básica de la cuenta
* Permitir operaciones de mantenimiento controladas

---

### 4.1 GET /api/session-manager/sessions/{instance_id}

**Descripción**
Devuelve el estado actual de la sesión WhatsApp para una instancia.

**Request**

```http
GET /api/session-manager/sessions/acme-01
```

**Response 200**

```json
{
  "instance_id": "acme-01",
  "status": "connected",
  "qr_status": "none",
  "qr_string": null,
  "updated_at": "2026-02-27T12:00:00Z"
}
```

**Estados posibles (`status`)**

* `init`
* `qr_required`
* `connecting`
* `connected`
* `disconnected`
* `error`

**Estados posibles (`qr_status`)**

* `none`
* `generated`
* `expired`
* `used`

---

### 4.2 POST /api/session-manager/sessions/{instance_id}/qr

**Descripción**
Inicia (si hace falta) la sesión para la instancia y devuelve un snapshot con QR cuando corresponda.

**Request**

```http
POST /api/session-manager/sessions/acme-01/qr
```

**Response 200**

```json
{
  "instance_id": "acme-01",
  "status": "qr_required",
  "qr_status": "generated",
  "qr_string": "2@...",
  "updated_at": "2026-02-27T12:00:00Z"
}
```

**Errores**

* `409` → sesión no requiere QR

---

### 4.3 POST /api/session-manager/sessions/{instance_id}/send

**Descripción**
Envía un mensaje WhatsApp.

**Request**

```json
{
  "to": "5491123456789",
  "message": "Hola, este es un mensaje de prueba"
}
```

**Response 200**

```json
{
  "ok": true,
  "message_id": "wamid.HBgLM..."
}
```

**Errores comunes**

* `400` → datos inválidos
* `409` → sesión no conectada (`status != connected`)
* `500` → error interno WhatsApp

---

### 4.4 POST /api/session-manager/sessions/{instance_id}/disconnect

**Descripción**
Desconecta la sesión WhatsApp de forma controlada.

**Uso**
Solo para mantenimiento o recuperación.

**Request**

```http
POST /api/session-manager/sessions/acme-01/disconnect
```

**Response 200**

```json
{
  "ok": true
}
```

---

### 4.5 GET /api/session-manager/sessions/{instance_id}/account-info (opcional)

**Descripción**
Devuelve información básica de la cuenta WhatsApp conectada.

**Request**

```http
GET /api/session-manager/sessions/acme-01/account-info
```

**Response 200**

```json
{
  "number": "5491123456789",
  "name": "Empresa Cliente",
  "platform": "whatsapp"
}
```

---

### 4.6 GET /health

**Descripción**
Healthcheck del servicio session-manager.

**Response 200**

```json
{
  "service": "session-manager",
  "status": "healthy",
  "uptime": 86400,
  "whatsapp": "connected"
}
```

---

## 5. Servicio: listener

Responsable de:

* Procesar mensajes entrantes
* Persistir mensajes
* Llamar a IA o marcar pausas

### 5.1 POST /incoming-message

**Descripción**
Endpoint interno llamado por session-manager.

**Request**

```json
{
  "instance_id": "acme-01",
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

Para operaciones WhatsApp, central-hub debe resolver además un `instance_id` (opaco) y usarlo con session-manager/listener.

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
El código debe adaptarse al contrato, no al revés.
