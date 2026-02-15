import React, { useState, useEffect, useCallback } from 'react';
import { Users, Phone, ChevronLeft } from 'lucide-react';
import Button from '../common/Button';
import LoadingSpinner from '../common/LoadingSpinner';
import { leadsAPI, senderAPI } from '../../services/api';
import { destinatariosService } from '../../services/destinatarios';
import { useNavigate } from 'react-router-dom';

const AgregarProspectosACampaniaPage = () => {
  console.log('🔍 [DIAGNOSTIC 1] ====== COMPONENTE MONTADO ======');
  console.log('🔍 [DIAGNOSTIC 1] Timestamp:', new Date().toISOString());
  console.log('🔍 [DIAGNOSTIC 1] leadsAPI disponible:', !!leadsAPI);
  console.log('🔍 [DIAGNOSTIC 1] senderAPI disponible:', !!senderAPI);
  console.log('🔍 [DIAGNOSTIC 1] leadsAPI.getProspectos:', typeof leadsAPI?.getProspectos);
  console.log('🔍 [DIAGNOSTIC 1] senderAPI.getCampaigns:', typeof senderAPI?.getCampaigns);
  
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [prospectos, setProspectos] = useState([]);
  const [selectedProspectos, setSelectedProspectos] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [agregandoDestinatarios, setAgregandoDestinatarios] = useState(false);

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
        return 'No incluido';
    }
  };

  useEffect(() => {
    console.log('🔍 [DIAGNOSTIC 2] ====== useEffect CAMPAIGNS EJECUTADO ======');
    
    const cargarCampaigns = async () => {
      try {
        console.log('🔍 [DIAGNOSTIC 3] Llamando senderAPI.getCampaigns()...');
        const response = await senderAPI.getCampaigns();
        
        console.log('🔍 [DIAGNOSTIC 4] Response completa:', response);
        console.log('🔍 [DIAGNOSTIC 4] response.data:', response.data);
        console.log('🔍 [DIAGNOSTIC 4] Tipo de response.data:', typeof response.data);
        console.log('🔍 [DIAGNOSTIC 4] Es Array?', Array.isArray(response.data));
        console.log('🔍 [DIAGNOSTIC 4] response.data.data existe?', response.data?.data);
        console.log('🔍 [DIAGNOSTIC 4] Estructura completa:', JSON.stringify(response.data, null, 2));
        
        setCampaigns(response.data || []);
        console.log('🔍 [DIAGNOSTIC 5] setCampaigns ejecutado con:', response.data?.length || 0, 'campañas');
        
        if (response.data && response.data.length > 0) {
          console.log('🔍 [DIAGNOSTIC 6] Primera campaña:', response.data[0]);
          console.log('🔍 [DIAGNOSTIC 6] ID de primera campaña:', response.data[0].id);
          const idString = response.data[0].id.toString();
          console.log('🔍 [DIAGNOSTIC 6] ID como string:', idString);
          setSelectedCampaign(idString);
          console.log('🔍 [DIAGNOSTIC 7] ✅ setSelectedCampaign ejecutado con valor:', idString);
        } else {
          console.warn('⚠️ [DIAGNOSTIC 6] NO hay campañas en response.data');
          console.warn('⚠️ [DIAGNOSTIC 6] response.data:', response.data);
        }
      } catch (error) {
        console.error('❌ [DIAGNOSTIC 8] ERROR cargando campañas:', error);
        console.error('❌ [DIAGNOSTIC 8] Error.message:', error.message);
        console.error('❌ [DIAGNOSTIC 8] Error.response:', error.response);
        console.error('❌ [DIAGNOSTIC 8] Error.response.data:', error.response?.data);
      }
    };
    cargarCampaigns();
  }, []);

  const cargarProspectos = useCallback(async () => {
    console.log('🔍 [DIAGNOSTIC 9] ====== cargarProspectos() LLAMADO ======');
    console.log('🔍 [DIAGNOSTIC 9] selectedCampaign actual:', selectedCampaign);
    console.log('🔍 [DIAGNOSTIC 9] Tipo:', typeof selectedCampaign);
    console.log('🔍 [DIAGNOSTIC 9] Es falsy?', !selectedCampaign);
    console.log('🔍 [DIAGNOSTIC 9] Longitud:', selectedCampaign?.length);
    
    if (!selectedCampaign) {
      console.warn('⚠️ [DIAGNOSTIC 10] RETURN EARLY: selectedCampaign está vacío');
      setProspectos([]);
      return;
    }
    
    console.log('✅ [DIAGNOSTIC 10] selectedCampaign válido, continuando...');
    
    console.log('🔍 [DIAGNOSTIC 11] Iniciando carga de prospectos...');
    setLoading(true);
    
    try {
      const params = {
        campania_id: selectedCampaign
      };
      
      console.log('🔍 [DIAGNOSTIC 12] Params para API:', params);
      console.log('🔍 [DIAGNOSTIC 12] leadsAPI existe?', !!leadsAPI);
      console.log('🔍 [DIAGNOSTIC 12] leadsAPI.getProspectos existe?', typeof leadsAPI.getProspectos);
      console.log('🔍 [DIAGNOSTIC 13] Ejecutando leadsAPI.getProspectos()...');
      
      const response = await leadsAPI.getProspectos(params);
      
      console.log('🔍 [DIAGNOSTIC 14] Response de prospectos recibida');
      console.log('🔍 [DIAGNOSTIC 14] response:', response);
      console.log('🔍 [DIAGNOSTIC 14] response.data:', response.data);
      console.log('🔍 [DIAGNOSTIC 14] response.data.data:', response.data?.data);
      console.log('🔍 [DIAGNOSTIC 14] Cantidad:', response.data?.data?.length || 0);
      console.log('🔍 [DIAGNOSTIC 14] Estructura:', JSON.stringify(response.data, null, 2));
      const prospectosData = response.data?.data || [];
      console.log('🔍 [DIAGNOSTIC 15] Seteando prospectos:', prospectosData.length, 'items');
      setProspectos(prospectosData);
      console.log('✅ [DIAGNOSTIC 15] setProspectos ejecutado');
    } catch (error) {
      console.error('❌ [DIAGNOSTIC 16] ERROR cargando prospectos:', error);
      console.error('❌ [DIAGNOSTIC 16] Error.message:', error.message);
      console.error('❌ [DIAGNOSTIC 16] Error.response:', error.response);
      console.error('❌ [DIAGNOSTIC 16] Error.response.data:', error.response?.data);
      setProspectos([]);
    } finally {
      setLoading(false);
      console.log('🔍 [DIAGNOSTIC 17] cargarProspectos() FINALIZADO');
    }
  }, [selectedCampaign]);

  useEffect(() => {
    console.log('🔍 [DIAGNOSTIC 18] ====== useEffect PROSPECTOS EJECUTADO ======');
    console.log('🔍 [DIAGNOSTIC 18] selectedCampaign cambió a:', selectedCampaign);
    cargarProspectos();
  }, [cargarProspectos]);

  const toggleProspecto = (prospecto) => {
    setSelectedProspectos(prev => {
      const exists = prev.find(p => p.prospecto_id === prospecto.prospecto_id);
      if (exists) {
        return prev.filter(p => p.prospecto_id !== prospecto.prospecto_id);
      } else {
        return [...prev, prospecto];
      }
    });
  };

  const toggleSelectAll = () => {
    const todosSeleccionados = prospectos.every(p => 
      selectedProspectos.find(sp => sp.prospecto_id === p.prospecto_id)
    );
    
    if (todosSeleccionados) {
      setSelectedProspectos([]);
    } else {
      setSelectedProspectos(prospectos);
    }
  };

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
      const destinatarios = selectedProspectos.map(prospecto => ({
        nombre: prospecto.nombre,
        telefono: prospecto.telefono_wapp,
        lugar_id: prospecto.prospecto_id
      }));

      const response = await destinatariosService.agregarDestinatarios(selectedCampaign, destinatarios);
      
      if (response.success) {
        alert(`✅ ${response.data.agregados} destinatarios agregados exitosamente a la campaña`);
        setSelectedProspectos([]);
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
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
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="p-4 border-b bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <input
                  type="checkbox"
                  checked={prospectos.length > 0 && prospectos.every(p => 
                    selectedProspectos.find(sp => sp.prospecto_id === p.prospecto_id)
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
                  No hay prospectos asociados a esta campaña
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
                    const isSelected = selectedProspectos.find(p => p.prospecto_id === prospecto.prospecto_id);
                    return (
                      <tr 
                        key={prospecto.prospecto_id} 
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
                          <div className="flex items-center">
                            <Phone className="h-4 w-4 text-gray-400 mr-2" />
                            <span className="text-sm text-gray-900">
                              {prospecto.telefono_wapp}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                            prospecto.estado_campania === 'enviado' ? 'bg-green-100 text-green-800' :
                            prospecto.estado_campania === 'pendiente' ? 'bg-yellow-100 text-yellow-800' :
                            prospecto.estado_campania === 'error' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                          {traducirEstado(prospecto.estado_campania)}
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

export default AgregarProspectosACampaniaPage;