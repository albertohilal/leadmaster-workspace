# LeadMaster Workspace

Sistema de gestión de leads con integración WhatsApp, autenticación JWT y arquitectura modular.

**Estado actual:** ✅ Phase 2 Completed - Producción operativa  
**Dominio:** https://desarrolloydisenioweb.com.ar  
**Documentación:** [`docs/01-CONSTITUCIONAL/PROJECT_STATUS.md`](docs/01-CONSTITUCIONAL/PROJECT_STATUS.md)

---

## Estructura del Proyecto

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

---

## Estado del Proyecto

### ✅ Phase 2: Infraestructura + Auth + SPA + Proxy (COMPLETED)
- Nginx + Cloudflare Origin Certificate SSL/TLS
- Proxy inverso Nginx → Node.js (PM2)
- Autenticación JWT funcional
- Frontend React + Vite desplegado
- Backend modular activado

**Documentación completa:** [`docs/06-FASES/PHASE-2-COMPLETED.md`](docs/06-FASES/PHASE-2-COMPLETED.md)

### 🚧 Phase 3: Prospect Quality (ACTIVE)
- Contactability scoring
- Validation gates
- Sender protections

**Planificación:** [`docs/06-FASES/PHASE-3-PROSPECT-QUALITY.md`](docs/06-FASES/PHASE-3-PROSPECT-QUALITY.md)

### 📋 Phase 4: WhatsApp Session Lifecycle (PLANNED)
- WhatsApp connection flow (QR generation)
- Session persistence
- Real-time status updates
- Frontend integration

**Planificación:** [`docs/06-FASES/PHASE-4-WHATSAPP-SESSION-LIFECYCLE-AUTOMATION.md`](docs/06-FASES/PHASE-4-WHATSAPP-SESSION-LIFECYCLE-AUTOMATION.md)

---

## Infraestructura

- **Servidor:** VPS Contabo
- **Web Server:** Nginx 1.18
- **SSL/TLS:** Cloudflare Origin Certificate (Full strict)
- **Protocol:** HTTP/2
- **Process Manager:** PM2
- **Domain:** desarrolloydisenioweb.com.ar

**Guías de infraestructura:**
- [`docs/SSL-Cloudflare-Setup.md`](docs/SSL-Cloudflare-Setup.md) - Configuración SSL
- [`docs/Checklist-Post-SSL.md`](docs/Checklist-Post-SSL.md) - Validación SSL

---

## Quick Start

### Development
```bash
cd services/central-hub
npm install
npm run dev
```

### Production
```bash
pm2 show leadmaster-hub
pm2 logs leadmaster-hub
pm2 restart leadmaster-hub
```

### Health Checks
```bash
curl https://desarrolloydisenioweb.com.ar/health
curl http://localhost:3012/auth/login
```

---

## Documentación

### 🚀 Para Desarrolladores
- **Metodología VPS-First:** [`DEV_WORKFLOW_VPS.md`](DEV_WORKFLOW_VPS.md) - **⭐ Lectura obligatoria**

### 📊 Estado y Planificación
- **Estado del proyecto:** [`docs/01-CONSTITUCIONAL/PROJECT_STATUS.md`](docs/01-CONSTITUCIONAL/PROJECT_STATUS.md)
- **Phase 2 completada:** [`docs/06-FASES/PHASE-2-COMPLETED.md`](docs/06-FASES/PHASE-2-COMPLETED.md)
- **Phase 3 (Prospect Quality):** [`docs/06-FASES/PHASE-3-PROSPECT-QUALITY.md`](docs/06-FASES/PHASE-3-PROSPECT-QUALITY.md)
- **Phase 4 (WhatsApp Session Lifecycle):** [`docs/06-FASES/PHASE-4-WHATSAPP-SESSION-LIFECYCLE-AUTOMATION.md`](docs/06-FASES/PHASE-4-WHATSAPP-SESSION-LIFECYCLE-AUTOMATION.md)

### ✉️ Canal Email (Documentación fundacional)
- **ADR-001 (aprobado):** [`docs/01-CONSTITUCIONAL/ADR-001-CANAL-EMAIL-PROSPECCION-OPERADO-POR-LEADMASTER.md`](docs/01-CONSTITUCIONAL/ADR-001-CANAL-EMAIL-PROSPECCION-OPERADO-POR-LEADMASTER.md)
- **Phase 4B (aprobada):** [`docs/06-FASES/PHASE-4B-EMAIL-PROSPECTING-PLAN.md`](docs/06-FASES/PHASE-4B-EMAIL-PROSPECTING-PLAN.md)
- **Arquitectura del canal:** [`docs/04-INTEGRACION/ARQUITECTURA-CANAL-EMAIL.md`](docs/04-INTEGRACION/ARQUITECTURA-CANAL-EMAIL.md)
- **Requisitos mínimos:** [`docs/05-REPORTES/OPS/REQUISITOS-MINIMOS-CANAL-EMAIL.md`](docs/05-REPORTES/OPS/REQUISITOS-MINIMOS-CANAL-EMAIL.md)
- **Contrato HTTP Mailer:** [`docs/07-CONTRATOS/Contratos-HTTP-Mailer.md`](docs/07-CONTRATOS/Contratos-HTTP-Mailer.md)

### 🔒 Infraestructura y Seguridad
- **Setup SSL:** [`docs/SSL-Cloudflare-Setup.md`](docs/SSL-Cloudflare-Setup.md)
- **Checklist SSL:** [`docs/Checklist-Post-SSL.md`](docs/Checklist-Post-SSL.md)

---

## Seguridad

⚠️ **NUNCA versionar:**
- Certificados SSL (`.crt`, `.key`, `.pem`)
- Variables de entorno (`.env`)
- Tokens y secrets
- Sesiones WhatsApp

✅ **Configuración segura:**
- Certificados en `/etc/nginx/ssl/cloudflare/`
- Permisos: `600` para keys, `644` para certificates
- `.gitignore` actualizado
- JWT secrets en `.env`

---

## Stack Tecnológico

**Frontend:** React 18 + Vite + TailwindCSS  
**Backend:** Node.js + Express.js + JWT  
**Database:** MySQL  
**Process Manager:** PM2  
**Web Server:** Nginx  
**SSL/TLS:** Cloudflare Origin Certificate

---

## Notas de Desarrollo

- **Metodología:** Desarrollo directo en VPS (ver [`DEV_WORKFLOW_VPS.md`](DEV_WORKFLOW_VPS.md))
- Trabajo remoto vía VS Code + SSH
- Uso intensivo de GitHub Copilot (Claude Sonnet 4.5)
- Arquitectura modular para escalabilidad
- Testing end-to-end validado
- Producción estable y operativa

---

**Lead Developer:** Alberto Hilal  
**Repository:** albertohilal/leadmaster-workspace  
**Last Updated:** 2026-02-09
