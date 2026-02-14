# Diagnóstico: Fallo de Login en Producción

**Fecha:** 14 de enero de 2026  
**Rama:** feature/whatsapp-init-sync  
**Ingeniero:** GitHub Copilot

---

## 🔴 Problema Identificado

El login falla en producción aunque el backend responde correctamente. El error es de **configuración de variables de entorno en el frontend**.

---

## 🔍 Análisis Técnico

### Archivos Involucrados

1. **`frontend/.env`** ❌
   ```env
   VITE_API_URL=https://desarrolloydisenioweb.com.ar
   ```

2. **`frontend/.env.production`** ✅
   ```env
   VITE_API_URL=/api
   VITE_SESSION_MANAGER_URL=/api/whatsapp
   ```

3. **`frontend/src/config/api.js`**
   ```javascript
   const envUrl = import.meta.env.VITE_API_URL?.trim();
   ```

### Causa Raíz

Vite **prioriza `.env` sobre `.env.production`** durante el build si no se especifica explícitamente `--mode production`.

**Flujo del error:**
1. Build ejecutado con `npm run build` (sin `--mode production`)
2. Vite lee `.env` en lugar de `.env.production`
3. `VITE_API_URL` queda con valor `https://desarrolloydisenioweb.com.ar`
4. El código intenta hacer POST a `https://desarrolloydisenioweb.com.ar/auth/login`
5. Falla por CORS o ruteo incorrecto (debería ir a `/api/auth/login` vía proxy Nginx)

---

## ✅ Solución

### Opción 1: Eliminar `.env` (Recomendado)

```bash
rm /root/leadmaster-workspace/services/central-hub/frontend/.env
```

### Opción 2: Vaciar `.env` y dejar comentario

```env
# Este archivo no debe contener variables.
# Usar .env.development para desarrollo local
# Usar .env.production para builds de producción
```

---

## 🛠️ Comandos de Corrección

```bash
# 1. Navegar al directorio frontend
cd /root/leadmaster-workspace/services/central-hub/frontend

# 2. Eliminar archivo conflictivo
rm .env

# 3. Limpiar build anterior
rm -rf dist

# 4. Rebuild con modo producción explícito
npm run build -- --mode production

# 5. Verificar que la variable correcta fue embebida
grep -r "VITE_API_URL" dist/assets/*.js | head -1
# Debe mostrar: "/api" NO "desarrolloydisenioweb.com.ar"

# 6. Redeploy
pm2 restart central-hub-frontend

# 7. Verificar en producción
curl -X POST https://desarrolloydisenioweb.com.ar/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"usuario":"test","password":"test"}'
```

---

## 📋 Validación Post-Deploy

### Checklist

- [ ] Archivo `.env` eliminado o vaciado
- [ ] Build ejecutado con `--mode production`
- [ ] `dist/assets/*.js` contiene `"/api"` no URL absoluta
- [ ] PM2 reiniciado
- [ ] Login funciona en `https://desarrolloydisenioweb.com.ar`
- [ ] Console del navegador sin errores CORS
- [ ] Token JWT guardado en localStorage

### Verificación en DevTools

1. Abrir `https://desarrolloydisenioweb.com.ar`
2. F12 → Network → intentar login
3. Verificar POST a `/api/auth/login` (relativa, no absoluta)
4. Status esperado: 200 OK

---

## 📝 Notas Técnicas

### Por qué `.env.production` no se usó

Vite carga archivos `.env` en este orden de prioridad:
```
.env.production.local  (más prioritario)
.env.production
.env.local
.env                   (menos prioritario, pero siempre se carga)
```

Si `.env` existe, sus valores **sobrescriben** los de `.env.production` a menos que:
- Se use `--mode production` explícitamente
- O `.env` no exista

### Configuración Correcta para Producción

**`.env.production`** (actual, correcto):
```env
VITE_API_URL=/api
VITE_SESSION_MANAGER_URL=/api/whatsapp
```

Estas rutas relativas funcionan porque Nginx actúa como proxy reverso:
```nginx
location /api/ {
    proxy_pass http://localhost:3013/;
}

location /api/whatsapp/ {
    proxy_pass http://localhost:3001/;
}
```

---

## 🚀 Estado Esperado Post-Fix

| Componente | Estado |
|------------|--------|
| Backend Express (3013) | ✅ Funcionando (sin cambios) |
| Frontend Build | ✅ Variables correctas embebidas |
| Nginx Proxy | ✅ Rutas /api configuradas |
| Login Flow | ✅ POST /api/auth/login → 200 OK |

---

## 🔗 Referencias

- **Config API:** `frontend/src/config/api.js`
- **AuthContext:** `frontend/src/contexts/AuthContext.jsx` (línea 76)
- **Vite Env Docs:** https://vitejs.dev/guide/env-and-mode.html
- **Nginx Config:** `/etc/nginx/sites-available/desarrolloydisenioweb.com.ar`

---

**Fin del diagnóstico**
