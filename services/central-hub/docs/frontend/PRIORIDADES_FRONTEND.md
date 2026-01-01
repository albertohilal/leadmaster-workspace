# Prioridades de desarrollo - Frontend Web Dashboard

> **Stack tecnológico:** React + Vite + Tailwind CSS + Axios  
> **API Backend:** http://localhost:3010 (leadmaster-central-hub)  
> **Estado:** ✅ COMPLETADO (14 de diciembre de 2025)  
> **Documentación:** Este archivo ahora está en `/docs/frontend/` (estructura unificada). Contenido consolidado desde `docs/PRIORIDADES_DESARROLLO_FRONT.md`.

## 🎯 Objetivo

✅ **COMPLETADO** - Crear una interfaz web moderna y funcional para gestionar todo el sistema leadmaster-central-hub, proporcionando acceso visual a todas las funcionalidades de los módulos backend (session-manager, sender, listener).

## 📦 Entregables

- ✅ **Frontend completo** en `/frontend/`
- ✅ **15+ componentes React** implementados
- ✅ **6 rutas** configuradas (+ ruta login)
- ✅ **20+ endpoints** integrados
- ✅ **Sistema de autenticación completo** con JWT
- ✅ **Branding DyD** con logos integrados
- ✅ **Documentación completa:**
  - `/docs/frontend/ARQUITECTURA_FRONTEND.md` (400+ líneas)
  - `/docs/frontend/GUIA_RAPIDA.md`
  - `/docs/AUTENTICACION.md`
  - `/docs/INSTALACION_AUTH.md`
  - `/frontend/README.md`
  - `/frontend/PROYECTO_COMPLETADO.md` (si existe en el directorio)

---

## 📋 Orden de prioridades

### 1. **Configuración inicial del proyecto** ⚙️ ✅ COMPLETADO

**Tareas:**
- [x] Crear proyecto React con Vite
- [x] Configurar Tailwind CSS
- [x] Instalar dependencias (axios, react-router-dom)
- [x] Estructura de carpetas modular
- [x] Configurar servicio API (axios)
- [x] Layout principal con sidebar y header

**Estructura propuesta:**
```
frontend/
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.jsx
│   │   │   ├── Header.jsx
│   │   │   └── Layout.jsx
│   │   ├── dashboard/
│   │   │   └── Dashboard.jsx
│   │   ├── whatsapp/
│   │   │   ├── SessionStatus.jsx
│   │   │   ├── QRCode.jsx
│   │   │   └── SessionLogs.jsx
│   │   ├── campaigns/
│   │   │   ├── CampaignsList.jsx
│   │   │   ├── CampaignForm.jsx
│   │   │   └── CampaignStats.jsx
│   │   ├── leads/
│   │   │   ├── LeadsTable.jsx
│   │   │   ├── LeadDetail.jsx
│   │   │   └── LeadForm.jsx
│   │   ├── listener/
│   │   │   ├── ListenerControl.jsx
│   │   │   ├── MessageLogs.jsx
│   │   │   └── IAControl.jsx
│   │   └── common/
│   │       ├── Card.jsx
│   │       ├── Button.jsx
│   │       ├── Table.jsx
│   │       └── LoadingSpinner.jsx
│   ├── services/
│   │   └── api.js
│   ├── App.jsx
│   └── main.jsx
├── package.json
├── vite.config.js
└── tailwind.config.js
```

---

### 2. **Dashboard principal** 🏠 ✅ COMPLETADO

**Funcionalidades:**
- Estado general del sistema
- Tarjetas con métricas principales:
  - Estado de conexión WhatsApp (conectado/desconectado/QR)
  - Total de mensajes enviados hoy
  - Total de leads activos
  - Leads con IA habilitada
  - Campañas activas
- Últimos 10 mensajes recibidos (listener)
- Gráfico de actividad (opcional)

**API Endpoints a consumir:**
```
GET /session-manager/status
GET /listener/status
GET /sender/status
```

**Diseño:**
- Grid responsivo con tarjetas
- Iconos visuales (WhatsApp, usuarios, mensajes)
- Colores: verde para activo, rojo para inactivo, amarillo para pendiente
- Actualización automática cada 5 segundos

---

### 3. **Gestión de sesión WhatsApp** 📱 ✅ COMPLETADO

**Funcionalidades:**
- **Vista de estado:**
  - Mostrar estado actual (CONNECTED/DISCONNECTED/QR)
  - Información de la sesión activa
  - Tiempo conectado
  
- **Conexión/Desconexión:**
  - Botón para solicitar QR code
  - Mostrar QR code en pantalla (si está disponible)
  - Botón para cerrar sesión
  - Botón para reconectar
  
- **Logs de sesión:**
  - Tabla con últimos eventos de la sesión
  - Filtros por tipo de evento
  - Exportar logs

**API Endpoints:**
```
GET  /session-manager/status
GET  /session-manager/state
GET  /session-manager/qr
POST /session-manager/disconnect (si existe)
```

**Componentes:**
- `SessionStatus.jsx` - tarjeta con estado actual
- `QRCode.jsx` - modal para mostrar QR
- `SessionLogs.jsx` - tabla de eventos

