git status# Login Local WhatsApp - Quick Start

## El Problema
WhatsApp bloquea QR en modo headless → **Solución: Login local con Chrome visible, luego copiar tokens al servidor**

---

## Uso Rápido

### 1️⃣ Primera vez (Máquina Local)

```bash
cd /root/leadmaster-workspace/services/session-manager

# Opción A: Script automático (recomendado)
./scripts/test-local-login.sh

# Opción B: Manual
export LOGIN_MODE=local
pm2 start ecosystem.config.js --env local
curl -X POST http://localhost:3001/connect
# Escanear QR en ventana de Chrome que se abre
```

**Resultado:** Tokens guardados en `tokens/admin/`

---

### 2️⃣ Copiar al Servidor (VPS)

```bash
# Desde máquina local
rsync -avz tokens/admin/ user@vps:/path/to/session-manager/tokens/admin/
```

---

### 3️⃣ Producción (Servidor con tokens)

```bash
# En el servidor
cd /path/to/session-manager
export LOGIN_MODE=server  # O dejarlo en default
pm2 start ecosystem.config.js
curl http://localhost:3001/status
# Debe mostrar: "state": "READY" (sin pedir QR)
```

---

## Variables de Entorno

| Variable | Valor | Comportamiento |
|----------|-------|----------------|
| `LOGIN_MODE` | `local` | Chrome **visible** → Escanear QR |
| `LOGIN_MODE` | `server` | Chrome **headless** → Reutilizar tokens |
| Sin setear | `server` | Default: headless |

---

## Troubleshooting

### Chrome no se abre
```bash
echo $LOGIN_MODE  # Debe mostrar: local
pm2 logs session-manager | grep "Modo de login"
# Buscar: "Modo de login: local (headless: false)"
```

### VPS pide QR aunque copié tokens
```bash
ls -la tokens/admin/  # Verificar que existen
pm2 env 0 | grep LOGIN_MODE  # Debe mostrar: server o vacío
pm2 restart session-manager --update-env
```

### Error "Was disconnected!"
WhatsApp desvinculó el dispositivo:
```bash
rm -rf tokens/admin/
./scripts/test-local-login.sh  # Repetir login local
# Copiar nuevos tokens al servidor
```

---

## Documentación Completa

Ver: [docs/LOCAL_LOGIN_SETUP.md](docs/LOCAL_LOGIN_SETUP.md)

---

## Comandos Útiles

```bash
# Ver logs
pm2 logs session-manager --lines 50

# Estado actual
curl http://localhost:3001/status

# Reiniciar con nueva config
pm2 restart session-manager --update-env

# Variables de entorno de PM2
pm2 env 0
```
