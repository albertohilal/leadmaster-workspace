Informe de Cambios – 22 de enero de 2026

Sistema LeadMaster – Campañas WhatsApp

Resumen Ejecutivo

El día 22 de enero de 2026 se realizaron correcciones críticas sobre el sistema de campañas WhatsApp tras detectar inconsistencias en los datos históricos, errores de segmentación y una restricción temporal impuesta por WhatsApp.

Las acciones implementadas permitieron:

Corregir estados incorrectos de envíos.

Depurar y normalizar números telefónicos.

Ajustar filtros de segmentación (leads vs proveedores).

Pausar preventivamente el sistema durante la restricción.

Alinear completamente la zona horaria del sistema con Argentina (UTC-3).

El sistema queda estable, coherente y listo para reactivación controlada.

1. Corrección de Datos Históricos – Campaña 47
Problema Detectado

El 20 de enero de 2026 se registraron incorrectamente 257 envíos como “enviados”, cuando en realidad solo 10 mensajes fueron efectivamente procesados con éxito.
El error se originó por un fallo del sistema de envío que marcó estados sin confirmación real.

Solución Implementada

Se realizó una corrección directa sobre la base de datos.

SQL ejecutado:

-- Resetear envíos incorrectamente marcados
UPDATE ll_envios_whatsapp
SET estado = 'pendiente', fecha_envio = NULL
WHERE campania_id = 47
  AND DATE(fecha_envio) = '2026-01-20'
  AND estado = 'enviado';

-- Marcar los 10 números realmente enviados
UPDATE ll_envios_whatsapp
SET estado = 'enviado', fecha_envio = '2026-01-20 10:00:00'
WHERE campania_id = 47
  AND telefono_wapp IN (
    '5491123360779', '5491121654102', '5491121705863',
    '5491121748189', '5491121896046', '5491122349183',
    '5491122469005', '5491122519491', '5491121848428',
    '5491122557236'
  );

-- Caso especial: Gerli Tattoo (formato diferente)
UPDATE ll_envios_whatsapp
SET estado = 'enviado', fecha_envio = '2026-01-20 10:00:00'
WHERE campania_id = 47 AND id = 4491;

Resultado

10 envíos correctamente marcados como enviados (20/01).

7 envíos en estado error (números WhatsApp inválidos).

250 envíos en estado pendiente.

72 envíos exitosos acumulados (20, 21 y 22 de enero).

Total campaña 47: 329 registros.

2. Pausa del Scheduler Automático
Problema

El 22 de enero (~12:00 hs) WhatsApp aplicó una restricción temporal de 24 horas tras detectar un patrón de envío masivo
(11 mensajes en aproximadamente 10 minutos).

Solución

Se desactivó el scheduler automático desde configuración.

Archivo modificado: .env

AUTO_CAMPAIGNS_ENABLED=false


Acción aplicada:

pm2 restart leadmaster-central-hub --update-env

Justificación

Evitar intentos de envío durante la restricción.

Prevenir escalamiento de penalización.

Establecer una ventana de 48 horas sin envíos para recuperación de reputación.

3. Limpieza de Números WhatsApp Inválidos
Problema Detectado

Se identificaron 27 registros en llxbx_societe.phone_mobile que no cumplen criterios de WhatsApp válido, incluyendo:

Teléfonos fijos.

Números incompletos (8–10 dígitos).

Placeholders (54911000000).

Formatos de otros países.

Solución Implementada

Los números inválidos se movieron a phone, preservando la información.

UPDATE llxbx_societe
SET phone = phone_mobile, phone_mobile = NULL
WHERE phone_mobile IS NOT NULL
  AND phone_mobile != ''
  AND (phone IS NULL OR phone = '')
  AND (
    phone_mobile NOT LIKE '549%'
    OR LENGTH(phone_mobile) < 12
    OR phone_mobile = '54911000000'
    OR (phone_mobile NOT LIKE '54%' AND LENGTH(phone_mobile) > 10)
  );

Resultado

1.204 números válidos permanecen en phone_mobile.

27 números inválidos preservados en phone.

phone_mobile queda reservado exclusivamente para WhatsApp válido (E.164).

4. Corrección de Filtros SQL (Leads vs Proveedores)
Problema Crítico

Las consultas utilizaban client = 0 como criterio de lead, lo que incluía proveedores, contaminando campañas.

Clasificación Correcta

client = 0 AND fournisseur = 0 → Lead / Prospecto

client = 1 → Cliente

fournisseur = 1 → Proveedor

Cambios Aplicados

Se corrigieron filtros en los siguientes archivos:

leadsController.js

prospectosController.js

syncService.js

Ejemplo:

// Antes
(s.client = 0 OR s.client IS NULL)

// Después
((s.client = 0 OR s.client IS NULL) AND s.fournisseur = 0)

Impacto

Proveedores excluidos de campañas.

Segmentación consistente.

Métricas limpias.

5. Marcado de Proveedores

Se identificaron y marcaron proveedores reales para exclusión futura.

UPDATE llxbx_societe SET fournisseur = 1 WHERE nom LIKE 'Halcon%';

UPDATE llxbx_societe
SET fournisseur = 1
WHERE phone_mobile IN ('5491123535393', '5491123887956');

ID	Nombre	Clasificación
883	Halcon Supplies Quilmes	Proveedor
923	Halcon Supplies Lomas	Proveedor
954	Jagüel City	Proveedor
1039	Ferretería Polo	Proveedor
6. Corrección de Zona Horaria
Problema

MySQL operaba en UTC-5, generando desfasajes con la lógica de envíos.

Solución

Se fijó explícitamente UTC-3 (Argentina) en todas las conexiones MySQL.

timezone: '-03:00'

Resultado

Fechas y comparaciones coherentes.

Ventanas horarias correctas.

Debugging y análisis simplificados.

7. Estado Actual del Sistema
Base de Datos

✅ 1.204 teléfonos WhatsApp válidos

✅ 27 teléfonos inválidos preservados

✅ Proveedores correctamente marcados

✅ Campaña 47: 72 enviados / 7 error / 250 pendientes

Sistema

⏸ Scheduler pausado

⏸ WhatsApp en restricción

✅ Zona horaria correcta

✅ Filtros SQL consistentes

8. Plan de Reactivación – Sábado 24 de enero

Checklist:

Confirmar fin de restricción.

Verificar estado WhatsApp = READY.

Reactivar scheduler.

Reiniciar PM2.

Envío de prueba controlado.

Recomendaciones iniciales:

5 mensajes/día (primera semana).

Ventana 12:00–20:00.

Monitoreo activo.

Conclusión

Las inconsistencias detectadas fueron completamente corregidas, dejando el sistema:

Con datos confiables.

Segmentación correcta.

Riesgo operativo minimizado.

Preparado para una reactivación gradual y segura.