-- Migration: 002_create_ll_envios_manual
-- Fecha: 2026-02-13
-- Descripción: Tabla para registro de envíos manuales por Web WhatsApp
-- Parte de: FASE 1 – Modo Manual Controlado

-- ============================================================
-- TABLA: ll_envios_manual
-- ============================================================
-- Propósito:
--   Registrar cada intento de envío manual realizado por el usuario
--   a través de Web WhatsApp (wa.me).
--
-- Reglas de Negocio:
--   1. NO modifica el estado automático del prospecto
--   2. NO usa session-manager ni WhatsApp Cloud API
--   3. Solo registra el intento para auditoría
--   4. El usuario es responsable del envío real en WhatsApp Web
-- ============================================================

CREATE TABLE IF NOT EXISTS ll_envios_manual (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY
    COMMENT 'ID único del registro de envío manual',

  prospecto_id BIGINT UNSIGNED NOT NULL
    COMMENT 'ID del prospecto (societe.rowid) al que se envió',

  telefono VARCHAR(50) NOT NULL
    COMMENT 'Teléfono normalizado (solo números) usado para el envío',

  mensaje TEXT NULL
    COMMENT 'Mensaje que se abrió en WhatsApp Web',

  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    COMMENT 'Timestamp de cuando se registró el intento',

  INDEX idx_prospecto_id (prospecto_id),
  INDEX idx_fecha (fecha),
  INDEX idx_telefono (telefono)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Registro de envíos manuales por Web WhatsApp - FASE 1';
