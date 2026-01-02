# LeadMaster Workspace

Este workspace contiene los servicios que conforman el sistema LeadMaster.

Arquitectura basada en múltiples procesos Node.js independientes, gestionados con PM2.

## Estructura

- **services/**  
  Servicios independientes (WhatsApp session-manager, listener, sender, API, etc.)

- **shared/**  
  Código y configuración compartida entre servicios

- **scripts/**  
  Scripts de despliegue y configuración PM2

- **infra/**  
  Infraestructura: configuraciones Nginx, SSL, deployment

- **docs/**  
  Documentación técnica y guías operativas

## Infraestructura

- **Servidor**: VPS Contabo
- **Web Server**: Nginx + Cloudflare Origin SSL
- **SSL/TLS**: Full (strict) con Origin Certificates
- **Dominios**: desarrolloydisenioweb.com.ar

Ver documentación SSL: [`docs/SSL-Cloudflare-Setup.md`](docs/SSL-Cloudflare-Setup.md)

## Notas

- Trabajo remoto vía VS Code + SSH
- Uso intensivo de Copilot
- Configuraciones sensibles (certificados, claves) NO versionadas
