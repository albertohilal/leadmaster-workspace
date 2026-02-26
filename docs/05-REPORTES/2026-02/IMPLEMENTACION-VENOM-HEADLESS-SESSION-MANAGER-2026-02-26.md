# IMPLEMENTACION-VENOM-HEADLESS-SESSION-MANAGER-2026-02-26

**Destino (obligatorio):** docs/05-REPORTES/2026-02/IMPLEMENTACION-VENOM-HEADLESS-SESSION-MANAGER-2026-02-26.md

**Fecha:** 2026-02-26

## 1) Contexto y objetivo

Se implementó y endureció (hardening operativo) un flujo de sesión de WhatsApp vía `venom-bot` para el servicio Session Manager, orientado a VPS Linux **100% headless** (sin GUI, sin DISPLAY, sin Xvfb). El objetivo funcional fue:

- Mantener **una única sesión ADMIN**.
- Persistir tokens para no re-autenticar en cada reinicio.
- Exponer estado y QR mediante HTTP:
  - `GET /status` → `{ status: <estado> }`
  - `GET /qr` → `{ status: 'NO_QR' }` o `{ status: 'QR_AVAILABLE', qr: <base64> }`

## 2) Alcance y restricciones

### Alcance
- Ajustes de sesión Venom/Puppeteer para ejecución headless.
- Persistencia de tokens en ruta fija dentro del servicio.
- Contratos HTTP mínimos para status/QR.
- Robustez ante reinicios y fallas comunes (PM2 + Chrome headless).

### Restricciones explícitas
- Prohibido modo no-headless.
- Prohibido depender de Xvfb/GUI.
- Tokenización persistente dentro de la carpeta del servicio.

## 3) Inventario técnico relevante

- Runtime: Node.js (reportado en ejecución como v20.19.6).
- Librería WA: `venom-bot` (instalado v5.3.0).
- Navegador: Google Chrome estable del sistema (`/usr/bin/google-chrome-stable`; en logs se observó versión ~142.x).
- Process manager: PM2.
- OS: Linux.

## 4) Cambios realizados (por archivo)

### 4.1 Sesión Venom headless + estado + QR

Archivo: [services/session-manager/whatsapp/venom-session.js](../../../services/session-manager/whatsapp/venom-session.js)

**Cambios principales:**
- Se reemplazó el enfoque previo (dependiente de GUI/Xvfb) por una inicialización Venom **headless estricta**.
- Se incorporaron variables de estado y QR en memoria:
  - `sessionStatus` con estados: `INIT`, `QR_REQUIRED`, `AUTHENTICATED`, `READY`, `DISCONNECTED`, `ERROR`.
  - `currentQR` (base64 en memoria).
  - `qrAttempts`.
- Se configuró persistencia de tokens usando opciones soportadas por Venom:
  - `mkdirFolderToken` + `folderNameToken` para asegurar tokens en `services/session-manager/tokens/admin`.
- Se implementó limpieza best-effort de locks de perfil de Chrome para mitigar fallas de arranque:
  - Eliminación previa de `SingletonLock`, `SingletonSocket`, `SingletonCookie` dentro del perfil.
- Se reforzó comportamiento ante errores:
  - Errores “Not Logged” se traducen a estado `QR_REQUIRED`.
  - Se evitó re-lanzar (`throw`) desde el `.catch()` para impedir reinicios por unhandled rejection.
- Se mejoró la posibilidad de reintento:
  - Si hubo intento anterior y terminó en `DISCONNECTED`/`ERROR`, se resetea el “in-flight promise” para permitir reconectar.

**Notas de implementación:**
- Se fuerza `headless: true` tanto en opciones de Venom como en `puppeteerOptions`.
- Se fuerza `executablePath` al binario del sistema.
- Se usan argumentos mínimos para VPS:
  - `--no-sandbox`, `--disable-setuid-sandbox`.

### 4.2 Contratos HTTP: status + qr

Archivo: [services/session-manager/routes/api.js](../../../services/session-manager/routes/api.js)

**Cambios principales:**
- `GET /status` se alineó al contrato: `{ status: <estado> }`.
- Se agregó `GET /qr`:
  - Si `currentQR` es nulo → `{ status: 'NO_QR' }`.
  - Si existe base64 → `{ status: 'QR_AVAILABLE', qr: <base64> }`.

### 4.3 Boot del servicio

