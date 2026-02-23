# Sistema de Control de Entregabilidad Manual con Bloqueo Exclusivo por Operador

**Fecha de Creación:** 2026-02-16  
**Módulo:** Envíos Manuales WhatsApp  
**Objetivo:** Evolucionar de "abrir enlace" a sistema transaccional con control de workflow

---

## 1. PROPÓSITO DEL MÓDULO

### 1.1 Contexto

El módulo actual abre WhatsApp Web pero **no garantiza**:
- Que el envío sea tomado por un solo operador
- Que no haya múltiples ventanas abiertas simultáneas
- Que el estado refleje la realidad operativa
- Que exista trazabilidad de quién procesó cada envío

### 1.2 Objetivo del Sistema Transaccional

Implementar un **sistema de control de entregabilidad manual** que:

1. **Garantice trazabilidad**: Cada envío tiene registro de quién lo procesó y cuándo
2. **Evite duplicaciones**: Un envío solo puede ser tomado una vez
3. **Impida múltiples envíos abiertos**: Un operador solo puede tener un envío activo
4. **Asegure aislamiento multi-cliente**: Los envíos de un cliente no interfieren con otros
5. **Permita control de workflow**: Estados claros que representan el proceso real

### 1.3 Fundamento

Este módulo es la base de un **CRM operativo serio** donde:
- El backend es la única fuente de verdad
- Las transiciones de estado son explícitas y auditables
- Los conflictos se detectan y previenen a nivel de BD
- La UI refleja el estado real, no lo define

**Esto NO es simplemente "abrir un enlace"** — es un sistema de gestión de operaciones manuales con consistencia transaccional.

---

## 2. MODELO DE ESTADOS DEFINITIVO

### 2.1 Estados Oficiales

```sql
ENUM('pendiente', 'abierto', 'enviado', 'error', 'cancelado')
```

| Estado | Significado | Operador Asignado | Acción Requerida |
|--------|-------------|-------------------|------------------|
| `pendiente` | Envío creado, no tomado | NO | Tomar envío |
| `abierto` | Operador lo tomó, WhatsApp abierto | SÍ | Confirmar o cancelar |
| `enviado` | Confirmado por operador | SÍ | Ninguna (final) |
| `error` | Falló durante proceso | SÍ | Reintento manual |
| `cancelado` | Operador canceló | SÍ | Ninguna (final) |

### 2.2 Diagrama de Transiciones

```
                    ┌─────────────┐
                    │  pendiente  │
                    └──────┬──────┘
                           │
              openManual() │
                           │
                    ┌──────▼──────┐
             ┌──────┤   abierto   ├──────┐
             │      └─────────────┘      │
             │                           │
    cancel() │                           │ confirm()
             │                           │
      ┌──────▼──────┐            ┌──────▼──────┐
      │  cancelado  │            │   enviado   │
      └─────────────┘            └─────────────┘
             │                           │
             │        error durante      │
             │        procesamiento      │
             │                           │
             │      ┌─────────────┐      │
             └─────►│    error    ◄──────┘
                    └─────────────┘
```

### 2.3 Transiciones Permitidas

| Desde | Hacia | Método | Validación |
|-------|-------|--------|------------|
| `pendiente` | `abierto` | `openManual()` | Operador no tiene otro abierto |
| `abierto` | `enviado` | `confirmManual()` | Operador es el dueño |
| `abierto` | `cancelado` | `cancelManual()` | Operador es el dueño |
| `abierto` | `error` | Sistema | Error técnico |

### 2.4 Transiciones Prohibidas

❌ **NUNCA permitir:**
- `enviado` → `pendiente` (no se puede deshacer)
- `cancelado` → `pendiente` (no se puede reutilizar)
- Cambio de `operador_id` una vez asignado
- Transiciones sin validación de operador

---

## 3. CAMBIOS EN BASE DE DATOS

### 3.1 Checklist de Migraciones

- [ ] Ampliar ENUM de `estado`
- [ ] Agregar columna `operador_id`
- [ ] Agregar columna `fecha_apertura`
- [ ] Agregar columna `fecha_confirmacion`
- [ ] Crear índice compuesto `(operador_id, estado)`
- [ ] Crear índice de búsqueda `(cliente_id, estado)`
- [ ] Verificar consistencia de datos actuales
- [ ] Migrar envíos `pendiente` existentes

### 3.2 Comandos SQL

#### 3.2.1 Ampliar ENUM de estado

```sql
ALTER TABLE ll_envios_whatsapp 
MODIFY COLUMN estado ENUM(
  'pendiente', 
  'abierto', 
  'enviado', 
  'error', 
  'cancelado'
) NOT NULL DEFAULT 'pendiente';
```

#### 3.2.2 Agregar columnas de control

