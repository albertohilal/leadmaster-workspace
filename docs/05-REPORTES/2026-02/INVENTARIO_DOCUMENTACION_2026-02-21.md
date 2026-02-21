# 📋 INVENTARIO DE DOCUMENTACIÓN — LeadMaster Workspace

**Fecha:** 2026-02-21  
**Alcance:** `/root/leadmaster-workspace` (excluye whatsapp-massive-sender y whatsapp-bot-responder)  
**Propósito:** Análisis exhaustivo de documentación antes de reorganización  
**Estado:** STAGE 0 — INVENTARIO COMPLETO (sin cambios)

---

## 🎯 RESUMEN EJECUTIVO

### Estadísticas Globales

| Ubicación | Archivos .md | Archivos .txt | Total |
|-----------|--------------|---------------|-------|
| **Raíz del repositorio** | 8 | 1 | 9 |
| **/docs** | 8 | 0 | 8 |
| **/services/central-hub (raíz)** | 25 | 0 | 25 |
| **/services/central-hub/docs** | 113 | 1 | 114 |
| **/services/session-manager (raíz)** | 6 | 0 | 6 |
| **/services/session-manager/docs** | 12 | 0 | 12 |
| **/_internal/docs** | 1 | 0 | 1 |
| **/.github** | 1 | 0 | 1 |
| **/AUXILIAR** (backups) | ~20 | ~10 | ~30 |
| **TOTAL (excl. cache/tokens)** | **~194** | **~12** | **~206** |

### Hallazgos Clave

✅ **Documentación existente:** 206 archivos documentando arquitectura, integraciones, diagnósticos  
❌ **Desorganización crítica:** 80% de docs dispersos sin estructura clara  
⚠️ **Documentos temporales:** 25+ diagnósticos/informes en raíz de central-hub  
⚠️ **Duplicación:** Carpetas `decisiones/` vs `decisions/`, múltiples READMEs  
⚠️ **Contaminación:** 30+ archivos en `/AUXILIAR/` (backup antiguo de session-manager)  

---

## 📂 SECCIÓN 1 — DOCUMENTOS EN RAÍZ DEL REPOSITORIO

**Total:** 9 archivos (8 markdown + 1 txt)

| Archivo | Tamaño | Tipo | Categoría Propuesta |
|---------|--------|------|---------------------|
| `README.md` | 3.7K | Proyecto | **Constitucional** - Identidad del proyecto |
| `PR_INSTRUCTIONS.md` | 3.5K | Proceso | **Constitucional** - Flujo de trabajo del equipo |
| `DEV_WORKFLOW_VPS.md` | 7.6K | Guía | **Infraestructura** - Workflow de deployment |
| `CHECKLIST_ESTABILIZACION_POST_INCIDENTE.md` | 22K | Procedimiento | **Reportes** - Respuesta a incidentes |
| `DIAGNOSTICO_CRITICO_ENVIOS_WHATSAPP.md` | 14K | Reporte | **Reportes** - Diagnóstico crítico |
| `DIFERENCIAS_PROYECTOS.md` | 15K | Análisis | **Arquitectura** - Comparación de proyectos |
| `INFORME_ALMACENAMIENTO_SESIONES_WHATSAPP.md` | 9.5K | Reporte | **Arquitectura** - Análisis de almacenamiento |
| `INFORME_INCIDENTE_2026-02-07.md` | 11K | Reporte | **Reportes** - Post-mortem de incidente |
| `CI_TRIGGER.txt` | 24B | Flag | **Infraestructura** - Archivo de trigger CI |

### Observaciones

- **README.md** es pequeño (3.7K) → probablemente necesita expansión
- **PR_INSTRUCTIONS.md** define workflow de equipo → debe permanecer en raíz
- 6 archivos de diagnóstico/reporte → deberían moverse a `/docs/reports/`
- 1 archivo de arquitectura → debe moverse a `/docs/architecture/`

---

## 📂 SECCIÓN 2 — CARPETA /docs (Nivel Workspace)

**Total:** 8 archivos (estructura mínima, sub-organizada)

