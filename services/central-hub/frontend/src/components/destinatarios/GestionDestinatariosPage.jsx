import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Mail, MessageCircle, Phone, SendHorizontal, XCircle } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import prospectosService from '../../services/prospectos';
import campanasService from '../../services/campanas';
import destinatariosService from '../../services/destinatarios';
import enviosService from '../../services/envios';
import emailService from '../../services/email';
import EmailCampaignFormModal from './EmailCampaignFormModal';

const CARTERA_ORIGEN_UI_OPTIONS = [
  { value: 'todos', label: 'Todos' },
  { value: 'CAPTADO_LEADMASTER', label: 'CAPTADO_LEADMASTER' },
  { value: 'IMPORTADO_CLIENTE', label: 'IMPORTADO_CLIENTE' },
  { value: 'EXISTENTE_CLIENTE', label: 'EXISTENTE_CLIENTE' },
  { value: 'OTRO', label: 'OTRO' }
];

const CANAL_DISPONIBLE_OPTIONS = [
  { value: 'todos', label: 'Todos' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
  { value: 'ambos', label: 'Ambos' },
  { value: 'solo_whatsapp', label: 'Solo WhatsApp' },
  { value: 'solo_email', label: 'Solo Email' },
  { value: 'sin_canales', label: 'Sin canales' }
];

// Valores reales en datos/BD (ll_societe_extended.cartera_origen)
const CARTERA_ORIGEN_UI_TO_DATA = {
  CAPTADO_LEADMASTER: ['CAPTADO_LEADMASTER'],
  IMPORTADO_CLIENTE: ['IMPORT_MANUAL'],
  EXISTENTE_CLIENTE: ['CARTERA_PROPIA']
};

function hasWhatsappDisponible(prospecto) {
  return typeof prospecto?.telefono_wapp === 'string' && prospecto.telefono_wapp.trim() !== '';
}

function hasEmailDisponible(prospecto) {
  return emailService.isValidEmail(prospecto?.email);
}

function normalizeCarteraOrigenValue(raw) {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  return s.toUpperCase();
}

function matchesCarteraOrigenFilter(prospecto, carteraOrigenFiltro) {
  if (!carteraOrigenFiltro || carteraOrigenFiltro === 'todos') return true;

  const cartera = normalizeCarteraOrigenValue(
    prospecto?.cartera_origen ?? prospecto?.carteraOrigen
  );

  if (carteraOrigenFiltro === 'OTRO') {
    return cartera === null || cartera === 'OTRO' || cartera === 'REFERIDO';
  }

  const allowed = CARTERA_ORIGEN_UI_TO_DATA[carteraOrigenFiltro];
  if (!Array.isArray(allowed)) return false;

  return cartera !== null && allowed.includes(cartera);
}

function matchesCanalDisponibleFilter(prospecto, canalDisponibleFiltro) {
  if (!canalDisponibleFiltro || canalDisponibleFiltro === 'todos') return true;

  const hasWhatsapp = hasWhatsappDisponible(prospecto);
  const hasEmail = hasEmailDisponible(prospecto);

  switch (canalDisponibleFiltro) {
    case 'whatsapp':
      return hasWhatsapp;
    case 'email':
      return hasEmail;
    case 'ambos':
      return hasWhatsapp && hasEmail;
    case 'solo_whatsapp':
      return hasWhatsapp && !hasEmail;
    case 'solo_email':
      return !hasWhatsapp && hasEmail;
    case 'sin_canales':
      return !hasWhatsapp && !hasEmail;
    default:
      return true;
  }
}

const INITIAL_CLASIFICACION = {
  post_envio_estado: '',
  accion_siguiente: '',
  detalle: ''
};

const POST_ENVIO_ESTADOS = [
  { value: 'CONTACTO_VALIDO_SIN_INTERES', label: 'Contacto válido sin interés' },
  { value: 'PARA_DERIVAR', label: 'Para derivar' },
  { value: 'PENDIENTE_SIN_RESPUESTA', label: 'Pendiente sin respuesta' },
  { value: 'NUMERO_INEXISTENTE', label: 'Número inexistente' },
  { value: 'NUMERO_CAMBIO_DUEÑO', label: 'Número cambió de dueño' },
  { value: 'TERCERO_NO_RESPONSABLE', label: 'Tercero no responsable' },
  { value: 'ATENDIO_MENOR_DE_EDAD', label: 'Atendió menor de edad' },
  { value: 'NO_ENTREGADO_ERROR_ENVIO', label: 'No entregado / error de envío' }
];

const POST_ENVIO_ACCIONES = [
  { value: 'DERIVAR', label: 'Derivar' },
  { value: 'FOLLOWUP_1', label: 'Follow-up 1' },
  { value: 'CERRAR', label: 'Cerrar' },
  { value: 'INVALIDAR_TELEFONO', label: 'Invalidar teléfono' },
  { value: 'REINTENTO_TECNICO', label: 'Reintento técnico' },
  { value: 'NO_CONTACTAR', label: 'No contactar' }
];

function traducirEstado(estado) {
  if (typeof estado === 'string' && estado.startsWith('email_status:')) {
    return estado.replace('email_status:', '').replaceAll('_', ' ');
  }

  switch (estado) {
    case 'sin_contexto':
      return 'Sin campaña seleccionada';
    case 'sin_envio':
      return 'No incluido';
    case 'pendiente':
      return 'Pendiente';
    case 'enviado':
      return 'Enviado';
    case 'error':
      return 'Error';
    case 'CONTACTO_VALIDO_SIN_INTERES':
      return 'Contacto válido sin interés';
    case 'PARA_DERIVAR':
      return 'Para derivar';
    case 'PENDIENTE_SIN_RESPUESTA':
      return 'Pendiente sin respuesta';
    case 'NUMERO_INEXISTENTE':
      return 'Número inexistente';
    case 'NUMERO_CAMBIO_DUEÑO':
      return 'Número cambió de dueño';
    case 'TERCERO_NO_RESPONSABLE':
      return 'Tercero no responsable';
    case 'ATENDIO_MENOR_DE_EDAD':
      return 'Atendió menor de edad';
    case 'NO_ENTREGADO_ERROR_ENVIO':
      return 'No entregado / error de envío';
    default:
      return estado;
  }
}

function badgeEstado(estado) {
  if (typeof estado === 'string' && estado.startsWith('email_status:')) {
    const raw = estado.replace('email_status:', '');
    if (raw === 'PENDING') return 'bg-yellow-100 text-yellow-800';
    if (raw === 'SENT') return 'bg-green-100 text-green-800';
    if (raw === 'FAILED' || raw === 'ERROR') return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-800';
  }

  switch (estado) {
    case 'sin_contexto':
      return 'bg-slate-100 text-slate-700';
    case 'enviado':
      return 'bg-green-100 text-green-800';
    case 'pendiente':
      return 'bg-yellow-100 text-yellow-800';
    case 'error':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

const GestionDestinatariosPage = ({
  hideHeader = false,
  backPath = '/campaigns',
  title = 'Seleccionar Prospectos',
  campaignId,
  defaultCanalDisponibleFiltro = 'todos',
  hideWhatsappActions = false,
  useEmailCampaignSelector = false,
  emailCampaigns = []
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [campanas, setCampanas] = useState([]);
  const [campaniaSeleccionada, setCampaniaSeleccionada] = useState('');
  const [emailCampaignSeleccionada, setEmailCampaignSeleccionada] = useState('');
  const [prospectos, setProspectos] = useState([]);
  const [seleccionados, setSeleccionados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [estadoFiltro, setEstadoFiltro] = useState('todos');
  const [tipoSocieteFiltro, setTipoSocieteFiltro] = useState('todos');
  const [carteraOrigenFiltro, setCarteraOrigenFiltro] = useState('todos');
  const [canalDisponibleFiltro, setCanalDisponibleFiltro] = useState(defaultCanalDisponibleFiltro);
  const [q, setQ] = useState('');

  // Estados para envío manual (flujo 2 fases)
  const [prospectoSeleccionado, setProspectoSeleccionado] = useState(null);
  const [mostrarModalWhatsApp, setMostrarModalWhatsApp] = useState(false);
  const [datosEnvioPreparado, setDatosEnvioPreparado] = useState(null);
  const [loadingEnvio, setLoadingEnvio] = useState(false);
  const [whatsappAbierto, setWhatsappAbierto] = useState(false);

  const [mostrarModalEmail, setMostrarModalEmail] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [resultadoEmail, setResultadoEmail] = useState(null);

  // Estados para clasificación post-envío
  const [mostrarModalClasificar, setMostrarModalClasificar] = useState(false);
  const [prospectoClasificar, setProspectoClasificar] = useState(null);
  const [loadingClasificacion, setLoadingClasificacion] = useState(false);
  const [clasificacion, setClasificacion] = useState(INITIAL_CLASIFICACION);

  const resetWhatsappModalState = useCallback(() => {
    setMostrarModalWhatsApp(false);
    setProspectoSeleccionado(null);
    setDatosEnvioPreparado(null);
    setLoadingEnvio(false);
    setWhatsappAbierto(false);
  }, []);

  const resetEmailModalState = useCallback(() => {
    setMostrarModalEmail(false);
    setLoadingEmail(false);
    setResultadoEmail(null);
  }, []);

  const resetClasificacionState = useCallback(() => {
    setMostrarModalClasificar(false);
    setProspectoClasificar(null);
    setClasificacion(INITIAL_CLASIFICACION);
    setLoadingClasificacion(false);
  }, []);

  const resetTransientUiState = useCallback(() => {
    resetWhatsappModalState();
    resetEmailModalState();
    resetClasificacionState();
  }, [resetClasificacionState, resetEmailModalState, resetWhatsappModalState]);

  useEffect(() => {
    if (useEmailCampaignSelector) {
      return;
    }

    cargarCampanas();
  }, [useEmailCampaignSelector]);

  useEffect(() => {
    if (!useEmailCampaignSelector) return;
    cargarProspectos();
  }, [useEmailCampaignSelector, emailCampaignSeleccionada]);

  useEffect(() => {
    if (!useEmailCampaignSelector && campaniaSeleccionada) {
      cargarProspectos();
    }
  }, [campaniaSeleccionada, useEmailCampaignSelector]);

  useEffect(() => {
    resetTransientUiState();
  }, [location.pathname, campaniaSeleccionada, emailCampaignSeleccionada, resetTransientUiState]);

  const hasCampaignMatch = !useEmailCampaignSelector && Boolean(campaignId) && campanas.some(
    (c) => String(c.id) === String(campaignId)
  );

  useEffect(() => {
    if (hasCampaignMatch) {
      setCampaniaSeleccionada(String(campaignId));
    }
  }, [campaignId, hasCampaignMatch]);

  useEffect(() => {
    if (!useEmailCampaignSelector) return;
    if (!campaignId) return;

    const exists = emailCampaigns.some((c) => String(c.id) === String(campaignId));
    if (exists) {
      setEmailCampaignSeleccionada(String(campaignId));
    }
  }, [campaignId, emailCampaigns, useEmailCampaignSelector]);

  const emailCampaignContexto = useMemo(
    () => emailCampaigns.find((c) => String(c.id) === String(emailCampaignSeleccionada)) || null,
    [emailCampaignSeleccionada, emailCampaigns]
  );

  useEffect(() => {
    if (!useEmailCampaignSelector) return;
    setSeleccionados([]);
    resetEmailModalState();
  }, [emailCampaignSeleccionada, emailCampaigns, resetEmailModalState, useEmailCampaignSelector]);

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

      const response = await prospectosService.filtrarProspectos(
        useEmailCampaignSelector
          ? {
              email_campaign_id: emailCampaignSeleccionada || undefined
            }
          : {
              campania_id: campaniaSeleccionada
            }
      );

      const lista = response?.data || [];
      setProspectos(lista);
      setSeleccionados([]);
      resetTransientUiState();
      setEstadoFiltro('todos');
      setTipoSocieteFiltro('todos');
      setCarteraOrigenFiltro('todos');
      setCanalDisponibleFiltro(defaultCanalDisponibleFiltro);
      setQ('');
    } catch (err) {
      console.error('Error cargando prospectos:', err);
      setError('Error al cargar prospectos');
    } finally {
      setLoading(false);
    }
  };

  function normalizeEmailRecipientStatus(status) {
    if (status === undefined || status === null) return null;

    const normalized = String(status).trim().toUpperCase();
    if (!normalized) return null;

    switch (normalized) {
      case 'PENDING':
        return 'pendiente';
      case 'SENT':
        return 'enviado';
      case 'FAILED':
      case 'ERROR':
        return 'error';
      default:
        return `email_status:${normalized}`;
    }
  }

  function estadoPrincipal(prospecto) {
    if (useEmailCampaignSelector) {
      if (!emailCampaignSeleccionada) {
        return 'sin_contexto';
      }

      return normalizeEmailRecipientStatus(prospecto?.email_recipient_status) || 'sin_envio';
    }

    return prospecto?.post_envio_estado || prospecto?.estado_campania || 'sin_envio';
  }

  const estadoOptions = useMemo(() => {
    if (useEmailCampaignSelector) {
      if (!emailCampaignSeleccionada) {
        return [{ value: 'sin_contexto', label: 'Sin campaña seleccionada' }];
      }

      const preferredOrder = ['sin_envio', 'pendiente', 'enviado', 'error'];
      const presentes = Array.from(new Set(prospectos.map((p) => estadoPrincipal(p))));
      const ordered = preferredOrder.filter((value) => presentes.includes(value));
      const extra = presentes
        .filter((value) => !preferredOrder.includes(value))
        .sort((a, b) => traducirEstado(a).localeCompare(traducirEstado(b), 'es'));

      return [...ordered, ...extra].map((value) => ({
        value,
        label: traducirEstado(value)
      }));
    }

    return [
      'sin_envio',
      'pendiente',
      'enviado',
      'error',
      ...POST_ENVIO_ESTADOS.map((opt) => opt.value)
    ].map((value) => ({
      value,
      label: traducirEstado(value)
    }));
  }, [useEmailCampaignSelector, emailCampaignSeleccionada, prospectos]);
  const prospectosFiltrados = useMemo(() => {
    let filtrados = [...prospectos];

    if (estadoFiltro !== 'todos') {
      filtrados = filtrados.filter((p) => estadoPrincipal(p) === estadoFiltro);
    }

    if (tipoSocieteFiltro !== 'todos') {
      filtrados = filtrados.filter((p) => (p.tipo_societe || 'Otro') === tipoSocieteFiltro);
    }

    if (carteraOrigenFiltro !== 'todos') {
      filtrados = filtrados.filter((p) => matchesCarteraOrigenFilter(p, carteraOrigenFiltro));
    }

    filtrados = filtrados.filter((p) =>
      matchesCanalDisponibleFilter(p, canalDisponibleFiltro)
    );

    const query = q.trim().toLowerCase();
    if (query) {
      filtrados = filtrados.filter((p) => {
        const nombre = String(p.nombre || '').toLowerCase();
        const telefono = String(p.telefono_wapp || '').toLowerCase();
        const email = String(p.email || '').toLowerCase();
        const direccion = String(p.direccion || '').toLowerCase();
        return (
          nombre.includes(query) ||
          telefono.includes(query) ||
          email.includes(query) ||
          direccion.includes(query)
        );
      });
    }

    return filtrados;
  }, [
    prospectos,
    estadoFiltro,
    tipoSocieteFiltro,
    carteraOrigenFiltro,
    canalDisponibleFiltro,
    q
  ]);

  const contextoCampania = useMemo(
    () => campanas.find((c) => String(c.id) === String(campaniaSeleccionada)) || null,
    [campanas, campaniaSeleccionada]
  );

  const resumenSeleccion = useMemo(() => {
    const conWhatsapp = seleccionados.filter(hasWhatsappDisponible);
    const conEmail = seleccionados.filter(hasEmailDisponible);
    const whatsappListos = seleccionados.filter(
      (p) => hasWhatsappDisponible(p) && p.estado_campania === 'pendiente' && p.envio_id
    );

    return {
      total: seleccionados.length,
      conWhatsapp: conWhatsapp.length,
      conEmail: conEmail.length,
      sinEmail: seleccionados.length - conEmail.length,
      whatsappListos
    };
  }, [seleccionados]);

  const toggleSeleccion = (prospecto) => {
    setSeleccionados((prev) => {
      const existe = prev.find((p) => p.prospecto_id === prospecto.prospecto_id);
      if (existe) return prev.filter((p) => p.prospecto_id !== prospecto.prospecto_id);
      return [...prev, prospecto];
    });
  };

  const seleccionarTodos = () => {
    const todosSeleccionados =
      prospectosFiltrados.length > 0 &&
      prospectosFiltrados.every((p) =>
        seleccionados.find((s) => s.prospecto_id === p.prospecto_id)
      );

    if (todosSeleccionados) {
      setSeleccionados((prev) =>
        prev.filter((s) => !prospectosFiltrados.find((p) => p.prospecto_id === s.prospecto_id))
      );
    } else {
      const nuevos = prospectosFiltrados.filter(
        (p) => !seleccionados.find((s) => s.prospecto_id === p.prospecto_id)
      );
      setSeleccionados((prev) => [...prev, ...nuevos]);
    }
  };

  const agregarACampania = async () => {
    try {
      setLoading(true);

      if (useEmailCampaignSelector) {
        if (!emailCampaignSeleccionada || seleccionados.length === 0) {
          alert('Selecciona campaña Email y prospectos');
          return;
        }

        const recipients = seleccionados
          .filter(hasEmailDisponible)
          .map((p) => ({
            to_email: emailService.normalizeEmail(p.email),
            nombre_destino: p.nombre || null,
            lugar_id: p.prospecto_id || null
          }));

        const omitidosSinEmail = seleccionados.length - recipients.length;

        if (recipients.length === 0) {
          alert('Los prospectos seleccionados no tienen email válido');
          return;
        }

        const data = await emailService.addCampaignRecipients(emailCampaignSeleccionada, recipients);
        const summary = data?.summary || {};

        alert(
          `Destinatarios Email procesados. Insertados: ${summary.inserted || 0}. Reencolados: ${summary.requeued || 0}. Ya pendientes: ${summary.already_pending || 0}. Omitidos sin email válido: ${omitidosSinEmail}.`
        );
      } else {
        if (!campaniaSeleccionada || seleccionados.length === 0) {
          alert('Selecciona campaña y prospectos');
          return;
        }

        const destinatarios = seleccionados.map((p) => ({
          telefono_wapp: p.telefono_wapp,
          nombre_destino: p.nombre,
          lugar_id: p.prospecto_id
        }));

        await destinatariosService.agregarDestinatarios(campaniaSeleccionada, destinatarios);

        alert(`Se agregaron ${destinatarios.length} prospectos`);
      }

      setSeleccionados([]);
      cargarProspectos();
    } catch (err) {
      console.error('Error agregando destinatarios:', err);
      alert('Error al agregar destinatarios: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const abrirModalEmail = () => {
    if (seleccionados.length === 0) {
      alert('Selecciona al menos un prospecto');
      return;
    }

    resetEmailModalState();
    setMostrarModalEmail(true);
  };

  const cerrarModalEmail = () => {
    resetEmailModalState();
  };

  const prepararEnvioEmailCampania = async () => {
    if (!useEmailCampaignSelector) {
      // Flujo de campaña Email no aplica en este modo;
      // el envío manual se dispara directamente desde abrirModalEmail.
      return;
    }

    if (!emailCampaignSeleccionada) {
      alert('Selecciona una campaña Email para preparar su envío');
      return;
    }

    const campaignName = emailCampaignContexto?.nombre || `#${emailCampaignSeleccionada}`;
    const confirmed = window.confirm(
      `Se va a preparar el envío técnico de la campaña Email "${campaignName}" usando el asunto, cuerpo y destinatarios persistidos. ¿Continuar?`
    );

    if (!confirmed) {
      return;
    }

    setLoadingEmail(true);

    try {
      const response = await emailService.prepareCampaign(emailCampaignSeleccionada);
      const campaign = response?.campaign || {};
      const stats = response?.stats || {};

      await cargarProspectos();

      alert(
        `Campaña Email preparada correctamente. Estado: ${campaign.estado || 'pendiente'}. Próximo envío: ${campaign.next_envio_id || 'N/D'}. Destinatarios pendientes: ${stats.total_pendientes ?? 'N/D'}.`
      );
    } catch (error) {
      console.error('Error preparando campaña Email:', error);
      alert(
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        'No se pudo preparar la campaña Email'
      );
    } finally {
      setLoadingEmail(false);
    }
  };

  const enviarEmailSeleccion = async ({ subject, text, recipients }) => {
    setLoadingEmail(true);
    setResultadoEmail(null);

    try {
      const resultado = await emailService.sendSelectionFanout({
        recipients,
        subject,
        text
      });

      setResultadoEmail(resultado);

      if (resultado.failed === 0) {
        alert(`Se enviaron ${resultado.sent} emails correctamente`);
      } else {
        alert(`Emails enviados: ${resultado.sent}. Fallidos: ${resultado.failed}`);
      }
    } catch (error) {
      console.error('Error enviando emails:', error);
      alert('Error al enviar emails: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoadingEmail(false);
    }
  };

  const prepararEnvioWhatsAppSeleccionado = async () => {
    if (resumenSeleccion.total === 0) {
      alert('Selecciona al menos un prospecto');
      return;
    }

    if (resumenSeleccion.whatsappListos.length === 0) {
      alert('No hay prospectos seleccionados listos para reutilizar el flujo actual de WhatsApp');
      return;
    }

    if (resumenSeleccion.whatsappListos.length > 1) {
      alert(
        'El flujo actual de WhatsApp se reutiliza de a un prospecto por vez. Selecciona solo uno para continuar.'
      );
      return;
    }

    await handleAbrirModalWhatsApp(resumenSeleccion.whatsappListos[0]);
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

  /**
   * FASE 3b: Marcar estado 'error' en el backend
   * (no registra detalle aquí; se usa "Clasificar post-envío" para eso)
   */
  const marcarEstadoError = async () => {
    const envioId = datosEnvioPreparado?.envio_id || prospectoSeleccionado?.envio_id;
    if (!envioId) return;

    setLoadingEnvio(true);
    try {
      const response = await enviosService.markManualError(envioId);

      if (response?.success) {
        alert('⚠️ Envío marcado como error');
        setMostrarModalWhatsApp(false);
        setDatosEnvioPreparado(null);
        setProspectoSeleccionado(null);
        setWhatsappAbierto(false);
        cargarProspectos();
      } else {
        alert('No se pudo marcar el envío como error');
      }
    } catch (error) {
      console.error('Error al marcar error:', error);
      alert('Error al marcar error: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoadingEnvio(false);
    }
  };

  const cancelarEnvio = () => {
    resetWhatsappModalState();
  };

  const abrirModalClasificar = (prospecto) => {
    if (!prospecto?.envio_id) {
      alert('Este prospecto no tiene un envío asociado');
      return;
    }
    setProspectoClasificar(prospecto);
    setClasificacion({
      post_envio_estado: prospecto?.post_envio_estado || '',
      accion_siguiente: prospecto?.accion_siguiente || '',
      detalle: prospecto?.detalle || ''
    });
    setMostrarModalClasificar(true);
  };

  const cerrarModalClasificar = () => {
    resetClasificacionState();
  };

  const onChangePostEnvioEstado = (nuevoEstado) => {
    setClasificacion((prev) => {
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
        cargarProspectos();
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

  const Indicator = ({ enabled, label, detail, icon: Icon }) => (
    <div
      className={`inline-flex min-w-[132px] items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
        enabled
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-gray-200 bg-gray-50 text-gray-500'
      }`}
    >
      <Icon className="h-4 w-4" />
      <div className="min-w-0">
        <div className="font-medium">{label}</div>
        <div className="truncate text-xs">{detail}</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col overflow-x-hidden">
      {!hideHeader && (
        <div className="bg-white border-b px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate(backPath)}
              className="flex items-center text-gray-600 hover:text-gray-800"
            >
              <ArrowLeft className="h-5 w-5 mr-1" />
              Volver
            </button>
            <h1 className="text-2xl font-bold">{title}</h1>
          </div>

          <div className="text-sm text-gray-600">{resumenSeleccion.total} seleccionados</div>
        </div>
      )}

      <div className="flex-1 p-4 md:p-6 overflow-hidden">
        <div className="bg-white rounded-lg shadow h-full overflow-y-auto overflow-x-hidden">
          <div className="sticky top-0 z-20 bg-white border-b">
            <div className="grid gap-4 border-b px-6 py-5 md:grid-cols-3">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  {useEmailCampaignSelector ? 'Campaña Email actual' : 'Campaña / base actual'}
                </div>
                <div className="mt-2 text-lg font-semibold text-gray-900">
                  {useEmailCampaignSelector
                    ? emailCampaignContexto?.nombre || 'Seleccionar campaña Email'
                    : contextoCampania?.nombre || 'Seleccionar campaña'}
                </div>
                <div className="mt-1 text-sm text-gray-500">
                  {useEmailCampaignSelector
                    ? emailCampaignSeleccionada
                      ? 'Mostrando el universo de prospectos del cliente autenticado'
                      : 'La tabla carga el universo del cliente aunque aún no elijas campaña Email'
                    : campaniaSeleccionada
                      ? `ID ${campaniaSeleccionada}`
                      : 'Sin campaña seleccionada'}
                </div>
              </div>

              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-blue-700">
                  Total filtrados
                </div>
                <div className="mt-2 text-3xl font-semibold text-blue-900">
                  {prospectosFiltrados.length}
                </div>
                <div className="mt-1 text-sm text-blue-700">Prospectos visibles en la tabla</div>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-emerald-700">
                  Total seleccionados
                </div>
                <div className="mt-2 text-3xl font-semibold text-emerald-900">
                  {resumenSeleccion.total}
                </div>
                <div className="mt-1 text-sm text-emerald-700">
                  {hideWhatsappActions
                    ? `emails válidos: ${resumenSeleccion.conEmail}, sin email: ${resumenSeleccion.sinEmail}`
                    : `${resumenSeleccion.conWhatsapp} con WhatsApp, ${resumenSeleccion.conEmail} con email`}
                </div>
              </div>
            </div>

            <div className="px-6 py-4">
              <div className="flex flex-wrap items-end gap-3">
                {useEmailCampaignSelector ? (
                  <div className="min-w-[240px] flex-1">
                    <label className="block text-sm font-medium mb-1">Campaña Email</label>
                    <select
                      value={emailCampaignSeleccionada}
                      onChange={(e) => setEmailCampaignSeleccionada(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="">Seleccionar campaña Email...</option>
                      {emailCampaigns.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      La grilla usa automáticamente todos los prospectos del cliente autenticado.
                    </p>
                  </div>
                ) : (
                  <div className="min-w-[240px] flex-1">
                    <label className="block text-sm font-medium mb-1">Campaña de destino</label>
                    <>
                      <select
                        value={campaniaSeleccionada}
                        onChange={(e) => setCampaniaSeleccionada(e.target.value)}
                        disabled={hasCampaignMatch}
                        className="w-full px-3 py-2 border rounded-lg disabled:bg-gray-100 disabled:text-gray-600"
                      >
                        <option value="">Seleccionar campaña...</option>
                        {campanas.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nombre}
                          </option>
                        ))}
                      </select>
                      {hasCampaignMatch && (
                        <p className="mt-1 text-xs text-blue-600">
                          Campaña fijada por contexto de navegación.
                        </p>
                      )}
                      {!useEmailCampaignSelector && campaignId && !hasCampaignMatch && (
                        <p className="mt-1 text-xs text-amber-600">
                          Esta campaña Email aún no está vinculada a una campaña operativa. Seleccioná una campaña para continuar.
                        </p>
                      )}
                    </>
                  </div>
                )}

                <button
                  onClick={agregarACampania}
                  disabled={
                    (useEmailCampaignSelector
                      ? !emailCampaignSeleccionada
                      : !campaniaSeleccionada) || resumenSeleccion.total === 0
                  }
                  className="px-4 py-2 bg-slate-700 text-white rounded-lg disabled:bg-gray-300"
                >
                  {useEmailCampaignSelector ? 'Agregar destinatarios Email' : 'Agregar a Campaña'}
                </button>

                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700">Estado</label>
                  <select
                    value={estadoFiltro}
                    onChange={(e) => setEstadoFiltro(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="todos">Todos</option>
                    {estadoOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
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

                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700">
                    Cartera Origen
                  </label>
                  <select
                    value={carteraOrigenFiltro}
                    onChange={(e) => setCarteraOrigenFiltro(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    {CARTERA_ORIGEN_UI_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700">
                    Canal disponible
                  </label>
                  <select
                    value={canalDisponibleFiltro}
                    onChange={(e) => setCanalDisponibleFiltro(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    {CANAL_DISPONIBLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="min-w-[220px] flex-1">
                  <label className="block text-sm font-medium mb-1 text-gray-700">Búsqueda</label>
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Nombre, teléfono, email o dirección"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="border-t px-6 py-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {useEmailCampaignSelector
                      ? 'Acciones de campaña Email'
                      : 'Acciones sobre seleccionados'}
                  </div>
                  <div className="text-sm text-gray-600">
                    {useEmailCampaignSelector
                      ? `${resumenSeleccion.total} seleccionados. Agregá destinatarios a la campaña Email y luego prepará el envío técnico de esa campaña.`
                      : hideWhatsappActions
                        ? `${resumenSeleccion.total} seleccionados.`
                        : `${resumenSeleccion.total} seleccionados. WhatsApp reutiliza el flujo actual y se prepara de a un prospecto por vez.`}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={seleccionarTodos}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    {prospectosFiltrados.length > 0 &&
                    prospectosFiltrados.every((p) =>
                      seleccionados.find((s) => s.prospecto_id === p.prospecto_id)
                    )
                      ? 'Deseleccionar todos'
                      : 'Seleccionar todos'}
                  </button>

                  {!hideWhatsappActions && (
                    <button
                      onClick={prepararEnvioWhatsAppSeleccionado}
                      disabled={
                        resumenSeleccion.total === 0 ||
                        resumenSeleccion.whatsappListos.length === 0 ||
                        loadingEnvio
                      }
                      className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:bg-gray-300"
                    >
                      <MessageCircle className="h-4 w-4" />
                      Preparar envío WhatsApp
                    </button>
                  )}

                  {useEmailCampaignSelector ? (
                    <button
                      onClick={prepararEnvioEmailCampania}
                      disabled={!emailCampaignSeleccionada || loadingEmail}
                      className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-gray-300"
                    >
                      <SendHorizontal className="h-4 w-4" />
                      {loadingEmail ? 'Preparando campaña...' : 'Preparar envío de campaña'}
                    </button>
                  ) : (
                    <button
                      onClick={abrirModalEmail}
                      disabled={resumenSeleccion.total === 0 || loadingEmail}
                      className="flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-blue-700 hover:bg-blue-100 disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      <Mail className="h-4 w-4" />
                      Envío manual Email (sin campaña)
                    </button>
                  )}
                </div>
              </div>

              {!useEmailCampaignSelector && !hideWhatsappActions && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
                  <strong>Envío manual Email:</strong> abre un formulario para redactar y enviar un correo puntual sin asociarlo a ninguna campaña Email persistida. Para trabajar con campañas Email, usá el <a href="/email/campaigns" className="underline font-medium">módulo de Campañas Email</a>.
                </div>
              )}

              {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
            </div>
          </div>

          <table className="w-full table-fixed">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-6 py-3 text-left w-[24%]">Empresa</th>
                {!hideWhatsappActions && (
                  <th className="px-6 py-3 text-left w-[16%]">WhatsApp</th>
                )}
                <th className="px-6 py-3 text-left w-[16%]">Email</th>
                <th className="px-6 py-3 text-left w-[12%]">Estado</th>
                <th className="px-6 py-3 text-left w-[20%]">Dirección</th>
                <th className="px-6 py-3 text-left w-[12%]">Acciones</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={hideWhatsappActions ? 5 : 6} className="p-6 text-center">
                    Cargando...
                  </td>
                </tr>
              ) : prospectosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={hideWhatsappActions ? 5 : 6} className="p-6 text-center">
                    {prospectos.length === 0 ? 'No hay prospectos' : 'No hay prospectos con este filtro'}
                  </td>
                </tr>
              ) : (
                prospectosFiltrados.map((p) => {
                  const seleccionado = seleccionados.find((s) => s.prospecto_id === p.prospecto_id);
                  const estado = estadoPrincipal(p);

                  return (
                    <tr
                      key={p.prospecto_id}
                      className={`hover:bg-gray-50 cursor-pointer ${seleccionado ? 'bg-blue-50' : ''}`}
                      onClick={() => toggleSeleccion(p)}
                    >
                      <td className="px-6 py-5 min-w-0">
                        <div className="flex items-start gap-3 min-w-0">
                          <input type="checkbox" checked={!!seleccionado} readOnly className="mt-1" />
                          <div className="min-w-0">
                            <div className="font-medium text-gray-900 break-words">{p.nombre}</div>
                            <div className="text-xs text-gray-500">{p.tipo_societe || 'Otro'}</div>
                          </div>
                        </div>
                      </td>

                      {!hideWhatsappActions && (
                        <td className="px-6 py-5 text-sm text-gray-700">
                          <Indicator
                            enabled={hasWhatsappDisponible(p)}
                            label={hasWhatsappDisponible(p) ? 'Disponible' : 'Sin WhatsApp'}
                            detail={p.telefono_wapp || 'Sin teléfono'}
                            icon={Phone}
                          />
                        </td>
                      )}

                      <td className="px-6 py-5 text-sm text-gray-700">
                        <Indicator
                          enabled={hasEmailDisponible(p)}
                          label={hasEmailDisponible(p) ? 'Disponible' : 'Sin email'}
                          detail={p.email || 'Sin email'}
                          icon={Mail}
                        />
                      </td>

                      <td className="px-6 py-5">
                        <span className={`px-2 py-1 text-xs rounded-full ${badgeEstado(estado)}`}>
                          {traducirEstado(estado)}
                        </span>
                      </td>

                      <td className="px-6 py-5 min-w-0">
                        <div
                          className="text-sm text-gray-700"
                          style={clamp2LinesStyle}
                          title={p.direccion || ''}
                        >
                          {p.direccion || '-'}
                        </div>
                      </td>

                      <td className="px-6 py-5">
                        <div className="flex flex-wrap gap-2">
                          {!hideWhatsappActions && p.estado_campania === 'pendiente' && p.telefono_wapp && (
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

                          {!useEmailCampaignSelector && p.envio_id && (
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

      {!useEmailCampaignSelector && (
        <EmailCampaignFormModal
          isOpen={mostrarModalEmail}
          onClose={cerrarModalEmail}
          selectedProspects={seleccionados}
          onSubmit={enviarEmailSeleccion}
          loading={loadingEmail}
          result={resultadoEmail}
        />
      )}

      {mostrarModalWhatsApp && prospectoSeleccionado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">Enviar por Web WhatsApp</h3>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Empresa</label>
                <p className="text-gray-900">{prospectoSeleccionado.nombre}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <p className="text-gray-900">{prospectoSeleccionado.telefono_wapp}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mensaje</label>
                <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg max-h-40 overflow-y-auto">
                  {datosEnvioPreparado?.mensaje_final || 'Cargando mensaje...'}
                </div>
              </div>

              {!whatsappAbierto ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-800">
                    ℹ️ Presiona "Abrir WhatsApp" para abrir una ventana con el mensaje. Luego confirma
                    el envío cuando hayas enviado el mensaje (o marca error si hubo un inconveniente).
                  </p>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-xs text-green-800">
                    ✅ WhatsApp abierto. Envía el mensaje y luego presiona "Confirmar Envío" para
                    actualizar el estado (o "Marcar Error" si no se pudo enviar).
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

              <button
                onClick={marcarEstadoError}
                disabled={loadingEnvio || !datosEnvioPreparado}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-300"
              >
                {loadingEnvio ? 'Marcando...' : 'Marcar Error'}
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

      {mostrarModalClasificar && prospectoClasificar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">Clasificar post-envío</h3>
              <p className="text-sm text-gray-600 mt-1">
                {prospectoClasificar.nombre} — envío #{prospectoClasificar.envio_id}
              </p>

              {prospectoClasificar.post_envio_id && (
                <div className="mt-3 text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-1">
                  <div className="font-medium text-gray-800">Última clasificación guardada</div>
                  <div>
                    <span className="font-medium">Estado:</span>{' '}
                    {traducirEstado(prospectoClasificar.post_envio_estado || 'sin_envio')}
                  </div>
                  <div>
                    <span className="font-medium">Acción:</span>{' '}
                    {prospectoClasificar.accion_siguiente || '-'}
                  </div>
                  <div>
                    <span className="font-medium">Detalle:</span>{' '}
                    {prospectoClasificar.detalle || '-'}
                  </div>
                  {prospectoClasificar.clasificado_por && (
                    <div>
                      <span className="font-medium">Clasificado por:</span>{' '}
                      {prospectoClasificar.clasificado_por}
                    </div>
                  )}
                  {prospectoClasificar.post_envio_created_at && (
                    <div>
                      <span className="font-medium">Fecha:</span>{' '}
                      {new Date(prospectoClasificar.post_envio_created_at).toLocaleString()}
                    </div>
                  )}
                </div>
              )}
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
                  {POST_ENVIO_ESTADOS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Acción siguiente
                </label>
                <select
                  value={clasificacion.accion_siguiente}
                  onChange={(e) =>
                    setClasificacion((prev) => ({ ...prev, accion_siguiente: e.target.value }))
                  }
                  disabled={clasificacion.post_envio_estado === 'ATENDIO_MENOR_DE_EDAD'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
                >
                  <option value="">Seleccionar...</option>
                  {POST_ENVIO_ACCIONES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                {clasificacion.post_envio_estado === 'ATENDIO_MENOR_DE_EDAD' && (
                  <p className="text-xs text-gray-600 mt-1">
                    Regla: menor de edad ⇒ NO_CONTACTAR (forzado)
                  </p>
                )}

                {(clasificacion.post_envio_estado === 'NUMERO_INEXISTENTE' ||
                  clasificacion.post_envio_estado === 'NUMERO_CAMBIO_DUEÑO') && (
                  <p className="text-xs text-gray-600 mt-1">Sugerido: INVALIDAR_TELEFONO</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Detalle (opcional)
                </label>
                <input
                  value={clasificacion.detalle}
                  onChange={(e) =>
                    setClasificacion((prev) => ({ ...prev, detalle: e.target.value }))
                  }
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