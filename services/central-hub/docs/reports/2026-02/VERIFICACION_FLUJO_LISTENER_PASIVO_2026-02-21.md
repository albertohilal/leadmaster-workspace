# ✅ VERIFICACIÓN FLUJO COMPLETO: Listener Pasivo
**Fecha:** 2026-02-21  
**Auditor:** Sistema Automatizado  
**Alcance:** Análisis línea por línea del flujo massive-sender → bot-responder  
**Objetivo:** Confirmar funcionamiento seguro en modo `bot_activo = 0`

---

##  RESUMEN EJECUTIVO

**CONCLUSIÓN:** ✅ **Es SEGURO ejecutar con bot_activo = 0**

**ADVERTENCIA CRÍTICA:** ⚠️ **NO es seguro con bot_activo = 1** (riesgo de loop infinito)

---

## PARTE 1 — MASSIVE-SENDER

### ✅ Instanciación de WhatsApp

**Archivo:** `/root/whatsapp-massive-sender/routes/haby.js`

**Línea 11:** Inicio de función `createHabyWappClient()`

```javascript
function createHabyWappClient() {
  console.log('🚀 Creando cliente WhatsApp para Haby...');
```

**Línea 18:** Creación de instancia de Cliente

```javascript
habyClientWrapper = {
  client: new Client({
    authStrategy: new LocalAuth({ dataPath: 'tokens/haby' }),
    puppeteer: {
```

**Tecnología utilizada:**
- ✅ `whatsapp-web.js` (no Venom)
- ✅ Estrategia de autenticación: `LocalAuth`
- ✅ Tokens guardados en: `tokens/haby/`

**Función de obtención de cliente:**

**Línea 202 (haby.js):** Función exportada

```javascript
function getHabyClient() {
  if (!habyClientWrapper || !habyClientWrapper.client) {
    throw new Error('Cliente WhatsApp Haby no inicializado');
  }
  return habyClientWrapper.client;
}
```

---

### ✅ Listener de Mensajes

**Archivo:** `/root/whatsapp-massive-sender/routes/whatsapp-listener.js`

**Línea 103:** Función que configura el listener

```javascript
function setupMessageListener() {
  try {
    const client = getHabyClient();
```

**Línea 115:** Event handler de mensajes

```javascript
    client.on('message', async (msg) => {
      // Filtrar status broadcasts y newsletters
      if (msg.from === 'status@broadcast' || msg.from.includes('@newsletter')) {
        console.log(`📨 Mensaje recibido de ${msg.from} (ignorado: status/newsletter)`);
        return;
      }
```

**✅ CONFIRMADO:** Evento escuchado: `'message'`

**✅ CONFIRMADO:** Filtra:
- `status@broadcast` (línea 117)
- `@newsletter` (línea 117)

**❌ CRÍTICO:** NO filtra `msg.fromMe`

**Verificación realizada:**
```bash
$ grep -n "fromMe" /root/whatsapp-massive-sender/routes/whatsapp-listener.js
# Resultado: 0 matches
```

---

### ✅ Reenvío a Webhooks

**Archivo:** `/root/whatsapp-massive-sender/routes/whatsapp-listener.js`

**Línea 123:** Log de captura

```javascript
      console.log(`📨 Mensaje recibido de ${msg.from}: ${msg.body}`);
```

**Línea 125-133:** Envío a listeners registrados

```javascript
      // Notificar a todos los listeners registrados
      await notifyListeners({
        from: msg.from,
        body: msg.body,
        timestamp: msg.timestamp,
        type: msg.type,
        id: msg.id._serialized,
        cliente_id: 51 // Haby
      });
```

**Línea 93:** Función `notifyListeners`

```javascript
async function notifyListeners(message) {
  const axios = require('axios');
  
  for (const url of listeners) {
    try {
      await axios.post(url, message, {
        timeout: 5000,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error(`❌ Error notificando a ${url}:`, error.message);
    }
  }
}
```

**✅ CONFIRMADO:**
- URL destino: Todas las URLs en el Set `listeners`
- Método: `HTTP POST`
- Timeout: 5000ms
- Headers: `Content-Type: application/json`

