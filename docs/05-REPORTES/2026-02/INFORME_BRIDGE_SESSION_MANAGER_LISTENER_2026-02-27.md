# Informe — Bridge Session Manager → Listener (persistencia conversaciones) — 2026-02-27

## Objetivo
Restablecer la **persistencia en MySQL** de conversaciones WhatsApp “del día” sin modificar el contrato del frontend, conectando los eventos reales de WhatsApp (via `whatsapp-web.js` en `session-manager`) con el Listener del Central Hub (`POST /api/listener/test-message`).

Requisitos clave:
- Capturar **inbound** (prospecto → WhatsApp) como `esHumano:false`.
- Capturar **outbound** (operador desde WhatsApp Web/UI) como `esHumano:true` (pausa IA).
- Autenticación requerida: JWT Bearer (`POST /api/auth/login` → token).
- Robustez: si Central Hub no está disponible o faltan credenciales, el `session-manager` **no debe caerse** (solo loguear y continuar).

## Diagnóstico (causa raíz)
- El Central Hub **solo persiste** conversaciones cuando se ejecuta el flujo del Listener (`listenerService.onMessageReceived`).
- Las conversaciones “reales” no se estaban guardando porque faltaba el cableado desde los eventos de WhatsApp hacia el endpoint del Listener.

## Cambios aplicados

### 1) Session Manager — Bridge hacia Central Hub
Archivo: [services/session-manager/whatsapp/wwebjs-session.js](services/session-manager/whatsapp/wwebjs-session.js)

Se agregó un bloque **CENTRAL HUB BRIDGE** y handlers de eventos:
- Configuración vía env:
  - `CENTRAL_HUB_BASE_URL`
  - `CENTRAL_HUB_USER`
  - `CENTRAL_HUB_PASS`
  - `CENTRAL_HUB_CLIENTE_ID` (fallback a `CLIENTE_ID`)
- Helpers principales:
  - Normalización de teléfono (remueve sufijos tipo `@c.us`, ignora grupos `@g.us`, deja solo dígitos).
  - `centralHubLogin()` con caché en memoria del token.
  - `postToCentralHubListener()` que:
    - Hace `POST /api/listener/test-message`.
    - Reintenta 1 vez ante `401` (renueva token).
    - Usa timeout y manejo de errores para no propagar excepciones.
- Handlers:
  - `waClient.on('message', ...)`: inbound (solo si `!msg.fromMe`) → `esHumano:false`.
  - `waClient.on('message_create', ...)`: outbound (solo si `msg.fromMe`) → `esHumano:true`.

Efecto:
- Al llegar mensajes reales, se dispara:
  - `[WWEBJS->HUB] inbound saved telefono=...`
  - `[WWEBJS->HUB] outbound saved (human) telefono=...`

Nota de seguridad:
- El `.env` local se usa para runtime; **no se debe commitear** con secretos.


### 2) Central Hub — Persistencia correcta de `cliente_id`
Archivo: [services/central-hub/src/modules/listener/services/listenerService.js](services/central-hub/src/modules/listener/services/listenerService.js)

Problema encontrado en runtime:
- `ll_ia_conversaciones` requiere `cliente_id` (NOT NULL). El Listener insertaba sin esa columna.
- En MySQL no-strict, esto terminaba guardando `cliente_id=0`, aunque el payload traía `cliente_id=51`.

Solución mínima:
- Se modificó `registrarMensajeConversacion(...)` para insertar explícitamente `cliente_id`.
- Se actualizó `onMessageReceived(...)` para pasar `clienteId` en:
  - Mensaje humano (`esHumano:true`)
  - Mensaje entrante user (`esHumano:false`)
  - Respuesta IA (rama `respond`)

Resultado:
- Las filas nuevas en `ll_ia_conversaciones` quedan con `cliente_id` correcto (ej. `51`).

## Validaciones realizadas

### A) Autenticación + Listener (sin exponer token)
- `POST http://localhost:3012/api/auth/login` devuelve `HTTP 200` y `token`.
- `POST http://localhost:3012/api/listener/test-message` devuelve `HTTP 200`.

### B) Persistencia en MySQL
- Se verificó estructura con `DESCRIBE ll_ia_conversaciones`.
- Se verificó inserción posterior al fix:
  - Nuevas filas muestran `cliente_id=51`.

### C) Runtime
- `session-manager` reinició y volvió a estado `READY`.

## Impacto y riesgos
- `session-manager` agrega tráfico HTTP hacia Central Hub por cada mensaje inbound/outbound.
- Si Central Hub está caído o credenciales faltan/son inválidas:
  - el bridge loguea error y **no interrumpe** el servicio.
- Cambios en Central Hub son acotados al Listener y consistentes con el contrato actual del endpoint.

## Rollback
- Session Manager: revertir el bloque CENTRAL HUB BRIDGE + handlers en [services/session-manager/whatsapp/wwebjs-session.js](services/session-manager/whatsapp/wwebjs-session.js).
- Central Hub: revertir cambios en [services/central-hub/src/modules/listener/services/listenerService.js](services/central-hub/src/modules/listener/services/listenerService.js).
- Reiniciar PM2:
  - `pm2 restart session-manager`
  - `pm2 restart leadmaster-central-hub`

## Próximos pasos (operativos)
1) Validar con mensajes reales:
   - Inbound: enviar mensaje al WhatsApp conectado.
   - Outbound: responder desde WhatsApp Web/UI.
   - Confirmar logs `[WWEBJS->HUB] ... saved`.
2) Confirmar en DB:
   - Buscar en `ll_ia_conversaciones` por `telefono` y verificar `cliente_id=51`.
3) (Recomendación) Evitar secrets en `.env` versionado:
   - Mantener `.env` fuera de git o usar variables de entorno inyectadas por el entorno/PM2.
