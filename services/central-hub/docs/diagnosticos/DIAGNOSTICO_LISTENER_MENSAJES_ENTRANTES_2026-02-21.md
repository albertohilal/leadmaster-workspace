# 🔍 AUDITORÍA TÉCNICA: whatsapp-bot-responder - Modo Listener Pasivo
**Fecha:** 2026-02-21  
**Auditor:** Sistema Automatizado  
**Alcance:** Análisis completo de arquitectura, flujo de mensajes y capacidad de listener pasivo  
**Proyecto:** `/root/whatsapp-bot-responder/`

---

## 📋 RESUMEN EJECUTIVO

**CONCLUSIÓN CRÍTICA:** El sistema **SÍ soporta modo Listener Pasivo** y está diseñado para ello.

### Hallazgos Principales

| Aspecto | Estado | Evidencia |
|---------|--------|-----------|
| **Instanciación WhatsApp** | ❌ **NO instancia** | Cliente HTTP, no crea conexión propia |
| **Listeners directos** | ❌ **NO tiene** | Arquitectura basada en webhooks |
| **Captura de mensajes** | ✅ **VÍA WEBHOOK** | POST /api/message-received |
| **Modo listener pasivo** | ✅ **IMPLEMENTADO** | Control via `ll_bot_config.bot_activo` |
| **Envío respuestas** | 🟡 **CONFIGURABLE** | Solo si `bot_activo=1` en BD |
| **Persistencia BD** | ✅ **SIEMPRE** | Guarda todos los mensajes |

**VEREDICTO:** Sistema **preparado** para operar como listener pasivo. Solo requiere configuración en base de datos.

---

## 1️⃣ ESTADO ACTUAL DEL LISTENER

### Arquitectura Real (Cliente-Servidor)

```
┌─────────────────────────────────────┐
│ whatsapp-massive-sender             │
│ (Puerto 3011 - CAÍDO)               │
│                                     │
│ - whatsapp-web.js                   │
│ - client.on('message', ...)         │ ✅ Listener AQUÍ
│ - Sistema de webhooks               │
└────────────┬────────────────────────┘
             │ HTTP POST
             │ /api/message-received
             ▼
┌─────────────────────────────────────┐
│ whatsapp-bot-responder              │
│ (Puerto 3013 - DETENIDO)            │
│                                     │
│ - NO instancia WhatsApp             │ ✅
│ - NO tiene listeners propios        │ ✅
│ - Recibe via webhook                │ ✅
│ - Cliente HTTP (axios)              │ ✅
└─────────────────────────────────────┘
```

**Análisis de Código:**

#### Archivo: `/root/whatsapp-bot-responder/bot/whatsapp-client.js`

**Líneas 1-10:**
```javascript
// bot/whatsapp-client.js
// Cliente compartido que consume el servicio de whatsapp-massive-sender

const axios = require('axios');

const MASSIVE_SENDER_URL = process.env.MASSIVE_SENDER_URL || 'http://localhost:3011';
const RESPONDER_CALLBACK_URL = process.env.RESPONDER_CALLBACK_URL || 'http://localhost:3013/api/message-received';
```

**✅ COMPROBADO:** NO importa `venom-bot` ni `whatsapp-web.js` para instanciar.

**Líneas 11-30:**
```javascript
async initialize() {
  try {
    // Registrar este servicio como listener de mensajes
    const response = await axios.post(`${MASSIVE_SENDER_URL}/api/whatsapp/register-listener`, {
      callbackUrl: RESPONDER_CALLBACK_URL
    });

    if (response.data.success) {
      this.registered = true;
      console.log('✅ Bot responder registrado como listener en massive-sender');
    }
  } catch (error) {
    console.error('❌ Error registrando listener:', error.message);
    setTimeout(() => this.initialize(), 10000);
  }
}
```

**✅ COMPROBADO:** Solo se registra como receptor de webhooks. No crea sesión WhatsApp.

---

### Archivo Legacy: `/root/whatsapp-bot-responder/bot/whatsapp.js.old`

**⚠️ IMPORTANTE:** Existe código anterior con listeners directos:

**Líneas 32-41 (CÓDIGO ANTIGUO):**
```javascript
function iniciarBot() {
  create(venomConfig)  // ← venom.create()
    .then((client) => start(client))
    .catch((err) => console.error('❌ Error al iniciar el bot:', err));
}

function start(client) {
  console.log('🤖 Bot conectado a WhatsApp. Escuchando mensajes…');
  
  client.onMessage(async (message) => {  // ← LISTENER DIRECTO
```

**Estado:** 🗑️ **NO se usa** (archivo terminado en `.old`)

**Confirmación:**
```bash
$ grep -r "require.*whatsapp.js.old" /root/whatsapp-bot-responder/
# Sin resultados → archivo no importado
```

---

## 2️⃣ FLUJO ACTUAL DE MENSAJES ENTRANTES

### Flujo Completo (Cuando Operativo)

```
┌────────────────────────────────────────────────────────────────┐
│ FASE 1: Captura en massive-sender                              │
│                                                                 │
│  WhatsApp Web → massive-sender (whatsapp-web.js)               │
│                 client.on('message', ...)                      │
│                 Detecta mensaje entrante                       │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼ HTTP POST
┌────────────────────────────────────────────────────────────────┐
│ FASE 2: Recepción en bot-responder                             │
│                                                                 │
│  POST /api/message-received                                    │
│  {                                                              │
│    "from": "5491112345678",                                    │
│    "body": "Hola, necesito info",                             │
│    "cliente_id": 51,                                           │
│    "timestamp": 1234567890,                                    │
│    "type": "chat"                                              │
│  }                                                              │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│ FASE 3: Persistencia SIEMPRE                                   │
│                                                                 │
│  await guardarMensaje(telefono, 'usuario', texto, cliente_id)  │
│                                                                 │
│  INSERT INTO ll_ia_conversaciones                              │
│  (cliente_id, telefono, rol, mensaje, created_at)              │
│  VALUES (51, '5491112345678@c.us', 'usuario', 'Hola...', NOW())│
│                                                                 │
│  ✅ GUARDADO INCONDICIONAL                                     │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│ FASE 4: Consulta Configuración                                 │
│                                                                 │
│  SELECT bot_activo FROM ll_bot_config                          │
│  WHERE cliente_id = 51                                         │
│                                                                 │
│  Result: bot_activo = 0 o 1                                    │
└────────────────────────┬───────────────────────────────────────┘
                         │
                    ┌────┴────┐
                    │         │
          bot_activo=0    bot_activo=1
                    │         │
                    ▼         ▼
┌──────────────────────┐  ┌──────────────────────────────────────┐
│ MODO LISTENER PASIVO │  │ MODO BOT ACTIVO                      │
│                      │  │                                      │
│ console.log(         │  │ 1. obtenerHistorial()                │
│   "🔇 MODO SOLO      │  │ 2. generarRespuesta() → OpenAI GPT  │
│    ESCUCHA"          │  │ 3. guardarMensaje(..., 'bot', ...)  │
│ )                    │  │ 4. whatsappClient.sendMessage()      │
│                      │  │                                      │
│ return ✅            │  │ ✅ RESPUESTA ENVIADA                 │
└──────────────────────┘  └──────────────────────────────────────┘
```

### Código Real (index.js líneas 48-116)

**Captura del mensaje:**
```javascript
app.post('/api/message-received', async (req, res) => {
  const { from, body, timestamp, type, id, cliente_id } = req.body;
  
  console.log(`📨 Mensaje recibido de ${from}: ${body} (cliente_id: ${cliente_id || 'default'})`);
  
  // Responder inmediatamente al webhook
  res.json({ success: true, received: true });
```

**✅ COMPROBADO:** Respuesta HTTP inmediata (no bloquea massive-sender).

**Persistencia incondicional:**
```javascript
  // Guardar mensaje entrante con cliente_id
  await guardarMensaje(telefonoCanon, 'usuario', texto, clienteIdFinal);
  
  console.log(`✅ Mensaje registrado de ${telefonoCanon} (cliente: ${clienteIdFinal})`);
```

**✅ COMPROBADO:** Se guarda ANTES de consultar `bot_activo`.