**Estructura del payload:**
```json
{
  "from": "5491112345678@c.us",
  "body": "Texto del mensaje",
  "timestamp": 1234567890,
  "type": "chat",
  "id": "mensaje_id_serializado",
  "cliente_id": 51
}
```

---

### ✅ Registro de Listeners

**Archivo:** `/root/whatsapp-massive-sender/routes/whatsapp-listener.js`

**Línea 8:** Variable para almacenar listeners

```javascript
const listeners = new Set();
```

**Línea 11:** Endpoint de registro

```javascript
router.post('/api/whatsapp/register-listener', (req, res) => {
  const { callbackUrl } = req.body;
  
  if (!callbackUrl) {
    return res.status(400).json({ error: 'callbackUrl requerido' });
  }
  
  listeners.add(callbackUrl);
  console.log(`📡 Listener registrado: ${callbackUrl}`);
  
  res.json({ 
    success: true, 
    message: 'Listener registrado correctamente',
    totalListeners: listeners.size
  });
});
```

**✅ CONFIRMADO:** bot-responder se registra llamando a este endpoint.

---

## PARTE 2 — BOT-RESPONDER

### ✅ Endpoint de Recepción

**Archivo:** `/root/whatsapp-bot-responder/index.js`

**Línea 48:** Endpoint webhook

```javascript
app.post('/api/message-received', async (req, res) => {
  const { from, body, timestamp, type, id, cliente_id } = req.body;
  
  console.log(`📨 Mensaje recibido de ${from}: ${body} (cliente_id: ${cliente_id || 'default'})`);
  
  // Responder inmediatamente al webhook
  res.json({ success: true, received: true });
```

**✅ CONFIRMADO:** Respuesta HTTP inmediata (línea 54) antes de procesamiento.

---

### ✅ Persistencia INCONDICIONAL

**Archivo:** `/root/whatsapp-bot-responder/index.js`

**Línea 57-69:** Normalización y validación

```javascript
  // Procesar el mensaje de forma asíncrona
  try {
    const telefonoCanon = normalizarTelefonoWhatsApp(from);
    const texto = (body || '').trim();
    
    if (!texto || type !== 'chat') {
      return;
    }
    
    // Usar cliente_id del webhook o fallback al .env
    const clienteIdFinal = cliente_id || process.env.CLIENTE_ID || 51;
```

**Línea 71-73:** Guardado en base de datos

```javascript
    // Guardar mensaje entrante con cliente_id
    await guardarMensaje(telefonoCanon, 'usuario', texto, clienteIdFinal);
    
    console.log(`✅ Mensaje registrado de ${telefonoCanon} (cliente: ${clienteIdFinal})`);
```

**✅ CONFIRMADO:** `guardarMensaje()` se ejecuta ANTES de cualquier chequeo de `bot_activo`.

**Tabla destino:** `ll_ia_conversaciones`

**Implementación (db/conversaciones.js línea 10-23):**
```javascript
const sql = `
  INSERT INTO ll_ia_conversaciones (cliente_id, telefono, rol, mensaje, created_at)
  VALUES (?, ?, ?, ?, NOW())
`;
const params = [clienteId, telefono, rol, mensaje];

try {
  await pool.execute(sql, params);
  console.log('✅ Mensaje guardado en DB:', params);
}
```

---

### ✅ Consulta de bot_activo

**Archivo:** `/root/whatsapp-bot-responder/index.js`

**Línea 75-81:** Consulta a base de datos

```javascript
    // Consultar configuración del bot para este cliente
    const pool = require('./db/pool');
    const [configRows] = await pool.execute(
      'SELECT bot_activo FROM ll_bot_config WHERE cliente_id = ?',
      [clienteIdFinal]
    );
    
    const botActivo = configRows.length > 0 ? configRows[0].bot_activo : 0;
```

**✅ CONFIRMADO:**
- Tabla: `ll_bot_config`
- Campo: `bot_activo`
- Filtro: `cliente_id`
- Default: `0` (si no existe registro)

---

### ✅ Control de Respuesta (PUNTO CRÍTICO)

**Archivo:** `/root/whatsapp-bot-responder/index.js`

**Línea 84-87:** Evaluación y return temprano

