# Data Test IDs Recomendados para E2E Estable

## Objetivo
Hacer los tests E2E 100% estables y resistentes a cambios de diseño en producción.

---

## Vista: Login

### Formulario de Login
```jsx
<form data-testid="login-form">
  <input 
    data-testid="username-input"
    name="username"
    type="text"
  />
  
  <input 
    data-testid="password-input"
    name="password"
    type="password"
  />
  
  <button 
    data-testid="login-button"
    type="submit"
  >
    Iniciar Sesión
  </button>
</form>
```

### Mensajes de Error
```jsx
<div 
  data-testid="error-message"
  role="alert"
>
  {errorMessage}
</div>
```

---

## Vista: Navegación Principal

### Menú de Navegación
```jsx
<nav data-testid="main-nav">
  <a 
    data-testid="nav-dashboard"
    href="/dashboard"
  >
    Dashboard
  </a>
  
  <a 
    data-testid="nav-whatsapp"
    href="/whatsapp"
  >
    WhatsApp
  </a>
  
  <a 
    data-testid="nav-campanas"
    href="/campanas"
  >
    Campañas
  </a>
</nav>
```

### Usuario y Logout
```jsx
<div data-testid="user-menu">
  <span data-testid="username-display">{userName}</span>
  
  <button data-testid="logout-button">
    Cerrar Sesión
  </button>
</div>
```

---

## Vista: WhatsApp

### Estado de Conexión
```jsx
<div 
  data-testid="whatsapp-status"
  className={`status-${state.toLowerCase()}`}
>
  Estado: {state}
</div>

{/* Alternativa con más detalle */}
<div data-testid="whatsapp-connection-info">
  <span data-testid="status-label">Estado:</span>
  <span data-testid="status-value">{state}</span>
  <span data-testid="session-label">Sesión:</span>
  <span data-testid="session-value">{session}</span>
</div>
```

### QR Code (cuando aplique)
```jsx
{state === 'QR_REQUIRED' && (
  <div data-testid="qr-container">
    <img 
      data-testid="qr-code"
      src={qrBase64}
      alt="QR Code WhatsApp"
    />
    <p data-testid="qr-instructions">
      Escanea este código con tu WhatsApp
    </p>
  </div>
)}
```

### Botones de Acción
```jsx
{/* Botón de Conectar/Reconectar */}
{(state === 'DISCONNECTED' || state === 'QR_REQUIRED') && (
  <button data-testid="connect-button">
    Conectar WhatsApp
  </button>
)}

{/* Botón de Desconectar */}
{state === 'READY' && (
  <button data-testid="disconnect-button">
    Desconectar
  </button>
)}

{/* Botón de Enviar Mensaje */}
{state === 'READY' && (
  <button data-testid="send-message-button">
    Enviar Mensaje
  </button>
)}
```

### Formulario de Envío de Mensajes
```jsx
<form data-testid="message-form">
  <input 
    data-testid="phone-input"
    name="to"
    type="tel"
    placeholder="Número de teléfono"
  />
  
  <textarea 
    data-testid="message-input"
    name="message"
    placeholder="Escribe tu mensaje"
  />
  
  <button 
    data-testid="send-button"
    type="submit"
  >
    Enviar
  </button>
</form>
```

---

## Vista: Campañas (opcional para futuras pruebas)

### Lista de Campañas
```jsx
<div data-testid="campaigns-list">
  {campaigns.map(campaign => (
    <div 
      key={campaign.id}
      data-testid={`campaign-item-${campaign.id}`}
    >
      <h3 data-testid={`campaign-name-${campaign.id}`}>
        {campaign.nombre}
      </h3>
      
      <span data-testid={`campaign-status-${campaign.id}`}>
        {campaign.estado}
      </span>
      
      <button 
        data-testid={`campaign-edit-${campaign.id}`}
        onClick={() => editCampaign(campaign.id)}
      >
        Editar
      </button>
    </div>
  ))}
</div>
```

---

## Implementación Recomendada

### 1. Crear constantes centralizadas

