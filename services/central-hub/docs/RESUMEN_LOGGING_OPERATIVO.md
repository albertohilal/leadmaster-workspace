# Resumen: Logging Operativo Agregado

## ✅ Cambios Realizados

### 1. Archivo modificado: `src/modules/sender/services/programacionScheduler.js`

**Agregado:**
- Helper `diagLog()` que solo ejecuta si `DIAG_SENDER=1`
- 8 puntos de logging estratégicos:
  - 🚀 Inicio de procesamiento
  - 📊 Cupo diario (total/usado/disponible)
  - 📥 Pendientes obtenidos de DB
  - 📤 Antes de cada `sendMessage`
  - ✅ Confirmación de envío exitoso
  - ❌ Error en `sendMessage`
  - 🏁 Resumen final (éxitos/fallos)
  - ⛔ Abortos (WhatsApp no READY, cupo agotado, etc.)

**Líneas agregadas:** ~80 líneas (incluyendo logs condicionales)

**Impacto:**
- ✅ Cero overhead cuando `DIAG_SENDER` no está activo
- ✅ Tests de integración siguen pasando 6/6
- ✅ Sin modificaciones a lógica de negocio

---

### 2. Documentación creada: `docs/DIAGNOSTICO_OPERATIVO_SCHEDULER.md`

**Contenido:**
- Instrucciones de activación/desactivación en PM2
- Catálogo completo de logs generados
- Escenarios de uso (verificar cupo, detectar cortes, correlacionar IDs)
- Comandos de troubleshooting
- Validación cruzada con base de datos
- Diferencias con tests de integración

---

### 3. Script de captura: `scripts/diag-sender-capture.sh`

**Funcionalidad:**
- Activa `DIAG_SENDER=1`
- Captura logs por 2 minutos
- Desactiva `DIAG_SENDER`
- Genera resumen automático (resúmenes finales, errores encontrados)
- Guarda en `/tmp/diag_sender_TIMESTAMP.log`

**Uso:**
```bash
chmod +x scripts/diag-sender-capture.sh
./scripts/diag-sender-capture.sh
```

---

## 🎯 Uso en Producción (Contabo)

### Activación Manual

```bash
# Terminal 1: Activar y reiniciar
export DIAG_SENDER=1
pm2 restart central-hub --update-env

# Terminal 2: Ver logs en tiempo real
pm2 logs central-hub | grep DIAG_SENDER

# Cuando termines: Desactivar
unset DIAG_SENDER
pm2 restart central-hub --update-env
```

### Captura Automática (Recomendado)

```bash
./scripts/diag-sender-capture.sh
cat /tmp/diag_sender_*.log | jq .
```

---

## 📊 Ejemplo de Output

```json
[DIAG_SENDER] 🚀 INICIO {
  "programacion_id": 123,
  "campania_id": 456,
  "cupo_diario": 50
}

[DIAG_SENDER] 📊 CUPO DIARIO {
  "cupo_total": 50,
  "enviados_hoy": 12,
  "disponible": 38
}

[DIAG_SENDER] 📥 PENDIENTES OBTENIDOS {
  "pendientes_encontrados": 25,
  "ids": [4821, 4822, 4823, ...]
}

[DIAG_SENDER] 📤 ENVIANDO { "envio_id": 4821, "telefono": "549..." }
[DIAG_SENDER] ✅ ENVIADO { "envio_id": 4821 }

[DIAG_SENDER] 🏁 RESUMEN FINAL {
  "pendientes_procesados": 25,
  "enviados_exitosos": 25,
  "enviados_fallidos": 0
}
```

---

## ✅ Validación

### Tests de Integración
```bash
npm test -- tests/campaign-send.integration.test.js
```

**Resultado:** 6/6 tests PASS ✅

---

## 🔍 Casos de Uso

### 1. Verificar que registros cambian de estado
```bash
pm2 logs central-hub | grep "ENVIADO\|RESUMEN FINAL"
```

### 2. Detectar por qué se detiene antes del cupo
```bash
pm2 logs central-hub | grep "ABORT\|ERROR"
```

### 3. Rastrear envío específico (ej: ID 4822)
```bash
pm2 logs central-hub | grep "envio_id.*4822"
```

### 4. Validar con DB
```sql
SELECT COUNT(*) FROM ll_envios_whatsapp 
WHERE campania_id = 456 
  AND estado = 'enviado' 
  AND DATE(fecha_envio) = CURDATE();
```

Comparar con: `enviados_exitosos` del log

---

## 🎓 Próximos Pasos Sugeridos

1. **Ejecutar en producción** durante 1 ciclo de envío
2. **Comparar logs con DB** para confirmar coincidencia
3. **Desactivar** después del diagnóstico
4. **Repetir** solo cuando se sospeche un problema

---

**Fecha:** 2026-01-21  
**Autor:** Equipo Backend  
**Estado:** ✅ Listo para producción
