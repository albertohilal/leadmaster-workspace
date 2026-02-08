# 📚 Navegación de Documentación - Central Hub

**Última actualización:** 8 de febrero de 2026

Este archivo sirve como índice para navegar toda la documentación del proyecto LeadMaster Central Hub.

---

## 📂 Estructura de Documentación

### 📋 /docs/informes/
Informes técnicos de implementaciones, cambios y correcciones realizadas.

- [INFORME_APROBACION_CAMPANAS.md](docs/informes/INFORME_APROBACION_CAMPANAS.md) - Sistema de aprobación manual de campañas
- [INFORME_CAMBIOS_2026-01-22.md](docs/informes/INFORME_CAMBIOS_2026-01-22.md) - Cambios realizados el 22 de enero
- [INFORME_ENVIO_MANUAL_WHATSAPP_2026-02-08.md](docs/informes/INFORME_ENVIO_MANUAL_WHATSAPP_2026-02-08.md) - **NUEVO** Implementación de envío manual vía WhatsApp Web
- [INFORME_ROUTING_FIX.md](docs/informes/INFORME_ROUTING_FIX.md) - Corrección de routing en el sistema
- [INFORME_WHATSAPP_QR_ISSUE.md](docs/informes/INFORME_WHATSAPP_QR_ISSUE.md) - Resolución de problemas con códigos QR

---

### 🔍 /docs/diagnosticos/
Análisis de problemas encontrados y sus resoluciones.

- [DIAGNOSTICO_ENVIOS_PENDIENTES.md](docs/diagnosticos/DIAGNOSTICO_ENVIOS_PENDIENTES.md) - Análisis de envíos pendientes en el sistema
- [DIAGNOSTICO_FRONTEND_CACHE_304.md](docs/diagnosticos/DIAGNOSTICO_FRONTEND_CACHE_304.md) - Problema de caché 304 en frontend
- [DIAGNOSTICO_LOGIN_PRODUCCION.md](docs/diagnosticos/DIAGNOSTICO_LOGIN_PRODUCCION.md) - Diagnóstico de login en producción
- [DIAGNOSTICO_OPERATIVO_SCHEDULER.md](docs/diagnosticos/DIAGNOSTICO_OPERATIVO_SCHEDULER.md) - Análisis operativo del scheduler
- [DIAGNOSTICO_PM2_ENV_VARIABLES.md](docs/diagnosticos/DIAGNOSTICO_PM2_ENV_VARIABLES.md) - Variables de entorno en PM2
- [DIAGNOSTICO_WHATSAPP_CONNECTION_ERROR.md](docs/diagnosticos/DIAGNOSTICO_WHATSAPP_CONNECTION_ERROR.md) - Errores de conexión WhatsApp

---

### ✅ /docs/procedimientos/
Checklists, procedimientos y puntos de control del proyecto.

- [AJUSTE_COMPLETADO.md](docs/procedimientos/AJUSTE_COMPLETADO.md) - Documentación de ajustes completados
- [CHECKLIST_QR_AUTHORIZATION.md](docs/procedimientos/CHECKLIST_QR_AUTHORIZATION.md) - Checklist para autorización QR
- [CIERRE_DE_FASE.md](docs/procedimientos/CIERRE_DE_FASE.md) - Procedimiento de cierre de fase
- [PUNTO_DE_RETORNO_PR01.md](docs/procedimientos/PUNTO_DE_RETORNO_PR01.md) - Punto de retorno seguro PR01

---

### 📅 /docs/planificacion/
Roadmaps, TODOs y planificación del proyecto.

- [PHASE_3_ROADMAP.md](docs/planificacion/PHASE_3_ROADMAP.md) - Roadmap de la Fase 3
- [TODO_2025-12-31.md](docs/planificacion/TODO_2025-12-31.md) - Lista de tareas pendientes

---

### 📖 /docs/guides/
Guías técnicas y manuales de usuario.

Ver carpeta [docs/guides/](docs/guides/) para:
- Guías de implementación
- Manuales técnicos
- Tutoriales paso a paso

---

### 🏗️ /docs/backend/
Documentación específica del backend.

Ver carpeta [docs/backend/](docs/backend/)

---

### 🎨 /docs/frontend/
Documentación específica del frontend.

Ver carpeta [docs/frontend/](docs/frontend/)

---

### 🚀 /docs/deployment/
Guías de despliegue y configuración de producción.

Ver carpeta [docs/deployment/](docs/deployment/)

---

### 🔌 /docs/session-manager/
Documentación del módulo Session Manager.

Ver carpeta [docs/session-manager/](docs/session-manager/)

---

### 🧠 /docs/decisiones/ & /docs/decisions/
Registro de decisiones arquitectónicas (ADR - Architecture Decision Records).