```sql
-- Operador que tomó el envío
ALTER TABLE ll_envios_whatsapp 
ADD COLUMN operador_id INT UNSIGNED NULL 
AFTER estado;

-- Fecha y hora en que el operador abrió WhatsApp
ALTER TABLE ll_envios_whatsapp 
ADD COLUMN fecha_apertura DATETIME NULL 
AFTER fecha_envio;

-- Fecha y hora de confirmación/cancelación
ALTER TABLE ll_envios_whatsapp 
ADD COLUMN fecha_confirmacion DATETIME NULL 
AFTER fecha_apertura;

-- Foreign key al usuario operador
ALTER TABLE ll_envios_whatsapp 
ADD CONSTRAINT fk_envio_operador 
FOREIGN KEY (operador_id) 
REFERENCES ll_usuarios(id) 
ON DELETE SET NULL;
```

#### 3.2.3 Crear índices de performance

```sql
-- Índice para búsqueda de envíos abiertos por operador
CREATE INDEX idx_operador_estado 
ON ll_envios_whatsapp(operador_id, estado);

-- Índice para búsqueda de envíos pendientes por cliente
CREATE INDEX idx_cliente_estado 
ON ll_envios_whatsapp(cliente_id, estado);

-- Índice para búsqueda temporal de envíos
CREATE INDEX idx_fecha_estado 
ON ll_envios_whatsapp(fecha_apertura, estado);
```

#### 3.2.4 Verificar consistencia de datos

```sql
-- Verificar envíos sin fecha que están como enviados
SELECT id, estado, fecha_envio, fecha_apertura 
FROM ll_envios_whatsapp 
WHERE estado = 'enviado' 
  AND fecha_envio IS NULL;

-- Corregir envíos marcados como enviados sin fecha
UPDATE ll_envios_whatsapp 
SET fecha_envio = created_at 
WHERE estado = 'enviado' 
  AND fecha_envio IS NULL;
```

### 3.3 Migración de Datos Existentes

```sql
-- Estado actual → nuevo estado
-- Todos los 'pendiente' quedan igual
-- No hay datos históricos de 'abierto' porque no existía

-- Envíos manuales históricos sin operador quedan sin asignación
-- (aceptable para datos históricos)

-- Verificar totales por estado
SELECT estado, COUNT(*) as total 
FROM ll_envios_whatsapp 
GROUP BY estado;
```

---

## 4. BACKEND – ENDPOINTS A IMPLEMENTAR

### 4.1 Open Manual (Bloqueo Exclusivo)

**Ruta:** `POST /api/sender/envios/:id/manual/open`

#### 4.1.1 Checklist de Implementación

- [ ] Verificar autenticación de operador
- [ ] Validar que envío pertenece al cliente del operador
- [ ] Verificar que envío está en estado `pendiente`
- [ ] **Verificar que operador NO tiene otro envío `abierto`**
- [ ] UPDATE condicional con locking
- [ ] Registrar `operador_id` y `fecha_apertura`
- [ ] Retornar mensaje personalizado y teléfono
- [ ] Manejo de errores explícito

#### 4.1.2 Código de Referencia

```javascript
// src/modules/sender/controllers/enviosController.js

async openManual(req, res) {
  const { id: envioId } = req.params;
  const operadorId = req.user.id;
  const clienteId = req.user.cliente_id;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Verificar que operador no tenga otro envío abierto
    const [enviosAbiertos] = await connection.execute(
      `SELECT id FROM ll_envios_whatsapp 
       WHERE operador_id = ? 
         AND estado = 'abierto' 
         AND cliente_id = ?
       LIMIT 1`,
      [operadorId, clienteId]
    );

    if (enviosAbiertos.length > 0) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        error: 'OPERADOR_TIENE_ENVIO_ABIERTO',
        message: 'Ya tienes un envío abierto. Complétalo antes de tomar otro.',
        envio_abierto_id: enviosAbiertos[0].id
      });
    }

    // 2. Tomar envío con UPDATE condicional
    const [result] = await connection.execute(
      `UPDATE ll_envios_whatsapp 
       SET estado = 'abierto',
           operador_id = ?,
           fecha_apertura = NOW()
       WHERE id = ? 
         AND estado = 'pendiente'
         AND cliente_id = ?`,
      [operadorId, envioId, clienteId]
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      
      // Verificar por qué falló
      const [envio] = await connection.execute(
        'SELECT estado FROM ll_envios_whatsapp WHERE id = ? AND cliente_id = ?',
        [envioId, clienteId]
      );

      if (envio.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'ENVIO_NO_ENCONTRADO',
          message: 'El envío no existe o no pertenece a tu organización.'
        });
      }

      return res.status(409).json({
        success: false,
        error: 'ENVIO_YA_TOMADO',
        message: `El envío ya está en estado: ${envio[0].estado}`,
        estado_actual: envio[0].estado
      });
    }

    // 3. Obtener datos completos del envío
    const [envio] = await connection.execute(
      `SELECT e.*, c.mensaje as mensaje_campania
       FROM ll_envios_whatsapp e
       JOIN ll_campanias_whatsapp c ON e.campania_id = c.id
       WHERE e.id = ?`,
      [envioId]
    );

    // 4. Renderizar mensaje personalizado
    const mensajeFinal = mensajeService.renderizarMensaje(
      envio[0].mensaje_final || envio[0].mensaje_campania,
      { nombre_destino: envio[0].nombre_destino }
    );

    await connection.commit();

    return res.json({
      success: true,
      data: {
        envio_id: envioId,
        telefono: envio[0].telefono_wapp,
        mensaje_final: mensajeFinal,
        nombre_destino: envio[0].nombre_destino,
        estado: 'abierto',
        fecha_apertura: new Date()
      }
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error en openManual:', error);
    return res.status(500).json({
      success: false,
      error: 'ERROR_SERVIDOR',
      message: 'Error al abrir envío manual'
    });
  } finally {
    connection.release();
  }
}
```

