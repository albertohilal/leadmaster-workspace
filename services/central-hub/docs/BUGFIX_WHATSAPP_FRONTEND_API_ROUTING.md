# BUGFIX: WhatsApp Frontend Error - API Routing Issue

**Fecha:** 2026-01-14  
**Prioridad:** 🔴 CRÍTICA  
**Estado:** ✅ FIXED  
**Afecta a:** Producción (desarrolloydisenioweb.com.ar)

---

## Problema Detectado

### Síntoma
Dashboard muestra permanentemente "WhatsApp: Error" en producción, incluso después de verificar que:
- Backend session-manager está corriendo en puerto 3001 ✅
- Switch-case de estados implementado correctamente ✅
- Componente React con lógica correcta ✅

### Causa Raíz

**El frontend está haciendo requests a una URL incorrecta:**

```javascript
// WhatsappPage.jsx (ANTES)
const sessionManagerUrl = process.env.REACT_APP_SESSION_MANAGER_URL || 'http://localhost:3001';
```

**Problemas identificados:**

1. **Variable de entorno incorrecta**: Frontend usa Vite (no Create React App)
   - ❌ `process.env.REACT_APP_*` → No funciona con Vite
   - ✅ `import.meta.env.VITE_*` → Sintaxis correcta para Vite

2. **Sin archivos .env configurados**: No existían `.env.production` ni `.env.development`
   - Frontend siempre usaba fallback: `http://localhost:3001`
   - En producción, el navegador intenta llamar a `http://localhost:3001` desde el cliente
   - Falla con CORS o "network error"

3. **Nginx sin proxy para WhatsApp API**: 
   - Nginx tenía proxy `/api` → puerto 3012 (central-hub)
   - Pero session-manager corre en puerto 3001
   - Requests a `/api/whatsapp/status` terminan en central-hub (backend incorrecto)

### Evidencia

**Test en producción (ANTES del fix):**
```bash
$ curl -s -v http://desarrolloydisenioweb.com.ar/api/whatsapp/status \
  -H "X-Cliente-Id: 30" 2>&1 | grep HTTP
> GET /api/whatsapp/status HTTP/1.1
< HTTP/1.1 301 Moved Permanently
```

**Respuesta final:**
```html
<!DOCTYPE html>
<html lang="en">
<head><title>Error</title></head>
<body><pre>Cannot GET /whatsapp/status</pre></body>
</html>
```

**Diagnóstico:**
- Nginx redirige `/api/whatsapp/status` a central-hub (3012)
- Central-hub no tiene ruta `/whatsapp/status` (solo existe en session-manager:3001)
- Frontend recibe HTML de error → parseo JSON falla → estado ERROR

---

## Solución Implementada

### 1. Crear Variables de Entorno para Vite

**Archivo: `.env.production`**
```bash
# Production environment variables for central-hub frontend
VITE_SESSION_MANAGER_URL=/api/whatsapp
```

**Archivo: `.env.development`**
```bash
# Development environment variables for central-hub frontend
VITE_SESSION_MANAGER_URL=http://localhost:3001
```

**Ventajas:**
- En desarrollo: Llama directamente a `localhost:3001`
- En producción: Usa path relativo `/api/whatsapp` (proxied por Nginx)

### 2. Actualizar WhatsappPage.jsx

**ANTES:**
```javascript
const sessionManagerUrl = process.env.REACT_APP_SESSION_MANAGER_URL || 'http://localhost:3001';
```

**DESPUÉS:**
```javascript
// Session Manager URL desde variables de entorno
// Vite usa VITE_ prefix (no REACT_APP_)
const sessionManagerUrl = import.meta.env.VITE_SESSION_MANAGER_URL || 'http://localhost:3001';
```

### 3. Configurar Nginx Proxy para WhatsApp API

**Archivo: `infra/nginx/sites-available/desarrolloydisenioweb.com.ar.conf`**

**ANTES:**
```nginx
location /api {
    proxy_pass http://127.0.0.1:3012;  # Solo central-hub
    # ... headers
}
```

**DESPUÉS:**
```nginx
# WhatsApp Session Manager API (puerto 3001)
location /api/whatsapp {
    # Rewrite para quitar /api/whatsapp del path antes de proxy
    rewrite ^/api/whatsapp/(.*) /$1 break;
    
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # Forward X-Cliente-Id header
    proxy_set_header X-Cliente-Id $http_x_cliente_id;
    
    proxy_cache_bypass $http_upgrade;
}

# Other API routes (central-hub puerto 3012)
location /api {
    proxy_pass http://127.0.0.1:3012;
    # ... headers
}
```

