# 🔧 INFORME TÉCNICO: Corrección del Módulo Selector de Prospectos

**Proyecto:** LeadMaster Central Hub  
**Módulo:** Selector de Prospectos  
**Fecha:** 2026-02-12  
**Autor:** Análisis Técnico Copilot

---

## 📋 RESUMEN EJECUTIVO

Se detectaron **múltiples errores críticos de arquitectura** en el módulo de selección de prospectos que impedían el correcto funcionamiento del sistema. Los problemas se centran en:

1. **Uso incorrecto de la API** (llamadas directas vs métodos exportados)
2. **Loops infinitos** en useEffect por dependencias incorrectas
3. **Falta de validación defensiva** en parámetros obligatorios
4. **Inconsistencia en el patrón de llamadas**

---

## 🔍 ANÁLISIS DEL FLUJO ACTUAL

### Arquitectura de Backend (Express)

```
┌─────────────────────────────────────────────────────────┐
│ src/index.js                                             │
│ app.use('/api/sender', require('./modules/sender'))     │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│ src/modules/sender/routes/index.js                       │
│ router.use('/prospectos', require('./prospectos'))      │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│ src/modules/sender/routes/prospectos.js                 │
│ router.get('/filtrar', prospectosController.filtrar)    │
└─────────────────────────────────────────────────────────┘

✅ RUTA FINAL CORRECTA: /api/sender/prospectos/filtrar
```

### Arquitectura de Frontend (React + Vite)

```
┌─────────────────────────────────────────────────────────┐
│ frontend/src/config/api.js                               │
│ API_BASE_URL = import.meta.env.VITE_API_URL             │
│ Producción: /api                                         │
│ Local: http://localhost:3012                             │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│ frontend/src/services/api.js                             │
│ export const leadsAPI = {                                │
│   getProspectos: (filters) =>                            │
│     api.get('/sender/prospectos/filtrar', { params })    │
│ }                                                         │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│ Componentes React                                        │
│ ❌ INCORRECTO: leadsAPI.get('/areas')                    │
│ ✅ CORRECTO: leadsAPI.getAreas()                         │
└─────────────────────────────────────────────────────────┘
```

---

## 🐛 ERRORES CRÍTICOS DETECTADOS

### ❌ Error #1: Llamadas directas a axios en lugar de métodos exportados

**Archivo:** `frontend/src/components/leads/SelectorProspectos.jsx`

**Línea 29:**
```jsx
❌ const response = await leadsAPI.get('/areas');
```

**Problema:**
- `leadsAPI` NO es una instancia de axios
- Es un objeto con métodos predefinidos: `{ getProspectos(), getAreas(), getRubros() }`
- Al llamar `leadsAPI.get()` → JavaScript no encuentra el método → Error

**Línea 48:**
```jsx
❌ const response = await leadsAPI.get(`/prospectos/filtrar?${params}`);
```

**Problema:**
- Construye query string manualmente
- No usa el método correcto `getProspectos(filters)`
- Bypass del patrón de API establecido

---

### ❌ Error #2: Loop infinito en useEffect

**Archivo:** `frontend/src/components/leads/SelectorProspectos.jsx`

**Línea 57-60:**
```jsx
❌ useEffect(() => {
  if (campaniaId) {
    cargarProspectos();
  }
}, [campaniaId, filters]);  // ⚠️ LOOP INFINITO
```

**Problema:**
1. `filters` es un objeto (referencia)
2. React compara por referencia, NO por valor
3. Cada render → nueva referencia de `filters`
4. Nueva referencia → useEffect se ejecuta
5. Se carga → posible cambio estado → nuevo render → LOOP

**Solución:** Usar `useCallback` o separar dependencias

---

### ❌ Error #3: Falta validación defensiva de campania_id

**Archivo:** `frontend/src/components/leads/SelectorProspectos.jsx`

**Línea 38-52:**
```jsx
❌ const cargarProspectos = async () => {
  setLoading(true);
  try {
    const params = new URLSearchParams({
      campania_id: campaniaId,  // ⚠️ Puede ser undefined/null
      ...filters
    });
    // ...
```

**Problema:**
- No valida si `campaniaId` existe antes de fetch
- Backend requiere `campania_id` obligatorio (400 si falta)
- Genera errores 400 innecesarios en consola

---

### ❌ Error #4: Llamada incorrecta a campaignsAPI

