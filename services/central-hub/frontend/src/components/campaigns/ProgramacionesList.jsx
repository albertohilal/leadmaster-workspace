import { useEffect, useState } from 'react';
import { senderAPI } from '../../services/api';

export default function ProgramacionesList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [estado, setEstado] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await senderAPI.listProgramaciones(estado ? { estado } : undefined);
      setItems(res.data || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  if (loading) return (
    <div className="p-6 bg-white rounded-lg shadow-sm border">
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-600">Cargando programaciones...</p>
      </div>
    </div>
  );
  
  if (!items.length) return (
    <div className="p-6 bg-white rounded-lg shadow-sm border">
      <h3 className="text-lg font-semibold mb-6">Programaciones Existentes</h3>
      <div className="text-center py-8">
        <p className="text-gray-500">📅 Todavía no registraste programaciones.</p>
        <p className="text-sm text-gray-400 mt-2">Crea una programación usando el formulario de la izquierda.</p>
      </div>
    </div>
  );

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm border">
      <h3 className="text-lg font-semibold mb-6">Programaciones Existentes</h3>
      
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Estado:</label>
          <select
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
          >
            <option value="">Todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="aprobada">Aprobada</option>
            <option value="rechazada">Rechazada</option>
            <option value="pausada">Pausada</option>
          </select>
        </div>
        <button
          onClick={load}
          className="ml-auto px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          🔄 Actualizar
        </button>
      </div>
      
      <div className="space-y-4">
        {items.map((p) => (
          <div key={p.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="font-semibold text-lg mb-3">{p.campania_nombre || `Campaña ${p.campania_id}`}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-600">📅 Días:</span>
                <span className="font-medium">{String(p.dias_semana || '').toUpperCase()}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-600">🕒 Horario:</span>
                <span className="font-medium">{p.hora_inicio} - {p.hora_fin}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-600">👥 Cupo diario:</span>
                <span className="font-medium">{p.cupo_diario}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-600">📊 Estado:</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  p.estado === 'aprobada' ? 'bg-green-100 text-green-800' :
                  p.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-800' :
                  p.estado === 'rechazada' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {p.estado}
                </span>
              </div>
            </div>
            {p.comentario_admin && (
              <div className="mt-3 p-3 bg-blue-50 rounded border-l-4 border-blue-400">
                <span className="text-sm font-medium text-blue-800">Comentario del Admin:</span>
                <p className="text-sm text-blue-700">{p.comentario_admin}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}