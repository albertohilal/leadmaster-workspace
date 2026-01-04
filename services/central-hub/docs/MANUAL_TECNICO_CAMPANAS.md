# Manual Técnico - Módulo de Campañas

## Información Técnica

### Arquitectura del Componente

#### Estructura de Archivos
```
frontend/src/components/campaigns/
├── CampaignsManager.jsx          # Componente principal
├── ProgramacionesForm.jsx        # Formulario de programación
└── ProgramacionesList.jsx        # Lista de programaciones
```

#### Dependencias
```jsx
import { senderAPI, leadsAPI } from '../../services/api';
import Card from '../common/Card';
import Button from '../common/Button';
import LoadingSpinner from '../common/LoadingSpinner';
import Modal from '../common/Modal';
```

### Estados y Datos

#### Estados de Campaña
```javascript
const CAMPAIGN_STATES = {
  ACTIVA: 'activa',
  COMPLETADA: 'completada', 
  PROGRAMADA: 'programada',
  PAUSADA: 'pausada'
};
```

#### Estructura de Datos
```javascript
// Campaña
const campaignStructure = {
  id: Number,
  nombre: String,
  descripcion: String,
  estado: String, // 'activa' | 'completada' | 'programada' | 'pausada'
  fecha_creacion: String, // 'YYYY-MM-DD'
  total_destinatarios: Number,
  enviados: Number,
  fallidos: Number,
  pendientes: Number
};

// Programación
const programacionStructure = {
  id: Number,
  campania_id: Number,
  campania_nombre: String,
  dias_semana: String, // 'MON,TUE,WED'
  hora_inicio: String, // 'HH:MM:SS'
  hora_fin: String, // 'HH:MM:SS'
  cupo_diario: Number,
  fecha_inicio: String, // 'YYYY-MM-DD'
  fecha_fin: String, // 'YYYY-MM-DD' | null
  comentario: String,
  comentario_admin: String,
  estado: String, // 'pendiente' | 'aprobada' | 'rechazada' | 'pausada'
  rechazo_motivo: String
};
```

### Funciones y Métodos

#### CampaignsManager.jsx

##### Estados Principales
```javascript
const [loading, setLoading] = useState(true);
const [campaigns, setCampaigns] = useState([]);
const [showCreateModal, setShowCreateModal] = useState(false);
const [showStatsModal, setShowStatsModal] = useState(false);
const [selectedCampaign, setSelectedCampaign] = useState(null);
const [formData, setFormData] = useState({
  nombre: '',
  descripcion: '',
  mensaje: '',
  programada: false,
  fecha_envio: ''
});
```

##### Funciones Clave
```javascript
// Cargar campañas (actualmente usa datos mock)
const loadCampaigns = async () => {
  try {
    // TODO: Reemplazar con llamada real a API
    const mockCampaigns = [...];
    setCampaigns(mockCampaigns);
  } catch (error) {
    console.error('Error loading campaigns:', error);
  } finally {
    setLoading(false);
  }
};

// Crear nueva campaña
const handleCreateCampaign = () => {
  setFormData({
    nombre: '',
    descripcion: '',
    mensaje: '',
    programada: false,
    fecha_envio: ''
  });
  setShowCreateModal(true);
};

// Guardar campaña
const handleSaveCampaign = async () => {
  try {
    await senderAPI.createCampaign(formData);
    alert('Campaña creada exitosamente');
    setShowCreateModal(false);
    loadCampaigns();
  } catch (error) {
    console.error('Error creating campaign:', error);
    alert('Error al crear campaña');
  }
};

// Obtener color de estado
const getStatusColor = (estado) => {
  switch (estado) {
    case 'activa': return 'bg-success';
    case 'completada': return 'bg-primary';
    case 'programada': return 'bg-warning';
    case 'pausada': return 'bg-gray-400';
    default: return 'bg-gray-400';
  }
};

// Calcular tasa de éxito
const calculateSuccessRate = (campaign) => {
  const total = campaign.total_destinatarios;
  const exitosos = campaign.enviados;
  return total > 0 ? Math.round((exitosos / total) * 100) : 0;
};
```

#### ProgramacionesForm.jsx

##### Estados del Formulario
```javascript
const [form, setForm] = useState({
  campania_id: '',
  dias_semana: [],
  hora_inicio: '09:00:00',
  hora_fin: '13:00:00',
  cupo_diario: 50,
  fecha_inicio: '',
  fecha_fin: '',
  comentario: ''
});
const [saving, setSaving] = useState(false);
const [message, setMessage] = useState('');
const [errors, setErrors] = useState({});
```