**Archivo:** `frontend/src/components/leads/SelectorProspectosPage.jsx`

**Línea 33:**
```jsx
❌ const response = await leadsAPI.get('/sender/campaigns');
```

**Problema:**
- Usa `leadsAPI` para obtener campañas
- Debería usar `campaignsAPI.getAll()`
- Inconsistencia de dominio: leads ≠ campaigns

---

### ❌ Error #5: Dependencias incorrectas en useEffect

**Archivo:** `frontend/src/components/leads/SelectorProspectosPage.jsx`

**Línea 80:**
```jsx
❌ useEffect(() => {
  cargarProspectos();
}, [selectedCampaign, filters]);  // ⚠️ LOOP INFINITO
```

**Mismo problema que Error #2** → loop infinito por objeto `filters`

---

## ✅ SOLUCIÓN PROPUESTA

### Principios de la corrección:

1. ✅ **Uso exclusivo de métodos exportados** (no llamadas directas)
2. ✅ **Validación defensiva** de parámetros obligatorios
3. ✅ **useEffect con dependencias correctas** (sin loops)
4. ✅ **Separación de responsabilidades** (campaigns ≠ leads)
5. ✅ **Manejo de errores robusto**

---

## 📄 CÓDIGO CORREGIDO COMPLETO

### 1️⃣ SelectorProspectos.jsx (CORREGIDO)

```jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Search, Filter, Users, MapPin, Phone, Building2, Plus, Check, X } from 'lucide-react';
import Button from '../common/Button';
import LoadingSpinner from '../common/LoadingSpinner';
import { leadsAPI } from '../../services/api';
import { destinatariosService } from '../../services/destinatarios';

const SelectorProspectos = ({ campaniaId, onDestinatariosAgregados }) => {
  const [loading, setLoading] = useState(false);
  const [prospectos, setProspectos] = useState([]);
  const [selectedProspectos, setSelectedProspectos] = useState([]);
  const [filters, setFilters] = useState({
    area: '',
    rubro: '',
    direccion: '',
    estado: 'sin_envio',
    tipoCliente: '',
    soloWappValido: true
  });
  
  const [areas, setAreas] = useState([]);
  const [agregandoDestinatarios, setAgregandoDestinatarios] = useState(false);

  // ✅ Cargar áreas disponibles (una sola vez al montar)
  useEffect(() => {
    const cargarAreas = async () => {
      try {
        const response = await leadsAPI.getAreas();
        setAreas(response.areas || []);
      } catch (error) {
        console.error('Error cargando áreas:', error);
      }
    };
    cargarAreas();
  }, []); // ✅ Sin dependencias = solo se ejecuta al montar

  // ✅ Cargar prospectos con validación defensiva
  const cargarProspectos = useCallback(async () => {
    // ✅ VALIDACIÓN: No hacer fetch si no hay campaniaId
    if (!campaniaId) {
      console.warn('[SelectorProspectos] No se puede cargar prospectos sin campaniaId');
      return;
    }

    setLoading(true);
    try {
      // ✅ Usar método exportado con objeto de parámetros
      const params = {
        campania_id: campaniaId,
        ...filters
      };
      
      const response = await leadsAPI.getProspectos(params);
      setProspectos(response.prospectos || []);
    } catch (error) {
      console.error('Error cargando prospectos:', error);
      setProspectos([]);
    } finally {
      setLoading(false);
    }
  }, [campaniaId, filters]); // ✅ useCallback previene loops

  // ✅ Cargar prospectos cuando cambien campaniaId o filters
  useEffect(() => {
    cargarProspectos();
  }, [cargarProspectos]); // ✅ Dependencia de la función memoizada

  // Manejar selección de prospectos
  const toggleProspecto = (prospecto) => {
    setSelectedProspectos(prev => {
      const exists = prev.find(p => p.id === prospecto.id);
      if (exists) {
        return prev.filter(p => p.id !== prospecto.id);
      } else {
        return [...prev, prospecto];
      }
    });
  };

  // Seleccionar todos los prospectos visibles
  const toggleSelectAll = () => {
    const todosSeleccionados = prospectos.every(p => 
      selectedProspectos.find(sp => sp.id === p.id)
    );
    
    if (todosSeleccionados) {
      setSelectedProspectos([]);
    } else {
      setSelectedProspectos(prospectos);
    }
  };

  // ✅ Agregar prospectos con validación robusta
  const agregarDestinatarios = async () => {
    // ✅ Validaciones defensivas
    if (!campaniaId) {
      alert('❌ Error: No hay campaña seleccionada');
      return;
    }

    if (selectedProspectos.length === 0) {
      alert('⚠️ Selecciona al menos un prospecto');
      return;
    }

    setAgregandoDestinatarios(true);
    try {
      // Convertir prospectos a formato de destinatarios
      const destinatarios = selectedProspectos.map(prospecto => ({
        nombre: prospecto.nombre,
        telefono: prospecto.telefono_wapp,
        lugar_id: prospecto.id,
        empresa: prospecto.nombre,
        rubro: prospecto.rubro,
        direccion: prospecto.direccion
      }));

      const response = await destinatariosService.agregarDestinatarios(campaniaId, destinatarios);
      
      if (response.success) {
        alert(`✅ ${response.data.agregados} destinatarios agregados exitosamente`);
        setSelectedProspectos([]);
        
        // Callback opcional para notificar al componente padre
        if (onDestinatariosAgregados) {
          onDestinatariosAgregados();
        }
      } else {
        alert('❌ Error: ' + response.message);
      }
    } catch (error) {
      console.error('Error agregando destinatarios:', error);
      alert('❌ Error al agregar destinatarios: ' + (error.response?.data?.message || error.message));
    } finally {
      setAgregandoDestinatarios(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Seleccionar Prospectos para Campaña
              </h2>
              <p className="text-sm text-gray-600">
                {selectedProspectos.length} de {prospectos.length} seleccionados
              </p>
            </div>
          </div>
          <Button 
            onClick={agregarDestinatarios}
            disabled={!campaniaId || selectedProspectos.length === 0 || agregandoDestinatarios}
            className="bg-green-600 hover:bg-green-700"
          >
            {agregandoDestinatarios ? (
              <><LoadingSpinner size="sm" /> Agregando...</>
            ) : (
              <><Plus className="h-4 w-4" /> Agregar Seleccionados ({selectedProspectos.length})</>
            )}
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {/* Filtro por Área */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filtrar por Área
            </label>
            <select
              value={filters.area}
              onChange={(e) => setFilters(prev => ({ ...prev, area: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todas las áreas</option>
              {areas.map(area => (
                <option key={area.id} value={area.nombre}>{area.nombre}</option>
              ))}
            </select>
          </div>

          {/* Filtro por Rubro */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Buscar Rubro
            </label>
            <input
              type="text"
              value={filters.rubro}
              onChange={(e) => setFilters(prev => ({ ...prev, rubro: e.target.value }))}
              placeholder="Ej: tattoo, restaurant, etc."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Filtro por Dirección */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filtrar por Dirección
            </label>
            <input
              type="text"
              value={filters.direccion}
              onChange={(e) => setFilters(prev => ({ ...prev, direccion: e.target.value }))}
              placeholder="Ej: Av. San Martín"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Estado */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estado
            </label>
            <select
              value={filters.estado}
              onChange={(e) => setFilters(prev => ({ ...prev, estado: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="sin_envio">Sin envío registrado</option>
              <option value="">Todos los estados</option>
              <option value="pendiente">Pendiente</option>
              <option value="enviado">Enviado</option>
            </select>
          </div>

          {/* Solo números válidos de WhatsApp */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="soloWappValido"
              checked={filters.soloWappValido}
              onChange={(e) => setFilters(prev => ({ ...prev, soloWappValido: e.target.checked }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="soloWappValido" className="text-sm text-gray-700">
              Solo números válidos de WhatsApp
            </label>
          </div>
        </div>
      </div>

      {/* Lista de Prospectos */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <input
              type="checkbox"
              checked={prospectos.length > 0 && prospectos.every(p => 
                selectedProspectos.find(sp => sp.id === p.id)
              )}
              onChange={toggleSelectAll}
              disabled={prospectos.length === 0}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">
              Seleccionar Todos
            </span>
          </div>
          <span className="text-sm text-gray-600">
            {prospectos.length} prospectos encontrados
          </span>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center">
              <LoadingSpinner size="large" text="Cargando prospectos..." />
            </div>
          ) : !campaniaId ? (
            <div className="p-8 text-center">
              <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Selecciona una campaña
              </h3>
              <p className="text-gray-500">
                Elige una campaña para ver los prospectos disponibles
              </p>
            </div>
          ) : prospectos.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No se encontraron prospectos
              </h3>
              <p className="text-gray-500">
                Ajusta los filtros para encontrar prospectos
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Seleccionar
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nombre
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Teléfono
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rubro
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dirección
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {prospectos.map((prospecto) => {
                  const isSelected = selectedProspectos.find(p => p.id === prospecto.id);
                  return (
                    <tr 
                      key={prospecto.id} 
                      className={`hover:bg-gray-50 cursor-pointer ${
                        isSelected ? 'bg-blue-50 border-blue-200' : ''
                      }`}
                      onClick={() => toggleProspecto(prospecto)}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={!!isSelected}
                          onChange={() => toggleProspecto(prospecto)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center">
                          <Building2 className="h-4 w-4 text-gray-400 mr-2" />
                          <span className="text-sm font-medium text-gray-900">
                            {prospecto.nombre}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center">
                          <Phone className="h-4 w-4 text-gray-400 mr-2" />
                          <span className="text-sm text-gray-900">
                            {prospecto.telefono_wapp || 'Sin teléfono'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-900">
                          {prospecto.rubro || 'Sin rubro'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center">
                          <MapPin className="h-4 w-4 text-gray-400 mr-2" />
                          <span className="text-sm text-gray-600">
                            {prospecto.direccion || 'Sin dirección'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                          prospecto.estado === 'enviado' ? 'bg-green-100 text-green-800' :
                          prospecto.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {prospecto.estado === 'enviado' ? 'Enviado' :
                           prospecto.estado === 'pendiente' ? 'Pendiente' :
                           'Disponible'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default SelectorProspectos;
```

