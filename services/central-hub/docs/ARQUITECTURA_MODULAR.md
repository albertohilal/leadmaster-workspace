# Control manual de IA por lead

## Objetivo
Permitir que un operador humano tome el control de la conversación con un lead y, cuando lo desee, devuelva el control a la IA de forma manual y explícita.

## Funcionamiento
- Por defecto, la IA responde automáticamente a los leads.
- Si un humano interviene, la IA deja de responder para ese lead/conversación.
- El control solo puede volver a la IA mediante una acción manual (endpoint, botón o comando administrativo).
- Todas las interacciones (IA y humano) se registran en `ll_ia_conversaciones` con el rol correspondiente.

## Endpoints sugeridos
- `POST /listener/ia/enable` — Devuelve el control a la IA para un lead/conversación. Requiere identificador (ej: teléfono o id de conversación).
  - Body ejemplo: `{ "telefono": "5491112345678" }`
- `POST /listener/ia/disable` — Toma el control manualmente (opcional, puede ser automático al detectar intervención humana).

## Ejemplo de flujo
1. IA responde automáticamente a un lead.
2. Un humano interviene (mensaje manual): la IA se desactiva para ese lead.
3. El humano finaliza y ejecuta la acción manual para devolver el control a la IA.
4. La IA vuelve a responder automáticamente.

---
# Estructura propuesta para leadmaster-central-hub
# -----------------------------
# Envíos masivos (campañas, mensajes) - Estructura y Endpoints

## 📦 Estructura modular propuesta

```

```
leadmaster-central-hub/
│
├── src/
│   ├── index.js                # Entry point principal (Express)
│   ├── config/                  # Configuración y utilidades globales
│   ├── modules/
│   │   ├── session-manager/     # Gestión de sesiones/conexiones WhatsApp
│   │   │   ├── controllers/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   └── ...
│   │   ├── sender/              # Envíos masivos (campañas, mensajes)


## 🚦 Endpoints principales implementados


### Campañas
- `GET /sender/campaigns` — Listar campañas
  - **Response:**
    ```json
    [
      { "id": 1, "nombre": "Campaña Demo", "estado": "activa" }
    ]
    ```
- `POST /sender/campaigns` — Crear campaña
  - **Request:**
    ```json
    { "nombre": "Campaña Test", "descripcion": "Campaña de prueba" }
    ```
  - **Response:**
    ```json
    { "id": 1017, "nombre": "Campaña Test", "descripcion": "Campaña de prueba", "estado": "activa", "creada": "2025-12-13T15:08:13.000Z" }
    ```
- `GET /sender/campaigns/:id` — Detalle de campaña
  - **Response:**
    ```json
    { "id": 1, "nombre": "Campaña Demo", "estado": "activa", "descripcion": "Demo", "creada": "2025-12-13T00:00:00.000Z" }
    ```
- `PUT /sender/campaigns/:id` — Editar campaña
  - **Request:**
    ```json
    { "nombre": "Campaña Editada" }
    ```
  - **Response:**
    ```json
    { "id": 1, "nombre": "Campaña Editada", "descripcion": "Demo", "estado": "activa", "actualizada": "2025-12-13T15:29:06.146Z" }
    ```
- `DELETE /sender/campaigns/:id` — Eliminar campaña
  - **Response:**
    ```json
    { "success": true, "id": 1 }
    ```


### Envíos y Mensajes
- `GET /sender/envios` — Listar envíos
  - **Response:**
    ```json
    [
      { "id": 1, "campaña": "Campaña Demo", "destinatario": "+5491112345678", "estado": "enviado", "fecha": "2025-12-13" },
      { "id": 2, "campaña": "Campaña Navidad", "destinatario": "+5491198765432", "estado": "pendiente", "fecha": "2025-12-13" }
    ]
    ```
