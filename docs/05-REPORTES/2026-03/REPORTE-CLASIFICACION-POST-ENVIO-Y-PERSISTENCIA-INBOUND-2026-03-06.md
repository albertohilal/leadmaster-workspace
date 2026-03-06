# Reporte — Clasificación Post-Envío vs Post-Respuesta (Auditoría de Implementación)

**Fecha:** 2026-03-06  
**Destino (path):** `docs/05-REPORTES/2026-03/REPORTE-CLASIFICACION-POST-ENVIO-Y-PERSISTENCIA-INBOUND-2026-03-06.md`

## Objetivo
Verificar (con evidencia en repo) si existe un sistema de **clasificación** de leads/números WhatsApp:
- **Post-envío** (operador clasifica el resultado luego de enviar)
- **Post-respuesta / inbound** (clasificación luego de recibir respuesta)

El reporte separa explícitamente:
- **Implementado** (DB + API + UI / wiring real)
- **Documentado/planeado** (si aplica)

---

## A) Estado (resumen)

### A.1 Clasificación post-envío — IMPLEMENTADO (end-to-end)
Existe un sistema formal y auditable bajo **OPS-POST-ENVÍO-01** con:
- Tabla histórica `ll_post_envio_clasificaciones` (enums)
- Endpoint backend para registrar clasificaciones
- UI (botón + modal) para operar desde la grilla de prospectos

**Evidencia (documento OPS):** `docs/05-REPORTES/OPS/OPS-POST-ENVIO-01-CLASIFICACION-DEPURADORA.md` (L1-L120)
```markdown
# OPS-POST-ENVIO-01 — Clasificación Post-Envío (Depuradora)
...
## DDL / Migration (idempotente)
- Migration SQL: `services/central-hub/migrations/003_create_ll_post_envio_clasificaciones.sql`
...
## API (Backend)
- POST `/api/sender/envios/:envio_id/post-envio-clasificar`
...
## UI mínima (Operador)
- Acción por fila: “Clasificar post-envío”
...
```

### A.2 Post-respuesta / inbound — PERSISTENCIA IMPLEMENTADA, CLASIFICACIÓN (motivos/enums/UI) NO ENCONTRADA
Se encontró implementación real de **persistencia de mensajes WhatsApp** (IN/OUT) vía módulo Listener, con tabla `ll_whatsapp_messages`.

No se encontró (en esta auditoría) un sistema equivalente a OPS-POST-ENVÍO-01 para **clasificar post-respuesta** con motivos/enums/endpoint/UI dedicados.

---

## B) Base de datos (tablas/enums)

### B.1 Post-envío: `ll_post_envio_clasificaciones` — IMPLEMENTADO
Tabla satélite (bitácora) con enums exactos.

**Evidencia (DDL):** `services/central-hub/migrations/003_create_ll_post_envio_clasificaciones.sql` (L1-L120)
```sql
CREATE TABLE IF NOT EXISTS ll_post_envio_clasificaciones (
  ...
  post_envio_estado ENUM(
    'CONTACTO_VALIDO_SIN_INTERES',
    'INTERESADO_PARA_DERIVAR_A_HABY',
    'PENDIENTE_SIN_RESPUESTA',
    'NUMERO_INEXISTENTE',
    'NUMERO_CAMBIO_DUEÑO',
    'TERCERO_NO_RESPONSABLE',
    'ATENDIO_MENOR_DE_EDAD',
    'NO_ENTREGADO_ERROR_ENVIO'
  ) NOT NULL,
  accion_siguiente ENUM(
    'DERIVAR_HABY',
    'FOLLOWUP_1',
    'CERRAR',
    'INVALIDAR_TELEFONO',
    'REINTENTO_TECNICO',
    'NO_CONTACTAR'
  ) NOT NULL,
  ...
);
```

### B.2 Inbound/outbound: `ll_whatsapp_messages` — IMPLEMENTADO
Tabla unificada para persistencia IN/OUT con idempotencia por `UNIQUE (cliente_id, message_hash)`.

**Evidencia (DDL):** `services/central-hub/db/migrations/004_create_ll_whatsapp_messages.sql` (L1-L22)
```sql
CREATE TABLE IF NOT EXISTS ll_whatsapp_messages (
  id INT NOT NULL AUTO_INCREMENT,
  cliente_id INT NOT NULL,
  direction ENUM('IN','OUT') NOT NULL DEFAULT 'IN',
  wa_from VARCHAR(32) NOT NULL,
  wa_to VARCHAR(32) NULL,
  message TEXT NOT NULL,
  ts_wa DATETIME NOT NULL,
  message_hash CHAR(64) NOT NULL,
  raw_json JSON NULL,
  ...
  UNIQUE KEY uq_cliente_hash (cliente_id, message_hash)
);
```

---

## C) Backend (endpoints + wiring)

### C.1 Post-envío — IMPLEMENTADO
Registro del endpoint y lógica de validación + persistencia.

**Ruta:** `services/central-hub/src/modules/sender/routes/envios.js` (L1-L26)
```js
// OPS-POST-ENVÍO-01: Clasificación post-envío (auditable)
router.post('/:id/post-envio-clasificar', enviosController.clasificarPostEnvio);
```

**Controller (enums + reglas + multi-tenant + insert histórico):**
- `services/central-hub/src/modules/sender/controllers/enviosController.js` (L1-L28)
- `services/central-hub/src/modules/sender/controllers/enviosController.js` (L388-L515)