---

### 4. **Panel de campañas** 📨 ✅ COMPLETADO

**Funcionalidades:**
- **Listar campañas:**
  - Tabla con todas las campañas
  - Filtros: activas, completadas, programadas
  - Búsqueda por nombre
  
- **Crear campaña:**
  - Formulario para nueva campaña
  - Nombre, descripción
  - Seleccionar leads destinatarios
  - Programar fecha/hora de envío (opcional)
  - Vista previa del mensaje
  
- **Ver estadísticas:**
  - Total enviados
  - Fallidos
  - Pendientes
  - Tasa de éxito
  - Gráfico de progreso

**API Endpoints:**
```
GET  /sender/campaigns (por implementar en backend)
POST /sender/campaigns (por implementar)
GET  /sender/campaigns/:id/stats
POST /sender/messages/bulk
```

**Componentes:**
- `CampaignsList.jsx`
- `CampaignForm.jsx`
- `CampaignStats.jsx`
- `MessagePreview.jsx`

---

### 5. **Gestión de leads** 👥 ✅ COMPLETADO

**Funcionalidades:**
- **Tabla de leads:**
  - Listar todos los leads (paginado)
  - Columnas: nombre, teléfono, email, empresa, IA habilitada
  - Búsqueda por nombre/teléfono
  - Filtros: con IA, sin IA, activos
  - Ordenamiento por columnas
  
- **Detalle de lead:**
  - Información completa del lead
  - Historial de conversaciones WhatsApp
  - Toggle para habilitar/deshabilitar IA
  - Editar información básica
  
- **Crear/Editar lead:**
  - Formulario con campos principales
  - Validaciones
  - Guardar cambios

**API Endpoints (backend a implementar):**
```
GET    /leads
GET    /leads/:id
POST   /leads
PUT    /leads/:id
DELETE /leads/:id
GET    /leads/search?q=telefono
POST   /listener/ia/enable
POST   /listener/ia/disable
```

**Componentes:**
- `LeadsTable.jsx`
- `LeadDetail.jsx`
- `LeadForm.jsx`
- `IAToggle.jsx`
- `ConversationHistory.jsx`

---

### 6. **Control del Listener** 🤖 ✅ COMPLETADO

**Funcionalidades:**
- **Estado del listener:**
  - Modo actual (listen/respond/off)
  - Cambiar modo con botones
  
- **Logs de mensajes:**
  - Tabla con mensajes recibidos
  - Columnas: fecha, teléfono, mensaje, respuesta IA
  - Filtros por fecha y teléfono
  - Ver si se activó IA o no
  
- **Configuración:**
  - Configurar respuestas automáticas por defecto
  - Ver prompts usados por la IA
  - Estadísticas de uso de IA

**API Endpoints:**
```
GET  /listener/status
POST /listener/mode
GET  /listener/logs
POST /listener/test-message (para pruebas)
```

**Componentes:**
- `ListenerControl.jsx`
- `MessageLogs.jsx`
- `ModeSelector.jsx`
- `IAConfig.jsx`

---

### 7. **Configuración del sistema** ⚙️ ✅ COMPLETADO

**Funcionalidades:**
- **Variables de entorno:**
  - API Keys (OpenAI) - enmascarada
  - URL de API backend
  - Configuración de base de datos (solo lectura)
  
- **Parámetros generales:**
  - Timeout de sesión WhatsApp
  - Reintentos de envío
  - Intervalo de polling
  
- **Backup/Restore:**
  - Exportar configuración
  - Importar configuración

**Componentes:**
- `ConfigPanel.jsx`
- `APIKeysManager.jsx`
- `SystemParams.jsx`

---

## 🎨 Diseño UI/UX

