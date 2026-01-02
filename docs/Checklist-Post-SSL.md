# Checklist Post-SSL para Despliegues

## 📋 Checklist de validación SSL/HTTPS

Usa esta lista después de configurar SSL en un nuevo dominio o servidor.

---

### 1. Configuración de certificados

- [ ] Certificado instalado en `/etc/nginx/ssl/cloudflare/[dominio].crt`
- [ ] Clave privada instalada en `/etc/nginx/ssl/cloudflare/[dominio].key`
- [ ] Permisos correctos: `chmod 600` para `.key`, `chmod 644` para `.crt`
- [ ] Ownership correcto: `chown root:root` para ambos archivos

---

### 2. Configuración Nginx

- [ ] Archivo de configuración creado en `infra/nginx/sites-available/`
- [ ] Paths de certificados correctos en la config
- [ ] Puerto 443 con `ssl http2` habilitado
- [ ] Redirect HTTP → HTTPS configurado (puerto 80)
- [ ] Headers de seguridad agregados
- [ ] Logs configurados (`access_log`, `error_log`)

---

### 3. Activación

- [ ] Symlink creado en `/etc/nginx/sites-enabled/`
- [ ] `sudo nginx -t` ejecutado sin errores
- [ ] `sudo systemctl reload nginx` exitoso
- [ ] Nginx corriendo: `sudo systemctl status nginx`

---

### 4. Cloudflare

- [ ] SSL/TLS mode: **Full (strict)**
- [ ] Origin Certificate generado y válido
- [ ] DNS apuntando correctamente (proxy naranja activado)
- [ ] Edge Certificates activo

---

### 5. Validación técnica

- [ ] `curl -I https://[dominio]` responde 200 OK
- [ ] `curl -I http://[dominio]` redirige a HTTPS (301)
- [ ] HTTP/2 activo (verificar con curl o DevTools)
- [ ] `openssl s_client -connect [dominio]:443` muestra certificado válido

---

### 6. Validación en navegador

- [ ] Sitio carga correctamente en navegador
- [ ] Candado verde/seguro visible
- [ ] Sin warnings de mixed content
- [ ] Certificado válido al inspeccionar (debe ser de Cloudflare en edge)
- [ ] Probado en Chrome, Firefox, Safari

---

### 7. Seguridad y performance

- [ ] SSL Labs test: https://www.ssllabs.com/ssltest/
  - Calificación esperada: **A** o superior
- [ ] Headers de seguridad presentes:
  - `X-Frame-Options`
  - `X-Content-Type-Options`
  - `X-XSS-Protection`
  - `Referrer-Policy`
- [ ] HSTS configurado (opcional pero recomendado)

---

### 8. Documentación y versionado

- [ ] Config de nginx versionada en Git
- [ ] Certificados/claves **NO** versionados (en `.gitignore`)
- [ ] Documentación actualizada
- [ ] Commit descriptivo realizado

---

### 9. Monitoring y mantenimiento

- [ ] Logs accesibles y sin errores críticos
- [ ] Fecha de vencimiento del certificado documentada
- [ ] Alerta de renovación configurada (6 meses antes)
- [ ] Backup de certificados almacenado en lugar seguro

---

## 🚨 Troubleshooting rápido

### Si el sitio no carga:

```bash
# 1. Verificar nginx
sudo nginx -t
sudo systemctl status nginx

# 2. Verificar logs
sudo tail -f /var/log/nginx/error.log

# 3. Verificar certificados
ls -la /etc/nginx/ssl/cloudflare/
openssl x509 -in /etc/nginx/ssl/cloudflare/[dominio].crt -text -noout
```

### Si hay error de certificado:

1. Regenerar en Cloudflare
2. Reinstalar siguiendo guía
3. Verificar permisos y paths
4. Reload nginx

---

## 📚 Referencias

- Guía completa: `docs/SSL-Cloudflare-Setup.md`
- Config ejemplo: `infra/nginx/sites-available/desarrolloydisenioweb.com.ar.conf`

---

**Versión**: 1.0  
**Fecha**: 2025-01-02
