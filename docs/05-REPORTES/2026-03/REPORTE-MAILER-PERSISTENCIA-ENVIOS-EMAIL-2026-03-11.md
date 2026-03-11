# REPORTE — Mailer: persistencia/auditoría de envíos email en `ll_envios_email` — 2026-03-11

**Fecha:** 2026-03-11  
**Destino (path):** `docs/05-REPORTES/2026-03/REPORTE-MAILER-PERSISTENCIA-ENVIOS-EMAIL-2026-03-11.md`

---

## 1) Resumen ejecutivo

Se implementó persistencia (auditoría) de cada envío de email del servicio `services/mailer` en MySQL, tabla `ll_envios_email`, con un flujo **PENDING → SENT/FAILED**.

El endpoint `POST /send` mantiene el contrato y comportamiento HTTP actual:
- En éxito: responde igual que antes.
- En error SMTP: sigue devolviendo error tipificado; adicionalmente queda registrado el fallo en DB.
- En error de DB al crear el log PENDING: responde error controlado.

---

## 2) Objetivo

Registrar en `ll_envios_email` cada intento de envío para poder auditar:
- qué se intentó enviar,
- cuándo,
- resultado (SENT/FAILED),
- `message_id` del proveedor,
- y mensaje de error útil cuando falle.

---

## 3) Flujo implementado (detalle)

### 3.1 Inserción previa (antes de SMTP)
Antes de intentar enviar por SMTP:
- INSERT en `ll_envios_email` con:
  - `cliente_id`
  - `to_email`
  - `subject`
  - `body` (mapeado desde `html` si existe; si no, desde `text`)
  - `provider = 'smtp'`
  - `status = 'PENDING'`

Log:
- `[mailer] email log created` (incluye `id` y `cliente_id`)

Si el INSERT falla (problema DB o configuración):
- se loguea `[mailer] failed to create email log`
- se corta el flujo
- se responde error controlado `SERVICE_UNAVAILABLE` con mensaje `Database unavailable`

### 3.2 Envío SMTP
Se realiza el envío real reutilizando el provider actual (nodemailer) sin cambios de contrato.

### 3.3 Update en éxito
Si SMTP es exitoso:
- UPDATE del registro creado a:
  - `status = 'SENT'`
  - `message_id = <provider messageId>`
  - `sent_at = NOW()`
  - `error_message = NULL`

Log:
- `[mailer] email marked as SENT`

Si el UPDATE de éxito falla:
- se loguea `[mailer] failed to mark email as SENT`
- NO se rompe la respuesta 200 (el envío ya ocurrió)

### 3.4 Update en error
Si SMTP falla:
- UPDATE del registro creado a:
  - `status = 'FAILED'`
  - `error_message = <mensaje legible>` (formato `CODE: message` cuando aplica)

Log:
- `[mailer] email marked as FAILED`

Luego:
- se re-lanza el error original para mantener el comportamiento HTTP actual del endpoint

Si el UPDATE de error falla:
- se loguea `[mailer] failed to mark email as FAILED`
- se mantiene el error HTTP original

---

## 4) Mapeo de campos (payload → DB)

- `cliente_id` → `cliente_id`
- `to` → `to_email`
- `subject` → `subject`
- `html` si existe y no está vacío, sino `text` → `body`
- Provider fijo → `provider = 'smtp'`

---

## 5) Archivos impactados

### Nuevos
- `services/mailer/src/config/db.js`
- `services/mailer/src/repositories/emailLogRepository.js`

### Modificados
- `services/mailer/src/services/mailerService.js`
- `services/mailer/package.json` (se agrega `mysql2`)
- `services/mailer/.env.example` (se agregan `DB_*`)
- `services/mailer/README.md` (documentación de `DB_*` + alcance)

---

## 6) Variables de entorno requeridas

El servicio ahora requiere configuración DB para poder auditar envíos:

- `DB_HOST`
- `DB_PORT` (default 3306)
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`

Nota: la conexión se inicializa de forma *lazy* (no bloquea el arranque), pero el endpoint `/send` fallará si no está configurada o no hay conectividad a DB.

---

## 7) Validación recomendada (manual)

1) Configurar `DB_*` en `services/mailer/.env` apuntando a la base que contiene `ll_envios_email`.
2) Levantar el servicio (`npm run dev` o `npm start`).
3) Ejecutar:

```bash
curl -X POST http://localhost:3005/send \
  -H "Content-Type: application/json" \
  -d '{
    "cliente_id": 52,
    "to": "alguien@dominio.com",
    "subject": "Prueba mailer",
    "text": "hola"
  }'
