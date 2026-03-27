# Relevamiento: resolución de remitente para cliente de prueba y brecha hacia estado sendable — 2026-03-24

## Clasificación documental
- **AS-IS IMPLEMENTADO**: hallazgos respaldados por código activo del repositorio.
- **VALIDADO EN REPO / NO VERIFICADO EN RUNTIME**: hallazgos observables en archivos `.env` o documentación del workspace, pero no comprobados en despliegue real durante este relevamiento.
- **INFERIDO**: conclusiones derivadas de la combinación de evidencias verificadas.

---

## 1. Objetivo

Determinar, sin tocar código:

1. cómo se resuelve hoy el remitente en el flujo Email para el cliente de prueba
2. si `email_from` sale de la campaña o del cliente
3. si existe evidencia de resolución desde `societe` / `llxbx_societe`
4. si hay otra tabla o configuración activa para remitente
5. si existe hoy un camino completo para remitente por cliente
6. qué falta para volver la campaña del cliente de prueba a estado **sendable**
7. si el problema principal es de datos, configuración, infraestructura, código o mezcla

---

## 2. Criterio de verdad

Prioridad aplicada en este relevamiento:

1. código activo en `services/central-hub`
2. código activo en `services/mailer`
3. configuración visible en el repositorio
4. documentación previa, solo como apoyo contextual

Cuando la documentación y el código pudieran divergir, se privilegió el código.

---

## 3. Código revisado

### Central Hub
- `src/modules/email/validators/createEmailCampaign.validator.js`
- `src/modules/email/services/emailCampaigns.service.js`
- `src/modules/email/services/emailCampaignPrepare.service.js`
- `src/modules/email/services/emailCampaigns.scheduler.js`
- `src/integrations/mailer/mailerClient.js`

### Mailer
- `src/repositories/clientEmailConfigRepository.js`
- `src/services/mailerService.js`
- `src/services/smtpTransportFactory.js`
- `src/validators/sendValidator.js`

### Configuración observada en repo
- `services/central-hub/.env`
- `services/mailer/.env`

---

## 4. Hallazgos principales

### Hallazgo H-01 — `email_from` exigido por prepare pertenece a la campaña
**Estado:** AS-IS IMPLEMENTADO  
**Severidad:** alta  
**Certeza:** alta

**Evidencia verificada por código**
- El validador de create mínimo rechaza `email_from`, `name_from` y `reply_to_email`.
- El servicio de create inserta la campaña con esos tres campos en `null`.
- El servicio `prepare` exige que `campaign.email_from` exista y no esté vacío.

**Conclusión**
Hoy, para que una campaña quede preparable/sendable, el `email_from` requerido por `prepare` sale de la **campaña**, no de una resolución dinámica por cliente dentro de `prepare`.

---

### Hallazgo H-02 — El remitente SMTP técnico real sale de `ll_clientes_email_config` o del fallback global
**Estado:** AS-IS IMPLEMENTADO  
**Severidad:** alta  
**Certeza:** alta

**Evidencia verificada por código**
- `services/mailer` busca configuración activa por `cliente_id` en `ll_clientes_email_config`.
- Si encuentra config, arma el transporte SMTP con `smtp_host`, `smtp_port`, `smtp_secure`, `smtp_user`, `smtp_pass` y construye el remitente con `from_email` + `from_name`.
- Si no encuentra config y `SMTP_FALLBACK_ENABLED=true`, arma un transporte global usando `SMTP_*`, incluyendo `SMTP_FROM_EMAIL`.
- Si no encuentra config y el fallback está deshabilitado, falla con `CLIENT_EMAIL_CONFIG_NOT_FOUND`.

**Conclusión**
El remitente técnico real del servicio `mailer` se resuelve por **configuración SMTP del cliente** o por **fallback global**, no desde `campaign.email_from` como fuente primaria interna del `mailer`.

---

### Hallazgo H-03 — Existe una brecha real entre la campaña preparable y la configuración SMTP por cliente
**Estado:** AS-IS IMPLEMENTADO  
**Severidad:** crítica  
**Certeza:** alta