### Paleta de colores:
- **Principal:** Azul (#3B82F6) - acciones primarias
- **Éxito:** Verde (#10B981) - WhatsApp conectado, IA activa
- **Advertencia:** Amarillo (#F59E0B) - pendientes, warnings
- **Error:** Rojo (#EF4444) - desconectado, errores
- **Fondo:** Gris claro (#F9FAFB)
- **Texto:** Gris oscuro (#1F2937)

### Tipografía:
- **Familia:** Inter (Google Fonts)
- **Tamaños:** Tailwind por defecto (text-sm, text-base, text-lg, etc.)

### Componentes reutilizables:
- **Card:** contenedor con sombra y bordes redondeados
- **Button:** primario, secundario, danger
- **Table:** con paginación y ordenamiento
- **Modal:** para formularios y confirmaciones
- **Toast/Alert:** notificaciones de éxito/error

---

## 🔌 Integración con API

### Servicio API (`src/services/api.js`):
```javascript
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3010';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Session Manager
export const sessionAPI = {
  getStatus: () => api.get('/session-manager/status'),
  getState: () => api.get('/session-manager/state'),
  getQR: () => api.get('/session-manager/qr'),
};

// Listener
export const listenerAPI = {
  getStatus: () => api.get('/listener/status'),
  setMode: (mode) => api.post('/listener/mode', { mode }),
  getLogs: () => api.get('/listener/logs'),
  enableIA: (telefono) => api.post('/listener/ia/enable', { telefono }),
  disableIA: (telefono) => api.post('/listener/ia/disable', { telefono }),
};

// Sender
export const senderAPI = {
  sendMessage: (data) => api.post('/sender/messages/send', data),
  sendBulk: (data) => api.post('/sender/messages/bulk', data),
  getMessageStatus: (id) => api.get(`/sender/messages/status/${id}`),
};

// Leads (por implementar en backend)
export const leadsAPI = {
  getAll: () => api.get('/leads'),
  getById: (id) => api.get(`/leads/${id}`),
  create: (data) => api.post('/leads', data),
  update: (id, data) => api.put(`/leads/${id}`, data),
  delete: (id) => api.delete(`/leads/${id}`),
};
```

---

## 📦 Dependencias del proyecto

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "axios": "^1.6.2",
    "qrcode.react": "^3.1.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32",
    "tailwindcss": "^3.3.6",
    "vite": "^5.0.7"
  }
}
```

---

## 🚀 Comandos de desarrollo

```bash
# Instalar dependencias
npm install

# Desarrollo (http://localhost:5173)
npm run dev

# Build para producción
npm run build

# Preview de producción
npm run preview
```

---

## 📝 Notas de implementación

1. **Responsive design:** Todas las vistas deben funcionar en mobile, tablet y desktop
2. **Manejo de errores:** Mostrar mensajes claros cuando falle la API
3. **Loading states:** Indicadores visuales mientras se cargan datos
4. **Validaciones:** Validar formularios en frontend antes de enviar a API
5. **Actualización en tiempo real:** Usar polling (cada 5-10s) o WebSockets (futuro)
6. **Accesibilidad:** Usar etiquetas semánticas y ARIA labels
7. **Comentarios en español:** Todo el código comentado para facilitar aprendizaje

---

## ✅ Checklist de implementación

### Fase 1: Setup y Layout (1-2 horas) ✅ COMPLETADO
- [x] Crear proyecto con Vite
- [x] Instalar y configurar Tailwind
- [x] Crear componentes de layout (Sidebar, Header)
- [x] Configurar React Router
- [x] Crear servicio API

### Fase 2: Dashboard y WhatsApp (2-3 horas) ✅ COMPLETADO
- [x] Componente Dashboard con métricas
- [x] Vista de estado de sesión WhatsApp
- [x] Mostrar/ocultar QR code
- [x] Logs de sesión

### Fase 3: Leads (3-4 horas) ✅ COMPLETADO
- [x] Tabla de leads con paginación
- [x] Búsqueda y filtros
- [x] Detalle de lead
- [x] Formulario crear/editar
- [x] Toggle IA por lead

### Fase 4: Listener (2 horas) ✅ COMPLETADO
- [x] Control de modos
- [x] Logs de mensajes
- [x] Vista de configuración IA

### Fase 5: Campañas (2-3 horas) ✅ COMPLETADO
- [x] Lista de campañas
- [x] Formulario nueva campaña
- [x] Selección de destinatarios
- [x] Vista de estadísticas

### Fase 6: Configuración (1-2 horas) ✅ COMPLETADO
- [x] Panel de configuración
- [x] Gestión de API keys
- [x] Parámetros del sistema

### Fase 7: Pulido final (1-2 horas) ✅ COMPLETADO
- [x] Revisar responsive design
- [x] Agregar transiciones/animaciones
- [x] Testing manual de todas las funciones
- [x] Documentación de uso

---

**Tiempo estimado total:** 12-18 horas de desarrollo
**Tiempo real:** ~6 horas ⚡

## 🎉 PROYECTO COMPLETADO

✅ **Todas las fases implementadas**
✅ **Documentación completa creada**
✅ **15+ componentes funcionales**
✅ **6 rutas configuradas**
✅ **Responsive design implementado**

### 📚 Documentación Generada

1. **`/frontend/docs/ARQUITECTURA_FRONTEND.md`**
   - Guía completa de 400+ líneas
   - Explica React, Vite, Tailwind desde cero
   - Patrones y buenas prácticas
   - Ejemplos de código comentados

2. **`/frontend/docs/GUIA_RAPIDA.md`**
   - Inicio rápido en 3 pasos
   - Tareas comunes
   - Snippets útiles
   - Tips de debugging

3. **`/frontend/README.md`**
   - Características del frontend
   - Instalación y uso
   - Stack tecnológico
   - Roadmap

4. **`/frontend/PROYECTO_COMPLETADO.md`**
   - Lista completa de lo implementado
   - Estadísticas del proyecto
   - Próximos pasos sugeridos

### 🚀 Para Empezar

```bash
cd /home/beto/Documentos/Github/leadmaster-central-hub/frontend
npm install
npm run dev
```

Abre http://localhost:5173 y explora la aplicación.

---

_Este documento sirvió como guía detallada para la implementación completa del frontend._
_**Estado final:** ✅ COMPLETADO (14 de diciembre de 2025)_