#### 4.1.3 Casos de Error Específicos

| Código | HTTP | Descripción | Acción Usuario |
|--------|------|-------------|----------------|
| `OPERADOR_TIENE_ENVIO_ABIERTO` | 409 | Ya tiene un envío abierto | Completar el abierto primero |
| `ENVIO_YA_TOMADO` | 409 | Otro operador lo tomó | Seleccionar otro envío |
| `ENVIO_NO_ENCONTRADO` | 404 | No existe o no pertenece | Refrescar lista |

---

### 4.2 Confirm Manual

**Ruta:** `POST /api/sender/envios/:id/manual/confirm`

#### 4.2.1 Checklist de Implementación

- [ ] Verificar que envío está en estado `abierto`
- [ ] **Validar que operador es el dueño**
- [ ] UPDATE a estado `enviado`
- [ ] Registrar `fecha_envio` y `fecha_confirmacion`
- [ ] No permitir cambio de operador
- [ ] Retornar confirmación exitosa

#### 4.2.2 Código de Referencia

```javascript
async confirmManual(req, res) {
  const { id: envioId } = req.params;
  const operadorId = req.user.id;
  const clienteId = req.user.cliente_id;

  try {
    const [result] = await pool.execute(
      `UPDATE ll_envios_whatsapp 
       SET estado = 'enviado',
           fecha_envio = NOW(),
           fecha_confirmacion = NOW()
       WHERE id = ? 
         AND estado = 'abierto'
         AND operador_id = ?
         AND cliente_id = ?`,
      [envioId, operadorId, clienteId]
    );

    if (result.affectedRows === 0) {
      // Verificar motivo de fallo
      const [envio] = await pool.execute(
        `SELECT estado, operador_id 
         FROM ll_envios_whatsapp 
         WHERE id = ? AND cliente_id = ?`,
        [envioId, clienteId]
      );

      if (envio.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'ENVIO_NO_ENCONTRADO',
          message: 'El envío no existe.'
        });
      }

      if (envio[0].operador_id !== operadorId) {
        return res.status(403).json({
          success: false,
          error: 'NO_ES_PROPIETARIO',
          message: 'Este envío fue tomado por otro operador.'
        });
      }

      return res.status(409).json({
        success: false,
        error: 'ESTADO_INVALIDO',
        message: `El envío está en estado: ${envio[0].estado}`,
        estado_actual: envio[0].estado
      });
    }

    return res.json({
      success: true,
      message: 'Envío confirmado correctamente',
      data: {
        envio_id: envioId,
        estado: 'enviado',
        fecha_confirmacion: new Date()
      }
    });

  } catch (error) {
    console.error('Error en confirmManual:', error);
    return res.status(500).json({
      success: false,
      error: 'ERROR_SERVIDOR',
      message: 'Error al confirmar envío'
    });
  }
}
```

---

### 4.3 Cancel Manual

**Ruta:** `POST /api/sender/envios/:id/manual/cancel`

#### 4.3.1 Checklist de Implementación

- [ ] Solo permitir si estado = `abierto`
- [ ] Validar que operador es el dueño
- [ ] Cambiar estado a `cancelado`
- [ ] Registrar `fecha_confirmacion`
- [ ] Permitir motivo opcional de cancelación
- [ ] Retornar confirmación

#### 4.3.2 Código de Referencia

```javascript
async cancelManual(req, res) {
  const { id: envioId } = req.params;
  const { motivo } = req.body;
  const operadorId = req.user.id;
  const clienteId = req.user.cliente_id;

  try {
    const [result] = await pool.execute(
      `UPDATE ll_envios_whatsapp 
       SET estado = 'cancelado',
           fecha_confirmacion = NOW(),
           observaciones = ?
       WHERE id = ? 
         AND estado = 'abierto'
         AND operador_id = ?
         AND cliente_id = ?`,
      [motivo || 'Cancelado por operador', envioId, operadorId, clienteId]
    );

    if (result.affectedRows === 0) {
      return res.status(409).json({
        success: false,
        error: 'NO_SE_PUEDE_CANCELAR',
        message: 'El envío no puede ser cancelado en su estado actual.'
      });
    }

    return res.json({
      success: true,
      message: 'Envío cancelado correctamente',
      data: {
        envio_id: envioId,
        estado: 'cancelado',
        fecha_confirmacion: new Date()
      }
    });

  } catch (error) {
    console.error('Error en cancelManual:', error);
    return res.status(500).json({
      success: false,
      error: 'ERROR_SERVIDOR',
      message: 'Error al cancelar envío'
    });
  }
}
```