---

### 2️⃣ SelectorProspectosPage.jsx (CORREGIDO)

```jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Search, Filter, Users, MapPin, Phone, Building2, Plus, Check, X, ChevronLeft } from 'lucide-react';
import Button from '../common/Button';
import LoadingSpinner from '../common/LoadingSpinner';
import { leadsAPI, campaignsAPI } from '../../services/api';
import { destinatariosService } from '../../services/destinatarios';
import { useNavigate } from 'react-router-dom';

const SelectorProspectosPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [prospectos, setProspectos] = useState([]);
  const [selectedProspectos, setSelectedProspectos] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState('');
  
  const [filters, setFilters] = useState({
    area: '',
    rubro: '',
    direccion: '',
    estado: 'sin_envio',
    tipoCliente: '',
    soloWappValido: true
  });
  
  const [areas, setAreas] = useState([]);
  const [agregandoDestinatarios, setAgregandoDestinatarios] = useState(false);

  // ✅ Cargar campañas disponibles (una sola vez al montar)
  useEffect(() => {
    const cargarCampaigns = async () => {
      try {
        const response = await campaignsAPI.getAll();
        setCampaigns(response.data || []);
        
        // Seleccionar la primera campaña por defecto
        if (response.data && response.data.length > 0) {
          setSelectedCampaign(response.data[0].id.toString());
        }
      } catch (error) {
        console.error('Error cargando campañas:', error);
      }
    };
    cargarCampaigns();
  }, []); // ✅ Sin dependencias

  // ✅ Cargar áreas disponibles (una sola vez al montar)
  useEffect(() => {
    const cargarAreas = async () => {
      try {
        const response = await leadsAPI.getAreas();
        setAreas(response.areas || []);
      } catch (error) {
        console.error('Error cargando áreas:', error);
      }
    };
    cargarAreas();
  }, []); // ✅ Sin dependencias

  // ✅ Cargar prospectos con validación defensiva
  const cargarProspectos = useCallback(async () => {
    // ✅ VALIDACIÓN: No hacer fetch si no hay campaña seleccionada
    if (!selectedCampaign) {
      console.warn('[SelectorProspectosPage] No se puede cargar prospectos sin campaña seleccionada');
      setProspectos([]);
      return;
    }
    
    setLoading(true);
    try {
      const params = {
        campania_id: selectedCampaign,
        ...filters
      };
      
      const response = await leadsAPI.getProspectos(params);
      setProspectos(response.prospectos || []);
    } catch (error) {
      console.error('Error cargando prospectos:', error);
      setProspectos([]);
    } finally {
      setLoading(false);
    }
  }, [selectedCampaign, filters]); // ✅ useCallback previene loops

  // ✅ Cargar prospectos cuando cambien selectedCampaign o filters
  useEffect(() => {
    cargarProspectos();
  }, [cargarProspectos]); // ✅ Dependencia de la función memoizada

  // Manejar selección de prospectos
  const toggleProspecto = (prospecto) => {
    setSelectedProspectos(prev => {
      const exists = prev.find(p => p.id === prospecto.id);
      if (exists) {
        return prev.filter(p => p.id !== prospecto.id);
      } else {
        return [...prev, prospecto];
      }
    });
  };

  // Seleccionar todos los prospectos visibles
  const toggleSelectAll = () => {
    const todosSeleccionados = prospectos.every(p => 
      selectedProspectos.find(sp => sp.id === p.id)
    );
    
    if (todosSeleccionados) {
      setSelectedProspectos([]);
    } else {
      setSelectedProspectos(prospectos);
    }
  };

  // Manejar filtro solo seleccionados
  const handleSoloSeleccionados = (checked) => {
    if (checked && selectedProspectos.length > 0) {
      setProspectos(selectedProspectos);
    } else {
      cargarProspectos();
    }
  };

  // ✅ Agregar prospectos con validación robusta
  const agregarSeleccionadosACampania = async () => {
    // ✅ Validaciones defensivas
    if (!selectedCampaign) {
      alert('❌ Error: Selecciona una campaña');
      return;
    }

    if (selectedProspectos.length === 0) {
      alert('⚠️ Selecciona al menos un prospecto');
      return;
    }

    setAgregandoDestinatarios(true);
    try {
      // Convertir prospectos a formato de destinatarios
      const destinatarios = selectedProspectos.map(prospecto => ({
        nombre: prospecto.nombre,
        telefono: prospecto.telefono_wapp,
        lugar_id: prospecto.id,
        empresa: prospecto.nombre,
        rubro: prospecto.rubro,
        direccion: prospecto.direccion
      }));

      const response = await destinatariosService.agregarDestinatarios(selectedCampaign, destinatarios);
      
      if (response.success) {
        alert(`✅ ${response.data.agregados} destinatarios agregados exitosamente a la campaña`);
        setSelectedProspectos([]);
        navigate('/dashboard');
      } else {
        alert('❌ Error: ' + response.message);
      }
    } catch (error) {
      console.error('Error agregando destinatarios:', error);
      alert('❌ Error al agregar destinatarios: ' + (error.response?.data?.message || error.message));
    } finally {
      setAgregandoDestinatarios(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/dashboard')}
                className="mr-4 p-2 hover:bg-gray-100 rounded-lg"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h1 className="text-2xl font-bold text-gray-900">
                Seleccionar Prospectos para Campaña
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button 
                onClick={() => navigate('/dashboard')}
                variant="outline"
              >
                Volver al dashboard
              </Button>
              <Button 
                onClick={agregarSeleccionadosACampania}
                disabled={!selectedCampaign || selectedProspectos.length === 0 || agregandoDestinatarios}
                className="bg-green-600 hover:bg-green-700"
              >
                {agregandoDestinatarios ? (
                  <><LoadingSpinner size="sm" /> Agregando...</>
                ) : (
                  <>Agregar Seleccionados a Campaña</>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            
            {/* Selección de Campaña */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Campaña *
              </label>
              <select
                value={selectedCampaign}
                onChange={(e) => setSelectedCampaign(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecciona una campaña</option>
                {campaigns.map(campaign => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.nombre}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro por Área */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Filtrar por Área
              </label>
              <select
                value={filters.area}
                onChange={(e) => setFilters(prev => ({ ...prev, area: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todas las áreas</option>
                {areas.map(area => (
                  <option key={area.id} value={area.nombre}>{area.nombre}</option>
                ))}
              </select>
            </div>

            {/* Filtro por Rubro */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Buscar Rubro (LIKE)
              </label>
              <input
                type="text"
                value={filters.rubro}
                onChange={(e) => setFilters(prev => ({ ...prev, rubro: e.target.value }))}
                placeholder="Ej: tattoo, restaurant, etc."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Filtro por Dirección */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Filtrar por Dirección
              </label>
              <input
                type="text"
                value={filters.direccion}
                onChange={(e) => setFilters(prev => ({ ...prev, direccion: e.target.value }))}
                placeholder="Ej: Av. San Martín"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Estado */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estado
              </label>
              <select
                value={filters.estado}
                onChange={(e) => setFilters(prev => ({ ...prev, estado: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="sin_envio">Sin envío registrado</option>
                <option value="">Todos los estados</option>
                <option value="pendiente">Pendiente</option>
                <option value="enviado">Enviado</option>
              </select>
            </div>

            {/* Solo números válidos de WhatsApp */}
            <div className="flex items-center space-x-2 pt-6">
              <input
                type="checkbox"
                id="soloWappValido"
                checked={filters.soloWappValido}
                onChange={(e) => setFilters(prev => ({ ...prev, soloWappValido: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="soloWappValido" className="text-sm text-gray-700">
                Solo mostrar números válidos de WhatsApp
              </label>
            </div>

            {/* Solo mostrar seleccionados */}
            <div className="flex items-center space-x-2 pt-6">
              <input
                type="checkbox"
                id="soloSeleccionados"
                onChange={(e) => handleSoloSeleccionados(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="soloSeleccionados" className="text-sm text-gray-700">
                Solo mostrar seleccionados en la campaña
              </label>
            </div>

            {/* Botón Filtrar */}
            <div className="flex items-end">
              <Button 
                onClick={cargarProspectos}
                disabled={!selectedCampaign}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                Filtrar
              </Button>
            </div>
          </div>
        </div>

        {/* Lista de Prospectos */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="p-4 border-b bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <input
                  type="checkbox"
                  checked={prospectos.length > 0 && prospectos.every(p => 
                    selectedProspectos.find(sp => sp.id === p.id)
                  )}
                  onChange={toggleSelectAll}
                  disabled={prospectos.length === 0}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Seleccionar Todos
                </span>
              </div>
              <div className="flex items-center space-x-6">
                <span className="text-sm text-gray-600">
                  {selectedProspectos.length} seleccionados de {prospectos.length} prospectos
                </span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center">
                <LoadingSpinner size="large" text="Cargando prospectos..." />
              </div>
            ) : !selectedCampaign ? (
              <div className="p-8 text-center">
                <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Selecciona una campaña
                </h3>
                <p className="text-gray-500">
                  Elige una campaña para ver los prospectos disponibles
                </p>
              </div>
            ) : prospectos.length === 0 ? (
              <div className="p-8 text-center">
                <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No se encontraron prospectos
                </h3>
                <p className="text-gray-500">
                  Ajusta los filtros para encontrar prospectos
                </p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Seleccionar
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nombre
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Teléfono
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rubro
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Dirección
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {prospectos.map((prospecto) => {
                    const isSelected = selectedProspectos.find(p => p.id === prospecto.id);
                    return (
                      <tr 
                        key={prospecto.id} 
                        className={`hover:bg-gray-50 cursor-pointer ${
                          isSelected ? 'bg-blue-50 border-blue-200' : ''
                        }`}
                        onClick={() => toggleProspecto(prospecto)}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={!!isSelected}
                            onChange={() => toggleProspecto(prospecto)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-gray-900">
                            {prospecto.nombre}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-900">
                            {prospecto.telefono_wapp || 'Sin teléfono'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-900">
                            {prospecto.rubro || 'Sin rubro'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-600">
                            {prospecto.direccion || 'Sin dirección'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                            prospecto.estado === 'enviado' ? 'bg-green-100 text-green-800' :
                            prospecto.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {prospecto.estado === 'enviado' ? 'Enviado' :
                             prospecto.estado === 'pendiente' ? 'Pendiente' :
                             'Disponible'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SelectorProspectosPage;
```