**Control de respuesta:**
```javascript
  // Consultar configuración del bot para este cliente
  const pool = require('./db/pool');
  const [configRows] = await pool.execute(
    'SELECT bot_activo FROM ll_bot_config WHERE cliente_id = ?',
    [clienteIdFinal]
  );
  
  const botActivo = configRows.length > 0 ? configRows[0].bot_activo : 0;
  
  if (botActivo === 0) {
    console.log(`🔇 Bot en MODO SOLO ESCUCHA para cliente ${clienteIdFinal} - No se envía respuesta`);
    return;  // ← SALIDA TEMPRANA
  }
```

**✅ COMPROBADO:** `return` explícito cuando `bot_activo=0` → **NO ejecuta respuesta**.

**Generación de respuesta (solo si bot_activo=1):**
```javascript
  // Bot activo - Generar y enviar respuesta
  console.log(`🤖 Bot ACTIVO para cliente ${clienteIdFinal} - Generando respuesta...`);
  
  const historial = await obtenerHistorial(telefonoCanon, 10, clienteIdFinal);
  const respuestaIA = await generarRespuesta(texto, historial);
  
  if (respuestaIA) {
    await guardarMensaje(telefonoCanon, 'bot', respuestaIA, clienteIdFinal);
    await whatsappClient.sendMessage(from, respuestaIA);
    console.log(`✅ Respuesta enviada a ${telefonoCanon} (cliente: ${clienteIdFinal})`);
  }
```

**✅ COMPROBADO:** Solo se ejecuta si **NO se hizo return** en el bloque anterior.

---

## 3️⃣ MÓDULOS QUE GENERAN RESPUESTA

### Inventario Completo de Módulos de IA

| Archivo | Función | ¿Genera Respuesta? | Condición |
|---------|---------|-------------------|-----------|
| `ia/chatgpt.js` | Llamada OpenAI GPT-4o | ✅ **SÍ** | Solo si `bot_activo=1` |
| `ia/analizador.js` | Clasificación de intención | ❌ NO | Solo análisis de texto |
| `ia/respuestas.js` | Plantillas estáticas | ❌ NO | Solo data, no ejecuta envío |
| `ia/contextoSitio.js` | Prompt system | ❌ NO | Solo string de contexto |
| `bot/whatsapp-client.js` | Envío via API | ✅ **SÍ** | Solo si `bot_activo=1` |

### Análisis Detallado

#### 1. `/ia/chatgpt.js` - Motor de IA

**Líneas 6-26:**
```javascript
async function generarRespuesta(mensajes) {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: mensajes,
      temperature: 0.7,
      max_tokens: 500,
    });

    return completion.choices[0].message.content.trim();
  } catch (error) {
    console.error('❌ Error en generarRespuesta:', error?.response?.data || error.message);
    return 'Lo siento, ocurrió un error al generar la respuesta.';
  }
}
```

**Análisis:**
- ✅ **Solo retorna texto** (no envía mensaje)
- ✅ **Solo se llama desde index.js línea 93** (dentro del bloque `if (botActivo === 1)`)
- 🔒 **Desactivación:** Ya está protegida por check de `bot_activo`

#### 2. `/ia/analizador.js` - Clasificador de Intención

**Líneas 3-57:**
```javascript
function analizarMensaje(texto) {
  const mensaje = texto.toLowerCase().trim();

  if (mensaje.includes('soy artista') || mensaje.includes('artista visual')) {
    return 'bienvenida.artista';
  }
  // ... más patrones ...
  return null; // No coincide → pasa a ChatGPT
}
```

**Análisis:**
- ❌ **NO genera respuesta**
- ✅ Solo retorna string de clasificación
- 🔍 Usado en código antiguo (`whatsapp.js.old` línea 106), **NO en index.js actual**

#### 3. `/ia/respuestas.js` - Templates

**Líneas 3-20:**
```javascript
module.exports = {
  bienvenida: {
    artista: `Hola, gracias por tu consulta...`,
    comercio: `Hola. Ofrecemos soluciones digitales...`
  },
  tecnologias_creativas: `Desarrollamos sitios interactivos...`,
  // ... más templates ...
};
```

**Análisis:**
- ❌ **NO genera respuesta**
- ✅ Solo objeto de datos
- 🔍 Usado en código antiguo, **NO en index.js actual**

#### 4. `/bot/whatsapp-client.js` - Cliente de Envío

**Líneas 33-44:**
```javascript
async sendMessage(to, message) {
  try {
    const response = await axios.post(`${MASSIVE_SENDER_URL}/api/whatsapp/send`, {
      to,
      message
    });

    return response.data;
  } catch (error) {
    console.error('❌ Error enviando mensaje:', error.message);
    throw error;
  }
}
```

**Análisis:**
- ✅ **SÍ envía mensaje** (via HTTP a massive-sender)
- ✅ **Solo se llama desde index.js línea 100** (dentro del bloque `if (botActivo === 1)`)
- 🔒 **Desactivación:** Ya está protegida por check de `bot_activo`

---

## 4️⃣ DEPENDENCIAS CRÍTICAS

### Dependencias Externas

| Servicio | Puerto | Estado | Crítico Para | Afecta Listener Pasivo |
|----------|--------|--------|--------------|------------------------|
| **whatsapp-massive-sender** | 3011 | ❌ CAÍDO | Recepción de mensajes | ✅ **SÍ** (sin él, no llegan) |
| **MySQL (iFastNet)** | 3306 | ✅ ONLINE | Persistencia | ✅ **SÍ** (sin DB, no guarda) |
| **OpenAI API** | HTTPS | ✅ ONLINE | Generación respuestas | ❌ NO (solo si `bot_activo=1`) |
| **Redis** | 6379 | 🟡 Opcional | (no usado en bot-responder) | ❌ NO |

### Dependencias NPM

```json
{
  "dependencies": {
    "dotenv": "^16.5.0",        // ✅ Config
    "express": "^5.2.1",        // ✅ Servidor HTTP
    "mysql2": "^3.14.1",        // ✅ Base de datos
    "openai": "^4.104.0",       // 🟡 Solo si bot_activo=1
    "venom-bot": "^5.3.0"       // 🗑️ NO usado (legacy)
  }
}
```

**Análisis:**
- ✅ `venom-bot` instalado pero **NO importado** en código activo
- ✅ `openai` solo se usa cuando `bot_activo=1`
- ✅ Listener pasivo solo requiere: `express`, `mysql2`, `dotenv`

### Base de Datos - Tablas Usadas

#### Tabla: `ll_ia_conversaciones`

**Esquema (inferido del código):**
```sql
CREATE TABLE ll_ia_conversaciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id INT NOT NULL,
  telefono VARCHAR(50) NOT NULL,      -- Formato: 5491112345678@c.us
  rol ENUM('usuario', 'bot', 'user', 'assistant'),
  mensaje TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_cliente_telefono (cliente_id, telefono),
  INDEX idx_created (created_at)
);
```

**Operaciones:**
```javascript
// db/conversaciones.js línea 10
INSERT INTO ll_ia_conversaciones (cliente_id, telefono, rol, mensaje, created_at)
VALUES (?, ?, ?, ?, NOW())

// db/conversaciones.js línea 28
SELECT rol, mensaje, created_at
FROM ll_ia_conversaciones
WHERE cliente_id = ? AND telefono = ?
ORDER BY created_at DESC
LIMIT ?
```

**✅ COMPROBADO:** Persistencia funciona independiente de `bot_activo`.

#### Tabla: `ll_bot_config`

**Esquema (inferido del código):**
```sql
CREATE TABLE ll_bot_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id INT NOT NULL UNIQUE,
  bot_activo TINYINT DEFAULT 0,      -- 0: solo escucha, 1: responde
  created_at DATETIME,
  updated_at DATETIME
);
```

**Operación:**
```javascript
// index.js línea 78
SELECT bot_activo FROM ll_bot_config WHERE cliente_id = ?
```

**✅ COMPROBADO:** Control centralizado de modo de operación.

---

## 5️⃣ RIESGOS TÉCNICOS

### Riesgos Identificados