| Archivo | Categoría Propuesta |
|---------|---------------------|
| `Checklist-Post-SSL.md` | **Infraestructura** - Procedimiento SSL |
| `Contratos-HTTP-LeadMaster-Workspace.md` | **Contratos** - Especificaciones API HTTP |
| `INFORME-FINAL-INTEGRACION-SESSION-MANAGER.md` | **Integración** - Reporte de integración |
| `Integration-CentralHub-SessionManager.md` | **Integración** - Arquitectura de integración |
| `PHASE-2-COMPLETED.md` | **Fases** - Completitud de fase |
| `PHASE-3-PLAN.md` | **Fases** - Planificación de fase |
| `PROJECT-STATUS.md` | **Reportes** - Estado actual del proyecto |
| `SSL-Cloudflare-Setup.md` | **Infraestructura** - Configuración SSL/Cloudflare |

### Observaciones

- **Estructura débil:** Solo 8 archivos en nivel workspace
- **Sin organización interna:** Sin subcarpetas (architecture/, contracts/, etc.)
- **Archivos bien categorizables:** Clara separación por propósito
- **Oportunidad:** Esta carpeta debe ser el hub principal post-reorganización

---

## 📂 SECCIÓN 3 — /services/central-hub (Raíz del Servicio)

**Total:** 25 archivos markdown en la raíz del servicio

### Distribución por Patrón

| Patrón de Nombre | Cantidad | Categoría Propuesta |
|------------------|----------|---------------------|
| `DIAGNOSTICO_*.md` | ~12 | **Reportes** - Diagnósticos técnicos |
| `INFORME_*.md` | ~8 | **Reportes** - Reportes de implementación |
| `CONTROL-*.md` | ~2 | **Procedimientos** - Checklists manuales |
| `ANALISIS_*.md` | ~2 | **Reportes** - Análisis de código |
| `AUDITORIA_*.md` | ~1 | **Reportes** - Auditorías |

### Archivos Destacados (Recientes, 2026-02)

```
DIAGNOSTICO_WHATSAPP_BOT_RESPONDER_2026-02-21.md
DIAGNOSTICO_LISTENER_MENSAJES_ENTRANTES_2026-02-21.md
VERIFICACION_FLUJO_LISTENER_PASIVO_2026-02-21.md  ← Este documento
INFORME_IMPLEMENTACION_CANAL_MANUAL_WHATSAPP_2026-02-13.md
INFORME_IMPLEMENTACION_TAREAS_CRITICAS_2026-02-17.md
CONTROL-ENTREGABILIDAD-MANUAL-CHECKLIST.md
NAVEGACION_DOCS.md
README.md
```

### Archivos Completos en Raíz

```
./services/central-hub/ANALISIS_SCHEMA_INTEGRATION_TESTS.md
./services/central-hub/AUDITORIA_CI_TESTING.md
./services/central-hub/CONTROL-ENTREGABILIDAD-MANUAL-CHECKLIST.md
./services/central-hub/DIAGNOSTICO_BOTON_WHATSAPP_MANUAL.md
./services/central-hub/DIAGNOSTICO_ERROR_500_CONFIRM_MANUAL_2026-02-18.md
./services/central-hub/DIAGNOSTICO_ERROR_CI_SCHEMA.md
./services/central-hub/DIAGNOSTICO_ERROR_MESSAGE_ID_2026-02-18.md
./services/central-hub/DIAGNOSTICO_ESTADO_GRILLA_PROSPECTOS_2026-02-18.md
./services/central-hub/DIAGNOSTICO_LISTENER_MENSAJES_ENTRANTES_2026-02-21.md
./services/central-hub/DIAGNOSTICO_MENSAJE_WHATSAPP_HARDCODEADO.md
./services/central-hub/DIAGNOSTICO_PROSPECTOS_DETALLADO.md
./services/central-hub/DIAGNOSTICO_SELECTOR_PROSPECTOS.md
./services/central-hub/DIAGNOSTICO_WHATSAPP_BOT_RESPONDER_2026-02-21.md
./services/central-hub/IMPLEMENTACION_FASE1_MANUAL_WHATSAPP.md
./services/central-hub/INFORME_FLUJO_MANUAL_WHATSAPP.md
./services/central-hub/INFORME_IMPLEMENTACION_BLINDAJE_ENTORNO.md
./services/central-hub/INFORME_IMPLEMENTACION_CANAL_MANUAL_WHATSAPP_2026-02-13.md
./services/central-hub/INFORME_IMPLEMENTACION_TAREAS_CRITICAS_2026-02-17.md
./services/central-hub/INFORME_LOCALIZACION_CONSTRUCCION_DESTINATARIOS_2026-02-20.md
./services/central-hub/INFORME_REFACTORIZACION_SCHEDULER_2026-02-13.md
./services/central-hub/INFORME_REFACTOR_NOMBRES_COMPONENTES.md
./services/central-hub/INFORME_RIESGO_INTEGRATION_TESTS.md
./services/central-hub/NAVEGACION_DOCS.md
./services/central-hub/README.md
./services/central-hub/VERIFICACION_FLUJO_LISTENER_PASIVO_2026-02-21.md
```

