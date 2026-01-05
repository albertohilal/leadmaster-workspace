# Migración Frontend - Alineación con Contrato Session Manager

## Resumen Ejecutivo

El frontend actualmente **VIOLA** el contrato `SESSION_MANAGER_API_CONTRACT.md` al:
1. Inventar estados personalizados (`CONNECTED`, `DISCONNECTED`, `QR`, `ERROR`, `CHECKING`)
2. Mapear estados del backend a estados inventados
3. Usar endpoints legacy no definidos en el contrato
4. Usar `hasQR` en vez del enum `qr_status`

**Backend**: ✅ 100% alineado con contrato  
**Frontend**: ❌ Necesita migración completa

---

## Archivos Afectados

### 1. `frontend/src/services/api.js`
**Problema**: Define métodos legacy que no existen en el contrato
```javascript
// INCORRECTO - No están en el contrato
getStatus: () => api.get('/session-manager/status')
getState: () => api.get('/session-manager/state')
getQR: () => api.get('/session-manager/qr')
```

**Solución**: Usar endpoints del contrato
```javascript
// CORRECTO - Endpoints del contrato
getSession: (clienteId) => api.get(`/api/whatsapp/${clienteId}/status`)
requestQR: (clienteId) => api.post(`/api/whatsapp/${clienteId}/qr`)
```

---

### 2. `frontend/src/components/whatsapp/SessionManager.jsx`
**Problema**: Usa estados inventados y mapea respuestas del backend

**Líneas problemáticas**:
- Línea 11: `const [sessionStatus, setSessionStatus] = useState('DISCONNECTED');`
- Líneas 40-51: Mapeo de 'conectado'/'desconectado' a estados custom
- Línea 46: `const hasQR = response.data.hasQR` (debería usar `qr_status`)
- Línea 41: Llamada a endpoint legacy `sessionAPI.getStatus()`

**Solución**: Consumir `session.status` directamente sin mapeo

---

### 3. `frontend/src/components/dashboard/Dashboard.jsx`
**Problema**: Inventa estado `CHECKING`

**Línea 11**: 
```javascript
whatsappStatus: 'CHECKING'  // ❌ No existe en contrato
```

**Solución**: Usar `SessionStatus.INIT` o null mientras carga

---

### 4. `frontend/src/components/layout/Header.jsx`
**Problema**: Inventa estado `CHECKING`

**Línea 6**: 
```javascript
const [connectionStatus, setConnectionStatus] = useState('CHECKING'); // ❌
```

**Solución**: Usar `SessionStatus.INIT` o null mientras carga

---

## Propuesta de Implementación

### PASO 1: Crear Enums del Contrato

**Archivo**: `frontend/src/constants/sessionStatus.js`

```javascript
/**
 * Enums oficiales del contrato SESSION_MANAGER_API_CONTRACT.md
 * NO INVENTAR ESTADOS ADICIONALES
 */

export const SessionStatus = Object.freeze({
  INIT: 'init',
  QR_REQUIRED: 'qr_required',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  ERROR: 'error'
});

export const QRStatus = Object.freeze({
  NONE: 'none',
  GENERATED: 'generated',
  EXPIRED: 'expired',
  USED: 'used'
});

/**
 * Funciones PURAS de mapeo UI (solo presentación)
 * NO cambian la lógica de negocio
 */
export const getStatusColor = (status) => {
  switch (status) {
    case SessionStatus.CONNECTED:
      return 'green';
    case SessionStatus.CONNECTING:
      return 'blue';
    case SessionStatus.QR_REQUIRED:
      return 'yellow';
    case SessionStatus.DISCONNECTED:
      return 'gray';
    case SessionStatus.ERROR:
      return 'red';
    case SessionStatus.INIT:
    default:
      return 'gray';
  }
};

export const getStatusText = (status) => {
  switch (status) {
    case SessionStatus.CONNECTED:
      return 'Conectado';
    case SessionStatus.CONNECTING:
      return 'Conectando...';
    case SessionStatus.QR_REQUIRED:
      return 'QR Requerido';
    case SessionStatus.DISCONNECTED:
      return 'Desconectado';
    case SessionStatus.ERROR:
      return 'Error';
    case SessionStatus.INIT:
      return 'Inicializando...';
    default:
      return 'Desconocido';
  }
};

export const getQRStatusText = (qrStatus) => {
  switch (qrStatus) {
    case QRStatus.GENERATED:
      return 'QR Generado';
    case QRStatus.EXPIRED:
      return 'QR Expirado';
    case QRStatus.USED:
      return 'QR Usado';
    case QRStatus.NONE:
    default:
      return 'Sin QR';
  }
};
```

