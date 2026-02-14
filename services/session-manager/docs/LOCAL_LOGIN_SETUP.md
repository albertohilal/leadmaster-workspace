# Setup de Login Local para WhatsApp (Venom Bot)

## Problema
WhatsApp bloquea el QR en modo headless en servidores VPS, por lo que la primera autenticación debe hacerse localmente con Chrome visible.

## Solución: Login Local + Transferencia de Tokens

### 1. Primera Autenticación (MÁQUINA LOCAL)

#### Paso 1: Configurar modo local
```bash
cd /root/leadmaster-workspace/services/session-manager
export LOGIN_MODE=local
```

#### Paso 2: Iniciar session-manager
```bash
# Opción A: Con PM2
pm2 start ecosystem.config.js --update-env

# Opción B: Directamente con Node
node src/index.js
```

#### Paso 3: Conectar WhatsApp
```bash
# Hacer POST a /connect para iniciar el proceso
curl -X POST http://localhost:3001/connect

# Se abrirá ventana de Chrome con QR de WhatsApp
# Escanear con WhatsApp móvil
```

#### Paso 4: Verificar estado READY
```bash
curl http://localhost:3001/status
# Debe mostrar: {"connected":true,"state":"READY","session":"admin"}
```

#### Paso 5: Tokens generados
Los tokens quedan en:
```
session-manager/tokens/admin/
```

---

### 2. Transferencia al Servidor (VPS)

#### Opción A: rsync (recomendado)
```bash
rsync -avz \
  /root/leadmaster-workspace/services/session-manager/tokens/admin/ \
  user@your-vps-ip:/path/to/session-manager/tokens/admin/
```

#### Opción B: scp
```bash
scp -r \
  /root/leadmaster-workspace/services/session-manager/tokens/admin \
  user@your-vps-ip:/path/to/session-manager/tokens/
```

#### Opción C: Comprimir y transferir
```bash
# En máquina local
cd /root/leadmaster-workspace/services/session-manager
tar czf admin-tokens.tar.gz tokens/admin/

# Transferir
scp admin-tokens.tar.gz user@your-vps-ip:/tmp/

# En el servidor
cd /path/to/session-manager
tar xzf /tmp/admin-tokens.tar.gz
```

---

### 3. Ejecución en Producción (VPS)

#### Paso 1: Verificar tokens copiados
```bash
ls -la tokens/admin/
# Debe mostrar archivos de sesión
```

#### Paso 2: Configurar modo servidor (headless)
```bash
# En ecosystem.config.js o .env
export LOGIN_MODE=server
```

#### Paso 3: Iniciar session-manager
```bash
pm2 start ecosystem.config.js --update-env
pm2 save
```

#### Paso 4: Verificar conexión automática
```bash
curl http://localhost:3001/status
# Debe mostrar: {"connected":true,"state":"READY","session":"admin"}
# Sin necesidad de volver a escanear QR
```

---

## Variables de Entorno

### `LOGIN_MODE`

| Valor | Descripción | Uso |
|-------|-------------|-----|
| `local` | Chrome visible, QR en ventana | Primera autenticación en máquina local |
| `server` | Chrome headless, sin ventana | Producción en VPS con tokens existentes |

**Default:** `server`

---

## Configuración en PM2

### ecosystem.config.js
```javascript
module.exports = {
  apps: [{
    name: 'session-manager',
    script: './src/index.js',
    cwd: '/path/to/session-manager',
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
      LOGIN_MODE: 'server' // <-- Modo servidor en producción
    },
    env_local: {
      NODE_ENV: 'development',
      PORT: 3001,
      LOGIN_MODE: 'local' // <-- Modo local para primera vez
    }
  }]
};
```

### Uso
```bash
# Modo local (primera vez)
pm2 start ecosystem.config.js --env local

# Modo servidor (producción)
pm2 start ecosystem.config.js --env production
```

---

## Arquitectura

### Sesión Única ADMIN
- **Una sola sesión** de WhatsApp para todo el sistema
- Tokens en: `tokens/admin/`
- `cliente_id` es solo metadata (NO crea sesiones)

### Estados de adminState
1. `DISCONNECTED` - Sin conexión
2. `CONNECTING` - Iniciando Chrome/WhatsApp
3. `QR_REQUIRED` - Esperando escaneo de QR (solo primera vez)
4. `READY` - Conectado y listo para enviar

### Flujo Normal
```
Login Local → CONNECTING → QR_REQUIRED → READY → Copiar tokens → VPS
VPS con tokens → CONNECTING → READY (sin QR)
```

---

## Troubleshooting

### Chrome no se abre en modo local
```bash
# Verificar variable de entorno
echo $LOGIN_MODE
# Debe mostrar: local

# Verificar logs
pm2 logs session-manager
# Buscar: "Modo de login: local (headless: false)"
```

### VPS pide QR aunque tengo tokens
```bash
# Verificar que tokens existen
ls -la tokens/admin/

# Verificar permisos
chmod -R 755 tokens/admin/

# Verificar LOGIN_MODE
pm2 env 0 | grep LOGIN_MODE
# Debe mostrar: server
```

### Error "Was disconnected!"
WhatsApp desvinculó la sesión desde el móvil. Solución:
1. Borrar tokens: `rm -rf tokens/admin/`
2. Volver a hacer login local (Paso 1)
3. Copiar nuevos tokens al servidor (Paso 2)

---

## Comandos Útiles

```bash
# Ver logs en tiempo real
pm2 logs session-manager --lines 50

# Verificar estado
curl http://localhost:3001/status

# Reiniciar con nueva configuración
pm2 restart session-manager --update-env

# Ver variables de entorno
pm2 env 0
```

---

## Seguridad

### Proteger tokens en el servidor
```bash
# Permisos restrictivos
chmod 700 tokens/admin/
chown -R pm2-user:pm2-user tokens/admin/
```

### Backup de tokens
```bash
# Hacer backup periódico
tar czf backup-admin-tokens-$(date +%Y%m%d).tar.gz tokens/admin/
```

---

## Notas Importantes

1. **Solo necesitas hacer login local UNA VEZ** por sesión de WhatsApp
2. Los tokens son **reutilizables** en múltiples reinicios del servidor
3. Si WhatsApp desvincula la sesión, hay que repetir el login local
4. **No ejecutar** LOGIN_MODE=local en el VPS (no tiene display)
5. **No borrar** tokens/admin/ en producción sin tener backup
