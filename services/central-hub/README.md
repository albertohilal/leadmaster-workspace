# Leadmaster Central Hub

Sistema modular para la gestión centralizada de:
- Envío masivo de WhatsApp
- Listener/bot responder con IA
- Scraper de Google Places
- Gestión de leads multicliente
- **Control de autorización de QR WhatsApp** ⭐ NUEVO

## 📁 Estructura del Proyecto

```
leadmaster-central-hub/
├── src/                    # Código fuente
│   ├── modules/           # Módulos del sistema
│   │   ├── auth/          # Autenticación JWT
│   │   ├── session-manager/ # Gestión WhatsApp (única fuente de verdad)
│   │   ├── sender/        # Envíos masivos
│   │   ├── listener/      # Respuestas automáticas
│   │   └── sync-contacts/ # Sincronización Gmail Contacts
│   └── index.js           # Entry point
├── frontend/              # Frontend (HTML / futuro React/Vue)
├── docs/                  # Documentación
│   ├── guides/           # Guías de uso y TODOs
│   └── deployment/       # Guías de despliegue
├── scripts/              # Scripts de utilidad y testing
├── tests/                # Tests Playwright
├── docker/               # Configuración Docker
├── tokens/               # Sesiones WhatsApp (LocalAuth)
├── .env                  # Variables de entorno
└── package.json          # Dependencies

```

## 🚀 Inicio Rápido

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env

# Iniciar servicio
npm start

# O con PM2 (producción)
pm2 start src/index.js --name leadmaster-hub
```

## 📚 Documentación

> **📂 Navegación completa:** Ver [NAVEGACION_DOCS.md](NAVEGACION_DOCS.md) para un índice detallado de toda la documentación

### 📂 Estructura Organizada (Actualizado Feb 2026)

La documentación del proyecto está organizada en las siguientes carpetas:

- **📋 [docs/informes/](docs/informes/)** - Informes técnicos de implementaciones y cambios
  - Sistema de aprobación de campañas
  - Envío manual vía WhatsApp Web
  - Correcciones de routing
  - Resolución de issues con QR

- **🔍 [docs/diagnosticos/](docs/diagnosticos/)** - Análisis de problemas y resoluciones
  - Diagnósticos de envíos pendientes
  - Problemas de caché frontend
  - Variables de entorno PM2
  - Errores de conexión WhatsApp

- **✅ [docs/procedimientos/](docs/procedimientos/)** - Checklists y procedimientos
  - Checklists de QR authorization
  - Procedimientos de cierre de fase
  - Puntos de retorno seguros

- **📅 [docs/planificacion/](docs/planificacion/)** - Roadmaps y planificación
  - Phase 3 Roadmap
  - TODOs y tareas pendientes

### 🆕 Nuevo Sistema de Autorización de QR (Enero 2026)

**Documentación completa:**
- **📋 [Resumen Ejecutivo](docs/QR_AUTHORIZATION_SUMMARY.md)** - Lectura rápida (5 min)
- **🏗️ [Arquitectura Completa](docs/QR_AUTHORIZATION_ARCHITECTURE.md)** - Decisión arquitectónica, modelo de datos, flujos
- **🛠️ [Guía de Implementación](docs/QR_AUTHORIZATION_IMPLEMENTATION_GUIDE.md)** - Paso a paso con código
- **💼 [Resumen para Stakeholders](docs/QR_AUTHORIZATION_STAKEHOLDER_SUMMARY.md)** - Impacto de negocio
- **✅ [Checklist Ejecutiva](docs/procedimientos/CHECKLIST_QR_AUTHORIZATION.md)** - Testing y deployment
- **📦 [Migration SQL](migrations/001_create_ll_whatsapp_qr_sessions.sql)** - Tabla de base de datos

**Estado:** Documentación completa, listo para implementar Fase 1

---

### Arquitectura General

- **🔌 [WhatsApp Proxy Architecture](docs/WHATSAPP_PROXY_ARCHITECTURE.md)** - Proxy robusto al Session Manager
- **📖 [Índice de Documentación](docs/INDEX.md)** - Navegación completa
- **🗺️ [Navegación de Docs](NAVEGACION_DOCS.md)** - Mapa completo de documentación

### Guías de Uso

- **Guías:** `docs/guides/`
  - `GUIA_DESTINATARIOS.md` - Gestión de destinatarios
  - `GUIA_VSCODE_REMOTE_SSH.md` - Desarrollo remoto
  
- **Deployment:** `docs/deployment/`
  - `DEPLOY_CONTABO.md` - Despliegue en Contabo VPS

- **Arquitectura:** `docs/`
  - `ARQUITECTURA_MODULAR.md` - Estructura de módulos
  - `AUTENTICACION.md` - Sistema JWT y RBAC

## 🧪 Testing

```bash
# Tests completos
npm test

# Tests de API
npm run test:api

# Tests E2E
npm run test:e2e
```

Scripts de testing disponibles en `scripts/`:
- `test-*.js` - Tests unitarios
- `verify-services.js` - Verificación de servicios
- `debug-campaigns.js` - Debug de campañas

## 🛠️ Características

- ✅ Arquitectura modular con separación de responsabilidades
- ✅ Multi-cliente con aislamiento por `cliente_id`
- ✅ Autenticación JWT
- ✅ Session-manager como única fuente de verdad para WhatsApp
- ✅ Persistencia de sesión WhatsApp (sobrevive reinicios)
- ✅ Integración MySQL + Redis
- ✅ Testing E2E con Playwright

---

**Puerto:** 3012  
**Estado:** En desarrollo activo  
**Próximo milestone:** Completar migración de venom-bot a whatsapp-web.js (ver `docs/guides/TODO_2025-12-31.md`)