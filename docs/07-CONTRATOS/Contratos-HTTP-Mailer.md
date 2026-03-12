# Contratos HTTP — Mailer — LeadMaster Workspace

**Version:** 1.1  
**Status:** APPROVED  
**Date:** 2026-03-11  
**Owner:** Alberto Hilal  
**Approved by:** Alberto Hilal  
**Approved on:** 2026-03-11  
**Scope:** Contrato HTTP/JSON para consumo interno del servicio `mailer`

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
El código debe alinearse con este contrato.  
Toda desviación relevante debe corregirse o documentarse formalmente.

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

**Nota:** este documento describe únicamente endpoints implementados (`/health`, `/send`).

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
La autenticación entre servicios queda fuera del alcance detallado de este documento. El contrato asume consumo interno (no público).

### 4.6 Multi-tenant (resolución SMTP)

Regla implementada de resolución SMTP por `cliente_id`:

1. Buscar config SMTP activa del cliente en MySQL (`ll_clientes_email_config`, `is_active=1`).
2. Si existe, usar esa config.
3. Si no existe:
   - con `SMTP_FALLBACK_ENABLED=false` (default): responder `CLIENT_EMAIL_CONFIG_NOT_FOUND` (404) y auditar como `FAILED`.
   - con `SMTP_FALLBACK_ENABLED=true`: intentar enviar usando SMTP global por variables de entorno.

MySQL es dependencia obligatoria: el servicio audita en `ll_envios_email` y consulta configuración aun con fallback.

### 4.7 Base URL

- Base URL interna esperada (servidor): `http://localhost:3005`
- Los ejemplos del contrato asumen consumo directo interno (sin proxy).

---

## 5. Endpoint: `GET /health`

### Objetivo
Permitir verificación de disponibilidad básica del servicio.

### Request

```http
GET /health