# Arquitectura del Frontend - LeadMaster Dashboard

> Documentación completa para entender la arquitectura y tecnologías del frontend

## 📚 Índice

1. [Stack Tecnológico](#stack-tecnológico)
2. [Arquitectura General](#arquitectura-general)
3. [Estructura de Carpetas](#estructura-de-carpetas)
4. [Componentes React](#componentes-react)
5. [Enrutamiento](#enrutamiento)
6. [Gestión de Estado](#gestión-de-estado)
7. [Comunicación con API](#comunicación-con-api)
8. [Estilos con Tailwind CSS](#estilos-con-tailwind-css)
9. [Flujo de Datos](#flujo-de-datos)
10. [Patrones y Buenas Prácticas](#patrones-y-buenas-prácticas)

---

## 📦 Stack Tecnológico

### React 18.2
**¿Qué es?** Librería de JavaScript para construir interfaces de usuario mediante componentes reutilizables.

**¿Por qué React?**
- **Componentes reutilizables:** Cada parte de la UI es un componente independiente
- **Virtual DOM:** Actualiza solo lo necesario, mejorando el rendimiento
- **Hooks:** Permiten usar estado y efectos sin clases
- **Ecosistema maduro:** Miles de librerías y herramientas disponibles

**Conceptos clave:**
```jsx
// Componente funcional
function MiComponente() {
  return <div>Hola Mundo</div>
}

// Componente con estado
function Contador() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(count + 1)}>{count}</button>
}

// Componente con efectos
function DatosAPI() {
  const [datos, setDatos] = useState(null)
  
  useEffect(() => {
    // Se ejecuta cuando el componente se monta
    fetchDatos().then(setDatos)
  }, []) // [] = solo una vez
  
  return <div>{datos}</div>
}
```

### Vite 5
**¿Qué es?** Herramienta de build y servidor de desarrollo ultra-rápido.

**¿Por qué Vite?**
- **Inicio instantáneo:** No importa el tamaño del proyecto
- **Hot Module Replacement (HMR):** Actualiza cambios sin recargar la página
- **Build optimizado:** Usa Rollup para producción
- **Configuración mínima:** Funciona out-of-the-box

**Comandos principales:**
```bash
npm run dev      # Inicia servidor de desarrollo en http://localhost:5173
npm run build    # Genera build optimizado para producción en /dist
npm run preview  # Preview del build de producción
```

### Tailwind CSS 3
**¿Qué es?** Framework CSS utility-first que permite estilizar con clases predefinidas.

**¿Por qué Tailwind?**
- **Productividad:** Estiliza sin salir del JSX
- **Consistencia:** Sistema de diseño integrado
- **Responsive:** Mobile-first por defecto
- **Optimización:** Solo incluye las clases que usas

**Ejemplo práctico:**
```jsx
// Sin Tailwind (CSS tradicional)
<div className="mi-card">
  <h2 className="titulo">Hola</h2>
</div>
// CSS separado:
.mi-card { padding: 24px; background: white; border-radius: 8px; }
.titulo { font-size: 20px; font-weight: 600; }

// Con Tailwind (todo en JSX)
<div className="p-6 bg-white rounded-lg">
  <h2 className="text-xl font-semibold">Hola</h2>
</div>
```

### React Router 6
**¿Qué es?** Librería para navegación y rutas en aplicaciones React.

**¿Por qué Router?**
- **SPA (Single Page Application):** Navega sin recargar la página
- **Rutas declarativas:** Define rutas como componentes
- **Parámetros y query strings:** Manejo fácil de URLs dinámicas

**Uso:**
```jsx
<Router>
  <Routes>
    <Route path="/" element={<Dashboard />} />
    <Route path="/leads" element={<LeadsManager />} />
    <Route path="/leads/:id" element={<LeadDetail />} />
  </Routes>
</Router>
```

### Axios
**¿Qué es?** Cliente HTTP basado en promesas para hacer peticiones a la API.

**¿Por qué Axios?**
- **Sintaxis simple:** Más fácil que fetch nativo
- **Interceptores:** Manejo global de errores y autenticación
- **Configuración:** Base URL, headers, timeouts centralizados

**Ejemplo:**
```javascript
// Configuración base
const api = axios.create({
  baseURL: 'http://localhost:3010',
  timeout: 10000
})

// Peticiones
const datos = await api.get('/leads')
const nuevo = await api.post('/leads', { nombre: 'Juan' })
```

---

## 🏗️ Arquitectura General

### Patrón Component-Based

```
┌─────────────────────────────────────┐
│           App.jsx (Raíz)            │
│         ┌───────────────┐           │
│         │  Router       │           │
│         └───────┬───────┘           │
│                 │                   │
│         ┌───────▼───────┐           │
│         │  Layout       │           │
│         │  ┌─────────┐  │           │
│         │  │ Sidebar │  │           │
│         │  └─────────┘  │           │
│         │  ┌─────────┐  │           │
│         │  │ Header  │  │           │
│         │  └─────────┘  │           │
│         │  ┌─────────┐  │           │
│         │  │ Content │◄─┼── Rutas (Dashboard, Leads, etc)
│         │  └─────────┘  │           │
│         └───────────────┘           │
└─────────────────────────────────────┘
```

### Flujo de Datos (Unidireccional)

```
┌──────────────┐
│   Usuario    │
│  (interacción)│
└──────┬───────┘
       │
       ▼
┌──────────────┐     ┌──────────────┐
│  Componente  │────▶│   Handler    │
│              │     │  (onClick)   │
└──────────────┘     └──────┬───────┘
                            │
                            ▼
                     ┌──────────────┐
                     │  API Service │
                     │  (axios)     │
                     └──────┬───────┘
                            │
                            ▼
                     ┌──────────────┐
                     │   Backend    │
                     │ (REST API)   │
                     └──────┬───────┘
                            │
                            ▼
                     ┌──────────────┐
                     │   Response   │
                     └──────┬───────┘
                            │
                            ▼
                     ┌──────────────┐
                     │  setState()  │
                     │  (actualiza) │
                     └──────┬───────┘
                            │
                            ▼
                     ┌──────────────┐
                     │   Re-render  │
                     │      UI      │
                     └──────────────┘
```

---

## 📁 Estructura de Carpetas

```
frontend/
│
├── public/                     # Archivos estáticos (imágenes, favicon)
│
├── src/                        # Código fuente
│   │
│   ├── components/             # Componentes React organizados por módulo
│   │   │
│   │   ├── layout/             # Estructura general de la aplicación
│   │   │   ├── Sidebar.jsx     # Menú lateral de navegación
│   │   │   ├── Header.jsx      # Barra superior con estado y usuario
│   │   │   └── Layout.jsx      # Wrapper que combina Sidebar + Header
│   │   │
│   │   ├── dashboard/          # Página principal con métricas
│   │   │   └── Dashboard.jsx   # Componente principal del dashboard
│   │   │
│   │   ├── whatsapp/           # Gestión de sesión WhatsApp
│   │   │   └── SessionManager.jsx  # Control de conexión y QR
│   │   │
│   │   ├── leads/              # Gestión de leads
│   │   │   └── LeadsManager.jsx    # CRUD completo de leads
│   │   │
│   │   ├── listener/           # Control del listener
│   │   │   └── ListenerControl.jsx # Cambiar modos y ver logs
│   │   │
│   │   ├── campaigns/          # Gestión de campañas
│   │   │   └── CampaignsManager.jsx # Crear y gestionar campañas
│   │   │
│   │   ├── config/             # Configuración del sistema
│   │   │   └── ConfigPanel.jsx     # Ajustes y parámetros
│   │   │
│   │   └── common/             # Componentes reutilizables
│   │       ├── Card.jsx        # Tarjeta contenedora
│   │       ├── Button.jsx      # Botón con variantes
│   │       ├── Modal.jsx       # Diálogo modal
│   │       └── LoadingSpinner.jsx  # Indicador de carga
│   │
│   ├── services/               # Lógica de comunicación con API
│   │   └── api.js              # Cliente Axios configurado
│   │
│   ├── App.jsx                 # Componente raíz con Router
│   ├── main.jsx                # Punto de entrada (renderiza App)
│   └── index.css               # Estilos globales + Tailwind
│
├── index.html                  # HTML principal
├── package.json                # Dependencias y scripts
├── vite.config.js              # Configuración de Vite
├── tailwind.config.js          # Configuración de Tailwind
└── postcss.config.js           # Configuración de PostCSS
```

### ¿Qué va en cada carpeta?

**components/**: Cada componente es una función que retorna JSX (HTML + JavaScript)
**services/**: Funciones que hacen peticiones HTTP al backend
**App.jsx**: Define las rutas de la aplicación
**main.jsx**: Monta la aplicación React en el DOM

---

## ⚛️ Componentes React

### ¿Qué es un Componente?

Un componente es una función que retorna elementos de UI (JSX). Piensa en ellos como bloques de LEGO que puedes reutilizar.

### Anatomía de un Componente

```jsx
// 1. Imports - traer dependencias
import React, { useState, useEffect } from 'react';
import Card from '../common/Card';
import { leadsAPI } from '../../services/api';

// 2. Definición del componente
const LeadsManager = () => {
  // 3. Estado local (datos que cambian)
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // 4. Efectos (código que se ejecuta en momentos específicos)
  useEffect(() => {
    loadLeads(); // Cargar datos al montar el componente
  }, []); // [] significa "solo una vez"
  
  // 5. Funciones auxiliares
  const loadLeads = async () => {
    setLoading(true);
    try {
      const response = await leadsAPI.getAll();
      setLeads(response.data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleDelete = async (id) => {
    if (confirm('¿Eliminar?')) {
      await leadsAPI.delete(id);
      loadLeads(); // Recargar lista
    }
  };
  
  // 6. Renderizado condicional
  if (loading) {
    return <LoadingSpinner />;
  }
  
  // 7. JSX - estructura visual del componente
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Leads</h1>
      
      <Card title="Lista de Leads">
        {leads.map(lead => (
          <div key={lead.id}>
            <span>{lead.nombre}</span>
            <button onClick={() => handleDelete(lead.id)}>
              Eliminar
            </button>
          </div>
        ))}
      </Card>
    </div>
  );
};

// 8. Export - permitir que otros lo usen
export default LeadsManager;
```

### Hooks Principales

#### useState - Gestión de Estado
```jsx
// Declaración: [variable, función para cambiarla]
const [count, setCount] = useState(0); // valor inicial: 0

// Uso
setCount(5);                  // Establece el valor a 5
setCount(count + 1);          // Incrementa
setCount(prev => prev + 1);   // Forma segura de incrementar
```

#### useEffect - Efectos Secundarios
```jsx
// Se ejecuta una vez al montar
useEffect(() => {
  console.log('Componente montado');
}, []);

// Se ejecuta cuando cambia 'count'
useEffect(() => {
  console.log('Count cambió:', count);
}, [count]);

// Se ejecuta en cada render
useEffect(() => {
  console.log('Cualquier cambio');
});

// Cleanup (limpieza)
useEffect(() => {
  const interval = setInterval(() => {
    console.log('Tick');
  }, 1000);
  
  // Esta función se ejecuta al desmontar
  return () => clearInterval(interval);
}, []);
```

### Props - Pasar Datos entre Componentes

```jsx
// Componente padre
function Dashboard() {
  return (
    <Card 
      title="Mi Tarjeta" 
      icon="📊"
      className="mb-4"
    >
      <p>Contenido de la tarjeta</p>
    </Card>
  );
}

// Componente hijo (recibe props)
function Card({ title, icon, children, className = '' }) {
  return (
    <div className={`card ${className}`}>
      <div className="flex items-center">
        {icon && <span>{icon}</span>}
        <h3>{title}</h3>
      </div>
      <div>{children}</div>
    </div>
  );
}
```

---

## 🛣️ Enrutamiento

### React Router - Navegación SPA

```jsx
// App.jsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          {/* Ruta exacta */}
          <Route path="/" element={<Dashboard />} />
          
          {/* Rutas con path */}
          <Route path="/leads" element={<LeadsManager />} />
          <Route path="/whatsapp" element={<SessionManager />} />
          
          {/* Ruta con parámetro */}
          <Route path="/leads/:id" element={<LeadDetail />} />
          
          {/* Ruta 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Layout>
    </Router>
  );
}
```

### Navegación Programática

```jsx
import { Link, useNavigate, useParams } from 'react-router-dom';

function MiComponente() {
  const navigate = useNavigate();
  const { id } = useParams(); // Obtener parámetro de URL
  
  return (
    <div>
      {/* Link declarativo */}
      <Link to="/leads">Ver Leads</Link>
      
      {/* Navegación programática */}
      <button onClick={() => navigate('/dashboard')}>
        Ir al Dashboard
      </button>
      
      {/* Con parámetros */}
      <button onClick={() => navigate(`/leads/${id}`)}>
        Ver Detalle
      </button>
      
      {/* Ir atrás */}
      <button onClick={() => navigate(-1)}>
        Volver
      </button>
    </div>
  );
}
```

---

## 📊 Gestión de Estado

### Estado Local (useState)

Usado para datos específicos de un componente:

```jsx
function LeadsManager() {
  // Cada componente tiene su propio estado
  const [leads, setLeads] = useState([]);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // El estado se pierde si el componente se desmonta
  return (
    <div>
      <input 
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
    </div>
  );
}
```

### Levantar el Estado (Lifting State Up)

Cuando varios componentes necesitan compartir estado:

```jsx
// ❌ Mal: Estado duplicado
function ComponentA() {
  const [count, setCount] = useState(0);
  return <div>{count}</div>
}

function ComponentB() {
  const [count, setCount] = useState(0); // Otro estado diferente
  return <div>{count}</div>
}

// ✅ Bien: Estado compartido en padre
function Parent() {
  const [count, setCount] = useState(0);
  
  return (
    <>
      <ComponentA count={count} setCount={setCount} />
      <ComponentB count={count} />
    </>
  );
}

function ComponentA({ count, setCount }) {
  return <button onClick={() => setCount(count + 1)}>{count}</button>
}

function ComponentB({ count }) {
  return <div>Contador: {count}</div>
}
```

### Actualización de Arrays y Objetos

```jsx
// ❌ Mal: Mutar el estado directamente
const [items, setItems] = useState([1, 2, 3]);
items.push(4); // No funciona
setItems(items);

// ✅ Bien: Crear nuevo array
setItems([...items, 4]); // Agregar
setItems(items.filter(i => i !== 2)); // Eliminar
setItems(items.map(i => i === 2 ? 20 : i)); // Modificar

// Objetos
const [user, setUser] = useState({ name: 'Juan', age: 30 });

// ❌ Mal
user.age = 31;

// ✅ Bien
setUser({ ...user, age: 31 });
setUser(prev => ({ ...prev, age: 31 }));
```

---

## 🌐 Comunicación con API

### Estructura del Servicio (api.js)

```javascript
// src/services/api.js
import axios from 'axios';

// 1. Configuración base
const api = axios.create({
  baseURL: 'http://localhost:3010',
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 10000 // 10 segundos
});

// 2. Interceptores (middlewares)
api.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error);
    // Aquí puedes manejar errores globales
    // Ej: redirigir al login si es 401
    return Promise.reject(error);
  }
);

// 3. Endpoints organizados por módulo
export const leadsAPI = {
  getAll: (params) => api.get('/leads', { params }),
  getById: (id) => api.get(`/leads/${id}`),
  create: (data) => api.post('/leads', data),
  update: (id, data) => api.put(`/leads/${id}`, data),
  delete: (id) => api.delete(`/leads/${id}`)
};

export const sessionAPI = {
  getStatus: () => api.get('/session-manager/status'),
  getQR: () => api.get('/session-manager/qr'),
  disconnect: () => api.post('/session-manager/disconnect')
};
```

### Uso en Componentes

```jsx
import { leadsAPI } from '../../services/api';

function LeadsManager() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Cargar datos
  const loadLeads = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await leadsAPI.getAll();
      setLeads(response.data);
    } catch (err) {
      setError(err.message);
      console.error('Error cargando leads:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Crear lead
  const handleCreate = async (formData) => {
    try {
      const response = await leadsAPI.create(formData);
      setLeads([...leads, response.data]);
      alert('Lead creado');
    } catch (err) {
      alert('Error al crear lead');
    }
  };
  
  // Actualizar lead
  const handleUpdate = async (id, formData) => {
    try {
      await leadsAPI.update(id, formData);
      setLeads(leads.map(l => l.id === id ? formData : l));
      alert('Lead actualizado');
    } catch (err) {
      alert('Error al actualizar');
    }
  };
  
  // Eliminar lead
  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar?')) return;
    
    try {
      await leadsAPI.delete(id);
      setLeads(leads.filter(l => l.id !== id));
      alert('Lead eliminado');
    } catch (err) {
      alert('Error al eliminar');
    }
  };
  
  useEffect(() => {
    loadLeads();
  }, []);
  
  return (
    <div>
      {loading && <LoadingSpinner />}
      {error && <div className="text-danger">{error}</div>}
      {/* ... resto del componente */}
    </div>
  );
}
```

### Polling (Actualización Automática)

```jsx
function Dashboard() {
  const [stats, setStats] = useState(null);
  
  useEffect(() => {
    // Función para cargar datos
    const loadStats = async () => {
      const response = await statsAPI.getDashboard();
      setStats(response.data);
    };
    
    // Cargar inmediatamente
    loadStats();
    
    // Configurar intervalo (cada 10 segundos)
    const interval = setInterval(loadStats, 10000);
    
    // Limpiar intervalo al desmontar
    return () => clearInterval(interval);
  }, []);
  
  return <div>{JSON.stringify(stats)}</div>;
}
```

---

## 🎨 Estilos con Tailwind CSS

### Clases Utility-First

En lugar de escribir CSS, usas clases predefinidas:

```jsx
// Espaciado
<div className="p-4">        {/* padding: 1rem (16px) */}
<div className="px-6">       {/* padding-left/right: 1.5rem */}
<div className="mt-2">       {/* margin-top: 0.5rem */}
<div className="space-y-4">  {/* espacio vertical entre hijos */}

// Colores
<div className="bg-blue-500">      {/* fondo azul */}
<div className="text-white">       {/* texto blanco */}
<div className="border-gray-300">  {/* borde gris */}

// Tipografía
<h1 className="text-3xl font-bold">  {/* tamaño y peso */}
<p className="text-sm text-gray-600"> {/* pequeño y gris */}

// Layout
<div className="flex items-center justify-between">
<div className="grid grid-cols-3 gap-4">

// Responsive
<div className="md:flex lg:grid-cols-4">
  {/* flex en tablet+, grid 4 cols en desktop */}
</div>

// Interactividad
<button className="hover:bg-blue-600 active:scale-95">
  {/* cambios al pasar mouse y click */}
</button>
```

### Clases Personalizadas

```css
/* src/index.css */
@layer components {
  .card {
    @apply bg-white rounded-lg shadow-md p-6;
  }
  
  .btn-primary {
    @apply bg-primary hover:bg-blue-600 text-white 
           font-medium py-2 px-4 rounded-lg transition-colors;
  }
}
```

```jsx
// Ahora puedes usar .card y .btn-primary
<div className="card">
  <button className="btn-primary">Guardar</button>
</div>
```

### Responsive Design

Tailwind es mobile-first:

```jsx
<div className="
  w-full          {/* móvil: 100% ancho */}
  md:w-1/2        {/* tablet: 50% ancho */}
  lg:w-1/3        {/* desktop: 33% ancho */}
  xl:w-1/4        {/* desktop grande: 25% ancho */}
">
  Contenido responsive
</div>

// Breakpoints:
// sm: 640px
// md: 768px
// lg: 1024px
// xl: 1280px
// 2xl: 1536px
```

---

## 🔄 Flujo de Datos

### Ejemplo Completo: Gestión de Leads

```
1. Usuario carga la página /leads
   ↓
2. React Router renderiza <LeadsManager />
   ↓
3. useEffect se ejecuta (componentDidMount)
   ↓
4. loadLeads() llama a leadsAPI.getAll()
   ↓
5. Axios hace petición GET a http://localhost:3010/leads
   ↓
6. Backend responde con array de leads
   ↓
7. setLeads(response.data) actualiza el estado
   ↓
8. React re-renderiza el componente con los nuevos datos
   ↓
9. Usuario ve la tabla de leads
   ↓
10. Usuario hace click en "Eliminar" de un lead
    ↓
11. handleDelete(id) se ejecuta
    ↓
12. confirm() muestra diálogo de confirmación
    ↓
13. Si confirma, leadsAPI.delete(id) hace DELETE al backend
    ↓
14. Backend elimina el lead y responde 200 OK
    ↓
15. setLeads(leads.filter(...)) actualiza el estado local
    ↓
16. React re-renderiza sin el lead eliminado
    ↓
17. Usuario ve la lista actualizada
```

---

## 🎯 Patrones y Buenas Prácticas

### 1. Separación de Responsabilidades

```jsx
// ❌ Mal: Todo en un componente gigante
function LeadsManager() {
  // 500 líneas de código...
}

// ✅ Bien: Separar en componentes más pequeños
function LeadsManager() {
  return (
    <>
      <LeadsHeader />
      <LeadsFilters />
      <LeadsTable />
      <LeadFormModal />
    </>
  );
}
```

### 2. Custom Hooks (Lógica Reutilizable)

```jsx
// Hook personalizado para fetch de datos
function useFetch(url) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    fetch(url)
      .then(res => res.json())
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [url]);
  
  return { data, loading, error };
}

// Uso
function MiComponente() {
  const { data, loading, error } = useFetch('/api/leads');
  
  if (loading) return <LoadingSpinner />;
  if (error) return <div>Error: {error.message}</div>;
  
  return <div>{JSON.stringify(data)}</div>;
}
```

### 3. Composición sobre Herencia

```jsx
// ✅ Componentes como contenedores (composition)
function Card({ children, title }) {
  return (
    <div className="card">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

// Uso flexible
<Card title="Mis Datos">
  <p>Cualquier contenido aquí</p>
  <Button>Acción</Button>
</Card>
```

### 4. Manejo de Errores

```jsx
function MiComponente() {
  const [error, setError] = useState(null);
  
  const handleAction = async () => {
    try {
      await api.post('/endpoint', data);
      alert('Éxito');
    } catch (err) {
      setError(err.message);
      console.error('Error:', err);
    }
  };
  
  return (
    <div>
      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded">
          <p className="text-red-800">{error}</p>
          <button onClick={() => setError(null)}>Cerrar</button>
        </div>
      )}
      {/* ... resto del componente */}
    </div>
  );
}
```

### 5. Loading States

```jsx
function LeadsManager() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  
  useEffect(() => {
    loadData();
  }, []);
  
  if (loading) {
    return <LoadingSpinner text="Cargando leads..." />;
  }
  
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No hay leads para mostrar
      </div>
    );
  }
  
  return (
    <div>
      {data.map(item => (
        <LeadCard key={item.id} lead={item} />
      ))}
    </div>
  );
}
```

### 6. Keys en Listas

```jsx
// ❌ Mal: Índice como key
{items.map((item, index) => (
  <div key={index}>{item.name}</div>
))}

