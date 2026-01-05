# Header.jsx - Informe de Violaciones del Contrato

## Archivo Analizado
**Path**: `frontend/src/components/layout/Header.jsx`  
**Fecha**: 2026-01-04  
**Estado**: ❌ VIOLACIONES DETECTADAS

---

## CONTRATO OFICIAL (Fuente de Verdad)

### Endpoint Real del Backend
```
GET /api/whatsapp/:clienteId/status
```

### Respuesta Esperada
```javascript
{
  ok: true,
  session: {
    status: 'init' | 'qr_required' | 'connecting' | 'connected' | 'disconnected' | 'error',
    qr_status: 'none' | 'generated' | 'expired' | 'used',
    phone_number?: string,
    last_error_code?: string,
    last_error_message?: string
  }
}
```

---

## VIOLACIONES IDENTIFICADAS

### 🔴 VIOLACIÓN 1: Estado Inventado (Línea 6)

**Código Actual**:
```javascript
const [connectionStatus, setConnectionStatus] = useState('CHECKING');
```

**Problema**:
- `'CHECKING'` no existe en el contrato
- No es un valor válido de `SessionStatus`

**Corrección Requerida**:
```javascript
const [connectionStatus, setConnectionStatus] = useState(null);
```

**Justificación**: Mientras carga, el estado debe ser `null`, no un string inventado.

---

### 🔴 VIOLACIÓN 2: Endpoint Legacy (Línea 18)

**Código Actual**:
```javascript
const response = await sessionAPI.getStatus();
```

**Problema**:
- `sessionAPI.getStatus()` NO existe en el backend
- Endpoint `/session-manager/status` fue eliminado
- No recibe parámetro `clienteId` (multi-tenant)

**Corrección Requerida**:
```javascript
const clienteId = localStorage.getItem('cliente_id');
const response = await sessionAPI.getSession(clienteId);
```

**Justificación**: El endpoint real es `/api/whatsapp/:clienteId/status` implementado en `whatsappQrProxy.js`.

---

### 🔴 VIOLACIÓN 3: Campo Incorrecto (Línea 19)

**Código Actual**:
```javascript
setConnectionStatus(response.data.status || 'DISCONNECTED');
```

**Problemas Múltiples**:
1. Campo `response.data.status` no existe
2. Mapeo a estado inventado `'DISCONNECTED'`
3. No consume la estructura real de respuesta

**Corrección Requerida**:
```javascript
setConnectionStatus(response.data.session.status);
```

**Justificación**: El backend retorna `{ ok, session: { status, ... } }`, no `{ status }`.

---

### 🔴 VIOLACIÓN 4: String Literal en Error (Línea 22)

**Código Actual**:
```javascript
setConnectionStatus('ERROR');
```

**Problema**:
- Usa string literal `'ERROR'` en vez del enum oficial
- No es consistente con el contrato

**Corrección Requerida**:
```javascript
import { SessionStatus } from '../../constants/sessionStatus';
// ...
setConnectionStatus(SessionStatus.ERROR);
```

**Justificación**: Debe usar el enum `SessionStatus.ERROR` ('error') del contrato.

---

### 🔴 VIOLACIÓN 5: Función Duplicada getStatusColor() (Líneas 28-42)

**Código Actual**:
```javascript
const getStatusColor = () => {
  switch (connectionStatus) {
    case 'CONNECTED':
      return 'bg-success';
    case 'DISCONNECTED':
    case 'ERROR':
      return 'bg-danger';
    case 'QR':
      return 'bg-warning';
    default:
      return 'bg-gray-400';
  }
};
```

**Problemas**:
1. Función duplicada (también existe en Dashboard.jsx y SessionManager.jsx)
2. Usa estados inventados (`'CONNECTED'`, `'DISCONNECTED'`, `'QR'`)
3. No alineado con enums del contrato

**Corrección Requerida**:
```javascript
// ELIMINAR función local
// IMPORTAR desde constants:
import { getStatusColor } from '../../constants/sessionStatus';
```

**Justificación**: Centralizar funciones UI en un solo lugar elimina duplicación y garantiza consistencia.

---

### 🔴 VIOLACIÓN 6: Función Duplicada getStatusText() (Líneas 44-58)

**Código Actual**:
```javascript
const getStatusText = () => {
  switch (connectionStatus) {
    case 'CONNECTED':
      return 'Conectado';
    case 'DISCONNECTED':
      return 'Desconectado';
    case 'QR':
      return 'Esperando QR';
    case 'ERROR':
      return 'Error';
    default:
      return 'Verificando...';
  }
};
```

**Problemas**:
1. Función duplicada (tercera instancia en el código)
2. Usa estados inventados
3. Texto default "Verificando..." para estado desconocido

**Corrección Requerida**:
```javascript
// ELIMINAR función local
// IMPORTAR desde constants:
import { getStatusText } from '../../constants/sessionStatus';
```

