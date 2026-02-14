# Plan de Migración: session-manager a venom-bot

**Fecha:** 20 de enero de 2026  
**Proyecto:** LeadMaster - Session Manager  
**Objetivo:** Migrar de whatsapp-web.js a venom-bot usando como referencia exacta el proyecto funcional

---

## 📋 Contexto

### Problema Actual
- **whatsapp-web.js v1.23.0-1.34.4:** Bug crítico en `sendMessage()` 
- **Error:** `Cannot read properties of undefined (reading 'markedUnread')`
- **Resultado:** Los mensajes NO se envían (confirmado con pruebas)
- **Causa:** WhatsApp Web cambió su API interna, whatsapp-web.js no está actualizado

### Proyecto de Referencia Funcional
```
/root/whatsapp-massive-sender
├── bot/whatsapp_instance.js    ← Lógica probada y estable
├── package.json                ← venom-bot v5.3.0
└── Funciona correctamente desde hace meses
```

---

## 🎯 Objetivo Técnico

Migrar `session-manager` para usar **venom-bot** replicando 1:1 la semántica del proyecto probado.

### Diferencias Clave: whatsapp-web.js vs venom-bot

| Aspecto | whatsapp-web.js | venom-bot |
|---------|-----------------|-----------|
| **Inicialización** | `client.initialize()` + esperar evento `ready` | `venom.create()` Promise resuelve cuando READY |
| **Estado READY** | Evento asíncrono `client.on('ready')` | `.then(clientInstance)` = READY |
| **Envío** | `client.sendMessage()` (buggy) | `client.sendText()` (estable) |
| **Estados** | INIT, CONNECTING, QR_REQUIRED, READY, etc. | Cliente existe = READY, No existe = Desconectado |
| **QR Code** | Evento `qr` | Callback `catchQR` en configuración |

---

## 📐 Arquitectura Objetivo

### Estructura en Memoria

```javascript
// Almacén simple de clientes por cliente_id
const clientes = {};

// Ejemplo:
// clientes = {
//   "51": <VenomClient>,
//   "52": <VenomClient>,
//   "admin": <VenomClient>
// }
```

### Semántica de Estados

**Estado READY:**
- Existe `clientes[cliente_id]`
- Promise de `venom.create()` se resolvió exitosamente
- Cliente puede enviar mensajes inmediatamente

**Estado QR_REQUIRED:**
- No existe `clientes[cliente_id]`
- Necesita llamar a `POST /connect`

**No hay estados intermedios** (CONNECTING, AUTHENTICATING, etc.)

---

## 🔧 Implementación Detallada

### 1. Modificar `package.json`

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "qrcode": "^1.5.4",
    "venom-bot": "^5.3.0"
  }
}
```

**Eliminar:**
- ❌ `whatsapp-web.js`

**Instalar:**
```bash
cd /root/leadmaster-workspace/services/session-manager
npm uninstall whatsapp-web.js
npm install venom-bot@5.3.0
```

---

### 2. Crear `whatsapp/venom-session.js`

```javascript
const venom = require('venom-bot');

// Almacenamiento en memoria de clientes por cliente_id
const clientes = {};
const qrCodes = {}; // QR temporal durante conexión

/**
 * Inicia una sesión de WhatsApp para un cliente específico
 * @param {string|number} clienteId - ID único del cliente
 * @returns {Promise<Object>} Cliente de venom-bot
 */
async function connect(clienteId) {
  const sessionName = `session-${clienteId}`;
  
  console.log(`[VenomSession] Iniciando conexión para cliente_id=${clienteId}`);
  
  // Si ya existe, retornar el cliente
  if (clientes[clienteId]) {
    console.log(`[VenomSession] Cliente ${clienteId} ya está conectado`);
    return clientes[clienteId];
  }
  
  try {
    const client = await venom.create({
      session: sessionName,
      headless: true,
      useChrome: true,
      executablePath: '/usr/bin/google-chrome-stable',
      disableSpins: true,
      browserArgs: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ],
      puppeteerOptions: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: true
      },
      // Capturar QR durante la conexión
      catchQR: (base64Qr, asciiQR, attempts, urlCode) => {
        console.log(`[VenomSession] QR generado para cliente_id=${clienteId} (intento ${attempts})`);
        qrCodes[clienteId] = {
          base64: base64Qr,
          url: urlCode,
          attempts,
          timestamp: Date.now()
        };
      },
      statusFind: (statusSession, session) => {
        console.log(`[VenomSession] Estado (${clienteId}):`, statusSession);
      }
    });
    
    // ✅ Al llegar aquí, el cliente está READY
    clientes[clienteId] = client;
    delete qrCodes[clienteId]; // Limpiar QR temporal
    
    console.log(`✅ [VenomSession] Cliente ${clienteId} conectado y READY`);
    return client;
    
  } catch (error) {
    console.error(`❌ [VenomSession] Error al conectar cliente_id=${clienteId}:`, error.message);
    delete qrCodes[clienteId];
    throw error;
  }
}

