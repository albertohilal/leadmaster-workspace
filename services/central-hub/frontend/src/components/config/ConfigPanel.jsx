import React, { useState } from 'react';
import Card from '../common/Card';
import Button from '../common/Button';

const ConfigPanel = () => {
  const [config, setConfig] = useState({
    apiUrl: 'http://localhost:3010',
    openaiKey: '••••••••••••••••••••',
    sessionTimeout: 3600,
    retryAttempts: 3,
    pollingInterval: 5000
  });

  const [editing, setEditing] = useState(false);

  const handleSave = () => {
    // Implementar guardado
    alert('Configuración guardada (funcionalidad por implementar en backend)');
    setEditing(false);
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(config, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'leadmaster-config.json';
    link.click();
  };

  const handleImport = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target.result);
          setConfig(imported);
          alert('Configuración importada exitosamente');
        } catch (error) {
          alert('Error al importar configuración');
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="space-y-6">
      {/* Título */}
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Configuración del Sistema</h1>
        <p className="text-gray-600 mt-1">Ajusta los parámetros del sistema</p>
      </div>

      {/* API Backend */}
      <Card title="Configuración de API" icon="🔌">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              URL de API Backend
            </label>
            <input
              type="text"
              value={config.apiUrl}
              onChange={(e) => setConfig({ ...config, apiUrl: e.target.value })}
              disabled={!editing}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
            />
            <p className="text-xs text-gray-500 mt-1">
              URL base para conectar con el backend de LeadMaster
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              OpenAI API Key
            </label>
            <input
              type="password"
              value={config.openaiKey}
              onChange={(e) => setConfig({ ...config, openaiKey: e.target.value })}
              disabled={!editing}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
            />
            <p className="text-xs text-gray-500 mt-1">
              Clave de API para conectar con OpenAI (se almacena de forma segura)
            </p>
          </div>
        </div>
      </Card>

      {/* Parámetros del Sistema */}
      <Card title="Parámetros Generales" icon="⚙️">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Timeout de Sesión WhatsApp (segundos)
            </label>
            <input
              type="number"
              value={config.sessionTimeout}
              onChange={(e) => setConfig({ ...config, sessionTimeout: parseInt(e.target.value) })}
              disabled={!editing}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
            />
            <p className="text-xs text-gray-500 mt-1">
              Tiempo máximo de inactividad antes de cerrar la sesión
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reintentos de Envío
            </label>
            <input
              type="number"
              value={config.retryAttempts}
              onChange={(e) => setConfig({ ...config, retryAttempts: parseInt(e.target.value) })}
              disabled={!editing}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
            />
            <p className="text-xs text-gray-500 mt-1">
              Número de intentos antes de marcar un envío como fallido
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Intervalo de Actualización (ms)
            </label>
            <input
              type="number"
              value={config.pollingInterval}
              onChange={(e) => setConfig({ ...config, pollingInterval: parseInt(e.target.value) })}
              disabled={!editing}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
            />
            <p className="text-xs text-gray-500 mt-1">
              Frecuencia de actualización del dashboard y estado del sistema
            </p>
          </div>
        </div>

        <div className="flex justify-end space-x-2 mt-6">
          {!editing ? (
            <Button variant="primary" onClick={() => setEditing(true)}>
              Editar Configuración
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
              <Button variant="success" onClick={handleSave}>
                Guardar Cambios
              </Button>
            </>
          )}
        </div>
      </Card>

      {/* Backup/Restore */}
      <Card title="Backup y Restauración" icon="💾">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Exporta o importa la configuración del sistema para respaldar o transferir ajustes.
          </p>
          
          <div className="flex space-x-4">
            <Button variant="primary" onClick={handleExport}>
              📥 Exportar Configuración
            </Button>
            
            <label className="btn-secondary cursor-pointer inline-flex items-center space-x-2">
              <span>📤 Importar Configuración</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
            </label>
          </div>

          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Advertencia:</strong> Al importar una configuración, se sobrescribirán todos los valores actuales.
              Asegúrate de exportar una copia de seguridad antes de importar.
            </p>
          </div>
        </div>
      </Card>

      {/* Estado del Sistema */}
      <Card title="Estado de Servicios" icon="📊">
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-success rounded-full flex items-center justify-center text-white">
                ✓
              </div>
              <div>
                <p className="font-medium text-gray-800">API Backend</p>
                <p className="text-xs text-gray-600">http://localhost:3010</p>
              </div>
            </div>
            <span className="text-sm font-medium text-success">Online</span>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-success rounded-full flex items-center justify-center text-white">
                ✓
              </div>
              <div>
                <p className="font-medium text-gray-800">Base de Datos MySQL</p>
                <p className="text-xs text-gray-600">iunaorg_dyd</p>
              </div>
            </div>
            <span className="text-sm font-medium text-success">Conectada</span>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-success rounded-full flex items-center justify-center text-white">
                ✓
              </div>
              <div>
                <p className="font-medium text-gray-800">OpenAI API</p>
                <p className="text-xs text-gray-600">GPT-4</p>
              </div>
            </div>
            <span className="text-sm font-medium text-success">Activa</span>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-warning rounded-full flex items-center justify-center text-white">
                !
              </div>
              <div>
                <p className="font-medium text-gray-800">WhatsApp Session</p>
                <p className="text-xs text-gray-600">Venom Bot</p>
              </div>
            </div>
            <span className="text-sm font-medium text-warning">Verificando...</span>
          </div>
        </div>
      </Card>

      {/* Información del Sistema */}
      <Card title="Información del Sistema" icon="ℹ️">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Versión</p>
            <p className="text-lg font-medium text-gray-800">1.0.0</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Entorno</p>
            <p className="text-lg font-medium text-gray-800">Desarrollo</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Node.js</p>
            <p className="text-lg font-medium text-gray-800">v18.x</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Frontend</p>
            <p className="text-lg font-medium text-gray-800">React 18.2</p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ConfigPanel;
