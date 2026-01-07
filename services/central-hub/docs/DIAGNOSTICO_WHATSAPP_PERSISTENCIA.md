# 🔍 DIAGNÓSTICO: Cliente WhatsApp y Persistencia de Sesiones

**Proyecto:** leadmaster-central-hub  
**Fecha:** 7 de enero de 2026  
**Servicio analizado:** session-manager

---

## 1️⃣ Librería de WhatsApp Utilizada

**Respuesta:** `whatsapp-web.js` versión `^1.23.0`

**Evidencia:**
- **Archivo:** `/root/leadmaster-workspace/services/session-manager/package.json`
- **Línea:** 21
- **Contenido:**
  ```json
  "whatsapp-web.js": "^1.23.0"
  ```

**Notas:**
- Es una librería que usa Puppeteer para automatizar WhatsApp Web
- Compatible con Node.js >= 18.0.0 (especificado en engines)
- Más estable que Venom-bot para operación 24x7

---

## 2️⃣ Archivo de Creación del Cliente WhatsApp

**Respuesta:** `/root/leadmaster-workspace/services/session-manager/whatsapp/client.js`

**Función principal:** `initialize(id)` (línea 74-103)

**Evidencia:**
```javascript
// Línea 74-103
export function initialize(id) {
  if (clientInstance) {
    console.log(`[WhatsApp] Client already initialized for cliente_id: ${clienteId}`);
    return;
  }

  clienteId = id;
  const authPath = `./sessions/cliente_${clienteId}`;

  console.log(`[WhatsApp] Initializing for cliente_id: ${clienteId}`);
  console.log(`[WhatsApp] Session path: ${authPath}`);

  clientInstance = new Client({
    authStrategy: new LocalAuth({
      clientId: `cliente_${clienteId}`,
      dataPath: authPath
    }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });
  
  // ... event handlers ...
  
  clientInstance.initialize();
}
```

**Llamado desde:**
- **Archivo:** `/root/leadmaster-workspace/services/session-manager/index.js`
- **Línea:** 31
- **Contexto:**
  ```javascript
  // Línea 31
  initialize(clienteIdNum);
  ```

**Flujo de inicialización:**
1. `index.js` valida variable de entorno `CLIENTE_ID`
2. Llama a `initialize(clienteIdNum)` del módulo `client.js`
3. El cliente se crea con `new Client()` usando estrategia `LocalAuth`

---

## 3️⃣ Parámetro de Persistencia de Sesión

**Respuesta:** `authStrategy` con `LocalAuth` + `dataPath`

**Evidencia:**
- **Archivo:** `/root/leadmaster-workspace/services/session-manager/whatsapp/client.js`
- **Líneas:** 95-99

**Configuración exacta:**
```javascript
authStrategy: new LocalAuth({
  clientId: `cliente_${clienteId}`,
  dataPath: authPath
})
```

**Parámetros clave:**
- **`authStrategy`:** Define el método de autenticación (LocalAuth)
- **`clientId`:** Identificador único por cliente (formato: `cliente_51`)
- **`dataPath`:** Ruta en disco donde se guardan las credenciales

**Tipo de estrategia:**
- `LocalAuth` es nativa de `whatsapp-web.js`
- Guarda la sesión completa en disco (incluye tokens, claves, estado)
- Permite recuperación automática sin escanear QR

---

## 4️⃣ Ubicación Actual de Credenciales en Disco

**Respuesta:** `./sessions/cliente_<CLIENTE_ID>/session-cliente_<CLIENTE_ID>/`

**Ruta absoluta:** `/root/leadmaster-workspace/services/session-manager/sessions/`

**Evidencia:**
- **Variable definida en:** `client.js` línea 81
  ```javascript
  const authPath = `./sessions/cliente_${clienteId}`;
  ```

**Estructura en disco (verificada):**
```
/root/leadmaster-workspace/services/session-manager/
└── sessions/
    └── cliente_51/                    # Directorio por clienteId
        └── session-cliente_51/         # Subdirectorio de LocalAuth
            ├── DevToolsActivePort
            ├── Default/                # Perfil de Chromium/Puppeteer
            │   ├── GPUCache/
            │   ├── Code Cache/
            │   ├── IndexedDB/
            │   ├── Local Storage/
            │   └── Session Storage/
            └── [archivos de sesión WhatsApp]
```

**Contenido persistido:**
- Tokens de autenticación
- Claves de cifrado
- Estado de la sesión
- Cache del navegador (Puppeteer)
- IndexedDB con datos de WhatsApp Web

**Verificación realizada:**
```bash
$ ls -la /root/leadmaster-workspace/services/session-manager/sessions/
total 12
drwxr-xr-x 3 root root 4096 Jan  3 08:07 .
drwxr-xr-x 9 root root 4096 Jan  5 09:09 ..
drwxr-xr-x 3 root root 4096 Jan  3 08:07 cliente_51
```

---

## 5️⃣ ¿Path Fijo o Dinámico por clienteId?

**Respuesta:** ✅ **DINÁMICO por clienteId**

**Evidencia:**
- **Archivo:** `client.js`
- **Línea:** 81

**Código:**
```javascript
const authPath = `./sessions/cliente_${clienteId}`;
```

**Comportamiento:**
- El `clienteId` se pasa como parámetro a `initialize(id)`
- El path se construye dinámicamente: `./sessions/cliente_${clienteId}`
- Cada cliente tiene su propio directorio aislado

**Ejemplos de rutas generadas:**
| clienteId | Path generado |
|-----------|---------------|
| 51 | `./sessions/cliente_51/` |
| 1 | `./sessions/cliente_1/` |
| 100 | `./sessions/cliente_100/` |

