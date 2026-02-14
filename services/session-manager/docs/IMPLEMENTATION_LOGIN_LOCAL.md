# Implementación: Login Local WhatsApp

## Fecha
2026-01-20

## Problema Resuelto
WhatsApp bloquea el QR en modo headless en servidores VPS, impidiendo la primera autenticación.

## Solución Implementada
Modo de login configurable por variable de entorno `LOGIN_MODE`:
- **`local`**: Chrome visible para primera autenticación
- **`server`**: Chrome headless para producción (reutiliza tokens)

---

## Cambios Realizados

### 1. `/whatsapp/venom-session.js`

#### Variables y constantes agregadas:
```javascript
const LOGIN_MODE = process.env.LOGIN_MODE || 'server';
const isLocalLogin = LOGIN_MODE === 'local';
```

#### Configuración de venom.create() modificada:
```javascript
{
  session: 'admin',
  headless: !isLocalLogin,           // ← Configurable
  logQR: isLocalLogin,                // ← Muestra QR en consola en modo local
  browserArgs: [
    // ...
    ...(isLocalLogin ? [] : ['--disable-gpu'])  // ← GPU solo en servidor
  ],
  puppeteerOptions: {
    headless: !isLocalLogin           // ← Configurable
  }
}
```

#### Documentación en comentarios:
- Flujo de autenticación detallado
- Instrucciones de uso de LOGIN_MODE
- Comando rsync para copiar tokens

---

### 2. `/ecosystem.config.js`

#### Ambientes PM2 agregados:
```javascript
env: {
  NODE_ENV: 'production',
  PORT: 3001,
  LOGIN_MODE: 'server'    // ← Default para producción
},
env_local: {
  NODE_ENV: 'development',
  PORT: 3001,
  LOGIN_MODE: 'local'     // ← Para primera autenticación
}
```

#### Uso:
```bash
pm2 start ecosystem.config.js --env local      # Login local
pm2 start ecosystem.config.js --env production # Producción
```

---

### 3. Documentación Creada

#### `docs/LOCAL_LOGIN_SETUP.md` (completo)
- Problema y solución
- Paso a paso detallado:
  1. Login local (máquina local)
  2. Transferencia de tokens (rsync/scp)
  3. Ejecución en producción (VPS)
- Variables de entorno
- Configuración PM2
- Arquitectura de sesión única
- Troubleshooting
- Comandos útiles
- Notas de seguridad

#### `LOGIN_LOCAL_README.md` (quick start)
- Instrucciones rápidas
- Tabla de variables
- Troubleshooting común
- Comandos útiles

---

### 4. Script de Testing

#### `scripts/test-local-login.sh`
Script interactivo que:
1. Verifica/borra tokens existentes
2. Detiene session-manager si está corriendo
3. Inicia en modo local con PM2
4. Dispara `/connect`
5. Monitorea estado cada 10 segundos
6. Detecta READY automáticamente
7. Muestra instrucciones de próximos pasos

**Uso:**
```bash
./scripts/test-local-login.sh
```

---

## Flujo de Trabajo Completo

### Primera Autenticación (Máquina Local)
```bash
cd /root/leadmaster-workspace/services/session-manager
export LOGIN_MODE=local
pm2 start ecosystem.config.js --env local
curl -X POST http://localhost:3001/connect
# Escanear QR en ventana de Chrome
# Esperar estado READY
```

### Transferencia al Servidor
```bash
rsync -avz tokens/admin/ user@vps:/path/to/session-manager/tokens/admin/
```

### Producción (VPS)
```bash
cd /path/to/session-manager
export LOGIN_MODE=server  # O default
pm2 start ecosystem.config.js
curl http://localhost:3001/status
# {"connected":true,"state":"READY","session":"admin"}
```

---

## Compatibilidad

### ✅ Mantenido
- Arquitectura de sesión única ADMIN
- Estados: DISCONNECTED → CONNECTING → QR_REQUIRED → READY
- Idempotencia de `/connect`
- Metadata `cliente_id` (no crea sesiones)
- API pública sin cambios
- PM2 ecosystem
- Variables adminClient, adminState, qrData

### ➕ Agregado
- Variable de entorno `LOGIN_MODE`
- Configuración headless dinámica
- Log de modo al inicio
- Documentación extensa
- Script de testing

### ❌ Sin cambios
- Endpoints HTTP
- Lógica de estados
- Función isConnected()
- Función sendMessage()
- Manejo de errores

---

## Testing

### Modo Local
```bash
export LOGIN_MODE=local
node src/index.js
# Verificar: Chrome se abre con ventana visible
```

### Modo Servidor
```bash
export LOGIN_MODE=server
node src/index.js
# Verificar: Chrome headless (sin ventana)
```

### Logs esperados
```
[VenomSession] Modo de login: local (headless: false)
[VenomSession] Iniciando conexión ADMIN
[VenomSession] QR generado para sesión ADMIN (intento 1)
[VenomSession] Estado ADMIN: waitForLogin
[VenomSession] Cambio de estado: waitForLogin → QR_REQUIRED
```

---

## Próximos Pasos (Recomendados)

1. **Probar en máquina local**:
   ```bash
   ./scripts/test-local-login.sh
   ```

2. **Verificar tokens generados**:
   ```bash
   ls -la tokens/admin/
   ```

3. **Copiar tokens al VPS de staging primero** (antes de producción)

4. **Validar en staging**:
   ```bash
   curl http://staging-vps:3001/status
   # Debe mostrar READY sin pedir QR
   ```

5. **Documentar en wiki del equipo** el procedimiento de renovación de tokens

---

## Notas Importantes

1. **Solo necesitas login local UNA VEZ** por sesión de WhatsApp
2. Los tokens son **persistentes** entre reinicios
3. Si WhatsApp desvincula la sesión ("Was disconnected!"):
   - Borrar tokens: `rm -rf tokens/admin/`
   - Repetir login local
   - Copiar nuevos tokens al servidor
4. **NO ejecutar** `LOGIN_MODE=local` en VPS sin display
5. **Backup de tokens** antes de actualizaciones

---

## Archivos Modificados/Creados

```
services/session-manager/
├── whatsapp/venom-session.js           (MODIFICADO - 30 líneas)
├── ecosystem.config.js                 (MODIFICADO - 6 líneas)
├── LOGIN_LOCAL_README.md               (NUEVO - quick start)
├── docs/LOCAL_LOGIN_SETUP.md           (NUEVO - documentación completa)
└── scripts/test-local-login.sh         (NUEVO - script de testing)
```

---

## Commit Sugerido

```bash
git add services/session-manager/
git commit -m "feat(session-manager): implement local login mode for WhatsApp

- Add LOGIN_MODE environment variable (local|server)
- Enable headless: false for local authentication
- Add comprehensive documentation and testing script
- Maintain single ADMIN session architecture
- Support token transfer workflow for VPS deployment

Resolves issue with WhatsApp QR blocking in headless mode
```