##### Funciones de Validación
```javascript
// Validaciones del formulario
const validateForm = () => {
  const errs = {};
  if (!form.campania_id) errs.campania_id = 'Selecciona una campaña';
  if (!form.fecha_inicio) errs.fecha_inicio = 'Selecciona fecha de inicio';
  if (!form.dias_semana.length) errs.dias_semana = 'Selecciona al menos un día';
  if (!form.hora_inicio) errs.hora_inicio = 'Ingresa hora de inicio';
  if (!form.hora_fin) errs.hora_fin = 'Ingresa hora de fin';
  if (Number(form.cupo_diario) <= 0) errs.cupo_diario = 'El cupo debe ser mayor a 0';
  return errs;
};

// Alternar días de la semana
const toggleDay = (key) => {
  setForm((f) => {
    const has = f.dias_semana.includes(key);
    return {
      ...f,
      dias_semana: has 
        ? f.dias_semana.filter((d) => d !== key) 
        : [...f.dias_semana, key]
    };
  });
};
```

#### ProgramacionesList.jsx

##### Estados y Filtros
```javascript
const [items, setItems] = useState([]);
const [loading, setLoading] = useState(true);
const [estado, setEstado] = useState('');
```

##### Funciones de Carga
```javascript
const load = async () => {
  setLoading(true);
  try {
    const res = await senderAPI.listProgramaciones(estado ? { estado } : undefined);
    setItems(res.data || []);
  } catch {
    setItems([]);
  } finally {
    setLoading(false);
  }
};
```

### Estilos y Clases CSS

#### Clases de Tailwind Utilizadas

##### Layout Principal
```css
/* Espaciado general */
.space-y-8 { margin-top: 2rem; }
.space-y-6 { margin-top: 1.5rem; }
.space-y-4 { margin-top: 1rem; }

/* Grid responsive */
.grid.grid-cols-1.md:grid-cols-4 { /* Estadísticas */ }
.grid.grid-cols-1.xl:grid-cols-2 { /* Programaciones */ }
.grid.grid-cols-2.md:grid-cols-4 { /* Métricas */ }
```

##### Cards y Contenedores
```css
/* Cards principales */
.bg-white.rounded-lg.shadow-sm.border { /* Card estándar */ }
.p-6 { padding: 1.5rem; }
.p-8 { padding: 2rem; }

/* Cards de métricas con colores */
.bg-gray-50 { /* Destinatarios */ }
.bg-green-50 { /* Enviados */ }
.bg-red-50 { /* Fallidos */ }
.bg-blue-50 { /* Tasa de éxito */ }
```

##### Estados y Badges
```css
/* Badges de estado */
.px-3.py-1.rounded-full.text-xs.font-medium.text-white {
  /* Badge base */
}
.bg-green-100.text-green-800 { /* Aprobada */ }
.bg-yellow-100.text-yellow-800 { /* Pendiente */ }
.bg-red-100.text-red-800 { /* Rechazada */ }
```

##### Barras de Progreso
```css
.w-full.bg-gray-200.rounded-full.h-3 { /* Contenedor */ }
.bg-success.h-3.rounded-full.transition-all { /* Barra */ }
```

### APIs y Endpoints

#### Endpoints Utilizados
```javascript
// Campañas
senderAPI.createCampaign(formData)
senderAPI.getCampaigns()

// Programaciones  
senderAPI.createProgramacion(payload)
senderAPI.listProgramaciones(filters)

// Leads
leadsAPI.getAll()
```

#### Estructura de Respuesta
```javascript
// Respuesta estándar
{
  success: Boolean,
  data: Array | Object,
  message: String,
  error: String
}
```

### Configuración de Datos Mock

#### Campañas de Ejemplo
```javascript
const mockCampaigns = [
  {
    id: 1,
    nombre: 'Campaña Navidad 2025',
    descripcion: 'Promoción especial de fin de año',
    estado: 'activa',
    fecha_creacion: '2025-12-10',
    total_destinatarios: 150,
    enviados: 120,
    fallidos: 5,
    pendientes: 25
  },
  {
    id: 2,
    nombre: 'Seguimiento Leads',
    descripcion: 'Contacto con leads potenciales',
    estado: 'completada',
    fecha_creacion: '2025-12-05',
    total_destinatarios: 80,
    enviados: 80,
    fallidos: 0,
    pendientes: 0
  }
];
```

### Mejoras Futuras

#### Funcionalidades Pendientes
1. **Integración con API real** (actualmente usa datos mock)
2. **Edición de campañas existentes**
3. **Duplicación de campañas**
4. **Filtros avanzados**
5. **Exportación de estadísticas**
6. **Templates de mensajes**
7. **Programación con zonas horarias**

#### Optimizaciones Técnicas
1. **Lazy loading** para listas grandes
2. **Paginación** de campañas
3. **WebSocket** para actualizaciones en tiempo real
4. **Cache** de datos localmente
5. **Debounce** en formularios
6. **Validación** en tiempo real

#### UX/UI Mejoras
1. **Drag & drop** para reordenar
2. **Búsqueda** en tiempo real
3. **Tooltips** informativos
4. **Confirmaciones** de acciones destructivas
5. **Temas** oscuro/claro
6. **Responsive** mejorado para móviles

---

**Documentación técnica actualizada**: 19 de diciembre de 2025