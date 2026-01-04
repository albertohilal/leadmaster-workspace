# Endpoint /qr - Documentación Técnica

## 📌 Resumen

Endpoint HTTP para obtener el QR de WhatsApp cuando el Session Manager requiere autenticación.

**URL**: `GET /qr`  
**Versión**: 1.0  
**Fecha**: 2026-01-03  
**Estado**: ✅ PRODUCCIÓN

---

## 🎯 Propósito

Permitir escaneo remoto del código QR de WhatsApp sin acceso directo al servidor.

**Casos de uso**:
- Interfaz web para administradores
- Aplicaciones móviles de gestión
- Dashboards remotos

---

## 📍 Ubicación del Código

```
/services/session-manager/
├── routes/qr.js          ← Implementación del endpoint
├── whatsapp/client.js    ← Almacenamiento en memoria del QR
└── app.js                ← Registro del endpoint
```

---

## 🔄 Flujo de Funcionamiento

```
1. Cliente llama GET /status
   └─> Si needs_qr === true
       └─> Cliente llama GET /qr
           └─> Si state === 'QR_REQUIRED'
               └─> Devuelve QR como PNG base64
           └─> Si otro estado
               └─> Devuelve 409 Conflict
```

---

## 📊 Respuestas del Endpoint

### ✅ Caso 1: QR Disponible (200 OK)

**Condición**: `state === 'QR_REQUIRED'` y QR existe en memoria

**Respuesta**:
```json
{
  "state": "QR_REQUIRED",
  "expires_in": 60,
  "qr": "data:image/png;base64,iVBORw0KGgo..."
}
```

**Campos**:
- `state`: Estado actual del Session Manager
- `expires_in`: Segundos antes de que expire (informativo, no temporizador real)
- `qr`: Data URI con imagen PNG en base64

**Uso en HTML**:
```html
<img src="data:image/png;base64,iVBORw0KGgo..." alt="QR WhatsApp" />
```

---

### ❌ Caso 2: QR No Disponible (409 Conflict)

**Condición**: Cualquier estado diferente a `QR_REQUIRED`

**Respuesta**:
```json
{
  "error": "QR not available",
  "state": "READY",
  "can_send_messages": true
}
```

**Estados que devuelven 409**:
- `INITIALIZING` - Inicializando por primera vez
- `RECONNECTING` - Recuperando sesión existente
- `READY` - Sesión lista (no necesita QR)
- `AUTH_FAILURE` - Falló autenticación
- `DISCONNECTED_RECOVERABLE` - Desconexión temporal
- `DISCONNECTED_LOGOUT` - Usuario cerró sesión
- `DISCONNECTED_BANNED` - Número bloqueado
- `ERROR` - Error técnico

---

### 🔥 Caso 3: Error Interno (500)

**Condición**: Error al generar imagen PNG desde QR string

**Respuesta**:
```json
{
  "error": "Internal error",
  "message": "Error details here"
}
```

---

## 🔐 Seguridad

### Modelo Actual: **Sin Autenticación**

**Decisión de diseño**:
- Endpoint solo lectura (read-only)
- No modifica estado del sistema
- No ejecuta acciones críticas
- Seguridad delegada al Central Hub

**Protección recomendada**:
- Firewall: Solo Central Hub puede acceder al puerto 3001
- Nginx: Reverse proxy con rate limiting
- VPN: Acceso solo desde red interna

**NO implementado intencionalmente**:
- ❌ JWT tokens
- ❌ OAuth2
- ❌ API keys
- ❌ Basic auth

**Razón**: Simplicidad operativa. La seguridad se gestiona en capa superior.

---

## 🧪 Pruebas

### Test 1: QR Disponible

```bash
# 1. Verificar estado
curl http://localhost:3001/status

# Respuesta esperada:
# {"state":"QR_REQUIRED","needs_qr":true,...}

# 2. Obtener QR
curl http://localhost:3001/qr > qr-response.json

# 3. Verificar respuesta
cat qr-response.json
# {"state":"QR_REQUIRED","expires_in":60,"qr":"data:image/png;base64,..."}
```

### Test 2: QR No Disponible (Sesión READY)

```bash
# Caso: Sesión ya autenticada
curl -i http://localhost:3001/qr

# Respuesta esperada:
# HTTP/1.1 409 Conflict
# {"error":"QR not available","state":"READY","can_send_messages":true}
```

### Test 3: HTML Visual

Abrir en navegador:
```bash
file:///root/leadmaster-workspace/services/session-manager/test-qr.html
```

