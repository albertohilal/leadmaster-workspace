# 🔧 Documentación Técnica - Edición de Campañas

## 🏗️ Arquitectura del Sistema

### Componentes Principales

```
Frontend (React)          Backend (Node.js)         Database (MySQL)
├─ CampaignsManager.jsx   ├─ campaignsController.js  ├─ ll_campanias_whatsapp
├─ services/api.js        ├─ routes/campaigns.js     ├─ ll_envios_whatsapp  
└─ Modal de Edición       └─ middleware/auth.js      └─ ll_usuarios
```

### Flujo de Datos

```
Usuario → Frontend → API → Validaciones → Database → Response → Frontend → UI Update
```

---

## 🔒 Seguridad y Validaciones

### Backend: Validaciones Críticas

#### 1. **Verificación de Propiedad**
```javascript
// Solo el cliente propietario puede editar sus campañas
const campaignQuery = `
  SELECT c.id, c.estado, c.cliente_id,
         COALESCE(env.enviados, 0) as enviados
  FROM ll_campanias_whatsapp c
  LEFT JOIN (
    SELECT campania_id, COUNT(*) as enviados 
    FROM ll_envios_whatsapp 
    WHERE estado = 'enviado'
    GROUP BY campania_id
  ) env ON c.id = env.campania_id
  WHERE c.id = ? AND c.cliente_id = ?
`;
```

#### 2. **Validación de Estados Editables**
```javascript
// Estados que NO permiten edición
const estadosNoEditables = ['activa', 'completada', 'pausada'];

if (estadosNoEditables.includes(campaign.estado) || campaign.enviados > 0) {
  return res.status(403).json({ 
    success: false, 
    error: 'No se pueden editar campañas que ya han comenzado a enviarse',
    details: {
      estado_actual: campaign.estado,
      mensajes_enviados: campaign.enviados,
      razon: campaign.enviados > 0 
        ? 'La campaña ya tiene mensajes enviados' 
        : `Estado "${campaign.estado}" no permite edición`
    }
  });
}
```

#### 3. **Validación de Entrada**
```javascript
// Campos obligatorios
if (!nombre || nombre.trim().length === 0) {
  return res.status(400).json({ 
    success: false, 
    error: 'El nombre de la campaña es requerido' 
  });
}

if (!mensaje || mensaje.trim().length === 0) {
  return res.status(400).json({ 
    success: false, 
    error: 'El mensaje de la campaña es requerido' 
  });
}

// Validar fecha si es programada
if (programada && (!fecha_envio || isNaN(new Date(fecha_envio)))) {
  return res.status(400).json({ 
    success: false, 
    error: 'Fecha y hora de envío requeridas para campañas programadas' 
  });
}
```

### Frontend: Validaciones Pre-envío

```javascript
const handleEditCampaign = (campaign) => {
  // Validaciones del cliente para UX inmediato
  const estadosNoEditables = ['activa', 'completada', 'pausada'];
  const hayEnviados = campaign.enviados > 0;
  
  if (estadosNoEditables.includes(campaign.estado) || hayEnviados) {
    let mensaje = 'No se pueden editar campañas que ya han comenzado a enviarse.';
    
    if (hayEnviados) {
      mensaje += `\n\nEsta campaña ya tiene ${campaign.enviados} mensajes enviados.`;
      mensaje += '\nEditar el contenido crearía inconsistencias en los datos.';
    }
    
    alert(mensaje);
    return;
  }
  
  // Proceder con edición...
};
```

---

## 🛠️ API Endpoints

### PUT `/sender/campaigns/:id`

#### Request
```http
PUT /sender/campaigns/123
Authorization: Bearer jwt_token_here
Content-Type: application/json

{
  "nombre": "Campaña Actualizada",
  "descripcion": "Nueva descripción",
  "mensaje": "Mensaje actualizado para WhatsApp",
  "programada": true,
  "fecha_envio": "2025-12-25T09:00:00.000Z"
}
```

