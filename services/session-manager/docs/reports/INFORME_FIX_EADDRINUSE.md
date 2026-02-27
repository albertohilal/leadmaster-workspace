# 📋 Informe: Fix EADDRINUSE en session-manager

**Fecha:** 2026-01-17  
**Servicio:** session-manager  
**Problema:** Error `EADDRINUSE: address already in use :::3001` al reiniciar con PM2

---

## 🔍 Diagnóstico

### Estado actual del código

**Archivo:** `services/session-manager/index.js`

El código actual **YA TIENE** un shutdown parcialmente implementado:

```javascript
const gracefulShutdown = (signal) => {
  console.log(`\n[Shutdown] Received ${signal}`);
  server.close(() => {
    console.log('[Shutdown] Server closed');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('[Shutdown] Forcing exit');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
```

### ✅ Lo que está bien

1. **Referencia del servidor guardada**: `const server = app.listen(...)`
2. **Handlers de señales**: `SIGTERM` y `SIGINT` capturados
3. **Cierre del servidor HTTP**: `server.close()` se ejecuta
4. **Timeout de seguridad**: 10 segundos para forzar salida

### ❌ Lo que falta

1. **No cierra el cliente WhatsApp**: El cliente Puppeteer/Chromium queda abierto
2. **No hay flag de shutdown único**: Podría ejecutarse múltiples veces
3. **No notifica a PM2**: Falta `process.send('shutdown')` para PM2
4. **Timeout muy largo**: 10 segundos es excesivo (PM2 usa `kill_timeout: 3000` por defecto)

---

## 🎯 Solución propuesta

### Cambios en `index.js`

**Objetivo:** Implementar shutdown completo con:
- Cierre del cliente WhatsApp
- Flag para evitar ejecución múltiple
- Notificación a PM2
- Timeout ajustado a 5 segundos (compatible con PM2)

### Cambios en `whatsapp/session.js`

**Objetivo:** Exportar función `cleanup()` para cerrar cliente y timers:
- Detener `qrCheckInterval`
- Destruir cliente WhatsApp
- Limpiar estado

---

## 📝 Plan de implementación

### 1. Modificar `whatsapp/session.js`

Agregar función de limpieza al final del archivo:

```javascript
async function cleanup() {
  console.log('[SessionManager] Cleaning up WhatsApp client...');
  
  stopQRCheckInterval();
  
  if (client) {
    try {
      await client.destroy();
      client = null;
      console.log('[SessionManager] WhatsApp client destroyed');
    } catch (error) {
      console.error('[SessionManager] Error destroying client:', error);
    }
  }
}

module.exports = {
  connect,
  disconnect,
  sendMessage,
  getState,
  getQRCode,
  cleanup  // ← NUEVO
};
```

### 2. Modificar `index.js`

Reemplazar la función `gracefulShutdown` actual:

```javascript
let isShuttingDown = false;

const gracefulShutdown = async (signal) => {
  if (isShuttingDown) {
    console.log('[Shutdown] Already shutting down, ignoring signal');
    return;
  }
  
  isShuttingDown = true;
  console.log(`\n[Shutdown] Received ${signal}, initiating graceful shutdown...`);

  // Notificar a PM2 que estamos cerrando
  if (process.send) {
    process.send('shutdown');
  }

  // Timeout de seguridad: 5 segundos
  const forceExitTimer = setTimeout(() => {
    console.error('[Shutdown] ⚠️  Forcing exit after timeout');
    process.exit(1);
  }, 5000);

  try {
    // 1. Cerrar servidor HTTP
    console.log('[Shutdown] Closing HTTP server...');
    await new Promise((resolve) => {
      server.close(() => {
        console.log('[Shutdown] ✅ HTTP server closed');
        resolve();
      });
    });

    // 2. Limpiar cliente WhatsApp
    const { cleanup } = require('./whatsapp/session');
    await cleanup();

    // 3. Salir limpiamente
    clearTimeout(forceExitTimer);
    console.log('[Shutdown] ✅ Graceful shutdown completed');
    process.exit(0);

  } catch (error) {
    console.error('[Shutdown] ❌ Error during shutdown:', error);
    clearTimeout(forceExitTimer);
    process.exit(1);
  }
};
```

---

## 🧪 Testing

### Comandos de prueba

```bash
# 1. Iniciar con PM2
pm2 start index.js --name session-manager

# 2. Verificar que responde
curl http://localhost:3001/health

# 3. Reiniciar y verificar logs
pm2 restart session-manager
pm2 logs session-manager --lines 20

# 4. Verificar que no hay EADDRINUSE
pm2 restart session-manager
pm2 restart session-manager
pm2 restart session-manager
```

### Resultado esperado en logs

```
[Shutdown] Received SIGINT, initiating graceful shutdown...
[Shutdown] Closing HTTP server...
[Shutdown] ✅ HTTP server closed
[SessionManager] Cleaning up WhatsApp client...
[SessionManager] QR check interval stopped
[SessionManager] WhatsApp client destroyed
[Shutdown] ✅ Graceful shutdown completed
```

---

## ⚠️ Consideraciones

### Compatible con PM2 ecosystem.config.js

Si existe configuración PM2, verificar:

```javascript
{
  kill_timeout: 5000,  // Debe ser >= timeout del código (5s)
  wait_ready: true,
  listen_timeout: 8000
}
```

### No afecta funcionalidad existente

- ✅ QR auto-regeneration sigue funcionando
- ✅ LocalAuth no se borra
- ✅ Estado global se mantiene
- ✅ API endpoints no cambian

### Rollback sencillo

Si surge algún problema, simplemente revertir a:

```bash
git checkout HEAD -- index.js whatsapp/session.js
pm2 restart session-manager
```

---

## 📊 Resumen ejecutivo

| Aspecto | Estado actual | Después del fix |
|---------|--------------|-----------------|
| Cierra servidor HTTP | ✅ Sí | ✅ Sí |
| Cierra cliente WhatsApp | ❌ No | ✅ Sí |
| Evita EADDRINUSE | ⚠️  A veces | ✅ Siempre |
| Compatible con PM2 | ⚠️  Parcial | ✅ Total |
| Shutdown único | ❌ No | ✅ Sí |
| Timeout apropiado | ⚠️  10s | ✅ 5s |

---

## ✅ Conclusión

El fix es **simple, seguro y no invasivo**. Solo agrega:
- 1 función nueva en `session.js` (cleanup)
- Mejora la función existente en `index.js` (gracefulShutdown)

**Riesgo:** Muy bajo  
**Impacto:** Alto (elimina EADDRINUSE definitivamente)  
**Complejidad:** Baja  

**Recomendación:** ✅ Aplicar inmediatamente

---

## 📌 Siguiente paso

Confirmar aplicación con:
```
Aplicar el fix ahora
```