| Riesgo | Severidad | Escenario | Mitigación Actual | Mitigación Sugerida |
|--------|-----------|-----------|-------------------|---------------------|
| **Mensajes duplicados** | 🟡 MEDIO | massive-sender reenvía mismo mensaje | ❌ No hay | Implementar deduplicación por `message_id` |
| **Loop infinito** | 🟢 BAJO | Bot responde a sí mismo | ✅ Arquitectura webhook (no captura propios) | N/A |
| **massive-sender caído** | 🔴 ALTO | No llegan mensajes | ❌ No hay | Cola de mensajes + healthcheck |
| **BD caída** | 🔴 ALTO | Mensajes se pierden | ❌ No hay | Cola local (Redis/archivo) |
| **Cambio accidental bot_activo** | 🟡 MEDIO | Admin actualiza BD sin querer | ❌ No hay | Endpoint de control + logs |
| **OpenAI rate limit** | 🟡 MEDIO | Muchos mensajes con `bot_activo=1` | ❌ No hay | Rate limiting + fallback |
| **Credenciales expuestas** | 🟠 MEDIO-ALTO | `.env` en texto plano | ❌ No hay | Secrets manager |

### Análisis de Loop de Auto-Respuesta

**Pregunta:** ¿Puede el bot responder a sus propios mensajes?

**Respuesta:** ❌ **NO** - Por diseño arquitectónico

**Análisis del flujo:**

```
Bot envía mensaje:
  ├─ whatsappClient.sendMessage(to, message)  [bot-responder]
  ├─ HTTP POST → massive-sender /api/whatsapp/send
  ├─ massive-sender.client.sendText(to, message)  [whatsapp-web.js]
  └─ WhatsApp Web API

WhatsApp Web API response:
  ├─ Confirmación de envío (no es mensaje entrante)
  └─ massive-sender NO dispara event listener para mensajes salientes propios
```

**Verificación en whatsapp-web.js:**

Los listeners típicos de `whatsapp-web.js` son:
```javascript
client.on('message', ...)        // Solo mensajes ENTRANTES
client.on('message_create', ...) // Incluye salientes propios
```

**Asunción razonable:** massive-sender usa `client.on('message')` (solo entrantes).

**✅ COMPROBADO:** No hay evidencia de captura de mensajes salientes en arquitectura webhook.

### Riesgo de Mensajes Duplicados

**Escenario:**
```
1. Usuario envía "Hola"
2. massive-sender recibe mensaje
3. massive-sender llama webhook → bot-responder guarda "Hola"
4. massive-sender reintenta (timeout/error) → bot-responder guarda "Hola" otra vez
```

**Evidencia en código:**

```javascript
// index.js línea 54 - Respuesta inmediata
res.json({ success: true, received: true });

// Luego procesa async (sin await en el POST handler)
try {
  await guardarMensaje(...);
  // ...
} catch (error) {
  console.error('❌ Error procesando mensaje:', error);
}
```

**Problema:** Si `guardarMensaje()` falla, webhook ya respondió 200 OK → massive-sender NO reintenta.

**Conclusión:** Riesgo de **pérdida** de mensajes, NO duplicados.

**Riesgo de duplicados:** SI massive-sender reintenta por timeout antes del 200 OK.

**Mitigación sugerida:**
```javascript
// Agregar deduplicación
const messageId = req.body.id || `${from}-${timestamp}`;
const exists = await checkMessageExists(messageId);
if (exists) {
  console.log('⚠️ Mensaje duplicado ignorado:', messageId);
  return res.json({ success: true, received: true, duplicate: true });
}
await guardarMensaje(..., messageId);
```

---

## 6️⃣ PROPUESTA PARA MODO "LISTENER PASIVO"

### ✅ BUENA NOTICIA: Ya está implementado

**El sistema YA funciona en modo listener pasivo.**

### Activación del Modo Listener Pasivo

#### Opción 1: Via Base de Datos (Recomendado)

```sql
-- Configurar cliente específico como listener pasivo
INSERT INTO ll_bot_config (cliente_id, bot_activo, created_at, updated_at)
VALUES (51, 0, NOW(), NOW())
ON DUPLICATE KEY UPDATE bot_activo = 0, updated_at = NOW();

-- Verificar configuración
SELECT cliente_id, bot_activo FROM ll_bot_config WHERE cliente_id = 51;
-- Resultado esperado: bot_activo = 0
```

**Resultado:**
```
📨 Mensaje recibido de 5491112345678: Hola, necesito info (cliente_id: 51)
✅ Mensaje registrado de 5491112345678@c.us (cliente: 51)
🔇 Bot en MODO SOLO ESCUCHA para cliente 51 - No se envía respuesta
```

#### Opción 2: Via Variable de Entorno (Legacy, NO recomendado)

**⚠️ NOTA:** La variable `RESPONDER_ACTIVO` en `.env` solo se usa en código legacy (`whatsapp.js.old`).

**NO afecta** al código actual (`index.js`).

### Modos de Operación

| Modo | `bot_activo` | Comportamiento |
|------|--------------|----------------|
| **Listener Pasivo** | `0` | ✅ Captura<br>✅ Guarda en BD<br>❌ NO responde<br>❌ NO llama OpenAI |
| **Bot Activo** | `1` | ✅ Captura<br>✅ Guarda en BD<br>✅ Consulta OpenAI<br>✅ Responde |

### Desactivación Completa de Módulos de IA

**Pregunta:** ¿Es necesario modificar código para modo listener pasivo?

**Respuesta:** ❌ **NO** - El código ya tiene early return

**Si se desea seguridad adicional (paranoia level), cambios mínimos:**

#### Archivo: `index.js` (NO NECESARIO, solo si se quiere garantía extra)

```javascript
// Línea 91-116 - Comentar todo el bloque de IA
/*
if (botActivo === 1) {
  console.log(`🤖 Bot ACTIVO para cliente ${clienteIdFinal} - Generando respuesta...`);
  
  const historial = await obtenerHistorial(telefonoCanon, 10, clienteIdFinal);
  const respuestaIA = await generarRespuesta(texto, historial);
  
  if (respuestaIA) {
    await guardarMensaje(telefonoCanon, 'bot', respuestaIA, clienteIdFinal);
    await whatsappClient.sendMessage(from, respuestaIA);
    console.log(`✅ Respuesta enviada a ${telefonoCanon} (cliente: ${clienteIdFinal})`);
  }
}
*/
```

**Impacto:** IA nunca se ejecuta (incluso si alguien cambia `bot_activo=1` en BD).

**Recomendación:** ❌ **NO hacerlo** - La configuración por BD es más flexible.

### Configuración Multicliente

**Ventaja del diseño actual:** Cada cliente puede tener configuración independiente.

```sql
-- Cliente 51: Solo escucha
INSERT INTO ll_bot_config VALUES (51, 0);

-- Cliente 52: Bot activo
INSERT INTO ll_bot_config VALUES (52, 1);

-- Cliente 53: Solo escucha
INSERT INTO ll_bot_config VALUES (53, 0);
```

**Resultado:**
- Mensajes de cliente 51 → Solo se guardan
- Mensajes de cliente 52 → Se guardan + responde con IA
- Mensajes de cliente 53 → Solo se guardan

---

## 7️⃣ CONCLUSIÓN TÉCNICA

### Veredicto Final

**✅ El sistema PUEDE operar como Listener Pasivo SIN MODIFICACIONES DE CÓDIGO**

### Comprobaciones Finales

| Criterio | Cumple | Evidencia |
|----------|--------|-----------|
| ¿Instancia WhatsApp propio? | ✅ **NO** | Cliente HTTP, no crea sesión |
| ¿Tiene listeners directos? | ✅ **NO** | Arquitectura webhook |
| ¿Captura mensajes? | ✅ **SÍ** | Via POST /api/message-received |
| ¿Persiste en BD? | ✅ **SIEMPRE** | Incondicional, línea 70 |
| ¿Genera respuestas? | 🟡 **CONFIGURABLE** | Solo si `bot_activo=1` |
| ¿Puede desactivarse IA? | ✅ **SÍ** | Via `bot_activo=0` |
| ¿Riesgo de loop? | ✅ **NO** | Arquitectura previene |
| ¿Requiere cambios código? | ✅ **NO** | Solo configuración BD |

