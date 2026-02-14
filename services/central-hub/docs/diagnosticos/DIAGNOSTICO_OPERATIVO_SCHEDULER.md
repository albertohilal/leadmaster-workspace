# Diagnóstico Operativo: Envío de Campañas

## Objetivo

Logging estructurado para **verificar en producción** el comportamiento del scheduler de campañas, sin modificar la lógica de negocio.

---

## Activación

### En Contabo VPS (PM2)

```bash
# 1. Activar diagnóstico
export DIAG_SENDER=1

# 2. Reiniciar PM2 con la variable
pm2 restart central-hub --update-env

# 3. Ver logs en tiempo real
pm2 logs central-hub --lines 100 | grep DIAG_SENDER
```

### Desactivación

```bash
# 1. Desactivar
unset DIAG_SENDER

# 2. Reiniciar PM2
pm2 restart central-hub --update-env
```

---

## Logs Generados

### 1. Inicio de Procesamiento
```json
[DIAG_SENDER] 🚀 INICIO {
  "programacion_id": 123,
  "campania_id": 456,
  "cupo_diario": 50
}
```

### 2. Cupo Diario
```json
[DIAG_SENDER] 📊 CUPO DIARIO {
  "programacion_id": 123,
  "cupo_total": 50,
  "enviados_hoy": 12,
  "disponible": 38
}
```

### 3. Pendientes Obtenidos
```json
[DIAG_SENDER] 📥 PENDIENTES OBTENIDOS {
  "programacion_id": 123,
  "campania_id": 456,
  "limite_solicitado": 38,
  "pendientes_encontrados": 25,
  "ids": [4821, 4822, 4823, ...]
}
```

### 4. Cada Envío (Individual)
```json
[DIAG_SENDER] 📤 ENVIANDO {
  "envio_id": 4821,
  "telefono": "5491112345678@c.us",
  "cliente_id": 1
}

[DIAG_SENDER] ✅ ENVIADO {
  "envio_id": 4821,
  "telefono": "5491112345678@c.us"
}
```

### 5. Errores
```json
[DIAG_SENDER] ❌ ERROR sendMessage {
  "envio_id": 4822,
  "error": "Connection timeout",
  "telefono": "5491187654321@c.us"
}
```

### 6. Resumen Final
```json
[DIAG_SENDER] 🏁 RESUMEN FINAL {
  "programacion_id": 123,
  "campania_id": 456,
  "pendientes_procesados": 25,
  "enviados_exitosos": 24,
  "enviados_fallidos": 1
}
```

### 7. Abortos Anticipados

#### WhatsApp no READY
```json
[DIAG_SENDER] ⛔ ABORT: WhatsApp no READY {
  "programacion_id": 123,
  "status": "DISCONNECTED",
  "connected": false
}
```

#### Campaña no habilitada
```json
[DIAG_SENDER] ⛔ ABORT: Campaña no habilitada {
  "programacion_id": 123,
  "campania_id": 456,
  "estado": "pausada"
}
```

#### Cupo agotado
```json
[DIAG_SENDER] ⛔ ABORT: Cupo agotado {
  "programacion_id": 123,
  "cupo_diario": 50,
  "enviados_hoy": 50
}
```

#### Sin pendientes
```json
[DIAG_SENDER] ⛔ ABORT: Sin pendientes {
  "programacion_id": 123,
  "campania_id": 456
}
```

---

## Escenarios de Uso

### 1. Verificar que mensajes se marcan como enviados

**Pregunta:** ¿Los registros cambian de estado correctamente?

**Comando:**
```bash
pm2 logs central-hub | grep -A 2 "ENVIADO\|RESUMEN FINAL"
```

**Validación:**
- Cada `✅ ENVIADO` debe corresponder a un registro actualizado en DB
- `enviados_exitosos` en resumen debe coincidir con registros actualizados

### 2. Detectar cortes prematuros

**Pregunta:** ¿Por qué se detiene el envío antes del cupo?

**Comando:**
```bash
pm2 logs central-hub | grep "DIAG_SENDER.*ERROR\|ABORT"
```

**Posibles causas:**
- `ERROR sendMessage` → Session Manager falló
- `ABORT: WhatsApp no READY` → Conexión perdida
- `ABORT: Cupo agotado` → Límite alcanzado

### 3. Verificar respeto del cupo diario

**Pregunta:** ¿Se respeta el límite configurado?

**Comando:**
```bash
pm2 logs central-hub | grep "CUPO DIARIO\|RESUMEN FINAL"
```

**Validación:**
```
CUPO DIARIO: disponible = 50
RESUMEN FINAL: enviados_exitosos = 50  ✅ OK

CUPO DIARIO: disponible = 10
RESUMEN FINAL: enviados_exitosos = 10  ✅ OK

CUPO DIARIO: disponible = 10
RESUMEN FINAL: enviados_exitosos = 3   ❌ Revisar (error o sin pendientes)
```

