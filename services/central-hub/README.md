# Leadmaster Central Hub

Sistema modular para la gestión centralizada de:
- Envío masivo de WhatsApp
- Listener/bot responder con IA
- Scraper de Google Places
- Gestión de leads multicliente

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
├── frontend/              # Frontend React/Vue
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

- **Guías de uso:** `docs/guides/`
  - `GUIA_DESTINATARIOS.md` - Gestión de destinatarios
  - `GUIA_VSCODE_REMOTE_SSH.md` - Desarrollo remoto
  - `TODO_2025-12-31.md` - Tareas pendientes
  
- **Deployment:** `docs/deployment/`
  - `DEPLOY_CONTABO.md` - Despliegue en Contabo VPS

- **Arquitectura:** `docs/`
  - `ARQUITECTURA_UNIFICACION.md`
  - `AUTENTICACION.md`

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
**Próximo milestone:** Migración de venom-bot a whatsapp-web.js (ver `docs/guides/TODO_2025-12-31.md`)