```javascript
    if (botActivo === 0) {
      console.log(`🔇 Bot en MODO SOLO ESCUCHA para cliente ${clienteIdFinal} - No se envía respuesta`);
      return;
    }
```

**✅ CONFIRMADO:**
- Comparación estricta: `botActivo === 0`
- Acción: `return` inmediato
- Log explícito: "MODO SOLO ESCUCHA"

**CONSECUENCIA:** El código NO continúa a las líneas siguientes cuando `bot_activo = 0`.

---

### ✅ Generación y Envío de Respuesta (SOLO si bot_activo = 1)

**Archivo:** `/root/whatsapp-bot-responder/index.js`

**Línea 89-91:** Inicio de bloque bot activo

```javascript
    // Bot activo - Generar y enviar respuesta
    console.log(`🤖 Bot ACTIVO para cliente ${clienteIdFinal} - Generando respuesta...`);
    
    // Obtener historial del cliente específico
    const historial = await obtenerHistorial(telefonoCanon, 10, clienteIdFinal);
```

**Línea 95:** Llamada a OpenAI

```javascript
    // Generar respuesta con IA
    const respuestaIA = await generarRespuesta(texto, historial);
```

**Línea 97-105:** Guardado y envío

```javascript
    if (respuestaIA) {
      // Guardar respuesta del bot con cliente_id
      await guardarMensaje(telefonoCanon, 'bot', respuestaIA, clienteIdFinal);
      
      // Enviar respuesta
      await whatsappClient.sendMessage(from, respuestaIA);
      
      console.log(`✅ Respuesta enviada a ${telefonoCanon} (cliente: ${clienteIdFinal})`);
    }
```

**✅ CONFIRMADO:**
- Línea 100: `guardarMensaje(..., 'bot', ...)` - Solo si `bot_activo = 1`
- Línea 103: `whatsappClient.sendMessage(...)` - Solo si `bot_activo = 1`

---

### ✅ Verificación Exhaustiva de sendMessage

**Búsqueda realizada:**
```bash
$ grep -n "sendMessage" /root/whatsapp-bot-responder/index.js
103:      await whatsappClient.sendMessage(from, respuestaIA);
```

**Líneas totales del archivo:** 132

**✅ CONFIRMADO:** Solo existe 1 invocación de `sendMessage` en todo el archivo (línea 103).

**Líneas 121-133:** Handlers de cierre

```javascript
// Cleanup al cerrar
process.on('SIGINT', async () => {
  console.log('🛑 Cerrando bot responder...');
  await whatsappClient.destroy();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Cerrando bot responder...');
  await whatsappClient.destroy();
  process.exit(0);
});
```

**✅ CONFIRMADO:** No hay otros `sendMessage` en handlers de señal.

---

## PARTE 3 — RIESGO DE CONFLICTO Y LOOP

### ⚠️ RIESGO DE LOOP INFINITO (bot_activo = 1)

**Escenario:**

```
1. Usuario envía: "Hola"
   └─> massive-sender captura
       └─> Reenvía a bot-responder

2. bot-responder (bot_activo=1):
   ├─ Guarda mensaje usuario
   ├─ Genera respuesta: "Hola, ¿en qué puedo ayudarte?"
   └─ Envía via whatsappClient.sendMessage()

3. massive-sender captura el mensaje del bot:
   ├─ client.on('message', ...) línea 115
   ├─ ❌ NO filtra msg.fromMe
   └─> Reenvía a bot-responder

4. bot-responder (bot_activo=1):
   ├─ Guarda mensaje del bot como si fuera del usuario
   ├─ Genera respuesta al mensaje del bot
   └─ Envía nueva respuesta

5. LOOP INFINITO →→→
```

**Evidencia del riesgo:**

**Archivo:** `/root/whatsapp-massive-sender/routes/whatsapp-listener.js`

**Línea 115-121:** Filtros actuales

```javascript
client.on('message', async (msg) => {
  // Filtrar status broadcasts y newsletters
  if (msg.from === 'status@broadcast' || msg.from.includes('@newsletter')) {
    console.log(`📨 Mensaje recibido de ${msg.from} (ignorado: status/newsletter)`);
    return;
  }
  
  console.log(`📨 Mensaje recibido de ${msg.from}: ${msg.body}`);
```

