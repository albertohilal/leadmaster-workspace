````md
# Mailer MVP — Implementation Plan

**Version:** 1.0  
**Status:** DRAFT  
**Date:** 2026-03-10  
**Owner:** Alberto Hilal  
**Scope:** LeadMaster Workspace / Canal Email / MVP técnico inicial

---

## 1. Objetivo

Definir el plan técnico mínimo para implementar el servicio `mailer` dentro de LeadMaster Workspace, respetando la arquitectura ya aprobada para el canal email.

Este MVP tiene como objetivo permitir que LeadMaster:

1. envíe emails individuales de prospección
2. valide payloads mínimos
3. entregue correos mediante un relay SMTP externo
4. devuelva resultados técnicos consistentes
5. permita que `central-hub` registre el evento de negocio del envío

---

## 2. Alcance del MVP

### Incluido
- nuevo servicio `services/mailer`
- endpoint `GET /health`
- endpoint `POST /send`
- validación técnica mínima del payload
- integración inicial con relay SMTP externo
- respuesta JSON consistente
- integración posterior con `central-hub`
- registro del envío desde `central-hub`
- soporte multi-tenant mediante `cliente_id`

### No incluido
- recepción inbound real
- tracking de aperturas
- tracking de clicks
- campañas masivas complejas
- colas distribuidas
- retry avanzado
- analytics detallado
- scoring
- gestión automática de rebotes
- UI final de operación
- motor de plantillas sofisticado

---

## 3. Principio de implementación

Este MVP **no** implementa un servidor de correo propio completo ni entrega directa desde la IP del VPS.

La estrategia adoptada es:

> **servicio `mailer` propio dentro del workspace + entrega final mediante relay SMTP externo**

Esto permite:

- mantener control arquitectónico del canal
- reducir complejidad operativa
- evitar problemas tempranos de reputación de IP
- acelerar implementación
- preservar posibilidad de evolucionar a otros providers en el futuro

---

## 4. Decisiones técnicas principales

### 4.1 Mailer como servicio separado
Se implementará un nuevo servicio:

`services/mailer`

No debe resolverse como parche dentro de `sender` ni mezclarse con lógica WhatsApp.

### 4.2 Provider inicial
El provider inicial será un **SMTP relay externo configurable por `.env`**.

### 4.3 Orquestación
`central-hub` será el orquestador del flujo de negocio.

### 4.4 Persistencia
La persistencia del envío como evento de negocio será responsabilidad de `central-hub`, no del `mailer`.

### 4.5 Responsabilidad del `mailer`
El `mailer` debe limitarse a validar técnicamente el request, ejecutar la entrega y devolver un resultado técnico consistente.

---

## 5. Arquitectura técnica del MVP

### 5.1 Componentes

#### `central-hub`
Responsable de:
- autenticar
- resolver `cliente_id`
- decidir el envío
- construir payload
- llamar a `mailer`
- registrar el evento de negocio del envío
- asociar el envío al flujo comercial

#### `mailer`
Responsable de:
- exponer API HTTP mínima
- validar payload técnico
- enviar vía SMTP relay
- devolver resultado técnico
- tipificar errores

#### SMTP Relay externo
Responsable de:
- entregar el correo a destino
- manejar la capa de transporte de salida

---

## 6. Estructura sugerida del servicio

