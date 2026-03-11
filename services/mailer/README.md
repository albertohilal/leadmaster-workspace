# Mailer (MVP)

Servicio técnico standalone para entrega de email dentro de LeadMaster Workspace.

## Requisitos

- Node.js (CommonJS)
- MySQL (para resolver SMTP por cliente)
- SMTP relay externo (resuelto por cliente desde DB; fallback opcional por variables de entorno)

## Configuración

Crear un `.env` a partir de `.env.example`.

Variables:

- `MAILER_PORT`
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`

Multi-tenant (principal):

- El servicio resuelve credenciales SMTP por `cliente_id` desde MySQL, tabla `ll_clientes_email_config` (`is_active=1`).

Fallback opcional (NO recomendado como camino principal):

- `SMTP_FALLBACK_ENABLED=true` habilita el envío usando SMTP global por `.env` cuando no exista config activa en DB.
- Si `SMTP_FALLBACK_ENABLED=false` y no hay config activa, el envío falla con error controlado.

Variables SMTP globales (solo si se habilita fallback):

- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`
- `SMTP_USER`, `SMTP_PASS`
- `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME`
- `SMTP_FALLBACK_ENABLED`
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`

## SMTP resolution order

Regla conceptual (para evitar ambigüedades):

1. Buscar configuración SMTP activa del cliente en MySQL (`ll_clientes_email_config`) por `cliente_id` (`is_active=1`).
2. Si existe config activa, **usar esa configuración** (este es el camino normal de operación).
3. Si no existe config activa:
  - si `SMTP_FALLBACK_ENABLED=false` (valor por defecto), **cortar el flujo**, auditar `FAILED` y responder `CLIENT_EMAIL_CONFIG_NOT_FOUND`.
  - si `SMTP_FALLBACK_ENABLED=true`, usar SMTP global del `.env` como **fallback técnico**.

## Ejecutar

- Instalación: `npm install`
- Desarrollo: `npm run dev`
- Producción: `npm start`

### PM2

- `pm2 start src/server.js --name leadmaster-mailer`
- `pm2 save`

Por defecto escucha en `http://localhost:3005`.

## Endpoints

### `GET /health`

Devuelve estado básico del servicio.

### `POST /send`

Contrato: ver `docs/07-CONTRATOS/Contratos-HTTP-Mailer.md`.

Payload mínimo:

```json
{
  "cliente_id": 51,
  "to": "lead@empresa.com",
  "subject": "Presentación comercial",
  "text": "Hola...",
  "html": "<p>Hola...</p>"
}
```

Errores tipificados (ejemplos):

- `VALIDATION_ERROR` (400)
- `MAIL_PROVIDER_ERROR` (502)
- `SERVICE_UNAVAILABLE` (503)
- `INTERNAL_ERROR` (500)

## Alcance del MVP

Este servicio:

- valida payload técnico
- entrega correo vía SMTP relay (multi-tenant por cliente)
- audita envíos en MySQL (`ll_envios_email`)
- devuelve resultado técnico

No incluye:

- lógica comercial
- campañas
- - integración con `central-hub`