### ⚠️ Problema Crítico

**La raíz del servicio está sobrecargada** con 25 archivos de diagnóstico/implementación que deberían estar en `docs/reports/`. Esto dificulta la navegación y encontrar el código fuente real.

---

## 📂 SECCIÓN 4 — /services/central-hub/docs

**Total:** 113 archivos markdown + 1 txt (hub de documentación principal)

### Estructura de Subcarpetas

| Subcarpeta | Archivos | Propósito |
|------------|----------|-----------|
| `docs/` (raíz) | ~40 | Arquitectura, guías, reportes (mezclados) |
| `docs/backend/whatsapp/` | 7 | Documentación módulo WhatsApp backend |
| `docs/frontend/` | 3 | Arquitectura frontend |
| `docs/decisiones/` | ~2 | Registros de decisiones (ADR) |
| `docs/decisions/` | ~2 | **DUPLICADO** - Más registros de decisiones |
| `docs/diagnosticos/` | ~6 | Reportes de diagnóstico |
| `docs/deployment/` | 1 | Guías de deployment |
| `docs/guides/` | 3 | Guías de usuario/desarrollador |
| `docs/informes/` | ~5 | Reportes de implementación |
| `docs/planificacion/` | ~2 | Documentos de planificación |
| `docs/procedimientos/` | ~4 | Procedimientos operacionales |
| `docs/session-manager/` | ~1 | Documentación de session-manager |

### Archivos Destacados en Raíz de docs/

```
./services/central-hub/docs/INDEX.md  ← Índice existente (revisar)
./services/central-hub/docs/README.md  ← ¿Duplicado de INDEX.md?
./services/central-hub/docs/REORGANIZACION_DOCS.md  ← Intento previo de reorganizar
./services/central-hub/docs/ARQUITECTURA_EDICION_CAMPANAS.md
./services/central-hub/docs/ARQUITECTURA_MODULAR.md
./services/central-hub/docs/AUTENTICACION.md
./services/central-hub/docs/CHANGELOG.md
./services/central-hub/docs/MANUAL_CAMPANAS.md
./services/central-hub/docs/MANUAL_EDICION_CAMPANAS.md
./services/central-hub/docs/MANUAL_TECNICO_CAMPANAS.md
./services/central-hub/docs/PM2_DEPLOYMENT_GUIDE.md
./services/central-hub/docs/PM2_PRODUCTION_DEPLOYMENT.md
./services/central-hub/docs/QR_AUTHORIZATION_ARCHITECTURE.md
./services/central-hub/docs/SESSION_MANAGER_API_CONTRACT.md
./services/central-hub/docs/WHATSAPP_PROXY_ARCHITECTURE.md
```

### Archivos por Categoría (Análisis de Contenido)

#### Arquitectura (~20 archivos)
```
ARQUITECTURA_EDICION_CAMPANAS.md
ARQUITECTURA_MODULAR.md
ARQUITECTURA_FRONTEND.md
QR_AUTHORIZATION_ARCHITECTURE.md
QR_AUTH_PHASE_B_ARCHITECTURE.md
WHATSAPP_PROXY_ARCHITECTURE.md
MAQUINA_DE_ESTADOS_ENVIO_WHATSAPP.md
```

#### Contratos (~8 archivos)
```
SESSION_MANAGER_API_CONTRACT.md
Contratos-HTTP-LeadMaster-Workspace.md (en /docs raíz)
ENDPOINTS_SESSION_MANAGER.md
CONTRACT_IMPLEMENTATION_REPORT.md
```

#### Guías (~15 archivos)
```
GUIA_DEPLOYMENT.md
GUIA_DESTINATARIOS.md
GUIA_VSCODE_REMOTE_SSH.md
MANUAL_CAMPANAS.md
MANUAL_EDICION_CAMPANAS.md
MANUAL_TECNICO_CAMPANAS.md
PM2_DEPLOYMENT_GUIDE.md
PM2_PRODUCTION_DEPLOYMENT.md
```