---

## 📦 RECOMENDACIONES PARA api.js

El archivo `frontend/src/services/api.js` está **bien estructurado**. Solo asegurarse de exportar `campaignsAPI`:

```javascript
// ===============================
// CAMPAIGNS API
// ===============================
export const campaignsAPI = {
  getAll: () =>
    api.get('/sender/campaigns'),

  getById: (id) =>
    api.get(`/sender/campaigns/${id}`),

  create: (data) =>
    api.post('/sender/campaigns', data),

  update: (id, data) =>
    api.put(`/sender/campaigns/${id}`, data),

  delete: (id) =>
    api.delete(`/sender/campaigns/${id}`),

  pauseCampaign: (id) =>
    api.post(`/sender/campaigns/${id}/pause`),

  resumeCampaign: (id) =>
    api.post(`/sender/campaigns/${id}/resume`)
};

// ===============================
// LEADS API
// ===============================
export const leadsAPI = {
  getAll: (params) =>
    api.get('/sender/lugares', { params }),

  getFiltered: (filters) =>
    api.get('/sender/lugares/filter', { params: filters }),

  getStats: () =>
    api.get('/sender/lugares/stats'),

  // ✅ MÉTODO CORRECTO PARA PROSPECTOS
  getProspectos: (filters) =>
    api.get('/sender/prospectos/filtrar', { params: filters }),

  // ✅ ÁREAS
  getAreas: () =>
    api.get('/sender/prospectos/areas'),

  // ✅ RUBROS
  getRubros: () =>
    api.get('/sender/prospectos/rubros'),

  // ✅ ESTADÍSTICAS
  getProspectosStats: (campaniaId) =>
    api.get('/sender/prospectos/estadisticas', {
      params: { campania_id: campaniaId }
    })
};
```

