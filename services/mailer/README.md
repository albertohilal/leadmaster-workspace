# leadmaster-mailer (MVP)

Servicio técnico standalone para entrega de email dentro de LeadMaster Workspace.

## Propósito

`leadmaster-mailer` expone una API HTTP mínima para enviar emails individuales vía SMTP.  
El objetivo es desacoplar la entrega técnica (SMTP + auditoría) de la lógica de negocio (orquestada por otros servicios como `central-hub`).

## Estado actual (observado)

- Operativo en servidor y saludable: `GET /health` responde correctamente en `http://localhost:3005/health`.
- Envío validado: `POST /send` probado con envío real con `status: "SENT"` y recepción efectiva en Gmail.
- Remitente validado en la prueba realizada:
  - `SMTP_FROM_EMAIL=info@desarrolloydisenio.com.ar`
  - `SMTP_FROM_NAME=Desarrollo y Diseño`
- Multi-tenant activo por `cliente_id` (configuración SMTP por cliente).

## Rol arquitectónico

- Responsabilidad del mailer: entrega SMTP + auditoría técnica (`ll_envios_email`).
- Responsabilidad del hub (u otro orquestador): reglas de negocio, campañas, segmentación y flujo comercial.

## Resolución SMTP y multi-tenant

El mailer resuelve el SMTP en este orden:

1. Buscar configuración SMTP activa del cliente por `cliente_id` en MySQL, tabla `ll_clientes_email_config` (`is_active=1`).
2. Si existe, usar esa configuración (camino normal de operación).
3. Si no existe:
   - si `SMTP_FALLBACK_ENABLED` está deshabilitado (default), el envío falla con error controlado `CLIENT_EMAIL_CONFIG_NOT_FOUND` (HTTP 404) y se audita como `FAILED`.
   - si `SMTP_FALLBACK_ENABLED=true`, intenta construir transporte SMTP global desde variables de entorno.

Notas:

- MySQL es una dependencia obligatoria: el servicio audita en `ll_envios_email` y consulta la configuración por cliente aun cuando se use fallback.
- Aislamiento: `cliente_id` determina la configuración SMTP utilizada y se persiste en la auditoría; no hay mezcla entre clientes.

## Requisitos

- Node.js
- MySQL (lookup de SMTP por cliente + auditoría)
- SMTP relay externo (por cliente desde DB; fallback opcional por variables de entorno)

## Variables de entorno

Crear un `.env` a partir de `.env.example`.

### Servicio

- `MAILER_PORT` (default 3005)

### Base de datos (obligatorio)

- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`

### SMTP fallback global (opcional)

- `SMTP_FALLBACK_ENABLED` (`true|false`; default: deshabilitado)
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE` (`true|false`)
- `SMTP_USER` (opcional)
- `SMTP_PASS` (opcional)
- `SMTP_FROM_EMAIL`
- `SMTP_FROM_NAME` (opcional)

## Ejecución local

- Instalación: `npm install`
- Desarrollo: `npm run dev`
- Producción: `npm start`

Por defecto escucha en `http://localhost:3005`.

## Ejecución con PM2

Ejemplo mínimo:

```bash
pm2 start src/server.js --name leadmaster-mailer
pm2 save