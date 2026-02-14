
---

## 3) `03-session-manager-integration.md`

```md
# Integración con Session Manager

## Contexto
Session Manager es un servicio separado que expone una API HTTP para controlar sesiones WhatsApp.

## Endpoints relevantes

### GET /health
Verifica que el servicio está vivo.

### GET /status
Consulta estado de WhatsApp.
Requiere header:

X-Cliente-Id: <number>


### POST /connect
Inicia la sesión WhatsApp para ese `clienteId`.

### GET /qr-code
Devuelve el QR cuando la sesión está en estado QR_REQUIRED.

## Estados posibles de sesión

| Estado | Significado |
|--------|------------|
| INIT | No iniciado |
| QR_REQUIRED | Requiere escaneo de QR |
| READY | Sesión operativa |
| DISCONNECTED | Sesión caída |
| ERROR | Error interno |

## Uso desde Central Hub

Se expone un cliente HTTP (`sessionManagerClient.js`) que permite:

- `getSessionStatus(clienteId)`
- `isWhatsAppReady(clienteId)`

Ejemplo de invocación:

```js
const { isWhatsAppReady } = require('../services/sessionManagerClient');

const { ready } = await isWhatsAppReady(clienteId);
if (!ready) {
  throw new Error('WhatsApp no está listo.');
}

