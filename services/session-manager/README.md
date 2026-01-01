# Session Manager

## Purpose

The **session-manager** service is responsible for managing a **single WhatsApp Web session** for a specific client in the LeadMaster multi-tenant system.

This service:
- Maintains one WhatsApp connection per `cliente_id`
- Exposes HTTP endpoints for sending messages and checking status
- Uses `whatsapp-web.js` with LocalAuth for persistent sessions
- **Does NOT** handle incoming message logic (that's the `listener` service)
- **Does NOT** handle campaigns or mass sending (that's the `massive-sender` service)
- **Does NOT** access the database directly

## Architecture Position

```
┌─────────────────────┐
│ leadmaster-central  │
│       hub           │ ← API / Orchestration
└──────────┬──────────┘
           │
           │ HTTP
           ↓
┌─────────────────────┐
│  session-manager    │ ← YOU ARE HERE
│   (one per client)  │
└──────────┬──────────┘
           │
           │ whatsapp-web.js
           ↓
       WhatsApp Web
```

## Critical Operating Rules

⚠️ **WARNING**: This service manages WhatsApp sessions. Incorrect restarts can:
- Force re-authentication (QR code scan)
- Break active conversations
- Trigger WhatsApp rate limits or blocks

### When NOT to restart:
- ❌ During normal deploys of other services
- ❌ For code changes in `listener` or `massive-sender`
- ❌ For database migrations
- ❌ For API updates in `central-hub`

### When it's OK to restart:
- ✅ Updating `whatsapp-web.js` library version
- ✅ Session is stuck in `DISCONNECTED` state
- ✅ Scheduled maintenance window
- ✅ Initial setup or testing

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CLIENTE_ID` | **YES** | - | The client ID this instance manages (e.g., `51`) |
| `PORT` | No | `3001` | HTTP port for the service |

**Example:**
```bash
CLIENTE_ID=51 PORT=3001 npm start
```

## Installation

```bash
cd /root/leadmaster-workspace/services/session-manager
npm install
```

## Running Locally

### First time setup:
```bash
# Set cliente_id and start
CLIENTE_ID=51 npm start
```

The service will:
1. Initialize the WhatsApp client
2. Display a QR code in the terminal
3. Wait for you to scan it with WhatsApp mobile app
4. Once authenticated, it will show `[WhatsApp] Client is ready`

### Subsequent runs:
Once authenticated, the session is saved in `./sessions/cliente_51/`.

Starting the service again will restore the session automatically (no QR code needed).

## API Endpoints

All endpoints are defined in `/docs/Contratos-HTTP-LeadMaster-Workspace.md`.

### GET /health
Check if the service is running and the WhatsApp state.

**Response:**
```json
{
  "status": "healthy",
  "service": "session-manager",
  "cliente_id": 51,
  "whatsapp_state": "READY",
  "timestamp": "2026-01-01T12:00:00.000Z"
}
```

### GET /status
Get the current WhatsApp session status.

**Response:**
```json
{
  "cliente_id": 51,
  "connected": true,
  "state": "READY"
}
```

**States:**
- `INIT` - Initializing
- `QR_REQUIRED` - Waiting for QR scan
- `READY` - Connected and ready
- `DISCONNECTED` - Not connected

### GET /qr-code
Get the QR code for authentication (only available when `state = QR_REQUIRED`).

**Response:**
```json
{
  "qr_code": "1@abc123..."
}
```

### POST /send
Send a WhatsApp message.

**Request:**
```json
{
  "cliente_id": 51,
  "to": "5491123456789",
  "message": "Hello from LeadMaster"
}
```

**Response:**
```json
{
  "ok": true,
  "message_id": "wamid.HBgLM..."
}
```

**Errors:**
- `400` - Missing or invalid fields
- `409` - Session not ready (state != READY)
- `500` - WhatsApp send error

### POST /disconnect
Disconnect the WhatsApp session.

**Response:**
```json
{
  "ok": true,
  "message": "WhatsApp session disconnected successfully"
}
```

### GET /account-info
Get information about the connected WhatsApp account.

**Response:**
```json
{
  "phone": "5491123456789",
  "platform": "android",
  "pushname": "John Doe"
}
```

## Session Storage

WhatsApp authentication data is stored in:
```
./sessions/cliente_<CLIENTE_ID>/
```

This directory contains:
- LocalAuth session files
- Browser profile data
- Encryption keys

**Do NOT delete this folder** unless you want to force re-authentication.

## Testing

```bash
# Start the service
CLIENTE_ID=51 npm start

# In another terminal, test health check
curl http://localhost:3001/health

# Check status
curl http://localhost:3001/status

# Send a test message (once READY)
curl -X POST http://localhost:3001/send \
  -H "Content-Type: application/json" \
  -d '{
    "cliente_id": 51,
    "to": "5491123456789",
    "message": "Test message"
  }'
```

## Production Deployment

This service will run under PM2 with a dedicated process per client:

```bash
pm2 start index.js \
  --name "session-manager-51" \
  --env CLIENTE_ID=51 \
  --env PORT=3001
```

**PM2 Restart Policy:**
- Set `autorestart: false` or manual restart only
- Use `pm2 restart session-manager-51` **only when necessary**
- Never use `pm2 restart all` in production

## Troubleshooting

### "QR code not showing"
- Check the terminal output for QR ASCII art
- Access `GET /qr-code` to get the raw QR string
- State should be `QR_REQUIRED`

### "Session not ready"
- Check `GET /status` to see current state
- If `DISCONNECTED`, restart the service
- If `INIT`, wait a few seconds

### "Authentication failure"
- Session might be invalidated by WhatsApp
- Delete `./sessions/cliente_<ID>/` and re-authenticate
- Check for WhatsApp Web updates

### "Send message fails"
- Verify phone number format: `5491123456789` (country + area + number, no spaces/symbols)
- Check `GET /status` shows `state: "READY"`
- Review logs for specific WhatsApp errors

## Development

### Code Structure
```
session-manager/
├── index.js              # Entry point, env validation, server start
├── app.js                # Express setup, middleware, routing
├── whatsapp/
│   └── client.js         # WhatsApp client wrapper
└── routes/
    ├── status.js         # GET /status
    ├── qr.js             # GET /qr-code
    ├── send.js           # POST /send
    ├── disconnect.js     # POST /disconnect
    ├── account.js        # GET /account-info
    └── health.js         # GET /health
```

### Adding New Features
1. Check if it belongs here or in another service
2. Update HTTP contracts document first
3. Implement route handler
4. Test without affecting production sessions
5. Update this README

## Related Documentation

- `/docs/Guía De Arquitectura Y Migración – Lead Master Workspace` - Overall architecture
- `/docs/Contratos-HTTP-LeadMaster-Workspace.md` - HTTP contracts between services

## License

Internal use only - LeadMaster workspace.
