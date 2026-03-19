# REPORTE — Estado real de integración Mailer ↔ Central Hub — 2026-03-14

## Estado del documento

**Documento superado / obsoleto.**

Este reporte fue válido como fotografía técnica del estado del repositorio al momento de su emisión inicial, pero **ya no representa el estado actual del sistema**.

A partir del avance implementado y validado posteriormente, el punto de verdad operativo vigente para esta temática pasa a ser:

- `docs/05-REPORTES/2026-03/REPORTE-INTEGRACION-END-TO-END-EMAIL-CENTRAL-HUB-MAILER-2026-03-15.md`

## Motivo de obsolescencia

Luego de emitido este reporte, quedó efectivamente implementada y validada la integración entre `central-hub` y `leadmaster-mailer`, incluyendo:

- integración HTTP real `central-hub` → `leadmaster-mailer`
- gateway autenticado `POST /mailer/send` expuesto por `central-hub`
- resolución de `cliente_id` desde el usuario autenticado vía JWT
- delegación del envío al servicio standalone `leadmaster-mailer`
- resolución SMTP por cliente desde `iunaorg_dyd.ll_clientes_email_config`
- validación con envío real en modo prueba
- UI inicial para selección común de prospectos y preparación de envío Email

## Qué partes de este reporte quedaron desactualizadas

Las siguientes conclusiones del documento original **ya no son válidas**:

- que en `central-hub` no existía integración real implementada con el mailer
- que no había cliente HTTP hacia `leadmaster-mailer`
- que no había rutas o módulos de email/mailer en `central-hub`
- que la integración `central-hub` ↔ `leadmaster-mailer` estaba “NO IMPLEMENTADA”
- que el estado general debía leerse como “mailer listo pero hub no conectado”

Ese diagnóstico fue superado por la implementación posterior.

## Estado real vigente

El estado real vigente debe leerse así:

### Mailer standalone
- `leadmaster-mailer` existe y opera como servicio standalone
- expone `GET /health` y `POST /send`
- resuelve SMTP por `cliente_id`
- usa `iunaorg_dyd.ll_clientes_email_config`
- registra auditoría/persistencia de envíos

### Central Hub
- `central-hub` ya integra mailer vía HTTP
- expone `POST /mailer/send`
- exige autenticación JWT
- resuelve `cliente_id` desde el usuario autenticado
- delega al servicio standalone para el envío efectivo

### UI
- existe una UI inicial para selección común de prospectos
- la UI puede identificar disponibilidad de email
- existe una preparación inicial de envío Email en modo prueba

## Alcance de la corrección

Este documento **no se elimina** porque conserva valor como evidencia histórica del estado previo de integración.

Sin embargo, desde este momento debe interpretarse bajo estas reglas:

- **no usar este reporte como punto de verdad operativo actual**
- **no usar este reporte para concluir que la integración hub↔mailer está pendiente**
- **usar en su lugar el reporte end-to-end del 2026-03-15**

## Referencia obligatoria actual

Documento vigente de referencia:

- `docs/05-REPORTES/2026-03/REPORTE-INTEGRACION-END-TO-END-EMAIL-CENTRAL-HUB-MAILER-2026-03-15.md`

## Nota final

Se conserva este archivo como evidencia de auditoría previa, pero su contenido quedó superado por la implementación real posterior. Toda lectura actual del canal Email en `leadmaster-workspace` debe partir del estado documentado en el reporte de integración end-to-end del 2026-03-15.
