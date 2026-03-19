````markdown
# Contratos HTTP — Central Hub Mailer Gateway — LeadMaster Workspace

**Version:** 1.0  
**Status:** IMPLEMENTED  
**Date:** 2026-03-15  
**Owner:** Alberto Hilal  
**Scope:** Contrato HTTP/JSON del gateway autenticado de `central-hub` para envío de Email

---

## 1. Objetivo

Documentar formalmente el contrato HTTP del gateway autenticado que expone `central-hub` para el canal Email.

Este documento define la frontera pública interna que consume el frontend u otros consumidores autenticados del hub para disparar un envío de Email.

Este contrato existe para dejar explícito que:

- no se consume directamente el servicio standalone `leadmaster-mailer` desde el frontend
- `central-hub` actúa como gateway autenticado
- `cliente_id` no viaja libremente desde el caller
- `cliente_id` se deriva del JWT autenticado
- el ejecutor real del envío sigue siendo `leadmaster-mailer`

---

## 2. Alcance

Este contrato cubre exclusivamente el endpoint autenticado expuesto por `central-hub`:

- `POST /mailer/send`

Incluye:

- autenticación requerida
- request body permitido por el gateway
- reglas de negocio aplicadas por `central-hub`
- forma esperada de respuesta exitosa
- errores esperables del gateway
- mapeo de errores devueltos por el servicio upstream `leadmaster-mailer`

No incluye:

- el contrato standalone de `leadmaster-mailer`
- endpoints internos o privados del mailer
- contratos comerciales de campañas masivas
- dashboard comercial de Email
- enriquecimiento automático masivo de emails

---

## 3. Frontera del contrato

La frontera de este contrato es:

- caller autenticado → `central-hub` gateway → `leadmaster-mailer`

La responsabilidad de cada componente es distinta:

### `central-hub`

- autentica al caller vía JWT
- valida el body funcional del request
- resuelve `cliente_id` desde el usuario autenticado
- ignora `cliente_id` si llega en el body
- delega el envío al servicio standalone `leadmaster-mailer`

### `leadmaster-mailer`

- recibe el request interno desde `central-hub`
- usa `cliente_id` para resolver SMTP por cliente
- consulta `iunaorg_dyd.ll_clientes_email_config`
- ejecuta el envío real
- persiste/audita el resultado técnico del envío

Regla explícita:

- el frontend no llama directamente al standalone `leadmaster-mailer`
- el frontend llama al gateway autenticado de `central-hub`

---

## 4. Endpoint documentado

### `POST /mailer/send`

**Descripción**  
Gateway autenticado para solicitar el envío de un Email usando el contexto tenant derivado del usuario autenticado.

**Base de publicación**  
Se publica desde `central-hub` sin prefijo `/api`, por contrato actual.

**Content-Type**  
`application/json`

**Respuesta**  
`application/json`

---

## 5. Autenticación

Este endpoint requiere autenticación obligatoria por JWT.

Header requerido:

