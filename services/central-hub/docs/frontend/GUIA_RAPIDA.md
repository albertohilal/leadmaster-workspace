# Guía Rápida de Inicio - Frontend LeadMaster

Esta guía te ayudará a empezar a trabajar con el frontend en minutos.

## 🚀 Inicio Rápido

### 1. Instalar Dependencias

```bash
cd /home/beto/Documentos/Github/leadmaster-central-hub/frontend
npm install
```

### 2. Iniciar Servidor de Desarrollo

```bash
npm run dev
```

La aplicación estará disponible en: **http://localhost:5173**

### 3. Asegúrate que el Backend Esté Corriendo

El frontend necesita conectarse al backend en `http://localhost:3010`

```bash
# En otra terminal, desde la raíz del proyecto
cd /home/beto/Documentos/Github/leadmaster-central-hub
node src/index.js
```

---

## 📂 Archivos Principales

### Empezar por Aquí

1. **`src/App.jsx`** - Define las rutas de la aplicación
2. **`src/components/dashboard/Dashboard.jsx`** - Página principal
3. **`src/services/api.js`** - Toda la comunicación con el backend

### Componentes por Funcionalidad

| Archivo | Qué hace |
|---------|----------|
| `components/whatsapp/SessionManager.jsx` | Gestión de sesión WhatsApp (QR, conexión) |
| `components/leads/LeadsManager.jsx` | CRUD completo de leads |
| `components/listener/ListenerControl.jsx` | Control de modos y logs del listener |
| `components/campaigns/CampaignsManager.jsx` | Crear y gestionar campañas |
| `components/config/ConfigPanel.jsx` | Configuración del sistema |

---

## 🔧 Tareas Comunes

### Agregar un Nuevo Componente

1. Crear archivo en `src/components/nombre/MiComponente.jsx`
2. Estructura básica:

```jsx
import React, { useState } from 'react';
import Card from '../common/Card';

const MiComponente = () => {
  const [data, setData] = useState(null);
  
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Mi Componente</h1>
      <Card title="Mi Card">
        <p>Contenido aquí</p>
      </Card>
    </div>
  );
};

export default MiComponente;
```

3. Agregar ruta en `src/App.jsx`:

```jsx
import MiComponente from './components/nombre/MiComponente';

// Dentro de <Routes>
<Route path="/mi-ruta" element={<MiComponente />} />
```

4. Agregar al menú en `src/components/layout/Sidebar.jsx`:

```jsx
{ 
  path: '/mi-ruta', 
  icon: '🎯', 
  label: 'Mi Sección' 
}
```

### Agregar un Nuevo Endpoint de API

En `src/services/api.js`:

```javascript
export const miModuloAPI = {
  getAll: () => api.get('/mi-modulo'),
  getById: (id) => api.get(`/mi-modulo/${id}`),
  create: (data) => api.post('/mi-modulo', data),
  update: (id, data) => api.put(`/mi-modulo/${id}`, data),
  delete: (id) => api.delete(`/mi-modulo/${id}`)
};
```

Usar en componente:

```jsx
import { miModuloAPI } from '../../services/api';

const loadData = async () => {
  try {
    const response = await miModuloAPI.getAll();
    setData(response.data);
  } catch (error) {
    console.error('Error:', error);
  }
};
```

### Crear un Modal

```jsx
import Modal from '../common/Modal';

const [showModal, setShowModal] = useState(false);

// En el JSX
<button onClick={() => setShowModal(true)}>Abrir Modal</button>

<Modal
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  title="Mi Modal"
>
  <div>
    <p>Contenido del modal</p>
    <Button onClick={() => setShowModal(false)}>Cerrar</Button>
  </div>
</Modal>
```

### Agregar un Formulario

```jsx
const [formData, setFormData] = useState({
  nombre: '',
  email: ''
});

const handleSubmit = async (e) => {
  e.preventDefault();
  try {
    await api.post('/endpoint', formData);
    alert('Guardado!');
  } catch (error) {
    alert('Error al guardar');
  }
};

// JSX
<form onSubmit={handleSubmit}>
  <input
    type="text"
    value={formData.nombre}
    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
    className="w-full px-4 py-2 border rounded"
  />
  <button type="submit" className="btn-primary">
    Guardar
  </button>
</form>
```

---

## 🎨 Tailwind CSS - Clases Más Usadas