**Búsqueda de filtro fromMe:**
```bash
$ grep -n "fromMe" /root/whatsapp-massive-sender/routes/whatsapp-listener.js
# Resultado: 0 coincidencias
```

**Búsqueda en haby.js:**
```bash
$ grep -n "fromMe" /root/whatsapp-massive-sender/routes/haby.js
# Resultado: 0 coincidencias
```

**✅ CONFIRMADO:** massive-sender NO filtra mensajes propios.

**Mitigación ACTUAL:** bot-responder tiene `return` en línea 86 cuando `bot_activo = 0`.

**Conclusión:**
- ✅ **SEGURO** con `bot_activo = 0` → No envía respuestas → No hay loop
- ⚠️ **PELIGROSO** con `bot_activo = 1` → Envía respuestas → Loop infinito

---

### ⚠️ RIESGO DE CONFLICTO CON SESSION-MANAGER

**Pregunta:** ¿Pueden massive-sender y session-manager usar el mismo número simultáneamente?

**Respuesta:** ❌ **NO**

**Análisis:**

**massive-sender:**
- Instancia: `whatsapp-web.js` Client
- Tokens: `tokens/haby/`
- Número: El configurado en la sesión Haby

**session-manager:**
- Ubicación: `/root/leadmaster-workspace/services/session-manager/`
- Tecnología: Venom-bot
- Tokens: (ubicación desconocida, requiere verificación)

**Restricción de WhatsApp Web:**
- Solo 1 conexión activa por número telefónico
- Si 2 servicios intentan conectarse → El segundo falla
- El primero en conectar mantiene la sesión

**Estado actual (verificado):**
```bash
$ pm2 list
┌────┬───────────────────┬─────────┬───────────┐
│ id │ name              │ status  │ memory    │
├────┼───────────────────┼─────────┼───────────┤
│ 10 │ session-manager   │ online  │ 104.4mb   │  ← ACTIVO
│ 12 │ leadmaster-centra…│ online  │ 147.9mb   │
└────┴───────────────────┴─────────┴───────────┘

# massive-sender NO está corriendo
# bot-responder NO está corriendo
```

**Conclusión:**
- ✅ **NO hay conflicto actual** (massive-sender detenido)
- ⚠️ **HABRÁ conflicto SI se activan ambos**

**Recomendación:**
```bash
# Antes de activar massive-sender:
pm2 stop session-manager
pm2 save

# Luego:
pm2 start massive-sender
pm2 start bot-responder
```

---

## CHECKLIST DE VERIFICACIÓN

### ✅ Massive-Sender

- [✅] Archivo listener: `/root/whatsapp-massive-sender/routes/whatsapp-listener.js`
- [✅] Línea del client.on('message'): **Línea 115**
- [⚠️] Confirmación de filtrado fromMe: **NO IMPLEMENTADO**
- [✅] Línea donde hace POST al webhook: **Línea 94-104** (función notifyListeners)
- [✅] Tecnología: whatsapp-web.js
- [✅] Instancia: `/root/whatsapp-massive-sender/routes/haby.js` línea 18

### ✅ Bot-Responder

- [✅] Archivo donde se consulta bot_activo: `/root/whatsapp-bot-responder/index.js`
- [✅] Línea del SELECT: **Línea 78-80**
- [✅] Línea del if (botActivo === 0): **Línea 84**
- [✅] Confirmación de return temprano: **Línea 86** (`return;`)
- [✅] Línea de sendMessage: **Línea 103**
- [✅] Confirmación que solo ocurre si bot_activo = 1: **SÍ** (después del if línea 84)
- [✅] Confirmación de guardado previo en BD: **Línea 71** (ANTES del chequeo)
- [✅] Verificación exhaustiva: Solo 1 sendMessage en todo el archivo

### ⚠️ Riesgos

