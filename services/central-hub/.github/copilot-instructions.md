# LeadMaster Central Hub - Instrucciones para GitHub Copilot

## Contexto del Proyecto
Sistema multi-cliente de gestión de leads con integración WhatsApp para envío de mensajes masivos y respuestas automáticas.

## Arquitectura Modular

### Módulo Principal: Session Manager
- **Ubicación:** `/src/modules/session-manager/`
- **Responsabilidad:** Administra la conexión a WhatsApp (única fuente de verdad)
- **Otros módulos:** Solo CONSUMEN la conexión, NO la administran

### Módulos Consumidores
- **Auth:** Autenticación JWT multi-cliente
- **Sender:** Envío de mensajes masivos (consume session-manager)
- **Listener:** Respuestas automáticas (consume session-manager)

## Reglas de Desarrollo

### Código y Documentación
- **NO incluir código inline en archivos markdown**
- **NO duplicar lógica de conexión WhatsApp en otros módulos**
- Mantener separación clara de responsabilidades

### Base de Datos Multi-tenant
- Estructura Dolibarr: `llxbx_*` (societe, etc.)
- Tablas custom: `ll_*` (lugares_clientes, etc.)
- Aislamiento por `cliente_id` en todas las queries

### Endpoints y APIs
- Backend: Puerto 3011 (cambiado desde 3010 por conflictos)
- Frontend: Puerto 5173
- Autenticación JWT obligatoria
- Filtrado automático por cliente en todas las respuestas

## Estructura de Módulos
```
src/modules/
├── session-manager/     # Administra conexión WhatsApp
├── auth/               # Autenticación multi-cliente
├── sender/             # Envíos masivos (consume session)
└── listener/           # Respuestas auto (consume session)
```

## Estado Actual
- ✅ Sistema multi-cliente implementado
- ✅ Todos los módulos activos y funcionando
- ✅ Frontend conectado a APIs reales
- ✅ Segmentación de leads por cliente_id
