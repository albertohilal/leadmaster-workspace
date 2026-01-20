
---

## 4) `04-sender-flow.md`

```md
# Flujo de Envío (Sender Flow)

## Objetivo
Garantizar que no se envíen mensajes si WhatsApp no está listo.

## Flujo general

1. El cliente se autentica (JWT).
2. El admin selecciona el contexto `clienteId` al enviar.
3. Central Hub consulta Session Manager con:

GET /status
Header: X-Cliente-Id: <clienteId>


4. Si el estado es `READY` y `connected=true`, envía mensaje.
5. Si no, se aborta con error descriptivo.

## Contrato de envío

Endpoint de prueba:


POST /api/sender/test-send
Authorization: Bearer <JWT_ADMIN>


Body:

```json
{
  "clienteId": 51,
  "to": "54911XXXXXXXX",
  "message": "Texto"
}