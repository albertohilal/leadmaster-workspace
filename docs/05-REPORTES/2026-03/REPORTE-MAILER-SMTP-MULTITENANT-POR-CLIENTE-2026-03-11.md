# REPORTE — Mailer: SMTP multi-tenant por `cliente_id` (desde `ll_clientes_email_config`) — 2026-03-11

**Fecha:** 2026-03-11  
**Destino (path):** `docs/05-REPORTES/2026-03/REPORTE-MAILER-SMTP-MULTITENANT-POR-CLIENTE-2026-03-11.md`

---

## 1) Resumen ejecutivo

Se modificó el servicio `services/mailer` para que el envío de emails sea **multi-tenant por `cliente_id`**, resolviendo la configuración SMTP desde MySQL en la tabla `ll_clientes_email_config` (config activa `is_active=1`).

La auditoría ya existente en `ll_envios_email` se mantiene:
- Inserta `PENDING` antes de enviar.
- Marca `SENT` con `message_id` y `sent_at` en éxito.
- Marca `FAILED` con `error_message` útil ante fallas.

Se agregó un fallback opcional y explícito (deshabilitado por defecto) para usar SMTP global por `.env` **solo si** no existe config activa del cliente.

---

## 2) Objetivo

Implementar envío por email multi-tenant:
- La fuente principal de configuración SMTP debe ser MySQL por `cliente_id`.
- Evitar depender “principalmente” de un SMTP global en `.env`.
- Mantener el contrato del endpoint `POST /send`.

---

## 3) Nuevo comportamiento (flujo)

### 3.1 Entrada del endpoint
`POST /send` sigue recibiendo:
- `cliente_id` (obligatorio)
- `to`
- `subject`
- `text` y/o `html`

### 3.2 Auditoría previa
Antes de intentar enviar:
- Insert en `ll_envios_email` con `status='PENDING'`.

### 3.3 Resolución de config SMTP por cliente (principal)
Se consulta MySQL:
- Tabla: `ll_clientes_email_config`
- Filtro: `cliente_id = ? AND is_active = 1`
- `LIMIT 1`

Si existe config:
- Se crea transporter Nodemailer dinámico con:
  - `smtp_host`, `smtp_port`, `smtp_secure`, `smtp_user`, `smtp_pass`
- Se usa remitente:
  - `from_email`, `from_name`
- Si existe, se aplica:
  - `reply_to_email` → `replyTo`

Logs:
- `[mailer] client smtp config loaded`
- `[mailer] transporter created for cliente_id`

### 3.4 Si NO hay config activa
Si no existe config activa en DB:
- NO se intenta enviar (modo normal)
- Se marca el log como `FAILED`
- Se guarda `error_message = 'CLIENT_EMAIL_CONFIG_NOT_FOUND'`
- Se responde error controlado:
  - HTTP `404`
  - `code = CLIENT_EMAIL_CONFIG_NOT_FOUND`

Logs:
- `[mailer] client smtp config not found`
- `[mailer] email marked as FAILED`

### 3.5 Fallback opcional por `.env` (controlado)
El fallback está controlado por:
- `SMTP_FALLBACK_ENABLED` (por defecto `false`)

Si `SMTP_FALLBACK_ENABLED=true` y NO hay config activa en DB:
- el mailer intenta enviar usando `SMTP_*` globales del `.env`

Nota: el fallback existe solo como herramienta técnica; el camino principal es DB.

### 3.6 Manejo de errores DB
- Si falla la carga de config desde DB: responde error controlado `503 SERVICE_UNAVAILABLE`.
- Se audita `FAILED` con un mensaje útil (`CLIENT_EMAIL_CONFIG_LOAD_FAILED: ...`).

---

## 4) Diseño / módulos implementados

- Repo de config cliente (DB):
  - `services/mailer/src/repositories/clientEmailConfigRepository.js`
- Factory de transporter (cliente + fallback):
  - `services/mailer/src/services/smtpTransportFactory.js`
- Integración del flujo:
  - `services/mailer/src/services/mailerService.js`
