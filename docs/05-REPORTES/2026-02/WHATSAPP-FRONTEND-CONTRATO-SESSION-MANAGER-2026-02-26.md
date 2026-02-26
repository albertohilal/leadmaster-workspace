# WHATSAPP FRONTEND – CONTRATO SESSION-MANAGER (FIX)

**Fecha:** 2026-02-26  
**Destino:** `docs/05-REPORTES/2026-02/WHATSAPP-FRONTEND-CONTRATO-SESSION-MANAGER-2026-02-26.md`  
**Alcance:** Integración Frontend (Central Hub) ↔ Session Manager  

---

## Resumen Ejecutivo

La pantalla `/whatsapp` del frontend mostraba “Error en la sesión” y **no se observaban requests** a `/status` o `/qr` en DevTools. La causa raíz fue doble:

1. **Crash en runtime del componente React** por uso de `process.env.NODE_ENV` en un bundle Vite (en navegador típicamente `process` no existe), lo que impedía ejecutar `useEffect`.
2. **Desalineación de contrato HTTP esperado por el frontend**: el componente estaba implementado contra endpoints y payloads distintos (`POST /init` y `GET /status` → `state` + `qr_code_base64`) mientras que el `session-manager` vigente expone `POST /connect`, `GET /status` → `{ status }` y `GET /qr` → `{ status: QR_AVAILABLE|NO_QR, qr }`.

Resultado: el frontend quedaba en error/estado inválido y/o sin ejecutar el flujo de inicialización/polling.

---

## Contexto

- El microservicio `services/session-manager` fue migrado a `whatsapp-web.js` y mantiene el contrato HTTP acordado:
  - `POST /connect`
  - `GET /status` → `{ status: INIT|QR_REQUIRED|AUTHENTICATED|READY|DISCONNECTED|ERROR }`
  - `GET /qr` → `{ status: NO_QR }` o `{ status: QR_AVAILABLE, qr, qrType? }`

- La UI de Central Hub renderiza `WhatsappSession` desde `WhatsappPage.jsx` y toma la base URL desde `VITE_SESSION_MANAGER_URL` (fallback `http://localhost:3001`).

---

## Hallazgos (Causa Raíz)

### 1) `process.env.NODE_ENV` en Vite

- El componente `WhatsappSession.jsx` contenía un bloque de debug protegido por `process.env.NODE_ENV === 'development'`.
- En Vite (browser) esto puede producir `ReferenceError: process is not defined`.
- Efecto: el componente puede fallar en render y **nunca ejecutar** los `useEffect`, por lo que no aparecen requests en Network.

### 2) Contrato HTTP esperado por el frontend no coincide

El componente asumía:

- `POST /init`
- `GET /status` devolviendo `data.state`
- `QR_REQUIRED` usando `data.qr_code_base64`

Pero el `session-manager` actual expone:

- `POST /connect`
- `GET /status` devolviendo `data.status`
- `GET /qr` devolviendo `{ status: 'QR_AVAILABLE', qr: <data-url> }`

---

## Solución Implementada

Se actualizó el componente del frontend para:

1. Evitar crash en Vite:
   - Reemplazo de `process.env.NODE_ENV` por `import.meta.env.DEV`.

2. Ajustar el flujo al contrato real del `session-manager`:
   - Al montar: `POST ${sessionManagerUrl}/connect`
   - Polling: `GET ${sessionManagerUrl}/status` (lee `data.status`)
   - Si estado `QR_REQUIRED`: `GET ${sessionManagerUrl}/qr` y renderiza `data.qr` (Data URL PNG)
   - Si estado `READY`: marca conectado y detiene polling

3. Manejo de estados:
   - Soporta `INIT`, `QR_REQUIRED`, `AUTHENTICATED`, `READY`, `DISCONNECTED`, `ERROR`.

---

## Archivos Impactados

- `services/central-hub/frontend/src/components/WhatsappSession.jsx`

---

## Verificación

- Build del frontend:
  - Comando: `npm -C /root/leadmaster-workspace/services/central-hub/frontend run build`
  - Resultado: **OK** (Vite build exitoso)

---

## Riesgos / Consideraciones Operativas

- **URL de Session Manager desde el navegador:**
  - El fallback `http://localhost:3001` solo sirve para desarrollo local.
  - En producción, el navegador del usuario no resolverá el `localhost` del VPS.

---

## Próximos Pasos Sugeridos

1. Definir estrategia de acceso desde frontend en producción:
   - Opción A: configurar `VITE_SESSION_MANAGER_URL` apuntando al host real accesible.
   - Opción B (preferible): crear un **reverse proxy** desde Central Hub (same-origin) hacia Session Manager para evitar CORS/puertos y simplificar despliegue.

2. Validación end-to-end en entorno real:
   - Abrir `/whatsapp` en el navegador.
   - Confirmar requests a `/connect`, `/status`, `/qr`.
   - Confirmar que el QR se muestra y `READY` se refleja como “Conectado”.
