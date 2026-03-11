# Mailer (MVP)

Servicio técnico standalone para entrega de email dentro de LeadMaster Workspace.

## Requisitos

- Node.js (CommonJS)
- SMTP relay externo (configurado por variables de entorno)

## Configuración

Crear un `.env` a partir de `.env.example`.

Variables:

- `MAILER_PORT`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`
- `SMTP_USER`, `SMTP_PASS`
- `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME`
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`

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
- entrega correo vía SMTP relay
- audita envíos en MySQL (`ll_envios_email`)
- devuelve resultado técnico

No incluye:

- lógica comercial
- campañas
- - integración con `central-hub`