**Justificación**: Single source of truth para textos de UI.

---

### 🔴 VIOLACIÓN 7: Falta clienteId

**Código Actual**:
```javascript
// No existe variable clienteId
```

**Problema**:
- No obtiene el ID del cliente desde localStorage
- El sistema es multi-tenant, cada cliente tiene su propia sesión

**Corrección Requerida**:
```javascript
const clienteId = localStorage.getItem('cliente_id');
```

**Justificación**: El endpoint requiere `clienteId` como parámetro de ruta.

---

### 🔴 VIOLACIÓN 8: No Verifica Estado Null en Render

**Código Actual** (aproximado en líneas 70-80):
```javascript
<div className={`w-3 h-3 rounded-full ${getStatusColor()}`}>
<span>{getStatusText()}</span>
```

**Problema**:
- Llama funciones helper sin verificar si `connectionStatus === null`
- Puede causar comportamiento inesperado durante la carga

**Corrección Requerida**:
```javascript
<span>
  {connectionStatus ? getStatusText(connectionStatus) : 'Cargando...'}
</span>
```

**Justificación**: Evitar llamar helpers con valores null/undefined.

---

## RESUMEN EJECUTIVO

### Estadísticas de Violaciones

| Categoría | Cantidad | Severidad |
|-----------|----------|-----------|
| Estados inventados | 2 | 🔴 CRÍTICA |
| Endpoints legacy | 1 | 🔴 CRÍTICA |
| Campos incorrectos | 1 | 🔴 CRÍTICA |
| Funciones duplicadas | 2 | 🟡 ALTA |
| Variables faltantes | 1 | 🟡 ALTA |
| Verificaciones faltantes | 1 | 🟠 MEDIA |

**Total**: 8 violaciones detectadas

---

## PLAN DE CORRECCIÓN

### Paso 1: Actualizar Imports
```javascript
import React, { useState, useEffect } from 'react';
import { sessionAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { SessionStatus, getStatusColor, getStatusText } from '../../constants/sessionStatus';
```

### Paso 2: Inicializar Estado Correctamente
```javascript
const [connectionStatus, setConnectionStatus] = useState(null); // NO 'CHECKING'
const [loading, setLoading] = useState(true);
const [showUserMenu, setShowUserMenu] = useState(false);
const { user, logout } = useAuth();
const clienteId = localStorage.getItem('cliente_id'); // AGREGAR
```

### Paso 3: Refactorizar checkStatus()
```javascript
const checkStatus = async () => {
  if (!clienteId) {
    console.warn('No hay cliente_id configurado');
    setConnectionStatus(SessionStatus.ERROR);
    setLoading(false);
    return;
  }

  try {
    const response = await sessionAPI.getSession(clienteId);
    setConnectionStatus(response.data.session.status); // Sin mapeo
  } catch (error) {
    console.error('Error checking status:', error);
    setConnectionStatus(SessionStatus.ERROR);
  } finally {
    setLoading(false);
  }
};
```

### Paso 4: Eliminar Funciones Locales
```javascript
// ELIMINAR getStatusColor() completo (líneas 28-42)
// ELIMINAR getStatusText() completo (líneas 44-58)
```

### Paso 5: Actualizar Renderizado
```javascript
<div className="flex items-center space-x-2">
  <span className="text-sm text-gray-600">WhatsApp:</span>
  <div className="flex items-center space-x-2">
    <div className={`w-3 h-3 rounded-full ${
      connectionStatus ? getStatusColor(connectionStatus) : 'bg-gray-400'
    } ${loading ? 'animate-pulse' : ''}`}></div>
    <span className="text-sm font-medium text-gray-700">
      {connectionStatus ? getStatusText(connectionStatus) : 'Cargando...'}
    </span>
  </div>
</div>
```

---

## IMPACTO ESPERADO

### Antes de la Corrección
- ❌ 8 violaciones del contrato
- ❌ Estados inventados en 3 archivos
- ❌ Funciones duplicadas en 3 archivos
- ❌ Endpoints legacy que no existen
- ❌ Mapeos incorrectos de estado

### Después de la Corrección
- ✅ 100% alineado con contrato
- ✅ Single source of truth para estados
- ✅ Funciones centralizadas en constants/
- ✅ Endpoints reales del backend
- ✅ Consumo directo sin mapeo

### Beneficios
1. **Consistencia**: Mismo comportamiento en Header, Dashboard y SessionManager
2. **Mantenibilidad**: Cambios en constants/ afectan a todos los componentes
3. **Debugging**: Estados visibles son los mismos que el backend envía
4. **Simplicidad**: Menos código, más claro

---

## CÓDIGO COMPARATIVO

