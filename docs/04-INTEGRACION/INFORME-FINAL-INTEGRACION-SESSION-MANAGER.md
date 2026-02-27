# Informe Final: Integración Session Manager ↔ Central Hub (Config/Ports/PM2)

**Fecha:** 2026-01-14  
**Responsable Técnico:** Sistema de Integración LeadMaster  
**Severidad del Problema:** Crítica  
**Estado:** ✅ RESUELTO

---

## 1. Resumen Ejecutivo

Se detectó y corrigió un problema crítico de integración entre los servicios `session-manager` y `leadmaster-central-hub` que impedía la funcionalidad del módulo WhatsApp en LeadMaster.

**Problema detectado (infra/config):**
- Discrepancia de configuración de puertos entre servicios.
- Variable de entorno `SESSION_MANAGER_BASE_URL` no aplicada efectivamente en el proceso PM2 de `central-hub`.
- `session-manager` escuchando en un puerto incorrecto (3011 en lugar de 3001).
- Imposibilidad de conexión entre `frontend → central-hub → session-manager`.

**Solución implementada:**
- Declaración explícita de variables críticas en `ecosystem.config.js` / `ecosystem.config.cjs`.
- Reinicio controlado de servicios desde configuración PM2 (evitando herencia de variables residuales).
- Validación end-to-end con healthchecks y endpoints de sesión.

**Resultado:**
- ✅ `session-manager`: puerto 3001 (correcto)
- ✅ `central-hub`: puerto 3012 (correcto)
- ✅ `SESSION_MANAGER_BASE_URL` aplicada en `central-hub`
- ✅ Servicios comunicándose correctamente

---

## 2. Contexto Operativo (Corrección Constitucional)

### 2.1 Rol de WhatsApp Web en LeadMaster (AS-IS)

**`session-manager` (WhatsApp Web / whatsapp-web.js) se usa como Listener-Only:**
- Conexión por QR.
- Exposición de estado (`/status`).
- Exposición de QR (`/qr`) cuando corresponde.
- Captura de mensajes entrantes (inbound) para que el sistema los procese.

**Fuera de alcance (por diseño):**
- Envío automático outbound por WhatsApp Web (se evita por riesgo/baneo).
- Envío de campañas o programación outbound desde `session-manager`.

### 2.2 Outbound (saliente)

- Outbound manual: operador usando web.whatsapp.com
- Outbound automático futuro: Meta WhatsApp Cloud API (cuando esté disponible)

---

## 3. Análisis de Causa Raíz

### 3.1 Arquitectura del Sistema (en esta incidencia)
