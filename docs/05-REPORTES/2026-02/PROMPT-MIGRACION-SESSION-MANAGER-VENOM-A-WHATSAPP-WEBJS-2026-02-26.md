# PROMPT-MIGRACION-SESSION-MANAGER-VENOM-A-WHATSAPP-WEBJS-2026-02-26

**Destino (obligatorio):** docs/05-REPORTES/2026-02/PROMPT-MIGRACION-SESSION-MANAGER-VENOM-A-WHATSAPP-WEBJS-2026-02-26.md

**Fecha:** 2026-02-26

## 1) Propósito

Documento utilitario para pegar en Copilot tal cual, orientado a migrar el microservicio standalone `services/session-manager` desde `venom-bot` hacia `whatsapp-web.js`, manteniendo contrato HTTP y operación 100% headless en VPS Linux.

## 2) Prompt (copiar/pegar tal cual)

> Implement a full migration of the standalone microservice `services/session-manager` from `venom-bot` to `whatsapp-web.js`, keeping the existing HTTP contract and ensuring the service works 100% headless on a Linux VPS (no GUI, no Xvfb, no DISPLAY).
>
> ## Constraints
>
> * Single ADMIN session only (no multi-tenant).
> * Must work with PM2 (fork mode, 1 instance).
> * Must persist auth using `LocalAuth` inside `services/session-manager/tokens/`.
> * Must NOT depend on Venom anymore.
> * Must NOT crash the process on QR/login errors (no unhandled promise rejections).
>
> ## Required endpoints (keep exact behavior)
>
> * `GET /health` -> ok payload (already exists)
> * `GET /status` -> `{ status: <state> }` where state is one of:
>   `INIT`, `QR_REQUIRED`, `AUTHENTICATED`, `READY`, `DISCONNECTED`, `ERROR`
> * `GET /qr`:
>
>   * If no QR available -> `{ status: 'NO_QR' }`
>   * If QR available -> `{ status: 'QR_AVAILABLE', qr: <data> }`
>     where `<data>` is either:
>
>     * base64 PNG string (preferred), or
>     * raw QR string (acceptable) plus a second field indicating type.
>
> ## Implementation details
>
> 1. Add dependency:
>
>    * Install `whatsapp-web.js` in `services/session-manager/package.json`
>    * Ensure compatible Node 20 + Chrome installed.
> 2. Create/replace session implementation file:
>
>    * Replace `services/session-manager/whatsapp/venom-session.js` with a new module, e.g. `whatsapp/session.js`
>    * Use `const { Client, LocalAuth } = require('whatsapp-web.js');`
>    * Configure puppeteer/chrome args for VPS:
>      `--no-sandbox`, `--disable-setuid-sandbox`, `--disable-dev-shm-usage`
>    * Use LocalAuth with a fixed path under `services/session-manager/tokens/`.
> 3. State machine:
>
>    * Track `sessionStatus`, `currentQR`, `qrTimestamp`, `qrAttempts`.
>    * On `client.on('qr', qrString)` set status `QR_REQUIRED` and store `currentQR` (converted to base64 PNG if possible).
>    * On `authenticated` set status `AUTHENTICATED` and clear QR.
>    * On `ready` set status `READY` and clear QR.
>    * On `disconnected` set status `DISCONNECTED` and clear QR and client reference.
>    * On `auth_failure` set status `ERROR` and clear QR.
> 4. Concurrency:
>
>    * Prevent duplicate connects with an in-flight `connectPromise`.
> 5. API wiring:
>
>    * Update `services/session-manager/routes/api.js` to use the new session module:
>
>      * `getSessionStatus()`, `getCurrentQR()`, `connect()`, `disconnect()`, `isConnected()`, and `sendMessage()`.
> 6. Sending:
>
>    * Implement `sendMessage(clienteId, to, message)` using `client.sendMessage(chatId, message)` where `chatId = <digits>@c.us`.
>    * Remove UI-simulation navigation. Use native send API of whatsapp-web.js.
> 7. Cleanup:
>
>    * Remove or isolate legacy files under `services/session-manager/whatsapp/` that import whatsapp-web.js but are not mounted.
>    * Ensure only one canonical implementation exists in this microservice.
>
> ## Deliverables
>
> * Provide the complete final code for:
>
>   * the session module file
>   * `routes/api.js` adjustments if needed
>   * any required changes in `app.js` / `index.js`
>   * `package.json` diff
> * Provide a minimal test plan using curl:
>
>   * connect -> status transitions -> qr visible -> ready -> send message
>
> Do not change the external contract of the microservice besides adding QR type info if needed.