**Evidencia verificada por código**
- `create` deja `campaign.email_from = null`.
- `prepare` exige `campaign.email_from`.
- El scheduler envía `from_email: campaign.email_from || undefined`, `from_name: campaign.name_from || undefined` y `reply_to: campaign.reply_to_email || undefined` al envío técnico.
- El `mailer`, por su lado, resuelve internamente el `from` desde `ll_clientes_email_config` o desde `SMTP_FROM_EMAIL` en fallback.
- En el código relevado no apareció un paso que copie automáticamente `clientConfig.from_email` hacia `campaign.email_from`.

**Conclusión**
Hay un hueco real entre:
- la superficie funcional que exige `campaign.email_from` para preparar la campaña
- y la infraestructura SMTP que ya sabe resolver un `from_email` por cliente

---

### Hallazgo H-04 — No hay evidencia verificada de que `societe` o `llxbx_societe` sean fuente activa del remitente en este flujo
**Estado:** AS-IS IMPLEMENTADO / NEGATIVO  
**Severidad:** media  
**Certeza:** media-alta

**Evidencia verificada por código**
- En el flujo revisado de Email/Mailer no se encontró una consulta activa al dominio `societe` / `llxbx_societe` para resolver el remitente.
- La tabla/configuración explícita encontrada para remitente por cliente fue `ll_clientes_email_config`.

**Conclusión**
Con la evidencia actual, `societe.email` o `llxbx_societe.email` no aparecen como fuente efectiva del remitente del flujo Email revisado.

---

### Hallazgo H-05 — El problema no parece ser principalmente de infraestructura
**Estado:** VALIDADO EN REPO / NO VERIFICADO EN RUNTIME  
**Severidad:** media  
**Certeza:** media

**Evidencia observada en repo**
- `central-hub` tiene `MAILER_BASE_URL` definido en `.env`.
- `services/mailer/.env` contiene `SMTP_FROM_EMAIL`.
- `services/mailer/.env` tiene `SMTP_FALLBACK_ENABLED=false`.

**Conclusión**
En el repositorio no aparece una ausencia obvia de configuración base de integración entre `central-hub` y `mailer`. El foco principal del bloqueo relevado está antes, en la brecha funcional entre campaña y remitente requerido para `prepare`, y luego en la existencia o no de config activa por cliente.

---

## 5. Matriz de evidencia

| ID | Afirmación | Evidencia en código | Estado |
|---|---|---|---|
| H-01 | `prepare` exige `campaign.email_from` | `emailCampaignPrepare.service.js` valida `campaign.email_from` | Verificado |
| H-01 | create mínimo no acepta remitente | `createEmailCampaign.validator.js` rechaza `email_from`, `name_from`, `reply_to_email` | Verificado |
| H-01 | create persiste remitente nulo | `emailCampaigns.service.js` inserta `email_from = null`, `name_from = null`, `reply_to_email = null` | Verificado |
| H-02 | config por cliente sale de `ll_clientes_email_config` | `clientEmailConfigRepository.findActiveByClienteId()` | Verificado |
| H-02 | mailer arma `from` desde `from_email` + `from_name` | `smtpTransportFactory.createClientTransport()` | Verificado |
| H-02 | existe fallback global opcional | `mailerService.isFallbackEnabled()` + `createFallbackTransportFromEnv()` | Verificado |
| H-03 | scheduler pasa remitente desde campaña | `emailCampaigns.scheduler.js` usa `campaign.email_from`, `campaign.name_from`, `campaign.reply_to_email` | Verificado |
| H-03 | no se encontró autocompletado campaña ← config cliente | ausencia de ese bridge en flujo revisado | Verificado con evidencia negativa parcial |
| H-04 | no se encontró resolución desde `societe` / `llxbx_societe` | ausencia de referencias activas en flujo Email/Mailer revisado | Verificado con evidencia negativa parcial |
| H-05 | `MAILER_BASE_URL` está presente en repo | `.env` de `central-hub` | Validado en repo |
| H-05 | fallback SMTP está deshabilitado en repo | `.env` de `services/mailer` | Validado en repo |

---

## 6. Respuestas directas a las preguntas de investigación

### 6.1 ¿`email_from` sale hoy de la campaña o del cliente?
- **Para `prepare`: de la campaña.**
- **Para el SMTP técnico real: de la config del cliente o del fallback global.**