---

### 4.4 Get Active Sending (Envío Abierto del Operador)

**Ruta:** `GET /api/sender/envios/manual/active`

#### 4.4.1 Propósito

Permitir al frontend saber si el operador tiene un envío abierto al cargar la página.

#### 4.4.2 Código de Referencia

```javascript
async getActiveSending(req, res) {
  const operadorId = req.user.id;
  const clienteId = req.user.cliente_id;

  try {
    const [envios] = await pool.execute(
      `SELECT e.*, c.nombre as campania_nombre
       FROM ll_envios_whatsapp e
       JOIN ll_campanias_whatsapp c ON e.campania_id = c.id
       WHERE e.operador_id = ? 
         AND e.estado = 'abierto'
         AND e.cliente_id = ?
       LIMIT 1`,
      [operadorId, clienteId]
    );

    if (envios.length === 0) {
      return res.json({
        success: true,
        data: null
      });
    }

    return res.json({
      success: true,
      data: envios[0]
    });

  } catch (error) {
    console.error('Error en getActiveSending:', error);
    return res.status(500).json({
      success: false,
      error: 'ERROR_SERVIDOR'
    });
  }
}
```

---

## 5. REGLAS DE NEGOCIO OBLIGATORIAS

### 5.1 Principios Fundamentales

1. **Un operador = un envío abierto máximo**
   - Validación a nivel de BD con UPDATE condicional
   - El frontend debe deshabilitar botones si ya tiene uno abierto
   - Mensaje claro al usuario si intenta violar esta regla

2. **Un envío solo puede ser tomado una vez**
   - El UPDATE condicional `WHERE estado = 'pendiente'` lo garantiza
   - Si falla, el envío ya fue tomado por alguien más
   - No hay race conditions porque la BD serializa los UPDATE

3. **El backend es la única fuente de verdad**
   - El frontend NUNCA cambia estado localmente
   - Siempre se valida en el servidor con transacciones
   - La UI solo refleja el estado, no lo define

4. **No hay transiciones implícitas**
   - Cada cambio de estado requiere llamada explícita al endpoint
   - No hay timeouts automáticos
   - No hay cambios de estado "por defecto"

### 5.2 Validaciones Críticas

```javascript
// Validación multi-nivel

// 1. A nivel de BD (más confiable)
WHERE estado = 'pendiente' AND operador_id IS NULL

// 2. A nivel de aplicación (performance)
if (operadorTieneEnvioAbierto) {
  throw new ConflictError('Ya tienes un envío abierto');
}

// 3. A nivel de UI (UX)
<Button disabled={hayEnvioAbierto}>
  Abrir WhatsApp
</Button>
```

### 5.3 Casos Edge Resueltos

| Escenario | Resolución |
|-----------|------------|
| Operador abre 2 envíos simultáneos | Segundo UPDATE falla, recibe error 409 |
| Operador A y B toman mismo envío | El segundo recibe error "ya tomado" |
| Operador cierra navegador | Estado permanece `abierto`, puede reanudar |
| Envío `abierto` sin confirmar por días | Válido, es manual, no hay timeout automático |
| Operador diferente intenta confirmar | Validación `operador_id` lo bloquea |

---

## 6. FRONTEND – CHECKLIST DE IMPLEMENTACIÓN

### 6.1 Cambios en GestionDestinatariosPage.jsx

- [ ] Llamar a `openManual()` en lugar de `prepareManual()`
- [ ] Detectar error `OPERADOR_TIENE_ENVIO_ABIERTO`
- [ ] Mostrar banner si hay envío abierto pendiente
- [ ] Deshabilitar botones "Web WhatsApp" si hay envío abierto
- [ ] Agregar botón "Cancelar" en modal
- [ ] Manejar errores 409 de forma amigable

### 6.2 Flujo de UI Mejorado

```
1. Usuario entra a página
   ↓
2. Llamar GET /envios/manual/active
   ↓
3. Si tiene envío abierto → Mostrar banner con opciones:
   - "Continuar con envío pendiente"
   - "Cancelar envío"
   ↓
4. Usuario hace clic en "Web WhatsApp"
   ↓
5. Llamar POST /envios/:id/manual/open
   ↓
6. Si error 409 → Mostrar: "Ya tienes un envío abierto"
   ↓
7. Si success → Abrir WhatsApp Web
   ↓
8. Modal con 2 botones:
   - "✓ Confirmar Envío" → POST /envios/:id/manual/confirm
   - "✗ Cancelar" → POST /envios/:id/manual/cancel
```