Ver carpetas:
- [docs/decisiones/](docs/decisiones/)
- [docs/decisions/](docs/decisions/)

---

## 🔗 Enlaces Rápidos

### Documentos Principales
- [README.md](README.md) - Documentación principal del proyecto
- [docs/INDEX.md](docs/INDEX.md) - Índice general de docs/

### Manuales de Usuario
- [docs/MANUAL_CAMPANAS.md](docs/MANUAL_CAMPANAS.md)
- [docs/MANUAL_EDICION_CAMPANAS.md](docs/MANUAL_EDICION_CAMPANAS.md)
- [docs/MANUAL_TECNICO_CAMPANAS.md](docs/MANUAL_TECNICO_CAMPANAS.md)

### Arquitectura
- [docs/ARQUITECTURA_MODULAR.md](docs/ARQUITECTURA_MODULAR.md)
- [docs/ARQUITECTURA_EDICION_CAMPANAS.md](docs/ARQUITECTURA_EDICION_CAMPANAS.md)
- [docs/WHATSAPP_PROXY_ARCHITECTURE.md](docs/WHATSAPP_PROXY_ARCHITECTURE.md)

### Autenticación y Seguridad
- [docs/AUTENTICACION.md](docs/AUTENTICACION.md)
- [docs/QR_AUTHORIZATION_ARCHITECTURE.md](docs/QR_AUTHORIZATION_ARCHITECTURE.md)

### Deployment
- [docs/GUIA_DEPLOYMENT.md](docs/GUIA_DEPLOYMENT.md)
- [docs/PM2_DEPLOYMENT_GUIDE.md](docs/PM2_DEPLOYMENT_GUIDE.md)
- [docs/PM2_PRODUCTION_DEPLOYMENT.md](docs/PM2_PRODUCTION_DEPLOYMENT.md)

---

## 🎯 Por Tema

### WhatsApp & Mensajería
- Informes: `INFORME_WHATSAPP_QR_ISSUE.md`, `INFORME_ENVIO_MANUAL_WHATSAPP_2026-02-08.md`
- Diagnósticos: `DIAGNOSTICO_WHATSAPP_CONNECTION_ERROR.md`
- Arquitectura: `docs/WHATSAPP_PROXY_ARCHITECTURE.md`, `docs/WHATSAPP_QR_AUTHORIZATION_MODULE.md`

### Campañas
- Informes: `INFORME_APROBACION_CAMPANAS.md`
- Manuales: `docs/MANUAL_CAMPANAS.md`, `docs/MANUAL_EDICION_CAMPANAS.md`
- Arquitectura: `docs/ARQUITECTURA_EDICION_CAMPANAS.md`

### Deployment & Producción
- Guías: `docs/GUIA_DEPLOYMENT.md`, `docs/PM2_DEPLOYMENT_GUIDE.md`
- Diagnósticos: `DIAGNOSTICO_PM2_ENV_VARIABLES.md`

### Frontend
- Diagnósticos: `DIAGNOSTICO_FRONTEND_CACHE_304.md`
- Docs: `docs/frontend/`

---

## 📝 Convenciones

### Nomenclatura de Archivos

- **INFORME_[TEMA]_[FECHA].md** - Informes técnicos de implementaciones
- **DIAGNOSTICO_[TEMA].md** - Análisis de problemas y resoluciones
- **CHECKLIST_[TEMA].md** - Listas de verificación
- **MANUAL_[TEMA].md** - Documentación de usuario
- **ARQUITECTURA_[TEMA].md** - Documentación arquitectónica

### Organización

1. **Raíz del proyecto**: Solo README.md y NAVEGACION_DOCS.md
2. **docs/informes/**: Informes de implementaciones y cambios
3. **docs/diagnosticos/**: Análisis de problemas
4. **docs/procedimientos/**: Checklists y procedimientos
5. **docs/planificacion/**: Roadmaps y planificación
6. **docs/[modulo]/**: Documentación específica por módulo

---

## 🔄 Última Reorganización

**Fecha:** 8 de febrero de 2026  
**Cambios:**
- ✅ Movidos 5 archivos INFORME_*.md a `docs/informes/`
- ✅ Movidos 6 archivos DIAGNOSTICO_*.md a `docs/diagnosticos/`
- ✅ Movidos 4 archivos de procedimientos a `docs/procedimientos/`
- ✅ Movidos 2 archivos de planificación a `docs/planificacion/`
- ✅ Creado este archivo de navegación
- ✅ Organizado 1 informe en session-manager
- ✅ Total: 18 archivos organizados y sincronizados con GitHub

---

**Mantenedor:** Lead Master Team  
**Proyecto:** LeadMaster - Central Hub  
**Versión:** 1.0
