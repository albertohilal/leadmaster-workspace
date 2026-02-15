import React, { useState } from 'react';
import { Plus, Trash2, Upload, Download, Users, Phone, User, Search, MessageCircle } from 'lucide-react';
import destinatariosService from '../../services/destinatarios';
import enviosService from '../../services/envios';
import SelectorProspectos from '../leads/SelectorProspectos';

const GestorDestinatarios = ({ campaniaId, onDestinatariosUpdated }) => {
  const [activeTab, setActiveTab] = useState('manual');
  const [showAgregarForm, setShowAgregarForm] = useState(false);
  const [showQuitarForm, setShowQuitarForm] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Estados para agregar destinatarios
  const [nuevosDestinatarios, setNuevosDestinatarios] = useState([
    { telefono: '', nombre: '' }
  ]);
  
  // Estados para quitar destinatarios
  const [telefonosAQuitar, setTelefonosAQuitar] = useState('');

  // TAREA 4: Estados para envío manual (flujo 2 fases)
  const [showModalConfirmarEnvio, setShowModalConfirmarEnvio] = useState(false);
  const [datosEnvioPreparado, setDatosEnvioPreparado] = useState(null);
  const [loadingButtons, setLoadingButtons] = useState({});

  // Agregar fila para nuevo destinatario
  const agregarFilaDestinatario = () => {
    setNuevosDestinatarios([...nuevosDestinatarios, { telefono: '', nombre: '' }]);
  };

  // Quitar fila de destinatario
  const quitarFilaDestinatario = (index) => {
    const nuevaLista = nuevosDestinatarios.filter((_, i) => i !== index);
    setNuevosDestinatarios(nuevaLista.length > 0 ? nuevaLista : [{ telefono: '', nombre: '' }]);
  };

  // Actualizar destinatario en fila específica
  const actualizarDestinatario = (index, campo, valor) => {
    const nuevaLista = [...nuevosDestinatarios];
    nuevaLista[index][campo] = valor;
    setNuevosDestinatarios(nuevaLista);
  };

  // Procesar agregar destinatarios
  const procesarAgregarDestinatarios = async () => {
    setLoading(true);
    try {
      // Filtrar destinatarios válidos
      const destinatariosValidos = nuevosDestinatarios.filter(
        dest => dest.telefono.trim() && dest.nombre.trim()
      );

      if (destinatariosValidos.length === 0) {
        alert('Por favor, ingresa al menos un destinatario válido');
        return;
      }

      const response = await destinatariosService.agregarDestinatarios(campaniaId, destinatariosValidos);
      
      if (response.success) {
        alert(`✅ Agregados: ${response.data.agregados} | Duplicados: ${response.data.duplicados}`);
        setNuevosDestinatarios([{ telefono: '', nombre: '' }]);
        setShowAgregarForm(false);
        if (onDestinatariosUpdated) onDestinatariosUpdated();
      }
    } catch (error) {
      alert('Error al agregar destinatarios: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  // Procesar quitar destinatarios
  const procesarQuitarDestinatarios = async () => {
    setLoading(true);
    try {
      // Convertir string de teléfonos a array
      const telefonos = telefonosAQuitar
        .split('\n')
        .map(tel => tel.trim())
        .filter(tel => tel);

      if (telefonos.length === 0) {
        alert('Por favor, ingresa al menos un teléfono');
        return;
      }

      const response = await destinatariosService.quitarDestinatarios(campaniaId, telefonos);
      
      if (response.success) {
        alert(`✅ Eliminados: ${response.data.eliminados} | No eliminados: ${response.data.noEliminados}`);
        setTelefonosAQuitar('');
        setShowQuitarForm(false);
        if (onDestinatariosUpdated) onDestinatariosUpdated();
      }
    } catch (error) {
      alert('Error al quitar destinatarios: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  // Procesar archivo CSV
  const procesarArchivoCSV = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const csv = e.target.result;
      const lines = csv.split('\n');
      const destinatarios = [];

      lines.forEach((line, index) => {
        if (index === 0) return; // Saltar header
        const [telefono, nombre] = line.split(',').map(col => col.trim());
        if (telefono && nombre) {
          destinatarios.push({ telefono, nombre });
        }
      });

      setNuevosDestinatarios(destinatarios);
    };
    reader.readAsText(file);
  };

  // =====================================================
  // TAREA 4: FLUJO DE ENVÍO MANUAL (2 FASES)
  // =====================================================

  /**
   * FASE 1: Preparar envío
   * - Llama a GET /api/envios/:id/manual/prepare
   * - Obtiene mensaje renderizado y teléfono normalizado
   * - Abre modal de confirmación
   */
  const handlePrepararEnvioManual = async (destinatario) => {
    setLoadingButtons(prev => ({ ...prev, [destinatario.id]: true }));
    try {
      const response = await enviosService.prepareManual(destinatario.id);
      
      if (response.success) {
        // Guardar datos preparados para la fase 2
        setDatosEnvioPreparado(response.data);
        setShowModalConfirmarEnvio(true);
      }
    } catch (error) {
      alert('Error al preparar envío: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoadingButtons(prev => ({ ...prev, [destinatario.id]: false }));
    }
  };

  /**
   * FASE 2: Abrir WhatsApp y confirmar envío
   * - Abre WhatsApp Web con mensaje personalizado
   * - Usuario envía manualmente
   * - Al confirmar, llama a POST /api/envios/:id/manual/confirm
   * - Cambia estado a 'enviado' con auditoría completa
   */
  const handleConfirmarEnvioManual = async () => {
    if (!datosEnvioPreparado) return;

    try {
      // Abrir WhatsApp Web con mensaje personalizado
      const urlWhatsApp = `https://web.whatsapp.com/send?phone=${datosEnvioPreparado.telefono}&text=${encodeURIComponent(datosEnvioPreparado.mensaje_final)}`;
      window.open(urlWhatsApp, '_blank');

      // Cerrar modal temporalmente para que el usuario pueda enviar
      setShowModalConfirmarEnvio(false);

      // Confirmar si el usuario envió el mensaje
      setTimeout(() => {
        const confirmado = window.confirm('¿Ya enviaste el mensaje por WhatsApp? Presiona OK para confirmar.');
        
        if (confirmado) {
          confirmarEstadoEnviado();
        } else {
          alert('El envío fue cancelado. El estado permanece como pendiente.');
          setDatosEnvioPreparado(null);
        }
      }, 2000); // Dar tiempo para que abra WhatsApp

    } catch (error) {
      alert('Error al abrir WhatsApp: ' + error.message);
      setDatosEnvioPreparado(null);
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
        if (onDestinatariosUpdated) onDestinatariosUpdated();
      }
    } catch (error) {
      alert('Error al confirmar envío: ' + (error.response?.data?.message || error.message));
    }
  };

  // Renderizar destinatarios con acciones
  const renderizarDestinatarios = (destinatarios) => (
    <table className="w-full text-left border-collapse">
      <thead>
        <tr>
          <th className="border-b py-2">Nombre</th>
          <th className="border-b py-2">Teléfono</th>
          <th className="border-b py-2">Estado</th>
          <th className="border-b py-2">Acciones</th>
        </tr>
      </thead>
      <tbody>
        {destinatarios.map((destinatario) => (
          <tr key={destinatario.id}>
            <td className="border-b py-2">{destinatario.nombre}</td>
            <td className="border-b py-2">{destinatario.telefono}</td>
            <td className="border-b py-2">{destinatario.estado}</td>
            <td className="border-b py-2">
              {destinatario.estado === 'pendiente' && (
                <button
                  onClick={() => handlePrepararEnvioManual(destinatario)}
                  disabled={loadingButtons[destinatario.id]}
                  className={`flex items-center px-4 py-2 rounded-lg text-white transition-colors ${
                    loadingButtons[destinatario.id]
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  {loadingButtons[destinatario.id] ? 'Preparando...' : 'Enviar por WhatsApp'}
                </button>
              )}
              {destinatario.estado === 'enviado' && (
                <span className="text-green-600 font-medium">✓ Enviado</span>
              )}
              {destinatario.estado === 'error' && (
                <span className="text-red-600 font-medium">✗ Error</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center">
          <Users className="w-5 h-5 mr-2 text-blue-600" />
          Gestionar Destinatarios
        </h3>
        
        <div className="flex gap-2">
          <button
            onClick={() => setShowQuitarForm(true)}
            className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Quitar
          </button>
        </div>
      </div>

      {/* Sistema de Pestañas */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('manual')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'manual'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <User className="w-4 h-4 inline mr-2" />
              Agregar Manual
            </button>
            <button
              onClick={() => setActiveTab('prospectos')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'prospectos'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Search className="w-4 h-4 inline mr-2" />
              Seleccionar Prospectos
            </button>
            <button
              onClick={() => setActiveTab('csv')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'csv'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Upload className="w-4 h-4 inline mr-2" />
              Importar CSV
            </button>
          </nav>
        </div>
      </div>

      {/* Contenido de Pestañas */}
      {activeTab === 'manual' && (
        <div>
          <button
            onClick={() => setShowAgregarForm(true)}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors mb-4"
          >
            <Plus className="w-4 h-4 mr-2" />
            Agregar Destinatarios Manualmente
          </button>
        </div>
      )}

      {activeTab === 'prospectos' && (
        <SelectorProspectos 
          campaniaId={campaniaId} 
          onDestinatariosAgregados={onDestinatariosUpdated}
        />
      )}

      {activeTab === 'csv' && (
        <div>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">
              Importar destinatarios desde CSV
            </h4>
            <p className="text-gray-500 mb-4">
              Formato: telefono,nombre (una línea por destinatario)
            </p>
            <input
              type="file"
              accept=".csv"
              onChange={manejarImportacionCSV}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
        </div>
      )}

      {/* Modal para agregar destinatarios */}
      {showAgregarForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-lg font-semibold">Agregar Destinatarios</h4>
              <button
                onClick={() => setShowAgregarForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            {/* Opción de cargar CSV */}
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <label className="block text-sm font-medium mb-2">
                <Upload className="w-4 h-4 inline mr-2" />
                Cargar desde archivo CSV
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={procesarArchivoCSV}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              <p className="text-xs text-gray-500 mt-1">
                Formato: telefono,nombre (primera fila será ignorada)
              </p>
            </div>

            {/* Formulario manual */}
            <div className="space-y-3">
              {nuevosDestinatarios.map((dest, index) => (
                <div key={index} className="flex gap-3 items-center">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Teléfono (ej: 5491168777888)"
                      value={dest.telefono}
                      onChange={(e) => actualizarDestinatario(index, 'telefono', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Nombre completo"
                      value={dest.nombre}
                      onChange={(e) => actualizarDestinatario(index, 'nombre', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    onClick={() => quitarFilaDestinatario(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={agregarFilaDestinatario}
                className="flex items-center px-3 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50"
              >
                <Plus className="w-4 h-4 mr-2" />
                Agregar fila
              </button>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAgregarForm(false)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={procesarAgregarDestinatarios}
                disabled={loading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? 'Agregando...' : 'Agregar Destinatarios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para quitar destinatarios */}
      {showQuitarForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-lg font-semibold">Quitar Destinatarios</h4>
              <button
                onClick={() => setShowQuitarForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Teléfonos a quitar (uno por línea):
              </label>
              <textarea
                value={telefonosAQuitar}
                onChange={(e) => setTelefonosAQuitar(e.target.value)}
                placeholder="5491168777888&#10;5491168777889&#10;..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 h-32"
              />
              <p className="text-xs text-gray-500 mt-1">
                Solo se pueden eliminar destinatarios con estado 'pendiente' o 'error'
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowQuitarForm(false)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={procesarQuitarDestinatarios}
                disabled={loading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? 'Eliminando...' : 'Quitar Destinatarios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAREA 4: Modal de Confirmación de Envío Manual */}
      {showModalConfirmarEnvio && datosEnvioPreparado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-lg font-semibold flex items-center">
                <MessageCircle className="w-5 h-5 mr-2 text-green-600" />
                Confirmar Envío Manual
              </h4>
              <button
                onClick={() => {
                  setShowModalConfirmarEnvio(false);
                  setDatosEnvioPreparado(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="mb-6 space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800 mb-2">
                  <strong>Campaña:</strong> {datosEnvioPreparado.campania_nombre}
                </p>
                <p className="text-sm text-blue-800 mb-2">
                  <strong>Destinatario:</strong> {datosEnvioPreparado.nombre_destino || 'Sin nombre'}
                </p>
                <p className="text-sm text-blue-800">
                  <strong>Teléfono:</strong> +{datosEnvioPreparado.telefono}
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-xs font-medium text-gray-600 mb-2">MENSAJE A ENVIAR:</p>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">
                  {datosEnvioPreparado.mensaje_final}
                </p>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-xs text-yellow-800">
                  ⚠️ Al presionar "Abrir WhatsApp", se abrirá una nueva ventana. 
                  Debes enviar el mensaje manualmente y luego confirmar en esta ventana.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowModalConfirmarEnvio(false);
                  setDatosEnvioPreparado(null);
                }}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarEnvioManual}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Abrir WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GestorDestinatarios;