---

### PASO 2: Actualizar API Service

**Archivo**: `frontend/src/services/api.js`

```javascript
// ANTES (INCORRECTO)
export const sessionAPI = {
  getStatus: () => api.get('/session-manager/status'),
  getState: () => api.get('/session-manager/state'),
  getQR: () => api.get('/session-manager/qr'),
  disconnect: () => api.post('/session-manager/disconnect'),
  // ...
};

// DESPUÉS (CORRECTO - Alineado con contrato)
export const sessionAPI = {
  /**
   * GET /api/whatsapp/:clienteId/status
   * Retorna: { status, qr_status, qr_code?, error? }
   */
  getSession: (clienteId) => api.get(`/api/whatsapp/${clienteId}/status`),
  
  /**
   * POST /api/whatsapp/:clienteId/qr
   * Retorna: { status, qr_status, qr_code }
   * Errores: 409 (already connected), 500 (generation failed)
   */
  requestQR: (clienteId) => api.post(`/api/whatsapp/${clienteId}/qr`),
  
  /**
   * POST /session-manager/disconnect (mantener si existe en backend)
   */
  disconnect: () => api.post('/session-manager/disconnect')
};
```

---

### PASO 3: Refactorizar SessionManager.jsx

**Cambios principales**:
1. Eliminar estados custom (`CONNECTED`, `DISCONNECTED`, etc.)
2. Usar `session.status` directamente del contrato
3. Reaccionar con `switch` explícito sobre `SessionStatus`
4. Usar `qr_status` en vez de `hasQR`

