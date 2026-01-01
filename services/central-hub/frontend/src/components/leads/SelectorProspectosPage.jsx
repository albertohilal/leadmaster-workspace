import React, { useState, useEffect } from 'react';
import { Search, Filter, Users, MapPin, Phone, Building2, Plus, Check, X, ChevronLeft } from 'lucide-react';
import Button from '../common/Button';
import LoadingSpinner from '../common/LoadingSpinner';
import { leadsAPI } from '../../services/api';
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

  // Cargar campañas disponibles
  useEffect(() => {
    const cargarCampaigns = async () => {
      try {
        const response = await leadsAPI.get('/sender/campaigns');
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
  }, []);

  // Cargar áreas disponibles
  useEffect(() => {
    const cargarAreas = async () => {
      try {
        const response = await leadsAPI.getAreas();
        setAreas(response.data || []);
      } catch (error) {
        console.error('Error cargando áreas:', error);
      }
    };
    cargarAreas();
  }, []);

  // Cargar prospectos cuando cambien filtros o campaña seleccionada
  const cargarProspectos = async () => {
    if (!selectedCampaign) return;
    
    setLoading(true);
    try {
      const params = {
        campania_id: selectedCampaign,
        ...filters
      };
      
      const response = await leadsAPI.getProspectos(params);
      setProspectos(response.data || []);
    } catch (error) {
      console.error('Error cargando prospectos:', error);
      setProspectos([]);
    } finally {
      setLoading(false);
    }
  };

  // Cargar prospectos al cambiar campaña o filtros
  useEffect(() => {
    cargarProspectos();
  }, [selectedCampaign, filters]);

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

  // Agregar prospectos seleccionados como destinatarios
  const agregarSeleccionadosACampania = async () => {
    if (selectedProspectos.length === 0) {
      alert('Selecciona al menos un prospecto');
      return;
    }

    if (!selectedCampaign) {
      alert('Selecciona una campaña');
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
        
        // Opcional: redirigir al dashboard o mostrar mensaje de éxito
        navigate('/dashboard');
      } else {
        alert('Error al agregar destinatarios: ' + response.message);
      }
    } catch (error) {
      console.error('Error agregando destinatarios:', error);
      alert('Error al agregar destinatarios');
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
                disabled={selectedProspectos.length === 0 || agregandoDestinatarios}
                className="bg-green-600 hover:bg-green-700"
              >
                {agregandoDestinatarios ? (
                  <><LoadingSpinner size="sm" /> Agregando...</>
                ) : (
                  <>Agregar Seleccionados a Campaña</>
                )}
              </Button>
              <Button variant="danger">
                Salir
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
                Campaña
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
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Seleccionar
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