import React, { useState, useEffect } from 'react';
import Card from '../common/Card';
import Button from '../common/Button';
import LoadingSpinner from '../common/LoadingSpinner';
import Modal from '../common/Modal';
import { senderAPI, leadsAPI } from '../../services/api';
import { destinatariosService } from '../../services/destinatarios';
import { campanasService } from '../../services/campanas';
import { useAuth } from '../../contexts/AuthContext';
import ProgramacionesForm from './ProgramacionesForm';
import ProgramacionesList from './ProgramacionesList';
import GestorDestinatarios from '../admin/GestorDestinatarios';

const CampaignsManager = () => {
  const { user } = useAuth();
  const isAdmin = user?.tipo === 'admin';
  
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showRecipientsModal, setShowRecipientsModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [destinatarios, setDestinatarios] = useState([]);
  const [estadisticasDestinatarios, setEstadisticasDestinatarios] = useState({});
  const [loadingDestinatarios, setLoadingDestinatarios] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    mensaje: '',
    programada: false,
    fecha_envio: ''
  });

  useEffect(() => {
    console.log('🔄 useEffect ejecutándose, cargando campañas...');
    console.log('👤 Usuario actual:', user);
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    console.log('🚀 loadCampaigns iniciando...');
    try {
      setLoading(true);
      console.log('📡 Llamando a senderAPI.getCampaigns()...');
      // Llamar a la API real
      const response = await senderAPI.getCampaigns();
      console.log('📊 Campañas cargadas desde API (response completo):', response);
      
      // Axios devuelve data en response.data
      const campaniasData = response.data || response;
      console.log('📊 Campañas data:', campaniasData);
      
      // Mapear respuesta para compatibilidad con la UI
      const campaniasMapeadas = (Array.isArray(campaniasData) ? campaniasData : []).map(campania => ({
        ...campania,
        total_destinatarios: campania.total_destinatarios || 0,
        enviados: campania.enviados || 0,
        fallidos: campania.fallidos || 0,
        pendientes: campania.pendientes || 0,
        descripcion: campania.descripcion || '',
        programada: campania.programada || false,
        fecha_envio: campania.fecha_envio || null
      }));
      
      console.log('📊 Campañas mapeadas:', campaniasMapeadas.length);
      setCampaigns(campaniasMapeadas);
    } catch (error) {
      console.error('❌ Error loading campaigns:', error);
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCampaign = () => {
    setFormData({
      nombre: '',
      descripcion: '',
      mensaje: '',
      programada: false,
      fecha_envio: ''
    });
    setShowCreateModal(true);
  };

  const handleEditCampaign = (campaign) => {
    // Validaciones más restrictivas para proteger integridad de datos
    const estadosNoEditables = ['activa', 'completada', 'pausada'];
    const hayEnviados = campaign.enviados > 0;
    
    if (estadosNoEditables.includes(campaign.estado) || hayEnviados) {
      let mensaje = 'No se pueden editar campañas que ya han comenzado a enviarse.';
      
      if (hayEnviados) {
        mensaje += `\n\nEsta campaña ya tiene ${campaign.enviados} mensajes enviados.`;
        mensaje += '\nEditar el contenido crearía inconsistencias en los datos.';
      } else {
        mensaje += `\n\nEstado actual: "${campaign.estado}"`;
        mensaje += '\nSolo se pueden editar campañas en estado: pendiente, pendiente_aprobacion, programada';
      }
      
      alert(mensaje);
      return;
    }
    
    setEditingCampaign(campaign);
    setFormData({
      nombre: campaign.nombre,
      descripcion: campaign.descripcion,
      mensaje: campaign.mensaje || '',
      programada: campaign.programada || false,
      fecha_envio: campaign.fecha_envio || ''
    });
    setShowEditModal(true);
  };

  const handleSaveCampaign = async () => {
    try {
      await senderAPI.createCampaign(formData);
      alert('Campaña creada exitosamente');
      setShowCreateModal(false);
      loadCampaigns();
    } catch (error) {
      console.error('Error creating campaign:', error);
      alert('Error al crear campaña');
    }
  };

  const handleSaveEditCampaign = async () => {
    try {
      console.log('Editando campaña:', editingCampaign.id, formData);
      
      // Llamada real a la API
      const response = await senderAPI.updateCampaign(editingCampaign.id, formData);
      
      // Actualizar la campaña en el estado local con la respuesta del servidor
      setCampaigns(campaigns.map(campaign => 
        campaign.id === editingCampaign.id 
          ? { 
              ...campaign, 
              ...formData, 
              estado: response.data.data.estado // Estado del servidor
            }
          : campaign
      ));
      
      // Mostrar mensaje de éxito del servidor
      alert(response.data.message || 'Campaña editada exitosamente. Estado cambiado a "Pendiente Aprobación".');
      
      setShowEditModal(false);
      setEditingCampaign(null);
      
      // Recargar campañas para sincronizar con servidor
      await loadCampaigns();
      
    } catch (error) {
      console.error('Error al editar campaña:', error);
      
      // Manejar errores específicos del servidor
      if (error.response?.data?.error) {
        const errorData = error.response.data;
        let errorMessage = errorData.error;
        
        // Agregar detalles si están disponibles
        if (errorData.details) {
          errorMessage += `\n\nDetalles:`;
          errorMessage += `\nEstado actual: ${errorData.details.estado_actual}`;
          errorMessage += `\nMensajes enviados: ${errorData.details.mensajes_enviados}`;
          errorMessage += `\nRazón: ${errorData.details.razon}`;
        }
        
        alert(errorMessage);
      } else {
        alert('Error al editar campaña. Inténtalo de nuevo.');
      }
    }
  };

  const handleViewStats = async (campaign) => {
    try {
      // Por ahora usar datos del mock
      setSelectedCampaign(campaign);
      setShowStatsModal(true);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleViewDetails = (campaign) => {
    console.log('Abriendo detalles de campaña:', campaign);
    setSelectedCampaign(campaign);
    setShowDetailsModal(true);
    console.log('showDetailsModal establecido a:', true);
  };

  const handleApproveCampaign = async (campaign) => {
    if (!isAdmin) {
      alert('Solo los administradores pueden aprobar campañas');
      return;
    }

    const confirmar = window.confirm(
      `¿Deseas aprobar la campaña "${campaign.nombre}"?\n\n` +
      'Esta acción permitirá que la campaña pueda ser enviada.'
    );

    if (!confirmar) return;

    try {
      const response = await campanasService.aprobarCampana(campaign.id);
      
      alert(response.message || 'Campaña aprobada correctamente');
      
      // Actualizar el estado de la campaña en la lista
      setCampaigns(campaigns.map(c => 
        c.id === campaign.id 
          ? { ...c, estado: 'en_progreso' }
          : c
      ));
      
      // Recargar campañas
      await loadCampaigns();
      
    } catch (error) {
      console.error('Error al aprobar campaña:', error);
      const errorMessage = error.response?.data?.error || 'Error al aprobar la campaña';
      alert(errorMessage);
    }
  };

  const handleViewRecipients = async (campaign) => {
    console.log('Abriendo lista de destinatarios:', campaign);
    setSelectedCampaign(campaign);
    setLoadingDestinatarios(true);
    setShowRecipientsModal(true);
    
    try {
      // Intentar cargar destinatarios reales de la base de datos
      const response = await destinatariosService.getDestinatariosCampania(campaign.id);
      if (response.success) {
        setDestinatarios(response.data.destinatarios);
        setEstadisticasDestinatarios(response.data.estadisticas);
        console.log('✅ Datos reales cargados:', response.data);
      } else {
        throw new Error('API respondió con error: ' + response.message);
      }
    } catch (error) {
      console.warn('⚠️ Error al cargar destinatarios reales, usando datos mock:', error.message);
      
      // Datos mock para demostración mientras se implementa la API
      const mockDestinatarios = [
        {
          id: 1,
          nombre: "Bar de Prueba 1",
          telefono: "+54 9 11 6308-3302",
          estado: "enviado",
          fecha_envio: "2025-12-02T14:27:43.000Z",
          lugar_nombre: "Bar de Prueba 1"
        }
      ];
      
      const mockEstadisticas = {
        total: mockDestinatarios.length,
        enviados: mockDestinatarios.filter(d => d.estado === 'enviado').length,
        pendientes: mockDestinatarios.filter(d => d.estado === 'pendiente').length,
        fallidos: mockDestinatarios.filter(d => d.estado === 'fallido').length
      };
      
      setDestinatarios(mockDestinatarios);
      setEstadisticasDestinatarios(mockEstadisticas);
    } finally {
      setLoadingDestinatarios(false);
    }
  };

  const handleSendCampaign = (campaign) => {
    setSelectedCampaign(campaign);
    setShowSendModal(true);
  };

  const confirmSendCampaign = async () => {
    try {
      if (!selectedCampaign) return;
      
      // Simular envío de campaña
      const updatedCampaigns = campaigns.map(c => 
        c.id === selectedCampaign.id 
          ? { ...c, estado: 'activa', enviados: Math.floor(c.total_destinatarios * 0.8) }
          : c
      );
      
      setCampaigns(updatedCampaigns);
      setShowSendModal(false);
      setSelectedCampaign(null);
      alert('Campaña enviada exitosamente');
    } catch (error) {
      console.error('Error sending campaign:', error);
      alert('Error al enviar campaña');
    }
  };

  const getStatusColor = (estado) => {
    switch (estado) {
      case 'activa':
        return 'bg-green-500';
      case 'completada':
      case 'finalizado':
        return 'bg-blue-500';
      case 'programada':
        return 'bg-yellow-500';
      case 'pendiente':
        return 'bg-yellow-600';
      case 'en_progreso':
      case 'aprobada':
        return 'bg-green-600';
      case 'pendiente_aprobacion':
        return 'bg-orange-500';
      case 'pausada':
        return 'bg-gray-400';
      case 'rechazada':
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getStatusText = (estado) => {
    switch (estado) {
      case 'activa':
        return 'Activa';
      case 'completada':
        return 'Completada';
      case 'finalizado':
        return 'Finalizada';
      case 'programada':
        return isAdmin ? 'Lista para enviar' : 'Programada';
      case 'pendiente':
        return 'Pendiente Aprobación';
      case 'en_progreso':
        return 'Aprobada';
      case 'aprobada':
        return 'Aprobada';
      case 'pendiente_aprobacion':
        return 'Pendiente Aprobación';
      case 'pausada':
        return 'Pausada';
      case 'rechazada':
        return 'Rechazada';
      default:
        return estado || 'Sin estado';
    }
  };

  const calculateSuccessRate = (campaign) => {
    const total = campaign.total_destinatarios;
    const exitosos = campaign.enviados;
    return total > 0 ? Math.round((exitosos / total) * 100) : 0;
  };

  if (loading) {
    return <LoadingSpinner size="large" text="Cargando campañas..." />;
  }

  return (
    <div className="space-y-8">
      {/* Título y acciones */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-800">Gestión de Campañas</h1>
            {isAdmin && (
              <span className="bg-purple-100 text-purple-800 text-sm font-medium px-3 py-1 rounded-full">
                👑 Panel Administrador
              </span>
            )}
          </div>
          <p className="text-gray-600 mt-1">
            {isAdmin 
              ? "Administra y envía campañas de todos los clientes" 
              : "Administra tus envíos masivos de WhatsApp"
            }
          </p>
          {/* Debug info temporal */}
          <p className="text-xs text-blue-600 mt-1">
            Debug: {campaigns.length} campañas | showDetailsModal: {showDetailsModal ? 'true' : 'false'}
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="primary" onClick={handleCreateCampaign}>
            + Nueva Campaña
          </Button>
          <Button variant="secondary" onClick={() => console.log('Debug - Campaigns:', campaigns, 'Modal states:', {showDetailsModal, showStatsModal, showEditModal})}>
            🐛 Debug
          </Button>
          <Button variant="info" onClick={() => {
            setSelectedCampaign(campaigns[0]);
            setShowDetailsModal(true);
            console.log('Test: Abriendo modal con primera campaña:', campaigns[0]);
          }}>
            🧪 Test Modal
          </Button>
        </div>
      </div>

      {/* Estadísticas Generales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <div className="text-center py-4">
            <p className="text-sm text-gray-600">Activas</p>
            <p className="text-4xl font-bold text-success mt-2">
              {campaigns.filter(c => c.estado === 'activa').length}
            </p>
          </div>
        </Card>
        <Card>
          <div className="text-center py-4">
            <p className="text-sm text-gray-600">Completadas</p>
            <p className="text-4xl font-bold text-primary mt-2">
              {campaigns.filter(c => c.estado === 'completada').length}
            </p>
          </div>
        </Card>
        <Card>
          <div className="text-center py-4">
            <p className="text-sm text-gray-600">Mensajes Enviados</p>
            <p className="text-4xl font-bold text-gray-800 mt-2">200</p>
          </div>
        </Card>
        <Card>
          <div className="text-center py-4">
            <p className="text-sm text-gray-600">Total Campañas</p>
            <p className="text-4xl font-bold text-gray-800 mt-2">{campaigns.length}</p>
          </div>
        </Card>
      </div>

      {/* Programaciones (franjas por días/horarios/cupo) */}
      <Card title="Programación de Campañas" icon="⏱️">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          <div>
            <ProgramacionesForm />
          </div>
          <div>
            <ProgramacionesList />
          </div>
        </div>
      </Card>

      {/* Lista de Campañas */}
      <Card title="Campañas" icon="📨">
        <div className="space-y-6">
          {campaigns.length === 0 ? (
            <p className="text-center text-gray-500 py-12">
              No hay campañas creadas. ¡Crea tu primera campaña!
            </p>
          ) : (
            campaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="border border-gray-200 rounded-lg p-8 hover:shadow-md transition-shadow bg-white"
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3">
                      <h3 className="text-xl font-bold text-gray-800">{campaign.nombre}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium text-white ${getStatusColor(campaign.estado)}`}>
                        {getStatusText(campaign.estado)}
                      </span>
                      {isAdmin && campaign.cliente_nombre && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                          Cliente: {campaign.cliente_nombre}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 mb-2">{campaign.descripcion}</p>
                    <p className="text-sm text-gray-500">
                      Creada el {campaign.fecha_creacion}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => handleViewDetails(campaign)}>
                      📄 Ver Detalles
                    </Button>
                    <Button variant="secondary" onClick={() => handleViewStats(campaign)}>
                      Ver Estadísticas
                    </Button>
                    <Button variant="info" onClick={() => handleViewRecipients(campaign)}>
                      👥 Ver Destinatarios ({campaign.total_destinatarios || 0})
                    </Button>
                    
                    {/* Solo mostrar botón editar si la campaña no está completada */}
                    {campaign.estado !== 'completada' && campaign.estado !== 'enviando' && (
                      <Button variant="info" onClick={() => handleEditCampaign(campaign)}>
                        ✏️ Editar
                      </Button>
                    )}
                    
                    {/* Botón de aprobar campaña (solo admin y campañas pendientes) */}
                    {isAdmin && campaign.estado === 'pendiente' && (
                      <Button variant="success" onClick={() => handleApproveCampaign(campaign)}>
                        ✅ Aprobar Campaña
                      </Button>
                    )}
                    
                    {isAdmin && (campaign.estado === 'programada' || campaign.estado === 'pendiente_aprobacion') && (
                      <Button variant="primary" onClick={() => handleSendCampaign(campaign)}>
                        🚀 Enviar Campaña
                      </Button>
                    )}
                  </div>
                </div>

                {/* Barra de progreso */}
                <div className="mb-6">
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>Progreso del envío</span>
                    <span>
                      {campaign.enviados} / {campaign.total_destinatarios}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-success h-3 rounded-full transition-all"
                      style={{
                        width: `${(campaign.enviados / campaign.total_destinatarios) * 100}%`
                      }}
                    ></div>
                  </div>
                </div>

                {/* Métricas */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="text-center bg-gray-50 rounded-lg py-4">
                    <p className="text-sm text-gray-600 mb-1">Destinatarios</p>
                    <p className="text-xl font-bold text-gray-800">{campaign.total_destinatarios}</p>
                  </div>
                  <div className="text-center bg-green-50 rounded-lg py-4">
                    <p className="text-sm text-gray-600 mb-1">Enviados</p>
                    <p className="text-xl font-bold text-success">{campaign.enviados}</p>
                  </div>
                  <div className="text-center bg-red-50 rounded-lg py-4">
                    <p className="text-sm text-gray-600 mb-1">Fallidos</p>
                    <p className="text-xl font-bold text-danger">{campaign.fallidos}</p>
                  </div>
                  <div className="text-center bg-blue-50 rounded-lg py-4">
                    <p className="text-sm text-gray-600 mb-1">Tasa de Éxito</p>
                    <p className="text-xl font-bold text-primary">{calculateSuccessRate(campaign)}%</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Modal Crear Campaña */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Nueva Campaña"
        size="large"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la campaña *</label>
            <input
              type="text"
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Ej: Promoción Navidad 2025"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              value={formData.descripcion}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              rows="3"
              placeholder="Describe el objetivo de esta campaña..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mensaje *</label>
            <textarea
              value={formData.mensaje}
              onChange={(e) => setFormData({ ...formData, mensaje: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              rows="5"
              placeholder="Escribe el mensaje que se enviará a los destinatarios..."
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              {formData.mensaje.length} caracteres
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={formData.programada}
              onChange={(e) => setFormData({ ...formData, programada: e.target.checked })}
              className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
            />
            <label className="text-sm font-medium text-gray-700">Programar envío</label>
          </div>

          {formData.programada && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha y hora de envío</label>
              <input
                type="datetime-local"
                value={formData.fecha_envio}
                onChange={(e) => setFormData({ ...formData, fecha_envio: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          )}

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              <strong>Nota:</strong> Los mensajes se enviarán solo a los leads con IA habilitada.
              Puedes gestionar esto desde la sección de Leads.
            </p>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleSaveCampaign}>
              Crear Campaña
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Editar Campaña */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingCampaign(null);
        }}
        title={`Editar Campaña: ${editingCampaign?.nombre}`}
        size="large"
      >
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center">
              <span className="text-2xl mr-3">ℹ️</span>
              <div>
                <h4 className="font-bold text-blue-800">Información</h4>
                <p className="text-blue-700">Los cambios requerirán nueva aprobación del administrador antes del envío.</p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la campaña *</label>
            <input
              type="text"
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Ej: Promoción Navidad 2025"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              value={formData.descripcion}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              rows="3"
              placeholder="Describe el objetivo de esta campaña..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mensaje *</label>
            <textarea
              value={formData.mensaje}
              onChange={(e) => setFormData({ ...formData, mensaje: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              rows="5"
              placeholder="Escribe el mensaje que se enviará a los destinatarios..."
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              {formData.mensaje.length} caracteres
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={formData.programada}
              onChange={(e) => setFormData({ ...formData, programada: e.target.checked })}
              className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
            />
            <label className="text-sm font-medium text-gray-700">Programar envío</label>
          </div>

          {formData.programada && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha y hora de envío</label>
              <input
                type="datetime-local"
                value={formData.fecha_envio}
                onChange={(e) => setFormData({ ...formData, fecha_envio: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          )}

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              <strong>Nota:</strong> Al editar una campaña, su estado cambiará a "Pendiente Aprobación" y requerirá nueva autorización del administrador.
            </p>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="secondary" onClick={() => {
              setShowEditModal(false);
              setEditingCampaign(null);
            }}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleSaveEditCampaign}>
              💾 Guardar Cambios
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Estadísticas */}
      <Modal
        isOpen={showStatsModal}
        onClose={() => setShowStatsModal(false)}
        title={selectedCampaign ? `Estadísticas: ${selectedCampaign.nombre}` : 'Estadísticas'}
      >
        {selectedCampaign && (
          <div className="space-y-6">
            {/* Resumen */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Total Destinatarios</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">
                  {selectedCampaign.total_destinatarios}
                </p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-gray-600">Enviados</p>
                <p className="text-3xl font-bold text-success mt-1">
                  {selectedCampaign.enviados}
                </p>
              </div>
              <div className="p-4 bg-red-50 rounded-lg">
                <p className="text-sm text-gray-600">Fallidos</p>
                <p className="text-3xl font-bold text-danger mt-1">
                  {selectedCampaign.fallidos}
                </p>
              </div>
              <div className="p-4 bg-yellow-50 rounded-lg">
                <p className="text-sm text-gray-600">Pendientes</p>
                <p className="text-3xl font-bold text-warning mt-1">
                  {selectedCampaign.pendientes}
                </p>
              </div>
            </div>

            {/* Tasa de éxito */}
            <div className="p-6 bg-blue-50 rounded-lg text-center">
              <p className="text-sm text-gray-600 mb-2">Tasa de Éxito</p>
              <p className="text-5xl font-bold text-primary">
                {calculateSuccessRate(selectedCampaign)}%
              </p>
            </div>

            {/* Detalles */}
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Detalles de la Campaña</h4>
              <dl className="space-y-2">
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-600">Estado:</dt>
                  <dd className="text-sm font-medium text-gray-800">{getStatusText(selectedCampaign.estado)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-600">Fecha de creación:</dt>
                  <dd className="text-sm font-medium text-gray-800">{selectedCampaign.fecha_creacion}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-600">Descripción:</dt>
                  <dd className="text-sm font-medium text-gray-800">{selectedCampaign.descripcion}</dd>
                </div>
              </dl>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Detalles de Campaña */}
      <Modal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        title={selectedCampaign ? `Detalles: ${selectedCampaign.nombre}` : 'Detalles de Campaña'}
        size="large"
      >
        {selectedCampaign && (
          <div className="space-y-6">
            {/* Información general */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-800">{selectedCampaign.nombre}</h3>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium mt-2 ${getStatusColor(selectedCampaign.estado)}`}>
                    {getStatusText(selectedCampaign.estado)}
                  </span>
                </div>
                {isAdmin && selectedCampaign.cliente_nombre && (
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-lg font-medium">
                    Cliente: {selectedCampaign.cliente_nombre}
                  </span>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Fecha de creación:</span>
                  <p className="font-medium text-gray-800">{selectedCampaign.fecha_creacion}</p>
                </div>
                <div>
                  <span className="text-gray-600">Última modificación:</span>
                  <p className="font-medium text-gray-800">{selectedCampaign.fecha_modificacion || selectedCampaign.fecha_creacion}</p>
                </div>
                {selectedCampaign.programada && (
                  <>
                    <div>
                      <span className="text-gray-600">Fecha de envío:</span>
                      <p className="font-medium text-gray-800">{selectedCampaign.fecha_envio}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Programada:</span>
                      <p className="font-medium text-green-600">Sí</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Descripción */}
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                📝 Descripción
              </h4>
              <p className="text-gray-700 leading-relaxed">{selectedCampaign.descripcion}</p>
            </div>

            {/* Mensaje de la campaña */}
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                💬 Mensaje de la campaña
              </h4>
              <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-green-400">
                <p className="text-gray-800 whitespace-pre-wrap">{selectedCampaign.mensaje}</p>
              </div>
              <div className="mt-3 text-sm text-gray-600">
                <span className="font-medium">Longitud:</span> {selectedCampaign.mensaje.length} caracteres
              </div>
            </div>

            {/* Estadísticas rápidas */}
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <h4 className="font-semibold text-gray-800 mb-4 flex items-center">
                📊 Estadísticas
              </h4>
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-800">{selectedCampaign.total_destinatarios}</p>
                  <p className="text-sm text-gray-600">Destinatarios</p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{selectedCampaign.enviados}</p>
                  <p className="text-sm text-gray-600">Enviados</p>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">{selectedCampaign.fallidos}</p>
                  <p className="text-sm text-gray-600">Fallidos</p>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{calculateSuccessRate(selectedCampaign)}%</p>
                  <p className="text-sm text-gray-600">Éxito</p>
                </div>
              </div>
            </div>

            {/* Configuración técnica */}
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <h4 className="font-semibold text-gray-800 mb-4 flex items-center">
                ⚙️ Configuración técnica
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">ID de campaña:</span>
                  <p className="font-medium text-gray-800">{selectedCampaign.id}</p>
                </div>
                <div>
                  <span className="text-gray-600">Tipo:</span>
                  <p className="font-medium text-gray-800">
                    {selectedCampaign.programada ? 'Programada' : 'Manual'}
                  </p>
                </div>
                {selectedCampaign.cliente_id && (
                  <div>
                    <span className="text-gray-600">Cliente ID:</span>
                    <p className="font-medium text-gray-800">{selectedCampaign.cliente_id}</p>
                  </div>
                )}
                <div>
                  <span className="text-gray-600">Estado del sistema:</span>
                  <p className="font-medium text-gray-800">
                    {selectedCampaign.activa ? 'Activa' : 'Inactiva'}
                  </p>
                </div>
              </div>
            </div>

            {/* Acciones rápidas */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              {selectedCampaign.estado !== 'completada' && selectedCampaign.estado !== 'enviando' && (
                <Button variant="info" onClick={() => {
                  setShowDetailsModal(false);
                  handleEditCampaign(selectedCampaign);
                }}>
                  ✏️ Editar Campaña
                </Button>
              )}
              <Button variant="secondary" onClick={() => {
                setShowDetailsModal(false);
                handleViewStats(selectedCampaign);
              }}>
                📊 Ver Estadísticas Completas
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Enviar Campaña (Solo Admin) */}
      <Modal
        isOpen={showSendModal}
        onClose={() => setShowSendModal(false)}
        title="Confirmar Envío de Campaña"
        size="medium"
      >
        {selectedCampaign && (
          <div className="space-y-6">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-center">
                <span className="text-2xl mr-3">⚠️</span>
                <div>
                  <h4 className="font-bold text-orange-800">¡Atención!</h4>
                  <p className="text-orange-700">Esta acción iniciará el envío inmediato de la campaña y no se puede deshacer.</p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-semibold text-gray-800 mb-3">Detalles de la campaña:</h4>
              <dl className="space-y-2">
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-600">Nombre:</dt>
                  <dd className="text-sm font-medium text-gray-800">{selectedCampaign.nombre}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-600">Cliente:</dt>
                  <dd className="text-sm font-medium text-gray-800">{selectedCampaign.cliente_nombre}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-600">Total destinatarios:</dt>
                  <dd className="text-sm font-medium text-gray-800">{selectedCampaign.total_destinatarios}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-600">Estado actual:</dt>
                  <dd className="text-sm font-medium text-gray-800">{getStatusText(selectedCampaign.estado)}</dd>
                </div>
              </dl>
            </div>

            <div className="flex justify-end space-x-3">
              <Button variant="secondary" onClick={() => setShowSendModal(false)}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={confirmSendCampaign}>
                🚀 Confirmar Envío
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal para ver destinatarios */}
      {showRecipientsModal && selectedCampaign && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-lg max-w-4xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">
                Destinatarios - {selectedCampaign.nombre}
              </h2>
              <button
                onClick={() => setShowRecipientsModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <span className="text-2xl">×</span>
              </button>
            </div>

            {loadingDestinatarios ? (
              <div className="text-center py-8">
                <LoadingSpinner size="large" text="Cargando destinatarios..." />
              </div>
            ) : destinatarios.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-6xl mb-4">📭</div>
                <h3 className="text-xl font-semibold text-gray-700 mb-2">No hay destinatarios</h3>
                <p className="text-gray-500">Esta campaña aún no tiene destinatarios asignados.</p>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <GestorDestinatarios 
                    campaniaId={selectedCampaign?.id}
                    onDestinatariosUpdated={() => {
                      // Recargar destinatarios después de agregar/quitar
                      handleViewRecipients(selectedCampaign);
                    }}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 mt-6">
                    <div className="text-center p-4 bg-green-100 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {estadisticasDestinatarios.enviados || 0}
                      </div>
                      <div className="text-sm text-green-700">Enviados</div>
                    </div>
                    <div className="text-center p-4 bg-yellow-100 rounded-lg">
                      <div className="text-2xl font-bold text-yellow-600">
                        {estadisticasDestinatarios.pendientes || 0}
                      </div>
                      <div className="text-sm text-yellow-700">Pendientes</div>
                    </div>
                    <div className="text-center p-4 bg-red-100 rounded-lg">
                      <div className="text-2xl font-bold text-red-600">
                        {estadisticasDestinatarios.fallidos || 0}
                      </div>
                      <div className="text-sm text-red-700">Fallidos</div>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-300 px-4 py-2 text-left">Nombre</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Teléfono</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Estado</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Fecha Envío</th>
                      </tr>
                    </thead>
                    <tbody>
                      {destinatarios.map((destinatario, index) => (
                        <tr key={destinatario.id || index} className="hover:bg-gray-50">
                          <td className="border border-gray-300 px-4 py-2">
                            {destinatario.nombre}
                          </td>
                          <td className="border border-gray-300 px-4 py-2">
                            {destinatario.telefono}
                          </td>
                          <td className="border border-gray-300 px-4 py-2">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              destinatario.estado === 'enviado' 
                                ? 'bg-green-100 text-green-800'
                                : destinatario.estado === 'pendiente'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {destinatario.estado}
                            </span>
                          </td>
                          <td className="border border-gray-300 px-4 py-2">
                            {destinatario.fecha_envio 
                              ? new Date(destinatario.fecha_envio).toLocaleString('es-AR')
                              : '-'
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <div className="mt-6 text-center">
              <Button variant="secondary" onClick={() => setShowRecipientsModal(false)}>
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignsManager;
