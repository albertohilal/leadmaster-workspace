# Contratos HTTP — Mailer — LeadMaster Workspace

**Version:** 1.0  
**Status:** APPROVED  
**Date:** 2026-03-10  
**Owner:** Alberto Hilal  
**Approved by:** Alberto Hilal  
**Approved on:** 2026-03-10  
**Scope:** Contrato HTTP/JSON entre `central-hub` y `mailer`

---

## 1. Objetivo

Definir el contrato HTTP inicial del servicio `mailer` dentro de LeadMaster Workspace.

Este documento fija el acuerdo de integración entre:

- `central-hub` como orquestador de negocio
- `mailer` como servicio técnico de entrega de email

El contrato existe para evitar acoplamiento implícito y para asegurar consistencia multi-tenant, trazabilidad y evolución controlada.

---

## 2. Principios generales

### 2.1 Hub orquesta, mailer entrega
`central-hub` decide flujos de negocio.  
`mailer` ejecuta la entrega técnica del correo.

### 2.2 Multi-tenant obligatorio
Todo request funcional debe estar asociado a `cliente_id`.

### 2.3 Contrato primero
El código debe adaptarse a este contrato.  
No se modificará el contrato informalmente para acomodar implementaciones accidentales.

### 2.4 JSON sobre HTTP
La comunicación entre `central-hub` y `mailer` se realiza sobre HTTP/JSON.

### 2.5 Errores tipificados
Los errores deben devolverse con estructura consistente y legible.

---

## 3. Alcance del servicio `mailer`

### Incluido
- healthcheck
- envío individual de email
- validación técnica básica del request
- devolución de resultado técnico
- tipificación de error
- soporte multi-tenant a nivel de contrato

### No incluido en esta versión
- campañas masivas complejas
- tracking de aperturas
- tracking de clicks
- secuencias automáticas avanzadas
- webhooks complejos
- recepción inbound completa
- colas distribuidas

---

## 4. Convenciones

### 4.1 Content-Type
Todos los endpoints que reciben payload deben aceptar:

`Content-Type: application/json`

### 4.2 Formato de respuesta
Toda respuesta debe ser JSON.

### 4.3 Fechas
Las fechas deben devolverse en formato ISO 8601 cuando aplique.

### 4.4 IDs
Los IDs internos pueden ser numéricos o string según implementación, pero deben ser consistentes dentro de cada endpoint.

### 4.5 Seguridad
La autenticación entre servicios queda fuera del alcance detallado de este documento, pero el contrato asume que `mailer` no es público y que será consumido por servicios confiables del workspace.

---

## 5. Endpoint: `GET /health`

### Objetivo
Permitir verificación de disponibilidad básica del servicio.

### Request
```http
GET /health
```

### Response 200

```json
{
  "service": "mailer",
  "status": "healthy",
  "timestamp": "2026-03-10T12:00:00.000Z"
}
```

### Reglas

* no requiere `cliente_id`
* no ejecuta lógica de negocio
* debe responder de forma rápida y simple

---

## 6. Endpoint: `POST /send`

### Objetivo

Enviar un email individual asociado a un cliente.

### Request

```http
POST /send
Content-Type: application/json
```

### Payload mínimo

```json
{
  "cliente_id": 51,
  "to": "lead@empresa.com",
  "subject": "Presentación comercial",
  "text": "Hola, te escribimos de parte de Conrad...",
  "html": "<p>Hola, te escribimos de parte de Conrad...</p>"
}
```

### Payload extendido sugerido

```json
{
  "cliente_id": 51,
  "campaign_id": 12,
  "contact_id": 345,
  "from_email": "ventas@conradsa.com.ar",
  "from_name": "Conrad",
  "reply_to": "contacto@conradsa.com.ar",
  "to": "lead@empresa.com",
  "subject": "Presentación comercial",
  "text": "Hola, te escribimos de parte de Conrad...",
  "html": "<p>Hola, te escribimos de parte de Conrad...</p>",
  "metadata": {
    "segmento": "colegios",
    "fuente": "desarrolloydisenio-api",
    "landing_url": "https://conradsa.com.ar/uniformes"
  }
}
```

