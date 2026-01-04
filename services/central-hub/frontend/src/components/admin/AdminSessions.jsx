import { useEffect, useState } from 'react';
import { senderAPI, sessionAPI } from '../../services/api';

export default function AdminSessions() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadSessions = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await sessionAPI.listSessions();
      setSessions(res);
    } catch (e) {
      setError(e.message || 'Error cargando sesiones');
    } finally {
      setLoading(false);
    }
  };

  const connect = async (clienteId) => {
    setLoading(true);
    try {
      await sessionAPI.adminLogin(clienteId);
      await loadSessions();
    } catch (e) {
      setError(e.message || 'Error conectando sesión');
    } finally {
      setLoading(false);
    }
  };

  const disconnect = async (clienteId) => {
    setLoading(true);
    try {
      await sessionAPI.adminLogout(clienteId);
      await loadSessions();
    } catch (e) {
      setError(e.message || 'Error desconectando sesión');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Sesiones WhatsApp (Admin)</h1>
        <button
          onClick={loadSessions}
          className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Refrescar
        </button>
      </div>

      {error && (
        <div className="mb-3 text-red-600">{error}</div>
      )}

      {loading ? (
        <div>Cargando...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="p-2">Cliente</th>
                <th className="p-2">Estado</th>
                <th className="p-2">Ready</th>
                <th className="p-2">Conectando</th>
                <th className="p-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.clienteId} className="border-b">
                  <td className="p-2">{s.clienteId}</td>
                  <td className="p-2">{s.state?.state}</td>
                  <td className="p-2">{String(s.state?.ready)}</td>
                  <td className="p-2">{String(s.state?.connecting)}</td>
                  <td className="p-2 flex gap-2">
                    <button
                      onClick={() => connect(s.clienteId)}
                      className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Conectar
                    </button>
                    <button
                      onClick={() => disconnect(s.clienteId)}
                      className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Desconectar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