#### Reportes de Diagnóstico (~30 archivos)
```
DIAGNOSTICO_502_BACKEND_DOWN.md
DIAGNOSTICO_BUG_INNER_JOIN_LUGARES_CLIENTES.md
DIAGNOSTICO_BUG_PROSPECTOS_VACIO.md
DIAGNOSTICO_ENV_CREDENCIALES.md
DIAGNOSTICO_ERROR_502_LOGIN.md
DIAGNOSTICO_ESTADO_PROSPECTOS.md
DIAGNOSTICO_WHATSAPP_PERSISTENCIA.md
DIAGNOSTICO_ENVIOS_PENDIENTES.md
DIAGNOSTICO_FRONTEND_CACHE_304.md
DIAGNOSTICO_LOGIN_PRODUCCION.md
DIAGNOSTICO_OPERATIVO_SCHEDULER.md
DIAGNOSTICO_PM2_ENV_VARIABLES.md
DIAGNOSTICO_WHATSAPP_CONNECTION_ERROR.md
```

#### Reportes de Implementación (~20 archivos)
```
INFORME_AUDITORIA_CUMPLIMIENTO_POLITICA_v1.2.0_2026-02-17.md
INFORME_CAMBIOS_2026-01-22.md
INFORME_ENVIO_MANUAL_WHATSAPP_2026-02-08.md
INFORME_ROUTING_FIX.md
INFORME_WHATSAPP_QR_ISSUE.md
INFORME_CORRECCION_SELECTOR_PROSPECTOS.md
INFORME_APROBACION_CAMPANAS.md
```

#### Procedimientos (~10 archivos)
```
CHECKLIST_POST_DEPLOYMENT.md
CHECKLIST_QR_AUTHORIZATION.md
AJUSTE_COMPLETADO.md
CIERRE_DE_FASE.md
PUNTO_DE_RETORNO_PR01.md
```

#### Decisiones/Decision Records (~4 archivos)
```
docs/decisiones/2026-01_06_pausa_tecnica_qr_authorization.md
docs/decisions/2026-01-08_fix_qr_code_route.md
docs/decisions/2026-01-08_session_manager_multi_client_singleton.md
```

### ⚠️ Problemas Identificados

1. **Carpetas duplicadas:** `decisiones/` (español) vs `decisions/` (inglés)
2. **Sin separación clara:** Arquitectura, contratos, integraciones mezclados en raíz de docs/
3. **Muchos archivos sueltos:** 40 archivos en `docs/` raíz sin subcarpeta
4. **Nomenclatura inconsistente:** MAYUSCULAS.md, kebab-case.md, mixtos
5. **Índice desactualizado:** `INDEX.md` probablemente desactualizado

---

## 📂 SECCIÓN 5 — /services/session-manager

**Total:** 6 archivos en raíz + 12 en docs/

### Archivos en Raíz del Servicio

```
./services/session-manager/DIAGNOSTICO_QR_VINCULACION.md
./services/session-manager/DIAGNOSTICO_VINCULACION_MOVIL.md
./services/session-manager/INFORME-ENDPOINT-QR.md
./services/session-manager/INFORME_FIX_EADDRINUSE.md
./services/session-manager/LOGIN_LOCAL_README.md
./services/session-manager/MIGRACION_VENOM_BOT.md
```

### Archivos en docs/

```
./services/session-manager/docs/architecture/REFINAMIENTOS_ESTADO_IDEMPOTENCIA.md
./services/session-manager/docs/architecture/SESSION_MANAGER_SINGLE_ADMIN.md
./services/session-manager/docs/AUDIT_FIXES_IMPLEMENTATION_REPORT.md
./services/session-manager/docs/BACKEND_SESSION_MANAGER_AUDIT.md
./services/session-manager/docs/DEPLOY_CHECKLIST_REPORT.md
./services/session-manager/docs/ENDPOINT-QR.md
./services/session-manager/docs/IMPLEMENTACION-QR-COMPLETADA.md
./services/session-manager/docs/IMPLEMENTATION_LOGIN_LOCAL.md
./services/session-manager/docs/informes/INFORME_WHATSAPP_BUSINESS_INTEGRATION.md
./services/session-manager/docs/INIT_ENDPOINT_REPORT.md
./services/session-manager/docs/LOCAL_LOGIN_SETUP.md
```

### Observaciones