- [⚠️] Riesgo de loop: **SÍ con bot_activo=1 / NO con bot_activo=0**
  - **Explicación:** massive-sender NO filtra msg.fromMe. Si bot responde, capturará su propio mensaje y lo reenviará, generando loop infinito.
  - **Mitigación actual:** Con bot_activo=0, el bot NO envía respuestas → No hay loop.
  - **Solución permanente:** Agregar `if (msg.fromMe) return;` en línea 116 de whatsapp-listener.js

- [⚠️] Riesgo de conflicto con session-manager: **SÍ**
  - **Explicación:** WhatsApp Web solo permite 1 conexión por número. session-manager y massive-sender NO pueden ejecutarse simultáneamente con el mismo número.
  - **Estado actual:** session-manager ACTIVO, massive-sender DETENIDO → No hay conflicto.
  - **Recomendación:** `pm2 stop session-manager` antes de activar massive-sender.

---

## DIAGRAMA DE FLUJO COMPLETO

### Flujo con bot_activo = 0 (LISTENER PASIVO - SEGURO)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Usuario envía: "Hola"                                    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. massive-sender                                            │
│    whatsapp-listener.js línea 115                           │
│    client.on('message', async (msg) => {                    │
│      if (msg.from !== 'status@broadcast') { ... }           │
│    })                                                        │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP POST
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. bot-responder                                             │
│    index.js línea 48                                         │
│    POST /api/message-received                               │
│    res.json({ success: true, received: true });             │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Persistencia                                              │
│    index.js línea 71                                         │
│    await guardarMensaje(telefono, 'usuario', texto, 51);    │
│                                                              │
│    INSERT INTO ll_ia_conversaciones                         │
│    (cliente_id, telefono, rol, mensaje, created_at)         │
│    VALUES (51, '5491112345678@c.us', 'usuario', 'Hola', NOW()) │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Consulta configuración                                    │
│    index.js línea 78                                         │
│    SELECT bot_activo FROM ll_bot_config WHERE cliente_id=51 │
│    → Resultado: bot_activo = 0                              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Control de respuesta                                      │
│    index.js línea 84                                         │
│    if (botActivo === 0) {                                   │
│      console.log("🔇 MODO SOLO ESCUCHA");                   │
│      return;  ← SALIDA TEMPRANA                             │
│    }                                                         │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
                    ┌────────┐
                    │  FIN   │ ✅ SEGURO
                    └────────┘

    ❌ NO se ejecuta:
    - generarRespuesta() (línea 95)
    - guardarMensaje(..., 'bot', ...) (línea 100)
    - whatsappClient.sendMessage() (línea 103)
```

### Flujo con bot_activo = 1 (BOT ACTIVO - PELIGROSO)

```
[... todo igual hasta línea 84 ...]

┌─────────────────────────────────────────────────────────────┐
│ 6. Control de respuesta                                      │
│    index.js línea 84                                         │
│    if (botActivo === 0) { return; }                         │
│    → bot_activo = 1 → NO hace return                        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. Generación de respuesta IA                                │
│    index.js línea 95                                         │
│    const respuestaIA = await generarRespuesta(texto, hist); │
│    → GPT-4o genera: "Hola, ¿en qué puedo ayudarte?"        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 8. Envío de respuesta                                        │
│    index.js línea 103                                        │
│    await whatsappClient.sendMessage(from, respuestaIA);     │
│                                                              │
│    HTTP POST → massive-sender /api/whatsapp/send            │
│    → massive-sender envía a WhatsApp Web                    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 9. ⚠️ PROBLEMA: massive-sender captura mensaje propio       │
│    whatsapp-listener.js línea 115                           │
│    client.on('message', async (msg) => {                    │
│      // ❌ NO filtra msg.fromMe                             │
│      await notifyListeners({                                │
│        from: "5491112345678@c.us",                          │
│        body: "Hola, ¿en qué puedo ayudarte?"               │
│      });                                                     │
│    })                                                        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 10. bot-responder procesa mensaje del bot como usuario      │
│     Guarda en BD como 'usuario'                             │
│     Genera respuesta al mensaje del bot                     │
│     Envía nueva respuesta                                   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
                  ┌──────────────┐
                  │  LOOP ∞      │ ⚠️ PELIGRO
                  │  ↻ ↻ ↻ ↻ ↻  │
                  └──────────────┘
