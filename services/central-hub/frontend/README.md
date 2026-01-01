# LeadMaster - Frontend Dashboard

Dashboard web moderno para gestionar el sistema LeadMaster Central Hub.

## 📚 Documentación

- **[Arquitectura Frontend](../docs/frontend/ARQUITECTURA_FRONTEND.md)** - Guía completa de React, Vite, Tailwind CSS
- **[Guía Rápida](../docs/frontend/GUIA_RAPIDA.md)** - Tareas comunes y referencia rápida
- **[Prioridades Frontend](../docs/frontend/PRIORIDADES_FRONTEND.md)** - Fases de desarrollo completadas
- **[Sistema de Autenticación](../docs/AUTENTICACION.md)** - Documentación del sistema de auth JWT

## 🚀 Stack Tecnológico

- **React 18.2** - Librería UI
- **Vite 5** - Build tool y dev server
- **Tailwind CSS 3** - Framework CSS
- **React Router 6** - Navegación
- **Axios** - Cliente HTTP
- **QRCode.react** - Generación de códigos QR

## 📁 Estructura del Proyecto

```
frontend/
├── src/
│   ├── components/
│   │   ├── layout/          # Sidebar, Header, Layout
│   │   ├── dashboard/       # Dashboard principal
│   │   ├── whatsapp/        # Gestión de sesión WhatsApp
│   │   ├── leads/           # Gestión de leads
│   │   ├── listener/        # Control del listener
│   │   ├── campaigns/       # Gestión de campañas
│   │   ├── config/          # Panel de configuración
│   │   └── common/          # Componentes reutilizables
│   ├── services/
│   │   └── api.js          # Servicio de API
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── public/
├── index.html
├── package.json
├── vite.config.js
└── tailwind.config.js
```

## 🎨 Características Implementadas

### ✅ Dashboard Principal
- Métricas en tiempo real del sistema
- Estado de conexión WhatsApp
- Estadísticas de leads y mensajes
- Estado del listener
- Actualización automática cada 10 segundos

### ✅ Gestión de Sesión WhatsApp
- Visualización de estado de conexión
- Generación y escaneo de código QR
- Conectar/Desconectar sesión
- Información de la sesión activa
- Logs de eventos

### ✅ Gestión de Leads
- Tabla con todos los leads
- Búsqueda y filtros avanzados
- Toggle de IA por lead
- Crear, editar y eliminar leads
- Vista detallada de cada lead

### ✅ Control del Listener
- Cambiar modo (off/listen/respond)
- Logs de mensajes recibidos
- Filtros por teléfono y fecha
- Estadísticas de uso de IA

### ✅ Gestión de Campañas
- Lista de campañas activas y completadas
- Crear nuevas campañas
- Estadísticas detalladas por campaña
- Barra de progreso en tiempo real
- Programación de envíos

### ✅ Panel de Configuración
- Configuración de API y OpenAI
- Parámetros del sistema
- Backup y restauración de configuración
- Estado de servicios

## 🛠️ Instalación

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo (puerto 5173)
npm run dev

# Build para producción
npm run build

# Preview de producción
npm run preview
```

## 🔌 Configuración de API

El frontend se conecta al backend en `http://localhost:3012` por defecto.

Para builds en servidores HTTPS crea un `.env.production` para evitar contenido mixto:

```env
VITE_API_URL=https://desarrolloydisenioweb.com.ar/api
```

En desarrollo, ajusta el archivo `.env`:

```env
VITE_API_URL=http://localhost:3012
```

## 📡 API Endpoints Consumidos

### Session Manager
- `GET /session-manager/status` - Estado de la sesión
- `GET /session-manager/state` - Información de la sesión
- `GET /session-manager/qr` - Obtener código QR
- `POST /session-manager/disconnect` - Cerrar sesión
- `POST /session-manager/reconnect` - Reconectar

### Listener
- `GET /listener/status` - Estado del listener
- `POST /listener/mode` - Cambiar modo
- `GET /listener/logs` - Obtener logs
- `POST /listener/ia/enable` - Habilitar IA
- `POST /listener/ia/disable` - Deshabilitar IA

### Sender
- `POST /sender/messages/send` - Enviar mensaje
- `POST /sender/messages/bulk` - Envío masivo
- `GET /sender/messages/status/:id` - Estado de mensaje
- `GET /sender/campaigns` - Listar campañas
- `POST /sender/campaigns` - Crear campaña

### Leads (por implementar en backend)
- `GET /leads` - Listar leads
- `GET /leads/:id` - Obtener lead
- `POST /leads` - Crear lead
- `PUT /leads/:id` - Actualizar lead
- `DELETE /leads/:id` - Eliminar lead

## 🎨 Diseño

### Paleta de Colores
- **Primary:** `#3B82F6` (Azul)
- **Success:** `#10B981` (Verde)
- **Warning:** `#F59E0B` (Amarillo)
- **Danger:** `#EF4444` (Rojo)

### Tipografía
- **Familia:** Inter (Google Fonts)
- **Pesos:** 300, 400, 500, 600, 700

### Componentes Comunes
- `Card` - Contenedor con sombra
- `Button` - Botones con variantes
- `Modal` - Diálogos modales
- `LoadingSpinner` - Indicador de carga

## 📱 Responsive Design

El dashboard es completamente responsive y funciona en:
- 💻 Desktop (>1024px)
- 📱 Tablet (768px - 1024px)
- 📱 Mobile (<768px)

## 🔄 Actualizaciones en Tiempo Real

El sistema actualiza automáticamente:
- Estado de WhatsApp cada 10 segundos
- Dashboard principal cada 10 segundos
- Estado del listener cada 10 segundos

## 🚧 Próximas Funcionalidades

- [ ] WebSockets para actualizaciones en tiempo real
- [ ] Notificaciones push
- [ ] Gráficos y analytics avanzados
- [ ] Modo oscuro
- [ ] Exportación de reportes
- [ ] Múltiples usuarios y roles

## 📝 Notas de Desarrollo

- Todo el código está comentado en español
- Los componentes son modulares y reutilizables
- Se usa Tailwind CSS para estilos consistentes
- Mock data cuando los endpoints no están implementados
- Manejo de errores con try/catch en todas las llamadas API

## 🤝 Integración con Backend

El frontend espera que el backend esté corriendo en `http://localhost:3012` y responda a los endpoints documentados.

Para desarrollo, asegúrate de:
1. Tener el backend corriendo
2. Configurar CORS en el backend
3. Verificar que los endpoints respondan correctamente

## 📄 Licencia

© 2025 LeadMaster - Todos los derechos reservados
