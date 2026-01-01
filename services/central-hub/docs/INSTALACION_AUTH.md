# Instalación del Sistema de Autenticación

## Pasos para activar la autenticación

### 1. Instalar dependencias del backend
```bash
cd /home/beto/Documentos/Github/leadmaster-central-hub
npm install bcrypt jsonwebtoken
```

### 2. Crear tabla de sesiones por cliente en MySQL

Conectarse a MySQL y ejecutar:

```bash
mysql -h sv46.byethost46.org -u iunaorg_b3toh -p iunaorg_dyd < AUXILIAR/ll_whatsapp_sessions.sql
```

O desde MySQL Workbench, ejecutar el contenido de `AUXILIAR/ll_whatsapp_sessions.sql`

### 3. Verificar tabla ll_usuarios

Asegurarse de que los usuarios tengan contraseñas hasheadas con bcrypt. Si no, ejecutar:

```javascript
// Script de migración de contraseñas (ejecutar una sola vez)
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');

async function migratePasswords() {
  const pool = mysql.createPool({
    host: 'sv46.byethost46.org',
    user: 'iunaorg_b3toh',
    password: 'elgeneral2018',
    database: 'iunaorg_dyd'
  });

  // Lista de usuarios con contraseñas en texto plano
  const users = [
    { id: 1, password: 'admin123' },
    { id: 2, password: 'haby123' },
    { id: 3, password: 'marketing123' }
  ];

  for (const user of users) {
    const hash = await bcrypt.hash(user.password, 10);
    await pool.query(
      'UPDATE ll_usuarios SET password_hash = ? WHERE id = ?',
      [hash, user.id]
    );
    console.log(`✅ Usuario ${user.id} actualizado`);
  }

  console.log('✅ Migración completada');
  process.exit(0);
}

migratePasswords();
```

### 4. Reiniciar el servidor backend

```bash
# Detener servidor si está corriendo
# Ctrl + C en la terminal donde corre

# Iniciar servidor
npm run dev
```

### 5. Probar autenticación

#### Desde terminal:
```bash
# Login
curl -X POST http://localhost:3010/auth/login \
  -H "Content-Type: application/json" \
  -d '{"usuario": "Haby", "password": "tu_password"}'

# Respuesta esperada:
# {
#   "success": true,
#   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#   "user": { ... }
# }
```

#### Desde el navegador:
1. Ir a http://localhost:5173/login
2. Ingresar credenciales
3. Debería redirigir al dashboard

### 6. Verificar rutas protegidas

Todas las rutas de los módulos ahora requieren autenticación:
- `/session-manager/*` ✅ Protegido
- `/listener/*` ✅ Protegido
- `/sender/*` ✅ Protegido
- `/auth/login` ❌ Público (no requiere auth)

## Credenciales de prueba

Según la tabla `ll_usuarios`:

| Usuario | Cliente ID | Tipo | Activo |
|---------|-----------|------|--------|
| b3ion | ? | admin | 1 |
| Haby | 51 | cliente | 1 |
| marketing | 52 | cliente | 1 |

**Nota:** Las contraseñas están hasheadas. Si no sabes la contraseña, usa el script de migración para establecer nuevas contraseñas conocidas.

## Troubleshooting

### Error: "Cannot find module 'bcrypt'"
```bash
npm install bcrypt jsonwebtoken
```

### Error: "Table 'll_whatsapp_sessions' doesn't exist"
```bash
mysql -h sv46.byethost46.org -u iunaorg_b3toh -p iunaorg_dyd < AUXILIAR/ll_whatsapp_sessions.sql
```

### Error: "Token inválido o expirado"
- El token JWT expira en 24 horas
- Hacer login nuevamente
- Verificar que SESSION_SECRET en .env sea consistente

### No puedo hacer login
- Verificar que la contraseña esté hasheada con bcrypt en la BD
- Verificar que el campo `activo` sea 1
- Ver logs del backend para más detalles

### Frontend no redirige después del login
- Abrir consola del navegador (F12)
- Verificar que no haya errores de CORS
- Verificar que el token se guarde en localStorage

## Estructura de archivos creados

### Backend
```
src/
├── config/
│   └── db.js                          # Pool MySQL centralizado
├── modules/
│   └── auth/
│       ├── controllers/
│       │   └── authController.js      # Endpoints login/verify/logout
│       ├── services/
│       │   └── authService.js         # Lógica de auth + bcrypt
│       ├── middleware/
│       │   └── authMiddleware.js      # authenticate, requireAdmin
│       └── routes/
│           └── authRoutes.js          # Rutas /auth/*
│   └── session-manager/
│       └── services/
│           └── clientSessionService.js # Gestión sesiones por cliente
```

### Frontend
```
frontend/src/
├── contexts/
│   └── AuthContext.jsx                # Context global de auth
├── components/
│   └── auth/
│       ├── Login.jsx                  # Pantalla de login
│       └── ProtectedRoute.jsx         # HOC para proteger rutas
└── App.jsx                            # Actualizado con AuthProvider
```

### Documentación
```
docs/
└── AUTENTICACION.md                   # Documentación completa del sistema
```

### SQL
```
AUXILIAR/
└── ll_whatsapp_sessions.sql           # Tabla para multi-tenant
```

---

¡Sistema de autenticación listo! 🎉

Para más detalles, ver `docs/AUTENTICACION.md`