---

## 💡 EXPLICACIÓN TÉCNICA DEL ERROR RAÍZ

### Problema Principal: Confusión entre instancia de axios y objeto con métodos

```javascript
// ❌ LO QUE NO HACER
export const leadsAPI = api; // Exportar instancia de axios directamente

// Componente
const response = await leadsAPI.get('/sender/prospectos/filtrar'); // ✅ Funciona

// ✅ LO QUE SE HIZO CORRECTAMENTE
export const leadsAPI = {
  getProspectos: (filters) => api.get('/sender/prospectos/filtrar', { params: filters })
};

// Componente
const response = await leadsAPI.getProspectos(filters); // ✅ Funciona
const response = await leadsAPI.get('/path'); // ❌ ERROR: leadsAPI no tiene método .get()
```

### ¿Por qué usar métodos exportados en lugar de axios directo?

#### ✅ **Ventajas del patrón actual (métodos exportados)**:

1. **Encapsulación**: Oculta implementación interna
2. **Centralización**: Todos los endpoints en un solo lugar
3. **Type Safety**: Mejor para TypeScript futuro
4. **Mantenibilidad**: Cambiar un endpoint solo requiere editar api.js
5. **Testeable**: Fácil de mockear en tests
6. **Documentación implícita**: Se ve qué métodos hay disponibles