/**
 * Obtiene el cliente si existe
 */
function getClient(clienteId) {
  return clientes[clienteId] || null;
}

/**
 * Verifica si un cliente está conectado
 */
function isConnected(clienteId) {
  return !!clientes[clienteId];
}

/**
 * Desconecta un cliente
 */
async function disconnect(clienteId) {
  const client = clientes[clienteId];
  
  if (!client) {
    console.log(`[VenomSession] Cliente ${clienteId} no está conectado`);
    return { success: true, message: 'No active session' };
  }
  
  try {
    await client.close();
    delete clientes[clienteId];
    console.log(`[VenomSession] Cliente ${clienteId} desconectado`);
    return { success: true, message: 'Disconnected' };
  } catch (error) {
    console.error(`[VenomSession] Error al desconectar cliente_id=${clienteId}:`, error.message);
    delete clientes[clienteId];
    return { success: true, message: 'Disconnected with errors' };
  }
}

/**
 * Envía un mensaje de WhatsApp
 */
async function sendMessage(clienteId, to, text) {
  const client = clientes[clienteId];
  
  if (!client) {
    throw new Error('SESSION_NOT_READY');
  }
  
  // Formatear número
  const rawNumber = String(to).replace(/\D/g, '');
  const destinatario = rawNumber.includes('@c.us') ? rawNumber : `${rawNumber}@c.us`;
  
  console.log(`[VenomSession] Enviando mensaje: cliente_id=${clienteId}, to=${destinatario}`);
  
  try {
    // ✅ Este método funciona correctamente
    const result = await client.sendText(destinatario, text);
    
    console.log(`✅ [VenomSession] Mensaje enviado exitosamente a ${destinatario}`);
    
    return {
      success: true,
      cliente_id: clienteId,
      to: rawNumber,
      messageId: result?.id || 'sent',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error(`❌ [VenomSession] Error al enviar mensaje:`, error.message);
    throw error;
  }
}

/**
 * Obtiene el estado de la sesión
 */
function getState(clienteId) {
  if (clientes[clienteId]) {
    return {
      connected: true,
      state: 'READY',
      cliente_id: clienteId
    };
  }
  
  // Si hay QR pendiente
  if (qrCodes[clienteId]) {
    return {
      connected: false,
      state: 'QR_REQUIRED',
      qr: qrCodes[clienteId],
      cliente_id: clienteId
    };
  }
  
  return {
    connected: false,
    state: 'DISCONNECTED',
    cliente_id: clienteId
  };
}

/**
 * Lista todas las sesiones activas
 */
function listSessions() {
  return Object.keys(clientes);
}

module.exports = {
  connect,
  disconnect,
  sendMessage,
  getClient,
  getState,
  isConnected,
  listSessions
};
```

---

### 3. Modificar `routes/api.js`

```javascript
const express = require('express');
const session = require('../whatsapp/venom-session');

const router = express.Router();

// Health check
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'session-manager',
    timestamp: new Date().toISOString()
  });
});

// Estado de la sesión
router.get('/status', (req, res) => {
  const { cliente_id } = req.query;
  
  if (!cliente_id) {
    return res.status(400).json({
      success: false,
      error: 'cliente_id is required'
    });
  }
  
  const state = session.getState(cliente_id);
  res.status(200).json(state);
});

