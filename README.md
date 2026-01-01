# LeadMaster Workspace

Este workspace contiene los servicios que conforman el sistema LeadMaster.

Arquitectura basada en múltiples procesos Node.js independientes, gestionados con PM2.

## Estructura

- services/
  Servicios independientes (WhatsApp session-manager, listener, sender, API, etc.)

- shared/
  Código y configuración compartida entre servicios

- scripts/
  Scripts de despliegue y configuración PM2

## Notas

- Trabajo remoto vía VS Code + SSH
- Uso intensivo de Copilot
- Producción en VPS Contabo
