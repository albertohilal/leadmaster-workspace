-- Migration: 003_create_ll_post_envio_clasificaciones
-- Fecha: 2026-03-04
-- Descripción: Tabla satélite (bitácora) para clasificación post-envío WhatsApp
-- Parte de: RELEASE R-OPS-01 — OPS-POST-ENVÍO-01

-- ============================================================
-- TABLA: ll_post_envio_clasificaciones
-- ============================================================
-- Propósito:
--   Registrar eventos de clasificación post-envío (auditable, histórico)
--   SIN modificar ll_envios_whatsapp.
--
-- Reglas de Negocio:
--   - 1 envío puede tener múltiples clasificaciones (histórico)
--   - La clasificación NO sobreescribe registros previos
--   - cliente_id redundante intencional para auditoría multi-tenant
-- ============================================================

CREATE TABLE IF NOT EXISTS ll_post_envio_clasificaciones (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT
    COMMENT 'PK - ID único de clasificación post-envío',

  envio_id INT UNSIGNED NOT NULL
    COMMENT 'ID del envío (ll_envios_whatsapp.id)',

  cliente_id INT UNSIGNED NOT NULL
    COMMENT 'ID del cliente (redundante para multi-tenant/auditoría)',

  post_envio_estado ENUM(
    'CONTACTO_VALIDO_SIN_INTERES',
    'INTERESADO_PARA_DERIVAR_A_HABY',
    'PENDIENTE_SIN_RESPUESTA',
    'NUMERO_INEXISTENTE',
    'NUMERO_CAMBIO_DUEÑO',
    'TERCERO_NO_RESPONSABLE',
    'ATENDIO_MENOR_DE_EDAD',
    'NO_ENTREGADO_ERROR_ENVIO'
  ) NOT NULL
    COMMENT 'Clasificación post-envío (ENUM exacto)',

  accion_siguiente ENUM(
    'DERIVAR_HABY',
    'FOLLOWUP_1',
    'CERRAR',
    'INVALIDAR_TELEFONO',
    'REINTENTO_TECNICO',
    'NO_CONTACTAR'
  ) NOT NULL
    COMMENT 'Acción siguiente (ENUM exacto)',

  detalle VARCHAR(255) NULL
    COMMENT 'Detalle breve opcional (operador)',

  clasificado_por VARCHAR(64) NULL
    COMMENT 'Opcional: "{tipo}:{id}" (ej: admin:1, user:25)',

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    COMMENT 'Timestamp de creación del evento',

  PRIMARY KEY (id),

  INDEX idx_post_envio_envio_id (envio_id),
  INDEX idx_post_envio_cliente_created (cliente_id, created_at),
  INDEX idx_post_envio_estado (post_envio_estado)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Bitácora de clasificaciones post-envío WhatsApp (histórico)';


-- ============================================================
-- FK opcional (solo si ll_envios_whatsapp es compatible)
-- - No debe romper instalaciones donde ll_envios_whatsapp no es InnoDB
-- - No debe duplicarse si ya existe
-- ============================================================

SET @envios_ok := (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name = 'll_envios_whatsapp'
    AND engine = 'InnoDB'
);

SET @envios_id_ok := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'll_envios_whatsapp'
    AND column_name = 'id'
    AND data_type = 'int'
    AND column_type LIKE 'int%'
);

SET @fk_exists := (
  SELECT COUNT(*)
  FROM information_schema.table_constraints
  WHERE table_schema = DATABASE()
    AND table_name = 'll_post_envio_clasificaciones'
    AND constraint_name = 'fk_post_envio_envio'
    AND constraint_type = 'FOREIGN KEY'
);

SET @add_fk_sql := IF(
  @envios_ok > 0 AND @envios_id_ok > 0 AND @fk_exists = 0,
  'ALTER TABLE ll_post_envio_clasificaciones
     ADD CONSTRAINT fk_post_envio_envio
     FOREIGN KEY (envio_id) REFERENCES ll_envios_whatsapp(id)
     ON DELETE CASCADE
     ON UPDATE CASCADE;',
  'SELECT "Skipping FK fk_post_envio_envio (not compatible or already exists)" AS info;'
);

PREPARE stmt FROM @add_fk_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================
-- Verificación rápida (manual)
-- DESCRIBE ll_post_envio_clasificaciones;
-- SHOW INDEX FROM ll_post_envio_clasificaciones;
-- ============================================================