# Deploy a Contabo - LeadMaster Central Hub

## Estado Actual del Sistema

✅ **Sistema en Producción:** https://desarrolloydisenioweb.com.ar  
✅ **Backend:** Node.js + Express en puerto 3012 (PM2)  
✅ **Frontend:** React + Vite compilado y servido por Nginx  
✅ **Base de Datos:** MySQL remota (sv46.byethost46.org)  
✅ **Autenticación:** JWT multi-cliente  
✅ **Módulos Activos:** Auth, Session-Manager, Sender, Listener, Sync-Contacts  

## Arquitectura de Despliegue

### Nginx (Puerto 80/443)
- **Puerto 443 (HTTPS):** Certificado SSL de Let's Encrypt
- **Frontend estático:** `/root/leadmaster-central-hub/frontend/dist`
- **Proxy reverso:** Rutas `/auth/*`, `/session-manager/*`, etc. → `localhost:3012`

### PM2 (Gestor de Procesos)
- **Proceso:** `leadmaster-central-hub`
- **Comando:** `PORT=3012 node src/index.js`
- **Auto-restart:** Habilitado
- **Logs:** `pm2 logs leadmaster-central-hub`

## 1. Workflow de Desarrollo y Deploy

### Desarrollo Local → GitHub → Contabo

**En tu máquina local:**
```bash
cd /home/beto/Documentos/Github/leadmaster-central-hub

# Hacer cambios y commitear
git add .
git commit -m "Descripción de los cambios"
git push origin main
```

**En Contabo:**
```bash
cd ~/leadmaster-central-hub
git pull origin main

# Si hay cambios en dependencias
npm install

# Si hay cambios en frontend
cd frontend
npm install
npm run build
cd ..

# Reiniciar backend
pm2 restart leadmaster-central-hub

# Verificar logs
pm2 logs leadmaster-central-hub --lines 20
```

### Script de Deploy Automático

**Crear en Contabo:**
```bash
nano ~/deploy.sh
```

**Contenido:**
```bash
#!/bin/bash
echo "🚀 Iniciando deploy..."
cd ~/leadmaster-central-hub

echo "📥 Pulling cambios de GitHub..."
git pull origin main

echo "📦 Instalando dependencias backend..."
npm install

echo "🎨 Building frontend..."
cd frontend
npm install
npm run build

echo "🔄 Reiniciando backend..."
cd ..
pm2 restart leadmaster-central-hub

echo "✅ Deploy completado"
pm2 logs leadmaster-central-hub --lines 10
```

**Dar permisos y usar:**
```bash
chmod +x ~/deploy.sh
~/deploy.sh
```

## 2. Configuración SSH para GitHub

✅ **Configurado:** Autenticación SSH sin tokens

**Clave pública agregada en GitHub:**
```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAKLrdNHs7P4e6FJAzkqgQMErlmEmHywOx9yyLY5DDhZ contabo-leadmaster
```

**Remote configurado:**
```bash
git remote -v
# origin  git@github.com:albertohilal/leadmaster-central-hub.git
```

## 3. Configuración de Nginx

**Archivo:** `/etc/nginx/sites-available/desarrolloydisenioweb.com.ar`

```nginx
server {
    server_name desarrolloydisenioweb.com.ar www.desarrolloydisenioweb.com.ar;

    root /root/leadmaster-central-hub/frontend/dist;
    index index.html;

    # Proxy para todas las rutas de API del backend
    location ~ ^/(auth|session-manager|sender|listener|sync-contacts|health)/ {
        proxy_pass http://localhost:3012;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Frontend estático
    location / {
        try_files $uri $uri/ /index.html;
    }

    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/desarrolloydisenioweb.com.ar/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/desarrolloydisenioweb.com.ar/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

server {
    listen 80;
    server_name desarrolloydisenioweb.com.ar www.desarrolloydisenioweb.com.ar;
    return 301 https://$server_name$request_uri;
}
```

**Aplicar cambios:**
```bash
sudo nginx -t && sudo systemctl restart nginx
```

## 4. Variables de Entorno

