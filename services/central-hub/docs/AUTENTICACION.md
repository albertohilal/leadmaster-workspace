# Sistema de Autenticación - LeadMaster Central Hub

## Descripción general

Sistema completo de autenticación basado en JWT (JSON Web Tokens) que protege el acceso al dashboard y APIs. Utiliza la tabla `ll_usuarios` de MySQL para gestionar usuarios y roles.

## Arquitectura

### Backend

#### 1. Base de datos (`src/config/db.js`)
- Pool de conexiones MySQL centralizado
- Configurado con variables de entorno
- Reutilizable en todos los módulos

#### 2. Servicio de autenticación (`src/modules/auth/services/authService.js`)
**Funciones principales:**
- `login(usuario, password)`: Valida credenciales con bcrypt
- `verifyToken(token)`: Verifica validez del JWT
- `getUserById(id)`: Obtiene información del usuario
- `changePassword(userId, oldPassword, newPassword)`: Cambia contraseña

#### 3. Controlador (`src/modules/auth/controllers/authController.js`)
**Endpoints:**
- `POST /auth/login`: Iniciar sesión
- `POST /auth/verify`: Verificar token
- `POST /auth/logout`: Cerrar sesión
- `POST /auth/change-password`: Cambiar contraseña (requiere autenticación)
- `GET /auth/me`: Obtener datos del usuario actual

#### 4. Middleware (`src/modules/auth/middleware/authMiddleware.js`)
**Funciones:**
- `authenticate`: Verifica JWT en requests
- `requireAdmin`: Solo permite acceso a admins
- `requireOwnClient`: Verifica que el usuario pertenezca al cliente

### Frontend

#### 1. Context de autenticación (`frontend/src/contexts/AuthContext.jsx`)
**Estado global:**
- `user`: Datos del usuario autenticado
- `token`: JWT token
- `loading`: Estado de carga
- `isAuthenticated`: Boolean si hay usuario
- `isAdmin`: Boolean si es administrador

**Funciones:**
- `login(usuario, password)`: Iniciar sesión
- `logout()`: Cerrar sesión
- `changePassword(oldPassword, newPassword)`: Cambiar contraseña

#### 2. Componente de Login (`frontend/src/components/auth/Login.jsx`)
- Formulario con usuario/contraseña
- Logo de DyD
- Manejo de errores
- Redirección al dashboard

#### 3. Rutas protegidas (`frontend/src/components/auth/ProtectedRoute.jsx`)
- Verifica autenticación antes de renderizar
- Redirecciona a `/login` si no está autenticado
- Muestra mensaje si no tiene permisos de admin

## Flujo de autenticación

### 1. Login
```
Usuario ingresa credenciales
    ↓
Frontend: AuthContext.login()
    ↓
POST /auth/login { usuario, password }
    ↓
Backend: Valida con bcrypt
    ↓
Backend: Genera JWT token
    ↓
Frontend: Guarda token en localStorage
    ↓
Frontend: Configura axios headers
    ↓
Frontend: Redirecciona a dashboard
```

### 2. Requests autenticados
```
Frontend hace request a API
    ↓
axios interceptor agrega header:
Authorization: Bearer <token>
    ↓
Backend: middleware authenticate()
    ↓
Verifica JWT
    ↓
Agrega req.user con datos del usuario
    ↓
Controlador procesa request
```

### 3. Logout
```
Usuario hace clic en "Cerrar sesión"
    ↓
Frontend: AuthContext.logout()
    ↓
POST /auth/logout (opcional)
    ↓
Frontend: Elimina token de localStorage
    ↓
Frontend: Limpia estado de user
    ↓
Frontend: Redirecciona a /login
```

## Uso en el código

### Proteger rutas de backend
```javascript
const { authenticate, requireAdmin } = require('../auth/middleware/authMiddleware');

// Ruta que requiere autenticación
router.get('/data', authenticate, controller.getData);

// Ruta que requiere ser admin
router.post('/admin-action', authenticate, requireAdmin, controller.action);

// Ruta que verifica pertenencia al cliente
router.get('/client/:cliente_id', authenticate, requireOwnClient, controller.getClient);
```

