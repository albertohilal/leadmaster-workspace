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
2. Todo request debe incluir **`cliente_id`**
3. Los servicios son **stateful por cliente**, pero **stateless entre requests**
4. Los errores deben ser explícitos y tipificados
5. No se asume orden de ejecución implícito

---

## 3. Identidad multicliente

### Campo obligatorio

Todos los requests deben incluir:

```json
{
  "cliente_id": 51
}
```

Puede viajar:

* en el body (POST)
* en query params (GET)
* o en header interno

```http
X-Cliente-Id: 51
```

📌 Si `cliente_id` falta o es inválido → **HTTP 400**

---

## 4. Servicio: session-manager

Responsable de:

* Mantener sesión WhatsApp
* Enviar mensajes
* Emitir eventos de mensajes entrantes

### 4.1 GET /status

**Descripción**
Devuelve el estado de la sesión WhatsApp para un cliente.

**Request**

```http
GET /status
X-Cliente-Id: 51
```

**Response 200**

```json
{
  "cliente_id": 51,
  "connected": true,
  "state": "READY"
}
```

**Estados posibles (`state`)**

* `INIT`
* `QR_REQUIRED`
* `READY`
* `DISCONNECTED`

---

### 4.2 POST /send

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
  "ok": true,
  "message_id": "wamid.HBgLM..."
}
```

**Errores comunes**

* `400` → datos inválidos
* `409` → sesión no lista (`state != READY`)
* `500` → error interno WhatsApp

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
  "cliente_id": 51,
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
* se propaga a otros servicios

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
