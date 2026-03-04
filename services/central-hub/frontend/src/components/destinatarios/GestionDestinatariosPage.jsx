import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import prospectosService from '../../services/prospectos';
import campanasService from '../../services/campanas';
import destinatariosService from '../../services/destinatarios';
import enviosService from '../../services/envios';

const GestionDestinatariosPage = () => {
  const navigate = useNavigate();

  const [campanas, setCampanas] = useState([]);
  const [campaniaSeleccionada, setCampaniaSeleccionada] = useState('');
  const [prospectos, setProspectos] = useState([]);
  const [seleccionados, setSeleccionados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [estadoFiltro, setEstadoFiltro] = useState('todos');
  const [tipoSocieteFiltro, setTipoSocieteFiltro] = useState('todos');
  const [q, setQ] = useState('');

  // Estados para envío manual (flujo 2 fases)
  const [prospectoSeleccionado, setProspectoSeleccionado] = useState(null);
  const [mostrarModalWhatsApp, setMostrarModalWhatsApp] = useState(false);
  const [datosEnvioPreparado, setDatosEnvioPreparado] = useState(null);
  const [loadingEnvio, setLoadingEnvio] = useState(false);
  const [whatsappAbierto, setWhatsappAbierto] = useState(false);

  // Estados para clasificación post-envío
  const [mostrarModalClasificar, setMostrarModalClasificar] = useState(false);
  const [prospectoClasificar, setProspectoClasificar] = useState(null);
  const [loadingClasificacion, setLoadingClasificacion] = useState(false);
  const [clasificacion, setClasificacion] = useState({
    post_envio_estado: '',
    accion_siguiente: '',
    detalle: ''
  });

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
      setError(null);
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
      setError(null);

      const response = await prospectosService.filtrarProspectos({
        campania_id: campaniaSeleccionada
      });

      const lista = response?.data || [];
      setProspectos(lista);
      setSeleccionados([]);
      setEstadoFiltro('todos');
      setTipoSocieteFiltro('todos');
      setQ('');
    } catch (err) {
      console.error('Error cargando prospectos:', err);
      setError('Error al cargar prospectos');
    } finally {
      setLoading(false);
    }
  };

  const prospectosFiltrados = useMemo(() => {
    let filtrados = [...prospectos];

    if (estadoFiltro !== 'todos') {
      filtrados = filtrados.filter(p => p.estado_campania === estadoFiltro);
    }

    if (tipoSocieteFiltro !== 'todos') {
      filtrados = filtrados.filter(p => (p.tipo_societe || 'Otro') === tipoSocieteFiltro);
    }

    const query = q.trim().toLowerCase();
    if (query) {
      filtrados = filtrados.filter(p => {
        const nombre = String(p.nombre || '').toLowerCase();
        const telefono = String(p.telefono_wapp || '').toLowerCase();
        const direccion = String(p.direccion || '').toLowerCase();
        return (
          nombre.includes(query) ||
          telefono.includes(query) ||
          direccion.includes(query)
        );
      });
    }

    return filtrados;
  }, [prospectos, estadoFiltro, tipoSocieteFiltro, q]);

  const toggleSeleccion = (prospecto) => {
    setSeleccionados(prev => {
      const existe = prev.find(p => p.prospecto_id === prospecto.prospecto_id);
      if (existe) return prev.filter(p => p.prospecto_id !== prospecto.prospecto_id);
      return [...prev, prospecto];
    });
  };

  const seleccionarTodos = () => {
    const todosSeleccionados = prospectosFiltrados.length > 0 && prospectosFiltrados.every(p =>
      seleccionados.find(s => s.prospecto_id === p.prospecto_id)
    );

    if (todosSeleccionados) {
      setSeleccionados(prev =>
        prev.filter(s => !prospectosFiltrados.find(p => p.prospecto_id === s.prospecto_id))
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

      await destinatariosService.agregarDestinatarios(campaniaSeleccionada, destinatarios);

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

  const traducirEstado = (estado) => {
    switch (estado) {
      case 'sin_envio': return 'No incluido';
      case 'pendiente': return 'Pendiente';
      case 'enviado': return 'Enviado';
      case 'error': return 'Error';
      default: return estado;
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

  /**
   * FASE 1: Preparar envío manual
   * Obtiene el mensaje personalizado de la campaña desde el backend
   */
  const handleAbrirModalWhatsApp = async (prospecto) => {
    if (!prospecto?.telefono_wapp || prospecto.telefono_wapp.trim() === '') {
      alert('Este prospecto no tiene teléfono de WhatsApp');
      return;
    }
    if (!prospecto?.envio_id) {
      alert('Este prospecto no tiene un envío asociado en la campaña');
      return;
    }

    setLoadingEnvio(true);
    try {
      const response = await enviosService.prepareManual(prospecto.envio_id);

      if (response?.success) {
        setProspectoSeleccionado(prospecto);
        setDatosEnvioPreparado(response.data);
        setMostrarModalWhatsApp(true);
        setWhatsappAbierto(false);
      } else {
        alert('No se pudo preparar el envío');
      }
    } catch (error) {
      console.error('Error al preparar envío:', error);
      alert('Error al preparar envío: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoadingEnvio(false);
    }
  };

  /**
   * FASE 2: Abrir WhatsApp
   */
  const handleAbrirWhatsApp = () => {
    if (!datosEnvioPreparado) return;

    try {
      const urlWhatsApp = `https://web.whatsapp.com/send?phone=${datosEnvioPreparado.telefono}&text=${encodeURIComponent(datosEnvioPreparado.mensaje_final)}`;
      window.open(urlWhatsApp, '_blank');
      setWhatsappAbierto(true);
    } catch (error) {
      console.error('Error al abrir WhatsApp:', error);
      alert('Error al abrir WhatsApp: ' + error.message);
    }
  };

  /**
   * FASE 3: Confirmar estado 'enviado' en el backend
   */
  const confirmarEstadoEnviado = async () => {
    if (!datosEnvioPreparado) return;

    setLoadingEnvio(true);
    try {
      const response = await enviosService.confirmManual(datosEnvioPreparado.envio_id);

      if (response?.success) {
        alert('✅ Envío confirmado correctamente');
        setMostrarModalWhatsApp(false);
        setDatosEnvioPreparado(null);
        setProspectoSeleccionado(null);
        setWhatsappAbierto(false);
        cargarProspectos();
      } else {
        alert('No se pudo confirmar el envío');
      }
    } catch (error) {
      console.error('Error al confirmar envío:', error);
      alert('Error al confirmar envío: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoadingEnvio(false);
    }
  };

  const cancelarEnvio = () => {
    setMostrarModalWhatsApp(false);
    setProspectoSeleccionado(null);
    setDatosEnvioPreparado(null);
    setWhatsappAbierto(false);
  };

  const POST_ENVIO_ESTADOS = [
    { value: 'CONTACTO_VALIDO_SIN_INTERES', label: 'Contacto válido sin interés' },
    { value: 'INTERESADO_PARA_DERIVAR_A_HABY', label: 'Interesado para derivar a Haby' },
    { value: 'PENDIENTE_SIN_RESPUESTA', label: 'Pendiente sin respuesta' },
    { value: 'NUMERO_INEXISTENTE', label: 'Número inexistente' },
    { value: 'NUMERO_CAMBIO_DUEÑO', label: 'Número cambió de dueño' },
    { value: 'TERCERO_NO_RESPONSABLE', label: 'Tercero no responsable' },
    { value: 'ATENDIO_MENOR_DE_EDAD', label: 'Atendió menor de edad' },
    { value: 'NO_ENTREGADO_ERROR_ENVIO', label: 'No entregado / error de envío' }
  ];

  const POST_ENVIO_ACCIONES = [
    { value: 'DERIVAR_HABY', label: 'Derivar a Haby' },
    { value: 'FOLLOWUP_1', label: 'Follow-up 1' },
    { value: 'CERRAR', label: 'Cerrar' },
    { value: 'INVALIDAR_TELEFONO', label: 'Invalidar teléfono' },
    { value: 'REINTENTO_TECNICO', label: 'Reintento técnico' },
    { value: 'NO_CONTACTAR', label: 'No contactar' }
  ];

  const abrirModalClasificar = (prospecto) => {
    if (!prospecto?.envio_id) {
      alert('Este prospecto no tiene un envío asociado');
      return;
    }
    setProspectoClasificar(prospecto);
    setClasificacion({ post_envio_estado: '', accion_siguiente: '', detalle: '' });
    setMostrarModalClasificar(true);
  };

  const cerrarModalClasificar = () => {
    setMostrarModalClasificar(false);
    setProspectoClasificar(null);
    setClasificacion({ post_envio_estado: '', accion_siguiente: '', detalle: '' });
    setLoadingClasificacion(false);
  };

  const onChangePostEnvioEstado = (nuevoEstado) => {
    setClasificacion(prev => {
      const next = { ...prev, post_envio_estado: nuevoEstado };

      if (nuevoEstado === 'ATENDIO_MENOR_DE_EDAD') {
        next.accion_siguiente = 'NO_CONTACTAR';
      } else if (
        (nuevoEstado === 'NUMERO_INEXISTENTE' || nuevoEstado === 'NUMERO_CAMBIO_DUEÑO') &&
        (!prev.accion_siguiente || prev.accion_siguiente === 'NO_CONTACTAR')
      ) {
        if (!prev.accion_siguiente) next.accion_siguiente = 'INVALIDAR_TELEFONO';
      }

      return next;
    });
  };

  const guardarClasificacion = async () => {
    if (!prospectoClasificar?.envio_id) return;

    if (!clasificacion.post_envio_estado || !clasificacion.accion_siguiente) {
      alert('Selecciona post_envio_estado y accion_siguiente');
      return;
    }

    setLoadingClasificacion(true);
    try {
      const resp = await enviosService.clasificarPostEnvio(prospectoClasificar.envio_id, {
        post_envio_estado: clasificacion.post_envio_estado,
        accion_siguiente: clasificacion.accion_siguiente,
        detalle: clasificacion.detalle
      });

      if (resp?.success) {
        alert('✅ Clasificación guardada');
        cerrarModalClasificar();
      } else {
        alert('No se pudo guardar la clasificación');
      }
    } catch (e) {
      alert('Error al guardar: ' + (e.response?.data?.message || e.message));
    } finally {
      setLoadingClasificacion(false);
    }
  };

  const clamp2LinesStyle = {
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 2,
    overflow: 'hidden',
    wordBreak: 'break-word'
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col overflow-x-hidden">
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

      {/* Contenido */}
      <div className="flex-1 p-4 md:p-6 overflow-hidden">
        <div className="bg-white rounded-lg shadow h-full overflow-y-auto overflow-x-hidden">
          {/* Barra Sticky */}
          <div className="sticky top-0 z-20 bg-white border-b px-6 py-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[240px] flex-1">
                <label className="block text-sm font-medium mb-1">
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
                className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:bg-gray-300"
              >
                Agregar a Campaña
              </button>

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">
                  Estado
                </label>
                <select
                  value={estadoFiltro}
                  onChange={(e) => setEstadoFiltro(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="todos">Todos</option>
                  <option value="sin_envio">No incluido</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="enviado">Enviado</option>
                  <option value="error">Error</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">
                  Tipo Societe
                </label>
                <select
                  value={tipoSocieteFiltro}
                  onChange={(e) => setTipoSocieteFiltro(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="todos">Todos</option>
                  <option value="Cliente">Cliente</option>
                  <option value="Prospecto">Prospecto</option>
                  <option value="Proveedor">Proveedor</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>

              <div className="min-w-[220px] flex-1">
                <label className="block text-sm font-medium mb-1 text-gray-700">
                  Búsqueda
                </label>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Nombre, teléfono o dirección"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="text-sm text-gray-600">
                Prospectos: {prospectosFiltrados.length}
              </div>

              <button
                onClick={seleccionarTodos}
                className="text-sm text-blue-600 whitespace-nowrap"
              >
                {prospectosFiltrados.length > 0 &&
                prospectosFiltrados.every(p => seleccionados.find(s => s.prospecto_id === p.prospecto_id))
                  ? 'Deseleccionar todos'
                  : 'Seleccionar todos'}
              </button>
            </div>

            {error && (
              <div className="mt-3 text-sm text-red-600">
                {error}
              </div>
            )}
          </div>

          {/* Tabla */}
          <table className="w-full table-fixed">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-6 py-3 text-left w-[32%]">Empresa</th>
                <th className="px-6 py-3 text-left w-[12%]">Estado</th>
                <th className="px-6 py-3 text-left w-[16%]">Teléfono</th>
                <th className="px-6 py-3 text-left w-[28%]">Dirección</th>
                <th className="px-6 py-3 text-left w-[12%]">Acciones</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center">
                    Cargando...
                  </td>
                </tr>
              ) : prospectosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center">
                    {prospectos.length === 0
                      ? 'No hay prospectos'
                      : 'No hay prospectos con este filtro'}
                  </td>
                </tr>
              ) : (
                prospectosFiltrados.map(p => {
                  const seleccionado = seleccionados.find(s => s.prospecto_id === p.prospecto_id);

                  return (
                    <tr
                      key={p.prospecto_id}
                      className={`hover:bg-gray-50 cursor-pointer ${seleccionado ? 'bg-blue-50' : ''}`}
                      onClick={() => toggleSeleccion(p)}
                    >
                      {/* Empresa (con checkbox integrado) */}
                      <td className="px-6 py-5 min-w-0">
                        <div className="flex items-start gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={!!seleccionado}
                            readOnly
                            className="mt-1"
                          />
                          <div className="min-w-0">
                            <div className="font-medium text-gray-900 break-words">
                              {p.nombre}
                            </div>
                            <div className="text-xs text-gray-500">
                              {p.tipo_societe || 'Otro'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Estado */}
                      <td className="px-6 py-5">
                        <span className={`px-2 py-1 text-xs rounded-full ${badgeEstado(p.estado_campania)}`}>
                          {traducirEstado(p.estado_campania)}
                        </span>
                      </td>

                      {/* Teléfono */}
                      <td className="px-6 py-5 text-sm text-gray-700 break-words">
                        {p.telefono_wapp || '-'}
                      </td>

                      {/* Dirección (clamp 2 líneas) */}
                      <td className="px-6 py-5 min-w-0">
                        <div
                          className="text-sm text-gray-700"
                          style={clamp2LinesStyle}
                          title={p.direccion || ''}
                        >
                          {p.direccion || '-'}
                        </div>
                      </td>

                      {/* Acciones */}
                      <td className="px-6 py-5">
                        <div className="flex flex-wrap gap-2">
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

                          {p.envio_id && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                abrirModalClasificar(p);
                              }}
                              className="px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50"
                            >
                              Clasificar post-envío
                            </button>
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

              {!whatsappAbierto ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-800">
                    ℹ️ Presiona "Abrir WhatsApp" para abrir una ventana con el mensaje. Luego confirma el envío cuando hayas enviado el mensaje.
                  </p>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-xs text-green-800">
                    ✅ WhatsApp abierto. Envía el mensaje y luego presiona "Confirmar Envío" para actualizar el estado.
                  </p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button
                onClick={cancelarEnvio}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>

              {!whatsappAbierto ? (
                <button
                  onClick={handleAbrirWhatsApp}
                  disabled={!datosEnvioPreparado || loadingEnvio}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 disabled:bg-gray-300"
                >
                  <MessageCircle className="h-4 w-4" />
                  {loadingEnvio ? 'Preparando...' : 'Abrir WhatsApp'}
                </button>
              ) : (
                <button
                  onClick={confirmarEstadoEnviado}
                  disabled={loadingEnvio}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:bg-gray-300"
                >
                  {loadingEnvio ? 'Confirmando...' : '✓ Confirmar Envío'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Clasificación Post-Envío */}
      {mostrarModalClasificar && prospectoClasificar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">Clasificar post-envío</h3>
              <p className="text-sm text-gray-600 mt-1">
                {prospectoClasificar.nombre} — envío #{prospectoClasificar.envio_id}
              </p>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estado post-envío
                </label>
                <select
                  value={clasificacion.post_envio_estado}
                  onChange={(e) => onChangePostEnvioEstado(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">Seleccionar...</option>
                  {POST_ENVIO_ESTADOS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Acción siguiente
                </label>
                <select
                  value={clasificacion.accion_siguiente}
                  onChange={(e) => setClasificacion(prev => ({ ...prev, accion_siguiente: e.target.value }))}
                  disabled={clasificacion.post_envio_estado === 'ATENDIO_MENOR_DE_EDAD'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
                >
                  <option value="">Seleccionar...</option>
                  {POST_ENVIO_ACCIONES.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>

                {clasificacion.post_envio_estado === 'ATENDIO_MENOR_DE_EDAD' && (
                  <p className="text-xs text-gray-600 mt-1">
                    Regla: menor de edad ⇒ NO_CONTACTAR (forzado)
                  </p>
                )}

                {(clasificacion.post_envio_estado === 'NUMERO_INEXISTENTE' ||
                  clasificacion.post_envio_estado === 'NUMERO_CAMBIO_DUEÑO') && (
                  <p className="text-xs text-gray-600 mt-1">
                    Sugerido: INVALIDAR_TELEFONO
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Detalle (opcional)
                </label>
                <input
                  value={clasificacion.detalle}
                  onChange={(e) => setClasificacion(prev => ({ ...prev, detalle: e.target.value }))}
                  placeholder="Detalle breve (máx 255)"
                  maxLength={255}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button
                onClick={cerrarModalClasificar}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                disabled={loadingClasificacion}
              >
                Cancelar
              </button>
              <button
                onClick={guardarClasificacion}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
                disabled={loadingClasificacion}
              >
                {loadingClasificacion ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GestionDestinatariosPage;