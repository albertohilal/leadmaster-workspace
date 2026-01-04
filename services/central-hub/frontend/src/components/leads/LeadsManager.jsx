import React, { useState, useEffect } from 'react';
import Card from '../common/Card';
import Button from '../common/Button';
import LoadingSpinner from '../common/LoadingSpinner';
import Modal from '../common/Modal';
import { leadsAPI, listenerAPI } from '../../services/api';

const LeadsManager = () => {
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState([]);
  const [filteredLeads, setFilteredLeads] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterIA, setFilterIA] = useState('all'); // all, enabled, disabled
  const [filterTipoCliente, setFilterTipoCliente] = useState('all'); // all, 0, 1, 2, 3
  const [filterOrigen, setFilterOrigen] = useState('all'); // all, originales, scraping
  const [selectedLead, setSelectedLead] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    telefono: '',
    email: '',
    empresa: '',
    ia_habilitada: false
  });

  useEffect(() => {
    loadLeads();
  }, []);

  useEffect(() => {
    filterLeads();
  }, [leads, searchQuery, filterIA, filterTipoCliente, filterOrigen]);

  const loadLeads = async () => {
    try {
      setLoading(true);
      
      // Usar API real para obtener leads del cliente autenticado
      const response = await leadsAPI.getAll();
      
      if (response.data && response.data.success) {
        const leadsData = response.data.data || [];
        setLeads(leadsData);
        setFilteredLeads(leadsData);
        console.log(`Cargados ${leadsData.length} leads para cliente ${response.data.cliente_id}`);
      } else {
        console.error('Error en respuesta de API:', response);
        setLeads([]);
        setFilteredLeads([]);
      }
      
    } catch (error) {
      console.error('Error loading leads:', error);
      
      // Fallback a datos mock si hay error de conexión
      if (error.message.includes('Network') || error.message.includes('fetch')) {
        console.log('Usando datos mock por error de conexión');
        const mockLeads = [
          {
            rowid: 1217,
            nom: 'Mi Santa Guadalupe Masajes',
            telephone: '+5491112345678',
            email: 'guadalupe@masajes.com',
            address: null,
            client: 1,
            ia_habilitada: true,
            fecha_creacion: '2025-12-01',
            tipo_cliente: 'Cliente',
            origen: 'Originales'
          },
          {
            rowid: 21,
            nom: 'Nicolas Tileres',
            telephone: '+5491198765432', 
            email: 'nicolas@linkedin.com',
            address: 'https://www.linkedin.com/...',
            client: 0,
            ia_habilitada: false,
            fecha_creacion: '2025-12-05',
            tipo_cliente: 'Lead',
            origen: 'Scraping'
          }
        ];
        setLeads(mockLeads);
        setFilteredLeads(mockLeads);
      } else {
        setLeads([]);
        setFilteredLeads([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const getTipoClienteIcon = (client) => {
    switch (client) {
      case 0: return '🔍'; // Lead
      case 1: return '👑'; // Cliente (Originales)
      case 2: return '💬'; // Prospecto
      case 3: return '🏭'; // Proveedor
      default: return '❓';
    }
  };

  const getTipoClienteColor = (client) => {
    switch (client) {
      case 0: return 'bg-gray-100 text-gray-700'; // Lead
      case 1: return 'bg-blue-100 text-blue-700'; // Cliente
      case 2: return 'bg-yellow-100 text-yellow-700'; // Prospecto 
      case 3: return 'bg-green-100 text-green-700'; // Proveedor
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getOrigenBadge = (client) => {
    if (client === 1) {
      return <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">Originales</span>;
    } else if (client === 0) {
      return <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">Scraping</span>;
    } else {
      return <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">Otros</span>;
    }
  };

  const filterLeads = async () => {
    try {
      // Si hay filtros activos, usar API de filtrado
      if (searchQuery || filterTipoCliente !== 'all' || filterOrigen !== 'all' || filterIA !== 'all') {
        const filters = {};
        
        // Preparar filtros para la API
        if (searchQuery) filters.search = searchQuery;
        if (filterTipoCliente !== 'all') filters.tipo_cliente = filterTipoCliente;
        if (filterOrigen !== 'all') filters.origen = filterOrigen;
        if (filterIA !== 'all') filters.ia_status = filterIA;
        
        const response = await leadsAPI.getFiltered(filters);
        
        if (response.data && response.data.success) {
          let filtered = response.data.data || [];
          
          // Filtrar por IA localmente (ya que la API no lo maneja aún)
          if (filterIA === 'enabled') {
            filtered = filtered.filter(lead => lead.ia_habilitada);
          } else if (filterIA === 'disabled') {
            filtered = filtered.filter(lead => !lead.ia_habilitada);
          }
          
          setFilteredLeads(filtered);
        } else {
          // Fallback a filtrado local
          filterLeadsLocal();
        }
      } else {
        // Sin filtros, mostrar todos
        setFilteredLeads(leads);
      }
    } catch (error) {
      console.error('Error filtering leads:', error);
      // Fallback a filtrado local
      filterLeadsLocal();
    }
  };

  // Función de filtrado local como fallback
  const filterLeadsLocal = () => {
    let filtered = [...leads];

    // Filtrar por búsqueda
    if (searchQuery) {
      filtered = filtered.filter(lead => 
        lead.nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.telephone.includes(searchQuery) ||
        (lead.email && lead.email.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Filtrar por IA
    if (filterIA === 'enabled') {
      filtered = filtered.filter(lead => lead.ia_habilitada);
    } else if (filterIA === 'disabled') {
      filtered = filtered.filter(lead => !lead.ia_habilitada);
    }

    // Filtrar por tipo de cliente
    if (filterTipoCliente !== 'all') {
      filtered = filtered.filter(lead => lead.client.toString() === filterTipoCliente);
    }

    // Filtrar por origen
    if (filterOrigen === 'originales') {
      filtered = filtered.filter(lead => lead.client === 1);
    } else if (filterOrigen === 'scraping') {
      filtered = filtered.filter(lead => lead.client === 0);
    }

    setFilteredLeads(filtered);
  };

  const handleToggleIA = async (lead) => {
    try {
      if (lead.ia_habilitada) {
        await listenerAPI.disableIA(lead.telefono);
      } else {
        await listenerAPI.enableIA(lead.telefono);
      }
      
      // Actualizar estado local
      setLeads(leads.map(l => 
        l.id === lead.id ? { ...l, ia_habilitada: !l.ia_habilitada } : l
      ));
      
      alert(`IA ${lead.ia_habilitada ? 'deshabilitada' : 'habilitada'} para ${lead.nombre}`);
    } catch (error) {
      console.error('Error toggling IA:', error);
      alert('Error al cambiar estado de IA');
    }
  };

  const handleViewDetail = (lead) => {
    setSelectedLead(lead);
    setShowDetailModal(true);
  };

  const handleEdit = (lead) => {
    setFormData(lead);
    setShowFormModal(true);
  };

  const handleCreateNew = () => {
    setFormData({
      nombre: '',
      telefono: '',
      email: '',
      empresa: '',
      ia_habilitada: false
    });
    setShowFormModal(true);
  };

  const handleSaveForm = async () => {
    try {
      if (formData.id) {
        // Actualizar
        await leadsAPI.update(formData.id, formData);
        setLeads(leads.map(l => l.id === formData.id ? formData : l));
      } else {
        // Crear nuevo
        const response = await leadsAPI.create(formData);
        setLeads([...leads, { ...formData, id: response.data.id }]);
      }
      
      setShowFormModal(false);
      alert('Lead guardado exitosamente');
    } catch (error) {
      console.error('Error saving lead:', error);
      alert('Error al guardar lead');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Estás seguro de eliminar este lead?')) return;
    
    try {
      await leadsAPI.delete(id);
      setLeads(leads.filter(l => l.id !== id));
      alert('Lead eliminado exitosamente');
    } catch (error) {
      console.error('Error deleting lead:', error);
      alert('Error al eliminar lead');
    }
  };

  if (loading) {
    return <LoadingSpinner size="large" text="Cargando leads..." />;
  }

  return (
    <div className="space-y-6">
      {/* Título y acciones */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Gestión de Leads</h1>
          <p className="text-gray-600 mt-1">Administra tus leads y clientes</p>
        </div>
        <Button variant="primary" onClick={handleCreateNew}>
          + Nuevo Lead
        </Button>
      </div>

      {/* Filtros y búsqueda */}
      <Card>
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Buscar por nombre, teléfono o email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={filterIA}
                onChange={(e) => setFilterIA(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="all">Todos (IA)</option>
                <option value="enabled">Con IA</option>
                <option value="disabled">Sin IA</option>
              </select>
            </div>
          </div>
          
          {/* Nueva fila de filtros de segmentación */}
          <div className="flex flex-col md:flex-row gap-4 pt-2 border-t border-gray-200">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">Tipo de Cliente</label>
              <select
                value={filterTipoCliente}
                onChange={(e) => setFilterTipoCliente(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="all">Todos los tipos</option>
                <option value="0">🔍 Leads</option>
                <option value="1">👑 Clientes</option>
                <option value="2">💬 Prospectos</option>
                <option value="3">🏭 Proveedores</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">Origen</label>
              <select
                value={filterOrigen}
                onChange={(e) => setFilterOrigen(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="all">Todos los orígenes</option>
                <option value="originales">👑 Originales</option>
                <option value="scraping">🔍 Scraping</option>
              </select>
            </div>
          </div>
        </div>
        <div className="mt-4 text-sm text-gray-600">
          Mostrando {filteredLeads.length} de {leads.length} leads
        </div>
      </Card>

      {/* Tabla de Leads */}
      <Card title="Lista de Leads" icon="👥">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Teléfono</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Origen</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IA</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                    No se encontraron leads
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => (
                  <tr key={lead.rowid} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">
                      <div>
                        <div className="font-medium text-gray-800">{lead.nom}</div>
                        {lead.email && (
                          <div className="text-xs text-gray-500">{lead.email}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{lead.telephone}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        getTipoClienteColor(lead.client)
                      }`}>
                        {getTipoClienteIcon(lead.client)} {lead.tipo_cliente}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {getOrigenBadge(lead.client)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={() => handleToggleIA(lead)}
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          lead.ia_habilitada
                            ? 'bg-success text-white'
                            : 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        {lead.ia_habilitada ? '✓ Activa' : 'Inactiva'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleViewDetail(lead)}
                          className="text-primary hover:text-blue-700"
                        >
                          Ver
                        </button>
                        <button
                          onClick={() => handleEdit(lead)}
                          className="text-warning hover:text-yellow-700"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(lead.rowid)}
                          className="text-danger hover:text-red-700"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal Detalle */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="Detalle del Lead"
      >
        {selectedLead && (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600">Nombre</p>
              <p className="text-lg font-medium text-gray-800">{selectedLead.nom}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Teléfono</p>
              <p className="text-lg font-medium text-gray-800">{selectedLead.telephone}</p>
            </div>
            {selectedLead.email && (
              <div>
                <p className="text-sm text-gray-600">Email</p>
                <p className="text-lg font-medium text-gray-800">{selectedLead.email}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-gray-600">Tipo de Cliente</p>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                getTipoClienteColor(selectedLead.client)
              }`}>
                {getTipoClienteIcon(selectedLead.client)} {selectedLead.tipo_cliente}
              </span>
            </div>
            <div>
              <p className="text-sm text-gray-600">Origen</p>
              <div className="mt-1">
                {getOrigenBadge(selectedLead.client)}
              </div>
            </div>
            {selectedLead.address && (
              <div>
                <p className="text-sm text-gray-600">Dirección/URL</p>
                <p className="text-sm font-medium text-gray-800 break-all">{selectedLead.address}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-gray-600">IA Habilitada</p>
              <p className="text-lg font-medium text-gray-800">
                {selectedLead.ia_habilitada ? '✅ Sí' : '❌ No'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Fecha de creación</p>
              <p className="text-lg font-medium text-gray-800">{selectedLead.fecha_creacion}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">ID</p>
              <p className="text-sm font-mono text-gray-600">{selectedLead.rowid}</p>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Formulario */}
      <Modal
        isOpen={showFormModal}
        onClose={() => setShowFormModal(false)}
        title={formData.id ? 'Editar Lead' : 'Nuevo Lead'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input
              type="text"
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono *</label>
            <input
              type="tel"
              value={formData.telefono}
              onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="+54911..."
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Empresa</label>
            <input
              type="text"
              value={formData.empresa}
              onChange={(e) => setFormData({ ...formData, empresa: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={formData.ia_habilitada}
              onChange={(e) => setFormData({ ...formData, ia_habilitada: e.target.checked })}
              className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
            />
            <label className="text-sm font-medium text-gray-700">Habilitar IA</label>
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="secondary" onClick={() => setShowFormModal(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleSaveForm}>
              Guardar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default LeadsManager;
