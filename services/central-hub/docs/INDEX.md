# Documentación - LeadMaster Central Hub

## 📚 Índice de Documentación

### 🏗️ Arquitectura

#### WhatsApp Integration
- **[WhatsApp Proxy Architecture](./WHATSAPP_PROXY_ARCHITECTURE.md)**
  - Arquitectura del proxy robusto para Session Manager
  - Componentes: sessionManagerClient, whatsappQrProxy
  - Endpoints públicos y flujos de comunicación
  - Validación de reglas arquitectónicas

#### QR Authorization System (NEW)
- **[QR Authorization Architecture](./QR_AUTHORIZATION_ARCHITECTURE.md)** ⭐
  - Decisión arquitectónica final (MySQL)
  - Modelo de datos completo
  - Implementación faseada (Fase 1 + Fase 2)
  - Flujos de trabajo y diagramas de secuencia
  - Seguridad, auditoría y métricas

- **[QR Authorization Implementation Guide](./QR_AUTHORIZATION_IMPLEMENTATION_GUIDE.md)** 🛠️
  - Guía paso a paso para implementar
  - Código completo de servicios y rutas
  - Testing manual y E2E
  - Troubleshooting y monitoreo

- **[QR Authorization Summary](./QR_AUTHORIZATION_SUMMARY.md)** 📋
  - Resumen ejecutivo de 1 página
  - Checklist de implementación
  - API specification
  - Rollback plan

---

### 📖 Manuales y Guías

#### Campañas
- **[Manual de Campañas](./MANUAL_CAMPANAS.md)**
  - Uso del sistema de campañas
  - Creación y gestión de envíos

- **[Manual Técnico de Campañas](./MANUAL_TECNICO_CAMPANAS.md)**
  - Arquitectura técnica de campañas
  - Integración con Session Manager

- **[Arquitectura de Edición de Campañas](./ARQUITECTURA_EDICION_CAMPANAS.md)**
  - Sistema de edición de campañas
  - Flujos y estados

#### Destinatarios y Prospectos
- **[Guía de Destinatarios](./guides/GUIA_DESTINATARIOS.md)**
  - Gestión de destinatarios
  - Segmentación y filtros

#### Desarrollo
- **[Guía VS Code Remote SSH](./guides/GUIA_VSCODE_REMOTE_SSH.md)**
  - Configuración de desarrollo remoto
  - Workflows con SSH

---

### 🔐 Autenticación y Seguridad

- **[Autenticación](./AUTENTICACION.md)**
  - Sistema de autenticación JWT
  - Roles: cliente / admin
  - Middleware de autenticación

- **[Instalación de Auth](./INSTALACION_AUTH.md)**
  - Setup inicial del sistema de auth
  - Configuración de usuarios y roles

---

### 📐 Arquitectura General

- **[Arquitectura Modular](./ARQUITECTURA_MODULAR.md)**
  - Estructura de módulos del sistema
  - Separación de responsabilidades
  - Principios de diseño

- **[Session Manager Endpoints](./ENDPOINTS_SESSION_MANAGER.md)**
  - Endpoints del Session Manager externo
  - Integración con Central Hub

---

### 🚀 Deployment

- **[Guía de Deployment](./GUIA_DEPLOYMENT.md)**
  - Proceso de deployment general
  - Configuración de entornos

- **[Deploy a Contabo](./deployment/DEPLOY_CONTABO.md)**
  - Deployment específico en Contabo
  - Configuración de servidor

- **[Diferencias Local vs Producción](./DIFERENCIAS_LOCAL_VS_PRODUCCION.md)**
  - Configuraciones por entorno
  - Troubleshooting

---

### 🧪 Testing y Verificación

#### Session Manager
- **[Pruebas de Session Manager](./PRUEBAS_SESSION_MANAGER.md)**
  - Testing del Session Manager
  - Casos de prueba

- **[Verificación de Session Manager](./VERIFICACION_SESSION_MANAGER.md)**
  - Checklist de verificación
  - Health checks

---

### 📅 Roadmap y Prioridades

- **[Prioridades de Desarrollo](./PRIORIDADES_DESARROLLO.md)**
  - Roadmap general del proyecto
  - Features planificadas

- **[Prioridades Frontend](./PRIORIDADES_FRONTEND.md)** / **[frontend/](./frontend/PRIORIDADES_FRONTEND.md)**
  - Roadmap específico de frontend
  - UI/UX improvements

- **[Agenda Próxima Jornada](./AGENDA_PROXIMA_JORNADA.md)**
  - Tasks pendientes de corto plazo
  - Sprint planning

- **[TODO 2025-12-31](./guides/TODO_2025-12-31.md)**
  - Lista de tareas con deadline
  - Backlog priorizado

---

### 📝 Cambios y Actualizaciones

- **[Cambios Diciembre 2025](./CAMBIOS_DICIEMBRE_2025.md)**
  - Changelog del mes
  - Breaking changes y migraciones

- **[Reorganización de Docs](./REORGANIZACION_DOCS.md)**
  - Reestructuración de documentación
  - Nuevas convenciones

---

### 🎨 Frontend

- **[Arquitectura Frontend](./frontend/ARQUITECTURA_FRONTEND.md)**
  - Arquitectura de la aplicación React
  - Componentes y servicios

