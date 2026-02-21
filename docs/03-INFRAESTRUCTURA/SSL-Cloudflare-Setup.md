# Configuración SSL con Cloudflare Origin Certificate

## Descripción general

Este documento describe la configuración SSL implementada para los dominios alojados en el servidor Nginx con certificados Origin Certificate de Cloudflare.

## Arquitectura

```
Cliente → Cloudflare (Edge) → Nginx (Origin) → Aplicación
          ↓                    ↓
          SSL Universal        Cloudflare Origin Certificate
```

## Dominios configurados

- **desarrolloydisenioweb.com.ar**
  - Configuración: `/root/leadmaster-workspace/infra/nginx/sites-available/desarrolloydisenioweb.com.ar.conf`
  - Certificado: `/etc/nginx/ssl/cloudflare/desarrolloydisenioweb.com.ar.crt`
  - Clave privada: `/etc/nginx/ssl/cloudflare/desarrolloydisenioweb.com.ar.key`

## Configuración Cloudflare

### Panel Cloudflare

1. **SSL/TLS Mode**: Full (strict)
2. **Edge Certificates**: Active (automático)
3. **Origin Server**: Certificado generado con validez 15 años

### Pasos para generar Origin Certificate

1. Ir a Cloudflare Dashboard → SSL/TLS → Origin Server
2. Click "Create Certificate"
3. Seleccionar:
   - Private key type: RSA (2048)
   - Hostnames: `*.desarrolloydisenioweb.com.ar`, `desarrolloydisenioweb.com.ar`
   - Validity: 15 años
4. Guardar:
   - Origin Certificate → archivo `.crt`
   - Private Key → archivo `.key`

## Instalación en servidor

### 1. Crear directorios

```bash
sudo mkdir -p /etc/nginx/ssl/cloudflare
sudo chmod 700 /etc/nginx/ssl/cloudflare
```

### 2. Instalar certificados

```bash
# Copiar contenido del certificado
sudo nano /etc/nginx/ssl/cloudflare/desarrolloydisenioweb.com.ar.crt

# Copiar contenido de la clave privada
sudo nano /etc/nginx/ssl/cloudflare/desarrolloydisenioweb.com.ar.key

# Asegurar permisos
sudo chmod 600 /etc/nginx/ssl/cloudflare/*.key
sudo chmod 644 /etc/nginx/ssl/cloudflare/*.crt
```

### 3. Configurar snippet SSL (opcional pero recomendado)

Crear `/etc/nginx/snippets/ssl-cloudflare.conf`:

```nginx
# SSL Protocol and Ciphers
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers off;

# SSL Session
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;
ssl_session_tickets off;

# OCSP Stapling (disabled for Cloudflare Origin Certificates)
# ssl_stapling on;
# ssl_stapling_verify on;
```

### 4. Activar configuración

```bash
# Crear symlink
sudo ln -s /root/leadmaster-workspace/infra/nginx/sites-available/desarrolloydisenioweb.com.ar.conf \
    /etc/nginx/sites-enabled/

# Validar configuración
sudo nginx -t

# Recargar nginx
sudo systemctl reload nginx
```

## Validación

### Pruebas locales (en el servidor)

```bash
# Test de configuración Nginx
sudo nginx -t

# Test de respuesta HTTPS
curl -I https://desarrolloydisenioweb.com.ar

# Verificar certificado
openssl s_client -connect desarrolloydisenioweb.com.ar:443 -servername desarrolloydisenioweb.com.ar
```

### Pruebas externas

1. **Navegador**: https://desarrolloydisenioweb.com.ar
   - Verificar candado verde
   - Inspeccionar certificado (debe ser de Cloudflare, no Origin)

2. **SSL Labs**: https://www.ssllabs.com/ssltest/
   - Calificación esperada: A o superior

3. **HTTP/2**: Verificar en DevTools → Network → Protocol

## Troubleshooting

### Error: "SSL: error:0909006C:PEM routines"

**Causa**: Certificado mal formateado o corrupto

**Solución**:
```bash
# Regenerar certificado en Cloudflare
# Reinstalar siguiendo pasos de instalación
# Validar formato:
openssl x509 -in /etc/nginx/ssl/cloudflare/desarrolloydisenioweb.com.ar.crt -text -noout
```

### Error: "Permission denied" al leer certificados

**Solución**:
```bash
sudo chmod 600 /etc/nginx/ssl/cloudflare/*.key
sudo chown root:root /etc/nginx/ssl/cloudflare/*
```

### Error: Mixed content warnings

**Solución**: Verificar que Cloudflare SSL/TLS mode esté en "Full (strict)", no "Flexible"

## Seguridad

### ⚠️ NUNCA versionar

- Archivos `.crt` (certificados)
- Archivos `.key` (claves privadas)
- Archivos `.pem`

### ✅ Buenas prácticas

- Certificados solo accesibles por root
- Claves privadas con permiso 600
- Renovar certificados antes del vencimiento
- Usar snippet compartido para configuración SSL
- Documentar paths en configs versionadas

## Mantenimiento

### Renovación de certificados

Los Origin Certificates de Cloudflare tienen validez de 15 años. Planificar renovación:

- **Fecha instalación**: 2025-01-02
- **Fecha vencimiento**: ~2040-01-02
- **Recordatorio**: Configurar alerta 6 meses antes

### Backup

```bash
# Backup de certificados (almacenar en lugar seguro, NO en Git)
sudo tar -czf cloudflare-certs-$(date +%Y%m%d).tar.gz /etc/nginx/ssl/cloudflare/
```

## Referencias

- [Cloudflare Origin CA](https://developers.cloudflare.com/ssl/origin-configuration/origin-ca/)
- [Nginx SSL Module](https://nginx.org/en/docs/http/ngx_http_ssl_module.html)
- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/)

---

**Última actualización**: 2025-01-02  
**Responsable**: Alberto Hilal  
**Estado**: ✅ Operativo