```typescript
// src/constants/testIds.ts
export const TEST_IDS = {
  // Login
  LOGIN_FORM: 'login-form',
  USERNAME_INPUT: 'username-input',
  PASSWORD_INPUT: 'password-input',
  LOGIN_BUTTON: 'login-button',
  ERROR_MESSAGE: 'error-message',
  
  // Navigation
  MAIN_NAV: 'main-nav',
  NAV_WHATSAPP: 'nav-whatsapp',
  NAV_DASHBOARD: 'nav-dashboard',
  NAV_CAMPAIGNS: 'nav-campanas',
  LOGOUT_BUTTON: 'logout-button',
  
  // WhatsApp
  WHATSAPP_STATUS: 'whatsapp-status',
  QR_CONTAINER: 'qr-container',
  QR_CODE: 'qr-code',
  CONNECT_BUTTON: 'connect-button',
  DISCONNECT_BUTTON: 'disconnect-button',
  SEND_MESSAGE_BUTTON: 'send-message-button',
  
  // Message Form
  MESSAGE_FORM: 'message-form',
  PHONE_INPUT: 'phone-input',
  MESSAGE_INPUT: 'message-input',
  SEND_BUTTON: 'send-button',
} as const;
```

### 2. Usar en componentes React

```tsx
import { TEST_IDS } from '@/constants/testIds';

function LoginForm() {
  return (
    <form data-testid={TEST_IDS.LOGIN_FORM}>
      <input 
        data-testid={TEST_IDS.USERNAME_INPUT}
        name="username"
        type="text"
      />
      <input 
        data-testid={TEST_IDS.PASSWORD_INPUT}
        name="password"
        type="password"
      />
      <button 
        data-testid={TEST_IDS.LOGIN_BUTTON}
        type="submit"
      >
        Login
      </button>
    </form>
  );
}
```

### 3. Usar en tests Playwright

```javascript
const { TEST_IDS } = require('../src/constants/testIds');

test('login flow', async ({ page }) => {
  await page.locator(`[data-testid="${TEST_IDS.USERNAME_INPUT}"]`).fill('admin');
  await page.locator(`[data-testid="${TEST_IDS.PASSWORD_INPUT}"]`).fill('pass');
  await page.locator(`[data-testid="${TEST_IDS.LOGIN_BUTTON}"]`).click();
});
```

---

## Beneficios

✅ **Estabilidad:** Tests no se rompen por cambios de CSS/clases  
✅ **Claridad:** data-testid indica explícitamente elementos interactuables  
✅ **Mantenibilidad:** Cambios en un solo archivo (testIds.ts)  
✅ **Documentación:** Los test IDs documentan la funcionalidad  
✅ **Performance:** Selectores específicos son más rápidos  

---

## Prioridad de Implementación

### Alta Prioridad (Implementar primero)
1. ✅ Login Form (username, password, button)
2. ✅ Navigation (nav-whatsapp link)
3. ✅ WhatsApp Status (estado de conexión)
4. ✅ Logout Button

### Media Prioridad
5. QR Container y QR Code
6. Connect/Disconnect Buttons
7. Send Message Button

### Baja Prioridad
8. Message Form (inputs de mensaje)
9. Campaigns List
10. Error Messages específicos

---

## Ejemplo Completo: Vista WhatsApp

```tsx
import { TEST_IDS } from '@/constants/testIds';

function WhatsAppView() {
  const [status, setStatus] = useState('DISCONNECTED');
  const [qrCode, setQrCode] = useState(null);
  
  return (
    <div className="whatsapp-container">
      {/* Estado */}
      <div 
        data-testid={TEST_IDS.WHATSAPP_STATUS}
        className={`status-badge status-${status.toLowerCase()}`}
      >
        Estado: {status}
      </div>
      
      {/* QR Code */}
      {status === 'QR_REQUIRED' && (
        <div data-testid={TEST_IDS.QR_CONTAINER}>
          <img 
            data-testid={TEST_IDS.QR_CODE}
            src={qrCode}
            alt="QR Code WhatsApp"
          />
        </div>
      )}
      
      {/* Botones */}
      {status === 'DISCONNECTED' && (
        <button 
          data-testid={TEST_IDS.CONNECT_BUTTON}
          onClick={handleConnect}
        >
          Conectar WhatsApp
        </button>
      )}
      
      {status === 'READY' && (
        <>
          <button 
            data-testid={TEST_IDS.DISCONNECT_BUTTON}
            onClick={handleDisconnect}
          >
            Desconectar
          </button>
          
          <button 
            data-testid={TEST_IDS.SEND_MESSAGE_BUTTON}
            onClick={handleSend}
          >
            Enviar Mensaje
          </button>
        </>
      )}
    </div>
  );
}
```

---

## Validación

Después de agregar los `data-testid`, ejecutar:

```bash
# Test que debe pasar 100% si están implementados
E2E_BASE_URL=https://desarrolloydisenioweb.com.ar \
E2E_USER=admin \
E2E_PASS=tu_password \
npx playwright test --project="E2E Tests - WhatsApp"
```

Si todos los `data-testid` están en su lugar, el test no usará fallbacks genéricos y será mucho más rápido y estable.
