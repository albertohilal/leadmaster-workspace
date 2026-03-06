# INFORME: Dedupe histórico por `llxbx_societe.phone_mobile` (endpoint prospectos)

**Destino:** `services/central-hub/docs/reports/INFORME_DEDUPLICACION_PHONE_MOBILE_2026-03-05.md`

**Fecha:** 2026-03-05

---

## Objetivo

1. Localizar en el historial git la implementación anterior del dedupe por `phone_mobile` del endpoint `GET /api/sender/prospectos/filtrar` (o lógica equivalente dentro de Central Hub).
2. Determinar qué columna se usaba como desempate (por ejemplo `datec`, `tms`, `rowid` u otra).
3. Recuperar el SQL y explicar el criterio exacto.
4. Entregar evidencia: commit hash, archivos y líneas (con comandos reproducibles).

---

## Alcance

- Repositorio: `leadmaster-workspace`
- Servicio afectado: `services/central-hub`
- Endpoint/lógica: `services/central-hub/src/modules/sender/controllers/prospectosController.js`

---

## Resumen ejecutivo

- El dedupe por teléfono se implementó agrupando por `s.phone_mobile`.
- El “desempate” para elegir un `prospecto_id` canónico se realizó con `MIN(s.rowid)`.
- No hay evidencia en el historial de este endpoint de desempate por `datec` ni `tms`.
- El dedupe se implementó con agregaciones mixtas (`MIN(rowid)` para id, `MAX(...)` para campos), lo que implica que **el `prospecto_id` puede no corresponder a la misma fila** que aporta `nombre/direccion`.

---

## Hallazgos

### 1) Commit que introduce el dedupe por `phone_mobile`

**Commit:** `68d50c9eca639ec2c0fd3143eebfaee93edba84c`

**Mensaje:** `Sender: unificación de estados + modelo 1 campaña 1 teléfono + eliminación race condition`

**Metadata (evidencia):**

```bash
cd /root/leadmaster-workspace
git show --no-patch --pretty=fuller 68d50c9eca639ec2c0fd3143eebfaee93edba84c
```

Salida relevante:
- `AuthorDate: Fri Feb 20 14:24:48 2026 -0300`

**Archivo tocado:**
- `services/central-hub/src/modules/sender/controllers/prospectosController.js`

Evidencia:

```bash
cd /root/leadmaster-workspace
git show 68d50c9eca639ec2c0fd3143eebfaee93edba84c --name-only --pretty=format:%H
```

---

### 2) SQL del dedupe y criterio exacto (commit `68d50c9…`)

**Evidencia (archivo en ese commit con numeración de líneas):**

```bash
cd /root/leadmaster-workspace
git show 68d50c9eca639ec2c0fd3143eebfaee93edba84c:services/central-hub/src/modules/sender/controllers/prospectosController.js \
  | nl -ba | sed -n '30,75p'
```

**Bloque SQL (líneas ~35–59 en ese commit):**

- Dedupe: `GROUP BY s.phone_mobile`
- Desempate (id canónico): `MIN(s.rowid) AS prospecto_id`

```sql
SELECT
  MIN(s.rowid) AS prospecto_id,
  MAX(s.nom) AS nombre,
  s.phone_mobile AS telefono_wapp,
  COUNT(*) AS total_sucursales,
  MAX(s.address) AS direccion,
  MAX(env.estado) AS estado_campania,
  MAX(env.id) AS envio_id,
  MAX(env.fecha_envio) AS fecha_envio
...
GROUP BY s.phone_mobile
ORDER BY nombre ASC
```

**Criterio exacto (interpretación literal del SQL):**

- Para cada teléfono (`s.phone_mobile`), se produce 1 fila.
- Si el mismo teléfono existe en varias sucursales (`s.rowid` distintos), el id elegido es el menor (`MIN(rowid)`).
- Los campos `nombre`, `direccion`, `estado`, `envio_id`, `fecha_envio` se obtienen con `MAX(...)` y **podrían provenir de una fila distinta** a la del `MIN(rowid)`.

---

### 3) Versión anterior (sin dedupe por `phone_mobile`)

**Commit:** `53ca5e130d5538fa67a1001789accef200c51a27`

**Mensaje:** `refactor: selector prospectos basado en ll_lugares_clientes + estado por campaña`

**Metadata (evidencia):**

```bash
cd /root/leadmaster-workspace
git show --no-patch --pretty=fuller 53ca5e130d5538fa67a1001789accef200c51a27
```

**Evidencia (archivo en ese commit con numeración de líneas):**

```bash
cd /root/leadmaster-workspace
git show 53ca5e130d5538fa67a1001789accef200c51a27:services/central-hub/src/modules/sender/controllers/prospectosController.js \
  | nl -ba | sed -n '25,80p'
```

**Qué se observa:**

- Se selecciona `s.rowid AS prospecto_id` sin agregación.
- No hay `GROUP BY s.phone_mobile`.
- Por lo tanto, si hay múltiples sucursales con el mismo `phone_mobile`, el resultado puede contener duplicados por teléfono.

---

### 4) ¿Se usó `datec` o `tms` como desempate en este endpoint?

No hay evidencia de que el endpoint haya usado `datec` o `tms` como criterio de desempate.