### 6.3 Componente de Banner de Envío Abierto

```jsx
{envioAbierto && (
  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-sm font-medium text-yellow-800">
          Tienes un envío abierto
        </h3>
        <p className="text-sm text-yellow-700">
          {envioAbierto.nombre_destino} - Abierto hace {tiempoTranscurrido}
        </p>
      </div>
      <div className="flex gap-2">
        <button 
          onClick={retomarEnvio}
          className="btn-primary"
        >
          Continuar
        </button>
        <button 
          onClick={cancelarEnvio}
          className="btn-secondary"
        >
          Cancelar
        </button>
      </div>
    </div>
  </div>
)}
```

---

## 7. TESTING FUNCIONAL

### 7.1 Checklist de Pruebas de Sistema

#### Test Case 1: Bloqueo Exclusivo por Operador

- [ ] **Setup:** 2 operadores autenticados, mismo cliente
- [ ] Operador A toma envío 100 → Estado = `abierto`, operador_id = A
- [ ] Operador A intenta tomar envío 101 → Error: "Ya tienes un envío abierto"
- [ ] Operador B intenta tomar envío 100 → Error: "Envío ya tomado"
- [ ] Operador B toma envío 101 → Estado = `abierto`, operador_id = B
- [ ] **Verificar:** `SELECT * FROM ll_envios_whatsapp WHERE id IN (100, 101)`

#### Test Case 2: Confirmación Exitosa

- [ ] Operador A toma envío 200
- [ ] Operador A confirma envío 200 → Estado = `enviado`, fecha_envio != NULL
- [ ] Operador B intenta confirmar envío 200 → Error: "No es propietario"
- [ ] **Verificar:** `operador_id` no cambió

#### Test Case 3: Cancelación

- [ ] Operador A toma envío 300
- [ ] Operador A cancela envío 300 con motivo → Estado = `cancelado`
- [ ] Operador A intenta confirmar envío 300 → Error: "Estado inválido"
- [ ] **Verificar:** No puede volver a `pendiente`

#### Test Case 4: Aislamiento Multi-Cliente

- [ ] Operador A (cliente 1) toma envío 400
- [ ] Operador C (cliente 2) intenta tomar envío 400 → Error: "No encontrado"
- [ ] **Verificar:** `WHERE cliente_id = ?` funciona

#### Test Case 5: Race Condition

- [ ] Setup: Script que intenta tomar mismo envío simultáneamente
- [ ] Ejecutar 10 requests paralelos a openManual(500)
- [ ] **Verificar:** Solo 1 tiene `affectedRows = 1`, los demás 0
- [ ] **Verificar:** Solo 1 operador queda asignado

#### Test Case 6: Persistencia tras Recarga

- [ ] Operador A toma envío 600
- [ ] Operador A cierra navegador
- [ ] Operador A vuelve a entrar → Banner muestra envío 600 abierto
- [ ] Operador A puede confirmar/cancelar
- [ ] **Verificar:** Estado persiste correctamente

### 7.2 Queries de Verificación

```sql
-- Ver estado de todos los envíos de prueba
SELECT 
  id, 
  nombre_destino, 
  estado, 
  operador_id,
  fecha_apertura,
  fecha_confirmacion
FROM ll_envios_whatsapp
WHERE id IN (100, 101, 200, 300, 400, 500, 600)
ORDER BY id;

-- Ver envíos abiertos por operador
SELECT 
  operador_id,
  COUNT(*) as envios_abiertos
FROM ll_envios_whatsapp
WHERE estado = 'abierto'
GROUP BY operador_id
HAVING envios_abiertos > 1;
-- Resultado esperado: 0 rows

-- Verificar integridad de fechas
SELECT id, estado, fecha_apertura, fecha_envio, fecha_confirmacion
FROM ll_envios_whatsapp
WHERE 
  (estado = 'enviado' AND fecha_envio IS NULL) OR
  (estado = 'abierto' AND fecha_apertura IS NULL) OR
  (estado IN ('enviado', 'cancelado') AND fecha_confirmacion IS NULL);
-- Resultado esperado: 0 rows
```

---

## 8. CRITERIOS DE FINALIZACIÓN

### 8.1 Definición de "Completo"

El módulo se considera **estable y en producción** cuando:

#### Criterios Técnicos

- [ ] Todas las migraciones de BD ejecutadas en producción
- [ ] Todos los endpoints implementados y documentados
- [ ] Tests unitarios cubren casos críticos
- [ ] Tests de integración validan transacciones
- [ ] No hay race conditions detectadas en pruebas de carga
- [ ] Logs estructurados en todos los endpoints

#### Criterios Funcionales

