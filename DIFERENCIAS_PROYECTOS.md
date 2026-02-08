# 🏗️ Diferencias entre los Proyectos del Workspace

**Fecha:** 8 de febrero de 2026  
**Autor:** Lead Master Team

---

## 📊 Resumen Ejecutivo

El workspace **LeadMaster** contiene **DOS NIVELES** de proyecto:

1. **`/root/leadmaster-workspace/`** → **MONOREPO COMPLETO** (Orquestador)
2. **`/root/leadmaster-workspace/services/central-hub/`** → **SERVICIO PRINCIPAL** (Aplicación)

---

## 🎯 1. MONOREPO COMPLETO: `/root/leadmaster-workspace/`

### Descripción
**Workspace contenedor** que orquesta múltiples servicios y componentes del ecosistema LeadMaster.

### Propósito Principal
- Gestionar **infraestructura compartida**
- Coordinar **múltiples servicios** independientes
- Proveer **configuración global** (Nginx, PM2, SSL)
- Centralizar **scripts de deployment**
- Documentar **arquitectura del sistema completo**

### Estructura

```
/root/leadmaster-workspace/
├── services/              ← SERVICIOS INDEPENDIENTES
│   ├── central-hub/       → Aplicación principal (backend + frontend + WhatsApp)
│   └── session-manager/   → Gestor de sesión única de WhatsApp (microservicio)
│
├── shared/                ← CÓDIGO COMPARTIDO
│   ├── config/            → Configuraciones comunes
│   ├── db/                → Conexiones y modelos de BD
│   ├── logger/            → Sistema de logging
│   └── types/             → Tipos TypeScript compartidos
│
├── scripts/               ← SCRIPTS DE DEPLOYMENT
│   ├── deploy/            → Scripts de despliegue
│   └── pm2/               → Configuraciones PM2
│
├── infra/                 ← INFRAESTRUCTURA
│   └── nginx/             → Configuraciones Nginx, SSL, proxy
│
├── docs/                  ← DOCUMENTACIÓN GLOBAL
│   ├── PROJECT-STATUS.md  → Estado general del proyecto
│   ├── PHASE-2-COMPLETED.md
│   ├── PHASE-3-PLAN.md
│   └── SSL-Cloudflare-Setup.md
│
├── package.json           → Dependencias globales (jest)
└── README.md              → Documentación del SISTEMA COMPLETO
```

### Responsabilidades

✅ **Infraestructura:**
- Nginx como proxy inverso
- SSL/TLS con Cloudflare Origin Certificate
- Configuración de dominio: https://desarrolloydisenioweb.com.ar
- PM2 para gestión de procesos

✅ **Orquestación:**
- Coordinar servicios `central-hub` y `session-manager`
- Gestionar dependencias compartidas
- Deployment unificado

✅ **Documentación:**
- Estado global del proyecto (Phases 1, 2, 3)
- Guías de infraestructura
- Contratos entre servicios

### Puerto
**No tiene puerto propio** - Orquesta servicios que sí tienen puertos

### Stack Tecnológico
- **Web Server:** Nginx
- **Process Manager:** PM2
- **SSL/TLS:** Cloudflare Origin Certificate
- **Infraestructura:** VPS Contabo

---

## 🚀 2. SERVICIO PRINCIPAL: `/root/leadmaster-workspace/services/central-hub/`

### Descripción
**Aplicación principal** del sistema LeadMaster. Es el servicio que contiene toda la lógica de negocio.

### Propósito Principal
- **Backend API REST completo** (autenticación, campañas, destinatarios, envíos)
- **Frontend React + Vite** (SPA para gestión de campañas)
- **Integración WhatsApp** (gestión de sesiones, envío manual)
- **Gestión de leads multicliente** (CRUD, filtros, estados)
- **Sistema de campañas** (creación, aprobación, envío)

### Estructura

