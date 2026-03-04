-- Migration: 001_create_ll_whatsapp_qr_sessions
-- Fecha: 2026-01-03
-- Descripción: Tabla para control de autorización de escaneo de QR WhatsApp
-- Parte de: Arquitectura de Autorización de QR (Fase 1)

-- ============================================================
-- TABLA: ll_whatsapp_qr_sessions
-- ============================================================
-- Propósito:
--   Almacenar autorizaciones temporales para que clientes
--   puedan escanear el QR de WhatsApp desde el dashboard.
--
-- Reglas de Negocio:
--   1. Solo admin puede crear autorizaciones
--   2. Autorizaciones expiran automáticamente
--   3. Una autorización puede ser revocada manualmente
--   4. Sistema auditable (quién autorizó, cuándo)
-- ============================================================

CREATE TABLE IF NOT EXISTS ll_whatsapp_qr_sessions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY
    COMMENT 'ID único de la sesión de autorización',

  cliente_id BIGINT UNSIGNED NOT NULL
    COMMENT 'ID del cliente que tiene permiso para escanear QR',

  enabled BOOLEAN NOT NULL DEFAULT true
    COMMENT 'TRUE = autorización activa, FALSE = expirada o revocada',

  enabled_by_admin_id BIGINT UNSIGNED NOT NULL
    COMMENT 'ID del administrador que autorizó el acceso',

  enabled_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    COMMENT 'Timestamp UTC de cuando se creó la autorización',

  expires_at DATETIME NOT NULL
    COMMENT 'Timestamp UTC de expiración',

  revoked_at DATETIME NULL DEFAULT NULL
    COMMENT 'Timestamp UTC de revocación manual',

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    COMMENT 'Timestamp de creación del registro',

  -- 🔒 Regla crítica: una sola autorización activa por cliente
  UNIQUE KEY uq_cliente_enabled (cliente_id, enabled),

  INDEX idx_cliente_id (cliente_id),
  INDEX idx_expires_at (expires_at),
  INDEX idx_enabled (enabled),
  INDEX idx_enabled_by_admin (enabled_by_admin_id)

) ENGINE=InnoDB 
  DEFAULT CHARSET=utf8mb4 
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Control de autorización temporal para escaneo de QR WhatsApp';


-- ============================================================
-- VERIFICACIÓN POST-MIGRATION
-- ============================================================
-- Ejecutar estos queries para verificar que la tabla se creó correctamente:

-- 1. Verificar estructura
-- DESCRIBE ll_whatsapp_qr_sessions;

-- 2. Verificar índices
-- SHOW INDEX FROM ll_whatsapp_qr_sessions;

-- 3. Contar registros (debe ser 0)
-- SELECT COUNT(*) FROM ll_whatsapp_qr_sessions;

-- ============================================================
-- ROLLBACK (si es necesario)
-- ============================================================
-- DROP TABLE IF EXISTS ll_whatsapp_qr_sessions;

-- ============================================================
-- QUERIES DE EJEMPLO (para testing)
-- ============================================================

-- Crear autorización de prueba (60 minutos)
-- INSERT INTO ll_whatsapp_qr_sessions 
--   (cliente_id, enabled_by_admin_id, enabled_at, expires_at, enabled)
-- VALUES 
--   (51, 1, NOW(), DATE_ADD(NOW(), INTERVAL 60 MINUTE), true);

-- Verificar autorización activa
-- SELECT * FROM ll_whatsapp_qr_sessions 
-- WHERE cliente_id = 51 
--   AND enabled = true 
--   AND expires_at > NOW();

-- Revocar autorización
-- UPDATE ll_whatsapp_qr_sessions 
-- SET enabled = false, revoked_at = NOW() 
-- WHERE cliente_id = 51 AND enabled = true;

-- Limpiar expiradas (cron job)
-- UPDATE ll_whatsapp_qr_sessions 
-- SET enabled = false 
-- WHERE enabled = true 
--   AND expires_at < NOW();

-- Listar todas las sesiones activas
-- SELECT 
--   id,
--   cliente_id,
--   enabled_by_admin_id,
--   enabled_at,
--   expires_at,
--   TIMESTAMPDIFF(MINUTE, NOW(), expires_at) as remaining_minutes
-- FROM ll_whatsapp_qr_sessions 
-- WHERE enabled = true 
--   AND expires_at > NOW()
-- ORDER BY expires_at ASC;