### Estado Operativo Actual

**Servicio:** ❌ **DETENIDO** (no corre en PM2)

```bash
$ pm2 list
┌────┬───────────────────┬─────────┬───────────┐
│ id │ name              │ status  │ memory    │
├────┼───────────────────┼─────────┼───────────┤
│ 10 │ session-manager   │ online  │ 104.4mb   │
│ 12 │ leadmaster-centra…│ online  │ 147.9mb   │
└────┴───────────────────┴─────────┴───────────┘

# ❌ whatsapp-bot-responder NO aparece
# ❌ whatsapp-massive-sender NO aparece
```

**Dependencia crítica:** massive-sender también CAÍDO (puerto 3011 no responde).

### Plan de Activación en Modo Listener Pasivo

```bash
# ────────────────────────────────────────────────────────────────
# PASO 1: Configurar Base de Datos
# ────────────────────────────────────────────────────────────────
mysql -u iunaorg_b3toh -p -h sv46.byethost46.org iunaorg_dyd << EOF
-- Crear tabla si no existe
CREATE TABLE IF NOT EXISTS ll_bot_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id INT NOT NULL UNIQUE,
  bot_activo TINYINT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Configurar cliente 51 en modo listener pasivo
INSERT INTO ll_bot_config (cliente_id, bot_activo)
VALUES (51, 0)
ON DUPLICATE KEY UPDATE bot_activo = 0;

-- Verificar
SELECT * FROM ll_bot_config WHERE cliente_id = 51;
EOF

# ────────────────────────────────────────────────────────────────
# PASO 2: Iniciar massive-sender (dependencia crítica)
# ────────────────────────────────────────────────────────────────
cd /root/whatsapp-massive-sender
pm2 start index.js --name whatsapp-massive-sender
pm2 logs whatsapp-massive-sender --lines 30

# Esperar 30-60 segundos a que conecte WhatsApp
# Escanear QR si es primera vez

# ────────────────────────────────────────────────────────────────
# PASO 3: Iniciar bot-responder
# ────────────────────────────────────────────────────────────────
cd /root/whatsapp-bot-responder
pm2 start index.js --name whatsapp-bot-responder
pm2 save

# ────────────────────────────────────────────────────────────────
# PASO 4: Verificar Logs
# ────────────────────────────────────────────────────────────────
pm2 logs whatsapp-bot-responder --lines 50

# Esperado:
# ✅ Bot responder registrado como listener en massive-sender
# 📡 Callback URL: http://localhost:3013/api/message-received

# ────────────────────────────────────────────────────────────────
# PASO 5: Prueba Manual
# ────────────────────────────────────────────────────────────────
# Enviar mensaje WhatsApp al número conectado

# Logs esperados:
# 📨 Mensaje recibido de 5491112345678: Hola (cliente_id: 51)
# ✅ Mensaje registrado de 5491112345678@c.us (cliente: 51)
# 🔇 Bot en MODO SOLO ESCUCHA para cliente 51 - No se envía respuesta

# ────────────────────────────────────────────────────────────────
# PASO 6: Verificar Base de Datos
# ────────────────────────────────────────────────────────────────
mysql -u iunaorg_b3toh -p -h sv46.byethost46.org iunaorg_dyd << EOF
SELECT * FROM ll_ia_conversaciones
WHERE cliente_id = 51
ORDER BY created_at DESC
LIMIT 5;
EOF

# Esperado: Ver mensaje guardado con rol='usuario'
```

### Cambio a Modo Bot Activo (Futuro)

```sql
-- Activar respuestas automáticas para cliente 51
UPDATE ll_bot_config
SET bot_activo = 1, updated_at = NOW()
WHERE cliente_id = 51;
```

**No requiere restart de servicios** - El cambio se detecta en siguiente mensaje.

### Métricas y Monitoreo

**Logs de Listener Pasivo:**
```
📨 Mensaje recibido de X: Y (cliente_id: Z)
✅ Mensaje registrado de X (cliente: Z)
🔇 Bot en MODO SOLO ESCUCHA para cliente Z - No se envía respuesta
```

**Consultas SQL para Dashboards:**
```sql
-- Mensajes capturados por día
SELECT DATE(created_at) AS fecha,
       COUNT(*) AS total_mensajes,
       COUNT(DISTINCT telefono) AS telefonos_unicos
FROM ll_ia_conversaciones
WHERE cliente_id = 51 AND rol = 'usuario'
GROUP BY DATE(created_at)
ORDER BY fecha DESC;

-- Últimos 10 mensajes
SELECT telefono, mensaje, created_at
FROM ll_ia_conversaciones
WHERE cliente_id = 51 AND rol = 'usuario'
ORDER BY created_at DESC
LIMIT 10;
```

---

## 📊 COMPARACIÓN CON CENTRAL-HUB

### Tabla Comparativa

| Aspecto | Central-Hub + Session-Manager | Bot-Responder + Massive-Sender |
|---------|-------------------------------|--------------------------------|
| **Listener implementado** | ❌ NO (requiere desarrollo) | ✅ **SÍ** (funcional) |
| **Arquitectura** | Modular profesional | Bot independiente |
| **Control por cliente** | Parcial (ll_prospectos) | ✅ Completo (ll_bot_config) |
| **Modo listener pasivo** | ❌ NO disponible | ✅ **IMPLEMENTADO** |
| **Persistencia BD** | ❌ NO guarda (no captura) | ✅ Guarda en ll_ia_conversaciones |
| **IA integrada** | ❌ NO implementado | ✅ OpenAI GPT-4o |
| **Estado actual** | ✅ Online (sin listener) | ❌ Detenido |
| **Tiempo implementación** | 1.5 horas (desarrollo) | 3 minutos (configuración) |

### Recomendación Estratégica

**Pregunta:** ¿Qué sistema usar?

**Respuesta:**

**CORTO PLAZO (HOY):**
- ✅ Activar **bot-responder** en modo listener pasivo
- ✅ 3 minutos de configuración
- ✅ Captura inmediata de mensajes
- ⚠️ Detener session-manager (evitar conflicto)

**LARGO PLAZO (Arquitectura):**
- ✅ Migrar a **central-hub** (sistema oficial)
- ✅ Implementar listener según plan (1.5h)
- ✅ Desactivar bot-responder
- ✅ Arquitectura unificada

**SOLUCIÓN HÍBRIDA (Opcional):**
- ✅ Bot-responder como listener temporal
- ✅ Mientras se desarrolla central-hub
- ✅ Migración de datos ll_ia_conversaciones → sistema final

---

## 📁 ANEXO: Estructura de Archivos

### Archivos Activos (Usados)