#### Response Success (200)
```json
{
  "success": true,
  "message": "Campaña actualizada exitosamente. Estado cambiado a 'Pendiente Aprobación'.",
  "data": {
    "id": 123,
    "nombre": "Campaña Actualizada",
    "descripcion": "Nueva descripción",
    "mensaje": "Mensaje actualizado para WhatsApp",
    "estado": "pendiente_aprobacion",
    "programada": 1,
    "fecha_envio": "2025-12-25T09:00:00.000Z",
    "cliente_id": 51,
    "fecha_actualizacion": "2025-12-19T15:30:00.000Z"
  },
  "warnings": [
    "La campaña requiere nueva aprobación del administrador",
    "No se puede enviar hasta que sea aprobada"
  ]
}
```

#### Response Error (403)
```json
{
  "success": false,
  "error": "No se pueden editar campañas que ya han comenzado a enviarse",
  "details": {
    "estado_actual": "completada",
    "mensajes_enviados": 150,
    "razon": "La campaña ya tiene mensajes enviados"
  }
}
```

#### Response Error (400)
```json
{
  "success": false,
  "error": "El mensaje de la campaña es requerido"
}
```

#### Response Error (404)
```json
{
  "success": false,
  "error": "Campaña no encontrada"
}
```

---

## 🗄️ Esquema de Base de Datos

### Tabla: `ll_campanias_whatsapp`

