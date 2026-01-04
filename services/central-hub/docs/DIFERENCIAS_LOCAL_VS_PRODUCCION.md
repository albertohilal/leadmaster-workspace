# Diferencias: Entorno Local vs Contabo (Producción)

**Fecha:** 21 de diciembre de 2025

---

## 🎯 Resumen Ejecutivo

El sistema tiene configuraciones y comportamientos diferentes entre el entorno de desarrollo local y el servidor de producción en Contabo. Esta guía documenta todas las diferencias críticas.

---

## 1. Gestor de Procesos

### 🏠 Local
```bash
# Inicio manual cada vez
cd /home/beto/Documentos/Github/leadmaster-central-hub
PORT=3012 node src/index.js

# Detener: Ctrl+C
# Si cierras la terminal, el proceso termina
```

### ☁️ Contabo
```bash
# PM2 gestiona el proceso automáticamente
pm2 start src/index.js --name leadmaster-central-hub

# Características:
✅ Auto-restart si el proceso falla
✅ Logs centralizados
✅ Monitoreo de recursos
✅ Se mantiene tras reboot del servidor (pm2 startup)

# Comandos útiles:
pm2 list                          # Ver procesos
pm2 logs leadmaster-central-hub   # Ver logs en tiempo real
pm2 restart leadmaster-central-hub # Reiniciar
pm2 stop leadmaster-central-hub   # Detener
pm2 delete leadmaster-central-hub # Eliminar
```

---

## 2. Servidor Web y Enrutamiento

### 🏠 Local

**Backend:**
- Acceso directo: `http://localhost:3012`
- Sin proxy, sin nginx

**Frontend:**
```bash
cd frontend
npm run dev  # Vite dev server en puerto 5173
```
- Hot-reload automático
- Acceso: `http://localhost:5173`
- Apunta a backend local

### ☁️ Contabo

**Nginx (Reverse Proxy):**
```nginx
# Puerto 443 (HTTPS)
server {
    server_name desarrolloydisenioweb.com.ar;
    
    # Frontend estático compilado
    root /root/leadmaster-central-hub/frontend/dist;
    
    # Proxy a backend para todas las APIs
    location ~ ^/(auth|session-manager|sender|listener|sync-contacts|health)/ {
        proxy_pass http://localhost:3012;
        # Headers para WebSocket, IP real, etc.
    }
    
    # Certificado SSL de Let's Encrypt
    ssl_certificate /etc/letsencrypt/live/.../fullchain.pem;
}

# Redirección HTTP → HTTPS
server {
    listen 80;
    return 301 https://$server_name$request_uri;
}
```

**Frontend:**
```bash
cd frontend
npm run build  # Compila a dist/
# Nginx sirve archivos estáticos desde dist/
```

**Acceso público:**
- Frontend: `https://desarrolloydisenioweb.com.ar`
- Backend API: `https://desarrolloydisenioweb.com.ar/auth/*`, etc.

---

## 3. Variables de Entorno

### 🏠 Local

**Backend (`.env`):**
```bash
PORT=3012
NODE_ENV=development
DB_HOST=sv46.byethost46.org     # DB remota
DB_USER=iunaorg_b3toh
DB_PASSWORD=elgeneral2018
DB_NAME=iunaorg_dyd
JWT_SECRET=leadmaster_jwt_secret_key_super_secure_2025
```

**Frontend (`frontend/.env`):**
```bash
VITE_API_URL=http://localhost:3012  # ⚠️ Apunta a backend local
```

### ☁️ Contabo

**Backend (`.env`):**
```bash
PORT=3012
NODE_ENV=production              # ⚠️ Producción
DB_HOST=sv46.byethost46.org
DB_USER=iunaorg_b3toh
DB_PASSWORD=elgeneral2018
DB_NAME=iunaorg_dyd
JWT_SECRET=leadmaster_jwt_secret_key_super_secure_2025

# Google OAuth con URL pública
GOOGLE_REDIRECT_URI=https://desarrolloydisenioweb.com.ar/sync-contacts/callback
```

