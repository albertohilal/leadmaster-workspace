# Test de Integración: Envío de Campaña

## Descripción

Test de integración completo que verifica el flujo de envío de campañas WhatsApp **sin dependencia de WhatsApp real**. Usa un Session Manager stub para simular respuestas y base de datos real para verificar cambios de estado.

## Estructura de Archivos

```
tests/
├── campaign-send.integration.test.js    # Test principal
├── helpers/
│   └── dbTestHelpers.js                  # Funciones setup/teardown DB
└── stubs/
    └── sessionManagerStub.js             # Mock del Session Manager
```

## ⚙️ Preparación: Ajuste de Exports

**IMPORTANTE:** Antes de ejecutar los tests, se realizó un ajuste en el archivo fuente para exponer funciones internas:

**Archivo modificado:** `src/modules/sender/services/programacionScheduler.js`

**Cambio:**
```javascript
// ANTES
module.exports = { start };

// DESPUÉS
module.exports = {
  start,
  __test__: {
    procesarProgramacion,
    marcarEnviado,
    obtenerPendientes
  }
};
```

**Garantías:**
- ✅ Comportamiento en producción **NO cambia** (solo usa `start()`)
- ✅ Patrón `__test__` es convención estándar para testing
- ✅ Sin side-effects ni dependencias adicionales
- ✅ Código de producción NO debe acceder a `__test__`

Ver documentación completa en: [`docs/AJUSTE_EXPORTS_TESTING.md`](../docs/AJUSTE_EXPORTS_TESTING.md)

---

## Componentes

### 1. Session Manager Stub (`tests/stubs/sessionManagerStub.js`)

Mock completo del `sessionManagerClient` con:

- **Métodos principales:**
  - `getStatus()` → retorna estado configurable (READY, DISCONNECTED, etc.)
  - `sendMessage()` → simula envío exitoso o error programado
  
- **Configuración:**
  ```javascript
  stub.setStatusResponse({ status: 'READY', connected: true });
  stub.setSendMessageBehavior('success'); // o 'error', 'timeout'
  ```

- **Rastreo de llamadas:**
  ```javascript
  stub.calls.sendMessage // Array de todas las llamadas
  stub.messagesSent      // Contador de mensajes enviados
  stub.getMessagesSentTo(to) // Mensajes a destinatario específico
  ```

### 2. Database Test Helpers (`tests/helpers/dbTestHelpers.js`)

Funciones para gestión de datos de prueba:

**Setup:**
- `createTestCampaign()` → Crea campaña de prueba (ID >= 9000)
- `createTestProgramacion()` → Crea programación activa
- `createTestEnvios()` → Inserta N registros pendientes

**Consultas:**
- `countEnviosByEstado()` → Conteo por estado (pendiente/enviado/error)
- `getEnvioById()` → Obtiene registro específico
- `isEnvioMarcadoComoEnviado()` → Verifica estado + fecha_envio

**Teardown:**
- `cleanupTestData()` → Elimina todos los registros de test

### 3. Test Suite (`tests/campaign-send.integration.test.js`)

6 casos de prueba:

1. **Envío exitoso marca registros:** Verifica transición `pendiente` → `enviado`
2. **Respeto del cupo diario:** Límite de mensajes por día
3. **Error en sendMessage NO marca registro:** Rollback ante fallo
4. **WhatsApp no READY aborta envíos:** Validación pre-vuelo
5. **Campaña pausada no procesa:** Control de estado de campaña
6. **Contador diario correcto:** Incremento exacto de envíos

## Ejecución

### Requisitos Previos

1. Base de datos MySQL accesible
2. Variables de entorno configuradas (`.env`):
   ```env
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=yourpassword
   DB_NAME=leadmaster_test
   DB_PORT=3306
   ```

### Ejecutar Tests

```bash
# Todos los tests de integración
npm test -- tests/campaign-send.integration.test.js

# Test específico
npm test -- tests/campaign-send.integration.test.js -t "debe marcar registros como enviados"

# Con verbose
npm test -- tests/campaign-send.integration.test.js --verbose

# Con coverage
npm test -- tests/campaign-send.integration.test.js --coverage
```

## Casos de Prueba Detallados

### Test 1: Envío Exitoso

```javascript
// ARRANGE: 3 envíos pendientes, cupo 10
await createTestEnvios({ campania_id: 9001, count: 3 });

// ACT: Procesar programación
await procesarProgramacion(programacion);

// ASSERT:
// - 3 registros cambian a "enviado"
// - Cada registro tiene fecha_envio
// - Stub fue llamado 3 veces
```

