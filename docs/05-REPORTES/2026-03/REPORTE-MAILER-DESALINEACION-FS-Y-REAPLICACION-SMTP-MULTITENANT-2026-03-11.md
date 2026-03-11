# REPORTE — Mailer: desalineación de FS/edición y reaplicación de SMTP multi-tenant — 2026-03-11

**Fecha:** 2026-03-11  
**Destino (path):** `docs/05-REPORTES/2026-03/REPORTE-MAILER-DESALINEACION-FS-Y-REAPLICACION-SMTP-MULTITENANT-2026-03-11.md`

---

## 1) Resumen ejecutivo

Durante la implementación de SMTP multi-tenant en `services/mailer`, se observó una **desalineación entre el contenido del archivo en disco que ejecuta Node/PM2** y el contenido visible/modificado mediante herramientas de edición.

Efecto operacional: el servicio en ejecución seguía respondiendo `500 INTERNAL_ERROR ("SMTP transporter is not configured")` al intentar el caso “cliente sin config activa”, cuando el comportamiento esperado era `404 CLIENT_EMAIL_CONFIG_NOT_FOUND` (si `SMTP_FALLBACK_ENABLED=false`).

Se preparó un plan de reaplicación **manual y verificable** para garantizar que el código multi-tenant quede efectivamente en el filesystem que ejecuta PM2.

---

## 2) Objetivo

- Dejar asentado el diagnóstico de desalineación FS/edición.
- Dejar el orden de reaplicación del cambio SMTP multi-tenant (DB por `cliente_id` con fallback opcional por `.env`).

---

## 3) Síntomas observados

- `POST /send` con `cliente_id` sin config activa (ej. `999999`) devolvía:
  - `500 INTERNAL_ERROR`
  - `message: "SMTP transporter is not configured"`

- Logs PM2 mostraban auditoría `PENDING` y `FAILED` pero la respuesta HTTP no correspondía al error de “config inexistente” esperado.

---

## 4) Evidencia técnica (hallazgos)

### 4.1 El proceso que atiende el puerto es el de PM2

Se verificó que el listener en `:3005` correspondía a Node en `services/mailer`:
- `ss -ltnp | grep ':3005'` → PID de `node /root/leadmaster-workspace/services/mailer/...`
- `readlink -f /proc/<pid>/cwd` → `.../services/mailer`

### 4.2 La edición no impactaba el contenido que veía el terminal

Se intentó insertar un marcador de sincronización en `services/mailer/src/services/mailerService.js` usando herramientas de edición.

Luego, desde terminal:
- `grep`/`head` sobre `src/services/mailerService.js` **no reflejaban** el marcador.

Conclusión: las herramientas de edición estaban escribiendo en una vista distinta (o buffer no persistido) respecto del filesystem leído por Node/PM2.

---

## 5) Impacto

- El servicio podía quedar ejecutando una versión antigua de `mailerService`/`smtpProvider`.
- El flujo multi-tenant no quedaba confiablemente aplicado.
- Las pruebas por HTTP arrojaban resultados inconsistentes con el diseño esperado.

---

## 6) Reaplicación recomendada (pasos)

1. Aplicar cambios **en el filesystem real** (copiar/pegar en los archivos desde el editor asegurando que el contenido sea visible con `head`/`grep`).
2. Verificar consistencia de contenido:
   - `grep -n "client smtp config loaded" services/mailer/src/services/mailerService.js`
   - `grep -n "CLIENT_EMAIL_CONFIG_NOT_FOUND" services/mailer/src/services/mailerService.js`
   - `grep -n "SMTP transporter is not configured" services/mailer/src/services/providers/smtpProvider.js`
3. Reiniciar usando solo PM2:
   - `pm2 restart leadmaster-mailer`
4. Validar:
   - `GET /health` → `200`
   - `POST /send` (cliente con config activa) → `200`
   - `POST /send` (cliente sin config activa, fallback apagado) → `404 CLIENT_EMAIL_CONFIG_NOT_FOUND`

---

## 7) Diseño esperado (recordatorio)

Regla conceptual:
1. Buscar config SMTP activa en `ll_clientes_email_config` por `cliente_id` (`is_active=1`).
2. Si existe, usar esa configuración.
3. Si NO existe:
   - `SMTP_FALLBACK_ENABLED=false` (default) → cortar, auditar `FAILED` y responder `CLIENT_EMAIL_CONFIG_NOT_FOUND` (404).
   - `SMTP_FALLBACK_ENABLED=true` → usar SMTP global `.env` como fallback explícito.

Logs requeridos:
- `[mailer] client smtp config loaded`
- `[mailer] client smtp config not found`
- `[mailer] transporter created for cliente_id`
- `[mailer] using fallback smtp from env`

---

## 8) Referencias

- Reporte técnico de implementación multi-tenant:
  - `docs/05-REPORTES/2026-03/REPORTE-MAILER-SMTP-MULTITENANT-POR-CLIENTE-2026-03-11.md`

- Archivos del servicio involucrados:
  - `services/mailer/src/services/mailerService.js`
  - `services/mailer/src/services/providers/smtpProvider.js`
  - `services/mailer/src/repositories/clientEmailConfigRepository.js`
  - `services/mailer/src/services/smtpTransportFactory.js`

---

## 9) Estado actual

- La arquitectura multi-tenant está definida.
- La reaplicación debe garantizarse sobre el filesystem real (verificación por `grep/head`), y luego validarse con PM2.