```text
services/mailer/
  src/
    app.js
    server.js
    routes/
      healthRoutes.js
      mailerRoutes.js
    controllers/
      mailerController.js
    services/
      mailerService.js
      providers/
        smtpProvider.js
    validators/
      sendValidator.js
    middleware/
      errorHandler.js
    utils/
      logger.js
  package.json
  .env.example
  README.md
````

---

## 7. Endpoints mínimos

### 7.1 `GET /health`

Objetivo:

* verificar disponibilidad básica del servicio

### 7.2 `POST /send`

Objetivo:

* enviar un email individual asociado a un `cliente_id`

Este endpoint debe respetar el contrato ya documentado en:

`docs/07-CONTRATOS/Contratos-HTTP-Mailer.md`

---

## 8. Payload mínimo de `POST /send`

```json
{
  "cliente_id": 51,
  "to": "lead@empresa.com",
  "subject": "Presentación comercial",
  "text": "Hola, te escribimos de parte de Conrad...",
  "html": "<p>Hola, te escribimos de parte de Conrad...</p>"
}
```

### Reglas mínimas

* `cliente_id` obligatorio
* `to` obligatorio
* `subject` obligatorio
* al menos uno entre `text` o `html`

---

## 9. Response esperada de éxito

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

---

## 10. Response esperada de error

```json
{
  "error": true,
  "code": "MAIL_PROVIDER_ERROR",
  "message": "SMTP authentication failed"
}
```

### Códigos mínimos esperados

* `VALIDATION_ERROR`
* `UNAUTHORIZED`
* `FORBIDDEN`
* `MAIL_PROVIDER_ERROR`
* `SERVICE_UNAVAILABLE`
* `INTERNAL_ERROR`

---

## 11. Validación técnica mínima

El `mailer` debe realizar validación mínima y estricta.

### Debe validar

* presencia de `cliente_id`
* presencia de `to`
* formato básico de email en `to`
* presencia de `subject`
* existencia de `text` o `html`

### No debe decidir

* segmentación comercial
* scoring
* derivación
* campañas
* ownership de base

Eso sigue siendo responsabilidad del `central-hub`.

---

## 12. Provider SMTP inicial

### Estrategia

El provider inicial debe encapsularse en:

`src/services/providers/smtpProvider.js`

### Responsabilidades del provider

* construir transporte SMTP
* enviar mensaje
* devolver resultado normalizado
* encapsular errores del proveedor

### Requisitos de configuración por `.env`

Campos sugeridos:

```env
MAILER_PORT=3005
SMTP_HOST=
SMTP_PORT=
SMTP_SECURE=
SMTP_USER=
SMTP_PASS=
SMTP_FROM_EMAIL=
SMTP_FROM_NAME=
```

### Nota

La identidad final por cliente puede venir:

* por payload desde `central-hub`
* o por defaults iniciales en configuración

Para el MVP, se admite esquema simple siempre que no rompa la evolución futura.

---

## 13. Persistencia mínima del flujo

La persistencia del evento de negocio del envío debe quedar en `central-hub`.

### Razón

El `mailer` debe mantenerse como servicio técnico de entrega, no como dueño del proceso comercial.

### Tabla sugerida

`ll_email_envios`

### Campos iniciales sugeridos

* `id`
* `cliente_id`
* `campaign_id` nullable
* `contact_id` nullable
* `from_email`
* `from_name`
* `reply_to`
* `to_email`
* `subject`
* `body_text`
* `body_html`
* `provider`
* `provider_message_id`
* `status`
* `error_message`
* `created_at`
* `sent_at`

### Estados mínimos

* `PENDING`
* `SENT`
* `FAILED`

---

## 14. Flujo técnico esperado

### Paso 1

Un usuario, proceso o endpoint del `central-hub` decide enviar un email.

### Paso 2

`central-hub`:

* autentica
* resuelve `cliente_id`
* arma payload
* decide contenido
* llama a `POST /send` del `mailer`

### Paso 3

`mailer`:

* valida payload técnico
* llama al provider SMTP
* intenta la entrega
* devuelve respuesta normalizada

### Paso 4

`central-hub`:

* registra el evento de negocio del envío en DB
* actualiza estado del envío
* asocia el evento al flujo del lead/contacto

---

## 15. Integración con `central-hub`

La integración con `central-hub` será la segunda etapa del MVP.

### Módulo sugerido en `central-hub`

```text
src/modules/mailer/
  controllers/
  routes/
  services/
  validators/
```

### Responsabilidades del lado hub

* exponer endpoint interno o administrativo si corresponde
* consumir el contrato HTTP del `mailer`
* registrar cada envío
* propagar contexto multi-tenant

---

## 16. Orden de implementación recomendado

### Etapa 1 — Servicio standalone

Implementar `services/mailer` con:

* estructura base
* `/health`
* `/send`
* SMTP relay externo
* validación mínima

### Etapa 2 — Test manual local/servidor

Validar:

* payload correcto
* respuesta correcta
* errores tipificados
* envío real de prueba

### Etapa 3 — Integración con `central-hub`

Agregar:

* service client HTTP
* módulo mailer en hub
* registro de envíos

### Etapa 4 — Persistencia real

Crear tabla `ll_email_envios` y registrar eventos.

### Etapa 5 — Primer caso de negocio

Probar envío real asociado a cliente/campaña/contacto.

---

## 17. Criterios de aceptación del MVP

El MVP se considera completo cuando:

* existe `services/mailer`
* responde `GET /health`
* responde `POST /send`
* valida payload mínimo
* puede enviar un email real por SMTP relay
* devuelve `message_id`, `status` y `provider`
* `central-hub` puede consumirlo
* el envío queda registrado en DB
* todo el flujo conserva `cliente_id`

---

## 18. Riesgos técnicos principales

### Riesgo 1 — Acoplar email con WhatsApp

**Mitigación**

* mantener `mailer` como servicio separado

### Riesgo 2 — Mover persistencia al `mailer`

**Mitigación**

* persistencia del evento de negocio en `central-hub`

### Riesgo 3 — Intentar enviar directo desde el VPS

**Mitigación**

* usar SMTP relay externo en el MVP

### Riesgo 4 — Sobre-ingeniería temprana

**Mitigación**

* limitar alcance a `/health` + `/send` + registro mínimo

### Riesgo 5 — Mezclar reglas comerciales con provider técnico

**Mitigación**

* mantener responsabilidad comercial en hub

---

## 19. Decisiones abiertas para fase siguiente

Estas decisiones pueden postergarse después del MVP:

* provider definitivo
* tabla de identidades por cliente
* soporte inbound real
* tracking de aperturas
* retries
* colas
* plantillas versionadas
* dashboard específico de email

---

## 20. Documentos relacionados

* `docs/01-CONSTITUCIONAL/ADR-001-CANAL-EMAIL-PROSPECCION-OPERADO-POR-LEADMASTER.md`
* `docs/06-FASES/PHASE-4B-EMAIL-PROSPECTING-PLAN.md`
* `docs/04-INTEGRACION/ARQUITECTURA-CANAL-EMAIL.md`
* `docs/05-REPORTES/OPS/REQUISITOS-MINIMOS-CANAL-EMAIL.md`
* `docs/07-CONTRATOS/Contratos-HTTP-Mailer.md`

---

## 21. Estado

**Status:** DRAFT

Este documento es un plan técnico de implementación.
No reemplaza el contrato HTTP ni los documentos constitucionales ya aprobados.

```
```