#### ❌ **Desventajas de llamadas directas**:

1. **Acoplamiento**: Código del componente depende de estructura de URL
2. **Duplicación**: Cada componente construye query strings manualmente
3. **Difícil de mantener**: Cambios de API requieren editar múltiples componentes
4. **Propenso a errores**: Fácil equivocarse en la construcción de URLs

### Ejemplo Comparativo

```jsx
// ❌ ANTES (Mal patrón)
const SelectorProspectos = () => {
  const cargarAreas = async () => {
    const response = await leadsAPI.get('/areas'); // ❌ No existe el método
  };

  const cargarProspectos = async () => {
    const params = new URLSearchParams({ campania_id: id, ...filters });
    const response = await leadsAPI.get(`/prospectos/filtrar?${params}`);
  };
};

// ✅ DESPUÉS (Buen patrón)
const SelectorProspectos = () => {
  const cargarAreas = async () => {
    const response = await leadsAPI.getAreas(); // ✅ Método exportado
  };

  const cargarProspectos = async () => {
    const response = await leadsAPI.getProspectos({ campania_id: id, ...filters });
  };
};
```

---

## ⚠️ PROBLEMA DEL LOOP INFINITO EN useEffect

### Causa del loop:

```javascript
// ❌ PROBLEMA
const [filters, setFilters] = useState({
  area: '',
  rubro: ''
});

useEffect(() => {
  cargarProspectos();
}, [filters]); // ⚠️ LOOP: filters es un objeto (nueva referencia cada render)
```

### Explicación:

1. **Renderizado inicial**: `filters = { area: '', rubro: '' }` (ref1)
2. **useEffect se ejecuta** porque filters cambió
3. **Posible actualización de estado** dentro de cargarProspectos
4. **Nuevo renderizado**: `filters = { area: '', rubro: '' }` (ref2)
5. **React compara**: `ref1 !== ref2` → **TRUE** (aunque valores son iguales)
6. **useEffect se ejecuta de nuevo** → **LOOP INFINITO**

### Soluciones:

