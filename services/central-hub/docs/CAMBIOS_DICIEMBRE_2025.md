# Cambios Importantes - Diciembre 2025

## Resumen
Resolución completa de problemas de despliegue en producción y configuración exitosa del sistema en Contabo con HTTPS, proxy reverso y autenticación SSH.

---

## 1. Fix authMiddleware en sync-contacts

### Problema
El módulo `sync-contacts` no arrancaba correctamente mostrando el error:
```
Router.use() requires a middleware function
```

### Causa
El archivo `authMiddleware.js` exporta un objeto con múltiples funciones, pero en las rutas se intentaba usar como función directa.

### Solución
**Archivo:** `src/modules/sync-contacts/routes/index.js`

**Antes:**
```javascript
router.use(authMiddleware);
```

**Después:**
```javascript
router.use(authMiddleware.authenticate);
```

**Commit:** `ae96950`  
**Fecha:** 20 de diciembre de 2025

---

## 2. Configuración Nginx para HTTPS con Proxy Reverso

### Problema
- Frontend cargaba por HTTPS pero intentaba hacer peticiones HTTP al backend
- Error de Mixed Content bloqueado por el navegador
- Backend en puerto 3012 no accesible públicamente

### Solución Implementada

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

### Cambios en Frontend

**Archivo:** `frontend/.env`

**Antes:**
```
VITE_API_URL=http://desarrolloydisenio-web.com.ar:3012
```

**Después:**
```
VITE_API_URL=https://desarrolloydisenioweb.com.ar
```

**Nota:** El dominio correcto es `desarrolloydisenioweb.com.ar` (sin guión entre "desarrollo" y "y")

### Resultado
- ✅ Frontend y backend servidos desde el mismo dominio
- ✅ Todas las peticiones usan HTTPS
- ✅ Sin errores de Mixed Content
- ✅ Backend no expuesto directamente, solo a través del proxy

---

## 3. Configuración SSH para GitHub

### Problema
Cada vez que se hacía push desde Contabo, se requería ingresar usuario y token de GitHub manualmente.

### Solución

**1. Generación de clave SSH en Contabo:**
```bash
ssh-keygen -t ed25519 -C "contabo-leadmaster"
```

**2. Clave pública generada:**
```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAKLrdNHs7P4e6FJAzkqgQMErlmEmHywOx9yyLY5DDhZ contabo-leadmaster
```

**3. Clave agregada en GitHub:**
- URL: https://github.com/settings/keys
- Title: "Contabo Leadmaster"

**4. Cambio de remote a SSH:**
```bash
git remote set-url origin git@github.com:albertohilal/leadmaster-central-hub.git
```

### Resultado
- ✅ Push y pull sin necesidad de tokens
- ✅ Autenticación automática con clave SSH
- ✅ Mayor seguridad (clave privada en servidor)

---

## 4. Script de Deploy Automático

### Creación
**Archivo:** `/root/deploy.sh` en Contabo

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

### Uso
```bash
chmod +x ~/deploy.sh
~/deploy.sh
```

---

## 5. Corrección de Nombre de Dominio

### Problema Detectado
Se usaba inconsistentemente `desarrolloydisenio-web.com.ar` (con guión) cuando el dominio real es `desarrolloydisenioweb.com.ar` (sin guión).

### Archivos Corregidos
- Configuración de Nginx
- Frontend `.env`
- Documentación

---

## 6. Arquitectura Final

```
Internet (HTTPS)
       ↓
[Nginx - Puerto 443]
       ↓
   ┌───────────────────┐
   │                   │
   ├→ Frontend (/)     │ → Archivos estáticos en /root/.../frontend/dist
   │                   │
   └→ Backend (/auth, /session-manager, etc.)
                       ↓
              [Node.js - Puerto 3012]
                       ↓
              [PM2 Process Manager]
                       ↓
              [MySQL Database]
```

---

## 7. Variables de Entorno en Producción

### Backend (.env)
```bash
PORT=3012
NODE_ENV=production
DB_HOST=sv46.byethost46.org
DB_USER=iunaorg_b3toh
DB_PASSWORD=elgeneral2018
DB_NAME=iunaorg_dyd
DB_PORT=3306
JWT_SECRET=leadmaster_jwt_secret_key_super_secure_2025
SESSION_SECRET=leadmaster_hub_secret_key_2025
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID_HERE
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET_HERE
GOOGLE_REDIRECT_URI=https://desarrolloydisenioweb.com.ar/sync-contacts/callback
```

### Frontend (.env)
```bash
VITE_API_URL=https://desarrolloydisenioweb.com.ar
```

---

## 8. Estado Actual del Sistema

### ✅ Servicios Activos
- **Frontend:** https://desarrolloydisenioweb.com.ar
- **Backend:** Puerto 3012 (interno, proxy via Nginx)
- **Base de Datos:** MySQL remota (sv46.byethost46.org)

### ✅ Módulos Funcionando
- Auth (Autenticación JWT)
- Session-Manager (Conexión WhatsApp)
- Sender (Envíos masivos)
- Listener (Respuestas automáticas)
- Sync-Contacts (Sincronización Gmail)

### ✅ Seguridad
- Certificado SSL de Let's Encrypt
- Autenticación JWT multi-cliente
- Backend no expuesto directamente
- Variables sensibles en .env (no versionadas)

---

## 9. Flujo de Trabajo Establecido

### Desarrollo Local → Producción

1. **Local:**
   ```bash
   # Hacer cambios
   git add .
   git commit -m "Descripción"
   git push origin main
   ```

2. **Contabo:**
   ```bash
   # Opción 1: Manual
   cd ~/leadmaster-central-hub
   git pull origin main
   npm install
   cd frontend && npm install && npm run build
   pm2 restart leadmaster-central-hub
   
   # Opción 2: Script automático
   ~/deploy.sh
   ```

3. **Verificar:**
   - Logs: `pm2 logs leadmaster-central-hub`
   - URL: https://desarrolloydisenioweb.com.ar

---

## 10. Lecciones Aprendidas

1. **Middleware debe exportarse correctamente**: Verificar siempre si se exporta un objeto o función directa
2. **HTTPS requiere configuración completa**: Frontend, backend y proxy deben estar sincronizados
3. **Nginx como proxy reverso**: Solución estándar para servir frontend y backend desde mismo dominio
4. **SSH mejor que tokens**: Para servidores de producción, SSH es más práctico
5. **.env nunca debe versionarse**: Usar .gitignore y documentar estructura sin valores sensibles
6. **Verificar nombres de dominio**: Un guión puede hacer la diferencia entre funcionamiento y error
7. **Scripts de deploy automático**: Reducen errores y aceleran despliegues

---

## 11. Problemas Resueltos

| # | Problema | Solución | Estado |
|---|----------|----------|--------|
| 1 | Error authMiddleware | Usar `.authenticate` | ✅ |
| 2 | Mixed Content HTTPS/HTTP | Proxy reverso Nginx | ✅ |
| 3 | Puerto 3012 bloqueado | Nginx proxy en 443 | ✅ |
| 4 | Token GitHub requerido | SSH key | ✅ |
| 5 | Dominio incorrecto | Corregir a sin guión | ✅ |
| 6 | Frontend cacheado | Rebuild + hard refresh | ✅ |

---

**Documento creado:** 20 de diciembre de 2025  
**Sistema:** LeadMaster Central Hub v1.0  
**Entorno:** Producción - Contabo  
**Estado:** ✅ Operativo