- **Patrón similar a central-hub:** Diagnósticos/informes en raíz del servicio
- **Estructura parcial en docs/:** Tiene `architecture/` e `informes/` pero incompleto
- **Autonomía del servicio:** Mantiene su propia documentación (correcto)
- **Duplicación:** Algunos informes duplican contenido con workspace-level docs

---

## 📂 SECCIÓN 6 — OTRAS UBICACIONES

### /_internal/docs

**Total:** 1 archivo

```
./_internal/docs/ANALISIS_ESTADO_NULL_FRONTEND_2026-02-18.md
```

- Análisis técnico interno
- Categoría: **Reportes**

### /.github

**Total:** 1 archivo

```
./.github/PULL_REQUEST_TEMPLATE.md
```

- Template de pull request (debe permanecer aquí por convención GitHub)

### /AUXILIAR (Backup de session-manager)

**Total:** ~30 archivos (backup completo del 2026-01-20)

```
./AUXILIAR/session-manager-backup-20260120-140247/DIAGNOSTICO_QR_VINCULACION.md
./AUXILIAR/session-manager-backup-20260120-140247/DIAGNOSTICO_VINCULACION_MOVIL.md
./AUXILIAR/session-manager-backup-20260120-140247/docs/... (12 archivos)
./AUXILIAR/session-manager-backup-20260120-140247/.wwebjs_auth/... (tokens, cache)
```

- **Acción recomendada:** Archivar como .tar.gz o mover a `docs/archive/backups/`
- **Contaminación:** Añade 30+ archivos al inventario sin valor actual

### Otros READMEs a Nivel Módulo

```
./services/central-hub/db/migrations/README.md
./services/central-hub/tests/README.md
./services/central-hub/tests/README_INTEGRATION_TESTS.md
./services/central-hub/e2e/README.md
./services/central-hub/frontend/README.md
./services/central-hub/frontend/INICIO_RAPIDO.md
./services/central-hub/frontend/PROYECTO_COMPLETADO.md
./services/central-hub/src/modules/listener/ia/README.md
./services/central-hub/src/modules/sync-contacts/README.md
```

- **Acción:** **MANTENER EN SU LUGAR** (documentación específica de módulo/área)
- No deben moverse a nivel workspace

---

## 🎯 ANÁLISIS DE CATEGORIZACIÓN

### Distribución Estimada por Categoría

