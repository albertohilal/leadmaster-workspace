# Propuesta: Endpoint /status Mejorado

## Objetivo

Reemplazar el endpoint `/health` simple por un endpoint `/status` más completo que exponga métricas clave del sistema para monitoreo y troubleshooting.

---

## Endpoint Propuesto

**URL:** `GET /status`  
**Auth:** No requiere autenticación (debe ser público para health checks)  
**Timeout:** Máximo 5 segundos (abort si DB/WhatsApp tardan más)

---

## Estructura de Respuesta

### Respuesta Exitosa (200 OK)

```json
{
  "status": "healthy",
  "service": "leadmaster-central-hub",
  "version": "1.0.0",
  "timestamp": "2026-01-05T10:30:00.000Z",
  "uptime": 3600,
  "environment": "production",
  
  "system": {
    "memory": {
      "used": 52428800,
      "total": 67108864,
      "usage_percent": 78.1,
      "warning": false
    },
    "cpu": {
      "usage_percent": 5.2
    }
  },
  
  "dependencies": {
    "database": {
      "status": "connected",
      "host": "sv46.byethost46.org",
      "latency_ms": 45,
      "error": null
    },
    "session_manager": {
      "status": "online",
      "url": "http://localhost:3001",
      "latency_ms": 12,
      "whatsapp_connected": true,
      "error": null
    }
  },
  
  "health_checks": [
    {
      "name": "database",
      "status": "pass",
      "duration_ms": 45
    },
    {
      "name": "session_manager",
      "status": "pass",
      "duration_ms": 12
    }
  ]
}
```

### Respuesta Degradada (200 OK con warnings)

```json
{
  "status": "degraded",
  "service": "leadmaster-central-hub",
  "version": "1.0.0",
  "timestamp": "2026-01-05T10:30:00.000Z",
  "uptime": 3600,
  "environment": "production",
  
  "system": {
    "memory": {
      "used": 283115520,
      "total": 314572800,
      "usage_percent": 90.0,
      "warning": true  // ⚠️ Cerca del límite max_memory_restart (300M)
    },
    "cpu": {
      "usage_percent": 75.3
    }
  },
  
  "dependencies": {
    "database": {
      "status": "connected",
      "host": "sv46.byethost46.org",
      "latency_ms": 45,
      "error": null
    },
    "session_manager": {
      "status": "unreachable",  // ⚠️ Session Manager caído
      "url": "http://localhost:3001",
      "latency_ms": null,
      "whatsapp_connected": false,
      "error": "ECONNREFUSED"
    }
  },
  
  "health_checks": [
    {
      "name": "database",
      "status": "pass",
      "duration_ms": 45
    },
    {
      "name": "session_manager",
      "status": "fail",
      "duration_ms": 5000,
      "error": "Connection timeout"
    }
  ]
}
```

### Respuesta Error (503 Service Unavailable)

Cuando componentes críticos (DB) fallan:

```json
{
  "status": "unhealthy",
  "service": "leadmaster-central-hub",
  "version": "1.0.0",
  "timestamp": "2026-01-05T10:30:00.000Z",
  "uptime": 3600,
  "environment": "production",
  
  "system": {
    "memory": {
      "used": 52428800,
      "total": 67108864,
      "usage_percent": 78.1,
      "warning": false
    },
    "cpu": {
      "usage_percent": 5.2
    }
  },
  
  "dependencies": {
    "database": {
      "status": "disconnected",  // ❌ DB crítica caída
      "host": "sv46.byethost46.org",
      "latency_ms": null,
      "error": "ETIMEDOUT: Connection timed out"
    },
    "session_manager": {
      "status": "online",
      "url": "http://localhost:3001",
      "latency_ms": 12,
      "whatsapp_connected": true,
      "error": null
    }
  },
  
  "health_checks": [
    {
      "name": "database",
      "status": "fail",
      "duration_ms": 5000,
      "error": "Connection timeout"
    },
    {
      "name": "session_manager",
      "status": "pass",
      "duration_ms": 12
    }
  ]
}
```

---

## Lógica de Estados

### Estado `healthy` (200 OK)

**Condiciones:**
- ✅ DB responde en < 1 segundo
- ✅ Session Manager responde (o es opcional)
- ✅ Memoria < 80% del límite max_memory_restart
- ✅ CPU < 80%

### Estado `degraded` (200 OK)

**Condiciones:**
- ✅ DB responde (aunque lento)
- ⚠️ Session Manager no responde (servicio no crítico)
- ⚠️ Memoria entre 80-95% del límite
- ⚠️ CPU entre 80-95%

**Acción:** Loguea warning, pero sigue operativo

### Estado `unhealthy` (503 Service Unavailable)

**Condiciones:**
- ❌ DB no responde o timeout > 5 segundos
- ❌ Memoria > 95% del límite
- ❌ CPU > 95%

**Acción:** Retorna 503, load balancer debe remover del pool

---

## Implementación Propuesta

### Ubicación