Snippet (regla sensible + persistencia):
```js
if (post_envio_estado === 'ATENDIO_MENOR_DE_EDAD' && accion_siguiente !== 'NO_CONTACTAR') {
  return res.status(400).json({
    success: false,
    message: 'Para ATENDIO_MENOR_DE_EDAD la accion_siguiente debe ser NO_CONTACTAR'
  });
}

await pool.execute(
  `INSERT INTO ll_post_envio_clasificaciones
     (envio_id, cliente_id, post_envio_estado, accion_siguiente, detalle, clasificado_por)
   VALUES
     (?, ?, ?, ?, ?, ?)`
);
```

### C.2 Inbound/outbound (post-respuesta como evento) — IMPLEMENTADO
`session-manager` postea mensajes entrantes/salientes al módulo listener de central-hub.

**Evidencia (session-manager → central-hub /incoming-message y /outgoing-message):**
`services/session-manager/whatsapp/wwebjs-session.js` (L250-L430)
```js
const url = `${CENTRAL_HUB_BASE_URL}/api/listener/incoming-message`;
...
waClient.on('message', async (msg) => {
  ...
  await postToCentralHubIncomingMessage({ from: telefono, message: texto, timestamp: tsIso });
});

const url = `${CENTRAL_HUB_BASE_URL}/api/listener/outgoing-message`;
```

**Wiring (central-hub listener routes, endpoints internos + guard opcional):**
`services/central-hub/src/modules/listener/routes/listenerRoutes.js` (L1-L55)
```js
router.post('/incoming-message', internalListenerTokenGuard, incomingMessageController.incomingMessage);
router.post('/outgoing-message', internalListenerTokenGuard, incomingMessageController.outgoingMessage);
```

**Controller (validaciones y persistencia):**
`services/central-hub/src/modules/listener/controllers/incomingMessageController.js` (L1-L210)

**Service (hash idempotente + INSERT ON DUPLICATE KEY):**
`services/central-hub/src/modules/listener/services/messagePersistence.js` (L1-L210)
```js
const messageHash = sha256Hex(`${clienteId}|IN|${fromDigits}|${message}|${tsIsoNormalized}`);
...
INSERT INTO ll_whatsapp_messages ...
ON DUPLICATE KEY UPDATE id = id
```

---

## D) Frontend/UI

### D.1 Post-envío — IMPLEMENTADO
Existe UI operativa (botón por fila + modal) y llamada a API.

**Botón por fila:** `services/central-hub/frontend/src/components/destinatarios/GestionDestinatariosPage.jsx` (L560-L610)
```jsx
{p.envio_id && (
  <button ...>
    Clasificar post-envío
  </button>
)}
```

**Modal + reglas UI (menor de edad fuerza NO_CONTACTAR / sugerencia INVALIDAR_TELEFONO):**
`services/central-hub/frontend/src/components/destinatarios/GestionDestinatariosPage.jsx` (L260-L357) y (L660-L760)

**Cliente API (frontend):** `services/central-hub/frontend/src/services/envios.js` (L1-L110)
```js
async clasificarPostEnvio(envioId, payload, options = {}) {
  return apiService.post(`/sender/envios/${id}/post-envio-clasificar${qs}`, payload);
}
```

### D.2 Post-respuesta / inbound — UI de clasificación NO ENCONTRADA
No se encontró UI dedicada a clasificar mensajes entrantes con motivos (tipo “ya es cliente”, “no usa WhatsApp”, “pedir baja”, “cambio de rubro”).

---

## E) Cobertura de motivos (mapping rápido)

### E.1 Cubierto por enums post-envío (implementado)
**Estados (post_envio_estado)** disponibles incluyen:
- `NUMERO_INEXISTENTE`
- `NUMERO_CAMBIO_DUEÑO`
- `TERCERO_NO_RESPONSABLE`
- `ATENDIO_MENOR_DE_EDAD`

**Acciones (accion_siguiente)** incluyen:
- `INVALIDAR_TELEFONO`
- `NO_CONTACTAR`

**Evidencia (enums DB):** `services/central-hub/migrations/003_create_ll_post_envio_clasificaciones.sql` (L23-L58)

### E.2 No cubierto como clasificación formal (no encontrado)
No aparece un set de enums/códigos para:
- “ya es cliente”
- “no usa WhatsApp”
- “pedir baja/opt-out” (más allá de poder registrar `NO_CONTACTAR` como acción en post-envío)
- “cambio de rubro”

---

## F) Impacto en flujo (bloqueos y exclusiones)

### F.1 Registro vs bloqueo — hallazgo
En el repo, `ll_post_envio_clasificaciones` se usa para:
- Crear la tabla (migración)
- Registrar clasificaciones (endpoint)
- Mostrar/operar desde UI

No se encontró evidencia (en esta auditoría) de que `accion_siguiente=NO_CONTACTAR` o `INVALIDAR_TELEFONO` se consuman para:
- Excluir prospectos del filtrado
- Bloquear envíos futuros
- Implementar blacklist/opt-out real

**Evidencia (uso del endpoint):** `services/central-hub/src/modules/sender/controllers/enviosController.js` (L388-L515)
```js
INSERT INTO ll_post_envio_clasificaciones ...
SELECT ... FROM ll_post_envio_clasificaciones ...
```

**Nota:** Este punto es importante: hoy el sistema luce como **auditoría + UX operativa**, no como **enforcement** (bloqueo) en el flujo de envío.

---

## Conclusión
- **Clasificación post-envío:** implementada end-to-end (DB/API/UI) como evento histórico auditable.
- **Post-respuesta/inbound:** existe persistencia formal IN/OUT en `ll_whatsapp_messages` (DB + endpoints internos + session-manager bridge), pero **no** se halló una clasificación post-respuesta por motivos en la misma línea de OPS.
