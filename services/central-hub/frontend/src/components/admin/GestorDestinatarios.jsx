import React, { useState } from 'react';
import { Plus, Trash2, Upload, Download, Users, Phone, User, Search } from 'lucide-react';
import destinatariosService from '../../services/destinatarios';
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
    </div>
  );
};

export default GestorDestinatarios;