- [ ] Imposible que 2 operadores tomen el mismo envío
- [ ] Imposible que 1 operador tenga 2 envíos abiertos
- [ ] Estados reflejan la realidad operativa
- [ ] Transiciones de estado son auditables
- [ ] UI muestra errores claros y accionables

#### Criterios de Auditoría

- [ ] Query que detecta inconsistencias retorna 0 filas
- [ ] Todos los envíos `abierto` tienen operador asignado
- [ ] Todos los envíos `enviado` tienen fecha_envio
- [ ] No hay transiciones prohibidas en histórico

### 8.2 Queries de Auditoría Post-Implementación

```sql
-- 1. Inconsistencias de estado
SELECT id, estado, operador_id, fecha_apertura, fecha_envio
FROM ll_envios_whatsapp
WHERE 
  (estado = 'abierto' AND operador_id IS NULL) OR
  (estado = 'enviado' AND operador_id IS NULL) OR
  (estado IN ('enviado', 'cancelado') AND fecha_apertura IS NULL);

-- 2. Operadores con múltiples envíos abiertos
SELECT operador_id, COUNT(*) as total
FROM ll_envios_whatsapp
WHERE estado = 'abierto'
GROUP BY operador_id
HAVING total > 1;

-- 3. Envíos abiertos hace más de 7 días (posible problema)
SELECT id, nombre_destino, operador_id, fecha_apertura,
       DATEDIFF(NOW(), fecha_apertura) as dias_abierto
FROM ll_envios_whatsapp
WHERE estado = 'abierto'
  AND fecha_apertura < DATE_SUB(NOW(), INTERVAL 7 DAY);
```

### 8.3 Métricas de Éxito

- **Duplicaciones detectadas:** 0
- **Estados inconsistentes:** 0
- **Errores de concurrencia:** 0
- **Conflictos 409 resueltos:** > 95%
- **Tiempo promedio de apertura → confirmación:** < 5 minutos

---

## 9. PRÓXIMOS PASOS (ROADMAP)

### 9.1 Fase 1: Infraestructura (Esta implementación)

- [x] Migraciones de BD
- [x] Endpoints backend
- [x] Validaciones transaccionales
- [x] Testing funcional

### 9.2 Fase 2: Mejoras Operativas

- [ ] Dashboard de envíos abiertos para supervisores
- [ ] Alertas de envíos abiertos > 24 horas
- [ ] Reasignación forzada por supervisor
- [ ] Métricas por operador (confirmados/cancelados)

### 9.3 Fase 3: Automatización

- [ ] Auto-cancelación de envíos abiertos > 7 días
- [ ] Sugerencias de confirmación automática (IA/ML)
- [ ] Integración con API oficial de WhatsApp Business
- [ ] Estados de lectura/entrega desde API

---

## 10. MODO OPERATIVO EXCLUYENTE (MANUAL vs META API)

### 10.1 Contexto de Dualidad Operativa

El sistema **LeadMaster** soporta dos modos completamente diferentes de envío de mensajes WhatsApp:

1. **Modo Manual** (Web WhatsApp)
   - Utiliza navegador web y WhatsApp Web
   - Requiere intervención humana por mensaje
   - Control operativo con bloqueo transaccional
   
2. **Modo Meta API** (Oficial)
   - Utiliza API oficial de Meta/WhatsApp Business
   - Envío automático desde el backend
   - Sin intervención manual del operador

**PRINCIPIO FUNDAMENTAL:** Estos modos son **mutuamente excluyentes** y no pueden coexistir simultáneamente para un mismo cliente.

---

### 10.2 Regla de Exclusión Operativa

#### 10.2.1 Definición del Modo Activo

El modo de operación se define mediante configuración a nivel de **cliente**:

```sql
-- Ejemplo conceptual (no requiere migración inmediata)
-- La configuración puede estar en:
-- 1. Tabla ll_clientes con campo modo_envio
-- 2. Configuración de campaña
-- 3. Variable de entorno por cuenta
```

**Variables de configuración posibles:**
- `modo_envio: 'manual' | 'meta'`
- `usa_api_oficial: boolean`
- `requiere_confirmacion_manual: boolean`

El **backend es la única fuente de verdad** sobre qué modo está activo.

#### 10.2.2 Comportamiento en Modo Manual

Cuando `modo_envio = 'manual'`:

**Workflow de Estados:**
```
pendiente → abierto → enviado
         ↘         ↗
           cancelado
```

**Características:**
- ✅ Endpoints `/manual/open`, `/manual/confirm`, `/manual/cancel` están **activos**
- ✅ Requiere `operador_id` obligatorio
- ✅ Requiere confirmación explícita del operador
- ✅ Estados intermedios (`abierto`) son válidos
- ✅ Botón "Web WhatsApp" visible en UI
- ❌ Scheduler automático de envíos está **deshabilitado**
- ❌ Endpoints de API automática devuelven **403 Forbidden**

