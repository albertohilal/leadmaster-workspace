import { useEffect, useState } from 'react';
import axios from 'axios';

const api = axios.create({
  baseURL: '/api/whatsapp-v2',
  timeout: 10000
});

export default function WhatsappSessionV2() {
  const [status, setStatus] = useState('checking');
  const [qr, setQr] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await api.get('/status');
      const newStatus = res?.data?.status || 'error';
      setStatus(newStatus);

      if (newStatus === 'qr_required') {
        fetchQr();
      }

      if (newStatus === 'ready') {
        setQr(null);
      }
    } catch (error) {
      setStatus('error');
    }
  };

  const fetchQr = async () => {
    try {
      const res = await api.get('/qr');
      if (res?.data?.status === 'qr_available') {
        setQr(res.data.qr);
      }
    } catch (_error) {
      setQr(null);
    }
  };

  const handleConnect = async () => {
    try {
      setLoading(true);
      await api.post('/connect');
      setTimeout(fetchStatus, 1500);
    } catch (_error) {
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ padding: '2rem' }}>
      <h2>WhatsApp Session (V2)</h2>

      <p>
        Estado actual: <strong>{status}</strong>
      </p>

      {status === 'qr_required' && (
        <button onClick={handleConnect} disabled={loading}>
          {loading ? 'Conectando...' : 'Generar QR'}
        </button>
      )}

      {qr && (
        <div style={{ marginTop: '2rem' }}>
          <img
            src={qr}
            alt="QR Code"
            style={{ width: '300px', border: '1px solid #ddd' }}
          />
        </div>
      )}

      {status === 'ready' && (
        <p style={{ color: 'green', marginTop: '1rem' }}>
          ✅ WhatsApp conectado correctamente
        </p>
      )}

      {status === 'error' && (
        <p style={{ color: 'red', marginTop: '1rem' }}>
          ❌ Error de conexión
        </p>
      )}
    </div>
  );
}