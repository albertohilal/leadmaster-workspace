````markdown
# Contratos HTTP — Mailer — LeadMaster Workspace

**Version:** 2.0  
**Status:** IMPLEMENTED  
**Date:** 2026-03-15  
**Owner:** Alberto Hilal  
**Scope:** Contrato HTTP/JSON del servicio standalone `leadmaster-mailer`

---

## 1. Objetivo

Dejar documentado de forma completa y formal el contrato HTTP del servicio standalone `leadmaster-mailer`.

Este documento fija el acuerdo técnico de integración para el servicio real ubicado en `services/mailer`, documentando:

- los endpoints efectivamente expuestos por el standalone
- el payload real de envío
- las reglas de validación observadas en código
- la resolución SMTP por cliente
- la auditoría/persistencia de envíos
- la forma real de respuestas y errores

Este contrato describe al servicio técnico interno de envío. No describe la frontera autenticada consumida por frontend.

---

## 2. Alcance

Este contrato cubre exclusivamente los endpoints implementados por el standalone:

- `GET /health`
- `POST /send`

Incluye:

- request/response de ambos endpoints
- body real del envío
- validaciones del payload
- reglas de negocio del servicio
- resolución SMTP por cliente usando `iunaorg_dyd.ll_clientes_email_config`
- fallback SMTP opcional
- auditoría/persistencia en `ll_envios_email`
- errores observables del servicio

No incluye:

- autenticación JWT de usuarios finales
- consumo directo desde frontend
- contratos comerciales de campañas
- dashboard comercial de Email
- enriquecimiento automático masivo de emails
- el gateway autenticado de `central-hub`

---

## 3. Naturaleza del servicio standalone

`leadmaster-mailer` es un servicio standalone interno y especializado en entrega técnica de correo.

Características de esta frontera:

- es un servicio backend independiente
- no es la frontera autenticada para frontend
- no autentica usuarios finales por JWT
- su consumidor principal real es `central-hub`
- ejecuta el envío técnico real del correo
- resuelve SMTP por cliente
- registra auditoría/persistencia técnica del envío

Regla explícita:

- el frontend no debe consumir directamente `leadmaster-mailer`
- la frontera autenticada para frontend corresponde a `central-hub` y está documentada por separado en `docs/07-CONTRATOS/Contratos-HTTP-Central-Hub-Mailer-Gateway.md`

---

## 4. Endpoint `GET /health`

### Objetivo

Permitir verificación básica de disponibilidad del servicio standalone.

### Request

