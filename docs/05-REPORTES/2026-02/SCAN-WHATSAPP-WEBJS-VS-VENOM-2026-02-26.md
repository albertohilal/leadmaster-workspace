# SCAN-WHATSAPP-WEBJS-VS-VENOM-2026-02-26

**Destino (obligatorio):** docs/05-REPORTES/2026-02/SCAN-WHATSAPP-WEBJS-VS-VENOM-2026-02-26.md

**Fecha:** 2026-02-26

## 1) Objetivo

Confirmar si `whatsapp-web.js` está implementado en el sistema (dependencias + referencias en código), si existe uso de `LocalAuth`, si aparece algún paquete `wwebjs`, y si `venom-bot` es la única librería de automatización WhatsApp instalada.

## 2) Alcance del escaneo

- Dependencias declaradas y lockfiles:
  - `services/central-hub/package.json` + `services/central-hub/package-lock.json`
  - `services/session-manager/package.json` + `services/session-manager/package-lock.json`
- Búsqueda de referencias en el código por patrones típicos:
  - `require('whatsapp-web.js')`
  - `import ... from 'whatsapp-web.js'`
  - `new Client(`
  - `LocalAuth(`
  - Carpetas/paths de sesión `.wwebjs_auth`, `.wwebjs_cache`

## 3) Hallazgos: librerías instaladas relacionadas a WhatsApp

### 3.1 Central Hub

- Dependencia declarada:
  - `whatsapp-web.js: ^1.26.0` en `services/central-hub/package.json`.
- Versión efectiva (lock):
  - `whatsapp-web.js@1.34.6` en `services/central-hub/package-lock.json`.

### 3.2 Session Manager (microservicio standalone)

- Dependencia declarada:
  - `venom-bot: ^5.3.0` en `services/session-manager/package.json`.
- Versión efectiva (lock):
  - `venom-bot@5.3.0` en `services/session-manager/package-lock.json`.
- `whatsapp-web.js`:
  - NO aparece como dependencia de este microservicio en su `package.json`/`package-lock.json`.

### 3.3 Paquete "wwebjs"

- No se encontró como dependencia npm en los `package.json` inspeccionados.
- Nota: la presencia de rutas/carpetas `.wwebjs_auth` / `.wwebjs_cache` corresponde a convenciones de `whatsapp-web.js` (no a un paquete npm llamado "wwebjs").

## 4) Hallazgos: referencias a whatsapp-web.js en código

### 4.1 Central Hub: implementación ACTIVA

Archivo principal:
- `services/central-hub/src/modules/session-manager/services/sessionService.js`
  - Importa `Client` y `LocalAuth`:
    - `const { Client, LocalAuth } = require('whatsapp-web.js');`
  - Instancia `new Client({ authStrategy: new LocalAuth(...) })`
  - Maneja evento de QR (`client.on('qr', ...)`) y genera base64.
  - Usa persistencia basada en carpetas `tokens/.wwebjs_auth` y cache `tokens/.wwebjs_cache`.

Rutas/controladores que lo consumen:
- `services/central-hub/src/modules/session-manager/controllers/sessionController.js`
  - Usa `sessionService.getOrCreateClient()`, `sessionService.getQR()`, etc.
- `services/central-hub/src/modules/session-manager/controllers/adminController.js`
  - Admin endpoints para iniciar/cerrar sesiones.

Montaje en runtime:
- `services/central-hub/src/index.js`
  - Monta el módulo: `app.use('/api/session-manager', require('./modules/session-manager/routes'))`

Conclusión local:
- En Central Hub, `whatsapp-web.js` + `LocalAuth` está implementado y activo.

### 4.2 Session Manager (microservicio): referencias LEGACY / no activas

Se detectaron archivos que importan `whatsapp-web.js` (ESM), por ejemplo:
- `services/session-manager/whatsapp/client.js`
- `services/session-manager/whatsapp/clientFactory.js`

Y rutas ESM relacionadas:
- `services/session-manager/routes/init.js`
- `services/session-manager/routes/send.js`
- `services/session-manager/routes/status.js`
- `services/session-manager/routes/qr.js`
- `services/session-manager/routes/qrCode.js`

Sin embargo, el servidor actual del microservicio Session Manager:
- Arranca desde `services/session-manager/index.js`.
- Monta únicamente `services/session-manager/routes/api.js` vía `services/session-manager/app.js`.
- Usa `services/session-manager/whatsapp/venom-session.js` (Venom) como implementación activa.

Conclusión local:
- En el microservicio `services/session-manager` actualmente activo, `whatsapp-web.js` NO está implementado en runtime (solo quedan archivos legacy que no se montan en el servidor actual y además no existe la dependencia instalada en ese servicio).

## 5) Estado de LocalAuth

- `LocalAuth` se usa de forma activa en Central Hub en:
  - `services/central-hub/src/modules/session-manager/services/sessionService.js`

## 6) Conclusión final

1. **¿whatsapp-web.js está implementado en el sistema?**
   - **Sí.** Está instalado y se usa activamente en Central Hub (`services/central-hub`).

2. **¿whatsapp-web.js está implementado en el microservicio Session Manager (standalone) actualmente operativo?**
   - **No.** Ese microservicio usa `venom-bot` como implementación activa. Existen restos legacy con imports a `whatsapp-web.js`, pero no están montados en el servidor actual y el paquete no figura como dependencia del servicio.

3. **¿venom-bot es la única librería instalada para WhatsApp?**
   - **No.** Coexisten `whatsapp-web.js` (Central Hub) y `venom-bot` (Session Manager microservicio).