**Validación Backend:**
```javascript
if (cliente.modo_envio !== 'manual') {
  return res.status(403).json({
    success: false,
    error: 'MODO_INCORRECTO',
    message: 'Esta cuenta está configurada para envío automático vía API'
  });
}
```

#### 10.2.3 Comportamiento en Modo Meta API

Cuando `modo_envio = 'meta'`:

**Workflow de Estados:**
```
pendiente → enviado
         ↘
           error
```

**Características:**
- ❌ El estado `abierto` no debe ser utilizado en este modo
- ❌ No existe concepto de `operador_id` manual
- ❌ Endpoints `/manual/*` devuelven **403 Forbidden**
- ❌ Botón "Web WhatsApp" debe estar **oculto/deshabilitado**
- ✅ Envío lo realiza el **backend vía API oficial**
- ✅ Scheduler automático está **habilitado**
- ✅ Confirmación es automática al recibir respuesta de Meta
- ✅ Estados de entrega/lectura vienen de webhooks oficiales

**Validación Backend:**
```javascript
if (cliente.modo_envio !== 'meta') {
  return res.status(403).json({
    success: false,
    error: 'MODO_INCORRECTO',
    message: 'Esta cuenta requiere envío manual vía WhatsApp Web'
  });
}
```

#### 10.2.4 Matriz de Exclusión

| Acción | Modo Manual | Modo Meta API |
|--------|-------------|---------------|
| `POST /envios/:id/manual/open` | ✅ Permitido | ❌ 403 Forbidden |
| `POST /envios/:id/manual/confirm` | ✅ Permitido | ❌ 403 Forbidden |
| `POST /envios/:id/manual/cancel` | ✅ Permitido | ❌ 403 Forbidden |
| Botón "Web WhatsApp" en UI | ✅ Visible | ❌ Oculto |
| Scheduler automático | ❌ Deshabilitado | ✅ Activo |
| Webhook de Meta | ❌ Ignorado | ✅ Procesado |
| Estado `abierto` | ✅ Válido | ❌ Inexistente |
| Campo `operador_id` | ✅ Requerido | ✅ NULL (válido) |

> **Nota técnica:** La validación del modo de operación debe implementarse mediante middleware dedicado a nivel de rutas y no mediante inspección de strings de URL (ej. `req.path.includes`). Esto garantiza mayor robustez y evita falsos positivos.

---

### 10.3 Aislamiento Multi-Cliente

**REGLA CRÍTICA:** Clientes diferentes pueden operar en modos diferentes simultáneamente.

**Ejemplo válido:**
- Cliente A (ID: 100) → `modo_envio = 'manual'`
- Cliente B (ID: 200) → `modo_envio = 'meta'`

**Validación en cada request:**
```javascript
// Middleware dedicado valida el modo antes de llegar al controller
// enviosRoutes.js
router.post('/envios/:id/manual/open', 
  autenticar,
  validarModoManual,  // ← Middleware específico
  enviosController.openManual
);

// middlewares/validarModoManual.js
async function validarModoManual(req, res, next) {
  const cliente = await obtenerCliente(req.user.cliente_id);
  
  if (cliente.modo_envio !== 'manual') {
    return res.status(403).json({
      success: false,
      error: 'MODO_INCORRECTO',
      message: 'Esta cuenta está configurada para envío automático vía API'
    });
  }
  
  next();
}
```

---

### 10.4 Preparación para Escalabilidad

#### 10.4.1 Compatibilidad del Modelo de Estados

El modelo de estados definido en la **Sección 2** es **compatible con ambos modos** sin requerir cambios estructurales:

```sql
ENUM('pendiente', 'abierto', 'enviado', 'error', 'cancelado')
```

**Modo Manual:** Utiliza todos los estados  
**Modo Meta API:** Utiliza subconjunto: `pendiente` → `enviado` | `error`

**Ventajas:**
- ✅ No hay fragmentación de esquema
- ✅ Consultas históricas funcionan para ambos modos
- ✅ Migración futura entre modos es posible
- ✅ Auditoría unificada

#### 10.4.2 Campos Opcionales por Modo

| Campo | Modo Manual | Modo Meta API |
|-------|-------------|---------------|
| `operador_id` | NOT NULL cuando `estado='abierto'` | NULL (siempre) |
| `fecha_apertura` | NOT NULL cuando `estado='abierto'` | NULL |
| `fecha_confirmacion` | NOT NULL cuando finaliza | NULL |
| `meta_message_id` | NULL | NOT NULL cuando enviado |
| `meta_status` | NULL | 'sent' \| 'delivered' \| 'read' |

**Query universal para ambos modos:**
```sql
-- Funciona para manual y API sin cambios
SELECT id, estado, fecha_envio, operador_id, meta_message_id
FROM ll_envios_whatsapp
WHERE cliente_id = ?
  AND estado = 'enviado';
```