**Archivo:** `src/routes/statusRoute.js` (nuevo)  
**Controlador:** `src/controllers/statusController.js` (nuevo)  
**Service:** `src/services/healthCheckService.js` (nuevo)

### Estructura de Archivos

```
src/
├── routes/
│   └── statusRoute.js          // GET /status
├── controllers/
│   └── statusController.js     // Orquesta health checks
└── services/
    └── healthCheckService.js   // Lógica de checks con timeout
```

---

## Pseudocódigo de Implementación

### healthCheckService.js

```javascript
const pool = require('../config/db');
const { sessionManagerClient } = require('../integrations/sessionManager');

// Timeout para cada check individual
const CHECK_TIMEOUT = 5000; // 5 segundos

async function checkDatabase() {
  const start = Date.now();
  try {
    // Simple SELECT 1 para verificar conectividad
    const [result] = await Promise.race([
      pool.query('SELECT 1 as ping'),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database timeout')), CHECK_TIMEOUT)
      )
    ]);
    
    const duration = Date.now() - start;
    
    return {
      status: 'connected',
      host: process.env.DB_HOST,
      latency_ms: duration,
      error: null
    };
  } catch (error) {
    return {
      status: 'disconnected',
      host: process.env.DB_HOST,
      latency_ms: null,
      error: error.message
    };
  }
}

async function checkSessionManager() {
  const start = Date.now();
  try {
    // Llamar a /health de Session Manager
    const health = await Promise.race([
      sessionManagerClient.getHealth(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Session Manager timeout')), CHECK_TIMEOUT)
      )
    ]);
    
    const duration = Date.now() - start;
    
    return {
      status: 'online',
      url: process.env.SESSION_MANAGER_BASE_URL,
      latency_ms: duration,
      whatsapp_connected: health.whatsapp_ready || false,
      error: null
    };
  } catch (error) {
    return {
      status: 'unreachable',
      url: process.env.SESSION_MANAGER_BASE_URL,
      latency_ms: null,
      whatsapp_connected: false,
      error: error.message
    };
  }
}

function getSystemMetrics() {
  const memUsed = process.memoryUsage().heapUsed;
  const memTotal = process.memoryUsage().heapTotal;
  const usagePercent = (memUsed / memTotal) * 100;
  
  // max_memory_restart está en 300M = 314572800 bytes
  const maxMemory = 314572800;
  const memWarning = memUsed > (maxMemory * 0.8);
  
  return {
    memory: {
      used: memUsed,
      total: memTotal,
      usage_percent: parseFloat(usagePercent.toFixed(1)),
      warning: memWarning
    },
    cpu: {
      usage_percent: process.cpuUsage().user / 10000 // Aproximado
    }
  };
}

async function performHealthChecks() {
  // Ejecutar checks en paralelo
  const [dbCheck, smCheck] = await Promise.all([
    checkDatabase(),
    checkSessionManager()
  ]);
  
  const systemMetrics = getSystemMetrics();
  
  // Determinar estado general
  let overallStatus = 'healthy';
  let httpStatus = 200;
  
  // DB es crítica
  if (dbCheck.status !== 'connected') {
    overallStatus = 'unhealthy';
    httpStatus = 503;
  }
  // Memoria crítica
  else if (systemMetrics.memory.usage_percent > 95) {
    overallStatus = 'unhealthy';
    httpStatus = 503;
  }
  // Session Manager no es crítica, pero degrada el servicio
  else if (smCheck.status !== 'online' || systemMetrics.memory.warning) {
    overallStatus = 'degraded';
  }
  
  return {
    httpStatus,
    body: {
      status: overallStatus,
      service: 'leadmaster-central-hub',
      version: process.env.npm_package_version || '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV || 'development',
      
      system: systemMetrics,
      
      dependencies: {
        database: dbCheck,
        session_manager: smCheck
      },
      
      health_checks: [
        {
          name: 'database',
          status: dbCheck.status === 'connected' ? 'pass' : 'fail',
          duration_ms: dbCheck.latency_ms,
          error: dbCheck.error
        },
        {
          name: 'session_manager',
          status: smCheck.status === 'online' ? 'pass' : 'fail',
          duration_ms: smCheck.latency_ms,
          error: smCheck.error
        }
      ]
    }
  };
}

module.exports = {
  performHealthChecks,
  checkDatabase,
  checkSessionManager,
  getSystemMetrics
};
```

### statusController.js

```javascript
const healthCheckService = require('../services/healthCheckService');

async function getStatus(req, res) {
  try {
    const { httpStatus, body } = await healthCheckService.performHealthChecks();
    
    // Loguear si está degradado o unhealthy
    if (body.status !== 'healthy') {
      console.warn('⚠️ Sistema en estado:', body.status);
      console.warn('Detalles:', JSON.stringify(body.dependencies, null, 2));
    }
    
    res.status(httpStatus).json(body);
  } catch (error) {
    console.error('❌ Error en /status:', error);
    
    // Fallback: retornar 503 con info mínima
    res.status(503).json({
      status: 'error',
      service: 'leadmaster-central-hub',
      timestamp: new Date().toISOString(),
      error: 'Failed to perform health checks'
    });
  }
}

module.exports = {
  getStatus
};
```

