import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Users, Building, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import prospectosService from '../../services/prospectos';
import campanasService from '../../services/campanas';
import destinatariosService from '../../services/destinatarios';

const SelectorProspectosPage = () => {
  const navigate = useNavigate();

  const [campanas, setCampanas] = useState([]);
  const [campaniaSeleccionada, setCampaniaSeleccionada] = useState('');
  const [prospectos, setProspectos] = useState([]);
  const [seleccionados, setSeleccionados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [estadoFiltro, setEstadoFiltro] = useState('todos');

  useEffect(() => {
    cargarCampanas();
  }, []);

  useEffect(() => {
    if (campaniaSeleccionada) {
      cargarProspectos();
    }
  }, [campaniaSeleccionada]);

  const cargarCampanas = async () => {
    try {
      setLoading(true);
      const data = await campanasService.obtenerCampanas();
      setCampanas(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error cargando campañas:', err);
      setError('Error al cargar campañas');
    } finally {
      setLoading(false);
    }
  };

  const cargarProspectos = async () => {
    try {
      setLoading(true);
      const response = await prospectosService.filtrarProspectos({
        campania_id: campaniaSeleccionada
      });

      const lista = response?.data || [];
      setProspectos(lista);
      setSeleccionados([]);
      setEstadoFiltro('todos');
    } catch (err) {
      console.error('Error cargando prospectos:', err);
      setError('Error al cargar prospectos');
    } finally {
      setLoading(false);
    }
  };

  const prospectosFiltrados = useMemo(() => {
    if (estadoFiltro === 'todos') return prospectos;
    return prospectos.filter(p => p.estado_campania === estadoFiltro);
  }, [prospectos, estadoFiltro]);

  const toggleSeleccion = (prospecto) => {
    setSeleccionados(prev => {
      const existe = prev.find(p => p.prospecto_id === prospecto.prospecto_id);
      if (existe) {
        return prev.filter(p => p.prospecto_id !== prospecto.prospecto_id);
      }
      return [...prev, prospecto];
    });
  };

  const seleccionarTodos = () => {
    const todosSeleccionados = prospectosFiltrados.every(p =>
      seleccionados.find(s => s.prospecto_id === p.prospecto_id)
    );

    if (todosSeleccionados) {
      setSeleccionados(prev =>
        prev.filter(s =>
          !prospectosFiltrados.find(p => p.prospecto_id === s.prospecto_id)
        )
      );
    } else {
      const nuevos = prospectosFiltrados.filter(p =>
        !seleccionados.find(s => s.prospecto_id === p.prospecto_id)
      );
      setSeleccionados(prev => [...prev, ...nuevos]);
    }
  };

  const agregarACampania = async () => {
    if (!campaniaSeleccionada || seleccionados.length === 0) {
      alert('Selecciona campaña y prospectos');
      return;
    }

    try {
      setLoading(true);

      const destinatarios = seleccionados.map(p => ({
        telefono_wapp: p.telefono_wapp,
        nombre_destino: p.nombre,
        lugar_id: p.prospecto_id
      }));

      await destinatariosService.agregarDestinatarios(
        campaniaSeleccionada,
        destinatarios
      );

      alert(`Se agregaron ${destinatarios.length} prospectos`);
      setSeleccionados([]);
      cargarProspectos();

    } catch (err) {
      console.error('Error agregando destinatarios:', err);
      alert('Error al agregar destinatarios');
    } finally {
      setLoading(false);
    }
  };

  const badgeEstado = (estado) => {
    switch (estado) {
      case 'enviado':
        return 'bg-green-100 text-green-800';
      case 'pendiente':
        return 'bg-yellow-100 text-yellow-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/campaigns')}
            className="flex items-center text-gray-600 hover:text-gray-800"
          >
            <ArrowLeft className="h-5 w-5 mr-1" />
            Volver
          </button>
          <h1 className="text-2xl font-bold">Seleccionar Prospectos</h1>
        </div>

        <div className="text-sm text-gray-600">
          {seleccionados.length} seleccionados
        </div>
      </div>

      <div className="flex">

        {/* Panel lateral */}
        <div className="w-80 bg-white border-r p-6 space-y-6">

          <div>
            <label className="block text-sm font-medium mb-2">
              Campaña de destino
            </label>

            <select
              value={campaniaSeleccionada}
              onChange={(e) => setCampaniaSeleccionada(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">Seleccionar campaña...</option>
              {campanas.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={agregarACampania}
            disabled={!campaniaSeleccionada || seleccionados.length === 0}
            className="w-full bg-blue-600 text-white py-2 rounded-lg disabled:bg-gray-300"
          >
            Agregar a Campaña
          </button>

        </div>

        {/* Tabla */}
        <div className="flex-1 p-6">

          <div className="bg-white rounded-lg shadow">

            <div className="px-6 py-4 border-b">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-medium">
                  Prospectos ({prospectosFiltrados.length})
                </h2>

                <button
                  onClick={seleccionarTodos}
                  className="text-sm text-blue-600"
                >
                  {prospectosFiltrados.length > 0 && 
                   prospectosFiltrados.every(p => seleccionados.find(s => s.prospecto_id === p.prospecto_id))
                    ? 'Deseleccionar todos'
                    : 'Seleccionar todos'}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">
                  Estado:
                </label>
                <select
                  value={estadoFiltro}
                  onChange={(e) => setEstadoFiltro(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="todos">Todos</option>
                  <option value="sin_envio">Sin envío</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="enviado">Enviado</option>
                  <option value="error">Error</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-6 py-3"></th>
                    <th className="px-6 py-3 text-left">Empresa</th>
                    <th className="px-6 py-3 text-left">Estado</th>
                    <th className="px-6 py-3 text-left">Teléfono</th>
                    <th className="px-6 py-3 text-left">Dirección</th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {loading ? (
                    <tr>
                      <td colSpan="5" className="p-6 text-center">
                        Cargando...
                      </td>
                    </tr>
                  ) : prospectosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="p-6 text-center">
                        {prospectos.length === 0 ? 'No hay prospectos' : 'No hay prospectos con este filtro'}
                      </td>
                    </tr>
                  ) : (
                    prospectosFiltrados.map(p => {
                      const seleccionado = seleccionados.find(
                        s => s.prospecto_id === p.prospecto_id
                      );

                      return (
                        <tr
                          key={p.prospecto_id}
                          className={`hover:bg-gray-50 cursor-pointer ${
                            seleccionado ? 'bg-blue-50' : ''
                          }`}
                          onClick={() => toggleSeleccion(p)}
                        >
                          <td className="px-6 py-4">
                            <input
                              type="checkbox"
                              checked={!!seleccionado}
                              readOnly
                            />
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              <Building className="h-4 w-4 mr-2 text-gray-400" />
                              {p.nombre}
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            <span
                              className={`px-2 py-1 text-xs rounded-full ${badgeEstado(p.estado_campania)}`}
                            >
                              {p.estado_campania}
                            </span>
                          </td>

                          <td className="px-6 py-4">
                            {p.telefono_wapp || '-'}
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              <MapPin className="h-4 w-4 mr-1 text-gray-400" />
                              {p.direccion || '-'}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default SelectorProspectosPage;