- `POST /sender/messages/send` — Enviar mensaje individual
  - **Request:**
    ```json
    { "destinatario": "+5491112345678", "mensaje": "Hola!" }
    ```
  - **Response:**
    ```json
    { "id": 446, "destinatario": "+5491112345678", "mensaje": "Hola!", "estado": "enviado", "fecha": "2025-12-13T15:29:15.017Z" }
    ```
- `POST /sender/messages/send-bulk` — Enviar mensajes masivos (campaña)
  - **Request:**
    ```json
    { "campañaId": 1, "mensajes": [ { "destinatario": "+5491112345678", "mensaje": "Hola!" } ] }
    ```
  - **Response:**
    ```json
    { "campañaId": 1, "enviados": 1, "estado": "procesando" }
    ```
- `GET /sender/messages/status/:id` — Estado de envío
  - **Response:**
    ```json
    { "id": "1", "estado": "enviado", "fecha": "2025-12-13T00:00:00.000Z" }
    ```

---

## 🔗 Integración
- Todos los envíos deben usar la sesión activa de WhatsApp (validar antes de enviar).
- Sin código inline: toda lógica en controladores y servicios.
│   │   │   ├── controllers/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   └── ...
│   │   ├── listener/            # Listener y respuestas automáticas (IA, reglas)
│   │   │   ├── controllers/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   └── ...
│   │   ├── scraper/             # Scraping y enriquecimiento de leads (Google Places, etc)
│   │   │   ├── controllers/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   └── ...
│   │   └── leads/               # Gestión de leads, clientes, integración con Dolibarr
│   │       ├── controllers/
│   │       ├── routes/
│   │       ├── services/
│   │       └── ...
│   ├── services/                # Servicios globales reutilizables
│   └── utils/                   # Utilidades generales
│
├── scripts/                     # Scripts de verificación, migración, etc.
├── .env                         # Variables de entorno
├── package.json
├── README.md
└── ...
```

## Descripción de módulos clave
- **session-manager:**
  - Inicia, cierra, reconecta y monitorea sesiones WhatsApp por cliente (multi-tenant, aisladas por `clienteId`).
  - Provee API y servicio central: `getOrCreateClient(clienteId)`, `getSessionState(clienteId)`, `getQR(clienteId)`, `isReady(clienteId)`, `sendMessage(clienteId, phone, message)`, `disconnect(clienteId)`, `getAllSessions()`.
  - Endpoints: conectar, desconectar, estado, QR. Se recomienda añadir endpoints administrativos: `GET /session-manager/sessions` (listar todas), `POST /session-manager/admin/login` y `POST /session-manager/admin/logout` para operar por `clienteId` con `requireAdmin`.
- **sender:**
  - Lógica de envío masivo, campañas, programación, reportes.
  - Usa la sesión activa del cliente a través de `session-manager` (nunca interactúa directamente con Venom).
- **listener:**
  - Escucha mensajes entrantes y ejecuta respuestas automáticas (IA, reglas, etc).
  - Consume exclusivamente el `session-manager` vía `whatsappService` (`isReady`, `getSessionState`, `sendMessage`). No accede directamente a Venom ni a tokens.
- **scraper:**
  - Scraping de Google Places y otras fuentes para alimentar leads/clientes.
  - Similar a la lógica de desarrolloydisenio-api.
- **leads:**
  - Gestión de leads, clientes, integración con Dolibarr y otras fuentes.

## Notas
- Cada módulo es independiente y puede tener sus propios controladores, rutas y servicios.
- El workspace puede incluir los proyectos legacy como referencia para migración y comparación.
- La estructura es escalable y permite agregar nuevos canales o integraciones fácilmente.

---

_Esta estructura está documentada en este archivo para referencia y planificación._

---

# Listener y respuestas automáticas (IA, reglas)

## Objetivo
El módulo `listener` permite escuchar mensajes entrantes de WhatsApp y, según configuración, responder automáticamente usando IA o reglas, o solo escuchar sin responder.

## Estructura del módulo
```
src/modules/listener/
  controllers/
    listenerController.js
  routes/
    listenerRoutes.js
  services/
    listenerService.js
