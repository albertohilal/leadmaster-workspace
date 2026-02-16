import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Users, Building, MapPin, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import prospectosService from '../../services/prospectos';
import campanasService from '../../services/campanas';
import destinatariosService from '../../services/destinatarios';
import enviosService from '../../services/envios';
import api from '../../services/api';

const GestionDestinatariosPage = () => {
  const navigate = useNavigate();

  const [campanas, setCampanas] = useState([]);
  const [campaniaSeleccionada, setCampaniaSeleccionada] = useState('');
  const [prospectos, setProspectos] = useState([]);
  const [seleccionados, setSeleccionados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [estadoFiltro, setEstadoFiltro] = useState('todos');
  
  // Estados para envío manual (flujo 2 fases)
  const [prospectoSeleccionado, setProspectoSeleccionado] = useState(null);
  const [mostrarModalWhatsApp, setMostrarModalWhatsApp] = useState(false);
  const [datosEnvioPreparado, setDatosEnvioPreparado] = useState(null);
  const [loadingEnvio, setLoadingEnvio] = useState(false);

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

  const traducirEstado = (estado) => {
    switch (estado) {
      case 'sin_envio':
        return 'No incluido';
      case 'pendiente':
        return 'Pendiente';
      case 'enviado':
        return 'Enviado';
      case 'error':
        return 'Error';
      default:
        return estado;
    }
  };

  /**
   * FASE 1: Preparar envío manual
   * Obtiene el mensaje personalizado de la campaña desde el backend
   */
  const handleAbrirModalWhatsApp = async (prospecto) => {
    // Validar que tenga teléfono
    if (!prospecto.telefono_wapp || prospecto.telefono_wapp.trim() === '') {
      alert('Este prospecto no tiene teléfono de WhatsApp');
      return;
    }

    // Validar que tenga envio_id
    if (!prospecto.envio_id) {
      alert('Este prospecto no tiene un envío asociado en la campaña');
      return;
    }

    setLoadingEnvio(true);
    
    try {
      // Llamar al backend para obtener mensaje personalizado
      const response = await enviosService.prepareManual(prospecto.envio_id);
      
      if (response.success) {
        console.log('📞 Teléfono recibido del backend:', response.data.telefono);
        console.log('📨 Mensaje recibido:', response.data.mensaje_final);
        console.log('🔍 Datos completos:', response.data);
        
        setProspectoSeleccionado(prospecto);
        setDatosEnvioPreparado(response.data);
        setMostrarModalWhatsApp(true);
      }
    } catch (error) {
      console.error('Error al preparar envío:', error);
      alert('Error al preparar envío: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoadingEnvio(false);
    }
  };

  /**
   * FASE 2: Abrir WhatsApp y confirmar envío
   * Usa el mensaje personalizado de la campaña y registra el envío
   */
  const handleConfirmarWhatsApp = async () => {
    if (!datosEnvioPreparado) return;

    try {
      // Abrir WhatsApp Web con mensaje personalizado de la campaña
      const urlWhatsApp = `https://web.whatsapp.com/send?phone=${datosEnvioPreparado.telefono}&text=${encodeURIComponent(datosEnvioPreparado.mensaje_final)}`;
      window.open(urlWhatsApp, '_blank');

      // Cerrar modal
      setMostrarModalWhatsApp(false);

      // Confirmar si el usuario envió el mensaje
      setTimeout(() => {
        const confirmado = window.confirm('¿Ya enviaste el mensaje por WhatsApp? Presiona OK para confirmar.');
        
        if (confirmado) {
          confirmarEstadoEnviado();
        } else {
          alert('El envío fue cancelado. El estado permanece como pendiente.');
          setDatosEnvioPreparado(null);
          setProspectoSeleccionado(null);
        }
      }, 2000);

    } catch (error) {
      console.error('Error al abrir WhatsApp:', error);
      alert('Error al abrir WhatsApp: ' + error.message);
      setDatosEnvioPreparado(null);
      setProspectoSeleccionado(null);
    }
  };

  /**
   * Confirmar estado 'enviado' en el backend
   */
  const confirmarEstadoEnviado = async () => {
    if (!datosEnvioPreparado) return;

    try {
      const response = await enviosService.confirmManual(datosEnvioPreparado.envio_id);
      
      if (response.success) {
        alert('✅ Envío confirmado correctamente');
        setDatosEnvioPreparado(null);
        setProspectoSeleccionado(null);
        // Recargar lista para actualizar estados
        cargarProspectos();
      }
    } catch (error) {
      console.error('Error al confirmar envío:', error);
      alert('Error al confirmar envío: ' + (error.response?.data?.message || error.message));
      setDatosEnvioPreparado(null);
      setProspectoSeleccionado(null);
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
                  <option value="sin_envio">No incluido</option>
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
                    <th className="px-6 py-3 text-left">Acciones</th>
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
                      <td colSpan="6" className="p-6 text-center">
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
                              {traducirEstado(p.estado_campania)}
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

                          <td className="px-6 py-4">
                            {p.estado_campania === 'pendiente' && p.telefono_wapp && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAbrirModalWhatsApp(p);
                                }}
                                className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                              >
                                <MessageCircle className="h-4 w-4" />
                                Web WhatsApp
                              </button>
                            )}
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

      {/* Modal de WhatsApp */}
      {mostrarModalWhatsApp && prospectoSeleccionado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">Enviar por Web WhatsApp</h3>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Empresa
                </label>
                <p className="text-gray-900">{prospectoSeleccionado.nombre}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono
                </label>
                <p className="text-gray-900">{prospectoSeleccionado.telefono_wapp}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mensaje
                </label>
                <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg max-h-40 overflow-y-auto">
                  {datosEnvioPreparado?.mensaje_final || 'Cargando mensaje...'}
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-800">
                  ⚠️ Al presionar "Abrir WhatsApp", se abrirá una nueva ventana. Después de enviar el mensaje, confirma el envío para actualizar el estado.
                </p>
              </div>
            </div>

            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button
                onClick={() => {
                  setMostrarModalWhatsApp(false);
                  setProspectoSeleccionado(null);
                  setDatosEnvioPreparado(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarWhatsApp}
                disabled={!datosEnvioPreparado}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 disabled:bg-gray-300"
              >
                <MessageCircle className="h-4 w-4" />
                Abrir WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GestionDestinatariosPage;