### Test 2: Cupo Diario

```javascript
// ARRANGE: 10 pendientes, cupo 5
await createTestEnvios({ campania_id: 9002, count: 10 });
await createTestProgramacion({ cupo_diario: 5 });

// ACT: Procesar
await procesarProgramacion(programacion);

// ASSERT:
// - 5 enviados, 5 pendientes
// - Stub llamado exactamente 5 veces
```

### Test 3: Error en SendMessage

```javascript
// ARRANGE: Stub configurado para fallar después del 1er mensaje
stub.sendMessage = async () => {
  if (callCount === 1) return { success: true };
  throw new Error('Error simulado');
};

// ACT: Procesar 3 envíos
await procesarProgramacion(programacion);

// ASSERT:
// - 1 enviado, 2 pendientes
// - Solo el primer registro marcado como enviado
```

### Test 4: WhatsApp No Ready

```javascript
// ARRANGE: WhatsApp DISCONNECTED
stub.setStatusResponse({ status: 'DISCONNECTED', connected: false });

// ACT: Procesar
await procesarProgramacion(programacion);

// ASSERT:
// - Ningún envío procesado
// - Stub NO llamado para sendMessage
```

### Test 5: Campaña Pausada

```javascript
// ARRANGE: Campaña con estado = 'pausada'
await createTestCampaign({ estado: 'pausada' });

// ACT: Procesar
await procesarProgramacion(programacion);

// ASSERT:
// - Ningún cambio de estado
// - Stub NO llamado
```

### Test 6: Contador Diario

```javascript
// ARRANGE: 10 pendientes, cupo 5
await createTestEnvios({ count: 10 });

// ACT: Procesar 2 veces (mismo día)
await procesarProgramacion(programacion);
await procesarProgramacion(programacion);

// ASSERT:
// - Primera ejecución: 5 enviados
// - Segunda ejecución: 0 enviados (cupo agotado)
// - Total stub llamado: 5 veces
```

## Ventajas de este Enfoque

✅ **Sin dependencia de WhatsApp real:** Stub programable  
✅ **Base de datos real:** Verifica transacciones SQL reales  
✅ **Aislamiento:** IDs >= 9000, cleanup automático  
✅ **Determinismo:** Sin `setInterval`, ejecución controlada  
✅ **Rastreo completo:** Todas las llamadas a stub grabadas  
✅ **Rollback ante error:** Verifica lógica de compensación  

## Arquitectura de Mocking

```
Test Suite
    ↓
jest.mock('sessionManagerClient')
    ↓
sessionManagerStub (programable)
    ↓
programacionScheduler (código real)
    ↓
DB real (MySQL)
```

## Configuración de Jest

```javascript
// jest.config.js
testMatch: [
  "**/tests/**/?(*.)+(integration.test).js" // ← Patrón agregado
],

// jest.setup.js (si aplica)
// Mock automático de sessionManagerClient
```

## Troubleshooting

### Error: "Cannot find module sessionManagerClient"

**Causa:** Mock aplicado después del import  
**Solución:** Verificar que `jest.mock()` esté ANTES del `require()` del scheduler

### Error: "Connection timeout to database"

**Causa:** Variables de entorno incorrectas  
**Solución:** Verificar `.env` y que MySQL esté corriendo

### Error: "ECONNREFUSED 127.0.0.1:3306"

**Causa:** MySQL no está corriendo o puerto incorrecto  
**Solución:** `systemctl start mysql` o verificar puerto

### Tests pasan pero datos reales afectados

**Causa:** IDs de test < 9000  
**Solución:** Siempre usar IDs >= 9000 en `createTestCampaign/Programacion/Envios`

## Próximos Pasos

1. **Agregar test de concurrencia:** Múltiples programaciones simultáneas
2. **Test de locking:** Verificar que locks previenen duplicados
3. **Test de ventana horaria:** Validar días/horas permitidas
4. **Test de delay anti-spam:** Verificar pausas entre envíos
5. **Integrar en CI/CD:** GitHub Actions con DB dockerizada

## Referencias

- Código fuente: `src/modules/sender/services/programacionScheduler.js`
- Session Manager real: `src/integrations/sessionManager/sessionManagerClient.js`
- Schema DB: `migrations/` (tabla `ll_envios_whatsapp`)

---

**Autor:** Test Engineering Team  
**Fecha:** 2026-01-21  
**Versión:** 1.0.0
