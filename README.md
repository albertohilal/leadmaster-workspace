# LeadMaster Workspace

Sistema de gestión de leads con integración WhatsApp, autenticación JWT y arquitectura modular.

**Estado actual:** ✅ Phase 2 Completed - Producción operativa  
**Dominio:** https://desarrolloydisenioweb.com.ar  
**Documentación:** [`docs/PROJECT-STATUS.md`](docs/PROJECT-STATUS.md)

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

**Documentación completa:** [`docs/PHASE-2-COMPLETED.md`](docs/PHASE-2-COMPLETED.md)

### 📋 Phase 3: WhatsApp Session Lifecycle (PLANNED)
- WhatsApp connection flow (QR generation)
- Session persistence
- Real-time status updates
- Frontend integration

**Planificación:** [`docs/PHASE-3-PLAN.md`](docs/PHASE-3-PLAN.md)

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

- **Estado del proyecto:** [`docs/PROJECT-STATUS.md`](docs/PROJECT-STATUS.md)
- **Phase 2 completada:** [`docs/PHASE-2-COMPLETED.md`](docs/PHASE-2-COMPLETED.md)
- **Phase 3 planificada:** [`docs/PHASE-3-PLAN.md`](docs/PHASE-3-PLAN.md)
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

- Trabajo remoto vía VS Code + SSH
- Uso intensivo de GitHub Copilot (Claude Sonnet 4.5)
- Arquitectura modular para escalabilidad
- Testing end-to-end validado
- Producción estable y operativa

---

**Lead Developer:** Alberto Hilal  
**Repository:** albertohilal/leadmaster-workspace  
**Last Updated:** 2026-01-02