### statusRoute.js

```javascript
const express = require('express');
const router = express.Router();
const statusController = require('../controllers/statusController');

router.get('/', statusController.getStatus);

module.exports = router;
```

### Integrar en src/index.js

```javascript
// Después de /health
const statusRoute = require('./routes/statusRoute');
app.use('/status', statusRoute);
```

---

## Casos de Uso

### 1. Load Balancer Health Check

**Configuración Nginx:**
```nginx
upstream leadmaster_backend {
    server localhost:3012 max_fails=3 fail_timeout=30s;
    
    # Health check
    # Si /status retorna 503, Nginx removerá del pool
}
```

**Kubernetes/Docker:**
```yaml
livenessProbe:
  httpGet:
    path: /status
    port: 3012
  initialDelaySeconds: 30
  periodSeconds: 10
  failureThreshold: 3
```

### 2. Monitoreo Externo

**Datadog/New Relic/Prometheus:**
- Scrape `/status` cada 30 segundos
- Alertar si `status != "healthy"` por > 2 minutos
- Métricas:
  - `leadmaster.memory.usage_percent`
  - `leadmaster.db.latency_ms`
  - `leadmaster.session_manager.status`

### 3. Troubleshooting Manual

```bash
# Dev/Ops puede ejecutar:
curl -s http://localhost:3012/status | jq .

# Ver solo dependencias
curl -s http://localhost:3012/status | jq .dependencies

# Ver solo checks que fallaron
curl -s http://localhost:3012/status | jq '.health_checks[] | select(.status == "fail")'
```

---

## Ventajas sobre /health Actual

| Aspecto | /health Actual | /status Propuesto |
|---------|----------------|-------------------|
| Info | Timestamp + "healthy" | Métricas completas |
| Dependencias | No verifica | Verifica DB + Session Manager |
| Memoria | No expone | Expone uso y warning |
| Uptime | No | Sí (process.uptime()) |
| Latencia | No | Sí (DB y SM latency) |
| Estados | Solo "healthy" | healthy/degraded/unhealthy |
| Timeout | No | 5 segundos max por check |
| Debugging | Imposible | Fácil (ver qué falló) |

---

## Compatibilidad con /health

**Mantener ambos endpoints:**

- `/health` → Simple check (backward compatibility)
- `/status` → Check completo (nuevo estándar)

**Recomendación:**
- Load balancers → `/health` (rápido, sin timeouts largos)
- Monitoreo → `/status` (completo, métricas ricas)
- Frontend → Puede consultar `/status` para mostrar estado del sistema

---

## Testing

### Unit Tests

```javascript
describe('healthCheckService', () => {
  it('should return healthy when all checks pass', async () => {
    const result = await performHealthChecks();
    expect(result.body.status).toBe('healthy');
    expect(result.httpStatus).toBe(200);
  });
  
  it('should return unhealthy when DB fails', async () => {
    // Mock pool.query to throw error
    const result = await performHealthChecks();
    expect(result.body.status).toBe('unhealthy');
    expect(result.httpStatus).toBe(503);
  });
  
  it('should return degraded when Session Manager fails', async () => {
    // Mock sessionManagerClient to fail
    const result = await performHealthChecks();
    expect(result.body.status).toBe('degraded');
    expect(result.httpStatus).toBe(200);
  });
});
```

### E2E Tests

```javascript
test('GET /status returns 200 when system is healthy', async () => {
  const response = await fetch('http://localhost:3012/status');
  expect(response.status).toBe(200);
  
  const json = await response.json();
  expect(json.status).toBe('healthy');
  expect(json.dependencies.database.status).toBe('connected');
});
```

---

## Consideraciones de Seguridad

### ✅ Seguro para Exponer

- Versión (pública)
- Uptime (no sensible)
- Estado de dependencias (nombres genéricos)
- Latencia (no sensible)

### ⚠️ NO Exponer

- ❌ DB username/password
- ❌ IPs internas completas (usar hostnames genéricos)
- ❌ Stack traces detallados
- ❌ Versiones de librerías (puede ayudar a atacantes)

**Implementación actual es segura:**
```json
"database": {
  "host": "sv46.byethost46.org"  // ✅ OK, es hostname público
}
```

---

## Próximos Pasos

1. **NO implementar aún** (según instrucciones)
2. Revisar propuesta con equipo
3. Decidir si /health es suficiente o /status agrega valor
4. Si se aprueba, crear issue en GitHub
5. Implementar en rama feature/status-endpoint
6. Tests unitarios + E2E
7. Merge a main

---

## Estimación de Esfuerzo

- **Implementación:** 2-3 horas
- **Tests:** 1-2 horas
- **Documentación:** 30 minutos
- **Total:** ~4-6 horas

---

**Fin de la propuesta**