**Comportamiento esperado**:
- ✅ Muestra estado actual
- ✅ Muestra imagen QR si disponible
- ✅ Muestra error 409 si no disponible
- ✅ Auto-refresh cada 10 segundos

---

## 📦 Dependencias

### NPM Package: `qrcode`

**Instalación**:
```bash
npm install qrcode
```

**Uso en código**:
```javascript
import QRCode from 'qrcode';

const qrDataURL = await QRCode.toDataURL(qrString, {
  errorCorrectionLevel: 'M',
  type: 'image/png',
  width: 300,
  margin: 2
});
```

**Documentación**: https://www.npmjs.com/package/qrcode

---

## ❄️ Integridad del Core

### ✅ Cambios Permitidos (realizados)

**whatsapp/client.js**:
```javascript
// Variable en memoria (SOLO LECTURA)
let lastQRCode = null;

// Almacenar QR al generarse
clientInstance.on('qr', (qr) => {
  lastQRCode = qr; // ← Único cambio
  // ... resto del código SIN CAMBIOS
});

// Limpiar QR cuando esté listo
clientInstance.on('ready', () => {
  lastQRCode = null; // ← Único cambio
  // ... resto del código SIN CAMBIOS
});

// Exportar getter (SOLO LECTURA)
export function getLastQR() {
  return lastQRCode;
}
```

### ❌ Cambios NO Realizados (core protegido)

- ❌ NO modificar lógica de estados
- ❌ NO cambiar reconexiones
- ❌ NO alterar inicialización
- ❌ NO tocar MAX_RECONNECTION_ATTEMPTS
- ❌ NO regenerar QR manualmente
- ❌ NO llamar client.initialize()
- ❌ NO forzar cambios de estado

---

## 🚀 Despliegue

### Reiniciar servicio PM2:

```bash
cd /root/leadmaster-workspace/services/session-manager
pm2 restart session-manager
pm2 logs session-manager --lines 30
```

### Verificar endpoint:

```bash
# Health check
curl http://localhost:3001/health

# Estado
curl http://localhost:3001/status

# QR
curl http://localhost:3001/qr
```

---

## 🔗 Integración con Central Hub

### Flujo Recomendado

```javascript
// 1. Verificar si necesita QR
const status = await fetch('http://localhost:3001/status').then(r => r.json());

if (status.needs_qr) {
  // 2. Obtener QR
  const qrResponse = await fetch('http://localhost:3001/qr');
  
  if (qrResponse.status === 200) {
    const qrData = await qrResponse.json();
    // Mostrar qrData.qr en <img src="..." />
  } else if (qrResponse.status === 409) {
    // QR no disponible - mostrar mensaje apropiado
    console.log('QR not available for state:', qrData.state);
  }
}
```

### Polling (Auto-Refresh)

```javascript
// Verificar estado cada 10 segundos
setInterval(async () => {
  const status = await fetch('http://localhost:3001/status').then(r => r.json());
  
  if (status.state === 'READY') {
    console.log('✅ Sesión lista - detener polling');
    // Redirigir a dashboard principal
  }
}, 10000);
```

---

## 📋 Checklist de Validación

- ✅ Endpoint `/qr` creado en `routes/qr.js`
- ✅ Registrado en `app.js`
- ✅ Variable `lastQRCode` agregada a `client.js`
- ✅ Función `getLastQR()` exportada
- ✅ Paquete `qrcode` instalado
- ✅ No se modificó lógica de estados
- ✅ No se tocó lógica de reconexión
- ✅ Compila sin errores
- ✅ PM2 reiniciado correctamente
- ✅ Endpoint responde 200 con QR cuando state=QR_REQUIRED
- ✅ Endpoint responde 409 cuando QR no disponible
- ✅ Test HTML funciona correctamente

---

## 🎯 Resultado

✅ **Endpoint implementado exitosamente**  
✅ **Core del Session Manager NO modificado**  
✅ **Compatible con arquitectura de 9 estados**  
✅ **Listo para producción**

---

## 📞 Soporte

**Logs en tiempo real**:
```bash
pm2 logs session-manager --lines 50 --nostream
```

**Estado del proceso**:
```bash
pm2 status session-manager
```

**Reinicio forzado**:
```bash
pm2 restart session-manager --update-env
```

---

**Autor**: GitHub Copilot  
**Fecha**: 2026-01-03  
**Versión**: 1.0  
**Status**: ✅ PRODUCCIÓN