| Categoría | Archivos Estimados | Ubicaciones Actuales |
|-----------|-------------------|----------------------|
| **Constitucional** | 4 (crear) + 2 (existentes) | Raíz: README.md, PR_INSTRUCTIONS.md |
| **Arquitectura** | 15-20 | docs/, services/*/docs/, raíz dispersos |
| **Contratos** | 5-8 | docs/, services/*/docs/ |
| **Integración** | 10-15 | docs/, services/*/docs/backend/ |
| **Fases** | 5-8 | docs/PHASE-*.md, docs/planificacion/ |
| **Infraestructura** | 10-15 | docs/, deployment guides, PM2, SSL, Nginx |
| **Reportes** | **80-100** | **DISPERSOS EN TODO EL REPO** |
| **Archivo** | 30-40 | AUXILIAR/, diagnósticos obsoletos |

### Documentos Constitucionales (Capa Superior)

**Existentes:**
- ✅ `README.md` (3.7K) - Identidad del proyecto
- ✅ `PR_INSTRUCTIONS.md` (3.5K) - Workflow del equipo

**Faltantes (deben crearse):**
- ❌ `PROJECT_REALITY.md` - Modelo de negocio, contexto del cliente
- ❌ `DECISION_LOG.md` - Registro consolidado de ADRs
- ❌ `BUSINESS_ENGINE.md` - Modelo de ingresos, propuesta de valor
- ❌ `SYSTEM_BOUNDARIES.md` - Qué está en alcance, qué no

---

## 🚨 PROBLEMAS IDENTIFICADOS

### 1. Desorganización Masiva

- **80 archivos de reportes** dispersos en 4 ubicaciones diferentes
- **25 diagnósticos/informes** en raíz de central-hub (debería ser código)
- **6 diagnósticos** en raíz de session-manager
- **Sin estructura clara** en workspace-level `/docs`

### 2. Duplicación de Estructuras

- `docs/decisiones/` vs `docs/decisions/` (español vs inglés)
- `docs/INDEX.md` vs `docs/README.md` (índices duplicados)
- `docs/informes/` duplica reportes en raíz de servicios
- AUXILIAR/ contiene backup completo con 30+ docs duplicados

### 3. Nomenclatura Inconsistente

```
MAYUSCULAS_CON_GUIONES.md            (mayoría)
kebab-case-minusculas.md             (algunos)
PascalCase.md                        (pocos)
snake_case_minusculas.md             (pocos)
```

### 4. Documentación Temporal Sin Archivar

- Muchos archivos con fechas `2026-01-*`, `2026-02-*`
- Diagnósticos resueltos que deberían estar archivados
- Informes de implementación completada sin archivar

### 5. Índices Desactualizados

- `docs/INDEX.md` probablemente desactualizado
- `NAVEGACION_DOCS.md` en central-hub no está en docs/
- `REORGANIZACION_DOCS.md` indica intento previo fallido

### 6. Falta de Capa Constitucional

- No hay documentos que expliquen el "por qué" del proyecto
- No hay contexto de negocio centralizado
- Decisiones arquitectónicas no consolidadas

---

## 📊 PROPUESTA DE ESTRUCTURA OBJETIVO

```
/root/leadmaster-workspace/
├── README.md                              ← CONSTITUCIONAL
├── PROJECT_REALITY.md                     ← CONSTITUCIONAL (crear)
├── DECISION_LOG.md                        ← CONSTITUCIONAL (crear)
├── BUSINESS_ENGINE.md                     ← CONSTITUCIONAL (crear)
├── SYSTEM_BOUNDARIES.md                   ← CONSTITUCIONAL (crear)
├── PR_INSTRUCTIONS.md                     ← CONSTITUCIONAL (mantener)
│
├── docs/
│   ├── INDEX.md                           ← Índice maestro (actualizar)
│   │
│   ├── architecture/                      ← 15-20 archivos
│   │   ├── README.md
│   │   ├── arquitectura-modular.md
│   │   ├── whatsapp-proxy-architecture.md
│   │   ├── qr-authorization-architecture.md
│   │   └── ...
│   │
│   ├── contracts/                         ← 5-8 archivos
│   │   ├── README.md
│   │   ├── http-contracts-leadmaster.md
│   │   ├── session-manager-api-contract.md
│   │   └── ...
│   │
│   ├── integration/                       ← 10-15 archivos
│   │   ├── README.md
│   │   ├── central-hub-session-manager.md
│   │   ├── whatsapp-integration.md
│   │   └── ...
│   │
│   ├── phases/                            ← 5-8 archivos
│   │   ├── README.md
│   │   ├── phase-2-completed.md
│   │   ├── phase-3-plan.md
│   │   └── ...
│   │
│   ├── infrastructure/                    ← 10-15 archivos
│   │   ├── README.md
│   │   ├── ssl-cloudflare-setup.md
│   │   ├── pm2-deployment-guide.md
│   │   ├── dev-workflow-vps.md
│   │   └── ...
│   │
│   ├── reports/                           ← 80-100 archivos
│   │   ├── README.md
│   │   ├── 2026-02/
│   │   │   ├── diagnostico-listener-mensajes-2026-02-21.md
│   │   │   ├── verificacion-flujo-listener-pasivo-2026-02-21.md
│   │   │   └── ...
│   │   ├── 2026-01/
│   │   └── 2025-12/
│   │
│   └── archive/                           ← 30-40 archivos
│       ├── README.md
│       ├── obsolete-diagnostics/
│       ├── backups/
│       │   └── session-manager-2026-01-20.tar.gz
│       └── ...
│
├── services/
│   ├── central-hub/
│   │   ├── README.md                      ← Solo info del servicio
│   │   ├── docs/                          ← Docs específicos del servicio
│   │   │   ├── backend/
│   │   │   ├── frontend/
│   │   │   └── ...
│   │   └── [código fuente]
│   │
│   └── session-manager/
│       ├── README.md
│       ├── docs/
│       └── [código fuente]
│
└── [otros directorios de código]
```

---

## 🔧 COMANDOS DE VERIFICACIÓN

### Total de Documentos

```bash
cd /root/leadmaster-workspace

# Total (excluyendo cache/tokens)
find . -type f \( -name "*.md" -o -name "*.txt" \) 2>/dev/null | \
  grep -v node_modules | grep -v ".git/" | grep -v "tokens/" | \
  grep -v ".wwebjs_auth" | grep -v "Service Worker" | wc -l

# Esperado: ~206
```

### Por Ubicación

```bash
# Raíz del repo
ls -lh *.md *.txt 2>/dev/null | wc -l

# Workspace docs/
find ./docs -maxdepth 1 -type f \( -name "*.md" -o -name "*.txt" \) | wc -l

# Central-hub raíz
find ./services/central-hub -maxdepth 1 -name "*.md" | wc -l

# Central-hub docs
find ./services/central-hub/docs -type f -name "*.md" | wc -l

# Session-manager
find ./services/session-manager -maxdepth 1 -name "*.md" | wc -l
find ./services/session-manager/docs -type f -name "*.md" | wc -l
```

### Estructura de Carpetas

```bash
# Ver estructura de docs/ actual
tree -L 2 docs/

# Ver estructura de central-hub/docs actual
tree -L 2 services/central-hub/docs/

# Ver archivos en raíz de central-hub
ls -1 services/central-hub/*.md
```

### Estado de Git

```bash
# Ver archivos markdown rastreados
git ls-files | grep -E "\.(md|txt)$" | wc -l

# Ver archivos markdown no rastreados
git status --short | grep -E "\.(md|txt)$"

# Ver último cambio en archivos de documentación
git log --oneline --all --name-only -- "*.md" | head -30
```

---

## 📝 NOTAS Y CONSIDERACIONES

### Riesgos de Reorganización

1. **Alto volumen:** 206 archivos → reorganización será extensa
2. **Desarrollo activo:** Muchos archivos recientes (Feb 2026) → coordinar con equipo
3. **Referencias internas:** Posibles enlaces rotos si no se actualizan
4. **Autonomía de servicios:** session-manager y central-hub tienen docs propios
5. **Sin historial git aún:** Necesario usar `git mv` para preservar historial

### Archivos que NO Deben Moverse

- READMEs a nivel módulo (`src/modules/*/README.md`)
- READMEs de testing (`tests/README.md`, `e2e/README.md`)
- READMEs de frontend (`frontend/README.md`)
- Template de GitHub (`.github/PULL_REQUEST_TEMPLATE.md`)
- Archivos de migración DB (`db/migrations/README.md`)

### Archivos que Requieren Decisión

- **AUXILIAR/**: ¿Comprimir a .tar.gz o mover a docs/archive/?
- **Diagnósticos 2025-12**: ¿Son obsoletos? ¿Archivar?
- **decisiones/ vs decisions/**: ¿Consolidar en uno solo?
- **INDEX.md vs README.md**: ¿Cuál mantener?

### Beneficios Esperados

1. **Navegación clara:** Estructura de 6 carpetas temáticas
2. **Raíz limpia:** Solo 4-6 docs constitucionales
3. **Reportes organizados:** Por fecha en `/reports/YYYY-MM/`
4. **Separación de concerns:** Arquitectura, contratos, integración separados
5. **Historial preservado:** Uso de `git mv` mantiene historial
6. **Índice actualizado:** docs/INDEX.md como punto de entrada único

---

## ✅ ESTADO ACTUAL: STAGE 0 COMPLETADO

### Lo que se ha hecho:

- ✅ Escaneo completo del repositorio
- ✅ Inventario de 206 archivos de documentación
- ✅ Categorización por contenido
- ✅ Identificación de problemas (duplicación, desorganización)
- ✅ Propuesta de estructura objetivo
- ✅ Comandos de verificación preparados

### Lo que NO se ha hecho (por diseño):

- ❌ No se han movido archivos
- ❌ No se han eliminado archivos
- ❌ No se han modificado contenidos
- ❌ No se han creado carpetas nuevas

---

## 🚀 PRÓXIMOS PASOS

**STAGE 1 — CREAR ESTRUCTURA OBJETIVO (cambios mínimos)**

1. Crear carpetas vacías:
   ```
   /docs/architecture
   /docs/contracts
   /docs/integration
   /docs/phases
   /docs/infrastructure
   /docs/reports
   /docs/archive
   ```

2. Crear `/docs/INDEX.md` con secciones vacías (sin enlaces aún)

3. Verificar con:
   ```bash
   tree -L 3 docs
   git status
   ```

4. **DETENER** para confirmación antes de mover archivos

---

**Generado:** 2026-02-21  
**Autor:** Sistema de Inventario Automatizado  
**Versión:** 1.0  
**Próxima acción:** Esperar confirmación para proceder a STAGE 1