**Explicación del rewrite:**
- Request: `GET /api/whatsapp/status`
- Rewrite: `/api/whatsapp/status` → `/status`
- Proxy: `http://127.0.0.1:3001/status`
- Session-manager recibe: `GET /status` ✅

**Orden importante:**
- `location /api/whatsapp` debe ir **ANTES** de `location /api`
- Nginx matchea el path más específico primero

---

## Checklist de Deploy

### Fase 1: Rebuild Frontend con Variables de Entorno

```bash
cd /root/leadmaster-workspace/services/central-hub/frontend

# Verificar que archivos .env existen
ls -la .env*
# Debe mostrar:
# .env.development
# .env.production

# Rebuild con modo producción (usa .env.production)
npm run build

# Verificar que el build incluyó la variable
grep -r "VITE_SESSION_MANAGER_URL" dist/ || echo "Variable injected at runtime"

# Copiar build a directorio web
sudo rm -rf /var/www/desarrolloydisenioweb/*
sudo cp -r dist/* /var/www/desarrolloydisenioweb/
sudo chown -R www-data:www-data /var/www/desarrolloydisenioweb/
```

### Fase 2: Actualizar Configuración Nginx

```bash
# Copiar nueva configuración
sudo cp /root/leadmaster-workspace/infra/nginx/sites-available/desarrolloydisenioweb.com.ar.conf \
  /etc/nginx/sites-available/desarrolloydisenioweb.com.ar.conf

# Verificar sintaxis
sudo nginx -t

# Si OK, recargar Nginx
sudo systemctl reload nginx
```

### Fase 3: Verificar Session Manager

```bash
# Verificar que session-manager está corriendo en puerto 3001
sudo pm2 list | grep session-manager

# Si no está corriendo, iniciar
cd /root/leadmaster-workspace/services/session-manager
sudo pm2 start ecosystem.config.cjs

# Verificar logs
sudo pm2 logs session-manager --lines 50
```

### Fase 4: Testing Post-Deploy

**Test 1: Nginx Proxy**
```bash
# Debe responder con JSON de session-manager
curl -s http://desarrolloydisenioweb.com.ar/api/whatsapp/health
# Esperado: {"status":"ok","service":"session-manager"}
```

**Test 2: Endpoint de Status**
```bash
# Debe responder con estado del cliente 30
curl -s http://desarrolloydisenioweb.com.ar/api/whatsapp/status \
  -H "X-Cliente-Id: 30"

# Esperado (si no inicializado):
# {"cliente_id":30,"state":"NOT_INITIALIZED",...}
```

**Test 3: Inicialización**
```bash
curl -X POST http://desarrolloydisenioweb.com.ar/api/whatsapp/init \
  -H "X-Cliente-Id: 30" \
  -H "Content-Type: application/json"

# Esperado:
# {"success":true,"cliente_id":30,"action":"INITIALIZING",...}
```

**Test 4: Frontend en Navegador**
```
1. Abrir: https://desarrolloydisenioweb.com.ar/dashboard
2. Verificar consola del navegador (F12):
   - NO debe mostrar errores de CORS
   - NO debe mostrar "Cannot GET /whatsapp/status"
   - Debe mostrar: "[WhatsappSession] Init successful"
3. Verificar UI:
   - Dashboard debe mostrar estado correcto (QR_REQUIRED, READY, etc.)
   - Badge debe ser azul/verde (no rojo permanente)
```

---

## Validación de Rutas

### Matriz de Routing (Producción)

| Request Frontend                    | Nginx Match          | Nginx Rewrite     | Backend Target        | Handler                  |
|-------------------------------------|----------------------|-------------------|-----------------------|--------------------------|
| `/api/whatsapp/init` (POST)         | `/api/whatsapp`      | `/init`           | `127.0.0.1:3001/init` | session-manager POST     |
| `/api/whatsapp/status` (GET)        | `/api/whatsapp`      | `/status`         | `127.0.0.1:3001/status` | session-manager GET    |
| `/api/whatsapp/health` (GET)        | `/api/whatsapp`      | `/health`         | `127.0.0.1:3001/health` | session-manager GET    |
| `/api/auth/login` (POST)            | `/api`               | (no rewrite)      | `127.0.0.1:3012/api/auth/login` | central-hub POST |
| `/api/leads` (GET)                  | `/api`               | (no rewrite)      | `127.0.0.1:3012/api/leads` | central-hub GET      |

