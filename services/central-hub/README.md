# Leadmaster Central Hub

Sistema modular para la gestión centralizada de:

- Envío masivo de WhatsApp
- Listener / bot responder con IA
- Gateway autenticado para canal Email
- Gestión de leads multicliente
- Control de autorización de QR WhatsApp

## 📁 Estructura del Proyecto

```text
leadmaster-central-hub/
├── src/                     # Código fuente
│   ├── modules/             # Módulos del sistema
│   │   ├── auth/            # Autenticación JWT
│   │   ├── session-manager/ # Gestión WhatsApp (única fuente de verdad)
│   │   ├── sender/          # Envíos masivos
│   │   ├── listener/        # Respuestas automáticas
│   │   ├── sync-contacts/   # Sincronización Gmail Contacts
│   │   ├── email/           # Integración funcional de Email en central-hub
│   │   └── mailer/          # Gateway HTTP autenticado hacia leadmaster-mailer
│   ├── integrations/        # Clientes HTTP a servicios internos
│   │   ├── sessionManager/
│   │   └── mailer/
│   └── index.js             # Entry point
├── frontend/                # Frontend React/Vite del hub
├── docs/                    # Documentación local del servicio
├── scripts/                 # Scripts de utilidad y testing
├── tests/                   # Tests Playwright
├── docker/                  # Configuración Docker
├── tokens/                  # Sesiones WhatsApp (LocalAuth)
├── .env                     # Variables de entorno
└── package.json             # Dependencias
```

## 🎯 Responsabilidad del servicio

`central-hub` es la frontera principal autenticada del workspace.
Su responsabilidad es orquestar módulos internos y exponer endpoints para operación segura desde frontend.

### Incluye

* autenticación JWT
* contexto multicliente
* integración con WhatsApp
* integración con `leadmaster-mailer`
* selección y operación sobre prospectos
* gateway autenticado para Email
* coordinación de módulos del workspace

### No incluye

* scraping de Google Places
* enriquecimiento externo de datos
* pipelines de captación fuera del workspace

**Importante:**
El scraping de Google Places y procesos relacionados de captación/enriquecimiento pertenecen al repositorio:

```text
https://github.com/albertohilal/desarrolloydisenio-api
```

## ✉️ Canal Email

El canal Email en `central-hub` se implementa como **gateway autenticado** hacia el servicio standalone `leadmaster-mailer`.

### Estado actual

* `POST /mailer/send` implementado
* JWT obligatorio
* `cliente_id` resuelto desde el usuario autenticado
* integración HTTP con `leadmaster-mailer` implementada
* flujo validado end-to-end en modo prueba

### Alcance actual

* preparación inicial de envío Email desde la UI
* operación manual sobre selección común de prospectos
* uso de configuración SMTP por cliente resuelta por el mailer

### Limitación actual

La principal limitación no es el transporte, sino la disponibilidad de emails útiles en la base operativa.

## 📲 Canal WhatsApp

`central-hub` mantiene la operación principal del canal WhatsApp mediante módulos dedicados.

Incluye:

* integración con `session-manager`
* envíos
* clasificación post-envío
* listener / respuesta automática
* control de sesión y QR

## 🔐 Multi-tenant

El servicio opera en modo multicliente.

Regla principal:

* el contexto tenant se deriva del usuario autenticado
* el frontend no debe decidir libremente `cliente_id` como fuente de verdad
* los gateways internos preservan esa frontera

## 🧩 Integraciones internas

### Session Manager

Cliente HTTP interno para:

* estado de sesión
* QR
* operaciones de WhatsApp

### Mailer

Cliente HTTP interno para:

* envío técnico de Email
* delegación al standalone `leadmaster-mailer`

## 🚀 Arranque local

### Development

```bash
npm install
npm run dev
```

### Production / PM2

```bash
pm2 show leadmaster-central-hub
pm2 logs leadmaster-central-hub
pm2 restart leadmaster-central-hub
```

## ❤️ Health

```bash
curl http://localhost:3012/health
```

## 📚 Documentación relacionada

### Estado general

* `../../PROJECT-STATUS.md`
* `../../docs/01-CONSTITUCIONAL/PROJECT_STATUS.md`

### Canal Email

* `../../docs/07-CONTRATOS/Contratos-HTTP-Central-Hub-Mailer-Gateway.md`
* `../../docs/07-CONTRATOS/Contratos-HTTP-Mailer.md`
* `../../docs/04-INTEGRACION/ARQUITECTURA-CANAL-EMAIL.md`
* `../../docs/06-FASES/PHASE-4B-EMAIL-PROSPECTING-PLAN.md`

### Reportes

* `../../docs/05-REPORTES/2026-03/REPORTE-INTEGRACION-END-TO-END-EMAIL-CENTRAL-HUB-MAILER-2026-03-15.md`

## 📝 Nota de alcance

Este servicio **no debe documentarse ni presentarse como repositorio de scraping de Google Places**.
Si se requiere referencia a captación externa de prospectos o enriquecimiento de datos, debe hacerse como dependencia o ecosistema complementario, no como responsabilidad propia de `central-hub`.