```

## Funcionamiento
- El listener consume eventos de mensajes entrantes desde la sesión activa de WhatsApp (session-manager).
- Puede funcionar en dos modos:
  1. **Solo escuchar:** Registra los mensajes entrantes, sin enviar respuestas.
  2. **Escuchar y responder:** Además de registrar, responde automáticamente usando IA (OpenAI) o reglas personalizadas.
- La configuración del modo se controla por variable de entorno (`LISTENER_MODE=listen|respond`).
- Las credenciales y configuración (API Key, DB, etc.) se obtienen del archivo `.env` compatible con whatsapp-bot-responder.

## Integración
- El listener se integra con el session-manager para recibir eventos de mensajes y enviar respuestas; está prohibido usar Venom directo en este módulo.
- Si está en modo "responder", utiliza servicios de IA (OpenAI) o lógica de reglas para generar respuestas.
- Toda la lógica está desacoplada en controladores y servicios.

### Guardrails arquitectónicos
- Listener y Sender deben consumir WhatsApp únicamente mediante `session-manager`.
- Cualquier envío debe validar sesión con `isReady(clienteId)` y obtener estado con `getSessionState(clienteId)`.
- En pruebas, se pueden mockear las llamadas al `sessionService` para validar que no se usan internals de Venom.

## Endpoints sugeridos
- `GET /listener/status` — Estado del listener y modo actual.
- `POST /listener/mode` — Cambiar modo (solo escuchar / responder).
- `GET /listener/logs` — Consultar mensajes escuchados y respuestas generadas.

## Ejemplo de configuración en .env
```
LISTENER_MODE=listen
OPENAI_API_KEY=sk-...
DB_HOST=...
DB_USER=...
DB_PASSWORD=...
DB_DATABASE=...
```

---

_Este módulo permite flexibilidad para operar como solo escucha o como bot automático, facilitando pruebas, monitoreo y despliegue seguro._

---
# Arquitectura de respuestas automáticas e IA por cliente

## Estructura modular IA/Reglas

```
src/modules/listener/ia/
  ├── analizador.js         # Analiza el mensaje y determina si hay coincidencia con una regla (por cliente_id)
  ├── respuestas.js         # Respuestas automáticas por regla, organizadas por cliente_id
  ├── chatgpt.js            # Lógica de integración con OpenAI (fallback IA)
  ├── contexto.js           # Contexto personalizado para la IA, por cliente_id
  ├── iaService.js          # Servicio principal: orquesta análisis, reglas y fallback IA
  └── README.md             # Documentación breve de la arquitectura y cómo agregar reglas/clientes
```

### Principios
- Cada cliente puede tener sus propias reglas y respuestas.
- El analizador detecta patrones y decide si responde por regla o deriva a IA.
- El servicio IA orquesta el flujo: primero reglas, luego IA si no hay coincidencia.
- Todo es desacoplado y extensible.

### Ejemplo de flujo
1. Llega un mensaje entrante con `cliente_id` y texto.
2. `iaService` consulta el analizador y respuestas para ese cliente.
3. Si hay coincidencia, responde con la respuesta predefinida.
4. Si no, consulta a OpenAI usando el contexto adecuado.
5. Devuelve la respuesta lista para enviar.

### Extensión
- Para agregar reglas/respuestas para un nuevo cliente, solo se agregan entradas en `analizador.js` y `respuestas.js`.
- El contexto de IA puede personalizarse por cliente en `contexto.js`.

---

# Ejemplo de uso en el listener

```js
const iaService = require('./ia/iaService');

async function onMessageReceived({ cliente_id, telefono, texto }) {
  const respuesta = await iaService.responder({ cliente_id, telefono, texto });
  // ...enviar respuesta por WhatsApp
}
```

---

# Ventajas
- Modularidad total.
- Fácil de mantener y escalar.
- Permite control manual, reglas y fallback IA en un solo flujo.