// ✅ Bien: ID único como key
{items.map(item => (
  <div key={item.id}>{item.name}</div>
))}
```

### 7. Evitar Re-renders Innecesarios

```jsx
// Memoizar valores calculados
const expensiveValue = useMemo(() => {
  return items.reduce((sum, item) => sum + item.price, 0);
}, [items]); // Solo recalcula si items cambia

// Memoizar callbacks
const handleClick = useCallback(() => {
  console.log('Click');
}, []); // La función no cambia entre renders
```

---

## 🚀 Desarrollo y Debugging

### Herramientas Esenciales

**React Developer Tools** (extensión de Chrome/Firefox)
- Inspeccionar árbol de componentes
- Ver props y estado en tiempo real
- Analizar performance

**Console.log estratégico**
```jsx
useEffect(() => {
  console.log('Componente montado');
  console.log('Leads actuales:', leads);
}, [leads]);
```

**Error Boundaries**
```jsx
class ErrorBoundary extends React.Component {
  state = { hasError: false };
  
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  
  componentDidCatch(error, info) {
    console.error('Error capturado:', error, info);
  }
  
  render() {
    if (this.state.hasError) {
      return <h1>Algo salió mal</h1>;
    }
    return this.props.children;
  }
}

// Uso
<ErrorBoundary>
  <App />
