import React, { useState, useEffect, useCallback } from 'react';
import { Search, Users, Phone, Plus } from 'lucide-react';
import Button from '../common/Button';
import LoadingSpinner from '../common/LoadingSpinner';
import { leadsAPI } from '../../services/api';
import { destinatariosService } from '../../services/destinatarios';

const SelectorProspectos = ({ campaniaId, onDestinatariosAgregados }) => {
  const [loading, setLoading] = useState(false);
  const [prospectos, setProspectos] = useState([]);
  const [selectedProspectos, setSelectedProspectos] = useState([]);
  const [filters, setFilters] = useState({
    estado: '',
    q: ''
  });
  
  const [agregandoDestinatarios, setAgregandoDestinatarios] = useState(false);

  const cargarProspectos = useCallback(async () => {
    if (!campaniaId) {
      console.warn('No hay campaniaId seleccionada');
      setProspectos([]);
      return;
    }

    setLoading(true);
    try {
      const params = {
        campania_id: campaniaId,
        estado: filters.estado,
        q: filters.q
      };
      
      const response = await leadsAPI.getProspectos(params);
      setProspectos(response.data?.data || []);
    } catch (error) {
      console.error('Error cargando prospectos:', error);
      setProspectos([]);
    } finally {
      setLoading(false);
    }
  }, [campaniaId, filters.estado, filters.q]);

  useEffect(() => {
    cargarProspectos();
  }, [cargarProspectos]);

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

  const agregarDestinatarios = async () => {
    if (selectedProspectos.length === 0) {
      alert('Selecciona al menos un prospecto');
      return;
    }

    setAgregandoDestinatarios(true);
    try {
      const destinatarios = selectedProspectos.map(prospecto => ({
        nombre: prospecto.nombre_destino,
        telefono: prospecto.telefono_wapp,
        lugar_id: prospecto.id
      }));

      const response = await destinatariosService.agregarDestinatarios(campaniaId, destinatarios);
      
      if (response.success) {
        alert(`✅ ${response.data.agregados} destinatarios agregados exitosamente`);
        setSelectedProspectos([]);
        onDestinatariosAgregados && onDestinatariosAgregados();
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
    <div className="space-y-6">
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
            disabled={selectedProspectos.length === 0 || agregandoDestinatarios}
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

      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estado
            </label>
            <select
              value={filters.estado}
              onChange={(e) => setFilters(prev => ({ ...prev, estado: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos los estados</option>
              <option value="pendiente">Pendiente</option>
              <option value="enviado">Enviado</option>
              <option value="error">Error</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Buscar por Nombre
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={filters.q}
                onChange={(e) => setFilters(prev => ({ ...prev, q: e.target.value }))}
                placeholder="Buscar destinatario..."
                className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

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

      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
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
                          {prospecto.nombre_destino}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center">
                          <Phone className="h-4 w-4 text-gray-400 mr-2" />
                          <span className="text-sm text-gray-900">
                            {prospecto.telefono_wapp}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                          prospecto.estado === 'enviado' ? 'bg-green-100 text-green-800' :
                          prospecto.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-800' :
                          prospecto.estado === 'error' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {prospecto.estado}
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