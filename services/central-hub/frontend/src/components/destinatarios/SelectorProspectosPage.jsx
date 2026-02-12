import React, { useState, useEffect } from 'react';
import { ArrowLeft, Search, Filter, Download, Users, Building, MapPin, Check, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import prospectosService from '../../services/prospectos';
import campanasService from '../../services/campanas';
import destinatariosService from '../../services/destinatarios';

const SelectorProspectosPage = () => {
  const navigate = useNavigate();
  
  // Estados para la página
  const [campanas, setCampanas] = useState([]);
  const [campaniaSeleccionada, setCampaniaSeleccionada] = useState('');
  const [prospectos, setProspectos] = useState([]);
  const [prospectosSeleccionados, setProspectosSeleccionados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Estados para filtros simplificados
  const [filters, setFilters] = useState({
    estado: '',
    q: ''
  });
  
  // Estados estáticos (sin llamadas API)
  const estados = [
    { value: '', label: 'Todos los estados' },
    { value: 'pendiente', label: 'Pendiente' },
    { value: 'enviado', label: 'Enviado' },
    { value: 'error', label: 'Error' }
  ];
  
  // Estados para paginación
  const [paginaActual, setPaginaActual] = useState(1);

  // Cargar datos iniciales
  useEffect(() => {
    cargarDatosIniciales();
  }, []);

  // Cargar prospectos cuando cambien los filtros O la campaña seleccionada
  useEffect(() => {
    if (campaniaSeleccionada) {
      cargarProspectos();
    }
  }, [campaniaSeleccionada, filters, paginaActual]);

  const cargarDatosIniciales = async () => {
    try {
      setLoading(true);
      setError(null);
      // Solo cargar campañas (sin áreas, rubros, etc.)
      const campanasData = await campanasService.obtenerCampanas();
      
      console.log('📊 Campañas cargadas:', campanasData);
      
      // Asegurar que sea array
      const campanasArray = Array.isArray(campanasData) ? campanasData : [];
      
      setCampanas(campanasArray);
    } catch (error) {
      console.error('❌ Error al cargar datos iniciales:', error);
      const errorMsg = error.response?.data?.message || error.message || 'Error al cargar datos';
      setError(errorMsg);
      
      // Si es error de autenticación, mostrar mensaje específico
      if (error.response?.status === 401) {
        setError('Sesión expirada. Por favor, inicia sesión nuevamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const cargarProspectos = async () => {
    try {
      setLoading(true);
      const filtrosConBusqueda = {
        campania_id: campaniaSeleccionada,
        estado: filters.estado,
        q: filters.q
      };
      
      const response = await prospectosService.filtrarProspectos(filtrosConBusqueda);
      console.log('📊 Prospectos recibidos:', response.prospectos?.length);
      
      // Normalizar telefono_wapp para todos los prospectos
      const prospectosNormalizados = (response.prospectos || []).map(p => ({
        ...p,
        telefono_wapp: p.telefono_wapp || p.telefono || p.phone || null
      }));
      
      if (prospectosNormalizados.length > 0) {
        console.log('📊 Primer prospecto normalizado:', prospectosNormalizados[0]);
        console.log('📊 telefono_wapp:', prospectosNormalizados[0].telefono_wapp);
      }
      
      setProspectos(prospectosNormalizados);
    } catch (error) {
      console.error('Error al cargar prospectos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFiltroChange = (campo, valor) => {
    setFilters(prev => ({
      ...prev,
      [campo]: valor
    }));
    setPaginaActual(1); // Resetear a la primera página
  };

  const handleSeleccionarProspecto = (prospecto) => {
    setProspectosSeleccionados(prev => {
      const yaSeleccionado = prev.find(p => p.id === prospecto.id);
      if (yaSeleccionado) {
        return prev.filter(p => p.id !== prospecto.id);
      } else {
        return [...prev, prospecto];
      }
    });
  };

  const handleSeleccionarTodos = () => {
    if (prospectosSeleccionados.length === prospectos.length) {
      setProspectosSeleccionados([]);
    } else {
      setProspectosSeleccionados([...prospectos]);
    }
  };

  const handleAgregarACampania = async () => {
    if (!campaniaSeleccionada || prospectosSeleccionados.length === 0) {
      alert('Selecciona una campaña y al menos un prospecto');
      return;
    }

    try {
      setLoading(true);
      const destinatarios = prospectosSeleccionados.map(p => ({
        telefono_wapp: p.telefono_wapp,
        nombre_destino: p.nombre,
        lugar_id: p.lugar_id || null
      }));

      await destinatariosService.agregarDestinatarios(campaniaSeleccionada, destinatarios);
      alert(`Se agregaron ${destinatarios.length} prospectos a la campaña`);
      setProspectosSeleccionados([]);
    } catch (error) {
      console.error('Error al agregar prospectos a campaña:', error);
      alert('Error al agregar prospectos a la campaña');
    } finally {
      setLoading(false);
    }
  };

  const limpiarFiltros = () => {
    setFilters({
      estado: '',
      q: ''
    });
    setPaginaActual(1);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/campaigns')}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-800"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>Volver a Campañas</span>
            </button>
            <div className="h-6 border-l border-gray-300"></div>
            <h1 className="text-2xl font-bold text-gray-900">Seleccionar Prospectos</h1>
          </div>

          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">
              {prospectosSeleccionados.length} seleccionados
            </span>
            <Users className="h-5 w-5 text-gray-400" />
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Panel de filtros lateral */}
        <div className="w-80 bg-white border-r border-gray-200 p-6">
          <div className="space-y-6">
            {/* Selección de campaña */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Campaña de destino
              </label>
              <select
                value={campaniaSeleccionada}
                onChange={(e) => setCampaniaSeleccionada(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading || campanas.length === 0}
              >
                <option value="">
                  {loading ? 'Cargando campañas...' : 
                   error ? 'Error al cargar campañas' :
                   campanas.length === 0 ? 'No hay campañas disponibles' :
                   'Seleccionar campaña...'}
                </option>
                {campanas.map((campana) => (
                  <option key={campana.id} value={campana.id}>
                    {campana.nombre}
                  </option>
                ))}
              </select>
              
              {/* Mensaje de error */}
              {error && (
                <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600 font-medium mb-2">⚠️ {error}</p>
                  {error.includes('Sesión expirada') || error.includes('Token') ? (
                    <div className="space-y-2">
                      <p className="text-xs text-red-600">
                        Necesitas iniciar sesión para ver las campañas.
                      </p>
                      <button
                        onClick={() => navigate('/login')}
                        className="w-full px-3 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                      >
                        Ir a inicio de sesión
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={cargarDatosIniciales}
                      className="mt-2 text-sm text-red-700 underline hover:text-red-800"
                    >
                      Reintentar
                    </button>
                  )}
                </div>
              )}
              
              {/* Ayuda cuando no hay campañas pero no hay error */}
              {!error && !loading && campanas.length === 0 && (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700 font-medium mb-2">ℹ️ No hay campañas disponibles</p>
                  <p className="text-xs text-blue-600 mb-2">
                    Primero debes crear una campaña desde el módulo de Campañas.
                  </p>
                  <button
                    onClick={() => navigate('/campaigns')}
                    className="w-full px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                  >
                    Ir a Campañas
                  </button>
                </div>
              )}
            </div>

            {/* Buscador */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Buscar
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por nombre o empresa..."
                  value={filters.q}
                  onChange={(e) => handleFiltroChange('q', e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Filtros */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Filtros</h3>
                <button
                  onClick={limpiarFiltros}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Limpiar
                </button>
              </div>

              {/* Estado */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estado
                </label>
                <select
                  value={filters.estado}
                  onChange={(e) => handleFiltroChange('estado', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {estados.map((estado) => (
                    <option key={estado.value} value={estado.value}>
                      {estado.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Acciones */}
            <div className="pt-4 border-t border-gray-200">
              <button
                onClick={handleAgregarACampania}
                disabled={!campaniaSeleccionada || prospectosSeleccionados.length === 0}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                <Users className="h-4 w-4" />
                <span>Agregar a Campaña ({prospectosSeleccionados.length})</span>
              </button>
            </div>
          </div>
        </div>

        {/* Lista de prospectos */}
        <div className="flex-1 p-6">
          {/* Controles de la tabla */}
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <h2 className="text-lg font-medium text-gray-900">
                    Prospectos disponibles ({prospectos.length})
                  </h2>
                  <button
                    onClick={handleSeleccionarTodos}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    {prospectosSeleccionados.length === prospectos.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                  </button>
                </div>

                <div className="flex items-center space-x-2">
                  <Filter className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">
                    Mostrando {prospectos.length} resultados
                  </span>
                </div>
              </div>
            </div>

            {/* Tabla de prospectos */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <input
                        type="checkbox"
                        checked={prospectosSeleccionados.length === prospectos.length && prospectos.length > 0}
                        onChange={handleSeleccionarTodos}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Empresa
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Teléfono/WhatsApp
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Dirección
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-4 text-center text-gray-500">
                        Cargando prospectos...
                      </td>
                    </tr>
                  ) : prospectos.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-4 text-center text-gray-500">
                        No se encontraron prospectos con los filtros seleccionados
                      </td>
                    </tr>
                  ) : (
                    prospectos.map((prospecto) => {
                      const estaSeleccionado = prospectosSeleccionados.find(p => p.id === prospecto.id);
                      return (
                        <tr
                          key={prospecto.id}
                          className={`hover:bg-gray-50 cursor-pointer ${estaSeleccionado ? 'bg-blue-50' : ''}`}
                          onClick={() => handleSeleccionarProspecto(prospecto)}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={!!estaSeleccionado}
                              onChange={() => handleSeleccionarProspecto(prospecto)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <Building className="h-4 w-4 text-gray-400 mr-2" />
                              <div>
                                <div className="text-sm font-medium text-gray-900">{prospecto.nombre || '-'}</div>
                                {prospecto.rubro && (
                                  <div className="text-sm text-gray-500">
                                    {prospecto.rubro}
                                    {prospecto.area_rubro && <span className="ml-1 text-xs text-blue-600">({prospecto.area_rubro})</span>}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                              prospecto.estado === 'disponible' 
                                ? 'bg-green-100 text-green-800'
                                : prospecto.estado === 'enviado'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {prospecto.estado === 'disponible' ? 'Disponible' : 
                               prospecto.estado === 'enviado' ? 'Enviado' : 
                               prospecto.estado || 'Pendiente'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {prospecto.telefono_wapp ? (
                                <div className="flex items-center text-green-600">
                                  <span className="mr-1">📱</span>
                                  {prospecto.telefono_wapp}
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center text-sm text-gray-900">
                              <MapPin className="h-4 w-4 text-gray-400 mr-1" />
                              {prospecto.direccion ? (
                                <div>
                                  <div>{prospecto.direccion}</div>
                                  {prospecto.ciudad && <div className="text-xs text-gray-500">{prospecto.ciudad}</div>}
                                </div>
                              ) : (
                                <span className="text-gray-500">-</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {prospectos.length > 0 && (
              <div className="bg-white px-4 py-3 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    Página {paginaActual} - {prospectos.length} resultados
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setPaginaActual(prev => Math.max(1, prev - 1))}
                      disabled={paginaActual === 1}
                      className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => setPaginaActual(prev => prev + 1)}
                      disabled={prospectos.length < registrosPorPagina}
                      className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SelectorProspectosPage;