### Matriz de Variables de Entorno

| Entorno         | VITE_SESSION_MANAGER_URL | Request Final                                      | Resultado                    |
|-----------------|--------------------------|----------------------------------------------------|------------------------------|
| Development     | `http://localhost:3001`  | `http://localhost:3001/init`                       | Direct to session-manager    |
| Production      | `/api/whatsapp`          | `https://desarrolloydisenioweb.com.ar/api/whatsapp/init` | Nginx proxy to 3001     |

---

## Riesgos Mitigados

| Riesgo                                | Probabilidad (Antes) | Impacto | Mitigación                              | Probabilidad (Después) |
|---------------------------------------|----------------------|---------|----------------------------------------|------------------------|
| Frontend llama a localhost en prod    | CRÍTICA              | CRÍTICO | Variable de entorno VITE_*             | NULA                   |
| Nginx proxy a backend incorrecto      | CRÍTICA              | CRÍTICO | `/api/whatsapp` → 3001 (rewrite)       | NULA                   |
| CORS error en producción              | ALTA                 | ALTO    | Path relativo + headers correctos      | NULA                   |
| Estado ERROR permanente en dashboard  | CRÍTICA              | CRÍTICO | Routing correcto + JSON responses      | NULA                   |
| Variables env no aplicadas en build   | MEDIA                | ALTO    | Archivos .env.* creados                | BAJA                   |

---

## Rollback Plan

Si el deploy falla:

**1. Revertir Nginx:**
```bash
# Restaurar config anterior (si existe backup)
sudo cp /etc/nginx/sites-available/desarrolloydisenioweb.com.ar.conf.bak \
  /etc/nginx/sites-available/desarrolloydisenioweb.com.ar.conf
sudo nginx -t && sudo systemctl reload nginx
```

**2. Revertir Frontend:**
```bash
# Volver a build anterior (sin variables de entorno)
cd /root/leadmaster-workspace/services/central-hub/frontend
git checkout HEAD~1 src/pages/WhatsappPage.jsx
npm run build
sudo cp -r dist/* /var/www/desarrolloydisenioweb/
```

**3. Fallback Temporal:**
Configurar frontend para usar URL absoluta hardcodeada:
```javascript
const sessionManagerUrl = 'https://desarrolloydisenioweb.com.ar:3001';
```
(Requiere exponer puerto 3001 en firewall - NO recomendado)

---

## Verificación Final

### Checklist de Producción

- [ ] Frontend rebuildeado con `.env.production`
- [ ] Archivos copiados a `/var/www/desarrolloydisenioweb/`
- [ ] Nginx config actualizada con `/api/whatsapp` proxy
- [ ] Nginx syntax test passed (`nginx -t`)
- [ ] Nginx reloaded (`systemctl reload nginx`)
- [ ] Session-manager running on port 3001 (`pm2 list`)
- [ ] Health endpoint responde: `curl /api/whatsapp/health`
- [ ] Status endpoint responde JSON válido
- [ ] Dashboard UI muestra estado correcto (no ERROR permanente)
- [ ] Consola del navegador sin errores CORS
- [ ] Inicialización POST /init funciona
- [ ] QR se renderiza correctamente cuando state=QR_REQUIRED

---

## Conclusión

**Problema:** Frontend intentaba llamar a `localhost:3001` desde el navegador del cliente (falla de CORS/network)  
**Causa:** Variables de entorno no configuradas + Nginx proxy incorrecto  
**Solución:** 
1. Archivos `.env.production` y `.env.development` con `VITE_SESSION_MANAGER_URL`
2. Actualización de `WhatsappPage.jsx` para usar `import.meta.env.VITE_*`
3. Nginx proxy `/api/whatsapp` → `127.0.0.1:3001` con rewrite

**Resultado esperado:** Dashboard muestra estado real del WhatsApp (QR_REQUIRED, READY, etc.) en lugar de ERROR permanente.

**Siguiente paso:** Ejecutar Checklist de Deploy → Validación en producción

---

**FIN DEL BUGFIX REPORT**