```

4) Verificar en MySQL:
- existe un registro nuevo con `status='SENT'` y `sent_at` no nulo (si SMTP OK)
- o `status='FAILED'` y `error_message` completo (si SMTP falla)

5) Probar caída de DB (credenciales erróneas o host inaccesible) y verificar:
- respuesta controlada con `SERVICE_UNAVAILABLE`
- log de error `[mailer] failed to create email log`

---

## 8) Riesgos / notas

- Si la DB está intermitente:
  - el envío puede quedar bloqueado antes de SMTP (por diseño) porque el audit es obligatorio.
- Si el UPDATE final (SENT/FAILED) falla, el evento queda en `PENDING` y el problema queda logueado; esto requiere observabilidad (logs) para detectar inconsistencias.
- No se alteró el validador: `cliente_id` se mantiene obligatorio.

---

## 9) Resultado esperado

- Todo envío intentado queda registrado.
- En éxito: registro termina en `SENT` con `message_id` y `sent_at`.
- En error: registro termina en `FAILED` con `error_message` útil.
- El contrato HTTP del endpoint `/send` no cambia.

---

## 10) Prueba ejecutada (evidencia)

Se ejecutó una validación manual real en el host (Linux) con el servicio corriendo bajo **PM2**.

### 10.1 Estado del servicio

- `GET /health` devolvió `200`:

```json
{"service":"mailer","status":"healthy","timestamp":"2026-03-11T14:28:53.000Z"}
```

### 10.2 Envío exitoso (SENT)

1) Se ejecutó un `POST /send` válido.
2) El endpoint devolvió `200` y el body mantuvo el contrato:

```json
{
  "ok": true,
  "service": "mailer",
  "cliente_id": 52,
  "provider": "smtp",
  "accepted": true,
  "message_id": "<91ec7bdc-7bbf-68af-0787-0ba80df19c6a@desarrolloydisenio.com.ar>",
  "status": "SENT",
  "timestamp": "2026-03-11T14:21:22.968Z"
}
```

3) Se verificó persistencia en MySQL:
- Registro creado en `ll_envios_email` con `status='SENT'`, `message_id` persistido y `sent_at` no nulo.
- Ejemplo observado:
  - `id = 1`
  - `cliente_id = 52`
  - `status = SENT`
  - `message_id = <91ec7bdc-7bbf-68af-0787-0ba80df19c6a@desarrolloydisenio.com.ar>`
  - `sent_at` con timestamp poblado

4) Se verificaron logs:
- `[mailer] email log created {"id":1,"cliente_id":52}`
- `[mailer] email marked as SENT {"id":1,"cliente_id":52,"message_id":"<...>"}`

### 10.3 Envío fallido forzado (FAILED)

Para validar el flujo `FAILED`, se forzó una falla de conectividad SMTP **temporalmente** (sin exponer credenciales) y se reinició el proceso con PM2.

1) Se ejecutó un `POST /send` válido bajo falla SMTP.
2) El endpoint devolvió error HTTP y mantuvo el comportamiento actual (tipificado):

```json
{"error":true,"code":"MAIL_PROVIDER_ERROR","message":"SMTP provider error"}
```

3) Se verificó persistencia en MySQL:
- Se crearon nuevos registros con `status='FAILED'`.
- Se persistió `error_message` útil:
  - `MAIL_PROVIDER_ERROR: SMTP provider error`
- Ejemplos observados:
  - `id = 2` → `FAILED` (sin `sent_at`)
  - `id = 3` → `FAILED` (sin `sent_at`)

4) Se restauró la configuración SMTP real, se reinició PM2 y se confirmó nuevamente un `POST /send` exitoso (`200`).

---

## 11) Verificación de credenciales (DB)

Se verificó que la conexión MySQL del mailer no tiene credenciales hardcodeadas:

- El módulo `services/mailer/src/config/db.js` **lee únicamente** desde variables de entorno `DB_*` (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`).
- No existen valores de host/usuario/password/base escritos en el código.
- La inicialización del pool es *lazy* (se crea al primer uso), pero siempre toma los valores desde `process.env`.

---

## 12) Verificación de dependencias (package.json)

Se verificó que el cambio en dependencias del servicio `services/mailer` fue mínimo:

- En `services/mailer/package.json` se agregó **solo** `mysql2` (necesario para conectarse a MySQL y persistir `ll_envios_email`).
- No se agregaron scripts nuevos ni otras dependencias.
- `services/mailer/package-lock.json` cambió únicamente como consecuencia de ejecutar `npm install` para incorporar `mysql2`.