</ErrorBoundary>
```

---

## 📚 Recursos Adicionales

### Documentación Oficial
- **React:** https://react.dev
- **Vite:** https://vitejs.dev
- **Tailwind CSS:** https://tailwindcss.com
- **React Router:** https://reactrouter.com
- **Axios:** https://axios-http.com

### Conceptos a Profundizar
- **Virtual DOM:** Cómo React optimiza actualizaciones
- **Reconciliation:** Algoritmo de diff de React
- **JSX:** Sintaxis extendida de JavaScript
- **Hooks avanzados:** useReducer, useContext, useRef
- **Performance:** React.memo, lazy loading, code splitting

---

## 🎓 Glosario

**SPA (Single Page Application):** Aplicación de una sola página que no recarga el navegador

**Component:** Función que retorna JSX (elementos de UI)

**Props:** Propiedades que se pasan de padre a hijo

**State:** Datos que cambian y causan re-renders

**Hook:** Función especial de React (useState, useEffect, etc.)

**JSX:** Sintaxis que mezcla JavaScript con HTML

**Virtual DOM:** Representación en memoria del DOM real

**Re-render:** Cuando React actualiza la UI porque cambió el estado

**Mounting:** Cuando un componente se agrega al DOM

**Unmounting:** Cuando un componente se elimina del DOM

---

_Esta documentación está diseñada para ayudarte a entender la arquitectura del frontend desde cero. Lee cada sección con calma y experimenta con el código para aprender mejor._
