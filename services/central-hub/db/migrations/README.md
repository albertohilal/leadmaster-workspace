# Migraciones de Base de Datos - LeadMaster Central Hub

## Cómo Ejecutar

Las migraciones deben ejecutarse en orden numérico desde la terminal MySQL:

```bash
# Conectar a MySQL
mysql -u root -p leadmaster

# Ejecutar migración (desde MySQL prompt)
source /root/leadmaster-workspace/services/central-hub/db/migrations/001_fix_historial_enum_remove_no_incluido.sql
source /root/leadmaster-workspace/services/central-hub/db/migrations/002_add_usuario_id_to_historial.sql
source /root/leadmaster-workspace/services/central-hub/db/migrations/003_add_message_id_to_envios.sql
```

O desde la terminal bash:

```bash
cd /root/leadmaster-workspace/services/central-hub

# Ejecutar todas las migraciones
mysql -u root -p leadmaster < db/migrations/001_fix_historial_enum_remove_no_incluido.sql
mysql -u root -p leadmaster < db/migrations/002_add_usuario_id_to_historial.sql
mysql -u root -p leadmaster < db/migrations/003_add_message_id_to_envios.sql
```

## Orden de Ejecución

| # | Archivo | Descripción | Crítico |
|---|---------|-------------|---------|
| 001 | `fix_historial_enum_remove_no_incluido.sql` | Elimina 'no_incluido' del ENUM de historial | ⚠️ MEDIA |
| 002 | `add_usuario_id_to_historial.sql` | Agrega columna usuario_id para auditoría | 🔴 ALTA |
| 003 | `add_message_id_to_envios.sql` | Agrega columna message_id para trazabilidad | 🔴 ALTA |

## Idempotencia

Todas las migraciones son idempotentes (pueden ejecutarse múltiples veces sin romper):
- Verifican existencia de columnas/constraints antes de crearlos
- Usan SQL dinámico condicional
- No fallan si ya fueron aplicadas

## Verificación Post-Migración

```sql
-- Verificar estructura de historial
DESCRIBE ll_envios_whatsapp_historial;
-- Debe incluir: usuario_id INT NULL
-- ENUMs deben ser: enum('pendiente','enviado','error')

-- Verificar estructura de envios
DESCRIBE ll_envios_whatsapp;
-- Debe incluir: message_id VARCHAR(255) NULL

-- Verificar foreign keys
SELECT 
  TABLE_NAME,
  CONSTRAINT_NAME,
  REFERENCED_TABLE_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'leadmaster'
  AND TABLE_NAME = 'll_envios_whatsapp_historial';
```

## Rollback (Si es necesario)

```sql
-- Rollback 003
ALTER TABLE ll_envios_whatsapp DROP COLUMN message_id;

-- Rollback 002
ALTER TABLE ll_envios_whatsapp_historial DROP FOREIGN KEY fk_historial_usuario;
ALTER TABLE ll_envios_whatsapp_historial DROP COLUMN usuario_id;

-- Rollback 001 (NO RECOMENDADO - perdería datos si hay 'pendiente')
-- ALTER TABLE ll_envios_whatsapp_historial
-- MODIFY COLUMN estado_anterior ENUM('no_incluido','pendiente','enviado','error');
```

## Notas Importantes

1. **Backup obligatorio antes de migración 001:**
   ```bash
   mysqldump -u root -p leadmaster ll_envios_whatsapp_historial > backup_historial_$(date +%Y%m%d).sql
   ```

2. **Migración 001 destructiva:**
   - Si existen registros con 'no_incluido', deben limpiarse primero
   - Revisar query de conteo antes de ejecutar ALTER

3. **Entornos:**
   - Ejecutar primero en development
   - Luego en staging con verificación
   - Finalmente en production con backup

4. **Código compatible:**
   - El código en estadoService.js ya está preparado para usar usuario_id y message_id
   - No se requieren cambios de código después de migraciones
   - Schema.sql debe actualizarse manualmente para reflejar migraciones

## Fecha de Creación

2026-02-17 - Alineación con Política WhatsApp v1.2.0
