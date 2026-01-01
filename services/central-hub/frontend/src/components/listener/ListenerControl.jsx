import React, { useState, useEffect } from 'react';
import Card from '../common/Card';
import Button from '../common/Button';
import LoadingSpinner from '../common/LoadingSpinner';
import { listenerAPI } from '../../services/api';

const ListenerControl = () => {
  const [loading, setLoading] = useState(true);
  const [currentMode, setCurrentMode] = useState('off');
  const [logs, setLogs] = useState([]);
  const [filterPhone, setFilterPhone] = useState('');
  const [filterDate, setFilterDate] = useState('');

  useEffect(() => {
    loadListenerData();
    const interval = setInterval(loadListenerData, 10000); // actualizar cada 10 segundos
    return () => clearInterval(interval);
  }, []);

  const loadListenerData = async () => {
    try {
      const statusRes = await listenerAPI.getStatus();
      setCurrentMode(statusRes.data.mode || 'off');
      
      // Cargar logs (mock por ahora)
      const mockLogs = [
        {
          id: 1,
          fecha: '2025-12-14 10:30:15',
          telefono: '+5491112345678',
          mensaje: 'Hola, necesito información',
          respuesta_ia: 'Hola! En qué puedo ayudarte?',
          ia_activada: true
        },
        {
          id: 2,
          fecha: '2025-12-14 10:25:00',
          telefono: '+5491198765432',
          mensaje: 'Cuál es el precio?',
          respuesta_ia: null,
          ia_activada: false
        }
      ];
      setLogs(mockLogs);
    } catch (error) {
      console.error('Error loading listener data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChangeMode = async (newMode) => {
    try {
      await listenerAPI.setMode(newMode);
      setCurrentMode(newMode);
      alert(`Modo cambiado a: ${getModeText(newMode)}`);
    } catch (error) {
      console.error('Error changing mode:', error);
      alert('Error al cambiar modo');
    }
  };

  const getModeText = (mode) => {
    switch (mode) {
      case 'listen':
        return 'Escuchando';
      case 'respond':
        return 'Respondiendo';
      case 'off':
        return 'Desactivado';
      default:
        return mode;
    }
  };

  const getModeColor = (mode) => {
    switch (mode) {
      case 'listen':
        return 'bg-warning';
      case 'respond':
        return 'bg-success';
      case 'off':
        return 'bg-gray-400';
      default:
        return 'bg-gray-400';
    }
  };

  const getModeDescription = (mode) => {
    switch (mode) {
      case 'listen':
        return 'El sistema está escuchando mensajes pero no responde automáticamente';
      case 'respond':
        return 'El sistema responde automáticamente con IA a los mensajes entrantes';
      case 'off':
        return 'El sistema no está procesando mensajes';
      default:
        return '';
    }
  };

  const filteredLogs = logs.filter(log => {
    if (filterPhone && !log.telefono.includes(filterPhone)) return false;
    if (filterDate && !log.fecha.includes(filterDate)) return false;
    return true;
  });

  if (loading) {
    return <LoadingSpinner size="large" text="Cargando listener..." />;
  }

  return (
    <div className="space-y-6">
      {/* Título */}
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Control del Listener</h1>
        <p className="text-gray-600 mt-1">Gestiona la escucha y respuestas automáticas</p>
      </div>

      {/* Estado y Control de Modo */}
      <Card title="Modo Actual" icon="🤖">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <div className={`w-16 h-16 ${getModeColor(currentMode)} rounded-full flex items-center justify-center text-white text-2xl`}>
              {currentMode === 'respond' ? '✓' : currentMode === 'listen' ? '👂' : '×'}
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{getModeText(currentMode)}</p>
              <p className="text-sm text-gray-600 mt-1">{getModeDescription(currentMode)}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <Button
            variant={currentMode === 'off' ? 'secondary' : 'primary'}
            onClick={() => handleChangeMode('off')}
            className="flex-1"
          >
            <span className="text-xl mr-2">⏸️</span>
            Desactivar
          </Button>
          <Button
            variant={currentMode === 'listen' ? 'secondary' : 'primary'}
            onClick={() => handleChangeMode('listen')}
            className="flex-1"
          >
            <span className="text-xl mr-2">👂</span>
            Solo Escuchar
          </Button>
          <Button
            variant={currentMode === 'respond' ? 'secondary' : 'success'}
            onClick={() => handleChangeMode('respond')}
            className="flex-1"
          >
            <span className="text-xl mr-2">🤖</span>
            Responder con IA
          </Button>
        </div>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-semibold text-gray-800 mb-2">Información sobre los modos:</h4>
          <ul className="space-y-1 text-sm text-gray-700">
            <li><strong>Desactivar:</strong> El listener no procesa ningún mensaje</li>
            <li><strong>Solo Escuchar:</strong> Registra los mensajes pero no responde</li>
            <li><strong>Responder con IA:</strong> Responde automáticamente solo a leads con IA habilitada</li>
          </ul>
        </div>
      </Card>

      {/* Filtros de Logs */}
      <Card title="Filtros" icon="🔍">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Filtrar por teléfono</label>
            <input
              type="text"
              placeholder="+549..."
              value={filterPhone}
              onChange={(e) => setFilterPhone(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Filtrar por fecha</label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <div className="flex items-end">
            <Button
              variant="secondary"
              onClick={() => {
                setFilterPhone('');
                setFilterDate('');
              }}
            >
              Limpiar filtros
            </Button>
          </div>
        </div>
      </Card>

      {/* Logs de Mensajes */}
      <Card title="Mensajes Recibidos" icon="📨">
        <div className="mb-4 text-sm text-gray-600">
          Mostrando {filteredLogs.length} de {logs.length} mensajes
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Teléfono</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mensaje</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Respuesta IA</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado IA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-4 py-8 text-center text-gray-500">
                    No hay mensajes para mostrar
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600">{log.fecha}</td>
                    <td className="px-4 py-3 text-sm text-gray-800">{log.telefono}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                      {log.mensaje}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                      {log.respuesta_ia || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          log.ia_activada
                            ? 'bg-success text-white'
                            : 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        {log.ia_activada ? '✓ IA Activa' : 'Sin IA'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <div className="text-center py-4">
            <p className="text-sm text-gray-600">Mensajes Hoy</p>
            <p className="text-4xl font-bold text-gray-800 mt-2">{logs.length}</p>
          </div>
        </Card>
        <Card>
          <div className="text-center py-4">
            <p className="text-sm text-gray-600">Con Respuesta IA</p>
            <p className="text-4xl font-bold text-success mt-2">
              {logs.filter(l => l.respuesta_ia).length}
            </p>
          </div>
        </Card>
        <Card>
          <div className="text-center py-4">
            <p className="text-sm text-gray-600">Tasa de Respuesta</p>
            <p className="text-4xl font-bold text-primary mt-2">
              {logs.length > 0
                ? Math.round((logs.filter(l => l.respuesta_ia).length / logs.length) * 100)
                : 0}
              %
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ListenerControl;