```sql
CREATE TABLE `ll_campanias_whatsapp` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(255) NOT NULL,
  `descripcion` text DEFAULT NULL,
  `mensaje` text NOT NULL,
  `estado` enum('pendiente','pendiente_aprobacion','programada','activa','completada','pausada','rechazada') DEFAULT 'pendiente_aprobacion',
  `programada` tinyint(1) DEFAULT 0,
  `fecha_envio` datetime DEFAULT NULL,
  `cliente_id` int(11) NOT NULL,
  `fecha_creacion` timestamp DEFAULT CURRENT_TIMESTAMP,
  `fecha_actualizacion` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cliente_id` (`cliente_id`),
  KEY `idx_estado` (`estado`),
  KEY `idx_fecha_envio` (`fecha_envio`),
  FOREIGN KEY (`cliente_id`) REFERENCES `ll_usuarios`(`cliente_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### Estados y Transiciones

```
Estado Inicial: pendiente_aprobacion
     ↓
[Admin Aprueba] → programada/activa
     ↓
[Proceso Envío] → activa → completada
     ↓
[Usuario Edita] → pendiente_aprobacion (vuelta atrás)

Estados Finales (NO editables):
- completada (envío terminado)
- activa (en proceso)
- pausada (pausada pero con envíos)
```

### Consulta de Validación
```sql
-- Verificar si la campaña es editable
SELECT 
  c.id, c.estado, c.cliente_id,
  COALESCE(env.enviados, 0) as enviados
FROM ll_campanias_whatsapp c
LEFT JOIN (
  SELECT campania_id, COUNT(*) as enviados 
  FROM ll_envios_whatsapp 
  WHERE estado = 'enviado'
  GROUP BY campania_id
) env ON c.id = env.campania_id
WHERE c.id = ? AND c.cliente_id = ?
```

---

## 🔄 Flujo de Trabajo

### 1. **Validación Inicial (Frontend)**
```javascript
// Verificar estado y envíos antes de abrir modal
const isEditable = !['activa', 'completada', 'pausada'].includes(campaign.estado) 
                   && campaign.enviados === 0;
```

### 2. **Envío de Datos**
```javascript
// Llamada API con manejo de errores específicos
const response = await senderAPI.updateCampaign(id, formData);
```

### 3. **Validación Backend**
```javascript
// 1. Verificar autenticación JWT
// 2. Verificar propiedad de campaña
// 3. Verificar estado editable
// 4. Verificar sin envíos
// 5. Validar datos entrada
// 6. Actualizar base de datos
// 7. Cambiar estado a pendiente_aprobacion
```

### 4. **Actualización Estado**
```javascript
// Sincronizar frontend con respuesta del servidor
setCampaigns(campaigns.map(campaign => 
  campaign.id === editingCampaign.id 
    ? { ...campaign, ...formData, estado: response.data.data.estado }
    : campaign
));
```

---

## 🚨 Logs y Auditoría

### Registro de Cambios
```javascript
// Log de auditoría en cada operación
console.log(`[AUDIT] Campaña editada - ID: ${id}, Usuario: ${req.user.usuario}, Cliente: ${clienteId}`);
```

### Estructura de Logs
```
[2025-12-19T15:30:00.000Z] [AUDIT] Campaña editada - ID: 123, Usuario: Haby, Cliente: 51
[2025-12-19T15:30:00.000Z] [SECURITY] Intento edición bloqueada - ID: 124, Razón: Ya enviada, Usuario: Haby
```

---

## 🧪 Testing

### Tests Backend (Jest)
```javascript
describe('PUT /sender/campaigns/:id', () => {
  test('Debe permitir editar campaña pendiente_aprobacion', async () => {
    // Test validación exitosa
  });
  
  test('Debe rechazar edición de campaña completada', async () => {
    // Test bloqueo de seguridad
  });
  
  test('Debe cambiar estado a pendiente_aprobacion', async () => {
    // Test transición de estado
  });
});
```

### Tests Frontend (Playwright)
```javascript
test('Cliente puede editar campaña válida', async ({ page }) => {
  // Test flujo completo de edición
});

test('Cliente no puede editar campaña enviada', async ({ page }) => {
  // Test bloqueo UI
});
```

---

## 🔧 Configuración y Deployment

### Variables de Entorno
```env
# Base de datos
DB_HOST=sv46.byethost46.org
DB_USER=iunaorg_b3toh
DB_PASSWORD=elgeneral2018
DB_NAME=iunaorg_dyd

# JWT
JWT_SECRET=leadmaster_jwt_secret_key_super_secure_2025

# Puerto
PORT=3011
```

### Middleware Requerido
```javascript
// En routes/campaigns.js
const authMiddleware = require('../middleware/auth');
router.use(authMiddleware); // JWT validation
router.put('/:id', campaignsController.update);
```

---

## 🐛 Debugging y Troubleshooting

### Errores Comunes

#### 1. **"Campaña no encontrada"**
- **Causa**: ID inexistente o no pertenece al cliente
- **Debug**: Verificar cliente_id en JWT vs base de datos
- **Solución**: Validar autenticación y permisos

#### 2. **"No se pueden editar campañas..."**
- **Causa**: Campaña ya tiene envíos o estado no editable
- **Debug**: Consultar tabla ll_envios_whatsapp
- **Solución**: Crear nueva campaña

#### 3. **"Error interno del servidor"**
- **Causa**: Error de base de datos o código
- **Debug**: Revisar logs del servidor
- **Solución**: Verificar conexión DB y esquema

### Debug Queries
```sql
-- Verificar estado de campaña
SELECT id, nombre, estado, cliente_id 
FROM ll_campanias_whatsapp 
WHERE id = ?;

-- Contar envíos
SELECT COUNT(*) as enviados 
FROM ll_envios_whatsapp 
WHERE campania_id = ? AND estado = 'enviado';

-- Ver historial de cambios
SELECT * FROM ll_campanias_whatsapp 
WHERE id = ? 
ORDER BY fecha_actualizacion DESC;
```

---

## 📚 Referencias Adicionales

- **[Manual de Usuario](./MANUAL_EDICION_CAMPANAS.md)** - Guía para usuarios finales
- **[API Documentation](./ENDPOINTS_SESSION_MANAGER.md)** - Documentación completa de APIs
- **[Manual Técnico Campañas](./MANUAL_TECNICO_CAMPANAS.md)** - Arquitectura general
- **[Testing Guide](../tests/README.md)** - Suite de pruebas automatizadas

---

*🔐 **Seguridad**: Este sistema prioriza la integridad de datos sobre la flexibilidad de edición. Las restricciones están diseñadas para prevenir inconsistencias y garantizar trazabilidad completa.*