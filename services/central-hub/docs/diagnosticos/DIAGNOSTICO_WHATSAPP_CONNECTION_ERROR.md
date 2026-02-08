# Diagnóstico: Error de Conexión WhatsApp

**Fecha:** 2026-01-14  
**Componente:** Session Manager / Frontend WhatsApp Integration  
**Severidad:** Alta - Frontend no puede conectar con session-manager

---

## 1. Síntomas Observados

- El frontend muestra "Error en la sesión" en la interfaz de WhatsApp
- Estado mostrado cambia entre "Conectando..." y "Error"
- El usuario no puede ver el código QR ni gestionar la sesión de WhatsApp
- La aplicación no puede enviar mensajes de WhatsApp

---

## 2. Análisis Realizado

### 2.1 Estado del Proceso session-manager

```bash
pm2 status
```

**Resultado:**
- ✅ session-manager está **ONLINE** (proceso PM2 id: 4)
- ✅ Uptime: 16+ horas
- ✅ Memoria: 88.1mb (normal)
- ✅ Restarts: 2 (aceptable)

### 2.2 Verificación del Puerto

```bash
netstat -tulpn | grep node
```

**Resultado:**
- session-manager escucha en puerto **3011**
- central-hub escucha en puerto **3012**

**PROBLEMA IDENTIFICADO:** El frontend está intentando conectar al puerto **3001**, pero session-manager está escuchando en el puerto **3011**.

### 2.3 Estado de las Sesiones WhatsApp

**Cliente 1:**
```json
{
  "cliente_id": 1,
  "connected": false,
  "state": "INITIALIZING",
  "can_send_messages": false,
  "recommended_action": "Initializing for first time - wait"
}
```

**Cliente 51:**
```json
{
  "cliente_id": 51,
  "connected": false,
  "state": "INITIALIZING",
  "can_send_messages": false,
  "recommended_action": "Initializing for first time - wait"
}
```

**Conclusión:** Hay 2 sesiones almacenadas en disco pero ninguna está conectada activamente a WhatsApp.

### 2.4 Verificación de Logs

```bash
pm2 logs session-manager --lines 50
```

**Observaciones:**
- El servidor está levantado correctamente en puerto 3011
- Recibe múltiples requests GET /status cada 5 segundos (desde central-hub)
- NO hay errores de ejecución
- Los procesos de Chromium/Puppeteer están activos (para cliente_1 y cliente_51)

---

## 3. Causa Raíz

**Desincronización de configuración de puertos:**

El frontend (y posiblemente central-hub) tiene configurado el puerto **3001** para conectar con session-manager, pero el servicio está levantado en el puerto **3011**.

Esta discrepancia causa:
1. ❌ Connection refused cuando el frontend intenta `http://localhost:3001`
2. ❌ El frontend no puede obtener el estado de WhatsApp
3. ❌ El frontend no puede solicitar el código QR
4. ❌ No se pueden enviar mensajes

---

## 4. Archivos de Configuración Afectados

### Posibles ubicaciones del problema:

1. **Frontend:** 
   - `/root/leadmaster-workspace/services/central-hub/frontend/src/config/api.js`
   - Variables de entorno del frontend
   - Configuración de proxy en desarrollo

2. **Backend (central-hub):**
   - Variables de entorno en PM2
   - Archivo `.env` en central-hub
   - Configuración de proxy reverso a session-manager

3. **Session Manager:**
   - Variables de entorno en PM2
   - El código lee `process.env.PORT || 3001` pero PM2 está pasando PORT=3011

---

## 5. Solución Propuesta

### Opción A: Cambiar session-manager al puerto 3001 (RECOMENDADO)

**Ventajas:**
- Menos cambios en el código
- El frontend ya espera este puerto
- Probablemente documentado así

**Pasos:**

1. Actualizar la configuración de PM2 para session-manager:
```bash
pm2 stop session-manager
pm2 delete session-manager
```

2. Editar el archivo de configuración de PM2 o variables de entorno para establecer `PORT=3001`

3. Reiniciar session-manager:
```bash
pm2 start session-manager --update-env
```

4. Verificar:
```bash
curl http://localhost:3001/health
```

### Opción B: Actualizar el frontend para usar puerto 3011

**Ventajas:**
- No requiere reiniciar session-manager
- Mantiene la configuración actual del servidor

**Pasos:**

1. Localizar la configuración de API en el frontend
2. Cambiar todas las referencias de puerto 3001 a 3011
3. Reconstruir el frontend
4. Reiniciar central-hub

---

## 6. Próximos Pasos Después de la Corrección

Una vez corregido el puerto, será necesario:

1. **Reconectar las sesiones de WhatsApp:**
   - Ambas sesiones (cliente 1 y 51) están en estado INITIALIZING
   - Necesitarán escanear el código QR nuevamente
   - Acceder a `/whatsapp` en el frontend
   - Solicitar el código QR
   - Escanear con WhatsApp móvil

2. **Verificar la persistencia:**
   - Confirmar que las sesiones se mantienen después de reiniciar
   - Verificar que los tokens se guardan correctamente en `/sessions/cliente_X/`

3. **Monitoreo:**
   - Revisar logs de session-manager periódicamente
   - Verificar estado de conexión cada hora

---

## 7. Prevención

Para evitar este problema en el futuro:

1. **Centralizar configuración de puertos:**
   - Usar variables de entorno desde un archivo `.env` compartido
   - Documentar en README.md los puertos de cada servicio

2. **Health checks:**
   - Implementar health checks que validen la conectividad entre servicios
   - Alertas cuando un servicio no responde en el puerto esperado

3. **Documentación:**
   - Mantener actualizado el diagrama de arquitectura con puertos
   - Agregar sección en README sobre configuración de puertos

---

## 8. Comandos Útiles para Diagnóstico

```bash
# Ver estado de todos los procesos
pm2 status

# Ver qué puertos está usando Node
netstat -tulpn | grep node

# Ver logs en tiempo real
pm2 logs session-manager --lines 100

# Verificar health de session-manager
curl http://localhost:3011/health

# Verificar estado de WhatsApp (cliente 1)
curl -H "X-Cliente-Id: 1" http://localhost:3011/status

# Verificar variables de entorno de un proceso PM2
pm2 env 4  # donde 4 es el id del proceso

# Describir proceso completo
pm2 describe session-manager
```

---

## Conclusión

El session-manager está funcionando correctamente en el puerto 3011, pero hay un desajuste de configuración que impide que el frontend se conecte. Se recomienda la **Opción A** (cambiar session-manager al puerto 3001) para minimizar cambios y mantener consistencia con la configuración esperada del frontend.