### Acceder a datos del usuario en controladores
```javascript
async getData(req, res) {
  // req.user contiene: { id, cliente_id, usuario, tipo }
  const userId = req.user.id;
  const clienteId = req.user.cliente_id;
  const isAdmin = req.user.tipo === 'admin';
  
  // Filtrar datos por cliente si no es admin
  if (!isAdmin) {
    // Solo mostrar datos del cliente del usuario
  }
}
```

### Proteger rutas de frontend
```jsx
import ProtectedRoute from './components/auth/ProtectedRoute';

// Ruta accesible solo autenticados
<Route 
  path="/dashboard" 
  element={
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  } 
/>

// Ruta solo para admins
<Route 
  path="/admin" 
  element={
    <ProtectedRoute requireAdmin={true}>
      <AdminPanel />
    </ProtectedRoute>
  } 
/>
```

### Usar autenticación en componentes
```jsx
import { useAuth } from '../contexts/AuthContext';

function MyComponent() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  
  if (!isAuthenticated) {
    return <div>No autenticado</div>;
  }
  
  return (
    <div>
      <p>Hola {user.usuario}</p>
      {isAdmin && <AdminFeatures />}
      <button onClick={logout}>Cerrar sesión</button>
    </div>
  );
}
```

## Sistema Multi-tenant

### Tabla de sesiones por cliente
```sql
CREATE TABLE ll_whatsapp_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id INT NOT NULL,
  session_name VARCHAR(100) NOT NULL,
  phone_number VARCHAR(20),
  status ENUM('DISCONNECTED', 'QR', 'CONNECTED', 'ERROR'),
  last_qr TEXT,
  last_connected DATETIME,
  UNIQUE KEY unique_client_session (cliente_id, session_name)
);
```

### Servicio de sesiones por cliente
```javascript
const clientSessionService = require('../session-manager/services/clientSessionService');

// Obtener sesión del cliente autenticado
const session = await clientSessionService.getSessionByClient(req.user.cliente_id);

// Actualizar estado
await clientSessionService.updateSessionStatus(
  req.user.cliente_id, 
  'CONNECTED', 
  phoneNumber
);
```

## Seguridad

### Contraseñas
- Hasheadas con bcrypt (10 rounds)
- Nunca se envían en respuestas
- Validación de longitud mínima (6 caracteres)

### JWT Tokens
- Firmados con SESSION_SECRET del .env
- Expiración de 24 horas
- Invalidación en cliente al logout

### Headers
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Variables de entorno necesarias

```env
# Database
DB_HOST=sv46.byethost46.org
DB_USER=iunaorg_b3toh
DB_PASSWORD=elgeneral2018
DB_NAME=iunaorg_dyd
DB_PORT=3306

# JWT Secret
SESSION_SECRET=lZwIt8yPsJuAcb9vWqVlOliAlNuede0KF5UxYP/MagodnUKtGnSdHNnXX1+oaZOF

# Backend
PORT=3010
```

## Testing

### Probar login
```bash
curl -X POST http://localhost:3010/auth/login \
  -H "Content-Type: application/json" \
  -d '{"usuario": "Haby", "password": "tu_password"}'
```

Respuesta exitosa:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 2,
    "cliente_id": 51,
    "usuario": "Haby",
    "tipo": "cliente"
  }
}
```

### Probar endpoint protegido
```bash
curl -X GET http://localhost:3010/session-manager/status \
  -H "Authorization: Bearer <tu_token>"
```

## Troubleshooting

### Error: "Token inválido o expirado"
- Verificar que el token no haya expirado (24h)
- Hacer login nuevamente
- Verificar que SESSION_SECRET sea el mismo en backend

### Error: "Usuario no encontrado o inactivo"
- Verificar que el usuario existe en `ll_usuarios`
- Verificar que el campo `activo` sea 1

### Error de CORS en frontend
- Verificar que vite.config.js tenga proxy configurado
- Backend debe tener CORS habilitado si se accede desde otro dominio

---

**Última actualización:** Diciembre 2025  
**Autor:** LeadMaster Central Hub Team