```

---

## CONCLUSIÓN TÉCNICA FINAL

### ✅ ¿Es seguro ejecutar el sistema con bot_activo = 0 sin enviar respuestas automáticas?

**RESPUESTA: SÍ, es completamente seguro.**

### Justificación Técnica:

1. **Persistencia garantizada (línea 71)**
   - El mensaje se guarda en `ll_ia_conversaciones` ANTES de cualquier chequeo
   - Operación exitosa independiente de `bot_activo`

2. **Control de respuesta robusto (línea 84-86)**
   - Comparación estricta: `botActivo === 0`
   - Return inmediato impide ejecución de código posterior
   - Log explícito confirma modo pasivo

3. **Sin invocaciones alternativas**
   - Solo existe 1 `sendMessage` en todo el archivo (línea 103)
   - Ningún handler de señal (SIGINT/SIGTERM) invoca sendMessage
   - No hay código condicional adicional que pueda enviar mensajes

4. **Prevención de loop**
   - Con `bot_activo = 0`, NO se envían mensajes
   - Sin mensajes salientes, NO hay capturas por massive-sender
   - Sin capturas, NO hay loop

### Condiciones para Operación Segura:

```sql
-- Configuración requerida en base de datos
INSERT INTO ll_bot_config (cliente_id, bot_activo)
VALUES (51, 0)
ON DUPLICATE KEY UPDATE bot_activo = 0;

-- Verificación
SELECT cliente_id, bot_activo FROM ll_bot_config;
-- Debe mostrar: bot_activo = 0
```

### Logs Esperados (Operación Normal):

```
📨 Mensaje recibido de 5491112345678@c.us (cliente_id: 51)
✅ Mensaje registrado de 5491112345678@c.us (cliente: 51)
🔇 Bot en MODO SOLO ESCUCHA para cliente 51 - No se envía respuesta
```

### ⚠️ Advertencia para bot_activo = 1:

**NO activar bot_activo = 1 sin antes implementar:**

```javascript
// Solución requerida en massive-sender
// Archivo: /root/whatsapp-massive-sender/routes/whatsapp-listener.js
// Línea 115 (AGREGAR después de):

