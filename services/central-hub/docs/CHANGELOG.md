# Changelog

Todas las modificaciones relevantes del sistema se documentan aquí.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/).

---

## [1.1.0] - 2026-02-13


### Added

- Implementación de `estadoService.js` como servicio centralizado de gestión de estados
- Función `cambiarEstado()` con:
  - Validación de transiciones permitidas entre estados
  - Transacciones ACID con rollback automático
  - Auditoría obligatoria de cada cambio de estado
  - Registro de `message_id` de WhatsApp para trazabilidad
- Clasificación estructurada de errores del Session Manager con 8 códigos:
  - `SESSION_MANAGER_TIMEOUT`: Timeout en comunicación HTTP
  - `SESSION_MANAGER_UNREACHABLE`: Servicio no alcanzable
  - `SESSION_NOT_READY`: Sesión de WhatsApp no inicializada
  - `WHATSAPP_ERROR`: Error reportado por WhatsApp API
  - `VALIDATION_ERROR`: Error de validación de datos
  - `INVALID_SEND_RESPONSE`: Respuesta malformada del Session Manager
  - `TELEFONO_INVALIDO`: Número de teléfono inválido
  - `UNKNOWN_ERROR`: Error no clasificado
- Validación estricta de respuesta del Session Manager: `{ ok: true, message_id: "..." }`
- Soporte para header `X-Cliente-Id` en comunicación con Session Manager
- Logs estructurados de transición de estados con origen y detalles

### Changed

- Refactorización completa de `programacionScheduler.js`
- Nuevo flujo de envío garantizado:
  1. Ejecutar `sendMessage()` primero
  2. Validar respuesta con triple verificación (null check, ok check, message_id check)
  3. Cambiar estado a 'enviado' solo después de confirmación
- Eliminación de `break` en loop de catch: scheduler continúa procesando envíos restantes ante fallos individuales
- Normalización de números de teléfono a solo dígitos (protocol-agnostic, sin `@c.us`)
- `sessionManagerClient.js` alineado a contrato HTTP oficial:
  - `cliente_id` enviado en body
  - `X-Cliente-Id` enviado en header
  - Validación estricta de estructura de respuesta

### Fixed

- **BUG CRÍTICO**: Envíos marcados como "enviado" antes de confirmación real por parte de WhatsApp
  - Origen: función `marcarEnviado()` ejecutada antes de `sendMessage()`
  - Impacto: 250 registros afectados en incidente del 07-02-2026
  - Solución: Eliminación de `marcarEnviado()`, implementación de flujo secuencial estricto
- Inconsistencia de estados ante errores en bloque catch: envíos quedaban en estado incorrecto sin auditoría
- Falta de validación de respuesta del Session Manager: respuestas malformadas o null eran aceptadas
- Riesgo de datos inconsistentes por ausencia de auditoría de cambios de estado

### Removed

- Función `marcarEnviado()` de `programacionScheduler.js` (líneas 139-145)
- Updates directos de campo `estado` mediante queries SQL sin validación
- Manejo de protocolo `@c.us` dentro del Central Hub (delegado al Session Manager)

### Security

- Garantía de que ningún envío puede marcarse como "enviado" sin `message_id` válido de WhatsApp
- Eliminación de posibilidad de estados inconsistentes mediante validación de transiciones
- Validación estricta de transiciones: solo se permiten cambios de estado lógicamente válidos
- Protección contra race conditions en cambios de estado mediante transacciones ACID con row locking

### Technical Notes

- Versión interna de arquitectura de estados: 1.0.0
- No hay cambios breaking en API externa del Central Hub
- Requiere ejecución de migraciones de base de datos antes de deployment:
  - Crear tabla `ll_envios_whatsapp_historial` (7 columnas, 3 índices, FK constraint)
  - Agregar columna `message_id VARCHAR(255)` a `ll_envios_whatsapp`
- Compatible con versión actual del Session Manager
- Scheduler se ejecuta cada 60 segundos mediante cron
- Sistema de estados: `pendiente` → `enviado` | `error` (con transición manual `error` → `pendiente`)

---

> Esta versión marca la estabilización del sistema de envíos tras el incidente del 07-02-2026.