### Espaciado
```jsx
<div className="p-4">       {/* padding todo alrededor */}
<div className="px-6 py-4"> {/* padding horizontal y vertical */}
<div className="mt-4">      {/* margin-top */}
<div className="space-y-6"> {/* espacio vertical entre hijos */}
```

### Layout
```jsx
<div className="flex items-center justify-between">
<div className="grid grid-cols-3 gap-4">
```

### Colores
```jsx
<div className="bg-white text-gray-800">
<div className="bg-primary text-white">
<div className="bg-success text-white">
<div className="bg-danger text-white">
```

### Tipografía
```jsx
<h1 className="text-3xl font-bold">
<p className="text-sm text-gray-600">
```

### Bordes y Sombras
```jsx
<div className="border border-gray-300 rounded-lg shadow-md">
```

### Hover y Estados
```jsx
<button className="hover:bg-blue-600 active:scale-95">
```

---

## 🐛 Debugging

### Ver Estado de Componente

```jsx
console.log('Estado actual:', { leads, loading, error });
```

### React DevTools

1. Instalar extensión "React Developer Tools"
2. Abrir DevTools (F12)
3. Pestaña "Components" para ver árbol de componentes
4. Pestaña "Profiler" para analizar performance

### Ver Peticiones de Red

1. F12 → Pestaña "Network"
2. Filtrar por "XHR" para ver peticiones AJAX
3. Click en petición para ver detalles (headers, body, response)

### Errores Comunes

**"Cannot read property of undefined"**
- Verificar que los datos existan antes de usarlos
- Usar optional chaining: `data?.property`

**"Too many re-renders"**
- No llamar setState directamente en el render
- Usar useCallback para funciones que se pasan como props

**"Key is not defined"**
- Siempre usar `key` único en listas
- Preferir IDs sobre índices

---

## 📱 Testing Manual

### Checklist de Pruebas

- [ ] Dashboard carga métricas correctamente
- [ ] Sidebar navega entre secciones
- [ ] Header muestra estado de WhatsApp
- [ ] Gestión de sesión WhatsApp funciona (QR, conectar/desconectar)
- [ ] CRUD de leads funciona (crear, editar, eliminar)
- [ ] Toggle de IA en leads funciona
- [ ] Cambio de modo del listener funciona
- [ ] Crear campaña funciona
- [ ] Responsive en móvil funciona
- [ ] No hay errores en consola

---

## 🔥 Hot Tips

### 1. Usar Snippet de Componente

Crear archivo: `.vscode/react.code-snippets`

```json
{
  "React Component": {
    "prefix": "rfc",
    "body": [
      "import React, { useState } from 'react';",
      "",
      "const ${1:ComponentName} = () => {",
      "  return (",
      "    <div>",
      "      $0",
      "    </div>",
      "  );",
      "};",
      "",
      "export default ${1:ComponentName};"
    ]
  }
}
```

Ahora escribe `rfc` + Tab para generar un componente.

### 2. Auto-import

VS Code puede auto-importar componentes. Escribe el nombre del componente y presiona Ctrl+Space para ver sugerencias.

### 3. Formato Automático

Instalar Prettier:
```bash
npm install -D prettier
```

Crear `.prettierrc`:
```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2
}
```

Formatear con `Shift + Alt + F`

### 4. Live Server con Backend

Si el backend y frontend corren en puertos diferentes, ya está configurado el proxy en `vite.config.js`:

```javascript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3010',
      changeOrigin: true
    }
  }
}
```

---

## 📚 Siguientes Pasos

1. ✅ **Lee la arquitectura completa:** `docs/ARQUITECTURA_FRONTEND.md`
2. 🎨 **Personaliza los estilos:** Modifica `tailwind.config.js`
3. 🔌 **Conecta con backend real:** Verifica endpoints en `src/services/api.js`
4. 🧪 **Prueba en diferentes dispositivos:** Chrome DevTools → Device Toolbar
5. 📝 **Agrega tus propias funcionalidades:** Sigue los ejemplos de componentes existentes

---

## 🆘 Necesitas Ayuda?

### Recursos
- **Documentación React:** https://react.dev/learn
- **Tailwind Playground:** https://play.tailwindcss.com
- **Ejemplos de componentes:** https://tailwindui.com/components

### Comandos Útiles

```bash
# Ver qué componentes usan un hook específico
grep -r "useState" src/components/

# Ver estructura del proyecto
tree src/components/ -L 2

# Buscar un componente por nombre
find src -name "*Lead*"
```

---

¡Listo para empezar! 🚀

Abre el navegador en http://localhost:5173 y explora la aplicación.