```
/root/leadmaster-workspace/services/central-hub/
├── src/                   ← BACKEND (Node.js + Express)
│   ├── modules/
│   │   ├── auth/          → Autenticación JWT + RBAC
│   │   ├── sender/        → Campañas y envíos masivos
│   │   │   ├── controllers/
│   │   │   ├── routes/
│   │   │   └── services/
│   │   ├── session-manager/ → Proxy a session-manager service
│   │   ├── listener/      → Bot responder con IA
│   │   └── sync-contacts/ → Sincronización Gmail Contacts
│   ├── config/            → DB, variables de entorno
│   └── index.js           → Entry point (puerto 3012)
│
├── frontend/              ← FRONTEND (React + Vite + TailwindCSS)
│   ├── src/
│   │   ├── components/    → Componentes React (Login, Dashboard, Campaigns)
│   │   ├── services/      → Clientes API (axios)
│   │   └── App.jsx        → Aplicación principal
│   ├── public/
│   └── package.json       → Dependencias frontend
│
├── docs/                  ← DOCUMENTACIÓN DEL SERVICIO
│   ├── informes/          → Informes técnicos (5 archivos)
│   ├── diagnosticos/      → Diagnósticos de problemas (6 archivos)
│   ├── procedimientos/    → Checklists y procedimientos (4 archivos)
│   ├── planificacion/     → Roadmaps y TODOs (2 archivos)
│   └── guides/            → Guías de uso
│
├── tests/                 ← TESTING (Playwright E2E)
│   ├── auth.e2e.spec.ts
│   └── campaigns.e2e.spec.ts
│
├── scripts/               ← SCRIPTS DE UTILIDAD
│   ├── test-*.js          → Scripts de testing
│   └── debug-*.js         → Scripts de debugging
│
├── migrations/            ← MIGRACIONES DE BASE DE DATOS
│
├── tokens/                ← SESIONES WHATSAPP (LocalAuth)
│
├── package.json           → Dependencias del servicio
└── README.md              → Documentación del SERVICIO
```

### Responsabilidades

✅ **Backend API:**
- Endpoints REST para campañas, destinatarios, envíos
- Autenticación JWT con roles (admin, cliente)
- Integración con MySQL
- Proxy a session-manager para WhatsApp

✅ **Frontend SPA:**
- Gestión de campañas (crear, editar, aprobar)
- Visualización de destinatarios
- Control de envíos manuales
- Dashboard con métricas

✅ **Lógica de Negocio:**
- Gestión de campañas multicliente
- Sistema de aprobación de campañas
- Envío manual vía WhatsApp Web
- Tracking de estados de destinatarios

### Puerto
**3012** (definido en `.env`)

### Stack Tecnológico
- **Backend:** Node.js + Express.js
- **Frontend:** React 18 + Vite + TailwindCSS
- **Database:** MySQL
- **Testing:** Playwright (E2E), Jest (Unit)
- **WhatsApp:** whatsapp-web.js (via session-manager)

---

## 🔗 3. SERVICIO AUXILIAR: `/root/leadmaster-workspace/services/session-manager/`

### Descripción
**Microservicio independiente** que gestiona una ÚNICA sesión de WhatsApp compartida.

### Propósito
- Gestionar conexión WhatsApp con Venom-bot
- Generar códigos QR para autenticación
- Persistir sesión entre reinicios
- Proveer API para envío de mensajes

### Puerto
**3011**

### Responsabilidades
- Única fuente de verdad para la sesión WhatsApp
- API REST: `/status`, `/qr-code`, `/send`
- Persistencia de tokens en `tokens/`

---

## 🎨 Comparación Visual

```
┌────────────────────────────────────────────────────────────────┐
│  /root/leadmaster-workspace/  (MONOREPO - ORQUESTADOR)         │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Nginx (Proxy Inverso + SSL)                              │  │
│  │  Puerto 80/443 → routing interno                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─────────────────────────┐  ┌────────────────────────────┐  │
│  │  SERVICIO 1:             │  │  SERVICIO 2:                │  │
│  │  central-hub             │  │  session-manager            │  │
│  │  (Aplicación Principal)  │  │  (Gestor WhatsApp)          │  │
│  │                          │  │                             │  │
│  │  Puerto: 3012            │  │  Puerto: 3011               │  │
│  │  Backend + Frontend      │  │  API WhatsApp               │  │
│  │  Gestión de Campañas     │  │  Gestión de Sesión          │  │
│  └─────────────────────────┘  └────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Shared/ (código compartido)                              │  │
│  │  - config, db, logger, types                              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Infra/ (nginx configs, SSL certs, PM2)                   │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

---

## 📋 Tabla Comparativa

| Aspecto | `/root/leadmaster-workspace/` | `services/central-hub/` |
|---------|-------------------------------|-------------------------|
| **Tipo** | Monorepo / Workspace | Servicio / Aplicación |
| **Rol** | Orquestador | Aplicación principal |
| **Contiene** | Múltiples servicios | Código de UN servicio |
| **Puerto** | No tiene (proxy) | 3012 |
| **Backend** | No tiene | Node.js + Express ✅ |
| **Frontend** | No tiene | React + Vite ✅ |
| **Database** | Configuración compartida | Lógica de acceso ✅ |
| **Infraestructura** | Nginx, PM2, SSL ✅ | Usa la del workspace |
| **Tests** | No tiene | Playwright + Jest ✅ |
| **README** | Sistema completo | Servicio específico |
| **package.json** | Deps globales (jest) | Deps del servicio |
| **Documentación** | `docs/` global | `docs/` del servicio |
| **Git** | Raíz del repo | Submódulo del repo |

---

## 🔄 Flujo de Trabajo

### Desarrollo en central-hub

```bash
cd /root/leadmaster-workspace/services/central-hub
npm install
npm run dev           # Desarrollo