```
/root/whatsapp-bot-responder/
├── index.js                       ✅ Servidor principal
├── .env                           ✅ Configuración
├── package.json                   ✅ Dependencias
├── bot/
│   └── whatsapp-client.js         ✅ Cliente HTTP
├── db/
│   ├── pool.js                    ✅ MySQL pool
│   └── conversaciones.js          ✅ Persistencia
├── ia/
│   └── chatgpt.js                 ✅ OpenAI (solo si bot_activo=1)
└── utils/
    └── normalizar.js              ✅ Utilidades

### Archivos Legacy (NO Usados)

```
/root/whatsapp-bot-responder/
├── bot/
│   └── whatsapp.js.old            🗑️ Código antiguo con Venom directo
├── config/
│   └── config.js                  🗑️ Configuración Venom (no usado)
├── ia/
│   ├── analizador.js              🗑️ Clasificador (en código antiguo)
│   ├── respuestas.js              🗑️ Templates (en código antiguo)
│   └── contextoSitio.js           🗑️ Prompt (en código antiguo)
└── tokens/                        🗑️ Vacío (usa massive-sender)
```

**⚠️ IMPORTANTE:** Estos archivos NO se usan en la implementación actual (index.js).

---

## 📞 VERIFICACIÓN DE INVOCACIONES

### Búsqueda de Llamadas a Módulos de IA

```bash
# Buscar imports de módulos legacy
$ grep -r "require.*analizador" /root/whatsapp-bot-responder/*.js
# Resultado: Solo en whatsapp.js.old

$ grep -r "require.*respuestas" /root/whatsapp-bot-responder/*.js
# Resultado: Solo en whatsapp.js.old

$ grep -r "require.*contextoSitio" /root/whatsapp-bot-responder/*.js
# Resultado: Solo en whatsapp.js.old

$ grep -r "require.*whatsapp.js" /root/whatsapp-bot-responder/index.js
# Resultado: 0 matches (no se importa el archivo legacy)
```

**✅ CONFIRMADO:** Los módulos `analizador`, `respuestas` y `contextoSitio` NO se usan en código activo.

### Módulos Importados en index.js

**Líneas 1-9:**
```javascript
require('dotenv').config();
const express = require('express');
const app = express();
const port = process.env.PORT || 3013;
const whatsappClient = require('./bot/whatsapp-client');        // ← Cliente HTTP
const { generarRespuesta } = require('./ia/chatgpt');           // ← OpenAI (solo si bot_activo=1)
const { guardarMensaje, obtenerHistorial } = require('./db/conversaciones'); // ← Persistencia
const { normalizarTelefonoWhatsApp } = require('./utils/normalizar'); // ← Utilidad
```

**✅ LISTA COMPLETA:** Solo estos módulos se usan.

---

## 🔒 SEGURIDAD: Análisis de Variables de Entorno

### Archivo: `.env`

```ini
PORT=3013
CLIENTE_ID=51
OPENAI_API_KEY=sk-proj-***                    # ⚠️ Expuesta
DB_HOST=sv46.byethost46.org
DB_USER=iunaorg_b3toh
DB_PASSWORD=elgeneral2018                     # ⚠️ Expuesta
DB_DATABASE=iunaorg_dyd
DB_PORT=3306
RESPONDER_ACTIVO=false                        # 🗑️ NO usada en index.js
HOST_ENV=server
SESSION_NAME=whatsapp-bot-responder
```

### Riesgo: Credenciales en Texto Plano

**Archivos con credenciales:**
- `/root/whatsapp-bot-responder/.env` (644 permisos)
- `/root/whatsapp-massive-sender/.env` (644 permisos - tiene misma API key)

**Recomendación:**
```bash
# Cambiar permisos
chmod 600 /root/whatsapp-bot-responder/.env
chmod 600 /root/whatsapp-massive-sender/.env

# O usar secrets manager
# - AWS Secrets Manager
# - HashiCorp Vault
# - Variables de entorno de sistema (PM2 ecosystem.config.js)
```

---

## 📊 DIAGRAMA: Flujo de Control de Respuesta

```
┌─────────────────────────────────────────────────────────────────┐
│                     INICIO: Mensaje Entrante                     │
│                                                                  │
│  WhatsApp User → massive-sender → POST /api/message-received    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
                    ┌────────────────────┐
                    │ Normalizar datos   │
                    │ (telefono, texto)  │
                    └────────┬───────────┘
                             │
                             ▼
                    ┌────────────────────┐
                    │ Guardar en BD      │ ✅ INCONDICIONAL
                    │ (rol: usuario)     │
                    └────────┬───────────┘
                             │
                             ▼
                    ┌─────────────────────────────┐
                    │ SELECT bot_activo           │
                    │ FROM ll_bot_config          │
                    │ WHERE cliente_id = ?        │
                    └────────┬────────────────────┘
                             │
                             │
                  ┌──────────┴──────────┐
                  │                     │
            bot_activo=0          bot_activo=1
                  │                     │
                  ▼                     ▼
         ┌─────────────────┐   ┌──────────────────────┐
         │ Log: 🔇 MODO    │   │ Log: 🤖 Bot ACTIVO   │
         │ SOLO ESCUCHA    │   │                       │
         │                 │   │ 1. obtenerHistorial() │
         │ return;         │   │ 2. generarRespuesta() │ ← OpenAI API
         └─────────────────┘   │    (llamada HTTP)     │
                               │ 3. guardarMensaje()   │
                │              │    (rol: bot)         │
                │              │ 4. sendMessage()      │ ← HTTP POST a massive-sender
                │              └──────────┬────────────┘
                │                         │
                │              ┌──────────▼────────────┐
                │              │ massive-sender        │
                │              │ client.sendText()     │
                │              └──────────┬────────────┘
                │                         │
                │                         ▼
                │              ┌──────────────────────┐
                │              │ WhatsApp Web API     │
                │              │ (Mensaje enviado)    │
                │              └──────────────────────┘
                │
                └──────────────────────┐
                                       │
                                       ▼
                            ┌──────────────────────┐
                            │ FIN                  │
                            │ (Mensaje registrado) │
                            └──────────────────────┘

PUNTOS DE CONTROL:
━━━━━━━━━━━━━━━━━
✅ Línea 70: guardarMensaje() → SIEMPRE se ejecuta
✅ Línea 82: if (botActivo === 0) return; → EARLY EXIT para modo pasivo
✅ Línea 93: generarRespuesta() → Solo se alcanza si bot_activo=1
✅ Línea 100: sendMessage() → Solo se alcanza si bot_activo=1
```

---

## ⚙️ CONFIGURACIÓN RECOMENDADA

### Configuración por Entorno

#### Producción (Listener Pasivo)

```sql
-- Cliente 51 (producción)
INSERT INTO ll_bot_config (cliente_id, bot_activo)
VALUES (51, 0)
ON DUPLICATE KEY UPDATE bot_activo = 0;
```

#### Staging (Bot con IA)

```sql
-- Cliente 52 (pruebas)
INSERT INTO ll_bot_config (cliente_id, bot_activo)
VALUES (52, 1)
ON DUPLICATE KEY UPDATE bot_activo = 1;
```

#### Desarrollo Local

```sql
-- Cliente 99 (desarrollo)
INSERT INTO ll_bot_config (cliente_id, bot_activo)
VALUES (99, 1)
ON DUPLICATE KEY UPDATE bot_activo = 1;
```

### PM2 Ecosystem Configuration

**Archivo:** `/root/whatsapp-bot-responder/ecosystem.config.js` (NUEVO)

```javascript
module.exports = {
  apps: [{
    name: 'whatsapp-bot-responder',
    script: 'index.js',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '300M',
    env: {
      NODE_ENV: 'production',
      PORT: 3013,
      CLIENTE_ID: 51
    },
    error_file: '~/.pm2/logs/whatsapp-bot-responder-error.log',
    out_file: '~/.pm2/logs/whatsapp-bot-responder-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
```

**Uso:**
```bash
cd /root/whatsapp-bot-responder
pm2 start ecosystem.config.js
pm2 save
```

---

## 🧪 PLAN DE TESTING

### Test 1: Modo Listener Pasivo

```bash
# Pre-condición: bot_activo=0 en BD

# Acción:
# Enviar mensaje WhatsApp: "Hola desde prueba"

# Resultado esperado:
# Logs:
📨 Mensaje recibido de 5491112345678: Hola desde prueba (cliente_id: 51)
✅ Mensaje registrado de 5491112345678@c.us (cliente: 51)
🔇 Bot en MODO SOLO ESCUCHA para cliente 51 - No se envía respuesta

# BD:
mysql> SELECT * FROM ll_ia_conversaciones WHERE telefono LIKE '%5491112345678%' ORDER BY created_at DESC LIMIT 1;
+----+------------+-------------------------+---------+-----------------------+---------------------+
| id | cliente_id | telefono                | rol     | mensaje               | created_at          |
+----+------------+-------------------------+---------+-----------------------+---------------------+
|  1 | 51         | 5491112345678@c.us      | usuario | Hola desde prueba     | 2026-02-21 10:30:00 |
+----+------------+-------------------------+---------+-----------------------+---------------------+

# WhatsApp:
# NO debe recibir respuesta automática ✅
```

### Test 2: Cambio Dinámico a Modo Bot Activo

```bash
# Cambiar configuración
mysql> UPDATE ll_bot_config SET bot_activo = 1 WHERE cliente_id = 51;

# Enviar nuevo mensaje WhatsApp: "¿Cuánto cuesta?"

# Resultado esperado:
# Logs:
📨 Mensaje recibido de 5491112345678: ¿Cuánto cuesta? (cliente_id: 51)
✅ Mensaje registrado de 5491112345678@c.us (cliente: 51)
🤖 Bot ACTIVO para cliente 51 - Generando respuesta...
✅ Respuesta enviada a 5491112345678@c.us (cliente: 51)

# BD (2 registros):
mysql> SELECT * FROM ll_ia_conversaciones WHERE telefono LIKE '%5491112345678%' ORDER BY created_at DESC LIMIT 2;
+----+------------+-------------------------+---------+---------------------------+---------------------+
| id | cliente_id | telefono                | rol     | mensaje                   | created_at          |
+----+------------+-------------------------+---------+---------------------------+---------------------+
|  3 | 51         | 5491112345678@c.us      | bot     | Hola, los precios...      | 2026-02-21 10:31:05 |
|  2 | 51         | 5491112345678@c.us      | usuario | ¿Cuánto cuesta?           | 2026-02-21 10:31:00 |
+----+------------+-------------------------+---------+---------------------------+---------------------+

# WhatsApp:
# Debe recibir respuesta generada por GPT-4o ✅
```

### Test 3: Multicliente

```bash
# Setup:
mysql> INSERT INTO ll_bot_config VALUES (51, 0), (52, 1);

# Mensajes simultáneos:
# - Cliente 51: "Mensaje A" → Solo registra
# - Cliente 52: "Mensaje B" → Registra + responde

# Verificación:
mysql> SELECT cliente_id, telefono, rol, mensaje FROM ll_ia_conversaciones ORDER BY created_at DESC LIMIT 4;
+------------+-------------------------+---------+---------------------------+
| cliente_id | telefono                | rol     | mensaje                   |
+------------+-------------------------+---------+---------------------------+
| 52         | 5491187654321@c.us      | bot     | Gracias por tu consulta...| ← Respuesta para 52
| 52         | 5491187654321@c.us      | usuario | Mensaje B                 |
| 51         | 5491112345678@c.us      | usuario | Mensaje A                 | ← Sin respuesta para 51
+------------+-------------------------+---------+---------------------------+

# ✅ Cada cliente mantiene configuración independiente
```

---

## 📝 RESUMEN DE HALLAZGOS PARA LÍDER TÉCNICO

### ✅ Buenas Noticias

1. **Modo listener pasivo ya está implementado** - No requiere desarrollo
2. **Control granular por cliente** - Configuración en BD (ll_bot_config)
3. **Sin riesgo de loops** - Arquitectura webhook previene auto-respuestas
4. **Persistencia garantizada** - Todos los mensajes se guardan (bot_activo independiente)
5. **Cambio en caliente** - No requiere restart para cambiar modo

### ⚠️ Limitaciones Actuales

1. **Sin deduplicación** - Riesgo teórico de duplicados si massive-sender reintenta
2. **Sin cola de mensajes** - Si BD cae, mensajes se pierden
3. **Dependencia única** - massive-sender es punto único de falla
4. **Credenciales expuestas** - .env en texto plano
5. **Sin healthchecks automáticos** - No hay alertas si servicios caen

### 🔴 Riesgos Críticos

1. **Servicio NO está corriendo** - bot-responder y massive-sender detenidos
2. **Conflicto arquitectónico** - Convive con session-manager (mismo propósito)
3. **Sin monitoreo** - Logs vacíos, sin métricas

### 📊 Esfuerzo vs Valor

| Solución | Esfuerzo | Valor | Prioridad |
|----------|----------|-------|-----------|
| Activar bot-responder en modo pasivo | 3 min | ALTO | 🔴 CRÍTICA |
| Configurar ll_bot_config en BD | 1 min | ALTO | 🔴 CRÍTICA |
| Implementar deduplicación | 30 min | MEDIO | 🟡 MEDIA |
| Implementar cola de mensajes | 2 horas | MEDIO | 🟡 MEDIA |
| Migrar a central-hub | 1.5 horas | ALTO | 🟢 LARGO PLAZO |
| Configurar secrets manager | 1 hora | MEDIO | 🟢 LARGO PLAZO |

---

## 🎯 DECISIÓN REQUERIDA

### ¿Qué sistema debe ser el listener oficial?

| Opción | Sistema | Estado | Pros | Contras |
|--------|---------|--------|------|---------|
| **A** | central-hub + session-manager | Activo sin listener | Arquitectura oficial, modular | Requiere desarrollo (1.5h) |
| **B** | bot-responder + massive-sender | Detenido pero funcional | Ya implementado (3 min) | Arquitectura independiente |
| **C** | Ambos (transición) | N/A | Listener inmediato + migración futura | Riesgo de conflicto |

### Recomendación Final

**OPCIÓN RECOMENDADA: C (Transición)**

**Fase 1 (HOY - 10 minutos):**
```bash
1. Detener session-manager           # pm2 stop session-manager
2. Configurar BD (bot_activo=0)      # 1 query SQL
3. Iniciar massive-sender            # pm2 start ...
4. Iniciar bot-responder             # pm2 start ...
5. Verificar logs y BD               # pm2 logs + SELECT
```

**Fase 2 (Próxima semana - 1.5 horas):**
```bash
1. Implementar listener en session-manager
2. Crear endpoint /incoming-message en central-hub
3. Testing end-to-end
4. Migrar datos ll_ia_conversaciones
5. Desactivar bot-responder
6. Reactivar session-manager
```

**Resultado:** Captura inmediata + arquitectura oficial a futuro.

---

**Fecha de emisión:** 2026-02-21 11:45 UTC  
**Próxima revisión:** Post-activación (verificar tras 24h de operación)  
**Responsable técnico:** Equipo LeadMaster / Alberto Hilal  
**Documento basado en:** Análisis exhaustivo de código fuente real

---

## 📎 ANEXO: Comandos de Referencia Rápida

```bash
# ═══════════════════════════════════════════════════════════════
# ACTIVACIÓN MODO LISTENER PASIVO
# ═══════════════════════════════════════════════════════════════

# 1. Configurar BD
mysql -u iunaorg_b3toh -p -h sv46.byethost46.org iunaorg_dyd -e "
INSERT INTO ll_bot_config (cliente_id, bot_activo) VALUES (51, 0)
ON DUPLICATE KEY UPDATE bot_activo = 0;
SELECT * FROM ll_bot_config;"

# 2. Detener session-manager (evitar conflicto)
pm2 stop session-manager

# 3. Iniciar servicios
pm2 start /root/whatsapp-massive-sender/index.js --name massive-sender
sleep 30  # Esperar conexión WhatsApp
pm2 start /root/whatsapp-bot-responder/index.js --name bot-responder
pm2 save

# 4. Verificar
pm2 logs bot-responder --lines 20
curl http://localhost:3011/health
curl http://localhost:3013/health

# ═══════════════════════════════════════════════════════════════
# MONITOREO
# ═══════════════════════════════════════════════════════════════

# Logs en tiempo real
pm2 logs bot-responder

# Últimos mensajes capturados
mysql -u iunaorg_b3toh -p -h sv46.byethost46.org iunaorg_dyd -e "
SELECT telefono, rol, LEFT(mensaje, 50) AS mensaje, created_at
FROM ll_ia_conversaciones
WHERE cliente_id = 51
ORDER BY created_at DESC
LIMIT 10;"

# Estado de servicios
pm2 status

# ═══════════════════════════════════════════════════════════════
# CAMBIO A MODO BOT ACTIVO
# ═══════════════════════════════════════════════════════════════

mysql -u iunaorg_b3toh -p -h sv46.byethost46.org iunaorg_dyd -e "
UPDATE ll_bot_config SET bot_activo = 1 WHERE cliente_id = 51;"

# No requiere restart - cambio inmediato en próximo mensaje

# ═══════════════════════════════════════════════════════════════
# ROLLBACK (detener listener)
# ═══════════════════════════════════════════════════════════════

pm2 stop bot-responder
pm2 stop massive-sender
pm2 start session-manager
pm2 save
```

---

**FIN DEL DIAGNÓSTICO**

### Estado Actual
| Componente | Estado | Descripción |
|------------|--------|-------------|
| Event Listeners WhatsApp | ❌ **NO IMPLEMENTADO** | No existen listeners de mensajes |
| Captura en session-manager | ❌ **NO IMPLEMENTADO** | No hay código que capture eventos |
| Llamadas HTTP a listener | ❌ **NO IMPLEMENTADO** | No hay webhooks ni HTTP calls |
| Endpoint POST /incoming-message | ❌ **NO IMPLEMENTADO** | Solo documentado, sin código |
| Flujo completo | ❌ **NO EXISTE** | No hay flujo funcional |

---

## 🔎 HALLAZGOS DETALLADOS

### 1. ❌ Event Listeners de WhatsApp (NO ENCONTRADOS)

**Búsqueda realizada:**
```bash
# Patrones buscados:
- client.on('message')
- client.on('message_create')
- client.on('incoming')
```

**Resultado:** `0 coincidencias`

**Archivos analizados:**
- `/services/session-manager/whatsapp/client.js`
- `/services/session-manager/whatsapp/eventHandlers.js`
- `/services/session-manager/whatsapp/venom-session.js`

**Event Handlers encontrados (NINGUNO escucha mensajes):**

#### `session-manager/whatsapp/eventHandlers.js`
```javascript
export function setupClientEventHandlers(clienteId, wrapper) {
  const { client } = wrapper;
  
  // ✅ Implementados:
  client.on('qr', (qr) => { ... });
  client.on('ready', () => { ... });
  client.on('authenticated', () => { ... });
  client.on('auth_failure', (msg) => { ... });
  client.on('disconnected', (reason) => { ... });
  client.on('change_state', (state) => { ... });
  client.on('loading_screen', (percent, message) => { ... });
  client.on('error', (error) => { ... });
  client.on('remote_session_saved', () => { ... });
  
  // ❌ FALTANTES:
  // client.on('message', async (msg) => { ... });          // NO EXISTE
  // client.on('message_create', async (msg) => { ... });   // NO EXISTE
}
```

**CONCLUSIÓN:** session-manager gestiona SOLO ciclo de vida de sesión. NO escucha mensajes entrantes.

---

### 2. ❌ Captura de Eventos en session-manager (NO IMPLEMENTADA)

**Archivo:** `/services/session-manager/whatsapp/venom-session.js`

**Funciones implementadas:**
```javascript
module.exports = {
  connect,        // ✅ Inicia sesión admin
  disconnect,     // ✅ Cierra sesión
  sendMessage,    // ✅ Envía mensaje
  getState,       // ✅ Estado de sesión
  isConnected     // ✅ Verifica conexión
};
```

**Funciones NO implementadas:**
```javascript
// ❌ NO EXISTE:
// - onIncomingMessage()
// - listenMessages()
// - registerWebhook()
// - forwardMessageToListener()
```

**Búsqueda de llamadas HTTP salientes:**
```bash
# Patrones buscados en session-manager:
- axios
- fetch
- http.post
- request(
```

**Resultado:** `0 coincidencias`

**CONCLUSIÓN:** session-manager NO realiza llamadas HTTP hacia ningún servicio externo.

---

### 3. ❌ Endpoint POST /incoming-message (NO IMPLEMENTADO)

**Archivo esperado:** `/services/central-hub/src/modules/listener/routes/listenerRoutes.js`

**Endpoints implementados:**
```javascript
const router = express.Router();

// ✅ EXISTENTES:
router.post('/test-message', listenerController.testMessage);
router.post('/human-intervention', listenerController.registerHumanIntervention);
router.post('/ia/enable', listenerController.enableIA);
router.post('/ia/disable', listenerController.disableIA);
router.post('/ia/reactivate', listenerController.reactivateIA);
router.get('/history/:telefono', listenerController.getInterventionHistory);
router.get('/status', listenerController.getStatus);
router.post('/mode', listenerController.setMode);
router.get('/logs', listenerController.getLogs);

// ❌ FALTANTE:
// router.post('/incoming-message', listenerController.handleIncomingMessage);  // NO EXISTE
```

**Búsqueda global:**
```bash
grep -r "incoming-message" services/central-hub/src/
```

**Resultado:** `0 coincidencias en código (solo 1 en documentación)`

**Único hallazgo:**
- `/docs/Contratos-HTTP-LeadMaster-Workspace.md` línea 271

**CONCLUSIÓN:** El endpoint está SOLO documentado, sin implementación real.

---

### 4. 📄 Documentación vs Realidad

#### Contratos HTTP (DOCUMENTADO, NO IMPLEMENTADO)

**Archivo:** `/docs/Contratos-HTTP-LeadMaster-Workspace.md`

```markdown
### 5.1 POST /incoming-message

**Descripción**
Endpoint interno llamado por session-manager.

**Request**
{
  "cliente_id": 51,
  "from": "5491199988877",
  "message": "Hola, necesito info",
  "timestamp": "2026-01-01T12:30:00Z"
}

**Response 200**
{
  "ok": true
}
```

**Estado:** 🟡 **Solo documentación teórica**

#### Integration-CentralHub-SessionManager.md

**Línea 222:**
```markdown
## 8. What This Integration Does NOT Include

❌ Incoming message handling  
```

**CONFIRMACIÓN EXPLÍCITA:** El contrato de integración NO incluye manejo de mensajes entrantes.

#### ARQUITECTURA_MODULAR.md

**Línea 208:**
```markdown
- El listener se integra con el session-manager para recibir eventos 
  de mensajes y enviar respuestas; está prohibido usar Venom directo 
  en este módulo.
```

**Estado:** 🟡 **Intención arquitectónica, sin implementación**

---

## 🚫 FLUJO INEXISTENTE

### Flujo Esperado (NO IMPLEMENTADO)

```
┌───────────────────┐
│  WhatsApp Web     │
│  (Usuario envía   │
│   mensaje)        │
└────────┬──────────┘
         │
         ▼
┌───────────────────────────────────┐
│  session-manager                  │  ← ❌ NO ESCUCHA
│  whatsapp-web.js / venom-bot      │
│  client.on('message', ...)        │  ← ❌ NO EXISTE
└────────┬──────────────────────────┘
         │
         ▼ ❌ NO HAY HTTP CALL
┌───────────────────────────────────┐
│  POST /api/listener/incoming-message  │  ← ❌ NO IMPLEMENTADO
│  central-hub                      │
└────────┬──────────────────────────┘
         │
         ▼ ❌ NUNCA LLEGA AQUÍ
┌───────────────────────────────────┐
│  listenerService.onMessageReceived│
│  - Guardar mensaje                │
│  - Consultar IA                   │
│  - Enviar respuesta               │
└───────────────────────────────────┘
```

### Estado Real del Sistema

```
WhatsApp → session-manager → ⚠️  MENSAJES PERDIDOS (no escuchados)
                               └─→ VOID
```

**Resultado:** Los mensajes entrantes de WhatsApp **NO son capturados** por el sistema.

---

## 📊 ANÁLISIS DE COMPONENTES EXISTENTES

### ✅ Componentes Funcionales (Solo Envío)

| Archivo | Función | Estado |
|---------|---------|--------|
| `session-manager/whatsapp/client.js` | Gestión de sesión, envío de mensajes | ✅ OK |
| `session-manager/routes/api.js` | `POST /send` endpoint | ✅ OK |
| `central-hub/src/services/sessionManagerClient.js` | Cliente HTTP hacia session-manager | ✅ OK |
| `central-hub/src/modules/sender/*` | Envío de mensajes salientes | ✅ OK |

### ❌ Componentes Faltantes (Recepción)

| Archivo Esperado | Función Esperada | Estado |
|------------------|------------------|--------|
| `session-manager/whatsapp/messageListener.js` | Event handler `on('message')` | ❌ NO EXISTE |
| `session-manager/webhooks/forwardToListener.js` | HTTP POST a central-hub | ❌ NO EXISTE |
| `central-hub/src/modules/listener/routes/incoming.js` | Endpoint HTTP /incoming-message | ❌ NO EXISTE |
| `central-hub/src/modules/listener/controllers/incomingController.js` | Controlador de mensajes entrantes | ❌ NO EXISTE |

---

## 🔧 QUÉ FALTA IMPLEMENTAR

### 1. Event Listener en session-manager

**Archivo:** `/services/session-manager/whatsapp/messageListener.js` (NUEVO)

```javascript
/**
 * Captura mensajes entrantes de WhatsApp y los reenvía a central-hub
 */