**Backend:** `/root/leadmaster-central-hub/.env`
```bash
PORT=3012
NODE_ENV=production

# Base de datos
DB_HOST=sv46.byethost46.org
DB_USER=iunaorg_b3toh
DB_PASSWORD=elgeneral2018
DB_NAME=iunaorg_dyd
DB_PORT=3306

# JWT
JWT_SECRET=leadmaster_jwt_secret_key_super_secure_2025
SESSION_SECRET=leadmaster_hub_secret_key_2025

# Google OAuth
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID_HERE
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET_HERE
GOOGLE_REDIRECT_URI=https://desarrolloydisenioweb.com.ar/sync-contacts/callback
```

**Frontend:** `/root/leadmaster-central-hub/frontend/.env`
```bash
VITE_API_URL=https://desarrolloydisenioweb.com.ar
```

⚠️ **Importante:** Los archivos `.env` están en `.gitignore` y NO se suben a GitHub.

## 5. Configuración PM2

**Ver procesos:**
```bash
pm2 list
```

**Reiniciar:**
```bash
pm2 restart leadmaster-central-hub
```

**Ver logs:**
```bash
pm2 logs leadmaster-central-hub
pm2 logs leadmaster-central-hub --lines 50
```

**Guardar configuración:**
```bash
pm2 save
pm2 startup
```

## 5. Reiniciar aplicación

```bash
# Si usas PM2
pm2 restart leadmaster-hub

# O si usas systemd
sudo systemctl restart leadmaster-hub

# Verificar logs
pm2 logs leadmaster-hub --lines 50
```

## 6. Verificar que el módulo está activo

```bash
# Test desde Contabo
curl http://localhost:3012/health
```

## 7. Probar autorización OAuth

Desde el navegador, ir a:
```
https://desarrolloydisenioweb.com.ar/sync-contacts/authorize/51
```

Esto debería:
- Redirigir a Google para autorizar
- Solicitar permisos de contactos
- Redirigir de vuelta y guardar tokens

## 8. Verificar primera sincronización

```bash
# Desde Contabo o con Postman/Insomnia
curl -X POST https://desarrolloydisenioweb.com.ar/sync-contacts/sync/51 \
  -H "Authorization: Bearer TU_TOKEN_JWT_DE_HABY"
```

---

## 6. Troubleshooting

### Backend no responde
```bash
# Ver logs
pm2 logs leadmaster-central-hub --lines 50

# Verificar que está corriendo
pm2 list
netstat -tlnp | grep 3012

# Reiniciar
pm2 restart leadmaster-central-hub

# Si falla, reiniciar completamente
pm2 delete leadmaster-central-hub
cd ~/leadmaster-central-hub
PORT=3012 pm2 start src/index.js --name leadmaster-central-hub
```

### Frontend muestra error 404 o rutas no cargan
```bash
# Verificar nginx
sudo nginx -t
sudo systemctl status nginx

# Ver logs de nginx
sudo tail -f /var/log/nginx/error.log

# Reconstruir frontend
cd ~/leadmaster-central-hub/frontend
npm run build

# Reiniciar nginx
sudo systemctl restart nginx
```

### Error de autenticación/CORS
```bash
# Verificar que el .env del frontend tenga la URL correcta
cat ~/leadmaster-central-hub/frontend/.env
# Debe ser: VITE_API_URL=https://desarrolloydisenioweb.com.ar

# Reconstruir frontend si cambió
cd ~/leadmaster-central-hub/frontend
npm run build
```

### Error en base de datos
```bash
# Verificar conexión
cd ~/leadmaster-central-hub
node -e "require('./src/config/db.js').execute('SELECT 1').then(()=>console.log('✅ DB OK')).catch(e=>console.log('❌',e))"
```

### Error: "Cannot find module 'googleapis'"
```bash
cd ~/leadmaster-central-hub
npm install googleapis
pm2 restart leadmaster-central-hub
```

### Error: "GOOGLE_CLIENT_ID is not defined"
- Verificar que el `.env` tiene las variables correctas
- Reiniciar el servidor después de editar `.env`