**Aislamiento:**
- ✅ Multi-tenant: cada cliente tiene sesión separada
- ✅ No hay colisiones entre clientes
- ✅ Permite múltiples instancias del session-manager (una por cliente)

**Validación de existencia:**
```javascript
// Línea 58-67
function hasExistingSession(id) {
  const sessionPath = path.resolve(`./sessions/cliente_${id}`);
  
  if (!fs.existsSync(sessionPath)) {
    return false;
  }
  
  const sessionFile = path.join(sessionPath, 'session');
  return fs.existsSync(sessionFile);
}
```

---

## 📊 Resumen Ejecutivo

| Aspecto | Detalle |
|---------|---------|
| **Librería** | `whatsapp-web.js` v1.23.0 |
| **Archivo principal** | `services/session-manager/whatsapp/client.js` |
| **Función de inicialización** | `initialize(id)` línea 74 |
| **Estrategia de auth** | `LocalAuth` con `dataPath` |
| **Path de sesiones** | `./sessions/cliente_<ID>/session-cliente_<ID>/` |
| **Tipo de path** | Dinámico por `clienteId` |
| **Multi-tenant** | ✅ Sí (aislamiento por directorio) |
| **Persistencia** | Disco local (tokens + cache Chromium) |

---

## 🔧 Detalles Técnicos Adicionales

### Modelo de Estados (9 estados explícitos)

**Archivo:** `client.js` líneas 14-31

```javascript
const SessionState = {
  INITIALIZING: 'INITIALIZING',
  RECONNECTING: 'RECONNECTING',
  READY: 'READY',
  QR_REQUIRED: 'QR_REQUIRED',
  AUTH_FAILURE: 'AUTH_FAILURE',
  DISCONNECTED_RECOVERABLE: 'DISCONNECTED_RECOVERABLE',
  DISCONNECTED_LOGOUT: 'DISCONNECTED_LOGOUT',
  DISCONNECTED_BANNED: 'DISCONNECTED_BANNED',
  ERROR: 'ERROR'
};
```

### Variables de Entorno Requeridas

**Archivo:** `index.js` líneas 4-6

```javascript
const CLIENTE_ID = process.env.CLIENTE_ID;  // OBLIGATORIO
const PORT = process.env.PORT || 3001;      // Opcional (default: 3001)
```

**Uso:**
```bash
CLIENTE_ID=51 npm start
```

### Event Handlers Registrados

**Archivo:** `client.js` líneas 107-178

- `qr` → Genera QR para escanear (línea 110)
- `ready` → Sesión lista para enviar mensajes (línea 117)
- `authenticated` → Autenticación exitosa (línea 124)
- `auth_failure` → Fallo de autenticación (línea 129)
- `disconnected` → Desconexión con clasificación (línea 136)
- `change_state` → Cambio de estado interno (línea 171)
- `loading_screen` → Progreso de carga (línea 175)

---

## ⚠️ Observaciones Importantes

### 1. Instancia Única por Proceso

**Código:** Línea 75-78
```javascript
if (clientInstance) {
  console.log(`[WhatsApp] Client already initialized for cliente_id: ${clienteId}`);
  return;
}
```

**Implicación:**
- Cada instancia del session-manager maneja **UN SOLO cliente**
- Para múltiples clientes, se necesitan múltiples procesos
- Arquitectura: 1 proceso PM2 por `clienteId`

### 2. Recuperación Automática de Sesión

**Código:** Líneas 89-95
```javascript
const hasSession = hasExistingSession(clienteId);

if (hasSession) {
  updateState(SessionState.RECONNECTING, 'Recovering existing session from disk');
} else {
  updateState(SessionState.INITIALIZING, 'First time initialization - no session found');
}
```

**Comportamiento:**
- Si existe sesión en disco → Intenta reconectar automáticamente
- Si NO existe → Genera QR para primer escaneo
- No requiere escaneo QR en cada reinicio del servicio

### 3. Límite de Reintentos de Reconexión

**Código:** Línea 40
```javascript
const MAX_RECONNECTION_ATTEMPTS = 3;
```

**Lógica:** Líneas 158-166
```javascript
if (reconnectionAttempts < MAX_RECONNECTION_ATTEMPTS) {
  reconnectionAttempts++;
  updateState(SessionState.DISCONNECTED_RECOVERABLE, ...);
} else {
  updateState(SessionState.ERROR, 'Max reconnection attempts reached');
}
```

**Implicación:**
- Después de 3 intentos fallidos → Estado ERROR
- Requiere intervención manual o reinicio del proceso

---

## 🎯 Conclusión

El sistema utiliza **`whatsapp-web.js`** con estrategia **`LocalAuth`** para gestionar sesiones persistentes en disco. Cada cliente tiene un directorio aislado generado dinámicamente: `./sessions/cliente_<ID>/`. El cliente se inicializa automáticamente al arrancar el proceso via `index.js`, con recuperación automática de sesión si existe en disco.

**Arquitectura actual:**
- ✅ Multi-tenant por proceso (1 proceso = 1 cliente)
- ✅ Persistencia en disco local
- ✅ Recuperación automática sin re-escaneo QR
- ✅ Gestión explícita de estados (9 estados)
- ⚠️  No soporta múltiples clientes en un solo proceso

---

**Generado:** 7 de enero de 2026  
**Autor:** GitHub Copilot (Claude Sonnet 4.5)  
**Estado:** Diagnóstico completo sin modificaciones de código