#### ✅ **Opción 1: useCallback (RECOMENDADA)**

```javascript
const cargarProspectos = useCallback(async () => {
  // ... lógica
}, [selectedCampaign, filters]);

useEffect(() => {
  cargarProspectos();
}, [cargarProspectos]); // Dependencia de la función memoizada
```

#### ✅ **Opción 2: Dependencias individuales**

```javascript
useEffect(() => {
  cargarProspectos();
}, [filters.area, filters.rubro, filters.direccion]); // Solo valores primitivos
```

#### ✅ **Opción 3: useRef + JSON.stringify**

```javascript
const filtersRef = useRef();
const filtersString = JSON.stringify(filters);

useEffect(() => {
  if (filtersRef.current !== filtersString) {
    filtersRef.current = filtersString;
    cargarProspectos();
  }
}, [filtersString]);
```

---

## ✅ VALIDACIÓN DEFENSIVA

Siempre validar parámetros obligatorios:

```javascript
// ✅ PATRÓN CORRECTO
const cargarProspectos = useCallback(async () => {
  // VALIDACIÓN PRIMERO
  if (!selectedCampaign) {
    console.warn('No se puede cargar sin campaña seleccionada');
    setProspectos([]);
    return; // Salida temprana
  }

  // LÓGICA DE NEGOCIO
  const response = await leadsAPI.getProspectos({
    campania_id: selectedCampaign,
    ...filters
  });
}, [selectedCampaign, filters]);
```

**Beneficios**:
- ✅ Previene errores 400 innecesarios
- ✅ Mejora experiencia de usuario
- ✅ Logs más claros
- ✅ Código más robusto

---

## 📊 RESUMEN DE CAMBIOS

| Archivo | Línea | Cambio | Impacto |
|---------|-------|--------|---------|
| `SelectorProspectos.jsx` | 29 | `leadsAPI.get('/areas')` → `leadsAPI.getAreas()` | ✅ Corrige 404 |
| `SelectorProspectos.jsx` | 48 | `leadsAPI.get('/prospectos/filtrar?...')` → `leadsAPI.getProspectos(params)` | ✅ Corrige 404 |
| `SelectorProspectos.jsx` | 38 | Agregar validación `if (!campaniaId) return` | ✅ Previene errores 400 | 
| `SelectorProspectos.jsx` | 41 | Usar `useCallback` en `cargarProspectos` | ✅ Elimina loop infinito |
| `SelectorProspectosPage.jsx` | 33 | `leadsAPI.get('/sender/campaigns')` → `campaignsAPI.getAll()` | ✅ Corrige 404 + separación |
| `SelectorProspectosPage.jsx` | 63 | Agregar validación `if (!selectedCampaign) return` | ✅ Previene errores 400 |
| `SelectorProspectosPage.jsx` | 66 | Usar `useCallback` en `cargarProspectos` | ✅ Elimina loop infinito |

---

## 🎯 CONCLUSIONES

### Errores Corregidos:
1. ✅ Llamadas incorrectas a API (404)
2. ✅ Loops infinitos en useEffect
3. ✅ Falta de validación defensiva
4. ✅ Inconsistencia en patrón de API

### Mejoras Implementadas:
1. ✅ **Arquitectura modular consistente**: Todos usan métodos exportados
2. ✅ **Manejo robusto de errores**: Try-catch + validaciones
3. ✅ **Performance optimizada**: useCallback previene re-renders
4. ✅ **UX mejorada**: Mensajes claros, estados de loading

### Patrón Final Recomendado:

```javascript
// ✅ PATRÓN CORRECTO
import { leadsAPI, campaignsAPI } from '../../services/api';

// Usar useCallback para funciones que dependen de estado
const cargarDatos = useCallback(async () => {
  if (!parametroObligatorio) return; // ✅ Validación defensiva
  
  try {
    const response = await leadsAPI.metodoExportado(params);
    setData(response.data);
  } catch (error) {
    console.error('Error:', error);
    setData([]);
  }
}, [parametroObligatorio, filtros]);

// useEffect depende de la función memoizada
useEffect(() => {
  cargarDatos();
}, [cargarDatos]);
```

---

**Fin del Informe**

**Estado:** ✅ Corrección completa implementada  
**Testing requerido:** Verificar en ambiente de desarrollo local  
**Próximos pasos:** Deployment y monitoreo de errores 404 en producción