**Frontend (`frontend/.env`):**
```bash
VITE_API_URL=https://desarrolloydisenioweb.com.ar  # ⚠️ Dominio público
```

**⚠️ IMPORTANTE:** 
- Los archivos `.env` están en `.gitignore`
- Debes configurarlos manualmente en cada servidor
- NO subas credenciales a GitHub

---

## 4. SSL/Seguridad

### 🏠 Local
- HTTP sin cifrar: `http://localhost:3012`
- Certificados SSL no necesarios
- CORS más permisivo para desarrollo

### ☁️ Contabo
- HTTPS obligatorio (Let's Encrypt)
- Redirección automática HTTP → HTTPS
- Headers de seguridad configurados en Nginx
- CORS configurado para dominio específico

---

## 5. Persistencia y Disponibilidad

### 🏠 Local

**Backend:**
- Se detiene al cerrar terminal
- No se reinicia automáticamente
- Solo disponible mientras trabajas

**Frontend:**
- Vite dev server activo mientras lo ejecutas
- Hot-reload para cambios instantáneos

### ☁️ Contabo

**Backend:**
- PM2 mantiene proceso corriendo 24/7
- Auto-restart si el proceso falla
- Configurado para iniciar tras reboot del servidor
```bash
pm2 startup  # Configura inicio automático
pm2 save     # Guarda configuración actual
```

**Frontend:**
- Archivos estáticos servidos por Nginx
- Siempre disponible mientras Nginx esté corriendo
- No requiere proceso Node.js

---

## 6. Build y Compilación

### 🏠 Local

```bash
# Backend: Sin build, ejecuta directamente
node src/index.js

# Frontend: Modo desarrollo
cd frontend
npm run dev  # Vite dev server con hot-reload
```

### ☁️ Contabo

```bash
# Backend: Sin build, ejecuta con PM2
pm2 start src/index.js

# Frontend: Build para producción
cd frontend
npm run build
# Genera: frontend/dist/ con HTML/CSS/JS optimizados
# Nginx sirve estos archivos estáticos
```

---

## 7. WhatsApp / venom-bot

### 🏠 Local

**Configuración:**
```javascript
venom.create({
  headless: false,  // Chrome visible en tu escritorio
  useChrome: true,
  executablePath: '/usr/bin/google-chrome-stable'
})
```

**Características:**
- Chrome se abre en ventana visible
- QR visible en la ventana del navegador
- Fácil de escanear directamente
- Logs en consola en tiempo real

### ☁️ Contabo

**Configuración:**
```javascript
venom.create({
  headless: true,   // ⚠️ Sin interfaz gráfica
  useChrome: true,
  // O usar Xvfb para display virtual
})
```

**Características:**
- Servidor sin interfaz gráfica (headless)
- QR disponible solo por API: `GET /session-manager/qr`
- Requiere Xvfb si headless: false
- Logs capturados por PM2

**Alternativa con Xvfb:**
```bash
# Instalar display virtual
sudo apt-get install xvfb

# Iniciar con Xvfb
xvfb-run --server-args="-screen 0 1920x1080x24" pm2 start src/index.js
```

---

## 8. Logs y Debugging

### 🏠 Local

```bash
# Logs directos en terminal
console.log() → se ve inmediatamente
console.error() → se ve en rojo

# Ctrl+C para detener y ver stack traces completos
```

### ☁️ Contabo

```bash
# PM2 captura todos los logs
pm2 logs leadmaster-central-hub           # Tiempo real
pm2 logs leadmaster-central-hub --lines 50  # Últimas 50 líneas
pm2 logs --err                            # Solo errores

# Logs también en archivos
~/.pm2/logs/leadmaster-central-hub-out.log
~/.pm2/logs/leadmaster-central-hub-error.log

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

---

## 9. Workflow de Deploy

### 🏠 Local → Contabo

**1. Desarrollo Local:**
```bash
cd /home/beto/Documentos/Github/leadmaster-central-hub

# Hacer cambios
# Probar localmente: npm run dev / node src/index.js

# Commitear
git add .
git commit -m "Descripción"
git push origin main
```

**2. Deploy en Contabo:**
```bash
# SSH a Contabo
ssh root@vmi123456.contaboserver.net

# Ejecutar script de deploy
cd ~/leadmaster-central-hub
git pull origin main
npm install

# Si hay cambios en frontend
cd frontend
npm install
npm run build
cd ..

# Reiniciar backend
pm2 restart leadmaster-central-hub

# Verificar
pm2 logs leadmaster-central-hub --lines 20
```

**Script automatizado (`deploy.sh`):**
```bash
#!/bin/bash
cd ~/leadmaster-central-hub
git pull origin main
npm install
cd frontend && npm install && npm run build && cd ..
pm2 restart leadmaster-central-hub
pm2 logs --lines 10
```

---

## 10. Base de Datos

### 🏠 Local
```bash
DB_HOST=sv46.byethost46.org  # Conexión remota a MySQL compartido
# Mismo que Contabo (base de datos compartida)
```

### ☁️ Contabo
```bash
DB_HOST=sv46.byethost46.org  # Misma base de datos remota
# Alternativa: MySQL local en Contabo si se requiere
```

**⚠️ Nota:** Ambos entornos usan la MISMA base de datos remota. Ten cuidado con:
- Datos de prueba vs producción
- Tokens de sesión WhatsApp compartidos

---

## 11. Puertos y Firewall

### 🏠 Local
- Backend: `3012` (solo localhost)
- Frontend dev: `5173` (solo localhost)
- Firewall: Generalmente sin restricciones

### ☁️ Contabo
- Nginx: `80` (HTTP) y `443` (HTTPS) - Público
- Backend: `3012` - Solo localhost (no expuesto)
- Frontend: Servido por Nginx en 443
- Firewall: Configurado para permitir solo 80/443/22(SSH)

```bash
# Ver puertos abiertos
sudo ufw status
sudo netstat -tlnp
```

---

## 12. Dependencias del Sistema

### 🏠 Local
```bash
# Ubuntu Desktop con GUI
sudo apt install nodejs npm google-chrome-stable
```

### ☁️ Contabo
```bash
# Ubuntu Server (sin GUI)
sudo apt install nodejs npm nginx certbot python3-certbot-nginx
npm install -g pm2

# Para WhatsApp con venom-bot
sudo apt install chromium-browser xvfb
```

---

## 🎯 Checklist de Configuración

### Configurar nuevo servidor (Contabo):

- [ ] Instalar Node.js, npm, pm2, nginx
- [ ] Clonar repositorio desde GitHub (SSH)
- [ ] Configurar `.env` backend (producción)
- [ ] Configurar `.env` frontend con URL pública
- [ ] Build frontend: `cd frontend && npm run build`
- [ ] Configurar nginx con proxy reverso
- [ ] Obtener certificado SSL: `certbot --nginx`
- [ ] Iniciar backend con PM2
- [ ] Configurar PM2 startup automático
- [ ] Verificar logs: `pm2 logs`
- [ ] Probar endpoints: `https://dominio.com/health`

---

## 📚 Referencias

- [DEPLOY_CONTABO.md](DEPLOY_CONTABO.md) - Guía completa de deployment
- [GUIA_DEPLOYMENT.md](docs/GUIA_DEPLOYMENT.md) - Configuración detallada
- [PM2 Documentation](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [Nginx Reverse Proxy](https://docs.nginx.com/nginx/admin-guide/web-server/reverse-proxy/)

---

**Última actualización:** 21 de diciembre de 2025