### ANTES (INCORRECTO)
```javascript
import React, { useState, useEffect } from 'react';
import { sessionAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const Header = () => {
  const [connectionStatus, setConnectionStatus] = useState('CHECKING'); // ❌

  const checkStatus = async () => {
    try {
      const response = await sessionAPI.getStatus(); // ❌
      setConnectionStatus(response.data.status || 'DISCONNECTED'); // ❌
    } catch (error) {
      setConnectionStatus('ERROR'); // ❌
    }
  };

  const getStatusColor = () => { // ❌ Duplicado
    switch (connectionStatus) {
      case 'CONNECTED': return 'bg-success'; // ❌ Estado inventado
      // ...
    }
  };

  const getStatusText = () => { // ❌ Duplicado
    // ...
  };

  return (
    <span>{getStatusText()}</span> // ❌ No verifica null
  );
};
```

### DESPUÉS (CORRECTO)
```javascript
import React, { useState, useEffect } from 'react';
import { sessionAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { SessionStatus, getStatusColor, getStatusText } from '../../constants/sessionStatus'; // ✅

const Header = () => {
  const [connectionStatus, setConnectionStatus] = useState(null); // ✅
  const clienteId = localStorage.getItem('cliente_id'); // ✅

  const checkStatus = async () => {
    if (!clienteId) return;
    
    try {
      const response = await sessionAPI.getSession(clienteId); // ✅
      setConnectionStatus(response.data.session.status); // ✅ Sin mapeo
    } catch (error) {
      setConnectionStatus(SessionStatus.ERROR); // ✅ Enum oficial
    }
  };

  // ✅ Sin funciones duplicadas (importadas)

  return (
    <span>
      {connectionStatus ? getStatusText(connectionStatus) : 'Cargando...'} // ✅
    </span>
  );
};
```

---

## LÍNEAS A MODIFICAR

| Línea | Acción | Código Original | Código Corregido |
|-------|--------|-----------------|------------------|
| 2-3 | Agregar import | `import { sessionAPI }` | `import { SessionStatus, getStatusColor, getStatusText }` |
| 6 | Cambiar | `useState('CHECKING')` | `useState(null)` |
| 9 | Agregar | - | `const clienteId = localStorage.getItem('cliente_id');` |
| 18 | Cambiar | `sessionAPI.getStatus()` | `sessionAPI.getSession(clienteId)` |
| 19 | Cambiar | `response.data.status \|\| 'DISCONNECTED'` | `response.data.session.status` |
| 22 | Cambiar | `'ERROR'` | `SessionStatus.ERROR` |
| 28-42 | Eliminar | `getStatusColor() { ... }` | (importada) |
| 44-58 | Eliminar | `getStatusText() { ... }` | (importada) |
| ~75 | Cambiar | `getStatusColor()` | `getStatusColor(connectionStatus)` con check null |
| ~78 | Cambiar | `getStatusText()` | `getStatusText(connectionStatus)` con check null |

**Total**: 10 líneas/bloques modificados

---

## VALIDACIÓN POST-CORRECCIÓN

### Checklist de Verificación

- [ ] Import de `SessionStatus` presente
- [ ] Import de `getStatusColor` presente
- [ ] Import de `getStatusText` presente
- [ ] Estado inicial es `null` (no 'CHECKING')
- [ ] Variable `clienteId` obtiene valor de localStorage
- [ ] Llamada a `sessionAPI.getSession(clienteId)`
- [ ] Consumo de `response.data.session.status`
- [ ] Uso de `SessionStatus.ERROR` en catch
- [ ] Sin funciones `getStatusColor()` local
- [ ] Sin funciones `getStatusText()` local
- [ ] Verificación de null antes de llamar helpers
- [ ] Sin estados inventados en todo el archivo

### Prueba Manual

1. Abrir DevTools
2. Verificar en Network que se llama a `/api/whatsapp/{clienteId}/status`
3. Verificar que NO se llama a `/session-manager/status`
4. En Console, verificar que `connectionStatus` es null inicialmente
5. Después de cargar, verificar que tiene valor del enum ('connected', 'disconnected', etc.)
6. NO debe mostrar 'CHECKING' en ningún momento

---

## CONCLUSIÓN

Header.jsx presenta **8 violaciones críticas** del contrato oficial.

**Estado actual**: ❌ NO CUMPLE con `SESSION_MANAGER_API_CONTRACT.md`

**Después de correcciones**: ✅ CUMPLIRÁ 100% con el contrato

**Archivos relacionados ya corregidos**:
- ✅ `constants/sessionStatus.js` (STEP 1)
- ✅ `services/api.js` (STEP 2)
- ✅ `components/whatsapp/SessionManager.jsx` (STEP 3)
- ✅ `components/dashboard/Dashboard.jsx` (STEP 4)
- ⏳ `components/layout/Header.jsx` (STEP 5 - PENDIENTE)

**Próximo paso**: Aplicar correcciones en Header.jsx para completar la migración frontend.