// Conectar sesión
router.post('/connect', async (req, res) => {
  const { cliente_id } = req.body;
  
  if (!cliente_id) {
    return res.status(400).json({
      success: false,
      error: 'cliente_id is required'
    });
  }
  
  try {
    await session.connect(cliente_id);
    
    res.status(200).json({
      success: true,
      message: 'Connected',
      state: 'READY',
      cliente_id
    });
  } catch (error) {
    console.error('[API] Connect error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Desconectar sesión
router.post('/disconnect', async (req, res) => {
  const { cliente_id } = req.body;
  
  if (!cliente_id) {
    return res.status(400).json({
      success: false,
      error: 'cliente_id is required'
    });
  }
  
  try {
    const result = await session.disconnect(cliente_id);
    res.status(200).json(result);
  } catch (error) {
    console.error('[API] Disconnect error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Enviar mensaje
router.post('/send', async (req, res) => {
  const { cliente_id, to, message } = req.body;
  
  // Validaciones
  if (!cliente_id || typeof cliente_id !== 'number') {
    return res.status(400).json({
      success: false,
      code: 'INVALID_CLIENTE_ID',
      message: 'cliente_id must be a number'
    });
  }
  
  if (!to || typeof to !== 'string') {
    return res.status(400).json({
      success: false,
      code: 'INVALID_TO',
      message: 'to must be a string'
    });
  }
  
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_MESSAGE',
      message: 'message must be a non-empty string'
    });
  }
  
  // Verificar que la sesión esté conectada
  if (!session.isConnected(cliente_id)) {
    return res.status(503).json({
      success: false,
      code: 'SESSION_NOT_READY',
      message: 'WhatsApp session not ready'
    });
  }
  
  try {
    const result = await session.sendMessage(cliente_id, to, message);
    
    res.status(200).json({
      success: true,
      message: 'Message sent',
      data: result
    });
  } catch (error) {
    console.error('[API] Send error:', error.message);
    res.status(500).json({
      success: false,
      code: 'SEND_FAILED',
      message: error.message
    });
  }
});

// Listar sesiones activas
router.get('/sessions', (req, res) => {
  const sessions = session.listSessions();
  res.status(200).json({
    success: true,
    sessions,
    count: sessions.length
  });
});

module.exports = router;
```

---

### 4. Actualizar `app.js`

```javascript
const express = require('express');
const cors = require('cors');
const apiRoutes = require('./routes/api');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/', apiRoutes);

module.exports = app;
```

---

### 5. Actualizar `index.js`

```javascript
require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 3001;

console.log('='.repeat(50));
console.log('  SESSION MANAGER - Venom Bot');
console.log('='.repeat(50));
console.log(`Port: ${PORT}`);
console.log(`Node Version: ${process.version}`);
console.log('='.repeat(50));

const server = app.listen(PORT, () => {
  console.log(`[Server] Listening on port ${PORT}`);
  console.log(`[Server] Health: http://localhost:${PORT}/health`);
  console.log(`[Server] Status: http://localhost:${PORT}/status?cliente_id=51`);
  console.log('='.repeat(50));
});

let isShuttingDown = false;

const gracefulShutdown = async (signal) => {
  if (isShuttingDown) {
    console.log('[Shutdown] Already shutting down, ignoring signal');
    return;
  }
  
  isShuttingDown = true;
  console.log(`\n[Shutdown] Received ${signal}, initiating graceful shutdown...`);

  const forceExitTimer = setTimeout(() => {
    console.error('[Shutdown] ⚠️  Forcing exit after timeout');
    process.exit(1);
  }, 5000);

  try {
    console.log('[Shutdown] Closing HTTP server...');
    await new Promise((resolve) => {
      server.close(() => {
        console.log('[Shutdown] ✅ HTTP server closed');
        resolve();
      });
    });

    clearTimeout(forceExitTimer);
    console.log('[Shutdown] ✅ Graceful shutdown completed');
    process.exit(0);

  } catch (error) {
    console.error('[Shutdown] ❌ Error during shutdown:', error);
    clearTimeout(forceExitTimer);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  console.error('[FATAL] Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
```

---

## 🚀 Plan de Ejecución

### Paso 1: Backup

```bash
cd /root/leadmaster-workspace/services/session-manager
cp -r . ../session-manager-backup-$(date +%Y%m%d)
```

### Paso 2: Instalar Dependencias

```bash
npm uninstall whatsapp-web.js
npm install venom-bot@5.3.0
```

### Paso 3: Implementar Código

1. Crear `whatsapp/venom-session.js` con el código del punto 2
2. Reemplazar `routes/api.js` con el código del punto 3
3. Actualizar `app.js` (punto 4)
4. Actualizar `index.js` (punto 5)

### Paso 4: Eliminar Archivos Obsoletos

```bash
rm -f whatsapp/session.js
rm -rf .wwebjs_auth/
```

### Paso 5: Reiniciar Servicio

```bash
pm2 stop session-manager
pm2 delete session-manager
pm2 start index.js --name session-manager
pm2 save
```

### Paso 6: Pruebas

```bash
# 1. Conectar
curl -X POST http://localhost:3001/connect \
  -H "Content-Type: application/json" \
  -d '{"cliente_id": 51}'

# 2. Verificar estado
curl "http://localhost:3001/status?cliente_id=51"

# 3. Enviar mensaje de prueba
curl -X POST http://localhost:3001/send \
  -H "Content-Type: application/json" \
  -d '{
    "cliente_id": 51,
    "to": "5491158254201",
    "message": "TEST venom-bot - confirmar recepción"
  }'

# 4. Listar sesiones
curl http://localhost:3001/sessions
```

---

## ✅ Validación de Éxito

### Indicadores de Migración Exitosa

1. ✅ Servicio inicia sin errores
2. ✅ POST `/connect` genera QR y conecta
3. ✅ GET `/status` retorna `READY` después de escanear QR
4. ✅ POST `/send` envía mensaje y se recibe en WhatsApp
5. ✅ No hay errores de `markedUnread` en los logs
6. ✅ Múltiples clientes pueden conectarse simultáneamente

### Logs Esperados

```
[VenomSession] Iniciando conexión para cliente_id=51
[VenomSession] QR generado para cliente_id=51 (intento 1)
[VenomSession] Estado (51): isLogged
✅ [VenomSession] Cliente 51 conectado y READY
[VenomSession] Enviando mensaje: cliente_id=51, to=5491158254201@c.us
✅ [VenomSession] Mensaje enviado exitosamente a 5491158254201@c.us
```

---

## 📊 Comparativa: Antes vs Después

| Aspecto | Antes (whatsapp-web.js) | Después (venom-bot) |
|---------|-------------------------|---------------------|
| **Librería** | whatsapp-web.js v1.34.4 | venom-bot v5.3.0 |
| **Envío funciona** | ❌ NO (bug markedUnread) | ✅ SÍ (probado) |
| **Estados complejos** | 6 estados (INIT, CONNECTING, etc.) | 2 estados (READY, DISCONNECTED) |
| **Inicialización** | eventos + polling | Promise simple |
| **Código** | 278 líneas | ~180 líneas |
| **Mantenibilidad** | Baja (bug no resuelto) | Alta (proyecto probado) |
| **Estabilidad** | Inestable | Estable |

---

## 🔒 Rollback Plan

Si la migración falla:

```bash
cd /root/leadmaster-workspace/services
rm -rf session-manager
cp -r session-manager-backup-YYYYMMDD session-manager
cd session-manager
npm install
pm2 restart session-manager
```

---

## 📝 Notas Adicionales

### Por qué venom-bot funciona mejor

1. **API más estable:** Mejor manejo de cambios de WhatsApp Web
2. **Semántica clara:** Promise resuelve = Cliente listo
3. **Menos abstracción:** No necesita capa de estados custom
4. **Probado en producción:** Funciona en whatsapp-massive-sender desde hace meses

### Limitaciones conocidas

- QR expira cada ~40 segundos (comportamiento de WhatsApp)
- Sesiones en memoria (se pierden al reiniciar el servicio)
- No hay persistencia de mensajes
- Un cliente_id = una sesión activa

### Consideraciones de Seguridad

- Validar `cliente_id` en todos los endpoints
- No exponer QR codes públicamente
- Rate limiting en `/send` (implementar si es necesario)
- Logs sensibles: no registrar contenido de mensajes

---

## 🎯 Resultado Final Esperado

Un `session-manager` que:

✅ Envía mensajes correctamente  
✅ Maneja múltiples clientes simultáneamente  
✅ Tiene lógica predecible (cliente existe = READY)  
✅ Es fácil de mantener y debuggear  
✅ Está alineado con el proyecto probado  

**Tiempo estimado de implementación:** 1-2 horas  
**Complejidad:** Media  
**Riesgo:** Bajo (tenemos backup funcional)

---

**Fecha de generación:** 20 de enero de 2026  
**Autor:** GitHub Copilot  
**Status:** Listo para implementación
