# 📁 UBICACIÓN DE SESIONES DE WHATSAPP
**Fecha:** 2026-02-12  
**Sistema:** LeadMaster Workspace

---

## 🎯 RESUMEN EJECUTIVO

Las sesiones de WhatsApp se guardan en **dos ubicaciones diferentes** dependiendo de qué servicio las gestiona:

### 1️⃣ **Session Manager (Servicio Independiente)**
- **Ubicación actual:** `/root/leadmaster-workspace/services/session-manager/tokens/admin/`
- **Tamaño:** 922 MB
- **Contenido:** Sesión de Chrome completa con perfil de usuario
- **Tecnología:** `whatsapp-web.js` + `LocalAuth`

### 2️⃣ **Central Hub (Módulo Integrado)**
- **Ubicación:** `/root/leadmaster-workspace/services/central-hub/tokens/.wwebjs_auth/session-{sessionName}/`
- **Estado:** Vacío (sin sesiones activas)
- **Arquitectura preparada pero no en uso**

---

## 📂 ESTRUCTURA DETALLADA

### Session Manager (Activo)

```
/root/leadmaster-workspace/services/session-manager/
├── tokens/
│   └── admin/                          ← SESIÓN ACTIVA (922 MB)
│       ├── Default/
│       │   ├── IndexedDB/              ← Base de datos local de WhatsApp
│       │   ├── Local Storage/          ← Almacenamiento local
│       │   ├── Session Storage/
│       │   └── Service Worker/
│       ├── Local State                 ← Estado de Chrome
│       ├── BrowserMetrics-spare.pma    ← Métricas del navegador
│       └── DevToolsActivePort          ← Puerto de DevTools
│
└── .wwebjs_cache/                      ← Cache temporal (432 KB)
    └── 2.3000.1032178752.html          ← WhatsApp Web HTML
```

### Central Hub (Preparado, no activo)

```
/root/leadmaster-workspace/services/central-hub/
└── tokens/                             ← VACÍO
    └── .wwebjs_auth/                   ← Estructura preparada
        └── session-{sessionName}/      ← Por cliente (no existe aún)
```

---

## 🔧 CONFIGURACIÓN DEL ALMACENAMIENTO

### Session Manager - `whatsapp/client.js`

```javascript
const client = new Client({
  authStrategy: new LocalAuth({
    clientId: `cliente_${id}`,
    dataPath: './sessions/cliente_${id}' // ⚠️ No existe carpeta "sessions"
  }),
  puppeteer: {
    executablePath: '/usr/bin/google-chrome',
    headless: 'old',
    // ...
  }
});
```

**⚠️ DISCREPANCIA DETECTADA:**
- El código menciona `./sessions/cliente_{id}`
- Pero la realidad es `./tokens/admin/`
- La sesión actual usa el nombre **"admin"**

---

### Central Hub - `sessionService.js`

```javascript
const client = new Client({
  authStrategy: new LocalAuth({
    clientId: name,
    dataPath: path.join(__dirname, '../../../tokens')
  }),
  puppeteer: {
    executablePath: '/usr/bin/google-chrome-stable',
    headless: true,
    // ...
  }
});
```

**Ruta absoluta:** `/root/leadmaster-workspace/services/central-hub/tokens/`

---

## 📊 ANÁLISIS DE CONTENIDO

### ¿Qué contiene la carpeta `tokens/admin/`?

