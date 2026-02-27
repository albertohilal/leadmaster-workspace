# ADR-2026-02 — WhatsApp Web (whatsapp-web.js) Listener-Only, Outbound por Manual/Meta API

**Estado:** Aprobado  
**Fecha:** 2026-02-26  
**Sistema:** LeadMaster Workspace  
**Servicios afectados:** `session-manager`, `central-hub`  
**Documentos relacionados:** Contratos HTTP, Plan de Integración CentralHub↔SessionManager, Phase 3 Plan

---

## Contexto

El workspace utilizó `whatsapp-web.js` (WhatsApp Web automatizado) como parte de la integración `central-hub` ↔ `session-manager`.

En esa etapa, se habilitó envío outbound automático vía endpoint HTTP (ej. `POST /send`) desde `central-hub` hacia `session-manager`.

**Resultado operacional:** el uso de envío automático con WhatsApp Web contribuyó a incidentes de confiabilidad y derivó en el baneo del número.

En paralelo, el flujo operativo real del negocio consolidó dos canales de outbound:

1. **Envío manual** por operador en https://web.whatsapp.com/  
2. **Envío automático futuro** por **Meta WhatsApp Cloud API** (cuando esté disponible)

---

## Problema

Mantener capacidad de envío automático en `session-manager` (WhatsApp Web automatizado) deja un riesgo latente:

- Riesgo alto de baneo / bloqueo
- Riesgo de reactivación accidental (por refactor, scheduler, tests, o “uso rápido”)
- Confusión de responsabilidades: `session-manager` pasa a ser motor comercial outbound, cuando el plan operativo define outbound por otros canales

---

## Decisión

### 1) `session-manager` queda en modo **Listener-Only**
Responsabilidades **permitidas**:

- Conectar y mantener sesión WhatsApp (QR, LocalAuth)
- Exponer estado operativo (READY / QR_REQUIRED / DISCONNECTED, etc.)
- Capturar mensajes entrantes (inbound)
- Proveer eventos/datos necesarios para el módulo `listener`

Responsabilidades **prohibidas**:

- Envío outbound automático (mensajes salientes)
- Campañas / colas / rate-limit outbound
- Lógica comercial de envíos

### 2) Outbound se define como:
- **Manual:** operador usando WhatsApp Web (web.whatsapp.com)
- **Automático futuro:** Meta WhatsApp Cloud API

---

## Consecuencias

### Positivas
- Reducción fuerte del riesgo de baneo
- Separación de responsabilidades más nítida
- Arquitectura coherente con operación real
- `session-manager` se simplifica (menos superficie de fallo)

### Costos / trade-offs
- `central-hub` pierde capacidad de enviar por WhatsApp Web automatizado (intencional)
- Necesidad de ajustar contratos/documentación y limpiar código legacy

---

## Alcance de implementación

Cambios requeridos:

1. Eliminar (o deshabilitar explícitamente) el endpoint outbound en `session-manager` (ej. `POST /send`)
2. Eliminar uso de envío hacia `session-manager` en `central-hub`
3. Actualizar contratos y documentos de integración para reflejar Listener-Only
4. Confirmar en producción: ningún flujo/scheduler usa el envío automático

---

## No objetivos (Out of scope)

- Implementación de Meta Cloud API (se gestiona en fase futura)
- Automatización de envío manual (no se automatiza Web WhatsApp)
- Diseño de campañas/rate-limit/colas (fase futura de sender)

---

## Checklist de verificación

- [ ] `session-manager` no expone endpoint de envío outbound
- [ ] `central-hub` no llama a endpoint outbound del `session-manager`
- [ ] Contratos HTTP actualizados: outbound eliminado de `session-manager`
- [ ] Documentación de integración actualizada (CentralHub↔SessionManager)
- [ ] Validación en VPS: `pm2` OK, `/status` OK, inbound OK
- [ ] Confirmación operativa: outbound solo manual o Meta API

---