```http
GET /health
````

### Autenticación

No requiere JWT a nivel de contrato actual.

### Response success observada

Respuesta real observada en código:

```json
{
  "service": "mailer",
  "status": "healthy",
  "timestamp": "2026-03-15T12:34:56.789Z"
}
```

Notas:

* el endpoint responde `200 OK`
* el shape actual no incluye `ok: true`
* si se quisiera cambiar esa forma, deberá actualizarse este contrato

### Errores posibles

* `404 NOT_FOUND` para rutas no existentes fuera del endpoint documentado
* `500 INTERNAL_ERROR` ante falla interna no tipificada

---

## 5. Endpoint `POST /send`

### Objetivo

Solicitar el envío técnico de un Email usando el contexto tenant recibido en el payload.

### Request

```http
POST /send
Content-Type: application/json
```

### Naturaleza del contrato

En este contrato sí existe `cliente_id` en body.

Esto diferencia al standalone del gateway de `central-hub`, donde `cliente_id` se deriva del JWT autenticado y no debe ser enviado como fuente de verdad por el caller.

---

## 6. Request body real

### Body mínimo esperado

```json
{
  "cliente_id": 1,
  "to": "destino@email.com",
  "subject": "Asunto",
  "text": "Contenido"
}
```

### Variante válida con `html`

```json
{
  "cliente_id": 1,
  "to": "destino@email.com",
  "subject": "Asunto",
  "html": "<p>Contenido</p>"
}
```

### Campos requeridos

* `cliente_id`: entero positivo requerido
* `to`: email válido requerido
* `subject`: string no vacío requerido
* `text` o `html`: al menos uno es requerido

### Campos aceptados por la validación actual

Además del mínimo funcional, la validación actual también acepta estos campos y los normaliza/pasa al servicio:

* `campaign_id`
* `contact_id`
* `from_email`
* `from_name`
* `reply_to`
* `metadata`

Nota contractual:

* el flujo real de envío técnico depende de `cliente_id`, `to`, `subject` y `text` o `html`
* los campos adicionales no alteran la regla central del contrato

---

## 7. Reglas de validación

Las validaciones observadas en código son:

1. el payload debe ser un objeto JSON
2. `cliente_id` es obligatorio
3. `cliente_id` debe ser entero positivo
4. `to` debe ser un email válido
5. `subject` debe ser un string no vacío
6. debe existir al menos uno entre `text` o `html`

### Errores de validación

Si alguna validación falla, el servicio responde con:

* status `400`
* `code: VALIDATION_ERROR`

Shape real de error:

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

### Casos típicos de validación

* `payload must be an object`
* `cliente_id is required`
* `cliente_id must be a positive integer`
* `to must be a valid email`
* `subject is required`
* `text or html is required`
* `Invalid JSON`

---

## 8. Reglas de negocio

Las reglas de negocio del standalone son:

1. el caller provee `cliente_id` en el body
2. el servicio valida el payload antes de intentar el envío
3. el servicio crea primero un registro de auditoría `PENDING`
4. el servicio intenta resolver SMTP por cliente
5. si encuentra configuración SMTP activa, usa esa configuración
6. si no encuentra configuración, evalúa fallback SMTP según configuración global
7. si logra construir un transporter válido, ejecuta el envío real
8. si el envío resulta exitoso, marca auditoría como `SENT`
9. si falla, marca auditoría como `FAILED` cuando corresponde

Separación importante:

* el standalone es el ejecutor técnico del envío
* no decide autenticación de usuario final
* no reemplaza la frontera autenticada del hub

---

## 9. Resolución SMTP por cliente

La resolución SMTP por cliente es obligatoria en la lógica del servicio.

Regla implementada:

1. buscar configuración SMTP activa por `cliente_id`
2. consulta realizada sobre `iunaorg_dyd.ll_clientes_email_config`
3. condición funcional observada: `cliente_id = ?` e `is_active = 1`
4. si existe configuración activa, construir el transporter con esos datos

Datos funcionales usados desde la configuración del cliente:

* `smtp_host`
* `smtp_port`
* `smtp_secure`
* `smtp_user`
* `smtp_pass`
* `from_email`
* `from_name`
* `reply_to_email`

Conclusión:

* el servicio es multi-tenant a nivel SMTP
* la identidad técnica de envío depende del `cliente_id` recibido en el body

---

## 10. Fallback opcional

El servicio puede usar un fallback SMTP global si no existe configuración por cliente y la política lo permite.

Regla observada:

* si no se encuentra configuración activa por cliente y `SMTP_FALLBACK_ENABLED=false`, el servicio responde error
* si no se encuentra configuración activa por cliente y `SMTP_FALLBACK_ENABLED=true`, el servicio intenta construir transporte SMTP global por variables de entorno

Variables de entorno asociadas al fallback:

* `SMTP_HOST`
* `SMTP_PORT`
* `SMTP_SECURE`
* `SMTP_USER`
* `SMTP_PASS`
* `SMTP_FROM_EMAIL`
* `SMTP_FROM_NAME`

Si el fallback está habilitado pero la configuración global está incompleta o es inválida, el servicio falla con error interno observable.

Importante:

* el fallback es opcional
* el comportamiento por defecto del sistema es no usar fallback si no fue habilitado explícitamente

---

## 11. Auditoría/persistencia

El standalone audita y persiste técnicamente los envíos en la tabla `ll_envios_email`.

Flujo observado:

1. antes del envío crea registro `PENDING`
2. si el envío es exitoso, actualiza a `SENT`
3. si ocurre un error recuperado en el flujo, actualiza a `FAILED`

Datos principales persistidos/gestionados por el servicio:

* `cliente_id`
* `to_email`
* `subject`
* `body`
* `provider`
* `status`
* `message_id`
* `sent_at`
* `error_message`

La auditoría es parte estructural del servicio, no un agregado opcional.

---

## 12. Response success esperada

Cuando el envío resulta exitoso, el servicio responde `200 OK` con un body como el siguiente:

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

Semántica principal:

* `ok`: resultado exitoso
* `service`: servicio que ejecutó el envío
* `cliente_id`: tenant efectivo usado para resolver SMTP
* `provider`: proveedor técnico utilizado
* `accepted`: aceptación técnica del envío
* `message_id`: identificador devuelto por el transporte/proveedor
* `status`: estado técnico final reportado por el servicio
* `timestamp`: fecha/hora ISO 8601 de la respuesta

---

## 13. Errores esperables

### Shape real de error

La forma real de error del standalone es:

```json
{
  "error": true,
  "code": "...",
  "message": "..."
}
```

Puede incluir también:

```json
{
  "details": {
    "field": "..."
  }
}
```

### Errores observables relevantes

#### `VALIDATION_ERROR`

* status típico: `400`
* causa: payload inválido, JSON inválido o campos requeridos faltantes/incorrectos

#### `CLIENT_EMAIL_CONFIG_NOT_FOUND`

* causa: no existe configuración SMTP activa para el `cliente_id` y no hay fallback habilitado
* el status exacto devuelto depende de la implementación efectiva desplegada

Ejemplo:

```json
{
  "error": true,
  "code": "CLIENT_EMAIL_CONFIG_NOT_FOUND",
  "message": "Client SMTP config not found"
}
```

#### `MAIL_PROVIDER_ERROR`

* error funcional observable asociado a fallas del proveedor o transporte SMTP
* puede expresarse con status `5xx` según la implementación efectiva desplegada
* causa: fallo del proveedor SMTP, incluyendo autenticación SMTP fallida o error general del provider

Ejemplos de mensajes observables:

* `SMTP authentication failed`
* `SMTP provider error`

#### `SERVICE_UNAVAILABLE`

* error observable asociado a indisponibilidad de servicios subyacentes
* puede expresarse con status `5xx` según la implementación efectiva desplegada
* causa: base de datos no disponible, carga fallida de configuración SMTP, o indisponibilidad del provider SMTP por red

Ejemplos de mensajes observables:

* `Database unavailable`
* `Mailer provider unavailable`

#### `INTERNAL_ERROR`

* status típico: `500`
* causa: configuración interna inválida o falla no tipificada

Ejemplos de mensajes observables:

* `SMTP transporter is not configured`
* `SMTP from is not configured`
* `smtp_host is not configured`
* `SMTP_HOST is not configured`

#### `NOT_FOUND`

* status típico: `404`
* causa: endpoint inexistente fuera de los dos endpoints soportados por el contrato

### Nota sobre equivalencias

La implementación actual no expone literalmente un código `SMTP_TRANSPORT_ERROR`.

El equivalente observable hoy se materializa principalmente como:

* `MAIL_PROVIDER_ERROR`
* `SERVICE_UNAVAILABLE`
* `INTERNAL_ERROR`

según el punto exacto de falla dentro del flujo SMTP.

---

## 14. Notas de seguridad

Consideraciones de seguridad vigentes para este contrato:

1. el standalone no autentica usuarios finales por JWT
2. el standalone debe tratarse como servicio técnico interno
3. el frontend no debe consumir esta frontera directamente
4. `cliente_id` es parte del contrato del standalone y debe ser enviado por el caller interno autorizado
5. las credenciales SMTP no forman parte del request HTTP del contrato
6. la seguridad de red y exposición del servicio depende de infraestructura/despliegue
7. el servicio consulta y utiliza credenciales SMTP por cliente desde almacenamiento persistente

Nota operativa:

* el hecho de que este servicio no autentique JWT no lo vuelve una API pública; sigue siendo una pieza interna de infraestructura de aplicación

---

## 15. Relación con el gateway de `central-hub`

Este contrato es distinto del gateway documentado en `docs/07-CONTRATOS/Contratos-HTTP-Central-Hub-Mailer-Gateway.md`.

Diferencias clave:

1. en este contrato el caller sí envía `cliente_id` en body
2. en el gateway de `central-hub`, `cliente_id` se deriva del JWT autenticado
3. este servicio no autentica usuarios finales por JWT
4. este servicio ejecuta el envío técnico real
5. `central-hub` actúa como gateway autenticado y consumidor principal del standalone

Conclusión:

* el contrato del standalone y el contrato del gateway no deben mezclarse
* el frontend debe consumir el gateway del hub, no este standalone

---

## 16. Estado del contrato

Estado actual:

* **IMPLEMENTED**

Interpretación del estado:

* el servicio real existe en `services/mailer`
* `GET /health` existe en código
* `POST /send` existe en código
* el payload real con `cliente_id` existe en código
* la validación de payload existe en código
* la resolución SMTP por cliente existe en código
* el fallback opcional existe en código
* la auditoría/persistencia en `ll_envios_email` existe en código
* la forma general de errores y respuestas está alineada con la implementación observada al 2026-03-15

Este contrato debe actualizarse si cambia alguno de los siguientes puntos:

* endpoints expuestos
* forma del payload `POST /send`
* reglas de validación
* estrategia de resolución SMTP
* política de fallback
* forma de auditoría/persistencia
* shape de errores o respuesta exitosa

```
```