---

## 7. Reglas de validación para `POST /send`

### 7.1 Obligatorios

Deben existir como mínimo:

* `cliente_id`
* `to`
* `subject`
* al menos uno entre `text` o `html`

### 7.2 `cliente_id`

* debe existir
* debe ser entero positivo o identificador válido según implementación adoptada
* no puede omitirse

### 7.3 `to`

* debe ser email válido en formato básico
* no puede estar vacío

### 7.4 `subject`

* no puede estar vacío

### 7.5 Cuerpo del mensaje

* al menos uno entre `text` o `html` debe existir
* ambos pueden coexistir
* se recomienda enviar ambas versiones cuando sea posible

### 7.6 Campos opcionales

Pueden incluirse:

* `campaign_id`
* `contact_id`
* `from_email`
* `from_name`
* `reply_to`
* `metadata`

### 7.7 Campos no admitidos

El servicio puede ignorar campos no reconocidos o rechazarlos explícitamente.
La política debe ser consistente.

Recomendación inicial:

* rechazar campos inválidos solo si comprometen seguridad o interpretación
* ignorar campos extra inocuos si no afectan el contrato

---

## 8. Response exitosa de `POST /send`

### Response 200

```json
{
  "ok": true,
  "service": "mailer",
  "cliente_id": 51,
  "provider": "smtp",
  "accepted": true,
  "message_id": "msg_abc123",
  "status": "SENT",
  "timestamp": "2026-03-10T12:00:00.000Z"
}
```

### Significado

* `ok`: la operación fue procesada exitosamente
* `accepted`: el proveedor aceptó el envío
* `message_id`: identificador técnico del envío
* `status`: estado inicial del envío

### Nota

`accepted: true` no implica apertura, lectura ni interés comercial.
Solo indica aceptación técnica inicial del envío.

---

## 9. Errores de `POST /send`

### 9.1 Error de validación — Response 400

```json
{
  "error": true,
  "code": "VALIDATION_ERROR",
  "message": "cliente_id is required",
  "details": {
    "field": "cliente_id"
  }
}
```

### 9.2 Error de autenticación/autorización entre servicios — Response 401/403

```json
{
  "error": true,
  "code": "UNAUTHORIZED",
  "message": "Unauthorized request"
}
```

o

```json
{
  "error": true,
  "code": "FORBIDDEN",
  "message": "Forbidden request"
}
```

### 9.3 Error de proveedor — Response 502

```json
{
  "error": true,
  "code": "MAIL_PROVIDER_ERROR",
  "message": "SMTP authentication failed"
}
```

### 9.4 Error interno — Response 500

```json
{
  "error": true,
  "code": "INTERNAL_ERROR",
  "message": "Unexpected internal error"
}
```

### 9.5 Error de timeout o indisponibilidad de proveedor — Response 503

```json
{
  "error": true,
  "code": "SERVICE_UNAVAILABLE",
  "message": "Mailer provider unavailable"
}
```

---

## 10. Tabla de códigos de error sugeridos

| Code                  | HTTP | Significado                            |
| --------------------- | ---: | -------------------------------------- |
| `VALIDATION_ERROR`    |  400 | Payload inválido o incompleto          |
| `UNAUTHORIZED`        |  401 | Request no autenticado                 |
| `FORBIDDEN`           |  403 | Request autenticado pero no autorizado |
| `NOT_FOUND`           |  404 | Recurso no encontrado                  |
| `MAIL_PROVIDER_ERROR` |  502 | Falla del proveedor de envío           |
| `SERVICE_UNAVAILABLE` |  503 | Servicio o dependencia no disponible   |
| `INTERNAL_ERROR`      |  500 | Error interno inesperado               |