client.on('message', async (msg) => {
  // ⚡ AGREGAR ESTE FILTRO:
  if (msg.fromMe) {
    console.log(`📤 Mensaje propio ignorado: ${msg.body}`);
    return;
  }
  
  // Filtrar status broadcasts y newsletters
  if (msg.from === 'status@broadcast' || msg.from.includes('@newsletter')) {
```

**Sin este filtro:** Loop infinito garantizado con `bot_activo = 1`.

---

## RECOMENDACIONES INMEDIATAS

### Para Activación Inmediata (Modo Listener Pasivo):

```bash
# 1. Configurar base de datos
mysql -u iunaorg_b3toh -p -h sv46.byethost46.org iunaorg_dyd << 'EOF'
INSERT INTO ll_bot_config (cliente_id, bot_activo)
VALUES (51, 0)
ON DUPLICATE KEY UPDATE bot_activo = 0;
SELECT * FROM ll_bot_config;
EOF

# 2. Detener session-manager (evitar conflicto)
pm2 stop session-manager

# 3. Iniciar servicios
pm2 start /root/whatsapp-massive-sender/index.js --name massive-sender
sleep 30  # Esperar conexión WhatsApp
pm2 start /root/whatsapp-bot-responder/index.js --name bot-responder
pm2 save

# 4. Verificar logs
pm2 logs bot-responder --lines 20

# 5. Enviar mensaje de prueba al número WhatsApp conectado

# 6. Verificar BD
mysql -u iunaorg_b3toh -p -h sv46.byethost46.org iunaorg_dyd -e "
SELECT telefono, rol, mensaje, created_at
FROM ll_ia_conversaciones
WHERE cliente_id = 51
ORDER BY created_at DESC
LIMIT 5;"
```

### Para Activación Futura (Bot Activo con IA):

```bash
# ⚠️ ANTES de ejecutar, aplicar el parche:

# 1. Editar /root/whatsapp-massive-sender/routes/whatsapp-listener.js
# 2. Agregar filtro fromMe en línea 116 (después de client.on('message'))
# 3. Testing exhaustivo en entorno de desarrollo
# 4. Activar en producción:

mysql -u iunaorg_b3toh -p -h sv46.byethost46.org iunaorg_dyd -e "
UPDATE ll_bot_config SET bot_activo = 1 WHERE cliente_id = 51;"
```

---

## RUNBOOK — Activación Listener Pasivo (sin responder)

### Precondiciones

**Antes de proceder, confirmar:**

- [ ] **bot_activo = 0** para cliente_id 51 en base de datos
  ```bash
  mysql -u iunaorg_b3toh -p -h sv46.byethost46.org iunaorg_dyd \
    -e "SELECT cliente_id, bot_activo FROM ll_bot_config WHERE cliente_id = 51;"
  ```
  **Resultado esperado:** `bot_activo = 0`

- [ ] **NO se activará bot_activo = 1** durante esta jornada
  - Confirmar con equipo que NO hay planes de activar respuestas automáticas
  - Recordar: bot_activo=1 sin parche fromMe → loop infinito

- [ ] **session-manager será detenido** para evitar conflicto de sesión WhatsApp
  - Solo 1 servicio puede conectarse al mismo número WhatsApp
  - Verificar estado actual: `pm2 list | grep session-manager`

---

### Secuencia de Arranque

#### 1️⃣ Detener session-manager

```bash
pm2 stop session-manager
pm2 save
```

**Validación:**
```bash
pm2 list | grep session-manager
# Debe mostrar: status → stopped
```

---

#### 2️⃣ Iniciar massive-sender

```bash
cd /root/whatsapp-massive-sender
pm2 start index.js --name massive-sender
```

**Validación de conexión WhatsApp (esperar 30-60 segundos):**

```bash
pm2 logs massive-sender --lines 50
```

**Logs esperados:**
- `🚀 Creando cliente WhatsApp para Haby...`
- `✅ Cliente WhatsApp Haby listo`
- `🔗 WhatsApp conectado y listo`
- O bien: `📱 QR Code generado` (si requiere reautenticación)

**Si aparece QR:**
```bash
pm2 logs massive-sender --lines 5
# Copiar URL del QR y escanear con WhatsApp
# Esperar hasta ver: "✅ Cliente WhatsApp Haby listo"
```

---

#### 3️⃣ Iniciar bot-responder

```bash
cd /root/whatsapp-bot-responder
pm2 start index.js --name bot-responder
```

**Validación de registro como listener:**

```bash
pm2 logs bot-responder --lines 30
```

**Logs esperados:**
- `🚀 Servidor escuchando en puerto 3013`
- `📡 Intentando registrar listener con massive-sender...`
- `✅ Listener registrado exitosamente`

**Guardar configuración PM2:**
```bash
pm2 save
```

---

### Prueba Mínima

#### Enviar mensaje de prueba

**Acción:** Desde un teléfono móvil, enviar un mensaje al número WhatsApp conectado en massive-sender.

**Ejemplo:** `"Hola, soy una prueba"`

---

#### Validar logs de captura → webhook → persistencia

```bash
# Monitorear ambos servicios simultáneamente
pm2 logs --lines 20
```

**Logs esperados en massive-sender:**
```
📨 Mensaje recibido de 5491112345678@c.us: Hola, soy una prueba
```

**Logs esperados en bot-responder:**
```
📨 Mensaje recibido de 5491112345678@c.us: Hola, soy una prueba (cliente_id: 51)
✅ Mensaje registrado de 5491112345678 (cliente: 51)
🔇 Bot en MODO SOLO ESCUCHA para cliente 51 - No se envía respuesta
```

---

#### Validar inserción en base de datos

```bash
mysql -u iunaorg_b3toh -p -h sv46.byethost46.org iunaorg_dyd -e "
SELECT telefono, rol, mensaje, created_at
FROM ll_ia_conversaciones
WHERE cliente_id = 51
ORDER BY created_at DESC
LIMIT 3;"
```

**Resultado esperado:**
```
+------------------+---------+----------------------+---------------------+
| telefono         | rol     | mensaje              | created_at          |
+------------------+---------+----------------------+---------------------+
| 5491112345678    | usuario | Hola, soy una prueba | 2026-02-21 12:45:00 |
+------------------+---------+----------------------+---------------------+
```

**✅ Confirmaciones:**
- Registro existe
- `rol = 'usuario'` (no 'bot')
- Timestamp reciente

---

### Validaciones Negativas (Anti-Riesgo)

#### ✅ Confirmar que NO se envían respuestas automáticas

```bash
pm2 logs bot-responder --lines 50 | grep -i "respuesta enviada"
```

**Resultado esperado:** `Sin resultados` (exit code 1)

**Si aparecen logs de "respuesta enviada":**
```bash
# ⚠️ DETENER INMEDIATAMENTE
pm2 stop bot-responder massive-sender
# Verificar bot_activo en base de datos
```

---

#### ✅ Confirmar que NO hay loop infinito

**Monitorear logs durante 2-3 minutos sin enviar mensajes:**

```bash
pm2 logs --lines 0 --timestamp
# Observar si hay flujo continuo de mensajes sin intervención humana
```

**Resultado esperado:** **Silencio total** (solo logs de heartbeat/keepalive si existen)

**Si hay actividad continua:**
```bash
# ⚠️ LOOP DETECTADO - DETENER INMEDIATAMENTE
pm2 stop bot-responder massive-sender
```

---

#### ✅ Confirmar que bot_activo permanece en 0

```bash
mysql -u iunaorg_b3toh -p -h sv46.byethost46.org iunaorg_dyd \
  -e "SELECT cliente_id, bot_activo FROM ll_bot_config WHERE cliente_id = 51;"
```

**Resultado esperado:** `bot_activo = 0` (sin cambios)

---

### Rollback

**En caso de problemas:**

```bash
# 1. Detener servicios
pm2 stop massive-sender bot-responder
pm2 save

# 2. Revisar logs para diagnóstico
pm2 logs massive-sender --lines 100 > /tmp/massive-sender-error.log
pm2 logs bot-responder --lines 100 > /tmp/bot-responder-error.log

# 3. Rehabilitar session-manager (si fuera necesario)
pm2 start session-manager
pm2 save

# 4. Verificar estado final
pm2 list
```

**Causas comunes de rollback:**
- Conflicto de sesión WhatsApp (ambos servicios activos simultáneamente)
- bot_activo = 1 activado accidentalmente
- Respuestas automáticas siendo enviadas
- Loop infinito detectado

---

## Resultado Esperado (en una ejecución correcta)

### Logs durante operación normal:

```
[massive-sender] 📨 Mensaje recibido de 5491165432178@c.us: Hola, quiero info
[bot-responder] 📨 Mensaje recibido de 5491165432178@c.us: Hola, quiero info (cliente_id: 51)
[bot-responder] ✅ Mensaje registrado de 5491165432178 (cliente: 51)
[bot-responder] 🔇 Bot en MODO SOLO ESCUCHA para cliente 51 - No se envía respuesta
```

### Estado PM2:

```
┌────┬──────────────────┬─────────┬─────────┬──────────┐
│ id │ name             │ status  │ cpu     │ memory   │
├────┼──────────────────┼─────────┼─────────┼──────────┤
│ 15 │ massive-sender   │ online  │ 0.2%    │ 145.2mb  │
│ 16 │ bot-responder    │ online  │ 0.1%    │ 78.5mb   │
└────┴──────────────────┴─────────┴─────────┴──────────┘
```

### Consulta en base de datos:

```sql
SELECT COUNT(*) as mensajes_capturados, MAX(created_at) as ultimo_mensaje
FROM ll_ia_conversaciones
WHERE cliente_id = 51 AND rol = 'usuario';
```

**Resultado esperado:** Contador incremental con timestamp actualizado

---

**Fecha de emisión:** 2026-02-21 12:30 UTC  
**Próxima revisión:** Post-activación (verificar tras 1 hora de operación con mensaje real)  
**Responsable técnico:** Equipo LeadMaster / Alberto Hilal  

**Método de verificación:** Análisis línea por línea de código fuente + grep exhaustivo + verificación de flujo completo

---

**FIN DEL INFORME DE VERIFICACIÓN**