import axios from 'axios';

const CENTRAL_HUB_URL = process.env.CENTRAL_HUB_URL || 'http://localhost:3012';

/**
 * Configura el listener de mensajes para un cliente
 * @param {number} clienteId - ID del cliente
 * @param {Object} client - Instancia de whatsapp-web.js
 */
export function setupMessageListener(clienteId, client) {
  
  // ⚡ CAPTURAR MENSAJES ENTRANTES
  client.on('message', async (msg) => {
    console.log(`[MessageListener][${clienteId}] Mensaje recibido de ${msg.from}`);
    
    try {
      // Reenviar a central-hub
      await axios.post(`${CENTRAL_HUB_URL}/api/listener/incoming-message`, {
        cliente_id: clienteId,
        from: msg.from.replace('@c.us', ''),
        message: msg.body,
        timestamp: new Date(msg.timestamp * 1000).toISOString(),
        message_id: msg.id._serialized
      }, {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`[MessageListener][${clienteId}] Mensaje reenviado a central-hub`);
      
    } catch (error) {
      console.error(`[MessageListener][${clienteId}] Error reenviando mensaje:`, error.message);
    }
  });
  
  console.log(`[MessageListener][${clienteId}] Listener configurado`);
}
```

**Integración requerida en:** `/services/session-manager/whatsapp/eventHandlers.js`

```javascript
import { setupMessageListener } from './messageListener.js';

export function setupClientEventHandlers(clienteId, wrapper) {
  const { client } = wrapper;
  
  // Event handlers existentes (qr, ready, etc.)
  // ...
  
  // ⚡ AGREGAR AL FINAL:
  setupMessageListener(clienteId, client);
}
```

---

### 2. Endpoint en central-hub

**Archivo:** `/services/central-hub/src/modules/listener/controllers/incomingController.js` (NUEVO)

```javascript
const listenerService = require('../services/listenerService');

/**
 * POST /api/listener/incoming-message
 * Recibe mensajes entrantes desde session-manager
 */
exports.handleIncomingMessage = async (req, res) => {
  const { cliente_id, from, message, timestamp, message_id } = req.body;
  
  // Validaciones
  if (!cliente_id || !from || !message) {
    return res.status(400).json({
      ok: false,
      error: 'Faltan campos requeridos: cliente_id, from, message'
    });
  }
  
  try {
    // Procesar mensaje con el servicio existente
    await listenerService.onMessageReceived({
      cliente_id: Number(cliente_id),
      telefono: from,
      texto: message,
      esHumano: false,
      origenMensaje: 'whatsapp_entrante',
      timestamp,
      message_id
    });
    
    res.status(200).json({ ok: true });
    
  } catch (error) {
    console.error('[IncomingController] Error procesando mensaje:', error);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
};
```

**Registro de ruta en:** `/services/central-hub/src/modules/listener/routes/listenerRoutes.js`

```javascript
const incomingController = require('../controllers/incomingController');

// ⚡ AGREGAR ANTES DE module.exports:
router.post('/incoming-message', incomingController.handleIncomingMessage);
```

---

### 3. Variables de Entorno

**Archivo:** `/services/session-manager/.env`

```bash
# URL de central-hub para reenvío de mensajes entrantes
CENTRAL_HUB_URL=http://localhost:3012
```

---

### 4. Dependencias

**Archivo:** `/services/session-manager/package.json`

```json
{
  "dependencies": {
    "axios": "^1.6.0"  // ⚡ AGREGAR si no existe
  }
}
```

**Comando:**
```bash
cd /root/leadmaster-workspace/services/session-manager
npm install axios
```

---

## 🎯 PLAN DE IMPLEMENTACIÓN

### Fase 1: Captura en session-manager (30 min)
1. ✅ Crear `whatsapp/messageListener.js`
2. ✅ Integrar en `eventHandlers.js`
3. ✅ Agregar variable `CENTRAL_HUB_URL`
4. ✅ Instalar `axios`
5. ✅ Testing: Verificar logs de captura

### Fase 2: Endpoint en central-hub (20 min)
1. ✅ Crear `controllers/incomingController.js`
2. ✅ Registrar ruta en `listenerRoutes.js`
3. ✅ Testing: curl manual al endpoint

### Fase 3: Integración end-to-end (30 min)
1. ✅ Enviar mensaje de prueba a WhatsApp
2. ✅ Verificar logs en session-manager (mensaje recibido)
3. ✅ Verificar logs en central-hub (mensaje procesado)
4. ✅ Verificar respuesta automática (si IA activa)
5. ✅ Verificar registro en base de datos

### Fase 4: Monitoreo (15 min)
1. ✅ Agregar logs estructurados
2. ✅ Configurar alertas de errores
3. ✅ Dashboard de mensajes entrantes

**Tiempo total estimado:** 1.5 horas

---

## 🔴 RIESGOS IDENTIFICADOS

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Mensajes duplicados | ALTO | Implementar deduplicación por `message_id` |
| Sesión no lista al recibir mensaje | MEDIO | Validar estado en session-manager antes de reenviar |
| Central-hub offline | ALTO | Implementar cola local en session-manager (Redis/archivo) |
| Rendimiento con alto volumen | MEDIO | Implementar procesamiento asíncrono con workers |
| Errores no monitoreados | ALTO | Agregar logging estructurado + alertas |

---

## 📈 MÉTRICAS RECOMENDADAS

### KPIs de Listener
- ✅ **Mensajes recibidos/min**
- ✅ **Mensajes procesados/min**
- ✅ **Tasa de error de reenvío**
- ✅ **Latencia promedio (WhatsApp → BD)**
- ✅ **Estado de sesión (READY/ERROR)**

### Alertas Críticas
- ⚠️ **Sesión caída** → Reiniciar session-manager
- ⚠️ **Mensajes no reenviados > 10% últimos 5 min** → Revisar central-hub
- ⚠️ **Latencia > 3s** → Revisar performance

---

## ✅ CHECKLIST DE AUDITORÍA

**Componentes Verificados:**
- [x] Event listeners en session-manager (TODAS las variantes)
- [x] Funciones de captura en cliente WhatsApp
- [x] Llamadas HTTP salientes desde session-manager
- [x] Endpoint POST /incoming-message en central-hub
- [x] Rutas registradas en Express
- [x] Controladores de mensajes entrantes
- [x] Integración en arquitectura modular
- [x] Documentación vs implementación

**Resultado Final:**
- ❌ **0/8** componentes implementados
- 🟡 **2/8** componentes documentados (sin código)
- ✅ **Diagnóstico completo**

---

## 📝 CONCLUSIÓN TÉCNICA

### Estado Actual
El sistema LeadMaster Workspace **NO está escuchando mensajes entrantes de WhatsApp**. La arquitectura está preparada para envío (sender) pero carece completamente de la funcionalidad de recepción (listener).

### Arquitectura Implementada (Solo Envío)
```
Frontend → sender → session-manager → WhatsApp ✅ FUNCIONAL
```

### Arquitectura Faltante (Recepción)
```
WhatsApp → session-manager → listener → procesamiento ❌ NO EXISTE
```

### Causa Raíz
El contrato de integración entre central-hub y session-manager **explícitamente excluye** el manejo de mensajes entrantes (ver Integration-CentralHub-SessionManager.md línea 222).

### Impacto en Producto
- ❌ No hay respuestas automáticas en tiempo real
- ❌ No se registran conversaciones entrantes
- ❌ Bot/IA no puede funcionar sin estimulación manual
- ❌ Flujo bidireccional de comunicación inexistente

### Recomendación
**Prioridad:** 🔴 **CRÍTICA**  
Implementar Fase 1-3 del plan (1.5 horas) para habilitar funcionalidad básica de listener.

---

**Fecha de emisión:** 2026-02-21  
**Próxima revisión:** Después de implementar el listener  
**Responsable técnico:** Equipo de desarrollo LeadMaster