```http
Authorization: Bearer <JWT>
````

Regla de identidad tenant:

* `cliente_id` se obtiene desde `req.user.cliente_id`
* si el usuario autenticado no tiene un `cliente_id` numérico positivo, el gateway rechaza la operación

Consecuencia funcional:

* `cliente_id` no debe ser enviado por el caller como fuente de verdad
* si `cliente_id` viene en el body, el hub lo ignora

---

## 6. Request body

### Body permitido por el gateway

```json
{
  "to": "destino@email.com",
  "subject": "Asunto",
  "text": "Contenido"
}
```

### Campos del contrato

* `to`: email destino válido
* `subject`: asunto no vacío
* `text`: contenido de texto no vacío

### Regla explícita sobre `cliente_id`

* `cliente_id` no debe ser enviado por el caller
* si el caller envía `cliente_id` en el body, `central-hub` lo ignora
* el valor real usado para el envío proviene exclusivamente del usuario autenticado

### Validación aplicada por el gateway

El gateway valida que:

* el payload sea un objeto JSON
* `to` sea un email válido
* `subject` sea un string no vacío
* `text` sea un string no vacío

Si la validación falla, el gateway responde con error `400 VALIDATION_ERROR`.

### Nota de contrato

Este documento define un contrato funcional mínimo para el gateway. Campos fuera de este contrato no forman parte de la interfaz soportada y no deben ser usados por el caller.

---

## 7. Reglas de negocio

Las reglas de negocio implementadas por el gateway son:

1. el caller debe estar autenticado por JWT
2. el gateway obtiene `cliente_id` del usuario autenticado
3. el gateway no confía en `cliente_id` enviado por body
4. el gateway valida el body antes de delegar
5. el gateway construye el payload interno hacia `leadmaster-mailer` con:

   * `cliente_id`
   * `to`
   * `subject`
   * `text`
6. el gateway delega el envío vía HTTP al standalone `leadmaster-mailer`
7. el standalone usa `cliente_id` para resolver SMTP por cliente desde `iunaorg_dyd.ll_clientes_email_config`

Separación importante:

* `central-hub` no ejecuta SMTP
* `leadmaster-mailer` sí ejecuta el envío real

---

## 8. Response success

Cuando el envío es aceptado y procesado exitosamente por el standalone, el gateway responde `200 OK` con una respuesta JSON equivalente al resultado técnico exitoso del mailer.

Respuesta esperada:

```json
{
  "ok": true,
  "service": "mailer",
  "cliente_id": 1,
  "provider": "smtp",
  "accepted": true,
  "message_id": "<...>",
  "status": "SENT",
  "timestamp": "2026-03-15T12:34:56.789Z"
}
```

Semántica de campos:

* `ok`: envío exitoso
* `service`: servicio ejecutor real del envío
* `cliente_id`: tenant efectivo usado por el mailer
* `provider`: proveedor técnico usado para enviar
* `accepted`: confirmación de aceptación técnica del envío
* `message_id`: identificador devuelto por el proveedor/transporte
* `status`: estado final técnico del envío reportado por el mailer
* `timestamp`: fecha/hora ISO 8601 de la respuesta

---

## 9. Errores esperables

### 9.1 `400 VALIDATION_ERROR`

Se devuelve cuando:

* el body no es un objeto válido
* `to` no es un email válido
* `subject` falta o está vacío
* `text` falta o está vacío

Ejemplo:

```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "to must be a valid email",
  "details": {
    "field": "to"
  }
}
```

### 9.2 `403 FORBIDDEN`

Se devuelve cuando el usuario autenticado no expone un `cliente_id` válido.

Ejemplo:

```json
{
  "success": false,
  "error": "FORBIDDEN",
  "message": "Usuario autenticado sin cliente_id válido"
}
```

### 9.3 `503 MAILER_UNREACHABLE`

Se devuelve cuando `central-hub` no puede conectarse al servicio `leadmaster-mailer`.

Ejemplo:

```json
{
  "success": false,
  "error": "MAILER_UNREACHABLE",
  "message": "No se pudo conectar con Mailer en http://.../send"
}
```

### 9.4 `504 MAILER_TIMEOUT`

Se devuelve cuando el request hacia el mailer excede el timeout configurado.

Ejemplo:

```json
{
  "success": false,
  "error": "MAILER_TIMEOUT",
  "message": "Timeout al conectar con Mailer (10000ms)"
}
```

### 9.5 `502 MAILER_UPSTREAM_ERROR`

Se devuelve cuando el standalone responde con un error `5xx`.

Ejemplo:

```json
{
  "success": false,
  "error": "MAILER_UPSTREAM_ERROR",
  "message": "Error en servicio upstream (mailer)",
  "details": {
    "upstream_status": 503,
    "upstream_body": {
      "error": true,
      "code": "SERVICE_UNAVAILABLE",
      "message": "Database unavailable"
    }
  }
}
```

### 9.6 Propagación de errores `4xx` del mailer

Si `leadmaster-mailer` responde con `400`, el gateway propaga `400`.

Si `leadmaster-mailer` responde con otro `4xx`, el gateway propaga ese status `4xx` y devuelve el body upstream cuando está disponible.

Caso típico esperado:

* error `CLIENT_EMAIL_CONFIG_NOT_FOUND` cuando el standalone no encuentra configuración SMTP activa para el `cliente_id` y no hay fallback habilitado. El status exacto devuelto dependerá de la implementación efectiva del standalone en la versión desplegada.

Ejemplo:

```json
{
  "error": true,
  "code": "CLIENT_EMAIL_CONFIG_NOT_FOUND",
  "message": "Client SMTP config not found"
}
```

### 9.7 Otros errores posibles del gateway

Además de los errores anteriores, el gateway puede responder:

* `500 MAILER_INVALID_CONFIG` si `MAILER_BASE_URL` no está definida o es inválida en `central-hub`
* `500 INTERNAL_ERROR` ante una falla interna no tipificada

Estos errores no cambian la frontera contractual principal, pero forman parte del comportamiento observable actual.

---

## 10. Mapeo de errores upstream

La siguiente tabla resume el comportamiento de `central-hub` frente a respuestas del standalone:

| Situación                                       | Respuesta del gateway       |
| ----------------------------------------------- | --------------------------- |
| Validación local del body falla                 | `400 VALIDATION_ERROR`      |
| Usuario autenticado sin `cliente_id` válido     | `403 FORBIDDEN`             |
| Mailer no accesible por red                     | `503 MAILER_UNREACHABLE`    |
| Timeout hacia mailer                            | `504 MAILER_TIMEOUT`        |
| Mailer responde `400`                           | `400` propagado             |
| Mailer responde `4xx` distinto de `400`         | mismo `4xx` propagado       |
| Mailer responde `5xx`                           | `502 MAILER_UPSTREAM_ERROR` |
| Configuración inválida del cliente HTTP del hub | `500 MAILER_INVALID_CONFIG` |

Regla de mapeo principal:

* `central-hub` preserva errores funcionales `4xx` del standalone cuando corresponde
* `central-hub` traduce fallas técnicas `5xx` del standalone a error de upstream en el gateway

---

## 11. Ejemplo curl

```bash
curl -X POST 'http://localhost:3012/mailer/send' \
  -H 'Authorization: Bearer <JWT>' \
  -H 'Content-Type: application/json' \
  -d '{
    "to": "destino@email.com",
    "subject": "Asunto",
    "text": "Contenido"
  }'
