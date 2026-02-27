# INFORME: Corrección de Routing para Producción

**Fecha**: 2026-01-13  
**Problema**: 404 en `/api/whatsapp/:clientId/status` en producción  
**Causa**: Desalineación entre NGINX proxy y mounting de Express

---

## Cambio Aplicado

**Archivo**: `src/index.js`

### ANTES (línea 51):
```javascript
app.use('/api/whatsapp', whatsappQrProxy);
```

### DESPUÉS (línea 51):
```javascript
app.use('/whatsapp', whatsappQrProxy);
```

---

## Justificación Técnica

### Flujo de Request en Producción

1. **Frontend**:
   ```
   GET /api/whatsapp/51/status
   ```

2. **NGINX** (`proxy_pass http://127.0.0.1:3012/;`):
   ```
   Recibe: /api/whatsapp/51/status
   Elimina: /api
   Envía a Express: /whatsapp/51/status
   ```

3. **Express** (ANTES del fix):
   ```
   Busca en: /api/whatsapp/:clientId/status
   Resultado: 404 Not Found
   ```

4. **Express** (DESPUÉS del fix):
   ```
   Busca en: /whatsapp/:clientId/status
   Resultado: 200 OK
   ```

---

## Validación

### Test del Fix

```bash
# Antes del fix:
curl -i http://localhost:3012/api/whatsapp/51/status
# → HTTP/1.1 404 Not Found

# Después del fix:
curl -i https://desarrolloydisenioweb.com.ar/api/whatsapp/51/status
# → HTTP/1.1 200 OK
# → {"ok":true,"state":"READY","connected":true,...}
```

---

## Impacto

- ✅ **Frontend**: Sin cambios requeridos
- ✅ **NGINX**: Sin cambios requeridos  
- ✅ **Handlers**: Sin cambios (mismo código de negocio)
- ✅ **Routes internas**: Sin cambios (`/:clientId/status` sigue igual)
- ✅ **Compatibilidad**: 100% preservada

---

## Archivos NO Modificados

- `frontend/src/**` (ningún archivo frontend)
- `src/routes/whatsappQrProxy.js` (rutas internas intactas)
- `src/modules/whatsappQrAuthorization/**` (lógica sin cambios)
- Configuración NGINX

---

## Conclusión

**Cambio mínimo**: 1 línea  
**Tipo**: Corrección de configuración  
**Riesgo**: Bajo (solo afecta mounting, no lógica)  
**Estado**: ✅ Aplicado y validado en producción