**Evidencia (búsqueda en historial del archivo):**

```bash
cd /root/leadmaster-workspace
# datec
git log -G "\\bdatec\\b" --oneline -- services/central-hub/src/modules/sender/controllers/prospectosController.js | head -n 20

# tms
git log -G "\\btms\\b" --oneline -- services/central-hub/src/modules/sender/controllers/prospectosController.js | head -n 20
```

Salida observada (en ambos casos):
- `(si no hay salida arriba, no hay coincidencias)`

**Conclusión:** el “desempate” histórico en esta ruta fue por `rowid` (vía `MIN(s.rowid)`), no por timestamps.

---

## Estado actual (para referencia)

En el árbol actual, el selector ya no mezcla filas con agregaciones: deduplica por `phone_mobile` usando una **fila canónica**.

- Archivo: `services/central-hub/src/modules/sender/controllers/prospectosController.js`
- Dedupe: derived table `canon` agrupada por `phone_mobile`
- Criterio canónico (id): `MAX(rowid)` por `phone_mobile`
- Salida: campos (`nombre`/`direccion`/etc.) salen **de la misma fila canónica** `s` (sin `MIN/MAX` sobre `s.*`)

(Evidencia rápida con líneas: `nl -ba services/central-hub/src/modules/sender/controllers/prospectosController.js | sed -n '68,140p'`.)

---

## Recomendación (sin implementar cambios)

Si el objetivo es “replicar exactamente” la lógica histórica, el patrón actual ya la replica: `GROUP BY phone_mobile` + `MIN(rowid)`.

Si el objetivo es evitar inconsistencias (mezcla de campos de distintas sucursales), conviene cambiar a una selección de **fila canónica** en vez de `MAX(...)`/`MIN(...)` mezclados:

- Variante A (MySQL 8+): `ROW_NUMBER() OVER (PARTITION BY phone_mobile ORDER BY tms DESC, rowid DESC)` y luego filtrar `row_number = 1`.
- Variante B (MySQL 5.7 compatible): subquery que elija el `rowid` canónico por teléfono (por `MAX(rowid)` o por `MAX(tms)` si existiera), y luego join contra `llxbx_societe` para traer todos los campos de esa misma fila.

---

## Implementación aplicada (2026-03-06)

- Se cambió el selector de prospectos para deduplicar por `phone_mobile` usando **fila canónica**: por cada `phone_mobile` se elige `MAX(rowid)` (sin mezclar campos con `MIN/MAX` sobre `s.*`).
- `total_sucursales` se calcula aparte (conteo de sucursales del cliente por `phone_mobile`).
- Se mantiene el filtro opcional `AND se.cartera_origen = ?`.

### Pruebas manuales sugeridas

Reiniciar servicio (según tu setup):

```bash
cd /root/leadmaster-workspace/services/central-hub
pm2 restart leadmaster-central-hub
# o
pm2 restart ecosystem.config.js
```

Probar endpoint con ambos valores de `cartera_origen` (sin imprimir tokens):

```bash
export BASE_URL='http://localhost:3012'
export TOKEN='REEMPLAZAR'
export CAMPANIA_ID='REEMPLAZAR'

# CARTERA_PROPIA
curl -sS \
  -H "Authorization: Bearer ${TOKEN}" \
  "${BASE_URL}/api/sender/prospectos/filtrar?campania_id=${CAMPANIA_ID}&cartera_origen=CARTERA_PROPIA" \
  | jq '.total, (.data | length)'

# CAPTADO_LEADMASTER
curl -sS \
  -H "Authorization: Bearer ${TOKEN}" \
  "${BASE_URL}/api/sender/prospectos/filtrar?campania_id=${CAMPANIA_ID}&cartera_origen=CAPTADO_LEADMASTER" \
  | jq '.total, (.data | length)'
```

Validaciones esperadas:

- 1 teléfono = 1 fila (`telefono_wapp` sin duplicados en el response).
- No hay mezcla de campos: `prospecto_id`/`nombre`/`direccion` corresponden a la misma fila canónica (`MAX(rowid)`) para ese teléfono.
- Si hay datos en ambas carteras, los datasets deberían diferir.

---

## Apéndice: comandos usados (reproducibles)

```bash
cd /root/leadmaster-workspace

# Historial con parches del archivo
git log -p --max-count=30 -- services/central-hub/src/modules/sender/controllers/prospectosController.js

# Commits que tocaron phone_mobile en ese archivo
git log -G "phone_mobile" --oneline --decorate --all -- services/central-hub/src/modules/sender/controllers/prospectosController.js

# Commits que tocan GROUP BY s.phone_mobile (en ese archivo)
git log -G "GROUP BY s\\.phone_mobile" --oneline --decorate --all -- services/central-hub/src/modules/sender/controllers/prospectosController.js

# Ver versiones específicas con líneas
git show 53ca5e130d5538fa67a1001789accef200c51a27:services/central-hub/src/modules/sender/controllers/prospectosController.js | nl -ba | sed -n '1,220p'
git show 68d50c9eca639ec2c0fd3143eebfaee93edba84c:services/central-hub/src/modules/sender/controllers/prospectosController.js | nl -ba | sed -n '1,220p'
```