---

## 11. Responsabilidades por lado

### 11.1 `central-hub` debe

* validar lógica de negocio antes de llamar a `mailer`
* resolver `cliente_id`
* decidir destinatario y contenido
* registrar flujo comercial
* decidir clasificación y derivación

### 11.2 `central-hub` no debe

* delegar al `mailer` la decisión de a quién contactar
* asumir que un envío exitoso implica interés
* usar `mailer` como dueño del flujo de negocio

### 11.3 `mailer` debe

* validar payload técnico mínimo
* intentar entrega
* devolver resultado técnico consistente
* tipificar errores
* mantener desacople respecto del proveedor

### 11.4 `mailer` no debe

* decidir campañas
* enriquecer base comercial
* clasificar interés
* derivar leads al cliente
* reemplazar lógica del hub

---

## 12. Endpoint futuro sugerido: `POST /incoming-email`

### Estado

Fuera de alcance de la versión 1.0, pero previsto para evolución futura.

### Objetivo potencial

Permitir registrar o normalizar correos entrantes para asociarlos a leads/contactos.

### Payload tentativo

```json
{
  "cliente_id": 51,
  "from": "lead@empresa.com",
  "to": "ventas@conradsa.com.ar",
  "subject": "Re: Presentación comercial",
  "text": "Me interesa recibir más información",
  "html": "<p>Me interesa recibir más información</p>",
  "received_at": "2026-03-10T13:00:00.000Z",
  "provider_message_id": "incoming_001"
}
```

### Nota

Este endpoint no forma parte del mínimo implementable inicial.

---

## 13. Endpoint futuro sugerido: `GET /message-status/:id`

### Estado

Fuera de alcance de la versión 1.0, pero compatible con evolución futura.

### Objetivo potencial

Consultar estado técnico de un envío ya registrado.

### Response ejemplo

```json
{
  "ok": true,
  "message_id": "msg_abc123",
  "status": "SENT",
  "provider": "smtp",
  "timestamp": "2026-03-10T12:00:00.000Z"
}
```

---

## 14. Compatibilidad y versionado

Este contrato corresponde a la versión inicial del servicio `mailer`.

Toda ampliación futura debe:

* preservar compatibilidad cuando sea razonable
* documentarse antes de implementarse
* evitar romper integraciones existentes sin transición explícita

---

## 15. Ejemplo de integración esperada

### Paso 1

`central-hub` decide enviar un correo de prospección a un lead.

### Paso 2

`central-hub` construye payload con:

* `cliente_id`
* destinatario
* asunto
* cuerpo
* metadata opcional

### Paso 3

`central-hub` llama a `POST /send`

### Paso 4

`mailer` responde:

* éxito técnico
* o error tipificado

### Paso 5

`central-hub` registra el resultado y actualiza estado funcional del lead.

---

## 16. Reglas de interpretación

Este contrato define integración técnica, no éxito comercial.

En particular:

* `status: SENT` no implica interés
* `accepted: true` no implica lectura
* `message_id` no implica derivación
* toda clasificación comercial sigue siendo responsabilidad del hub y del proceso LeadMaster

---

## 17. Documentos relacionados

* `docs/01-CONSTITUCIONAL/ADR-001-CANAL-EMAIL-PROSPECCION-OPERADO-POR-LEADMASTER.md`
* `docs/06-FASES/PHASE-4B-EMAIL-PROSPECTING-PLAN.md`
* `docs/04-INTEGRACION/ARQUITECTURA-CANAL-EMAIL.md`
* `docs/05-REPORTES/OPS/REQUISITOS-MINIMOS-CANAL-EMAIL.md`

---

## 18. Estado

**Status actual:** APPROVED  
**Approved by:** Alberto Hilal  
**Approved on:** 2026-03-10

Este documento fija el contrato inicial entre `central-hub` y `mailer`.
La implementación futura debe respetar este contrato o proponer formalmente su evolución.