> Los campos `meta_message_id` y `meta_status` no forman parte de la migración actual y serán incorporados en la Fase 3 (Integración con API Oficial). Se documentan aquí como previsión arquitectónica futura.

#### 10.4.3 Migraciones Futuras

**Si un cliente cambia de modo:**

```sql
-- De manual a Meta API (caso raro)
UPDATE ll_campanias_whatsapp
SET modo_envio = 'meta'
WHERE cliente_id = ? AND modo_envio = 'manual';

-- Envíos en estado 'abierto' deben resolverse antes del cambio
SELECT COUNT(*) FROM ll_envios_whatsapp
WHERE cliente_id = ? AND estado = 'abierto';
-- Resultado esperado: 0 (prerequisito para cambio de modo)
```

---

### 10.5 Frontend – Detección de Modo

#### 10.5.1 Endpoint de Configuración

**Ruta:** `GET /api/clientes/config`

```javascript
{
  "success": true,
  "data": {
    "cliente_id": 100,
    "nombre": "ACME Corp",
    "modo_envio": "manual",
    "requiere_confirmacion_manual": true,
    "tiene_api_oficial": false
  }
}
```

#### 10.5.2 Renderizado Condicional

```jsx
// GestionDestinatariosPage.jsx
const { modo_envio } = useClienteConfig();

return (
  <div>
    {modo_envio === 'manual' && (
      <button onClick={handleAbrirModalWhatsApp}>
        📱 Abrir WhatsApp Web
      </button>
    )}
    
    {modo_envio === 'meta' && (
      <p>
        Los envíos se realizan automáticamente vía API oficial
      </p>
    )}
  </div>
);
```

---

### 10.6 Testing de Exclusión Operativa

#### Test Case 1: Rechazo Cross-Mode

- [ ] Cliente configurado con `modo_envio = 'meta'`
- [ ] Intentar `POST /envios/:id/manual/open`
- [ ] **Verificar:** HTTP 403 con error `MODO_INCORRECTO`

#### Test Case 2: Aislamiento Multi-Cliente

- [ ] Cliente A: `modo_envio = 'manual'`
- [ ] Cliente B: `modo_envio = 'meta'`
- [ ] Operador de Cliente A abre envío manual → ✅ Success
- [ ] Operador de Cliente B intenta abrir envío manual → ❌ 403

#### Test Case 3: UI Condicional

- [ ] Login como Cliente A (manual)
- [ ] **Verificar:** Botón "Web WhatsApp" visible
- [ ] Login como Cliente B (meta)
- [ ] **Verificar:** Botón "Web WhatsApp" oculto

---

### 10.7 Conclusión del Modelo Dual

**Ventajas del Diseño Excluyente:**
- ✅ Simplicidad operativa (sin lógica híbrida)
- ✅ Sin estados ambiguos
- ✅ Validación clara en backend
- ✅ UI predecible para usuarios
- ✅ Fácil de testear

**Restricciones Operativas:**
- ❌ No hay modo mixto dentro del mismo cliente
- ❌ Cambio de modo requiere migración planificada
- ❌ Frontend debe adaptarse al modo del cliente

**Estado Actual (Febrero 2026):**
- Modo Manual: ✅ **Implementado** (documento actual)
- Modo Meta API: 🔜 **Roadmap Futuro** (Fase 3)

---

## 11. REFERENCIAS TÉCNICAS

### 10.1 Archivos Impactados

```
services/central-hub/
├── src/
│   └── modules/
│       └── sender/
│           ├── controllers/
│           │   └── enviosController.js          [MODIFICAR]
│           ├── routes/
│           │   └── enviosRoutes.js              [AGREGAR RUTAS]
│           └── services/
│               └── enviosService.js             [OPCIONAL]
├── frontend/
│   └── src/
│       ├── components/
│       │   └── destinatarios/
│       │       └── GestionDestinatariosPage.jsx [MODIFICAR]
│       └── services/
│           └── envios.js                        [AGREGAR MÉTODOS]
└── migrations/
    └── 2026-02-16-envios-manual-bloqueo.sql     [CREAR]
```

### 10.2 Dependencias

- MySQL >= 5.7 (transacciones InnoDB)
- Node.js >= 16
- Express.js
- Middleware de autenticación (`req.user`)

### 10.3 Variables de Entorno

Ninguna adicional requerida.

---

## CONCLUSIÓN

Este sistema transaccional convierte el envío manual de WhatsApp de un "simple enlace" a un **proceso controlado con garantías de consistencia**.

Los beneficios clave:
- ✅ Trazabilidad completa
- ✅ No hay duplicaciones
- ✅ No hay race conditions
- ✅ Estados auditables
- ✅ Aislamiento multi-cliente

**El backend es la fuente de verdad. El frontend solo refleja el estado.**

---

**Fecha de última actualización:** 2026-02-16  
**Versión del documento:** 1.1  
**Estado:** DRAFT - Pendiente de implementación
