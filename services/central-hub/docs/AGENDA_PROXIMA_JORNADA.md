# Agenda Próxima Jornada - Deploy Sync Contacts

**Fecha:** 20 de diciembre de 2025  
**Estado:** Módulo sync-contacts completo, listo para deploy a Contabo

---

## ✅ Completado Hoy

### 1. Configuración Google Cloud OAuth
- [x] Proyecto "My First Project" creado en Google Cloud Console
- [x] People API habilitada
- [x] Pantalla de consentimiento OAuth configurada (usuarios externos)
- [x] Cliente OAuth Web creado: "LeadMaster Sync Web Client"
- [x] Credenciales obtenidas y configuradas en `.env` (no incluidas en repo público)
- [x] URIs configuradas para producción Contabo

### 2. Base de Datos
- [x] 4 tablas creadas: `ll_sync_contactos_log`, `ll_cliente_google_tokens`, `ll_sync_contactos_mapping`, `ll_sync_contactos_config`
- [x] Vista `vw_sync_contactos_stats` para monitoreo
- [x] Configuración inicial para Haby (cliente_id=51) con prefijo `[Haby]`

### 3. Código
- [x] Módulo sync-contacts completo (controllers, services, routes, cron)
- [x] `.env` local actualizado con credenciales OAuth
- [x] Todo commitado a GitHub (commit `feb4748`)
- [x] Guía de deploy creada: `DEPLOY_CONTABO.md`

---

## 🎯 Próxima Jornada: Deploy y Testing

### Fase 1: Deploy a Contabo (30-45 min)

```bash
# 1. SSH a Contabo
ssh root@desarrolloydisenioweb.com.ar

# 2. Actualizar código
cd /var/www/leadmaster-central-hub
git pull origin main
npm install

# 3. Configurar .env
nano .env
# Agregar:
# GOOGLE_CLIENT_ID=<TU_CLIENT_ID_AQUI>
# GOOGLE_CLIENT_SECRET=<TU_CLIENT_SECRET_AQUI>
# GOOGLE_REDIRECT_URI=https://desarrolloydisenioweb.com.ar/sync-contacts/callback

# 4. Reiniciar
pm2 restart leadmaster-hub
pm2 logs leadmaster-hub --lines 50
```

### Fase 2: Autorización OAuth - Haby (15 min)

**URL:** `https://desarrolloydisenioweb.com.ar/sync-contacts/authorize/51`

1. Seleccionar cuenta Gmail de Haby
2. Permitir acceso a contactos
3. Verificar tokens guardados en BD

### Fase 3: Primera Sincronización (20 min)

```bash
# Ejecutar sync manual
curl -X POST https://desarrolloydisenioweb.com.ar/sync-contacts/sync/51 \
  -H "Authorization: Bearer TOKEN_JWT_HABY"

# Monitorear logs
pm2 logs leadmaster-hub --lines 100
```

**Esperado:** 617 contactos de Haby sincronizados a Gmail (~10 minutos)

### Fase 4: Validación (10 min)

```sql
-- Verificar sincronización
SELECT * FROM vw_sync_contactos_stats WHERE cliente_id = 51;

-- Ver últimos contactos
SELECT nombre_contacto, telefono, estado, fecha_sync
FROM ll_sync_contactos_log
WHERE cliente_id = 51
ORDER BY fecha_sync DESC
LIMIT 10;
```

**Gmail:** Verificar en https://contacts.google.com que aparecen con prefijo `[Haby]`  
**WhatsApp:** Verificar que nombres aparecen en lugar de solo números

### Fase 5: Cron Job Automático (5 min)

- Verificar en logs: `"🔄 Cron job de sincronización de contactos iniciado"`
- Sync automática cada 6 horas
- Próxima sync programada visible en `ll_sync_contactos_config`

---

## 📊 Checklist de Validación

- [ ] Servidor actualizado y reiniciado
- [ ] Módulo sync-contacts responde
- [ ] OAuth autorizado para Haby
- [ ] Tokens guardados en BD
- [ ] 617 contactos sincronizados
- [ ] Contactos visibles en Gmail
- [ ] Nombres aparecen en WhatsApp
- [ ] Cron job activo
- [ ] Sin errores en logs

---

## 🚨 Troubleshooting

**Error: "Cannot find module 'googleapis'"**
```bash
npm install googleapis@128.0.0
pm2 restart leadmaster-hub
```

**Error: "redirect_uri_mismatch"**
- Verificar URI exacta en Google Cloud Console: `https://desarrolloydisenioweb.com.ar/sync-contacts/callback`

**Contactos no aparecen en WhatsApp**
- WhatsApp debe usar la misma cuenta Gmail
- Sincronizar contactos en configuración
- Puede tardar hasta 15 minutos

---

**Ver guía completa:** `DEPLOY_CONTABO.md`  
**Última actualización:** 20 dic 2025, 14:40  
**Estado:** ✅ Listo para deploy