# Testing
npm test              # Tests unitarios
npm run test:e2e      # Tests E2E Playwright
```

### Deployment (desde workspace)

```bash
cd /root/leadmaster-workspace

# Usar scripts del workspace
pm2 show leadmaster-hub
pm2 restart leadmaster-hub
pm2 logs leadmaster-hub
```

### Infraestructura (desde workspace)

```bash
cd /root/leadmaster-workspace

# Configurar Nginx
nano infra/nginx/sites-available/leadmaster.conf

# Recargar Nginx
sudo systemctl reload nginx
```

---

## 🎯 ¿Cuál usar?

### Trabajas en `/root/leadmaster-workspace/` cuando:
- ✅ Configuras infraestructura (Nginx, SSL, PM2)
- ✅ Agregas un nuevo servicio al ecosistema
- ✅ Modificas configuración compartida
- ✅ Documentas arquitectura general
- ✅ Haces deployment completo

### Trabajas en `services/central-hub/` cuando:
- ✅ Desarrollas features de la aplicación
- ✅ Modificas backend API o frontend
- ✅ Agregas nuevos endpoints
- ✅ Escribes tests
- ✅ Documentas funcionalidades específicas
- ✅ Debuggeas lógica de negocio

---

## 📝 Ejemplo Práctico

### Implementar "Envío Manual vía WhatsApp Web"

**¿Dónde se implementa?**  
👉 **`services/central-hub/`**

**¿Por qué?**
- Es una funcionalidad de la aplicación principal
- Requiere modificar backend (controller, routes)
- Requiere modificar frontend (componentes React)
- La documentación va en `services/central-hub/docs/informes/`

**¿El workspace participa?**  
❌ No directamente, solo orquesta el deployment

```bash
# 1. Desarrollo (en central-hub)
cd /root/leadmaster-workspace/services/central-hub
git checkout -b feature/envio-manual
# ... implementar código ...
git commit -m "feat: agregar envío manual vía WhatsApp Web"

# 2. Testing (en central-hub)
npm test
npm run test:e2e

# 3. Push (desde central-hub)
git push origin feature/envio-manual

# 4. Deployment (desde workspace)
cd /root/leadmaster-workspace
pm2 restart leadmaster-hub
```

---

## 🔗 Relación entre Proyectos

```
Workspace (Contenedor)
    ├── Orquesta servicios
    ├── Provee infraestructura
    └── Gestiona deployment
        │
        └─→ central-hub (Aplicación)
            ├── Usa infraestructura del workspace
            ├── Se despliega con PM2 del workspace
            └── Expone puerto 3012 (proxiado por Nginx del workspace)
        │
        └─→ session-manager (Microservicio)
            ├── Usa infraestructura del workspace
            ├── Se despliega con PM2 del workspace
            └── Expone puerto 3011 (usado por central-hub)
```

---

## ✅ Checklist de Identificación

**¿Estoy en el workspace?**
- [ ] Veo carpeta `services/` con múltiples servicios
- [ ] Veo carpeta `infra/` con configs de Nginx
- [ ] Veo carpeta `shared/` con código compartido
- [ ] README.md habla de "LeadMaster Workspace"
- [ ] package.json tiene solo `jest` de dependencia

**¿Estoy en central-hub?**
- [ ] Veo carpeta `src/` con código Node.js
- [ ] Veo carpeta `frontend/` con código React
- [ ] Veo `index.js` como entry point
- [ ] README.md habla de "Leadmaster Central Hub"
- [ ] package.json tiene muchas dependencias (express, mysql, etc)

---

## 📚 Referencias

- **Workspace README:** [`/root/leadmaster-workspace/README.md`](README.md)
- **Central-Hub README:** [`/root/leadmaster-workspace/services/central-hub/README.md`](services/central-hub/README.md)
- **Navegación Docs Central-Hub:** [`/root/leadmaster-workspace/services/central-hub/NAVEGACION_DOCS.md`](services/central-hub/NAVEGACION_DOCS.md)
- **Estado del Proyecto:** [`/root/leadmaster-workspace/docs/PROJECT-STATUS.md`](docs/PROJECT-STATUS.md)

---

**Creado:** 8 de febrero de 2026  
**Mantenedor:** Lead Master Team  
**Última actualización:** 2026-02-08