### 4. Correlacionar envío con ID de registro

**Pregunta:** ¿Qué pasó con el envío ID 4822?

**Comando:**
```bash
pm2 logs central-hub | grep "envio_id.*4822"
```

**Respuesta esperada:**
```
[DIAG_SENDER] 📤 ENVIANDO { "envio_id": 4822, ... }
[DIAG_SENDER] ✅ ENVIADO { "envio_id": 4822, ... }
```

O si falló:
```
[DIAG_SENDER] 📤 ENVIANDO { "envio_id": 4822, ... }
[DIAG_SENDER] ❌ ERROR sendMessage { "envio_id": 4822, "error": "..." }
```

---

## Validación con Base de Datos

### Confirmar estado de registros

```sql
-- Ver registros procesados hoy
SELECT 
  id,
  telefono_wapp,
  estado,
  fecha_envio
FROM ll_envios_whatsapp
WHERE campania_id = 456
  AND DATE(fecha_envio) = CURDATE()
ORDER BY id DESC;

-- Contar por estado
SELECT estado, COUNT(*) as total
FROM ll_envios_whatsapp
WHERE campania_id = 456
GROUP BY estado;
```

### Comparar logs con DB

**Caso ideal:**
```
LOG: enviados_exitosos = 25
DB:  COUNT(estado='enviado' AND fecha_envio=today) = 25  ✅ COINCIDE
```

**Caso anómalo:**
```
LOG: enviados_exitosos = 25
DB:  COUNT(estado='enviado' AND fecha_envio=today) = 20  ❌ REVISAR
```

---

## Impacto en Rendimiento

✅ **Sin DIAG_SENDER:** Cero overhead (condicionales con early return)  
⚠️ **Con DIAG_SENDER:** Overhead mínimo (<1% CPU), solo `console.log` + `JSON.stringify`

**Recomendación:** Activar solo durante diagnóstico, desactivar en operación normal.

---

## Diferencias con Tests de Integración

| Aspecto | Tests (`campaign-send.integration.test.js`) | Diagnóstico Operativo |
|---------|---------------------------------------------|------------------------|
| **Entorno** | Test DB + Stub | Producción real + WhatsApp real |
| **Objetivo** | Validar lógica | Observar comportamiento |
| **Activación** | `npm test` | `export DIAG_SENDER=1` |
| **Modificaciones** | Mock del Session Manager | Sin mocks |
| **Datos** | IDs >= 9000 (test) | IDs reales de producción |
| **Frecuencia** | Pre-deploy | Solo cuando se necesita diagnosticar |

---

## Troubleshooting

### No aparecen logs DIAG_SENDER

**Causa:** Variable no configurada o PM2 no reiniciado

**Solución:**
```bash
# Verificar que la variable está activa
pm2 env 0 | grep DIAG_SENDER

# Si no aparece, configurar en ecosystem.config.js:
module.exports = {
  apps: [{
    name: 'central-hub',
    env: {
      DIAG_SENDER: '1'  // ← Agregar aquí
    }
  }]
}

pm2 restart central-hub
```

### Logs demasiado verbosos

**Causa:** DIAG_SENDER activado permanentemente

**Solución:** Usar solo durante diagnóstico puntual (minutos/horas), no días

### Logs no coinciden con DB

**Posibles causas:**
1. **Race condition:** Múltiples instancias PM2 ejecutando el scheduler
2. **Rollback no loggeado:** Error después de marcar como enviado (lógica no contemplada actualmente)
3. **Delay en replicación:** DB slave con lag

**Verificación:**
```bash
# Ver cuántas instancias corren
pm2 list | grep central-hub

# Debe ser 1 sola instancia (no cluster mode para el scheduler)
```

---

## Ejemplo Real: Sesión de Diagnóstico

```bash
# 1. Activar
export DIAG_SENDER=1
pm2 restart central-hub --update-env

# 2. Observar por 5 minutos
pm2 logs central-hub --lines 200 | grep DIAG_SENDER > diagnostico_20260121.log

# 3. Analizar
cat diagnostico_20260121.log | grep "RESUMEN FINAL"

# 4. Desactivar
unset DIAG_SENDER
pm2 restart central-hub --update-env
```

**Output esperado:**
```
[DIAG_SENDER] 🚀 INICIO {"programacion_id":123,...}
[DIAG_SENDER] 📊 CUPO DIARIO {"disponible":50,...}
[DIAG_SENDER] 📥 PENDIENTES OBTENIDOS {"pendientes_encontrados":50,...}
[DIAG_SENDER] 📤 ENVIANDO {"envio_id":4821,...}
[DIAG_SENDER] ✅ ENVIADO {"envio_id":4821,...}
...
[DIAG_SENDER] 🏁 RESUMEN FINAL {"enviados_exitosos":50,"enviados_fallidos":0}
```

---

**Fecha:** 2026-01-21  
**Versión:** 1.0.0  
**Mantenedor:** Equipo Backend