### 6.2 ¿Hay evidencia de resolución desde `societe` / `llxbx_societe`?
- **No en el flujo activo revisado.**
- No apareció código que use `societe.email` o `llxbx_societe.email` como fuente del remitente del envío Email.

### 6.3 ¿Hay otra tabla o configuración activa?
- **Sí:** `ll_clientes_email_config`.
- **Sí, como fallback técnico:** variables `SMTP_*`.
- No apareció otra fuente activa equivalente en el flujo revisado.

### 6.4 ¿Existe hoy un camino completo para remitente por cliente?
- **Parcialmente.**
- Sí existe para construir el remitente SMTP técnico en `mailer`.
- No hay evidencia verificada de puente automático hacia `campaign.email_from`, que es el dato exigido por `prepare`.

### 6.5 ¿Qué falta para que el cliente de prueba quede sendable?
Faltan, como mínimo, dos condiciones:

1. que la campaña tenga `email_from` cargado
2. que exista una vía SMTP resoluble para ese `cliente_id`:
   - config activa en `ll_clientes_email_config`, o
   - fallback global habilitado

### 6.6 ¿El problema principal es datos, configuración, infraestructura, código o mezcla?
- **Conclusión:** mezcla de **código/superficie funcional** y **datos/configuración**.
- **Código/superficie:** porque el create mínimo deja la campaña sin remitente, pero `prepare` luego lo exige.
- **Datos/configuración:** porque el envío técnico depende de config activa por cliente o fallback.
- **Infraestructura:** no aparece como el bloqueo principal con la evidencia disponible en repo.

### 6.7 ¿La falta de `societe.email` bloquea de verdad?
- **No surge como bloqueo principal en este flujo.**
- Con la evidencia actual, el foco real está en `campaign.email_from` y en `ll_clientes_email_config` / fallback SMTP.

### 6.8 ¿Hay evidencia de autocompletado de `campaign.email_from`?
- **No.**
- La evidencia revisada muestra create en `null` y prepare exigiéndolo después, sin puente automático identificado.

### 6.9 ¿Hay una brecha real entre config por cliente y `campaign.email_from` exigido por prepare?
- **Sí.**
- Esa es la conclusión técnica principal del relevamiento.

---

## 7. Qué faltaría verificar específicamente para el cliente de prueba

Este relevamiento no ejecutó consultas DB directas sobre el cliente de prueba durante esta etapa. Para cerrar el diagnóstico operativo puntual faltaría comprobar:

1. si la campaña del cliente de prueba sigue con `email_from = null`
2. si existe fila activa en `ll_clientes_email_config` para ese `cliente_id`
3. si esa fila tiene `from_email` y parámetros SMTP completos
4. si en el runtime efectivo `SMTP_FALLBACK_ENABLED` coincide con lo observado en el repo

**Clasificación:** NO VERIFICADO con evidencia actual de runtime.

---

## 8. Conclusión ejecutiva

**Conclusión principal:**

El bloqueo más probable para volver **sendable** la campaña del cliente de prueba no está en `societe.email`, sino en una combinación de:

1. **brecha funcional**: `prepare` exige `campaign.email_from`, pero create mínimo deja ese dato en `null`
2. **dependencia técnica**: el envío real requiere configuración activa en `ll_clientes_email_config` o fallback SMTP habilitado

En otras palabras:
- el sistema ya sabe resolver un remitente técnico por cliente dentro de `mailer`
- pero la superficie de campañas Email sigue exigiendo un `email_from` propio de campaña sin que en el flujo revisado exista un autocompletado verificable desde esa config

---

## 9. Próximo paso recomendado

Para cerrar el caso del cliente de prueba con evidencia operativa puntual, el siguiente paso recomendado es un relevamiento de datos enfocado en:

- campaña concreta del cliente de prueba
- valor actual de `email_from`
- existencia y contenido de `ll_clientes_email_config`
- consistencia entre configuración de repo y runtime

**Resultado esperado de ese paso:** clasificar el caso puntual como:
- bloqueo por dato faltante en campaña
- bloqueo por config SMTP faltante por cliente
- bloqueo mixto