```javascript
import React, { useState, useEffect } from 'react';
import { sessionAPI } from '../../services/api';
import { SessionStatus, QRStatus, getStatusColor, getStatusText } from '../../constants/sessionStatus';

const SessionManager = () => {
  // Estado: Objeto completo de la sesión (no inventar estados)
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const clienteId = localStorage.getItem('cliente_id');

  // Cargar estado de la sesión
  const loadSession = async () => {
    if (!clienteId) {
      setError('No hay cliente_id configurado');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await sessionAPI.getSession(clienteId);
      
      // Guardar objeto completo del contrato
      setSession({
        status: response.data.status,
        qr_status: response.data.qr_status,
        qr_code: response.data.qr_code || null,
        error: response.data.error || null
      });
      
    } catch (err) {
      console.error('Error al cargar sesión:', err);
      setError(err.response?.data?.error || 'Error al cargar sesión');
    } finally {
      setLoading(false);
    }
  };

  // Solicitar nuevo QR
  const handleRequestQR = async () => {
    if (!clienteId) return;

    try {
      setLoading(true);
      setError(null);
      
      const response = await sessionAPI.requestQR(clienteId);
      
      // Actualizar con respuesta del contrato
      setSession({
        status: response.data.status,
        qr_status: response.data.qr_status,
        qr_code: response.data.qr_code,
        error: null
      });
      
    } catch (err) {
      console.error('Error al solicitar QR:', err);
      
      // Manejar errores específicos del contrato
      if (err.response?.status === 409) {
        setError('La sesión ya está conectada');
      } else if (err.response?.status === 500) {
        setError('Error al generar QR');
      } else {
        setError(err.response?.data?.error || 'Error desconocido');
      }
    } finally {
      setLoading(false);
    }
  };

  // Polling cada 5 segundos
  useEffect(() => {
    loadSession();
    const interval = setInterval(loadSession, 5000);
    return () => clearInterval(interval);
  }, [clienteId]);

  // Renderizado condicional basado en session.status (NO estados inventados)
  const renderContent = () => {
    if (loading && !session) {
      return <div>Cargando...</div>;
    }

    if (!session) {
      return <div>No hay información de sesión</div>;
    }

    // Switch explícito sobre SessionStatus del contrato
    switch (session.status) {
      case SessionStatus.CONNECTED:
        return (
          <div className="session-connected">
            <div className="status-badge" style={{ background: getStatusColor(session.status) }}>
              {getStatusText(session.status)}
            </div>
            <p>WhatsApp está conectado y listo para enviar mensajes</p>
            <button onClick={() => sessionAPI.disconnect()}>
              Desconectar
            </button>
          </div>
        );

      case SessionStatus.QR_REQUIRED:
        return (
          <div className="session-qr-required">
            <div className="status-badge" style={{ background: getStatusColor(session.status) }}>
              {getStatusText(session.status)}
            </div>
            
            {/* Mostrar QR si está generado */}
            {session.qr_status === QRStatus.GENERATED && session.qr_code ? (
              <div className="qr-container">
                <img src={session.qr_code} alt="QR Code" />
                <p>Escanea este código con WhatsApp</p>
              </div>
            ) : session.qr_status === QRStatus.EXPIRED ? (
              <div className="qr-expired">
                <p>El código QR ha expirado</p>
                <button onClick={handleRequestQR} disabled={loading}>
                  Generar Nuevo QR
                </button>
              </div>
            ) : (
              <button onClick={handleRequestQR} disabled={loading}>
                Generar QR
              </button>
            )}
          </div>
        );

      case SessionStatus.CONNECTING:
        return (
          <div className="session-connecting">
            <div className="status-badge" style={{ background: getStatusColor(session.status) }}>
              {getStatusText(session.status)}
            </div>
            <p>Estableciendo conexión con WhatsApp...</p>
          </div>
        );

      case SessionStatus.DISCONNECTED:
        return (
          <div className="session-disconnected">
            <div className="status-badge" style={{ background: getStatusColor(session.status) }}>
              {getStatusText(session.status)}
            </div>
            <p>La sesión de WhatsApp está desconectada</p>
            <button onClick={handleRequestQR} disabled={loading}>
              Conectar
            </button>
          </div>
        );

      case SessionStatus.ERROR:
        return (
          <div className="session-error">
            <div className="status-badge" style={{ background: getStatusColor(session.status) }}>
              {getStatusText(session.status)}
            </div>
            <p className="error-message">{session.error || 'Error desconocido'}</p>
            <button onClick={loadSession}>Reintentar</button>
          </div>
        );

      case SessionStatus.INIT:
        return (
          <div className="session-init">
            <div className="status-badge" style={{ background: getStatusColor(session.status) }}>
              {getStatusText(session.status)}
            </div>
            <p>Inicializando sesión...</p>
          </div>
        );

      default:
        return (
          <div className="session-unknown">
            <p>Estado desconocido: {session.status}</p>
          </div>
        );
    }
  };

  return (
    <div className="session-manager">
      <h2>Gestión de Sesión WhatsApp</h2>
      {error && <div className="error-banner">{error}</div>}
      {renderContent()}
    </div>
  );
};

export default SessionManager;
```

---

### PASO 4: Actualizar Dashboard.jsx

```javascript
import React, { useState, useEffect } from 'react';
import { sessionAPI } from '../../services/api';
import { SessionStatus, getStatusColor, getStatusText } from '../../constants/sessionStatus';

const Dashboard = () => {
  const [whatsappSession, setWhatsappSession] = useState(null); // null mientras carga
  const clienteId = localStorage.getItem('cliente_id');

  useEffect(() => {
    const loadWhatsAppStatus = async () => {
      try {
        const response = await sessionAPI.getSession(clienteId);
        setWhatsappSession({
          status: response.data.status,
          qr_status: response.data.qr_status
        });
      } catch (err) {
        console.error('Error al cargar estado WhatsApp:', err);
        setWhatsappSession({ status: SessionStatus.ERROR });
      }
    };

    loadWhatsAppStatus();
    const interval = setInterval(loadWhatsAppStatus, 10000);
    return () => clearInterval(interval);
  }, [clienteId]);

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>
      
      <div className="whatsapp-status-card">
        <h3>Estado WhatsApp</h3>
        {whatsappSession ? (
          <div 
            className="status-indicator"
            style={{ background: getStatusColor(whatsappSession.status) }}
          >
            {getStatusText(whatsappSession.status)}
          </div>
        ) : (
          <div>Cargando...</div>
        )}
      </div>
      
      {/* Resto del dashboard */}
    </div>
  );
};

export default Dashboard;
```