### Error 404 en /sync-contacts/authorize/51
- Verificar que el módulo está cargado en src/index.js
- Revisar logs: `pm2 logs leadmaster-central-hub`

---

## 7. Comandos Útiles

### Git
```bash
# Ver estado
git status

# Ver últimos commits
git log --oneline -5

# Descartar cambios locales
git restore .

# Ver diferencias
git diff
```

### PM2
```bash
# Listar procesos
pm2 list

# Reiniciar
pm2 restart leadmaster-central-hub

# Ver logs en tiempo real
pm2 logs leadmaster-central-hub

# Ver info del proceso
pm2 describe leadmaster-central-hub

# Monitoreo
pm2 monit
```

### Nginx
```bash
# Validar configuración
sudo nginx -t

# Reiniciar
sudo systemctl restart nginx

# Ver logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### Sistema
```bash
# Uso de recursos
htop

# Espacio en disco
df -h

# Procesos escuchando puertos
netstat -tlnp

# Ver proceso específico
ps aux | grep node
```

---

## 8. Cambios Importantes Realizados (Diciembre 2025)

### ✅ Fix authMiddleware en sync-contacts
**Problema:** El módulo sync-contacts no arrancaba por error en `authMiddleware`  
**Solución:** Cambiar `router.use(authMiddleware)` por `router.use(authMiddleware.authenticate)`  
**Archivo:** `src/modules/sync-contacts/routes/index.js`  
**Commit:** `ae96950`

### ✅ Configuración Nginx para HTTPS
**Problema:** Mixed Content - frontend en HTTPS pero API en HTTP  
**Solución:** Configurar proxy reverso en nginx para todas las rutas de API  
**Archivos:**
- `/etc/nginx/sites-available/desarrolloydisenioweb.com.ar`
- `frontend/.env` → `VITE_API_URL=https://desarrolloydisenioweb.com.ar`

### ✅ Configuración SSH para GitHub
**Problema:** Necesidad de token en cada push  
**Solución:** Generar clave SSH y configurar en GitHub  
**Clave pública:** `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAKLrdNHs7P4e6FJAzkqgQMErlmEmHywOx9yyLY5DDhZ contabo-leadmaster`

### ✅ Rutas de Nginx actualizadas
**Cambio:** Proxy configurado para rutas específicas del backend  
**Pattern:** `location ~ ^/(auth|session-manager|sender|listener|sync-contacts|health)/`  
**Beneficio:** Permite servir frontend y backend desde el mismo dominio con HTTPS

---

## 9. Flujo de Sincronización

```
┌─────────────────┐
│  Máquina Local  │
│   (Desarrollo)  │
└────────┬────────┘
         │ git push origin main
         ▼
┌─────────────────┐
│     GitHub      │
│  (Repositorio)  │
└────────┬────────┘
         │ git pull origin main
         ▼
┌─────────────────┐
│     Contabo     │
│  (Producción)   │
└─────────────────┘
```

**Importante:** Los archivos `.env` NO se sincronizan (están en `.gitignore`)

---

## 10. Checklist de Deploy

- [ ] Hacer cambios en local
- [ ] Probar en local: `npm run dev` (frontend) y `node src/index.js` (backend)
- [ ] Commit y push a GitHub
- [ ] Conectar a Contabo via SSH
- [ ] Pull de cambios: `git pull origin main`
- [ ] Instalar dependencias: `npm install`
- [ ] Rebuild frontend: `cd frontend && npm run build`
- [ ] Reiniciar backend: `pm2 restart leadmaster-central-hub`
- [ ] Verificar logs: `pm2 logs leadmaster-central-hub`
- [ ] Probar en producción: https://desarrolloydisenioweb.com.ar
- [ ] Verificar que todos los módulos funcionan correctamente

---

**Última actualización:** 20 de diciembre de 2025  
**Sistema en producción:** ✅ Funcionando correctamente  
**URL:** https://desarrolloydisenioweb.com.ar  
**Backend:** Puerto 3012 (interno)  
**Frontend:** Servido por Nginx con proxy a backend