Archivos:
- [services/session-manager/index.js](../../../services/session-manager/index.js)
- [services/session-manager/app.js](../../../services/session-manager/app.js)

**Observación operativa:**
- El servicio inicia y monta rutas. Se detectó que ciertas fallas de Venom podían escalar a reinicios PM2 si quedaban como promesas rechazadas sin control. Se ajustó el flujo en la sesión para devolver `null` en error y no propagar.

### 4.4 PM2 ecosystem

Archivo: [services/session-manager/ecosystem.config.js](../../../services/session-manager/ecosystem.config.js)

**Observación:**
- Se revisó configuración de ejecución (fork, instancias=1, env, logs). No fue necesario introducir un “modo local” porque el requerimiento era estrictamente headless.

## 5) Validaciones realizadas

### 5.1 Endpoints

Desde el host (ejemplos):
- `curl http://localhost:3001/status`
- `curl http://localhost:3001/qr`

Comportamiento observado:
- `/status` transiciona típicamente: `INIT` → `QR_REQUIRED` (si no está logueado).
- `/qr` responde de forma válida, pero frecuentemente permanece en `NO_QR` incluso cuando `/status` indica `QR_REQUIRED`.

### 5.2 Estabilidad de proceso

- Se reinició el proceso con PM2 y se monitorearon logs.
- Se detectaron y mitigaron fallas de Chrome headless por locks de perfil (`SingletonLock` existente). La limpieza previa redujo abortos de arranque.

## 6) Incidentes y diagnóstico

### 6.1 Error recurrente “Not Logged”

Síntoma:
- Venom reporta “Not Logged” y/o desconexiones.

Mitigación aplicada:
- Mapear “Not Logged” a estado `QR_REQUIRED`.
- Evitar que ese rechazo haga caer el proceso (no propagar promesa rechazada).

### 6.2 Fallo al lanzar Chrome (perfil bloqueado)

Síntoma:
- Error de Puppeteer/Chrome similar a: no se puede crear `SingletonLock` y Chrome aborta para evitar corrupción.

Mitigación aplicada:
- Limpieza previa best-effort de archivos `Singleton*` en el perfil antes de iniciar.

### 6.3 QR no disponible aunque el estado sea QR_REQUIRED

Síntoma:
- `/status` indica `QR_REQUIRED` pero `/qr` no expone base64.

Hipótesis principal:
- Incompatibilidad/fragilidad de extracción del QR por Venom frente a cambios recientes en WhatsApp Web (el callback `catchQR` no se dispara, o no entrega base64).

Estado:
- **Bloqueo vigente** para completar login 100% remoto: falta disponibilidad confiable de QR en `/qr`.

## 7) Estado actual

- Servicio responde HTTP correctamente.
- Headless está forzado.
- Persistencia de tokens está configurada y el perfil se almacena en la carpeta esperada.
- Se mitigaron reinicios por errores no manejados y abortos por locks de Chrome.
- **Pendiente crítico:** QR base64 no aparece en forma consistente.

## 8) Riesgos conocidos

- Dependencia de `venom-bot` (v5.3.0) para capturar QR: si WhatsApp Web cambia DOM/flujo, el login headless puede degradar.
- El envío actual por UI simulation (navegación a `web.whatsapp.com/send`) es frágil frente a cambios de selectores.
- Eliminación de `Singleton*` es best-effort y, aunque mitiga locks, puede ser riesgosa si se ejecuta en paralelo con un Chrome realmente activo (por eso el proceso está en 1 instancia).

## 9) Próximos pasos sugeridos (para cerrar el bloqueo del QR)

1. Instrumentar logs adicionales dentro de `catchQR`/`statusFind` y/o activar modo debug controlado para confirmar si Venom está viendo el QR.
2. Si Venom provee `urlCode` aunque no base64, implementar un fallback de generación PNG (QR) server-side.
3. Considerar alternativa de librería (si el proyecto lo permite) en caso de incompatibilidad persistente.

## 10) Referencias internas (relacionadas)

- [docs/05-REPORTES/2026-02/PM2-SESSION-MANAGER-CANON-2026-02-25.md](PM2-SESSION-MANAGER-CANON-2026-02-25.md)
- [docs/05-REPORTES/2026-02/PM2-SESSION-MANAGER-CONTRATO-Y-DESVIOS-2026-02-25.md](PM2-SESSION-MANAGER-CONTRATO-Y-DESVIOS-2026-02-25.md)