- Provider SMTP actualizado para recibir `transporter/from/replyTo`:
  - `services/mailer/src/services/providers/smtpProvider.js`

---

## 5) Archivos impactados

### Nuevos
- `services/mailer/src/repositories/clientEmailConfigRepository.js`
- `services/mailer/src/services/smtpTransportFactory.js`

### Modificados
- `services/mailer/src/services/mailerService.js`
- `services/mailer/src/services/providers/smtpProvider.js`
- `services/mailer/.env.example` (agrega `SMTP_FALLBACK_ENABLED`)
- `services/mailer/README.md` (documenta multi-tenant + fallback)

---

## 6) Variables de entorno

Requeridas (DB):
- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`

Opcional (fallback):
- `SMTP_FALLBACK_ENABLED=false|true`
- Si `SMTP_FALLBACK_ENABLED=true`, se usan también `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME`.

---

## 7) Evidencia de prueba (manual)

Se validó con el servicio corriendo bajo PM2.

### 7.1 Config activa encontrada (cliente_id=52)

Se verificó que existe una config activa en DB para `cliente_id=52` (`is_active=1`).

Logs observados en PM2:
- `[mailer] client smtp config loaded {"cliente_id":52,"config_id":1}`
- `[mailer] transporter created for cliente_id {"cliente_id":52}`

`POST /send` devolvió `200` y mantuvo el contrato del body:

```json
{
  "ok": true,
  "service": "mailer",
  "cliente_id": 52,
  "provider": "smtp",
  "accepted": true,
  "message_id": "<74f685ba-77af-58d0-3765-e7cdc8679c2b@desarrolloydisenio.com.ar>",
  "status": "SENT",
  "timestamp": "2026-03-11T16:26:05.000Z"
}
```

Se verificó persistencia en `ll_envios_email` (registro `SENT` con `sent_at` y `message_id`).

### 7.2 Config NO encontrada (cliente_id=999999)

Se ejecutó `POST /send` con un `cliente_id` sin config activa esperada.

- Respuesta HTTP controlada:
  - `404`
  - `code = CLIENT_EMAIL_CONFIG_NOT_FOUND`

Se verificó persistencia en `ll_envios_email`:
- `status = FAILED`
- `error_message = CLIENT_EMAIL_CONFIG_NOT_FOUND` (exacto, sin ser pisado por otro handler)

---

## 8) Notas / riesgos

- El fallback por `.env` está deshabilitado por defecto para evitar depender de SMTP global como camino principal.
- Si `SMTP_FALLBACK_ENABLED=true`, el comportamiento ante “config de cliente inexistente” cambia: intentará enviar con `SMTP_*` global.
- Si falla la DB, el envío se corta antes del SMTP (audit/config son obligatorios) y se responde con error controlado.

---

## 9) Resultado esperado

- Cada `cliente_id` envía con su propia configuración SMTP activa desde MySQL.
- Si no hay config activa:
  - se audita `FAILED` con `CLIENT_EMAIL_CONFIG_NOT_FOUND`
  - se responde error controlado sin intentar enviar
- La auditoría en `ll_envios_email` se mantiene (PENDING → SENT/FAILED).
- El contrato del endpoint `POST /send` se preserva.

---

## 10) Regla de resolución SMTP

Para evitar ambigüedades operativas, el servicio aplica la siguiente regla de resolución SMTP:

1. Buscar configuración SMTP activa del cliente en `ll_clientes_email_config` por `cliente_id` (`is_active=1`).
2. Si existe config activa, usar esa configuración (fuente principal).
3. Si no existe config activa:
   - si `SMTP_FALLBACK_ENABLED=false` (default), cortar el flujo, auditar `FAILED` y responder `CLIENT_EMAIL_CONFIG_NOT_FOUND`.
   - si `SMTP_FALLBACK_ENABLED=true`, usar SMTP global del `.env` como fallback técnico.

Notas:
- MySQL por `cliente_id` es el camino normal de operación.
- El fallback por `.env` no es el camino normal; existe solo para contingencias/compatibilidad explícita.