---

### PASO 5: Actualizar Header.jsx

```javascript
import React, { useState, useEffect } from 'react';
import { sessionAPI } from '../../services/api';
import { SessionStatus, getStatusColor } from '../../constants/sessionStatus';

const Header = () => {
  const [connectionStatus, setConnectionStatus] = useState(null); // null mientras carga
  const clienteId = localStorage.getItem('cliente_id');

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await sessionAPI.getSession(clienteId);
        setConnectionStatus(response.data.status);
      } catch (err) {
        setConnectionStatus(SessionStatus.ERROR);
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 15000);
    return () => clearInterval(interval);
  }, [clienteId]);

  return (
    <header className="main-header">
      <div className="logo">LeadMaster</div>
      
      <div className="connection-indicator">
        <div 
          className="status-dot"
          style={{ 
            background: connectionStatus ? getStatusColor(connectionStatus) : 'gray'
          }}
        />
        {connectionStatus === SessionStatus.CONNECTED ? 'Conectado' : 'Desconectado'}
      </div>
    </header>
  );
};

export default Header;
```

---

## Reglas Absolutas

### ❌ NO HACER

1. **NO inventar estados frontend**: `WAITING_QR`, `ACTIVE`, `ONLINE`, `OFFLINE`, `READY`, `CHECKING`, `AUTHENTICATED`
2. **NO mapear estados del backend**: No hacer `conectado` → `CONNECTED`
3. **NO usar `hasQR`**: Usar `qr_status === QRStatus.GENERATED`
4. **NO llamar endpoints legacy**: No usar `/session-manager/state` o `/session-manager/status`

### ✅ HACER

1. **Usar session.status directamente**: Consumir el enum tal cual viene del backend
2. **Switch explícito**: Reaccionar a `SessionStatus.CONNECTED`, `SessionStatus.QR_REQUIRED`, etc.
3. **Usar qr_status**: Verificar con `QRStatus.GENERATED`, `QRStatus.EXPIRED`, etc.
4. **Funciones UI puras**: `getStatusColor()` y `getStatusText()` solo para presentación

---

## Beneficios

1. **Single Source of Truth**: Frontend y backend usan los mismos enums
2. **Eliminación de ambigüedad**: No hay mapeos que puedan fallar
3. **Mantenibilidad**: Cambios en el contrato se propagan automáticamente
4. **Debugging simplificado**: Estados visibles en toda la aplicación son idénticos
5. **Contrato cumplido**: 100% alineación con `SESSION_MANAGER_API_CONTRACT.md`

---

## Orden de Implementación

1. ✅ Crear `constants/sessionStatus.js`
2. ✅ Actualizar `services/api.js`
3. ✅ Refactorizar `SessionManager.jsx`
4. ✅ Actualizar `Dashboard.jsx`
5. ✅ Actualizar `Header.jsx`
6. ✅ Eliminar cualquier referencia a estados custom
7. ✅ Verificar con `grep` que no queden estados inventados
8. ✅ Testing manual de flujo completo

---

## Verificación Final

Después de la implementación, verificar con:

```bash
# Buscar estados inventados
grep -r "CONNECTED\|DISCONNECTED\|CHECKING\|WAITING" frontend/src/ --include="*.jsx" --include="*.js"

# Buscar endpoints legacy
grep -r "/session-manager/status\|/session-manager/state\|/session-manager/qr" frontend/src/

# Verificar importación de enums
grep -r "import.*SessionStatus\|import.*QRStatus" frontend/src/
```

**Resultado esperado**: 
- ❌ Cero matches para estados custom
- ❌ Cero matches para endpoints legacy
- ✅ Múltiples imports de SessionStatus/QRStatus

---

## Conclusión

Esta migración **elimina completamente** la capa de abstracción inventada en el frontend y alinea 100% con el contrato definido en `SESSION_MANAGER_API_CONTRACT.md`.

**Backend**: ✅ Completo  
**Frontend**: ⏳ Listo para implementar

¿Proceder con la implementación?