```

Ejemplo de éxito esperado:

```json
{
  "ok": true,
  "service": "mailer",
  "cliente_id": 1,
  "provider": "smtp",
  "accepted": true,
  "message_id": "<abc123@example>",
  "status": "SENT",
  "timestamp": "2026-03-15T12:34:56.789Z"
}
```

---

## 12. Relación con el contrato standalone del mailer

Este documento no reemplaza el contrato standalone del servicio `leadmaster-mailer`.

Relación entre ambos contratos:

* contrato standalone del mailer: documenta el servicio técnico `POST /send`
* contrato del gateway de `central-hub`: documenta la frontera autenticada `POST /mailer/send`

Diferencias clave:

1. el caller del gateway no envía `cliente_id` como fuente de verdad
2. `central-hub` deriva `cliente_id` desde JWT
3. el frontend consume el gateway, no el standalone
4. el standalone sigue siendo el ejecutor real del envío y la resolución SMTP

Conclusión:

* son dos contratos distintos
* no deben mezclarse en un mismo punto de consumo

---

## 13. Notas de seguridad

Consideraciones de seguridad vigentes para este contrato:

1. el endpoint debe consumirse únicamente con JWT válido
2. `cliente_id` no debe confiarse al caller
3. el frontend no debe exponerse a consumo directo del standalone `leadmaster-mailer`
4. la resolución SMTP por cliente queda encapsulada en el servicio mailer
5. las credenciales SMTP no forman parte del contrato del gateway
6. la protección de red entre `central-hub` y `leadmaster-mailer` sigue siendo una responsabilidad de infraestructura y despliegue

Nota adicional:

* el contrato asume que `central-hub` es la única frontera autenticada para este caso de uso

---

## 14. Estado del contrato

Estado actual:

* **IMPLEMENTED**

Interpretación del estado:

* el endpoint documentado existe en código
* la autenticación requerida existe en código
* la validación del body existe en código
* la delegación HTTP al standalone existe en código
* la respuesta exitosa y el mapeo de errores están alineados con la implementación observada al 2026-03-15

Este contrato debe actualizarse si cambia cualquiera de los siguientes puntos:

* path del gateway
* forma del body permitido
* forma de autenticación
* estrategia de derivación de `cliente_id`
* política de propagación/mapeo de errores
* shape de respuesta exitosa

```
```