- **[Guía Rápida Frontend](./frontend/GUIA_RAPIDA.md)**
  - Setup rápido del frontend
  - Comandos comunes

---

## 🗂️ Estructura de Carpetas

```
docs/
├── deployment/              # Guías de deployment
│   └── DEPLOY_CONTABO.md
├── frontend/                # Docs específicas de frontend
│   ├── ARQUITECTURA_FRONTEND.md
│   ├── GUIA_RAPIDA.md
│   └── PRIORIDADES_FRONTEND.md
├── guides/                  # Guías generales
│   ├── GUIA_DESTINATARIOS.md
│   ├── GUIA_VSCODE_REMOTE_SSH.md
│   └── TODO_2025-12-31.md
├── session-manager/         # Docs de Session Manager
│   └── (varios archivos)
├── WHATSAPP_PROXY_ARCHITECTURE.md     # ⭐ Proxy WhatsApp
├── QR_AUTHORIZATION_ARCHITECTURE.md   # ⭐ Auth de QR (NEW)
├── QR_AUTHORIZATION_IMPLEMENTATION_GUIDE.md  # ⭐ Guía impl (NEW)
├── QR_AUTHORIZATION_SUMMARY.md        # ⭐ Resumen (NEW)
└── ... (otros archivos)
```

---

## 🆕 Últimas Actualizaciones

### 3 de enero de 2026

#### ⭐ QR Authorization System (NUEVO)
- Arquitectura completa documentada
- Implementación faseada (Fase 1 + Fase 2)
- Modelo de datos en MySQL
- Guía de implementación paso a paso
- Resumen ejecutivo

#### ✅ WhatsApp Proxy Architecture
- Documentación completa del proxy robusto
- Validación de reglas arquitectónicas
- Sequence diagrams para todos los flujos
- API reference completa

---

## 🔍 Cómo Navegar Esta Documentación

### Si eres nuevo en el proyecto:
1. Lee **[ARQUITECTURA_MODULAR.md](./ARQUITECTURA_MODULAR.md)** para entender la estructura
2. Revisa **[AUTENTICACION.md](./AUTENTICACION.md)** para entender roles y permisos
3. Consulta **[WHATSAPP_PROXY_ARCHITECTURE.md](./WHATSAPP_PROXY_ARCHITECTURE.md)** para la integración WhatsApp

### Si vas a implementar QR Authorization:
1. Lee **[QR_AUTHORIZATION_SUMMARY.md](./QR_AUTHORIZATION_SUMMARY.md)** (5 min)
2. Estudia **[QR_AUTHORIZATION_ARCHITECTURE.md](./QR_AUTHORIZATION_ARCHITECTURE.md)** (30 min)
3. Sigue **[QR_AUTHORIZATION_IMPLEMENTATION_GUIDE.md](./QR_AUTHORIZATION_IMPLEMENTATION_GUIDE.md)** paso a paso

### Si necesitas hacer deployment:
1. **[GUIA_DEPLOYMENT.md](./GUIA_DEPLOYMENT.md)** - Proceso general
2. **[deployment/DEPLOY_CONTABO.md](./deployment/DEPLOY_CONTABO.md)** - Específico de Contabo
3. **[DIFERENCIAS_LOCAL_VS_PRODUCCION.md](./DIFERENCIAS_LOCAL_VS_PRODUCCION.md)** - Configuraciones

### Si trabajas en frontend:
1. **[frontend/ARQUITECTURA_FRONTEND.md](./frontend/ARQUITECTURA_FRONTEND.md)**
2. **[frontend/GUIA_RAPIDA.md](./frontend/GUIA_RAPIDA.md)**
3. **[frontend/PRIORIDADES_FRONTEND.md](./frontend/PRIORIDADES_FRONTEND.md)**

---

## 📞 Soporte y Contacto

- **Repositorio:** `/root/leadmaster-workspace/services/central-hub`
- **Dashboard:** https://desarrolloydisenioweb.com.ar/dashboard
- **Logs:** `tail -f logs/central-hub.log`
- **MySQL:** `mysql -u root -p leadmaster`

---

## 🎯 Quick Links

| Tema | Link |
|------|------|
| Proxy WhatsApp | [WHATSAPP_PROXY_ARCHITECTURE.md](./WHATSAPP_PROXY_ARCHITECTURE.md) |
| Auth QR (Nuevo) | [QR_AUTHORIZATION_ARCHITECTURE.md](./QR_AUTHORIZATION_ARCHITECTURE.md) |
| Implementar Auth QR | [QR_AUTHORIZATION_IMPLEMENTATION_GUIDE.md](./QR_AUTHORIZATION_IMPLEMENTATION_GUIDE.md) |
| Autenticación JWT | [AUTENTICACION.md](./AUTENTICACION.md) |
| Campañas | [MANUAL_CAMPANAS.md](./MANUAL_CAMPANAS.md) |
| Deployment | [GUIA_DEPLOYMENT.md](./GUIA_DEPLOYMENT.md) |
| Frontend | [frontend/ARQUITECTURA_FRONTEND.md](./frontend/ARQUITECTURA_FRONTEND.md) |
| TODO | [guides/TODO_2025-12-31.md](./guides/TODO_2025-12-31.md) |

---

**Última actualización:** 3 de enero de 2026  
**Mantenido por:** Equipo de Desarrollo LeadMaster