| Carpeta/Archivo | Descripción | Importancia |
|----------------|-------------|-------------|
| **Default/IndexedDB/** | Base de datos de WhatsApp (mensajes, contactos, chats) | ⭐⭐⭐ CRÍTICO |
| **Default/Local Storage/** | Configuración y tokens de sesión | ⭐⭐⭐ CRÍTICO |
| **Default/Service Worker/** | Cache del service worker de WhatsApp | ⭐⭐ Importante |
| **Local State** | Estado global de Chrome (configuración, permisos) | ⭐⭐⭐ CRÍTICO |
| **BrowserMetrics-spare.pma** | Métricas de rendimiento (no esencial) | ⭐ Opcional |
| **DevToolsActivePort** | Puerto de DevTools (temporal) | ⭐ Temporal |

---

## 🔐 SEGURIDAD Y RESPALDO

### ⚠️ ARCHIVOS CRÍTICOS (RESPALDAR)

```bash
# Carpeta completa de sesión (922 MB)
/root/leadmaster-workspace/services/session-manager/tokens/admin/

# Archivos esenciales mínimos (~50-100 MB)
/root/leadmaster-workspace/services/session-manager/tokens/admin/Default/IndexedDB/
/root/leadmaster-workspace/services/session-manager/tokens/admin/Default/Local Storage/
/root/leadmaster-workspace/services/session-manager/tokens/admin/Local State
```

### 📦 Comando de Respaldo

```bash
# Respaldo completo
tar -czf whatsapp-session-backup-$(date +%Y%m%d).tar.gz \
  /root/leadmaster-workspace/services/session-manager/tokens/admin/

# Respaldo selectivo (solo esenciales)
tar -czf whatsapp-session-minimal-$(date +%Y%m%d).tar.gz \
  /root/leadmaster-workspace/services/session-manager/tokens/admin/Default/IndexedDB \
  /root/leadmaster-workspace/services/session-manager/tokens/admin/Default/Local\ Storage \
  /root/leadmaster-workspace/services/session-manager/tokens/admin/Local\ State
```

---

## 🔄 PROCESO DE AUTENTICACIÓN

### Flujo de Login

```
1. Usuario solicita conexión
   ↓
2. whatsapp-web.js busca sesión en tokens/admin/
   ↓
   ├─ SÍ existe → Intenta reconexión automática (RECONNECTING)
   │  ↓
   │  ├─ Éxito → Estado READY
   │  └─ Falla → Requiere nuevo QR (QR_REQUIRED)
   │
   └─ NO existe → Genera QR (INITIALIZING)
      ↓
      Usuario escanea QR
      ↓
      Chrome guarda sesión en tokens/admin/
      ↓
      Estado READY
```

### Persistencia de Sesión

**LocalAuth** de `whatsapp-web.js` guarda automáticamente:
- ✅ Cookies de sesión
- ✅ Tokens de autenticación
- ✅ Base de datos IndexedDB de WhatsApp
- ✅ Estado del navegador Chrome
- ✅ Service Workers

**Resultado:** La sesión persiste entre reinicios del servidor.

---

## 📝 MÉTODO DE LOGIN ACTUAL

Según [LOGIN_LOCAL_README.md](services/session-manager/LOGIN_LOCAL_README.md):

### Modo Local (Desarrollo)
```bash
LOGIN_MODE=local npm start
```
- Chrome visible (headful)
- Usuario escanea QR manualmente
- Tokens se guardan en `tokens/admin/`

### Modo Server (Producción)
```bash
LOGIN_MODE=server npm start
```
- Chrome headless
- Reutiliza tokens existentes de `tokens/admin/`
- NO muestra QR (requiere sesión previa)

### Transferencia de Sesión (Local → VPS)

```bash
# Desde máquina local con sesión activa
rsync -avz tokens/admin/ user@vps:/root/leadmaster-workspace/services/session-manager/tokens/admin/
```

---

## 🐛 PROBLEMAS CONOCIDOS

### 1. **Discrepancia en rutas de código**

**Código dice:**
```javascript
dataPath: './sessions/cliente_${id}'
```

**Realidad:**
```
tokens/admin/
```

**Causa:** La carpeta `sessions/` no existe. El código parece configurado para multi-cliente pero solo usa `admin`.

---

### 2. **Central Hub no usa sus propios tokens**

La carpeta `/root/leadmaster-workspace/services/central-hub/tokens/` está vacía.

**Posibles razones:**
- Central Hub proxy a Session Manager (no gestiona sesiones directamente)
- Arquitectura preparada para futura implementación
- Session Manager es el único autorizado para gestionar WhatsApp

---

## 🎯 RECOMENDACIONES

### 🔒 Seguridad

1. **Respaldo diario automático:**
   ```bash
   # Cron job
   0 2 * * * tar -czf /backups/whatsapp-session-$(date +\%Y\%m\%d).tar.gz \
     /root/leadmaster-workspace/services/session-manager/tokens/admin/
   ```

2. **Permisos restrictivos:**
   ```bash
   chmod 700 /root/leadmaster-workspace/services/session-manager/tokens/admin/
   chown -R root:root /root/leadmaster-workspace/services/session-manager/tokens/
   ```

3. **Excluir de Git:**
   Verificar que `tokens/` está en `.gitignore`

---

### 🚀 Mejoras

1. **Unificar código con realidad:**
   - Cambiar `./sessions/` por `./tokens/` en el código
   - O mover `tokens/admin/` a `sessions/admin/`

2. **Implementar multi-cliente:**
   - Crear `tokens/cliente_1/`, `tokens/cliente_2/`, etc.
   - Actualizar lógica de `clientId` en LocalAuth

3. **Monitoreo de espacio:**
   ```bash
   # Alertar si tokens/ supera 1GB
   du -sm tokens/ | awk '$1 > 1024 {print "WARNING: WhatsApp session exceeds 1GB"}'
   ```

---

## 🔍 COMANDOS ÚTILES

### Ver tamaño de sesión
```bash
du -sh /root/leadmaster-workspace/services/session-manager/tokens/admin/
```

### Listar archivos recientes (últimas modificaciones)
```bash
find /root/leadmaster-workspace/services/session-manager/tokens/admin/ \
  -type f -mtime -1 -ls
```

### Verificar si existe sesión válida
```bash
test -f /root/leadmaster-workspace/services/session-manager/tokens/admin/Default/IndexedDB/https_web.whatsapp.com_0.indexeddb.leveldb/CURRENT \
  && echo "✅ Sesión válida" || echo "❌ Sin sesión"
```

### Limpiar sesión (forzar nuevo login)
```bash
# ⚠️ CUIDADO: Esto borra la sesión, requerirá nuevo QR
rm -rf /root/leadmaster-workspace/services/session-manager/tokens/admin/
```

---

## 📚 ARCHIVOS DE REFERENCIA

| Archivo | Descripción |
|---------|-------------|
| [whatsapp/client.js](services/session-manager/whatsapp/client.js) | Gestión de cliente WhatsApp |
| [sessionService.js](services/central-hub/src/modules/session-manager/services/sessionService.js) | Servicio de sesión en Central Hub |
| [LOGIN_LOCAL_README.md](services/session-manager/LOGIN_LOCAL_README.md) | Documentación de login local/server |

---

## 🎯 CONCLUSIÓN

**Sesión activa de WhatsApp:**
```
📍 /root/leadmaster-workspace/services/session-manager/tokens/admin/
📊 922 MB
🔐 Contiene: Sesión de Chrome + IndexedDB de WhatsApp
🔄 Persiste entre reinicios
⚠️ CRÍTICO: Respaldar regularmente
```

**Estado actual:** 
- ✅ Session Manager: Operativo con sesión persistente
- ⚠️ Central Hub: Preparado pero sin sesiones activas
- ⚠️ Discrepancia entre código (`./sessions/`) y realidad (`./tokens/`)

---

**Archivo generado:** `/root/leadmaster-workspace/INFORME_ALMACENAMIENTO_SESIONES_WHATSAPP.md`
