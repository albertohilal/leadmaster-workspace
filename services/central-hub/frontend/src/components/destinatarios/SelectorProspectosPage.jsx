import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Users, Building, MapPin, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import prospectosService from '../../services/prospectos';
import campanasService from '../../services/campanas';
import destinatariosService from '../../services/destinatarios';
import api from '../../services/api';

const SelectorProspectosPage = () => {
  // 🚨 VERIFICACIÓN DE CARGA DEL COMPONENTE
  console.log('🚀 SelectorProspectosPage CARGADO - VERSIÓN CON DIAGNÓSTICO');
  
  const navigate = useNavigate();

  const [campanas, setCampanas] = useState([]);
  const [campaniaSeleccionada, setCampaniaSeleccionada] = useState('');
  const [prospectos, setProspectos] = useState([]);
  const [seleccionados, setSeleccionados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [estadoFiltro, setEstadoFiltro] = useState('todos');
  
  // FASE 1 – Modo Manual Controlado
  const [prospectoSeleccionado, setProspectoSeleccionado] = useState(null);
  const [mostrarModalWhatsApp, setMostrarModalWhatsApp] = useState(false);

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

  // FASE 1 – Modo Manual Controlado
  const handleAbrirModalWhatsApp = (prospecto) => {
    // Validar que tenga teléfono
    if (!prospecto.telefono_wapp || prospecto.telefono_wapp.trim() === '') {
      alert('Este prospecto no tiene teléfono de WhatsApp');
      return;
    }

    setProspectoSeleccionado(prospecto);
    setMostrarModalWhatsApp(true);
  };

  const handleConfirmarWhatsApp = async () => {
    if (!prospectoSeleccionado) return;

    try {
      // Normalizar teléfono (solo números)
      const telefonoNormalizado = prospectoSeleccionado.telefono_wapp.replace(/\D/g, '');

      // Crear mensaje base
      const mensaje = `Hola ${prospectoSeleccionado.nombre}, te contacto desde Desarrollo y Diseño.`;

      // Encode mensaje
      const mensajeCodificado = encodeURIComponent(mensaje);

      // Construir URL de WhatsApp
      const urlWhatsApp = `https://wa.me/${telefonoNormalizado}?text=${mensajeCodificado}`;

      // Registrar en base de datos
      await api.post('/sender/registro-manual', {
        prospecto_id: prospectoSeleccionado.prospecto_id,
        telefono: telefonoNormalizado,
        mensaje: mensaje
      });

      // Abrir WhatsApp Web
      window.open(urlWhatsApp, '_blank');

      // Cerrar modal
      setMostrarModalWhatsApp(false);
      setProspectoSeleccionado(null);

      console.log('[MANUAL] Envío registrado y WhatsApp abierto');

    } catch (error) {
      console.error('[MANUAL] Error al procesar envío:', error);
      alert('Error al registrar el envío');
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

                      // 🔍 DIAGNÓSTICO TÉCNICO - FASE 1 WHATSAPP
                      console.group(`🔍 Prospecto ID: ${p.prospecto_id}`);
                      console.log('📋 Nombre:', p.nombre);
                      console.log('📊 estado_campania:', p.estado_campania);
                      console.log('🔤 typeof estado_campania:', typeof p.estado_campania);
                      console.log('📞 telefono_wapp:', p.telefono_wapp);
                      console.log('🔤 typeof telefono_wapp:', typeof p.telefono_wapp);
                      console.log('✅ Condición pendiente:', p.estado_campania === 'pendiente');
                      console.log('✅ Condición sin_envio:', p.estado_campania === 'sin_envio');
                      console.log('✅ Tiene teléfono:', !!p.telefono_wapp);
                      console.log('🎯 Mostrar botón:', (p.estado_campania === 'pendiente' || p.estado_campania === 'sin_envio') && p.telefono_wapp);
                      console.log('📦 Objeto completo:', p);
                      console.log('🔑 Propiedades disponibles:', Object.keys(p));
                      console.groupEnd();

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

                          <td className="px-6 py-4">
                            {(p.estado_campania === 'pendiente' || p.estado_campania === 'sin_envio') && p.telefono_wapp && (
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
                <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                  Hola {prospectoSeleccionado.nombre}, te contacto desde Desarrollo y Diseño.
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-800">
                  ℹ️ Se abrirá WhatsApp Web en una nueva pestaña. El envío se registrará pero NO cambiará el estado automáticamente.
                </p>
              </div>
            </div>

            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button
                onClick={() => {
                  setMostrarModalWhatsApp(false);
                  setProspectoSeleccionado(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarWhatsApp}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
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

export default SelectorProspectosPage;
